'use server';

import prisma from '@/lib/db';
import { revalidatePath } from 'next/cache';

/**
 * Syncs daily statistics for a specific staff member on a specific date.
 * aggregates booking durations -> perfHours (Commission Base)
 * aggregates Shift/Clock-in -> workHours (Base Salary Base)
 */
export async function syncDailyStats(date: Date, staffId: string) {
    // 1. Define Day Range (UTC)
    // We assume the date passed is 00:00 UTC or adjusted to be the representive "Day".
    // Our Bookings are stored in UTC. 
    // We need to match bookings that *start* on this day (or overlap?).
    // Usually Commission is based on "Completed Bookings" starting on this day.

    // Normalize to Start/End of Day in UTC (assuming input date is correct "Day")
    // If input is "2026-02-05T00:00:00.000Z", we want 00:00 - 23:59.
    const startOfDay = new Date(date);
    startOfDay.setUTCHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setUTCHours(23, 59, 59, 999);

    // 2. Fetch Bookings
    const bookings = await prisma.booking.findMany({
        where: {
            staffId: staffId,
            startAt: { gte: startOfDay },
            endAt: { lte: endOfDay },
            status: { not: 'Cancelled' }
        },
        include: { service: true }
    });

    // 3. Calculate Performance Hours (Treatment Time)
    let totalMinutes = 0;

    for (const booking of bookings) {
        // Use actual duration (End - Start)
        const duration = (booking.endAt.getTime() - booking.startAt.getTime()) / 60000;
        totalMinutes += duration;
    }

    const perfHours = Math.round((totalMinutes / 60) * 100) / 100; // Round to 2 decimals

    // 4. Update or Create Attendance Record
    // Check if exists
    const existing = await prisma.attendance.findFirst({
        where: {
            staffId,
            date: {
                gte: startOfDay,
                lte: endOfDay
            }
        }
    });

    if (existing) {
        // Update existing
        // Only update perfHours? Or also workHours if missing?
        // Rule: If `isManual` is false, we can potentially overwrite workHours from Shift.
        // For now, let's ONLY update perfHours to be safe, as user asked for "Treatment Time" sync.

        await prisma.attendance.update({
            where: { id: existing.id },
            data: {
                perfHours: perfHours,
                // If workHours is 0, maybe try to fill it from Shift?
                // Left out for now to avoid overwriting manual clock-ins.
            }
        });
    } else {
        // Create new record if we have bookings but no attendance row?
        // Usually we expect an attendance row if they worked.
        // But maybe they forgot to clock in.
        // Let's create one derived from Shift if possible.

        const shift = await prisma.shift.findFirst({
            where: {
                staffId,
                date: {
                    gte: startOfDay,
                    lte: endOfDay
                }
            }
        });

        let workHours = 0;
        let status = 'Present'; // Inferred

        if (shift && shift.start && shift.end) {
            // Calculate planned work hours
            const s = parseInt(shift.start.replace(':', ''));
            const e = parseInt(shift.end.replace(':', ''));
            // Simple logic, ignoring midnight cross for now unless needed
            // Approximate hours
            const [sh, sm] = shift.start.split(':').map(Number);
            const [eh, em] = shift.end.split(':').map(Number);
            workHours = (eh + em / 60) - (sh + sm / 60) - 1; // Minus 1h break default
            if (workHours < 0) workHours = 0;
        }

        await prisma.attendance.create({
            data: {
                staffId,
                date: startOfDay,
                status: status,
                workHours: workHours,
                perfHours: perfHours,
                isManual: false
            }
        });
    }
}

/**
 * Batch sync for a date range.
 * Useful for "Recalculate Month".
 */
// ... (syncDailyStats kept for single day usage if needed, but we optimize batch here)

/**
 * Batch sync for a date range.
 * Useful for "Recalculate Month".
 */
