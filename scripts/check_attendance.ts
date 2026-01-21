
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const records = await prisma.attendance.findMany({
        where: {
            OR: [
                { date: new Date('2026-02-14T00:00:00.000Z') },
                { date: { gte: new Date('2026-01-14T00:00:00.000Z'), lte: new Date('2026-01-20T00:00:00.000Z') } }
            ]
        },
        orderBy: { date: 'desc' },
        include: { staff: true }
    });

    console.log('Attendance Records (Last 10):');
    records.forEach(r => {
        console.log(`Date: ${r.date.toISOString().split('T')[0]}, Staff: ${r.staff.name}, Start: ${r.start}, End: ${r.end}, Break: ${r.breakTime}, WorkHours: ${r.workHours}`);
    });
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
