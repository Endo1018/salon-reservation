
// Consistent Staff Colors
const STAFF_COLORS = [
    'bg-purple-600', 'bg-blue-600', 'bg-emerald-600', 'bg-orange-500',
    'bg-pink-600', 'bg-cyan-600', 'bg-indigo-600', 'bg-rose-500',
    'bg-teal-600', 'bg-fuchsia-600', 'bg-sky-600', 'bg-lime-600'
];

// Deterministic color based on string
export function getStaffColorClass(name: string | null | undefined): string {
    if (!name) return 'bg-slate-500'; // Default/Unknown

    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }

    // Use abs hash mod length
    return STAFF_COLORS[Math.abs(hash) % STAFF_COLORS.length];
}

// Also export raw hex codes if needed, but Tailwind classes are preferred for consistency.
