
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const dateQuery = '2026-01-18';

    // Find Chi
    const chi = await prisma.staff.findFirst({
        where: { name: { contains: 'Chi' } }
    });

    if (!chi) {
        console.log("Staff 'Chi' not found.");
        return;
    }
    console.log(`Found Staff: ${chi.name} (${chi.id})`);

    // Get Shift
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
    // Attendance date is stored as string 'YYYY-MM-DD' usually? Or Date object?
    // Schema says `date String` or `date DateTime`? Let's check schema/view_file later if unsure.
    // Based on `table.tsx` earlier: `date: string; // Formatted String`. 
    // Wait, DB schema usually uses specific types.
    // Let's check `Attendance` table model via finding it or just assuming `date` is DateTime due to typical Prisma patterns, OR simply string.
    // Actually `table.tsx` line 9 says `date: string`. But that's the simplified type `Rec`.
    // Let's assume `date` field in DB is DateTime or String.

    // Let's try finding by date range on `date` field if it's DateTime, or exact string match if String.
    // Re-checking `table.tsx`... `rec.date` comes from `initialData`.
    // Let's look at `schema.prisma` if needed, but I'll try querying many.

    const attendances = await prisma.attendance.findMany({
        where: {
            staffId: chi.id,
            // Try broad search or assume table structure
            // If date is DateTime
            // date: { gte: startOfDay, lte: endOfDay } 
            // If date is String "YYYY-MM-DD"
            // date: dateQuery
        }
    });

    // Filter manually if needed
    const att = attendances.find(a => {
        // Handle different date storage types dynamically for debug
        if (a.date instanceof Date) {
            return a.date.toISOString().startsWith(dateQuery);
        }
        return a.date === dateQuery;
    });

    console.log('Attendance:', att);
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
