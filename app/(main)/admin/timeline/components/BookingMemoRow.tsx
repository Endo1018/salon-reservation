
import { prisma } from '@/lib/db';
import { CheckCircle } from 'lucide-react';
import { BookingMemo } from '@prisma/client'; // Import type for safety if needed

type Props = {
    date: string;
};

export default async function BookingMemoRow({ date }: Props) {
    const startOfDay = new Date(`${date}T00:00:00Z`);
    const endOfDay = new Date(`${date}T23:59:59Z`);

    // Using UTC date comparison
    // Since we store as UTC midnight
    const targetDate = new Date(`${date}T00:00:00Z`); // This works if saved as UTC midnight
    // Wait, sync stores `Date.UTC(...)`, so it is effectively UTC midnight of the booking date.
    // Querying by exact match or range?

    let memos = [];
    try {
        memos = await prisma.bookingMemo.findMany({
            where: {
                date: {
                    gte: startOfDay,
                    lte: endOfDay
                }
            },
            orderBy: {
                time: 'asc'
            }
        });
    } catch (e) {
        console.error("Failed to fetch Booking Memos:", e);
        return null; // Fail gracefully
    }

    if (!memos || memos.length === 0) return null;

    return (
        <div className="flex items-center gap-4 py-2 px-1 text-sm border-b border-slate-800 bg-slate-900/30">
            <span className="text-slate-500 font-bold text-xs uppercase tracking-wider shrink-0">
                Booking List:
            </span>
            <div className="flex flex-wrap gap-2 overflow-x-auto">
                {memos.map(memo => (
                    <div key={memo.id} className="flex items-center gap-2 px-3 py-1 rounded bg-slate-800 border border-slate-700 text-xs text-slate-300 shadow-sm whitespace-nowrap">
                        <span className="font-bold text-slate-400">{memo.time}</span>
                        <span className="font-medium text-white">{memo.content}</span>
                        <div className="flex items-center gap-1 bg-slate-700 px-1.5 rounded text-[10px] text-slate-400">
                            <span>{memo.persons}名</span>
                            {memo.hasCome && <CheckCircle className="w-3 h-3 text-emerald-400" />}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
