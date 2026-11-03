# Hearth

**A plan your people can use.** Family care, inheritance and optional giving, with clear responsibilities and evidence of completed actions.

Built by **Shivam Gupta**, with AI-assisted research, implementation and testing, for the Meta Global AI Developer Hackathon (November 2026). All application work in this repository was created during the hackathon. The included framework starter and third-party dependencies are credited separately below. The sample family, employers, insurers, policies and institutions are fictional.

## What works

- Private, persistent household workspaces with hosted Sign in with ChatGPT.
- Living planning, permission-based helping, and after-death administration paths.
- People and roles, document originals and execution evidence, account ownership/beneficiary records, insurance policies, and optional giving.
- Encrypted document storage with authorised download; PDF/image reading through Meta Muse Spark 1.3, reviewed transcription, and source-quoted intake proposals.
- Muse Wonder 1.0 cross-record plan review. Every quote must exist in the saved source. Accepting a proposal creates a task with its instructions and source quote; it never executes a legal instruction.
- Email-bound expiring invitation links, member/unused-link revocation, server-side role and information-scope enforcement, and actual server-filtered permission previews.
- Separate insurance claimant authority, requirements, submission references, payment evidence and review packets.
- Death reports separated from evidence of death, recipient identity and representative authority. Real-plan authority review requires an administration-scoped invited professional.
- Exact-cent estate bookkeeping, proposed versus confirmed entries, reserves, overdraw protection, and evidence requirements. Hearth never moves funds.
- SHA-256-linked activity history, prior plan snapshots, permission-filtered exports and complete print summaries.
- Adviser business case with an adjustable value calculator, explicit proposed pricing, scope and operating-cost assumptions.

## Run locally

Node 22.13+ is required.

```sh
npm ci
cp .env.example .dev.vars
# Replace KEY_ENCRYPTION_SECRET with a random 32-byte base64 key.
# For the private loopback-only demo, set LOCAL_DEMO_AUTH=1.
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_smart_prism.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_fantastic_maggott.sql
npm run dev -- --port 5175
```

Apply each migration once. After initial setup, do not replay applied migrations. The source and built preview share `.wrangler/state`. Local previews use local D1/R2; deployed records are separate. The starter also supports a loopback-only mock sign-in at `/signin-with-chatgpt?return_to=/` when using its portable dev profile.

Open Settings in the app to connect a Meta API key. The server validates model access before encrypting and saving the credential. Analysis uses Standard-mode `muse-spark-1.3`; cross-record reasoning uses Standard-mode `muse-wonder-1.0`. Keys are never returned in workspace data or exports. Source/file review requires explicit consent before transmission to Meta. There is a 20-run hourly budget per household, a 5 MB file limit, and bounded request/record sizes. No model output is silently substituted when inference fails.

## Verify

```sh
npm test
npm run typecheck
npm run build
```

The API integration test targets a built **local** Worker with `LOCAL_DEMO_AUTH=0` and an encryption secret. It sends synthetic platform identity headers to test the application's downstream authorisation; it does not test the hosted identity provider itself.

```sh
TEST_BASE_URL=http://127.0.0.1:5176 node tests/api.integration.mjs
```

Use `scripts/start-api-test.mjs` to start a built test worker with the root `.dev.vars`, source bindings, and local storage. Then run `npm run test:api`. Synthetic test users use the `hearth.test` domain; no email is sent. Live model and PDF-intake paths are verified separately using the original synthetic sample in `fixtures/maria-policy-sample.pdf`.

## Architecture and access

React/TypeScript UI → Vinext server routes → Cloudflare D1 for records, memberships, revisions and encrypted credentials → R2 for AES-GCM encrypted files. Hosted identity is supplied by the Sites dispatch layer. Do not expose the Worker directly to the internet behind a proxy that permits clients to forge the `oai-authenticated-user-*` headers. Self-hosting requires an authenticated reverse proxy or replacing `identity()` with a verified identity provider.

Application operations enforce role and scope server-side. An adviser receives no private wishes, documents, account details, giving records or source text. A helper receives only explicitly shared content under the selected scope. Death reporting restricts further access; it does not grant powers. Administration roles require explicit invitation and recorded authority. Export/download routes use the same checks. Professional is an invited application role, not independent verification of credentials or an engagement with counsel.

Credentials and file contents use AES-GCM with random IVs and context-bound associated data. Protect and back up `KEY_ENCRYPTION_SECRET`: losing it makes stored credentials and files unreadable. D1 platform encryption protects structured records at rest; application permissions protect reads. Prior revisions are preserved. The hash-linked event log detects changes when compared with a trusted export; it is not independent notarisation or a legal-validity guarantee.

## Commercial scope

The initial buyer is an independent advice firm with continuing household coordination work. Proposed pricing is $15,000 onboarding and $18,000 annually for a bounded 250-household service, with separately scoped administration beginning at $3,000. These are hypotheses, not validated willingness to pay or current revenue. No actual customers, savings, insurer relationships, legal engagements or live estate outcomes are claimed.

At $60 per avoidable staff hour, an $18,000 fee requires 300 annual hours of genuine value if justified by labour savings alone. The service must also count its own operations, professional review, security, acquisition and support costs. See `docs/business.md` and the Practice view.

## Important limits

This is a working coordination application, **not an operating law firm, insurer, qualified electronic-will custodian or fiduciary service**. The initial planning guidance is scoped to Florida, with linked primary sources. The app does not certify execution, legal validity, coverage, death, professional credentials or appointment; submit court filings or insurance claims; negotiate disputes; or make payments/distributions. Evidence statuses record what the authorised user supplied. Official processes and qualified professionals remain necessary.

The application does not send invitation emails, scheduled reminders or anniversary messages. Links are generated for the owner to share; reminder preferences are stored without claiming delivery. Charity identity/effectiveness is not independently certified or ranked. Giving is optional, and neither a saved intention nor a donor-advised-fund acknowledgement is automatically a gift received by the preferred operating charity.

Before using real sensitive records or accepting paid case responsibility: independent security assessment, jurisdiction-specific legal review, qualification/engagement checks, privacy contracts, retention/deletion and continuity procedures, incident coverage, backups/restore exercises, and delivery partnerships are still required. See `docs/launch-readiness.md`. These operational requirements are not represented as completed by a green test suite.

## Project provenance

Original application, domain rules, tests, synthetic demo PDF and submission materials: Shivam Gupta, with disclosed AI assistance. Framework scaffold: OpenAI Sites Vinext starter and its vendored integration (preserved license under `scripts/vite/`). UI icons: Lucide (ISC); React, Vinext, Vite, Drizzle, Zod and other dependencies retain their own licenses. No private client documents or third-party insurance forms are bundled. No personal API key, local database, access token or environment file belongs in source control.

MIT license applies to original project code. See LICENSE.
