'use client';

import { useState, useEffect, useTransition } from 'react';
import { getImportListData, ImportLayoutRow } from '@/app/actions/import-list';
import { syncBookingsFromGoogleSheets } from '@/app/actions/sync-google';
import { toast } from 'sonner';
import { RefreshCcw } from 'lucide-react';

export default function ImportListPage() {
    const [rows, setRows] = useState<ImportLayoutRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSyncing, startTransition] = useTransition();

    const today = new Date();
    const [year, setYear] = useState(today.getFullYear());
    const [month, setMonth] = useState(today.getMonth() + 1);

    const fetchData = async () => {
        setLoading(true);
        try {
            const data = await getImportListData(year, month);
            setRows(data);
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
        if (!confirm('Warning: This will force re-import ALL bookings for this month from Google Sheets. Continue?')) return;

        startTransition(async () => {
            const toastId = toast.loading('Syncing all data...');
            // Construct date string yyyy-mm-dd for the target month
            const targetDate = `${year}-${month.toString().padStart(2, '0')}-01`;
            const result = await syncBookingsFromGoogleSheets(targetDate);

            if (result.success) {
                toast.success(result.message, { id: toastId });
                fetchData(); // Refresh list after sync
            } else {
                toast.error(result.message, { id: toastId });
            }
        });
    };

    if (loading) return <div className="p-10 text-white">Loading...</div>;

    return (
        <div className="flex flex-col h-full bg-slate-950 text-slate-200 p-6 overflow-hidden">
            <header className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-white mb-1">Imported Booking List</h1>
                    <p className="text-xs text-slate-500">View of database records emulating Google Sheet structure</p>
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex bg-slate-900 rounded border border-slate-700">
                        <button onClick={() => setMonth(m => m === 1 ? 12 : m - 1)} className="px-3 py-1 hover:bg-slate-800">←</button>
                        <span className="px-4 py-1 font-mono font-bold border-x border-slate-700">{year} / {month}</span>
                        <button onClick={() => setMonth(m => m === 12 ? 1 : m + 1)} className="px-3 py-1 hover:bg-slate-800">→</button>
                    </div>

                    <button
                        onClick={handleSync}
                        disabled={isSyncing}
                        className="flex items-center gap-2 px-4 py-2 bg-green-700 hover:bg-green-600 text-white font-bold rounded shadow-lg transition-transform active:scale-95 disabled:opacity-50"
                    >
                        <RefreshCcw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                        {isSyncing ? 'Syncing...' : 'Sync Now'}
                    </button>
                </div>
            </header>

            <div className="flex-1 overflow-auto border border-slate-800 rounded bg-slate-900">
                <table className="w-full text-left border-collapse text-sm">
                    <thead className="bg-slate-950 text-slate-400 sticky top-0 z-10 shadow-sm">
                        <tr>
                            <th className="p-3 border-b border-slate-700 min-w-[100px]">Date (A)</th>
                            <th className="p-3 border-b border-slate-700 min-w-[80px]">Time (C)</th>
                            <th className="p-3 border-b border-slate-700 min-w-[150px]">Name (E)</th>
                            <th className="p-3 border-b border-slate-700 min-w-[200px]">Menu 1 (G)</th>
                            <th className="p-3 border-b border-slate-700 min-w-[60px]">Min 1 (H)</th>
                            <th className="p-3 border-b border-slate-700 min-w-[200px]">Menu 2 (I)</th>
                            <th className="p-3 border-b border-slate-700 min-w-[60px]">Min 2 (J)</th>
                            <th className="p-3 border-b border-slate-700 min-w-[100px]">Staff 1 (K)</th>
                            <th className="p-3 border-b border-slate-700 min-w-[100px]">Staff 2 (L)</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                        {rows.map(row => (
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
