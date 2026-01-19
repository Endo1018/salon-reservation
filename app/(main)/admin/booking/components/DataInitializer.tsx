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
            setMeta(menus, staff);

            // Seed staff data if empty
            const { data: existingStaff } = await supabase.from('staff').select('id').limit(1);
            if (!existingStaff || existingStaff.length === 0) {
                console.log('Seeding staff data from CSV...');
                const staffData = staff.map(name => ({ name }));
                await supabase.from('staff').insert(staffData);
            }

            await fetchStaff();
            await fetchData();
        };
        init();
    }, [menus, staff, setMeta, fetchData, fetchStaff]);

    return null;
}
