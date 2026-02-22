'use server';

import { prisma } from '@/lib/db';

export type ImportLayoutRow = {
    id: string; // main booking id
    date: Date;
    time: string;
    clientName: string;
    menu1: string;
    time1: number;
    menu2: string;
    time2: number;
    staff1: string;
    staff2: string;
    totalPrice: number; // Add Sales amount
    status: string; // Add status
    isLocked: boolean; // Add lock status
};

// Correctly align to Vietnam Time (UTC+7) 00:00 for DATA SCOPE
// VN 00:00 on 1st = Previous Day 17:00 UTC
export async function getImportListData(year: number, month: number) {
    const startOfMonth = new Date(Date.UTC(year, month - 1, 1, 0 - 7, 0, 0));
    const endOfMonth = new Date(Date.UTC(year, month, 1, 0 - 7, 0, 0));

    // Check for Draft Mode (Robust Lookup)
    // Fetch ALL sync metas and find the one for this month in JS to avoid Timezone DB mismatch
    const allMetas = await prisma.bookingMemo.findMany({
        where: { content: { startsWith: 'SYNC_META:' } }
    });

    const meta = allMetas.find(m => {
        const d = new Date(m.date);
        // Match Year/Month (UTC)
        return d.getUTCFullYear() === year && (d.getUTCMonth() + 1) === month;
    });

    const isDraft = !!meta;
    let cutoff = endOfMonth; // Default: If no draft, everything is live (cutoff at end)

    if (meta) {
        // Parse cutoff from content
        try {
            const iso = meta.content.replace('SYNC_META:', '');
            const d = new Date(iso);
            if (!isNaN(d.getTime())) cutoff = d;
        } catch (e) {
            console.error("Error parsing meta date", e);
        }
    }

    // Build Query - SIMPLIFIED: Always show SYNC_DRAFT in the month scope
    // This bypasses the metadata lookup issue for debugging
    const bookings = await prisma.booking.findMany({
        where: {
            startAt: { gte: startOfMonth, lt: endOfMonth },
            OR: [
                { status: 'SYNC_DRAFT' },
                { status: 'Confirmed' }
            ]
        },
        include: { staff: true, service: true },
        orderBy: { startAt: 'asc' }
    });

    const rows: ImportLayoutRow[] = [];
    const processedComboIds = new Set<string>();

    for (const booking of bookings) {
        if (booking.comboLinkId) {
            if (processedComboIds.has(booking.comboLinkId)) continue;
            processedComboIds.add(booking.comboLinkId);

            // Find all parts
            const parts = bookings.filter(b => b.comboLinkId === booking.comboLinkId);
            const main = parts.find(p => p.isComboMain) || parts[0];
            const sub = parts.find(p => !p.isComboMain && p.id !== main.id) || parts[1];

            const date = main.startAt;
            // Format Time HH:mm
            const time = date.toISOString().substr(11, 5); // Simplistic UTC extraction might need shift?
            // Actually startAt is stored as UTC. We should format it on client or shift here?
            // The DB stores correct Time if we assume UTC for now.
            // Let's pass the Date object and format on Client.

            rows.push({
                id: main.id,
                date: main.startAt,
                time: '', // Client side format
                clientName: main.clientName || 'Unknown',
                menu1: main.menuName,
                time1: (main.endAt.getTime() - main.startAt.getTime()) / 60000,
                menu2: sub?.menuName || '',
                time2: sub ? ((sub.endAt.getTime() - sub.startAt.getTime()) / 60000) : 0,
                staff1: main.staff?.name || '',
                staff2: sub?.staff?.name || '',
                totalPrice: main.totalPrice || 0,
                status: main.status,
                isLocked: main.isLocked || (sub?.isLocked ?? false)
            });

        } else {
            // Single
            rows.push({
                id: booking.id,
                date: booking.startAt,
                time: '',
                clientName: booking.clientName || 'Unknown',
                menu1: booking.menuName,
                time1: (booking.endAt.getTime() - booking.startAt.getTime()) / 60000,
                menu2: '',
                time2: 0,
                staff1: booking.staff?.name || '',
                staff2: '',
                totalPrice: booking.totalPrice || 0,
                status: booking.status,
                isLocked: booking.isLocked
            });
        }
    }

    // Sort by Date then Time
    return {
        rows: rows.sort((a, b) => a.date.getTime() - b.date.getTime()),
        isDraft,
        debug: `Meta=${!!meta}, GlobalMeta=${allMetas.length}, Cutoff=${cutoff.toISOString()}, Range=[${startOfMonth.toISOString()} - ${endOfMonth.toISOString()}], RawCount=${bookings.length}`
    };
}
