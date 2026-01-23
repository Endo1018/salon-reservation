'use client';

import type { Staff, Shift, Attendance } from '@prisma/client';
import { useRouter } from 'next/navigation';
import { isVietnamHoliday } from '@/lib/payroll-engine';

type Props = {
    staffList: Staff[];
    shifts: Shift[];
    attendance: Attendance[];
    year: number;
    month: number;
};

export default function MonthlyAttendanceSummary({ staffList, shifts, attendance, year, month }: Props) {
    // ... (existing code)

    const summary = staffList.map(staff => {
        const staffShifts = shifts.filter(s => s.staffId === staff.id);
        const staffAttendance = attendance.filter(a => a.staffId === staff.id);

        // Filter out Public Holidays from Off Count
        const offCount = staffAttendance.filter(a =>
            a.status === 'Off' && !isVietnamHoliday(new Date(a.date))
        ).length;
        const alCount = staffAttendance.filter(a => a.status === 'AL').length;
        const workDays = staffAttendance.filter(a => (a.workHours || 0) > 0).length;

        let totalWorkHours = 0;
        let totalOvertimeHours = 0;
        let totalLateMins = 0;
        let totalEarlyMins = 0;

        // Duplicate helper from table.tsx for consistency
        const applyRounding = (start: string | null, end: string | null) => {
            let s = start;
            let e = end;

            if (s) {
                const [h, m] = s.split(':').map(Number);
                const mins = h * 60 + m;
                // Rule: 12:40 - 12:59 -> 13:00
                if (mins >= 12 * 60 + 40 && mins <= 12 * 60 + 59) {
                    s = '13:00';
                }
            }

            if (e) {
                const [h, m] = e.split(':').map(Number);
                const mins = h * 60 + m;
                // Rule: 21:35 - 21:59 -> 22:00
                if (mins >= 21 * 60 + 35 && mins <= 21 * 60 + 59) {
                    e = '22:00';
                }
            }
            return { start: s, end: e };
        };

        const calcLateEarly = (attStart: string, attEnd: string, shiftStart: string | null, shiftEnd: string | null, breakTime: number = 1.0) => {
            if (!attStart || !shiftStart || !attEnd) return { late: 0, early: 0 };

            const parse = (t: string) => {
                const [h, m] = t.split(':').map(Number);
                return h * 60 + m;
            };

            // 1. Normalize Shift
            let stdShiftStart = parse(shiftStart);
            if (stdShiftStart >= 750 && stdShiftStart <= 795) stdShiftStart = 780; // 12:30-13:15 -> 13:00
            if (stdShiftStart >= 570 && stdShiftStart <= 615) stdShiftStart = 600; // 09:30-10:15 -> 10:00

            // 2. Apply Rounding
            const { start: rStart, end: rEnd } = applyRounding(attStart, attEnd);
            if (!rStart || !rEnd) return { late: 0, early: 0 };

            const effStart = parse(rStart);
            const effEnd = parse(rEnd);

            // 3. Calc Late
            const late = Math.max(0, effStart - stdShiftStart);

            // 4. Calc Early (8h Rule)
            const effDurationMins = (effEnd - effStart) - (breakTime * 60);
            const early = Math.max(0, (8 * 60) - effDurationMins);

            return { late, early };
        };

        staffAttendance.forEach(att => {
            totalWorkHours += att.workHours || 0;
            totalOvertimeHours += att.overtime || 0;

            // Find corresponding shift
            const d = new Date(att.date);
            const shift = staffShifts.find(s => {
                const sd = new Date(s.date);
                return sd.getDate() === d.getDate() && sd.getMonth() === d.getMonth();
            });

            if (att.start && att.end && shift && shift.start && shift.end) {
                const { late, early } = calcLateEarly(
                    att.start,
                    att.end,
                    shift.start,
                    shift.end,
                    att.breakTime ?? 1.0
                );
                totalLateMins += late;
                totalEarlyMins += early;
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
                            <td className="px-4 py-3 text-center font-mono">
                                <span className={row.offCount < getRequiredHolidays(month, row.daysInMonth) ? 'text-red-400 font-bold' : 'text-green-400'}>
                                    {row.offCount}
                                </span>
                                <span className="text-slate-500 text-xs"> / {getRequiredHolidays(month, row.daysInMonth)}</span>
                            </td>
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
