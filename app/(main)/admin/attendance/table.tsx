'use client';

import { updateAttendance, deleteAttendance } from '@/app/actions/attendance';
import { useState } from 'react';

// Simplified Type
type Rec = {
    id: number;
    date: string; // Formatted String
    staff: { name: string };
    start: string | null;
    end: string | null;
    workHours: number;
    breakTime: number;
    overtime: number;
    isOvertime: boolean;
    status: string;
};

// Pure function for calculation
const calculateDuration = (start: string, end: string): number | null => {
    if (!start || !end) return null;

    // Robust parsing using split, which handles HH:mm and HH:mm:ss
    const [h1Str, m1Str] = start.split(':');
    const [h2Str, m2Str] = end.split(':');

    const h1 = parseInt(h1Str, 10);
    const m1 = parseInt(m1Str, 10);
    const h2 = parseInt(h2Str, 10);
    const m2 = parseInt(m2Str, 10);

    if (isNaN(h1) || isNaN(m1) || isNaN(h2) || isNaN(m2)) return null;

    const startMin = h1 * 60 + m1;
    const endMin = h2 * 60 + m2;
    let diff = (endMin - startMin) / 60;

    // Handle overnight shifts (crossing midnight)
    if (diff < 0) diff += 24;

    return diff;
};

import { useEffect } from 'react';

