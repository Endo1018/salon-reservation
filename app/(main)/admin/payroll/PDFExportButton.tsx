'use client';

import { useState, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import { PayslipDocument } from './PayslipPDF';
import { Staff } from '@prisma/client';
import { calculateStaffPayroll } from '@/lib/payroll-engine';
import { Download } from 'lucide-react';

interface PDFExportButtonProps {
    staff: Staff;
    payroll: ReturnType<typeof calculateStaffPayroll>;
    year: number;
    month: number;
}

export default function PDFExportButton({ staff, payroll, year, month }: PDFExportButtonProps) {
    const [isClient, setIsClient] = useState(false);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    useEffect(() => setIsClient(true), []);

    if (!isClient) return <span className="text-slate-600 text-xs">Loading...</span>;

    return (
        <PDFDownloadLink
            document={<PayslipDocument staff={staff} payroll={payroll} year={year} month={month} />}
            fileName={`Payslip_${staff.name}_${year}-${month}.pdf`}
            className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300 transition-colors text-xs font-bold bg-emerald-900/20 px-2 py-1 rounded border border-emerald-800"
        >
            {({ loading }) => (
                <>
                    <Download className="w-3 h-3" />
                    <span>{loading ? '...' : 'PDF'}</span>
                </>
            )}
        </PDFDownloadLink>
    );
}
