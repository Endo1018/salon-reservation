'use client';

import { useState, useEffect } from 'react';
import { getMonthlyStaffSummary } from '@/app/actions/timeline';

interface Props {
    year: number;
    month: number;
}

export default function StaffSummarySection({ year, month }: Props) {
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

    if (isLoading) return <div className="py-8 text-center text-slate-500 animate-pulse">Loading Summary...</div>;

    return (
        <div className="mb-6 bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
            <div className="bg-slate-950 px-4 py-2 border-b border-slate-800 flex justify-between items-center">
                <h2 className="text-sm font-bold text-slate-300">Staff Summary ({year}/{month})</h2>
            </div>
            <table className="w-full text-left text-sm">
                <thead className="bg-slate-950/50 text-slate-400 text-xs uppercase font-bold">
                    <tr>
                        <th className="p-3">Staff</th>
                        <th className="p-3 text-right">Count</th>
                        <th className="p-3 text-right">Mins</th>
                        <th className="p-3 text-right">Rate</th>
                        <th className="p-3 text-right">Commission</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                    {summary.map(s => (
                        <tr key={s.id} className="hover:bg-slate-800/50 transition-colors">
                            <td className="p-3 font-bold text-white">{s.name}</td>
                            <td className="p-3 text-right font-mono text-slate-400">{s.bookingCount}</td>
                            <td className="p-3 text-right font-mono text-[var(--primary)] font-bold">
                                {s.totalMinutes.toLocaleString()}
                            </td>
                            <td className="p-3 text-right font-mono text-slate-400 font-bold">
                                {s.commissionRate?.toLocaleString()}
                            </td>
                            <td className="p-3 text-right font-mono text-emerald-400 font-bold">
                                {s.totalCommission?.toLocaleString()} VND
                            </td>
                        </tr>
                    ))}
                    {summary.length === 0 && (
                        <tr>
                            <td colSpan={5} className="p-6 text-center text-slate-500">No data for this month.</td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}
