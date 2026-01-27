'use client';

import { useTransition } from 'react';
import { syncAttendanceRange } from '@/app/actions/sync-attendance';
import { toast } from 'sonner';
import { RefreshCcw } from 'lucide-react';

export default function RecalcButton({ year, month }: { year: number, month: number }) {
    const [isPending, startTransition] = useTransition();

    const handleRecalc = () => {
        // User requested to remove confirmation
        // if (!confirm(`${year}年${month}月の勤怠データを予約データから再計算しますか？\n(手入力された施術時間は上書きされます)`)) return;

        startTransition(async () => {
            try {
                await syncAttendanceRange(year, month);
                toast.success(`${year}年${month}月の再計算が完了しました`);
            } catch (e) {
                toast.error('エラーが発生しました');
                console.error(e);
            }
        });
    };

    return (
        <button
            onClick={handleRecalc}
            disabled={isPending}
            className="flex items-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-sm transition-colors disabled:opacity-50"
        >
            <RefreshCcw className={`w-4 h-4 ${isPending ? 'animate-spin' : ''}`} />
            {isPending ? '計算中...' : '予約から再計算'}
        </button>
    );
}
