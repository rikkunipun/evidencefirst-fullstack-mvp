# EvidenceFirst web application

The deployable Next.js application for EvidenceFirst. Project-level documentation, architecture, validation evidence, and submission links are in the [repository README](../../README.md).

## Start locally

```bash
npm install
cp .env.example .env.local
npm run db:migrate
npm run db:seed
npm run dev
```

Open http://localhost:3000. Do not commit `.env.local`.

## Checks

```bash
npm run test:unit
npm run lint
npx tsc --noEmit
npm run build
npm run test:e2e
```

## Production

https://evidencefirst-fullstack-mvp.vercel.app

See [`../../docs/deployment.md`](../../docs/deployment.md) for deployment and verification details.
