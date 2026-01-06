'use client';

import { useReservationStore } from '@/store/reservationStore';
import { Trash2 } from 'lucide-react';

export function ClearAllButton() {
    const clearAll = useReservationStore(state => state.clearAllReservations);

    const handleClear = () => {
        if (confirm("全ての予約を削除してもよろしいですか？この操作は取り消せません。")) {
            clearAll();
        }
    };

    return (
        <button
            onClick={handleClear}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-md transition-colors border border-red-200 shadow-sm"
        >
            <Trash2 className="w-4 h-4" />
            <span>全削除</span>
        </button>
    );
}
