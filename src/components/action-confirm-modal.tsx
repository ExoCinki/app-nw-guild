import { LoadingIndicator } from "@/components/loading-indicator";

type ActionConfirmModalProps = {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  confirmButtonClassName: string;
  isPending?: boolean;
  pendingLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ActionConfirmModal({
  isOpen,
  title,
  description,
  confirmLabel,
  confirmButtonClassName,
  isPending = false,
  pendingLabel,
  onCancel,
  onConfirm,
}: ActionConfirmModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
        <h3 className="text-base font-semibold text-slate-100">{title}</h3>
        <p className="mt-2 text-sm text-slate-400">{description}</p>
        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-slate-300 transition hover:bg-slate-700"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={onConfirm}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition disabled:opacity-50 ${confirmButtonClassName}`}
          >
            {isPending ? (
              <>
                <LoadingIndicator /> {pendingLabel ?? "Processing..."}
              </>
            ) : (
              confirmLabel
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
