
import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const prisma = new PrismaClient();

async function main() {
    console.log("=== Jan 2026 Stats Investigation ===");

    const startOfMonth = new Date(Date.UTC(2026, 0, 1));
    const endOfMonth = new Date(Date.UTC(2026, 1, 1));

    const bookings = await prisma.booking.findMany({
        where: {
            startAt: { gte: startOfMonth, lt: endOfMonth },
            status: { not: 'Cancelled' },
            staffId: { not: null }
        },
        include: { staff: true, service: true }
    });

    console.log(`Total Bookings in Jan 2026: ${bookings.length}`);

    const staffStats = new Map<string, { raw: number, dedicated: number, name: string }>();

    bookings.forEach(b => {
        const name = b.staff?.name || 'Unknown';
        if (!staffStats.has(name)) staffStats.set(name, { raw: 0, dedicated: 0, name });

        const stats = staffStats.get(name)!;
        stats.raw++;
    });

    // Calculate "Dedicated" (Unique Combo) count
    const processedCombos = new Set<string>();

    // We need to group by staff first to emulate the logic in timeline.ts
    const staffList = [...new Set(bookings.map(b => b.staff?.name).filter(Boolean))];

    console.log("\n--- Comparison: Raw vs Deduplicated ---");
    console.log("Name | Raw Count (Old) | Deduplicated (New) | Difference");
    console.log("---|---|---|---");

    for (const name of staffList) {
        if (!name) continue;
        const staffBookings = bookings.filter(b => b.staff?.name === name);

        let dedupCount = 0;
        const seenCombos = new Set<string>();

        staffBookings.forEach(b => {
            if (b.comboLinkId) {
                const key = `${name}-${b.comboLinkId}`; // Unique per staff-combo
                if (!seenCombos.has(key)) {
                    dedupCount++;
                    seenCombos.add(key);
                }
            } else {
                dedupCount++;
            }
        });

        const raw = staffBookings.length;
        console.log(`${name.padEnd(10)} | ${raw.toString().padEnd(15)} | ${dedupCount.toString().padEnd(18)} | ${raw - dedupCount}`);
    }

}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
