# EvidenceFirst

EvidenceFirst is a full-stack research prototype for **verified persuasion**. It reconstructs one recent decision, identifies the specific expectation and reason behind it, checks whether the case qualifies, and delivers only pre-reviewed factual claims that map to named sources. If the available evidence does not address the exact claim, the system refuses to improvise.

## Submission links

- **Live application:** https://evidencefirst-fullstack-mvp.vercel.app
- **Source repository:** https://github.com/rikkunipun/evidencefirst-fullstack-mvp
- **Demo video:** upload the final recording using [`docs/demo-script.md`](docs/demo-script.md), then add its public link here
- **Case study:** https://docs.google.com/document/d/1T-gmO0Uq-E-CkZgGSCVrf-qOEwPeI26gsr4OHdSv4_0/edit

## What the product does

1. Collects adult consent and machine disclosure.
2. Helps the participant recall one recent decision.
3. Uses a bounded AI interviewer to reconstruct the action, rejected alternative, expected outcome, consequence, and supporting reason.
4. Lets the participant correct and freeze the exact belief wording.
5. Applies deterministic eligibility and safety gates.
6. Records initial confidence, the central reason, and a final pre-evidence baseline.
7. Assigns a fixed or personalized evidence condition reproducibly.
8. Delivers only exact, versioned claim units from an approved evidence pack.
9. Records the immediate score, reaction, intended behavior, exact receipt, and seven-day follow-up.
10. Refuses unsupported or out-of-scope claims rather than generating persuasive prose.

The AI model may ask the next question and extract candidate fields. Deterministic application code controls consent, eligibility, state transitions, assignment, evidence policy, delivery, scoring, freezing, receipts, and follow-up timing.

## Evidence discipline

Three versioned evidence packs are enabled:

- general physical activity outside a gym
- study methods
- learning-style matching

Each delivered claim has an ID, exact approved wording, source URL, locator, evidence-pack version, and content hash. Participant-facing text is assembled from approved claim units by a constrained template; the model does not write the final factual brief.

The system can return four honest outcomes:

- evidence contradicts the claim
- evidence supports the claim
- evidence qualifies a mixed claim
- available evidence does not address it

## Architecture

```text
Participant browser
  -> Next.js API routes
  -> bounded OpenAI structured extraction
  -> deterministic state machine and eligibility gates
  -> Supabase/PostgreSQL persistence
  -> closed, versioned evidence-pack policy
  -> constrained delivery template
  -> immutable receipt and seven-day follow-up

Researcher browser
  -> allow-listed Supabase Auth
  -> session traces, evidence audit, exports, and reversal QA
```

## Technology

- Next.js 16 and React 19
- TypeScript and Zod
- Tailwind CSS
- Supabase/PostgreSQL with RLS and immutable-record triggers
- OpenAI Responses API with structured outputs
- Vitest and Playwright
- Vercel

## Repository structure

```text
apps/web/                 Full-stack application
apps/web/app/             Participant, follow-up, and researcher routes
apps/web/lib/             State, AI, eligibility, evidence, and receipt logic
apps/web/db/migrations/   PostgreSQL schema and security migrations
apps/web/tests/           Unit and end-to-end tests
dist/                     Frozen V3.4 static reference prototype
docs/                     Audit trail, deployment notes, case study, and demo script
```

## Verified build status

At the submission checkpoint:

- 107/107 unit tests pass.
- TypeScript, ESLint, and the production build pass.
- Real-model and real-database end-to-end checks cover supported delivery, preference parking, out-of-scope refusal, immutable receipts, follow-up timing, and reversal behavior.
- The production deployment works without a participant login.
- The researcher dashboard is protected by an allow-listed account.
- The public build was checked for mobile overflow and accidental secret exposure.

These checks establish functional correctness of the pipeline. They do **not** establish persuasion efficacy. That requires consented participants and comparison outcomes; synthetic QA sessions are excluded from human-result claims.

## Local setup

```bash
cd apps/web
npm install
cp .env.example .env.local
npm run db:migrate
npm run db:seed
npm run dev
```

See [`apps/web/.env.example`](apps/web/.env.example) for required variables. Never expose service-role or model-provider credentials in browser code.

## Validation

```bash
cd apps/web
npm run test:unit
npm run lint
npx tsc --noEmit
npm run build
npm run test:e2e
```

Some live-model end-to-end paths are intentionally nondeterministic. Deterministic unit and seeded end-to-end tests remain the reproducible regression signal.

## Known limits

- Evidence coverage is intentionally narrow and conservative.
- A supported topic can still be refused when the exact participant claim falls outside the reviewed claim directions.
- Model-backed discovery can take roughly 10–25 seconds per turn.
- The current production mode uses deterministic automatic validation and post-hoc researcher auditing; a manual pre-delivery review mode remains available.
- The production and development deployment currently share one Supabase project.
- Real participant comparison results and seven-day outcomes must be reported separately from synthetic QA.

## Research documentation

- [`docs/case-study.md`](docs/case-study.md)
- [`docs/demo-script.md`](docs/demo-script.md)
- [`docs/submission-evidence.md`](docs/submission-evidence.md)
- [`docs/deployment.md`](docs/deployment.md)
- [`docs/deferred.md`](docs/deferred.md)
