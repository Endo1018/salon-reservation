import { GanttChart } from '@/app/(main)/admin/booking/components/GanttChart';
import { loadMenuData } from '@/app/(main)/admin/booking/lib/data';
import { DataInitializer } from '@/app/(main)/admin/booking/components/DataInitializer';
import { StaffAttendance } from '@/app/(main)/admin/booking/components/StaffAttendance';
import { ClearAllButton } from '@/app/(main)/admin/booking/components/ClearAllButton';

// We fetch data on server and pass to client if needed, or client fetches via API.
// For now, let's just render the Gantt Chart. Menu data loading can happen in the booking dialog or provided via Context.

export default async function Home() {
  const { menus } = await loadMenuData(); // Ignore allStaff from CSV
  const { getStaffShifts } = await import('@/app/actions/booking');
  const { staffNames } = await getStaffShifts(new Date());

  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-200 p-6">
      <header className="mb-6 flex justify-between items-center border-b border-slate-700 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Reservation Management</h1>
          <StaffAttendance />
        </div>
        <ClearAllButton />
      </header>

      <div className="flex-grow overflow-auto bg-slate-800 rounded-xl border border-slate-700 shadow-xl">
        <GanttChart />
      </div>

      <DataInitializer menus={menus} staff={staffNames} />
    </div>
  );
}


