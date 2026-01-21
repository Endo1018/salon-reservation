
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const dateQuery = '2026-01-18';

    // Use exact name 'CHI'
    const chi = await prisma.staff.findFirst({
        where: { name: 'CHI' }
    });

    if (!chi) return;

    const startOfDay = new Date(`${dateQuery}T00:00:00.000Z`);
    const endOfDay = new Date(`${dateQuery}T23:59:59.999Z`);

    // Get Shift (already tried, was null, retry just in case)
    const shift = await prisma.shift.findFirst({
        where: {
            staffId: chi.id,
            date: { gte: startOfDay, lte: endOfDay }
        }
    });

    // Get Attendance (Fixed)
    const att = await prisma.attendance.findFirst({
        where: {
            staffId: chi.id,
            date: { gte: startOfDay, lte: endOfDay }
        }
    });

    console.log(`Analyzing for CHI on ${dateQuery}:`);
    console.log('Shift:', shift ? `${shift.startTime} - ${shift.endTime}` : 'No Shift Record (NULL)');
    console.log('Attendance:', att ? `${att.startTime} - ${att.endTime}` : 'No Attendance Record');

    // Check if Shift is missing, what is the default "Expected Start"?
    // Logic in StaffAttendanceRow.tsx likely handles this.
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
