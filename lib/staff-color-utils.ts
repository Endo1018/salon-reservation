
// Consistent Staff Colors
const STAFF_COLORS = [
    'bg-purple-600', 'bg-blue-600', 'bg-emerald-600', 'bg-orange-500',
    'bg-pink-600', 'bg-cyan-600', 'bg-indigo-600', 'bg-rose-500',
    'bg-teal-600', 'bg-fuchsia-600', 'bg-sky-600', 'bg-lime-600'
];

// Explicit Staff Colors to prevent collisions
const STAFF_COLOR_MAP: Record<string, string> = {
    'KIM': 'bg-orange-500',
    'LILI': 'bg-blue-600',
    'CHI': 'bg-emerald-600',
    'JOY': 'bg-purple-600',
    'Daisy': 'bg-pink-600',
    'Sam': 'bg-cyan-600',
    'JEN': 'bg-lime-600',
    'Massa': 'bg-indigo-600',
    'TOKIO': 'bg-rose-500'
};

// Deterministic color based on string
export function getStaffColorClass(name: string | null | undefined): string {
    if (!name) return 'bg-slate-500'; // Default/Unknown

    // Check explicit map (case-insensitive key match if needed, but names are usually consistent)
    // Using exact match first
    if (STAFF_COLOR_MAP[name]) return STAFF_COLOR_MAP[name];

    // Case insensitive fallback
    const upper = name.toUpperCase();
    for (const key in STAFF_COLOR_MAP) {
        if (key.toUpperCase() === upper) return STAFF_COLOR_MAP[key];
    }

    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }

    // Use abs hash mod length
    return STAFF_COLORS[Math.abs(hash) % STAFF_COLORS.length];
}

// Also export raw hex codes if needed, but Tailwind classes are preferred for consistency.
