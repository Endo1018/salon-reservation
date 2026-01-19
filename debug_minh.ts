import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const minh = await prisma.staff.findFirst({
        where: { name: 'Minh' }
    });

    if (!minh) {
        console.log('Minh not found');
        return;
    }

    console.log(`Minh ID: ${minh.id}, Role: ${minh.role}`);

    const start = new Date('2026-01-01T00:00:00Z');
    const end = new Date('2026-02-01T00:00:00Z');

    const shifts = await prisma.shift.findMany({
        where: {
            staffId: minh.id,
            date: { gte: start, lt: end }
        },
        orderBy: { date: 'asc' }
    });

    const attendance = await prisma.attendance.findMany({
        where: {
            staffId: minh.id,
            date: { gte: start, lt: end }
        },
        orderBy: { date: 'asc' }
    });

    console.log('--- Shifts ---');
    shifts.forEach(s => {
        console.log(`Date: ${s.date.toISOString()}, Status: ${s.status}, Start: ${s.start}, End: ${s.end}`);
    });

    console.log('--- Attendance ---');
    attendance.forEach(a => {
        console.log(`Date: ${a.date.toISOString()}, Start: ${a.start}, End: ${a.end}`);
    });

    console.log('--- Matching & Late Calc ---');
    attendance.forEach(att => {
        const d = new Date(att.date);
        const shift = shifts.find(s => {
            const sd = new Date(s.date);
            return sd.getDate() === d.getDate() && sd.getMonth() === d.getMonth();
        });

        if (shift) {
            const shiftStart = parseTime(shift.start);
            const attStart = parseTime(att.start);
            let lateness = 0;
            if (shiftStart !== null && attStart !== null && attStart > shiftStart) {
                lateness = attStart - shiftStart;
            }
            console.log(`Day ${d.getDate()}: Shift ${shift.start} vs Att ${att.start}. Late: ${lateness} mins`);
        } else {
            console.log(`Day ${d.getDate()}: No Shift Found`);
        }
    });
}

const parseTime = (t: string | null) => {
    if (!t) return null;
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
};

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
