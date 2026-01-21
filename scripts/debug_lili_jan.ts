
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const applyRounding = (time: string) => {
    // Port logic from MonthlyAttendanceSummary (assuming 15 min rounding for calculation or similar?)
    // Actually, let's just use raw difference first to see where the 1 min comes from.
    // If Summary uses rounding, we should verify that.
    return time;
};

async function main() {
    const lili = await prisma.staff.findFirst({ where: { name: 'LILI' } });
    if (!lili) return console.log('LILI not found');

    const start = new Date('2026-01-01T00:00:00.000Z');
    const end = new Date('2026-02-01T00:00:00.000Z');

    const shifts = await prisma.shift.findMany({
        where: { staffId: lili.id, date: { gte: start, lt: end } },
        orderBy: { date: 'asc' }
    });

    const atts = await prisma.attendance.findMany({
        where: { staffId: lili.id, date: { gte: start, lt: end } },
        orderBy: { date: 'asc' }
    });

    console.log(`Analyzing LILI (ID ${lili.id}) for Jan 2026:`);

    for (const s of shifts) {
        const dateStr = s.date.toISOString().split('T')[0];
        const a = atts.find(att => att.date.toISOString().split('T')[0] === dateStr);

        if (a && a.start && a.end && s.start && s.end) {
            const parse = (t) => {
                const [h, m] = t.split(':').map(Number);
                return h * 60 + m;
            };

            // Shift
            const sStart = parse(s.start);
            const sEnd = parse(s.end);

            // Attendance (Raw)
            const aStart = parse(a.start);
            const aEnd = parse(a.end);

            // Calc Late (Att Start - Shift Start) -> If > 0, Late
            // Using logic: Late = max(0, AttStart - ShiftStart)
            // But we need to know if there's rounding!
            // Let's assume raw for now.
            const late = Math.max(0, aStart - sStart);
            const early = Math.max(0, sEnd - aEnd);

            if (late > 0 || early > 0) {
                console.log(`[${dateStr}] Shift: ${s.start}-${s.end} | Att: ${a.start}-${a.end}`);
                console.log(`  Late: ${late}m, Early: ${early}m`);
                if (late === 1 || early === 2) console.log('  ^^^ THIS MATCHES REPORT');
            }
        }
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
