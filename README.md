# La Asistenta

**A modular platform for AI-assisted booking and commerce for local businesses** — built for the Meta × Cerebral Valley hackathon, and running today with a real pilot business: **Ari Vivas Beauty**, a brow salon in Madrid ([arivivasbeauty.com](https://arivivasbeauty.com)).

A client discovers the salon, gets an AI brow analysis from a photo, sees **real** availability and books into the salon's **real** agenda — from a mobile web app or over WhatsApp, where an AI operator (Hermes) answers, recommends from the real price list and confirms the booking. The owner runs her day from a professional area: today's appointments, a 7-day agenda, a waitlist with one-tap WhatsApp follow-up, and a measured booking funnel.

> **Live demo:** https://8090-agqyfjnmnvcrrnfraerzrpu5ye.instabox.tech
> The demo runs on a free-tier machine that pauses after 30 idle minutes; it is woken up for judging sessions. Everything below is reproducible from this repository.

![Home — discovery, search and the module shelf](https://8090-agqyfjnmnvcrrnfraerzrpu5ye.instabox.tech/icons/vista-espec-inicio.png)
![Recommended — the salon and its real services](https://8090-agqyfjnmnvcrrnfraerzrpu5ye.instabox.tech/icons/vista-espec-recomendado.png)
![Salon page](https://8090-agqyfjnmnvcrrnfraerzrpu5ye.instabox.tech/icons/vista-barrido-salon-barra.png)

---

## Why it is built this way

Booking reliability outranks AI features. The agenda is the source of truth: every write goes through a transactional overlap guard, idempotency keys and a state machine that never deletes an appointment (cancellations are states, not erasures). AI is layered on top of that foundation — it recommends and converses, but it can never double-book a slot.

## The Meta stack

| Piece | Role |
|---|---|
| **Muse Spark** (`meta-models/muse-spark-open-1026`, Meta's open-weights model, served on Baseten) | The brain: brow-photo analysis and service recommendation in the web app (async, with honest progress polling — measured 12.2 s end-to-end in the UI on a real run), and the conversational operator behind WhatsApp |
| **Hermes Agent** (Nous Research) | The operator runtime: a WhatsApp receptionist with the salon's real services, prices and rules, tool access to the agenda via MCP, and human hand-off when a request falls outside the catalogue |
| **Muse Image + SAM 3.1** | Integration prepared, not yet live: the try-on contracts (`probador/INTERFACES.md`) route brow previews and segmentation through them as soon as the Meta team API key is provisioned. Until then the UI labels that step as under construction — no simulated results are ever shown |
| **FASHN VTON v1.5** (Apache 2.0) | Chosen engine for the future fashion try-on module after a licence-first model survey (`MODELOS_TRYON.md` — IDM-VTON and CatVTON were rejected on licence terms). Truss + adapter are built and tested offline; deployment waits on an inference-provider key with deploy permissions |

## What is live today (pilot: Ari Vivas Beauty)

- **Client PWA** (installable, offline shell, Spanish UI): discovery home driven by a central module registry (`web/modulos.json`), real service catalogue, salon page with the salon's real photos and TikTok videos, and literal client reviews.
- **Booking engine**: service packs in one appointment (prices/durations summed from the real list), month calendar + slot list, real availability, confirmation with a booking code (`AS-XXXX`) and a **magic link** (`/cita/<token>`, SHA-256 hashed at rest) to view, prep, reschedule or cancel. Real `.ics` download.
- **AI brow analysis**: consent → photo → async analysis by Muse Spark → recommended service → book it, without an account. Photos are processed in memory and discarded.
- **WhatsApp channel**: Twilio sandbox webhook; replies travel in the TwiML response (the trial tier rejects free-form API sends). Hermes holds the conversation and writes to the same agenda.
- **Professional area** (`/profesional`, per-business key, 8 h session, rate-limited): Today with one-tap state changes (done / no-show / cancel), 7-day agenda with real free intervals, waitlist (`por_avisar`) with wa.me follow-up, an outbox, and the real funnel metrics.
- **Real data only**: the pilot's services are its public ones — Ombré Brows Henna €30 · Brow Lamination €45 · Brow Design €18 · Quick Waxing (ask) — Mon–Fri 10–20, Sat 10–14.

## Measured reliability (not claimed — measured)

From [`MEDICIONES.md`](MEDICIONES.md), reproducible with `agenda/mediciones.py` against the running services (localhost, 4 vCPU / 8 GiB):

| Measurement | Result |
|---|---|
| Health check (agenda API) | p50 **0.3 ms** |
| Availability query (web → API) | p50 **2.7 ms** |
| Create booking (with overlap guard) | p50 **1.3 ms** |
| Burst: 20× simultaneous availability reads | 20× 200, no errors |
| Burst: 5× simultaneous POSTs to the **same slot** | **1× 201 + 4× 409 in ~10 ms** — exactly one winner |

- **No double-booking, transactionally**: overlap check + insert in a single `BEGIN IMMEDIATE` transaction (also for reschedules).
- **Idempotent creation**: `POST /citas` accepts `Idempotency-Key` — same key + same body returns the original booking (200), same key + different body is rejected (422).
- **Cancellation guard**: a completed appointment can no longer be cancelled from any surface (409 "already done"); the guard lives in the agenda and covers web, magic link, professional area and the WhatsApp/MCP path.
- **Multi-business isolation, verified**: every record carries `negocio_id`; a second business can book the same slot, sees none of the pilot's data, and gets 404 cancelling someone else's appointment. Battery: **22/22**.
- **Test batteries, all green against the real machine**: web **32/32** · agenda guard **8/8** · booking mechanics **23/23** · multi-business **22/22** · FASHN adapter **5/5** (offline). Plus click-through QA at 412×915 on every screen (QA16–QA18).
- **Honest scale note**: this shape comfortably serves one business and, on the same box, dozens of small ones. We do **not** claim it supports millions: that would need a served database, non-pausing machines, more workers — and fresh measurements at each step (`MEDICIONES.md` lists exactly what and why).

## Module map (the registry is the product's spine)

The UI renders from `web/modulos.json`; activating a module is a configuration change, not a code change — demonstrated in QA by flipping a module's state in a test instance.

| Module | State | Notes |
|---|---|---|
| **Beauty & booking** (`belleza`) | ✅ **Active** | The pilot above: catalogue, availability, booking, AI analysis, WhatsApp |
| **Fashion try-on** (`moda_probador`) | 🔜 Coming soon | Interfaces defined; FASHN VTON truss + adapter built and dormant; no catalogue or engine until verified with real products |
| **Glasses & accessories** (`gafas_accesorios`) | 🔜 Coming soon | Research done (no serious indie API exists; the pragmatic route is reference-based editing, labelled as an approximation) |
| **Footwear** (`calzado`) | 🔜 Coming soon | Reserved in the registry; engine research pending the fashion module |

"Coming soon" screens are honest by design: they explain what is being prepared and show no fake products, prices or previews.

## Repository map

```
web/          Client PWA + professional area (stdlib Python server, port 8090)
  index.html    The whole client experience in one file
  cita.html     Magic-link appointment page
  profesional.html  Owner's area (served by web_server.py under /profesional)
  modulos.json  Central module registry — the UI renders from it
  qa*/          Click-through QA scripts (CDP, 412×915) per iteration
agenda/       Booking core (API on 8081, MCP server for Hermes, CLI)
  agenda_api.py   REST API: availability, bookings, waitlist, funnel, outbox
  agenda_comun.py Shared core: overlap guard, state machine, negocio_id scoping
  mcp_agenda.py   MCP tools the WhatsApp operator uses
  pruebas_*.py    Batteries: guard 8/8 · mechanics 23/23 · phase-2 22/22
whatsapp/     Twilio webhook → Hermes (replies via TwiML)
probador/     Try-on contracts, FASHN VTON truss + Baseten adapter (dormant)
app/          Android shell (Capacitor + a manual build) for the owner
*.md          Design/decision record: ESPEC_REFERENCIA (UX spec),
              MEDICIONES (measurements), MODELOS_TRYON (model survey),
              DIAGNOSTICO_PROBADOR, AUDITORIA_ORDEN_MAESTRA, ESTADO_PROYECTO (full log)
```

## Run it

Requirements: Python 3.11+ (stdlib only for web + agenda), a Baseten API key for Muse Spark, a Twilio sandbox for WhatsApp, Hermes Agent for the operator. Secrets live in `.env` files that are **never** in this repo (see the `.env.example` files); the agenda token is read from the environment only.

```bash
# 1 · Booking core (port 8081, localhost only)
AGENDA_API_TOKEN=<token> python3 agenda/agenda_api.py

# 2 · Client web + professional area (port 8090)
AGENDA_API_TOKEN=<token> BASETEN_API_KEY=<key> python3 web/web_server.py

# 3 · WhatsApp webhook (port 8080) — point the Twilio sandbox webhook here
python3 whatsapp/webhook.py   # replies are returned as TwiML

# Or all of it, idempotently, the way production does:
bash arrancar.instabox.sh
```

Verify any running instance with the batteries: `agenda/pruebas_api_guarda.py`, `agenda/pruebas_mecanicas.py`, `agenda/pruebas_fase2.py` (spins a throwaway instance on a copy of the DB) and `web/pruebas_web.py`.

## Privacy & honesty rules baked in

- Client photos for analysis are processed in memory and discarded; nothing is stored.
- No fake data anywhere: no invented reviews, ratings, prices or availability — and coming-soon modules show no simulated results.
- Test appointments created by the QA batteries are always left **cancelled**, never deleted; the pilot's agenda contains no live test data.

## License

MIT — © 2026 Lee Renteria (Blackleets). Built during the Meta × Cerebral Valley hackathon (27 Oct – 4 Nov 2026).

---

*Documentación y registro de decisiones en español en los `.md` de la raíz (`ESTADO_PROYECTO.md` es el diario completo del proyecto).*
