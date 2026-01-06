import { GanttChart } from '@/components/GanttChart';
import { loadMenuData } from '@/lib/data';
import { DataInitializer } from '@/components/DataInitializer';
import { StaffAttendance } from '@/components/StaffAttendance';
import { ClearAllButton } from '@/components/ClearAllButton';

// We fetch data on server and pass to client if needed, or client fetches via API.
// For now, let's just render the Gantt Chart. Menu data loading can happen in the booking dialog or provided via Context.

export default async function Home() {
  const { menus, allStaff } = await loadMenuData();

  return (
    <main className="flex min-h-screen flex-col p-4 bg-gray-100">
      <header className="mb-4 flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Relaxation Salon Reservation</h1>
          <StaffAttendance />
        </div>
        <ClearAllButton />
      </header>

      <div className="flex-grow overflow-auto bg-white rounded-lg shadow-lg max-h-[calc(100vh-100px)]">
        <GanttChart />
      </div>

      {/* Hidden Data Hydration or Context Provider?
          We might need to pass menus/staff to the store or a context so the Booking Dialog can use them.
          Let's create a Client Component wrapper to hydrate the store or provide context.
      */}
      <DataInitializer menus={menus} staff={allStaff} />
    </main>
  );
}


