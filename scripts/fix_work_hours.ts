
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
    let diff = (h2 * 60 + m2 - (h1 * 60 + m1)) / 60;
    if (diff < 0) diff += 24;
    return diff;
};

async function main() {
    const all = await prisma.attendance.findMany();
    let fixedCount = 0;

    for (const rec of all) {
        if (rec.start && rec.end) {
            const raw = calculateDuration(rec.start, rec.end);
            if (raw !== null) {
                const breakTime = rec.breakTime || 0;
                const net = Math.max(0, raw - breakTime);
                const stored = rec.workHours || 0;

                // Fix if stored matches raw (ignoring break) AND break > 0
                // Difference is roughly equal to breakTime
                const diff = stored - net;

                if (Math.abs(diff - breakTime) < 0.05 && breakTime > 0) {
                    console.log(`Fixing ID ${rec.id}: Stored ${stored.toFixed(2)} -> Net ${net.toFixed(2)} (Break ignored)`);
                    await prisma.attendance.update({
                        where: { id: rec.id },
                        data: { workHours: net }
                    });
                    fixedCount++;
                }
                // Also fix if stored is way off (e.g. Sam's case might be exactly this)
                // Jen (Jan 14): Stored 9.00 vs Net 8.00. Break 1.00. Diff 1.00. Matches break.
                // Sam (Feb 3): Stored 9.00 vs Net 8.00. Break 1.00. Matches break.
            }
        }
    }
    console.log(`Fixed ${fixedCount} records.`);
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
