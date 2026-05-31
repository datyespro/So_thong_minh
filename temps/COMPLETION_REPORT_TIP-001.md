## COMPLETION REPORT - TIP-001

**STATUS:** DONE

TIP-001 scaffold + auth foundation is implemented. The app builds with Next.js 15 App Router, Tailwind, shadcn/ui, Supabase SSR clients, email/password login UI, protected `/chat` shell, and local Supabase migrations. A create-user bug was found during verification and fixed in migration 002 by schema-qualifying `public.profiles` inside the signup trigger.

**FILES CHANGED:**
- Created: `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml` - project scripts, dependencies, pnpm lockfile, and allowed dependency build scripts.
- Created: `.gitignore`, `.env.local.example`, `.env.local` - secret-safe local env setup; `.env.local` and `key.txt` are ignored.
- Created: `README.md` - local setup and auth test instructions.
- Created: `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `tailwind.config.ts`, `eslint.config.mjs`, `components.json` - Next/Tailwind/ESLint/shadcn configuration.
- Created: `app/layout.tsx`, `app/globals.css`, `app/page.tsx` - global layout, fonts, palette, root redirect.
- Created: `app/(auth)/layout.tsx`, `app/(auth)/login/page.tsx` - centered login layout and page.
- Created: `app/(app)/layout.tsx`, `app/(app)/chat/page.tsx` - protected app shell, sidebar, and placeholder chat page.
- Created: `src/actions/auth.ts`, `src/types/action-result.ts` - auth Server Actions and shared ActionResult union.
- Created: `src/lib/supabase/client.ts`, `src/lib/supabase/server.ts`, `src/lib/supabase/admin.ts`, `src/lib/supabase/proxy.ts`, `proxy.ts` - Supabase browser/server/admin clients and SSR session refresh proxy.
- Created: `src/lib/utils.ts`, `src/lib/dayjs.ts` - shadcn utility and Vietnamese dayjs setup.
- Created: `src/components/auth/LoginForm.tsx`, `src/components/shared/AuthGuard.tsx`, `src/components/shared/SignOutButton.tsx`.
- Created by shadcn CLI: `src/components/ui/button.tsx`, `src/components/ui/input.tsx`, `src/components/ui/label.tsx`, `src/components/ui/card.tsx`.
- Created: `supabase/migrations/20250528000001_extensions.sql`, `supabase/migrations/20250528000002_profiles.sql`, `supabase/functions/.gitkeep`.
- Modified: `supabase/config.toml` - localhost site URL/redirects, email confirmations off, auth session timebox set to 720h.
- Created screenshots: `screenshots/login-empty.png`, `screenshots/login-error.png`, `screenshots/login-mobile-375.png`, `screenshots/chat-redirect-login.png`.

**TEST RESULTS:**
- `pnpm install`: PASS.
- `pnpm lint`: PASS.
- `pnpm build`: PASS.
- `supabase start`: PASS; local API, Studio, DB, and MCP URL are available.
- `supabase db reset --local`: PASS; both migrations apply cleanly.
- Migration 001: PASS; `pg_trgm` exists in `pg_extension`.
- Migration 002: PASS; `public.profiles` exists and RLS is enabled.
- Trigger `public.handle_new_user`: PASS; creating `dat@test.com` creates matching row in `public.profiles`.
- Supabase Auth login: PASS via Supabase JS using `dat@test.com / dat1234`; session token returned.
- `/login` empty form render: PASS; screenshot captured.
- Wrong login error: PASS; UI shows `Sai email hoặc mật khẩu`; screenshot captured.
- `/chat` unauthenticated protection: PASS; direct access redirects to `/login`; screenshot captured.
- Font rendering: PASS; body computed `Be Vietnam Pro`; Next font `.woff2` assets observed.
- Palette: PASS; button computed `rgb(30, 64, 175)`, card computed `rgb(255, 254, 249)`.
- Responsive 375px: PASS; login form remains usable; screenshot captured.
- Local MCP endpoint: PARTIAL PASS; `http://127.0.0.1:54321/mcp` is reachable and returns `405 Method Not Allowed` for GET, confirming the route is up. Codex did not expose this local MCP as a callable table-list tool.
- Cloud Supabase MCP table list: BLOCKED; installed cloud MCP account does not have permission for the provided `sotm-dev` ref and lists only an unrelated project.
- Browser automation login -> `/chat`: NOT AUTOMATED; the in-app browser automation could not type credentials because its virtual clipboard was unavailable. Backend auth and route protection are verified.
- Refresh keeps session and logout: NOT AUTOMATED in browser for the same automation input issue.

