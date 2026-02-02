import prisma from '@/lib/db';
import ShiftCalendar from './calendar'; // Client Component
import Link from 'next/link';
import ImportButton from '../attendance/ImportButton';
import DeleteAllButton from '../attendance/DeleteAllButton';

import CopyShiftButton from './CopyShiftButton';

export const dynamic = 'force-dynamic';

export default async function ShiftsPage(props: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
    const searchParams = await props.searchParams;
    const queryMonth = typeof searchParams.month === 'string' ? searchParams.month : null;

    const today = new Date();
    let year = today.getFullYear();
    let month = today.getMonth(); // 0-indexed

    if (queryMonth) {
        // Expected format "2026-02"
        const parts = queryMonth.split('-');
        if (parts.length === 2) {
            year = parseInt(parts[0]);
            month = parseInt(parts[1]) - 1; // 1-indexed to 0-indexed
        }
    }

    // Navigation Dates
    const prevDate = new Date(year, month - 1);
    const nextDate = new Date(year, month + 1);
    const prevMonthStr = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
    const nextMonthStr = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`;
    const currentDisplay = new Date(year, month).toLocaleString('en-US', { month: 'long', year: 'numeric' });

    // Define date range for this month (used for both staff filter and shifts query)
    const startDate = new Date(year, month, 1);
    const nextMonthStart = new Date(year, month + 1, 1);

    // Filter staff: include if no endDate OR endDate is on or after the 1st of this month
    const allStaff = await prisma.staff.findMany({
        where: {
            isActive: true,
            OR: [
                { endDate: null },
                { endDate: { gte: startDate } }
            ]
        },
        orderBy: { id: 'asc' },
    });

    // Fetch shifts for this month

    const shifts = await prisma.shift.findMany({
        where: {
            date: {
                gte: startDate,
                lt: nextMonthStart,
            },
        },
    });

    return (
        <div className="min-h-screen bg-slate-900 text-slate-100 p-4 md:p-8">
            <div className="max-w-6xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <div className="flex items-center gap-4">
                        <h1 className="text-2xl font-bold text-[var(--primary)] tracking-widest">SHIFT MANAGEMENT</h1>
                        <div className="flex gap-2">
                            <ImportButton />
                            <DeleteAllButton year={year} month={month} />
                        </div>
                    </div>
                    <div className="flex items-center gap-4 bg-slate-800 p-2 rounded-lg border border-slate-700">
                        <CopyShiftButton year={year} month={month + 1} />
                        <div className="w-px bg-slate-700 h-6"></div>
                        <Link href={`?month=${prevMonthStr}`} className="p-2 hover:bg-slate-700 rounded text-slate-400 hover:text-white">
                            &lt; Prev
                        </Link>
                        <span className="font-mono font-bold w-32 text-center text-lg">{currentDisplay}</span>
                        <Link href={`?month=${nextMonthStr}`} className="p-2 hover:bg-slate-700 rounded text-slate-400 hover:text-white">
                            Next &gt;
                        </Link>
                    </div>
                </div>

                <ShiftCalendar
                    key={`${year}-${month}`} // Force re-mount when month changes to reset local state
                    staffList={allStaff}
                    initialShifts={shifts}
                    year={year}
                    month={month}
                />
            </div>
        </div>
    );
}
