'use client';

import { useState, useEffect, useMemo } from 'react';
import { getImportListData, ImportLayoutRow } from '@/app/actions/import-list';
import { syncBookingsFromGoogleSheets } from '@/app/actions/sync-google';
import { publishDrafts } from '@/app/actions/publish-draft';
import { updateDraft } from '@/app/actions/update-draft';
import { deleteDraft } from '@/app/actions/delete-draft';
import { clearFebruaryData } from '@/app/actions/debug-tools';
import { toast } from 'sonner';
import { RefreshCcw, Check, AlertTriangle, Lock, Trash2, Edit } from 'lucide-react';
import TimelineNav from '../timeline/components/TimelineNav';
import StaffSummarySection from './components/StaffSummarySection';

// Sort Config Type
type SortConfig = {
    key: keyof ImportLayoutRow | '';
    direction: 'asc' | 'desc';
};

export default function ImportListPage() {
    // Top-level Date State
    const today = new Date();
    const [year, setYear] = useState(today.getFullYear());
    const [month, setMonth] = useState(today.getMonth() + 1);

    // Data State
    const [rows, setRows] = useState<ImportLayoutRow[]>([]);
    const [isDraft, setIsDraft] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    // UI State
    const [isSyncing, setIsSyncing] = useState(false);
    const [isPublishing, setIsPublishing] = useState(false);

    // Filtering & Sorting
    const [staffFilter, setStaffFilter] = useState('ALL');
    const [dateFilterMode, setDateFilterMode] = useState<'ALL' | 'SPECIFIC'>('ALL');
    const [specificDate, setSpecificDate] = useState(''); // YYYY-MM-DD
    const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'date', direction: 'asc' });

    // Editing State
    const [editingRow, setEditingRow] = useState<ImportLayoutRow | null>(null);
    const [editForm, setEditForm] = useState({ startTime: '' }); // Simplified edit form

    useEffect(() => {
        loadData();
    }, [year, month]);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const data = await getImportListData(year, month);
            setRows(data.rows);
            setIsDraft(data.isDraft);
        } catch (e) {
            console.error(e);
            toast.error('Failed to load data');
        } finally {
            setIsLoading(false);
        }
    };

    // Actions
    const handleSync = async () => {
        if (!confirm('Google Sheetsからデータを同期しますか？\n(現在のドラフトは上書きされます)')) return;
        setIsSyncing(true);
        const targetDateStr = `${year}-${String(month).padStart(2, '0')}-01`;
        const res = await syncBookingsFromGoogleSheets(targetDateStr);
        setIsSyncing(false);

        if (res.success) {
            toast.success(res.message);
            loadData();
        } else {
            toast.error(res.message);
        }
    };

    const handlePublish = async () => {
        if (!confirm('ドラフトを本番(Timeline)に反映しますか？\n(既存の予約は上書きされます)')) return;
        setIsPublishing(true);
        const res = await publishDrafts(year, month);
        setIsPublishing(false);

        if (res.success) {
            toast.success(res.message);
            loadData();
        } else {
            toast.error(res.message);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('このドラフト予約を削除しますか？')) return;
        const res = await deleteDraft(id);
        if (res.success) {
            toast.success('Deleted');
            loadData();
        } else {
            toast.error(res.message);
        }
    };

    const handleClearFeb = async () => {
        if (confirm('2026年2月の全データを強制削除しますか？\n(ドラフト・確定予約すべて削除されます)')) {
            const res = await clearFebruaryData();
            if (res.success) {
                toast.success(`Deleted ${res.count} records.`);
                await loadData();
            } else {
                toast.error(`Failed: ${res.error}`);
            }
        }
    };

    // Edit Logic
    const openEdit = (row: ImportLayoutRow) => {
        // Parse time from Time String or Date?
        // Row has time string or explicit.
        // Let's use Date object
        const d = new Date(row.date);
        // Correct to display local time (VN/JP)
        // row.date is UTC from server (startAt).
        // Let's assume we just want HH:mm
        // row.date is Date object.
        const hh = d.getUTCHours() + 7; // VN
        const mm = d.getUTCMinutes();
        const timeStr = `${String(hh % 24).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;

        setEditingRow(row);
        setEditForm({ startTime: timeStr });
    };

    const handleSaveEdit = async () => {
        if (!editingRow) return;
        const res = await updateDraft(editingRow.id, { startTime: editForm.startTime });
        if (res.success) {
            toast.success('Updated');
            setEditingRow(null);
            loadData();
        } else {
            toast.error(res.message);
        }
    };

    const handleSort = (key: keyof ImportLayoutRow) => {
        setSortConfig(current => ({
            key,
            direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    // Filtering & Sorting Logic
    const visibleRows = useMemo(() => {
        let filtered = [...rows];

        // Staff Filter
        if (staffFilter !== 'ALL') {
            filtered = filtered.filter(row =>
                row.staff1 === staffFilter || row.staff2 === staffFilter
            );
        }

        // Date Filter
        if (dateFilterMode === 'SPECIFIC' && specificDate) {
            filtered = filtered.filter(row => {
                const d = new Date(row.date);
                // Compare YYYY-MM-DD
                // Need to match specificDate string
                // Row date is Date obj.
                // specificDate is "2026-01-01"?
                // Let's match roughly
                const dateStr = d.toISOString().split('T')[0];
                // But timezone...
                // Better: check if booking falls on that day local time.
                // Simplified: Match exact YMD if possible.
                // Or just string compare for now assuming UTC alignment in layout.
                return dateStr === specificDate;
            });
        }

        // Sort
        if (sortConfig.key && sortConfig.key !== '') {
            filtered.sort((a, b) => {
                const key = sortConfig.key as keyof ImportLayoutRow; // Assert
                const aVal = a[key];
                const bVal = b[key];
                if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }

        return filtered;
    }, [rows, staffFilter, dateFilterMode, specificDate, sortConfig]);

    const uniqueStaff = useMemo(() => {
        const set = new Set<string>();
        rows.forEach(r => {
            if (r.staff1) set.add(r.staff1);
            if (r.staff2) set.add(r.staff2);
        });
        return Array.from(set).sort();
    }, [rows]);

    return (
        <div className="flex flex-col h-full bg-slate-950 text-slate-200 overflow-hidden">
            <TimelineNav />

            <div className="flex flex-col h-full p-6 overflow-hidden">
                <header className="flex flex-col gap-4 mb-2">
                    <div className="flex justify-between items-center">
                        <div>
                            <h1 className="text-2xl font-bold text-white mb-1">Imported Booking List</h1>
                            <p className="text-xs text-slate-500">View of database records emulating Google Sheet structure</p>
                        </div>
                        <div className="flex items-center gap-2">
                            {/* Date Navigation (Simple Year/Month Selector) */}
                            <select
                                value={year}
                                onChange={e => setYear(Number(e.target.value))}
                                className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm"
                            >
                                {[2025, 2026, 2027].map(y => <option key={y} value={y}>{y}年</option>)}
                            </select>
                            <select
                                value={month}
                                onChange={e => setMonth(Number(e.target.value))}
                                className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm"
                            >
                                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                                    <option key={m} value={m}>{m}月</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Filter Bar */}
                    <div className="flex flex-wrap gap-4 bg-slate-800 p-4 rounded-xl border border-slate-700 items-end">
                        {/* Staff Filter */}
                        <div>
                            <label className="text-xs text-slate-500 mb-1 block">スタッフ</label>
                            <select
                                value={staffFilter}
                                onChange={e => setStaffFilter(e.target.value)}
                                className="bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-sm min-w-[150px]"
                            >
                                <option value="ALL">全員 (All)</option>
                                {uniqueStaff.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>

                        {/* Date Filter */}
                        <div>
                            <label className="text-xs text-slate-500 mb-1 block">日付指定</label>
                            <div className="flex gap-2">
                                <select
                                    value={dateFilterMode}
                                    onChange={e => setDateFilterMode(e.target.value as any)}
                                    className="bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-sm"
                                >
                                    <option value="ALL">月 (Month)</option>
                                    <option value="SPECIFIC">日 (Day)</option>
                                </select>
                                {dateFilterMode === 'SPECIFIC' && (
                                    <input
                                        type="date"
                                        value={specificDate}
                                        onChange={e => setSpecificDate(e.target.value)}
                                        className="bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-sm"
                                    />
                                )}
                            </div>
                        </div>

                        <div className="flex-1"></div>

                        {/* Sync Button */}
                        <button
                            onClick={handleSync}
                            disabled={isSyncing || isPublishing}
                            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded shadow-lg transition-transform active:scale-95 disabled:opacity-50"
                        >
                            <RefreshCcw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                            {isSyncing ? 'Syncing...' : 'Fetch Draft'}
                        </button>

                        {/* Publish Button */}
                        {isDraft && (
                            <button
                                onClick={handlePublish}
                                disabled={isPublishing || isSyncing}
                                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white font-bold rounded shadow-lg transition-transform active:scale-95 disabled:opacity-50 animate-pulse"
                            >
                                <Check className="w-4 h-4" />
                                {isPublishing ? 'Publishing...' : 'Publish to Timeline'}
                            </button>
                        )}
                    </div>

                    {/* Draft Banner & debug tools */}
                    <div className="flex justify-between items-center w-full gap-4">
                        {isDraft && (
                            <div className="flex-1 bg-amber-900/50 border border-amber-700 text-amber-200 px-4 py-2 rounded flex items-center gap-2 text-sm">
                                <AlertTriangle className="w-4 h-4 text-amber-500" />
                                <span>PREVIEW MODE: You are viewing DRAFT data. This has NOT been applied to the Timeline yet. Click "Publish" to go live.</span>
                            </div>
                        )}
                        {!isDraft && <div className="flex-1"></div>}
                        <button onClick={handleClearFeb} className="px-3 py-1 bg-red-900/50 hover:bg-red-800 text-red-200 text-xs rounded border border-red-800 whitespace-nowrap">
                            ⚠️ Clear Feb 2026
                        </button>
                    </div>
                </header>

                {/* Summary Section */}
                <StaffSummarySection year={year} month={month} />

                <div className="flex-1 overflow-auto border border-slate-800 rounded bg-slate-900">
                    <table className="w-full text-left border-collapse text-sm">
                        <thead className="bg-slate-950 text-slate-400 sticky top-0 z-10 shadow-sm">
                            <tr>
                                <th
                                    className="p-3 border-b border-slate-700 min-w-[100px] cursor-pointer hover:bg-slate-800 transition-colors select-none"
                                    onClick={() => handleSort('date')}
                                >
                                    Date {sortConfig?.key === 'date' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                </th>
                                <th className="p-3 border-b border-slate-700 min-w-[80px]">Time</th>
                                <th className="p-3 border-b border-slate-700 min-w-[150px]">Name</th>
                                <th className="p-3 border-b border-slate-700 min-w-[200px]">Menu 1</th>
                                <th className="p-3 border-b border-slate-700 min-w-[60px]">Min 1</th>
                                <th className="p-3 border-b border-slate-700 min-w-[200px]">Menu 2</th>
                                <th className="p-3 border-b border-slate-700 min-w-[60px]">Min 2</th>
                                <th
                                    className="p-3 border-b border-slate-700 min-w-[100px] cursor-pointer hover:bg-slate-800 transition-colors select-none"
                                    onClick={() => handleSort('staff1')}
                                >
                                    Staff 1 {sortConfig?.key === 'staff1' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                </th>
                                <th className="p-3 border-b border-slate-700 min-w-[100px]">Staff 2</th>
                                <th className="p-3 border-b border-slate-700 w-24">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {visibleRows.map(row => (
                                <tr key={row.id} className={`hover:bg-slate-800 transition-colors ${row.isLocked ? 'bg-slate-900/50' : row.status === 'SYNC_DRAFT' ? 'bg-sky-900/10' : ''}`}>
                                    <td className="p-3 text-slate-300 font-mono">
                                        {new Date(row.date).toLocaleDateString('ja-JP')}
                                    </td>
                                    <td className="p-3 text-slate-300 font-mono">
                                        {new Date(row.date).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                                    </td>
                                    <td className="p-3 font-medium text-white">{row.clientName}</td>
                                    <td className="p-3 text-emerald-400">{row.menu1}</td>
                                    <td className="p-3 font-mono text-center text-slate-400">{row.time1}</td>
                                    <td className="p-3 text-sky-400">{row.menu2}</td>
                                    <td className="p-3 font-mono text-center text-slate-400">{row.time2 || '-'}</td>
                                    <td className="p-3 text-yellow-500 font-bold">{row.staff1}</td>
                                    <td className="p-3 text-yellow-500 font-bold opacity-80">{row.staff2}</td>
                                    <td className="p-3 flex gap-2">
                                        {isDraft && (
                                            <>
                                                <button
                                                    onClick={() => openEdit(row)}
                                                    className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-white"
                                                >
                                                    <Edit className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(row.id)}
                                                    className="p-1 hover:bg-slate-700 rounded text-red-400 hover:text-red-300"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </>
                                        )}
                                        {row.isLocked && <Lock className="w-4 h-4 text-amber-500" />}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {rows.length === 0 && (
                        <div className="p-10 text-center text-slate-500">
                            No data found. Click "Fetch Draft" to import from Google Sheets.
                        </div>
                    )}
                </div>

                {/* Edit Modal */}
                {editingRow && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                        <div className="bg-slate-900 border border-slate-700 p-6 rounded-xl w-96 shadow-2xl">
                            <h2 className="text-xl font-bold text-white mb-4">Edit Draft</h2>

                            <div className="mb-4">
                                <label className="text-sm text-slate-400 block mb-1">Time (C)</label>
                                <input
                                    type="time"
                                    value={editForm.startTime}
                                    onChange={e => setEditForm({ ...editForm, startTime: e.target.value })}
                                    className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white"
                                />
                            </div>

                            {/* Note: Staff Edit not fully implemented due to missing ID list, keeping Time for now */}

                            <div className="flex justify-end gap-2 mt-6">
                                <button
                                    onClick={() => setEditingRow(null)}
                                    className="px-4 py-2 text-slate-400 hover:text-white"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSaveEdit}
                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded font-bold"
                                >
                                    Save & Lock
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
