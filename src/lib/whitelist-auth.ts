import { getOwnerGuardStatus } from "@/lib/admin-access";

export async function getOwnerSessionStatus() {
    return getOwnerGuardStatus();
}