# Intelligence Twin — Incident Tracker

Map-first, evidence-led citizen-intelligence platform for South Africa. Tracks incidents across six modules: Farm & Rural, Unrest Watch, Bias Monitor, Infrastructure, Natural Events, and Traffic.

## Stack

- **Frontend**: React 19 · TypeScript · Vite 6 · Zustand 5 (Immer) · MapLibre GL JS
- **Backend**: Supabase (PostgreSQL with RLS, Auth, Storage)
- **Monorepo**: pnpm workspaces

## Quick start

```bash
# Prerequisites: Node >=20, pnpm >=9
pnpm install

# Copy environment template
cp .env.example apps/public-web/.env

# Start dev server (runs on localhost:5173)
pnpm dev
```

The app runs in **demo mode** when Supabase credentials are not configured — all data comes from synthetic mock datasets. No backend setup is required for development.

## Environment variables

See [`.env.example`](.env.example) for the full list. Key distinctions:

| Variable | Side | Purpose |
|---|---|---|
| `VITE_SUPABASE_URL` | Client | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Client | Supabase public anon key |
| `VITE_PAYPAL_CLIENT_ID` | Client | PayPal button rendering |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Admin DB operations |
| `AI_API_KEY` | Server only | AI summariser (Groq/Gemini/CF) |
| `PAYMENT_PROVIDER_SECRET` | Server only | PayPal secret |
| `EMAIL_REPLY_TO` | Server only | Reply-to address for notifications |

**Security**: Service-role keys, API secrets, and payment credentials must never appear in frontend code or committed files.

## Project structure

```
incident-tracker/
├── apps/public-web/          # Main frontend application
│   ├── src/
│   │   ├── components/       # UI components (map, widgets, shell)
│   │   ├── data/             # Mock datasets for demo mode
│   │   ├── lib/              # API services, hooks, Supabase client
│   │   ├── pages/            # Route pages (public + admin)
│   │   ├── stores/           # Zustand state management
│   │   ├── styles/           # CSS design system
│   │   └── types/            # TypeScript type definitions
│   └── public/               # Static assets
├── packages/types/           # Shared type definitions
├── tests/                    # Test suite
└── .env.example              # Environment template
```

## Scripts

```bash
pnpm dev          # Start dev server
pnpm build        # Production build
pnpm test         # Run test suite
pnpm typecheck    # TypeScript type checking
```

## Architecture

### API service layer

All data access goes through `src/lib/api/` services. Each service checks `isSupabaseConfigured()` and falls back to mock data when the database isn't connected:

- `auth.ts` — Authentication (Supabase Auth / demo accounts)
- `incidents.ts` — Incident CRUD and filtering
- `submissions.ts` — Citizen report submissions
- `sponsors.ts` — Sponsor campaign management
- `evidence.ts` — Evidence file uploads
- `users.ts` — User and role management
- `feature-flags.ts` — Feature toggle system
- `news-feeds.ts` — RSS feed management
- `subscriptions.ts` — Subscription tier management

### Database schemas

The Supabase backend uses multiple schemas for data isolation:

| Schema | Purpose |
|---|---|
| `public` | Incidents, categories, locations, users |
| `editorial` | Submissions, editorial workflow |
| `evidence` | Evidence files, chain-of-custody |
| `sponsor` | Sponsor campaigns, ad placements |
| `audit` | Audit trail, access logs |

### Admin console

13 admin pages accessible at `/admin` after authentication:

Dashboard · Incidents · Submissions · Sponsors · Widgets · News Feeds · Live Ticker · Reports · Import Data · Users & Roles · Subscriptions · Test Data · Settings
