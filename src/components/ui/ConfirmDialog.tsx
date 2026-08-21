import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle } from "lucide-react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: "danger" | "primary";
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Usun",
  cancelLabel = "Anuluj",
  confirmVariant = "danger",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-[#1f1208]/40 dark:bg-black/70 backdrop-blur-[2px] p-4"
      role="dialog"
      aria-modal="true"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-[1.75rem] border border-[#f1dcc6] dark:border-white/10 bg-[#fff9f2] dark:bg-[#16161c] p-5 sm:p-6 shadow-[0_20px_60px_rgba(90,40,10,0.28)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.6)] max-h-[calc(100dvh-2rem)] overflow-y-auto transition-colors duration-700"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#fff0e8] dark:bg-red-500/15 text-[#d6623d] dark:text-red-300">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-[17px] font-medium text-[#2b180a] dark:text-white">{title}</h3>
            <p className="mt-1 text-[13px] font-medium leading-relaxed text-[#6d4d38] dark:text-white/60">{description}</p>
          </div>
        </div>

        <div className="mt-5 flex gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-xl border border-[#e9dac8] dark:border-white/10 bg-white dark:bg-white/5 px-4 py-2.5 text-sm font-bold text-[#6d4d38] dark:text-white/80 transition-colors hover:bg-[#fffaf3] dark:hover:bg-white/10"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-medium text-white transition-opacity ${
              confirmVariant === "primary"
                ? "bg-gradient-to-r from-[#de9241] to-[#ca782a] dark:from-indigo-500 dark:to-violet-600"
                : "bg-gradient-to-r from-[#e86b58] to-[#d44f43] dark:from-red-500 dark:to-red-700"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
