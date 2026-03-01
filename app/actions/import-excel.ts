'use server';

import prisma from '@/lib/db';
import { revalidatePath } from 'next/cache';
import * as XLSX from 'xlsx';
import { Attendance, Shift } from '@prisma/client';

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

        // Dynamically determine year from date columns (DD/MM/YYYY) or fallback to current year
        let year = new Date().getFullYear();
        for (const { dateStr } of dateCols) {
            const parts = dateStr.split('/');
            if (parts.length === 3 && parts[2]?.length === 4) {
                year = parseInt(parts[2]);
                break;
            }
        }

        const validStaffIds = new Set<string>();

        // Vars that were accidentally removed
        const staffRowMap = new Map<string, number[]>();
        let currentStaffId: string | null = null;
        const processedStaffIds: string[] = [];
        const missingStaffIds: string[] = [];

        // Pre-fetch all staff to validate IDs
        const allStaff = await prisma.staff.findMany();
        const dbStaffIds = new Set(allStaff.map((s: { id: string }) => s.id));

        for (let i = entryRowStartIndex; i < data.length; i++) {
            const row = data[i];
            // ... 
            // (I need to be careful with range. updateCount is at line 51.)
            // Let's split into two chunks.

            if (!row || row.length < 3) continue;

            const cellId = row[1]; // Col B: Mã nhân viên

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

        // --- 2. Bulk Fetch Existing Data ---
        // Find Date Range
        const firstDateStr = dateCols[0].dateStr;
        const lastDateStr = dateCols[dateCols.length - 1].dateStr;
        const [fDay, fMonth] = firstDateStr.split('/').map(Number);
        const [lDay, lMonth] = lastDateStr.split('/').map(Number);

        // Construct Date objects manually to ensure correct UTC mapping as used in other parts
        // Assuming year 2026 as per code
        const startRange = new Date(Date.UTC(year, fMonth - 1, fDay));
        const endRange = new Date(Date.UTC(year, lMonth - 1, lDay));
        // Add 1 day to endRange for exclusive upper bound if needed, or just use lte
        // Logic below uses exact dates, so range filter is good optimization.

        const validStaffIdsArray = Array.from(validStaffIds);

        const [existingAttendances, existingShifts] = await Promise.all([
            prisma.attendance.findMany({
                where: {
                    staffId: { in: validStaffIdsArray },
                    date: { gte: startRange, lte: endRange }
                }
            }),
            prisma.shift.findMany({
                where: {
                    staffId: { in: validStaffIdsArray },
                    date: { gte: startRange, lte: endRange }
                }
            })
        ]);

        // Access Maps: Key = `${staffId}-${date.toISOString()}`
        // Using toISOString() key is safe if dates are stored consistently as UTC midnight.
        const attendanceMap = new Map<string, Attendance>();
        existingAttendances.forEach((a: Attendance) => attendanceMap.set(`${a.staffId}-${a.date.toISOString()}`, a));

        const shiftMap = new Map<string, Shift>();
        existingShifts.forEach((s: Shift) => shiftMap.set(`${s.staffId}-${s.date.toISOString()}`, s));

        // --- 3. Prepare Operations ---
        const operations: (() => Promise<any>)[] = [];

        // Helper to queue op
        let successfulUpdates = 0;

        for (const staffId of validStaffIds) {
            const rowIndices = staffRowMap.get(staffId)!;
            const staff = allStaff.find(s => s.id === staffId)!;
            let staffHasUpdate = false;

            for (const { dateStr, colIndex } of dateCols) {
                const [day, month] = dateStr.split('/').map(Number);
                const dateObj = new Date(Date.UTC(year, month - 1, day));
                const key = `${staffId}-${dateObj.toISOString()}`;

                // --- Extract best start/end (Same logic as before) ---
                const cleanTime = (t: unknown) => {
                    if (!t) return null;
                    const s = String(t).trim();
                    if (s.match(/^\d{1,2}:\d{2}$/)) return s;
                    if (s.match(/^\d{1,2}:\d{2}:\d{2}$/)) return s.slice(0, 5);
                    return null;
                };

                let rawStart: string | null = null;
                let rawEnd: string | null = null;
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
                        if (!rawEnd || mins > maxEndMin) {
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

                // --- Rounding Logic (Same) ---
                let attStart = rawStart;
                let attEnd = rawEnd;

                if (staff.role === 'RECEPTION') {
                    if (attStart) {
                        const [h, m] = attStart.split(':').map(Number);
                        const min = h * 60 + m;
                        if (min >= 9 * 60 + 30 && min <= 10 * 60) attStart = "10:00";
                        if (h === 12 && m >= 40) attStart = "13:00";
                    }
                    if (attEnd) {
                        const [h, m] = attEnd.split(':').map(Number);
                        const min = h * 60 + m;
                        if (min >= 18 * 60 + 45 && min <= 19 * 60 + 10) attEnd = "19:00";
                        if ((h === 21 && m >= 31) || (h === 22 && m <= 4)) attEnd = "22:00";
                    }
                } else {
                    if (attStart) {
                        const [h, m] = attStart.split(':').map(Number);
                        if (h === 12 && m >= 40) attStart = "13:00";
                    }
                    if (attEnd) {
                        const [h, m] = attEnd.split(':').map(Number);
                        if ((h === 21 && m >= 31) || (h === 22 && m <= 4)) attEnd = "22:00";
                    }
                }

                // --- Calc Work Hours ---
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

                // --- Queue DB Ops ---
                const existing = attendanceMap.get(key);
                const existingShift = shiftMap.get(key);

                if (existing) {
                    if (!existing.isManual) {
                        // Queue Attendance Update
                        operations.push(() => prisma.attendance.update({
                            where: { id: existing.id },
                            data: {
                                start: attStart || null,
                                end: attEnd || null,
                                workHours, breakTime,
                                status: (!attStart && !attEnd) ? 'Off' : ((!attStart || !attEnd) ? 'Error' : 'Normal')
                            }
                        }));

                        // Queue Shift Update
                        if (existingShift) {
                            if (!rawStart && !rawEnd) {
                                operations.push(() => prisma.shift.update({
                                    where: { id: existingShift.id },
                                    data: { start: null, end: null, status: 'Off' }
                                }));
                            } else if (rawStart && rawEnd) {
                                operations.push(() => prisma.shift.update({
                                    where: { id: existingShift.id },
                                    data: { start: rawStart, end: rawEnd, status: 'Confirmed' }
                                }));
                            }
                        } else if (rawStart && rawEnd) {
                            // Create Shift if missing
                            operations.push(() => prisma.shift.create({
                                data: { staffId: staff.id, date: dateObj, start: rawStart, end: rawEnd, status: 'Confirmed' }
                            }));
                        }
                        staffHasUpdate = true;
                    }
                } else if (rawStart && rawEnd) {
                    // Create Attendance
                    operations.push(() => prisma.attendance.create({
                        data: {
                            staffId: staff.id, date: dateObj, start: attStart, end: attEnd,
                            workHours, breakTime, status: 'Normal'
                        }
                    }));

                    // Create/Update Shift
                    // Note: If we are creating attendance, shift might still exist (unlikely but possible)
                    if (existingShift) {
                        operations.push(() => prisma.shift.update({
                            where: { id: existingShift.id },
                            data: { start: rawStart, end: rawEnd, status: 'Confirmed' }
                        }));
                    } else {
                        operations.push(() => prisma.shift.create({
                            data: { staffId: staff.id, date: dateObj, start: rawStart, end: rawEnd, status: 'Confirmed' }
                        }));
                    }
                    staffHasUpdate = true;
                }
            } // end date loop

            if (staffHasUpdate) successfulUpdates++;
            processedStaffIds.push(staffId);
        }

        // --- 4. Execute Batched Operations ---
        console.log(`[Import] Executing ${operations.length} DB operations...`);

        const BATCH_SIZE = 50;
        for (let i = 0; i < operations.length; i += BATCH_SIZE) {
            const batch = operations.slice(i, i + BATCH_SIZE);
            await Promise.all(batch.map(op => op()));
        }

        revalidatePath('/admin/attendance');
        revalidatePath('/admin/shifts');

        const uniqueMissing = Array.from(new Set(missingStaffIds));
        let msg = `取込完了 (Import Complete)\n`;
        msg += `・対象スタッフ数 (Processed Staff): ${processedStaffIds.length}\n`;
        msg += `・データ更新有り (Updated Staff): ${successfulUpdates}\n`;

        if (uniqueMissing.length > 0) {
            msg += `\n⚠️ 不明なスタッフID (Unknown IDs): ${uniqueMissing.join(', ')}`;
        }

        return { success: true, message: msg };


    } catch (e) {
        console.error(e);
        return { success: false, message: 'Failed to process file: ' + (e instanceof Error ? e.message : String(e)) };
    }
}
