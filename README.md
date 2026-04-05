This is a [Next.js](https://nextjs.org) app using:

- Discord OAuth via `next-auth`
- PostgreSQL with `prisma`
- API fetching with `@tanstack/react-query`
- Toast notifications with `sonner`

## Getting Started

1. Configure environment variables:

```bash
cp .env.example .env
```

2. Fill `.env`:

- `DATABASE_URL`: PostgreSQL connection string
- `NEXTAUTH_SECRET`: random secret (at least 32 chars)
- `NEXTAUTH_URL`: usually `http://localhost:3000`
- `DISCORD_CLIENT_ID` and `DISCORD_CLIENT_SECRET`: from Discord Developer Portal
- `OWNER_DISCORD_ID`: ton Discord user ID (seul owner autorise a modifier la whitelist)
- `NEXT_PUBLIC_OWNER_DISCORD_ID`: meme valeur que `OWNER_DISCORD_ID` pour afficher la section owner dans l'UI

3. Create and apply Prisma migration:

```bash
bunx prisma migrate dev --name init_auth
```

4. Run the development server:

```bash
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Discord OAuth setup

In Discord Developer Portal:

1. Create an application.
2. Go to OAuth2 > General.
3. Add Redirect URI:

```txt
http://localhost:3000/api/auth/callback/discord
```

4. Copy client ID/secret to `.env`.

## Available routes

- `/` main page with Discord sign-in and profile card
- `/api/auth/[...nextauth]` NextAuth handler
- `/api/me` authenticated profile endpoint used by React Query
- `/api/guilds/admin` retourne uniquement les serveurs admin whitelistes
- `/api/whitelist` gestion whitelist (owner only)

## Notes

- This project uses Prisma v6 for compatibility with a classic `schema.prisma` setup.
- If you change the schema: run `bunx prisma migrate dev --name your_change` then `bunx prisma generate`.

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
