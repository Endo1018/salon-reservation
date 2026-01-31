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

import { clearFebruaryData } from '@/app/actions/debug-tools';
import TimelineNav from '../timeline/components/TimelineNav';
import StaffSummarySection from './components/StaffSummarySection';

// ... (types) ...

export default function ImportListPage() {
    // ... (state) ...
    // ... (effects) ...

    const loadData = async () => {
        // ...
    };

    // Actions
    const handleSync = async () => {
        // ...
    };

    // ... (publish, delete actions) ...

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

    // ... (edit actions, sort actions) ...
    // ... (filtering logic) ...

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
                        {/* ... Filters ... */}

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
