
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const kim = await prisma.staff.findFirst({ where: { name: 'KIM' } });
    if (!kim) return;

    const dateStr = '2026-01-13';
    const start = new Date(`${dateStr}T00:00:00.000Z`);
    const end = new Date(`${dateStr}T23:59:59.999Z`);

    const shift = await prisma.shift.findFirst({
        where: {
            staffId: kim.id,
            date: { gte: start, lt: end }
        }
    });

    if (shift) {
        console.log(`Updating Shift ID ${shift.id}: ${shift.start}-${shift.end} -> 13:00-22:00`);
        await prisma.shift.update({
            where: { id: shift.id },
            data: {
                start: '13:00',
                end: '22:00'
            }
        });
        console.log('Update complete.');
    } else {
        console.log('Shift not found.');
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