**ISSUES DISCOVERED:**
- HIGH - Fixed: user creation failed because Auth trigger used unqualified `profiles`; Supabase Auth could not resolve it. Migration now uses `public.profiles`, `public.handle_new_user()`, and `SECURITY DEFINER SET search_path = public`.
- MEDIUM - Cloud Supabase MCP is not authenticated/authorized for `sotm-dev`. Recommendation: configure MCP against the intended dev project before relying on cloud MCP checks.
- LOW - Supabase Studio logged missing `supabase/functions`; adding `supabase/functions/.gitkeep` keeps the expected directory present.
- LOW - `next start` served stale `.next` chunks once after dependency changes. Clean rebuild fixed it.

**DEVIATIONS FROM SPEC:**
- Logged-in `/chat` screenshot was not captured because the browser automation tool could not type into the login form. The auth backend was verified via Supabase JS, and unauthenticated route protection was verified visually.
- DevTools Network screenshot for font load was not captured because the in-app browser tool does not expose the DevTools Network panel. Font loading was verified by computed font family and page asset inventory.
- Local MCP list-tables call could not be performed through a callable local MCP tool in this Codex session. The local MCP endpoint is reachable, and DB tables were verified via CLI/psql.

**SUGGESTIONS FOR CHU THAU:**
- Configure Supabase MCP authorization for `sotm-dev` if cloud MCP verification is required in future TIPs.
- Add a small Playwright smoke test once test tooling is introduced, covering login, `/chat` redirect, refresh session, and logout.
- Keep all future schema edits migration-first; the trigger bug reinforces why SQL files should remain the source of truth.

**SCREENSHOTS:**
- Empty login: `screenshots/login-empty.png`
- Login error: `screenshots/login-error.png`
- Mobile 375px login: `screenshots/login-mobile-375.png`
- Unauthenticated `/chat` redirect: `screenshots/chat-redirect-login.png`

**RAW package.json:**

```json
{
  "name": "so-thong-minh",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint"
  },
  "dependencies": {
    "@radix-ui/react-label": "^2.1.8",
    "@radix-ui/react-slot": "^1.2.4",
    "@supabase/ssr": "^0.10.3",
    "@supabase/supabase-js": "^2.86.0",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "dayjs": "^1.11.19",
    "lucide-react": "^0.555.0",
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "tailwind-merge": "^3.4.0",
    "tailwindcss-animate": "^1.0.7",
    "zod": "^4.1.0"
  },
  "devDependencies": {
    "@eslint/eslintrc": "^3.3.3",
    "@tailwindcss/postcss": "^4.1.0",
    "@types/node": "^24.10.0",
    "@types/react": "^19.2.0",
    "@types/react-dom": "^19.2.0",
    "autoprefixer": "^10.4.22",
    "eslint": "^9.39.0",
    "eslint-config-next": "^15.0.0",
    "postcss": "^8.5.6",
    "tailwindcss": "^3.4.17",
    "typescript": "^5.9.0"
  }
}
```

**RAW supabase/migrations/20250528000001_extensions.sql:**

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

**RAW supabase/migrations/20250528000002_profiles.sql:**

```sql
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_owner_read"
  ON public.profiles FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "profiles_owner_update"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- KHONG co INSERT/DELETE policy -> trigger insert, khong hard delete

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', NEW.email));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```
