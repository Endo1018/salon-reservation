
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const calculateDuration = (start: string | null, end: string | null): number | null => {
    if (!start || !end) return null;

    const [h1Str, m1Str] = start.split(':');
    const [h2Str, m2Str] = end.split(':');

    const h1 = parseInt(h1Str, 10);
    const m1 = parseInt(m1Str, 10);
    const h2 = parseInt(h2Str, 10);
    const m2 = parseInt(m2Str, 10);

    if (isNaN(h1) || isNaN(m1) || isNaN(h2) || isNaN(m2)) return null;

    const startMin = h1 * 60 + m1;
    const endMin = h2 * 60 + m2;
    let diff = (endMin - startMin) / 60;

    if (diff < 0) diff += 24;

    return diff;
};

async function main() {
    // Check all attendance
    const all = await prisma.attendance.findMany({
        include: { staff: true },
        orderBy: { date: 'asc' }
    });

    console.log(`Scanning ${all.length} records for work hour mismatches...`);

    let mismatchCount = 0;

    for (const rec of all) {
        if (rec.start && rec.end) {
            const raw = calculateDuration(rec.start, rec.end);
            if (raw !== null) {
                const net = Math.max(0, raw - (rec.breakTime || 0));

                // Compare with stored workHours
                const stored = rec.workHours || 0;

                // Tolerance 0.02 to avoid float precision issues
                if (Math.abs(net - stored) > 0.02) {
                    mismatchCount++;
                    const dateStr = rec.date instanceof Date ? rec.date.toISOString().split('T')[0] : rec.date;
                    console.log(`[MISMATCH] ID ${rec.id} (${rec.staff.name} @ ${dateStr}):`);
                    console.log(`  Start: ${rec.start} End: ${rec.end} Break: ${rec.breakTime}`);
                    console.log(`  Calc Net: ${net.toFixed(2)} vs Stored: ${stored.toFixed(2)}`);
                    console.log(`  Diff: ${(stored - net).toFixed(2)}`);
                    console.log('---');
                }
            }
        }
    }

    console.log(`Total mismatches found: ${mismatchCount}`);
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
