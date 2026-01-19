'use client';

import React, { useState } from 'react';
import { useReservationStore } from '@/app/(main)/admin/booking/store/reservationStore';
import { useMetaStore } from '@/app/(main)/admin/booking/store/metaStore';
import { cn, getStaffColor } from '@/app/(main)/admin/booking/lib/utils';
import { Settings } from 'lucide-react';
import { StaffManagementDialog } from './StaffManagementDialog';

export function StaffAttendance() {
    const staff = useMetaStore(state => state.staff);
    const { availableStaff, toggleStaffAvailability } = useReservationStore();
    const [isManageOpen, setIsManageOpen] = useState(false);

    return (
        <>
            <div className="flex flex-wrap items-center gap-2 mt-2">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mr-1">Staff Attendance:</span>
                {staff.map(sId => {
                    const isAvailable = availableStaff.includes(sId);
                    return (
                        <button
                            key={sId}
                            onClick={() => toggleStaffAvailability(sId)}
                            className={cn(
                                "px-3 py-1 rounded-full text-xs font-bold border transition-all flex items-center gap-1.5 active:scale-95 shadow-sm",
                                isAvailable
                                    ? getStaffColor(sId)
                                    : "bg-gray-100 text-gray-400 border-gray-200 opacity-40 grayscale-[0.5]"
                            )}
                        >
                            <div className={cn("w-1.5 h-1.5 rounded-full ring-1 ring-white/50", isAvailable ? "bg-green-500 animate-pulse" : "bg-gray-400")} />
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
            </div>

            <StaffManagementDialog
                isOpen={isManageOpen}
                onClose={() => setIsManageOpen(false)}
            />
        </>
    );
}
