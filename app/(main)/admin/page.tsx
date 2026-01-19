import HolidayCalendar from './HolidayCalendar';
import MonthlyAttendanceSummary from './MonthlyAttendanceSummary';
import Link from 'next/link';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function AdminDashboard({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
    // Await searchParams in Next.js 15+ (if applicable, but safer to assume async handling or access properties)
    // Next.js 13/14 searchParams is prop.
    const sp = await searchParams;
    const now = new Date();
    const year = sp.year ? parseInt(String(sp.year)) : now.getFullYear();
    const month = sp.month ? parseInt(String(sp.month)) : now.getMonth() + 1; // 1-12

    const allStaff = await prisma.staff.findMany({
        where: { isActive: true },
        orderBy: { id: 'asc' }
    });

    // Calculate Data Range (UTC)
    // Start of month
    const startOfMonth = new Date(Date.UTC(year, month - 1, 1));
    // End of month
    const endOfMonth = new Date(Date.UTC(year, month, 0, 23, 59, 59));

    // Fetch All Shifts (for Calendar and Summary)
    const allShifts = await prisma.shift.findMany({
        where: {
            date: {
                gte: startOfMonth,
                lte: endOfMonth
            }
        }
    });

    // Fetch All Attendance (for Summary)
    const allAttendance = await prisma.attendance.findMany({
        where: {
            date: {
                gte: startOfMonth,
                lte: endOfMonth
            }
        }
    });

    const offShifts = allShifts.filter(s => ['Off', 'AL'].includes(s.status));

    return (
        <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col">
            <header className="bg-slate-800 border-b border-slate-700 p-4 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-4">
                    <h1 className="text-xl font-bold text-[var(--primary)] tracking-widest">SPA MANAGER</h1>
                    <span className="text-xs px-2 py-1 bg-slate-700 rounded text-slate-300">ADMIN DASHBOARD</span>
                </div>
                <Link href="/" className="text-xs bg-slate-700 px-3 py-1 rounded hover:bg-slate-600">LOGOUT</Link>
            </header>

            <main className="p-6 flex-1 overflow-auto space-y-6">
                <HolidayCalendar
                    staffList={allStaff}
                    offShifts={offShifts}
                    year={year}
                    month={month}
                />

                <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 overflow-x-auto">
                    <h2 className="text-lg font-bold text-slate-200 mb-4 sticky left-0">Monthly Attendance Summary</h2>
                    <MonthlyAttendanceSummary
                        staffList={allStaff}
                        shifts={allShifts}
                        attendance={allAttendance}
                        year={year}
                        month={month}
                    />
                </div>
            </main>
        </div>
    );
}
