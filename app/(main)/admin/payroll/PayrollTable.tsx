'use client';

import { Staff, Attendance, Shift, PayrollAdjustment } from '@prisma/client';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { calculateStaffPayroll, formatCurrencyVND } from '@/lib/payroll-engine';
import { updatePayrollAdjustment } from '@/app/actions/payroll';
import PDFExportButton from './PDFExportButton';

type Props = {
    staffList: Staff[];
    attendance: Attendance[];
    shifts: Shift[];
    adjustments: PayrollAdjustment[];
    year: number;
    month: number;
};

export default function PayrollTable({ staffList, attendance, shifts, adjustments, year, month }: Props) {
    const router = useRouter();
    const [editingStaffId, setEditingStaffId] = useState<string | null>(null);

    const handleMonthChange = (offset: number) => {
        let newYear = year;
        let newMonth = month + offset;
        if (newMonth > 12) {
            newYear++;
            newMonth = 1;
        } else if (newMonth < 1) {
            newYear--;
            newMonth = 12;
        }
        router.push(`?year=${newYear}&month=${newMonth}`);
    };

    // Calculate Payroll Data using Engine
    const payrollData = staffList.map(staff => {
        const staffAttendance = attendance.filter(a => a.staffId === staff.id);
        const filteredShifts = shifts.filter(s => s.staffId === staff.id);
        const adjustment = adjustments.find(a => a.staffId === staff.id);

        const result = calculateStaffPayroll(staff, staffAttendance, filteredShifts, year, month, adjustment || undefined);
        return {
            staff,
            adjustment,
            ...result
        };
    });

    const fmtHours = (n: number) => n.toFixed(1);

    return (
        <div className="space-y-6">
            {/* Header / Month Selector */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                    <h2 className="text-2xl font-bold flex items-center gap-2 text-slate-200">
                        <span className="text-[var(--primary)]">{year}</span>
                        <span className="text-slate-400">/</span>
                        <span>{month.toString().padStart(2, '0')}</span>
                    </h2>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => handleMonthChange(-1)} className="p-2 bg-slate-800 hover:bg-slate-700 rounded text-slate-400 hover:text-white transition-colors">
                        &larr; Prev
                    </button>
                    <button onClick={() => handleMonthChange(1)} className="p-2 bg-slate-800 hover:bg-slate-700 rounded text-slate-400 hover:text-white transition-colors">
                        Next &rarr;
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-slate-300 border-collapse">
                    <thead className="text-xs text-slate-400 uppercase bg-slate-800/50 border-b border-slate-700">
                        <tr>
                            <th className="px-4 py-3 min-w-[150px]">Name</th>
                            <th className="px-4 py-3 text-right">Work</th>
                            <th className="px-4 py-3 text-right">Base</th>
                            <th className="px-4 py-3 text-right text-green-400">Allowances</th>
                            <th className="px-4 py-3 text-right text-pink-400">Overtime</th>
                            <th className="px-4 py-3 text-right text-red-400">Holiday</th>
                            <th className="px-4 py-3 text-right text-purple-400">Comm/Inc</th>
                            <th className="px-4 py-3 text-right text-blue-400">Bonus/Ded</th>
                            <th className="px-4 py-3 text-right font-bold text-white">GROSS</th>
                            <th className="px-4 py-3 text-right text-yellow-400">Ins/Tax</th>
                            <th className="px-4 py-3 text-right font-bold text-[var(--primary)]">NET</th>
                            <th className="px-4 py-3"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700">
                        {payrollData.map((row) => (
                            <tr key={row.staff.id} className="hover:bg-slate-800/30 transition-colors">
                                <td className="px-4 py-3 font-bold text-white">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-2 h-2 rounded-full ${row.staff.role === 'THERAPIST' ? 'bg-purple-500' : 'bg-orange-500'}`} />
                                        {row.staff.name}
                                    </div>
                                    <div className="text-[10px] text-slate-500 mt-1 pl-4">
                                        Wage: {formatCurrencyVND(row.staff.baseWage)}<br />
                                        Dept: {row.staff.dependents || 0}
                                    </div>
                                </td>

                                <td className="px-4 py-3 text-right font-mono text-xs">
                                    <div className="text-white">{row.totalWorkDays}d</div>
                                    <div className="text-slate-500">{fmtHours(row.totalWorkHours)}h</div>
                                </td>

                                <td className="px-4 py-3 text-right font-mono text-slate-200">
                                    {formatCurrencyVND(row.basePayTotal)}
                                </td>

                                <td className="px-4 py-3 text-right font-mono text-green-300" title={`Pos: ${formatCurrencyVND(row.allowances.position)}\nMeal: ${formatCurrencyVND(row.allowances.meal)}\nCommute: ${formatCurrencyVND(row.allowances.commute)}\nHousing: ${formatCurrencyVND(row.allowances.housing)}\nLang: ${formatCurrencyVND(row.allowances.language)}\nCommunic: ${formatCurrencyVND(row.allowances.communication)}\nOther: ${formatCurrencyVND(row.allowances.other)}`}>
                                    {row.allowances.total > 0 ? formatCurrencyVND(row.allowances.total) : '-'}
                                </td>

                                <td className="px-4 py-3 text-right font-mono text-pink-300">
                                    {row.overtimePayTotal > 0 ? (
                                        <>
                                            <div>{formatCurrencyVND(row.overtimePayTotal)}</div>
                                            <div className="text-[10px] text-pink-500/70">
                                                {fmtHours(row.totalOvertimeHours)}h
                                            </div>
                                        </>
                                    ) : '-'}
                                </td>

                                <td className="px-4 py-3 text-right font-mono text-red-300">
                                    {row.holidayWorkPayTotal > 0 ? (
                                        <>
                                            <div>{formatCurrencyVND(row.holidayWorkPayTotal)}</div>
                                            <div className="text-[10px] text-red-500/70">
                                                {fmtHours(row.totalHolidayWorkHours)}h
                                            </div>
                                        </>
                                    ) : '-'}
                                </td>

                                <td className="px-4 py-3 text-right font-mono text-purple-300">
                                    {(row.commissionTotal > 0 || row.incentiveTotal > 0) ? (
                                        <>
                                            <div>{formatCurrencyVND(row.commissionTotal + row.incentiveTotal)}</div>
                                            {(row.adjustment?.commission || row.adjustment?.incentive) ? (
                                                <div className="text-[10px] text-blue-400">*Manual Adj Inc</div>
                                            ) : null}
                                        </>
                                    ) : '-'}
                                </td>

                                <td className="px-4 py-3 text-right font-mono text-blue-300">
                                    {(row.bonus > 0 || row.deduction > 0) ? (
                                        <>
                                            {row.bonus > 0 && <div className="text-blue-300">+{formatCurrencyVND(row.bonus)}</div>}
                                            {row.deduction > 0 && <div className="text-red-400">-{formatCurrencyVND(row.deduction)}</div>}
                                        </>
                                    ) : '-'}
                                </td>

                                <td className="px-4 py-3 text-right font-mono font-bold text-white text-base">
                                    {formatCurrencyVND(row.grossSalary)}
                                </td>

                                <td className="px-4 py-3 text-right font-mono text-yellow-300" title={`SI: ${formatCurrencyVND(row.insurance.si)}\nHI: ${formatCurrencyVND(row.insurance.hi)}\nUI: ${formatCurrencyVND(row.insurance.ui)}\nPIT: ${formatCurrencyVND(row.pit)}`}>
                                    <div>-{formatCurrencyVND(row.insurance.total + row.pit)}</div>
                                    <div className="text-[10px] text-yellow-500/70">
                                        Ins: {formatCurrencyVND(row.insurance.total)}<br />
                                        Tax: {formatCurrencyVND(row.pit)}
                                    </div>
                                </td>

                                <td className="px-4 py-3 text-right font-mono font-bold text-[var(--primary)] text-lg border-l border-slate-700/50 bg-slate-800/10">
                                    {formatCurrencyVND(row.netSalary)}
                                </td>

                                <td className="px-4 py-3 text-right flex items-center justify-end gap-2">
                                    <PDFExportButton
                                        staff={row.staff}
                                        payroll={row}
                                        year={year}
                                        month={month}
                                    />
                                    <button
                                        onClick={() => setEditingStaffId(row.staff.id)}
                                        className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 px-2 py-1 rounded"
                                    >
                                        Edit
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>


            {
                editingStaffId && (
                    <AdjustmentModal
                        staffId={editingStaffId}
                        staff={staffList.find(s => s.id === editingStaffId)!}
                        year={year}
                        month={month}
                        initialData={adjustments.find(a => a.staffId === editingStaffId)}
                        onClose={() => setEditingStaffId(null)}
                    />
                )
            }

            <div className="bg-slate-800/50 p-4 rounded text-xs text-slate-500">
                <p><strong>Note:</strong> &quot;Holiday Work&quot; adds 300% on top of Base Pay. &quot;OT&quot; adds 150%. Insurance/PIT calculated on Gross.</p>
            </div>
        </div >
    );
}

function AdjustmentModal({ staffId, staff, year, month, initialData, onClose }: {
    staffId: string,
    staff: Staff,
    year: number,
    month: number,
    initialData?: PayrollAdjustment,
    onClose: () => void
}) {
    const [formData, setFormData] = useState({
        commission: (initialData?.commission || 0) + (initialData?.incentive || 0),
        incentive: 0,
        bonus: initialData?.bonus || 0,
        deduction: initialData?.deduction || 0,
        allowancePosition: initialData ? initialData.allowancePosition : (staff.allowancePosition || 0),
        allowanceCommute: initialData ? initialData.allowanceCommute : (staff.allowanceCommute || 0),
        allowanceCommunication: initialData ? initialData.allowanceCommunication : (staff.allowanceCommunication || 0),
        allowanceMeal: initialData ? initialData.allowanceMeal : (staff.allowanceMeal || 0),
        allowanceHousing: initialData ? initialData.allowanceHousing : (staff.allowanceHousing || 0),
        allowanceLanguage: initialData ? initialData.allowanceLanguage : (staff.allowanceLanguage || 0),
        allowanceOther: initialData ? initialData.allowanceOther : (staff.allowanceOther || 0),
        fine: initialData?.fine || 0,
        taxRefund: initialData?.taxRefund || 0,
        notes: initialData?.notes || ''
    });
    const [isSaving, startTransition] = useTransition();

    const handleSave = () => {
        startTransition(async () => {
            // We save merged value into commission, ensure incentive is 0
            const data = { ...formData, incentive: 0 };
            await updatePayrollAdjustment(staffId, year, month, data);
            onClose();
        });
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 w-[600px] shadow-xl">
                <h3 className="text-lg font-bold text-white mb-4">手当・控除修正 (手入力)</h3>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-3">
                        <div className="font-bold text-slate-400 text-xs border-b border-slate-700 pb-1 mb-2">基本支給・コミッション</div>
                        <div>
                            <label className="block text-[10px] text-slate-400 mb-1">コミッション・インセンティブ</label>
                            <input
                                type="number"
                                className="w-full bg-slate-900 border border-slate-600 rounded p-1 text-white text-xs"
                                value={formData.commission}
                                onChange={e => setFormData({ ...formData, commission: Number(e.target.value) })}
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] text-slate-400 mb-1">特別賞与 (Bonus)</label>
                            <input
                                type="number"
                                className="w-full bg-slate-900 border border-slate-600 rounded p-1 text-white text-xs"
                                value={formData.bonus}
                                onChange={e => setFormData({ ...formData, bonus: Number(e.target.value) })}
                            />
                        </div>
                    </div>

                    <div className="space-y-3">
                        <div className="font-bold text-slate-400 text-xs border-b border-slate-700 pb-1 mb-2">手当 (Allowances)</div>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="block text-[10px] text-slate-400 mb-1">役職 (Position)</label>
                                <input
                                    type="number"
                                    className="w-full bg-slate-900 border border-slate-600 rounded p-1 text-white text-xs"
                                    value={formData.allowancePosition}
                                    onChange={e => setFormData({ ...formData, allowancePosition: Number(e.target.value) })}
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] text-slate-400 mb-1">外語 (Language)</label>
                                <input
                                    type="number"
                                    className="w-full bg-slate-900 border border-slate-600 rounded p-1 text-white text-xs"
                                    value={formData.allowanceLanguage}
                                    onChange={e => setFormData({ ...formData, allowanceLanguage: Number(e.target.value) })}
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="block text-[10px] text-slate-400 mb-1">通勤 (Commute)</label>
                                <input
                                    type="number"
                                    className="w-full bg-slate-900 border border-slate-600 rounded p-1 text-white text-xs"
                                    value={formData.allowanceCommute}
                                    onChange={e => setFormData({ ...formData, allowanceCommute: Number(e.target.value) })}
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] text-slate-400 mb-1">通信 (Communic.)</label>
                                <input
                                    type="number"
                                    className="w-full bg-slate-900 border border-slate-600 rounded p-1 text-white text-xs"
                                    value={formData.allowanceCommunication}
                                    onChange={e => setFormData({ ...formData, allowanceCommunication: Number(e.target.value) })}
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="block text-[10px] text-slate-400 mb-1">食事 (Meal)</label>
                                <input
                                    type="number"
                                    className="w-full bg-slate-900 border border-slate-600 rounded p-1 text-white text-xs"
                                    value={formData.allowanceMeal}
                                    onChange={e => setFormData({ ...formData, allowanceMeal: Number(e.target.value) })}
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] text-slate-400 mb-1">住宅 (Housing)</label>
                                <input
                                    type="number"
                                    className="w-full bg-slate-900 border border-slate-600 rounded p-1 text-white text-xs"
                                    value={formData.allowanceHousing}
                                    onChange={e => setFormData({ ...formData, allowanceHousing: Number(e.target.value) })}
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-[10px] text-slate-400 mb-1">その他 (Other)</label>
                            <input
                                type="number"
                                className="w-full bg-slate-900 border border-slate-600 rounded p-1 text-white text-xs"
                                value={formData.allowanceOther}
                                onChange={e => setFormData({ ...formData, allowanceOther: Number(e.target.value) })}
                            />
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-slate-700">
                    <div className="space-y-3">
                        <div className="font-bold text-slate-400 text-xs border-b border-slate-700 pb-1 mb-2">控除・調整</div>
                        <div>
                            <label className="block text-[10px] text-slate-400 mb-1">その他控除 (Deduction)</label>
                            <input
                                type="number"
                                className="w-full bg-slate-900 border border-slate-600 rounded p-1 text-white text-xs"
                                value={formData.deduction}
                                onChange={e => setFormData({ ...formData, deduction: Number(e.target.value) })}
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] text-red-400 mb-1">違犯罰金 (Fine / Net Ded)</label>
                            <input
                                type="number"
                                className="w-full bg-slate-900 border border-slate-600 rounded p-1 text-white text-xs border-red-900/50"
                                value={formData.fine}
                                onChange={e => setFormData({ ...formData, fine: Number(e.target.value) })}
                            />
                        </div>
                    </div>
                    <div className="space-y-3">
                        <div className="font-bold text-slate-400 text-xs border-b border-slate-700 pb-1 mb-2">還付</div>
                        <div>
                            <label className="block text-[10px] text-green-400 mb-1">還付所得税 (Refund / Net Add)</label>
                            <input
                                type="number"
                                className="w-full bg-slate-900 border border-slate-600 rounded p-1 text-white text-xs border-green-900/50"
                                value={formData.taxRefund}
                                onChange={e => setFormData({ ...formData, taxRefund: Number(e.target.value) })}
                            />
                        </div>
                    </div>
                </div>

                <div className="mt-4">
                    <label className="block text-[10px] text-slate-400 mb-1">備考</label>
                    <textarea
                        className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white h-16 text-xs"
                        value={formData.notes}
                        onChange={e => setFormData({ ...formData, notes: e.target.value })}
                    />
                </div>

                <div className="flex justify-end gap-2 mt-6">
                    <button onClick={onClose} className="px-4 py-2 text-slate-400 hover:text-white text-sm">キャンセル</button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="px-4 py-2 bg-[var(--primary)] text-white font-bold rounded hover:opacity-90 disabled:opacity-50 text-sm"
                    >
                        {isSaving ? '保存中...' : '保存'}
                    </button>
                </div>
            </div>
        </div>
    );
}
