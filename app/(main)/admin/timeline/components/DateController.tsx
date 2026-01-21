'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { format, addDays, subDays } from 'date-fns';

type Props = {
    date: string;
};

export default function DateController({ date }: Props) {
    const router = useRouter();
    const currentDate = new Date(date);

    const handleDateChange = (newDate: string) => {
        router.push(`/admin/timeline?date=${newDate}`);
    };

    const goPrev = () => {
        const d = subDays(currentDate, 1);
        handleDateChange(format(d, 'yyyy-MM-dd'));
    };

    const goNext = () => {
        const d = addDays(currentDate, 1);
        handleDateChange(format(d, 'yyyy-MM-dd'));
    };

    return (
        <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-lg p-1">
            <button onClick={goPrev} className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white">
                <ChevronLeft className="w-5 h-5" />
            </button>
            <input
                type="date"
                value={date}
                onChange={(e) => handleDateChange(e.target.value)}
                className="bg-transparent border-none text-slate-200 text-sm font-bold focus:ring-0 [&::-webkit-calendar-picker-indicator]:invert"
            />
            <button onClick={goNext} className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white">
                <ChevronRight className="w-5 h-5" />
            </button>
        </div>
    );
}
