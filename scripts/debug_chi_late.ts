
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const applyRounding = (time: string, role: string, type: 'start' | 'end') => {
    const [h, m] = time.split(':').map(Number);
    const min = h * 60 + m;

    if (role === 'RECEPTION') {
        if (type === 'start') {
            if (min >= 9 * 60 + 30 && min <= 10 * 60) return "10:00";
            if (h === 12 && m >= 40) return "13:00";
        } else {
            if (min >= 18 * 60 + 45 && min <= 19 * 60 + 10) return "19:00";
            if ((h === 21 && m >= 31) || (h === 22 && m <= 4)) return "22:00";
        }
    } else {
        // Therapist / Other
        if (type === 'start') {
            if (h === 12 && m >= 40) return "13:00";
        } else {
            if ((h === 21 && m >= 31) || (h === 22 && m <= 4)) return "22:00";
        }
    }
    return time;
};

const parseTime = (t: string | null) => {
    if (!t) return null;
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
};

async function main() {
    const chi = await prisma.staff.findFirst({ where: { name: 'CHI' } });
    if (!chi) return console.log('Chi not found');

    const start = new Date('2026-01-01T00:00:00.000Z');
    const end = new Date('2026-02-01T00:00:00.000Z');

    const shifts = await prisma.shift.findMany({
        where: {
            staffId: chi.id,
            date: { gte: start, lt: end }
        }
    });

    const attendances = await prisma.attendance.findMany({
        where: {
            staffId: chi.id,
            date: { gte: start, lt: end }
        }
    });

    let totalLate = 0;

    console.log(`Checking ${attendances.length} attendance records against ${shifts.length} shifts...`);

    attendances.forEach(att => {
        // Match shift by date
        const attDate = new Date(att.date);
        const shift = shifts.find(s => {
            const sd = new Date(s.date);
            return sd.getDate() === attDate.getDate() && sd.getMonth() === attDate.getMonth();
        });

        if (shift && shift.status === 'Confirmed') {
            const roundedShiftStart = shift.start ? applyRounding(shift.start, chi.role, 'start') : null;
            const shiftStart = parseTime(roundedShiftStart);
            const attStart = parseTime(att.start);

            if (shiftStart !== null && attStart !== null) {
                if (attStart > shiftStart) {
                    const diff = attStart - shiftStart;
                    totalLate += diff;
                    console.log(`[LATE] ${att.date.toISOString().split('T')[0]}: Shift ${shift.start}(Rounded ${roundedShiftStart}) vs Att ${att.start} -> Late ${diff} mins`);
                } else {
                    // console.log(`[OK] ${att.date.toISOString().split('T')[0]}: Shift ${shift.start} vs Att ${att.start}`);
                }
            } else {
                console.log(`[SKIP] ${att.date.toISOString().split('T')[0]}: Times null. Shift: ${shift.start}, Att: ${att.start}`);
            }
        } else {
            // console.log(`[NO MATCH/CONFIRMED SHIFT] ${att.date.toISOString().split('T')[0]}`);
        }
    });

    console.log(`Total Late: ${totalLate} mins`);
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
