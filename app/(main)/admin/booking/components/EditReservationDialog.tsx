'use client';

import React, { useState, useEffect } from 'react';
import { useReservationStore } from '@/app/(main)/admin/booking/store/reservationStore';
import { Reservation, ResourceId, RESOURCES } from '@/app/(main)/admin/booking/types';
import { cn, isOverlapping, findAvailableResource } from '@/app/(main)/admin/booking/lib/utils';
import { format, parseISO, addMinutes } from 'date-fns';
import { X } from 'lucide-react';
import { SIMPLE_MENU_OPTIONS, ResourceCategoryName } from '@/app/(main)/admin/booking/lib/constants';
import { useMetaStore } from '@/app/(main)/admin/booking/store/metaStore';

interface EditReservationDialogProps {
    isOpen: boolean;
    onClose: () => void;
    reservationId: string;
}


export function EditReservationDialog({ isOpen, onClose, reservationId }: EditReservationDialogProps) {
    const { reservations, updateReservation, updateStatus, availableStaff } = useReservationStore();
    const staff = useMetaStore(state => state.staff);

    // State for which specific reservation in a combo we are editing
    const [currentId, setCurrentId] = useState(reservationId);

    // Derived state
    const reservation = reservations.find(r => r.id === currentId);
    const allParts = reservation?.comboLinkId
        ? reservations.filter(r => r.comboLinkId === reservation.comboLinkId).sort((a, b) => a.startAt.localeCompare(b.startAt))
        : reservation ? [reservation] : [];

    // Form state
    const [startParams, setStartParams] = useState({ date: '', time: '' });
    const [duration, setDuration] = useState(60);
    const [selectedStaff, setSelectedStaff] = useState('Unassigned');
    const [selectedMenuName, setSelectedMenuName] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<ResourceCategoryName | null>(null);
    const [clientName, setClientName] = useState('');
    const [error, setError] = useState<string | null>(null);

    // Sync state when dialog opens or part changes
    useEffect(() => {
        if (isOpen && reservationId) {
            setCurrentId(reservationId);
        }
    }, [isOpen, reservationId]);

    useEffect(() => {
        if (reservation) {
            const date = parseISO(reservation.startAt);
            setStartParams({
                date: format(date, 'yyyy-MM-dd'),
                time: format(date, 'HH:mm')
            });
            const end = parseISO(reservation.endAt);
            const diffMin = (end.getTime() - date.getTime()) / 60000;
            setDuration(diffMin);
            setSelectedStaff(reservation.staffId || 'Unassigned');
            setSelectedMenuName(reservation.menuName);
            setClientName(reservation.clientName || '');

            // Detect category from menuName OR ResourceId
            let cat = (Object.keys(SIMPLE_MENU_OPTIONS) as ResourceCategoryName[]).find(c => reservation.menuName.startsWith(c));

            if (!cat) {
                // Fallback: Infer from Resource ID
                const resDef = RESOURCES.find(r => r.id === reservation.resourceId);
                if (resDef) {
                    // Type assertion might be needed if category in RESOURCE isn't strictly ResourceCategoryName
                    // But usually it matches.
                    cat = resDef.category as ResourceCategoryName;
                }
            }

            setSelectedCategory(cat || null);
        }
    }, [reservation, isOpen]);

    if (!isOpen || !reservation) return null;

    const handleUpdate = (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        const newStart = parseISO(`${startParams.date}T${startParams.time}:00`);
        const newStartAt = newStart.toISOString();
        const newEndAt = addMinutes(newStart, duration).toISOString();

        if (reservation.comboLinkId) {
            // SEQUENTIAL COMBO LOGIC:
            const currentIndex = allParts.findIndex(p => p.id === reservation.id);
            const proposedSequence: Array<{ id: string, startAt: string, endAt: string, resourceId: ResourceId, staffId: string, menuName: string }> = [];

            const oldAnchorStart = parseISO(reservation.startAt).getTime();
            const anchorDeltaMs = newStart.getTime() - oldAnchorStart;

            for (const [idx, part] of allParts.entries()) {
                let pStart: Date;
                let pDuration: number;
                let pMenuName: string = part.menuName;
                let pResourceId: ResourceId = part.resourceId;
                let pStaffId: string = part.staffId;

                if (idx < currentIndex) {
                    pStart = new Date(parseISO(part.startAt).getTime() + anchorDeltaMs);
                    pDuration = (parseISO(part.endAt).getTime() - parseISO(part.startAt).getTime()) / 60000;
                    const pCat = (Object.keys(SIMPLE_MENU_OPTIONS) as ResourceCategoryName[]).find(c => part.menuName.startsWith(c));
                    const nextEnd = addMinutes(pStart, pDuration).toISOString();
                    const newRes = findAvailableResource(pCat as ResourceCategoryName, pStart.toISOString(), nextEnd, reservations.filter(r => r.comboLinkId !== reservation.comboLinkId));
                    if (!newRes) {
                        setError(`Conflict for ${part.menuName} at ${format(pStart, 'HH:mm')}. No rooms available.`);
                        return;
                    }
                    pResourceId = newRes as ResourceId;
                } else if (idx === currentIndex) {
                    pStart = newStart;
                    pDuration = duration;
                    pMenuName = selectedMenuName;
                    pStaffId = selectedStaff;

                    // Use selectedCategory if available, otherwise fallback to part name detection or resource fallback
                    let targetCat = selectedCategory;
                    if (!targetCat) {
                        targetCat = (Object.keys(SIMPLE_MENU_OPTIONS) as ResourceCategoryName[]).find(c => part.menuName.startsWith(c)) || null;
                        if (!targetCat) {
                            const resDef = RESOURCES.find(r => r.id === part.resourceId);
                            if (resDef) targetCat = resDef.category as ResourceCategoryName;
                        }
                    }

                    if (targetCat) {
                        const nextEnd = addMinutes(pStart, pDuration).toISOString();
                        const newRes = findAvailableResource(targetCat as ResourceCategoryName, pStart.toISOString(), nextEnd, reservations.filter(r => r.comboLinkId !== reservation.comboLinkId));
                        if (!newRes) {
                            setError(`Available room not found for ${targetCat} at ${format(pStart, 'HH:mm')}.`);
                            return;
                        }
                        pResourceId = newRes as ResourceId;
                    } else {
                        setError(`Could not determine service category for ${part.menuName}.`);
                        return;
                    }
                } else {
                    const prev = proposedSequence[idx - 1];
                    pStart = parseISO(prev.endAt);
                    pDuration = (parseISO(part.endAt).getTime() - parseISO(part.startAt).getTime()) / 60000;

                    let pCat = (Object.keys(SIMPLE_MENU_OPTIONS) as ResourceCategoryName[]).find(c => part.menuName.startsWith(c));
                    if (!pCat) {
                        const resDef = RESOURCES.find(r => r.id === part.resourceId);
                        if (resDef) pCat = resDef.category as ResourceCategoryName;
                    }

                    if (!pCat) {
                        setError(`Could not detect category for part: ${part.menuName}`);
                        return;
                    }

                    const nextEnd = addMinutes(pStart, pDuration).toISOString();
                    const newRes = findAvailableResource(pCat as ResourceCategoryName, pStart.toISOString(), nextEnd, reservations.filter(r => r.comboLinkId !== reservation.comboLinkId));
                    if (!newRes) {
                        setError(`Conflict for ${part.menuName} at ${format(pStart, 'HH:mm')}. No rooms available.`);
                        return;
                    }
                    pResourceId = newRes as ResourceId;
                }

                const pEnd = addMinutes(pStart, pDuration);
                proposedSequence.push({
                    id: part.id,
                    startAt: pStart.toISOString(),
                    endAt: pEnd.toISOString(),
                    resourceId: pResourceId,
                    staffId: pStaffId,
                    menuName: pMenuName
                });
            }

            for (const step of proposedSequence) {
                const isBusy = reservations.some(r => {
                    if (r.status === 'Cancelled' || r.comboLinkId === reservation.comboLinkId) return false;
                    if (!isOverlapping(r.startAt, r.endAt, step.startAt, step.endAt)) return false;
                    if (step.staffId !== 'Unassigned' && r.staffId === step.staffId) return true;
                    return false;
                });
                if (isBusy) {
                    setError(`Staff Conflict for ${step.menuName} at ${format(parseISO(step.startAt), 'HH:mm')}.`);
                    return;
                }
            }

            proposedSequence.forEach(step => {
                updateReservation(step.id, {
                    startAt: step.startAt,
                    endAt: step.endAt,
                    resourceId: step.resourceId,
                    staffId: step.staffId,
                    menuName: step.menuName,
                    clientName: clientName || 'Guest'
                });
            });

        } else {
            // SINGLE RESERVATION LOGIC
            let categoryToUse = selectedCategory;

            // If not selected, try to infer again
            if (!categoryToUse) {
                const currentCat = (Object.keys(SIMPLE_MENU_OPTIONS) as ResourceCategoryName[]).find(c => reservation.menuName.startsWith(c));
                categoryToUse = currentCat || null;
            }
            if (!categoryToUse) {
                const resDef = RESOURCES.find(r => r.id === reservation.resourceId);
                if (resDef) categoryToUse = resDef.category as ResourceCategoryName;
            }

            if (!categoryToUse) {
                setError("Could not determine service category.");
                return;
            }

            const isResourceStillAvailable = !reservations.some(r =>
                r.id !== reservation.id &&
                r.resourceId === reservation.resourceId &&
                r.status !== 'Cancelled' &&
                isOverlapping(r.startAt, r.endAt, newStartAt, newEndAt)
            );

            let targetResourceId = reservation.resourceId;

            // Check if we need to switch resource (if busy OR if we changed category manually)
            const currentCatFromRes = RESOURCES.find(r => r.id === reservation.resourceId)?.category;
            const categoryChanged = selectedCategory && selectedCategory !== currentCatFromRes;

            if (!isResourceStillAvailable || categoryChanged) {
                const newRes = findAvailableResource(
                    categoryToUse,
                    newStartAt,
                    newEndAt,
                    reservations,
                    reservation.id
                );

                if (!newRes) {
                    setError(`No available ${categoryToUse} at ${format(newStart, 'HH:mm')}.`);
                    return;
                }
                targetResourceId = newRes as ResourceId;
            }

            if (selectedStaff !== 'Unassigned') {
                const staffBusy = reservations.some(r =>
                    r.id !== reservation.id &&
                    r.staffId === selectedStaff &&
                    r.status !== 'Cancelled' &&
                    isOverlapping(r.startAt, r.endAt, newStartAt, newEndAt)
                );

                if (staffBusy) {
                    setError(`Staff ${selectedStaff} is busy at ${format(newStart, 'HH:mm')}.`);
                    return;
                }
            }

            updateReservation(reservation.id, {
                startAt: newStartAt,
                endAt: newEndAt,
                staffId: selectedStaff,
                menuName: selectedMenuName,
                resourceId: targetResourceId,
                clientName: clientName || 'Guest'
            });
        }

        onClose();
    };

    const handleCancel = () => {
        if (confirm("Cancel this booking?")) {
            if (reservation.comboLinkId) {
                allParts.forEach(p => updateStatus(p.id, 'Cancelled'));
            } else {
                updateStatus(reservation.id, 'Cancelled');
            }
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-6 relative">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-gray-700">
                    <X className="w-5 h-5" />
                </button>

                <h3 className="font-bold text-lg mb-1">Edit Reservation</h3>
                <input
                    type="text"
                    className="w-full border rounded p-1.5 text-sm mb-4 bg-gray-50 font-medium"
                    value={clientName}
                    onChange={e => setClientName(e.target.value)}
                    placeholder="Guest Name"
                />

                {reservation.comboLinkId && (
                    <div className="mb-4 bg-blue-50/50 p-2 rounded-lg border border-blue-100">
                        <label className="block text-[10px] font-bold text-blue-800 uppercase mb-2 px-1">Which part to edit? (セット内容)</label>
                        <div className="flex flex-col gap-1">
                            {allParts.map((part, idx) => (
                                <button
                                    key={part.id}
                                    type="button"
                                    onClick={() => setCurrentId(part.id)}
                                    className={cn(
                                        "text-xs flex justify-between p-2 rounded transition-colors",
                                        part.id === reservation.id
                                            ? "bg-blue-600 text-white font-bold shadow-sm"
                                            : "hover:bg-blue-100 text-blue-700"
                                    )}
                                >
                                    <span>{idx + 1}. {part.menuName}</span>
                                    <span>{format(parseISO(part.startAt), 'HH:mm')}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                <form onSubmit={handleUpdate} className="space-y-4">
                    <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Start Time (of this part)</label>
                        <div className="flex gap-2">
                            <input type="date" className="border rounded p-1 text-sm w-full bg-gray-50" value={startParams.date} readOnly />
                            <input type="time" className="border rounded p-1 text-sm w-full" value={startParams.time} onChange={e => setStartParams({ ...startParams, time: e.target.value })} required />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-2">Menu (Service)</label>
                        <div className="space-y-2.5">
                            {(Object.keys(SIMPLE_MENU_OPTIONS) as ResourceCategoryName[]).map(cat => (
                                <div key={cat} className="flex items-center gap-2">
                                    <span className="text-[10px] font-bold w-16 text-gray-400 uppercase leading-tight">{cat === 'Massage Seat' ? 'Massage' : cat}</span>
                                    <div className="flex flex-wrap gap-1">
                                        {SIMPLE_MENU_OPTIONS[cat].map(dur => {
                                            const mName = `${cat} ${dur}m`;
                                            const isSelected = selectedMenuName === mName;
                                            return (
                                                <button
                                                    key={dur} type="button"
                                                    onClick={() => {
                                                        setSelectedMenuName(mName);
                                                        setDuration(dur);
                                                        setSelectedCategory(cat);
                                                    }}
                                                    className={cn(
                                                        "px-2 py-0.5 text-[11px] border-2 rounded-full font-bold transition-all",
                                                        isSelected ? "border-gray-900 bg-gray-900 text-white" : "border-gray-200 text-gray-400 hover:border-gray-300"
                                                    )}
                                                >
                                                    {dur}m
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Staff</label>
                        <select className="w-full border rounded p-1 text-sm bg-white" value={selectedStaff} onChange={e => setSelectedStaff(e.target.value)}>
                            <option value="Unassigned">Unassigned</option>
                            {staff.map(s => {
                                const isAvailable = availableStaff.includes(s);
                                const isSelected = selectedStaff === s;
                                if (!isAvailable && !isSelected) return null;
                                return <option key={s} value={s}>{s} {!isAvailable && '(Absent)'}</option>;
                            })}
                        </select>
                    </div>

                    {error && <p className="text-red-600 text-[10px] bg-red-50 p-1.5 rounded">{error}</p>}

                    <div className="flex justify-between pt-4 border-t">
                        <button type="button" onClick={handleCancel} className="text-red-600 text-xs hover:underline font-medium">Cancel Booking</button>
                        <div className="flex gap-2">
                            <button type="button" onClick={onClose} className="px-3 py-1 text-gray-500 text-sm">Close</button>
                            <button type="submit" className="px-5 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 font-bold shadow-sm">Save</button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}
