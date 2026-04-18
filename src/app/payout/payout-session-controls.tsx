import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCheck,
  faCopy,
  faDownload,
  faLinkSlash,
  faPlus,
  faShareNodes,
  faUsers,
} from "@fortawesome/free-solid-svg-icons";
import { LoadingButton } from "@/components/loading-button";
import type { DiscordUser, PayoutRosterSourcePayload } from "./payout-types";

export function PayoutSessionControls({
  selectedSessionId,
  selectedGoldPoolInput,
  selectedSharedLink,
  selectedShareExpiresAt,
  selectedRosterSessionId,
  rosterSource,
  searchQuery,
  searchResults,
  isUpdateSessionPending,
  isCreateShareLinkPending,
  isRevokeShareLinkPending,
  isImportRosterPending,
  isImportZooRolePending,
  isAddEntryPending,
  onGoldPoolInputChange,
  onSaveGoldPool,
  onCreateShareLink,
  onCopyShareLink,
  onRevokeShareLink,
  onSelectedRosterSessionChange,
  onImportRoster,
  onImportZooRole,
  onSearchQueryChange,
  onAddEntry,
}: {
  selectedSessionId: string | null;
  selectedGoldPoolInput: string;
  selectedSharedLink: string;
  selectedShareExpiresAt: string;
  selectedRosterSessionId: string | null;
  rosterSource: PayoutRosterSourcePayload | undefined;
  searchQuery: string;
  searchResults: DiscordUser[];
  isUpdateSessionPending: boolean;
  isCreateShareLinkPending: boolean;
  isRevokeShareLinkPending: boolean;
  isImportRosterPending: boolean;
  isImportZooRolePending: boolean;
  isAddEntryPending: boolean;
  onGoldPoolInputChange: (value: string) => void;
  onSaveGoldPool: () => void;
  onCreateShareLink: () => void;
  onCopyShareLink: () => void;
  onRevokeShareLink: () => void;
  onSelectedRosterSessionChange: (value: string | null) => void;
  onImportRoster: () => void;
  onImportZooRole: () => void;
  onSearchQueryChange: (value: string) => void;
  onAddEntry: (user: DiscordUser) => void;
}) {
  return (
    <>
      <div className="p-4 bg-slate-900 rounded border border-slate-700">
        <h3 className="font-semibold mb-3">Settings</h3>
        <label className="block text-sm mb-2">Gold to distribute:</label>
        <div className="mb-4 flex gap-2">
          <input
            type="number"
            min="0"
            value={selectedGoldPoolInput}
            onChange={(event) => onGoldPoolInputChange(event.target.value)}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-slate-100"
          />
          <LoadingButton
            type="button"
            onClick={onSaveGoldPool}
            isLoading={isUpdateSessionPending}
            className="px-3 py-2 rounded bg-blue-600 hover:bg-blue-700"
            title="Save payout"
            aria-label="Save payout"
          >
            <FontAwesomeIcon icon={faCheck} />
          </LoadingButton>
        </div>

        <label className="block text-sm mb-2">Shared session link:</label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <LoadingButton
            type="button"
            onClick={onCreateShareLink}
            isLoading={isCreateShareLinkPending}
            className="px-3 py-2 rounded bg-indigo-600 hover:bg-indigo-700"
          >
            <FontAwesomeIcon icon={faShareNodes} /> Create link
          </LoadingButton>

          <div className="flex flex-1 gap-2">
            <input
              type="text"
              value={selectedSharedLink}
              readOnly
              placeholder="Generate a link to share this session"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-slate-200"
            />
            <button
              type="button"
              disabled={!selectedSharedLink}
              onClick={onCopyShareLink}
              className="px-3 py-2 rounded bg-slate-700 hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
              title="Copy link"
            >
              <FontAwesomeIcon icon={faCopy} />
            </button>
            <LoadingButton
              type="button"
              disabled={!selectedSessionId}
              onClick={onRevokeShareLink}
              isLoading={isRevokeShareLinkPending}
              className="px-3 py-2 rounded bg-red-700 hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50"
              title="Revoke link"
            >
              <FontAwesomeIcon icon={faLinkSlash} />
            </LoadingButton>
          </div>
        </div>
        {selectedShareExpiresAt ? (
          <p className="mt-2 text-xs text-slate-400">
            This link expires on{" "}
            {new Date(selectedShareExpiresAt).toLocaleDateString("en-US")}
          </p>
        ) : (
          <p className="mt-2 text-xs text-slate-500">
            Links expire after 30 days.
          </p>
        )}
      </div>

      <div className="p-4 bg-slate-900 rounded border border-slate-700">
        <h3 className="font-semibold mb-3">Add players</h3>
        <div className="space-y-2">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,1fr)_auto_auto]">
            <select
              value={selectedRosterSessionId ?? ""}
              onChange={(event) =>
                onSelectedRosterSessionChange(event.target.value || null)
              }
              disabled={(rosterSource?.sessions.length ?? 0) === 0}
              className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100"
            >
              {(rosterSource?.sessions ?? []).map((session) => (
                <option key={session.id} value={session.id}>
                  {session.name ?? "Untitled roster session"}
                </option>
              ))}
            </select>

            <LoadingButton
              onClick={onImportRoster}
              isLoading={isImportRosterPending}
              loadingText="Importing..."
              disabled={!selectedRosterSessionId}
              className="w-full px-3 py-1 bg-green-700 hover:bg-green-800 rounded text-xs"
            >
              <FontAwesomeIcon icon={faDownload} /> Import from roster
            </LoadingButton>

            <LoadingButton
              onClick={onImportZooRole}
              isLoading={isImportZooRolePending}
              loadingText="Importing..."
              className="w-full px-3 py-1 bg-blue-700 hover:bg-blue-800 rounded text-xs"
            >
              <FontAwesomeIcon icon={faUsers} />
              Import Members with Role membership
            </LoadingButton>
          </div>

          {rosterSource?.roster ? (
            <p className="text-xs text-slate-400">
              Selected roster:{" "}
              {rosterSource.roster.name ?? "Untitled roster session"}
            </p>
          ) : (
            <p className="text-xs text-slate-500">
              No roster session available for import.
            </p>
          )}

          <input
            type="text"
            placeholder="Search by display name or username..."
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-slate-100"
          />

          {searchQuery.length >= 2 && searchResults.length === 0 && (
            <div className="text-xs text-slate-400 text-center py-2">
              No player found
            </div>
          )}

          {searchQuery.length >= 2 && searchResults.length > 0 && (
            <div className="max-h-48 overflow-y-auto space-y-1">
              {searchResults.map((user) => (
                <LoadingButton
                  key={user.id}
                  onClick={() => onAddEntry(user)}
                  isLoading={isAddEntryPending}
                  className="w-full text-left px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded text-sm flex items-center justify-between"
                >
                  <div>
                    <div className="font-semibold">{user.displayName}</div>
                    <div className="text-xs text-slate-400">
                      {user.username}
                    </div>
                  </div>
                  <FontAwesomeIcon icon={faPlus} className="text-blue-400" />
                </LoadingButton>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
