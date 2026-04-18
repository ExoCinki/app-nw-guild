import { useState } from "react";

export function usePayoutClientState() {
    const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
        null,
    );
    const [selectedGoldPoolInput, setSelectedGoldPoolInput] =
        useState<string>("0");
    const [deleteSessionModalOpen, setDeleteSessionModalOpen] =
        useState<boolean>(false);
    const [renamingSessionId, setRenamingSessionId] = useState<string | null>(
        null,
    );
    const [renameInput, setRenameInput] = useState<string>("");
    const [searchQuery, setSearchQuery] = useState<string>("");
    const [playerSearchQuery, setPlayerSearchQuery] = useState<string>("");
    const [currentPlayersPage, setCurrentPlayersPage] = useState<number>(1);
    const [selectedRosterSessionId, setSelectedRosterSessionId] = useState<
        string | null
    >(null);
    const [sharedLinkBySession, setSharedLinkBySession] = useState<
        Record<string, string>
    >({});
    const [shareExpiresAtBySession, setShareExpiresAtBySession] = useState<
        Record<string, string>
    >({});
    const [currentTimeMs, setCurrentTimeMs] = useState<number>(0);

    return {
        selectedSessionId,
        setSelectedSessionId,
        selectedGoldPoolInput,
        setSelectedGoldPoolInput,
        deleteSessionModalOpen,
        setDeleteSessionModalOpen,
        renamingSessionId,
        setRenamingSessionId,
        renameInput,
        setRenameInput,
        searchQuery,
        setSearchQuery,
        playerSearchQuery,
        setPlayerSearchQuery,
        currentPlayersPage,
        setCurrentPlayersPage,
        selectedRosterSessionId,
        setSelectedRosterSessionId,
        sharedLinkBySession,
        setSharedLinkBySession,
        shareExpiresAtBySession,
        setShareExpiresAtBySession,
        currentTimeMs,
        setCurrentTimeMs,
    };
}