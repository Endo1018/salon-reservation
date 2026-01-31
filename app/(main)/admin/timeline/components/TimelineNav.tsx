'use client';

import { Calendar, Users, Briefcase, BarChart3 } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getDraftStatus } from '@/app/actions/timeline';

export default function TimelineNav() {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [hasDraft, setHasDraft] = useState(false);

    useEffect(() => {
        const checkDraft = async () => {
            let year = new Date().getFullYear();
            let month = new Date().getMonth() + 1;

            const dateParam = searchParams.get('date');
            if (dateParam) {
                const d = new Date(dateParam);
                if (!isNaN(d.getTime())) {
                    year = d.getFullYear();
                    month = d.getMonth() + 1;
                }
            } else {
                // Default to current month if no param
                // Could be improved to check context, but good enough for badge
            }

            try {
                const status = await getDraftStatus(year, month);
                setHasDraft(status);
            } catch (e) {
                console.error(e);
            }
        };
        checkDraft();
    }, [searchParams, pathname]);

    const tabs = [
        { name: 'Timeline', href: '/admin/timeline', icon: Calendar },
        { name: 'Services', href: '/admin/timeline/services', icon: Briefcase },
        { name: 'Summary', href: '/admin/timeline/summary', icon: BarChart3 },
        { name: 'Import List', href: '/admin/import-list', icon: Calendar },
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
