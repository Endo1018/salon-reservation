'use server';

import prisma from '@/lib/db';
import { revalidatePath } from 'next/cache';
import * as XLSX from 'xlsx';

export async function importAttendanceFromExcel(formData: FormData) {
    const file = formData.get('file') as File;
    if (!file) {
        return { success: false, message: 'No file uploaded' };
    }

    try {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const workbook = XLSX.read(buffer, { type: 'buffer' });

        // User said 3rd sheet has the data
        if (workbook.SheetNames.length < 3) {
            return { success: false, message: 'Excel file does not have 3 sheets' };
        }
        const sheetName = workbook.SheetNames[2];
        const worksheet = workbook.Sheets[sheetName];

        // Convert to array of arrays
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        // Inspect header row (Row 4, 0-indexed is 3) for Dates
        const dateRowIndex = 1;
        const entryRowStartIndex = 4;

        const dateRow = data[dateRowIndex];
        if (!dateRow) return { success: false, message: 'Invalid format: Date Row missing' };

        // Identify Date columns
        const dateCols: { dateStr: string; colIndex: number }[] = [];
        for (let i = 0; i < dateRow.length; i++) {
            const cell = dateRow[i];
            if (typeof cell === 'string' && cell.includes('/')) {
                const prevCell = i > 0 ? dateRow[i - 1] : null;
                if (cell === prevCell) {
                    continue;
                }
                dateCols.push({ dateStr: cell, colIndex: i });
            }
        }

        const year = 2026;

        let updateCount = 0;
        const processedStaffIds: string[] = [];
        const missingStaffIds: string[] = [];

        // --- 1. Map Rows to Staff IDs (Handling Merged/Empty Cells) ---
        // Map<StaffId, RowIndex[]>
        const staffRowMap = new Map<string, number[]>();
        let currentStaffId: string | null = null;
        const validStaffIds = new Set<string>();

        // Pre-fetch all staff to validate IDs
        const allStaff = await prisma.staff.findMany();
        const dbStaffIds = new Set(allStaff.map(s => s.id));

        for (let i = entryRowStartIndex; i < data.length; i++) {
            const row = data[i];
            if (!row || row.length < 3) continue;

            let cellId = row[1]; // Col B: Mã nhân viên

            if (cellId) {
                // New Staff ID block
                const sId = String(cellId).trim();
                // Check if this looks like a staff ID (e.g. starts with NV or S or matches DB)
                // The screenshot shows "NV000037". 
                // We should verify against DB to be safe, OR assume valid format.
                // Assuming if it matches a DB ID, it's a new block.
                if (dbStaffIds.has(sId)) {
                    currentStaffId = sId;
                } else {
                    // Unknown ID or just random text? 
                    // If it looks like an ID, log it. If it's empty, ignore.
                    // For now, if we found a match in DB, switch.
                    // If not match, maybe it's just "CA 1" text in wrong col? Unlikely.
                    missingStaffIds.push(sId);
                    // Reset current if we hit a clearly invalid ID line that pretends to be a header?
                    // Safer to just keep currentStaffId null if invalid.
                    currentStaffId = null;
                }
            }

            // If we have a current valid Staff ID, associate this row
            if (currentStaffId) {
                if (!staffRowMap.has(currentStaffId)) {
                    staffRowMap.set(currentStaffId, []);
                }
                staffRowMap.get(currentStaffId)!.push(i);
                validStaffIds.add(currentStaffId);
            }
        }

        // --- 2. Process Each Staff ---
        for (const staffId of validStaffIds) {
            const rowIndices = staffRowMap.get(staffId)!;
            const staff = allStaff.find(s => s.id === staffId)!;

            let staffHasUpdate = false;

            // Iterate Dates
            for (const { dateStr, colIndex } of dateCols) {
                const [day, month] = dateStr.split('/').map(Number);
                const dateObj = new Date(Date.UTC(year, month - 1, day));

                // Extract best start/end from ALL rows for this staff
                let rawStart: string | null = null;
                let rawEnd: string | null = null;

                // Priority: We just need to find *data*. 
                // Assumption: A staff only works ONE shift type per day.
                // If multiple rows have data, we pick the first valid one found?
                // Or merge? (Earliest start, Latest end).
                // Let's use Earliest Start and Latest End to be safe if split across rows.

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const cleanTime = (t: any) => {
                    if (!t) return null;
                    const s = String(t).trim();
                    if (s.match(/^\d{1,2}:\d{2}$/)) return s;
                    if (s.match(/^\d{1,2}:\d{2}:\d{2}$/)) return s.slice(0, 5);
                    return null;
                };

                let minStartMin = 9999;
                let maxEndMin = -1;
                let foundData = false;

                for (const rIdx of rowIndices) {
                    const r = data[rIdx];
                    const s = cleanTime(r[colIndex]);
                    const e = cleanTime(r[colIndex + 1]);

                    if (s) {
                        const [h, m] = s.split(':').map(Number);
                        const mins = h * 60 + m;
                        if (mins < minStartMin) {
                            minStartMin = mins;
                            rawStart = s;
                        }
                        foundData = true;
                    }
                    if (e) {
                        const [h, m] = e.split(':').map(Number);
                        const mins = h * 60 + m;
                        // Handle overnight? If end < start, add 24h. 
                        // But we just want the string.
                        // Let's just take the non-null end associated with the start?
                        // Actually, simple overwrite is risky.
                        // If Row 1 has 10:00 - 19:00, Row 2 is empty.
                        // If Row 1 is empty, Row 2 has 13:00 - 22:00.
                        // We just grab the one that exists.
                        if (!rawEnd || mins > maxEndMin) { // Use latest end? 
                            maxEndMin = mins;
                            rawEnd = e;
                        }
                        foundData = true;
                    }
                }

                if (!foundData) {
                    rawStart = null;
                    rawEnd = null;
                }

                // --- Logic Reuse (Rounding, Calc, Upsert) ---

                // --- Rounding Logic for Attendance ---
                let attStart = rawStart;
                let attEnd = rawEnd;

                if (staff.role === 'RECEPTION') {
                    // --- RECEPTION RULES ---
                    // Pattern 1: Early Shift (10:00 - 19:00)
                    // Start: 09:30 ~ 10:00 -> 10:00
                    if (attStart) {
                        const [h, m] = attStart.split(':').map(Number);
                        const min = h * 60 + m;
                        if (min >= 9 * 60 + 30 && min <= 10 * 60) {
                            attStart = "10:00";
                        }
                        // Also apply strict late shift start rounding if applicable?
                        // User mentioned 2 patterns (10:00 and 13:00).
                        // Let's apply the 13:00 rule too if it hits that range.
                        if (h === 12 && m >= 40) {
                            attStart = "13:00";
                        }
                    }

                    // End: 18:45 ~ 19:10 -> 19:00
                    if (attEnd) {
                        const [h, m] = attEnd.split(':').map(Number);
                        const min = h * 60 + m;
                        if (min >= 18 * 60 + 45 && min <= 19 * 60 + 10) {
                            attEnd = "19:00";
                        }
                        // Also apply late shift end rounding (22:00)
                        if ((h === 21 && m >= 31) || (h === 22 && m <= 4)) {
                            attEnd = "22:00";
                        }
                    }

                } else {
                    // --- THERAPIST / OTHER RULES ---
                    // Start: 12:40 ~ 12:59 -> 13:00
                    if (attStart) {
                        const [h, m] = attStart.split(':').map(Number);
                        if (h === 12 && m >= 40) {
                            attStart = "13:00";
                        }
                    }

                    // End: 21:31 ~ 22:04 -> 22:00
                    if (attEnd) {
                        const [h, m] = attEnd.split(':').map(Number);
                        if ((h === 21 && m >= 31) || (h === 22 && m <= 4)) {
                            attEnd = "22:00";
                        }
                    }
                }

                // --- Calculate Work Hours (Attendance) ---
                let workHours = 0;
                const breakTime = 1.0;

                if (attStart && attEnd) {
                    const [h1, m1] = attStart.split(':').map(Number);
                    const [h2, m2] = attEnd.split(':').map(Number);
                    const startMin = h1 * 60 + m1;
                    const endMin = h2 * 60 + m2;
                    let diff = (endMin - startMin) / 60;
                    if (diff < 0) diff += 24;
                    const netDiff = Math.max(0, diff - breakTime);
                    workHours = Number(netDiff.toFixed(2));
                }

                const existing = await prisma.attendance.findFirst({
                    where: { staffId: staff.id, date: dateObj }
                });

                if (existing) {
                    await prisma.attendance.update({
                        where: { id: existing.id },
                        data: {
                            start: attStart || null,
                            end: attEnd || null,
                            workHours: workHours,
                            breakTime: breakTime,
                            status: (!attStart && !attEnd) ? 'Off' : ((!attStart || !attEnd) ? 'Error' : 'Normal')
                        }
                    });

                    // Sync Shift (Raw)
                    const existingShift = await prisma.shift.findFirst({
                        where: { staffId: staff.id, date: dateObj }
                    });
                    if (existingShift) {
                        if (!rawStart && !rawEnd) {
                            await prisma.shift.update({
                                where: { id: existingShift.id },
                                data: { start: null, end: null, status: 'Off' }
                            });
                        } else if (rawStart && rawEnd) {
                            await prisma.shift.update({
                                where: { id: existingShift.id },
                                data: { start: rawStart, end: rawEnd, status: 'Confirmed' }
                            });
                        }
                    }

                } else if (rawStart && rawEnd) {
                    await prisma.attendance.create({
                        data: {
                            staffId: staff.id, date: dateObj, start: attStart, end: attEnd,
                            workHours: workHours, breakTime: breakTime, status: 'Normal'
                        }
                    });

                    // Sync Create Shift
                    const existingShift = await prisma.shift.findFirst({
                        where: { staffId: staff.id, date: dateObj }
                    });
                    if (!existingShift) {
                        await prisma.shift.create({
                            data: { staffId: staff.id, date: dateObj, start: rawStart, end: rawEnd, status: 'Confirmed' }
                        });
                    } else {
                        await prisma.shift.update({
                            where: { id: existingShift.id },
                            data: { start: rawStart, end: rawEnd, status: 'Confirmed' }
                        });
                    }
                }

                staffHasUpdate = true;
                updateCount++;
            }
            processedStaffIds.push(staffId);
        }

        revalidatePath('/admin/attendance');
        const uniqueMissing = Array.from(new Set(missingStaffIds));
        let msg = `Process Complete.\nUpdated Records: ${updateCount}\nProcessed Staff: ${processedStaffIds.join(', ')}`;
        if (uniqueMissing.length > 0) {
            msg += `\n\nUnknown IDs (Not in DB): ${uniqueMissing.join(', ')}`;
        }
        return { success: true, message: msg };

    } catch (e) {
        console.error(e);
        return { success: false, message: 'Failed to process file: ' + (e instanceof Error ? e.message : String(e)) };
    }
}
