'use server';

import { prisma } from '@/lib/db';

// ── 月次サマリー（売上・件数・客単価・前月比）──────────────────────────
export async function getMonthlySummary() {
    const rows = await prisma.$queryRaw<{
        month: string;
        bookings: bigint;
        revenue: bigint;
    }[]>`
        SELECT
            TO_CHAR("startAt" AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM') AS month,
            COUNT(*)::bigint                                                AS bookings,
            COALESCE(SUM("totalPrice"), 0)::bigint                         AS revenue
        FROM "Booking"
        WHERE status NOT IN ('Cancelled', 'SYNC_DRAFT', 'NoShow')
          AND "totalPrice" > 0
        GROUP BY month
        ORDER BY month ASC
    `;

    return rows.map((r, i) => {
        const prev = i > 0 ? rows[i - 1] : null;
        const bookings = Number(r.bookings);
        const revenue  = Number(r.revenue);
        const prevRev  = prev ? Number(prev.revenue) : null;
        const prevBk   = prev ? Number(prev.bookings) : null;
        return {
            month:     r.month,
            bookings,
            revenue,
            avgSpend:  bookings > 0 ? Math.round(revenue / bookings) : 0,
            revGrowth: prevRev && prevRev > 0 ? Math.round((revenue - prevRev) / prevRev * 100) : null,
            bkGrowth:  prevBk  && prevBk  > 0 ? Math.round((bookings - prevBk)  / prevBk  * 100) : null,
        };
    });
}

// ── メニュー別ランキング ────────────────────────────────────────────────
export async function getMenuRanking(months = 6) {
    const since = new Date();
    since.setMonth(since.getMonth() - months);

    return prisma.$queryRaw<{
        menu: string;
        count: bigint;
        revenue: bigint;
    }[]>`
        SELECT
            "menuName"                         AS menu,
            COUNT(*)::bigint                   AS count,
            COALESCE(SUM("totalPrice"), 0)::bigint AS revenue
        FROM "Booking"
        WHERE status NOT IN ('Cancelled', 'SYNC_DRAFT', 'NoShow')
          AND "startAt" >= ${since}
          AND "menuName" IS NOT NULL
        GROUP BY "menuName"
        ORDER BY count DESC
        LIMIT 15
    `;
}

// ── 時間帯 × 曜日 ヒートマップ ─────────────────────────────────────────
export async function getHeatmap(months = 3) {
    const since = new Date();
    since.setMonth(since.getMonth() - months);

    const rows = await prisma.$queryRaw<{
        dow: number;
        hour: number;
        count: bigint;
    }[]>`
        SELECT
            EXTRACT(DOW  FROM "startAt" AT TIME ZONE 'Asia/Ho_Chi_Minh')::int AS dow,
            EXTRACT(HOUR FROM "startAt" AT TIME ZONE 'Asia/Ho_Chi_Minh')::int AS hour,
            COUNT(*)::bigint AS count
        FROM "Booking"
        WHERE status NOT IN ('Cancelled', 'SYNC_DRAFT')
          AND "startAt" >= ${since}
          AND ("comboLinkId" IS NULL OR "isComboMain" = true)
        GROUP BY dow, hour
        ORDER BY dow, hour
    `;
    return rows.map(r => ({ dow: r.dow, hour: r.hour, count: Number(r.count) }));
}

// ── No-show / キャンセル率 ─────────────────────────────────────────────
// 予約総数: Bookingテーブル（Confirmed のみ、コンボはメインのみカウント）
// No-show:  BookingInquiryテーブルの hasCome=false（実績データはこちらにある）
export async function getCancelStats(months = 6) {
    const since = new Date();
    since.setMonth(since.getMonth() - months);

    // 月次予約件数（Bookingベース、コンボ重複排除）
    const bookingRows = await prisma.$queryRaw<{
        month: string;
        total: bigint;
    }[]>`
        SELECT
            TO_CHAR("startAt" AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM') AS month,
            COUNT(*)::bigint AS total
        FROM "Booking"
        WHERE status NOT IN ('SYNC_DRAFT')
          AND "startAt" >= ${since}
          AND ("comboLinkId" IS NULL OR "isComboMain" = true)
        GROUP BY month
        ORDER BY month ASC
    `;

    // No-show & キャンセル（BookingInquiryベース）
    const inquiryRows = await prisma.$queryRaw<{
        month: string;
        inquiries: bigint;
        noshow: bigint;
    }[]>`
        SELECT
            TO_CHAR("inquiryDate" AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM') AS month,
            COUNT(*)::bigint AS inquiries,
            SUM(CASE WHEN NOT "hasCome" THEN 1 ELSE 0 END)::bigint AS noshow
        FROM "BookingInquiry"
        WHERE "inquiryDate" >= ${since}
        GROUP BY month
        ORDER BY month ASC
    `;

    const inquiryMap = new Map(inquiryRows.map(r => [r.month, r]));

    return bookingRows.map(r => {
        const inq = inquiryMap.get(r.month);
        const total     = Number(r.total);
        const inquiries = inq ? Number(inq.inquiries) : 0;
        const noshow    = inq ? Number(inq.noshow) : 0;
        return {
            month:      r.month,
            total,
            noshow,
            cancelled:  0,  // 予約削除で対応しているためキャンセルステータス未使用
            noshowPct:  inquiries > 0 ? +(noshow / inquiries * 100).toFixed(1) : 0,
            cancelPct:  0,
            inquiries,
        };
    });
}

