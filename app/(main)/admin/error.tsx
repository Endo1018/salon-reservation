'use client';

import { useEffect } from 'react';

export default function AdminError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error('[Admin Error]', error);
    }, [error]);

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
            <div className="bg-slate-900 border border-red-500/30 rounded-xl p-8 max-w-md w-full text-center space-y-4">
                <p className="text-red-400 text-sm font-bold uppercase tracking-wider">Server Error</p>
                <p className="text-slate-300 text-sm">
                    データの読み込みに失敗しました。DB接続を確認してください。
                </p>
                {error.digest && (
                    <p className="text-slate-600 text-xs font-mono">Digest: {error.digest}</p>
                )}
                <button
                    onClick={reset}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-sm transition-colors"
                >
                    再試行
                </button>
            </div>
        </div>
    );
}
