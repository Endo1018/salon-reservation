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
    const { resources, bookings } = await getTimelineData(dateStr);

    return (
        <div className="h-full flex flex-col">
            {/* Top Bar */}
            <div className="flex justify-between items-center p-4 border-b border-slate-800 bg-slate-950">
                <div className="flex items-center gap-4">
                    <h2 className="text-xl font-bold flex items-center gap-2 text-slate-100">
                        Relaxation Salon Reservation
                    </h2>
                    <div className="flex items-center gap-2">
                        <Link href="/admin/import-list" className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-sm rounded border border-slate-700 transition-colors">
                            📊 Import List
                        </Link>
                        <GoogleSyncButton date={dateStr} />
                        <DateController date={dateStr} />
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
