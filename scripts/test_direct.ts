import { google } from 'googleapis';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

// Hardcoded ID from the Drive API list result
const SHEET_ID = '1zFXo9CvS_RHd8EbN6Ae3Tlh31MBGcNybxzk-5q1FZ5k';
const GOOGLE_CLIENT_EMAIL = process.env.GOOGLE_CLIENT_EMAIL;
const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

const auth = new google.auth.GoogleAuth({
    credentials: {
        client_email: GOOGLE_CLIENT_EMAIL,
        private_key: GOOGLE_PRIVATE_KEY,
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

const sheets = google.sheets({ version: 'v4', auth });

async function main() {
    console.log('Testing ID:', SHEET_ID);

    // Test 1: Metadata
    try {
        console.log('--- Metadata Check ---');
        const response = await sheets.spreadsheets.get({
            spreadsheetId: SHEET_ID,
        });
        console.log('Success! Properties:', response.data.properties);
        console.log('Sheets:', response.data.sheets?.map(s => s.properties?.title).join(', '));
    } catch (e: any) {
        console.error('MetaData Failed:', e.message);
    }

    // Test 2: Values (The real goal)
    try {
        console.log('\n--- Values Check (Range: A1:C5) ---');
        // If specific sheet name fails, try default (first sheet) by omitting sheet name
        // Or try specific name 'Tháng_1_2026'
        const res = await sheets.spreadsheets.values.get({
            spreadsheetId: SHEET_ID,
            range: 'A1:C5' // Should fetch from first sheet
        });
        console.log('Values Read Success!');
        console.log('Data Preview:', res.data.values);
    } catch (e: any) {
        console.error('Values Read Failed:', e.message);
        if (e.response) {
            console.error('Details:', e.response.data);
        }
    }
}

main();
