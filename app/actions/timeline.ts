'use server';

import { prisma } from '@/lib/db';
import type { Service } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { findFreeResource, isResourceFree, getPoolByResourceId, resourcePools } from '@/app/services/booking-service';

// --- TYPES ---
export type TimelineResource = {
    id: string;
    name: string;
    category: string; // 'HEAD SPA', 'AROMA ROOM', 'MASSAGE SEAT'
};

export type TimelineBooking = {
    id: string;
    resourceId: string;
    startAt: Date;
    endAt: Date;
    clientName: string;
    menuName: string;
    staffName: string;
    status: string;
};

// --- READ ACTIONS ---

export async function getAvailableStaff(dateStr: string, startTime: string, duration: number) {
    const startAt = new Date(`${dateStr}T${startTime}:00`);
    const endAt = new Date(startAt.getTime() + duration * 60000);

    const therapists = await prisma.staff.findMany({
        where: { isActive: true, role: 'THERAPIST' },
        select: { id: true, name: true }
    });

    const therapistIds = therapists.map(t => t.id);

    const [shifts, conflictingBookings] = await Promise.all([
        prisma.shift.findMany({
            where: {
                date: {
                    gte: new Date(`${dateStr}T00:00:00`),
                    lte: new Date(`${dateStr}T23:59:59`),
                },
                staffId: { in: therapistIds }
            }
        }),
        prisma.booking.findMany({
            where: {
                startAt: { lt: endAt },
                endAt: { gt: startAt },
                staffId: { in: therapistIds }
            },
            select: { staffId: true }
        })
    ]);

    const busyStaffIds = new Set(conflictingBookings.map(b => b.staffId));

    const available = therapists.filter(t => {
        const shift = shifts.find(s => s.staffId === t.id);
        const rawStatus = shift?.status;
        const statusUpper = rawStatus?.toUpperCase();

        if (rawStatus === '-' || !rawStatus) return true;

        const isOff = statusUpper === 'OFF' || statusUpper === 'AL' || statusUpper === 'HOLIDAY' || statusUpper === 'ABSENT';
        if (isOff) return false;

        if (busyStaffIds.has(t.id)) return false;

        return true;
    });
    return available;
}

export async function getActiveTherapists() {
    return await prisma.staff.findMany({
        where: { isActive: true, role: 'THERAPIST' },
        select: { id: true, name: true, insuranceBaseSalary: false }
    });
}

export async function getTimelineData(dateStr: string) {
    const resources: TimelineResource[] = [
        { id: 'spa-1', name: 'Spa 1', category: 'HEAD SPA' },
        { id: 'spa-2', name: 'Spa 2', category: 'HEAD SPA' },
        { id: 'spa-3', name: 'Spa 3', category: 'HEAD SPA' },
        { id: 'spa-4', name: 'Spa 4', category: 'HEAD SPA' },

        { id: 'aroma-a1', name: 'Aroma Room A-1', category: 'AROMA ROOM' },
        { id: 'aroma-a2', name: 'Aroma Room A-2', category: 'AROMA ROOM' },
        { id: 'aroma-b1', name: 'Aroma Room B-1', category: 'AROMA ROOM' },
        { id: 'aroma-b2', name: 'Aroma Room B-2', category: 'AROMA ROOM' },

        { id: 'seat-1', name: 'Massage Seat 1', category: 'MASSAGE SEAT' },
        { id: 'seat-2', name: 'Massage Seat 2', category: 'MASSAGE SEAT' },
        { id: 'seat-3', name: 'Massage Seat 3', category: 'MASSAGE SEAT' },
        { id: 'seat-4', name: 'Massage Seat 4', category: 'MASSAGE SEAT' },
        { id: 'seat-5', name: 'Massage Seat 5', category: 'MASSAGE SEAT' },

        { id: 'overflow-spa', name: '⚠️ Overflow Spa', category: 'HEAD SPA' },
        { id: 'overflow-aroma', name: '⚠️ Overflow Aroma', category: 'AROMA ROOM' },
        { id: 'overflow-seat', name: '⚠️ Overflow Seat', category: 'MASSAGE SEAT' },
    ];

    const startOfDay = new Date(`${dateStr}T00:00:00`);
    const endOfDay = new Date(`${dateStr}T23:59:59`);

    const bookings = await prisma.booking.findMany({
        where: {
            startAt: { gte: startOfDay },
            endAt: { lte: endOfDay }
        },
        include: {
            staff: { select: { name: true } },
            customer: { select: { name: true } },
            service: { select: { name: true } }
        }
    });

    const formattedBookings: TimelineBooking[] = bookings.map(b => ({
        id: b.id,
        resourceId: b.resourceId,
        startAt: b.startAt,
        endAt: b.endAt,
        clientName: b.customer?.name || b.clientName || 'Unknown',
        menuName: b.service?.name || b.menuName || 'Unknown',
        staffName: b.staff?.name || '?',
        status: b.status
    }));

    return { resources, bookings: formattedBookings };
}

