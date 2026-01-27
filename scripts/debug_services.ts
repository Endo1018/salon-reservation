
import { prisma } from '../lib/db';

async function main() {
    const services = await prisma.service.findMany({
        where: { name: { contains: 'CHAMPACA', mode: 'insensitive' } }
    });
    console.log("Services found:", services.length);
    services.forEach(s => {
        console.log(`[${s.type}] ${s.name} (ID: ${s.id})`);
        console.log(`  Total Dur: ${s.duration}`);
        console.log(`  Massage Dur: ${s.massageDuration}`);
        console.log(`  Head Spa Dur: ${s.headSpaDuration}`);
    });
}

main().catch(console.error).finally(() => prisma.$disconnect());
