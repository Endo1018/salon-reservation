'use server';

import { prisma } from '@/lib/db';
import { revalidatePath } from 'next/cache';

export async function clearFebruaryData() {
    const start = new Date(Date.UTC(2026, 1, 1)); // Feb 1
    const end = new Date(Date.UTC(2026, 2, 1));   // Mar 1

    try {
        const { count } = await prisma.booking.deleteMany({
            where: {
                startAt: {
                    gte: start,
                    lt: end
                }
            }
        });

        revalidatePath('/admin/import-list');
        return { success: true, count };
    } catch (e) {
        console.error(e);
        return { success: false, error: String(e) };
    }
}
