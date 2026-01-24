
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
    const conflict = await prisma.booking.findFirst({
        where: {
            resourceId,
            startAt: { lt: end },
            endAt: { gt: start },
            id: excludeBookingId ? { not: excludeBookingId } : undefined,
            status: { not: 'Cancelled' }
        }
    });
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
    // Check usage for all resources in pool efficiently?
    // Or just iterate (pool is small < 10). Iteration is fine.

    // Optimization: Fetch all conflicts for the pool in one query to avoid N queries?
    // Given low volume, simple iteration is okay, but one query is better.

    const conflicts = await prisma.booking.findMany({
        where: {
            resourceId: { in: pool },
            startAt: { lt: end },
            endAt: { gt: start },
            id: excludeBookingId ? { not: excludeBookingId } : undefined,
            status: { not: 'Cancelled' }
        },
        select: { resourceId: true }
    });

    const busySet = new Set(conflicts.map(c => c.resourceId));

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
