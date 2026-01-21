
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';

const prisma = new PrismaClient();

async function main() {
    console.log('Starting Import...');

    // 0. Clean up existing bookings for Jan 2026 (to allow clean re-import)
    console.log('Clearing existing bookings for Jan 2026...');
    await prisma.booking.deleteMany({
        where: {
            startAt: {
                gte: new Date('2026-01-01T00:00:00'),
                lt: new Date('2026-02-01T00:00:00')
            }
        }
    });

    // 1. Load Reference Data
    const staffList = await prisma.staff.findMany();
    const serviceList = await prisma.service.findMany();

    const staffMap = new Map(staffList.map(s => [s.name.trim().toLowerCase(), s]));
    const serviceMap = new Map(serviceList.map(s => [s.name.trim().toLowerCase(), s]));

    console.log('Available Services in DB:', Array.from(serviceMap.keys()));

    const nameCorrections: Record<string, string> = {
        'standard facial': 'standard faicial', // Fix DB typo
        'standard faicial': 'standard faicial',
        'head spa & treatment': 'head spa & treatment',
        // Add others as needed
    };

    // Resource Pools
    const resourcePools = {
        spa: ['spa-1', 'spa-2', 'spa-3', 'spa-4'],
        aroma: ['aroma-a1', 'aroma-a2', 'aroma-b1', 'aroma-b2'],
        seat: ['seat-1', 'seat-2', 'seat-3', 'seat-4', 'seat-5']
    };

    // Track usage to prevent overlap within this batch import
    // Map<resourceId, Array<{start: number, end: number}>>
    const resourceUsage = new Map<string, { start: number, end: number }[]>();

    const findAvailableResource = (categoryPool: string[], start: Date, end: Date): string => {
        const startMs = start.getTime();
        const endMs = end.getTime();

        for (const resId of categoryPool) {
            const usage = resourceUsage.get(resId) || [];
            const isBusy = usage.some(u => {
                return (startMs < u.end && endMs > u.start); // Overlap check
            });

            if (!isBusy) {
                // Mark as used
                usage.push({ start: startMs, end: endMs });
                resourceUsage.set(resId, usage);
                return resId;
            }
        }
        // If all busy, return random or first to accept overflow (user will see overlap)
        console.warn(`All resources busy for ${categoryPool[0]} at ${start.toISOString()}`);
        return categoryPool[0];
    };

    // 2. Read CSV
    // Path: ../../Visit_list_2026 - Tháng_1_2026.csv (Review exact name from previous steps)
    const csvPath = path.resolve(__dirname, '../../Visit_list_2026 - Tháng_1_2026.csv');

    if (!fs.existsSync(csvPath)) {
        console.error(`CSV file not found at: ${csvPath}`);
        // Fallback to exact name seen in ls: "Visit_list_2026 - Tháng_1_2026.csv" matches.
        process.exit(1);
    }

    const fileContent = fs.readFileSync(csvPath, 'utf-8');

    // Re-parsing with header: false to handle duplicate columns safely
    const parsedArrays = Papa.parse(fileContent, { header: false, skipEmptyLines: true });
    // Header is row 0. Data starts row 1.
    // 0: DATE, ..., 6: Svc1, 7: Time1, 8: Svc2, 9: Time2, 10: Staff1, 11: Staff2

    // Column Index Mapping (0-based)
    // A=0: DATE
    // C=2: TIME
    // E=4: NAME
    // G=6: SVC1
    // H=7: TIME1
    // I=8: SVC2 (May vary if row structure shifts, but let's assume fixed)
    // J=9: TIME2
    // K=10: STAFF1
    // L=11: STAFF2

    let successCount = 0;
    let errorCount = 0;

    // 3. Process Rows
    for (let i = 1; i < parsedArrays.data.length; i++) {
        const row: any = parsedArrays.data[i];
        if (!row[0]) continue; // Skip empty dates

        try {
            const dateStr = row[0];
            const timeStr = row[2];
            const clientName = row[4];

            // Svc 1
            const svcName1 = row[6]?.trim();
            const dur1 = parseInt(row[7]) || 60;
            const staffName1 = row[10]?.trim();

            // Svc 2
            const svcName2 = row[8]?.trim();
            const dur2 = parseInt(row[9]) || 0;
            const staffName2 = row[11]?.trim();

            // Date Parsing
            const [dd, mm, yyyy] = dateStr.split('/');
            const timeMatch = timeStr.match(/(\d+):(\d+)\s*(AM|PM)?/i);

            let hours = 0, mins = 0;
            if (timeMatch) {
                hours = parseInt(timeMatch[1]);
                mins = parseInt(timeMatch[2]);
                const ampm = timeMatch[3]?.toUpperCase();
                if (ampm === 'PM' && hours < 12) hours += 12;
                if (ampm === 'AM' && hours === 12) hours = 0;
            } else {
                // Should log error but try proceed
                console.warn(`Row ${i + 1}: Invalid Time ${timeStr}`);
                continue;
            }

            const startAt1 = new Date(parseInt(yyyy), parseInt(mm) - 1, parseInt(dd), hours, mins);
            const endAt1 = new Date(startAt1.getTime() + dur1 * 60000);

            // Match Service 1
            let svcKey1 = svcName1?.toLowerCase();
            if (svcKey1 && nameCorrections[svcKey1]) svcKey1 = nameCorrections[svcKey1];

            let service1 = serviceMap.get(svcKey1);
            // Fuzzy match or default?
            if (!service1 && svcName1) {
                // Try simpler match or log
                // console.log(`Service Not Found: ${svcName1}`);
                // Attempt to find by partial?
                for (const [k, v] of serviceMap.entries()) {
                    if (k.includes(svcName1.toLowerCase()) || svcName1.toLowerCase().includes(k)) {
                        service1 = v;
                        break;
                    }
                }
            }

            // Match Staff 1
            let staff1 = staffMap.get(staffName1?.toLowerCase());
            if (!staff1 && staffName1) {
                for (const [k, v] of staffMap.entries()) {
                    if (k.includes(staffName1.toLowerCase())) {
                        staff1 = v;
                        break;
                    }
                }
            }

            // Create Booking 1
            if (service1) {
                const isCombo = !!svcName2; // If Svc2 exists, treat as combo logic or sequence
                const comboLinkId = isCombo ? crypto.randomUUID() : null;

                // Resource Allocation 1
                let pool = resourcePools.seat;
                const name1Lower = service1.name.toLowerCase();

                if (service1.category === 'Aroma' || name1Lower.includes('aroma')) pool = resourcePools.aroma;
                else if (service1.category === 'Head Spa' || name1Lower.includes('head spa')) pool = resourcePools.spa;

                const resId1 = findAvailableResource(pool, startAt1, endAt1);

                await prisma.booking.create({
                    data: {
                        menuId: service1.id,
                        menuName: service1.name,
                        staffId: staff1?.id,
                        resourceId: resId1,
                        startAt: startAt1,
                        endAt: endAt1,
                        status: 'Confirmed',
                        clientName: clientName,
                        comboLinkId: comboLinkId,
                        isComboMain: isCombo
                    }
                });

                // Process Service 2 (if any)
                if (svcName2) {
                    let svcKey2 = svcName2.toLowerCase();
                    if (nameCorrections[svcKey2]) svcKey2 = nameCorrections[svcKey2];

                    let service2 = serviceMap.get(svcKey2);
                    if (!service2) {
                        for (const [k, v] of serviceMap.entries()) {
                            if (k.includes(svcName2.toLowerCase()) || svcName2.toLowerCase().includes(k)) {
                                service2 = v;
                                break;
                            }
                        }
                    }

                    let staff2 = staffMap.get(staffName2?.toLowerCase());
                    if (!staff2 && staffName2) {
                        for (const [k, v] of staffMap.entries()) {
                            if (k.includes(staffName2.toLowerCase())) {
                                staff2 = v;
                                break;
                            }
                        }
                    }

                    if (service2) {
                        const startAt2 = endAt1; // Sequential
                        const endAt2 = new Date(startAt2.getTime() + (dur2 || 30) * 60000);

                        // Resource Allocation 2
                        let resId2 = 'seat-1';

                        const name1Lower = service1.name.toLowerCase();
                        // Split if First Time OR Champaca OR Advance OR Deluxe
                        const isSplittableCombo = name1Lower.includes('first time') ||
                            name1Lower.includes('champaca') ||
                            name1Lower.includes('advance') ||
                            name1Lower.includes('deluxe');

                        if (isSplittableCombo) {
                            // Force 2nd leg to be Head Spa Room
                            resId2 = findAvailableResource(resourcePools.spa, startAt2, endAt2);
                        } else {
                            // Standard Logic
                            let pool2 = resourcePools.seat;
                            const name2Lower = service2.name.toLowerCase();

                            if (service2.category === 'Aroma' || name2Lower.includes('aroma')) pool2 = resourcePools.aroma;
                            else if (service2.category === 'Head Spa' || name2Lower.includes('head spa')) pool2 = resourcePools.spa;

                            resId2 = findAvailableResource(pool2, startAt2, endAt2);
                        }

                        await prisma.booking.create({
                            data: {
                                menuId: service2.id,
                                menuName: service2.name,
                                staffId: staff2?.id || staff1?.id, // Fallback to staff1 if staff2 missing
                                resourceId: resId2,
                                startAt: startAt2,
                                endAt: endAt2,
                                status: 'Confirmed',
                                clientName: clientName,
                                comboLinkId: comboLinkId,
                                isComboMain: false
                            }
                        });
                    }
                }
                successCount++;
            } else {
                console.log(`Skipping Row ${i + 1}: Service '${svcName1}' not found.`);
                errorCount++;
            }

        } catch (e) {
            console.error(`Error Row ${i + 1}:`, e);
            errorCount++;
        }
    }
    console.log(`Finished. Success: ${successCount}, Errors/Skipped: ${errorCount}`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
