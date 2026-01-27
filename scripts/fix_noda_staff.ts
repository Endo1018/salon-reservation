
import { prisma } from '../lib/db';

async function main() {
    const target = await prisma.booking.findFirst({
        where: {
            clientName: { contains: 'Noda', mode: 'insensitive' },
            startAt: {
                gte: new Date('2026-01-23T00:00:00Z'),
                lt: new Date('2026-01-24T00:00:00Z')
            },
            resourceId: 'spa-1' // Target the hidden one
        }
    });

    if (!target) {
        console.error("Target not found");
        return;
    }

    console.log("Updating Staff for:", target.id);
    await prisma.booking.update({
        where: { id: target.id },
        data: { staffId: 'NV000039' } // KIM (based on debug output for main leg)
    });
    console.log("Updated staffId to KIM");
}

main().catch(console.error).finally(() => prisma.$disconnect());
