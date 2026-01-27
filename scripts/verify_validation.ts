import { createBooking, updateBooking, deleteBooking } from '../app/actions/timeline';
import { prisma } from '../lib/db';

async function main() {
    console.log("=== STARTING VALIDATION VERIFICATION ===");

    // 1. Setup: Ensure clean slate for test resources
    const date = '2026-02-01'; // Future date
    const serviceId = (await prisma.service.findFirst({ where: { category: 'HEAD SPA' } }))?.id;
    if (!serviceId) throw new Error("No Service found");

    console.log("Cleaning up test bookings...");
    await prisma.booking.deleteMany({
        where: {
            startAt: {
                gte: new Date(`${date}T00:00:00Z`),
                lte: new Date(`${date}T23:59:59Z`)
            }
        }
    });

    // 2. Create Base Booking (Blocking Spa 1)
    console.log("\n1. Creating Base Booking on Spa 1 (10:00 - 11:00)");
    await createBooking({
        resourceId: 'spa-1',
        date,
        startTime: '10:00',
        duration: 60,
        serviceId,
        clientName: 'Base Blocker'
    });
    console.log("Base Booking Created.");

    // 3. Create Conflicting Booking (Targeting Spa 1)
    console.log("\n2. Creating Conflicting Booking on Spa 1 (10:15 - 11:15)");
    try {
        await createBooking({
            resourceId: 'spa-1',
            date,
            startTime: '10:15',
            duration: 60,
            serviceId,
            clientName: 'Conflict Tester'
        });
        console.log("Conflict Tester Created (Should have reallocated).");
    } catch (e: any) {
        console.error("Creation Failed (Unexpected if Realloc works):", e.message);
    }

    // Verify Reallocation
    const bookings = await prisma.booking.findMany({
        where: {
            startAt: { gte: new Date(`${date}T00:00:00Z`) },
            clientName: 'Conflict Tester'
        }
    });

    if (bookings.length > 0) {
        const b = bookings[0];
        console.log(`Conflict Tester Result: Resource=${b.resourceId} (Expected !== spa-1)`);
        if (b.resourceId !== 'spa-1') {
            console.log("SUCCESS: Auto-reallocated.");
        } else {
            console.error("FAILURE: Still on spa-1 (Double Booking!)");
        }
    } else {
        console.error("FAILURE: Booking not created.");
    }

    // 3. Test Update Conflict
    // Create another booking on Spa 2 (12:00)
    console.log("\n3. Creating Update Tester on Spa 2 (12:00)");
    await createBooking({
        resourceId: 'spa-2',
        date,
        startTime: '12:00',
        duration: 60,
        serviceId,
        clientName: 'Update Tester'
    });

    const updateTester = await prisma.booking.findFirst({ where: { clientName: 'Update Tester' } });
    if (!updateTester) throw new Error("Update Tester not found");

    // Create Blocker on Spa 1 (13:00)
    console.log("Creating Blocker on Spa 1 (13:00)");
    await createBooking({
        resourceId: 'spa-1',
        date,
        startTime: '13:00',
        duration: 60,
        serviceId,
        clientName: 'Update Blocker'
    });

    // Try to move Update Tester to Spa 1 (13:00) via Update
    // Note: updateBooking does NOT take resourceId, so it tries to keep Spa 2.
    // Wait, if I change time to 13:00, it stays on Spa 2.
    // Spa 2 is FREE at 13:00. So no conflict.

    // To test conflict, I need to make Spa 2 BUSY at 13:00 too.
    console.log("Creating Blocker on Spa 2 (13:00)");
    await createBooking({
        resourceId: 'spa-2',
        date,
        startTime: '13:00',
        duration: 60,
        serviceId,
        clientName: 'Update Blocker 2'
    });

    console.log("Updating Update Tester to 13:00 (Spa 2 is blocked)...");
    try {
        await updateBooking(updateTester.id, {
            date,
            startTime: '13:00',
            duration: 60,
            serviceId,
            clientName: 'Update Tester Moved'
        });
        console.log("Update Success.");

        const updated = await prisma.booking.findUnique({ where: { id: updateTester.id } });
        console.log(`Update Result: Resource=${updated?.resourceId}`);
        if (updated?.resourceId !== 'spa-2') {
            console.log("SUCCESS: Auto-reallocated from Spa 2.");
        } else {
            console.error("FAILURE: Still on Spa 2 (Double Booking)");
        }

    } catch (e: any) {
        console.log("Update Failed:", e.message);
        if (e.message.includes("fully booked")) console.log("SUCCESS: Correctly rejected if full.");
        else console.log("Partial Success if error is expected.");
    }
}

main().catch(console.error);
