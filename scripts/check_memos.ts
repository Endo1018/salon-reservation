
import { prisma } from '../lib/db';

async function main() {
    const count = await prisma.bookingMemo.count();
    console.log(`BookingMemo count: ${count}`);

    const memos = await prisma.bookingMemo.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' }
    });
    console.log('Sample Memos:', memos);
}

main();
