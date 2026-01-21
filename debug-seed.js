
const fs = require('fs');
const path = require('path');

const csvPath = path.join(process.cwd(), 'menustaff.csv');

try {
    const fileContent = fs.readFileSync(csvPath, 'utf-8');
    const lines = fileContent.split('\n');

    console.log(`Read ${lines.length} lines from ${csvPath}`);

    for (let i = 2; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const cols = line.split(',');
        const name = cols[0].trim();

        if (name.includes('CHAMPACA')) {
            console.log('--- Found Target ---');
            console.log(`Line ${i}: ${line}`);
            console.log(`Name: ${name}`);
            console.log(`Type Raw (Col 3): '${cols[3]}', Trimmed: '${cols[3]?.trim()}'`);
            console.log(`Massage Time (Col 4): '${cols[4]}', Parsed: ${parseInt(cols[4]?.trim())}`);
            console.log(`Head Spa Time (Col 5): '${cols[5]}', Parsed: ${parseInt(cols[5]?.trim())}`);
        }
    }
} catch (e) {
    console.error(e);
}
