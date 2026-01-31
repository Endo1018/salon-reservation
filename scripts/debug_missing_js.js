
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const bookings = await prisma.booking.findMany({
            where: {
                OR: [
                    { clientName: { contains: 'Yonemura' } },
                    { menuName: { contains: 'Advance' } }
                ]
            }
        });
        console.log('Found Bookings:', JSON.stringify(bookings, null, 2));

        // Also check BookingMemo to see if Draft Mode is active
        const startOfMonth = new Date('2026-01-01T00:00:00Z');
        const memo = await prisma.bookingMemo.findFirst({
            where: { date: startOfMonth, content: { startsWith: 'SYNC_META:' } }
        });
        console.log('Draft Memo:', memo);

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
