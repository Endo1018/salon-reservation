import { prisma } from '@/lib/db';
import { getStaffColorClass } from '@/lib/staff-color-utils';

type Props = {
    date: string;
};

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

    const targetDate = new Date(`${date}T00:00:00`);

    const staff = await prisma.staff.findMany({
        where: {
            isActive: true,
            role: 'THERAPIST',
            OR: [
                { endDate: null },
                { endDate: { gte: targetDate } } // Include if ended on or after this date
            ]
        },
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

                    const colorClass = getStaffColorClass(s.name);

                    return (
                        <div key={s.id} className={`px-3 py-1 rounded-full text-xs font-bold text-white border border-white/20 shadow-sm ${colorClass}`}>
                            {s.name}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
