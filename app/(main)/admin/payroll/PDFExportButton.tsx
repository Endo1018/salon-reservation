'use client';

import { PDFDownloadLink } from '@react-pdf/renderer';
import { useEffect, useState } from 'react';
import { PayslipDocument } from './PayslipPDF'; // Verify import path depending on file location

type Props = {
    data: any; // Type strictly if possible, or keep flexible for now
    year: number;
    month: number;
    fileName: string;
};

export default function PDFExportButton({ data, year, month, fileName }: Props) {
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
    }, []);

    if (!isClient) {
        return <button className="text-[10px] bg-slate-800 border border-slate-600 text-slate-500 px-2 py-1 rounded inline-block cursor-wait">Loading...</button>;
    }

    return (
        <PDFDownloadLink
            document={<PayslipDocument data={data} year={year} month={month} />}
            fileName={fileName}
            className="text-[10px] bg-slate-800 border border-slate-600 hover:bg-slate-700 text-slate-300 px-2 py-1 rounded inline-block"
        >
            {({ blob, url, loading, error }) => {
                if (loading) return 'Loading...';
                if (error) {
                    console.error('PDF Generation Error:', error);
                    return 'Error';
                }
                return 'Export PDF';
            }}
        </PDFDownloadLink>
    );
}
