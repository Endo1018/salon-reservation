import { getStaffList, getShifts } from '@/lib/sheets';
import prisma from '@/lib/db'; // Direct DB access for precision
import Link from 'next/link';
import TimeClock from './TimeClock';

export default async function Dashboard(props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    const staffId = params.id;
    const allStaff = await getStaffList();
    const staff = allStaff.find(s => s.id === staffId);

    // Mock Date for Demo (Display purposes)
    const currentMonth = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    // Fetch Shifts
    const shifts = await getShifts(staffId);

    // Fetch Today's Attendance (Vietnam Time)
    const now = new Date();
    const vnDateStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }); // "2026-01-14"
    const todayStart = new Date(vnDateStr + 'T00:00:00.000Z');

    const todayRecord = await prisma.attendance.findFirst({
        where: {
            staffId,
            date: todayStart,
        },
    });

    let todayStatus: 'NotStarted' | 'Working' | 'Done' = 'NotStarted';
    if (todayRecord) {
        if (todayRecord.end) {
            todayStatus = 'Done';
        } else {
            todayStatus = 'Working';
        }
    }

    // Mock Salary Calculation
    const estimatedSalary = 12500000;

    if (!staff) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[var(--background)] text-slate-400">
                <p>Staff ID not found.</p>
                <Link href="/" className="ml-4 text-[var(--primary)] underline">Back</Link>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[var(--background)] pb-20">
            {/* Header */}
            <header className="sticky top-0 z-10 bg-[var(--surface)]/80 backdrop-blur-md border-b border-white/5 px-6 py-4 flex justify-between items-center">
                <div>
                    <h1 className="text-xl font-medium text-white">{staff.name}</h1>
                    <p className="text-xs text-[var(--primary)] uppercase tracking-wider">{staff.role}</p>
                </div>
                <Link href="/" className="text-xs text-slate-400 hover:text-white">LOGOUT</Link>
            </header>

            <main className="p-6 space-y-6">

                {/* Time Clock */}
                <TimeClock
                    staffId={staffId}
                    todayStatus={todayStatus}
                    startTime={todayRecord?.start || undefined}
                    endTime={todayRecord?.end || undefined}
                />

                {/* Salary Card */}
                <section className="relative overflow-hidden rounded-[24px] bg-gradient-to-br from-[var(--primary)] to-[#a1824a] p-6 shadow-xl">
                    <div className="relative z-10">
                        <p className="text-slate-900/60 text-xs font-bold uppercase tracking-widest mb-1">
                            {currentMonth} Est. Salary
                        </p>
                        <p className="text-slate-900 text-3xl font-bold">
                            {estimatedSalary.toLocaleString()} <span className="text-lg font-medium">VND</span>
                        </p>
                    </div>
                    <div className="absolute -right-4 -bottom-4 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>
                </section>

                {/* Shift List */}
                <section>
                    <h2 className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-4 ml-1">
                        Upcoming Shifts
                    </h2>
                    <div className="space-y-3">
                        {shifts.length === 0 ? (
                            <div className="p-4 rounded-xl bg-[var(--surface)] text-slate-500 text-center text-sm">
                                No shifts found.
                            </div>
                        ) : (
                            shifts.map((shift, i) => (
                                <div key={i} className="flex items-center justify-between p-4 rounded-xl bg-[var(--surface)] border border-white/5">
                                    <div className="flex items-center space-x-4">
                                        <div className="text-center w-12">
                                            <p className="text-xs text-slate-500 uppercase">{new Date(shift.date).toLocaleDateString('en-US', { weekday: 'short' })}</p>
                                            <p className="text-lg font-bold text-white">{new Date(shift.date).getDate()}</p>
                                        </div>
                                        <div>
                                            <div className="text-sm text-white font-medium">
                                                {shift.status === 'Off' ? (
                                                    <span className="text-slate-500">OFF</span>
                                                ) : (
                                                    <span>{shift.start} - {shift.end}</span>
                                                )}
                                            </div>
                                            <p className="text-xs text-slate-500">{shift.status}</p>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </section>
            </main>
        </div>
    );
}
