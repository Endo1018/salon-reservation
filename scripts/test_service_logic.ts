
import { findFreeResource, isResourceFree, resourcePools } from '../app/services/booking-service';
import { prisma } from '../lib/db';

async function main() {
    // Target: 15:50 - 16:50 (Local) -> 08:50 - 09:50 UTC
    const start = new Date('2026-01-23T08:50:00Z');
    const end = new Date('2026-01-23T09:50:00Z');

    const pool = resourcePools.spa;

    console.log("Testing Overlap on Spa 2");
    console.log("New Booking: ", start.toISOString(), "~", end.toISOString());

    // 1. Check isResourceFree for Spa 2
    // We expect FALSE
    const spa2Free = await isResourceFree('spa-2', start, end);
    console.log("Is Spa 2 Free?", spa2Free);

    if (spa2Free) {
        console.log("Check Conflicts Manually if true:");
        const conflicts = await prisma.booking.findMany({
            where: {
                resourceId: 'spa-2',
                startAt: { lt: end },
                endAt: { gt: start },
                status: { not: 'Cancelled' }
            }
        });
        console.log("Conflicts on Spa 2 found via Prisma direct check:", conflicts.length);
        conflicts.forEach(c => console.log(` - ${c.id} ${c.menuName} ${c.startAt.toISOString()}~${c.endAt.toISOString()}`));
    }

    // 2. Run findFreeResource
    const freeRes = await findFreeResource(pool, start, end);
    console.log("findFreeResource Result:", freeRes);
}

main().catch(console.error).finally(() => prisma.$disconnect());
