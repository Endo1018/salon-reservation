
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const start = new Date('2026-01-01T00:00:00.000Z');
    const end = new Date('2026-02-01T00:00:00.000Z');

    const bookings = await prisma.booking.findMany({
        where: {
            startAt: {
                gte: start,
                lt: end
            }
        },
        select: {
            startAt: true
        }
    });

    const counts: Record<string, number> = {};
    bookings.forEach(b => {
        const dateKey = b.startAt.toISOString().split('T')[0];
        counts[dateKey] = (counts[dateKey] || 0) + 1;
    });

    console.log('Bookings per day:');
    Object.keys(counts).sort().forEach(k => {
        console.log(`${k}: ${counts[k]}`);
    });
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
