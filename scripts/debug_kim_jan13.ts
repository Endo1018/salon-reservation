
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const kim = await prisma.staff.findFirst({ where: { name: 'KIM' } });
    if (!kim) return console.log('KIM not found');

    const dateStr = '2026-01-13';
    const start = new Date(`${dateStr}T00:00:00.000Z`);
    const end = new Date(`${dateStr}T23:59:59.999Z`);

    const shift = await prisma.shift.findFirst({
        where: {
            staffId: kim.id,
            date: { gte: start, lt: end }
        }
    });

    const att = await prisma.attendance.findFirst({
        where: {
            staffId: kim.id,
            date: { gte: start, lt: end }
        }
    });

    console.log(`Checking KIM Jan 13:`);
    console.log('Shift:', shift ? `${shift.start} - ${shift.end}` : 'None');
    console.log('Attendance:', att ? `${att.start} - ${att.end}` : 'None');

    if (shift && att) {
        // Parse times
        const parse = (t) => {
            const [h, m] = t.split(':').map(Number);
            return h * 60 + m;
        };
        const shiftEnd = parse(shift.end);
        const attEnd = parse(att.end);
        const diff = shiftEnd - attEnd;
        console.log(`Diff (Shift End - Att End): ${diff} mins`);

        if (diff > 0) {
            console.log('Result: EARLY');
        } else {
            console.log('Result: OK (or OT)');
        }
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
