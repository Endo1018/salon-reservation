
import { prisma } from '@/lib/db';

export const resourcePools = {
    spa: ['spa-1', 'spa-2', 'spa-3', 'spa-4'],
    aroma: ['aroma-a1', 'aroma-a2', 'aroma-b1', 'aroma-b2'],
    seat: ['seat-1', 'seat-2', 'seat-3', 'seat-4', 'seat-5'],
};

/**
 * Check if a specific resource is free for the given time range.
 */
export async function isResourceFree(
    resourceId: string,
    start: Date,
    end: Date,
    excludeBookingId?: string
): Promise<boolean> {
    console.log(`[CheckFree] Res: ${resourceId}, Range: ${start.toISOString()}-${end.toISOString()}, Excl: ${excludeBookingId}`);

    // Ensure dates are valid
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        console.error("[CheckFree] Invalid Date supplied");
        return false;
    }

    const conflict = await prisma.booking.findFirst({
        where: {
            resourceId,
            startAt: { lt: end },
            endAt: { gt: start },
            id: excludeBookingId ? { not: excludeBookingId } : undefined,
            status: { notIn: ['Cancelled', 'SYNC_DRAFT'] }
        }
    });

    console.log(`[CheckFree] Conflict Found for ${resourceId}? ${!!conflict} (ID: ${conflict?.id})`);
    return !conflict;
}

/**
 * Find the first free resource in a given list (pool).
 */
export async function findFreeResource(
    pool: string[],
    start: Date,
    end: Date,
    excludeBookingId?: string
): Promise<string | null> {

    const conflicts = await prisma.booking.findMany({
        where: {
            resourceId: { in: pool },
            startAt: { lt: end },
            endAt: { gt: start },
            id: excludeBookingId ? { not: excludeBookingId } : undefined,
            status: { notIn: ['Cancelled', 'SYNC_DRAFT'] }
        },
        select: { resourceId: true }
    });

    const busySet = new Set(conflicts.map(c => c.resourceId));
    console.log(`[FindFree] Pool: ${pool.join(',')}, Busy: ${Array.from(busySet).join(',')}`);

    for (const resId of pool) {
        if (!busySet.has(resId)) return resId;
    }

    return null;
}

/**
 * Determine pool categorization from resource ID prefix
 */
export function getPoolByResourceId(resourceId: string): { pool: string[], type: string } | null {
    if (resourceId.startsWith('spa-')) return { pool: resourcePools.spa, type: 'HEAD SPA' };
    if (resourceId.startsWith('aroma-')) return { pool: resourcePools.aroma, type: 'AROMA ROOM' };
    if (resourceId.startsWith('seat-')) return { pool: resourcePools.seat, type: 'MASSAGE SEAT' };
    return null;
}
