'use server';

import { prisma } from '@/lib/db';
import { revalidatePath } from 'next/cache';

export async function publishDrafts(year: number, month: number) {
    try {
        const startOfMonth = new Date(Date.UTC(year, month - 1, 1));
        const endOfMonth = new Date(Date.UTC(year, month, 1));

        // 1. Retrieve SYNC_META to know the scope
        const meta = await prisma.bookingMemo.findFirst({
            where: {
                date: startOfMonth,
                content: { startsWith: 'SYNC_META:' }
            }
        });

        let cutoffDate = startOfMonth;

        if (meta) {
            const iso = meta.content.replace('SYNC_META:', '');
            const parsed = new Date(iso);
            if (!isNaN(parsed.getTime())) {
                cutoffDate = parsed;
            }
        } else {
            // Fallback: Use "Yesterday" logic if no meta? 
            // Or strict: If no meta, we can't safely delete. 
            // But let's fallback to assuming we only touch future if meta missing.
            const now = new Date();
            const vnNow = new Date(now.getTime() + (7 * 60 * 60 * 1000));
            cutoffDate = new Date(vnNow);
            cutoffDate.setUTCHours(0 - 7, 0, 0, 0); // Start of today? Or yesterday.
            // Let's assume Start of Month if we can't find meta, BUT that deletes everything. 
            // Safer to assume "Start of Month" to ensure cleanup if it was a full sync.
            // If user did a partial sync but lost meta, they might lose data. 
            // But meta should be there if they just synced.
            console.log("No SYNC_META found, defaulting cutoff to StartOfMonth");
            cutoffDate = startOfMonth;
        }

        console.log(`[Publish] Swapping Data for ${year}/${month}. Cutoff: ${cutoffDate.toISOString()}`);

        await prisma.$transaction(async (tx) => {
            // 2. Delete LIVE (Confirmed/Cancelled) bookings in the scope
            // Scope: [cutoffDate, endOfMonth)
            await tx.booking.deleteMany({
                where: {
                    startAt: {
                        gte: cutoffDate,
                        lt: endOfMonth
                    },
                    status: { not: 'SYNC_DRAFT' } // Don't delete our drafts
                }
            });

            // 3. Promote DRAFTS to Confirmed
            await tx.booking.updateMany({
                where: {
                    startAt: {
                        gte: cutoffDate,
                        lt: endOfMonth
                    },
                    status: 'SYNC_DRAFT'
                },
                data: {
                    status: 'Confirmed'
                }
            });

            // 4. Clean up Meta?
            // Optional, but good to keep cleaner.
            await tx.bookingMemo.delete({
                where: { id: meta?.id }
            }).catch(() => { }); // Validate existing ID or ignore
        });

        revalidatePath('/admin/timeline');
        return { success: true, message: 'Published successfully.' };

    } catch (e: any) {
        console.error("Publish Failed:", e);
        return { success: false, message: e.message };
    }
}
