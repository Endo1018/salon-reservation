'use client';

import { importAttendanceFromExcel } from '@/app/actions/import-excel';
import { useState, useRef } from 'react';

export default function ImportButton() {
    const [status, setStatus] = useState<'idle' | 'confirming' | 'loading' | 'success' | 'error'>('idle');
    const [message, setMessage] = useState('');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleSelectClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setSelectedFile(file);
            setStatus('confirming');
        }
        e.target.value = '';
    };

    const handleUpload = async () => {
        if (!selectedFile) return;

        setStatus('loading');

        try {
            const formData = new FormData();
            formData.append('file', selectedFile);

            const result = await importAttendanceFromExcel(formData);

            if (result.success) {
                setMessage(result.message);
                setStatus('success');
                // Reset after 3 seconds
                setTimeout(() => {
                    setStatus('idle');
                    setSelectedFile(null);
                    setMessage('');
                }, 3000);
            } else {
                setMessage(result.message);
                setStatus('error');
            }
        } catch (err) {
            console.error(err);
            setMessage('Unexpected Error');
            setStatus('error');
        }
    };

    const handleCancel = () => {
        setSelectedFile(null);
        setStatus('idle');
        setMessage('');
    };

    // Compact Confirmation UI
    if (status === 'confirming' && selectedFile) {
        return (
            <div className="flex items-center gap-2 bg-slate-800 p-1 rounded-lg border border-slate-600 animate-in fade-in slide-in-from-right-2">
                <div className="flex flex-col px-2">
                    <span className="text-xs text-white truncate max-w-[120px] font-bold">{selectedFile.name}</span>
                    <span className="text-[10px] text-yellow-400 leading-tight">確認:上書き(Overwrite)</span>
                </div>
                <div className="flex gap-1">
                    <button
                        onClick={handleCancel}
                        className="p-1 px-2 text-xs text-slate-300 hover:text-white bg-slate-700 hover:bg-slate-600 rounded transition-colors"
                    >
                        ✕
                    </button>
                    <button
                        onClick={handleUpload}
                        className="p-1 px-3 text-xs font-bold text-white bg-red-600 hover:bg-red-500 rounded shadow-sm transition-colors"
                    >
                        実行
                    </button>
                </div>
            </div>
        );
    }

    // Loading State
    if (status === 'loading') {
        return (
            <div className="flex items-center gap-2 bg-slate-800 px-3 py-2 rounded-lg border border-slate-600">
                <div className="animate-spin h-4 w-4 border-2 border-green-500 border-t-transparent rounded-full"></div>
                <span className="text-xs text-slate-200 font-bold">処理中 (Processing)...</span>
            </div>
        );
    }

    // Success State
    if (status === 'success') {
        return (
            <div className="flex items-center gap-2 bg-green-900/50 px-3 py-2 rounded-lg border border-green-700 animate-in zoom-in">
                <span className="text-green-400 font-bold text-sm">✓ 完了 (Done)</span>
                <span className="text-xs text-green-200">更新しました</span>
            </div>
        );
    }

    // Error State (Click to dismiss)
    if (status === 'error') {
        return (
            <button onClick={handleCancel} className="flex items-center gap-2 bg-red-900/50 px-3 py-2 rounded-lg border border-red-700 animate-in zoom-in hover:bg-red-900/70 transition-colors text-left">
                <span className="text-red-400 font-bold text-sm">✕ エラー</span>
                <span className="text-xs text-red-200 truncate max-w-[200px]">{message}</span>
            </button>
        );
    }

    // Default: Import Button
    return (
        <div className="flex items-center">
            <input
                type="file"
                accept=".xlsx, .xls"
                onChange={handleFileChange}
                ref={fileInputRef}
                className="hidden"
            />
            <button
                type="button"
                onClick={handleSelectClick}
                className="bg-green-600 hover:bg-green-500 text-white font-bold py-2 px-4 rounded transition-colors shadow-sm flex items-center gap-2"
            >
                <span className="text-sm">POSデータ取込</span>
            </button>
        </div>
    );
}
