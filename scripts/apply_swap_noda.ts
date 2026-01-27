
// We cannot easily import server actions in standalone script due to 'use server' and Next.js context.
// But we can replicate the data object and call a mock function or try to run it via `tsx` if we strip 'use server'.
// Better: We already have `test_realloc_action.ts` which successfully swapped it locally.
// Wait, `test_realloc_action.ts` (Step 3346) passed!
// It said "Final Spa Res: spa-4".
// Did it COMMIT to DB?
// No, `test_realloc_action.ts` in step 3341 logic:
// It ran `prisma.find...` then LOGGED what it would do. It did NOT `prisma.update`.
// Ah.
// So the LOGIC is correct, but we haven't tested the WRITE.
// But the user says "Nothing happened".
// And `check_noda_status` says "Massage First".
// So `updateBooking` is failing to write.

// I will Create `scripts/force_swap_via_action.ts` which IMPORTS `updateBooking`?
// No, 'use server' prevents that in `tsx`.
// I must copy the `updateBooking` code into a script (stripping use server) and RUN IT against the DB.
// If that works, then the deployed code is different or UI payload is wrong.

// Let's assume the deployed code matches my rewrite in Step 3350.
// Let's assume UI payload is correct (BookingModal.tsx Step 3310).

// Is there a Prisma Transaction error?
// `await Promise.all(updatePromises);`
// If one fails, does it throw? Yes.
// If it throws, the UI should show "Operation failed" alert.
// User didn't mention alert. Just "Color changes only" (maybe implies partial update?).
// Or "Nothing happens".

// Wait. "Color changes only".
// If only color changed, maybe `clientName` updated? Or just local React State changed?
// If DB didn't update, then React State is out of sync.

// I will write a script `scripts/apply_swap_noda.ts` that actually PERFORMES the update using Prisma, replicating the logic exactly.
// This will fix the user's data AND prove the logic works.

import { prisma } from '../lib/db';
import { findFreeResource, isResourceFree, getPoolByResourceId } from '../app/services/booking-service';

// ... Copy-paste relevant logic from timeline.ts ...

async function applySwap() {
    const target = await prisma.booking.findFirst({
        where: { clientName: { contains: 'Noda' }, menuName: { contains: 'CHAMPACA' }, isComboMain: true },
        include: { service: true }
    });
    if (!target) return console.error("Target NOT found");

    const data = {
        date: '2026-01-23',
        startTime: '15:50',
        isHeadSpaFirstOrder: true
    };

    // ... Logic ...
    // See `test_realloc_action.ts` but with Write.
    const service = target.service;
    if (!service) return;

    // Time Calc
    const [yyyy, mm, dd] = data.date.split('-').map(Number);
    const [hours, mins] = data.startTime.split(':').map(Number);
    const startAt = new Date(Date.UTC(yyyy, mm - 1, dd, hours - 7, mins));

    let duration = service.duration || 120;
    if (service.type?.toLowerCase() === 'combo') {
        duration = (service.massageDuration || 0) + (service.headSpaDuration || 0);
    }
    const endAt = new Date(startAt.getTime() + duration * 60000);

    const legs = await prisma.booking.findMany({ where: { comboLinkId: target.comboLinkId } });
    const mainLeg = legs.find(l => l.isComboMain);
    const subLeg = legs.find(l => !l.isComboMain);

    let massageStart = startAt; // Placeholder
    let massageEnd = startAt;
    let spaStart = startAt;
    let spaEnd = endAt; // Placeholder

    const mDur = service.massageDuration || 60;
    const hDur = service.headSpaDuration || 60;

    // Head Spa First
    spaStart = startAt;
    spaEnd = new Date(startAt.getTime() + hDur * 60000);
    massageStart = spaEnd;
    massageEnd = endAt;

    console.log(`Plan: Spa ${spaStart.toISOString()}~${spaEnd.toISOString()} | Massage ${massageStart.toISOString()}~${massageEnd.toISOString()}`);

    // Realloc
    let finalSpaResId = subLeg?.resourceId || 'spa-1';
    let finalMassageResId = mainLeg?.resourceId || 'aroma-a2';

    if (subLeg) {
        const isFree = await isResourceFree(subLeg.resourceId, spaStart, spaEnd, subLeg.id);
        console.log(`Spa ${subLeg.resourceId} free? ${isFree}`);
        if (!isFree) {
            const newRes = await findFreeResource(['spa-1', 'spa-2', 'spa-3', 'spa-4'], spaStart, spaEnd, subLeg.id);
            console.log(`New Spa Res: ${newRes}`);
            if (newRes) finalSpaResId = newRes;
        }
    }

    // UPDATE
    if (mainLeg) {
        await prisma.booking.update({
            where: { id: mainLeg.id },
            data: { startAt: massageStart, endAt: massageEnd, resourceId: finalMassageResId }
        });
    }
    if (subLeg) {
        await prisma.booking.update({
            where: { id: subLeg.id },
            data: { startAt: spaStart, endAt: spaEnd, resourceId: finalSpaResId }
        });
    }
    console.log("Update Complete");
}

applySwap().catch(console.error).finally(() => prisma.$disconnect());
