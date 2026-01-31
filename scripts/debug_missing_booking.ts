
import { prisma } from '@/lib/db';

async function main() {
    const startOfDay = new Date('2026-01-31T00:00:00Z'); // UTC? User says "Today" 1/31
    // Wait, local time is 22:55.
    // User screens show 2026/1/31.

    // Note: DB stores UTC. 20:00 VN time is 13:00 UTC.
    // Let's just search by Name.

    const bookings = await prisma.booking.findMany({
        where: {
            OR: [
                { clientName: { contains: 'Yonemura' } },
                { menuName: { contains: 'Advance' } }
            ]
        }
    });

    console.log('Found Bookings:', JSON.stringify(bookings, null, 2));
}

main();
