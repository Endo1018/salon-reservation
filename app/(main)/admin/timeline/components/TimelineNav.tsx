'use client';

import { Calendar, Users, Briefcase, BarChart3 } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function TimelineNav() {
    const pathname = usePathname();

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
                        <tab.icon className="w-4 h-4" />
                        {tab.name}
                    </Link>
                );
            })}
        </div>
    );
}
