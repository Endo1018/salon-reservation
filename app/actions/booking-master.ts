'use server';

import { prisma } from '@/lib/db';
import { revalidatePath } from 'next/cache';

// --- SERVICE (MENU) ACTIONS ---

export async function getServices() {
    const services = await prisma.service.findMany();

    const getScore = (s: any) => {
        // Priority: Head Spa > Aroma > Massage > Combo
        if (s.type === 'Combo' || s.category === 'Combo') return 40;

        const c = s.category ? s.category.toLowerCase() : '';
        if (c.includes('head') || c.includes('facial')) return 10;
        if (c.includes('aroma')) return 20;
        if (c.includes('massage') || c.includes('foot') || c.includes('body')) return 30;

        return 50; // Others
    };

    return services.sort((a, b) => {
        const scoreA = getScore(a);
        const scoreB = getScore(b);
        if (scoreA !== scoreB) return scoreA - scoreB;

        // Secondary: Name (Asc) - Group same services together
        if (a.name < b.name) return -1;
        if (a.name > b.name) return 1;

        // Tertiary: Duration (Asc) - Shortest first (60 -> 90 -> 120)
        return a.duration - b.duration;
    });
}



export async function createService(data: {
    name: string;
    duration: number;
    price: number;
    category: string;
    commission: number;
    allowedStaff: string[];
}) {
    await prisma.service.create({
        data: {
            ...data,
            type: 'Single' // Default
        }
    });
    revalidatePath('/admin/booking/services');
}

export async function updateService(id: string, data: {
    name?: string;
    duration?: number;
    price?: number;
    category?: string;
    commission?: number;
}) {
    await prisma.service.update({
        where: { id },
        data
    });
    revalidatePath('/admin/booking/services');
}

export async function deleteService(id: string) {
    await prisma.service.delete({ where: { id } });
    revalidatePath('/admin/booking/services');
}

export async function seedInitialServices() {
    const fs = require('fs');
    const path = require('path');
    const csvPath = path.join(process.cwd(), 'menustaff.csv');

    try {
        const fileContent = fs.readFileSync(csvPath, 'utf-8');
        const lines = fileContent.split('\n');

        // Start from line 2 (index 2, 0-based) because line 0 is junk, line 1 is header
        // Wait, line 0 is ",,,,,,,習得,,,,,,"
        // Line 1 is "メニュー名,時間(分),金額(C)..."
        // So data starts at Line 2 (3rd line)

        let count = 0;
        for (let i = 2; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            // Simple CSV split (assuming no commas in values based on file view)
            const cols = line.split(',');
            if (cols.length < 7) continue;

            const name = cols[0].trim();
            const duration = parseInt(cols[1].trim()) || 0;
            const price = parseInt(cols[2].trim()) || 0;
            const typeRaw = cols[3].trim(); // Col 3: Type
            const massageTime = parseInt(cols[4]?.trim()) || 0; // Col 4: Massage Time
            const headSpaTime = parseInt(cols[5]?.trim()) || 0; // Col 5: Head Spa Time
            const categoryRaw = cols[6]?.trim() || ''; // Col 6: Category (Make sure to handle undefined safely)

            if (!name || !duration) continue;

            // Map Category & Type
            let category = 'Massage'; // Default
            let type = 'Single';
            let mDuration = 0;
            let hDuration = 0;

            if (typeRaw === 'Combo') {
                type = 'Combo';
                category = 'Combo'; // Temporary placeholder
                mDuration = massageTime;
                hDuration = headSpaTime;

                // Infer Category from Name for Combo
                // "Aroma" or "Couple" -> Aroma Room
                if (name.includes('Aroma') || name.includes('Couple')) {
                    category = 'Aroma';
                } else if (name.includes('Thai') || name.includes('Foot') || name.includes('Massa')) {
                    category = 'Massage'; // Massage Seat
                } else {
                    category = 'Massage'; // Default fallback
                }
            } else {
                // Single Type Logic
                if (categoryRaw.includes('Aroma')) category = 'Aroma';
                else if (categoryRaw.includes('Head') || categoryRaw.includes('HeadSpa')) category = 'Head Spa';
                else if (categoryRaw.includes('Massage') || categoryRaw.includes('Foot')) category = 'Massage';
            }

            // Name+Duration should be unique enough to identify the service to update
            let existing = await prisma.service.findFirst({
                where: { name: name, duration: duration }
            });

            // Fallback for Combos: Try matching by name only (ignoring duration mismatch)
            if (!existing && type === 'Combo') {
                existing = await prisma.service.findFirst({
                    where: { name: name }
                });
                if (existing) {
                    require('fs').appendFileSync('/tmp/seed.log', `[Fallback Match] Found ${name} by name. Updating ID: ${existing.id}\n`);
                } else {
                    require('fs').appendFileSync('/tmp/seed.log', `[No Match] Could not find ${name} even by name.\n`);
                }
            } else if (existing) {
                require('fs').appendFileSync('/tmp/seed.log', `[Exact Match] Found ${name} by name+duration.\n`);
            }

            if (existing) {
                await prisma.service.update({
                    where: { id: existing.id },
                    data: {
                        price,
                        category,
                        type, // Ensure type is updated
                        massageDuration: mDuration,
                        headSpaDuration: hDuration
                    }
                });
                require('fs').appendFileSync('/tmp/seed.log', `[Updated] ${name} -> Type: ${type}, M: ${mDuration}, H: ${hDuration}\n`);
            } else {
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
                require('fs').appendFileSync('/tmp/seed.log', `[Created] ${name} -> Type: ${type}, M: ${mDuration}, H: ${hDuration}\n`);
            }
            count++;
        }
        console.log(`Seeded ${count} services from CSV`);
        require('fs').appendFileSync('/tmp/seed.log', `Seed Completed. Count: ${count}\n`);
    } catch (e) {
        console.error("Failed to seed services:", e);
        require('fs').appendFileSync('/tmp/seed.log', `Seed Failed: ${e}\n`);
    }

    try {
        revalidatePath('/admin/booking/services');
    } catch (_) { }
}


// --- CUSTOMERS ACTIONS ---

export async function getCustomers() {
    return await prisma.customer.findMany({
        orderBy: { name: 'asc' }
    });
}

export async function createCustomer(data: { name: string; phone?: string; email?: string; notes?: string }) {
    await prisma.customer.create({ data });
    revalidatePath('/admin/booking/customers');
}

export async function updateCustomer(id: string, data: { name?: string; phone?: string; email?: string; notes?: string }) {
    await prisma.customer.update({
        where: { id },
        data
    });
    revalidatePath('/admin/booking/customers');
}

export async function deleteCustomer(id: string) {
    await prisma.customer.delete({ where: { id } });
    revalidatePath('/admin/booking/customers');
}
