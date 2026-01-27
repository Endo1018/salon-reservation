'use server';

import prisma from '@/lib/db';
import { revalidatePath } from 'next/cache';

export async function updateAttendance(
    id: number,
    start: string,
    end: string,
    workHours: number,
    breakTime: number,
    overtime: number,
    isOvertime: boolean,
    status: string = 'Normal',
    shiftStart: string | null = null,
    shiftEnd: string | null = null,
    lateTimeOverride: number | null = null
) {
    console.log(`[updateAttendance] ID: ${id}, AtStart: ${start}, AtEnd: ${end}, ShiftStart: ${shiftStart}, ShiftEnd: ${shiftEnd}, LateOverride: ${lateTimeOverride}`);
    try {
        const att = await prisma.attendance.update({
            where: { id },
            data: {
                start,
                end,
                workHours,
                breakTime,
                overtime,
                isOvertime,
                status,
                isManual: true,
                lateTimeOverride, // Save override
            },
        });

        // Update linked Shift if provided
        if (shiftStart && shiftEnd) {
            // Find shift by staff/date
            const existingShift = await prisma.shift.findFirst({
                where: {
                    staffId: att.staffId,
                    date: att.date
                }
            });

            if (existingShift) {
                await prisma.shift.update({
                    where: { id: existingShift.id },
                    data: {
                        start: shiftStart,
                        end: shiftEnd
                    }
                });
            } else {
                // Should we create one if missing? 
                // Probably yes, to ensure the Late/Early calculation holds for future.
                await prisma.shift.create({
                    data: {
                        staffId: att.staffId,
                        date: att.date,
                        start: shiftStart,
                        end: shiftEnd,
                        status: 'Confirmed'
                    }
                });
            }
        }

        console.log(`[updateAttendance] Success.`);
        revalidatePath('/admin/attendance');
    } catch (e) {
        console.error(`[updateAttendance] Error:`, e);
        throw e;
    }
}

export async function deleteAttendance(id: number) {
    try {
        await prisma.attendance.delete({
            where: { id },
        });
        revalidatePath('/admin/attendance');
    } catch (e) {
        console.error(`[deleteAttendance] Error:`, e);
        throw e;
    }
}

export async function deleteAllAttendance(year?: number, month?: number) {
    try {
        let whereClause: any = {
            status: { not: 'AL' } // Protect AL
        };

        if (year !== undefined && month !== undefined) {
            // Scope to specific month
            // month is 0-indexed in JS Date, but usually 1-indexed in UI? 
            // In ShiftPage: month = today.getMonth() (0-indexed).
            // Let's assume input is 0-indexed for consistency with Date() constructor.
            const startDate = new Date(Date.UTC(year, month, 1));
            const endDate = new Date(Date.UTC(year, month + 1, 1));

            whereClause.date = {
                gte: startDate,
                lt: endDate
            };
        }

        // Delete Attendance (except AL)
        await prisma.attendance.deleteMany({
            where: whereClause
        });

        // Delete Shifts (except AL)
        // Check if Shift has status 'AL'? 
        // Assuming Shift status also uses 'AL' or similar. 
        // If Shift status for AL is 'AL' or 'Planned Leave', we should protect it.
        // User said "AL is remaining".
        // Let's apply same logic to Shift.
        await prisma.shift.deleteMany({
            where: {
                ...whereClause,
                status: { not: 'AL' }
            }
        });

        revalidatePath('/admin/attendance');
        revalidatePath('/admin/shifts');
    } catch (e) {
        console.error(`[deleteAllAttendance] Error:`, e);
        throw e;
    }
}


export async function clockIn(staffId: string) {
    // Get current time in Vietnam
    const now = new Date();
    // vnTimeFormatter removed (unused)

    // Format: "YYYY-MM-DD, HH:mm" (depends on locale, en-CA gives YYYY-MM-DD)
    // Actually safer to parse parts or use ISO-like string if possible.
    // Let's use simple approach:
    const vnDateStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }); // "2026-01-14"
    const vnTimeStr = now.toLocaleTimeString('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' }); // "13:47"

    // Create a Date object for the "date" field (Midnight VN time represented as UTC or just consistent date)
    // We will store the "Date" part as a simple Date object. 
    // Prisma/Postgres stores as timestamp. Let's start "today" as `2026-01-14T00:00:00.000Z` to ensure uniqueness for the day.
    const today = new Date(vnDateStr + 'T00:00:00.000Z');

    // Check if already clocked in
    const existing = await prisma.attendance.findFirst({
        where: {
            staffId,
            date: today,
        },
    });

    if (existing) {
        return { success: false, message: 'Already clocked in for today.' };
    }

    await prisma.attendance.create({
        data: {
            staffId,
            date: today,
            start: vnTimeStr,
            status: 'Normal',
        },
    });

    revalidatePath(`/dashboard/${staffId}`);
    return { success: true };
}

export async function clockOut(staffId: string) {
    const now = new Date();
    const vnDateStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }); // "2026-01-14"
    const vnTimeStr = now.toLocaleTimeString('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' }); // "13:47"
    const today = new Date(vnDateStr + 'T00:00:00.000Z');

    // Find today's record
    const existing = await prisma.attendance.findFirst({
        where: {
            staffId,
            date: today,
        },
    });

    if (!existing) {
        return { success: false, message: 'No attendance record found for today.' };
    }

    // Simple work hours diff (Decimal hours)
    let workHours = 0;
    const breakTime = 1.0;
    if (existing.start) {
        const [h1, m1] = existing.start.split(':').map(Number);
        const [h2, m2] = vnTimeStr.split(':').map(Number);
        const startMin = h1 * 60 + m1;
        const endMin = h2 * 60 + m2;
        let diff = (endMin - startMin) / 60;
        if (diff < 0) diff += 24; // Overnight
        workHours = Math.max(0, diff - breakTime);
    }

    await prisma.attendance.update({
        where: { id: existing.id },
        data: {
            end: vnTimeStr,
            workHours: Number(workHours.toFixed(2)),
            breakTime: breakTime
        },
    });

    revalidatePath(`/dashboard/${staffId}`);
    return { success: true };
}