// --- WRITE ACTIONS ---

export async function createBooking(data: {
    resourceId: string;
    date: string;       // YYYY-MM-DD
    startTime: string;  // HH:mm
    duration: number;   // minutes
    serviceId: string;
    staffId?: string | null;
    staffId2?: string | null;
    customerId?: string;
    clientName?: string;
    isAroma?: boolean;
    isHeadSpaFirstOrder?: boolean;
}) {
    try {
        const [yyyy, mm, dd] = data.date.split('-').map(Number);
        const [hours, mins] = data.startTime.split(':').map(Number);

        // Timezone Fix: GMT+7 input -> UTC
        const startAt = new Date(Date.UTC(yyyy, mm - 1, dd, hours - 7, mins));
        const endAt = new Date(startAt.getTime() + data.duration * 60000);

        const service = await prisma.service.findUnique({ where: { id: data.serviceId } });
        if (!service) throw new Error('Service not found');

        // Case-insensitive Combo check
        const isCombo = service.type && service.type.trim().toLowerCase() === 'combo';

        if (isCombo) {
            const comboLinkId = crypto.randomUUID();
            const mDur = service.massageDuration || 0;
            const hDur = service.headSpaDuration || 0;

            let massageResId = '';
            let headSpaResId = '';

            // Logic for resource assignment (simplified from prior versions)
            let massageStart = startAt;
            let massageEnd = new Date(startAt.getTime() + mDur * 60000);
            let spaStart = massageEnd;
            let spaEnd = endAt; // Standard Order

            if (data.isHeadSpaFirstOrder) {
                spaStart = startAt;
                spaEnd = new Date(startAt.getTime() + hDur * 60000);
                massageStart = spaEnd;
                massageEnd = endAt;
            }

            // Resource Logic
            if (data.resourceId.startsWith('spa-')) {
                headSpaResId = data.resourceId;
                const useAroma = data.isAroma || service.name.includes('Aroma') || service.name.includes('Couple') || service.name.includes('CHAMPACA');
                massageResId = useAroma ? 'aroma-a1' : 'seat-1';
                // Auto-find free for massage?
                const freeM = await findFreeResource(useAroma ? resourcePools.aroma : resourcePools.seat, massageStart, massageEnd);
                if (freeM) massageResId = freeM;
            } else {
                massageResId = data.resourceId;
                headSpaResId = 'spa-1';
                const freeS = await findFreeResource(resourcePools.spa, spaStart, spaEnd);
                if (freeS) headSpaResId = freeS;
            }

            // Booking A (Massage)
            await prisma.booking.create({
                data: {
                    menuId: service.id,
                    menuName: `${service.name} (Massage)`,
                    staffId: data.staffId || null,
                    resourceId: massageResId,
                    startAt: massageStart,
                    endAt: massageEnd,
                    status: 'Confirmed',
                    clientName: data.clientName || 'Walk-in',
                    customerId: data.customerId,
                    comboLinkId,
                    isComboMain: true
                }
            });

            // Booking B (Head Spa)
            await prisma.booking.create({
                data: {
                    menuId: service.id,
                    menuName: `${service.name} (Head Spa)`,
                    staffId: data.staffId2 || data.staffId || null,
                    resourceId: headSpaResId,
                    startAt: spaStart,
                    endAt: spaEnd,
                    status: 'Confirmed',
                    clientName: data.clientName || 'Walk-in',
                    customerId: data.customerId,
                    comboLinkId,
                    isComboMain: false
                }
            });

        } else {
            // Single
            let targetResourceId = data.resourceId;

            // --- VALIDATION & AUTO-REALLOCATION ---
            const isFree = await isResourceFree(targetResourceId, startAt, endAt);
            if (!isFree) {
                console.log(`[CreateBooking] Conflict for ${targetResourceId} @ ${startAt.toISOString()}. Attempting Auto-Realloc.`);

                const poolInfo = getPoolByResourceId(targetResourceId);
                if (poolInfo) {
                    const newRes = await findFreeResource(poolInfo.pool, startAt, endAt);
                    if (newRes) {
                        console.log(`[CreateBooking] Reallocated to ${newRes}`);
                        targetResourceId = newRes;
                    } else {
                        throw new Error(`Time slot is fully booked for ${poolInfo.type}. Please choose another time.`);
                    }
                } else {
                    throw new Error('Selected resource is busy.');
                }
            }

            await prisma.booking.create({
                data: {
                    menuId: service.id,
                    menuName: service.name,
                    staffId: data.staffId || null,
                    resourceId: targetResourceId,
                    startAt,
                    endAt,
                    status: 'Confirmed',
                    clientName: data.clientName || 'Walk-in',
                    customerId: data.customerId,
                }
            });
        }

        revalidatePath('/admin/timeline');
    } catch (e) {
        console.error("Booking Creation Failed:", e);
        throw e;
    }
}


