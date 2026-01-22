import prisma from '@/lib/db';
import AttendanceTable from './table';
import ImportButton from './ImportButton';
import DeleteAllButton from './DeleteAllButton';
import AttendanceFilter from './Filter';

export const dynamic = 'force-dynamic';

export default async function AttendanceManagementPage({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
    const params = await searchParams;
    const staffId = typeof params.staffId === 'string' ? params.staffId : undefined;
    const dateStr = typeof params.date === 'string' ? params.date : undefined;
    const monthStr = typeof params.month === 'string' ? params.month : undefined;

    // Build Where Clause
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    console.log('[AttendancePage] Params:', { staffId, dateStr, monthStr });

    if (staffId) {
        where.staffId = staffId;
    }

    if (dateStr) {
        // Specific Date
        // Prisma stores dates as Date objects at UTC midnight usually (from our other logic)
        // But simply filtering by date range for that day is safer.
        const start = new Date(dateStr);
        const end = new Date(dateStr);
        end.setDate(end.getDate() + 1);
        where.date = {
            gte: start,
            lt: end,
        };
    } else if (monthStr) {
        // Month Filter (YYYY-MM)
        const [y, m] = monthStr.split('-').map(Number);
        const start = new Date(Date.UTC(y, m - 1, 1));
        const end = new Date(Date.UTC(y, m, 1));
        where.date = {
            gte: start,
            lt: end,
        };
    } else {
        // Default: Current Month
        const now = new Date();
        const y = now.getFullYear();
        const m = now.getMonth(); // 0-indexed
        const start = new Date(Date.UTC(y, m, 1));
        const end = new Date(Date.UTC(y, m + 1, 1));
        where.date = {
            gte: start,
            lt: end,
        };
    }

    // Filter out "Off" and Empty records ("-")
    // User request: "OFFまたは"-"は表示しないで"
    where.AND = [
        { status: { not: 'Off' } },
        {
            OR: [
                { start: { not: null } },
                { end: { not: null } }
            ]
        }
    ];

    const attendanceData = await prisma.attendance.findMany({
        where,
        orderBy: [
            { date: 'desc' },
            { staffId: 'asc' }
        ],
        include: { staff: true },
        // No limit, relying on date filter
    });

    // Fetch Shifts for calculation
    // Reuse the 'where' clause but adapted? 
    // The 'where' usually filters by date range and staffId, which is compatible with Shift.
    // However, 'where' has "status: { not: 'Off' }" which might differ for Shift.
    // Let's rely on finding shifts by ID/Date from the fetched attendance list to be precise.
    const dateList = attendanceData.map(a => a.date);
    const staffIdList = attendanceData.map(a => a.staffId);

    const shifts = await prisma.shift.findMany({
        where: {
            staffId: { in: staffIdList },
            date: { in: dateList }
        }
    });

    const staffList = await prisma.staff.findMany({
        orderBy: { id: 'asc' },
        select: { id: true, name: true }
    });

    // Helper for Time Calc
    const parseTime = (t: string) => {
        if (!t) return 0;
        const [h, m] = t.split(':').map(Number);
        return h * 60 + m;
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const formattedData = attendanceData.map((record: any) => {
        const shift = shifts.find(s => s.staffId === record.staffId && s.date.toISOString() === record.date.toISOString());

        // Late / Early Calc
        let lateMins = 0;
        let earlyMins = 0;

        if (shift && shift.start && shift.end && record.start && record.end) {
            const sStart = parseTime(shift.start);
            const aStart = parseTime(record.start);
            const sEnd = parseTime(shift.end);
            const aEnd = parseTime(record.end);

            lateMins = Math.max(0, aStart - sStart);
            earlyMins = Math.max(0, sEnd - aEnd);
        }

        return {
            ...record,
            date: record.date.toISOString().split('T')[0],
            staff: {
                name: record.staff.name
            },
            breakTime: record.breakTime || 1.0,
            overtime: record.overtime || 0,
            isOvertime: record.isOvertime || false,
            lateMins,
            earlyMins,
            shiftStart: shift?.start || null,
            shiftEnd: shift?.end || null
        };
    });

    return (
        <div className="min-h-screen bg-slate-900 text-slate-100 p-8">
            <div className="max-w-5xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-2xl font-bold text-[var(--primary)] tracking-widest">勤怠修正 (Attendance Correction)</h1>
                    {/* Buttons moved to Shift Management Page */}
                </div>

                <AttendanceFilter staffList={staffList} />

                <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden mt-4">
                    <AttendanceTable initialData={formattedData} />
                </div>
            </div>
        </div>
    );
}
