'use client';

import React, { useMemo } from 'react';
import { RESOURCES, Resource } from '@/app/(main)/admin/booking/types';
import { STAFF_COLORS } from '@/app/(main)/admin/booking/lib/constants';
import { useReservationStore } from '@/app/(main)/admin/booking/store/reservationStore';
import { useMetaStore } from '@/app/(main)/admin/booking/store/metaStore';
import { cn, isOverlapping, getStaffColor } from '@/app/(main)/admin/booking/lib/utils';
import { format, addMinutes, parseISO, startOfDay, addHours } from 'date-fns';
import { BookingDialog } from './BookingDialog';
import { EditReservationDialog } from './EditReservationDialog';

const START_HOUR = 10;
const END_HOUR = 24;
const TOTAL_HOURS = END_HOUR - START_HOUR;
const SLOT_DURATION_MIN = 15;
const SLOTS_PER_HOUR = 60 / SLOT_DURATION_MIN; // 4
const TOTAL_SLOTS = TOTAL_HOURS * SLOTS_PER_HOUR;

const timeLabels = Array.from({ length: TOTAL_HOURS + 1 }).map((_, i) => START_HOUR + i);


export function GanttChart() {
    const reservations = useReservationStore(state => state.reservations);
    const availableStaff = useReservationStore(state => state.availableStaff);
    const selectedDate = useReservationStore(state => state.selectedDate);
    const setSelectedDate = useReservationStore(state => state.setSelectedDate);
    const staff = useMetaStore(state => state.staff);

    // const [selectedDate, setSelectedDate] = React.useState(new Date()); (Removed)

    // Calculate free staff for a given hour on the SELECTED date
    const getFreeStaffCount = (hour: number) => {
        const targetDateStr = format(selectedDate, 'yyyy-MM-dd');

        const activeReservationsCount = reservations.filter(r => {
            if (r.status === 'Cancelled') return false;

            const start = parseISO(r.startAt);
            const end = parseISO(r.endAt);

            // Filter by selected day
            if (format(start, 'yyyy-MM-dd') !== targetDateStr) return false;

            // Check if hour is within the reservation duration
            // Convert everything to "minutes from start of day" for clean comparison
            const targetMin = hour * 60;
            const startMin = start.getHours() * 60 + start.getMinutes();
            const endMin = end.getHours() * 60 + end.getMinutes();

            return targetMin >= startMin && targetMin < endMin;
        }).length;

        return Math.max(0, availableStaff.length - activeReservationsCount);
    };

    // Filter reservations for the selected date to display
    const filteredReservations = useMemo(() => {
        const dateStr = format(selectedDate, 'yyyy-MM-dd');
        return reservations.filter(r =>
            format(parseISO(r.startAt), 'yyyy-MM-dd') === dateStr &&
            r.status !== 'Cancelled'
        );
    }, [reservations, selectedDate]);

    const fetchAvailability = useReservationStore(state => state.fetchAvailability);

    // Re-fetch availability when date changes
    React.useEffect(() => {
        fetchAvailability(selectedDate);
    }, [selectedDate, fetchAvailability, staff]); // Re-run if staff list changes too

    // ... (rest of render)

    // In Header Row:
    // Display smaller intervals or just hourly? User asked "under the time". 
    // Time labels are hourly 09:00, 10:00.
    // I can stick the count there.
    // Or render a row for every 15 mins? 
    // The current header only shows Hour marks.
    // I'll show the count at the start of the hour.


    // Render structure
    // Grid Container: Grid with columns = TOTAL_SLOTS (+ sidebar width?)
    // Actually simpler: Sidebar separate, then Scrollable Timeline area.

    // Let's use a 100% width container.
    // Sidebar: Fixed width 200px.
    // Timeline: Flex 1, overflow-x-auto.

    // Reservation placement: absolute positioning based on startTime.

    const getLeft = (timeStr: string) => {
        const date = parseISO(timeStr);
        const h = date.getHours();
        const m = date.getMinutes();

        if (h < START_HOUR) return 0; // Or handle previous day wrapping? Requirement says 09-24. Assumed same day.

        const minutesFromStart = (h - START_HOUR) * 60 + m;
        const slotIndex = minutesFromStart / SLOT_DURATION_MIN;

        return `${(slotIndex / TOTAL_SLOTS) * 100}%`;
    };

    const getWidth = (startStr: string, endStr: string) => {
        const start = parseISO(startStr);
        const end = parseISO(endStr);
        const durationMin = (end.getTime() - start.getTime()) / 1000 / 60;
        const slots = durationMin / SLOT_DURATION_MIN;

        return `${(slots / TOTAL_SLOTS) * 100}%`;
    };


    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [dialogProps, setDialogProps] = React.useState<{ start?: string, resourceId?: string }>({});

    const [editId, setEditId] = React.useState<string | null>(null);

    const handleSlotClick = (resourceId: string, timeStr: string) => {
        setDialogProps({ start: timeStr, resourceId });
        setIsDialogOpen(true);
    };

    const handleReservationClick = (e: React.MouseEvent, resId: string) => {
        e.stopPropagation(); // Prevent slot click
        setEditId(resId);
    };

    return (
        <>
            <div className="flex flex-col h-full bg-white text-sm border rounded-lg shadow-sm overflow-hidden">
                {/* Header Row */}
                <div className="flex border-b bg-gray-50">
                    <div className="w-48 flex-shrink-0 border-r p-2 font-bold text-gray-700 flex flex-col items-center justify-center">
                        <div className="flex items-center gap-2 mb-1">
                            <button
                                onClick={() => {
                                    const prev = new Date(selectedDate);
                                    prev.setDate(prev.getDate() - 1);
                                    setSelectedDate(prev);
                                }}
                                className="p-1 hover:bg-gray-200 rounded text-gray-400"
                            >
                                ←
                            </button>
                            <span>Resource</span>
                            <button
                                onClick={() => {
                                    const next = new Date(selectedDate);
                                    next.setDate(next.getDate() + 1);
                                    setSelectedDate(next);
                                }}
                                className="p-1 hover:bg-gray-200 rounded text-gray-400"
                            >
                                →
                            </button>
                        </div>
                        <span className="text-xs font-normal text-gray-500">{format(selectedDate, 'yyyy-MM-dd (EEE)')}</span>
                    </div>
                    <div className="flex-grow relative h-14 overflow-hidden">
                        {/* Time Axis */}
                        {timeLabels.map((hour, i) => (
                            <div
                                key={hour}
                                className="absolute top-0 bottom-0 border-l border-gray-300 text-xs pl-1 pt-1 text-gray-500"
                                style={{ left: `${(i * SLOTS_PER_HOUR / TOTAL_SLOTS) * 100}%` }}
                            >
                                <div className="font-bold">{format(new Date().setHours(hour, 0, 0, 0), 'h a')}</div>
                                <div className="text-[10px] text-blue-600 font-semibold mt-1">
                                    Free: {getFreeStaffCount(hour)}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Resource Rows grouped by Category */}
                <div className="overflow-y-auto flex-grow">
                    {(['Head Spa', 'Aroma Room', 'Massage Seat'] as const).map(category => (
                        <React.Fragment key={category}>
                            {/* Category Separator */}
                            <div className="sticky top-0 z-20 flex border-b bg-gray-100 min-h-[30px] items-center">
                                <div className="w-48 flex-shrink-0 border-r px-2 font-bold text-gray-600 sticky left-0 bg-gray-100 text-xs uppercase tracking-wider h-full flex items-center">
                                    {category}
                                </div>
                                <div className="flex-grow bg-gray-50/50"></div>
                            </div>

                            {/* Resources for this Category */}
                            {RESOURCES.filter(r => r.category === category).map((resource) => (
                                <div key={resource.id} className="flex border-b min-h-[60px] relative group h-16">
                                    {/* Sidebar Resource Name */}
                                    <div className="w-48 flex-shrink-0 border-r bg-white p-2 flex items-center font-medium text-gray-700 z-10 sticky left-0">
                                        <div>
                                            <div className="text-sm">{resource.name}</div>
                                            {/* Category label removed from here as it's now in header */}
                                        </div>
                                    </div>

                                    {/* Timeline Area (Relative for absolute children) */}
                                    <div className="flex-grow relative min-w-[800px]">
                                        {/* Click Target Layers (Grid) */}
                                        {Array.from({ length: TOTAL_SLOTS }).map((_, i) => {
                                            // ... grid lines ...
                                            const hour = START_HOUR + Math.floor(i / SLOTS_PER_HOUR);
                                            const min = (i % SLOTS_PER_HOUR) * SLOT_DURATION_MIN;
                                            const timeStr = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), hour, min).toISOString();

                                            return (
                                                <div
                                                    key={i}
                                                    onClick={() => handleSlotClick(resource.id, timeStr)}
                                                    className={cn(
                                                        "absolute top-0 bottom-0 border-r border-gray-100 cursor-pointer hover:bg-gray-50",
                                                        (i + 1) % 4 === 0 && "border-r-gray-300"
                                                    )}
                                                    style={{
                                                        left: `${(i / TOTAL_SLOTS) * 100}%`,
                                                        width: `${(1 / TOTAL_SLOTS) * 100}%`
                                                    }}
                                                    title={`Click to book ${timeStr}`}
                                                />
                                            );
                                        })}

                                        {/* Reservations for this resource */}
                                        {filteredReservations.filter(r => r.resourceId === resource.id).map(res => {
                                            const isEditing = editId === res.id;
                                            const editingRes = reservations.find(r => r.id === editId);
                                            const isLinked = editId && res.comboLinkId && editingRes?.comboLinkId === res.comboLinkId;

                                            return (
                                                <div
                                                    key={res.id}
                                                    onClick={(e) => handleReservationClick(e, res.id)}
                                                    className={cn(
                                                        "absolute top-1 bottom-1 rounded px-2 text-xs flex flex-col justify-center overflow-hidden border transition-all hover:z-20 hover:shadow-md cursor-pointer z-10",
                                                        res.staffId === 'Unassigned' ? "bg-gray-400 border-gray-500 text-white" : getStaffColor(res.staffId),
                                                        // Handle Cancelled separately to hide it
                                                        res.status === 'Cancelled' && "hidden",
                                                        // Highlights
                                                        isEditing && "ring-2 ring-blue-500 ring-offset-1 z-30 shadow-lg scale-[1.02]",
                                                        isLinked && !isEditing && "ring-2 ring-blue-300 ring-offset-1 z-20 opacity-90",
                                                    )}
                                                    style={{
                                                        left: getLeft(res.startAt),
                                                        width: getWidth(res.startAt, res.endAt)
                                                    }}
                                                    title={`${res.clientName || 'Guest'} - ${res.menuName} (${res.staffId})`}
                                                >
                                                    <div className="font-bold truncate text-[11px]">
                                                        {format(parseISO(res.startAt), 'h:mm a')} - {format(parseISO(res.endAt), 'h:mm a')}
                                                    </div>
                                                    {res.clientName && (
                                                        <div className="truncate text-[10px] font-semibold text-black/70">
                                                            👤 {res.clientName}
                                                        </div>
                                                    )}
                                                    <div className="truncate text-xs">{res.menuName}</div>
                                                    <div className="truncate text-[10px]">{res.staffId}</div>
                                                </div>
                                            );
                                        })}

                                    </div>
                                </div>
                            ))}
                        </React.Fragment>
                    ))}
                </div>
            </div>

            <BookingDialog
                isOpen={isDialogOpen}
                onClose={() => setIsDialogOpen(false)}
                initialStartTime={dialogProps.start}
                initialResourceId={dialogProps.resourceId as any}
            />

            <EditReservationDialog
                isOpen={!!editId}
                onClose={() => setEditId(null)}
                reservationId={editId || ''}
            />
        </>
    );
}
