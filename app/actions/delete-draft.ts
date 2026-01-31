'use server';

import { prisma } from '@/lib/db';
import { revalidatePath } from 'next/cache';

export async function deleteDraft(id: string) {
    try {
        const booking = await prisma.booking.findUnique({ where: { id } });
        if (!booking) return { success: false, message: 'Not found' };

        if (booking.status !== 'SYNC_DRAFT') return { success: false, message: 'Cannot delete live booking from here' };

        if (booking.comboLinkId) {
            await prisma.booking.deleteMany({ where: { comboLinkId: booking.comboLinkId } });
        } else {
            await prisma.booking.delete({ where: { id } });
        }

        revalidatePath('/admin/import-list');
        return { success: true };
    } catch (e: any) {
        return { success: false, message: e.message };
    }
}