// ── チャンネル別集計 ────────────────────────────────────────────────────
export async function getChannelStats(months = 6) {
    const since = new Date();
    since.setMonth(since.getMonth() - months);

    const rows = await prisma.$queryRaw<{
        channel: string;
        total: bigint;
        came: bigint;
        persons: bigint;
    }[]>`
        SELECT
            channel,
            COUNT(*)::bigint                                  AS total,
            SUM(CASE WHEN "hasCome" THEN 1 ELSE 0 END)::bigint AS came,
            COALESCE(SUM(persons), 0)::bigint                  AS persons
        FROM "BookingInquiry"
        WHERE "inquiryDate" >= ${since}
        GROUP BY channel
        ORDER BY total DESC
    `;

    return rows.map(r => ({
        channel:    r.channel,
        total:      Number(r.total),
        came:       Number(r.came),
        persons:    Number(r.persons),
        noshowRate: Number(r.total) > 0
            ? +((1 - Number(r.came) / Number(r.total)) * 100).toFixed(1)
            : 0,
    }));
}

// ── スタッフ別施術件数（月次）──────────────────────────────────────────
export async function getStaffPerformance(year: number, month: number) {
    const startDate = new Date(year, month - 1, 1);
    const endDate   = new Date(year, month, 1);

    const bookings = await prisma.$queryRaw<{
        staffId: string;
        staffName: string;
        count: bigint;
    }[]>`
        SELECT
            s.id                      AS "staffId",
            s.name                    AS "staffName",
            COUNT(b.id)::bigint       AS count
        FROM "Staff" s
        LEFT JOIN "Booking" b
            ON b."staffId" = s.id
           AND b."startAt" >= ${startDate}
           AND b."startAt" <  ${endDate}
           AND b.status NOT IN ('Cancelled', 'SYNC_DRAFT', 'NoShow')
        WHERE (
            s."isActive" = true
            OR (s."isActive" = false AND s."endDate" IS NOT NULL AND s."endDate" >= ${startDate})
        )
        GROUP BY s.id, s.name
        ORDER BY count DESC
    `;

    const adjustments = await prisma.payrollAdjustment.findMany({
        where: { year, month },
        select: { staffId: true, commission: true, incentive: true, bonus: true },
    });
    const adjMap = new Map(adjustments.map(a => [a.staffId, a]));

    const attendance = await prisma.attendance.groupBy({
        by: ['staffId'],
        where: {
            date: { gte: startDate, lt: endDate },
        },
        _sum: { workHours: true, overtime: true },
    });
    const attMap = new Map(attendance.map(a => [a.staffId, a._sum]));

    return bookings.map(r => {
        const adj = adjMap.get(r.staffId);
        const att = attMap.get(r.staffId);
        return {
            staffId:    r.staffId,
            staffName:  r.staffName,
            count:      Number(r.count),
            commission: (adj?.commission ?? 0) + (adj?.incentive ?? 0) + (adj?.bonus ?? 0),
            workHours:  +(att?.workHours ?? 0).toFixed(1),
            overtime:   +(att?.overtime  ?? 0).toFixed(1),
        };
    });
}

// ── 人件費サマリー（月次）─────────────────────────────────────────────
export async function getLaborSummary(year: number, month: number) {
    const startDate = new Date(year, month - 1, 1);
    const endDate   = new Date(year, month, 1);

    const staffList = await prisma.staff.findMany({
        where: {
            OR: [
                { isActive: true },
                { isActive: false, endDate: { not: null, gte: startDate } },
            ],
        },
        select: {
            id: true,
            baseWage: true,
            allowanceCommute: true,
            allowanceMeal: true,
            allowanceOther: true,
            allowancePosition: true,
            allowanceCommunication: true,
            allowanceHousing: true,
            allowanceLanguage: true,
        },
    });

    const adjustments = await prisma.payrollAdjustment.findMany({
        where: { year, month },
    });
    const adjMap = new Map(adjustments.map(a => [a.staffId, a]));

    let totalLaborCost = 0;
    for (const s of staffList) {
        const adj = adjMap.get(s.id);
        totalLaborCost +=
            s.baseWage +
            s.allowanceCommute + s.allowanceMeal + s.allowanceOther +
            s.allowancePosition + s.allowanceCommunication +
            s.allowanceHousing + s.allowanceLanguage +
            (adj?.commission ?? 0) + (adj?.incentive ?? 0) +
            (adj?.bonus ?? 0) + (adj?.allowanceCommute ?? 0) +
            (adj?.allowanceMeal ?? 0) + (adj?.allowanceOther ?? 0) +
            (adj?.allowancePosition ?? 0) + (adj?.allowanceCommunication ?? 0) +
            (adj?.allowanceHousing ?? 0) + (adj?.allowanceLanguage ?? 0) +
            (adj?.taxRefund ?? 0) -
            (adj?.deduction ?? 0) - (adj?.fine ?? 0);
    }

    return { totalLaborCost, headCount: staffList.length };
}

// ── チャンネル × 月 トレンド ────────────────────────────────────────────
export async function getChannelTrend(months = 6) {
    const since = new Date();
    since.setMonth(since.getMonth() - months);

    const rows = await prisma.$queryRaw<{
        month: string;
        channel: string;
        count: bigint;
    }[]>`
        SELECT
            TO_CHAR("inquiryDate", 'YYYY-MM') AS month,
            channel,
            COUNT(*)::bigint AS count
        FROM "BookingInquiry"
        WHERE "inquiryDate" >= ${since}
        GROUP BY month, channel
        ORDER BY month ASC, count DESC
    `;
    return rows.map(r => ({ month: r.month, channel: r.channel, count: Number(r.count) }));
}
