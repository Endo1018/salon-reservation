'use server';

import { prisma } from '@/lib/db';
import { revalidatePath } from 'next/cache';

export async function updateDraft(id: string, data: {
    startTime: string; // HH:mm
    staffId?: string;
    staffId2?: string;
    isLocked?: boolean;
}) {
    try {
        const booking = await prisma.booking.findUnique({ where: { id } });
        if (!booking) throw new Error("Booking not found");

        if (booking.status !== 'SYNC_DRAFT') throw new Error("Only drafts can be edited here.");

        const updates: any = {
            isLocked: true // Auto-lock on edit
        };

        if (data.isLocked !== undefined) updates.isLocked = data.isLocked;

        // Update Staff
        if (data.staffId !== undefined) updates.staffId = data.staffId;

        // Update Time
        if (data.startTime) {
            const [h, m] = data.startTime.split(':').map(Number);
            const newStart = new Date(booking.startAt);
            newStart.setUTCHours(h - 7, m, 0, 0); // Re-apply VN offset

            const durationMs = booking.endAt.getTime() - booking.startAt.getTime();
            const newEnd = new Date(newStart.getTime() + durationMs);

            updates.startAt = newStart;
            updates.endAt = newEnd;
        }

        // Apply
        await prisma.booking.update({
            where: { id },
            data: updates
        });

        // Combo? Update linked
        if (booking.comboLinkId) {
            const others = await prisma.booking.findMany({
                where: { comboLinkId: booking.comboLinkId, id: { not: id } }
            });

            for (const other of others) {
                const otherUpdates: any = { isLocked: true };
                if (data.staffId2 && !booking.isComboMain) {
                    // If we updated the sub leg, maybe nothing else to do on main?
                }
                // Complex Logic: If time shifted, shift others?
                // Simple logic for now: Just lock them so they don't get deleted.

                // If User is editing "Row" in ImportList, they are editing the *Primary* representation?
                // ImportList currently shows "Row" which is 1 or 2 bookings.
                // We will need to handle "Update Row" logic carefully.
                // For now, let's assume the UI sends the ID of the specific booking leg?
                // Or we implement `updateDraftRow` that handles both?

                await prisma.booking.update({
                    where: { id: other.id },
                    data: otherUpdates
                });
            }
        }

        revalidatePath('/admin/import-list');
        return { success: true, message: 'Updated' };
    } catch (e: any) {
        return { success: false, message: e.message };
    }
}
