'use client';

import { importAttendanceFromExcel } from '@/app/actions/import-excel';
import { useState, useRef } from 'react';

export default function ImportButton() {
    const [isLoading, setIsLoading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!confirm('POSデータのExcelファイルをインポートしますか？既存の同日データは更新されます。(Import?)')) {
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
        }

        setIsLoading(true);
        const formData = new FormData();
        formData.append('file', file);

        const result = await importAttendanceFromExcel(formData);
        setIsLoading(false);

        if (result.success) {
            alert(result.message);
            // Refresh logic usually handled by revalidatePath in action, 
            // but router.refresh() might be needed if using client router cache heavily.
            // revalidatePath on server does the job for server components.
        } else {
            alert('Error: ' + result.message);
        }

        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    return (
        <div className="flex items-center gap-4">
            <input
                type="file"
                accept=".xlsx, .xls"
                onChange={handleFileChange}
                ref={fileInputRef}
                className="hidden"
                id="excel-upload"
            />
            <label
                htmlFor="excel-upload"
                className={`cursor-pointer bg-green-600 hover:bg-green-500 text-white font-bold py-2 px-4 rounded transition-colors ${isLoading ? 'opacity-50 pointer-events-none' : ''}`}
            >
                {isLoading ? '取込中...' : 'POSデータ取込 (Import Excel)'}
            </label>
        </div>
    );
}
