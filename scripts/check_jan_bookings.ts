
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const start = new Date('2026-01-01T00:00:00Z');
    const end = new Date('2026-02-01T00:00:00Z');

    const count = await prisma.booking.count({
        where: {
            startAt: {
                gte: start,
                lt: end
            }
        }
    });

    console.log(`Bookings in Jan 2026: ${count}`);

    // Also verify recently created bookings (timestamps)
    const recent = await prisma.booking.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: { id: true, createdAt: true, clientName: true, menuName: true }
    });
    console.log("Most recent bookings:", recent);
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
