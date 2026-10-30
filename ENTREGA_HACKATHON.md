# LA ASISTENTA — Hackathon submission package

> Prepared 29 Oct 2026 for the Meta × Cerebral Valley hackathon
> (submission deadline: **Wed 4 Nov, 21:00 ET** = 5 Nov, 03:00 Madrid;
> internal target: submitted by 4 Nov, 23:00 Madrid).
> Everything between the `✂️ COPY-PASTE` markers is final form copy.
> Fields that are **not yet closed** are marked ⚠️ PENDING — do not
> submit them as if they were done. The appendix at the end is
> internal and is **not** pasted into the form.
> Every claim below is verified against the running system; anything
> prepared-but-dormant is labelled as such.

---

## ✂️ COPY-PASTE — Project name

```
La Asistenta
```

## ✂️ COPY-PASTE — Tagline

```
A modular platform for AI-assisted booking and commerce for local businesses — live today at a real brow salon in Madrid.
```

## ✂️ COPY-PASTE — Short description

```
La Asistenta is the 24/7 AI receptionist a small business can actually afford. Clients discover the salon, get an AI brow analysis from a photo, see real availability and book into the salon's real agenda — in a mobile web app or over WhatsApp — while the owner runs her day from a professional area built on a transactional, double-booking-proof agenda.
```

## ✂️ COPY-PASTE — Long description

```
THE PROBLEM
A neighbourhood salon cannot staff a receptionist around the clock, but its clients write around the clock. Every unanswered evening WhatsApp message is a booking that quietly goes somewhere else, and the owner answers chats between clients, from memory, with no agenda discipline — double-bookings and lost follow-ups included.

THE SOLUTION
La Asistenta is a modular platform for AI-assisted booking and commerce for local businesses. It is not a chatbot bolted onto a calendar: the booking core comes first and the AI is layered on top of it. The agenda is the single source of truth — every write passes a transactional overlap guard, creation is idempotent, and appointments are never deleted (cancellations are states, not erasures), so the AI can recommend and converse but can never double-book a slot.

A client discovers the business, searches its real services, gets an AI brow analysis from a photo (consent first; the photo is processed in memory and discarded), receives a recommendation tied to the real price list, sees real availability and books — receiving a booking code and a personal magic link to view, prep for, reschedule or cancel the appointment, plus a calendar (.ics) file. The same booking conversation runs over WhatsApp, where an AI operator answers in natural Spanish, recommends from the real catalogue, shows a summary and asks for explicit confirmation before writing anything. When a request falls outside the catalogue, the operator does not improvise: it hands over to the human.

The owner runs her business from a professional area: today's appointments with one-tap state changes, a 7-day agenda with real free intervals, a waitlist that surfaces the moment a slot frees up, an outbox for client follow-ups, and a measured booking funnel.

THE PILOT IS REAL
The platform runs today with a real pilot business: Ari Vivas Beauty, a brow salon in Madrid (arivivasbeauty.com). Its catalogue on the platform is its public one — Ombré Brows Henna €30 · Brow Lamination €45 · Brow Design €18 · Quick Waxing (ask) — with its real hours (Mon–Fri 10–20, Sat 10–14, closed Sundays) and its real agenda. No prices, reviews, ratings or availability are invented anywhere in the product.

BUILT TO GROW, HONEST ABOUT SCALE
The interface renders from a central module registry: beauty & booking is the active module; fashion try-on, glasses & accessories and footwear are registered as "coming soon" with honest placeholder screens — no fake products, no simulated results. Multi-business isolation is implemented and verified (every record carries a business id; a second business sees none of the pilot's data). Measured on the production box, the agenda answers health checks at p50 0.3 ms, availability at p50 2.7 ms and booking creation at p50 1.3 ms; five simultaneous booking attempts on the same slot produce exactly one winner (1× 201, 4× 409, ~10 ms). We do not claim this shape supports millions of users: it comfortably serves one business and, on the same box, dozens of small ones — the submission documents exactly what real scale would require.
```

## ✂️ COPY-PASTE — How we used Meta technology

