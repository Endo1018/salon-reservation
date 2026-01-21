
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const dateQuery = '2026-01-18';

    // Use exact name 'CHI'
    const chi = await prisma.staff.findFirst({
        where: { name: 'CHI' }
    });

    if (!chi) {
        console.log("Staff 'CHI' not found.");
        return;
    }
    console.log(`Found Staff: ${chi.name} (${chi.id})`);

    // Get Shift (10:00 - 20:00 is standard? we'll see)
    const startOfDay = new Date(`${dateQuery}T00:00:00.000Z`);
    const endOfDay = new Date(`${dateQuery}T23:59:59.999Z`);

    const shift = await prisma.shift.findFirst({
        where: {
            staffId: chi.id,
            date: {
                gte: startOfDay,
                lte: endOfDay
            }
        }
    });
    console.log('Shift:', shift);

    // Get Attendance
    // Assuming date field is 'YYYY-MM-DD' String based on previous table inspection
    const att = await prisma.attendance.findFirst({
        where: {
            staffId: chi.id,
            date: dateQuery
        }
    });

    console.log('Attendance:', att);
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
