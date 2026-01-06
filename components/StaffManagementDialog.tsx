import React, { useState } from 'react';
import { useMetaStore } from '@/store/metaStore';
import { X, UserPlus, Trash2, Loader2 } from 'lucide-react';

interface StaffManagementDialogProps {
    isOpen: boolean;
    onClose: () => void;
}

export function StaffManagementDialog({ isOpen, onClose }: StaffManagementDialogProps) {
    const { staff, addStaff, removeStaff } = useMetaStore();
    const [newName, setNewName] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newName.trim()) return;

        setIsSubmitting(true);
        setError(null);
        try {
            await addStaff(newName.trim());
            setNewName('');
        } catch (err: any) {
            setError(err.message || 'Failed to add staff');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleRemove = async (name: string) => {
        if (!confirm(`Remove ${name}? This will affect future bookings.`)) return;

        setIsSubmitting(true);
        setError(null);
        try {
            await removeStaff(name);
        } catch (err: any) {
            setError(err.message || 'Failed to remove staff');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 relative">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors">
                    <X className="w-5 h-5" />
                </button>

                <h3 className="font-bold text-xl mb-1 text-gray-800">Manage Staff</h3>
                <p className="text-xs text-gray-400 mb-6 font-medium">Add or remove staff members from the system</p>

                {error && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-100 text-red-600 text-xs rounded-lg font-medium">
                        {error}
                    </div>
                )}

                <div className="space-y-6">
                    {/* Add New Staff */}
                    <form onSubmit={handleAdd} className="flex gap-2">
                        <input
                            type="text"
                            placeholder="Staff name..."
                            className="flex-grow border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            disabled={isSubmitting}
                        />
                        <button
                            type="submit"
                            disabled={isSubmitting || !newName.trim()}
                            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all active:scale-95 shadow-sm shadow-blue-200"
                        >
                            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                            Add
                        </button>
                    </form>

                    {/* Staff List */}
                    <div>
                        <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3 px-1">Current Staff List</h4>
                        <div className="max-h-[300px] overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                            {staff.map((name) => (
                                <div key={name} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg group hover:bg-gray-100 transition-colors">
                                    <span className="text-sm font-bold text-gray-700">{name}</span>
                                    <button
                                        onClick={() => handleRemove(name)}
                                        disabled={isSubmitting}
                                        className="text-gray-400 hover:text-red-600 p-1.5 rounded-md hover:bg-white transition-all active:scale-90"
                                        title="Remove staff"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="mt-8 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-bold text-gray-500 hover:text-gray-700 transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
