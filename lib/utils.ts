import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { parseISO, format, addMinutes, isBefore, isAfter, isEqual } from 'date-fns';
import { Menu, Resource, ResourceCategory, RESOURCES } from '@/types';

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

// Time helpers
export function isOverlapping(startA: string, endA: string, startB: string, endB: string): boolean {
    const sA = new Date(startA).getTime();
    const eA = new Date(endA).getTime();
    const sB = new Date(startB).getTime();
    const eB = new Date(endB).getTime();
    return sA < eB && sB < eA;
}

export function getResourceCategoryForMenu(menu: Menu): ResourceCategory {
    const lowerName = menu.name.toLowerCase();

    // Aroma rule: Aroma categories always use Aroma Room
    if (menu.category === 'Aroma' || lowerName.includes('aroma')) return 'Aroma Room';

    // Head Spa / Facial rule: "フェイシャルとヘッドスパはヘッドスパの席"
    if (menu.category === 'Headspa' || lowerName.includes('head spa') || lowerName.includes('facial') || lowerName.includes('treatment')) {
        return 'Head Spa';
    }

    // Default rule: "アロマ以外はマッサージの席"
    return 'Massage Seat';
}

// Logic for Combo Menu resource requirement
// Returns [FirstResourceCategory, SecondResourceCategory]
export function getComboResourceCategories(menu: Menu): [ResourceCategory, ResourceCategory] {
    // Current Rule: First part is Body (Aroma or Massage), Second part is always Head Spa
    let firstCategory: ResourceCategory = 'Massage Seat';
    if (menu.name.toUpperCase().includes('AROMA')) firstCategory = 'Aroma Room';

    return [firstCategory, 'Head Spa'];
}

export function findAvailableResource(
    category: ResourceCategory,
    start: string,
    end: string,
    reservations: any[],
    excludeId?: string
): string | null {
    const candidates = RESOURCES.filter(r => r.category === category);

    for (const resource of candidates) {
        const isBusy = reservations.some(r =>
            r.id !== excludeId && // Exclude self
            r.resourceId === resource.id &&
            r.status !== 'Cancelled' &&
            isOverlapping(r.startAt, r.endAt, start, end)
        );
        if (!isBusy) return resource.id;
    }

    return null;
}

export const STAFF_COLORS_PALETTE = [
    'bg-rose-500 border-rose-600 text-white shadow-sm',
    'bg-blue-500 border-blue-600 text-white shadow-sm',
    'bg-emerald-500 border-emerald-600 text-white shadow-sm',
    'bg-amber-500 border-amber-600 text-white shadow-sm',
    'bg-violet-500 border-violet-600 text-white shadow-sm',
    'bg-orange-500 border-orange-600 text-white shadow-sm',
    'bg-cyan-500 border-cyan-600 text-white shadow-sm',
    'bg-fuchsia-500 border-fuchsia-600 text-white shadow-sm',
    'bg-lime-500 border-lime-600 text-black shadow-sm',
    'bg-indigo-500 border-indigo-600 text-white shadow-sm',
    'bg-yellow-400 border-yellow-500 text-black shadow-sm',
    'bg-teal-500 border-teal-600 text-white shadow-sm',
    'bg-pink-500 border-pink-600 text-white shadow-sm',
    'bg-sky-500 border-sky-600 text-white shadow-sm',
    'bg-red-600 border-red-700 text-white shadow-sm',
    'bg-indigo-900 border-black text-white shadow-sm',
];

export const getStaffColor = (name: string) => {
    if (name === 'Unassigned') return "bg-gray-400 border-gray-500 text-white";
    // Deterministic hash based on name
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % STAFF_COLORS_PALETTE.length;
    return STAFF_COLORS_PALETTE[index];
};
