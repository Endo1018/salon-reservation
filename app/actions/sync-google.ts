'use server';

import prisma from '@/lib/db';
import { google } from 'googleapis';
import { revalidatePath } from 'next/cache';
import { Service, Staff } from '@prisma/client';

// Configuration
const SHEET_ID = process.env.SPREADSHEET_ID || '1zFXo9CvS_RHd8EbN6Ae3Tlh31MbGCnYBxzk-5q1FZ5k';
const GOOGLE_CLIENT_EMAIL = process.env.GOOGLE_CLIENT_EMAIL || 'client-email-private-key@primal-result-309908.iam.gserviceaccount.com';
const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

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
// Note: In Server Action request scope, this map should be re-instantiated or scoped per request?
// For simpler logic, we scoped it inside the function.

export async function syncBookingsFromGoogleSheets(targetDateStr?: string) {
    if (!SHEET_ID || !GOOGLE_CLIENT_EMAIL || !GOOGLE_PRIVATE_KEY) {
        console.error("Missing Creds", { SHEET_ID, GOOGLE_CLIENT_EMAIL });
        return { success: false, message: 'Google Sheets Credentials Missing' };
    }

    try {
        const auth = new google.auth.GoogleAuth({
            credentials: {
                client_email: GOOGLE_CLIENT_EMAIL,
                private_key: GOOGLE_PRIVATE_KEY,
            },
            scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
        });

        const sheets = google.sheets({ version: 'v4', auth });

        // 1. Determine Target Month
        const today = new Date();
        const targetDate = targetDateStr ? new Date(targetDateStr) : today;
        const month = targetDate.getMonth() + 1; // 1-12
        const year = targetDate.getFullYear();

        // Regex to match "Tháng_1_2026", "Tháng 01_2026", "01_2026", "1_2026", etc.
        // Matches: (Optional "Tháng" + space/underscore) + (1 or 01) + (space/underscore) + 2026
        // Note: Vietnamese 'á' might be involved but usually "Thang" or "Tháng".
        const monthRegex = new RegExp(`^(?:Th[aá]ng[ _]?)?0?${month}[_ ]${year}$`, 'i');

        console.log(`[Sync] Looking for sheet matching: Month ${month}, Year ${year}`);

        // 2. Fetch Metadata to find exact sheet name
        let sheetName = '';
        try {
            const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
            const tabs = meta.data.sheets?.map(s => s.properties?.title || '') || [];

            // Find match
            sheetName = tabs.find(t => monthRegex.test(t.trim())) || '';

            if (!sheetName) {
                // Fallback specific checks if regex fails or is too strict
                const candidates = [
                    `${month.toString().padStart(2, '0')}_${year}`,
                    `Tháng_${month}_${year}`,
                    `Tháng ${month.toString().padStart(2, '0')}_${year}`, // Found in check
                    `Tháng_${month.toString().padStart(2, '0')}_${year}`,
                ];
                sheetName = tabs.find(t => candidates.includes(t.trim())) || '';
            }

            if (!sheetName) {
                console.error(`[Sync] No matching sheet found in:`, tabs);
                return { success: false, message: `Sheet for ${month}/${year} not found. Available: ${tabs.slice(0, 5).join(', ')}...` };
            }

            console.log(`[Sync] Found target sheet: "${sheetName}"`);

        } catch (error: any) {
            console.error(`Error fetching metadata:`, error.message);
            return { success: false, message: `Connection Failed: ${error.message}` };
        }

        // 3. Fetch Data
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let rows: any[][] = [];
        try {
            const response = await sheets.spreadsheets.values.get({
                spreadsheetId: SHEET_ID,
                range: `'${sheetName}'!A2:L`, // Quote the name for safety
            });
            rows = response.data.values || [];
        } catch (error: any) {
            console.error(`Error fetching rows from "${sheetName}":`, error.message);
            return { success: false, message: `Error reading rows: ${error.message}` };
        }

        if (rows.length === 0) {
            return { success: true, message: 'No data found in sheet.' };
        }

        // 3. Prepare DB Data
        const staffList = await prisma.staff.findMany();
        const serviceList = await prisma.service.findMany();
        const staffMap = new Map<string, Staff>(staffList.map((s) => [s.name.trim().toLowerCase(), s]));
        const serviceMap = new Map<string, Service>(serviceList.map((s) => [s.name.trim().toLowerCase(), s]));

        // 4. Clear Existing Bookings for the Month
        const startOfMonth = new Date(year, month - 1, 1);
        const endOfMonth = new Date(year, month, 1); // Next month 1st is upper bound

        // Note: endOfMonth logic: new Date(2026, 1, 1) if month is 1. Correct.
        // Wait, month is 1-12. Date constructor uses 0-11 for month.
        // startOfMonth = new Date(2026, 0, 1).
        // endOfMonth = new Date(2026, 1, 1).
        // Correct.

        await prisma.booking.deleteMany({
            where: {
                startAt: { gte: startOfMonth, lt: endOfMonth },
            },
        });

        let successCount = 0;
        let errorCount = 0;

        // Resource Usage (Scoped for this sync run)
        const resourceUsage = new Map<string, { start: number; end: number }[]>();

        const isResourceFree = (resId: string, start: Date, end: Date): boolean => {
            const startMs = start.getTime();
            const endMs = end.getTime();
            const usage = resourceUsage.get(resId) || [];
            return !usage.some(u => startMs < u.end && endMs > u.start);
        };

        const findFree = (pool: string[], start: Date, end: Date): string | null => {
            for (const resId of pool) {
                if (isResourceFree(resId, start, end)) return resId;
            }
            return null;
        };

        const bookResource = (resId: string, start: Date, end: Date) => {
            const startMs = start.getTime();
            const endMs = end.getTime();
            const usage = resourceUsage.get(resId) || [];
            usage.push({ start: startMs, end: endMs });
            resourceUsage.set(resId, usage);
        };

        // 5. Process Rows
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            if (!row[0]) continue; // Skip empty

            try {
                const dateStr = row[0] as string; // A
                const timeStr = row[2] as string; // C
                const clientName = row[4] as string; // E

                // Svc 1
                const svcName1 = (row[6] as string)?.trim();
                const dur1 = parseInt(row[7] as string) || 60;
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const staffName1 = (row[10] as string)?.trim();

                // Svc 2
                const svcName2 = (row[8] as string)?.trim();
                const dur2 = parseInt(row[9] as string) || 0;
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const staffName2 = (row[11] as string)?.trim();

                // Date Parse (DD/MM/YYYY)
                const [dd, mm, yyyy] = dateStr.includes('/') ? dateStr.split('/') : dateStr.split('-');

                // Time Parse
                const timeMatch = timeStr.match(/(\d+):(\d+)\s*(AM|PM)?/i);

                if (!timeMatch || !dd || !mm || !yyyy) {
                    console.log(`[Sync] Skipped Row (Invalid Date/Time): ${dateStr} ${timeStr}`);
                    continue;
                }

                let hours = parseInt(timeMatch[1]);
                let mins = parseInt(timeMatch[2]);
                const ampm = timeMatch[3]?.toUpperCase();
                if (ampm === 'PM' && hours < 12) hours += 12;
                if (ampm === 'AM' && hours === 12) hours = 0;

                // Timezone Correction: Vietnam (GMT+7) -> UTC
                const startAt = new Date(Date.UTC(parseInt(yyyy), parseInt(mm) - 1, parseInt(dd), hours - 7, mins));

                // Simple date check
                if (startAt < startOfMonth || startAt >= endOfMonth) {
                    console.log(`[Sync] Skipped Row (Date Out of Range): ${startAt.toISOString()} vs [${startOfMonth.toISOString()} - ${endOfMonth.toISOString()}] | Sheet: ${dateStr}`);
                    continue;
                }

                // Match Service 1
                let svcKey1 = svcName1?.toLowerCase();
                if (svcKey1 && nameCorrections[svcKey1]) svcKey1 = nameCorrections[svcKey1];
                let service1: Service | undefined = serviceMap.get(svcKey1 || '');
                if (!service1 && svcName1) {
                    for (const [k, v] of serviceMap.entries()) {
                        if (k.includes(svcName1.toLowerCase()) || svcName1.toLowerCase().includes(k)) {
                            service1 = v;
                            break;
                        }
                    }
                }

                // Match Service 2
                let service2: Service | undefined = undefined;
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

                // Match Staff
                let staff1: Staff | undefined = staffMap.get((row[10] as string)?.trim()?.toLowerCase() || '');
                if (!staff1 && row[10]) {
                    const s1n = (row[10] as string).toLowerCase();
                    for (const [k, v] of staffMap.entries()) {
                        if (k.includes(s1n)) {
                            staff1 = v;
                            break;
                        }
                    }
                }
                let staff2: Staff | undefined = staffMap.get((row[11] as string)?.trim()?.toLowerCase() || '');
                if (!staff2 && row[11]) {
                    const s2n = (row[11] as string).toLowerCase();
                    for (const [k, v] of staffMap.entries()) {
                        if (k.includes(s2n)) {
                            staff2 = v;
                            break;
                        }
                    }
                }

                // Booking Logic
                if (service1) {
                    const isCombo = !!service2;
                    const comboLinkId = isCombo ? crypto.randomUUID() : null;

                    const getPool = (svc: Service) => {
                        const nameLower = svc.name.toLowerCase();
                        if (nameLower.includes('couple') && nameLower.includes('course')) return { pool: resourcePools.aroma, type: 'aroma' }; // Default 1st part to Aroma
                        if (svc.category === 'Aroma' || nameLower.includes('aroma')) return { pool: resourcePools.aroma, type: 'aroma' };
                        if (svc.category === 'Head Spa' || nameLower.includes('head spa')) return { pool: resourcePools.spa, type: 'spa' };
                        return { pool: resourcePools.seat, type: 'seat' };
                    };

                    const pool1Info = getPool(service1);
                    let pool2Info = isCombo && service2 ? getPool(service2) : null;

                    // Special Rule: Couple Course 2nd part is always Head Spa
                    if (isCombo && service1.name.toLowerCase().includes('couple') && service2?.name.toLowerCase().includes('couple')) {
                        pool2Info = { pool: resourcePools.spa, type: 'spa' };
                    }
                    let useSwappedOrder = false;
                    let resId1: string | null = null;
                    let resId2: string | null = null;

                    // Logic 1: Normal
                    const endAt1_Normal = new Date(startAt.getTime() + dur1 * 60000);
                    let targetPool2 = pool2Info ? pool2Info.pool : [];
                    let targetType2 = pool2Info ? pool2Info.type : 'seat';

                    if (isCombo && service1 && service2) {
                        const name1Lower = service1.name.toLowerCase();
                        if (name1Lower.includes('first time') || name1Lower.includes('champaca') || name1Lower.includes('advance') || name1Lower.includes('deluxe') || name1Lower.includes('special offer') || name1Lower.includes('v.i.p') || name1Lower.includes('vip')) {
                            console.log(`[Sync] Forced Spa for 2nd part: ${service1.name}`);
                            targetPool2 = resourcePools.spa;
                            targetType2 = 'spa';
                        }
                    }

                    const res1_Normal = findFree(pool1Info.pool, startAt, endAt1_Normal);
                    let res2_Normal: string | null = null;
                    let endAt2_Normal: Date | null = null;

                    if (isCombo) {
                        endAt2_Normal = new Date(endAt1_Normal.getTime() + (dur2 || 30) * 60000);
                        res2_Normal = findFree(targetPool2, endAt1_Normal, endAt2_Normal);
                    }

                    // Logic 2: Swap
                    if (isCombo && (!res1_Normal || !res2_Normal)) {
                        const endAt1_Swap = new Date(startAt.getTime() + (dur2 || 30) * 60000); // 2 First
                        const endAt2_Swap = new Date(endAt1_Swap.getTime() + dur1 * 60000); // 1 Second

                        const res1_Swap = findFree(targetPool2, startAt, endAt1_Swap); // Svc2
                        const res2_Swap = findFree(pool1Info.pool, endAt1_Swap, endAt2_Swap); // Svc1

                        if (res1_Swap && res2_Swap) {
                            useSwappedOrder = true;
                            resId1 = res2_Swap; // Svc1 (2nd)
                            resId2 = res1_Swap; // Svc2 (1st)
                        }
                    }

                    // Commit
                    let startAt1 = startAt;
                    let endAt1 = endAt1_Normal;
                    let startAt2 = endAt1_Normal;
                    let endAt2 = endAt2_Normal || endAt1_Normal;

                    if (useSwappedOrder) {
                        const svc2_Start = startAt;
                        const svc2_End = new Date(startAt.getTime() + (dur2 || 30) * 60000);
                        startAt1 = svc2_End;
                        endAt1 = new Date(startAt1.getTime() + dur1 * 60000);
                        startAt2 = svc2_Start;
                        endAt2 = svc2_End;

                        // Book
                        bookResource(resId1!, startAt1, endAt1);
                        bookResource(resId2!, startAt2, endAt2);
                    } else {
                        // Normal or Overflow
                        resId1 = res1_Normal || `overflow-${pool1Info.type}`;
                        // If overflow, we don't block resource? Or just don't track usage.
                        // Ideally we track overflow too if it was a real resource ID, but overflow-X is virtual.
                        if (res1_Normal) { bookResource(resId1, startAt1, endAt1); }

                        if (isCombo) {
                            startAt2 = endAt1;
                            // endAt2 set above
                            resId2 = res2_Normal || `overflow-${targetType2}`;
                            if (res2_Normal) { bookResource(resId2, startAt2, endAt2); }
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
                    console.log(`[Sync] Skipped Row (Service Not Found): "${svcName1}" | Client: ${clientName} | Date: ${dateStr}`);
                    errorCount++;
                }

            } catch (e) {
                errorCount++;
            }
        } // end loop

        revalidatePath('/admin/timeline');
        return { success: true, message: `Sync Complete: ${successCount} Imported, ${errorCount} Errors` };

    } catch (e: any) {
        console.error(e);
        return { success: false, message: e.message };
    }
}
