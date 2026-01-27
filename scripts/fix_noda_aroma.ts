
import { prisma } from '../lib/db';
import { findFreeResource, isResourceFree, resourcePools } from '../app/services/booking-service';

async function fixNoda() {
    // Find Noda Main Leg
    const target = await prisma.booking.findFirst({
        where: {
            clientName: { contains: 'Noda' },
            menuName: { contains: 'CHAMPACA' },
            isComboMain: true
        }
    });

    if (!target) return console.log("Noda Main Leg Not Found");
    console.log(`Current Noda Main: ${target.resourceId} at ${target.startAt.toISOString()}-${target.endAt.toISOString()}`);

    // Check Conflict
    const isFree = await isResourceFree(target.resourceId, target.startAt, target.endAt, target.id);
    console.log(`Is Free? ${isFree}`);

    if (!isFree) {
        // Find New
        const pool = resourcePools.aroma;
        const newRes = await findFreeResource(pool, target.startAt, target.endAt, target.id);
        console.log(`Found Free: ${newRes}`);

        if (newRes) {
            await prisma.booking.update({
                where: { id: target.id },
                data: { resourceId: newRes }
            });
            console.log("Moved to " + newRes);
        } else {
            console.log("No free Aroma room found!");
        }
    } else {
        console.log("Surprisingly free? Logic mismatch.");
    }
}

fixNoda().catch(console.error).finally(() => prisma.$disconnect());
