# Hearth

**A plan your people can use.** Family care, inheritance and optional giving, with clear responsibilities and evidence of completed actions.

Built by **Shivam Gupta**, with AI-assisted research, implementation and testing, for the Meta Global AI Developer Hackathon (November 2026). All application work in this repository was created during the hackathon. The included framework starter and third-party dependencies are credited separately below. The sample family, employers, insurers, policies and institutions are fictional.

[![Watch the 2:53 product walkthrough](docs/hearth-video-thumbnail.png)](https://youtu.be/WRoXRO8BRIs)

[Watch the public demo](https://youtu.be/WRoXRO8BRIs) · [Try Hearth](https://hearth-family-plan.web.app) · [Inspect the evaluation](https://hearth-family-plan.web.app/evaluation)

## What works

- Private, persistent household workspaces with Firebase sign-in, verified-account planning and isolated private samples. The clean Hosting entry point is https://hearth-family-plan.web.app; the evaluation application is at /evaluation.
- Living planning, permission-based helping, and after-death administration paths.
- People and roles, document originals and execution evidence, account ownership/beneficiary records, insurance policies, and optional giving.
- Encrypted document storage with authorised download; PDF/image reading through Meta Muse Spark 1.3, reviewed transcription, and source-quoted intake proposals.
- Muse Wonder 1.0 cross-record plan review. Every quote must exist in the saved source. Accepting a proposal creates a task with its instructions and source quote; it never executes a legal instruction.
- Email-bound expiring invitation links, member/unused-link revocation, server-side role and information-scope enforcement, and actual server-filtered permission previews.
- Separate insurance claimant authority, requirements, submission references, payment evidence and review packets.
- Death reports separated from evidence of death, recipient identity and representative authority. Real-plan authority review requires an administration-scoped invited professional.
- Exact-cent estate bookkeeping, proposed versus confirmed entries, reserves, overdraw protection, and evidence requirements. Hearth never moves funds.
- SHA-256-linked activity history, prior plan snapshots, permission-filtered exports and complete print summaries.
- Neutral education-charity profiles with source-linked comparison and optional intention prefilling; giving still requires a separately completed route.
- Permission-filtered factual brief for professional review, with document, account and unresolved-action summaries.
- Adviser business case with an adjustable value calculator, explicit proposed pricing, scope and operating-cost assumptions.

## Firebase deployment

The public application and its standalone evaluation view share a clean origin:

- Application: https://hearth-family-plan.web.app
- Evaluation: https://hearth-family-plan.web.app/evaluation
- Repository: https://github.com/shi1720/hearth-family-plan

The dedicated Cloud Run service, build account, runtime account, artifact repository and source bucket are named for Hearth. Runtime credentials stay in Secret Manager. Deployment does not change unrelated services in the host project. The account's new-project and billing-link quotas required an existing billed project; Firebase Hosting uses a separate Hearth site within that project.

```sh
# Requires the pre-provisioned Hearth resources and gcloud authorisation.
# The JSON environment file contains public Firebase config and origins only.
# Secrets are supplied by the named Secret Manager resources, never this file.
npm run deploy:firebase -- --env-file /absolute/path/hearth-gateway-env.json
```

The script builds only gateway source, deploys a Node 24 container with zero minimum instances and bounded capacity, releases Hosting rewrites, and checks health plus anonymous workspace rejection. The Worker source and matching bridge secret must be deployed separately through the backend hosting workflow. See gateway/Dockerfile, gateway/cloudbuild.yaml and firebase.json. Do not run a direct proxy with client-trusted identity headers.

## Evaluation and verification

The public /evaluation page executes 19 synthetic workflow contracts against the actual domain functions. Cases show their input, expected state, observed state, duration and failure. Tests deliberately weaken domain behavior to confirm the evaluator can report failures. A consented live-model run uses a fixed synthetic source, the same Meta transport and credential limits, and checks structured output, exact source quotes, and pending proposal state. Mechanical checks do not measure legal accuracy or certify an interpretation. The UI exposes the actual model output and separate human review prompts.

```sh
npm test
npm run test:gateway
npm run test:key-policy
npm run test:plan-effects
npm run typecheck
npm run build
```

The isolated D1 key-policy suite tests 32 concurrent sample owners and admits exactly 12 shared requests, without making model calls or touching an app database. Gateway tests use injected synthetic identities to verify encryption, refresh binding, CSRF, header stripping and selected-household handling. They do not substitute for the separate hosted Firebase sign-in and live model walkthrough. The built-Worker HTTP suite has 44 checks, with two further 50-pair transport regressions. Ten isolated D1 integration cases force stale invitation, revocation and membership saves and SQL failures to verify state, effects, audit and snapshots commit together or not at all. These suites run in CI.

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

Apply each migration once. After initial setup, do not replay applied migrations. The source and built preview share `.wrangler/state`. Local previews use local D1/R2; deployed records are separate. The direct Worker preview uses only loopback-local demo authentication. To test real Firebase identity and Hosting cookie behavior, use the gateway and the deployed Firebase origin.

Open Settings in the app to connect a Meta API key. The server validates model access before encrypting and saving the credential. Analysis uses Standard-mode `muse-spark-1.3`; cross-record reasoning uses Standard-mode `muse-wonder-1.0`. An optional operator Meta key is usable by authenticated household owners explicitly listed in META_SHARED_EMAILS. An enabled private-sample allowance is additionally restricted to signed Firebase anonymous identities, reserved sample email addresses and fictional plans. Its atomic global rolling-day reservation admits at most 12 requests across all samples, in addition to the household rate limit. Other visitors connect their own key. Samples cannot create real plans or invite others. Keys are never returned in workspace data or exports. Source/file review requires explicit consent before transmission to Meta. There is a 20-run hourly budget per household, a 5 MB file limit, and bounded request/record sizes. No model output is silently substituted when inference fails.

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

The CI suite also runs 50 pooled and 50 connection-isolated rejection/read transport pairs with no retries. An early-rejection timeout reproduced in the local Worker proxy was addressed by bounded body draining (300 KB, one second, 256 reads), preserving the original 403. Unit checks cover complete, oversized, stalled and errored streams. The same stress corpus passes after the change; this does not establish a general fix for the related upstream runtime issue.

## Architecture and access

React/TypeScript UI → Vinext server routes → Cloudflare D1 for records, memberships, revisions and encrypted credentials → R2 for AES-GCM encrypted files. Firebase Hosting routes to a dedicated Cloud Run gateway. It verifies Firebase identity, checks token-refresh UID consistency, and holds the session and selected household in an AES-GCM encrypted HttpOnly __session cookie. Only this cookie is forwarded by Firebase Hosting. The gateway strips client identity headers and signs each upstream request, including identity, path, method, type and body digest. Production Worker APIs require a valid short-lived signed assertion; forged legacy identity headers cannot authorise access. The backend retains Cloudflare D1 and encrypted R2 storage. This is a Firebase-hosted application with a secured Cloudflare backend, not a claim that records are stored in Firestore.

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

## Responsive interface

Desktop navigation can collapse into an 82px icon rail and remembers the choice on this browser. Phones and portrait tablets use a bottom navigation bar with a focus-managed More sheet. Privacy and account controls remain reachable. Document and ledger records become labeled cards on phones, comparison rows name each charity, and forms retain visible actions with 16px input text. Uploads have readable filenames, matching format/size checks and drag-and-drop support. Unsaved forms ask before discarding edits; writes and uploads prevent an accidental close. Saved source views retain quotations and review dates without exposing technical hashes. Search includes a clear action. Save feedback clears after eight seconds. Checked layouts include 320px and 390px phones, a 768px tablet, and a 1280 × 640 laptop.

See [the everyday usability pass](docs/quality-of-life.md) for the changes and bounded workflow checks. The branded favicon and home-screen icons match the rose-and-plum design.

## Review materials

See [the project story](docs/submission-story.txt), [testing instructions](docs/review-testing.txt), [video metadata](docs/submission-video-metadata.txt), [narration](docs/submission-narration.txt) and [timed captions](docs/submission-captions.srt). The [public 2:53 product walkthrough](https://youtu.be/WRoXRO8BRIs) opens with the family problem and follows preparation, careful handover and after-death administration, then explains Meta model roles, evaluation and the proposed buyer. It uses original fictional records and actual app footage edited for pacing. The generated voice is a standard Google Cloud Chirp voice, without cloning a real person.

The entry was submitted on November 3, 2026 as Hearth Family Plan, Indie Developer, Build for Your World. Hearth was already taken as a team name. See [the publication receipt](docs/submission-receipt.txt). Google popup sign-in did not complete in the automated browser session and remains a manual review item; anonymous sample sign-in was verified through the clean Firebase origin.
