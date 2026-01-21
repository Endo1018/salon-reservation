import { PrismaClient } from '@prisma/client';
import { google } from 'googleapis';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env.local (or .env)
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const prisma = new PrismaClient();

// Configuration
const SHEET_ID = process.env.SPREADSHEET_ID;
const GOOGLE_CLIENT_EMAIL = process.env.GOOGLE_CLIENT_EMAIL;
const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

if (!SHEET_ID || !GOOGLE_CLIENT_EMAIL || !GOOGLE_PRIVATE_KEY) {
    console.error('Missing Google Sheets Credentials in .env');
    process.exit(1);
}

// Auth
const auth = new google.auth.GoogleAuth({
    credentials: {
        client_email: GOOGLE_CLIENT_EMAIL,
        private_key: GOOGLE_PRIVATE_KEY,
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

const sheets = google.sheets({ version: 'v4', auth });

// Correction Maps
const nameCorrections: Record<string, string> = {
    'standard facial': 'standard faicial',
    'standard faicial': 'standard faicial',
    'head spa & treatment': 'head spa & treatment',
};

// Resource Pools
const resourcePools = {
    spa: ['spa-1', 'spa-2', 'spa-3', 'spa-4'],
    aroma: ['aroma-a1', 'aroma-a2', 'aroma-b1', 'aroma-b2'],
    seat: ['seat-1', 'seat-2', 'seat-3', 'seat-4', 'seat-5'],
};

// Helper: Resource Allocation
const resourceUsage = new Map<string, { start: number; end: number }[]>();

const findAvailableResource = (categoryPool: string[], start: Date, end: Date): string => {
    const startMs = start.getTime();
    const endMs = end.getTime();

    for (const resId of categoryPool) {
        const usage = resourceUsage.get(resId) || [];
        const isBusy = usage.some((u) => startMs < u.end && endMs > u.start);

        if (!isBusy) {
            usage.push({ start: startMs, end: endMs });
            resourceUsage.set(resId, usage);
            return resId;
        }
    }
    // Overflow
    return categoryPool[0];
};

async function main() {
    // 1. Determine Target Month
    // Valid format: "Tháng_M_YYYY" (e.g., "Tháng_1_2026")
    const today = new Date();
    // Use command line arg or current month
    const targetDate = process.argv[2] ? new Date(process.argv[2]) : today;
    const month = targetDate.getMonth() + 1; // 1-12
    const year = targetDate.getFullYear();
    const sheetName = `Tháng_${month}_${year}`;

    console.log(`Targeting Sheet: ${sheetName}`);

    // 2. Fetch Data
    let rows: any[][] = [];
    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SHEET_ID,
            range: `${sheetName}!A2:L`, // Skip header
        });
        rows = response.data.values || [];
        console.log(`Fetched ${rows.length} rows.`);
    } catch (error: any) {
        console.error(`Error fetching sheet "${sheetName}":`, error.message);
        process.exit(1);
    }

    if (rows.length === 0) {
        console.log('No data found.');
        return;
    }

    // 3. Prepare DB Data
    const staffList = await prisma.staff.findMany();
    const serviceList = await prisma.service.findMany();
    const staffMap = new Map(staffList.map((s) => [s.name.trim().toLowerCase(), s]));
    const serviceMap = new Map(serviceList.map((s) => [s.name.trim().toLowerCase(), s]));

    // 4. Clear Existing Bookings for the Month
    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 1);

    console.log(`Clearing bookings from ${startOfMonth.toISOString()} to ${endOfMonth.toISOString()}...`);
    await prisma.booking.deleteMany({
        where: {
            startAt: { gte: startOfMonth, lt: endOfMonth },
        },
    });

    let successCount = 0;
    let errorCount = 0;

    // 5. Process Rows
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (!row[0]) continue; // Skip empty dates

        try {
            const dateStr = row[0] as string; // A: DATE
            const timeStr = row[2] as string; // C: TIME
            const clientName = row[4] as string; // E: NAME

            // Svc 1
            const svcName1 = (row[6] as string)?.trim(); // G
            const dur1 = parseInt(row[7] as string) || 60; // H
            const staffName1 = (row[10] as string)?.trim(); // K

            // Svc 2
            const svcName2 = (row[8] as string)?.trim(); // I
            const dur2 = parseInt(row[9] as string) || 0; // J
            const staffName2 = (row[11] as string)?.trim(); // L

            // Date Parse (DD/MM/YYYY)
            // Note: Sheets might return various formats depending on locale, but standard is often DD/MM/YYYY or YYYY-MM-DD
            // Assuming DD/MM/YYYY based on CSV logic
            const [dd, mm, yyyy] = dateStr.includes('/') ? dateStr.split('/') : dateStr.split('-');

            // Time Parse (HH:MM AM/PM or HH:MM)
            const timeMatch = timeStr.match(/(\d+):(\d+)\s*(AM|PM)?/i);

            if (!timeMatch || !dd || !mm || !yyyy) {
                console.warn(`Row ${i + 2}: Invalid Date/Time (${dateStr} ${timeStr})`);
                continue;
            }

            let hours = parseInt(timeMatch[1]);
            let mins = parseInt(timeMatch[2]);
            const ampm = timeMatch[3]?.toUpperCase();
            if (ampm === 'PM' && hours < 12) hours += 12;
            if (ampm === 'AM' && hours === 12) hours = 0;

            const startAt = new Date(parseInt(yyyy), parseInt(mm) - 1, parseInt(dd), hours, mins);

            // Filter out if row belongs to different month (sanity check)
            if (startAt < startOfMonth || startAt >= endOfMonth) {
                continue;
            }

            // Match Service 1
            let svcKey1 = svcName1?.toLowerCase();
            if (svcKey1 && nameCorrections[svcKey1]) svcKey1 = nameCorrections[svcKey1];

            // Fuzzy Match Service 1
            let service1 = serviceMap.get(svcKey1);
            if (!service1 && svcName1) {
                for (const [k, v] of serviceMap.entries()) {
                    if (k.includes(svcName1.toLowerCase()) || svcName1.toLowerCase().includes(k)) {
                        service1 = v;
                        break;
                    }
                }
            }

            // Match Service 2
            let service2: any = null;
            if (svcName2) {
                let svcKey2 = svcName2.toLowerCase();
                if (nameCorrections[svcKey2]) svcKey2 = nameCorrections[svcKey2];

                service2 = serviceMap.get(svcKey2);
                if (!service2) {
                    for (const [k, v] of serviceMap.entries()) {
                        if (k.includes(svcName2.toLowerCase()) || svcName2.toLowerCase().includes(k)) {
                            service2 = v;
                            break;
                        }
                    }
                }
            }


            // Fuzzy Match Staff
            let staff1 = staffMap.get(staffName1?.toLowerCase());
            if (!staff1 && staffName1) {
                for (const [k, v] of staffMap.entries()) {
                    if (k.includes(staffName1.toLowerCase())) {
                        staff1 = v;
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

            // Insert Booking
            if (service1) {
                const isCombo = !!service2;
                const comboLinkId = isCombo ? crypto.randomUUID() : null;

                // Determine Resource Pools
                const getPool = (svc: any) => {
                    const nameLower = svc.name.toLowerCase();
                    if (svc.category === 'Aroma' || nameLower.includes('aroma')) return { pool: resourcePools.aroma, type: 'aroma' };
                    if (svc.category === 'Head Spa' || nameLower.includes('head spa')) return { pool: resourcePools.spa, type: 'spa' };
                    return { pool: resourcePools.seat, type: 'seat' };
                };

                const pool1Info = getPool(service1);
                const pool2Info = isCombo && service2 ? getPool(service2) : null;

                let useSwappedOrder = false;
                let resId1: string | null = null;
                let resId2: string | null = null;

                // Helper to check availability
                const checkAvailability = (pool: string[], start: Date, end: Date) => {
                    const startMs = start.getTime();
                    const endMs = end.getTime();
                    for (const resId of pool) {
                        const usage = resourceUsage.get(resId) || [];
                        const isBusy = usage.some(u => (startMs < u.end && endMs > u.start));
                        if (!isBusy) return resId;
                    }
                    return null;
                };

                // Helper to book
                const bookResource = (resId: string, start: Date, end: Date) => {
                    const startMs = start.getTime();
                    const endMs = end.getTime();
                    const usage = resourceUsage.get(resId) || [];
                    usage.push({ start: startMs, end: endMs });
                    resourceUsage.set(resId, usage);
                };

                // Logic 1: Try Normal Order
                const endAt1_Normal = new Date(startAt.getTime() + dur1 * 60000);

                // Special Split Logic for Service 2 Pool?
                // Copying split logic from original:
                // "isSplittableCombo" forces 2nd leg to SPA if TRUE.
                // We need to respect that logic for determining the pool.
                let targetPool2 = pool2Info ? pool2Info.pool : [];
                let targetType2 = pool2Info ? pool2Info.type : 'seat';

                if (isCombo && service1 && service2) {
                    const name1Lower = service1.name.toLowerCase();
                    const isSplittableCombo = name1Lower.includes('first time') ||
                        name1Lower.includes('champaca') ||
                        name1Lower.includes('advance') ||
                        name1Lower.includes('deluxe');

                    if (isSplittableCombo) {
                        targetPool2 = resourcePools.spa;
                        targetType2 = 'spa';
                    }
                }

                const res1_Normal = checkAvailability(pool1Info.pool, startAt, endAt1_Normal);

                let res2_Normal: string | null = null;
                let endAt2_Normal: Date | null = null;

                if (isCombo) {
                    endAt2_Normal = new Date(endAt1_Normal.getTime() + (dur2 || 30) * 60000);
                    res2_Normal = checkAvailability(targetPool2, endAt1_Normal, endAt2_Normal);
                }

                // Logic 2: Try Swapped Order (if Combo and Normal Failed)
                if (isCombo && (!res1_Normal || !res2_Normal)) {
                    // Try Swap
                    const endAt1_Swap = new Date(startAt.getTime() + (dur2 || 30) * 60000); // Svc2 duration first
                    const endAt2_Swap = new Date(endAt1_Swap.getTime() + dur1 * 60000); // Svc1 duration second

                    const res1_Swap = checkAvailability(targetPool2, startAt, endAt1_Swap); // Svc2 uses Pool2
                    const res2_Swap = checkAvailability(pool1Info.pool, endAt1_Swap, endAt2_Swap); // Svc1 uses Pool1

                    if (res1_Swap && res2_Swap) {
                        useSwappedOrder = true;
                        resId1 = res2_Swap; // Service 1 slot (2nd segment)
                        resId2 = res1_Swap; // Service 2 slot (1st segment)
                        console.log(`Swapping order for ${clientName} at ${dateStr} ${timeStr}`);
                    }
                }

                // Final Selection
                let startAt1 = startAt;
                let endAt1 = endAt1_Normal;
                let startAt2 = endAt1_Normal; // Default
                let endAt2 = endAt2_Normal || endAt1_Normal; // Fallback

                if (useSwappedOrder) {
                    // Swapped Timing logic
                    const svc2_Start = startAt;
                    const svc2_End = new Date(startAt.getTime() + (dur2 || 30) * 60000);

                    startAt1 = svc2_End;
                    endAt1 = new Date(startAt1.getTime() + dur1 * 60000);

                    startAt2 = svc2_Start;
                    endAt2 = svc2_End;

                    bookResource(resId1!, startAt1, endAt1);
                    bookResource(resId2!, startAt2, endAt2);

                } else {
                    // Normal Order (or Overflow)
                    resId1 = res1_Normal;
                    if (isCombo) resId2 = res2_Normal;

                    // If still missing, use Overflow
                    if (!resId1) {
                        resId1 = `overflow-${pool1Info.type}`;
                        console.warn(`Overflow assigned for ${clientName} (Svc1)`);
                    } else {
                        bookResource(resId1, startAt1, endAt1);
                    }

                    if (isCombo) {
                        startAt2 = endAt1;
                        // endAt2 already calc
                        if (!resId2) {
                            resId2 = `overflow-${targetType2}`;
                            console.warn(`Overflow assigned for ${clientName} (Svc2)`);
                        } else {
                            bookResource(resId2, startAt2, endAt2);
                        }
                    }
                }

                await prisma.booking.create({
                    data: {
                        menuId: service1.id,
                        menuName: service1.name,
                        staffId: staff1?.id,
                        resourceId: resId1!,
                        startAt: startAt1,
                        endAt: endAt1,
                        status: 'Confirmed',
                        clientName: clientName,
                        comboLinkId: comboLinkId,
                        isComboMain: isCombo,
                    },
                });

                // Process Service 2
                if (isCombo && service2) {
                    await prisma.booking.create({
                        data: {
                            menuId: service2.id,
                            menuName: service2.name,
                            staffId: staff2?.id || staff1?.id,
                            resourceId: resId2!,
                            startAt: startAt2,
                            endAt: endAt2,
                            status: 'Confirmed',
                            clientName: clientName,
                            comboLinkId: comboLinkId,
                            isComboMain: false,
                        },
                    });
                }
                successCount++;
            } else {
                console.warn(`Row ${i + 2}: Service not found "${svcName1}"`);
                errorCount++;
            }

        } catch (e: any) {
            console.error(`Row ${i + 2} Error:`, e.message);
            errorCount++;
        }
    }

    console.log(`Sync Complete. Success: ${successCount}, Failed/Skipped: ${errorCount}`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
