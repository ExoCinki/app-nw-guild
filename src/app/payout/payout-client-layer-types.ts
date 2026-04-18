import type {
  DiscordUser,
  PayoutRosterSourcePayload,
  PayoutSession,
} from "./payout-types";

export type StateSetter<T> = React.Dispatch<React.SetStateAction<T>>;

export type MutationWithNoArgs = { mutate: () => void };
export type MutationWithArg<TArg> = { mutate: (arg: TArg) => void };

export type RenamePayload = { sessionId: string; name: string };
export type ToggleLockPayload = { sessionId: string; isLocked: boolean };
export type UpdateSessionPayload = {
  sessionId: string;
  updates: { goldPool?: number; status?: string };
};
export type TogglePaidPayload = { entryId: string; isPaid: boolean };

export interface UsePayoutClientActionsArgs {
  selectedSessionId: string | null;
  selectedGoldPoolInput: string;
  selectedSharedLink: string;
  totalPlayersPages: number;
  renameInput: string;
  setRenameInput: StateSetter<string>;
  setRenamingSessionId: StateSetter<string | null>;
  setDeleteSessionModalOpen: StateSetter<boolean>;
  setPlayerSearchQuery: StateSetter<string>;
  setCurrentPlayersPage: StateSetter<number>;
  setSelectedSessionId: StateSetter<string | null>;
  createSessionMutation: MutationWithNoArgs;
  renameSessionMutation: MutationWithArg<RenamePayload>;
  toggleLockMutation: MutationWithArg<ToggleLockPayload>;
  updateSessionMutation: MutationWithArg<UpdateSessionPayload>;
  createShareLinkMutation: MutationWithArg<string>;
  revokeShareLinkMutation: MutationWithArg<string>;
  importRosterMutation: MutationWithNoArgs;
  importZooRoleMutation: MutationWithNoArgs;
  addEntryMutation: MutationWithArg<DiscordUser>;
  togglePaidMutation: MutationWithArg<TogglePaidPayload>;
  deleteEntryMutation: MutationWithArg<string>;
  deleteSessionMutation: MutationWithArg<string>;
}

export interface UsePayoutClientSyncArgs {
  selectedSession: PayoutSession | undefined;
  selectedSessionId: string | null;
  sessions: PayoutSession[];
  rosterSource: PayoutRosterSourcePayload | undefined;
  sharedLinkBySession: Record<string, string>;
  shareExpiresAtBySession: Record<string, string>;
  currentTimeMs: number;
  setSelectedRosterSessionId: StateSetter<string | null>;
  setSelectedGoldPoolInput: StateSetter<string>;
  setCurrentPlayersPage: StateSetter<number>;
  setSharedLinkBySession: StateSetter<Record<string, string>>;
  setShareExpiresAtBySession: StateSetter<Record<string, string>>;
}