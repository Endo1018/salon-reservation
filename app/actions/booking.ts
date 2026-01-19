'use server';

import { prisma } from '@/lib/db';
import { startOfDay, endOfDay } from 'date-fns';

export async function getStaffShifts(dateInput: Date | string) {
    // Ensure we work with a string 'YYYY-MM-DD' to avoid timezone shifts on the server
    const dateStr = typeof dateInput === 'string'
        ? dateInput
        : dateInput.toISOString().split('T')[0];

    // Construct start/end from the string explicitly in UTC or local?
    // Prisma matches DateTime. 
    // IF shifts are stored as "Midnight UTC" (common for date-only fields without time type), 
    // we should query for the range of that day in UTC.

    // WIDE SEARCH WINDOW: Catch shifts that might be saved with Timezone offsets
    // Start: Target Date - 1 Day
    // End: Target Date + 2 Days
    const searchStart = new Date(dateStr);
    searchStart.setDate(searchStart.getDate() - 1);

    const searchEnd = new Date(dateStr);
    searchEnd.setDate(searchEnd.getDate() + 2);

    console.log(`[getStaffShifts] Input: ${dateStr}, Window: ${searchStart.toISOString()} - ${searchEnd.toISOString()}`);

    // Fetch all active staff
    const staffList = await prisma.staff.findMany({
        where: { isActive: true },
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
            status: true, // 'WORK' | 'OFF' | etc.
            date: true
        }
    });

    console.log(`[getStaffShifts] Found ${shifts.length} shifts in window.`);

    // Map shifts by staff name (or ID, but booking system currently uses Names heavily. 
    // The previous implementation used Names as IDs. 
    // We need to be careful: Does "StaffAttendance" use Name or ID?
    // Looking at StaffAttendance.tsx: `staff` is from `useMetaStore`, which is `string[]` (names).
    // So we should map by Name for compatibility, OR migrate to IDs.
    // Migration is safer but bigger. Let's return Map<Name, Status> for now to match `menustaff.csv` headers.

    // Using Name as key to match existing system
    const shiftMap: Record<string, string> = {};

    shifts.forEach(s => {
        const staff = staffList.find(st => st.id === s.staffId);
        if (staff) {
            shiftMap[staff.name] = s.status;
        }
    });

    // Also return the staff list (names) to ensure consistent ordering/updates
    const staffNames = staffList.map(s => s.name);

    return { staffNames, shiftMap };
}
