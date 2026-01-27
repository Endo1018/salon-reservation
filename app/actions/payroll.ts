'use server';

import prisma from '@/lib/db';
import { revalidatePath } from 'next/cache';

export async function updatePayrollAdjustment(
    staffId: string,
    year: number,
    month: number,
    data: {
        commission?: number;
        incentive?: number;
        bonus?: number;
        deduction?: number;
        allowancePosition?: number;
        allowanceCommute?: number;
        allowanceCommunication?: number;
        allowanceMeal?: number;
        allowanceHousing?: number;
        allowanceLanguage?: number;
        allowanceOther?: number;
        fine?: number;
        taxRefund?: number;
        notes?: string;
    }
) {
    if (!staffId || !year || !month) throw new Error('Missing keys');

    // Check for confirmation status
    const existing = await prisma.payrollAdjustment.findUnique({
        where: {
            staffId_year_month: {
                staffId,
                year,
                month
            }
        }
    });

    if (existing && existing.isConfirmed) {
        throw new Error('This payroll is already confirmed and cannot be edited.');
    }

    // Upsert
    await prisma.payrollAdjustment.upsert({
        where: {
            staffId_year_month: {
                staffId,
                year,
                month
            }
        },
        create: {
            staffId,
            year,
            month,
            commission: data.commission || 0,
            incentive: data.incentive || 0,
            bonus: data.bonus || 0,
            deduction: data.deduction || 0,
            allowancePosition: data.allowancePosition || 0,
            allowanceCommute: data.allowanceCommute || 0,
            allowanceCommunication: data.allowanceCommunication || 0,
            allowanceMeal: data.allowanceMeal || 0,
            allowanceHousing: data.allowanceHousing || 0,
            allowanceLanguage: data.allowanceLanguage || 0,
            allowanceOther: data.allowanceOther || 0,
            fine: data.fine || 0,
            taxRefund: data.taxRefund || 0,
            notes: data.notes
        },
        update: {
            commission: data.commission || 0,
            incentive: data.incentive || 0,
            bonus: data.bonus || 0,
            deduction: data.deduction || 0,
            allowancePosition: data.allowancePosition || 0,
            allowanceCommute: data.allowanceCommute || 0,
            allowanceCommunication: data.allowanceCommunication || 0,
            allowanceMeal: data.allowanceMeal || 0,
            allowanceHousing: data.allowanceHousing || 0,
            allowanceLanguage: data.allowanceLanguage || 0,
            allowanceOther: data.allowanceOther || 0,
            fine: data.fine || 0,
            taxRefund: data.taxRefund || 0,
            notes: data.notes
        }
    });

    revalidatePath('/admin/payroll');
}

export async function confirmPayroll(staffId: string, year: number, month: number) {
    if (!staffId || !year || !month) throw new Error('Missing keys');

    await prisma.payrollAdjustment.upsert({
        where: {
            staffId_year_month: {
                staffId,
                year,
                month
            }
        },
        create: {
            staffId, year, month,
            isConfirmed: true
        },
        update: {
            isConfirmed: true
        }
    });

    revalidatePath('/admin/payroll');
}

export async function confirmMonthlyPayroll(year: number, month: number) {
    if (!year || !month) throw new Error('Missing keys');

    // Update all adjustments for this month to confirmed
    await prisma.payrollAdjustment.updateMany({
        where: { year, month },
        data: { isConfirmed: true }
    });

    // Ensure all active staff have a confirmed adjustment record
    const activeStaff = await prisma.staff.findMany({ where: { isActive: true } });
    for (const staff of activeStaff) {
        await prisma.payrollAdjustment.upsert({
            where: {
                staffId_year_month: { staffId: staff.id, year, month }
            },
            create: { staffId: staff.id, year, month, isConfirmed: true },
            update: { isConfirmed: true }
        });
    }

    revalidatePath('/admin/payroll');
}
