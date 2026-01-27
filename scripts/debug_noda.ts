
import { prisma } from '../lib/db';

async function main() {
    const bookings = await prisma.booking.findMany({
        where: {
            clientName: { contains: 'Noda', mode: 'insensitive' },
            startAt: {
                gte: new Date('2026-01-23T00:00:00Z'),
                lt: new Date('2026-01-24T00:00:00Z')
            }
        },
        include: { service: true }
    });

    console.log("Found bookings for Noda Rika:", bookings.length);
    bookings.forEach(b => {
        console.log(`[${b.menuName}]`);
        console.log(`  Start: ${b.startAt.toISOString()} (UTC)`);
        console.log(`  End:   ${b.endAt.toISOString()} (UTC)`);
        console.log(`  Resource: ${b.resourceId}`);
        console.log(`  Staff: ${b.staffId}`);
        console.log(`  Main: ${b.isComboMain}`);
    });
}

main().catch(console.error).finally(() => prisma.$disconnect());
