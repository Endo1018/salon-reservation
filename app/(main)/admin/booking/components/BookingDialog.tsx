/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useState, useEffect } from 'react';
import { useMetaStore } from '@/app/(main)/admin/booking/store/metaStore';
import { useReservationStore } from '@/app/(main)/admin/booking/store/reservationStore';
import { Menu, ResourceId, ResourceCategory } from '@/app/(main)/admin/booking/types';
import { format, parseISO, addMinutes } from 'date-fns';
import { cn, findAvailableResource, getResourceCategoryForMenu, isOverlapping } from '@/app/(main)/admin/booking/lib/utils';
import { X, Plus, Trash2 } from 'lucide-react';
import { SIMPLE_MENU_OPTIONS, ResourceCategoryName } from '@/app/(main)/admin/booking/lib/constants';

interface BookingDialogProps {
    isOpen: boolean;
    onClose: () => void;
    initialStartTime?: string; // ISO
    initialResourceId?: ResourceId;
}

interface TreatmentPart {
    id: string;
    category: ResourceCategoryName;
    duration: number;
}

export function BookingDialog({ isOpen, onClose, initialStartTime, initialResourceId }: BookingDialogProps) {
    const staff = useMetaStore(state => state.staff);
    const { addReservation, validateReservation, reservations, availableStaff } = useReservationStore();

    const [clientName, setClientName] = useState('');
    // Time input only (HH:mm)
    const [startHourStr, setStartHourStr] = useState('10:00');
    const [selectedStaffId, setSelectedStaffId] = useState<string>('Unassigned');

    // Dynamic list of treatments
    const [treatments, setTreatments] = useState<TreatmentPart[]>([]);

    const [error, setError] = useState<string | null>(null);

    // Initialize form when opening
    useEffect(() => {
        if (isOpen && initialStartTime) {
            const date = parseISO(initialStartTime);
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setStartHourStr(format(date, 'HH:mm'));

            // Auto-add first treatment based on initial resource if possible
            // But we don't know duration. Just add a default placeholder? 
            // User can click buttons to add.
            setTreatments([]);
        }
    }, [isOpen, initialStartTime]);

    if (!isOpen) return null;

    // Calculate date from initialStartTime (which contains the clicked date)
    // If initialStartTime is missing (shouldn't be), default to today.
    const baseDateStr = initialStartTime ? initialStartTime.split('T')[0] : format(new Date(), 'yyyy-MM-dd');

    // Handle adding a treatment part
    const addTreatment = (category: ResourceCategoryName, duration: number) => {
        setTreatments(prev => [...prev, {
            id: crypto.randomUUID(),
            category,
            duration
        }]);
    };

    const removeTreatment = (id: string) => {
        setTreatments(prev => prev.filter(t => t.id !== id));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!selectedStaffId || treatments.length === 0) {
            setError("Please fill staff and at least one treatment.");
            return;
        }

        // Construct reservations sequence
        const fullStartIso = `${baseDateStr}T${startHourStr}:00`; // Assuming HH:mm:00
        let currentStart = parseISO(fullStartIso);

        // Validate sequence
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pendingReservations: any[] = [];
        const comboLinkId = treatments.length > 1 ? crypto.randomUUID() : undefined;

        // We need to simulate the sequence
        for (const [index, part] of treatments.entries()) {
            const startStr = currentStart.toISOString();
            const end = addMinutes(currentStart, part.duration);
            const endStr = end.toISOString();

            // Find available resource for this part
            // If it's the first part and we clicked a specific row, try to use that resource IF it matches category
            let targetResource: string | null = null;

            // Optimization: If initialResourceId is provided and matches the first part's category, use it.
            if (index === 0 && initialResourceId) {
                // Check if initialResourceId belongs to category
                // We can't easily check category of initialResourceId without strict lookup or name parsing
                // Let's rely on standard findAvailableResource but prioritize initial if valid?
                // Simplest: Just use findAvailableResource. The check below will find a valid one.
                // BUT user clicked a specific row, they expect it to land there if possible.
                // Let's TRY to force it if category matches.
                // Hacky check: 
                const isHeadSpa = initialResourceId.toLowerCase().includes('head');
                const isAroma = initialResourceId.toLowerCase().includes('aroma');
                // Massage is default
                let clickedCat: ResourceCategoryName | null = null;
                if (isHeadSpa) clickedCat = 'Head Spa';
                else if (isAroma) clickedCat = 'Aroma Room';
                else clickedCat = 'Massage Seat'; // Basic guess

                if (part.category === clickedCat) {
                    targetResource = initialResourceId;
                }
            }

            if (!targetResource) {
                targetResource = findAvailableResource(part.category, startStr, endStr, reservations);
            } else {
                // Verify the forced resource is actually free
                // (Re-using findAvailable logic or manual check)
                // Simplified: findAvailableResource usually returns ANY valid. 
                // If we want specific, we must check specific.
                // Let's just trust findAvailable for now to ensure validity.
                targetResource = findAvailableResource(part.category, startStr, endStr, reservations);
            }

            if (!targetResource) {
                const localTime = format(parseISO(startStr), 'HH:mm');
                setError(`No available ${part.category} at ${localTime}.`);
                return;
            }

            // Check Staff Availability
            // (Reuse store logic or manual check)
            // Skip check if Unassigned
            if (selectedStaffId !== 'Unassigned') {
                const staffBusy = reservations.some(r =>
                    r.staffId === selectedStaffId &&
                    r.status !== 'Cancelled' &&
                    isOverlapping(r.startAt, r.endAt, startStr, endStr)
                );

                if (staffBusy) {
                    const localTime = format(parseISO(startStr), 'HH:mm');
                    setError(`Staff ${selectedStaffId} is busy at ${localTime}.`);
                    return;
                }
            }

            console.log('Adding reservation with comboLinkId:', comboLinkId);
            pendingReservations.push({
                id: crypto.randomUUID(),
                menuId: `generic-${part.category}-${part.duration}`,
                menuName: `${part.category} ${part.duration}m`,
                staffId: selectedStaffId,
                startAt: startStr,
                endAt: endStr,
                resourceId: targetResource as ResourceId,
                status: 'Hold',
                clientName: clientName || 'Guest',
                comboLinkId: comboLinkId,
                isComboMain: index === 0
            });

            currentStart = end;
        }

        // All valid, commit
        pendingReservations.forEach(r => addReservation(r));
        onClose();

        // Reset
        setClientName('');
        setTreatments([]);
        setSelectedStaffId('Unassigned');
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 overflow-y-auto">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 relative animate-in fade-in zoom-in-95 duration-200 my-8">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-gray-700">
                    <X className="w-5 h-5" />
                </button>

                <h2 className="text-xl font-bold mb-2">New Booking</h2>
                <div className="text-sm text-gray-500 mb-4 font-mono">
                    Date: {baseDateStr}
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Start Time</label>
                            <input
                                type="time"
                                className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm"
                                value={startHourStr}
                                onChange={e => setStartHourStr(e.target.value)}
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Customer Name (任意)</label>
                            <input
                                type="text"
                                className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm"
                                value={clientName}
                                onChange={e => setClientName(e.target.value)}
                                placeholder="名前を入力..."
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">担当スタッフ (Staff)</label>
                        <div className="grid grid-cols-4 gap-2">
                            <div
                                key="Unassigned"
                                onClick={() => setSelectedStaffId('Unassigned')}
                                className={cn(
                                    "cursor-pointer text-center text-[10px] font-bold border rounded py-1.5 px-1 transition-all active:scale-95",
                                    selectedStaffId === 'Unassigned' ? "bg-gray-600 text-white border-gray-600 shadow-sm" : "bg-white text-gray-400 border-dashed border-gray-300"
                                )}
                            >
                                Unassigned
                            </div>
                            {staff.map(staffName => {
                                const isAvailable = availableStaff.includes(staffName);
                                return (
                                    <button
                                        type="button"
                                        key={staffName}
                                        onClick={() => isAvailable && setSelectedStaffId(staffName)}
                                        disabled={!isAvailable}
                                        className={cn(
                                            "cursor-pointer text-center text-[10px] font-bold border rounded py-1.5 px-1 transition-all active:scale-95",
                                            selectedStaffId === staffName
                                                ? "bg-gray-900 text-white border-gray-900 shadow-sm"
                                                : isAvailable
                                                    ? "bg-white text-gray-700 border-gray-200 hover:border-gray-400"
                                                    : "bg-gray-50 text-gray-300 border-gray-100 opacity-30 cursor-not-allowed grayscale" // Dim heavily if unavailable (OFF)
                                        )}
                                        title={!isAvailable ? "Unavailable / OFF" : "Select Staff"}
                                    >
                                        {staffName}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <hr className="border-gray-100" />

                    <div>
                        <div className="flex justify-between items-center mb-4">
                            <label className="text-sm font-bold text-gray-700">追加したメニュー (Order)</label>
                            {treatments.length > 0 && (
                                <span className="text-xs text-blue-600 font-semibold bg-blue-50 px-2 py-0.5 rounded-full">
                                    合計: {treatments.reduce((sum, t) => sum + t.duration, 0)}分
                                </span>
                            )}
                        </div>

                        {/* Selected Treatments List */}
                        {treatments.length > 0 ? (
                            <div className="flex flex-wrap gap-2 mb-6">
                                {treatments.map((t, idx) => (
                                    <div key={t.id} className="flex items-center gap-1.5 bg-gray-100 px-2 py-1 rounded-md border border-gray-200 shadow-sm animate-in slide-in-from-left-2 duration-200">
                                        <span className="text-[11px] font-bold text-gray-400">{idx + 1}</span>
                                        <span className="text-xs font-semibold text-gray-700">
                                            {t.category === 'Massage Seat' ? 'Massage' : t.category} {t.duration}m
                                        </span>
                                        <button type="button" onClick={() => removeTreatment(t.id)} className="text-gray-400 hover:text-red-500 transition-colors ml-1">
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-xs text-gray-400 italic mb-6 p-4 border border-dashed rounded-lg text-center bg-gray-50/50">
                                下のボタンからメニュー（部屋と時間）を追加してください
                            </div>
                        )}

                        {/* Add Buttons (Matching Screenshot) */}
                        <div className="space-y-6">
                            {(Object.keys(SIMPLE_MENU_OPTIONS) as ResourceCategoryName[]).map(cat => (
                                <div key={cat} className="flex items-center gap-4">
                                    <span className="text-sm font-bold w-24 text-gray-700">
                                        {cat === 'Massage Seat' ? 'Massage' : cat}
                                    </span>
                                    <div className="flex flex-wrap gap-2">
                                        {SIMPLE_MENU_OPTIONS[cat].map(dur => (
                                            <button
                                                type="button"
                                                key={`${cat}-${dur}`}
                                                onClick={() => addTreatment(cat, dur)}
                                                className="group relative px-4 py-1.5 text-sm border-2 border-gray-900 rounded-full hover:bg-gray-900 hover:text-white transition-all duration-200 flex items-center gap-1.5 font-bold"
                                            >
                                                <span className="text-gray-400 group-hover:text-white/50 transition-colors">+</span>
                                                {dur}m
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {
                        error && (
                            <div className="text-red-600 text-sm bg-red-50 p-2 rounded">
                                {error}
                            </div>
                        )
                    }

                    <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md">
                            Cancel
                        </button>
                        <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium shadow-sm">
                            Book Appointment
                        </button>
                    </div>
                </form >
            </div >
        </div >
    );
}
