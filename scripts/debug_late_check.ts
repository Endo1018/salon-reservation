
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const parseTime = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
};

// Simplified rounding logic (matching MonthlyAttendanceSummary approximately)
const getRounded = (time: string, type: 'start' | 'end') => {
    // Current app logic seems to depend on `applyRounding` which might be just raw comparison or specific rounding
    // For this debug, let's look at RAW comparisons first to spot data issues.
    return parseTime(time);
};

async function main() {
    const start = new Date('2026-01-01T00:00:00.000Z');
    const end = new Date('2026-02-01T00:00:00.000Z');

    const allAttendance = await prisma.attendance.findMany({
        where: { date: { gte: start, lt: end } },
        include: { staff: true },
        orderBy: [{ staffId: 'asc' }, { date: 'asc' }]
    });

    const allShifts = await prisma.shift.findMany({
        where: { date: { gte: start, lt: end } },
        orderBy: [{ staffId: 'asc' }, { date: 'asc' }]
    });

    console.log(`Scanning ${allAttendance.length} attendance records for Late/Early...`);

    let issueCount = 0;

    for (const att of allAttendance) {
        if (!att.start || !att.end) continue;

        const dateStr = att.date.toISOString().split('T')[0];
        const shift = allShifts.find(s => s.staffId === att.staffId && s.date.toISOString().split('T')[0] === dateStr);

        if (shift && shift.start && shift.end) {
            const sStart = parseTime(shift.start);
            const aStart = parseTime(att.start);
            const sEnd = parseTime(shift.end);
            const aEnd = parseTime(att.end);

            // Calculate Late (Positive if Att > Shift)
            const late = Math.max(0, aStart - sStart);
            const early = Math.max(0, sEnd - aEnd);

            // Filter for "Non-Zero" Late/Early
            if (late > 0 || early > 0) {
                // Heuristic for "Weird Shift": Shift minute is not 00, 15, 30, 45 (or just 00/30)
                const shiftStartMin = sStart % 60;
                const shiftEndMin = sEnd % 60;
                const isWeirdShift = (shiftStartMin % 10 !== 0) || (shiftEndMin % 10 !== 0);

                // Or if Late matched strict diff (1-5 mins)
                const isSmallDiff = (late > 0 && late <= 5) || (early > 0 && early <= 5);

                // Or if Shift == Att (exact), Late should be 0.
                // If Late > 0, it implies Att > Shift.

                if (isWeirdShift || isSmallDiff || late > 0) {
                    console.log(`[${att.staff.name}] ${dateStr}`);
                    console.log(`  Shift: ${shift.start} - ${shift.end}`);
                    console.log(`  Att  : ${att.start} - ${att.end}`);
                    console.log(`  Late : ${late}m ${isWeirdShift ? '(Weird Shift)' : ''}`);
                    console.log(`  Early: ${early}m ${isWeirdShift ? '(Weird Shift)' : ''}`);
                    console.log('---');
                    issueCount++;
                }
            }
        }
    }
    console.log(`Found ${issueCount} potential issues.`);
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
