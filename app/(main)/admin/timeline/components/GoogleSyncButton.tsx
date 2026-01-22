'use client';

import { useTransition } from 'react';
import { RefreshCcw } from 'lucide-react';
import { syncBookingsFromGoogleSheets } from '@/app/actions/sync-google';

export default function GoogleSyncButton({ date }: { date: string }) {
    const [isPending, startTransition] = useTransition();

    const handleSync = () => {
        if (!confirm('Sync latest bookings from Google Sheets? (This will overwrite changes)')) return;

        startTransition(async () => {
            const result = await syncBookingsFromGoogleSheets(date);
            if (result.success) {
                alert(result.message);
            } else {
                alert(`Error: ${result.message}`);
            }
        });
    };

    return (
        <button
            onClick={handleSync}
            disabled={isPending}
            className="flex items-center gap-2 px-3 py-1.5 bg-green-700 hover:bg-green-600 text-white rounded text-sm disabled:opacity-50"
            title="Sync from Google Sheets"
        >
            <RefreshCcw className={`w-4 h-4 ${isPending ? 'animate-spin' : ''}`} />
            {isPending ? 'Syncing...' : 'G-Sheet Sync'}
        </button>
    );
}
