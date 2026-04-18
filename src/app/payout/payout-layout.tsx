import { LoadingButton } from "@/components/loading-button";

export function PayoutPageHeader() {
  return <h1 className="mb-6 text-3xl font-bold">Payout Distribution</h1>;
}

type PayoutDeleteModalProps = {
  isOpen: boolean;
  selectedSessionId: string | null;
  isDeleting: boolean;
  onCancel: () => void;
  onConfirmDelete: (sessionId: string) => void;
};

export function PayoutDeleteModal({
  isOpen,
  selectedSessionId,
  isDeleting,
  onCancel,
  onConfirmDelete,
}: PayoutDeleteModalProps) {
  if (!isOpen || !selectedSessionId) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className="w-80 rounded-lg border border-slate-700 bg-slate-900 p-5">
        <h4 className="text-lg font-semibold text-slate-100">
          Confirm payout deletion
        </h4>
        <p className="mt-2 text-sm text-slate-300">
          This action will permanently delete this payout session and all its
          entries.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded bg-slate-700 px-3 py-2 text-sm text-slate-100 hover:bg-slate-600"
          >
            Cancel
          </button>
          <LoadingButton
            type="button"
            onClick={() => onConfirmDelete(selectedSessionId)}
            isLoading={isDeleting}
            loadingText="Deleting..."
            className="rounded bg-red-700 px-3 py-2 text-sm text-white hover:bg-red-800"
          >
            Delete
          </LoadingButton>
        </div>
      </div>
    </div>
  );
}
