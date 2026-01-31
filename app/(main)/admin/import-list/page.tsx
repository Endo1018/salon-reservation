'use client';

import { useState, useEffect, useMemo } from 'react';
// Force Redeploy
import { getImportListData, ImportLayoutRow } from '@/app/actions/import-list';
import { syncBookingsFromGoogleSheets } from '@/app/actions/sync-google';
import { publishDrafts } from '@/app/actions/publish-draft';
import { updateDraft } from '@/app/actions/update-draft';
import { deleteDraft } from '@/app/actions/delete-draft';
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
    const [isSyncing, setIsSyncing] = useState(false);
    const [isPublishing, setIsPublishing] = useState(false);

    // UI State
    const [filterStaff, setFilterStaff] = useState('');
    const [filterDate, setFilterDate] = useState('');
    const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'date', direction: 'asc' });

    // Edit Modal State
    const [editingRow, setEditingRow] = useState<ImportLayoutRow | null>(null);
    const [editForm, setEditForm] = useState({ startTime: '' });

    // Load Data Effect
    useEffect(() => {
        loadData();
    }, [year, month]);

    const loadData = async () => {
        try {
            const data = await getImportListData(year, month);
            // Convert strings/dates safely if needed, though Server Actions sanitize
            setRows(data.rows);
            setIsDraft(data.isDraft);
        } catch (e) {
            console.error("Failed to load import list:", e);
            toast.error("Failed to load data.");
        }
    };

    // Actions
    const handleSync = async () => {
        if (confirm('Google Sheetsから同期しますか？\n(現在のドラフトは上書きされます)')) {
            setIsSyncing(true);
            try {
                const result = await syncBookingsFromGoogleSheets(year, month);
                toast.success(result.message);
                await loadData();
            } catch (e) {
                console.error(e);
                toast.error("Sync failed");
            } finally {
                setIsSyncing(false);
            }
        }
    };

    const handlePublish = async () => {
        if (confirm('ドラフトを公開しますか？\n(Timelineに反映され、現在のLiveデータは置き換えられます)')) {
            setIsPublishing(true);
            try {
                await publishDrafts(year, month);
                toast.success("Published successfully!");
                await loadData();
            } catch (e) {
                console.error(e);
                toast.error("Publish failed");
            } finally {
                setIsPublishing(false);
            }
        }
    };

    const handleDelete = async (id: string) => {
        if (confirm('このドラフトを削除しますか？')) {
            try {
                await deleteDraft(id);
                toast.success("Deleted draft");
                await loadData();
            } catch (e) {
                toast.error("Delete failed");
            }
        }
    };

    const openEdit = (row: ImportLayoutRow) => {
        // extract time HH:mm from date or use dummy
        const timeStr = row.date instanceof Date
            ? row.date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
            : '00:00';
        setEditForm({ startTime: timeStr });
        setEditingRow(row);
    };

    const handleSaveEdit = async () => {
        if (!editingRow) return;
        try {
            await updateDraft(editingRow.id, {
                startTime: editForm.startTime,
                // Add validation or other fields?
            });
            toast.success("Draft updated (Reserved/Locked)");
            setEditingRow(null);
            await loadData();
        } catch (e) {
            console.error(e);
            toast.error("Update failed");
        }
    };

    const handleSort = (key: keyof ImportLayoutRow) => {
        setSortConfig(current => ({
            key,
            direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    // Filtering & Sorting
    const uniqueStaff = useMemo(() => {
        const staffSet = new Set<string>();
        rows.forEach(r => {
            if (r.staff1) staffSet.add(r.staff1);
            if (r.staff2) staffSet.add(r.staff2);
        });
        return Array.from(staffSet).sort();
    }, [rows]);

    const visibleRows = useMemo(() => {
        let result = [...rows];

        // Filter
        if (filterStaff) {
            result = result.filter(r => r.staff1 === filterStaff || r.staff2 === filterStaff);
        }
        if (filterDate) {
            const dateStr = new Date(filterDate).toDateString();
            result = result.filter(r => new Date(r.date).toDateString() === dateStr);
        }

        // Sort
        if (sortConfig.key) {
            result.sort((a, b) => {
                const valA = a[sortConfig.key as keyof ImportLayoutRow];
                const valB = b[sortConfig.key as keyof ImportLayoutRow];

                if (valA === valB) return 0;

                // Date handling
                if (valA instanceof Date && valB instanceof Date) {
                    return sortConfig.direction === 'asc'
                        ? valA.getTime() - valB.getTime()
                        : valB.getTime() - valA.getTime();
                }

                if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
                return sortConfig.direction === 'asc' ? 1 : -1;
            });
        }

        return result;
    }, [rows, filterStaff, filterDate, sortConfig]);

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
                    </div>

                    {/* Filter Bar */}
                    <div className="flex flex-wrap gap-4 bg-slate-800 p-4 rounded-xl border border-slate-700 items-end">
                        {/* Staff Filter */}
                        <div className="flex flex-col">
                            <label className="text-xs text-slate-500 mb-1">スタッフ</label>
                            <select
                                value={filterStaff}
                                onChange={(e) => setFilterStaff(e.target.value)}
                                className="bg-slate-900 border border-slate-600 rounded p-2 text-sm text-white min-w-[150px]"
                            >
                                <option value="">全員 (All)</option>
                                {uniqueStaff.map((s) => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </select>
                        </div>

                        {/* Month Picker */}
                        <div className="flex flex-col">
                            <label className="text-xs text-slate-500 mb-1">月 (Month)</label>
                            <input
                                type="month"
                                value={`${year}-${month.toString().padStart(2, '0')}`}
                                onChange={(e) => {
                                    if (e.target.value) {
                                        const [y, m] = e.target.value.split('-').map(v => Number(v));
                                        setYear(y);
                                        setMonth(m);
                                        setFilterDate(''); // Clear date filter
                                    }
                                }}
                                className="bg-slate-900 border border-slate-600 rounded p-2 text-sm text-white"
                            />
                        </div>

                        {/* Date Picker */}
                        <div className="flex flex-col">
                            <label className="text-xs text-slate-500 mb-1">日付指定</label>
                            <input
                                type="date"
                                value={filterDate}
                                onChange={(e) => {
                                    setFilterDate(e.target.value);
                                    if (e.target.value) {
                                        const d = new Date(e.target.value);
                                        if (!isNaN(d.getTime())) {
                                            setYear(d.getFullYear());
                                            setMonth(d.getMonth() + 1);
                                        }
                                    }
                                }}
                                className="bg-slate-900 border border-slate-600 rounded p-2 text-sm text-white"
                            />
                        </div>

                        {/* Clear Button */}
                        {(filterStaff || filterDate) && (
                            <button
                                onClick={() => { setFilterStaff(''); setFilterDate(''); }}
                                className="mb-2 text-xs text-slate-400 hover:text-white underline"
                            >
                                フィルター解除
                            </button>
                        )}

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

                        {/* Publish Button (Only if Draft) */}
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

                    {/* Draft Banner */}
                    {isDraft && (
                        <div className="w-full bg-amber-900/50 border border-amber-700 text-amber-200 px-4 py-2 rounded flex items-center gap-2 text-sm">
                            <AlertTriangle className="w-4 h-4 text-amber-500" />
                            <span>PREVIEW MODE: You are viewing DRAFT data. This has NOT been applied to the Timeline yet. Click "Publish" to go live.</span>
                        </div>
                    )}
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
                                    Date (A) {sortConfig?.key === 'date' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                </th>
                                <th className="p-3 border-b border-slate-700 min-w-[80px]">Time (C)</th>
                                <th className="p-3 border-b border-slate-700 min-w-[150px]">Name (E)</th>
                                <th className="p-3 border-b border-slate-700 min-w-[200px]">Menu 1 (G)</th>
                                <th className="p-3 border-b border-slate-700 min-w-[60px]">Min 1 (H)</th>
                                <th className="p-3 border-b border-slate-700 min-w-[200px]">Menu 2 (I)</th>
                                <th className="p-3 border-b border-slate-700 min-w-[60px]">Min 2 (J)</th>
                                <th
                                    className="p-3 border-b border-slate-700 min-w-[100px] cursor-pointer hover:bg-slate-800 transition-colors select-none"
                                    onClick={() => handleSort('staff1')}
                                >
                                    Staff 1 (K) {sortConfig?.key === 'staff1' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                </th>
                                <th className="p-3 border-b border-slate-700 min-w-[100px]">Staff 2 (L)</th>
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
