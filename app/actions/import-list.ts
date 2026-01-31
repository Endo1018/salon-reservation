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
};

export async function getImportListData(year: number, month: number) {
    const startOfMonth = new Date(Date.UTC(year, month - 1, 1));
    const endOfMonth = new Date(Date.UTC(year, month, 1)); // Exclusive

    const bookings = await prisma.booking.findMany({
        where: {
            startAt: { gte: startOfMonth, lt: endOfMonth },
            status: { not: 'Cancelled' },
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
                time1: main.service?.duration || (main.endAt.getTime() - main.startAt.getTime()) / 60000,
                menu2: sub?.menuName || '',
                time2: sub ? (sub.service?.duration || (sub.endAt.getTime() - sub.startAt.getTime()) / 60000) : 0,
                staff1: main.staff?.name || '',
                staff2: sub?.staff?.name || '',
            });

        } else {
            // Single
            rows.push({
                id: booking.id,
                date: booking.startAt,
                time: '',
                clientName: booking.clientName || 'Unknown',
                menu1: booking.menuName,
                time1: booking.service?.duration || (booking.endAt.getTime() - booking.startAt.getTime()) / 60000,
                menu2: '',
                time2: 0,
                staff1: booking.staff?.name || '',
                staff2: '',
            });
        }
    }

    // Sort by Date then Time
    return rows.sort((a, b) => a.date.getTime() - b.date.getTime());
}
