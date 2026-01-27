
import prisma from '@/lib/db';

async function main() {
    const staffName = 'LILI';
    // Find staff first
    const staff = await prisma.staff.findFirst({
        where: { name: { contains: staffName, mode: 'insensitive' } }
    });

    if (!staff) {
        console.log('Staff LILI not found');
        return;
    }

    const date = new Date(Date.UTC(2026, 0, 20)); // Jan 20, 2026

    const attendance = await prisma.attendance.findFirst({
        where: {
            staffId: staff.id,
            date: date
        }
    });

    const shift = await prisma.shift.findFirst({
        where: {
            staffId: staff.id,
            date: date
        }
    });

    console.log('Staff:', staff.name, staff.id);
    console.log('Attendance:', attendance);
    console.log('Shift:', shift);

    // Calc late manually to verify
    if (attendance?.start && shift?.start) {
        const [ah, am] = attendance.start.split(':').map(Number);
        const [sh, sm] = shift.start.split(':').map(Number);
        const attMin = ah * 60 + am;
        const shiftMin = sh * 60 + sm;
        console.log(`Att: ${attMin}, Shift: ${shiftMin}, Diff: ${attMin - shiftMin}`);
    }
}

main();
