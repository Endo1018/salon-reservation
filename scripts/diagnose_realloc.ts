
import { prisma } from '../lib/db';
import { resourcePools } from '../app/services/booking-service';

async function checkResourceStatus(poolName: string, poolIds: string[], start: Date, end: Date, excludeId?: string) {
    console.log(`\nChecking Pool: ${poolName} (${start.toISOString()} - ${end.toISOString()})`);

    for (const resId of poolIds) {
        const conflicts = await prisma.booking.findMany({
            where: {
                resourceId: resId,
                startAt: { lt: end },
                endAt: { gt: start },
                id: excludeId ? { not: excludeId } : undefined,
                status: { not: 'Cancelled' }
            },
            select: { id: true, startAt: true, endAt: true, menuName: true, clientName: true }
        });

        if (conflicts.length > 0) {
            console.log(`❌ [${resId}] BUSY. Conflicts:`);
            conflicts.forEach(c => console.log(`   - ${c.startAt.toISOString()}~${c.endAt.toISOString()} | ${c.menuName} (${c.clientName})`));
        } else {
            console.log(`✅ [${resId}] FREE.`);
        }
    }
}

async function main() {
    // 1. Find the Problematic Booking (Noda Rika?)
    // User image shows "15:50 - 16:50 CHAMPACA AROMA".
    // Date: 2026-01-23. Time: 15:50 Local -> 08:50 UTC.

    const startSearch = new Date('2026-01-23T08:40:00Z');
    const endSearch = new Date('2026-01-23T09:00:00Z');

    const targets = await prisma.booking.findMany({
        where: {
            startAt: { gte: startSearch, lte: endSearch },
            menuName: { contains: 'CHAMPACA' }
        },
        include: { service: true }
    });

    console.log(`Found ${targets.length} target bookings.`);

    for (const target of targets) {
        console.log(`\nTarget: ${target.id} | ${target.menuName} | ${target.resourceId}`);
        console.log(`Time: ${target.startAt.toISOString()} - ${target.endAt.toISOString()}`);

        // Check availability for this slot
        const poolInfo = Object.entries(resourcePools).find(([_, ids]) => ids.includes(target.resourceId));
        if (poolInfo) {
            const [name, ids] = poolInfo;
            await checkResourceStatus(name, ids, target.startAt, target.endAt, target.id);
        } else {
            console.log("Could not determine pool for resource:", target.resourceId);
        }
    }

    // 2. Check Aroma Room B-1 weirdness (16:50 Local -> 09:50 UTC)
    // Range 09:40 - 10:00 UTC.
    console.log("\n--- Checking Aroma Room B-1 Weirdness ---");
    const aromaWeirdness = await prisma.booking.findMany({
        where: {
            resourceId: 'aroma-b1',
            startAt: { gte: new Date('2026-01-23T09:00:00Z'), lte: new Date('2026-01-23T11:00:00Z') }
        }
    });
    aromaWeirdness.forEach(b => {
        console.log(`[aroma-b1] ${b.startAt.toISOString()} - ${b.endAt.toISOString()} | ${b.menuName}`);
    });
}

main().catch(console.error).finally(() => prisma.$disconnect());
