'use client';

import { useState, useTransition } from 'react';
import { toggleStaffActive, updateStaff, deleteStaff } from '@/app/actions/staff';

type Staff = {
    id: string;
    name: string;
    role: string;
    baseWage: number;
    commissionRate: number;
    incentiveRate: number;
    insuranceBaseSalary?: number;
    dependents: number;
    allowancePosition?: number;
    allowanceCommute?: number;
    allowanceCommunication?: number;
    allowanceMeal?: number;
    allowanceHousing?: number;
    allowanceLanguage?: number;
    allowanceOther?: number;
    isActive: boolean;
};

export default function StaffList({ staffList }: { staffList: Staff[] }) {
    const [editingId, setEditingId] = useState<string | null>(null);

    const therapists = staffList.filter(s => s.role === 'THERAPIST');
    const reception = staffList.filter(s => s.role === 'RECEPTION');

    const renderTable = (title: string, list: Staff[]) => (
        <div className="mb-8">
            <h2 className="text-xl font-bold mb-4 pl-2 border-l-4 border-[var(--primary)]">{title}</h2>
            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-slate-900/50 text-slate-400 uppercase text-xs">
                        <tr>
                            <th className="p-4">ID</th>
                            <th className="p-4">Name</th>
                            <th className="p-4">Role</th>
                            <th className="p-4">Wage Structure</th>
                            <th className="p-4">Status</th>
                            <th className="p-4">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700">
                        {list.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="p-8 text-center text-slate-500">No staff in this role.</td>
                            </tr>
                        ) : list.map((staff) => {
                            const isEditing = editingId === staff.id;

                            if (isEditing) {
                                return (
                                    <tr key={staff.id} className="bg-slate-700/50">
                                        <InputRow staff={staff} onCancel={() => setEditingId(null)} />
                                    </tr>
                                );
                            }

                            return (
                                <tr key={staff.id} className="hover:bg-slate-700/50 transition-colors">
                                    <td className="p-4 font-mono">{staff.id}</td>
                                    <td className="p-4 font-bold">{staff.name}</td>
                                    <td className="p-4">
                                        <span className={`px-2 py-1 rounded text-xs border ${staff.role === 'THERAPIST'
                                            ? 'bg-purple-900/20 text-purple-300 border-purple-800'
                                            : 'bg-orange-900/20 text-orange-300 border-orange-800'
                                            }`}>
                                            {staff.role}
                                        </span>
                                    </td>
                                    <td className="p-4 text-sm text-slate-400">
                                        <div>Monthly: {staff.baseWage.toLocaleString()}</div>
                                        {staff.insuranceBaseSalary && staff.insuranceBaseSalary > 0 && (
                                            <div className="text-yellow-500/80">BHXH: {staff.insuranceBaseSalary.toLocaleString()}</div>
                                        )}
                                        {staff.role === 'THERAPIST' && (
                                            <div className="text-[var(--primary)]">Comm: {staff.commissionRate.toLocaleString()}</div>
                                        )}
                                        {staff.role === 'RECEPTION' && (
                                            <div className="text-green-400">Comm: {staff.commissionRate.toLocaleString()}</div>
                                        )}
                                        <div className="text-slate-500 text-xs mt-1">Dependents: {staff.dependents}</div>

                                        {/* Allowances Display */}
                                        <div className="mt-2 pt-2 border-t border-slate-700/50 grid grid-cols-2 gap-x-2 gap-y-1 text-xs text-slate-400">
                                            {(staff.allowancePosition || 0) > 0 && <div>役職: {staff.allowancePosition?.toLocaleString()}</div>}
                                            {(staff.allowanceCommute || 0) > 0 && <div>通勤: {staff.allowanceCommute?.toLocaleString()}</div>}
                                            {(staff.allowanceCommunication || 0) > 0 && <div>通信: {staff.allowanceCommunication?.toLocaleString()}</div>}
                                            {(staff.allowanceMeal || 0) > 0 && <div>食事: {staff.allowanceMeal?.toLocaleString()}</div>}
                                            {(staff.allowanceHousing || 0) > 0 && <div>住宅: {staff.allowanceHousing?.toLocaleString()}</div>}
                                            {(staff.allowanceLanguage || 0) > 0 && <div>外語: {staff.allowanceLanguage?.toLocaleString()}</div>}
                                            {(staff.allowanceOther || 0) > 0 && <div>他: {staff.allowanceOther?.toLocaleString()}</div>}
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        {staff.isActive ? (
                                            <span className="text-green-400 text-xs font-bold">ACTIVE</span>
                                        ) : (
                                            <span className="text-red-400 text-xs font-bold">RETIRED</span>
                                        )}
                                    </td>
                                    <td className="p-4">
                                        <div className="flex flex-col gap-2 items-start">
                                            <button onClick={() => setEditingId(staff.id)} className="text-xs bg-blue-600 px-2 py-1 rounded text-white hover:bg-blue-500">
                                                Edit
                                            </button>

                                            <form action={toggleStaffActive.bind(null, staff.id, staff.isActive)}>
                                                <button className="text-xs underline text-slate-500 hover:text-white">
                                                    {staff.isActive ? 'Deactivate' : 'Activate'}
                                                </button>
                                            </form>

                                            <form action={deleteStaff.bind(null, staff.id)} onSubmit={(e) => {
                                                if (!confirm('Are you sure you want to DELETE this staff? This cannot be undone.')) {
                                                    e.preventDefault();
                                                }
                                            }}>
                                                <button className="text-xs text-red-500 hover:text-red-400 font-bold">
                                                    Delete
                                                </button>
                                            </form>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );

    return (
        <div>
            {renderTable('THERAPIST', therapists)}
            {renderTable('RECEPTION', reception)}
        </div>
    );
}

function InputRow({ staff, onCancel }: { staff: Staff, onCancel: () => void }) {
    // Store as strings to allow empty input without forcing 0
    const [formData, setFormData] = useState({
        name: staff.name,
        role: staff.role,
        baseWage: String(staff.baseWage),
        commissionRate: String(staff.commissionRate || staff.incentiveRate),
        incentiveRate: "0",
        insuranceBaseSalary: String(staff.insuranceBaseSalary || 0),
        dependents: String(staff.dependents || 0),
        allowancePosition: String(staff.allowancePosition || 0),
        allowanceCommute: String(staff.allowanceCommute || 0),
        allowanceCommunication: String(staff.allowanceCommunication || 0),
        allowanceMeal: String(staff.allowanceMeal || 0),
        allowanceHousing: String(staff.allowanceHousing || 0),
        allowanceLanguage: String(staff.allowanceLanguage || 0),
        allowanceOther: String(staff.allowanceOther || 0),
    });
    const [isSaving, startTransition] = useTransition();

    const handleSave = () => {
        const data = new FormData();
        data.append('id', staff.id);
        data.append('name', formData.name);
        data.append('role', formData.role);
        // Ensure we send "0" if empty, or just send the string and let server handle
        data.append('baseWage', formData.baseWage || "0");
        data.append('commissionRate', formData.commissionRate || "0");
        data.append('incentiveRate', formData.incentiveRate || "0");
        data.append('insuranceBaseSalary', formData.insuranceBaseSalary || "0");
        data.append('dependents', formData.dependents || "0");
        data.append('allowancePosition', formData.allowancePosition || "0");
        data.append('allowanceCommute', formData.allowanceCommute || "0");
        data.append('allowanceCommunication', formData.allowanceCommunication || "0");
        data.append('allowanceMeal', formData.allowanceMeal || "0");
        data.append('allowanceHousing', formData.allowanceHousing || "0");
        data.append('allowanceLanguage', formData.allowanceLanguage || "0");
        data.append('allowanceOther', formData.allowanceOther || "0");

        startTransition(async () => {
            await updateStaff(data);
            onCancel();
        });
    };

    return (
        <>
            <td className="p-4 font-mono text-slate-400">
                {staff.id}
            </td>
            <td className="p-4">
                <input
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="bg-slate-900 border border-slate-600 rounded p-1 w-full text-white"
                />
            </td>
            <td className="p-4">
                <select
                    value={formData.role}
                    onChange={e => setFormData({ ...formData, role: e.target.value })}
                    className="bg-slate-900 border border-slate-600 rounded p-1 w-full text-white"
                >
                    <option value="THERAPIST">THERAPIST</option>
                    <option value="RECEPTION">RECEPTION</option>
                </select>
            </td>
            <td className="p-4 text-sm">
                <div className="flex gap-1 items-center mb-1">
                    <span className="w-12 text-xs">Monthly:</span>
                    <input
                        type="number"
                        value={formData.baseWage}
                        onChange={e => setFormData({ ...formData, baseWage: e.target.value })}
                        className="bg-slate-900 border border-slate-600 rounded p-1 w-20 text-white"
                    />
                </div>
                <div className="flex gap-1 items-center mb-1">
                    <span className="w-12 text-xs text-yellow-400">BHXH:</span>
                    <input
                        type="number"
                        value={formData.insuranceBaseSalary}
                        onChange={e => setFormData({ ...formData, insuranceBaseSalary: e.target.value })}
                        className="bg-slate-900 border border-slate-600 rounded p-1 w-20 text-white"
                    />
                </div>
                <div className="flex gap-1 items-center mb-1">
                    <span className="w-12 text-xs">Comm%:</span>
                    <input
                        type="number"
                        value={formData.commissionRate}
                        onChange={e => setFormData({ ...formData, commissionRate: e.target.value })}
                        className="bg-slate-900 border border-slate-600 rounded p-1 w-20 text-white"
                    />
                </div>
                <div className="flex gap-1 items-center mb-1">
                    <span className="w-12 text-xs">Dept:</span>
                    <input
                        type="number"
                        value={formData.dependents}
                        onChange={e => setFormData({ ...formData, dependents: e.target.value })}
                        className="bg-slate-900 border border-slate-600 rounded p-1 w-20 text-white"
                    />
                </div>
                <div className="mt-2 pt-2 border-t border-slate-700 grid grid-cols-2 md:grid-cols-3 gap-x-2 gap-y-2">
                    <div className="flex items-center gap-1">
                        <span className="text-[10px] w-8 text-slate-400">役職:</span>
                        <input
                            type="number"
                            value={formData.allowancePosition}
                            onChange={e => setFormData({ ...formData, allowancePosition: e.target.value })}
                            className="bg-slate-900 border border-slate-600 rounded p-1 w-full text-xs text-white"
                            placeholder="役職"
                        />
                    </div>
                    <div className="flex items-center gap-1">
                        <span className="text-[10px] w-8 text-slate-400">通勤:</span>
                        <input
                            type="number"
                            value={formData.allowanceCommute}
                            onChange={e => setFormData({ ...formData, allowanceCommute: e.target.value })}
                            className="bg-slate-900 border border-slate-600 rounded p-1 w-full text-xs text-white"
                            placeholder="通勤"
                        />
                    </div>
                    <div className="flex items-center gap-1">
                        <span className="text-[10px] w-8 text-slate-400">通信:</span>
                        <input
                            type="number"
                            value={formData.allowanceCommunication}
                            onChange={e => setFormData({ ...formData, allowanceCommunication: e.target.value })}
                            className="bg-slate-900 border border-slate-600 rounded p-1 w-full text-xs text-white"
                            placeholder="通信"
                        />
                    </div>
                    <div className="flex items-center gap-1">
                        <span className="text-[10px] w-8 text-slate-400">食事:</span>
                        <input
                            type="number"
                            value={formData.allowanceMeal}
                            onChange={e => setFormData({ ...formData, allowanceMeal: e.target.value })}
                            className="bg-slate-900 border border-slate-600 rounded p-1 w-full text-xs text-white"
                            placeholder="食事"
                        />
                    </div>
                    <div className="flex items-center gap-1">
                        <span className="text-[10px] w-8 text-slate-400">住宅:</span>
                        <input
                            type="number"
                            value={formData.allowanceHousing}
                            onChange={e => setFormData({ ...formData, allowanceHousing: e.target.value })}
                            className="bg-slate-900 border border-slate-600 rounded p-1 w-full text-xs text-white"
                            placeholder="住宅"
                        />
                    </div>
                    <div className="flex items-center gap-1">
                        <span className="text-[10px] w-8 text-slate-400">外語:</span>
                        <input
                            type="number"
                            value={formData.allowanceLanguage}
                            onChange={e => setFormData({ ...formData, allowanceLanguage: e.target.value })}
                            className="bg-slate-900 border border-slate-600 rounded p-1 w-full text-xs text-white"
                            placeholder="外語"
                        />
                    </div>
                    <div className="flex items-center gap-1 md:col-span-1">
                        <span className="text-[10px] w-8 text-slate-400">他:</span>
                        <input
                            type="number"
                            value={formData.allowanceOther}
                            onChange={e => setFormData({ ...formData, allowanceOther: e.target.value })}
                            className="bg-slate-900 border border-slate-600 rounded p-1 w-full text-xs text-white"
                            placeholder="他"
                        />
                    </div>
                </div>
            </td>
            <td className="p-4 text-center">
                -
            </td>
            <td className="p-4">
                <div className="flex flex-col gap-2">
                    <button onClick={handleSave} disabled={isSaving} className="text-xs bg-green-600 px-2 py-1 rounded text-white font-bold hover:bg-green-500 disabled:opacity-50">
                        {isSaving ? 'Saving...' : 'Save'}
                    </button>
                    <button onClick={onCancel} className="text-xs underline text-slate-400">
                        Cancel
                    </button>
                </div>
            </td>
        </>
    );
}
