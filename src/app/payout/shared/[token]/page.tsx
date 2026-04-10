import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import SharedPayoutClient from "./shared-payout-client";

export default async function SharedPayoutPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    redirect("/");
  }

  return <SharedPayoutClient token={token} />;
}