export async function syncAttendanceRange(year: number, month: number) {
    const startDate = new Date(Date.UTC(year, month - 1, 1));
    const endDate = new Date(Date.UTC(year, month, 0)); // Last day of month

    // Ensure end of day for the query range
    const rangeStart = new Date(startDate);
    rangeStart.setUTCHours(0, 0, 0, 0);
    const rangeEnd = new Date(endDate);
    rangeEnd.setUTCHours(23, 59, 59, 999);

    console.log(`[Sync] Starting batch sync for ${year}-${month}`);

    // 1. Bulk Fetch Data
    const [allStaff, allBookings, allShifts, allAttendance] = await Promise.all([
        prisma.staff.findMany({ where: { isActive: true } }),
        prisma.booking.findMany({
            where: {
                startAt: { gte: rangeStart },
                endAt: { lte: rangeEnd },
                status: { not: 'Cancelled' }
            },
            include: { service: true }
        }),
        prisma.shift.findMany({
            where: {
                date: { gte: rangeStart, lte: rangeEnd }
            }
        }),
        prisma.attendance.findMany({
            where: {
                date: { gte: rangeStart, lte: rangeEnd }
            }
        })
    ]);

    // 2. Process In-Memory
    const daysInMonth = endDate.getDate();
    const updates = [];
    const creates = [];

    for (const staff of allStaff) {
        for (let d = 1; d <= daysInMonth; d++) {
            const currentDate = new Date(Date.UTC(year, month - 1, d));
            const dayStart = new Date(currentDate); dayStart.setUTCHours(0, 0, 0, 0);
            const dayEnd = new Date(currentDate); dayEnd.setUTCHours(23, 59, 59, 999);

            // Filter relevant data for this Staff/Day
            const dailyBookings = allBookings.filter(b =>
                b.staffId === staff.id &&
                b.startAt >= dayStart &&
                b.startAt <= dayEnd
            );

            // Calc Perf Hours
            let totalMinutes = 0;
            for (const b of dailyBookings) {
                const duration = (b.endAt.getTime() - b.startAt.getTime()) / 60000;
                totalMinutes += duration;
            }
            const perfHours = Math.round((totalMinutes / 60) * 100) / 100;

            // Find existing Attendance
            // Note: Prisma returns Date objects. We need to match dates carefully. 
            // Usually simply checking ISO string date part matching is safe for "Date" types.
            const existingRecord = allAttendance.find(a =>
                a.staffId === staff.id &&
                a.date.toISOString().startsWith(currentDate.toISOString().split('T')[0])
            );

            if (existingRecord) {
                // Update if perfHours changed
                if (existingRecord.perfHours !== perfHours) {
                    updates.push(prisma.attendance.update({
                        where: { id: existingRecord.id },
                        data: { perfHours }
                    }));
                }
            } else if (dailyBookings.length > 0) {
                // Create if missing but has bookings
                // Derive workHours from Shift if available
                const shift = allShifts.find(s =>
                    s.staffId === staff.id &&
                    s.date.toISOString().startsWith(currentDate.toISOString().split('T')[0])
                );

                let workHours = 0;
                if (shift && shift.start && shift.end) {
                    const [sh, sm] = shift.start.split(':').map(Number);
                    const [eh, em] = shift.end.split(':').map(Number);
                    workHours = (eh + em / 60) - (sh + sm / 60) - 1; // -1h break
                    if (workHours < 0) workHours = 0;
                }

                creates.push(prisma.attendance.create({
                    data: {
                        staffId: staff.id,
                        date: currentDate,
                        status: 'Present',
                        workHours,
                        perfHours,
                        isManual: false
                    }
                }));
            }
        }
    }

    console.log(`[Sync] Processing ${updates.length} updates and ${creates.length} creates.`);

    // 3. Execute Writes (in chunks if needed, but Promise.all is fine for ~100-200 items usually)
    // Run in transaction to ensure consistency? Or just parallel. Parallel is faster.
    await prisma.$transaction([
        ...updates,
        ...creates
    ]);

    revalidatePath('/admin/attendance');
    revalidatePath('/admin/payroll');
}
