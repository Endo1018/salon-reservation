const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function deleteKimAttendance() {
    // Find KIM's staff ID
    const kim = await prisma.staff.findFirst({ where: { name: 'KIM' } });
    if (!kim) {
        console.log('KIM not found');
        return;
    }
    console.log('KIM ID:', kim.id);

    // Delete attendance for 2/5 and 2/9
    const result = await prisma.attendance.deleteMany({
        where: {
            staffId: kim.id,
            OR: [
                { date: new Date('2026-02-05') },
                { date: new Date('2026-02-09') }
            ]
        }
    });
    console.log('Deleted:', result.count, 'records');
}

deleteKimAttendance().then(() => prisma.$disconnect());