```
MUSE SPARK is the brain of the product, in production. We run Meta's open-weights model (meta-models/muse-spark-open-1026, served on Baseten) in two places:

1. Brow analysis in the web app. The client consents, uploads a photo, and Spark analyses her brows (shape, thickness, density, gaps) and recommends the service from the salon's real catalogue that best fits her stated preferences. The flow is asynchronous with honest progress polling — measured end-to-end in the UI at 12.2 s in full QA, 15.1 s in the pre-submission technical rehearsal and 12.1 s in the post-redesign QA21 pass (30 Oct). The photo is processed in memory and discarded; nothing is stored.

2. The WhatsApp operator. Spark powers the receptionist that holds the booking conversation in natural Spanish: it recommends from the real price list with exact prices, resolves relative dates ("this Thursday"), checks the salon's real hours, presents a summary and only writes to the agenda after the client's explicit confirmation. The operator runs on Hermes Agent (Nous Research's open-source agent runtime), which gives it tool access to the agenda over MCP. In server-side tests the operator has completed full booking conversations against the real agenda; the live handset rehearsal on the Twilio sandbox is scheduled for Nov 2 (see the pending checklist — we do not claim it before it happens).

MUSE IMAGE + SAM 3.1 — key provisioned and verified against the real Meta Model API on 30 Oct; the in-product switch turns on the moment the key is placed on the host. What is already proven with the founder's real team key (not a stub): GET /v1/models answers 200 with both models available to the team; a real Muse Image edit of the project's example photo was executed end-to-end (orientative brow-service preview generated, identity preserved, 21 s, $0.01); and SAM 3.1's real response format (bounding-box + mask tokens over the Responses surface) was confirmed and is now parsed by our provider. The $150 Meta credit is confirmed applied to the account (founder-verified in dev.meta.ai Billing, 30 Oct). Until the key file lands on the host, the product shows no simulated preview: the analysis result itself tells the client, in plain words, that the visual preview is not yet available and that we never show fake images. Benchmark H1 (strategy A, the production strategy) was executed on 30 Oct over the authorized stock-photo set: 12 real Muse Image proposals across 6 brow cases × 2 intensities — edit latency p50 16.1 s, identity preservation 5.0/5 and change confinement 5.0/5 under the protocol's rubric, zero out-of-brow leaks, $0.12 total against the confirmed credit. The one criterion still open is the salon owner's blind acceptance scoring, which the protocol reserves to her.
```

## ✂️ COPY-PASTE — Impact

```
La Asistenta gives a one-person business the reception capacity of a staffed salon: 24/7 answering, recommending and booking, with the discipline of a transactional agenda underneath.

- A real pilot, not a mock-up: Ari Vivas Beauty (Madrid) runs its real catalogue, real hours and real agenda on the platform today — client web app, WhatsApp channel and the owner's professional area.
- Booking reliability, measured (production box, reproducible from the repo): health p50 0.3 ms · availability p50 2.7 ms · booking creation p50 1.3 ms · 20 simultaneous availability reads: 20× 200 · 5 simultaneous bookings on the same slot: exactly one winner (1× 201 + 4× 409 in ~10 ms) · idempotent creation (same key + same body returns the original booking; different body is rejected 422) · cancellation guard: a completed appointment can no longer be cancelled from any surface.
- Verified, not just built: test batteries against the real machine — web 33/33 · professional panel 25/25 · agenda guard 11/11 · booking mechanics 23/23 · multi-business isolation 22/22 · try-on + Meta provider adapters 18/18 (offline) — plus click-through QA of every screen at a real phone size (412×915), a full technical rehearsal of the demo sequence on 29 Oct (8/8 steps, 0 console errors), and a complete post-redesign re-verification on 30 Oct (functional matrix 15/15, demo sequence re-run 8/8, PWA cache update v29→v30 verified clean).
- Privacy by design: analysis photos are processed in memory and discarded; magic links are stored as SHA-256 hashes; test appointments are always left cancelled, never deleted — the pilot's live agenda holds no test data.
- A path beyond one salon: the module registry and per-business data isolation are already in place and verified, so a second business is a configuration change, not a rewrite — with an honest note in the repo about what true scale would require next.
```

## ✂️ COPY-PASTE — Built with

