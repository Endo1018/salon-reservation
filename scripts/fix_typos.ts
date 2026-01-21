import { PrismaClient } from '@prisma/client';
import { seedInitialServices } from '../app/actions/booking-master';

const prisma = new PrismaClient();

async function main() {
    console.log('Fixing typos by re-seeding services...');
    // Typo: Standard Faicial -> Standard Facial
    const typoName = 'Standard Faicial';
    const correctName = 'Standard Facial';

    const typoService = await prisma.service.findFirst({ where: { name: typoName } });

    if (typoService) {
        console.log(`Found typo service: ${typoName} (${typoService.id})`);

        // Check/Create Correct Service
        let correctService = await prisma.service.findFirst({ where: { name: correctName } });
        if (!correctService) {
            // Create mostly copying typo service but correct name
            correctService = await prisma.service.create({
                data: {
                    ...typoService,
                    id: undefined, // New ID
                    name: correctName,
                    createdAt: undefined,
                    updatedAt: undefined
                }
            });
            console.log(`Created correct service: ${correctName} (${correctService.id})`);
        } else {
            console.log(`Found correct service: ${correctName} (${correctService.id})`);
        }

        // Migrate Bookings
        const updateResult = await prisma.booking.updateMany({
            where: { menuId: typoService.id },
            data: {
                menuId: correctService.id,
                menuName: correctName
            }
        });
        console.log(`Migrated ${updateResult.count} bookings from ${typoName} to ${correctName}.`);

        // Now safe to delete
        await prisma.service.delete({ where: { id: typoService.id } });
        console.log(`Deleted typo service: ${typoName}`);
    } else {
        console.log(`Typo service '${typoName}' not found. Skipping migration.`);
    }

    // Run seed function which reads from upgraded menustaff.csv
    await seedInitialServices();
    console.log('Services re-seeded successfully.');
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
