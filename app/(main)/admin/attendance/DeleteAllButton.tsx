'use client';

import { deleteAllAttendance } from '@/app/actions/attendance';
import { useState } from 'react';

export default function DeleteAllButton({ year, month }: { year?: number; month?: number }) {
    const [status, setStatus] = useState<'idle' | 'confirming' | 'deleting' | 'success'>('idle');

    const handleDeleteClick = () => {
        setStatus('confirming');
    };

    const handleExecute = async () => {
        setStatus('deleting');
        try {
            await deleteAllAttendance(year, month);
            setStatus('success');
            setTimeout(() => setStatus('idle'), 3000);
        } catch (e) {
            console.error(e);
            alert('削除に失敗しました (Failed to delete)');
            setStatus('idle');
        }
    };

    const handleCancel = () => {
        setStatus('idle');
    };

    if (status === 'confirming') {
        return (
            <div className="flex items-center gap-2 bg-slate-800 p-1 rounded-lg border border-slate-600 animate-in fade-in slide-in-from-right-2 ml-2">
                <div className="flex flex-col px-2">
                    <span className="text-xs text-white font-bold">全削除しますか？</span>
                    <span className="text-[10px] text-red-400 leading-tight">復元不可 (No Undo)</span>
                </div>
                <div className="flex gap-1">
                    <button
                        onClick={handleCancel}
                        className="p-1 px-2 text-xs text-slate-300 hover:text-white bg-slate-700 hover:bg-slate-600 rounded transition-colors"
                    >
                        ✕
                    </button>
                    <button
                        onClick={handleExecute}
                        className="p-1 px-3 text-xs font-bold text-white bg-red-600 hover:bg-red-500 rounded shadow-sm transition-colors"
                    >
                        実行
                    </button>
                </div>
            </div>
        );
    }

    if (status === 'deleting') {
        return (
            <div className="flex items-center gap-2 bg-slate-800 px-3 py-2 rounded-lg border border-slate-600 ml-2">
                <div className="animate-spin h-4 w-4 border-2 border-red-500 border-t-transparent rounded-full"></div>
                <span className="text-xs text-slate-200 font-bold">削除中...</span>
            </div>
        );
    }

    if (status === 'success') {
        return (
            <div className="flex items-center gap-2 bg-slate-800 px-3 py-2 rounded-lg border border-slate-600 animate-in zoom-in ml-2">
                <span className="text-slate-200 font-bold text-sm">削除完了</span>
            </div>
        );
    }

    return (
        <button
            onClick={handleDeleteClick}
            className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded shadow transition-colors flex items-center gap-2"
        >
            <span className="text-sm">全データを削除</span>
        </button>
    );
}