```
Muse Spark (meta-models/muse-spark-open-1026, Meta open weights) on Baseten · Hermes Agent (Nous Research) · Meta Model API — Muse Image + SAM 3.1 (team key provisioned and verified against the real API on 30 Oct; in-product activation pending the key's placement on the host) · Python 3.11 standard library (web + agenda servers) · SQLite with transactional overlap guard · MCP (agenda tools for the operator) · Twilio WhatsApp sandbox (TwiML replies) · PWA — vanilla JS + service worker, installable, offline shell · InstaBox hosting · FASHN VTON v1.5, Apache 2.0 (fashion try-on module: truss + adapter built and dormant) · Capacitor (owner's Android shell)
```

## ✂️ COPY-PASTE — Links

```
Repository: https://github.com/Blackleets/la-asistenta
Live app (pilot): https://8090-agqyfjnmnvcrrnfraerzrpu5ye.instabox.tech
Demo video: ⚠️ PENDING — recorded after the dress rehearsal on Nov 2 (see checklist below); this field is filled at submission time, not before.
```
> Note for the live demo: the app runs on a free-tier machine that
> pauses after 30 idle minutes; it is woken for judging sessions.
> Everything in the repo is reproducible from source.

---

# Demo video — final script (3:00)

Aligned with the rehearsal runbook (`ENSAYO_Y_DEMO.md` §2), which is
the operative document on recording day; minute-by-minute narration
lines live in `GUION_DEMO.md`. Rule that does not change: **everything
presented as live is live**; anything pre-recorded is labelled on
screen. The WhatsApp shots are recorded at the dress rehearsal on
**Mon 2 Nov** against the real Twilio sandbox (budget: 13 of the
trial's 100 messages for the whole rehearsal + recording plan).

| Time | Shot | Live / pre-recorded | On-screen text | What it proves |
|---|---|---|---|---|
| 0:00–0:20 | Arianna after hours; WhatsApp notifications piling up; clock reads 23:40 (real salon material, no real client data visible — rehearsal conversation notifications) | Pre-recorded | `23:40 — the salon is closed. Its WhatsApp isn't.` | The problem: bookings lost outside working hours |
| 0:20–0:35 | Architecture card: 📞 WhatsApp · 🧠 Muse Spark · 🧭 Hermes Agent · 📋 Real agenda | Pre-recorded (graphic) | `📞 WhatsApp · 🧠 Muse Spark (Meta) · 🧭 Hermes Agent (Nous Research) · 📋 A real agenda` | The stack, named honestly |
| 0:35–1:05 | Client's phone, screen recording: she writes asking for natural-but-noticeable brows; La Asistenta recommends from the real list — Brow Design €18 · 25 min and Ombré Brows Henna €30 · 65 min | **LIVE** (real sandbox conversation; waits sped up in editing with the "typing…" indicator visible, no content cuts) | `Real prices from Ari Vivas Beauty — nothing made up` | Spark converses and recommends with exact prices |
| 1:05–1:30 | Same conversation: she picks Brow Design, "this Thursday around 17:30", gives her name; La Asistenta shows the full summary and asks "Shall I confirm it for you?" | **LIVE** | — | Date resolution, schedule validation, explicit confirmation before writing |
| 1:30–1:50 | She confirms → split screen: the appointment **appears at that moment** in the professional area's "Today" on the owner's screen | **LIVE** | `The booking is written to the agenda — LIVE` | The full loop message → real booking, no human touching a phone |
| 1:50–2:15 | Web app: consent → photo → brow analysis → recommendation → book it. Decision rule from the runbook, fed by the 29 Oct pre-rehearsal (15.1 s end-to-end): if rehearsal-day latency holds ≤ ~45 s, record **LIVE** (async polling shows honest progress); if Baseten is in a slow streak, use a pre-recorded take of a **real analysis from the same day**, labelled on screen, with the measured latency stated in the narration. Never simulated. If the Muse Image preview is shown at all, it carries its label | LIVE (planned) / pre-recorded real take (fallback, labelled) | `Under construction — visual preview with Muse Image + SAM 3.1` (only if the preview step is shown) | Meta vision stack + the honesty rule in action |
| 2:15–2:40 | The owner's organised day in the professional area; an ambiguous client message arrives and La Asistenta hands it over to Arianna instead of improvising (the rehearsal's hand-off take may be reused if clean, labelled as rehearsal footage) | **LIVE** | `When in doubt, it hands over to the human` | Impact + knowing when not to act |
| 2:40–3:00 | Closing shot: the salon working, Arianna with a client, her phone face-down and silent. Final card | Pre-recorded | `La Asistenta — the 24/7 receptionist a small business can actually afford` | The one-sentence pitch |

