'use client';

type Props = {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    isDestructive?: boolean;
    isLoading?: boolean;
};

export default function ConfirmDialog({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    isDestructive = false,
    isLoading = false
}: Props) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100]">
            <div className="bg-slate-900 border border-slate-700 p-6 rounded-lg w-[400px] shadow-2xl relative">
                <h2 className="text-xl font-bold text-white mb-2">{title}</h2>
                <div className="text-slate-300 mb-6 whitespace-pre-wrap leading-relaxed text-sm">
                    {message}
                </div>

                <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-slate-800">
                    <button
                        onClick={onClose}
                        disabled={isLoading}
                        className="px-4 py-2 text-slate-400 hover:text-white text-sm font-medium transition-colors hover:bg-slate-800 rounded"
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={isLoading}
                        className={`px-4 py-2 text-white font-bold rounded text-sm shadow-lg transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2
                            ${isDestructive
                                ? 'bg-red-600 hover:bg-red-500 shadow-red-900/20'
                                : 'bg-[var(--primary)] text-slate-900 hover:opacity-90 shadow-[var(--primary)]/20'
                            }`}
                    >
                        {isLoading ? 'Processing...' : confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
}
