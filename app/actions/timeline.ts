'use server';

import { prisma } from '@/lib/db';
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
    // 1. Calculate Time Range
    const startAt = new Date(`${dateStr}T${startTime}:00`);
    const endAt = new Date(startAt.getTime() + duration * 60000);

    // 2. Fetch All Therapists
    const therapists = await prisma.staff.findMany({
        where: { isActive: true, role: 'THERAPIST' },
        select: { id: true, name: true }
    });

    // 3. Parallel Fetch: Shifts & Bookings
    const therapistIds = therapists.map(t => t.id);

    const [shifts, conflictingBookings] = await Promise.all([
        // Fetch Shifts
        prisma.shift.findMany({
            where: {
                date: {
                    gte: new Date(`${dateStr}T00:00:00`),
                    lte: new Date(`${dateStr}T23:59:59`),
                },
                staffId: { in: therapistIds }
            }
        }),
        // Fetch Conflicting Bookings
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

    // 5. Filter Result
    // Available if:
    // - Has a shift that is NOT 'OFF'/'AL'/'Holiday' (Strict Policy)
    // - OR (if no shift record) -> Default Available? (System policy: default available unless OFF)
    // - AND Not in busyStaffIds

    // DEBUG LOGGING
    console.log(`[getAvailableStaff] Date: ${dateStr}, Time: ${startTime}`);

    // Debug: Log all shifts found to verify Prisma output
    // shifts.forEach(s => console.log(`Shift: ${s.staffId} = ${s.status}`));

    const available = therapists.filter(t => {
        // Check Shift
        const shift = shifts.find(s => s.staffId === t.id);
        const rawStatus = shift?.status; // Preserving raw case/value
        const statusUpper = rawStatus?.toUpperCase();

        // Treat '-' or undefined as Available
        if (rawStatus === '-' || !rawStatus) return true;

        const isOff = statusUpper === 'OFF' || statusUpper === 'AL' || statusUpper === 'HOLIDAY' || statusUpper === 'ABSENT';

        if (isOff) {
            console.log(`[Debug Staff] ${t.name} excluded due to Shift: ${rawStatus}`);
            return false;
        }

        // Check Bookings
        if (busyStaffIds.has(t.id)) {
            console.log(`[Debug Staff] ${t.name} excluded due to Booking Overlap`);
            return false;
        }

        return true;
    });
    console.log(`[getAvailableStaff] Returning ${available.length} staff.`);
    return available;
}

export async function getActiveTherapists() {
    return await prisma.staff.findMany({
        where: { isActive: true, role: 'THERAPIST' },
        select: { id: true, name: true, insuranceBaseSalary: false }
    });
}

export async function getTimelineData(dateStr: string) {
    // 1. Define Resources
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

        // Overflow Resources (Dynamically added for view)
        { id: 'overflow-spa', name: '⚠️ Overflow Spa', category: 'HEAD SPA' },
        { id: 'overflow-aroma', name: '⚠️ Overflow Aroma', category: 'AROMA ROOM' },
        { id: 'overflow-seat', name: '⚠️ Overflow Seat', category: 'MASSAGE SEAT' },
    ];

    // 2. Fetch Bookings for the Date
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
    staffId?: string | null; // Make Optional
    staffId2?: string | null; // For 2nd leg of Combo
    customerId?: string;
    clientName?: string;
    isAroma?: boolean; // New Flag
}) {
    try {
        // Calculate Start/End (Total) - Input is Vietnam Time (GMT+7)
        const [yyyy, mm, dd] = data.date.split('-').map(Number);
        const [hours, mins] = data.startTime.split(':').map(Number);

        // Convert to UTC by subtracting 7 hours
        const startAt = new Date(Date.UTC(yyyy, mm - 1, dd, hours - 7, mins));
        const endAt = new Date(startAt.getTime() + data.duration * 60000);

        // Fetch details
        const service = await prisma.service.findUnique({ where: { id: data.serviceId } });
        if (!service) throw new Error('Service not found');

        // Handle Combo
        if (service.type && service.type.trim().toLowerCase() === 'combo') {
            const comboLinkId = crypto.randomUUID();
            const mDur = service.massageDuration || 0;
            const hDur = service.headSpaDuration || 0;

            let massageResId = '';
            let headSpaResId = '';
            const massageEnd = new Date(startAt.getTime() + mDur * 60000);

            if (data.resourceId.startsWith('spa-')) {
                // User from Head Spa -> 2nd leg
                headSpaResId = data.resourceId;

                // If Aroma requested OR Service is naturally Aroma
                const useAroma = data.isAroma || service.name.includes('Aroma') || service.name.includes('Couple') || service.name.includes('CHAMPACA'); // Case insensitive check handled by includes logic usually, but here names are standardized

                if (useAroma) {
                    massageResId = 'aroma-a1';
                } else {
                    massageResId = 'seat-1';
                }
            } else {
                // User from Massage -> 1st leg
                massageResId = data.resourceId; // Keep user selection if they clicked a specific row? 
                // Wait, if they clicked a Seat row but checked Aroma, we should probably MOVE it to Aroma?
                // But typically users click the row they want.
                // However, if they are creating from "New Booking" button (no specific resource?), or if valid check overrides.

                const useAroma = data.isAroma || service.name.includes('Aroma') || service.name.includes('Couple') || service.name.includes('CHAMPACA');

                if (useAroma && !massageResId.startsWith('aroma-')) {
                    massageResId = 'aroma-a1';
                } else if (!useAroma && massageResId.startsWith('aroma-') && !service.name.includes('Aroma')) {
                    // Checkbox NOT checked, but clicked Aroma row? 
                    // Maybe keep it? But request implies strict toggle.
                    // Let's trust the flag if explicitly provided/relevant.
                    // Actually, if `data.isAroma` is TRUE, force Aroma.
                    if (data.isAroma) massageResId = 'aroma-a1';
                }

                // If no specific resource ID passed (e.g. global create), default logic applies.
                if (!massageResId) {
                    massageResId = useAroma ? 'aroma-a1' : 'seat-1';
                }

                headSpaResId = 'spa-1';
            }

            // Create Booking A (Massage)
            await prisma.booking.create({
                data: {
                    menuId: service.id,
                    menuName: `${service.name} (Massage)`,
                    staffId: data.staffId || null,
                    resourceId: massageResId,
                    startAt: startAt,
                    endAt: massageEnd,
                    status: 'Confirmed',
                    clientName: data.clientName || 'Walk-in',
                    customerId: data.customerId,
                    comboLinkId,
                    isComboMain: true
                }
            });

            // Create Booking B (Head Spa)
            await prisma.booking.create({
                data: {
                    menuId: service.id,
                    menuName: `${service.name} (Head Spa)`,
                    staffId: data.staffId2 || data.staffId || null, // Use 2nd staff if provided
                    resourceId: headSpaResId,
                    startAt: massageEnd,
                    endAt: endAt,
                    status: 'Confirmed',
                    clientName: data.clientName || 'Walk-in',
                    customerId: data.customerId,
                    comboLinkId,
                    isComboMain: false
                }
            });

        } else {
            // Single Booking Resource Logic
            let targetResourceId = data.resourceId;
            const serviceCat = service.category;

            let validPrefix = '';
            if (serviceCat === 'Aroma') validPrefix = 'aroma-';
            else if (serviceCat === 'Head Spa' || serviceCat === 'Headspa') validPrefix = 'spa-';
            else if (serviceCat === 'Massage' || serviceCat === 'Foot') validPrefix = 'seat-';

            if (validPrefix && !targetResourceId.startsWith(validPrefix)) {
                if (validPrefix === 'aroma-') targetResourceId = 'aroma-a1';
                else if (validPrefix === 'spa-') targetResourceId = 'spa-1';
                else if (validPrefix === 'seat-') targetResourceId = 'seat-1';
                console.log(`Resource corrected: ${data.resourceId} -> ${targetResourceId}`);
            }

            // Single Booking
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
        try {
            const fs = require('fs');
            fs.appendFileSync('/tmp/booking_errors.log', `[${new Date().toISOString()}] Error: ${e}\nData: ${JSON.stringify(data)}\n`);
        } catch (_) { }
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
            // Massage (isComboMain=true) is usually 1st. If 1st item is NOT Main, then Head Spa is First.
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
    isHeadSpaFirstOrder?: boolean; // Renamed to force refresh
}) {
    // 1. Fetch Target
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

    // 3. Calculate New Times - Input is Vietnam Time (GMT+7)
    const [yyyy, mm, dd] = data.date.split('-').map(Number);
    const [hours, mins] = data.startTime.split(':').map(Number);

    // Convert to UTC by subtracting 7 hours
    const startAt = new Date(Date.UTC(yyyy, mm - 1, dd, hours - 7, mins));
    console.log(`[updateBooking] Input: ${data.startTime} (GMT+7) -> UTC: ${startAt.toISOString()}`); // Force Deploy Check

    let duration = data.duration || (service?.duration || 0);
    if (service?.type === 'Combo') {
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

        // Identify Legs based on isComboMain
        const mainLeg = legs.find(l => l.isComboMain) || legs[0]; // Massage
        const subLeg = legs.find(l => !l.isComboMain) || legs[1] || null; // Head Spa

        const updatePromises = [];

        // CALCULATE SPLIT TIMES
        let massageStart = startAt;
        let massageEnd = startAt;
        let spaStart = startAt;
        let spaEnd = endAt;

        if (service?.type === 'Combo') {
            const mDur = service.massageDuration || 0;
            const hDur = service.headSpaDuration || 0;

            if (data.isHeadSpaFirstOrder) {
                // HEAD SPA FIRST
                spaStart = startAt;
                spaEnd = new Date(startAt.getTime() + hDur * 60000);
                massageStart = spaEnd;
                massageEnd = endAt;
            } else {
                // MASSAGE FIRST (Default)
                massageStart = startAt;
                massageEnd = new Date(startAt.getTime() + mDur * 60000);
                spaStart = massageEnd;
                spaEnd = endAt;
            }
        }

        // --- AUTO REALLOCATION ---
        let finalMassageResId = mainLeg?.resourceId;
        if (mainLeg) {
            const isFree = await isResourceFree(mainLeg.resourceId, massageStart, massageEnd, mainLeg.id);
            if (!isFree) {
                console.log(`[AutoRealloc] Conflict detected for Main (${mainLeg.resourceId})`);
                const poolInfo = getPoolByResourceId(mainLeg.resourceId);
                if (poolInfo) {
                    const newRes = await findFreeResource(poolInfo.pool, massageStart, massageEnd, mainLeg.id);
                    if (newRes) {
                        console.log(`[AutoRealloc] Moved Main to ${newRes}`);
                        finalMassageResId = newRes;
                    }
                }
            }
        }

        let finalSpaResId = subLeg?.resourceId;
        if (subLeg) {
            const isFree = await isResourceFree(subLeg.resourceId, spaStart, spaEnd, subLeg.id);
            if (!isFree) {
                console.log(`[AutoRealloc] Conflict detected for Sub (${subLeg.resourceId})`);
                const poolInfo = getPoolByResourceId(subLeg.resourceId);
                if (poolInfo) {
                    const newRes = await findFreeResource(poolInfo.pool, spaStart, spaEnd, subLeg.id);
                    if (newRes) {
                        console.log(`[AutoRealloc] Moved Sub to ${newRes}`);
                        finalSpaResId = newRes;
                    }
                }
            }
        }

        if (isServiceChanged && service?.type === 'Combo') {
            // Update Main Leg (Massage)
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
            // Update Sub Leg (Spa)
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
        } else if (isServiceChanged && service?.type !== 'Combo') {
            // CONVERT COMBO -> SINGLE
            if (subLeg) {
                updatePromises.push(prisma.booking.delete({ where: { id: subLeg.id } }));
            }
            if (mainLeg) {
                updatePromises.push(prisma.booking.update({
                    where: { id: mainLeg.id },
                    data: {
                        menuId: service!.id,
                        menuName: service!.name,
                        startAt: startAt,
                        endAt: endAt,
                        comboLinkId: null, // Unlink
                        isComboMain: false,
                        resourceId: finalMassageResId
                    }
                }));
            }
        } else {
            // Service NOT Changed (Just Time/Staff/Duration/Order edit)
            if (service?.type === 'Combo') {
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
            }
        }

        // Common Updates (Staff / Client)
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
        // Warning: If switching Single -> Combo?
        if (service?.type === 'Combo') {
            // Complex upgrade. Easiest is delete & recreate logic, but we want to preserve ID if possible.
            // Actually, `createBooking` does heavy lifting. 
            // For now, let's treat it as: Update THIS record to be Main, and Create new Sub record.

            const comboLinkId = crypto.randomUUID();
            const mDur = service.massageDuration || 0;
            const massageEnd = new Date(startAt.getTime() + mDur * 60000);

            // Update Main
            await prisma.booking.update({
                where: { id },
                data: {
                    menuId: service.id,
                    menuName: `${service.name} (Massage)`,
                    startAt: startAt,
                    endAt: massageEnd,
                    comboLinkId,
                    isComboMain: true,
                    staffId: data.staffId,
                    clientName: data.clientName
                }
            });

            // Create Sub
            await prisma.booking.create({
                data: {
                    menuId: service.id,
                    menuName: `${service.name} (Head Spa)`,
                    staffId: data.staffId2 || data.staffId || null,
                    resourceId: 'spa-1', // Default? Or try to guess? safely 'spa-1' or request logic.
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
            // Normal Single -> Single
            await prisma.booking.update({
                where: { id },
                data: {
                    menuId: service!.id,
                    menuName: service!.name,
                    startAt: startAt,
                    endAt: endAt,
                    staffId: data.staffId,
                    clientName: data.clientName
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
    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);

    const bookings = await prisma.booking.findMany({
        where: {
            startAt: { gte: startOfMonth, lte: endOfMonth },
            status: { not: 'Cancelled' }, // Exclude cancelled
            staffId: { not: null }
        },
        include: { service: true }
    });

    const staffList = await prisma.staff.findMany({
        where: { role: { in: ['Therapist', 'THERAPIST', 'therapist'] } } // Case insensitive match attempt
    });

    const summary = staffList.map(staff => {
        const staffBookings = bookings.filter(b => b.staffId === staff.id);
        const totalMs = staffBookings.reduce((acc, b) => acc + (b.endAt.getTime() - b.startAt.getTime()), 0);
        // Commission = (Total Hours) * Staff.commissionRate
        // Assuming commissionRate is per hour.
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
