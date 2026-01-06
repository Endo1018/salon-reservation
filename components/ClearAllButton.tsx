'use client';

import { useReservationStore } from '@/store/reservationStore';
import { Trash2 } from 'lucide-react';
import { format } from 'date-fns';

export function ClearAllButton() {
    const clearReservationsForDate = useReservationStore(state => state.clearReservationsForDate);
    const selectedDate = useReservationStore(state => state.selectedDate);

    const handleClear = () => {
        const dateStr = format(selectedDate, 'yyyy-MM-dd');
        if (confirm(`${dateStr} の予約を全て削除してもよろしいですか？\nこの操作は取り消せません。`)) {
            clearReservationsForDate(selectedDate);
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
