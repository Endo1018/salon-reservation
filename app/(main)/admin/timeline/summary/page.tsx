'use client';

import { useState, useEffect } from 'react';
import { getMonthlyStaffSummary } from '@/app/actions/timeline';
import { format } from 'date-fns';

export default function SummaryPage() {
    const today = new Date();
    const [year, setYear] = useState(today.getFullYear());
    const [month, setMonth] = useState(today.getMonth() + 1);
    const [summary, setSummary] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, [year, month]);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const data = await getMonthlyStaffSummary(year, month);
            setSummary(data);
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    const handlePrevMonth = () => {
        if (month === 1) {
            setYear(y => y - 1);
            setMonth(12);
        } else {
            setMonth(m => m - 1);
        }
    };

    const handleNextMonth = () => {
        if (month === 12) {
            setYear(y => y + 1);
            setMonth(1);
        } else {
            setMonth(m => m + 1);
        }
    };

    return (
        <div className="flex-1 bg-slate-950 p-6 overflow-auto text-slate-200">
            <header className="flex items-center justify-between mb-8">
                <h1 className="text-2xl font-bold text-white">月次スタッフ集計</h1>
                <div className="flex items-center gap-4 bg-slate-900 p-2 rounded-lg border border-slate-800">
                    <button onClick={handlePrevMonth} className="p-2 hover:bg-slate-800 rounded">←</button>
                    <span className="font-bold w-32 text-center text-lg">{year} / {month.toString().padStart(2, '0')}</span>
                    <button onClick={handleNextMonth} className="p-2 hover:bg-slate-800 rounded">→</button>
                </div>
            </header>

            {isLoading ? (
                <div className="text-center py-20 text-slate-500">読み込み中...</div>
            ) : (
                <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
                    <table className="w-full text-left">
                        <thead className="bg-slate-950 text-slate-400 text-xs uppercase font-bold">
                            <tr>
                                <th className="p-4">スタッフ名</th>
                                <th className="p-4 text-right">施術回数</th>
                                <th className="p-4 text-right">施術時間 (分)</th>
                                <th className="p-4 text-right">レート</th>
                                <th className="p-4 text-right">コミッション</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {summary.map(s => {
                                return (
                                    <tr key={s.id} className="hover:bg-slate-800/50 transition-colors">
                                        <td className="p-4 font-bold text-white">{s.name}</td>
                                        <td className="p-4 text-right font-mono text-slate-400">{s.bookingCount}</td>
                                        <td className="p-4 text-right font-mono text-[var(--primary)] font-bold">
                                            {s.totalMinutes.toLocaleString()}
                                        </td>
                                        <td className="p-4 text-right font-mono text-slate-400 font-bold">
                                            {s.commissionRate?.toLocaleString()}
                                        </td>
                                        <td className="p-4 text-right font-mono text-emerald-400 font-bold">
                                            {s.totalCommission?.toLocaleString()} VND
                                        </td>
                                    </tr>
                                );
                            })}
                            {summary.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="p-8 text-center text-slate-500">この月のデータはありません。</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
