'use client';

import { useState, useTransition } from 'react';
import { copyShiftsFromPreviousMonth } from '@/app/actions/shift';
import { toast } from 'sonner';

export default function CopyShiftButton({ year, month }: { year: number, month: number }) {
    const [isPending, startTransition] = useTransition();

    const handleCopy = () => {
        if (!confirm(`Are you sure you want to copy shifts from the previous month to ${year}/${month}?`)) return;

        startTransition(async () => {
            const res = await copyShiftsFromPreviousMonth(year, month);
            if (res.success) {
                toast.success(res.message);
            } else {
                toast.error(res.message);
            }
        });
    };

    return (
        <button
            onClick={handleCopy}
            disabled={isPending}
            className="p-2 px-3 bg-indigo-700 hover:bg-indigo-600 rounded text-xs text-white transition-colors flex items-center gap-2"
        >
            {isPending ? 'Copying...' : 'Copy Prev Month'}
        </button>
    );
}
