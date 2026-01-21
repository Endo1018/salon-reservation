
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const lili = await prisma.staff.findFirst({ where: { name: 'LILI' } });
    if (!lili) return;

    // Jan 1: Fix Early 2m (Shift End 20:17 -> 20:15)
    const d1 = new Date('2026-01-01T00:00:00.000Z');
    const fullEnd1 = new Date('2026-01-01T23:59:59.999Z');
    const s1 = await prisma.shift.findFirst({
        where: { staffId: lili.id, date: { gte: d1, lt: fullEnd1 } }
    });
    if (s1 && s1.end === '20:17') {
        console.log(`Fixing Jan 1 Shift End: ${s1.end} -> 20:15`);
        await prisma.shift.update({ where: { id: s1.id }, data: { end: '20:15' } });
    }

    // Jan 3: Fix Late 1m (Shift Start 11:26 -> 11:27)
    const d3 = new Date('2026-01-03T00:00:00.000Z');
    const fullEnd3 = new Date('2026-01-03T23:59:59.999Z');
    const s3 = await prisma.shift.findFirst({
        where: { staffId: lili.id, date: { gte: d3, lt: fullEnd3 } }
    });
    if (s3 && s3.start === '11:26') {
        console.log(`Fixing Jan 3 Shift Start: ${s3.start} -> 11:27`);
        await prisma.shift.update({ where: { id: s3.id }, data: { start: '11:27' } });
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
