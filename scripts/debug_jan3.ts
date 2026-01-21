
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const start = new Date('2026-01-03T00:00:00.000Z');
    const end = new Date('2026-01-03T23:59:59.999Z');

    const shifts = await prisma.shift.findMany({
        where: {
            date: { gte: start, lt: end }
        },
        include: { staff: true }
    });

    console.log('Shifts on Jan 3:');
    shifts.forEach(s => {
        console.log(`${s.staff.name}: ${s.start} - ${s.end} (${s.status})`);
    });
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
