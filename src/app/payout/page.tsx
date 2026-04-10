import { redirect } from "next/navigation";
import { getCurrentUserAccessState } from "@/lib/current-user-access";
import PayoutClient from "./payout-client";

export default async function PayoutPage() {
  const accessState = await getCurrentUserAccessState();

  if (accessState.status !== "ok" || !accessState.access.payout) {
    redirect("/");
  }

  return <PayoutClient />;
}
