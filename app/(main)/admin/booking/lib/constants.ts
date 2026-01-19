export const STAFF_LIST = [
    'Masuda',
    'Joy',
    'Jen',
    'Daisy',
    'Chi',
    'Lili',
    'Sam',
    'Kim'
];

export const STAFF_COLORS: Record<string, string> = {
    'Masuda': 'bg-red-200 border-red-300 text-red-900',
    'Joy': 'bg-pink-200 border-pink-300 text-pink-900',
    'Jen': 'bg-green-200 border-green-300 text-green-900',
    'Daisy': 'bg-purple-200 border-purple-300 text-purple-900',
    'Chi': 'bg-orange-200 border-orange-300 text-orange-900',
    'Lili': 'bg-teal-200 border-teal-300 text-teal-900',
    'Sam': 'bg-blue-200 border-blue-300 text-blue-900',
    'Kim': 'bg-indigo-200 border-indigo-300 text-indigo-900',
};

export const SIMPLE_MENU_OPTIONS = {
    'Head Spa': [30, 60, 75, 90, 120],
    'Aroma Room': [60, 90, 120],
    'Massage Seat': [60, 90, 120], // "Massage" in user request mapped to Massage Seat
};

export type ResourceCategoryName = 'Head Spa' | 'Aroma Room' | 'Massage Seat';
