'use client';

import React, { useState } from 'react';
import { useReservationStore } from '@/app/(main)/admin/booking/store/reservationStore';
import { useMetaStore } from '@/app/(main)/admin/booking/store/metaStore';
import { cn, getStaffColor } from '@/app/(main)/admin/booking/lib/utils';
import { Settings } from 'lucide-react';
import { StaffManagementDialog } from './StaffManagementDialog';

export function StaffAttendance() {
    const staff = useMetaStore(state => state.staff);
    const { availableStaff, toggleStaffAvailability, shiftStatus } = useReservationStore();
    const [isManageOpen, setIsManageOpen] = useState(false);

    return (
        <>
            <div className="flex flex-wrap items-center gap-2 mt-2">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mr-1">Staff Attendance:</span>
                {staff.map(sId => {
                    // Logic:
                    // 1. Check Shift Status (OFF/AL) -> If so, DISABLED & RED/DIMMED.
                    // 2. Check AvailableStaff (Manual Toggle) -> If not included, DIMMED (Gray).

                    // Robust Shift Check
                    let status = shiftStatus[sId];
                    if (!status) {
                        const key = Object.keys(shiftStatus).find(k => k.toLowerCase() === sId.toLowerCase());
                        if (key) status = shiftStatus[key];
                    }

                    // Is Forced OFF by Shift?
                    const isShiftOff = status === 'OFF' || status === 'AL' || status === 'Holiday';

                    // Is Manually Toggled On? (Only relevant if not Shift Off)
                    const isAvailable = availableStaff.includes(sId);

                    return (
                        <button
                            key={sId}
                            onClick={() => !isShiftOff && toggleStaffAvailability(sId)}
                            className={cn(
                                "px-3 py-1 rounded-full text-xs font-bold border transition-all flex items-center gap-1.5 active:scale-95 shadow-sm",
                                isShiftOff
                                    ? "opacity-30 cursor-not-allowed ring-1 ring-red-200 grayscale bg-gray-100 text-gray-400 border-gray-200" // FORCE OFF STYLE
                                    : isAvailable
                                        ? getStaffColor(sId) // ACTIVE STYLE
                                        : "bg-gray-100 text-gray-400 border-gray-200 opacity-60 grayscale-[0.5]" // MANUAL REST STYLE
                            )}
                            disabled={isShiftOff}
                            title={isShiftOff ? `Shift: ${status || 'OFF'}` : isAvailable ? "Online" : "Away"}
                        >
                            <div className={cn("w-1.5 h-1.5 rounded-full ring-1 ring-white/50",
                                isShiftOff ? "bg-red-500" :
                                    isAvailable ? "bg-green-500 animate-pulse" : "bg-gray-400"
                            )} />
                            {sId}
                        </button>
                    );
                })}

                <button
                    onClick={() => setIsManageOpen(true)}
                    className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-all active:scale-90 ml-1"
                    title="Manage Staff"
                >
                    <Settings className="w-4 h-4" />
                </button>
            </div >

            <StaffManagementDialog
                isOpen={isManageOpen}
                onClose={() => setIsManageOpen(false)}
            />
        </>
    );
}
