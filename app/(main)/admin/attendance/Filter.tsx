'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

type Staff = {
    id: string;
    name: string;
};

export default function AttendanceFilter({ staffList }: { staffList: Staff[] }) {
    const router = useRouter();
    const searchParams = useSearchParams();

    const currentStaffId = searchParams.get('staffId') || '';
    const currentDate = searchParams.get('date') || '';
    const currentMonth = searchParams.get('month') || '';

    const createQueryString = useCallback(
        (name: string, value: string) => {
            const params = new URLSearchParams(searchParams.toString());
            if (value) {
                params.set(name, value);
            } else {
                params.delete(name);
            }

            // If date is set, clear month. If month is set, clear date.
            if (name === 'date' && value) params.delete('month');
            if (name === 'month' && value) params.delete('date');

            return params.toString();
        },
        [searchParams]
    );

    const handleFilterChange = (name: string, value: string) => {
        router.push('?' + createQueryString(name, value));
    };

    return (
        <div className="flex gap-4 mb-4 bg-slate-800 p-4 rounded-xl border border-slate-700 items-center">
            {/* Staff Filter */}
            <div className="flex flex-col">
                <label className="text-xs text-slate-500 mb-1">スタッフ</label>
                <select
                    value={currentStaffId}
                    onChange={(e) => handleFilterChange('staffId', e.target.value)}
                    className="bg-slate-900 border border-slate-600 rounded p-2 text-sm text-white min-w-[150px]"
                >
                    <option value="">全員 (All)</option>
                    {staffList.map((s) => (
                        <option key={s.id} value={s.id}>
                            {s.name}
                        </option>
                    ))}
                </select>
            </div>

            {/* Month Filter */}
            <div className="flex flex-col">
                <label className="text-xs text-slate-500 mb-1">月 (Month)</label>
                <input
                    type="month"
                    value={currentMonth}
                    onChange={(e) => handleFilterChange('month', e.target.value)}
                    className="bg-slate-900 border border-slate-600 rounded p-2 text-sm text-white"
                />
            </div>

            {/* Date Filter (Optional Override) */}
            <div className="flex flex-col">
                <label className="text-xs text-slate-500 mb-1">日付指定</label>
                <input
                    type="date"
                    value={currentDate}
                    onChange={(e) => handleFilterChange('date', e.target.value)}
                    className="bg-slate-900 border border-slate-600 rounded p-2 text-sm text-white"
                />
            </div>

            <button
                onClick={() => router.push('/admin/attendance')}
                className="mt-5 text-xs text-slate-400 hover:text-white underline"
            >
                フィルター解除
            </button>
        </div>
    );
}
