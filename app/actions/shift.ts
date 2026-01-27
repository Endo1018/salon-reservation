'use server';

import prisma from '@/lib/db';
import { revalidatePath } from 'next/cache';

export async function upsertShift(staffId: string, dateStr: string, status: string, start: string, end: string) {
    // dateStr is expected to be "YYYY-MM-DD" or ISO. 
    // If ISO "2026-01-01T17:00:00.000Z" (VN midnight), new Date(dateStr) works.
    // BUT to be safe and avoid "previous day" issues, let's normalize to UTC Midnight of that Date string.

    // Recommended: dateStr passed from client should be YYYY-MM-DD
    // If client sends ISO, parse accurately.
    // Let's assume client sends "YYYY-MM-DD" OR we parse the date part only.

    const d = new Date(dateStr);
    // Force UTC Midnight:
    // This removes time components and timezone offsets, ensuring "2026-01-01" is stored as "2026-01-01T00:00:00Z" (or whatever Prisma uses).
    // Actually, safer to treat input as YYYY-MM-DD only.

    // Better approach: Create Date from YYYY, MM, DD relative to UTC
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));

    // Find existing shift
    const existing = await prisma.shift.findFirst({
        where: {
            staffId: staffId,
            date: date,
        },
    });

    if (status === 'DELETE') {
        if (existing) {
            await prisma.shift.delete({
                where: { id: existing.id },
            });
        }
        // If not exists, do nothing (already deleted)
    } else if (existing) {
        await prisma.shift.update({
            where: { id: existing.id },
            data: { status, start, end },
        });
    } else {
        await prisma.shift.create({
            data: {
                staffId,
                date,
                status,
                start,
                end,
            },
        });
    }

    revalidatePath('/admin/shifts');
    revalidatePath(`/dashboard/${staffId}`);
    revalidatePath('/admin'); // Revalidate Admin Dashboard

    // Sync to Attendance
    if (status !== 'DELETE') {
        let workHours = 0;
        let newStart: string | null = null;
        let newEnd: string | null = null;
        let newStatus = 'Normal';

        if (status === 'Off') {
            newStatus = 'Off';
            newStart = null;
            newEnd = null;
            workHours = 0;
        } else if (status === 'AL') {
            // Treat AL as Paid Leave (no work hours, just marked)
            newStatus = 'AL';
            newStart = null;
            newEnd = null;
            workHours = 0;
        } else if (start && end) {
            // Calculate Duration
            const [h1, m1] = start.split(':').map(Number);
            const [h2, m2] = end.split(':').map(Number);
            const startMin = h1 * 60 + m1;
            const endMin = h2 * 60 + m2;
            let diff = (endMin - startMin) / 60;
            if (diff < 0) diff += 24;
            workHours = Number(diff.toFixed(2));
            newStart = start;
            newEnd = end;
        } else {
            // If Confirmed but no times? Skip sync or treat as error?
            // For now, only sync if we have explicit Off or explicit Times.
            return;
        }

        const existingAttendance = await prisma.attendance.findFirst({
            where: {
                staffId: staffId,
                date: date
            }
        });

        if (existingAttendance) {
            await prisma.attendance.update({
                where: { id: existingAttendance.id },
                data: {
                    start: newStart,
                    end: newEnd,
                    workHours,
                    status: newStatus
                }
            });
        } else {
            await prisma.attendance.create({
                data: {
                    staffId,
                    date,
                    start: newStart,
                    end: newEnd,
                    workHours,
                    status: newStatus
                }
            });
        }
        revalidatePath('/admin/attendance');
    }
}
// ... existing upsertShift ...

export async function copyShiftsFromPreviousMonth(targetYear: number, targetMonth: number) {
    // 1. Determine Previous Month
    let prevYear = targetYear;
    let prevMonth = targetMonth - 1;
    if (prevMonth < 1) {
        prevYear--;
        prevMonth = 12;
    }

    // 2. Fetch Previous Shifts
    const prevStart = new Date(Date.UTC(prevYear, prevMonth - 1, 1));
    const prevEnd = new Date(Date.UTC(prevYear, prevMonth, 0, 23, 59, 59));

    const prevShifts = await prisma.shift.findMany({
        where: {
            date: {
                gte: prevStart,
                lte: prevEnd
            }
        }
    });

    if (prevShifts.length === 0) {
        return { success: false, message: 'No shifts found in previous month to copy.' };
    }

    let count = 0;
    const targetDaysInMonth = new Date(targetYear, targetMonth, 0).getDate();

    // 3. Copy Loop
    for (const shift of prevShifts) {
        const day = shift.date.getUTCDate();
        if (day > targetDaysInMonth) continue; // Skip days that don't exist in target (e.g. 31st)

        const targetDate = new Date(Date.UTC(targetYear, targetMonth - 1, day));

        // Create New Shift
        // Avoid overwriting existing target shifts? Or overwrite? 
        // User usually wants to fill blanks. Let's start with "Upsert" but maybe skip if status is not default?
        // Simple Logic: Upsert.

        await prisma.shift.upsert({
            where: {
                staffId_date: {
                    staffId: shift.staffId,
                    date: targetDate
                }
            },
            create: {
                staffId: shift.staffId,
                date: targetDate,
                status: shift.status,
                start: shift.start,
                end: shift.end
            },
            update: {
                // Optional: Don't overwrite if it exists? 
                // For now, let's overwrite to ensure full copy, user can edit later.
                status: shift.status,
                start: shift.start,
                end: shift.end
            }
        });
        count++;
    }

    revalidatePath('/admin/shifts');
    return { success: true, message: `Copied ${count} shifts from ${prevMonth}/${prevYear}.` };
}
