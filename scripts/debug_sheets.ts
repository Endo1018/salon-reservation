import { google } from 'googleapis';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const SHEET_ID = process.env.SPREADSHEET_ID?.trim();
const GOOGLE_CLIENT_EMAIL = process.env.GOOGLE_CLIENT_EMAIL?.trim();
const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

const auth = new google.auth.GoogleAuth({
    credentials: {
        client_email: GOOGLE_CLIENT_EMAIL,
        private_key: GOOGLE_PRIVATE_KEY,
    },
    scopes: ['https://www.googleapis.com/auth/drive.readonly', 'https://www.googleapis.com/auth/spreadsheets.readonly'],
});

const drive = google.drive({ version: 'v3', auth });

async function main() {
    console.log('Checking File Capabilities...');
    try {
        const fileList = await drive.files.list({
            q: "mimeType='application/vnd.google-apps.spreadsheet'",
            fields: 'files(id, name, owners, mimeType, capabilities)',
        });

        const files = fileList.data.files;
        if (files && files.length > 0) {
            files.forEach(file => {
                console.log(`\nFile: [${file.name}]`);
                console.log(`ID: ${file.id}`);
                console.log(`Mime: ${file.mimeType}`);
                console.log(`Capabilities:`, JSON.stringify(file.capabilities, null, 2));
            });
        } else {
            console.log('No files found.');
        }

    } catch (error: any) {
        console.error('Error:', error.message);
    }
}

main();
