
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Starting attendance record fix...');

    const records = await prisma.attendance.findMany({
        where: {
            start: { not: null },
            end: { not: null }
        }
    });

    console.log(`Found ${records.length} records to verify.`);

    let updatedCount = 0;

    for (const r of records) {
        if (!r.start || !r.end) continue;

        const [h1, m1] = r.start.split(':').map(Number);
        const [h2, m2] = r.end.split(':').map(Number);

        const startMin = h1 * 60 + m1;
        const endMin = h2 * 60 + m2;

        let diff = (endMin - startMin) / 60;
        if (diff < 0) diff += 24; // Overnight

        const breakTime = r.breakTime || 1.0;
        const correctWorkHours = Number(Math.max(0, diff - breakTime).toFixed(2));

        if (Math.abs(r.workHours - correctWorkHours) > 0.01) {
            console.log(`Fixing Record ID ${r.id}: ${r.start} - ${r.end} (Break: ${breakTime}) | Old: ${r.workHours} -> New: ${correctWorkHours}`);
            await prisma.attendance.update({
                where: { id: r.id },
                data: { workHours: correctWorkHours, breakTime: breakTime }
            });
            updatedCount++;
        }
    }

    console.log(`\nFix complete. Updated ${updatedCount} records.`);
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
