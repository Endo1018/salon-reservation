'use client';

import { useState, useEffect } from 'react';
import { upsertShift } from '@/app/actions/shift';
import { useRouter } from 'next/navigation';

type Staff = { id: string; name: string; role: string };
type Shift = { staffId: string; date: Date; status: string; start: string | null; end: string | null };

export default function ShiftCalendar({
    staffList,
    initialShifts,
    year,
    month
}: {
    staffList: Staff[];
    initialShifts: Shift[];
    year: number;
    month: number;
}) {
    const router = useRouter();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    const [localShifts, setLocalShifts] = useState(initialShifts);

    // Sync state with props to ensure fresh data on navigation/re-render
    useEffect(() => {
        setLocalShifts(initialShifts);
    }, [initialShifts]);

    const getShift = (staffId: string, day: number) => {
        return localShifts.find(s =>
            s.staffId === staffId &&
            new Date(s.date).getDate() === day
        );
    };

    const handleCellClick = async (staffId: string, day: number) => {
        const current = getShift(staffId, day);
        // Correctly format YYYY-MM-DD using local (displayed) year/month
        // Note: month is 0-indexed in JS Date, but we need 1-indexed for string
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

        // IMPORTANT: The server will treat this as YYYY-MM-DD -> UTC Midnight
        // The display logic must also match this.

        const staff = staffList.find(s => s.id === staffId);

        // Default Logic (Safe fallback)
        let newStatus = 'Confirmed';
        let newStart = '10:00';
        let newEnd = '19:00';

        if (staff?.role === 'RECEPTION') {
            // Reception Cycle: Empty (-) -> OFF -> AL -> 10:00-19:00 -> 13:00-22:00 -> Delete
            // User requested: - -> OFF -> AL -> Time

            if (!current) {
                // Empty -> OFF
                newStatus = 'Off';
                newStart = '';
                newEnd = '';
            } else if (current.status === 'Off') {
                // OFF -> AL
                newStatus = 'AL';
                newStart = '';
                newEnd = '';
            } else if (current.status === 'AL') {
                // AL -> 10:00-19:00 (Early)
                newStatus = 'Confirmed';
                newStart = '10:00';
                newEnd = '19:00';
            } else if (current.status === 'Confirmed' && current.start === '10:00') {
                // 10:00 -> 13:00-22:00 (Late)
                newStatus = 'Confirmed';
                newStart = '13:00';
                newEnd = '22:00';
            } else {
                // Any other Confirmed -> DELETE
                newStatus = 'DELETE';
            }
        } else {
            // Therapist Cycle: Empty (-) -> OFF -> AL -> 13:00-22:00 -> Custom -> Delete
            if (!current) {
                // Empty -> OFF
                newStatus = 'Off';
                newStart = '';
                newEnd = '';
            } else if (current.status === 'Off') {
                // OFF -> AL
                newStatus = 'AL';
                newStart = '';
                newEnd = '';
            } else if (current.status === 'AL') {
                // AL -> 13:00-22:00 (Standard)
                newStatus = 'Confirmed';
                newStart = '13:00';
                newEnd = '22:00';
            } else if (current.status === 'Confirmed' && current.start === '13:00') {
                // 13:00 -> Custom Input
                const input = window.prompt("予約・早番の開始時間を入力してください (例: 10:00)\nキャンセルを押すと「-」に戻ります。", "10:00");

                if (input === null) {
                    // Cancelled -> DELETE
                    newStatus = 'DELETE';
                } else {
                    // Validate/Format Time
                    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
                    let validStart = input.trim();

                    // Simple correction 10 -> 10:00
                    if (/^\d{1,2}$/.test(validStart)) validStart = `${validStart}:00`;

                    if (!timeRegex.test(validStart)) {
                        alert("時間の形式が正しくありません (例: 10:00)");
                        return; // Abort
                    }

                    // Calculate End Time (+9 hours)
                    const [h, m] = validStart.split(':').map(Number);
                    const endH = (h + 9) % 24;
                    const validEnd = `${String(endH).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

                    newStatus = 'Confirmed';
                    newStart = validStart;
                    newEnd = validEnd;
                }
            } else {
                // Custom/Other -> DELETE
                newStatus = 'DELETE';
            }
        }

        // Optimistic Update
        let nextShifts = [...localShifts];

        // Remove existing first (to replace or delete)
        nextShifts = nextShifts.filter(s => !(s.staffId === staffId && new Date(s.date).getDate() === day));

        // If not deleting, add the new one
        if (newStatus !== 'DELETE') {
            const newShift = {
                staffId,
                date: new Date(year, month, day),
                status: newStatus,
                start: newStart,
                end: newEnd
            };
            nextShifts.push(newShift);
        }

        setLocalShifts(nextShifts);

        await upsertShift(staffId, dateStr, newStatus, newStart, newEnd);
        router.refresh(); // Clear client cache to ensure navigation back sees new data
    };

    const therapists = staffList.filter(s => s.role === 'THERAPIST');
    const reception = staffList.filter(s => s.role === 'RECEPTION');

    const renderRows = (title: string, list: Staff[]) => (
        <>
            {/* Section Header */}
            <tr>
                <td
                    colSpan={days.length + 1}
                    className="bg-slate-800 text-left p-2 font-bold text-[var(--primary)] border-b border-slate-700 sticky left-0 z-20"
                >
                    {title}
                </td>
            </tr>
            {list.map(staff => (
                <tr key={staff.id}>
                    <td className="p-3 text-left bg-slate-900 border-b border-slate-700 sticky left-0 z-10 font-bold text-sm">
                        {staff.name}
                    </td>
                    {days.map(d => {
                        const shift = getShift(staff.id, d);
                        const isOff = shift && shift.status === 'Off';
                        const isAL = shift && shift.status === 'AL';
                        const isConfirmed = shift && shift.status === 'Confirmed';

                        return (
                            <td
                                key={d}
                                onClick={() => handleCellClick(staff.id, d)}
                                className={`border-b border-l border-slate-700 cursor-pointer hover:brightness-110 transition-colors text-[10px] h-12
              ${isOff ? 'bg-red-900/20 text-red-500' : ''}
              ${isAL ? 'bg-green-900/20 text-green-400 font-bold' : ''}
              ${isConfirmed ? 'bg-blue-900/20 text-blue-300' : ''}
              ${!shift ? 'bg-slate-800' : ''}
            `}
                            >
                                {isConfirmed ? (
                                    <>
                                        {shift.start}<br />{shift.end}
                                    </>
                                ) : (
                                    isOff ? 'OFF' : (isAL ? 'AL' : '-')
                                )}
                            </td>
                        );
                    })}
                </tr>
            ))}
        </>
    );

    return (
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-x-auto">
            <table className="w-full text-center border-collapse">
                <thead>
                    <tr>
                        <th className="p-4 text-left bg-slate-900 border-b border-slate-700 sticky left-0 z-10 w-40">Staff</th>
                        {days.map(d => {
                            const date = new Date(year, month, d);
                            const dayOfWeek = date.getDay(); // 0=Sun
                            const color = dayOfWeek === 0 ? 'text-red-400' : (dayOfWeek === 6 ? 'text-blue-400' : 'text-slate-400');
                            return (
                                <th key={d} className={`p-2 min-w-[3rem] border-b border-l border-slate-700 text-xs font-mono ${color}`}>
                                    {d}<br />{['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'][dayOfWeek]}
                                </th>
                            );
                        })}
                    </tr>
                </thead>
                <tbody>
                    {renderRows('THERAPIST', therapists)}
                    {renderRows('RECEPTION', reception)}
                </tbody>
            </table>
            <div className="p-4 text-xs text-slate-500 space-y-1">
                <p>Therapist: [ - ] &rarr; [OFF] &rarr; [AL] &rarr; [13:00-22:00] &rarr; [Custom] &rarr; [Clear]</p>
                <p>Reception: [ - ] &rarr; [OFF] &rarr; [AL] &rarr; [10:00-19:00] &rarr; [13:00-22:00] &rarr; [Clear]</p>
            </div>
        </div>
    );
}
