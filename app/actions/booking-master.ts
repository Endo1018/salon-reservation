'use server';

import { prisma } from '@/lib/db';
import { revalidatePath } from 'next/cache';

// --- SERVICE (MENU) ACTIONS ---

export async function getServices() {
    return await prisma.service.findMany({
        orderBy: { category: 'asc' }
    });
}

export async function createService(data: {
    name: string;
    duration: number;
    price: number;
    category: string;
    commission: number;
    allowedStaff: string[];
}) {
    await prisma.service.create({
        data: {
            ...data,
            type: 'Single' // Default
        }
    });
    revalidatePath('/admin/booking/services');
}

export async function updateService(id: string, data: {
    name?: string;
    duration?: number;
    price?: number;
    category?: string;
    commission?: number;
}) {
    await prisma.service.update({
        where: { id },
        data
    });
    revalidatePath('/admin/booking/services');
}

export async function deleteService(id: string) {
    await prisma.service.delete({ where: { id } });
    revalidatePath('/admin/booking/services');
}

export async function seedInitialServices() {
    const defaults = [
        { name: 'Thai Massage 2026', duration: 60, price: 1200000, category: 'Massage Seat', commission: 0 },
        { name: 'Thai Massage 2026', duration: 90, price: 1500000, category: 'Massage Seat', commission: 0 },
        { name: 'Thai Massage 2026', duration: 120, price: 1750000, category: 'Massage Seat', commission: 0 },

        { name: 'Aroma Body Therapy', duration: 60, price: 950000, category: 'Aroma Room', commission: 0 },
        { name: 'Aroma Body Therapy', duration: 90, price: 1250000, category: 'Aroma Room', commission: 0 },
        { name: 'Aroma Body Therapy', duration: 120, price: 1500000, category: 'Aroma Room', commission: 0 },

        { name: 'Standard Head Spa', duration: 60, price: 890000, category: 'Head Spa', commission: 0 },
        { name: 'Deluxe Course', duration: 180, price: 4800000, category: 'Aroma Room', commission: 0 },
    ];

    for (const svc of defaults) {
        // Check duplication by name + duration
        const exists = await prisma.service.findFirst({
            where: { name: svc.name, duration: svc.duration }
        });
        if (!exists) {
            await prisma.service.create({
                data: { ...svc, type: 'Single', allowedStaff: [] }
            });
        }
    }
    revalidatePath('/admin/booking/services');
}


// --- CUSTOMERS ACTIONS ---

export async function getCustomers() {
    return await prisma.customer.findMany({
        orderBy: { name: 'asc' }
    });
}

export async function createCustomer(data: { name: string; phone?: string; email?: string; notes?: string }) {
    await prisma.customer.create({ data });
    revalidatePath('/admin/booking/customers');
}

export async function updateCustomer(id: string, data: { name?: string; phone?: string; email?: string; notes?: string }) {
    await prisma.customer.update({
        where: { id },
        data
    });
    revalidatePath('/admin/booking/customers');
}

export async function deleteCustomer(id: string) {
    await prisma.customer.delete({ where: { id } });
    revalidatePath('/admin/booking/customers');
}
