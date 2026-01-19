'use client';

import { useRouter } from 'next/navigation';
import type { Staff, Shift } from '@prisma/client';

type Props = {
    staffList: Staff[];
    offShifts: Shift[];
    year: number;
    month: number; // 1-12
};

export default function HolidayCalendar({ staffList, offShifts, year, month }: Props) {
    const router = useRouter();

    const handleMonthChange = (offset: number) => {
        let newYear = year;
        let newMonth = month + offset;
        if (newMonth > 12) {
            newYear++;
            newMonth = 1;
        } else if (newMonth < 1) {
            newYear--;
            newMonth = 12;
        }
        router.push(`?year=${newYear}&month=${newMonth}`);
    };

    // Vietnam Holidays 2026
    const isVietnamHoliday = (y: number, m: number, d: number) => {
        if (y !== 2026) return false;
        const dateStr = `${m}/${d}`; // m is 1-based
        const holidays = [
            '1/1', // New Year
            '4/26', '4/27', // Hung Kings (26 Sun -> 27 Obs)
            '4/30', // Reunification
            '5/1', // Labor Day
            '9/2', '9/3', // National Day
        ];
        // Tet Range: Feb 16-20
        if (m === 2 && d >= 16 && d <= 20) return true;

        return holidays.includes(dateStr);
    };

    // Calendar Logic
    const daysInMonth = new Date(year, month, 0).getDate();
    const dateObj = new Date(year, month - 1, 1);
    const startDayOfWeek = dateObj.getDay(); // 0=Sun
    const totalDays = new Date(year, month, 0).getDate();

    // Group Shifts by Date and Count by Staff
    const shiftsByDay: Record<number, { staffId: string; status: string }[]> = {};
    const statsByStaff: Record<string, { off: number; al: number }> = {};

    // Initialize counts
    staffList.forEach(s => {
        statsByStaff[s.id] = { off: 0, al: 0 };
    });

    offShifts.forEach(shift => {
        const d = new Date(shift.date);
        const day = d.getUTCDate();

        if (!shiftsByDay[day]) shiftsByDay[day] = [];
        shiftsByDay[day].push({ staffId: shift.staffId, status: shift.status });

        if (statsByStaff[shift.staffId]) {
            if (shift.status === 'Off') statsByStaff[shift.staffId].off++;
            if (shift.status === 'AL') statsByStaff[shift.staffId].al++;
        }
    });

    // Color mapping
    const getRoleColor = (role: string, status: string) => {
        const base = role === 'THERAPIST'
            ? 'bg-purple-900/50 border-purple-700'
            : 'bg-orange-900/50 border-orange-700';

        const text = status === 'AL' ? 'text-green-400 font-bold' : (role === 'THERAPIST' ? 'text-purple-200' : 'text-orange-200');

        return `${base} ${text}`;
    };

    const weeks = [];
    let currentWeek = Array(7).fill(null);
    let dayCounter = 1;

    for (let i = startDayOfWeek; i < 7; i++) {
        currentWeek[i] = dayCounter++;
    }
    weeks.push(currentWeek);

    while (dayCounter <= totalDays) {
        currentWeek = Array(7).fill(null);
        for (let i = 0; i < 7 && dayCounter <= totalDays; i++) {
            currentWeek[i] = dayCounter++;
        }
        weeks.push(currentWeek);
    }

    // Calculate Sundays for the current month
    let sundaysCount = 0;
    for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(year, month - 1, d);
        if (date.getDay() === 0) sundaysCount++;
    }

    return (
        <div className="flex flex-col lg:flex-row gap-6 h-full">
            {/* Main Calendar */}
            <div className="flex-1 bg-slate-800 rounded-xl border border-slate-700 flex flex-col">
                {/* Header */}
                <div className="p-4 flex items-center justify-between border-b border-slate-700 bg-slate-900/50">
                    <div className="flex items-center gap-4">
                        <h2 className="text-2xl font-bold flex items-center gap-2">
                            <span className="text-[var(--primary)]">{year}</span>
                            <span className="text-slate-400">/</span>
                            <span>{month.toString().padStart(2, '0')}</span>
                        </h2>
                        <span className="text-sm font-bold text-slate-400 bg-slate-800 px-3 py-1 rounded border border-slate-700">
                            週休日数: <span className="text-[var(--primary)] text-lg">{sundaysCount}</span> 日
                        </span>
                    </div>

                    <div className="flex gap-2">
                        <button onClick={() => handleMonthChange(-1)} className="p-2 hover:bg-slate-700 rounded text-slate-400 hover:text-white">
                            &larr; Prev
                        </button>
                        <button onClick={() => handleMonthChange(1)} className="p-2 hover:bg-slate-700 rounded text-slate-400 hover:text-white">
                            Next &rarr;
                        </button>
                    </div>
                </div>

                {/* Grid */}
                <div className="grid grid-cols-7 flex-1 auto-rows-fr">
                    {/* Headers */}
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, i) => (
                        <div key={d} className={`p-2 text-center text-xs font-bold uppercase border-b border-slate-700 bg-slate-900/30 ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-slate-500'}`}>
                            {d}
                        </div>
                    ))}

                    {/* Days */}
                    {weeks.map((week, wIdx) => (
                        week.map((day: number | null, dIdx: number) => {
                            if (!day) return <div key={`${wIdx}-${dIdx}`} className="bg-slate-900/20 border-b border-r border-slate-700/50" />;

                            const dayShifts = shiftsByDay[day] || [];
                            const isHol = isVietnamHoliday(year, month, day);

                            return (
                                <div key={day} className={`min-h-[100px] border-b border-r border-slate-700 p-2 transition-colors hover:bg-slate-750 relative group ${isHol ? 'bg-red-900/10' : ''}`}>
                                    <div className="flex justify-between items-start mb-2">
                                        <span className={`text-sm font-mono font-bold block ${isHol ? 'text-red-500' : dIdx === 0 ? 'text-red-400' : dIdx === 6 ? 'text-blue-400' : 'text-slate-400'}`}>
                                            {day}
                                        </span>
                                        {isHol && <span className="text-[9px] text-red-400 px-1 border border-red-500/30 rounded">VN祝日</span>}
                                    </div>

                                    <div className="flex flex-col gap-1">
                                        {dayShifts.map((shift, idx) => {
                                            const staff = staffList.find(s => s.id === shift.staffId);
                                            if (!staff) return null;
                                            return (
                                                <div key={`${day}-${shift.staffId}-${idx}`} className={`text-[10px] px-2 py-0.5 rounded border truncate flex justify-between items-center ${getRoleColor(staff.role, shift.status)}`}>
                                                    <span>{staff.name}</span>
                                                    {shift.status === 'AL' && <span className="text-[9px] bg-green-900/50 px-1 rounded ml-1 text-green-400">AL</span>}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })
                    ))}
                </div>
            </div>

            {/* Sidebar Stats */}
            <div className="w-full lg:w-64 bg-slate-800 rounded-xl border border-slate-700 p-4 shrink-0">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 border-b border-slate-700 pb-2">
                    Start Days Off
                </h3>
                {/* Header for Columns */}
                <div className="flex justify-between text-[10px] text-slate-500 px-2 mb-2 uppercase font-bold tracking-wider">
                    <span>Name</span>
                    <div className="flex gap-3">
                        <span className="w-6 text-center">OFF</span>
                        <span className="w-6 text-center text-green-500">AL</span>
                    </div>
                </div>

                <div className="space-y-1 overflow-auto flex-1">
                    {staffList.map(staff => {
                        const stats = statsByStaff[staff.id];
                        return (
                            <div key={staff.id} className="flex justify-between items-center text-sm p-2 hover:bg-slate-700 rounded transition-colors group">
                                <div className="flex items-center gap-2 overflow-hidden">
                                    <div className={`w-2 h-2 shrink-0 rounded-full ${staff.role === 'THERAPIST' ? 'bg-purple-500' : 'bg-orange-500'}`} />
                                    <span className="font-bold text-slate-200 truncate">{staff.name}</span>
                                </div>
                                <div className="flex gap-3 font-mono font-bold text-xs shrink-0">
                                    <span className={`w-6 text-center bg-slate-900 rounded py-0.5 ${stats.off > 0 ? 'text-slate-200' : 'text-slate-600'}`}>
                                        {stats.off}
                                    </span>
                                    <span className={`w-6 text-center bg-green-900/30 rounded py-0.5 ${stats.al > 0 ? 'text-green-400' : 'text-slate-600'}`}>
                                        {stats.al}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="mt-8 p-4 bg-slate-900/50 rounded text-xs text-slate-500">
                    <div className="flex items-center gap-2 mb-1">
                        <div className="w-2 h-2 rounded-full bg-purple-500" />
                        <span>Therapist</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-orange-500" />
                        <span>Reception</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
