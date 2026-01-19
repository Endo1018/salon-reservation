'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [staffId, setStaffId] = useState('');
  const router = useRouter();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (staffId.trim()) {
      router.push(`/dashboard/${staffId}`);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-6 bg-[var(--background)]">
      <div className="w-full max-w-sm rounded-[24px] bg-[var(--surface)] p-8 shadow-2xl border border-slate-700">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-light tracking-widest text-[var(--primary)] mb-2">
            SPA SALON
          </h1>
          <p className="text-sm text-slate-400">STAFF PORTAL</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label htmlFor="staffId" className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wide">
              Staff ID
            </label>
            <input
              id="staffId"
              type="text"
              value={staffId}
              onChange={(e) => setStaffId(e.target.value)}
              className="w-full rounded-xl bg-slate-900 border border-slate-700 p-4 text-center text-lg text-white placeholder-slate-600 focus:border-[var(--primary)] focus:outline-none transition-colors"
              placeholder="S001"
              required
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-xl bg-gradient-to-r from-[var(--primary)] to-[#d4b475] p-4 text-sm font-bold text-slate-900 shadow-lg hover:shadow-[var(--primary)]/20 transition-all active:scale-95 uppercase tracking-wider"
          >
            Enter System
          </button>
        </form>
      </div>
    </div>
  );
}