**Recorded at the Nov 2 dress rehearsal, in order:** machine wake-up
+ health checks → Twilio sandbox re-join from the founder's phone
(1 message) → server-side warm-up autotest (0 messages) → founder's
"Hola" (2) → the full booking conversation, Carmen script, 4 turns
(8) → the ambiguous-message hand-off (2) → web booking rehearsal (0)
→ web analysis rehearsal with latency noted (0) → professional area
shots (0). **Rehearsal total: 13 messages of 100.**

---

# ⚠️ PENDING — not closed until these happen (do not submit around them)

- [ ] **Demo video URL** — the video is recorded after the Nov 2
      dress rehearsal (same afternoon or Nov 3). No video exists
      yet; the Links field above stays ⚠️ until it does.
- [ ] **WhatsApp live confirmation** — the founder's real message to
      the Twilio sandbox (+49 15888 620339, `join twilio-trial`) and
      the full rehearsal conversation happen on Nov 2 per the
      runbook. Until then, the operator's live-handset step is the
      one matrix row honestly marked "not testable without the
      founder" — the channel is wired and server-tested, and no copy
      in this package claims more than that.
- [ ] **Muse Image + SAM 3.1** — the team key IS provisioned
      (created by the founder in dev.meta.ai on 30 Oct, stored in
      Muse's Secure Vault) and VERIFIED against the real API: model
      list 200, a real Muse Image edit executed ($0.01, 21 s) and
      SAM 3.1's real token format confirmed and parsed. The $150
      Meta credit is confirmed in Billing by the founder. One
      gesture remains: the key's value must be written into the
      host's `web/meta.env` (0600) — the vault never returns values
      in clear, so this placement is the founder's, from the value
      shown once at creation (or a fresh key). The copy above
      describes exactly this state, so the submission is honest
      either way.
- [ ] **Final repo freeze (Nov 4)** — a small diff on the audited
      29 Oct sync: rehearsal notes, this package, the final
      `ESTADO_PROYECTO.md`, `web/qa19/` (pre-rehearsal evidence) and
      `web/qa21/` (post-redesign QA evidence),
      after the usual two-way secret audit.

---

# APPENDIX (internal — do NOT paste into the form)

## Technical pre-rehearsal of the demo sequence — 29 Oct 2026 (QA19)

Executed in order against the real app at 412×915 with a headless
browser on the production machine (`web/qa19/preensayo.mjs`; log and
screenshots in `web/qa19/`). **No Twilio messages were spent** — the
WhatsApp leg is the Nov 2 rehearsal. Result: **8/8 steps OK, 0
console errors, no horizontal overflow on any step (scrollWidth 412
throughout).**

| # | Step | Result | Time | Evidence |
|---|---|---|---|---|
| 1 | Open the app | ✅ OK | 1.9 s (interactive in 715 ms) | Home per spec: salon row, search pill, 8 real tiles, service worker in control |
| 2 | Search a service ("henna") | ✅ OK | 1.5 s | Lands on Explore with "Ombré Brows Henna" as the only visible card |
| 3 | View Recommended | ✅ OK | 2.7 s | Carousel with 4 cards (salon + Diseño €18 · Henna €30 · Lamination €45); horizontal swipe works (scrollLeft 333) |
| 4 | Brow analysis (example photo) | ✅ OK | 20.0 s step · **analysis 15.1 s end-to-end in the UI** (12.26 s model time, as the app itself reports) | Consent gate verified (button disabled until accepted); Spark recommended **Diseño de cejas (18 € · 25 min)**, alternative Brow Lamination; the result screen itself states the visual preview is not yet available and that no fake images are shown |
| 5 | Book the recommended service | ✅ OK | 4.7 s | "Reservar este servicio" → step 2 with the service seeded; booked **today 29 Oct, 10:00** — see note below; code **AS-AAKU** |
| 6 | Confirmation + magic link | ✅ OK | 3.1 s | Confirmation shows code + personal link; the link opens the appointment: CONFIRMADA, AS-AAKU, correct service/date/name |
| 7 | Owner's view in the professional panel | ✅ OK | 4.9 s | Logged in with the business key; AS-AAKU found in "Today" |
| 8 | Cancel the demo appointment | ✅ OK | 6.2 s | Cancelled from the magic link; still cancelled after reload (state, never deleted) |

**Note on step 5 (honest, also logged in `ESTADO_PROYECTO.md` §46):**
the script takes the first slot the availability API offers, and for
today the API lists the day's full schedule without filtering hours
already past — at ~16:25 it offered 10:00 first, and the booking
succeeded. Nothing in the demo depends on this (at the rehearsal a
human picks a sensible future slot), but it is a real product
observation: recommend filtering past hours for the current day in
`/api/disponibilidad`, with a battery test. It was **not** patched in
this package — the booking core stays untouched in submission week
unless the CTO decides otherwise.

**Update 30 Oct (QA21):** the CTO did decide otherwise — the
past-hours issue was fixed on 29 Oct (`ESTADO_PROYECTO.md` §§47/49):
availability no longer offers past slots on any surface, and creating
or rescheduling into the past returns 409. QA21 verified it again
against the final build: the demo-sequence booking landed on the
first real future slot of the day, and the guard battery passes
11/11.

**Latency input for the recording decision (runbook §2):** analysis
at 15.1 s end-to-end is well inside the ≤ ~45 s "record it live"
criterion; QA18 measured 12.2 s on 29 Oct as well. Plan: record the
analysis live at the rehearsal; the labelled same-day fallback stays
in the runbook in case of a slow streak.

## Full post-redesign re-verification — 30 Oct 2026 (QA21)

After the MUSA redesign (blocks B1–B6, B8–B10) changed much of the
surface, the whole app was re-verified end to end against the final
build (service worker v30) on the production machine, at 412×915
(`web/qa21/`; full log in `ESTADO_PROYECTO.md` §61):

- **Functional matrix 15/15** across two runs: empty-search state,
  pack booking end-to-end (price/duration sums verified: €48 · 90 min),
  magic link (view, prep form, reschedule, cancel — all persisted),
  a booking for today fulfilled from the owner panel, Sunday-closed +
  waiting-list sign-up, a real 409 slot race with a human-readable
  recovery message, invented-token error page with exits, invalid
  photo rejection, save-a-look, saved items + profile, "My
  appointment", and the full professional area. Console errors: only
  the deliberately provoked ones (409/404/401) in run 1; zero in run 2.
- **Demo sequence re-run: 8/8 steps, 0 console errors** — open 1.2 s ·
  search 1.5 s · recommended 2.7 s · analysis step 17.0 s with
  **12.1 s end-to-end** · book 4.0 s · magic link 3.1 s · owner panel
  4.9 s · cancel 6.2 s.
- **PWA update path verified for real:** a profile installed on the
  v29 service worker was migrated to v30 — old cache deleted, new
  cache sole survivor, page controlled by the new worker, app fully
  functional, 0 console errors in both phases.
- **One real defect found by the founder and fixed:** the sticky
  "TU CITA" header in booking step 3 squeezed a 3-service pack name
  into a 124 px word-per-line column (161 px tall bar). Pure-CSS fix:
  the name now takes the full width and the price sits on the header
  row — bar 114 px, name 2 lines at 344 px, verified with the exact
  pack from the founder's own booking.
- **All batteries green on the final build:** web 33/33 ·
  professional 25/25 · agenda guard 11/11 · booking mechanics 23/23 ·
  multi-business 22/22 · try-on/Meta adapters 18/18.
- **Zero live test data** at the end: every QA appointment cancelled,
  fulfilled or discarded through its own channel; the only upcoming
  confirmed booking in the agenda is the founder's real one.
