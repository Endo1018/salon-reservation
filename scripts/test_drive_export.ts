import { google } from 'googleapis';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const SHEET_ID = '1zFXo9CvS_RHd8EbN6Ae3Tlh31MBGcNybxzk-5q1FZ5k';
const GOOGLE_CLIENT_EMAIL = process.env.GOOGLE_CLIENT_EMAIL;
const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

const auth = new google.auth.GoogleAuth({
    credentials: {
        client_email: GOOGLE_CLIENT_EMAIL,
        private_key: GOOGLE_PRIVATE_KEY,
    },
    scopes: ['https://www.googleapis.com/auth/drive'],
});

const drive = google.drive({ version: 'v3', auth });

async function main() {
    console.log('Testing drive.files.get (Metadata) for ID:', SHEET_ID);

    try {
        const res = await drive.files.get({
            fileId: SHEET_ID,
            fields: 'id, name, mimeType, owners, capabilities',
            supportsAllDrives: true
        });

        console.log('GET Metadata Success!');
        console.log('Name:', res.data.name);
        console.log('Mime:', res.data.mimeType);
    } catch (e: any) {
        console.error('GET Metadata Failed:', e.message);
        if (e.response) {
            console.error('Details:', e.response.data);
        }
    }
}

main();
