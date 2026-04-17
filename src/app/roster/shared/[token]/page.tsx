import SharedRosterClient from "./shared-roster-client";

export default async function SharedRosterPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return <SharedRosterClient token={token} />;
}
