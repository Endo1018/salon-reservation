
import { prisma } from '../lib/db';

async function mockUpdateBooking(id: string, data: any) {
    console.log("Mock Update ID:", id);
    const target = await prisma.booking.findUnique({
        where: { id },
        include: { service: true }
    });
    if (!target) throw new Error('Booking not found');

    // 2. Fetch New Service (if changed)
    let service = target.service;
    if (data.serviceId && data.serviceId !== target.menuId) {
        service = await prisma.service.findUnique({ where: { id: data.serviceId } });
        if (!service) throw new Error('Service not found');
    }

    // Simulate Timezone Fix
    const [yyyy, mm, dd] = data.date.split('-').map(Number);
    const [hours, mins] = data.startTime.split(':').map(Number);
    const startAt = new Date(Date.UTC(yyyy, mm - 1, dd, hours - 7, mins));
    console.log("Calculated startAt (UTC):", startAt.toISOString());

    const duration = data.duration || (service?.duration || 0);
    const endAt = new Date(startAt.getTime() + duration * 60000);

    if (target.comboLinkId) {
        const isServiceChanged = data.serviceId && data.serviceId !== target.menuId;
        console.log("Is Service Changed:", isServiceChanged);
        console.log("Service Type:", service.type);
        console.log("Is Combo Strict:", service.type === 'Combo');

        const legs = await prisma.booking.findMany({
            where: { comboLinkId: target.comboLinkId },
            orderBy: { startAt: 'asc' }
        });

        const mainLeg = legs.find(l => l.isComboMain) || legs[0];
        const subLeg = legs.find(l => !l.isComboMain) || legs[1] || null;

        // CALCULATE SPLIT TIMES
        let massageStart = startAt;
        let massageEnd = startAt;
        let spaStart = startAt;
        let spaEnd = endAt;

        if (service?.type === 'Combo') {
            const mDur = service.massageDuration || 0;
            const hDur = service.headSpaDuration || 0;

            if (data.isHeadSpaFirst) {
                // HEAD SPA FIRST
                console.log("Applying HEAD SPA FIRST logic");
                spaStart = startAt;
                spaEnd = new Date(startAt.getTime() + hDur * 60000);
                massageStart = spaEnd;
                massageEnd = endAt;
            } else {
                // MASSAGE FIRST
                console.log("Applying MASSAGE FIRST logic");
                massageStart = startAt;
                massageEnd = new Date(startAt.getTime() + mDur * 60000);
                spaStart = massageEnd;
                spaEnd = endAt;
            }
        }

        console.log("Calc Massage:", massageStart.toISOString());
        console.log("Calc Spa:", spaStart.toISOString());

        if (isServiceChanged && service?.type === 'Combo') {
            // ...
        } else if (isServiceChanged && service?.type !== 'Combo') {
            // ...
        } else {
            console.log("Entering Branch: Service NOT Changed");
            if (service?.type === 'Combo') {
                console.log("Updating Legs...");
                if (mainLeg) {
                    await prisma.booking.update({ where: { id: mainLeg.id }, data: { startAt: massageStart, endAt: massageEnd } });
                    console.log("Updated Main");
                }
                if (subLeg) {
                    await prisma.booking.update({ where: { id: subLeg.id }, data: { startAt: spaStart, endAt: spaEnd } });
                    console.log("Updated Sub");
                }
            } else {
                console.log("Skipped Branch: Service not Combo?");
            }
        }
    }
}

async function main() {
    const target = await prisma.booking.findFirst({
        where: {
            clientName: { contains: 'Noda', mode: 'insensitive' },
            menuName: { contains: 'CHAMPACA' }
        },
        include: { service: true }
    });

    if (!target) {
        console.error("Target not found");
        return;
    }

    await mockUpdateBooking(target.id, {
        date: '2026-01-23',
        startTime: '15:50',
        isHeadSpaFirst: true,
        serviceId: target.menuId // Simulate passing same ID
    });
}

main().catch(console.error).finally(() => prisma.$disconnect());
