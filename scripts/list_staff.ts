
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const staff = await prisma.staff.findMany({
        select: { id: true, name: true }
    });
    console.log('All Staff:');
    staff.forEach(s => console.log(`- '${s.name}' (${s.id})`));
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
