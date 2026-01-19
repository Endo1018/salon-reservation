'use client';

import type { Staff, Shift, Attendance } from '@prisma/client';

type Props = {
    staffList: Staff[];
    shifts: Shift[];
    attendance: Attendance[];
    year: number;
    month: number;
};

import { useRouter } from 'next/navigation';

export default function MonthlyAttendanceSummary({ staffList, shifts, attendance, year, month }: Props) {
    const router = useRouter();
    const daysInMonth = new Date(year, month, 0).getDate();

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

    // Helper to parse "HH:MM" to minutes
    const parseTime = (t: string | null) => {
        if (!t) return null;
        const [h, m] = t.split(':').map(Number);
        return h * 60 + m;
    };

    // Helper to format minutes to "H:MM:SS" (or just H:MM) - User image shows H:MM:SS or H:MM
    const formatDuration = (mins: number) => {
        const h = Math.floor(mins / 60);
        const m = Math.floor(mins % 60);
        // Assuming user wants 0:00 style
        return `${h}:${m.toString().padStart(2, '0')}`; // Simplification, usually seconds not tracked
    };

    const formatHours = (val: number) => {
        // val is float hours (e.g. 8.5)
        const h = Math.floor(val);
        const m = Math.round((val - h) * 60);
        return `${h}:${m.toString().padStart(2, '0')}`;
    };

    const summary = staffList.map(staff => {
        const staffShifts = shifts.filter(s => s.staffId === staff.id);
        const staffAttendance = attendance.filter(a => a.staffId === staff.id);

        const offCount = staffAttendance.filter(a => a.status === 'Off').length;
        const alCount = staffAttendance.filter(a => a.status === 'AL').length;
        const workDays = staffAttendance.filter(a => (a.workHours || 0) > 0).length;

        let totalWorkHours = 0;
        let totalOvertimeHours = 0;
        let totalLateMins = 0;
        let totalEarlyMins = 0;

        staffAttendance.forEach(att => {
            totalWorkHours += att.workHours || 0;
            totalOvertimeHours += att.overtime || 0;

            // Find corresponding shift
            const d = new Date(att.date);
            // Match shift by date
            const shift = staffShifts.find(s => {
                const sd = new Date(s.date);
                return sd.getDate() === d.getDate() && sd.getMonth() === d.getMonth();
            });

            // Helper for Rounding (Mimics import-excel.ts)
            const applyRounding = (time: string, role: string, type: 'start' | 'end') => {
                const [h, m] = time.split(':').map(Number);
                const min = h * 60 + m;

                if (role === 'RECEPTION') {
                    if (type === 'start') {
                        // 09:30 - 10:00 -> 10:00
                        if (min >= 9 * 60 + 30 && min <= 10 * 60) return "10:00";
                        // 12:40+ -> 13:00
                        if (h === 12 && m >= 40) return "13:00";
                    } else {
                        // 18:45 - 19:10 -> 19:00
                        if (min >= 18 * 60 + 45 && min <= 19 * 60 + 10) return "19:00";
                        // 21:31 - 22:04 -> 22:00 (Using shared logic from import)
                        if ((h === 21 && m >= 31) || (h === 22 && m <= 4)) return "22:00";
                    }
                } else {
                    // Therapist / Other
                    if (type === 'start') {
                        if (h === 12 && m >= 40) return "13:00";
                    } else {
                        if ((h === 21 && m >= 31) || (h === 22 && m <= 4)) return "22:00";
                    }
                }
                return time; // Return original if no rounding
            };

            if (shift && shift.status === 'Confirmed') {
                // Apply Rounding to Shift Time to match Attendance Rounding
                const roundedShiftStart = shift.start ? applyRounding(shift.start, staff.role, 'start') : null;
                const roundedShiftEnd = shift.end ? applyRounding(shift.end, staff.role, 'end') : null;

                const shiftStart = parseTime(roundedShiftStart);
                const shiftEnd = parseTime(roundedShiftEnd);
                const attStart = parseTime(att.start);
                const attEnd = parseTime(att.end);

                // Late Calculation
                if (shiftStart !== null && attStart !== null) {
                    if (attStart > shiftStart) {
                        totalLateMins += (attStart - shiftStart);
                    }
                }

                // Early Leave Calculation
                if (shiftEnd !== null && attEnd !== null) {
                    if (attEnd < shiftEnd) {
                        totalEarlyMins += (shiftEnd - attEnd);
                    }
                }
            }
        });

        return {
            staff,
            daysInMonth,
            workDays,
            offCount,
            alCount,
            totalLateMins,
            totalEarlyMins,
            totalWorkHours,
            totalOvertimeHours
        };
    });

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <h2 className="text-2xl font-bold flex items-center gap-2 text-slate-200">
                        <span className="text-[var(--primary)]">{year}</span>
                        <span className="text-slate-400">/</span>
                        <span>{month.toString().padStart(2, '0')}</span>
                    </h2>
                    <div className="flex gap-2">
                        <button onClick={() => handleMonthChange(-1)} className="p-1 px-3 bg-slate-700 hover:bg-slate-600 rounded text-xs text-white transition-colors">
                            &larr; Prev
                        </button>
                        <button onClick={() => handleMonthChange(1)} className="p-1 px-3 bg-slate-700 hover:bg-slate-600 rounded text-xs text-white transition-colors">
                            Next &rarr;
                        </button>
                    </div>
                </div>
            </div>

            <table className="w-full text-sm text-left text-slate-300 border-collapse">
                {/* ... table header ... */}
                <thead className="text-xs text-slate-400 uppercase bg-slate-900/50 border-b border-slate-700">
                    <tr>
                        <th className="px-4 py-3">名前</th>
                        <th className="px-4 py-3 text-center">月日数</th>
                        <th className="px-4 py-3 text-center">出勤日数</th>
                        <th className="px-4 py-3 text-center">休日取得</th>
                        <th className="px-4 py-3 text-center">有給取得</th>
                        <th className="px-4 py-3 text-center text-yellow-500">遅刻</th>
                        <th className="px-4 py-3 text-center text-yellow-500">早退</th>
                        <th className="px-4 py-3 text-center">総労働時間</th>
                        <th className="px-4 py-3 text-center">残業時間</th>
                    </tr>
                </thead>
                <tbody>
                    {summary.map((row) => (
                        <tr key={row.staff.id} className="border-b border-slate-700 hover:bg-slate-700/30">
                            <td className="px-4 py-3 font-bold text-white flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${row.staff.role === 'THERAPIST' ? 'bg-purple-500' : 'bg-orange-500'}`} />
                                {row.staff.name}
                            </td>
                            <td className="px-4 py-3 text-center">{row.daysInMonth}</td>
                            <td className="px-4 py-3 text-center font-mono">{row.workDays}</td>
                            <td className="px-4 py-3 text-center font-mono">{row.offCount}</td>
                            <td className="px-4 py-3 text-center font-mono text-green-400">{row.alCount}</td>
                            <td className="px-4 py-3 text-center font-mono text-yellow-400">
                                {row.totalLateMins > 0 ? formatDuration(row.totalLateMins) : '-'}
                            </td>
                            <td className="px-4 py-3 text-center font-mono text-yellow-400">
                                {row.totalEarlyMins > 0 ? formatDuration(row.totalEarlyMins) : '-'}
                            </td>
                            <td className="px-4 py-3 text-center font-mono font-bold text-[var(--primary)]">
                                {formatHours(row.totalWorkHours)}
                            </td>
                            <td className="px-4 py-3 text-center font-mono text-pink-400">
                                {formatHours(row.totalOvertimeHours)}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
