const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    console.log("Starting FORCE DELETION of February 2026 data...");

    try {
        const delB = await prisma.booking.deleteMany({
            where: {
                startAt: {
                    gte: new Date('2026-02-01T00:00:00Z'),
                    lt: new Date('2026-03-01T00:00:00Z')
                }
            }
        });
        console.log(`Deleted ${delB.count} Bookings.`);

        const delM = await prisma.bookingMemo.deleteMany({
            where: {
                date: {
                    gte: new Date('2026-02-01T00:00:00Z'),
                    lt: new Date('2026-03-01T00:00:00Z')
                }
            }
        });
        console.log(`Deleted ${delM.count} Booking Memos.`);
        console.log("SUCCESS.");
    } catch (e) {
        console.error("ERROR:", e);
        process.exit(1);
    }
}

run().then(() => prisma.$disconnect());
