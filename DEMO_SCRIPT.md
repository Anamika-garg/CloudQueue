# CloudQueue — Demo Script

A timed walkthrough for a live presentation or a screen-recorded video. It covers the full product in about **14 minutes**, with a 90-second elevator version and Q&A notes at the end.

The script uses the exact labels visible in the UI. Lines in **"Say"** blocks are narration prompts, not a word-for-word mandate.

---

## Table of contents

- [Pre-flight checklist](#pre-flight-checklist)
- [Demo at a glance](#demo-at-a-glance)
- [Act 1 — The problem and the product (0:00–1:15)](#act-1--the-problem-and-the-product-000115)
- [Act 2 — Student issues a token (1:15–4:15)](#act-2--student-issues-a-token-115415)
- [Act 3 — Admin calls the next token (4:15–6:30)](#act-3--admin-calls-the-next-token-415630)
- [Act 4 — Analytics, history and audit (6:30–8:30)](#act-4--analytics-history-and-audit-630830)
- [Act 5 — The public display board (8:30–9:30)](#act-5--the-public-display-board-830930)
- [Act 6 — Super-admin services and roles (9:30–11:30)](#act-6--super-admin-services-and-roles-9301130)
- [Act 7 — Architecture and security (11:30–13:30)](#act-7--architecture-and-security-11301330)
- [Act 8 — Wrap-up (13:30–14:00)](#act-8--wrap-up-13301400)
- [90-second elevator version](#90-second-elevator-version)
- [Q&A preparation](#qa-preparation)
- [Recovery playbook](#recovery-playbook)
- [Recording checklist](#recording-checklist)

---

## Pre-flight checklist

### 1. Start from a clean, seeded state

```powershell
# In the project root
npm install          # once
npm run build        # builds client/dist
npm run dev          # API + SPA on http://localhost:4000
```

In demo mode the server writes three days of deterministic data once per campus day (the in-memory store reseeds on every restart), so the charts and queue are populated immediately. Run `npm run seed` if you ever want to reset the dataset by hand.

Verify before presenting:

- [ ] **http://localhost:4000/api/health** returns `"status":"ok"`, `"authMode":"demo"`, `"database":"memory"`
- [ ] **http://localhost:4000** loads the landing page
- [ ] The sign-in card shows the **Demo** badge
- [ ] Three persona buttons are visible: **Aarav Sharma**, **Priya Nair**, **Daniel Osei**
- [ ] No other CloudQueue process is using port 4000

### 2. Prepare three browser surfaces

| Surface | Purpose | Suggested setup |
|---|---|---|
| **Window A** | Student experience | Incognito/private window |
| **Window B** | Admin console | Normal window |
| **Tab C** | Public display board | A third tab or a second monitor |

Use **two different browser profiles** (or one incognito and one normal). Demo sessions live in `sessionStorage`, which is scoped to a tab, so this prevents personas from clobbering each other. Arrange A and B side by side so the audience can see a student's view change when the admin acts.

### 3. Screen settings

- Resolution 1440 × 900 or larger; browser zoom 100%.
- Hide bookmarks and unrelated tabs.
- Close notifications.
- If recording, use 1080p and a large cursor highlight.
- Keep the API health tab available but not visible.

### 4. Know the reset move

If the demo goes sideways, run `npm run seed` to rebuild the dataset (or restart the server when using the in-memory store). The seeder clears the demo offices' tokens, so the primary student has no live token again and Act 2 can be repeated cleanly.

> **Why the primary student has no live token:** the seed gives `student@campus.edu` history but deliberately keeps them out of today's live queues, so "Get token" always works on the first try.

### 5. Rehearse the timing

The acts are budgeted for a relaxed pace. If you are short on time, drop Act 6 and shorten Act 7; never rush Acts 2–3, which carry the core story.

---

## Demo at a glance

| Time | Act | Screen | Key message |
|---|---|---|---|
| 0:00–1:15 | Problem and product | Landing | Physical queues waste time; CloudQueue digitises the wait |
| 1:15–4:15 | Student takes a token | `/app` | One tap, live position, ETA, atomic numbering |
| 4:15–6:30 | Admin calls next | `/admin` + `/app` | Atomic claim; the student's view updates by polling |
| 6:30–8:30 | Analytics and audit | `/admin` | KPIs, Chart.js, history, CSV, accountability |
| 8:30–9:30 | Display board | `/display` | Shared source of truth for the lobby |
| 9:30–11:30 | Services and roles | `/admin/services` | Cloud configuration and RBAC |
| 11:30–13:30 | Architecture and security | Slides/diagram | Serverless, Atlas, Firebase, polling, security |
| 13:30–14:00 | Wrap-up | Landing | Status, limitations, roadmap |

---

## Act 1 — The problem and the product (0:00–1:15)

**Screen:** `http://localhost:4000` (landing page).

**Do:**

1. Start on the hero: **"Skip the queue. Not the service."**
2. Slowly scroll to the three feature cards and the "Three taps from the corridor to the counter" section.
3. Point at the stack line: **Vercel · MongoDB Atlas · Firebase Auth · Chart.js**.
4. Scroll to the dark **"One source of truth, served from the edge"** panel.

**Say:**

> "Every campus has the same bottleneck: a corridor queue outside the registrar or the clinic. Students don't know how long they'll wait, staff can't see demand, and the line itself becomes a crowd.
>
> CloudQueue turns that wait into a digital token. A student takes a number from any device and watches their position from anywhere. Staff call the next token from an admin console. A lobby screen shows the number being served. All three views read the same cloud state, so they never disagree.
>
> It's a React SPA on a CDN, a stateless serverless API, MongoDB Atlas for state, and Firebase for identity."

**Transition:** "Let's start as a student."

---

## Act 2 — Student issues a token (1:15–4:15)

**Screen:** Window A (incognito), landing page.

**Do:**

1. In the sign-in card, click **Aarav Sharma · Student**.
   - Expected: lands on **`/app`**, header shows **Demo mode**, greeting **"Hello, Aarav"**.
2. Point out the **Live** badge and the 8-second refresh label.
3. In **Available services**, find the **Registrar** card (code **REG**) and click **Get token**.
   - Expected: a success toast: **"Token REG-NNN issued"** with position and estimated wait.
4. Point at the gradient **Your token** card:
   - token number (e.g. **REG-014**),
   - **Waiting** pill,
   - **Position**, **Est. wait**, **Now serving**,
   - **Ahead of you** chips.
5. Look at the right rail **Live queue**:
   - **Now serving · Registrar**,
   - waiting count,
   - **new token ≈ N min**,
   - the queue list with the serving token highlighted.
6. Scroll to **Your recent tokens** and point at the seeded history.

**Say:**

> "Aarav signs in with the demo persona — in production this is Firebase email or Google sign-in, and the API verifies the ID token on every request.
>
> He picks the Registrar and taps Get token. The API checks that he doesn't already hold a token for this office today, then atomically increments the day's sequence. That's a single MongoDB `$inc` operation, so two students tapping at the same millisecond still get different numbers — REG-014 and REG-015, never a duplicate.
>
> This card is the whole student experience: his number, his place in line, an ETA based on today's observed service rate, and exactly who is ahead of him. The live queue on the right is the same data the lobby screen uses.
>
> The page polls every eight seconds. No refresh, no WebSocket, no always-on server."

**Optional 20-second proof of polling:**

- Leave `/app` visible. In Window B, sign in as admin (Act 3) and call a token. Return to Window A and let one poll pass. The **Position** and **Now serving** values change on their own.

> **If asked why the ETA is 30–40 minutes:** the seed deliberately places two waiting tokens ahead of the live queue, and the clinic's average service time is eight minutes. The estimate is realistic, and it recalculates as tokens are served.

**Transition:** "Now the other side of the counter."

---

## Act 3 — Admin calls the next token (4:15–6:30)

**Screen:** Window B (normal), open `http://localhost:4000`.

**Do:**

1. Click **Priya Nair · Office admin**.
   - Expected: lands on **`/admin`**, header **"Admin console · office administrator"**, title **"Queue control"**.
2. Point at the service selector and click **Registrar** (the page may default to Bursary alphabetically).
3. Point at the **Now serving · Registrar** banner:
   - current token,
   - **N waiting**,
   - **avg service**,
   - **new arrival ≈ N min**.
4. Point at the queue table: **# / Token / Student / Issued / Waited / Status / Actions**.
5. Click **Call next token**.
   - Expected: toast **"Now serving REG-NNN"**; the banner and table update; the previous token leaves the waiting list.
6. Switch to Window A and wait up to 8 seconds.
   - Expected: the student's **Now serving** and **Position** update; if their token was called, a toast says **"It's your turn — REG-NNN"** and the card shows **Now serving**.
7. Back in Window B, on the serving row click **Mark served**.
   - Expected: toast **"Token REG-NNN marked as served"**; KPIs change.
8. On a waiting row, click **No-show**.
   - Expected: the token closes as no-show; the waiting count drops.

**Say:**

> "Priya sees exactly what the student sees, plus the identities behind the tokens — because staff need them, while the public board never gets them.
>
> Call next is the most important operation in the system. In one atomic `findOneAndUpdate`, the API closes the token currently at the counter and claims the oldest waiting token by sequence. If two tellers press the button at the same moment, they get different tokens — the database decides, not the browser.
>
> Watch the student window. Within one poll — eight seconds — Aarav's position and the Now serving number change by themselves. That's the same cloud state propagating to every client.
>
> Mark served closes the loop and records the service duration, which feeds tomorrow's ETA. No-show handles the student who left. Every one of these actions is written to the audit log."

**Optional 15-second edge-case:**

- Click **Call next token** until the queue is empty. The toast says **"Queue is empty"** and the table shows **"No one is waiting"**. This demonstrates graceful empty-state handling.

**Transition:** "All of that produces data. Let's look at it."

---

## Act 4 — Analytics, history and audit (6:30–8:30)

**Screen:** Window B, `/admin`.

**Do:**

1. Point at the five KPI cards: **Issued**, **Served**, **Avg wait**, **No-shows**, **Peak hour**.
2. Point at the two charts:
   - **Tokens per hour** — issued vs served bars.
   - **Average wait by hour** — amber area line.
3. Hover a bar or point to show the tooltip.
4. Scroll to **Daily history**:
   - point at the **Export CSV** button,
   - point at **Page 1 of N** and click **Next** once,
   - return to page 1.
5. Click **Export CSV**.
   - Expected: toast **"Export ready"** with a row count; a CSV downloads.
6. In the right rail, point at **Audit log**:
   - entries for **queue call next**, **queue mark served**, **token issue**, **auth demo login**, **service create**.
   - each shows actor, target and relative time.
7. Point at **Service settings** (code, office, location, average service time, status) and the note that call-next is atomic.

**Say:**

> "The admin console turns queue activity into operations data. Issued, served, average wait, no-shows and peak hour are computed from today's tokens. The charts are Chart.js, rendered in the browser from a 24-bucket aggregate — no chart server, no image generation.
>
> The hourly breakdown shows when demand actually arrives, which is what you need to staff a counter. Average wait is bucketed by the hour a token was called, so a slow morning is visible.
>
> History is paginated server-side and can be exported to CSV for a report. The audit log is append-only: who called which token, who marked it served, who changed a service or a role. That's the accountability layer you need when a student disputes their place.
>
> Notice the numbers agree across KPIs, charts and history — they're all derived from the same token documents."

**Transition:** "Students aren't the only audience. The corridor needs a screen too."

---

## Act 5 — The public display board (8:30–9:30)

**Screen:** Tab C, `http://localhost:4000/display`.

**Do:**

1. Let the dark full-screen board load.
2. Point at the **Live** pill, the clock and the date.
3. Point at each service card:
   - code and name,
   - **Serving / Idle** badge,
   - large **Now serving** number,
   - **Waiting** count and **Est. wait**.
4. Wait five seconds and point at **Updated HH:MM:SS**.
5. Return to `/admin` (Window B), call one more token, then come back to Tab C.
   - Expected: within five seconds, the serving number changes.
6. Point out what is **absent**: no names, no emails, no student IDs.

**Say:**

> "This is the waiting-room screen — a TV or kiosk in the corridor. It shows the number being served, how many people are waiting and an estimated wait for each office.
>
> It refreshes every five seconds, so a student can look up from their phone and see the same number. And it deliberately contains no personal data: token numbers and aggregates only. If someone photographs the screen, there's nothing sensitive to leak.
>
> This is the clearest demonstration of the shared-resource idea: one queue in the cloud, rendered on a phone, an office desktop and a lobby display at the same time."

**Transition:** "Who configures the offices and the staff? That's the super admin."

---

## Act 6 — Super-admin services and roles (9:30–11:30)

**Screen:** Window B. Sign out of Priya's account (click the account chip → **Sign out**), then sign in as **Daniel Osei · System admin**.

**Do:**

1. Expected: lands on `/admin` with a **Manage services** button and a **Services** item in the navigation.
2. Click **Manage services** (or navigate to `/admin/services`).
   - Expected: **"Super administrator"**, title **"Services & access"**.
3. Point at the four service cards: **REG**, **CLN**, **LIB**, **BUR** with **Open** badges and average service minutes.
4. Click **New service**.
   - Fill: Code **PRK**, Name **Parking Office**, Location **Gate 2**, Average service minutes **4**.
   - Choose a colour swatch.
   - Click **Create service**.
   - Expected: toast **"PRK created"**; the card appears.
5. Click **Edit** on the new card, change the name, click **Save changes**. Then click **Deactivate**.
   - Expected: the badge flips to **Closed**; students can no longer take tokens for it.
6. Click **Delete** on the new service.
   - Expected: the confirmation modal explains that services with history are deactivated, not removed. Confirm.
7. Scroll to **Staff & roles**.
   - Point at the role dropdowns (**Student**, **Office admin**, **Super admin**).
   - Point out that the current user's own dropdown is disabled — **"You cannot change your own role"**.
   - Optionally change a seeded student to **Office admin**, then change them back.

**Say:**

> "Super admins configure the system. A service is more than a name: it's a code that prefixes token numbers, a location, an average service time that seeds the ETA, and a colour used consistently across the student cards, charts and display board.
>
> Deleting is intentionally conservative. If a service has ever issued a token, CloudQueue deactivates it instead of destroying history. Reporting stays intact, and students simply can't take new tokens for a closed office.
>
> Roles are stored in MongoDB and enforced by the API, not by hiding buttons. A student calling the admin endpoint gets a 403 even if they craft the request by hand. And a super admin can't accidentally remove their own role — the server rejects self-demotion."

**Transition:** "That's the product. Here's what's underneath it."

---

## Act 7 — Architecture and security (11:30–13:30)

**Screen:** `README.md` architecture diagram, `REPORT.md` architecture section, or a slide with the same diagram.

Show the diagram and narrate top to bottom:

1. **Clients** — student phone, admin desktop, lobby display.
2. **Vercel CDN** — static React SPA, cached at the edge.
3. **Vercel serverless functions** — the Express API, stateless, one deployment, no `app.listen()` in production.
4. **Firebase Authentication** — ID tokens verified server-side with the Admin SDK.
5. **MongoDB Atlas** — the system of record, with atomic operators and compound indexes.
6. **Polling loop** — 8 seconds for the dashboard, 5 seconds for the display, 5–10 seconds for admin.

**Say:**

> "The architecture is deliberately small. The SPA is static, so it's served from the CDN and costs almost nothing at idle. The API is stateless serverless Express: every request carries its own identity, roles are loaded from the database, and no session lives in the function. That's what lets Vercel scale it horizontally without sticky sessions.
>
> Firebase gives us verified identity without storing passwords. The server calls `verifyIdToken` with revocation checking, then loads the user's role from MongoDB. We never trust a role sent by the browser.
>
> MongoDB Atlas is the single source of truth. The queue's two critical invariants are single-document atomic operations: `$inc` for the token sequence and `findOneAndUpdate` with a sort for call-next. Compound indexes cover the hot paths — oldest waiting token, a user's active token, and daily history.
>
> We chose polling over WebSockets because serverless functions are request-scoped. Polling is ordinary HTTPS: it survives cold starts and redeploys, and it's easy to rate-limit and observe. The cost is up to one interval of staleness, which is invisible when service takes minutes. The poller pauses when the tab is hidden, so idle screens don't burn quota."

**Security highlights (30 seconds):**

> "On security: every input is validated with Zod; CORS is an explicit allow-list; helmet sets protective headers; rate limits are 240 public reads, 30 auth attempts and 60 writes per minute per instance; secrets are environment-only; and privileged actions go to an append-only audit log. Public endpoints expose token numbers and aggregates, never names or emails.
>
> One trade-off we document openly: Atlas network access. On the free tier Vercel's egress IPs aren't stable, so the demo may allow all IPs, protected by a strong password and TLS. Production should use private endpoints or stable egress."

**Testing highlight (20 seconds):**

> "The API has a 53-assertion end-to-end suite, including eight concurrent token issues producing eight unique numbers and two concurrent call-next requests returning different tokens. It also proves a student can't read admin stats, an admin can't create services, and a user can't cancel someone else's token."

---

## Act 8 — Wrap-up (13:30–14:00)

**Screen:** Landing page or the report's conclusion.

**Say:**

> "CloudQueue digitises the campus queue end to end. Students get certainty, staff get control, the lobby gets a live screen, and the institution gets data and an audit trail.
>
> It runs as a static SPA on a CDN, a stateless serverless API, MongoDB Atlas and Firebase — all managed services, all elastic, all pay-per-use. The repository includes the full source, a Vercel configuration, environment templates, a MongoDB seed, a 53-assertion test suite, a formal report and this demo script.
>
> The public URL needs the owner's Vercel, Atlas and Firebase accounts, so the repo ships with a zero-account demo mode that exercises the same UI and domain logic. The next steps are a shared Redis rate limiter, push notifications, and multi-counter support.
>
> Thanks — happy to take questions."

---

## 90-second elevator version

Use this when you have one minute and one screen.

1. **Landing (10 s).** "CloudQueue replaces the campus corridor queue with a digital token. React SPA on Vercel, serverless Express, MongoDB Atlas, Firebase Auth."
2. **Student (25 s).** Sign in as **Aarav Sharma** → **Get token** on **Registrar**. "Atomic sequence, so no duplicate numbers. This is his position, ETA and who's ahead; it refreshes every eight seconds."
3. **Admin (25 s).** Sign in as **Priya Nair** in a second window → select **Registrar** → **Call next token**. "The previous token is closed and the oldest waiting token is claimed atomically. Watch the student window — it updates on its own."
4. **Analytics (15 s).** Point at the KPI row and the two charts. "Daily KPIs, hourly demand and wait, history, CSV and an audit log."
5. **Display (10 s).** Open `/display`. "The lobby screen reads the same cloud state and shows no personal data."
6. **Close (5 s).** "53 API assertions pass. Full report and demo script are in the repo."

---

## Q&A preparation

**"Why not WebSockets?"**

> Serverless functions are request-scoped and short-lived; there is no long-lived process to hold a socket. Polling is ordinary HTTPS, survives cold starts and redeploys, and is trivial to rate-limit. For a queue measured in minutes, 5–8 seconds of staleness is imperceptible. If sub-second updates were required, the migration path is SSE/WebSockets on a long-lived runtime with polling as fallback.

**"What happens if two students tap at the same time?"**

> `nextSequence` is a single atomic `$inc` upsert. Each request receives a distinct sequence. A unique index on `{serviceId, dateKey, tokenNumber}` is the final backstop. The smoke suite issues eight tokens concurrently and asserts eight unique numbers.

**"What happens if two admins press Call next simultaneously?"**

> `claimNext` is a `findOneAndUpdate` filtering `status: waiting` with `sort: issuedSequence`. The database serialises the claims, so each admin receives a different token. The suite runs two parallel calls and asserts distinct results and exactly one serving token.

**"Is the public board a privacy risk?"**

> It returns token numbers, waiting counts and aggregates only. No names, emails or user IDs. The admin endpoints that expose identities require the admin role.

**"How are roles enforced?"**

> The client hides navigation for convenience, but the API verifies the bearer token, loads the user record from MongoDB, and checks the role in middleware. A hand-crafted request from a student receives 403. The suite tests three cross-role denials explicitly.

**"What about rate limiting across serverless instances?"**

> Current limits are per warm instance, which is a guard rather than a hard global cap. The documented production fix is a shared Redis store (e.g. Upstash) or edge WAF rules. We state this as a limitation rather than overclaiming.

**"Why MongoDB instead of PostgreSQL?"**

> The access pattern is document-shaped: a token carries denormalised service and user labels, and the hot operations map directly to atomic single-document updates. Atlas provides a managed replica set and a free tier. PostgreSQL would work, but it would add joins on the hot path and more migration work for little benefit here.

**"How does the ETA work?"**

> `(people ahead + the person at the counter) × effective service minutes`. The effective rate is 70% observed from the last up to eight served tokens and 30% configured average, so it reacts when a counter runs slow without overreacting to one outlier.

**"What is not finished?"**

> The public deployment URL, because it needs the owner's cloud accounts. Demo data is ephemeral in memory mode. Rate limits are per instance. Notifications are in-app only. There are no automated browser tests yet. All of this is in the report's limitations and roadmap.

**"Can it handle multiple counters per office?"**

> Not in this version: one serving pointer per service per day. The roadmap adds multiple tellers with their own pointers. The data model already separates queue state per service and day, so the extension is additive.

**"How would you scale to 10,000 students?"**

> Stateless functions scale horizontally; Atlas scales vertically and can shard by service; add Redis for shared rate limits and short-lived snapshots; add ETag/304 to polls; pre-aggregate daily stats; and serve the board from a short cache. The load estimate in the report shows the request rate and where caching pays off.

---

## Recovery playbook

| Symptom | Likely cause | Fix |
|---|---|---|
| Landing shows **"Cannot reach the CloudQueue API"** | API not running | Start `npm run dev`; check `/api/health` |
| Sign-in card shows **Live** instead of **Demo** | Firebase env vars present | Set `DEMO_MODE=true`, or `ALLOW_DEMO_LOGIN=true` to keep both, then restart |
| Student **Get token** returns "You already hold a token" | A previous run issued one | Cancel it, or run `npm run seed` to reset |
| Admin page opens on **Bursary** | Services are alphabetical | Click **Registrar** in the service selector |
| Charts are empty | Date selector is not today, or timezone mismatch | Set the date to today; set `CAMPUS_TIMEZONE` explicitly |
| Student view does not update after call-next | Poll has not elapsed, or tab is hidden | Bring the tab to the foreground; wait 8 seconds |
| Display board shows **Idle** everywhere | Queue empty for today | Call a token for that service, or run `npm run seed` |
| `EADDRINUSE` on start | Old server still running | Stop the previous process; change `PORT` if needed |
| Build looks stale | Client not rebuilt after changes | `npm run build`, restart |
| CSV has no rows | No tokens on the selected date/service | Choose today and the seeded service |

---

## Recording checklist

**Before recording**

- [ ] 1080p, 30 or 60 fps, system audio muted, microphone tested
- [ ] Clean desktop, no personal notifications
- [ ] Two browser profiles prepared and pre-warmed
- [ ] Landing page loaded; `/display` loaded in a third tab
- [ ] Font size comfortable for mobile viewing (zoom 110% if needed)
- [ ] Script open on a second monitor or phone

**During recording**

- [ ] Move the cursor deliberately; pause on each important number
- [ ] Give the audience 8 seconds after call-next to see the poll update
- [ ] Say the token number out loud when it changes
- [ ] Keep acts to the time budget; cut Act 6 first if running long

**After recording**

- [ ] Trim the initial load and any failed take
- [ ] Add captions for token numbers and key terms
- [ ] Blur nothing — the demo data is fictional
- [ ] Export at 1080p; keep the file under the submission limit

**Suggested title card**

> **CloudQueue — Digital queue management for campus services**
> React · Vercel · MongoDB Atlas · Firebase Auth
> CCSA cloud computing project

---

## One-line summary for the submission form

> CloudQueue is a cloud-based campus queue manager: students take digital tokens and track their live position and ETA, staff call and close tokens from an RBAC-protected admin console, and a public display board shows the same queue in real time — built with React, serverless Express on Vercel, MongoDB Atlas and Firebase Authentication, with atomic queue operations, polling updates, Chart.js analytics and a 53-assertion test suite.
