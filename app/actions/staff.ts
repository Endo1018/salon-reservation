'use server';

import prisma from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export async function createStaff(formData: FormData) {
    let id = formData.get('id') as string;
    const name = formData.get('name') as string;
    const role = formData.get('role') as string;
    const baseWage = Number(formData.get('baseWage'));
    const commissionRate = Number(formData.get('commissionRate') || 0);
    const incentiveRate = Number(formData.get('incentiveRate') || 0);

    if (!name || !role) {
        throw new Error('Missing required fields');
    }

    // Auto-generate ID if empty
    if (!id) {
        const timestamp = Date.now().toString();
        id = `TEMP-${timestamp.slice(-6)}`;
    }

    try {
        await prisma.staff.create({
            data: {
                id,
                name,
                role,
                baseWage,
                commissionRate,
                incentiveRate,
                insuranceBaseSalary: Number(formData.get('insuranceBaseSalary') || 0),
                dependents: Number(formData.get('dependents') || 0),
                allowancePosition: Number(formData.get('allowancePosition') || 0),
                allowanceCommute: Number(formData.get('allowanceCommute') || 0),
                allowanceCommunication: Number(formData.get('allowanceCommunication') || 0),
                allowanceMeal: Number(formData.get('allowanceMeal') || 0),
                allowanceHousing: Number(formData.get('allowanceHousing') || 0),
                allowanceLanguage: Number(formData.get('allowanceLanguage') || 0),
                allowanceOther: Number(formData.get('allowanceOther') || 0),
            },
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
        console.log("Error creating staff:", e);
        if (e.message === 'NEXT_REDIRECT') {
            throw e;
        }
        if (e.code === 'P2002') {
            redirect('/admin/staff?status=duplicate');
        }
        redirect('/admin/staff?status=error');
    }

    revalidatePath('/admin/staff');
    redirect('/admin/staff?status=success');
}

export async function toggleStaffActive(id: string, currentStatus: boolean) {
    await prisma.staff.update({
        where: { id },
        data: { isActive: !currentStatus },
    });
    revalidatePath('/admin/staff');
}

export async function updateStaff(formData: FormData) {
    const originalId = formData.get('originalId') as string;
    const id = formData.get('id') as string;
    const name = formData.get('name') as string;
    const role = formData.get('role') as string;
    const baseWage = Number(formData.get('baseWage'));
    const commissionRate = Number(formData.get('commissionRate') || 0);
    const incentiveRate = Number(formData.get('incentiveRate') || 0);

    // Use originalId for lookup if provided (renaming case), otherwise use id
    const targetId = originalId || id;

    // Parse endDate
    const endDateStr = formData.get('endDate') as string;
    const endDate = endDateStr ? new Date(endDateStr) : null;

    await prisma.staff.update({
        where: { id: targetId },
        data: {
            id: id, // Update to new ID (if same, no-op)
            name,
            role,
            baseWage,
            commissionRate,
            incentiveRate,
            insuranceBaseSalary: Number(formData.get('insuranceBaseSalary') || 0),
            dependents: Number(formData.get('dependents') || 0),
            allowancePosition: Number(formData.get('allowancePosition') || 0),
            allowanceCommute: Number(formData.get('allowanceCommute') || 0),
            allowanceCommunication: Number(formData.get('allowanceCommunication') || 0),
            allowanceMeal: Number(formData.get('allowanceMeal') || 0),
            allowanceHousing: Number(formData.get('allowanceHousing') || 0),
            allowanceLanguage: Number(formData.get('allowanceLanguage') || 0),
            allowanceOther: Number(formData.get('allowanceOther') || 0),
            endDate: endDate, // Nullable Date
        },
    });

    revalidatePath('/admin/staff');
    revalidatePath('/admin/payroll');
    // redirect('/admin/staff?status=updated'); // Removed to allow client-side close
}

export async function deleteStaff(id: string) {
    try {
        await prisma.staff.delete({
            where: { id },
        });
    } catch (e) {
        console.error(e);
        redirect('/admin/staff?status=error');
    }
    revalidatePath('/admin/staff');
    redirect('/admin/staff?status=deleted');
}
