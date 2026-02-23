import prisma from '@/lib/db';
import { DollarSign, Users, Award, TrendingUp } from 'lucide-react';

export const dynamic = 'force-dynamic';

interface Props {
    year: number;
    month: number;
    startOfMonth: Date;
    endOfMonth: Date;
}

export default async function DashboardAnalytics({ year, month, startOfMonth, endOfMonth }: Props) {
    // 1. Calculate "Today" in UTC+7 (Vietnam Time)
    const nowUtc = new Date();
    const vnTime = new Date(nowUtc.getTime() + 7 * 60 * 60 * 1000);

    // Start and End of today in VN local time conceptually
    const startOfTodayVN = new Date(Date.UTC(vnTime.getUTCFullYear(), vnTime.getUTCMonth(), vnTime.getUTCDate(), 0, 0, 0));
    const endOfTodayVN = new Date(Date.UTC(vnTime.getUTCFullYear(), vnTime.getUTCMonth(), vnTime.getUTCDate(), 23, 59, 59, 999));

    // Convert VN day bounds to UTC to query DB cleanly
    const startOfTodayUTC = new Date(startOfTodayVN.getTime() - 7 * 60 * 60 * 1000);
    const endOfTodayUTC = new Date(endOfTodayVN.getTime() - 7 * 60 * 60 * 1000);

    // 2. Fetch Daily Bookings
    const dailyBookings = await prisma.booking.findMany({
        where: {
            startAt: { gte: startOfTodayUTC, lte: endOfTodayUTC },
            status: { notIn: ['CANCELLED', 'SYNC_DRAFT'] }
        },
        select: {
            id: true,
            totalPrice: true,
            isComboMain: true,
            comboLinkId: true,
            menuName: true
        }
    });

    // Count unique visits: standalone bookings (!comboLinkId) + the main booking of a combo (isComboMain = true)
    const dailyCustomers = dailyBookings.filter(b => !b.comboLinkId || b.isComboMain).length;
    const dailySales = dailyBookings.reduce((sum, b) => sum + (b.totalPrice || 0), 0);
    const dailyAvgSpend = dailyCustomers > 0 ? Math.round(dailySales / dailyCustomers) : 0;

    // 3. Fetch Monthly Bookings
    const monthlyBookings = await prisma.booking.findMany({
        where: {
            startAt: { gte: startOfMonth, lte: endOfMonth },
            status: { notIn: ['CANCELLED', 'SYNC_DRAFT'] }
        },
        select: {
            id: true,
            totalPrice: true,
            isComboMain: true,
            comboLinkId: true,
            menuName: true
        }
    });

    const monthlyCustomers = monthlyBookings.filter(b => !b.comboLinkId || b.isComboMain).length;
    const monthlySales = monthlyBookings.reduce((sum, b) => sum + (b.totalPrice || 0), 0);

    // 4. Calculate Top 5 Services for the Month
    const serviceStats: Record<string, { sales: number; count: number }> = {};
    monthlyBookings.forEach(b => {
        if (!b.menuName) return;
        if (!serviceStats[b.menuName]) {
            serviceStats[b.menuName] = { sales: 0, count: 0 };
        }
        serviceStats[b.menuName].sales += (b.totalPrice || 0);
        serviceStats[b.menuName].count += 1;
    });

    const topServices = Object.entries(serviceStats)
        .map(([name, stats]) => ({ name, ...stats }))
        .sort((a, b) => b.sales - a.sales)
        .slice(0, 5);

    // Formatter
    const formatJPY = (val: number) => new Intl.NumberFormat('ja-JP').format(val);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            {/* Daily Summary */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-5 shadow-lg">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-bold text-slate-400">TODAY'S SUMMARY</h2>
                    <div className="bg-sky-500/20 p-2 rounded-lg">
                        <TrendingUp className="w-5 h-5 text-sky-400" />
                    </div>
                </div>
                <div className="space-y-4">
                    <div>
                        <p className="text-xs text-slate-500 mb-1">Sales (VND)</p>
                        <p className="text-3xl font-mono font-bold text-white tracking-tight">
                            {formatJPY(dailySales)}
                        </p>
                    </div>
                    <div className="flex justify-between border-t border-slate-700 pt-3">
                        <div>
                            <p className="text-xs text-slate-500">Customers</p>
                            <p className="text-lg font-bold text-slate-200">{dailyCustomers}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-xs text-slate-500">Avg Spend</p>
                            <p className="text-lg font-bold text-slate-200">{formatJPY(dailyAvgSpend)}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Monthly Summary */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-5 shadow-lg">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-bold text-slate-400">MONTHLY SUMMARY ({year}/{month})</h2>
                    <div className="bg-emerald-500/20 p-2 rounded-lg">
                        <DollarSign className="w-5 h-5 text-emerald-400" />
                    </div>
                </div>
                <div className="space-y-4">
                    <div>
                        <p className="text-xs text-slate-500 mb-1">Total Sales (VND)</p>
                        <p className="text-3xl font-mono font-bold text-emerald-400 tracking-tight">
                            {formatJPY(monthlySales)}
                        </p>
                    </div>
                    <div className="border-t border-slate-700 pt-3">
                        <p className="text-xs text-slate-500">Total Customers</p>
                        <div className="flex items-center gap-2">
                            <Users className="w-4 h-4 text-slate-400" />
                            <p className="text-lg font-bold text-slate-200">{monthlyCustomers}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Service Ranking */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-5 shadow-lg flex flex-col">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-bold text-slate-400">TOP 5 SERVICES (SALES)</h2>
                    <div className="bg-amber-500/20 p-2 rounded-lg">
                        <Award className="w-5 h-5 text-amber-500" />
                    </div>
                </div>
                <div className="flex-1 overflow-auto">
                    {topServices.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-sm text-slate-500">
                            No sales data this month
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {topServices.map((service, idx) => (
                                <div key={service.name} className="flex justify-between items-center group">
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <div className={`w-6 h-6 rounded flex items-center justify-center text-xs font-bold shrink-0 ${idx === 0 ? 'bg-amber-500 text-amber-950' : idx === 1 ? 'bg-slate-300 text-slate-800' : idx === 2 ? 'bg-amber-700 text-amber-100' : 'bg-slate-700 text-slate-300'}`}>
                                            {idx + 1}
                                        </div>
                                        <p className="text-sm text-slate-200 truncate group-hover:text-white transition-colors" title={service.name}>
                                            {service.name}
                                        </p>
                                    </div>
                                    <div className="flex items-center shrink-0 ml-4 gap-4">
                                        <p className="text-sm text-slate-500">
                                            <span className="font-bold text-slate-300">{service.count}</span> 回
                                        </p>
                                        <p className="text-sm font-mono text-slate-400 min-w-[80px] text-right">
                                            {formatJPY(service.sales)}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
