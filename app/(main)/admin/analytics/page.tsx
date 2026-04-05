'use client';

import { useEffect, useState, useCallback } from 'react';
import {
    getMonthlySummary,
    getCancelStats,
    getStaffPerformance,
    getLaborSummary,
} from '@/app/actions/analytics';

type MonthlySummary = Awaited<ReturnType<typeof getMonthlySummary>>[number];
type CancelRow      = Awaited<ReturnType<typeof getCancelStats>>[number];
type StaffPerfRow   = Awaited<ReturnType<typeof getStaffPerformance>>[number];
type LaborSummary   = Awaited<ReturnType<typeof getLaborSummary>>;

const fmt  = (n: number) => n.toLocaleString('ja-JP');
const fmtM = (n: number) => (n / 1_000_000).toFixed(1) + 'M';

// ── 信号機カード ─────────────────────────────────────────────────────
const TRAFFIC: Record<'red'|'yellow'|'green', string> = {
    red:    'bg-red-950/60 border-red-500/70 text-red-300',
    yellow: 'bg-amber-950/60 border-amber-500/70 text-amber-300',
    green:  'bg-emerald-950/60 border-emerald-500/70 text-emerald-300',
};

export default function AnalyticsPage() {
    const today = new Date();
    const [monthly,   setMonthly]   = useState<MonthlySummary[]>([]);
    const [cancel,    setCancel]    = useState<CancelRow[]>([]);
    const [staffPerf, setStaffPerf] = useState<StaffPerfRow[]>([]);
    const [labor,     setLabor]     = useState<LaborSummary | null>(null);
    const [loading,   setLoading]   = useState(true);
    const [selYear,   setSelYear]   = useState(today.getFullYear());
    const [selMonth,  setSelMonth]  = useState(today.getMonth() + 1);
    const [showStaff, setShowStaff] = useState(false);
    const [showTrend, setShowTrend] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        const [m, cs, sp, lb] = await Promise.all([
            getMonthlySummary(),
            getCancelStats(6),
            getStaffPerformance(selYear, selMonth),
            getLaborSummary(selYear, selMonth),
        ]);
        setMonthly(m);
        setCancel(cs as CancelRow[]);
        setStaffPerf(sp);
        setLabor(lb);
        setLoading(false);
    }, [selYear, selMonth]);

    useEffect(() => { load(); }, [load]);

    function prevMonth() {
        if (selMonth === 1) { setSelYear(y => y - 1); setSelMonth(12); }
        else setSelMonth(m => m - 1);
    }
    function nextMonth() {
        if (selMonth === 12) { setSelYear(y => y + 1); setSelMonth(1); }
        else setSelMonth(m => m + 1);
    }

    // ── 計算 ──────────────────────────────────────────────────────────
    const monthKey   = `${selYear}-${String(selMonth).padStart(2, '0')}`;
    const selRevData = monthly.find(r => r.month === monthKey);
    const selRevenue = selRevData?.revenue ?? 0;
    const bookings   = selRevData?.bookings ?? 0;

    const prevKey      = selMonth === 1
        ? `${selYear - 1}-12`
        : `${selYear}-${String(selMonth - 1).padStart(2, '0')}`;
    const prevRevData  = monthly.find(r => r.month === prevKey);
    const prevRevenue  = prevRevData?.revenue ?? 0;
    const prevBookings = prevRevData?.bookings ?? 0;

    const totalLaborCost    = labor?.totalLaborCost ?? 0;
    const proratedLaborCost = labor?.proratedLaborCost ?? 0;
    const isCurrentMonth    = labor?.isCurrentMonth ?? false;
    const elapsedDays       = labor?.elapsedDays ?? 0;
    const totalDays         = labor?.totalDays ?? 0;

    // 当月は日割りで月末見込みを算出して先月と比較
    const projectedRevenue = isCurrentMonth && elapsedDays > 0
        ? Math.round(selRevenue * totalDays / elapsedDays)
        : selRevenue;
    const compareRevenue = projectedRevenue; // 信号機・アクションに使う
    const revGrowth = prevRevenue > 0
        ? Math.round((compareRevenue - prevRevenue) / prevRevenue * 100)
        : null;

    // 比率計算：当月は日割り人件費で比較
    const effectiveLaborCost = isCurrentMonth ? proratedLaborCost : totalLaborCost;
    const laborRatio  = selRevenue > 0 ? (effectiveLaborCost / selRevenue * 100) : 0;

    // 信号機判定
    const laborLevel: 'red'|'yellow'|'green' = laborRatio > 60 ? 'red' : laborRatio > 45 ? 'yellow' : 'green';
    const growthLevel: 'red'|'yellow'|'green' = revGrowth === null ? 'green'
        : revGrowth < -10 ? 'red' : revGrowth < -5 ? 'yellow' : 'green';

    // No-show（直近月）
    const latestCancel  = cancel[cancel.length - 1];
    const noshowPct     = latestCancel?.noshowPct ?? 0;
    const noshowLevel: 'red'|'yellow'|'green' = noshowPct > 15 ? 'red' : noshowPct > 8 ? 'yellow' : 'green';

    const maxRev = Math.max(...monthly.map(r => r.revenue), 1);

    return (
        <div className="min-h-screen bg-slate-900 text-slate-100 p-6 md:p-10 space-y-8 max-w-4xl mx-auto">

            {/* ── ヘッダー ── */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">経営状況レポート</h1>
                    <p className="text-sm text-slate-400 mt-1">毎週の確認にご利用ください</p>
                </div>
                <div className="flex items-center gap-3 bg-slate-800 rounded-xl px-4 py-2">
                    <button onClick={prevMonth} className="text-slate-300 hover:text-white text-xl px-1 transition-colors">←</button>
                    <span className="font-bold text-white text-lg min-w-[80px] text-center">
                        {selYear}年{selMonth}月
                    </span>
                    <button onClick={nextMonth} className="text-slate-300 hover:text-white text-xl px-1 transition-colors">→</button>
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <p className="text-slate-400 text-lg animate-pulse">データを読み込んでいます…</p>
                </div>
            ) : <>

                {/* ── A. 信号機インジケーター ── */}
                <section>
                    <h2 className="text-base font-bold text-slate-400 mb-3 uppercase tracking-widest">今月の状況</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* 人件費比率 */}
                        <div className={`rounded-xl border-2 p-5 ${TRAFFIC[laborLevel]}`}>
                            <p className="text-sm font-medium mb-1 opacity-80">人件費の割合</p>
                            <p className="text-5xl font-bold tracking-tight">
                                {selRevenue > 0 ? `${laborRatio.toFixed(0)}%` : '—'}
                            </p>
                            <p className="text-xs mt-2 opacity-70">
                                {isCurrentMonth
                                    ? `${elapsedDays}日分の売上と比較（日割り）`
                                    : '月全体の実績'}
                            </p>
                        </div>

                        {/* 売上前月比 */}
                        <div className={`rounded-xl border-2 p-5 ${TRAFFIC[growthLevel]}`}>
                            <p className="text-sm font-medium mb-1 opacity-80">先月との売上比較</p>
                            <p className="text-5xl font-bold tracking-tight">
                                {revGrowth !== null
                                    ? `${revGrowth > 0 ? '+' : ''}${revGrowth}%`
                                    : '—'}
                            </p>
                            <p className="text-xs mt-2 opacity-70">
                                {isCurrentMonth
                                    ? `月末見込み ${fmtM(projectedRevenue)} vs 先月 ${fmtM(prevRevenue)} VND`
                                    : `先月：${fmtM(prevRevenue)} VND`}
                            </p>
                            {isCurrentMonth && (
                                <p className="text-xs mt-1 opacity-50">
                                    ※ {elapsedDays}日実績を{totalDays}日換算
                                </p>
                            )}
                        </div>

                        {/* No-show率 */}
                        <div className={`rounded-xl border-2 p-5 ${TRAFFIC[noshowLevel]}`}>
                            <p className="text-sm font-medium mb-1 opacity-80">来店キャンセル率</p>
                            <p className="text-5xl font-bold tracking-tight">
                                {latestCancel ? `${noshowPct}%` : '—'}
                            </p>
                            <p className="text-xs mt-2 opacity-70">
                                {latestCancel?.month ?? '—'} 月 / 問合せ{fmt(latestCancel?.inquiries ?? 0)}件中
                            </p>
                        </div>
                    </div>
                </section>

                {/* ── B. 核心数字 ── */}
                <section>
                    <h2 className="text-base font-bold text-slate-400 mb-3 uppercase tracking-widest">今月の数字</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* 売上 */}
                        <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
                            <p className="text-sm text-slate-400 mb-2">今月の売上</p>
                            <p className="text-4xl font-bold text-white">{fmtM(selRevenue)}</p>
                            <p className="text-sm text-slate-500 mt-1">VND</p>
                            <p className="text-xs text-slate-600 mt-2">先月：{fmtM(prevRevenue)} VND</p>
                        </div>

                        {/* 予約件数 */}
                        <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
                            <p className="text-sm text-slate-400 mb-2">今月の予約件数</p>
                            <p className="text-4xl font-bold text-white">{fmt(bookings)}</p>
                            <p className="text-sm text-slate-500 mt-1">件</p>
                            <p className="text-xs text-slate-600 mt-2">先月：{fmt(prevBookings)} 件</p>
                        </div>

                        {/* 人件費 */}
                        <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
                            <p className="text-sm text-slate-400 mb-2">今月の人件費</p>
                            <p className="text-4xl font-bold text-white">{fmtM(totalLaborCost)}</p>
                            <p className="text-sm text-slate-500 mt-1">VND（月額固定）</p>
                            {isCurrentMonth && (
                                <p className="text-xs text-slate-500 mt-2">
                                    日割り換算：{fmtM(proratedLaborCost)} VND
                                    <span className="text-slate-600">（{elapsedDays}/{totalDays}日）</span>
                                </p>
                            )}
                            <p className="text-xs text-slate-600 mt-1">{labor?.headCount ?? 0} 名分</p>
                        </div>
                    </div>
                </section>


                {/* ── D. 売上推移（折りたたみ）── */}
                <section className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                    <button
                        onClick={() => setShowTrend(v => !v)}
                        className="w-full flex items-center justify-between p-5 hover:bg-slate-700/50 transition-colors"
                    >
                        <span className="text-base font-bold text-slate-300">過去6ヶ月の売上推移</span>
                        <span className="text-slate-500 text-sm">{showTrend ? '▲ 閉じる' : '▼ 開く'}</span>
                    </button>
                    {showTrend && (
                        <div className="px-5 pb-5 space-y-2">
                            {monthly.slice(-6).map(m => (
                                <div key={m.month} className="flex items-center gap-3 text-sm">
                                    <span className="font-mono text-slate-400 w-16 shrink-0">{m.month}</span>
                                    <div className="flex-1 bg-slate-700 rounded-full h-3 overflow-hidden">
                                        <div
                                            className="h-full bg-amber-500 rounded-full transition-all"
                                            style={{ width: `${(m.revenue / maxRev) * 100}%` }}
                                        />
                                    </div>
                                    <span className="font-mono text-white w-16 text-right">{fmtM(m.revenue)}</span>
                                    <span className="font-mono text-slate-500 w-12 text-right">{fmt(m.bookings)}件</span>
                                    <span className={`font-mono w-14 text-right text-xs ${
                                        m.revGrowth == null ? 'text-slate-600'
                                        : m.revGrowth >= 0 ? 'text-emerald-400' : 'text-red-400'
                                    }`}>
                                        {m.revGrowth != null ? `${m.revGrowth > 0 ? '+' : ''}${m.revGrowth}%` : '—'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </section>

                {/* ── E. 予約・来店統計（直近3ヶ月）── */}
                <section className="bg-slate-800 rounded-xl border border-slate-700 p-5">
                    <h2 className="text-base font-bold text-slate-300 mb-4">予約・来店状況（直近3ヶ月）</h2>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="text-slate-500 border-b border-slate-700">
                                <tr>
                                    <th className="text-left py-2 pr-4">月</th>
                                    <th className="text-right py-2 pr-4">予約受付件数<br/><span className="text-xs font-normal">（問い合わせ数）</span></th>
                                    <th className="text-right py-2 pr-4">予約件数<br/><span className="text-xs font-normal">（予約日あり）</span></th>
                                    <th className="text-right py-2 pr-4">予約来店件数<br/><span className="text-xs font-normal">（来店した件数）</span></th>
                                    <th className="text-right py-2">予約来店人数<br/><span className="text-xs font-normal">（来店した人数）</span></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700/50">
                                {cancel.slice(-3).map(r => (
                                    <tr key={r.month} className="hover:bg-slate-700/30">
                                        <td className="py-3 pr-4 font-mono text-slate-400">{r.month}</td>
                                        <td className="py-3 pr-4 text-right font-mono text-slate-200">{fmt(r.inquiries)}</td>
                                        <td className="py-3 pr-4 text-right font-mono text-slate-200">{fmt(r.booked)}</td>
                                        <td className="py-3 pr-4 text-right font-mono text-slate-200">{fmt(r.came)}</td>
                                        <td className="py-3 text-right font-mono text-slate-200">{fmt(r.camePersons)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>

                {/* ── F. スタッフ別施術件数（折りたたみ）── */}
                <section className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                    <button
                        onClick={() => setShowStaff(v => !v)}
                        className="w-full flex items-center justify-between p-5 hover:bg-slate-700/50 transition-colors"
                    >
                        <span className="text-base font-bold text-slate-300">スタッフ別 施術件数</span>
                        <span className="text-slate-500 text-sm">{showStaff ? '▲ 閉じる' : '▼ 開く'}</span>
                    </button>
                    {showStaff && (
                        <div className="px-5 pb-5">
                            <table className="w-full text-sm">
                                <thead className="text-slate-500 border-b border-slate-700">
                                    <tr>
                                        <th className="text-left py-2 pr-4">スタッフ</th>
                                        <th className="text-right py-2 pr-4">施術件数</th>
                                        <th className="text-right py-2 pr-4">稼働時間</th>
                                        <th className="text-right py-2">コミッション等</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800">
                                    {staffPerf.length === 0 ? (
                                        <tr><td colSpan={4} className="py-4 text-center text-slate-600">データなし</td></tr>
                                    ) : staffPerf.map(s => (
                                        <tr key={s.staffId} className="hover:bg-slate-700/30">
                                            <td className="py-2 pr-4 text-slate-200 font-medium">{s.staffName}</td>
                                            <td className="py-2 pr-4 text-right font-mono text-slate-300">{s.count} 件</td>
                                            <td className="py-2 pr-4 text-right font-mono text-slate-400">{s.workHours}h</td>
                                            <td className="py-2 text-right font-mono text-cyan-400">
                                                {s.commission > 0 ? `${fmtM(s.commission)} VND` : '—'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>

            </>}
        </div>
    );
}
