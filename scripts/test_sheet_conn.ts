
import { google } from 'googleapis';
import * as dotenv from 'dotenv';
import path from 'path';

// Load env
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const SHEET_ID = process.env.SPREADSHEET_ID;
const CLIENT_EMAIL = process.env.GOOGLE_CLIENT_EMAIL;
const PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

async function main() {
    console.log('--- Google Sheets Connectivity Test ---');
    if (!SHEET_ID) { console.error('Missing SPREADSHEET_ID'); return; }
    if (!CLIENT_EMAIL) { console.error('Missing GOOGLE_CLIENT_EMAIL'); return; }
    if (!PRIVATE_KEY) { console.error('Missing GOOGLE_PRIVATE_KEY'); return; }

    console.log(`Sheet ID: [${SHEET_ID}] (Length: ${SHEET_ID.length})`);
    console.log(`Email: ${CLIENT_EMAIL}`);

    const auth = new google.auth.GoogleAuth({
        credentials: {
            client_email: CLIENT_EMAIL,
            private_key: PRIVATE_KEY,
        },
        scopes: [
            'https://www.googleapis.com/auth/spreadsheets',
            'https://www.googleapis.com/auth/drive',
        ],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const drive = google.drive({ version: 'v3', auth });

    // 1. Who am I? (Optional, verify token)
    // difficult to verify cleanly without extra API calls, but client_email is authoritative for JWT.

    // 2. Drive List
    try {
        console.log('\n[Step 1] Listing Drive Files (to verify visibility)...');
        const res = await drive.files.list({
            pageSize: 10,
            fields: 'files(id, name, mimeType, owners)',
        });
        const files = res.data.files || [];
        console.log(`Found ${files.length} files.`);

        if (files.length === 0) {
            console.log('⚠️  Service Account sees 0 files. It is likely not shared with anything.');
        }

        let foundTarget = false;
        files.forEach(f => {
            console.log(` - File: "${f.name}" (ID: ${f.id}) Owner: ${f.owners?.[0]?.emailAddress}`);
            if (f.id === SHEET_ID || f.name.includes('Visit_list_2026')) {
                foundTarget = true;
                console.log('   >>> MATCHED TARGET! <<<');
            }
        });
    } catch (e: any) {
        console.error('❌ Drive List Failed:', e.message);
        if (e.message.includes('Project has not enabled the API')) {
            console.error('>>> ACTION REQUIRED: Enable "Google Drive API" in Cloud Console.');
        }
    }

    // 3. Sheet Read
    try {
        console.log('\n[Step 2] Reading Sheet Metadata...');
        const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
        console.log('✅ Sheet Access Success!');
        console.log('Title:', meta.data.properties?.title);

        const tabs = meta.data.sheets?.map(s => s.properties?.title) || [];
        console.log('Available Tabs:', tabs);

        // Check for 01_2026
        // Dynamic Month Check
        const today = new Date();
        const month = today.getMonth() + 1;
        const year = today.getFullYear();
        const expectedName = `${month.toString().padStart(2, '0')}_${year}`; // "01_2026"

        const found = tabs.find(t => t?.trim() === expectedName);
        if (found) {
            console.log(`✅ MATCH! Found tab "${found}"`);
        } else {
            console.log(`❌ Tab "${expectedName}" NOT found. Matches?`);
        }

    } catch (e: any) {
        console.error('❌ Sheet Read Failed:', e.message);
    }
}

main();
