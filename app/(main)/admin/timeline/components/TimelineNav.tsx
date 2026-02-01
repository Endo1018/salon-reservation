'use client';

import { Calendar, Users, Briefcase, BarChart3 } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getDraftStatus } from '@/app/actions/timeline';

export default function TimelineNav() {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    // Draft check logic removed as Import List tab is moved to Sidebar.
    // If we want a badge on Timeline tab, we can keep it, but user asked to clean up.
    // Assuming badge logic was specifically for that tab so removing unused code.

    const tabs = [
        { name: 'Timeline', href: '/admin/timeline', icon: Calendar },
        { name: 'Services', href: '/admin/timeline/services', icon: Briefcase },
        { name: 'Summary', href: '/admin/timeline/summary', icon: BarChart3 },
    ];

    return (
        <div className="border-b border-slate-800 px-6 pt-4 flex gap-6 bg-slate-950">
            {tabs.map(tab => {
                const isActive = pathname === tab.href;
                return (
                    <Link
                        key={tab.name}
                        href={tab.href}
                        className={`flex items-center gap-2 pb-3 border-b-2 text-sm font-bold transition-colors ${isActive
                            ? 'border-[var(--primary)] text-[var(--primary)]'
                            : 'border-transparent text-slate-500 hover:text-slate-300'
                            }`}
                    >
                        <div className="relative flex items-center gap-2">
                            <tab.icon className="w-4 h-4" />
                            {tab.name === 'Import List' && hasDraft && (
                                <span className="absolute -top-1 -right-1 w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
                            )}
                            {tab.name}
                        </div>
                    </Link>
                );
            })}
        </div>
    );
}
