/* eslint-disable @typescript-eslint/no-explicit-any */
import { create } from 'zustand';
import { Reservation, ResourceId, Menu } from '@/app/(main)/admin/booking/types';
import { STAFF_LIST } from '@/app/(main)/admin/booking/lib/constants';
import { isOverlapping, getComboResourceCategories, findAvailableResource, getResourceCategoryForMenu } from '@/app/(main)/admin/booking/lib/utils';
import { addMinutes, format, parseISO } from 'date-fns';

import { supabase } from '@/app/(main)/admin/booking/lib/supabaseClient';
import { useMetaStore } from '@/app/(main)/admin/booking/store/metaStore';

interface ReservationState {
    reservations: Reservation[];
    fetchData: () => Promise<void>;
    addReservation: (reservation: Reservation) => Promise<void>;
    removeReservation: (id: string) => Promise<void>;
    updateStatus: (id: string, status: Reservation['status']) => Promise<void>;
    updateReservation: (id: string, updates: Partial<Reservation>) => Promise<void>;
    selectedDate: Date;
    setSelectedDate: (date: Date) => void;
    clearReservationsForDate: (date: Date) => Promise<void>;
    // Staff Availability
    // Staff Availability
    availableStaff: string[];
    shiftStatus: Record<string, string>; // 'OFF', 'WORK', etc.
    toggleStaffAvailability: (staffId: string) => Promise<void>;
    setStaffAvailability: (staffIds: string[]) => void;
    fetchAvailability: (date: Date) => Promise<void>;

    validateReservation: (
        menu: Menu,
        startAt: string,
        staffId: string,
        forcedResourceId?: ResourceId
    ) => { valid: boolean; error?: string; slots?: { start: string, end: string, resourceId: string }[] };

    validateReservationInternal: (
        menu: Menu,
        startAt: string,
        staffId: string,
        forcedResourceId?: ResourceId,
        excludeId?: string
    ) => { valid: boolean; error?: string; slots?: { start: string, end: string, resourceId: string }[] };
}

