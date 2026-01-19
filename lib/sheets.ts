import prisma from './db';

// Types (Keep consistent with UI)
export interface Staff {
    id: string;
    name: string;
    role: string;
    base_wage: number;
}

export interface Shift {
    date: string; // ISO String
    status: string;
    start: string;
    end: string;
}

export interface Attendance {
    date: string;
    start: string;
    end: string;
    work_hours: number;
    overtime_hours: number;
    status: string;
}

// Functions replaced with Prisma Calls

export async function getStaffList(): Promise<Staff[]> {
    try {
        const staff = await prisma.staff.findMany({
            where: { isActive: true }
        });
        return staff.map(s => ({
            id: s.id,
            name: s.name,
            role: s.role,
            base_wage: s.baseWage
        }));
    } catch (error) {
        console.error('DB Error:', error);
        return [];
    }
}

export async function getShifts(staffId: string): Promise<Shift[]> {
    try {
        const shifts = await prisma.shift.findMany({
            where: { staffId },
            orderBy: { date: 'asc' }
        });
        return shifts.map(s => ({
            date: s.date.toISOString().split('T')[0],
            status: s.status,
            start: s.start || '',
            end: s.end || ''
        }));
    } catch (error) {
        console.error('DB Error:', error);
        return [];
    }
}

export async function getAttendance(staffId: string): Promise<Attendance[]> {
    try {
        const attendance = await prisma.attendance.findMany({
            where: { staffId },
            orderBy: { date: 'asc' }
        });
        return attendance.map(a => ({
            date: a.date.toISOString().split('T')[0],
            start: a.start || '',
            end: a.end || '',
            work_hours: a.workHours,
            overtime_hours: a.overtime, // Renamed from overtimeHours
            break_time: a.breakTime, // Added
            status: a.status
        }));
    } catch (error) {
        console.error('DB Error:', error);
        return [];
    }
}
