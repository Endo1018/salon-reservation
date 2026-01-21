
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const start = new Date('2026-01-01T00:00:00.000Z');
    const end = new Date('2026-02-01T00:00:00.000Z');

    console.log(`Checking bookings between ${start.toISOString()} and ${end.toISOString()}...`);

    const count = await prisma.booking.count({
        where: {
            startAt: {
                gte: start,
                lt: end
            }
        }
    });

    console.log(`Total bookings in Jan 2026: ${count}`);

    if (count > 0) {
        const bookings = await prisma.booking.findMany({
            where: {
                startAt: {
                    gte: start,
                    lt: end
                }
            },
            take: 5,
            orderBy: { startAt: 'asc' }
        });
        console.log('Sample first 5 bookings:');
        bookings.forEach(b => {
            console.log(`- [${b.resourceId}] ${b.startAt.toISOString()} | ${b.clientName}`);
        });

        // Group by day?
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
