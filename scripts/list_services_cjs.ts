
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const services = await prisma.service.findMany({
        where: {
            OR: [
                { name: { contains: 'Massa', mode: 'insensitive' } },
                { name: { contains: 'V.I.P', mode: 'insensitive' } },
                { name: { contains: 'Special', mode: 'insensitive' } },
                { name: { contains: 'Combo', mode: 'insensitive' } }
            ]
        }
    });
    console.log("Services found:", services.map(s => s.name));
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
