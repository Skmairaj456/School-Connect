# School Connect

A responsive school-family dashboard built with Next.js App Router, TypeScript, Tailwind CSS, Leaflet/OpenStreetMap, Recharts and Supabase. With Supabase environment variables configured, the dashboard uses Supabase Auth, derives the signed-in role from `user_roles`, reads tenant-scoped students, attendance, syllabus topics and announcements, and persists teacher/admin attendance, syllabus and announcement changes through RLS-protected writes. Without those variables it remains an explicitly labelled browser demo whose interactions persist in local storage.

## Requirements

- Node.js 20.9 or newer and npm
- Supabase CLI for local database work (on Windows, install with `scoop install supabase` or `choco install supabase`)

## Run the browser demo

```powershell
npm install
npm run dev
```

Open http://localhost:3000. Without Supabase configuration, use the “View as” selector to inspect Administrator, Parent, Teacher and Driver dashboard layouts. Attendance toggles, syllabus transitions, announcement creation/read state, and trip controls persist in this browser. Reset them with the banner control. Demo bus coordinates are labelled simulated; selecting “Advance simulated bus” moves the marker along its route. Driver location sharing uses browser geolocation only while the page is open.

## Presenting the demo

For a pitch, run the production build so the Next.js dev overlay is hidden:

```powershell
npm run build
npm start
```

Open http://localhost:3000. If Supabase is configured, the sign-in screen offers **Explore the interactive demo**, which opens the browser demo without contacting Supabase (use **Exit demo** in the banner to return). Demo dates are relative to today, and **Reset data** restores the sample school. The bus map needs internet access for OpenStreetMap tiles.

## Safety Chain

School apps usually treat bus GPS and class attendance as separate modules. Safety Chain joins them per child, across four checkpoints: **bus pickup → school gate → classroom → verified home handover**. A break between checkpoints raises an alert straight away:

- **Never scanned off the bus.** A child boarded but has no gate scan, and the driver cannot confirm the empty-bus check or end the trip until every child is scanned off. This targets children being left on parked buses.
- **Reached school but marked absent.** The bus says the child arrived and the register says Absent, so the office is told to locate the child.
- **Handover blocked.** Each child has a four-digit handover code that changes daily. Parents share it only with the adult collecting the child. A wrong code keeps the child with the attendant and alerts the school.

The logic lives in `src/lib/safety.ts` with unit tests in `src/lib/safety.test.ts`. It runs on sample riders today; the existing `transport_events` and `pickup_contacts` tables are where live boarding scans and guardians will be stored.

**Two-minute demo:** Overview shows the red safety banner → open Safety Chain (2 alerts, chain board) → switch to Driver: "Confirm bus is empty" is locked → Scan off Ishaan, tick the three checks, confirm → enter 0000 for Meera's handover to show it is blocked → switch to Parent to see Meera's journey and today's code → back as Driver, release Meera with the right code → switch to Administrator, click "Found in class" on Kabir: every child accounted for.

## Supabase local setup and seed

1. Start the local stack: `supabase start`.
2. Copy `.env.example` to `.env.local` and set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from `supabase status -o env`.
3. Copy the local `SERVICE_ROLE_KEY` value into `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`. Never put this key in a `NEXT_PUBLIC_` variable or client code.
4. Apply migrations and reset the local database: `supabase db reset`.
5. Seed demo records and role accounts: `npm run seed`.
6. Run the app: `npm run dev`.

The administrator invitation endpoint is available at `POST /api/admin/invite`. It requires
the signed-in user's Supabase access token in `Authorization: Bearer <token>` and accepts
`email`, `fullName`, `role` (`parent`, `teacher` or `driver`) and optional `phone`. The
service-role key is read only on the server. School administrators cannot invite platform
administrators or users into another school.

Development-only demo accounts all use password `SchoolDemo!2026`:

- `platform@school-connect.demo`
- `admin@school-connect.demo`
- `parent1@school-connect.demo` and `parent2@school-connect.demo`
- `teacher@school-connect.demo` and `teacher2@school-connect.demo`
- `driver@school-connect.demo`
- `student@school-connect.demo`

The seed refuses to run with `NODE_ENV=production`. Do not deploy these credentials or seed records.

## Checks

```powershell
npm test
npm run lint
npm run build
npm run test:e2e
npm run verify:rls
```

Unit tests cover attendance state changes, syllabus status/progress calculations and CSV escaping. Playwright covers the demo/live-mode dashboard smoke path and mobile navigation. `npm run verify:rls` runs a real parent cross-tenant query when local Supabase is configured; without `.env.local` it reports a safe skip.

## Architecture

- `src/app`: Next.js App Router, global styling and metadata.
- `src/components/school-connect.tsx`: client dashboard and local-demo workflow state.
- `src/components/route-map.tsx`: Leaflet route map, loaded client-only.
- `src/lib/demo-data.ts`: clearly marked sample data for the browser-only demo.
- `src/lib/workflows.ts`: pure state transitions and CSV formatting.
- `src/lib/supabase.ts`: public anon-key client bootstrap; returns `null` when unconfigured.
- `src/app/api/admin/invite/route.ts`: authenticated server-side invitation and membership provisioning.
- `src/components/student-dashboard.tsx`: linked student portal using tenant-scoped academic data.
- `supabase/migrations`: normalized school tables and RLS policies.
- `scripts/seed.mjs`: guarded local Supabase Auth/database seed.

## Deployment and security status

The frontend can be deployed to Vercel after `npm run build`; a production Supabase project needs the migrations applied separately. When public Supabase variables are present, the sign-in screen is required, role selection is removed, the role is read from `user_roles`, and live reads/writes are constrained by RLS. Bus trips, GPS locations and trip status are persisted through RLS and subscribed through Supabase Realtime. The platform-admin overview reads platform-wide counts and plan data. Realtime retention jobs, server-side audit writes, rate limits, email/SMS/push delivery and production secrets rotation remain deployment configuration responsibilities.

Before production use: apply and test all migrations in Supabase, review every RLS policy using separate role accounts, enable TLS and backups, define and test location retention/deletion, obtain school and guardian authorization, and complete legal/security review for India's Digital Personal Data Protection Act and applicable child-data rules. Do not upload real student or transport data to this demo until those controls are reviewed.

## Known limitations

- Live mode hydrates tenant-scoped roster, attendance, syllabus, announcements, homework, exams, marks and active transport data. Teachers/admins can update attendance, syllabus and announcements; drivers can start/end trips and persist simulated or browser GPS locations; parents can persist homework submissions.
- Demo mode dashboard workflows use browser local storage rather than the included Supabase schema.
- Attendance trend and some summary labels are illustrative demo values; current roster, attendance, syllabus and announcements in live mode are tenant-scoped database reads.
- Fee, leave-request, calendar and pickup-contact management screens are schema-ready but intentionally not exposed in this smallest complete slice.
- Student portal migrations add student account linking, timetable periods, published-result filtering and student-specific RLS; timetable authoring and file-upload submissions remain outside this slice.
- Apply `202610180007_student_portal.sql` and `202610180008_student_self_access.sql` after the existing migrations before running `npm run seed`.
- Map tiles require network access to OpenStreetMap. ETAs are demo estimates, not routing-engine results.
- PWA manifest is included; offline caching, push notifications and generated platform icon sizes are not included.
- Mark entry and audit/retention administration are not exposed in the dashboard; seeded marks are read-only in the MVP.