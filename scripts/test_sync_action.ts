
import * as dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { syncBookingsFromGoogleSheets } from '../app/actions/sync-google';
import { prisma } from '../lib/db';

async function main() {
    console.log("Running Sync...");
    const result = await syncBookingsFromGoogleSheets('2026-01-23');
    console.log("Sync Result:", result);

    const count = await prisma.bookingMemo.count();
    console.log("BookingMemo Count in DB:", count);

    if (count > 0) {
        const sample = await prisma.bookingMemo.findFirst();
        console.log("Sample:", sample);
    }
}

main();
