'use server';

import prisma from '@/lib/db';

export async function deleteStaffAttendance(staffName: string, dates: string[]) {
    const staff = await prisma.staff.findFirst({ where: { name: staffName } });
    if (!staff) {
        return { success: false, error: 'Staff not found' };
    }

    const dateObjects = dates.map(d => new Date(d));

    const result = await prisma.attendance.deleteMany({
        where: {
            staffId: staff.id,
            date: { in: dateObjects }
        }
    });

    return { success: true, count: result.count };
}
