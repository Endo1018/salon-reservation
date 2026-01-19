'use client';

import { useState, useEffect } from 'react';
import { getServices, createService, deleteService, seedInitialServices, updateService } from '@/app/actions/booking-master';
import { useRouter } from 'next/navigation';

export default function ServicesPage() {
    const [services, setServices] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [formData, setFormData] = useState({
        name: '', duration: 60, price: 0, category: 'Massage Seat', commission: 0
    });

    const router = useRouter();

    const load = async () => {
        setIsLoading(true);
        const data = await getServices();
        setServices(data);
        setIsLoading(false);
    };

    useEffect(() => { load(); }, []);

    const handleSeed = async () => {
        if (!confirm('Import default services?')) return;
        await seedInitialServices();
        load();
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete service?')) return;
        await deleteService(id);
        load();
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await createService({ ...formData, allowedStaff: [] });
        setIsFormOpen(false);
        setFormData({ name: '', duration: 60, price: 0, category: 'Massage Seat', commission: 0 });
        load();
    };

    const handleUpdateCommission = async (id: string, val: string) => {
        const num = parseInt(val) || 0;
        await updateService(id, { commission: num });
    };

    return (
        <div className="p-6 text-slate-100">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">Services</h1>
                <div className="flex gap-2">
                    <button onClick={handleSeed} className="px-4 py-2 bg-slate-700 rounded hover:bg-slate-600 text-sm">
                        Initialize Defaults
                    </button>
                    <button onClick={() => setIsFormOpen(true)} className="px-4 py-2 bg-[var(--primary)] text-slate-900 font-bold rounded hover:opacity-90">
                        + Add Service
                    </button>
                </div>
            </div>

            {/* Simple Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-800 text-slate-400">
                        <tr>
                            <th className="px-4 py-3">Category</th>
                            <th className="px-4 py-3">Name</th>
                            <th className="px-4 py-3">Duration</th>
                            <th className="px-4 py-3">Price (VND)</th>
                            <th className="px-4 py-3">Commission (VND)</th>
                            <th className="px-4 py-3 w-10"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                        {isLoading ? <tr><td colSpan={6} className="p-4 text-center">Loading...</td></tr> :
                            services.map(svc => (
                                <tr key={svc.id} className="hover:bg-slate-800/50">
                                    <td className="px-4 py-3">{svc.category}</td>
                                    <td className="px-4 py-3 font-medium">{svc.name}</td>
                                    <td className="px-4 py-3">{svc.duration} min</td>
                                    <td className="px-4 py-3">{svc.price.toLocaleString()}</td>
                                    <td className="px-4 py-3">
                                        <input
                                            type="number"
                                            className="bg-slate-800 border-none rounded w-28 text-right p-1 focus:ring-1 focus:ring-[var(--primary)]"
                                            defaultValue={svc.commission}
                                            onBlur={(e) => handleUpdateCommission(svc.id, e.target.value)}
                                        />
                                    </td>
                                    <td className="px-4 py-3">
                                        <button onClick={() => handleDelete(svc.id)} className="text-red-400 hover:text-red-300">×</button>
                                    </td>
                                </tr>
                            ))}
                    </tbody>
                </table>
            </div>

            {/* Modal Form */}
            {isFormOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-700 p-6 rounded-lg w-96 space-y-4 shadow-xl">
                        <h2 className="text-lg font-bold">New Service</h2>
                        <input className="w-full bg-slate-800 border-slate-700 rounded p-2" placeholder="Name" required
                            value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                        <div className="flex gap-2">
                            <input type="number" className="w-1/2 bg-slate-800 border-slate-700 rounded p-2" placeholder="Duration (min)" required
                                value={formData.duration} onChange={e => setFormData({ ...formData, duration: parseInt(e.target.value) })} />
                            <select className="w-1/2 bg-slate-800 border-slate-700 rounded p-2"
                                value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })}>
                                <option>Massage Seat</option>
                                <option>Head Spa</option>
                                <option>Aroma Room</option>
                            </select>
                        </div>
                        <input type="number" className="w-full bg-slate-800 border-slate-700 rounded p-2" placeholder="Price (VND)" required
                            value={formData.price} onChange={e => setFormData({ ...formData, price: parseInt(e.target.value) })} />
                        <input type="number" className="w-full bg-slate-800 border-slate-700 rounded p-2" placeholder="Commission (VND)" required
                            value={formData.commission} onChange={e => setFormData({ ...formData, commission: parseInt(e.target.value) })} />

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
