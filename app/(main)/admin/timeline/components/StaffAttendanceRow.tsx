import { prisma } from '@/lib/db';

type Props = {
    date: string;
};

// Simple hash function for color
function getStaffColor(name: string) {
    const colors = [
        'bg-pink-500', 'bg-purple-500', 'bg-indigo-500', 'bg-blue-500',
        'bg-cyan-500', 'bg-teal-500', 'bg-emerald-500', 'bg-green-500',
        'bg-lime-500', 'bg-orange-500', 'bg-rose-500'
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
}

export default async function StaffAttendanceRow({ date }: Props) {
    // Fetch staff shifts
    const shifts = await prisma.shift.findMany({
        where: {
            date: {
                gte: new Date(`${date}T00:00:00`),
                lte: new Date(`${date}T23:59:59`)
            },
            status: { not: 'OFF' } // Simple filter
        },
        include: { staff: true }
    });

    // Also fetch staff who don't have a shift record but are active?
    // Policy: If no shift record, assume default presence? Or require shift?
    // Let's stick to showing explicitly available people or all active staff with status.
    // User image shows a list of names. Let's fetch all active Therapists.

    const staff = await prisma.staff.findMany({
        where: { isActive: true, role: 'THERAPIST' },
        include: {
            shifts: {
                where: {
                    date: {
                        gte: new Date(`${date}T00:00:00`),
                        lte: new Date(`${date}T23:59:59`)
                    }
                }
            }
        }
    });

    return (
        <div className="flex items-center gap-4 py-2 px-1 text-sm border-b border-slate-800 bg-slate-900/50">
            <span className="text-slate-500 font-bold text-xs uppercase tracking-wider">Staff Attendance:</span>
            <div className="flex flex-wrap gap-2">
                {staff.map(s => {
                    const shift = s.shifts[0];
                    const status = shift?.status?.toUpperCase();
                    const isOff = status === 'OFF' || status === 'AL' || status === 'HOLIDAY';

                    if (isOff) return null; // Logic: Don't show absent staff

                    return (
                        <div key={s.id} className="px-3 py-1 rounded-full text-xs font-bold text-slate-200 bg-slate-700 border border-slate-600 shadow-sm">
                            {s.name}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
