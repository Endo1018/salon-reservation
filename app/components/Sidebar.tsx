'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Sidebar() {
    const pathname = usePathname();
    const isAdmin = pathname.startsWith('/admin');

    // Define menu items based on context
    const adminMenu = [
        { name: 'Dashboard', href: '/admin', icon: 'home' },
        { name: 'Staff', href: '/admin/staff', icon: 'users' },
        { name: 'Shifts', href: '/admin/shifts', icon: 'calendar' },
        { name: 'Attendance', href: '/admin/attendance', icon: 'clock' },
        { name: 'Payroll', href: '/admin/payroll', icon: 'money' },
        { name: 'Booking', href: '/admin/booking', icon: 'book' },
    ];

    const staffMenu = [
        { name: 'My Dashboard', href: '#', icon: 'user' }, // Dynamic link handling is complex here, keeping simple for UI demo
    ];

    const menu = isAdmin ? adminMenu : staffMenu;

    return (
        <aside className="fixed left-0 top-0 h-full w-64 bg-slate-900 border-r border-slate-800 text-slate-300 flex flex-col z-50">
            {/* Brand */}
            <div className="p-6 border-b border-slate-800">
                <h1 className="text-xl font-bold tracking-widest text-white flex items-center gap-2">
                    <span className="text-[var(--primary)]">✦</span> ANTIGRAVITY
                </h1>
            </div>

            {/* Navigation */}
            <nav className="flex-1 py-6 px-3 space-y-2">
                {menu.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                        <Link
                            key={item.name}
                            href={item.href}
                            className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors
                ${isActive
                                    ? 'bg-[var(--primary)] text-slate-900 shadow-lg shadow-[var(--primary)]/20'
                                    : 'hover:bg-slate-800 hover:text-white'
                                }`}
                        >
                            {/* Simple Icon Placeholder */}
                            <span className={`material-icons-outlined text-lg ${isActive ? 'text-slate-900' : 'text-slate-500'}`}>
                                {item.icon === 'home' && '⌂'}
                                {item.icon === 'users' && '☺'}
                                {item.icon === 'calendar' && '▦'}
                                {item.icon === 'clock' && '◔'}
                                {item.icon === 'money' && '$'}
                                {item.icon === 'book' && '📖'}
                                {item.icon === 'user' && '☃'}
                            </span>
                            {item.name}
                        </Link>
                    );
                })}
            </nav>

            {/* Footer / User Info */}
            <div className="p-4 border-t border-slate-800 bg-slate-900/50">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-white">
                        ADM
                    </div>
                    <div>
                        <p className="text-xs font-bold text-white">Admin User</p>
                        <Link href="/" className="text-[10px] text-slate-500 hover:text-white">Logout</Link>
                    </div>
                </div>
            </div>
        </aside>
    );
}
