
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function main() {
    const csvPath = path.join(process.cwd(), 'menustaff.csv');
    console.log(`Reading CSV from ${csvPath}`);

    try {
        const fileContent = fs.readFileSync(csvPath, 'utf-8');
        const lines = fileContent.split('\n');

        let count = 0;
        for (let i = 2; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const cols = line.split(',');
            if (cols.length < 7) continue;

            const name = cols[0].trim();
            const duration = parseInt(cols[1].trim()) || 0;
            const price = parseInt(cols[2].trim()) || 0;
            const typeRaw = cols[3].trim();
            const massageTime = parseInt(cols[4]?.trim()) || 0;
            const headSpaTime = parseInt(cols[5]?.trim()) || 0;
            const categoryRaw = cols[6]?.trim() || '';

            if (!name || !duration) continue;

            let category = 'Massage';
            let type = 'Single';
            let mDuration = 0;
            let hDuration = 0;

            if (typeRaw === 'Combo') {
                type = 'Combo';
                category = 'Combo';
                mDuration = massageTime;
                hDuration = headSpaTime;

                if (name.includes('Aroma') || name.includes('Couple')) {
                    category = 'Aroma';
                } else if (name.includes('Thai') || name.includes('Foot') || name.includes('Massa')) {
                    category = 'Massage';
                } else {
                    category = 'Massage';
                }
            } else {
                if (categoryRaw.includes('Aroma')) category = 'Aroma';
                else if (categoryRaw.includes('Head') || categoryRaw.includes('HeadSpa')) category = 'Head Spa';
                else if (categoryRaw.includes('Massage') || categoryRaw.includes('Foot')) category = 'Massage';
            }

            console.log(`Processing ${name} (${duration}min) - Type: ${type}`);

            // Find existing
            let existing = await prisma.service.findFirst({
                where: { name: name, duration: duration }
            });

            // Fallback
            if (!existing && type === 'Combo') {
                existing = await prisma.service.findFirst({
                    where: { name: name }
                });
                if (existing) console.log(`  -> Fallback Match by Name: ${existing.name}`);
            }

            if (existing) {
                console.log(`  -> Updating Service ${existing.id}`);
                await prisma.service.update({
                    where: { id: existing.id },
                    data: {
                        price,
                        category,
                        type,
                        massageDuration: mDuration,
                        headSpaDuration: hDuration
                    }
                });
            } else {
                console.log(`  -> Creating New Service`);
                await prisma.service.create({
                    data: {
                        name,
                        duration,
                        price,
                        category,
                        commission: 0,
                        type,
                        massageDuration: mDuration,
                        headSpaDuration: hDuration,
                        allowedStaff: []
                    }
                });
            }
            count++;
        }
        console.log(`Success! Processed ${count} services.`);
    } catch (e) {
        console.error("Error:", e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
