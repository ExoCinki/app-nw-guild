import SharedScoreboardClient from "./shared-scoreboard-client";

export default async function SharedScoreboardPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return <SharedScoreboardClient token={token} />;
}
