import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    // Clear existing data
    await prisma.attendance.deleteMany();
    await prisma.shift.deleteMany();
    await prisma.staff.deleteMany();

    // 1. Create Staff
    const staff1 = await prisma.staff.create({
        data: {
            id: 'S001',
            name: 'Hanako Yamada',
            role: 'THERAPIST',
            baseWage: 50000,
            commissionRate: 60000,
            isActive: true,
        },
    });

    const staff2 = await prisma.staff.create({
        data: {
            id: 'S002',
            name: 'Taro Sato',
            role: 'RECEPTION',
            baseWage: 40000,
            incentiveRate: 30000,
            isActive: true,
        },
    });

    console.log('Created Staff:', staff1.name, staff2.name);

    // 2. Create Shifts (This Month)
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth(); // 0-indexed

    // Shift 1
    await prisma.shift.create({
        data: {
            staffId: 'S001',
            date: new Date(year, month, 1),
            status: 'Confirmed',
            start: '10:00',
            end: '19:00',
        },
    });

    // Shift 2
    await prisma.shift.create({
        data: {
            staffId: 'S001',
            date: new Date(year, month, 2),
            status: 'Off',
        },
    });

    // 3. Create Attendance (Past)
    await prisma.attendance.create({
        data: {
            staffId: 'S001',
            date: new Date(year, month, 1),
            start: '09:55',
            end: '19:05',
            workHours: 8.0,
            perfHours: 5.0, // 5 hours treatment
            status: 'Normal',
        },
    });

    console.log('Seeding finished.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
