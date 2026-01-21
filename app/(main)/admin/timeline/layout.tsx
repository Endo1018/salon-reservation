import TimelineNav from './components/TimelineNav';

export default function TimelineLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex flex-col h-full bg-slate-950 text-slate-200 relative z-0">
            <TimelineNav />
            <div className="flex-1 flex flex-col min-h-0">
                {children}
            </div>
        </div>
    );
}
