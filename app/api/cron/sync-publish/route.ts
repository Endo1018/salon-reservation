import { NextRequest, NextResponse } from 'next/server';
import { syncBookingsFromGoogleSheets } from '@/app/actions/sync-google';
import { publishDrafts } from '@/app/actions/publish-draft';

export const dynamic = 'force-dynamic';

/**
 * POST /api/cron/sync-publish
 * Google Sheets → Fetch Draft → Publish を自動実行
 * Authorization: Bearer <CRON_SECRET>
 */
export async function POST(req: NextRequest) {
    // 認証チェック
    const auth = req.headers.get('authorization') ?? '';
    const secret = process.env.CRON_SECRET;
    if (!secret || auth !== `Bearer ${secret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const startedAt = Date.now();
    const now = new Date();
    // HCM (UTC+7) で当月を計算
    const hcm = new Date(now.getTime() + 7 * 60 * 60 * 1000);
    const year  = hcm.getUTCFullYear();
    const month = hcm.getUTCMonth() + 1;
    const targetDateStr = `${year}-${String(month).padStart(2, '0')}-01`;

    console.log(`[sync-publish] START ${new Date().toISOString()} → target: ${targetDateStr}`);

    // Step 1: Fetch Draft (Google Sheets → SYNC_DRAFT)
    const syncResult = await syncBookingsFromGoogleSheets(targetDateStr);
    if (!syncResult.success) {
        console.error('[sync-publish] Sync failed:', syncResult.message);
        return NextResponse.json({
            success: false,
            step: 'sync',
            message: syncResult.message,
        }, { status: 500 });
    }
    console.log('[sync-publish] Sync OK:', syncResult.message);

    // Step 2: Publish (SYNC_DRAFT → Confirmed)
    const publishResult = await publishDrafts(year, month);
    if (!publishResult.success) {
        console.error('[sync-publish] Publish failed:', publishResult.message);
        return NextResponse.json({
            success: false,
            step: 'publish',
            message: publishResult.message,
        }, { status: 500 });
    }
    console.log('[sync-publish] Publish OK:', publishResult.message);

    const elapsed = Date.now() - startedAt;
    return NextResponse.json({
        success: true,
        target: targetDateStr,
        sync:    syncResult.message,
        publish: publishResult.message,
        elapsedMs: elapsed,
    });
}
