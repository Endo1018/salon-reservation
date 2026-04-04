'use client';

import { useEffect, useState, useCallback } from 'react';
import {
    getMonthlySummary,
    getMenuRanking,
    getHeatmap,
    getCancelStats,
    getChannelStats,
} from '@/app/actions/analytics';

type MonthlySummary = Awaited<ReturnType<typeof getMonthlySummary>>[number];
type MenuRow        = { menu: string; count: bigint; revenue: bigint };
type HeatmapRow     = { dow: number; hour: number; count: number };
type CancelRow      = Awaited<ReturnType<typeof getCancelStats>>[number];
type ChannelRow     = Awaited<ReturnType<typeof getChannelStats>>[number];

const DOW = ['日', '月', '火', '水', '木', '金', '土'];
const HOURS = Array.from({ length: 14 }, (_, i) => i + 8); // 8〜21時
const fmt = (n: number) => n.toLocaleString();
const fmtM = (n: number) => (n / 1_000_000).toFixed(1) + 'M';

export default function AnalyticsPage() {
    const [monthly,  setMonthly]  = useState<MonthlySummary[]>([]);
    const [menus,    setMenus]    = useState<MenuRow[]>([]);
    const [heatmap,  setHeatmap]  = useState<HeatmapRow[]>([]);
    const [cancel,   setCancel]   = useState<CancelRow[]>([]);
    const [channels, setChannels] = useState<ChannelRow[]>([]);
    const [loading,  setLoading]  = useState(true);
    const [period,   setPeriod]   = useState(6); // 表示月数

    const load = useCallback(async () => {
        setLoading(true);
        const [m, mn, hm, cs, ch] = await Promise.all([
            getMonthlySummary(),
            getMenuRanking(period),
            getHeatmap(period),
            getCancelStats(period),
            getChannelStats(period),
        ]);
        setMonthly(m);
        setMenus(mn as unknown as MenuRow[]);
        setHeatmap(hm);
        setCancel(cs);
        setChannels(ch);
        setLoading(false);
    }, [period]);

    useEffect(() => { load(); }, [load]);

    // ── ヒートマップ値 ──────────────────────────────────────────────────
    const heatCell = (dow: number, hour: number) =>
        heatmap.find(r => r.dow === dow && r.hour === hour)?.count ?? 0;
    const maxHeat = Math.max(...heatmap.map(r => r.count), 1);

    // ── 月次グラフ最大値 ────────────────────────────────────────────────
    const maxRev = Math.max(...monthly.map(r => r.revenue), 1);
    const maxBk  = Math.max(...monthly.map(r => r.bookings), 1);

    // ── チャンネル最大値 ────────────────────────────────────────────────
    const maxCh  = Math.max(...channels.map(c => c.total), 1);

    return (
        <div className="flex flex-col min-h-full bg-slate-950 text-slate-200 p-6 space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">集計ダッシュボード</h1>
                    <p className="text-xs text-slate-500 mt-1">売上・予約・チャンネル・オペレーション分析</p>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">表示期間:</span>
                    {[3, 6, 12].map(m => (
                        <button
                            key={m}
                            onClick={() => setPeriod(m)}
                            className={`px-3 py-1 rounded text-xs font-bold transition-colors ${
                                period === m
                                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                    : 'bg-slate-800 text-slate-400 hover:text-white'
                            }`}
                        >
                            {m}ヶ月
                        </button>
                    ))}
                </div>
            </div>

            {loading && <p className="text-slate-500 animate-pulse">読み込み中...</p>}

            {!loading && <>
                {/* ── 1. 月次サマリー ──────────────────────────────────── */}
                <section className="bg-slate-900 rounded-xl border border-slate-800 p-5">
                    <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">月次サマリー</h2>
                    <div className="space-y-2">
                        {monthly.slice(-period).map(m => (
                            <div key={m.month} className="grid grid-cols-[80px_1fr_90px_80px_80px_80px] items-center gap-3 text-xs">
                                <span className="font-mono text-slate-400">{m.month}</span>
                                {/* 売上バー */}
                                <div className="flex items-center gap-2">
                                    <div className="flex-1 bg-slate-800 rounded-full h-2 overflow-hidden">
                                        <div
                                            className="h-full bg-amber-500 rounded-full"
                                            style={{ width: `${(m.revenue / maxRev) * 100}%` }}
                                        />
                                    </div>
                                </div>
                                <span className="font-mono text-white text-right">{fmtM(m.revenue)}</span>
                                <span className="font-mono text-slate-400 text-right">{fmt(m.bookings)}件</span>
                                <span className="font-mono text-slate-500 text-right">{fmtM(m.avgSpend)}/件</span>
                                <span className={`font-mono text-right ${
                                    m.revGrowth == null ? 'text-slate-600' :
                                    m.revGrowth >= 0 ? 'text-emerald-400' : 'text-red-400'
                                }`}>
                                    {m.revGrowth != null ? `${m.revGrowth > 0 ? '+' : ''}${m.revGrowth}%` : '—'}
                                </span>
                            </div>
                        ))}
                    </div>
                </section>

                {/* ── 2. メニューランキング + チャンネル ────────────────── */}
                <div className="grid grid-cols-2 gap-6">
                    {/* メニュー */}
                    <section className="bg-slate-900 rounded-xl border border-slate-800 p-5">
                        <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">
                            メニュー別予約数ランキング（直近{period}ヶ月）
                        </h2>
                        <div className="space-y-2">
                            {menus.map((m, i) => {
                                const count = Number(m.count);
                                const maxCount = Number((menus[0] as any).count);
                                return (
                                    <div key={String(m.menu)} className="flex items-center gap-3 text-xs">
                                        <span className="text-slate-600 w-4 shrink-0">{i + 1}</span>
                                        <span className="text-slate-200 w-36 truncate shrink-0">{m.menu || '(不明)'}</span>
                                        <div className="flex-1 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                                            <div
                                                className="h-full bg-emerald-500 rounded-full"
                                                style={{ width: `${(count / maxCount) * 100}%` }}
                                            />
                                        </div>
                                        <span className="font-mono text-slate-300 w-10 text-right">{count}件</span>
                                    </div>
                                );
                            })}
                        </div>
                    </section>

                    {/* チャンネル */}
                    <section className="bg-slate-900 rounded-xl border border-slate-800 p-5">
                        <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">
                            チャンネル別予約（直近{period}ヶ月）
                        </h2>
                        <div className="space-y-2">
                            {channels.map(c => (
                                <div key={c.channel} className="flex items-center gap-3 text-xs">
                                    <span className="text-slate-200 w-28 truncate shrink-0">{c.channel}</span>
                                    <div className="flex-1 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                                        <div
                                            className="h-full bg-violet-500 rounded-full"
                                            style={{ width: `${(c.total / maxCh) * 100}%` }}
                                        />
                                    </div>
                                    <span className="font-mono text-slate-300 w-8 text-right">{c.total}</span>
                                    <span className={`font-mono w-10 text-right ${
                                        c.noshowRate > 20 ? 'text-red-400' :
                                        c.noshowRate > 10 ? 'text-amber-400' : 'text-slate-500'
                                    }`}>
                                        {c.noshowRate}%
                                    </span>
                                    <span className="text-slate-600 text-[10px] w-10">NS率</span>
                                </div>
                            ))}
                        </div>
                    </section>
                </div>

                {/* ── 3. ヒートマップ ──────────────────────────────────── */}
                <section className="bg-slate-900 rounded-xl border border-slate-800 p-5">
                    <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">
                        時間帯 × 曜日 予約集中度（直近{period}ヶ月）
                    </h2>
                    <div className="overflow-x-auto">
                        <table className="text-xs border-collapse">
                            <thead>
                                <tr>
                                    <th className="w-8 text-slate-600 font-mono text-right pr-2"></th>
                                    {DOW.map(d => (
                                        <th key={d} className="w-10 text-center text-slate-500 font-bold pb-1">{d}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {HOURS.map(hour => (
                                    <tr key={hour}>
                                        <td className="text-slate-600 font-mono text-right pr-2 py-0.5">{hour}時</td>
                                        {DOW.map((_, dow) => {
                                            const val = heatCell(dow, hour);
                                            const intensity = val / maxHeat;
                                            const bg = intensity === 0 ? 'bg-slate-800'
                                                : intensity < 0.25 ? 'bg-amber-900/60'
                                                : intensity < 0.5  ? 'bg-amber-700/70'
                                                : intensity < 0.75 ? 'bg-amber-500/80'
                                                : 'bg-amber-400';
                                            return (
                                                <td key={dow} className="p-0.5">
                                                    <div
                                                        className={`w-9 h-6 rounded flex items-center justify-center font-mono ${bg} ${val > 0 ? 'text-white' : 'text-slate-700'}`}
                                                        title={`${DOW[dow]}曜 ${hour}時: ${val}件`}
                                                    >
                                                        {val > 0 ? val : ''}
                                                    </div>
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>

                {/* ── 4. No-show / キャンセル率 ────────────────────────── */}
                <section className="bg-slate-900 rounded-xl border border-slate-800 p-5">
                    <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">
                        No-show / キャンセル率
                    </h2>
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead className="text-slate-500 border-b border-slate-800">
                                <tr>
                                    <th className="text-left py-2 pr-4">月</th>
                                    <th className="text-right py-2 pr-4">総予約</th>
                                    <th className="text-right py-2 pr-4">No-show</th>
                                    <th className="text-right py-2 pr-4">NS率</th>
                                    <th className="text-right py-2 pr-4">キャンセル</th>
                                    <th className="text-right py-2">CL率</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {cancel.map(r => (
                                    <tr key={r.month} className="hover:bg-slate-800/40">
                                        <td className="py-2 pr-4 font-mono text-slate-400">{r.month}</td>
                                        <td className="py-2 pr-4 text-right font-mono">{fmt(r.total)}</td>
                                        <td className="py-2 pr-4 text-right font-mono">{fmt(r.noshow)}</td>
                                        <td className={`py-2 pr-4 text-right font-mono ${r.noshowPct > 10 ? 'text-red-400' : 'text-slate-400'}`}>
                                            {r.noshowPct}%
                                        </td>
                                        <td className="py-2 pr-4 text-right font-mono">{fmt(r.cancelled)}</td>
                                        <td className={`py-2 text-right font-mono ${r.cancelPct > 10 ? 'text-red-400' : 'text-slate-400'}`}>
                                            {r.cancelPct}%
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            </>}
        </div>
    );
}
