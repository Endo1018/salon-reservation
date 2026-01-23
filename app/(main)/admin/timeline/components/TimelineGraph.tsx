'use client';

import { useState, useEffect } from 'react';
import { TimelineResource, TimelineBooking, deleteBooking } from '@/app/actions/timeline';
import BookingModal from './BookingModal';
import { getStaffColorClass } from '@/lib/staff-color-utils';

type Props = {
    date: string; // YYYY-MM-DD
    resources: TimelineResource[];
    initialBookings: TimelineBooking[];
};

export default function TimelineGraph({ date, resources, initialBookings }: Props) {
    const [bookings, setBookings] = useState(initialBookings);
    const [modal, setModal] = useState<{ open: boolean, time: string, resource: string, editId: string | null }>({
        open: false, time: '10:00', resource: '', editId: null
    });

    useEffect(() => {
        setBookings(initialBookings);
    }, [initialBookings]);

    // Grid Configuration
    const startHour = 10;
    const endHour = 23; // 23:00 close
    const hourWidth = 100; // px
    const totalWidth = (endHour - startHour) * hourWidth;
    const hours = Array.from({ length: endHour - startHour }, (_, i) => i + startHour);

    const handleGridClick = (hour: number, minute: number, resourceId: string) => {
        const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        setModal({ open: true, time: timeStr, resource: resourceId, editId: null });
    };

    const handleBookingClick = (bookingId: string) => {
        // Find booking to get defaults?
        // Actually modal fetches details. We just need ID.
        setModal({ open: true, time: '10:00', resource: '', editId: bookingId });
    };

    const getPosition = (time: Date) => {
        const h = time.getHours();
        const m = time.getMinutes();
        if (h < startHour) return 0;
        return ((h - startHour) * hourWidth) + ((m / 60) * hourWidth);
    };

    const getWidth = (start: Date, end: Date) => {
        const diffMins = (end.getTime() - start.getTime()) / 60000;
        return (diffMins / 60) * hourWidth;
    };



    return (
        <div className="flex-1 flex flex-col overflow-hidden h-full">
            <div className="flex-1 border border-slate-700 rounded-lg bg-slate-900 overflow-auto flex isolate">
                {/* ... Resources Column (unchanged) ... */}

                {/* ... (Keep existing until Booking map) ... */}
                {/* Actually I need to be careful with replace_file_content context. */}
                {/* I'll insert the helper at top and use it in the map loop. */}
                {/* Let's target the bookings map specifically. */}

                {/* Wait, I can't insert helper inside the map easily if I target small block. */}
                {/* I'll add helper before return, and update the map. */}

                {/* 1. Resources Column */}
                <div className="sticky left-0 bg-slate-900 z-20 border-r border-slate-700 w-48 min-w-[12rem] shrink-0">
                    <div className="h-10 border-b border-slate-700 flex items-center px-4 font-bold text-slate-400 text-xs">
                        RESOURCE
                    </div>
                    {/* Groups */}
                    {['HEAD SPA', 'AROMA ROOM', 'MASSAGE SEAT'].map(cat => (
                        <div key={cat}>
                            <div className="bg-slate-800 text-[10px] font-bold text-slate-400 px-2 py-1 uppercase tracking-wider">
                                {cat}
                            </div>
                            {resources.filter(r => r.category === cat).map(r => (
                                <div key={r.id} className="h-12 border-b border-slate-800 flex items-center px-4 text-sm font-medium hover:bg-slate-800/30">
                                    {r.name}
                                </div>
                            ))}
                        </div>
                    ))}
                </div>

                {/* 2. Timeline Grid */}
                <div className="flex-1 relative" style={{ minWidth: totalWidth }}>

                    {/* Header Hours */}
                    <div className="h-10 border-b border-slate-700 bg-slate-900 sticky top-0 z-10 flex">
                        {hours.map(h => (
                            <div key={h} className="shrink-0 border-r border-slate-800 flex items-center justify-center text-xs text-slate-500 font-bold"
                                style={{ width: hourWidth }}>
                                {h}:00
                            </div>
                        ))}
                    </div>

                    {/* Rows */}
                    {['HEAD SPA', 'AROMA ROOM', 'MASSAGE SEAT'].map(cat => (
                        <div key={cat}>
                            <div className="h-6 bg-slate-800/10"></div> {/* Spacer for Category Header */}
                            {resources.filter(r => r.category === cat).map(r => (
                                <div key={r.id} className="h-12 border-b border-slate-800 relative group">
                                    {/* Grid Cells (15 min intervals) */}
                                    {hours.map(h => (
                                        [0, 15, 30, 45].map(m => (
                                            <div key={`${h}-${m}`}
                                                className={`absolute h-full cursor-pointer hover:bg-slate-800/30 ${m === 45 ? 'border-r border-slate-700' : 'border-r border-slate-800/30 border-dashed'}`}
                                                style={{ left: ((h - startHour) * hourWidth) + ((m / 60) * hourWidth), width: hourWidth / 4 }}
                                                onClick={() => handleGridClick(h, m, r.id)}
                                                title={`${h}:${m.toString().padStart(2, '0')}`}
                                            >
                                                {/* Optional: Add hover indicator? */}
                                            </div>
                                        ))
                                    ))}

                                    {/* Bookings */}
                                    {bookings.filter(b => b.resourceId === r.id).map(b => (
                                        <div key={b.id}
                                            className={`absolute top-1 bottom-1 rounded text-white text-xs p-1 overflow-hidden shadow-sm border border-white/20 select-none hover:brightness-110 z-10 group/booking ${getStaffColorClass(b.staffName)} cursor-pointer`}
                                            style={{
                                                left: getPosition(new Date(b.startAt)),
                                                width: getWidth(new Date(b.startAt), new Date(b.endAt))
                                            }}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleBookingClick(b.id);
                                            }}
                                            title={`${b.clientName} (${b.menuName}) w/ ${b.staffName}`}
                                        >
                                            <div className="font-bold truncate text-[10px]">
                                                {new Date(b.startAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })} - {new Date(b.endAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                            <div className="truncate text-[10px]">{b.menuName}</div>
                                            <div className="truncate text-[10px] opacity-90">{b.staffName}</div>
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>
                    ))}

                    {/* Current Time Line (Optional) */}
                </div>
            </div>

            <BookingModal
                isOpen={modal.open}
                onClose={() => {
                    setModal({ ...modal, open: false });
                    // Refresh?
                    // Currently rely on revalidatePath from Actions?
                    // But client needs to refetch?
                    // initialBookings comes from Server Component Props (TimelineDashboard -> TimelineGraph)
                    // So revalidatePath causes page reload? Yes.
                    // But we might need window.location.reload() for immediate feedback if Soft Nav doesn't trigger.
                    window.location.reload(); // Force reload for prototype robustness
                }}
                defaultDate={date}
                defaultTime={modal.time}
                defaultResource={modal.resource}
                editBookingId={modal.editId}
            />
        </div>
    );
}
