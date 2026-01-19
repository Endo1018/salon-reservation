
import { prisma } from './lib/db';

async function main() {
    console.log('--- Checking Staff Roles ---');
    const staff = await prisma.staff.findMany({
        select: { id: true, name: true, role: true, isActive: true }
    });
    console.table(staff);

    console.log('--- Checking Shifts (Next 48h) ---');
    const now = new Date();
    const next = new Date(now);
    next.setDate(next.getDate() + 2);

    const shifts = await prisma.shift.findMany({
        where: { date: { gte: now, lte: next } },
        select: { staffId: true, status: true, date: true }
    });
    console.log(`Found ${shifts.length} shifts.`);
    shifts.forEach(s => console.log(`${s.staffId}: ${s.status} @ ${s.date.toISOString()}`));
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
