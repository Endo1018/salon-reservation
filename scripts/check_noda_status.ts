
import { prisma } from '../lib/db';

async function main() {
    const targets = await prisma.booking.findMany({
        where: {
            clientName: { contains: 'Noda', mode: 'insensitive' },
            menuName: { contains: 'CHAMPACA' }
        },
        orderBy: { startAt: 'asc' }
    });

    if (targets.length === 0) {
        console.log("No Noda booking found.");
        return;
    }

    console.log("--- Noda Rika Bookings ---");
    targets.forEach(b => {
        console.log(`[${b.id}] ${b.menuName} | ${b.resourceId}`);
        console.log(`   Time: ${b.startAt.toISOString()} - ${b.endAt.toISOString()}`);
        console.log(`   Combo: ${b.comboLinkId}, Main: ${b.isComboMain}`);
    });

    if (targets.length >= 2) {
        const first = targets[0];
        const isHeadSpa = first.menuName.toLowerCase().includes('head spa');
        console.log(`\nCurrent Order: ${isHeadSpa ? 'Head Spa' : 'Massage'} First`);
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
