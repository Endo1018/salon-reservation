
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- Inspecting BookingMemos (Feb 2026) ---');

    // Look for any memo around Feb 2026
    const start = new Date('2026-01-25T00:00:00Z');
    const end = new Date('2026-02-10T00:00:00Z');

    const memos = await prisma.bookingMemo.findMany({
        where: {
            date: {
                gte: start,
                lte: end
            }
        }
    });

    console.log(`Found ${memos.length} memos.`);
    memos.forEach(m => {
        console.log(`[${m.id}] Date: ${m.date.toISOString()} | Content: "${m.content}"`);
    });

    console.log('------------------------------------------');

    // Check what Date.UTC(2026, 1, 1) produces in this environment
    const target = new Date(Date.UTC(2026, 1, 1));
    console.log(`Target Date (UTC 2026-02-01): ${target.toISOString()}`);
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
