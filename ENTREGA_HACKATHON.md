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

2. The WhatsApp operator. Spark powers the receptionist that holds the booking conversation in natural Spanish: it recommends from the real price list with exact prices, resolves relative dates ("this Thursday"), checks the salon's real hours, presents a summary and only writes to the agenda after the client's explicit confirmation. The operator runs on Hermes Agent (Nous Research's open-source agent runtime), which gives it tool access to the agenda over MCP. In server-side tests the operator has completed full booking conversations against the real agenda. On 4 Nov the complete demo conversation was executed end-to-end against the production system through the webhook's signed test door — the exact interface Twilio calls: Hermes + Spark answered in Spanish, checked real availability and wrote the booking (Brow Design, Thu 5 Nov, 17:30, code AS-AAXF) into the real agenda; the demo appointment was cancelled afterwards, as all test data is. The Twilio channel itself was verified the same morning (signed self-test: HTTP 200, full reply inside the TwiML, zero trial messages spent). What we do not claim: a founder-handset recording — none was made. The demo video shows that real conversation as an on-screen representation, labelled as such on screen.

MUSE IMAGE + SAM 3.1 — ACTIVATED in the product on 30 Oct: the founder placed the team key on the host, and the closing verification pass (QA22) exercised the live client flow end-to-end on the real machine — consent that discloses the Meta step, a real Spark analysis, and a real Muse Image proposal generated by the product itself, heading the result (the generated photo first, large, with the written orientation below it), labelled as an orientative preview, and saveable to the client's "Mis looks" with the generated image as its thumbnail. Measured in that pass: Spark analysis 12.8 s, visual generation 13.4 s, the full flow 28.7 s in the UI, 0 console errors. Also proven with the founder's real team key (not a stub): GET /v1/models answers 200 with both models available to the team, and SAM 3.1's real response format (bounding-box + mask tokens over the Responses surface) was confirmed and is parsed by our provider. The $150 Meta credit is confirmed applied to the account (founder-verified in dev.meta.ai Billing, 30 Oct). Before activation the product showed no simulated preview: the analysis result itself told the client, in plain words, that the visual preview was not yet available and that we never show fake images — and the first placement attempt, which Meta rejected (401), was detected by the same in-product smoke and recorded, not papered over (ESTADO §64/§65). Benchmark H1 (strategy A, the production strategy) was executed on 30 Oct over the authorized stock-photo set: 12 real Muse Image proposals across 6 brow cases × 2 intensities — edit latency p50 16.1 s, identity preservation 5.0/5 and change confinement 5.0/5 under the protocol's rubric, zero out-of-brow leaks, $0.12 total against the confirmed credit. The one criterion still open is the salon owner's blind acceptance scoring, which the protocol reserves to her.
```

## ✂️ COPY-PASTE — Impact

```
La Asistenta gives a one-person business the reception capacity of a staffed salon: 24/7 answering, recommending and booking, with the discipline of a transactional agenda underneath.

- A real pilot, not a mock-up: Ari Vivas Beauty (Madrid) runs its real catalogue, real hours and real agenda on the platform today — client web app, WhatsApp channel and the owner's professional area.
- Booking reliability, measured (production box, reproducible from the repo): health p50 0.3 ms · availability p50 2.7 ms · booking creation p50 1.3 ms · 20 simultaneous availability reads: 20× 200 · 5 simultaneous bookings on the same slot: exactly one winner (1× 201 + 4× 409 in ~10 ms) · idempotent creation (same key + same body returns the original booking; different body is rejected 422) · cancellation guard: a completed appointment can no longer be cancelled from any surface.
- Verified, not just built: test batteries against the real machine — web 33/33 · professional panel 25/25 · agenda guard 11/11 · booking mechanics 23/23 · multi-business isolation 22/22 · try-on + Meta provider adapters 18/18 (offline) — plus click-through QA of every screen at a real phone size (412×915), a full technical rehearsal of the demo sequence on 29 Oct (8/8 steps, 0 console errors), a complete post-redesign re-verification on 30 Oct (functional matrix 15/15, demo sequence re-run 8/8, PWA cache update v29→v30 verified clean), and the Meta activation closing pass the same day (in-product smoke 5/5 with a real generated proposal heading the result, PWA cache update v30→v31 verified clean, professional panel re-run 25/25).
- Privacy by design: analysis photos are processed in memory and discarded; magic links are stored as SHA-256 hashes; test appointments are always left cancelled, never deleted — the pilot's live agenda holds no test data.
- A path beyond one salon: the module registry and per-business data isolation are already in place and verified, so a second business is a configuration change, not a rewrite — with an honest note in the repo about what true scale would require next.
```

## ✂️ COPY-PASTE — Built with

```
Muse Spark (meta-models/muse-spark-open-1026, Meta open weights) on Baseten · Hermes Agent (Nous Research) · Meta Model API — Muse Image + SAM 3.1 (team key provisioned and verified against the real API on 30 Oct; activated in-product the same day — the live client flow generates real proposals) · Python 3.11 standard library (web + agenda servers) · SQLite with transactional overlap guard · MCP (agenda tools for the operator) · Twilio WhatsApp sandbox (TwiML replies) · PWA — vanilla JS + service worker, installable, offline shell · InstaBox hosting · FASHN VTON v1.5, Apache 2.0 (fashion try-on module: truss + adapter built and dormant) · Capacitor (owner's Android shell)
```

## ✂️ COPY-PASTE — Links

```
Repository: https://github.com/Blackleets/la-asistenta
Live app (pilot): https://8090-agqyfjnmnvcrrnfraerzrpu5ye.instabox.tech
Demo video: https://youtube.com/shorts/ejwBkEfCe1k — «La Asistenta — Demo» (YouTube, unlisted), submitted 4 Nov 2026 (see the closing note below). The centre of the video is one continuous guided tour of the whole app — home, search, full brow analysis, booking, personal link, owner's area — re-recorded on 4 Nov against the live app with zoom-ins driven by the recording's own tap registry; the WhatsApp segment is the real conversation executed against the production system on 4 Nov, shown as an on-screen representation labelled as such; the salon shots are composed from the salon's own photographs. Final master format: **1080×1920 (true 9:16)** — the footage was shot at 824×1830 (taller than 9:16), so the master keeps the complete frame, scaled by height and centred over a blurred, darkened fill of the frame itself; not one pixel of the app is cropped (§86).
```
> Note for the live demo: the app runs on a free-tier machine that
> pauses after 30 idle minutes; it is woken for judging sessions.
> Everything in the repo is reproducible from source.

---

# Demo video — final script (3:00)

Aligned with the rehearsal runbook (`ENSAYO_Y_DEMO.md` §2) and the
minute-by-minute lines in `GUION_DEMO.md`. Rule that does not change:
**everything presented as live is live**; anything that is not a
straight recording is labelled on screen or disclosed here. **Updated
4 Nov — what the final cut actually is:** the founder's handset
recording was never made, so, on the founder's explicit instruction
to simulate and finish, the three shots that depended on it were
produced around a **real execution**: the Carmen conversation ran
end-to-end against the production system on 4 Nov through the
webhook's signed test door (Hermes + Spark gave the real answers,
checked real availability, and wrote a real booking — AS-AAXF, Thu
5 Nov 17:30 — into the real agenda; it was cancelled after the
recording, per test-data hygiene; Twilio spend: 0 messages, the
channel itself having been verified that morning by signed
self-test). The video shows that conversation as an **on-screen
representation** of a WhatsApp chat with its texts verbatim and a
visible on-screen note («Conversación real con La Asistenta,
representada en pantalla»); the personal link's token is masked on
screen, as in the test cut. The two salon shots are **composed from
the salon's own real photographs** (slow Ken Burns), not footage.
Full provenance, per shot, in `video-demo/MANIFIESTO.md` and ESTADO
§79. If the founder records the real shots later, they drop into the
same edit unchanged.

**§84 update (4 Nov, founder's order — "show me how the app works
from head to toe, well made, with zoom effects like the big
startups do"):** the app footage was **re-recorded on 4 Nov** as
one continuous tour of the whole live app (post-§83 state), driven
by real touch input with every tap and focus point registered; the
edit's zoom-ins are programmed from that registry, not eyeballed.
The tour runs: home → search a real service → the full analysis
(real end-to-end latency 34.1 s, compressed on screen and labelled
with its real duration) → booking from the result (**AS-AAXG**,
Wed 4 Nov 16:45, written into the real agenda and cancelled after
the recording, per test-data hygiene) → the personal link (view,
reschedule and cancel shown, cancel not executed) → the owner's
professional area with that very booking in her day. The personal
link in the booking confirmation is blurred in the source frames,
so the blur follows the zoom. The WhatsApp segment and the salon
shots are unchanged from the cut described above; the §81 cut is
kept as `montaje-final-pre84.mp4`.

| Time | Shot | Live / pre-recorded | On-screen text | What it proves |
|---|---|---|---|---|
| 0:00–0:10 | Composed from the salon's own real photographs (its lounge with the salon's branding; Arianna at work), slow Ken Burns — no footage, no invented people | Pre-recorded (composed) | `23:40 — the salon is closed. Its WhatsApp isn't.` then, from ~0:07, the product super: `La Asistenta — the AI receptionist for local businesses` (every explanatory caption in the cut is bilingual ES + EN since the §81 audit) | The problem: bookings lost outside working hours — and the product's name, up front |
| 0:10–1:04 | The full Carmen conversation as a labelled on-screen representation: she asks for natural-but-noticeable brows; La Asistenta recommends from the real list (Brow Design €18 · 25 min, Ombré Brows Henna €30 · 65 min), offers the real free slots for "this Thursday around 17:30", shows the full summary, and only on her explicit confirmation writes the booking — real code **AS-AAXF** (cancelled after the recording, per test-data hygiene) | **EXECUTED against the production system on 4 Nov** (signed webhook door; real answers) — shown as a labelled on-screen representation; compressed from 75 s to 54 s with a uniform factor (waits included), no content cuts | `Real prices from Ari Vivas Beauty — nothing made up` · `A real conversation with La Asistenta, shown on screen` (gloss of the note burned into the footage) · `The booking is written into the real agenda the moment she confirms it` (the §81 audit retired an earlier "— LIVE" wording: the execution was real and the booking was written at confirmation, but the viewer is not watching it live) | Spark converses and recommends with exact prices; date resolution, schedule validation, explicit confirmation before writing; the full loop message → real booking, no human touching a phone |
| 1:04–1:22 | **The tour begins** (§84 re-recording): the app's home — the salon, the pill search, the category grid, the "Recommended" carousel — then "henna" is typed into the search and the real Ombré Brows Henna card opens (€30 · 65 min). Smooth punch-in zooms land on the search field and the card | Pre-recorded (recorded 4 Nov against the live app; real touch input, taps registered) | `The same agenda, through the website` | The web door into the same system, and how a client finds a service |
| 1:22–1:56 | The full brow analysis, end to end: consent (the text is read and accepted) → the example photo → Spark observing (its real phase texts and seconds counter on screen) → **Muse Image's generated proposal, large, heading the result** → the written orientation below it → the look saved to "My looks". Zooms land on the consent, the photo, the waiting card, the proposal and the recommendation | Pre-recorded (real analysis, recorded 4 Nov against the live app; one attempt, no retry) | `BEFORE — her photo` / `AFTER — Muse Image's proposal` (real frames of the same flow) · `Muse Image (Meta) generates the proposal on her photo` · `The real wait was 34 s — sped up here` (the measured 34.1 s wait, compressed and labelled, never faked) · `Visual proposal — orientative` (the label the product itself shows) | Meta vision stack (Spark reads, Muse Image proposes) + the honesty rule in action |
| 1:56–2:16 | Booking from the result: real calendar → Wed 4 Nov → real free slots → 16:45 → her details → confirmation with the real booking code **AS-AAXG** on screen; the personal link under it is blurred in the source frames, so the blur follows the zoom (booking cancelled after the recording, per test-data hygiene) | Pre-recorded (recorded 4 Nov against the live app; the booking was really written to the agenda) | — (the app's own confirmation carries the moment) | The web booking completes against the same real agenda as WhatsApp |
| 2:16–2:30 | Her personal link: the appointment CONFIRMED with its code, the preparation questions, the reschedule panel with real slots, and the cancel option — shown, **not executed**; she keeps her appointment | Pre-recorded (recorded 4 Nov against the live app) | `Her personal link: view, reschedule or cancel` | The client owns her booking after the fact — no account, no app install |
| 2:30–2:37 | The owner's professional area: "Today in your salon" with **that same booking** first in Arianna's day (16:45 · Carmen · AS-AAXG · Confirmed), her counters and her day organised | Pre-recorded (recorded 4 Nov against the live app; the professional key was typed off-camera) | `Arianna's professional area — her day, organized` · `When in doubt, it hands over to the human` | Impact + knowing when not to act |
| 2:37–2:48 | Architecture card: 📞 WhatsApp · 🧠 Muse Spark · 🧭 Hermes Agent · 📋 Real agenda — every label carries its English gloss | Pre-recorded (graphic) | `An employee, not a chatbot.` · `📞 WhatsApp · 🧠 Muse Spark (Meta) · 🧭 Hermes Agent (Nous Research) · 📋 A real agenda` · `SAM 3.1 — available in the same Meta API` | The stack, named honestly |
| 2:48–2:59 | Closing shot composed from the salon's own real photographs: Arianna at work with a client, then a finished-brows portrait. Final card | Pre-recorded (composed) | `La Asistenta — the 24/7 receptionist a small business can actually afford` | The one-sentence pitch |

**How the final cut was actually produced (3–4 Nov):** app footage
recorded the night of 3 Nov against the live app (brow analysis with
a real generated proposal; web booking AS-AAWF, cancelled after the
recording) → architecture card produced 4 Nov → the Carmen
conversation **executed against the production system on 4 Nov**
through the signed webhook test door (4 turns: recommendation →
choice → summary → confirmation; booking **AS-AAXF** written into
the real agenda for Thu 5 Nov 17:30 and cancelled after the
recording; Twilio spend **0**) and represented on screen, labelled →
salon shots composed from the salon's own real photographs → final
render verified (180 s, full decode, frames eyeballed). **§81
explanation audit (4 Nov, founder's order — "it must explain well,
no errors"):** every on-screen text was inventoried line by line
against the documented system and re-verdicted; the one wording
that over-promised («…EN DIRECTO» next to the representation label)
was reformulated to exactly what happened; every explanatory
caption gained an English gloss line (the jury is anglophone; the
app's Spanish UI stays — it is the real business); the
architecture card was re-rendered with English glosses under every
label; three explanation gaps were closed with new captions (the
product super after the cold open, the web-booking door, and the
owner's professional area). Final cut re-verified: 179.97 s, full
decode, a frame from every caption window eyeballed. **§84
re-cut (4 Nov, later the same day):** on the founder's order the
app footage was re-recorded as one continuous zoom-driven tour
(see the §84 paragraph and table above) and the cut was rebuilt
around it — WhatsApp segment, salon shots, architecture card and
every audited caption carried over; final render re-verified:
**179.00 s**, full decode, a frame from every zoom beat and every
caption window eyeballed (three framing fixes found and fixed in
that pass: the BEFORE caption re-windowed onto the loaded photo,
the booking slots re-framed so the hours read in full, and the
generation/wait captions split into two windows). The Nov 2
handset rehearsal plan (13 messages) was never run; the trial's only
historical traffic remains the 7 messages of 28 Oct (ESTADO §70).

---

# ⚠️ PENDING — not closed until these happen (do not submit around them)

- [x] **Demo video URL** — CLOSED 4 Nov 2026: https://youtube.com/shorts/ejwBkEfCe1k («La Asistenta — Demo», unlisted; see the closing note below). — the final cut EXISTS: rendered and
      verified on 4 Nov (see the script section above for exactly
      how each shot was produced — nothing in it is presented as
      what it is not). The URL is pasted here when the video is
      uploaded, after the founder approves the cut; the Links field
      above stays ⚠️ until then.
- [x] **WhatsApp conversation — EXECUTED on 4 Nov, with the honest
      asterisk recorded.** The full Carmen conversation ran
      end-to-end against the production system through the webhook's
      signed test door (the interface Twilio calls): real Spark
      answers, real availability, booking **AS-AAXF** written to the
      real agenda (Thu 5 Nov, 17:30) and cancelled after the
      recording, per test-data hygiene. Twilio spend: **0** (the
      channel itself was verified the same morning by signed
      self-test — HTTP 200, full reply inside the TwiML). What did
      NOT happen: the Nov 2 handset rehearsal on the Twilio sandbox
      was never run, and no founder-handset recording exists — the
      video shows the real conversation as a labelled on-screen
      representation instead. Found and fixed on the way: the
      receptionist's prompt carried a stale hard-coded date («today
      is Tue 27 Oct») that made a first run resolve "this Thursday"
      to 29 Oct and write nothing; the date was corrected to the
      real day and the run repeated clean (ESTADO §79).
- [x] **Muse Image + SAM 3.1** — ACTIVATED on 30 Oct. The team
      key was provisioned by the founder (dev.meta.ai, stored in
      Muse's Secure Vault) and verified against the real API
      (model list 200, SAM 3.1's real token format confirmed and
      parsed, the $150 Meta credit confirmed in Billing). The
      founder then placed a fresh full key on the host
      (`web/meta.env`, 0600) and the closing QA22 pass verified
      the live flow end-to-end on the real machine: consent
      disclosure → real Spark analysis → real Muse Image
      proposal generated by the product, heading the result →
      saved to "Mis looks" with the generated thumbnail —
      5/5 steps, 0 console errors, ≈$0.03 of credit across the
      closing passes. The rejected first placement (401) and its
      diagnosis are recorded in ESTADO §64; the completion in
      §65. Nothing about this item remains pending.
- [x] **Final repo freeze (Nov 4)** — CLOSED: freeze commit `06308ea` (4 Nov), followed by the §85 professional-docs commits `ee59b8b` and `d74f2ab`; substance verified in the §87 final review, and closed for the record at submission time per the §87 sequence. — a small diff on the audited
      29 Oct sync: rehearsal notes, this package, the final
      `ESTADO_PROYECTO.md`, `web/qa19/` (pre-rehearsal evidence) and
      `web/qa21/` (post-redesign QA evidence),
      after the usual two-way secret audit.

---

---

# ✅ SUBMITTED — closing note (4 Nov 2026)

The project was submitted to the **Meta Global AI Developer
Hackathon** (Cerebral Valley) on **4 Nov 2026, ~19:07 Madrid** — the
platform answered **«Project Submitted»**, ~7 h 53 min before the
official deadline (5 Nov, 03:00 Madrid) and ~3 h 53 min before the
internal 23:00 target.

- **Submission ID:** `a5b0574a-edaa-45d6-ac9a-564c681a0348`
- **Submission page:**
  https://cerebralvalley.ai/e/meta-ai-developer-hackathon/hackathon/a5b0574a-edaa-45d6-ac9a-564c681a0348/edit
- **Demo video** (final 9:16 master, §86):
  https://youtube.com/shorts/ejwBkEfCe1k — «La Asistenta — Demo»,
  YouTube **unlisted**, 2:59. It replaced the §81 cut's upload in the
  form's Demo Video field.
- **Consent** checkbox: ticked. **Required survey:** likelihood to
  build with the Meta Model API = **Very likely**; overall opinion
  of the Meta Model API = **Very favorable** (the field turned out
  to be a scale, so the prepared free-text wording was not used).
  Optional survey fields: left blank. X post link: none exists —
  left empty. Partner-technology feedback: left empty (no prepared
  text).
- **One deviation from this package, forced by the platform:** the
  form caps two fields at **3,000 characters**. The Project
  Description (3,099) and "Describe your use of Meta products"
  (3,794) went in trimmed **in wording only** (2,916 and 2,889
  characters) — every figure, price and honesty disclosure
  preserved. The exact texts as submitted are archived in the
  appendix («As-submitted field texts»), as an internal record; the
  full-length versions remain in the COPY-PASTE sections above.
- Full record of the submission day: `ESTADO_PROYECTO.md` §88.

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

---

## As-submitted field texts — INTERNAL RECORD (not copy-paste)

The platform capped two form fields at 3,000 characters, so the two
texts below are the **exact versions that were submitted** on
4 Nov 2026 (trimmed in wording only from the COPY-PASTE versions
above; every figure, price and honesty disclosure preserved). They
are archived here for the record — they are **not** form copy.

### Project Description — as submitted (2,916 characters)

```
THE PROBLEM
A neighbourhood salon cannot staff a receptionist around the clock, but its clients write around the clock. Every unanswered evening WhatsApp message is a booking that quietly goes elsewhere, and the owner answers chats between clients from memory, with no agenda discipline — double-bookings and lost follow-ups included.

THE SOLUTION
La Asistenta is a modular platform for AI-assisted booking and commerce for local businesses. Not a chatbot bolted onto a calendar: the booking core comes first, the AI layered on top. The agenda is the single source of truth — every write passes a transactional overlap guard, creation is idempotent, and appointments are never deleted (cancellations are states, not erasures), so the AI can recommend and converse but can never double-book a slot.

A client discovers the business, searches its real services, gets an AI brow analysis from a photo (consent first; the photo is processed in memory and discarded), receives a recommendation tied to the real price list, sees real availability and books — receiving a booking code and a personal magic link to view, reschedule or cancel the appointment, plus a calendar (.ics) file. The same booking conversation runs over WhatsApp, where an AI operator answers in natural Spanish, recommends from the real catalogue, shows a summary and asks for explicit confirmation before writing. Outside the catalogue, the operator does not improvise: it hands over to the human.

The owner runs her business from a professional area: today's appointments with one-tap state changes, a 7-day agenda with real free intervals, a waitlist that surfaces when a slot frees, an outbox for client follow-ups, and a measured booking funnel.

THE PILOT IS REAL
The platform runs today with a real pilot: Ari Vivas Beauty, a brow salon in Madrid (arivivasbeauty.com). Its catalogue is its public one — Ombré Brows Henna €30 · Brow Lamination €45 · Brow Design €18 · Quick Waxing (ask) — with its real hours (Mon–Fri 10–20, Sat 10–14, closed Sundays) and its real agenda. No prices, reviews, ratings or availability are invented anywhere in the product.

BUILT TO GROW, HONEST ABOUT SCALE
The interface renders from a central module registry: beauty & booking is the active module; fashion try-on, glasses & accessories and footwear are registered as "coming soon" with honest placeholder screens — no fake products, no simulated results. Multi-business isolation is implemented and verified: a second business sees none of the pilot's data. Measured on the production box: health checks at p50 0.3 ms, availability at p50 2.7 ms and booking creation at p50 1.3 ms; five simultaneous booking attempts on the same slot produce exactly one winner (1× 201, 4× 409, ~10 ms). We do not claim this supports millions: it comfortably serves one business and, on the same box, dozens of small ones — the repo documents what real scale would require.
```

### Describe your use of Meta products — as submitted (2,889 characters)

```
MUSE SPARK is the brain of the product, in production. We run Meta's open-weights model (meta-models/muse-spark-open-1026, served on Baseten) in two places:

1. Brow analysis in the web app. The client consents, uploads a photo, and Spark analyses her brows (shape, thickness, density, gaps) and recommends the best-fitting service from the real catalogue. The flow is asynchronous, with honest progress polling — 12.2 s end-to-end in full QA. The photo is processed in memory and discarded; nothing is stored.

2. The WhatsApp operator: Spark holds the booking conversation in natural Spanish — real prices, relative dates ("this Thursday") resolved, real hours checked, a summary shown, and a write to the agenda only after explicit confirmation. It runs on Hermes Agent (Nous Research), with tool access to the agenda over MCP. On 4 Nov the full demo conversation ran end-to-end against the production system through the webhook's signed test door — the exact interface Twilio calls: Hermes + Spark answered in Spanish, checked real availability and wrote the booking (Brow Design, Thu 5 Nov, 17:30, AS-AAXF) into the real agenda; it was cancelled afterwards, as all test data is. Twilio was verified the same morning (signed self-test: HTTP 200, full reply in the TwiML, zero trial messages spent). What we do not claim: a founder-handset recording — none was made; the demo video shows that real conversation as an on-screen representation, labelled as such.

MUSE IMAGE + SAM 3.1 — ACTIVATED in the product on 30 Oct: the founder placed the team key and the closing pass (QA22) ran the live flow end-to-end: consent disclosing the Meta step, a real Spark analysis, and a real Muse Image proposal generated by the product itself, heading the result (photo first, large, written orientation below), labelled orientative and saveable to "Mis looks". Measured: Spark 12.8 s, visual generation 13.4 s, the full flow 28.7 s in the UI, 0 console errors. Proven with the real team key: GET /v1/models answers 200 with both models available, and SAM 3.1's real response format (box + mask tokens over the Responses surface) is confirmed and parsed by our provider. The $150 Meta credit is confirmed applied (founder-verified in Billing, 30 Oct). Before activation the product showed no simulated preview: the result told the client the visual preview was not yet available and that we never show fake images — and the first key placement, which Meta rejected (401), was caught by the same in-product smoke and recorded, not papered over. Benchmark H1 ran on 30 Oct over the authorized stock-photo set: 12 real Muse Image proposals (6 brow cases × 2 intensities) — edit latency p50 16.1 s, identity preservation 5.0/5, change confinement 5.0/5, zero out-of-brow leaks, $0.12 total. The one criterion still open is the salon owner's blind acceptance scoring, which the protocol reserves to her.
```
