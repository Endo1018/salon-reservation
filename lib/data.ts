import Papa from 'papaparse';
import { Menu, Staff } from '@/types';

// We load the CSV from public or local file. Since this is server-side or build-time capable,
// but we want it available in client for this demo app. 
// For simplicity in a Next.js app, we can put the CSV in `public/` and fetch it, 
// OR import it as a raw string if configured, OR read via fs in Server Component -> pass to Client.
// Given the requirements, I'll assume we can read it on the server (Server Action or API or Page) and pass data down.
// Let's create a function that reads the file content (passed as string) or fetches it.

// Since I cannot move the file to `public` easily in `create-next-app` structure without manual steps,
// Valid approach: assume the file is at project root.
// We can use `fs` in `lib/data.ts` BUT `lib/data.ts` might be imported in Client Components where `fs` is not available.
// Better: specific server-only data loader.

import fs from 'fs';
import path from 'path';

export async function loadMenuData(): Promise<{ menus: Menu[], allStaff: string[] }> {
    // This function must only be called from Server Components/Server Actions
    const filePath = path.join(process.cwd(), 'menustaff.csv');
    const fileContent = fs.readFileSync(filePath, 'utf-8');

    return parseMenuCSV(fileContent);
}

export function parseMenuCSV(csvContent: string): { menus: Menu[], allStaff: string[] } {
    const lines = csvContent.split('\n');
    // Expected structure:
    // Line 1: ,,,,,,,習得,,,,,,
    // Line 2: メニュー名,時間(分),金額(C),分類(D),Massage Time,Head Spa Time,カテゴリ,Joy,Jen,Daisy,Chi,Lili,Sam,Kim
    // Line 3+: Data

    // Check if Line 1 is the '習得' line. If so, Line 2 is the header.
    // Or we can just inspect line which starts with 'メニュー名'.

    let headerLineIndex = -1;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('メニュー名')) {
            headerLineIndex = i;
            break;
        }
    }

    if (headerLineIndex === -1) {
        throw new Error('Invalid CSV format: Header "メニュー名" not found (Note: Check encoding, assuming UTF-8)');
    }

    const headerLine = lines[headerLineIndex];
    const headers = headerLine.split(',').map(h => h.trim());

    // Staff names start from column 7 (0-indexed)
    // Check index of 'カテゴリ' -> next one is staff.
    const categoryIndex = headers.indexOf('カテゴリ');
    if (categoryIndex === -1) throw new Error('Column "カテゴリ" not found');

    const staffStartIndex = categoryIndex + 1;
    const staffNames = headers.slice(staffStartIndex).filter(s => s && s.length > 0);

    const menus: Menu[] = [];

    // Parse data lines
    // Use PapaParse logic or manual for robustness with quotes?
    // The sample seems simple, no quotes. Manual split is risky if menu name has comma.
    // Better use PapaParse on the substring from headerLineIndex.

    const contentToParse = lines.slice(headerLineIndex).join('\n');

    const { data } = Papa.parse(contentToParse, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: false // do manual conversion
    });

    // data is array of objects keyed by header

    data.forEach((row: any) => {
        const name = row['メニュー名'];
        if (!name) return;

        const duration = parseInt(row['時間(分)'] || '0', 10);
        const price = parseInt(row['金額(C)']?.replace(/[^0-9]/g, '') || '0', 10);
        const typeStr = row['分類(D)'];
        const type = (typeStr && typeStr.toLowerCase() === 'combo') ? 'Combo' : 'Single';
        const massageTime = row['Massage Time'] ? parseInt(row['Massage Time'], 10) : undefined;
        const headSpaTime = row['Head Spa Time'] ? parseInt(row['Head Spa Time'], 10) : undefined;
        const category = row['カテゴリ'] || 'Unknown';

        // Staff availability
        const allowedStaff: string[] = [];
        staffNames.forEach(staff => {
            const val = row[staff];
            if (val === '○' || val === 'O' || val === 'o') {
                allowedStaff.push(staff);
            }
        });

        menus.push({
            id: name, // Unique enough? duplicate names in CSV?
            // CSV has "Thai Massage 2026" with diff durations.
            // So ID should include duration: `${name}-${duration}`
            name,
            duration,
            price,
            type,
            massageTime,
            headSpaTime,
            category,
            allowedStaff
        });
    });

    // Fix IDs for duplicates
    // Actually, we should probably generate a slug or index based ID.
    const menusWithIds = menus.map((m, i) => ({
        ...m,
        id: `${m.name.replace(/\s+/g, '-')}-${m.duration}-${i}`
    }));

    return { menus: menusWithIds, allStaff: staffNames };
}
