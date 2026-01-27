
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    // Jan 23 UTC range
    // Data is stored as UTC.
    // User "Today" is Jan 23 (Vietnam).
    // Vietnam 00:00 = UTC 17:00 (Prev Day).
    // Vietnam 23:59 = UTC 16:59 (Current Day).
    // So target range is roughly Jan 22 17:00 to Jan 23 17:00 UTC.

    // Easier: Just look for anything with startAt between Jan 22 10:00 and Jan 24 10:00 UTC
    const start = new Date('2026-01-22T00:00:00Z');
    const end = new Date('2026-01-24T00:00:00Z');

    const bookings = await prisma.booking.findMany({
        where: {
            startAt: {
                gte: start,
                lt: end
            }
        },
        orderBy: { startAt: 'asc' }
    });

    console.log(`Bookings around Jan 23: ${bookings.length}`);
    bookings.forEach(b => console.log(`${b.startAt.toISOString()} - ${b.clientName} (${b.menuName}) [Res: ${b.resourceId}]`));
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
