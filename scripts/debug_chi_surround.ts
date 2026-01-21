
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const chi = await prisma.staff.findFirst({ where: { name: 'CHI' } });
    if (!chi) return;

    // Check bookings for Jan 18
    const start = new Date('2026-01-18T00:00:00.000Z');
    const end = new Date('2026-01-19T00:00:00.000Z');

    const bookings = await prisma.booking.count({
        where: {
            staffId: chi.id,
            startAt: { gte: start, lt: end }
        }
    });
    console.log(`Bookings for CHI on Jan 18: ${bookings}`);

    // Check Attendance for ANY day in Jan to check date storage
    const atts = await prisma.attendance.findMany({
        where: { staffId: chi.id },
        take: 3,
        orderBy: { date: 'desc' }
    });
    console.log('Recent Attendances for CHI:', atts);
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
