'use client';

import { deleteAllAttendance } from '@/app/actions/attendance';
import { useState } from 'react';

export default function DeleteAllButton() {
    const [isDeleting, setIsDeleting] = useState(false);

    const handleDeleteAll = async () => {
        if (!confirm('【警告】すべての勤怠データを削除します。\n本当によろしいですか？\n(This will delete ALL attendance records. Are you sure?)')) {
            return;
        }

        // Double confirm
        if (!confirm('本当に削除してよろしいですか？この操作は取り消せません。\n(Double Check: This cannot be undone.)')) {
            return;
        }

        setIsDeleting(true);
        try {
            await deleteAllAttendance();
            alert('すべてのデータを削除しました。');
        } catch (e) {
            console.error(e);
            alert('削除に失敗しました。');
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <button
            onClick={handleDeleteAll}
            disabled={isDeleting}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded shadow transition-colors flex items-center gap-2 ml-4 disabled:opacity-50"
        >
            {isDeleting ? '削除中...' : '全データを削除 (Delete All)'}
        </button>
    );
}
