
import { prisma } from '../lib/db';

async function main() {
    const targets = await prisma.booking.findMany({
        where: {
            clientName: { contains: 'Noda' },
            menuName: { contains: 'CHAMPACA' }
        },
        orderBy: { startAt: 'asc' },
        include: { service: true }
    });

    console.log(`Found ${targets.length} legs for Noda.`);

    targets.forEach(b => {
        console.log(`\n[${b.id}] ${b.menuName} (${b.isComboMain ? 'Main/Massage' : 'Sub/Spa'})`);
        console.log(`Resource: ${b.resourceId}`);
        console.log(`Time: ${b.startAt.toISOString()} - ${b.endAt.toISOString()}`);
        console.log(`Duration: ${(b.endAt.getTime() - b.startAt.getTime()) / 60000}m`);
    });
}

main().catch(console.error).finally(() => prisma.$disconnect());
