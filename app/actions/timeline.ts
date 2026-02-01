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

    // Previously filtered strictly. Now we return ALL, but marked with status.
    const allTherapists = therapists.map(t => {
        const shift = shifts.find(s => s.staffId === t.id);
        const rawStatus = shift?.status;
        const statusUpper = rawStatus?.toUpperCase();
        let suffix = '';

        if (!rawStatus || rawStatus === '-') {
            // suffix = ' (?)'; // Maybe implies no shift
        } else {
            const isOff = statusUpper === 'OFF' || statusUpper === 'AL' || statusUpper === 'HOLIDAY' || statusUpper === 'ABSENT';
            if (isOff) suffix = ` (${rawStatus})`;
        }

        if (busyStaffIds.has(t.id)) {
            suffix += ' (Busy)';
        }

        return {
            id: t.id,
            name: t.name + suffix
        };
    });

    return allTherapists;
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
            endAt: { lte: endOfDay },
            status: { not: 'SYNC_DRAFT' } // Hide drafts
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

    const draftMeta = await prisma.bookingMemo.findFirst({
        where: {
            date: startOfDay,
            content: { startsWith: 'SYNC_META:' }
        }
    });

    return { resources, bookings: formattedBookings, isDraft: !!draftMeta };
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

        const createdBookings = [];

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
            const b1 = await prisma.booking.create({
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
            createdBookings.push(b1);

            // Booking B (Head Spa)
            const b2 = await prisma.booking.create({
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
            createdBookings.push(b2);

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

            const b1 = await prisma.booking.create({
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
            createdBookings.push(b1);
        }

        // --- DRAFT MODE TWIN SYNC ---
        // If Draft Mode is active, we must ALSO create this booking as a Locked Draft in the Import List.
        // This ensures that if the user hits "Publish", this manually created booking survives 
        // (because Publish wipes Live data and replaces it with Draft data).
        const startOfMonth = new Date(startAt.getFullYear(), startAt.getMonth(), 1);
        const hasMeta = await prisma.bookingMemo.findFirst({
            where: { date: startOfMonth, content: { startsWith: 'SYNC_META:' } }
        });

        if (hasMeta) {
            console.log('[createBooking] Draft Mode Detected. Creating Twin Drafts.');
            const draftComboId = isCombo ? `DRAFT-${crypto.randomUUID()}` : null;

            for (const b of createdBookings) {
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const { id, createdAt, updatedAt, ...bookingData } = b as any;
                await prisma.booking.create({
                    data: {
                        ...bookingData,
                        status: 'SYNC_DRAFT',
                        // @ts-ignore
                        isLocked: true,
                        comboLinkId: draftComboId
                    }
                });
            }
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

        // --- DRAFT SYNC LOGIC ---
        // If we are in Draft Mode, we must ensure this change is reflected in Import List.
        // If we edited a Live booking, and there is a Draft Mode active, 
        // we should create a Locked Draft so it persists.

        // Check if Draft Mode is active for this month
        const startOfMonth = new Date(startAt.getFullYear(), startAt.getMonth(), 1);
        const hasMeta = await prisma.bookingMemo.findFirst({
            where: { date: startOfMonth, content: { startsWith: 'SYNC_META:' } }
        });

        if (hasMeta) {
            console.log('[updateBooking] Draft Mode Detected. Ensuring Locked Draft exists.');
            // Only relevant if we edited a LIVE booking (not SYNC_DRAFT)?
            // `updateBooking` updates whatever ID we passed. 
            // If we edited a `Confirmed` booking, we want to CLONE it to `SYNC_DRAFT` (Locked).
            if (target.status !== 'SYNC_DRAFT') {
                // Check if a draft already exists for this booking ID? 
                // Usually Drafts are new rows.
                // We want to create a Draft that REPLACES this Live one in the user's view (Import List).
                // Import List view priority: Draft > Live.
                // If we create a SYNC_DRAFT with same derived props, it shows up.

                // Simplified: Just create a SYNC_DRAFT (Locked).
                // But avoid duplicates.
                // Let's see if we can find a Draft at the same time/resource?
                // This is tricky.
                // For now, let's simpler: Just UPDATE the Live booking (done above).
                // AND Create/Update a Locked Draft.

                // If target was part of a combo, we need to replicate the whole combo as Draft.
                // This is getting complex.
                // User requirement: "timelineで編集した場合（担当など）importlistに反映してください"
                // If we only update Live, and Import List is showing Drafts (for future), 
                // then the user won't see this change in Import List if the Import List logic hides Live futures.
                // In `getImportListData` / `getMonthlyStaffSummary`: Future = SYNC_DRAFT. Live is HIDDEN.
                // So updating Live is INVISIBLE in Import List for future dates!
                // So we MUST create a SYNC_DRAFT.

                const bookingsToClone = target.comboLinkId
                    ? await prisma.booking.findMany({ where: { comboLinkId: target.comboLinkId } })
                    : [await prisma.booking.findUniqueOrThrow({ where: { id } })];

                for (const b of bookingsToClone) { // Use updated data from DB? 
                    // Wait, `bookingsToClone` fetches OLD data if transaction hasn't committed or race?
                    // `updatePromises` awaited above. So `findMany` should return NEW data.
                    // Iterate and Clone.

                    // Check if a locked draft already exists for this?
                    // We don't have a link.
                    // But we can check if there's a SYNC_DRAFT at same time/resource.
                    const existingDraft = await prisma.booking.findFirst({
                        where: {
                            startAt: b.startAt,
                            resourceId: b.resourceId,
                            status: 'SYNC_DRAFT'
                        }
                    });

                    if (existingDraft) {
                        // Update existing draft
                        await prisma.booking.update({
                            where: { id: existingDraft.id },
                            data: {
                                staffId: b.staffId,
                                menuId: b.menuId,
                                menuName: b.menuName,
                                clientName: b.clientName,
                                // @ts-ignore
                                isLocked: true // LOCK IT
                            }
                        });
                    } else {
                        // Create new draft
                        // Create new draft
                        // eslint-disable-next-line @typescript-eslint/no-unused-vars
                        const { id, createdAt, updatedAt, ...bookingData } = b as any;
                        await prisma.booking.create({
                            data: {
                                ...bookingData,
                                status: 'SYNC_DRAFT',
                                // @ts-ignore
                                isLocked: true,
                                comboLinkId: b.comboLinkId ? `DRAFT-${b.comboLinkId}` : null // Unique link
                            }
                        });
                    }
                }
            }
        }

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

    // Check for Draft Mode (SYNC_META)
    const meta = await prisma.bookingMemo.findFirst({
        where: { date: startOfMonth, content: { startsWith: 'SYNC_META:' } }
    });

    const isDraft = !!meta;
    let cutoff = endOfMonth;
    if (meta) {
        const iso = meta.content.replace('SYNC_META:', '');
        const d = new Date(iso);
        if (!isNaN(d.getTime())) cutoff = d;
    }

    const whereClause = isDraft ? {
        startAt: { gte: startOfMonth, lte: endOfMonth },
        OR: [
            { startAt: { lt: cutoff }, status: { not: 'Cancelled' } }, // Live Past
            { startAt: { gte: cutoff }, status: 'SYNC_DRAFT' } // Draft Future
            // Note: Currently ImportList uses Confirmed for Past. Timeline usually uses "not Cancelled".
            // Let's match ImportList: Past Live, Future Draft.
        ]
    } : {
        startAt: { gte: startOfMonth, lte: endOfMonth },
        status: { not: 'Cancelled' }
    };

    if (isDraft) {
        // @ts-ignore
        whereClause.OR[0].AND = [{ status: { not: 'SYNC_DRAFT' } }];
    } else {
        // @ts-ignore
        whereClause.AND = [{ status: { not: 'SYNC_DRAFT' } }];
    }

    const bookings = await prisma.booking.findMany({
        // @ts-ignore
        where: whereClause,
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

    // ...
    // ensure last closing brace
    return summary;
}

export async function getDraftStatus(year: number, month: number) {
    const startOfMonth = new Date(Date.UTC(year, month - 1, 1)); // UTC to match how we save
    // or just simplified date string matching if strictly bookingMemo?
    // bookingMemo date is DateTime in Prisma.
    // Let's match the logic used in createBooking:
    // const startOfMonth = new Date(startAt.getFullYear(), startAt.getMonth(), 1);

    // Safer:
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0); // End of month

    const meta = await prisma.bookingMemo.findFirst({
        where: {
            // date: startOfMonth // Exact match might be tricky with timezones
            // Look for memo in range or just by startsWith?
            date: {
                gte: start,
                lte: end
            },
            content: { startsWith: 'SYNC_META:' }
        }
    });

    return !!meta;
}
