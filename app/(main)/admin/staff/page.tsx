import prisma from '@/lib/db';
import { createStaff } from '@/app/actions/staff';
import StaffList from './StaffList';

export const dynamic = 'force-dynamic';

export default async function StaffPage(props: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
    const searchParams = await props.searchParams;
    const status = searchParams.status;
    const allStaff = await prisma.staff.findMany({
        orderBy: { id: 'asc' },
    });

    return (
        <div className="min-h-screen bg-slate-900 text-slate-100 p-8">
            <div className="max-w-4xl mx-auto">
                <h1 className="text-2xl font-bold text-[var(--primary)] mb-8 tracking-widest">STAFF MANAGEMENT</h1>

                {/* Status Messages */}
                {status === 'success' && (
                    <div className="mb-6 p-4 bg-green-900/50 border border-green-500/50 text-green-300 rounded">
                        ✅ Staff registered successfully!
                    </div>
                )}
                {status === 'duplicate' && (
                    <div className="mb-6 p-4 bg-red-900/50 border border-red-500/50 text-red-300 rounded">
                        ⚠️ Error: Staff ID already exists. Please use a unique ID.
                    </div>
                )}
                {status === 'error' && (
                    <div className="mb-6 p-4 bg-red-900/50 border border-red-500/50 text-red-300 rounded">
                        ⚠️ System Error: Failed to register staff.
                    </div>
                )}

                {/* List */}
                <StaffList staffList={allStaff} />

                {/* Add New Form */}
                <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                    <h2 className="text-lg font-bold mb-4">Add New Staff</h2>
                    <form action={createStaff} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Staff ID</label>
                            <input name="id" type="text" placeholder="S999 (Auto-gen if empty)"
                                className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white" />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Name</label>
                            <input name="name" type="text" placeholder="Full Name" required
                                className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white" />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Role</label>
                            <select name="role" className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white">
                                <option value="THERAPIST">THERAPIST</option>
                                <option value="RECEPTION">RECEPTION</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Base Wage (Monthly)</label>
                            <input name="baseWage" type="number" placeholder="50000" required
                                className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white" />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Commission (Therapist)</label>
                            <input name="commissionRate" type="number" placeholder="60000"
                                className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white" />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Incentive (Reception)</label>
                            <input name="incentiveRate" type="number" placeholder="30000"
                                className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white" />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Dependents (扶養)</label>
                            <input name="dependents" type="number" placeholder="0"
                                className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white" />
                        </div>
                        <div>
                            <label className="block text-xs text-yellow-400 mb-1">BHXH (Ins Base)</label>
                            <input name="insuranceBaseSalary" type="number" placeholder="0"
                                className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white" />
                        </div>

                        {/* Allowances */}
                        <div className="md:col-span-2 mt-2 pt-2 border-t border-slate-700">
                            <h3 className="text-sm font-bold text-slate-400 mb-2">Allowances (各種手当)</h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div>
                                    <label className="block text-[10px] text-slate-400 mb-1">Position (役職)</label>
                                    <input name="allowancePosition" type="number" placeholder="0"
                                        className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white text-xs" />
                                </div>
                                <div>
                                    <label className="block text-[10px] text-slate-400 mb-1">Language (外語)</label>
                                    <input name="allowanceLanguage" type="number" placeholder="0"
                                        className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white text-xs" />
                                </div>
                                <div>
                                    <label className="block text-[10px] text-slate-400 mb-1">Meal (食事)</label>
                                    <input name="allowanceMeal" type="number" placeholder="0"
                                        className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white text-xs" />
                                </div>
                                <div>
                                    <label className="block text-[10px] text-slate-400 mb-1">Commute (通勤)</label>
                                    <input name="allowanceCommute" type="number" placeholder="0"
                                        className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white text-xs" />
                                </div>
                                <div>
                                    <label className="block text-[10px] text-slate-400 mb-1">Housing (住宅)</label>
                                    <input name="allowanceHousing" type="number" placeholder="0"
                                        className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white text-xs" />
                                </div>
                                <div>
                                    <label className="block text-[10px] text-slate-400 mb-1">Communic. (通信)</label>
                                    <input name="allowanceCommunication" type="number" placeholder="0"
                                        className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white text-xs" />
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-[10px] text-slate-400 mb-1">Other (その他)</label>
                                    <input name="allowanceOther" type="number" placeholder="0"
                                        className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white text-xs" />
                                </div>
                            </div>
                        </div>
                        <div className="md:col-span-2 mt-4">
                            <button type="submit" className="w-full bg-[var(--primary)] text-slate-900 font-bold p-3 rounded hover:opacity-90 transition p-4">
                                Register Staff
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
