'use client';

import { useEffect } from 'react';
import { useMetaStore } from '@/app/(main)/admin/booking/store/metaStore';
import { useReservationStore } from '@/app/(main)/admin/booking/store/reservationStore';
import { Menu } from '@/app/(main)/admin/booking/types';
import { supabase } from '@/app/(main)/admin/booking/lib/supabaseClient';

// Staff is passed as string[] from page.tsx (names)
export function DataInitializer({ menus, staff }: { menus: Menu[], staff: string[] }) {
    const setMeta = useMetaStore((state) => state.setMeta);
    const fetchStaff = useMetaStore((state) => state.fetchStaff);
    const fetchData = useReservationStore((state) => state.fetchData);

    useEffect(() => {
        const init = async () => {
            // Set menus and staff in the store directly from props (which come from Server Side DB/CSV)
            setMeta(menus, staff);

            // Fetch reservation data (and availability/shifts)
            await fetchData();
        };
        init();
        // Recalculate if menus/staff props change (e.g. navigation)
    }, [menus, staff, setMeta, fetchData]);

    return null;
}
