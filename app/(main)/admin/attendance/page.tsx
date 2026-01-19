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
        // Default: Current Month? Or just recent 100?
        // Let's default to current month to be helpful, or just take 100 recent.
        // User asked for filters. Let's keep "Take 100" as fallback if no filter, 
        // OR better: Default to "This Month" if nothing selected?
        // Let's stick to simple "Take 100" if no specific date/month filter is active, 
        // to avoid empty screens if they haven't imported current month yet.
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
        take: (dateStr || monthStr) ? undefined : 100, // No limit if filtering by date/month
    });

    const staffList = await prisma.staff.findMany({
        orderBy: { id: 'asc' },
        select: { id: true, name: true }
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const formattedData = attendanceData.map((record: any) => ({
        ...record,
        date: record.date.toISOString().split('T')[0],
        staff: {
            name: record.staff.name
        },
        breakTime: record.breakTime || 1.0,
        overtime: record.overtime || 0,
        isOvertime: record.isOvertime || false
    }));

    return (
        <div className="min-h-screen bg-slate-900 text-slate-100 p-8">
            <div className="max-w-5xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-2xl font-bold text-[var(--primary)] tracking-widest">勤怠修正 (Attendance Correction)</h1>
                    <div className="flex gap-2">
                        <ImportButton />
                        <DeleteAllButton />
                    </div>
                </div>

                <AttendanceFilter staffList={staffList} />

                <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden mt-4">
                    <AttendanceTable initialData={formattedData} />
                </div>
            </div>
        </div>
    );
}
