
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const parseTime = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
};

async function main() {
    const start = new Date('2026-01-01T00:00:00.000Z');
    const end = new Date('2026-02-01T00:00:00.000Z');

    const allShifts = await prisma.shift.findMany({
        where: { date: { gte: start, lt: end } },
        orderBy: [{ staffId: 'asc' }, { date: 'asc' }]
    });

    const allAttendance = await prisma.attendance.findMany({
        where: { date: { gte: start, lt: end } }
    });

    console.log(`Checking ${allShifts.length} shifts for irregular times causing Late/Early...`);

    for (const shift of allShifts) {
        if (!shift.start || !shift.end) continue;

        const dateStr = shift.date.toISOString().split('T')[0];
        const att = allAttendance.find(a => a.staffId === shift.staffId && a.date.toISOString().split('T')[0] === dateStr);

        if (att && att.start && att.end) {
            const sStart = parseTime(shift.start);
            const aStart = parseTime(att.start);
            const sEnd = parseTime(shift.end);
            const aEnd = parseTime(att.end);

            const late = Math.max(0, aStart - sStart);
            const early = Math.max(0, sEnd - aEnd);

            // Check for Irregular Shift Times (not :00 or :30)
            const startMin = sStart % 60;
            const endMin = sEnd % 60;

            const isIrregularStart = (startMin !== 0 && startMin !== 30);
            const isIrregularEnd = (endMin !== 0 && endMin !== 30);

            let newStart = shift.start;
            let newEnd = shift.end;
            let updated = false;

            // Fix Late due to Irregular Start
            if (late > 0 && isIrregularStart) {
                // Determine replacement: Attendance Start
                // If Att Start is also irregular, that's fine, at least it matches -> Zero Late.
                // Or snap to nearest 00/30?
                // Matching Att is safest to satisfy "Not Late".
                newStart = att.start;
                updated = true;
            }

            // Fix Early due to Irregular End
            if (early > 0 && isIrregularEnd) {
                newEnd = att.end;
                updated = true;
            }

            if (updated) {
                console.log(`[${dateStr}] Staff ${shift.staffId}: Fixing Shift ${shift.start}-${shift.end} -> ${newStart}-${newEnd} (Att: ${att.start}-${att.end}, Late: ${late}, Early: ${early})`);
                await prisma.shift.update({
                    where: { id: shift.id },
                    data: { start: newStart, end: newEnd }
                });
            }
        }
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
