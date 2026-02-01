
import { prisma } from '@/lib/db';

async function main() {
    const services = await prisma.service.findMany({
        where: { name: { contains: 'Head Spa & Treatment', mode: 'insensitive' } }
    });

    console.log("Found Services:");
    services.forEach(s => {
        console.log(`ID: ${s.id} | Name: ${s.name} | Duration: ${s.duration} | Type: ${s.type}`);
    });
}

main();
