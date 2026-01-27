
import { google } from 'googleapis';
import * as fs from 'fs';
import path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function main() {
    const SHEET_ID = process.env.SPREADSHEET_ID;
    const GOOGLE_CLIENT_EMAIL = process.env.GOOGLE_CLIENT_EMAIL;
    const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (!SHEET_ID || !GOOGLE_CLIENT_EMAIL || !GOOGLE_PRIVATE_KEY) {
        console.error("Missing Creds");
        return;
    }

    const auth = new google.auth.GoogleAuth({
        credentials: { client_email: GOOGLE_CLIENT_EMAIL, private_key: GOOGLE_PRIVATE_KEY },
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    try {
        console.log("Reading 'Booking' sheet...");
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SHEET_ID,
            range: "'Booking'!A6:I15", // Read first few rows including Col I
        });
        const rows = response.data.values;
        console.log("Rows found:", rows?.length);
        if (rows) {
            rows.forEach((row, i) => {
                console.log(`Row ${i} (Col E): ${row[4]} | Col I (Come): [${row[8]}]`);
            });
        }
    } catch (e: any) {
        console.error("Error:", e.message);
    }
}

main();
