'use server';

import { prisma } from '@/lib/db';
import { startOfDay, endOfDay } from 'date-fns';

export async function getStaffShifts(dateInput: Date | string) {
    // Ensure we work with a string 'YYYY-MM-DD' to avoid timezone shifts on the server
    const dateStr = typeof dateInput === 'string'
        ? dateInput
        : dateInput.toISOString().split('T')[0];

    // WIDE SEARCH WINDOW: Catch shifts that might be saved with Timezone offsets
    // Start: Target Date - 1 Day
    // End: Target Date + 2 Days
    const searchStart = new Date(dateStr);
    searchStart.setDate(searchStart.getDate() - 1);

    const searchEnd = new Date(dateStr);
    searchEnd.setDate(searchEnd.getDate() + 2);

    console.log(`[getStaffShifts] Input: ${dateStr}, Window: ${searchStart.toISOString()} - ${searchEnd.toISOString()}`);

    // Fetch all active THERAPISTS only
    const staffList = await prisma.staff.findMany({
        where: {
            isActive: true,
            role: 'Therapist'
        },
        select: { id: true, name: true }
    });

    // Fetch shifts for the date (Wide Window)
    const shifts = await prisma.shift.findMany({
        where: {
            date: {
                gte: searchStart,
                lte: searchEnd
            }
        },
        select: {
            staffId: true,
            status: true,
            date: true
        }
    });

    console.log(`[getStaffShifts] Found ${shifts.length} shifts in window.`);

    // Map shifts by staff name
    const shiftMap: Record<string, string> = {};

    shifts.forEach(s => {
        const staff = staffList.find(st => st.id === s.staffId);
        if (!staff) return;

        // Robust Timezone Matching
        // Determine if this shift record belongs to the target 'dateStr' requested by the user.
        // We check if the shift time (DB UTC) is "close enough" (within -10h to +24h window) to the target date.

        const dbDate = new Date(s.date);
        const targetDate = new Date(dateStr); // UTC midnight of target dateStr

        // Diff in hours
        const diffHours = (dbDate.getTime() - targetDate.getTime()) / (1000 * 60 * 60);

        // Typical offsets: -8 (US) to +9 (Japan) to +7 (BKK).
        // Matches:
        // - 17:00 prev day (-7h offset for 00:00) -> diff -7
        // - 00:00 curr day (UTC) -> diff 0
        // - 09:00 curr day (+9h) -> diff 9

        const isLikelyMatch = diffHours > -12 && diffHours < 18;

        if (isLikelyMatch) {
            console.log(`[getStaffShifts] MATCH ${staff.name}: ${s.status} (DB: ${s.date.toISOString()}, Offset: ${diffHours.toFixed(1)}h)`);
            shiftMap[staff.name] = s.status;
        }
    });

    // Also return the staff list (names) to ensure consistent ordering/updates
    const staffNames = staffList.map(s => s.name);

    return { staffNames, shiftMap };
}
