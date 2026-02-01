
import { prisma } from '@/lib/db';

async function main() {
    const date = new Date('2026-01-03T00:00:00.000Z');

    // Find JEN
    const staff = await prisma.staff.findFirst({
        where: { name: { contains: 'JEN', mode: 'insensitive' } }
    });

    if (!staff) {
        console.log('Staff JEN not found');
        return;
    }

    console.log(`Checking Shift for ${staff.name} (${staff.id}) on 2026-01-03`);

    const shift = await prisma.shift.findFirst({
        where: {
            staffId: staff.id,
            date: {
                gte: new Date('2026-01-03T00:00:00.000Z'),
                lte: new Date('2026-01-03T23:59:59.000Z')
            }
        }
    });

    console.log('Shift:', shift);

    // Check bookings too
    const bookings = await prisma.booking.findMany({
        where: {
            staffId: staff.id,
            startAt: { gte: date },
            endAt: { lt: new Date('2026-01-04T00:00:00.000Z') }
        }
    });
    console.log('Bookings:', bookings);
}

main();
