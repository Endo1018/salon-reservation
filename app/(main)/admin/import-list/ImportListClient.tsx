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
import BookingModal from '../timeline/components/BookingModal'; // Import BookingModal
import ConfirmDialog from '@/app/components/ConfirmDialog'; // Import ConfirmDialog
import { deleteBooking } from '@/app/actions/timeline'; // Reuse timeline delete logic
import { format } from 'date-fns'; // It's formatted as "HH:mm"



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
    const [debugInfo, setDebugInfo] = useState('');

    // Filtering & Sorting
    const [staffFilter, setStaffFilter] = useState('ALL');
    const [dateFilterMode, setDateFilterMode] = useState<'ALL' | 'SPECIFIC'>('ALL');
    const [specificDate, setSpecificDate] = useState(''); // YYYY-MM-DD
    const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'date', direction: 'asc' });

    // Editing State (using BookingModal)
    const [editBookingId, setEditBookingId] = useState<string | null>(null);
    const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
    const [modalDefaults, setModalDefaults] = useState({ date: '', time: '', resource: '' });

    useEffect(() => {
        loadData();
    }, [year, month]);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const data = await getImportListData(year, month);
            setRows(data.rows);
            setIsDraft(data.isDraft);
            // @ts-ignore
            setDebugInfo(data.debug || '');
        } catch (e) {
            console.error(e);
            toast.error('Failed to load data');
        } finally {
            setIsLoading(false);
        }
    };

    // State for Confirm Dialog
    const [confirmState, setConfirmState] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
        isDestructive?: boolean;
    }>({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => { },
        isDestructive: false
    });

    const openConfirm = (title: string, message: string, onConfirm: () => void, isDestructive = false) => {
        setConfirmState({
            isOpen: true,
            title,
            message,
            onConfirm,
            isDestructive
        });
    };

    const closeConfirm = () => {
        setConfirmState(prev => ({ ...prev, isOpen: false }));
    };

    // Actions
    const handleSync = () => {
        openConfirm(
            'Sync from Google Sheets',
            'Google Sheetsからデータを同期しますか？\n(現在のドラフトは上書きされます)',
            async () => {
                closeConfirm();
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
            }
        );
    };

    const handlePublish = () => {
        openConfirm(
            'Publish to Timeline',
            'ドラフトを本番(Timeline)に反映しますか？\n(既存の予約は上書きされます)',
            async () => {
                closeConfirm();
                setIsPublishing(true);
                const res = await publishDrafts(year, month);
                setIsPublishing(false);

                if (res.success) {
                    toast.success(res.message);
                    loadData();
                } else {
                    toast.error(res.message);
                }
            }
        );
    };

    const handleDelete = (id: string) => {
        openConfirm(
            'Delete Record',
            'この予約を削除しますか？\n(本番データも削除されます)',
            async () => {
                closeConfirm();
                try {
                    await deleteBooking(id); // Use timeline delete action
                    toast.success('Deleted');
                    loadData();
                } catch (e) {
                    toast.error('Deletion failed');
                    console.error(e);
                }
            },
            true
        );
    };

    const handleClearFeb = () => {
        openConfirm(
            'Clear Data',
            '2026年2月の全データを強制削除しますか？\n(ドラフト・確定予約すべて削除されます)',
            async () => {
                closeConfirm();
                const res = await clearFebruaryData();
                if (res.success) {
                    toast.success(`Deleted ${res.count} records.`);
                    await loadData();
                } else {
                    toast.error(`Failed: ${res.error}`);
                }
            },
            true
        );
    };

    // Edit Logic
    const openEdit = (row: ImportLayoutRow) => {
        // Prepare defaults (though modal loads most from DB)
        const d = new Date(row.date);
        // Correct to Local for display if needed, but BookingModal expects YYYY-MM-DD
        // Assuming row.date is usable.
        // Actually BookingModal expects "YYYY-MM-DD" string.
        // row.date is Date object in Client?
        // getImportListData returns Date object.
        // Local Timezone adjustment:
        const vnTime = new Date(d.getTime() + 7 * 60 * 60 * 1000); // Shift for display
        const dateStr = vnTime.toISOString().split('T')[0];
        const timeStr = vnTime.toISOString().split('T')[1].substr(0, 5);

        setEditBookingId(row.id);
        setModalDefaults({
            date: dateStr,
            time: timeStr,
            resource: 'seat-1' // Dummy, edit mode loads actual
        });
        setIsBookingModalOpen(true);
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
        // Date Filter
        if (specificDate) {
            filtered = filtered.filter(row => {
                const d = new Date(row.date);
                // Compare YYYY-MM-DD (UTC to Local assumed or simple string match)
                // row.date is ISO string from DB (UTC). specificDate is YYYY-MM-DD (Local).
                // Let's use simple string match on the T part if row.date is YYYY-MM-DD...
                // Actually row.date is Date object or string?
                // row.date comes from `getImportListData`.
                // It's likely ISO string.
                // We want to match the "Day" in the current view context.
                const rowDate = new Date(row.date);
                // Adjustment: User sees +7h (VN) in table?
                // Step 1144 line 127: const hh = d.getUTCHours() + 7;
                // If the table displays VN time, we should filter by VN date.
                const vnDate = new Date(rowDate.getTime() + 7 * 60 * 60 * 1000);
                const dateStr = vnDate.toISOString().split('T')[0];
                return dateStr === specificDate;
            });
        }

        // Sort
        if (sortConfig.key && String(sortConfig.key) !== '') {
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

                        {/* Month Filter */}
                        <div>
                            <label className="text-xs text-slate-500 mb-1 block">月 (Month)</label>
                            <select
                                value={`${year}-${String(month).padStart(2, '0')}`}
                                onChange={e => {
                                    const [y, m] = e.target.value.split('-').map(Number);
                                    setYear(y);
                                    setMonth(m);
                                }}
                                className="bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-sm"
                            >
                                <option value="2026-01">2026年01月</option>
                                <option value="2026-02">2026年02月</option>
                                <option value="2026-03">2026年03月</option>
                            </select>
                        </div>

                        {/* Date Filter */}
                        <div>
                            <label className="text-xs text-slate-500 mb-1 block">日付指定</label>
                            <input
                                type="date"
                                value={specificDate}
                                onChange={e => setSpecificDate(e.target.value)}
                                className="bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-sm"
                            />
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

                        {/* Publish Button - Show when there are SYNC_DRAFT rows */}
                        {rows.some(r => r.status === 'SYNC_DRAFT') && (
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
                        {rows.some(r => r.status === 'SYNC_DRAFT') && (
                            <div className="flex-1 bg-amber-900/50 border border-amber-700 text-amber-200 px-4 py-2 rounded flex items-center gap-2 text-sm">
                                <AlertTriangle className="w-4 h-4 text-amber-500" />
                                <span>PREVIEW MODE: You are viewing DRAFT data. This has NOT been applied &quot;Draft&quot; bookings are only visible to Admin. &quot;Publish&quot; to make them live.</span>
                            </div>
                        )}
                        {!rows.some(r => r.status === 'SYNC_DRAFT') && <div className="flex-1"></div>}
                        <button onClick={handleClearFeb} className="px-3 py-1 bg-red-900/50 hover:bg-red-800 text-red-200 text-xs rounded border border-red-800 whitespace-nowrap">
                            ⚠️ Clear Feb 2026
                        </button>
                    </div>
                </header>

                {/* Summary Section */}
                <StaffSummarySection year={year} month={month} staffFilter={staffFilter} />

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
                                        <button
                                            onClick={() => openEdit(row)}
                                            className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-white"
                                            title="Edit"
                                        >
                                            <Edit className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(row.id)}
                                            className="p-1 hover:bg-slate-700 rounded text-red-400 hover:text-red-300"
                                            title="Delete"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                        {row.isLocked && <Lock className="w-4 h-4 text-amber-500" />}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {rows.length === 0 && (
                        <div className="flex flex-col items-center justify-center p-12 text-slate-500 border border-slate-800 rounded-lg bg-slate-900/50">
                            <p className="mb-2">No data found. Click "Fetch Draft" to import from Google Sheets.</p>
                            {/* @ts-ignore */}
                            {rows.length === 0 && <p className="text-xs font-mono text-slate-600 mt-4">{debugInfo}</p>}
                        </div>
                    )}
                </div>

                {/* Booking Modal (Full Edit) */}
                <BookingModal
                    isOpen={isBookingModalOpen}
                    onClose={() => {
                        setIsBookingModalOpen(false);
                        loadData(); // Reload after close to catch updates
                    }}
                    defaultDate={modalDefaults.date}
                    defaultTime={modalDefaults.time}
                    defaultResource={modalDefaults.resource}
                    editBookingId={editBookingId}
                />

                {/* Confirm Dialog */}
                <ConfirmDialog
                    isOpen={confirmState.isOpen}
                    onClose={closeConfirm}
                    onConfirm={confirmState.onConfirm}
                    title={confirmState.title}
                    message={confirmState.message}
                    isDestructive={confirmState.isDestructive}
                />
            </div>
        </div>
    );
}
