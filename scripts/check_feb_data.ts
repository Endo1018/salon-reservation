
import { prisma } from '../app/lib/db';

async function checkFeb() {
    const start = new Date(Date.UTC(2026, 1, 1)); // Feb 1
    const end = new Date(Date.UTC(2026, 2, 1));   // Mar 1

    const bookings = await prisma.booking.findMany({
        where: {
            startAt: {
                gte: start,
                lt: end
            }
        },
        select: {
            id: true,
            startAt: true,
            status: true,
            menuName: true,
            clientName: true,
            isLocked: true
        }
    });

    console.log(`Found ${bookings.length} bookings for Feb 2026:`);
    bookings.forEach(b => {
        console.log(`[${b.status}] ${b.startAt.toISOString()} - ${b.clientName} (${b.menuName}) Locked:${b.isLocked}`);
    });
}

checkFeb()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