// --- EDIT ACTIONS ---

export async function getBooking(id: string) {
    const main = await prisma.booking.findUnique({
        where: { id },
        include: { service: true }
    });
    if (!main) return null;

    let isHeadSpaFirst = false;
    let overallStart = main.startAt;

    if (main.comboLinkId) {
        const group = await prisma.booking.findMany({
            where: { comboLinkId: main.comboLinkId },
            orderBy: { startAt: 'asc' }
        });
        if (group.length > 0) {
            overallStart = group[0].startAt;
            // If main leg (Massage) is NOT first, then Head Spa is first
            isHeadSpaFirst = !group[0].isComboMain;
        }
    }

    return {
        ...main,
        overallStart,
        isHeadSpaFirstOrder: isHeadSpaFirst
    };
}

export async function updateBooking(id: string, data: {
    date: string;
    startTime: string;
    duration?: number;
    serviceId?: string;
    staffId?: string | null;
    staffId2?: string | null;
    clientName?: string;
    isHeadSpaFirstOrder?: boolean;
}) {
    console.log("[updateBooking] Payload:", JSON.stringify(data));

    // 1. Fetch Target
    const target = await prisma.booking.findUnique({
        where: { id },
        include: { service: true }
    });
    if (!target) throw new Error('Booking not found');

    // 2. Fetch New Service
    let service: Service | null = target.service;
    if (data.serviceId && data.serviceId !== target.menuId) {
        service = await prisma.service.findUnique({ where: { id: data.serviceId } });
        if (!service) throw new Error('Service not found');
    }

    // 3. Time Calc (UTC)
    const [yyyy, mm, dd] = data.date.split('-').map(Number);
    const [hours, mins] = data.startTime.split(':').map(Number);
    const startAt = new Date(Date.UTC(yyyy, mm - 1, dd, hours - 7, mins));

    // Duration Logic
    let duration = data.duration || (service?.duration || 0);
    const isCombo = service?.type?.trim().toLowerCase() === 'combo';

    if (isCombo) {
        const sumDur = (service.massageDuration || 0) + (service.headSpaDuration || 0);
        if (sumDur > 0) duration = sumDur;
        console.log(`[updateBooking] Enforcing Combo Duration: ${duration}`);
    }
    const endAt = new Date(startAt.getTime() + duration * 60000);

    // 4. Update Logic
    if (target.comboLinkId) {
        // --- COMBO UPDATE ---
        const isServiceChanged = data.serviceId && data.serviceId !== target.menuId;

        const legs = await prisma.booking.findMany({
            where: { comboLinkId: target.comboLinkId },
            orderBy: { startAt: 'asc' }
        });

        const mainLeg = legs.find(l => l.isComboMain) || legs[0];
        const subLeg = legs.find(l => !l.isComboMain) || legs[1] || null;

        const updatePromises = [];

        // Calculate Split Times
        let massageStart = startAt;
        let massageEnd = endAt; // Default for Single
        let spaStart = startAt;
        let spaEnd = endAt;      // Default for Single

        if (isCombo) {
            const mDur = service.massageDuration || 0;
            const hDur = service.headSpaDuration || 0;

            if (data.isHeadSpaFirstOrder) {
                // HEAD SPA FIRST
                spaStart = startAt;
                spaEnd = new Date(startAt.getTime() + hDur * 60000);
                massageStart = spaEnd;
                massageEnd = endAt;
            } else {
                // MASSAGE FIRST
                massageStart = startAt;
                massageEnd = new Date(startAt.getTime() + mDur * 60000);
                spaStart = massageEnd;
                spaEnd = endAt;
            }
        }

        // --- AUTO REALLOCATION ---
        let finalMassageResId = mainLeg?.resourceId || 'seat-1';
        if (mainLeg) {
            const isFree = await isResourceFree(mainLeg.resourceId, massageStart, massageEnd, mainLeg.id);
            if (!isFree) {
                console.log(`[AutoRealloc] Conflict Main ${mainLeg.resourceId}`);
                const poolInfo = getPoolByResourceId(mainLeg.resourceId);
                if (poolInfo) {
                    const newRes = await findFreeResource(poolInfo.pool, massageStart, massageEnd, mainLeg.id);
                    if (newRes) finalMassageResId = newRes;
                }
            }
        }

        let finalSpaResId = subLeg?.resourceId || 'spa-1';
        if (subLeg) {
            const isFree = await isResourceFree(subLeg.resourceId, spaStart, spaEnd, subLeg.id);
            if (!isFree) {
                console.log(`[AutoRealloc] Conflict Sub ${subLeg.resourceId}`);
                const poolInfo = getPoolByResourceId(subLeg.resourceId);
                if (poolInfo) {
                    const newRes = await findFreeResource(poolInfo.pool, spaStart, spaEnd, subLeg.id);
                    if (newRes) finalSpaResId = newRes;
                }
            }
        }

        // APPLY UPDATES
        if (isServiceChanged && isCombo) {
            if (mainLeg) {
                updatePromises.push(prisma.booking.update({
                    where: { id: mainLeg.id },
                    data: {
                        menuId: service.id,
                        menuName: `${service.name} (Massage)`,
                        startAt: massageStart,
                        endAt: massageEnd,
                        resourceId: finalMassageResId
                    }
                }));
            }
            if (subLeg) {
                updatePromises.push(prisma.booking.update({
                    where: { id: subLeg.id },
                    data: {
                        menuId: service.id,
                        menuName: `${service.name} (Head Spa)`,
                        startAt: spaStart,
                        endAt: spaEnd,
                        resourceId: finalSpaResId
                    }
                }));
            }
        } else if (isServiceChanged && !isCombo) {
            // Combo -> Single
            if (subLeg) updatePromises.push(prisma.booking.delete({ where: { id: subLeg.id } }));
            if (mainLeg) {
                updatePromises.push(prisma.booking.update({
                    where: { id: mainLeg.id },
                    data: {
                        menuId: service!.id,
                        menuName: service!.name,
                        startAt: startAt,
                        endAt: endAt,
                        comboLinkId: null,
                        isComboMain: false,
                        resourceId: finalMassageResId
                    }
                }));
            }
        } else {
            // Service NOT Changed
            if (isCombo) {
                if (mainLeg) {
                    updatePromises.push(prisma.booking.update({
                        where: { id: mainLeg.id },
                        data: {
                            startAt: massageStart,
                            endAt: massageEnd,
                            resourceId: finalMassageResId
                        }
                    }));
                }
                if (subLeg) {
                    updatePromises.push(prisma.booking.update({
                        where: { id: subLeg.id },
                        data: {
                            startAt: spaStart,
                            endAt: spaEnd,
                            resourceId: finalSpaResId
                        }
                    }));
                }
            } else {
                // Single Service Update
                if (mainLeg) {
                    updatePromises.push(prisma.booking.update({
                        where: { id: mainLeg.id },
                        data: {
                            startAt,
                            endAt,
                            resourceId: finalMassageResId
                        }
                    }));
                }
            }
        }

        // Common Staff/Client Updates
        if (data.staffId !== undefined && mainLeg) {
            updatePromises.push(prisma.booking.update({ where: { id: mainLeg.id }, data: { staffId: data.staffId } }));
        }
        if (data.staffId2 !== undefined && subLeg) {
            updatePromises.push(prisma.booking.update({ where: { id: subLeg.id }, data: { staffId: data.staffId2 } }));
        }
        if (data.clientName !== undefined) {
            updatePromises.push(prisma.booking.updateMany({ where: { comboLinkId: target.comboLinkId }, data: { clientName: data.clientName } }));
        }

        await Promise.all(updatePromises);

    } else {
        // --- SINGLE UPDATE ---
        // (Convert Single -> Combo if needed)
        if (isCombo) {
            const comboLinkId = crypto.randomUUID();
            const mDur = service.massageDuration || 0;
            const hDur = service.headSpaDuration || 0;
            const massageEnd = new Date(startAt.getTime() + mDur * 60000);

            // Realloc Logic for Main (Massage)
            let mainResId = target.resourceId;
            // Check if current res accepts massage? Usually yes if seat. If spa, maybe.
            // But let's check availability.
            let isFreeM = await isResourceFree(mainResId, startAt, massageEnd, id);
            if (!isFreeM) {
                // Try to keep same category?
                const poolInfo = getPoolByResourceId(mainResId);
                if (poolInfo) {
                    const newM = await findFreeResource(poolInfo.pool, startAt, massageEnd, id);
                    if (newM) mainResId = newM;
                    else throw new Error("Main service time slot is busy.");
                }
            }

            // Realloc Logic for Sub (Spa - fixed to spa-1 default or auto)
            let subResId = 'spa-1';
            const isFreeS = await isResourceFree(subResId, massageEnd, endAt);
            if (!isFreeS) {
                const newS = await findFreeResource(resourcePools.spa, massageEnd, endAt);
                if (newS) subResId = newS;
                else throw new Error("Head Spa time slot is busy.");
            }


            // Update Main
            await prisma.booking.update({
                where: { id },
                data: {
                    menuId: service.id,
                    menuName: `${service.name} (Massage)`,
                    startAt: startAt,
                    endAt: massageEnd,
                    comboLinkId,
                    resourceId: mainResId
                }
            });

            // Create Sub
            await prisma.booking.create({
                data: {
                    menuId: service.id,
                    menuName: `${service.name} (Head Spa)`,
                    staffId: data.staffId2 || data.staffId || null,
                    resourceId: subResId,
                    startAt: massageEnd,
                    endAt: endAt,
                    status: 'Confirmed',
                    clientName: data.clientName || target.clientName || 'Walk-in',
                    customerId: target.customerId,
                    comboLinkId,
                    isComboMain: false
                }
            });

        } else {
            // Single -> Single
            let targetResourceId = target.resourceId; // Keep existing resource

            // --- VALIDATION & AUTO-REALLOCATION ---
            const isFree = await isResourceFree(targetResourceId, startAt, endAt, id);
            if (!isFree) {
                console.log(`[UpdateBooking] Conflict for ${targetResourceId}. Attempting Auto-Realloc.`);
                const poolInfo = getPoolByResourceId(targetResourceId);
                if (poolInfo) {
                    const newRes = await findFreeResource(poolInfo.pool, startAt, endAt, id);
                    if (newRes) {
                        targetResourceId = newRes;
                    } else {
                        throw new Error(`Time slot is fully booked for ${poolInfo.type}.`);
                    }
                } else {
                    throw new Error('Selected resource is busy.');
                }
            }

            await prisma.booking.update({
                where: { id },
                data: {
                    menuId: service!.id,
                    menuName: service!.name,
                    startAt: startAt,
                    endAt: endAt,
                    staffId: data.staffId,
                    clientName: data.clientName,
                    resourceId: targetResourceId
                }
            });
        }
    }

    revalidatePath('/admin/timeline');
}

