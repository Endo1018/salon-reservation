
import { prisma } from '@/lib/db';

async function main() {
    const services = await prisma.service.findMany({
        where: { name: { contains: 'CHAMPACA', mode: 'insensitive' } },
        include: { _count: { select: { bookings: true } } }
    });

    console.log("Found Services:");
    services.forEach(s => {
        console.log(`ID: ${s.id} | Name: ${s.name} | Type: ${s.type} | Price: ${s.price} | Bookings: ${s._count.bookings}`);
    });
}

main();
