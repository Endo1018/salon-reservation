
import { prisma } from '../lib/db';

async function main() {
    // Check conflicts on aroma-a2
    const start = new Date('2026-01-23T09:50:00Z'); // 16:50
    const end = new Date('2026-01-23T10:50:00Z'); // 17:50

    console.log("Checking conflicts on aroma-a2 for 16:50-17:50 Local (09:50-10:50 UTC)");

    const conflicts = await prisma.booking.findMany({
        where: {
            resourceId: 'aroma-a2',
            startAt: { lt: end },
            endAt: { gt: start },
            status: { not: 'Cancelled' }
        }
    });

    conflicts.forEach(b => {
        console.log(`[${b.id}] ${b.startAt.toISOString()} - ${b.endAt.toISOString()} | ${b.menuName} (${b.clientName})`);
    });

    // Check for Duplicates for Noda
    console.log("\nChecking all Noda bookings:");
    const noda = await prisma.booking.findMany({
        where: { clientName: { contains: 'Noda' } }
    });
    noda.forEach(b => {
        console.log(`[${b.id}] ${b.startAt.toISOString()} (${b.resourceId}) ${b.menuName}`);
    });
}

main().catch(console.error).finally(() => prisma.$disconnect());
