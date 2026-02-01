'use client';

import { useState, useEffect } from 'react';
import { getServices, createService, deleteService, seedInitialServices, updateService } from '@/app/actions/booking-master';
import { Pencil, Trash2, RotateCcw, Plus } from 'lucide-react';
import { toast } from 'sonner';

export default function ServicesPage() {
    const [services, setServices] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        name: '', duration: 60, price: 0, category: 'Massage Seat', commission: 0,
        type: 'Single', massageDuration: 0, headSpaDuration: 0
    });

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
        try {
            await deleteService(id);
            toast.success('Service deleted');
            load();
        } catch (e) {
            console.error(e);
            toast.error('Failed to delete service');
        }
    };

    const handleEdit = (svc: any) => {
        setEditingId(svc.id);
        setFormData({
            name: svc.name,
            duration: svc.duration,
            price: svc.price,
            category: svc.category,
            commission: svc.commission,
            type: svc.type || 'Single',
            massageDuration: svc.massageDuration || 0,
            headSpaDuration: svc.headSpaDuration || 0
        });
        setIsFormOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingId) {
                await updateService(editingId, { ...formData, allowedStaff: [] }); // Update ignores allowedStaff in simple update
                toast.success('Service updated');
            } else {
                await createService({ ...formData, allowedStaff: [] });
                toast.success('Service created');
            }
            setIsFormOpen(false);
            setEditingId(null);
            setFormData({
                name: '', duration: 60, price: 0, category: 'Massage Seat', commission: 0,
                type: 'Single', massageDuration: 0, headSpaDuration: 0
            });
            load();
        } catch (e) {
            toast.error('Failed to save service');
            console.error(e);
        }
    };

    const handleUpdateCommission = async (id: string, val: string) => {
        const num = parseInt(val) || 0;
        await updateService(id, { commission: num });
    };

    return (
        <div className="p-6 text-slate-100 h-full overflow-auto">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">Services</h1>
                <div className="flex gap-2">
                    <button onClick={handleSeed} className="flex items-center gap-2 px-4 py-2 bg-slate-700 rounded hover:bg-slate-600 text-sm transition-colors">
                        <RotateCcw className="w-4 h-4" />
                        Initialize Defaults
                    </button>
                    <button
                        onClick={() => {
                            setEditingId(null);
                            setFormData({
                                name: '', duration: 60, price: 0, category: 'Massage Seat', commission: 0,
                                type: 'Single', massageDuration: 0, headSpaDuration: 0
                            });
                            setIsFormOpen(true);
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-[var(--primary)] text-slate-900 font-bold rounded hover:opacity-90 transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        Add Service
                    </button>
                </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-800 text-slate-400">
                        <tr>
                            <th className="px-4 py-3">Type</th>
                            <th className="px-4 py-3">Category</th>
                            <th className="px-4 py-3">Name</th>
                            <th className="px-4 py-3">Duration</th>
                            <th className="px-4 py-3">Body (M/A)</th>
                            <th className="px-4 py-3">H Time</th>
                            <th className="px-4 py-3">Price (VND)</th>
                            <th className="px-4 py-3">Commission (VND)</th>
                            <th className="px-4 py-3 w-10"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                        {isLoading ? <tr><td colSpan={9} className="p-4 text-center">Loading...</td></tr> :
                            services.map(svc => (
                                <tr key={svc.id} className="hover:bg-slate-800/50">
                                    <td className="px-4 py-3 text-xs opacity-70">{svc.type}</td>
                                    <td className="px-4 py-3">{svc.category}</td>
                                    <td className="px-4 py-3 font-medium">{svc.name}</td>
                                    <td className="px-4 py-3">{svc.duration} min</td>
                                    <td className="px-4 py-3">{svc.massageDuration ? `${svc.massageDuration}m` : '-'}</td>
                                    <td className="px-4 py-3">{svc.headSpaDuration ? `${svc.headSpaDuration}m` : '-'}</td>
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
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => handleEdit(svc)}
                                                className="p-1 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
                                            >
                                                <Pencil className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(svc.id)}
                                                className="p-1 text-red-400 hover:text-red-300 hover:bg-red-900/30 rounded transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                    </tbody>
                </table>
            </div>

            {isFormOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
                    <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-700 p-6 rounded-lg w-96 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
                        <h2 className="text-lg font-bold border-b border-slate-800 pb-2">
                            {editingId ? 'Edit Service' : 'New Service'}
                        </h2>

                        <div>
                            <label className="text-xs text-slate-500 block mb-1">Service Name</label>
                            <input className="w-full bg-slate-800 border-slate-700 rounded p-2" placeholder="e.g. Traditional Thai Massage" required
                                value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                        </div>

                        <div className="flex gap-2">
                            <div className="w-1/2">
                                <label className="text-xs text-slate-500 block mb-1">Type</label>
                                <select className="w-full bg-slate-800 border-slate-700 rounded p-2"
                                    value={formData.type || 'Single'}
                                    onChange={e => setFormData({ ...formData, type: e.target.value })}>
                                    <option value="Single">Single</option>
                                    <option value="Combo">Combo</option>
                                </select>
                            </div>
                            <div className="w-1/2">
                                <label className="text-xs text-slate-500 block mb-1">Total Duration</label>
                                <div className="relative">
                                    <input type="number" className="w-full bg-slate-800 border-slate-700 rounded p-2 pr-8" placeholder="Total" required
                                        value={formData.duration} onChange={e => setFormData({ ...formData, duration: parseInt(e.target.value) })} />
                                    <span className="absolute right-2 top-2 text-xs text-slate-500">min</span>
                                </div>
                            </div>
                        </div>

                        {formData.type === 'Combo' && (
                            <div className="bg-slate-800/50 p-2 rounded border border-slate-700/50 space-y-2">
                                <p className="text-xs text-[var(--primary)] font-bold">Split Duration (must sum to Total)</p>
                                <div className="flex gap-2">
                                    <div>
                                        <label className="text-xs text-slate-500 block mb-1">Massage</label>
                                        <input type="number" className="w-full bg-slate-800 border-slate-700 rounded p-2 text-sm" placeholder="min"
                                            value={formData.massageDuration || 0} onChange={e => setFormData({ ...formData, massageDuration: parseInt(e.target.value) })} />
                                    </div>
                                    <div>
                                        <label className="text-xs text-slate-500 block mb-1">Head Spa</label>
                                        <input type="number" className="w-full bg-slate-800 border-slate-700 rounded p-2 text-sm" placeholder="min"
                                            value={formData.headSpaDuration || 0} onChange={e => setFormData({ ...formData, headSpaDuration: parseInt(e.target.value) })} />
                                    </div>
                                </div>
                            </div>
                        )}

                        <div>
                            <label className="text-xs text-slate-500 block mb-1">Category</label>
                            <select className="w-full bg-slate-800 border-slate-700 rounded p-2"
                                value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })}>
                                <option>Massage</option>
                                <option>Head Spa</option>
                                <option>Aroma</option>
                                <option>Combo</option>
                            </select>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="text-xs text-slate-500 block mb-1">Price (VND)</label>
                                <input type="number" className="w-full bg-slate-800 border-slate-700 rounded p-2" placeholder="0" required
                                    value={formData.price} onChange={e => setFormData({ ...formData, price: parseInt(e.target.value) })} />
                            </div>
                            <div>
                                <label className="text-xs text-slate-500 block mb-1">Commission (VND)</label>
                                <input type="number" className="w-full bg-slate-800 border-slate-700 rounded p-2" placeholder="0" required
                                    value={formData.commission} onChange={e => setFormData({ ...formData, commission: parseInt(e.target.value) })} />
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-slate-800">
                            <button type="button" onClick={() => setIsFormOpen(false)} className="px-3 py-1.5 text-slate-400 hover:text-white transition-colors">Cancel</button>
                            <button type="submit" className="px-4 py-1.5 bg-[var(--primary)] text-slate-900 font-bold rounded hover:bg-amber-400 transition-colors">Save Service</button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}
