
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const start = new Date('2026-01-18T00:00:00.000Z');
    const end = new Date('2026-01-19T00:00:00.000Z');

    console.log(`Checking bookings between ${start.toISOString()} and ${end.toISOString()}...`);

    // Check all bookings in that range
    const bookings = await prisma.booking.findMany({
        where: {
            startAt: {
                gte: start,
                lt: end
            }
        },
        include: {
            service: true,
            staff: true
        }
    });

    console.log(`Found ${bookings.length} bookings.`);

    if (bookings.length > 0) {
        console.log('Sample bookings:');
        bookings.slice(0, 5).forEach(b => {
            console.log(`- [${b.resourceId}] ${b.startAt.toISOString()} - ${b.endAt.toISOString()} | ${b.menuName} | ${b.clientName}`);
        });
    }

    // Check distinct resourceIds
    const resourceIds = [...new Set(bookings.map(b => b.resourceId))];
    console.log('Resource IDs found:', resourceIds);
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
