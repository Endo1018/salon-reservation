
import prisma from '@/lib/db';
import PayrollTable from './PayrollTable';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function PayrollPage({ searchParams }: { searchParams: Promise<{ year?: string; month?: string }> }) {
    const today = new Date();
    const params = await searchParams;
    const year = params?.year ? parseInt(params.year) : today.getFullYear();
    const month = params?.month ? parseInt(params.month) : today.getMonth() + 1;

    // First and Last Day of Month
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0); // Last day of current month

    const staffList = await prisma.staff.findMany({
        where: { isActive: true },
        orderBy: { id: 'asc' }
    });

    const attendance = await prisma.attendance.findMany({
        where: {
            date: {
                gte: startDate,
                lte: endDate
            }
        },
        orderBy: { date: 'asc' }
    });

    const shifts = await prisma.shift.findMany({
        where: {
            date: {
                gte: startDate,
                lte: endDate
            }
        }
    });

    const adjustments = await prisma.payrollAdjustment.findMany({
        where: {
            year,
            month
        }
    });

    const { getMonthlyStaffSummary } = await import('@/app/actions/timeline');
    const timelineSummary = await getMonthlyStaffSummary(year, month);

    return (
        <div className="h-full flex flex-col p-6 overflow-hidden">
            <h1 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                <span className="text-[var(--primary)]">$</span> Payroll Management
            </h1>

            <div className="flex-1 overflow-auto bg-slate-900/50 border border-slate-800 rounded-xl p-6">
                <PayrollTable
                    staffList={staffList}
                    attendance={attendance}
                    shifts={shifts}
                    adjustments={adjustments}
                    year={year}
                    month={month}
                    timelineSummary={timelineSummary}
                />
            </div>
        </div>
    );
}
