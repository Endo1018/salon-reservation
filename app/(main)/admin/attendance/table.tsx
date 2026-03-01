'use client';

import { updateAttendance, deleteAttendance } from '@/app/actions/attendance';
import { useState, useEffect } from 'react';
import ConfirmDialog from '@/app/components/ConfirmDialog';

// Simplified Type
type Rec = {
    id: number;
    date: string; // Formatted String
    staff: { name: string };
    staffRole: string; // 'THERAPIST' | 'RECEPTION' etc.
    start: string | null;
    end: string | null;
    workHours: number;
    breakTime: number;
    overtime: number;
    isOvertime: boolean;
    status: string;
    lateMins: number; // Calculated default
    earlyMins: number;
    shiftStart: string | null;
    shiftEnd: string | null;
    lateTimeOverride?: number | null; // DB field
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

// Helper for Rounding Rules
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

// Helper for dynamic Late/Early Calc
const calcLateEarly = (attStart: string, attEnd: string, shiftStart: string | null, shiftEnd: string | null, breakTime: number = 1.0, staffRole: string = 'THERAPIST') => {
    // 1. Normalize Shift (to avoid 12:47 vs 13:00 issues)
    if (!attStart || !shiftStart || !attEnd) return { late: 0, early: 0 };

    // Simple parse
    const parse = (t: string) => {
        const [h, m] = t.split(':').map(Number);
        return h * 60 + m;
    };

    // We infer Standard Shift from the DB Shift
    let stdShiftStart = parse(shiftStart);
    // Snap 12:30-13:15 -> 13:00 (780)
    if (stdShiftStart >= 750 && stdShiftStart <= 795) stdShiftStart = 780;
    // Snap 09:30-10:15 -> 10:00 (600)
    if (stdShiftStart >= 570 && stdShiftStart <= 615) stdShiftStart = 600;

    // 2. Apply Rounding to Attendance
    const { start: rStart, end: rEnd } = applyRounding(attStart, attEnd);
    if (!rStart || !rEnd) return { late: 0, early: 0 };

    const effStart = parse(rStart);
    const effEnd = parse(rEnd);

    // 3. Calc Late
    // Business Rule: Therapists (non-RECEPTION) arriving before 13:00 are
    // coming for bookings only, not their regular shift — no late penalty.
    let late = 0;
    const isTherapist = staffRole !== 'RECEPTION';
    const shiftBefore13 = stdShiftStart < 13 * 60;

    if (isTherapist && shiftBefore13) {
        late = 0;
    } else {
        // Late if Effective Start > Standard Shift Start
        late = Math.max(0, effStart - stdShiftStart);
    }

    // 4. Calc Early
    // Early if Work Hours < 8.0
    // Work Hours = EffEnd - EffStart - Break
    const effDurationMins = (effEnd - effStart) - (breakTime * 60);
    // Early = 8h - effDuration
    const early = Math.max(0, (8 * 60) - effDurationMins);

    return { late, early };
};

// Helper to format decimal hours to H:MM
const formatDecimalToTime = (decimalHours: number): string => {
    const totalMinutes = Math.round(decimalHours * 60);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${h}:${m.toString().padStart(2, '0')}`;
};

// Helper inside component to parse "H:MM" back to minutes
const parseDurationString = (str: string): number => {
    if (!str) return 0;
    const [h, m] = str.split(':').map(Number);
    if (isNaN(h) || isNaN(m)) return 0;
    return h * 60 + m;
};

export default function AttendanceTable({ initialData }: { initialData: Rec[] }) {
    const [editingId, setEditingId] = useState<number | null>(null);
    const [newStart, setNewStart] = useState<string>('');
    const [newEnd, setNewEnd] = useState<string>('');
    const [newBreakTime, setNewBreakTime] = useState<string>('1.0');
    const [newIsOvertime, setNewIsOvertime] = useState<boolean>(false);
    const [newWorkHours, setNewWorkHours] = useState<string>('0');

    // Manual Late Override: null means "use auto-calc". string means "user typed something".
    const [manualLate, setManualLate] = useState<string | null>(null);

    const [newEarly, setNewEarly] = useState<string>('0:00');
    const [newIsCheck, setNewIsCheck] = useState<boolean>(false);

    const [isDeleting, setIsDeleting] = useState(false);

    // Confirm Dialog State
    const [confirmState, setConfirmState] = useState<{
        isOpen: boolean;
        deleteId: number | null;
    }>({ isOpen: false, deleteId: null });

    const openDeleteConfirm = (id: number) => {
        setConfirmState({ isOpen: true, deleteId: id });
    };

    const closeDeleteConfirm = () => {
        setConfirmState({ isOpen: false, deleteId: null });
    };

    const executeDelete = async () => {
        if (confirmState.deleteId === null) return;
        setIsDeleting(true);
        closeDeleteConfirm();
        await deleteAttendance(confirmState.deleteId);
        setIsDeleting(false);
        if (editingId === confirmState.deleteId) stopEditing();
    };

    const startEditing = (rec: Rec) => {
        setEditingId(rec.id);
        // Normalize to HH:mm
        setNewStart(rec.start ? rec.start.slice(0, 5) : '');
        setNewEnd(rec.end ? rec.end.slice(0, 5) : '');
        setNewBreakTime(String(rec.breakTime ?? 1.0));
        setNewIsOvertime(rec.isOvertime || false);
        setNewWorkHours(String(rec.workHours));
        setNewIsCheck(rec.status === 'Check');

        // Late Init: If override exists, use it. Else null (auto).
        if (rec.lateTimeOverride !== null && rec.lateTimeOverride !== undefined) {
            setManualLate(formatDecimalToTime(rec.lateTimeOverride / 60));
        } else {
            setManualLate(null);
        }

        // Early init (keep calc or allow override too? User asked for Late only generally)
        const { early } = calcLateEarly(
            rec.start ? rec.start.slice(0, 5) : '',
            rec.end ? rec.end.slice(0, 5) : '',
            rec.shiftStart,
            rec.shiftEnd,
            rec.breakTime,
            rec.staffRole
        );
        setNewEarly(formatDecimalToTime(early / 60));
    };

    const stopEditing = () => {
        setEditingId(null);
        setNewStart('');
        setNewEnd('');
        setNewBreakTime('1.0');
        setNewIsOvertime(false);
        setNewWorkHours('0');
        setNewIsCheck(false);
        setManualLate(null);
        setNewEarly('0:00');
    };

    // Auto-calculate logic
    useEffect(() => {
        if (editingId === null) return;

        const rawDuration = calculateDuration(newStart, newEnd);
        if (rawDuration === null) return;

        const netDuration = Math.max(0, rawDuration - Number(newBreakTime));
        let calculatedHours = netDuration;
        const val = calculatedHours.toFixed(2);
        if (val !== newWorkHours) {
            // Deferred update to satisfy linter rule "no sync setState in effect"
            setTimeout(() => setNewWorkHours(val), 0);
        }

        // NOTE: we do NOT update manualLate here.
        // User sees auto-calc late value if manualLate is null.
        // If they change Start Time, auto-calc late changes.
    }, [newStart, newEnd, newBreakTime, editingId]);

    const handleSave = async (id: number) => {
        const rawDuration = calculateDuration(newStart, newEnd) || 0;
        const netDuration = Math.max(0, rawDuration - Number(newBreakTime));
        const potentialOvertime = Math.max(0, netDuration - 8.0);
        const finalOvertime = potentialOvertime;

        // Calc current dynamic late (for comparison)
        const rec = initialData.find(r => r.id === id);
        let overrideVal: number | null = null;
        let calculatedLate = 0;

        if (rec) {
            const { late } = calcLateEarly(newStart, newEnd, rec.shiftStart, rec.shiftEnd, Number(newBreakTime), rec.staffRole);
            calculatedLate = late;
        }

        if (manualLate !== null) {
            const manualMins = parseDurationString(manualLate);
            if (manualMins !== calculatedLate) {
                overrideVal = manualMins;
            } else {
                overrideVal = null; // Matches calc, so clear override
            }
        }

        await updateAttendance(
            id,
            newStart,
            newEnd,
            Number(newWorkHours),
            Number(newBreakTime),
            Number(finalOvertime.toFixed(2)),
            newIsOvertime,
            newIsCheck ? 'Check' : 'Normal',
            newStart,
            newEnd,
            overrideVal // Pass override
        );
        stopEditing();
    };

    const handleDelete = (id: number) => {
        openDeleteConfirm(id);
    };

    return (
        <>
            <table className="w-full text-left text-sm">
                <thead className="bg-slate-900/50 text-slate-400 uppercase">
                    <tr>
                        <th className="p-4">日付</th>
                        <th className="p-4">氏名</th>
                        <th className="p-4">開始</th>
                        <th className="p-4">終了</th>
                        <th className="p-4">休憩</th>
                        <th className="p-4">遅刻</th>
                        <th className="p-4">早退</th>
                        <th className="p-4">残業</th>
                        <th className="p-4">実働</th>
                        <th className="p-4">状態</th>
                        <th className="p-4">操作</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                    {initialData.map((rec) => {
                        const isEditing = editingId === rec.id;

                        // Calc Display Late/Early
                        const { late: calculatedLate, early } = calcLateEarly(
                            isEditing ? newStart : (rec.start ? rec.start.slice(0, 5) : ''),
                            isEditing ? newEnd : (rec.end ? rec.end.slice(0, 5) : ''),
                            rec.shiftStart,
                            rec.shiftEnd,
                            isEditing ? Number(newBreakTime) : rec.breakTime,
                            rec.staffRole
                        );

                        // Determine what to show for Late
                        // View Mode: use DB override if present, else calc.
                        // Edit Mode: use manualLate state if present, else calc.
                        let displayLateMins = calculatedLate;
                        if (isEditing) {
                            // In edit mode loop??? No wait.
                            // `newStart` is global state for the ONE editing row.
                            // So `calculatedLate` IS correct for the editing row.

                            // Wait, `manualLate` is a STRING input (H:MM). e.g. "0:41".
                            // `calculatedLate` is number (41).
                        } else {
                            if (rec.lateTimeOverride !== null && rec.lateTimeOverride !== undefined) {
                                displayLateMins = rec.lateTimeOverride;
                            }
                        }

                        // For editing input value:
                        const editingInputValue = manualLate !== null
                            ? manualLate
                            : formatDecimalToTime(calculatedLate / 60);

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
                                    <td className="p-4 text-slate-400">
                                        <input
                                            type="text"
                                            placeholder="0:00"
                                            value={editingInputValue}
                                            onChange={(e) => setManualLate(e.target.value)}
                                            className={`bg-slate-900 border border-slate-600 rounded p-1 w-16 text-white ${editingInputValue !== '0:00' ? 'text-red-400' : ''}`}
                                        />
                                    </td>
                                    <td className="p-4 text-slate-400">
                                        {early > 0 ? <span className="text-red-400 font-mono">{formatDecimalToTime(early / 60)}</span> : '-'}
                                    </td>
                                    <td className="p-4">
                                        {/* Potential Overtime logic */}
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
                                                        title="Check to approve overtime"
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
                                <td className="p-4 text-slate-400">
                                    {displayLateMins > 0 ? (
                                        <span className="text-red-400 font-mono text-xs font-bold">
                                            {formatDecimalToTime(displayLateMins / 60)}
                                        </span>
                                    ) : (
                                        <span className="text-slate-600">-</span>
                                    )}
                                </td>
                                <td className="p-4 text-slate-400">
                                    {early > 0 ? (
                                        <span className="text-red-400 font-mono text-xs font-bold">
                                            {formatDecimalToTime(early / 60)}
                                        </span>
                                    ) : (
                                        <span className="text-slate-600">-</span>
                                    )}
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

            {/* Confirm Dialog */}
            <ConfirmDialog
                isOpen={confirmState.isOpen}
                onClose={closeDeleteConfirm}
                onConfirm={executeDelete}
                title="勤怠記録を削除"
                message={"\u3053\u306e\u52e4\u6020\u8a18\u9332\u3092\u524a\u9664\u3057\u3066\u3082\u3088\u308d\u3057\u3044\u3067\u3059\u304b\uff1f\n(Are you sure?)"}
                confirmText="削除"
                cancelText="キャンセル"
                isDestructive={true}
                isLoading={isDeleting}
            />
        </>
    );
}
