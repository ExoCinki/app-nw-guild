import { DefaultSession } from "next-auth";

declare module "next-auth" {
    interface Session {
        user: DefaultSession["user"] & {
            id: string;
            displayName?: string | null;
            discordId?: string | null;
        };
    }

    interface User {
        displayName?: string | null;
        discordId?: string | null;
    }
}