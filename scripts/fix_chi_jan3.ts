
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const chi = await prisma.staff.findFirst({ where: { name: 'CHI' } });
    if (!chi) return;

    const start = new Date('2026-01-03T00:00:00.000Z');
    const end = new Date('2026-01-03T23:59:59.999Z');

    const shift = await prisma.shift.findFirst({
        where: {
            staffId: chi.id,
            date: { gte: start, lt: end }
        }
    });

    if (shift) {
        console.log(`Updating Shift ID ${shift.id}: ${shift.start} -> 13:00`);
        await prisma.shift.update({
            where: { id: shift.id },
            data: { start: '13:00' }
        });
        console.log('Update complete.');
    } else {
        console.log('Shift not found.');
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
