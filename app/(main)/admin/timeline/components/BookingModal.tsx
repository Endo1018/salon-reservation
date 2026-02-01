'use client';

import { useState, useEffect } from 'react';
import { getServices, getCustomers } from '@/app/actions/booking-master';
import { getStaffShifts } from '@/app/actions/booking'; // Reusing existing shift logic
import { createBooking, getAvailableStaff } from '@/app/actions/timeline';
import { format } from 'date-fns';

type Props = {
    isOpen: boolean;
    onClose: () => void;
    defaultDate: string;     // YYYY-MM-DD
    defaultTime: string;     // HH:mm
    defaultResource: string;
    editBookingId?: string | null; // Nullable to indicate Create mode
};

export default function BookingModal({ isOpen, onClose, defaultDate, defaultTime, defaultResource, editBookingId }: Props) {
    // if (!isOpen) return null; // MOVED TO BOTTOM to fix Hook Rule

    // Form State
    const [serviceId, setServiceId] = useState('');
    const [staffId, setStaffId] = useState('');
    const [staffId2, setStaffId2] = useState(''); // New State for Combo 2nd leg
    const [clientName, setClientName] = useState('');
    const [duration, setDuration] = useState(60);
    const [isAroma, setIsAroma] = useState(false); // New Aroma Checkbox State
    const [isHeadSpaFirst, setIsHeadSpaFirst] = useState(false); // New Head Spa First State
    const [startTime, setStartTime] = useState(defaultTime); // New State
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoading, setIsLoading] = useState(false); // For fetching edit data

    // Data State
    const [services, setServices] = useState<any[]>([]);
    const [customers, setCustomers] = useState<any[]>([]);
    const [therapists, setTherapists] = useState<{ id: string, name: string }[]>([]);

    // UI/Fetch State
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [isFetchingStaff, setIsFetchingStaff] = useState(false);

    // Update startTime if defaultTime changes (Create mode only or initial reset)
    useEffect(() => {
        if (!editBookingId) {
            setStartTime(defaultTime);
        }
    }, [defaultTime, editBookingId]);

    // 0. Fetch Edit Data
    useEffect(() => {
        if (isOpen && editBookingId) {
            setIsLoading(true);
            import('@/app/actions/timeline').then(async (mod) => {
                try {
                    const b = await mod.getBooking(editBookingId);
                    if (b) {
                        setServiceId(b.menuId);
                        setClientName(b.clientName || '');
                        setStaffId(b.staffId || '');
                        // Parse Time (Use overall start if present aka Combo, else startAt)
                        const d = new Date(b.overallStart || b.startAt);
                        const hh = d.getHours().toString().padStart(2, '0');
                        const mm = d.getMinutes().toString().padStart(2, '0');
                        setStartTime(`${hh}:${mm}`);
                        setIsHeadSpaFirst(!!b.isHeadSpaFirstOrder); // Load Order flag
                    }
                } catch (e) {
                    console.error(e);
                } finally {
                    setIsLoading(false);
                }
            });
        }
    }, [isOpen, editBookingId]);


    // 1. Initial Load of Static Data (Services/Customers)
    useEffect(() => {
        const fetchData = async () => {
            try {
                const [svcs, custs] = await Promise.all([getServices(), getCustomers()]);
                setServices(svcs);
                setCustomers(custs);
            } catch (e) {
                console.error("Failed to load initial data", e);
            }
        };
        fetchData();
    }, []);

    // 2. Dynamic Staff Availability Fetch
    useEffect(() => {
        const fetchStaff = async () => {
            if (!isOpen || !defaultDate || !startTime) return;

            setFetchError(null);
            setIsFetchingStaff(true);
            setTherapists([]);

            try {
                const available = await getAvailableStaff(defaultDate, startTime, duration);
                // Sort "Other" to bottom
                const sorted = available.sort((a, b) => {
                    if (a.id === 'other') return 1;
                    if (b.id === 'other') return -1;
                    return a.name.localeCompare(b.name);
                });
                setTherapists(sorted);

                if (available.length === 0) {
                    setFetchError('No staff available for this time.');
                }
            } catch (error) {
                console.error("Failed to fetch availability", error);
                setFetchError('Error fetching availability.');
            } finally {
                setIsFetchingStaff(false);
            }
        };
        fetchStaff();
    }, [defaultDate, startTime, duration]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            if (editBookingId) {
                const { updateBooking } = await import('@/app/actions/timeline');
                await updateBooking(editBookingId, {
                    date: defaultDate,
                    startTime,
                    duration,     // Pass duration
                    serviceId,    // Pass serviceId
                    staffId: staffId || null,
                    staffId2: staffId2 || staffId || null, // Resolve "Same as Therapist 1" to Main Staff
                    clientName,
                    isHeadSpaFirstOrder: isHeadSpaFirst // Pass flag
                    // isAroma? Update not yet supported in UI for edit, but ideally should be.
                    // For now, focusing on Create.
                });
            } else {
                await createBooking({
                    resourceId: defaultResource,
                    date: defaultDate,
                    startTime: startTime, // Use edited time
                    duration: duration,
                    serviceId,
                    staffId: staffId || undefined,
                    staffId2: staffId2 || undefined,
                    clientName,
                    isAroma,
                    isHeadSpaFirstOrder: isHeadSpaFirst // Pass flag
                });
            }
            onClose();
        } catch (err) {
            alert('Operation failed');
            console.error(err);
        } finally {
            setIsSubmitting(false);
        }
    };

    // Auto-update duration removed in favor of explicit onChange handler above
    // to prevent overwriting custom durations during Edit load.

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100]">
            <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-700 p-6 rounded-lg w-[500px] space-y-4 shadow-2xl">
                <h2 className="text-xl font-bold flex justify-between">
                    <span>{editBookingId ? 'Edit Booking' : 'New Booking'}</span>
                    <span className="text-sm font-normal text-slate-400">{defaultDate}</span>
                </h2>

                {isLoading && <div className="text-center text-slate-400 py-4">Loading...</div>}

                {!isLoading && (
                    <div className="space-y-4">
                        {/* Start Time Input */}
                        <div>
                            <label className="block text-xs uppercase text-slate-500 font-bold mb-1">Start Time</label>
                            <input
                                type="time"
                                className="w-full bg-slate-800 border-slate-700 rounded p-2 text-white"
                                value={startTime}
                                onChange={e => setStartTime(e.target.value)}
                                required
                            />
                        </div>

                        {/* Service Selection */}
                        <div>
                            <label className="block text-xs uppercase text-slate-500 font-bold mb-1">Service</label>
                            <select
                                className="w-full bg-slate-800 border-slate-700 rounded p-2"
                                required
                                value={serviceId}
                                onChange={e => {
                                    const newId = e.target.value;
                                    setServiceId(newId);
                                    // Auto-update params based on service
                                    const s = services.find(x => x.id === newId);
                                    if (s) {
                                        setDuration(s.duration);
                                        setIsAroma(false);
                                        setIsHeadSpaFirst(false);
                                    }
                                }}
                            >
                                <option value="">Select Service...</option>
                                {services.map(s => (
                                    <option key={s.id} value={s.id}>{s.name} ({s.duration} min)</option>
                                ))}
                            </select>
                        </div>

                        {/* Staff Selection */}
                        {services.find(s => s.id === serviceId)?.type === 'Combo' ? (
                            <div className="space-y-4">
                                <div className="flex items-center gap-2">
                                    <input
                                        id="head-spa-first"
                                        type="checkbox"
                                        className="w-4 h-4 bg-slate-800 border-slate-700 rounded"
                                        checked={isHeadSpaFirst}
                                        onChange={e => setIsHeadSpaFirst(e.target.checked)}
                                    />
                                    <label htmlFor="head-spa-first" className="text-sm text-slate-300 select-none">Head Spa First</label>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs uppercase text-slate-500 font-bold mb-1">Therapist 1 (Massage)</label>
                                        <select
                                            className="w-full bg-slate-800 border-slate-700 rounded p-2"
                                            value={staffId} onChange={e => setStaffId(e.target.value)}
                                            disabled={isFetchingStaff}
                                        >
                                            <option value="">Any / Unassigned</option>
                                            {therapists.map(s => (
                                                <option key={s.id} value={s.id}>{s.name}</option>
                                            ))}
                                        </select>

                                        {/* Aroma Checkbox for Advance/Deluxe */}
                                        {(services.find(s => s.id === serviceId)?.name.includes('Advance') ||
                                            services.find(s => s.id === serviceId)?.name.includes('Deluxe')) && (
                                                <div className="mt-2 flex items-center gap-2">
                                                    <input
                                                        id="use-aroma"
                                                        type="checkbox"
                                                        className="w-4 h-4 bg-slate-800 border-slate-700 rounded"
                                                        checked={isAroma}
                                                        onChange={e => setIsAroma(e.target.checked)}
                                                    />
                                                    <label htmlFor="use-aroma" className="text-sm text-slate-300 select-none">Use Aroma Room</label>
                                                </div>
                                            )}
                                    </div>
                                    <div>
                                        <label className="block text-xs uppercase text-slate-500 font-bold mb-1">Therapist 2 (Head Spa)</label>
                                        <select
                                            className="w-full bg-slate-800 border-slate-700 rounded p-2"
                                            value={staffId2} onChange={e => setStaffId2(e.target.value)}
                                            disabled={isFetchingStaff}
                                        >
                                            <option value="">Same as Therapist 1</option>
                                            {therapists.map(s => (
                                                <option key={s.id} value={s.id}>{s.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div>
                                <label className="block text-xs uppercase text-slate-500 font-bold mb-1">Therapist (Optional)</label>
                                <select
                                    className="w-full bg-slate-800 border-slate-700 rounded p-2"
                                    value={staffId} onChange={e => setStaffId(e.target.value)}
                                    disabled={isFetchingStaff}
                                >
                                    <option value="">{isFetchingStaff ? 'Checking...' : 'Any / Unassigned'}</option>
                                    {therapists.map(s => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                                {fetchError && <p className="text-xs text-red-400 mt-1">{fetchError}</p>}
                            </div>
                        )}

                        {/* Client Info */}
                        <div>
                            <label className="block text-xs uppercase text-slate-500 font-bold mb-1">Client Name (Optional)</label>
                            <input className="w-full bg-slate-800 border-slate-700 rounded p-2"
                                placeholder="Walk-in / Unknown"
                                value={clientName} onChange={e => setClientName(e.target.value)} />
                        </div>
                    </div>
                )}

                <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-slate-800">
                    <button type="button" onClick={onClose} className="px-4 py-2 text-slate-400 hover:text-white">Cancel</button>
                    <button type="submit" disabled={isSubmitting} className="px-4 py-2 bg-[var(--primary)] text-slate-900 font-bold rounded">
                        {isSubmitting ? 'Saving...' : (editBookingId ? 'Update' : 'Create Booking')}
                    </button>
                    {/* Delete Button (visible only in Edit Mode) */}
                    {editBookingId && (
                        <button type="button"
                            onClick={async () => {
                                if (confirm('Delete?')) {
                                    const { deleteBooking } = await import('@/app/actions/timeline');
                                    await deleteBooking(editBookingId);
                                    onClose();
                                }
                            }}
                            className="ml-auto text-red-500 bg-red-900/20 px-4 py-2 rounded hover:bg-red-900/40">
                            Delete
                        </button>
                    )}
                </div>
            </form>
        </div>
    );
}
