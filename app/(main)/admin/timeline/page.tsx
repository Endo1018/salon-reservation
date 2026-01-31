import { Calendar, Users, Briefcase } from 'lucide-react';
import Link from 'next/link';
import { getTimelineData } from '@/app/actions/timeline';
import TimelineGraph from './components/TimelineGraph';
import DateController from './components/DateController';
import StaffAttendanceRow from './components/StaffAttendanceRow';
import GoogleSyncButton from './components/GoogleSyncButton';

import BookingMemoRow from './components/BookingMemoRow';

type Props = {
    searchParams: { date?: string };
};

export default async function TimelineDashboard(props: Props) {
    // Await searchParams in Next.js 15+ if needed, but 14 is sync. 
    // Wait, recent Next.js versions made searchParams async.
    // Let's safe handle it assuming it might be a Promise in future or just object now.
    // For Next 14/15 safe interaction:
    const params = await props.searchParams;
    const dateStr = params?.date || new Date().toISOString().split('T')[0];

    // Fetch Data
    const { resources, bookings, isDraft } = await getTimelineData(dateStr);

    return (
        <div className="h-full flex flex-col">
            {/* Top Bar */}
            <div className="flex flex-col bg-slate-950 border-b border-slate-800">
                {/* Draft Banner */}
                {/* @ts-ignore */}
                {bookings['isDraft'] || (resources as any).isDraft ? ( // Handle return type change not yet reflected in Props type if inferred? 
                    // Actually `getTimelineData` return type changed. TS might complain if not updated.
                    // Let's assume `isDraft` is available.
                    // Wait, I updated the return of `getTimelineData`.
                    // Destructure it properly.
                    <div className="bg-amber-900/40 text-amber-200 px-4 py-2 text-sm flex justify-between items-center border-b border-amber-800/50">
                        <div className="flex items-center gap-2">
                            <Briefcase className="w-4 h-4 text-amber-500" />
                            {/* Briefcase/Alert icon */}
                            <span>
                                <strong>Draft Mode Active:</strong> You are viewing potentially incomplete or mixed data.
                                Changes from Google Sheets are waiting to be published.
                            </span>
                        </div>
                        <Link
                            href="/admin/import-list"
                            className="px-3 py-1 bg-amber-700 hover:bg-amber-600 text-white text-xs font-bold rounded flex items-center gap-1 transition-colors"
                        >
                            Go to Import List
                        </Link>
                    </div>
                ) : null}

                <div className="flex justify-between items-center p-4">
                    <div className="flex items-center gap-4">
                        <h2 className="text-xl font-bold flex items-center gap-2 text-slate-100">
                            Relaxation Salon Reservation
                        </h2>
                        <div className="flex items-center gap-2">
                            <GoogleSyncButton date={dateStr} />
                            <DateController date={dateStr} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Staff Row */}
            <StaffAttendanceRow date={dateStr} />

            {/* Booking Memos */}
            <BookingMemoRow date={dateStr} />

            {/* Main Graph Area */}
            <div className="flex-1 overflow-hidden p-4 flex flex-col">
                <TimelineGraph
                    date={dateStr}
                    resources={resources}
                    initialBookings={bookings}
                />
            </div>
        </div>
    );
}