export async function deleteBooking(id: string) {
    const target = await prisma.booking.findUnique({ where: { id } });
    if (!target) return;

    if (target.comboLinkId) {
        await prisma.booking.deleteMany({ where: { comboLinkId: target.comboLinkId } });
    } else {
        await prisma.booking.delete({ where: { id } });
    }
    revalidatePath('/admin/timeline');
}

export async function getMonthlyStaffSummary(year: number, month: number) {
    // Existing logic...
    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);

    const bookings = await prisma.booking.findMany({
        where: {
            startAt: { gte: startOfMonth, lte: endOfMonth },
            status: { not: 'Cancelled' },
            staffId: { not: null }
        },
        include: { service: true }
    });

    const staffList = await prisma.staff.findMany({
        where: { role: { in: ['Therapist', 'THERAPIST', 'therapist'] } }
    });

    const summary = staffList.map(staff => {
        const staffBookings = bookings.filter(b => b.staffId === staff.id);
        const totalMs = staffBookings.reduce((acc, b) => acc + (b.endAt.getTime() - b.startAt.getTime()), 0);
        const totalHours = totalMs / (1000 * 60 * 60);
        const totalCommission = Math.floor(totalHours * (staff.commissionRate || 0));

        return {
            id: staff.id,
            name: staff.name,
            totalMinutes: Math.floor(totalMs / 60000),
            bookingCount: staffBookings.length,
            commissionRate: staff.commissionRate || 0,
            totalCommission
        };
    }).sort((a, b) => a.name.localeCompare(b.name));

    return summary;
}
