'use server';

import prisma from '@/lib/db';

/**
 * Utility to serialize BigInt and Date objects returned by Prisma $queryRaw
 * so they can be parsed by Next.js Server Actions/Client Components.
 */
function serializeData(data: any[]): any[] {
    return data.map(item => {
        const serialized: any = {};
        for (const key in item) {
            const val = item[key];
            if (typeof val === 'bigint') {
                serialized[key] = Number(val);
            } else if (val instanceof Date) {
                serialized[key] = val.toISOString();
            } else {
                serialized[key] = val;
            }
        }
        return serialized;
    });
}

export async function getDailySummary() {
    try {
        const result = await prisma.$queryRaw`SELECT * FROM daily_summary`;
        return serializeData(Array.isArray(result) ? result : []);
    } catch (error) {
        console.error('getDailySummary Error:', error);
        return [];
    }
}

export async function getMonthlySummary() {
    try {
        const result = await prisma.$queryRaw`SELECT * FROM monthly_summary`;
        return serializeData(Array.isArray(result) ? result : []);
    } catch (error) {
        console.error('getMonthlySummary Error:', error);
        return [];
    }
}

export async function getMonthlyServiceRanking() {
    try {
        const result = await prisma.$queryRaw`SELECT * FROM monthly_service_ranking`;
        return serializeData(Array.isArray(result) ? result : []);
    } catch (error) {
        console.error('getMonthlyServiceRanking Error:', error);
        return [];
    }
}
