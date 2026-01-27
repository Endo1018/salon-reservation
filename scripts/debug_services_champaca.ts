
import { prisma } from '../lib/db';

async function main() {
    const services = await prisma.service.findMany({
        where: {
            name: { contains: 'CHAMPACA', mode: 'insensitive' }
        }
    });

    console.log(`Found ${services.length} services matching 'CHAMPACA':`);
    services.forEach(s => {
        console.log(`[${s.id}] ${s.name} | Type: ${s.type} | Total: ${s.duration}m | Massage: ${s.massageDuration}m | HeadSpa: ${s.headSpaDuration}m`);
    });
}

main().catch(console.error).finally(() => prisma.$disconnect());
