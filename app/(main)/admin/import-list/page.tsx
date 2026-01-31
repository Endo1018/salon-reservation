'use client';

import { useState, useEffect, useTransition } from 'react';
import { getImportListData, ImportLayoutRow } from '@/app/actions/import-list';
import { syncBookingsFromGoogleSheets } from '@/app/actions/sync-google';
import { publishDrafts } from '@/app/actions/publish-draft';
import { toast } from 'sonner';
import { RefreshCcw, Check, AlertTriangle } from 'lucide-react'; // Add Icons

export default function ImportListPage() {
    const [rows, setRows] = useState<ImportLayoutRow[]>([]);
    const [isDraft, setIsDraft] = useState(false);
    const [loading, setLoading] = useState(true);
    const [isSyncing, startTransition] = useTransition();
    const [isPublishing, startPublish] = useTransition();

    const today = new Date();
    const [year, setYear] = useState(today.getFullYear());
    const [month, setMonth] = useState(today.getMonth() + 1);

    // Filters
    const [filterStaff, setFilterStaff] = useState('');
    const [filterDate, setFilterDate] = useState('');

    // Derived Staff List
    const uniqueStaff = Array.from(new Set(rows.flatMap(r => [r.staff1, r.staff2]).filter(Boolean))).sort();

    const [sortConfig, setSortConfig] = useState<{ key: 'date' | 'staff1', direction: 'asc' | 'desc' } | null>(null);

    const getFilteredAndSortedRows = () => {
        let result = [...rows];

        // 1. Filter
        if (filterDate) {
            // If specific date is selected, filter by it (ignore month scope if date is outside? No, rows are loaded by month).
            // Actually, if user picks a date, we probably just filter the CURRENT loaded rows. 
            // If they pick a date outside current month, they expect to see nothing or should load that month?
            // "Attendance" page reloads data. Here we are client-side on loaded month.
            // Let's assume Date Picker is helpful for finding a day within the loaded month.
            // OR: If we want to support crossing months, we'd need to fetch. 
            // For now, client-side filter within loaded month is safest for this "Import List" context.
            const target = new Date(filterDate).toDateString();
            result = result.filter(r => r.date.toDateString() === target);
        }

        if (filterStaff) {
            const lower = filterStaff.toLowerCase();
            result = result.filter(r =>
                r.staff1.toLowerCase() === lower || r.staff2.toLowerCase() === lower
            );
        }

        // 2. Sort
        if (sortConfig) {
            result.sort((a, b) => {
                if (sortConfig.key === 'date') {
                    const dateA = a.date.getTime();
                    const dateB = b.date.getTime();
                    return sortConfig.direction === 'asc' ? dateA - dateB : dateB - dateA;
                } else if (sortConfig.key === 'staff1') {
                    const nameA = a.staff1.toLowerCase();
                    const nameB = b.staff1.toLowerCase();
                    if (nameA < nameB) return sortConfig.direction === 'asc' ? -1 : 1;
                    if (nameA > nameB) return sortConfig.direction === 'asc' ? 1 : -1;
                    return 0;
                }
                return 0;
            });
        }
        return result;
    };

    const handleSort = (key: 'date' | 'staff1') => {
        setSortConfig(current => {
            if (current?.key === key) {
                return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
            }
            return { key, direction: 'asc' };
        });
    };

    const visibleRows = getFilteredAndSortedRows();


    const fetchData = async () => {
        setLoading(true);
        try {
            const data = await getImportListData(year, month);
            setRows(data.rows);
            setIsDraft(data.isDraft);
        } catch (error) {
            console.error(error);
            toast.error("Failed to load list");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [year, month]);

    const handleSync = () => {
        if (!confirm('This will fetch latest data from Google Sheets as a DRAFT. \nLive timeline will NOT be updated until you click "Publish". \nContinue?')) return;

        startTransition(async () => {
            const toastId = toast.loading('Syncing all data...');
            // Construct date string yyyy-mm-dd for the target month
            const targetDate = `${year}-${month.toString().padStart(2, '0')}-01`;
            const result = await syncBookingsFromGoogleSheets(targetDate);

            if (result.success) {
                toast.success(result.message, { id: toastId });
                fetchData(); // Refresh list to show drafts
            } else {
                toast.error(result.message, { id: toastId });
            }
        });
    };

    const handlePublish = () => {
        if (!confirm('Are you sure you want to PUBLISH these changes to the live Timeline? \nThis will replace the current data.')) return;

        startPublish(async () => {
            const toastId = toast.loading('Publishing...');
            const result = await publishDrafts(year, month);
            if (result.success) {
                toast.success(result.message, { id: toastId });
                fetchData(); // Refresh to show Live state
            } else {
                toast.error(result.message, { id: toastId });
            }
        });
    };

    if (loading) return <div className="p-10 text-white">Loading...</div>;

    return (
        <div className="flex flex-col h-full bg-slate-950 text-slate-200 p-6 overflow-hidden">
            <header className="flex flex-col gap-4 mb-6">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold text-white mb-1">Imported Booking List</h1>
                        <p className="text-xs text-slate-500">View of database records emulating Google Sheet structure</p>
                    </div>
                </div>

                {/* Filter Bar (Like Attendance) */}
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
                                    const [y, m] = e.target.value.split('-').map(Number);
                                    setYear(y);
                                    setMonth(m);
                                    setFilterDate(''); // Clear date filter when changing month
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
                                // Optional: If date is picked, maybe jump to that month?
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
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                        {visibleRows.map(row => (
                            <tr key={row.id} className="hover:bg-slate-800 transition-colors">
                                <td className="p-3 text-slate-300 font-mono">
                                    {row.date.toLocaleDateString('ja-JP')}
                                </td>
                                <td className="p-3 text-slate-300 font-mono">
                                    {row.date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                                </td>
                                <td className="p-3 font-medium text-white">{row.clientName}</td>
                                <td className="p-3 text-emerald-400">{row.menu1}</td>
                                <td className="p-3 font-mono text-center text-slate-400">{row.time1}</td>
                                <td className="p-3 text-sky-400">{row.menu2}</td>
                                <td className="p-3 font-mono text-center text-slate-400">{row.time2 || '-'}</td>
                                <td className="p-3 text-yellow-500 font-bold">{row.staff1}</td>
                                <td className="p-3 text-yellow-500 font-bold opacity-80">{row.staff2}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {rows.length === 0 && (
                    <div className="p-10 text-center text-slate-500">
                        No data found. Click "Sync Now" to import from Google Sheets.
                    </div>
                )}
            </div>
        </div>
    );
}
