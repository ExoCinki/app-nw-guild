import SharedPayoutClient from "./shared-payout-client";

export default async function SharedPayoutPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return <SharedPayoutClient token={token} />;
}
