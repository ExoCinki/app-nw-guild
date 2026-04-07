import { PrismaAdapter } from "@auth/prisma-adapter";
import { type NextAuthOptions } from "next-auth";
import DiscordProvider from "next-auth/providers/discord";
import { prisma } from "@/lib/prisma";

export const authOptions: NextAuthOptions = {
    adapter: PrismaAdapter(prisma),
    session: {
        strategy: "database",
    },
    providers: [
        DiscordProvider({
            clientId: process.env.DISCORD_CLIENT_ID ?? "",
            clientSecret: process.env.DISCORD_CLIENT_SECRET ?? "",
            authorization: {
                params: {
                    scope: "identify email guilds",
                },
            },
            profile(profile) {
                return {
                    id: profile.id,
                    name: profile.global_name ?? profile.username,
                    email: profile.email,
                    image: profile.avatar
                        ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`
                        : null,
                };
            },
        }),
    ],
    callbacks: {
        async session({ session, user }) {
            if (session.user) {
                let discordId = user.discordId ?? null;
                let displayName = user.displayName ?? null;

                if (!discordId || !displayName) {
                    const hydratedUser = await prisma.user.findUnique({
                        where: { id: user.id },
                        select: {
                            displayName: true,
                            discordId: true,
                        },
                    });

                    displayName = displayName ?? hydratedUser?.displayName ?? null;
                    discordId = discordId ?? hydratedUser?.discordId ?? null;
                }

                if (!discordId) {
                    const discordAccount = await prisma.account.findFirst({
                        where: {
                            userId: user.id,
                            provider: "discord",
                        },
                        select: {
                            providerAccountId: true,
                        },
                    });

                    if (discordAccount?.providerAccountId) {
                        discordId = discordAccount.providerAccountId;

                        await prisma.user.update({
                            where: { id: user.id },
                            data: { discordId },
                        });
                    }
                }

                session.user.id = user.id;
                session.user.displayName = displayName;
                session.user.discordId = discordId;
            }

            return session;
        },
    },
    events: {
        async signIn({ user, account, profile }) {
            if (account?.provider !== "discord" || !profile) {
                return;
            }

            const discordProfile = profile as {
                id: string;
                global_name?: string | null;
                username: string;
            };

            const data = {
                discordId: discordProfile.id,
                displayName: discordProfile.global_name ?? discordProfile.username,
            };

            if (user.id) {
                await prisma.user.updateMany({
                    where: { id: user.id },
                    data,
                });
                return;
            }

            if (user.email) {
                await prisma.user.updateMany({
                    where: { email: user.email },
                    data,
                });
            }
        },
    },
    pages: {
        signIn: "/",
    },
};