
import { prisma } from '../lib/db';
import { findFreeResource, isResourceFree, getPoolByResourceId } from '../app/services/booking-service';

// Mock Data
const BOOKING_ID = "214a1a6f-3957-4638-b76b-950c4bb7c4e5"; // Need actual ID of Main Leg? Or any?
// Check user image, Noda Rika. 
// I'll filter by name to get ID.

async function mockUpdate() {
    // 1. Find Target
    const target = await prisma.booking.findFirst({
        where: { clientName: { contains: 'Noda' }, menuName: { contains: 'CHAMPACA' }, isComboMain: true },
        include: { service: true }
    });
    if (!target) return console.error("Target NOT found");
    console.log(`Target: ${target.id} (${target.clientName})`);

    const data = {
        date: '2026-01-23',
        startTime: '15:50', // Local
        isHeadSpaFirstOrder: true
    };

    // LOGIC START
    console.log("\n--- Logic Start ---");
    let service = target.service; // Assume Service Not Changed

    // Time Calc
    const [yyyy, mm, dd] = data.date.split('-').map(Number);
    const [hours, mins] = data.startTime.split(':').map(Number);
    const startAt = new Date(Date.UTC(yyyy, mm - 1, dd, hours - 7, mins));

    let duration = service?.duration || 0;
    if (service?.type?.trim().toLowerCase() === 'combo') {
        const sumDur = (service.massageDuration || 0) + (service.headSpaDuration || 0);
        if (sumDur > 0) duration = sumDur;
    }
    const endAt = new Date(startAt.getTime() + duration * 60000);

    console.log(`Calculated Time: ${startAt.toISOString()} - ${endAt.toISOString()}`);

    if (target.comboLinkId) {
        const legs = await prisma.booking.findMany({
            where: { comboLinkId: target.comboLinkId },
            orderBy: { startAt: 'asc' }
        });

        const mainLeg = legs.find(l => l.isComboMain) || legs[0];
        const subLeg = legs.find(l => !l.isComboMain) || legs[1] || null;

        let massageStart = startAt;
        let massageEnd = startAt;
        let spaStart = startAt;
        let spaEnd = endAt;

        if (service?.type?.trim().toLowerCase() === 'combo') {
            const mDur = service.massageDuration || 0;
            const hDur = service.headSpaDuration || 0;

            if (data.isHeadSpaFirstOrder) {
                console.log("Order: Head Spa First");
                spaStart = startAt;
                spaEnd = new Date(startAt.getTime() + hDur * 60000);
                massageStart = spaEnd;
                massageEnd = endAt;
            } else {
                console.log("Order: Massage First");
                massageStart = startAt;
                massageEnd = new Date(startAt.getTime() + mDur * 60000);
                spaStart = massageEnd;
                spaEnd = endAt;
            }
        }

        console.log(`Spa Time: ${spaStart.toISOString()} - ${spaEnd.toISOString()} on ${subLeg?.resourceId}`);

        // REALLOC CHECK
        let finalSpaResId = subLeg?.resourceId;
        if (subLeg) {
            console.log(`Checking Realloc for Sub (${subLeg.resourceId})...`);
            const isFree = await isResourceFree(subLeg.resourceId, spaStart, spaEnd, subLeg.id);
            console.log(`Is Free? ${isFree}`);

            if (!isFree) {
                const poolInfo = getPoolByResourceId(subLeg.resourceId);
                if (poolInfo) {
                    const newRes = await findFreeResource(poolInfo.pool, spaStart, spaEnd, subLeg.id);
                    console.log(`Found Free Res: ${newRes}`);
                    if (newRes) {
                        finalSpaResId = newRes;
                    }
                }
            }
        }

        console.log(`Final Spa Res: ${finalSpaResId}`);
    }
}

mockUpdate().catch(console.error).finally(() => prisma.$disconnect());
