'use client';

import { useState, useEffect } from 'react';
import { getCustomers, createCustomer, deleteCustomer } from '@/app/actions/booking-master';

export default function CustomersPage() {
    const [customers, setCustomers] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [formData, setFormData] = useState({ name: '', phone: '', email: '', notes: '' });

    const load = async () => {
        setIsLoading(true);
        const data = await getCustomers();
        setCustomers(data);
        setIsLoading(false);
    };

    useEffect(() => { load(); }, []);

    const handleDelete = async (id: string) => {
        if (!confirm('Delete customer?')) return;
        await deleteCustomer(id);
        load();
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await createCustomer(formData);
        setIsFormOpen(false);
        setFormData({ name: '', phone: '', email: '', notes: '' });
        load();
    };

    return (
        <div className="p-6 text-slate-100 h-full overflow-auto">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">Customers</h1>
                <button onClick={() => setIsFormOpen(true)} className="px-4 py-2 bg-[var(--primary)] text-slate-900 font-bold rounded hover:opacity-90">
                    + Add Customer
                </button>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-800 text-slate-400">
                        <tr>
                            <th className="px-4 py-3">Name</th>
                            <th className="px-4 py-3">Phone</th>
                            <th className="px-4 py-3">Email</th>
                            <th className="px-4 py-3">Notes</th>
                            <th className="px-4 py-3 w-10"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                        {isLoading ? <tr><td colSpan={5} className="p-4 text-center">Loading...</td></tr> :
                            customers.map(c => (
                                <tr key={c.id} className="hover:bg-slate-800/50">
                                    <td className="px-4 py-3 font-medium">{c.name}</td>
                                    <td className="px-4 py-3">{c.phone}</td>
                                    <td className="px-4 py-3">{c.email}</td>
                                    <td className="px-4 py-3 text-slate-500">{c.notes}</td>
                                    <td className="px-4 py-3">
                                        <button onClick={() => handleDelete(c.id)} className="text-red-400 hover:text-red-300">×</button>
                                    </td>
                                </tr>
                            ))}
                    </tbody>
                </table>
            </div>

            {isFormOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-700 p-6 rounded-lg w-96 space-y-4 shadow-xl">
                        <h2 className="text-lg font-bold">New Customer</h2>
                        <input className="w-full bg-slate-800 border-slate-700 rounded p-2" placeholder="Name" required
                            value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                        <div className="flex gap-2">
                            <input className="w-1/2 bg-slate-800 border-slate-700 rounded p-2" placeholder="Phone"
                                value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
                            <input className="w-1/2 bg-slate-800 border-slate-700 rounded p-2" placeholder="Email"
                                value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
                        </div>
                        <textarea className="w-full bg-slate-800 border-slate-700 rounded p-2" placeholder="Notes" rows={3}
                            value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} />

                        <div className="flex justify-end gap-2 mt-4">
                            <button type="button" onClick={() => setIsFormOpen(false)} className="px-3 py-1.5 text-slate-400 hover:text-white">Cancel</button>
                            <button type="submit" className="px-3 py-1.5 bg-[var(--primary)] text-slate-900 font-bold rounded">Save</button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}
