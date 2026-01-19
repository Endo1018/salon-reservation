'use client';

import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { Calendar, Users, Briefcase } from 'lucide-react';

export default function NewBookingDashboard() {
    const pathname = usePathname();
    const router = useRouter();

    const tabs = [
        { name: 'Calendar', href: '/admin/booking', icon: Calendar },
        { name: 'Services', href: '/admin/booking/services', icon: Briefcase },
        { name: 'Customers', href: '/admin/booking/customers', icon: Users },
    ];

    // Simple Calendar Skeleton (Week View)
    const hours = Array.from({ length: 13 }, (_, i) => i + 10); // 10:00 - 22:00
    const dates = ['Mon 1/19', 'Tue 1/20', 'Wed 1/21', 'Thu 1/22', 'Fri 1/23', 'Sat 1/24', 'Sun 1/25'];

    return (
        <div className="flex flex-col h-full bg-slate-950 text-slate-200">
            {/* Header Tabs */}
            <div className="border-b border-slate-800 px-6 pt-4 flex gap-6">
                {tabs.map(tab => {
                    const isActive = pathname === tab.href || (tab.href !== '/admin/booking' && pathname.startsWith(tab.href));
                    const Icon = tab.icon;
                    return (
                        <Link key={tab.name} href={tab.href} className={`flex items-center gap-2 pb-3 border-b-2 text-sm font-bold transition-colors ${isActive ? 'border-[var(--primary)] text-[var(--primary)]' : 'border-transparent text-slate-500 hover:text-slate-300'
                            }`}>
                            <Icon className="w-4 h-4" />
                            {tab.name}
                        </Link>
                    );
                })}
            </div>

            {/* Content Area */}
            <div className="flex-1 p-6 overflow-hidden flex flex-col">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <span className="text-[var(--primary)]">●</span> 2026 January (New Build)
                    </h2>
                    <div className="flex gap-2">
                        <button className="px-3 py-1 bg-slate-800 rounded hover:bg-slate-700 text-xs">Today</button>
                        <button className="px-3 py-1 bg-slate-800 rounded hover:bg-slate-700 text-xs">Month</button>
                        <button className="px-3 py-1 bg-[var(--primary)] text-slate-900 font-bold rounded text-xs">Week</button>
                    </div>
                </div>

                {/* Calendar Grid Skeleton */}
                <div className="flex-1 border border-slate-800 rounded-lg overflow-auto bg-slate-900/50">
                    <div className="grid grid-cols-8 divide-x divide-slate-800 min-w-[800px]">
                        {/* Time Col */}
                        <div className="bg-slate-900/80 sticky left-0">
                            <div className="h-10 border-b border-slate-800"></div>
                            {hours.map(h => (
                                <div key={h} className="h-20 border-b border-slate-800 text-xs text-slate-500 flex items-start justify-center pt-2">
                                    {h}:00
                                </div>
                            ))}
                        </div>
                        {/* Days */}
                        {dates.map((d, i) => (
                            <div key={i} className="flex-1 min-w-[120px]">
                                <div className="h-10 border-b border-slate-800 bg-slate-900/80 text-center text-sm font-bold py-2 text-slate-300 sticky top-0">
                                    {d}
                                </div>
                                {hours.map(h => (
                                    <div key={h} className="h-20 border-b border-slate-800 hover:bg-slate-800/30 cursor-pointer relative group transition-colors">
                                        <div className="hidden group-hover:flex absolute inset-0 items-center justify-center">
                                            <span className="text-[var(--primary)] opacity-50 text-2xl">+</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
