# Dasein — Design Document

> Philosophical text navigation through AI translation, not simplification

**Date:** 2026-03-01
**Status:** Approved
**Location:** `wallyblanchard.com/dasein`

## What Dasein Is

A web-based terminal interface for navigating complex philosophical texts through conversation with a specialized Claude subagent. The AI finds paths through full complexity tailored to the individual user — it translates, it does not simplify.

First source text: Baudrillard's *Simulacra and Simulation*.

Architecture is pluggable — future source texts (Principia Mathematica, etc.) slot in as new content directories.

## Core Principles

- **Translation not simplification** — preserve necessary complexity, find individual paths through it
- **Emergent topology** — no predetermined structure. The AI builds a map of the user's understanding in real-time. The user sees where they've been (retrospective trail), not where they're going
- **Three-gear voice** — Socratic (default: questions that pull deeper), Companion (bridge when stuck), Adversarial (challenge when coasting). Shifts organically, never announced
- **Claude is the engine** — no hand-authored concept graphs or state machines. The system prompt instructs Claude to maintain its own topology, track depth, and shift gears. The backend just shuttles data
- **Stalling is signal** — drawn from Semantic Training philosophy: confusion precedes insight, chaos before crystallization

## Architecture

```
Browser (dasein.html)              dasein-api (127.0.0.1:8803)
┌──────────────────────┐           ┌──────────────────────────┐
│ Terminal UI           │  fetch   │ FastAPI server (~100 LOC) │
│ • Conversation pane   │ ──────> │ • POST /api/converse      │
│ • Input line          │ <────── │ • POST /api/session/save   │
│ • Trail display       │ stream  │ • POST /api/session/restore│
│ • Glitch transitions  │         │ • GET  /api/health         │
│                       │         │                            │
│ localStorage:         │         │ Prompt assembly:           │
│ • conversation[]      │         │ • system.md (persona)      │
│ • AI state {}         │         │ • bridge-quotes.json       │
│ • sessionCode         │         │ • chapter text (selected)  │
└──────────────────────┘         │ • AI state (pass-through)  │
                                  │                            │
                                  │ texts/baudrillard/         │
                                  │ • chapters/*.md            │
                                  │ • persona.md               │
                                  │                            │
                                  │        Claude API ─────>   │
                                  └──────────────────────────┘
```

**Frontend**: Static HTML in Semantic-training repo. No build step, no frameworks. VT323 terminal aesthetic, green-on-black, consistent with wallyblanchard.com.

**Backend**: Separate repo at `/home/lwb3/dasein-api/`. Docker container behind Caddy. Holds API key, source texts, system prompt. Stateless per-request (state lives in localStorage, passed by the frontend on each call).

**Split rationale**: The frontend is a dumb terminal. The backend holds the curated intellectual content (book text, prompt philosophy, bridge quotes). They evolve independently. Adding a new source text means adding files to the backend, not touching the HTML.

## System Prompt (Four Layers)

### Layer 1: Core Persona

Three-gear voice (Socratic/Companion/Adversarial) with instructions for when to shift. Never announces gear. Never simplifies — translates.

### Layer 2: Semantic Training Philosophy

Drawn from the existing Semantic Training framework:
- Five epistemological domains (Scientific, Philosophical, Psychological, Mathematical, Linguistic)
- Korzybski's map/territory as foundational epistemology
- Deleuze's difference-in-repetition as organizing principle
- Stalling-as-adaptation, chaos-before-crystallization
- Bridge quotes curated from fnord.js transmissions (Zizek, Deleuze, Burroughs, Wilson, etc.)

### Layer 3: State Tracking

Claude outputs a hidden JSON state block after each response:

```json
{
  "concepts_engaged": ["simulacrum", "hyperreality"],
  "depth": { "simulacrum": 2, "hyperreality": 1 },
  "connections_made": [["simulacrum", "hyperreality"]],
  "current_gear": "socratic",
  "trail_display": "simulacrum → desert of the real → hyperreality",
  "chapters_needed": ["01-precession", "03-history"]
}
```

Backend strips this from the visible response, stores it, passes it back next turn. Claude maintains its own topology — no external engine.

### Layer 4: Source Text

Relevant chapter(s) of Simulacra and Simulation, selected based on the previous turn's `chapters_needed`. First turn gets chapter 1.

## Frontend Details

- **Conversation pane**: Scrolling dialogue, streaming token display
- **Input line**: Free text, enter to send, arrow keys for command history
- **Trail line**: Text-only retrospective of concepts visited (from AI state)
- **Header**: "DASEIN" + session code
- **Glitch transition**: Reuse fnord.js glitch animation — characters resolve from noise into the AI's response. Chaos before crystallization, made visual.
- **Fonts**: VT323 (already self-hosted)

## Deployment

| Component | Detail |
|-----------|--------|
| Port | `127.0.0.1:8803` |
| Network | `webproxy` (Caddy access) |
| Caddy route | `wallyblanchard.com/dasein` → static, `/dasein/api` → proxy 8803 |
| Container | Python + FastAPI, `restart: unless-stopped` |
| Health | `curl -f http://localhost:8803/api/health` |
| Resources | 256MB RAM, 0.5 CPU |
| Security | Read-only filesystem, tmpfs for /tmp, sessions/ as volume |
| Backup | Sessions directory added to nightly backup script |
| Secrets | `ANTHROPIC_API_KEY` in `.env` (never committed) |

## Existing Work That Feeds In

| Source | Contribution |
|--------|-------------|
| `js/fnord.js` (219 transmissions) | Bridge quotes — adjacent thinkers for conceptual connections |
| `README.md` (Semantic Training) | Pedagogical philosophy — five domains, stalling detection, zoom controls |
| `zork.html` UI patterns | Terminal conversation UX — input, scrolling output, status bar |
| Initialization prompt (README) | System prompt bones — immersion rules, behavioral tracking, gear logic |

## Deferred (v2+)

- Visual node graph (Canvas/SVG concept map)
- Session codes (v1 uses localStorage only)
- Additional source texts (Principia Mathematica, etc.)
- Subagent platform abstraction

## Key Design Decision

**Claude is the engine, not scaffolding around Claude.** No hand-authored concept graphs, no state machines, no retrieval scoring. The system prompt instructs Claude how to behave, what to track, and when to shift gears. The backend is a stateful proxy with curated content. This means:
- Ships in days, not weeks
- Gets smarter with every model improvement
- Intellectual effort goes into prompt + content curation, not code
- The fnord transmissions and Semantic Training philosophy become the soul of Dasein, not the engine. The engine is Claude.
