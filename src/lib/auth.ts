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
                session.user.id = user.id;
                session.user.displayName = user.displayName;
                session.user.discordId = user.discordId;
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