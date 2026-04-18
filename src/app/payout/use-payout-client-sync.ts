import { useEffect } from "react";
import type { UsePayoutClientSyncArgs } from "./payout-client-layer-types";

export function usePayoutClientSync({
    selectedSession,
    selectedSessionId,
    sessions,
    rosterSource,
    sharedLinkBySession,
    shareExpiresAtBySession,
    currentTimeMs,
    setSelectedRosterSessionId,
    setSelectedGoldPoolInput,
    setCurrentPlayersPage,
    setSharedLinkBySession,
    setShareExpiresAtBySession,
}: UsePayoutClientSyncArgs) {
    useEffect(() => {
        if (!rosterSource) {
            return;
        }

        const availableIds = new Set(
            rosterSource.sessions.map((session) => session.id),
        );

        setSelectedRosterSessionId((current) => {
            if (current && availableIds.has(current)) {
                return current;
            }
            return rosterSource.selectedRosterSessionId;
        });
    }, [rosterSource, setSelectedRosterSessionId]);

    useEffect(() => {
        if (selectedSession) {
            setSelectedGoldPoolInput(String(selectedSession.goldPool));
        }
    }, [selectedSession, setSelectedGoldPoolInput]);

    useEffect(() => {
        setCurrentPlayersPage(1);
    }, [selectedSessionId, setCurrentPlayersPage]);

    useEffect(() => {
        const linkMap: Record<string, string> = {};
        const expiresMap: Record<string, string> = {};
        for (const session of sessions) {
            const share = session.shares?.[0];
            if (share?.shareUrl) {
                linkMap[session.id] = share.shareUrl;
                expiresMap[session.id] = new Date(
                    new Date(share.updatedAt).getTime() + 30 * 24 * 60 * 60 * 1000,
                ).toISOString();
            }
        }
        setSharedLinkBySession(linkMap);
        setShareExpiresAtBySession(expiresMap);
    }, [sessions, setSharedLinkBySession, setShareExpiresAtBySession]);

    const selectedSharedLink = selectedSessionId
        ? sharedLinkBySession[selectedSessionId] || ""
        : "";
    const selectedShareExpiresAt = selectedSessionId
        ? shareExpiresAtBySession[selectedSessionId] || ""
        : "";

    const getShareLinkStatus = (sessionId: string) => {
        const expiresAt = shareExpiresAtBySession[sessionId];
        if (!expiresAt) {
            return { hasLink: false, expired: false };
        }

        return {
            hasLink: true,
            expired: currentTimeMs > 0 && new Date(expiresAt).getTime() <= currentTimeMs,
        };
    };

    return {
        selectedSharedLink,
        selectedShareExpiresAt,
        getShareLinkStatus,
    };
}