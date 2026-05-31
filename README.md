# Sổ Thông Minh

AI ghi đơn và công nợ cho cửa hàng vật liệu xây dựng nhỏ.

## Stack

- Next.js 15 App Router
- TypeScript strict mode
- Tailwind CSS + shadcn/ui
- Supabase Auth + Postgres

## Local setup

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Copy env template:

   ```bash
   cp .env.local.example .env.local
   ```

3. Fill `.env.local` with local Supabase values from `supabase start`.

4. Start Supabase:

   ```bash
   supabase start
   supabase db reset
   ```

5. Start the app:

   ```bash
   pnpm dev
   ```

6. Open `http://localhost:3000`.

## Auth test flow

- Create a test user in Supabase Studio.
- Go to `/login`.
- Login with email and password.
- Successful login redirects to `/chat`.
