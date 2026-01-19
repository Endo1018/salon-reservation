import { create } from 'zustand';
import { Menu } from '@/app/(main)/admin/booking/types';
import { supabase } from '@/app/(main)/admin/booking/lib/supabaseClient';

interface MetaStore {
    menus: Menu[];
    staff: string[];
    setMenus: (menus: Menu[]) => void;
    setStaff: (staff: string[]) => void;
    setMeta: (menus: Menu[], staff: string[]) => void;
    addStaff: (name: string) => Promise<void>;
    removeStaff: (name: string) => Promise<void>;
    fetchStaff: () => Promise<void>;
}

export const useMetaStore = create<MetaStore>((set, get) => ({
    menus: [],
    staff: [],
    setMenus: (menus) => set({ menus }),
    setStaff: (staff) => set({ staff }),
    setMeta: (menus, staff) => set({ menus, staff }),

    fetchStaff: async () => {
        const { data, error } = await supabase.from('staff').select('name').order('created_at', { ascending: true });
        if (error) {
            console.error('Error fetching staff:', error);
            return;
        }
        if (data) {
            set({ staff: data.map(s => s.name) });
        }
    },

    addStaff: async (name) => {
        const { error } = await supabase.from('staff').insert({ name });
        if (error) {
            console.error('Error adding staff:', error);
            throw error;
        }
        set((state) => ({ staff: [...state.staff, name] }));
    },

    removeStaff: async (name) => {
        const { error } = await supabase.from('staff').delete().eq('name', name);
        if (error) {
            console.error('Error removing staff:', error);
            throw error;
        }
        set((state) => ({ staff: state.staff.filter(s => s !== name) }));
    },
}));