export const useReservationStore = create<ReservationState>((set, get) => ({
    reservations: [],
    selectedDate: new Date(),
    shiftStatus: {},

    setSelectedDate: (date) => set({ selectedDate: date }),

    addReservation: async (reservation) => {
        set((state) => ({ reservations: [...state.reservations, reservation] }));
        console.log('Inserting reservation to Supabase:', reservation.id);
        const { data, error } = await supabase
            .from('reservations')
            .insert([{
                id: reservation.id,
                resource_id: reservation.resourceId,
                staff_id: reservation.staffId,
                start_at: reservation.startAt,
                end_at: reservation.endAt,
                menu_name: reservation.menuName,
                status: reservation.status,
                combo_link_id: reservation.comboLinkId,
                client_name: reservation.clientName
            }])
            .select();
        if (error) console.error('Supabase add error:', error);
        else console.log('Successfully inserted reservation');
    },

    removeReservation: async (id) => {
        set((state) => ({ reservations: state.reservations.filter(r => r.id !== id && r.comboLinkId !== id) }));
        const { error } = await supabase.from('reservations').delete().or(`id.eq.${id},combo_link_id.eq.${id}`);
        if (error) console.error('Supabase remove error:', error);
    },

    updateStatus: async (id, status) => {
        set((state) => ({ reservations: state.reservations.map(r => r.id === id ? { ...r, status } : r) }));
        const { error } = await supabase.from('reservations').update({ status }).eq('id', id);
        if (error) console.error('Supabase status update error:', error);
    },

    updateReservation: async (id, updates) => {
        set((state) => ({ reservations: state.reservations.map(r => r.id === id ? { ...r, ...updates } : r) }));
        // Map updates to snake_case
        const dbUpdates: any = {};
        if (updates.resourceId) dbUpdates.resource_id = updates.resourceId;
        if (updates.staffId) dbUpdates.staff_id = updates.staffId;
        if (updates.startAt) dbUpdates.start_at = updates.startAt;
        if (updates.endAt) dbUpdates.end_at = updates.endAt;
        if (updates.menuName) dbUpdates.menu_name = updates.menuName;
        if (updates.status) dbUpdates.status = updates.status;
        if (updates.clientName !== undefined) dbUpdates.client_name = updates.clientName;

        console.log('Updating reservation in Supabase:', id, dbUpdates);
        const { error } = await supabase.from('reservations').update(dbUpdates).eq('id', id);
        if (error) console.error('Supabase update error:', error);
        else console.log('Successfully updated reservation');
    },

    clearReservationsForDate: async (date) => {
        const dateStr = format(date, 'yyyy-MM-dd');

        // Remove from local state
        set((state) => ({
            reservations: state.reservations.filter(r => !r.startAt.startsWith(dateStr))
        }));

        // Remove from Supabase
        // Filter by start_at between [date 00:00, date 23:59:59]
        // Actually simpler to filter by text matching YYYY-MM-DD
        const startOfDay = `${dateStr}T00:00:00`;
        const endOfDay = `${dateStr}T23:59:59`;

        const { error } = await supabase
            .from('reservations')
            .delete()
            .gte('start_at', startOfDay)
            .lte('start_at', endOfDay);

        if (error) console.error('Supabase clear date error:', error);
        else console.log(`Successfully cleared reservations for ${dateStr}`);
    },

    availableStaff: [],

    toggleStaffAvailability: async (staffId) => {
        const { availableStaff } = get();
        const isAvailable = availableStaff.includes(staffId);
        const newAvailable = isAvailable
            ? availableStaff.filter(id => id !== staffId)
            : [...availableStaff, staffId];

        set({ availableStaff: newAvailable });

        // Upsert to DB for "Today"
        // Note: For simplicity, we assume we are managing "Today's" availability.
        const today = new Date().toISOString().split('T')[0];
        const { error } = await supabase.from('staff_availability').upsert({
            staff_id: staffId,
            date: today,
            is_available: !isAvailable // if it was available, now it's not (which means is_available=false?)
            // Wait, logic: if I click "toggle", and it WAS present (green), it becomes absent (gray).
            // So is_available = !oldState.
        }, { onConflict: 'staff_id,date' });

        if (error) console.error('Supabase availability error:', error);
    },

    setStaffAvailability: (ids) => set(() => ({ availableStaff: ids })),

    fetchData: async () => {
        console.log('Fetching data from Supabase...');
        const { data: resData, error: resError } = await supabase
            .from('reservations')
            .select('*')
            .neq('status', 'Cancelled');

        if (resError) {
            console.error('Supabase fetch error details:', {
                message: resError.message,
                details: resError.details,
                hint: resError.hint,
                code: resError.code
            });
            return;
        }

        if (resData) {
            console.log(`Supabase returned ${resData.length} records:`, resData);
            const mapped = resData.map((r: any) => ({
                id: r.id,
                resourceId: r.resource_id as ResourceId,
                staffId: r.staff_id,
                startAt: r.start_at,
                endAt: r.end_at,
                menuName: r.menu_name,
                menuId: r.menu_name,
                status: r.status,
                comboLinkId: r.combo_link_id,
                clientName: r.client_name
            }));
            console.log('Mapped reservations:', mapped);
            set({ reservations: mapped });
        }

        // 2. Fetch Availability for Today
        const today = new Date().toISOString().split('T')[0];
        const { data: availData, error: availError } = await supabase
            .from('staff_availability')
            .select('staff_id, is_available')
            .eq('date', today);

        if (availError) {
            console.error('Supabase availability fetch error:', availError);
        } else if (availData) {
            console.log(`Fetched availability for ${availData.length} staff`);
            const absentStaff = availData.filter((r: any) => !r.is_available).map((r: any) => r.staff_id);
            // Dynamic check instead of hardcoded STAFF_LIST
            const { staff } = useMetaStore.getState();
            const presentStaff = staff.filter((id) => !absentStaff.includes(id));
            set({ availableStaff: presentStaff });
        }
    },

    fetchAvailability: async (date: Date) => {
        // Fetch Shifts from DB (Server Action)
        const { getStaffShifts } = await import('@/app/actions/booking');
        const { shiftMap } = await getStaffShifts(date);

        set({ shiftStatus: shiftMap });

        // Default availability: Everyone who is NOT 'OFF'
        const { staff } = useMetaStore.getState();

        // If we want to persist manual toggles, we'd merge with `staff_availability` table.
        // For now, let's trust Shift status as primary. 
        // If Shift is OFF, they are unavailable.
        // If Shift is WORK (or undefined/null), they are available.

        const available = staff.filter(name => {
            const status = shiftMap[name];
            return status !== 'OFF';
        });

        set({ availableStaff: available });
    },

    validateReservation: (menu: Menu, startAt: string, staffId: string, forcedResourceId?: ResourceId) => {
        return get().validateReservationInternal(menu, startAt, staffId, forcedResourceId, undefined);
    },

    validateReservationInternal: (menu: Menu, startAt: string, staffId: string, forcedResourceId?: ResourceId, excludeId?: string) => {
        const { reservations } = get();
        const startTime = parseISO(startAt);

        // 1. Staff Availability Check (Global)
        const totalDuration = menu.duration || 60; // fallback
        const endAt = addMinutes(startTime, totalDuration).toISOString();

        const staffBusy = reservations.some(r =>
            r.id !== excludeId && // Exclude self
            r.staffId === staffId &&
            r.status !== 'Cancelled' &&
            isOverlapping(r.startAt, r.endAt, startAt, endAt)
        );

        if (staffBusy) {
            return { valid: false, error: `Staff ${staffId} is busy during this time.` };
        }

        // 2. Resource Logic
        if (menu.type === 'Combo') {
            // Automatic Split Logic
            const [cat1, cat2] = getComboResourceCategories(menu);
            const dur1 = menu.massageTime || (menu.duration / 2);
            const dur2 = menu.headSpaTime || (menu.duration - dur1);

            const end1 = addMinutes(startTime, dur1).toISOString();
            const start2 = end1;
            const end2 = addMinutes(parseISO(start2), dur2).toISOString();

            // Find Resource 1
            const res1 = findAvailableResource(cat1, startAt, end1, reservations, excludeId);
            if (!res1) return { valid: false, error: `No available ${cat1} for first half.` };

            // Find Resource 2
            const res2 = findAvailableResource(cat2, start2, end2, reservations, excludeId);
            if (!res2) return { valid: false, error: `No available ${cat2} for second half.` };

            return {
                valid: true,
                slots: [
                    { start: startAt, end: end1, resourceId: res1 },
                    { start: start2, end: end2, resourceId: res2 }
                ]
            };

        } else {
            // Single
            const category = getResourceCategoryForMenu(menu);
            let resourceId = forcedResourceId;

            // If not forced, find one
            if (!resourceId) {
                const found = findAvailableResource(category, startAt, endAt, reservations, excludeId);
                if (!found) return { valid: false, error: `No available ${category}.` };
                resourceId = found as ResourceId;
            } else {
                // Check specific resource availability
                const isBusy = reservations.some(r =>
                    r.id !== excludeId &&
                    r.resourceId === resourceId &&
                    r.status !== 'Cancelled' &&
                    isOverlapping(r.startAt, r.endAt, startAt, endAt)
                );
                if (isBusy) return { valid: false, error: `Resource ${resourceId} is busy.` };
            }

            return {
                valid: true,
                slots: [{ start: startAt, end: endAt, resourceId }]
            };
        }
    }
}));
