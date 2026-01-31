
import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const prisma = new PrismaClient();

async function main() {
    // 1. Inspect bookings for 2026-01-28
    const dateStr = '2026-01-28';
    const startOfDay = new Date(`${dateStr}T00:00:00`);
    const endOfDay = new Date(`${dateStr}T23:59:59`);

    console.log(`\n=== Bookings for ${dateStr} ===`);
    const bookings = await prisma.booking.findMany({
        where: {
            startAt: { gte: startOfDay, lte: endOfDay },
        },
        include: {
            staff: { select: { name: true } },
            service: { select: { name: true } },
        },
        orderBy: { startAt: 'asc' }
    });

    bookings.forEach(b => {
        console.log(`[${b.startAt.toISOString()} - ${b.endAt.toISOString()}] ${b.resourceId} | ${b.menuName} | Staff: ${b.staff?.name} | Status: ${b.status}`);
    });

    // 2. Inspect Monthly Summary for Jen and Joy for Jan 2026
    const year = 2026;
    const month = 1;
    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59);

    console.log(`\n=== Summary for Jen and Joy (${month}/${year}) ===`);

    // Fetch all bookings for the month
    const monthBookings = await prisma.booking.findMany({
        where: {
            startAt: { gte: startOfMonth, lte: endOfMonth },
            status: { not: 'Cancelled' },
            staffId: { not: null }
        },
        include: { service: true, staff: true }
    });

    const targetStaff = ['Jen', 'Joy'];

    for (const name of targetStaff) {
        // Find staff ID
        const staff = await prisma.staff.findFirst({
            where: { name: { contains: name, mode: 'insensitive' } }
        });

        if (!staff) {
            console.log(`Staff ${name} not found.`);
            continue;
        }

        const staffBookings = monthBookings.filter(b => b.staffId === staff.id);
        const count = staffBookings.length;
        const totalMs = staffBookings.reduce((acc, b) => acc + (b.endAt.getTime() - b.startAt.getTime()), 0);
        const totalMinutes = Math.floor(totalMs / 60000);

        // Calculate based on current logic
        const totalHours = totalMs / (1000 * 60 * 60);
        const commission = Math.floor(totalHours * (staff.commissionRate || 0));

        console.log(`\nStaff: ${staff.name} (ID: ${staff.id})`);
        console.log(`Booking Count (Tour): ${count}`);
        console.log(`Total Minutes: ${totalMinutes}`);
        console.log(`Commission Rate: ${staff.commissionRate}`);
        console.log(`Calculated Commission: ${commission}`);

        console.log(`--- Bookings List for ${staff.name} ---`);
        staffBookings.forEach(b => {
            console.log(`  ${b.startAt.toISOString()} | ${b.menuName} | ${b.service.name}`);
        });
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
