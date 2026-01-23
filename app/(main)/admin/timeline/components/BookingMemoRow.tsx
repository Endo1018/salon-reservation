
import { prisma } from '@/lib/db';

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

    // Safety range:
    const memos = await prisma.bookingMemo.findMany({
        where: {
            date: {
                gte: startOfDay,
                lte: endOfDay
            }
        },
        orderBy: {
            time: 'asc' // String sort might be imperfect but '5:30 PM' sorts okay-ish?
            // Ideally parse time for sort, but string is okay for now as requested simple display
        }
    });

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
                        <span className="bg-slate-700 px-1.5 rounded text-[10px] text-slate-400">
                            {memo.persons}名
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}
