'use client';

import { useTransition } from 'react';
import { clockIn, clockOut } from '@/app/actions/attendance';

type Props = {
    staffId: string;
    todayStatus: 'NotStarted' | 'Working' | 'Done';
    startTime?: string;
    endTime?: string;
};

export default function TimeClock({ staffId, todayStatus, startTime, endTime }: Props) {
    const [isPending, startTransition] = useTransition();

    const handleClockIn = () => {
        startTransition(async () => {
            await clockIn(staffId);
        });
    };

    const handleClockOut = () => {
        startTransition(async () => {
            await clockOut(staffId);
        });
    };

    return (
        <section className="rounded-[24px] bg-slate-800 p-6 border border-slate-700 shadow-lg">
            <h2 className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-4">
                Today&apos;s Attendance
            </h2>

            <div className="flex flex-col items-center justify-center space-y-4">
                {todayStatus === 'NotStarted' && (
                    <button
                        onClick={handleClockIn}
                        disabled={isPending}
                        className="w-full py-8 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-700 text-white font-bold text-2xl shadow-lg hover:shadow-green-500/20 active:scale-95 transition-all disabled:opacity-50"
                    >
                        {isPending ? 'Processing...' : 'CLOCK IN'}
                    </button>
                )}

                {todayStatus === 'Working' && (
                    <div className="w-full space-y-4">
                        <div className="text-center">
                            <p className="text-slate-400 text-sm mb-1">Started at</p>
                            <p className="text-3xl font-mono text-white">{startTime}</p>
                        </div>
                        <button
                            onClick={handleClockOut}
                            disabled={isPending}
                            className="w-full py-8 rounded-2xl bg-gradient-to-br from-red-500 to-rose-700 text-white font-bold text-2xl shadow-lg hover:shadow-red-500/20 active:scale-95 transition-all disabled:opacity-50"
                        >
                            {isPending ? 'Processing...' : 'CLOCK OUT'}
                        </button>
                    </div>
                )}

                {todayStatus === 'Done' && (
                    <div className="w-full text-center space-y-2 py-4">
                        <div className="inline-block p-4 rounded-full bg-slate-700/50 mb-2">
                            <span className="text-3xl">✅</span>
                        </div>
                        <h3 className="text-xl font-bold text-white">Work Complete</h3>
                        <div className="flex justify-center gap-8 text-sm text-slate-400 font-mono">
                            <div>
                                <span className="block text-xs uppercase text-slate-500">In</span>
                                {startTime}
                            </div>
                            <div>
                                <span className="block text-xs uppercase text-slate-500">Out</span>
                                {endTime}
                            </div>
                        </div>
                        {/* Optional: Allow re-clock out if needed? For now keeps simple */}
                    </div>
                )}
            </div>
        </section>
    );
}
