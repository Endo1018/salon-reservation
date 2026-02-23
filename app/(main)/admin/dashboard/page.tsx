import { getDailySummary, getMonthlySummary, getMonthlyServiceRanking } from '@/app/actions/dashboard';
import { DollarSign, Users, Award, TrendingUp, Scissors, Crown } from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
    // Fetch data from Server Actions (which query the Neon Views)
    const dailyData = await getDailySummary();
    const monthlyData = await getMonthlySummary();
    const rankingData = await getMonthlyServiceRanking();

    // The views return arrays. We'll extract the first row or aggregate if necessary.
    // The user explicitly stated column names are "totalPrice", "startAt", "menuName".
    // 1. Daily Summary Aggregation
    let dailySales = 0;
    let dailyCustomers = 0;
    
    dailyData.forEach(row => {
        // Fallbacks for aggregated column names just in case
        dailySales += Number(row.totalPrice || row.total_price || row.sales || row.sum || 0);
        dailyCustomers += Number(row.customers || row.count || row.来店数 || 1); // Defaults to 1 if it's returning raw rows
    });
    // If it returned 1 aggregated row with total=0, we should ensure customers=0 if sales=0 (simplified assumption if raw row fallback was applied)
    if (dailySales === 0 && dailyData.length <= 1 && !dailyData[0]?.count && !dailyData[0]?.customers) {
        dailyCustomers = 0;
    }
    const dailyAvg = dailyCustomers > 0 ? Math.round(dailySales / dailyCustomers) : 0;

    // 2. Monthly Summary Aggregation
    let monthlySales = 0;
    let monthlyCustomers = 0;
    
    monthlyData.forEach(row => {
        monthlySales += Number(row.totalPrice || row.total_price || row.sales || row.sum || 0);
        monthlyCustomers += Number(row.monthly_guest_count || row.customers || row.count || row.来店数 || 1);
    });
    if (monthlySales === 0 && monthlyData.length <= 1 && !monthlyData[0]?.count && !monthlyData[0]?.customers && !monthlyData[0]?.monthly_guest_count) {
        monthlyCustomers = 0;
    }

    // 3. Ranking Format
    // Format the ranking array. We expect rows with menuName, totalPrice (or sum), and a count column.
    const topServices = rankingData.map((row) => ({
        name: String(row.menuName || row.menu_name || row.menu || 'Unknown'),
        count: Number(row.count || row.service_count || row.providing_count || row.total_count || row.usage_count || 1),
        sales: Number(row.totalPrice || row.total_price || row.sales || row.sum || 0)
    })).sort((a, b) => b.sales - a.sales).slice(0, 5); // Ensure top 5

    // Helper to format VND
    const formatVND = (val: number) => new Intl.NumberFormat('ja-JP').format(val);

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-cyan-500/30">
            {/* Header */}
            <header className="sticky top-0 z-50 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800 p-4 lg:px-8 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="bg-gradient-to-br from-cyan-400 to-blue-600 w-8 h-8 rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(34,211,238,0.4)]">
                        <TrendingUp className="w-5 h-5 text-slate-950" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400 tracking-tight">WHALE<span className="font-light">MODE</span></h1>
                        <p className="text-[10px] uppercase font-bold text-cyan-400 tracking-widest leading-none">Management Cockpit</p>
                    </div>
                </div>
                <Link href="/admin" className="text-xs font-medium text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-800 px-3 py-1.5 rounded-md border border-slate-800 transition-colors">
                    Back to Admin
                </Link>
            </header>

            {/* Main Content Dashboard */}
            <main className="p-4 lg:p-8 max-w-7xl mx-auto space-y-6">
                
                {/* Top Metics Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
                    {/* DAILY CARD */}
                    <div className="bg-slate-900/50 backdrop-blur-sm rounded-2xl border border-slate-800/60 p-6 relative overflow-hidden group hover:border-cyan-500/30 transition-colors">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
                        <div className="flex items-center gap-3 mb-6">
                            <div className="bg-cyan-950 p-2.5 rounded-lg border border-cyan-900/50">
                                <DollarSign className="w-5 h-5 text-cyan-400" />
                            </div>
                            <h2 className="text-sm font-bold tracking-widest text-slate-400 uppercase">Today's Sales</h2>
                            <div className="ml-auto flex items-center gap-1.5">
                                <span className="relative flex h-2 w-2">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
                                </span>
                                <span className="text-[10px] text-cyan-400 font-mono">LIVE</span>
                            </div>
                        </div>

                        <div className="mb-6">
                            <div className="flex items-baseline gap-2">
                                <span className="text-xl font-medium text-slate-500">₫</span>
                                <p className="text-4xl lg:text-5xl font-mono font-bold text-white tracking-tighter">
                                    {formatVND(dailySales)}
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-800/60">
                            <div>
                                <p className="text-xs text-slate-500 font-medium mb-1 uppercase tracking-wider">Customers</p>
                                <div className="flex items-center gap-2">
                                    <Users className="w-4 h-4 text-cyan-500" />
                                    <p className="text-xl font-bold text-slate-200">{dailyCustomers}</p>
                                </div>
                            </div>
                            <div>
                                <p className="text-xs text-slate-500 font-medium mb-1 uppercase tracking-wider">Avg Spend</p>
                                <p className="text-xl font-mono font-bold text-cyan-400">
                                    <span className="text-sm text-slate-600 mr-1">₫</span>
                                    {formatVND(dailyAvg)}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* MONTHLY CARD */}
                    <div className="bg-slate-900/50 backdrop-blur-sm rounded-2xl border border-slate-800/60 p-6 relative overflow-hidden group hover:border-emerald-500/30 transition-colors">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
                        <div className="flex items-center gap-3 mb-6">
                            <div className="bg-emerald-950 p-2.5 rounded-lg border border-emerald-900/50">
                                <TrendingUp className="w-5 h-5 text-emerald-400" />
                            </div>
                            <h2 className="text-sm font-bold tracking-widest text-slate-400 uppercase">Monthly Sales</h2>
                        </div>

                        <div className="mb-6">
                            <div className="flex items-baseline gap-2">
                                <span className="text-xl font-medium text-slate-500">₫</span>
                                <p className="text-4xl lg:text-5xl font-mono font-bold text-transparent bg-clip-text bg-gradient-to-b from-white to-slate-300 tracking-tighter">
                                    {formatVND(monthlySales)}
                                </p>
                            </div>
                        </div>

                        <div className="pt-4 border-t border-slate-800/60">
                            <p className="text-xs text-slate-500 font-medium mb-1 uppercase tracking-wider">Total Customers</p>
                            <div className="flex items-center gap-2">
                                <Users className="w-4 h-4 text-emerald-500" />
                                <p className="text-xl font-bold text-slate-200">{monthlyCustomers}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Service Ranking */}
                <div className="bg-slate-900/50 backdrop-blur-sm rounded-2xl border border-slate-800/60 p-6">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="bg-amber-950 p-2.5 rounded-lg border border-amber-900/50">
                            <Crown className="w-5 h-5 text-amber-500" />
                        </div>
                        <h2 className="text-sm font-bold tracking-widest text-slate-400 uppercase">Monthly Top 5 Services</h2>
                    </div>

                    <div className="space-y-3">
                        {topServices.length === 0 ? (
                            <div className="py-8 text-center text-slate-500 text-sm border border-dashed border-slate-800 rounded-xl">
                                No ranking data available from the view.
                            </div>
                        ) : (
                            topServices.map((service, idx) => (
                                <div key={service.name + idx} className="flex items-center gap-3 md:gap-4 p-3 rounded-xl bg-slate-950/50 border border-slate-800/30 hover:border-amber-500/20 transition-colors">
                                    {/* Rank Badge */}
                                    <div className={`w-8 h-8 md:w-10 md:h-10 rounded-lg flex items-center justify-center shrink-0 font-bold text-sm md:text-lg
                                        ${idx === 0 ? 'bg-gradient-to-br from-amber-400 to-orange-600 text-white shadow-[0_0_10px_rgba(251,191,36,0.2)]' : 
                                            idx === 1 ? 'bg-gradient-to-br from-slate-300 to-slate-500 text-slate-900' : 
                                                idx === 2 ? 'bg-gradient-to-br from-amber-700 to-yellow-900 text-amber-100' : 
                                                    'bg-slate-800 text-slate-400 border border-slate-700'}`}>
                                        {idx === 0 ? <Crown className="w-4 h-4 md:w-5 md:h-5" /> : `#${idx + 1}`}
                                    </div>
                                    
                                    {/* Service Name */}
                                    <div className="flex-1 min-w-0 pr-2">
                                        <p className="text-sm md:text-base font-semibold text-slate-200 truncate">
                                            {service.name}
                                        </p>
                                    </div>

                                    {/* Usage Count */}
                                    <div className="text-right shrink-0">
                                        <p className="text-xs md:text-sm text-slate-400">
                                            <span className="font-bold text-slate-300">{service.count}</span>回
                                        </p>
                                    </div>

                                    {/* Revenue */}
                                    <div className="text-right shrink-0 min-w-[100px] md:min-w-[120px]">
                                        <p className="text-sm md:text-base font-mono font-bold text-amber-400">
                                            {formatVND(service.sales)}
                                        </p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Footer status text */}
                <div className="text-center pb-8 pt-4">
                    <p className="text-xs font-mono text-slate-600">
                        DATA SOURCE: NEON DB VIEWS // LIVE SYNC ACTIVE
                    </p>
                </div>
            </main>
        </div>
    );
}