// Helper to format decimal hours to H:MM
const formatDecimalToTime = (decimalHours: number): string => {
    const totalMinutes = Math.round(decimalHours * 60);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${h}:${m.toString().padStart(2, '0')}`;
};

export default function AttendanceTable({ initialData }: { initialData: Rec[] }) {
    const [editingId, setEditingId] = useState<number | null>(null);
    const [newStart, setNewStart] = useState<string>('');
    const [newEnd, setNewEnd] = useState<string>('');
    const [newBreakTime, setNewBreakTime] = useState<string>('1.0');
    const [newIsOvertime, setNewIsOvertime] = useState<boolean>(false);
    const [newWorkHours, setNewWorkHours] = useState<string>('0');
    const [newIsCheck, setNewIsCheck] = useState<boolean>(false);

    // Derived values (calculated on render for simplicity in UI, but passed to Save)
    const [isDeleting, setIsDeleting] = useState(false);

    const startEditing = (rec: Rec) => {
        setEditingId(rec.id);
        // Normalize to HH:mm
        setNewStart(rec.start ? rec.start.slice(0, 5) : '');
        setNewEnd(rec.end ? rec.end.slice(0, 5) : '');
        setNewBreakTime(String(rec.breakTime || 1.0));
        setNewIsOvertime(rec.isOvertime || false);
        setNewWorkHours(String(rec.workHours));
        setNewIsCheck(rec.status === 'Check');
    };

    const stopEditing = () => {
        setEditingId(null);
        setNewStart('');
        setNewEnd('');
        setNewBreakTime('1.0');
        setNewIsOvertime(false);
        setNewWorkHours('0');
        setNewIsCheck(false);
    };

    // Auto-calculate logic
    useEffect(() => {
        if (editingId === null) return;

        const rawDuration = calculateDuration(newStart, newEnd);
        if (rawDuration === null) return; // Don't wipe if invalid

        const netDuration = Math.max(0, rawDuration - Number(newBreakTime));
        const potentialOvertime = Math.max(0, netDuration - 8.0);

        let calculatedHours = netDuration;
        if (potentialOvertime > 0 && !newIsOvertime) {
            calculatedHours = 8.0;
        }

        // Only auto-update if the user hasn't typed a custom value that wildly differs?
        // No, simpler to just always update on dependency change. User overrides LAST.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setNewWorkHours(calculatedHours.toFixed(2));

    }, [newStart, newEnd, newBreakTime, newIsOvertime, editingId]); // Run when inputs change

    const handleSave = async (id: number) => {
        // Calculate overtime for display/record purpose based on logic, NOT the manual hours
        // OR: If manual hours are "8.0" (but real is 7.5), overtime is 0.
        // If manual hours are "9.0" (real 7.5), overtime is 1.0?
        // Let's stick to the derived "Overtime" field logic for saving the *Overtime Value*
        // but save the *WorkHours* as what the user typed.

        const rawDuration = calculateDuration(newStart, newEnd) || 0;
        const netDuration = Math.max(0, rawDuration - Number(newBreakTime));
        const potentialOvertime = Math.max(0, netDuration - 8.0);
        const finalOvertime = (potentialOvertime > 0 && newIsOvertime) ? potentialOvertime : 0;

        await updateAttendance(
            id,
            newStart,
            newEnd,
            Number(newWorkHours), // Use user input
            Number(newBreakTime),
            Number(finalOvertime.toFixed(2)),
            newIsOvertime,
            newIsCheck ? 'Check' : 'Normal'
        );
        stopEditing();
    };

    const handleDelete = async (id: number) => {
        if (confirm('この勤怠記録を削除してもよろしいですか？ (Are you sure?)')) {
            setIsDeleting(true);
            await deleteAttendance(id);
            setIsDeleting(false);
            if (editingId === id) stopEditing();
        }
    };

    return (
        <table className="w-full text-left text-sm">
            <thead className="bg-slate-900/50 text-slate-400 uppercase">
                <tr>
                    <th className="p-4">日付</th>
                    <th className="p-4">氏名</th>
                    <th className="p-4">開始</th>
                    <th className="p-4">終了</th>
                    <th className="p-4">休憩</th>
                    <th className="p-4">残業</th>
                    <th className="p-4">実働</th>
                    <th className="p-4">状態</th>
                    <th className="p-4">操作</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
                {initialData.map((rec) => {
                    const isEditing = editingId === rec.id;

                    if (isEditing) {
                        return (
                            <tr key={rec.id} className="bg-slate-700/50">
                                <td className="p-4 text-slate-400">{rec.date}</td>
                                <td className="p-4 text-slate-400">{rec.staff.name}</td>
                                <td className="p-4">
                                    <input
                                        type="time"
                                        value={newStart}
                                        onChange={(e) => setNewStart(e.target.value)}
                                        className="bg-slate-900 border border-slate-600 rounded p-1 w-24 text-white"
                                    />
                                </td>
                                <td className="p-4">
                                    <input
                                        type="time"
                                        value={newEnd}
                                        onChange={(e) => setNewEnd(e.target.value)}
                                        className="bg-slate-900 border border-slate-600 rounded p-1 w-24 text-white"
                                    />
                                </td>
                                <td className="p-4">
                                    <input
                                        type="number"
                                        step="0.25"
                                        value={newBreakTime}
                                        onChange={(e) => setNewBreakTime(e.target.value)}
                                        className="bg-slate-900 border border-slate-600 rounded p-1 w-16 text-white"
                                    />
                                </td>
                                <td className="p-4">
                                    {/* Potential Overtime UI logic reused for display context if needed, but here we just show the input */}
                                    {/* Recalculate potential overtime for display only: */}
                                    {(() => {
                                        const r = calculateDuration(newStart, newEnd) || 0;
                                        const n = Math.max(0, r - Number(newBreakTime));
                                        const p = Math.max(0, n - 8.0);
                                        if (p <= 0) return <span className="text-slate-600">-</span>;
                                        return (
                                            <div className="flex items-center gap-2">
                                                <span className="text-yellow-400 font-mono text-xs">+{formatDecimalToTime(p)}</span>
                                                <input
                                                    type="checkbox"
                                                    checked={newIsOvertime}
                                                    onChange={(e) => setNewIsOvertime(e.target.checked)}
                                                    className="w-4 h-4 bg-slate-900 border-slate-600 rounded"
                                                    title="残業として承認する場合はチェック (Check to approve overtime)"
                                                />
                                            </div>
                                        );
                                    })()}
                                </td>
                                <td className="p-4 font-mono text-white">
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={newWorkHours}
                                        onChange={(e) => setNewWorkHours(e.target.value)}
                                        className="bg-slate-900 border border-slate-600 rounded p-1 w-20 text-white font-mono"
                                    />
                                    <span className="ml-1 text-xs text-slate-500">h</span>
                                </td>
                                <td className="p-4">
                                    <label className="flex items-center gap-2 cursor-pointer bg-slate-800 px-2 py-1 rounded border border-slate-600">
                                        <input
                                            type="checkbox"
                                            checked={newIsCheck}
                                            onChange={(e) => setNewIsCheck(e.target.checked)}
                                            className="w-4 h-4 rounded border-slate-500 bg-slate-700 text-[var(--primary)]"
                                        />
                                        <span className="text-xs text-white">要確認</span>
                                    </label>
                                </td>
                                <td className="p-4 flex items-center">
                                    <button
                                        onClick={() => handleSave(rec.id)}
                                        className="text-green-400 font-bold hover:underline mr-2"
                                    >
                                        保存
                                    </button>
                                    <button
                                        onClick={() => stopEditing()}
                                        className="text-slate-500 hover:text-white mr-2"
                                    >
                                        中止
                                    </button>
                                    <button
                                        onClick={() => handleDelete(rec.id)}
                                        className="text-red-500 hover:text-red-400"
                                        disabled={isDeleting}
                                    >
                                        削除
                                    </button>
                                </td>
                            </tr>
                        );
                    }

                    return (
                        <tr key={rec.id} className="hover:bg-slate-700/50 transition-colors">
                            <td className="p-4 font-mono">{rec.date}</td>
                            <td className="p-4 font-bold">{rec.staff.name}</td>
                            <td className="p-4">{rec.start || '-'}</td>
                            <td className="p-4">{rec.end || '-'}</td>
                            <td className="p-4 text-slate-400">
                                {rec.breakTime ? formatDecimalToTime(rec.breakTime) : '1:00'}
                            </td>
                            <td className="p-4">
                                {rec.overtime > 0 ? (
                                    <span className="text-yellow-400 font-mono text-xs bg-yellow-900/20 px-2 py-1 rounded">
                                        +{formatDecimalToTime(rec.overtime)}
                                        {rec.isOvertime ? ' ✅' : ' ⚠️'}
                                    </span>
                                ) : (
                                    <span className="text-slate-600">-</span>
                                )}
                            </td>
                            <td className="p-4 font-mono">{formatDecimalToTime(rec.workHours)} h</td>
                            <td className="p-4">
                                {rec.status === 'Error' ? (
                                    <span className="text-red-400 font-bold text-xs bg-red-900/30 px-2 py-1 rounded">ERROR</span>
                                ) : rec.status === 'Check' ? (
                                    <span className="text-orange-400 font-bold text-xs bg-orange-900/30 px-2 py-1 rounded">CHECK</span>
                                ) : (
                                    <span className="text-green-400 font-bold text-xs">OK</span>
                                )}
                            </td>
                            <td className="p-4 flex items-center gap-2">
                                <button onClick={() => startEditing(rec)} className="text-xs bg-slate-700 px-3 py-1 rounded hover:bg-slate-600 border border-slate-500">編集</button>
                                <button onClick={() => handleDelete(rec.id)} className="text-xs text-red-500 hover:text-red-400">削除</button>
                            </td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
    );
}
