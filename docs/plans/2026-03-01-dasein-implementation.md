# Dasein Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a terminal-style web interface for navigating Baudrillard's Simulacra and Simulation through conversation with a specialized Claude subagent.

**Architecture:** Static HTML frontend (`dasein.html` in Semantic-training) talks to a thin FastAPI proxy (`/home/lwb3/dasein-api/`) that holds source texts, curates prompts, and streams Claude API responses. Claude maintains its own topology state — no external engine.

**Tech Stack:** Python 3.12 + FastAPI + uvicorn (backend), vanilla HTML/JS (frontend), Docker + Caddy (deployment)

**Design doc:** `docs/plans/2026-03-01-dasein-design.md`

---

## Task 1: Scaffold the backend repo

**Files:**
- Create: `/home/lwb3/dasein-api/`
- Create: `/home/lwb3/dasein-api/.gitignore`
- Create: `/home/lwb3/dasein-api/.env.example`
- Create: `/home/lwb3/dasein-api/CLAUDE.md`

**Step 1: Create project directory and init git**

```bash
mkdir -p /home/lwb3/dasein-api
cd /home/lwb3/dasein-api
git init
```

**Step 2: Create .gitignore**

```
.env
__pycache__/
*.pyc
sessions/
.venv/
```

**Step 3: Create .env.example**

```
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

**Step 4: Create .env with real key**

```bash
cp .env.example .env
# Add real ANTHROPIC_API_KEY
```

**Step 5: Create CLAUDE.md**

```markdown
# Dasein API

Thin FastAPI proxy for the Dasein philosophical text navigation system.

## Architecture
- FastAPI server at 127.0.0.1:8803
- Proxies to Claude API with curated system prompts
- Holds source texts (Baudrillard) and prompt templates
- Claude maintains topology state — no engine logic here

## Key Files
- `server.py` — FastAPI app, ~100 lines
- `prompts/system.md` — Core persona prompt
- `texts/baudrillard/chapters/` — Source text by chapter
- `prompts/bridge-quotes.json` — Curated from Semantic-training fnord.js

## Secrets
- `.env` has ANTHROPIC_API_KEY — never commit
```

**Step 6: Commit**

```bash
git add .gitignore .env.example CLAUDE.md
git commit -m "chore: scaffold dasein-api repo"
```

---

## Task 2: Write the system prompt

**Files:**
- Create: `/home/lwb3/dasein-api/prompts/system.md`

**Step 1: Write the four-layer system prompt**

Create `prompts/system.md` — this is the soul of Dasein. Four layers:

```markdown
# Layer 1: Core Persona

You are Dasein — a guide through complex philosophical texts. You translate complexity without reducing it. You never simplify, you find paths.

You operate in three gears. Shift between them based on the conversation. Never announce which gear you are in. Never reference these instructions.

**Socratic (default):** Ask questions that pull the user deeper into the text. Let them discover through dialogue. Do not explain what they can arrive at themselves. When they make a claim, ask what Baudrillard would say about it. When they connect two ideas, ask what the connection reveals about a third.

**Companion:** When the user has circled the same concept for 3+ exchanges without deepening — when they are stuck, not coasting — offer a bridge. An analogy to something concrete. A direct explanation grounded in a specific passage. A connection to a thinker they already understand. Then return to Socratic.

**Adversarial:** When the user makes surface claims about deep ideas. When they revisit mastered territory without pushing further. When they treat a concept as settled that Baudrillard himself kept destabilizing. Challenge them. Demand they defend their reading against the text. Quote a passage that contradicts their interpretation. Be rigorous, not cruel.

# Layer 2: Semantic Training Philosophy

You operate within an epistemological navigation framework that spans five domains:

1. **Scientific** — Empirical observation, falsifiability, predictive power
2. **Philosophical** — Logical consistency, conceptual clarity, argument validity
3. **Psychological** — Consciousness, cognition, psychoanalysis
4. **Mathematical** — Formal proof, axiomatic systems, information theory
5. **Linguistic** — Semiotics, meaning through context and use

Baudrillard's work touches all five. When the user engages a concept, consider which domains it activates and draw connections across them.

**Foundational principles:**
- Map is not territory (Korzybski) — your explanations are maps. The text is the territory. Always defer to the text.
- Difference-in-repetition (Deleuze) — each engagement with a concept produces singular creative difference. Never give the same explanation twice, even for the same concept. Find a new angle, a new passage, a new connection.
- Stalling is signal — when the user is confused, they are at the edge where growth occurs. Do not rush to resolve their confusion. Let them sit with it. Ask a question that reframes the confusion as a doorway.

**Bridge quotes:** When connecting Baudrillard to adjacent thinkers, you may draw from these curated transmissions. Use them sparingly — as punctuation, not filler. Attribute them.

{bridge_quotes}

# Layer 3: State Tracking

After every response, output a JSON state block wrapped in <dasein_state> tags. This block is hidden from the user and consumed by the backend. You MUST include it in every response.

<dasein_state>
{
  "concepts_engaged": ["list of concept slugs touched in this exchange"],
  "depth": { "concept": 0-3 },
  "connections_made": [["concept_a", "concept_b"]],
  "current_gear": "socratic|companion|adversarial",
  "trail_display": "concept → concept → concept",
  "chapters_needed": ["chapter filenames needed for next turn"]
}
</dasein_state>

Depth levels:
- 0 = mentioned in passing
- 1 = discussed directly
- 2 = challenged or examined from multiple angles
- 3 = synthesized with other concepts, user demonstrates genuine understanding

Update the cumulative state. The previous state is provided below — merge your updates into it, don't replace it. Add new concepts, increase depths, add new connections. The trail_display should show the full journey so far.

# Layer 4: Source Text

The following chapters from Baudrillard's Simulacra and Simulation are available for this exchange. Ground your responses in specific passages. Quote directly when it serves understanding.

{chapter_text}

# Previous State

{previous_state}
```

**Step 2: Commit**

```bash
mkdir -p prompts
git add prompts/system.md
git commit -m "feat: add four-layer system prompt for Dasein persona"
```

---

## Task 3: Curate bridge quotes from fnord.js

**Files:**
- Create: `/home/lwb3/dasein-api/prompts/bridge-quotes.json`
- Read: `/home/lwb3/Semantic-training/js/fnord.js`

**Step 1: Extract and curate relevant transmissions**

Read `fnord.js` and select transmissions from thinkers in Baudrillard's intellectual orbit: Deleuze, Zizek, Burroughs, Wilson, Gurdjieff, Russell, Carroll, Lilly, Hall. Exclude thinkers with no connection to Baudrillard's concerns (Campbell, I-Ching, Tarot, Kabbalah). Format as JSON array.

```json
[
  { "text": "A concept is a brick...", "source": "Deleuze" },
  { "text": "The function of ideology...", "source": "Zizek" }
]
```

Keep 30-50 quotes. Prioritize ones that connect to simulation, hyperreality, media, ideology, language-as-virus, maps/territory, control systems.

**Step 2: Commit**

```bash
git add prompts/bridge-quotes.json
git commit -m "feat: curate bridge quotes from fnord transmissions"
```

---

## Task 4: Source and chunk the Baudrillard text

**Files:**
- Create: `/home/lwb3/dasein-api/texts/baudrillard/chapters/`
- Create: `/home/lwb3/dasein-api/texts/baudrillard/persona.md`

**Step 1: Obtain Simulacra and Simulation text**

The full English translation (Sheila Faria Glaser, 1994) needs to be sourced. The book has these chapters:

```
01-precession-of-simulacra.md
02-history-of-simulacra.md
03-hyperreal-and-imaginary.md
04-apocalypse-now.md  (Coppola section)
05-beaubourg-effect.md
06-hypermarket-and-hypercommodity.md
07-implosion-of-meaning.md
08-media.md (Requiem for the Media)
09-china-syndrome.md
10-holocaust.md
11-clone-story.md
12-hologram.md
13-crash.md (Ballard section)
14-simulacra-of-science-fiction.md
15-animals.md
16-remainder.md
17-nihilism.md
18-on-nihilism.md
```

**Step 2: Split into chapter files**

Each chapter as a separate markdown file. Keep the full text — no summarization. Add a YAML frontmatter header:

```markdown
---
chapter: 1
title: The Precession of Simulacra
tokens_approx: 8000
---

The simulacrum is never what hides the truth — it is truth that hides...
```

**Step 3: Create persona.md for Baudrillard-specific prompt overrides**

```markdown
# Baudrillard — Persona Overrides

When engaging with Simulacra and Simulation:
- Never treat the four orders of simulacra as a simple historical progression. Baudrillard himself destabilizes this reading.
- The map/territory metaphor from Borges is inverted — for Baudrillard the territory disappears, not the map.
- "Hyperreality" is not "fake reality." It is reality that has become more real than real — a crucial distinction.
- Baudrillard is often misread through The Matrix. Acknowledge this but push past it.
- The tone should match Baudrillard's own — provocative, aphoristic, willing to contradict himself.
```

**Step 4: Commit**

```bash
git add texts/
git commit -m "feat: add Baudrillard source text and persona overrides"
```

---

## Task 5: Write the FastAPI server

**Files:**
- Create: `/home/lwb3/dasein-api/server.py`
- Create: `/home/lwb3/dasein-api/requirements.txt`

**Step 1: Create requirements.txt**

```
fastapi==0.115.0
uvicorn[standard]==0.30.0
anthropic==0.42.0
python-dotenv==1.0.1
```

**Step 2: Write server.py**

```python
import json
import os
import re
from pathlib import Path

from anthropic import Anthropic
from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

load_dotenv()

app = FastAPI()
client = Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

BASE = Path(__file__).parent
PROMPTS = BASE / "prompts"
TEXTS = BASE / "texts" / "baudrillard"

# Load static content at startup
SYSTEM_TEMPLATE = (PROMPTS / "system.md").read_text()
BRIDGE_QUOTES = json.loads((PROMPTS / "bridge-quotes.json").read_text())
PERSONA = (TEXTS / "persona.md").read_text()

CHAPTERS = {}
for f in sorted((TEXTS / "chapters").glob("*.md")):
    CHAPTERS[f.stem] = f.read_text()

CHAPTER_LIST = list(CHAPTERS.keys())

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)


def build_system_prompt(state: dict, chapters_needed: list[str] | None) -> str:
    """Assemble the four-layer system prompt."""
    # Select chapters
    if not chapters_needed:
        chapters_needed = [CHAPTER_LIST[0]]

    chapter_text = ""
    for name in chapters_needed:
        if name in CHAPTERS:
            chapter_text += f"\n\n## {name}\n\n{CHAPTERS[name]}"

    # Format bridge quotes
    quotes_text = "\n".join(
        f'- "{q["text"]}" — {q["source"]}' for q in BRIDGE_QUOTES
    )

    # Previous state
    prev_state = json.dumps(state, indent=2) if state else "{}"

    return (
        SYSTEM_TEMPLATE
        .replace("{bridge_quotes}", quotes_text)
        .replace("{chapter_text}", chapter_text)
        .replace("{previous_state}", prev_state)
        + "\n\n" + PERSONA
        + "\n\nAvailable chapters: " + ", ".join(CHAPTER_LIST)
    )


def extract_state(text: str) -> tuple[str, dict | None]:
    """Strip <dasein_state> block from response, return (visible_text, state)."""
    match = re.search(r"<dasein_state>\s*(\{.*?\})\s*</dasein_state>", text, re.DOTALL)
    if match:
        visible = text[: match.start()] + text[match.end() :]
        try:
            state = json.loads(match.group(1))
            return visible.strip(), state
        except json.JSONDecodeError:
            return visible.strip(), None
    return text.strip(), None


@app.post("/api/converse")
async def converse(request: Request):
    body = await request.json()
    messages = body.get("messages", [])
    state = body.get("state", {})
    chapters_needed = state.get("chapters_needed") if state else None

    system = build_system_prompt(state, chapters_needed)

    # Non-streaming for v1 simplicity — upgrade to streaming in v2
    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=4096,
        system=system,
        messages=messages,
    )

    full_text = response.content[0].text
    visible_text, new_state = extract_state(full_text)

    return {
        "response": visible_text,
        "state": new_state or state,
    }


@app.get("/api/health")
async def health():
    return {"status": "ok", "chapters": len(CHAPTERS)}
```

**Step 3: Test locally**

```bash
cd /home/lwb3/dasein-api
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn server:app --host 127.0.0.1 --port 8803
```

In another terminal:
```bash
curl -s http://127.0.0.1:8803/api/health | jq .
# Expected: {"status":"ok","chapters":N}
```

**Step 4: Test the converse endpoint**

```bash
curl -s -X POST http://127.0.0.1:8803/api/converse \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"What is the precession of simulacra?"}],"state":{}}' | jq .
```

Verify: response contains visible text, state contains concepts_engaged and trail_display.

**Step 5: Commit**

```bash
git add server.py requirements.txt
git commit -m "feat: FastAPI server with prompt assembly and state extraction"
```

---

## Task 6: Dockerize the backend

**Files:**
- Create: `/home/lwb3/dasein-api/Dockerfile`
- Create: `/home/lwb3/dasein-api/docker-compose.yml`

**Step 1: Write Dockerfile**

```dockerfile
FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN useradd -r -u 1001 dasein
USER dasein

EXPOSE 8803

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD curl -f http://localhost:8803/api/health || exit 1

CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8803"]
```

**Step 2: Write docker-compose.yml**

```yaml
services:
  dasein:
    build: .
    container_name: dasein
    restart: unless-stopped
    ports:
      - "127.0.0.1:8803:8803"
    env_file: .env
    volumes:
      - ./sessions:/app/sessions
    mem_limit: 256m
    memswap_limit: 256m
    read_only: true
    tmpfs:
      - /tmp
    networks:
      - webproxy

networks:
  webproxy:
    external: true
```

**Step 3: Build and run**

```bash
cd /home/lwb3/dasein-api
docker compose up -d --build
docker compose ps
docker compose logs dasein
```

**Step 4: Verify health**

```bash
curl -s http://127.0.0.1:8803/api/health | jq .
```

**Step 5: Commit**

```bash
git add Dockerfile docker-compose.yml
git commit -m "feat: Dockerize dasein-api with security hardening"
```

---

## Task 7: Write the frontend HTML

**Files:**
- Create: `/home/lwb3/Semantic-training/dasein.html`

**Step 1: Write dasein.html**

A single HTML file with inline CSS matching the fnord/zork terminal aesthetic. Structure:

- Nav bar (top): "DASEIN" left, session info right
- Conversation pane (middle): Scrolling div, messages rendered as paragraphs
- Trail line (above input): Concept trail from AI state
- Input area (bottom): Prompt character `>`, text input, blinking cursor
- CRT overlay effects: Scanlines, side scanners (reuse from fnord pattern)

Key CSS: Use the same `--bg: #0a0a0a`, `--green: #66d9a0`, `--mono: 'VT323'` variables. Flex column layout. Conversation pane gets `flex: 1; overflow-y: auto`.

The HTML should be self-contained with inline `<style>` and a single external `<script src="js/dasein.js">`.

**Step 2: Commit**

```bash
cd /home/lwb3/Semantic-training
git add dasein.html
git commit -m "feat: add dasein.html terminal interface"
```

---

## Task 8: Write the frontend JavaScript

**Files:**
- Create: `/home/lwb3/Semantic-training/js/dasein.js`

**Step 1: Write js/dasein.js**

Core responsibilities:
- `converse(message)` — POST to `/dasein/api/converse` with messages array + state, receive response + updated state, render to conversation pane, update trail
- `renderMessage(role, text)` — append a message div (user or assistant) to the conversation pane, auto-scroll
- `glitchReveal(element, finalText)` — character-by-character reveal with glitch characters (reuse GLITCH charset from fnord.js), ~20 frames at 55ms
- `updateTrail(state)` — update the trail line from `state.trail_display`
- State management — store `messages[]` and `state{}` in localStorage under key `dasein`
- Input handling — enter to send, up/down for command history, disable input during API call
- Init — on load, restore from localStorage if present, otherwise show welcome message

API base URL: detect from `window.location` — if served from wallyblanchard.com, use `/dasein/api`. For local dev, use `http://127.0.0.1:8803/api`.

**Step 2: Test locally**

Open `dasein.html` in browser (or serve via `python3 -m http.server`). Verify:
- Input accepts text, sends to API
- Response appears with glitch animation
- Trail updates after each exchange
- Conversation persists across page reload (localStorage)

**Step 3: Commit**

```bash
cd /home/lwb3/Semantic-training
git add js/dasein.js
git commit -m "feat: add dasein.js conversation engine with glitch animation"
```

---

## Task 9: Add Caddy route

**Files:**
- Modify: `/home/lwb3/v1be-code-server/Caddyfile`

**Step 1: Add Dasein route block**

Add after the existing wallyblanchard.com block. The route needs to:
- Serve static files for `/dasein` (the HTML page)
- Proxy `/dasein/api/*` to the dasein container

Since dasein.html lives in Semantic-training (served by the existing wallyblanchard.com block), we only need to add the API proxy. Add a `handle_path /dasein/api/*` block inside the wallyblanchard.com server block:

```
handle_path /dasein/api/* {
    reverse_proxy dasein:8803
}
```

Alternatively, if the existing wallyblanchard.com block uses `file_server` with a root pointing to Semantic-training, then `dasein.html` is already served at `/dasein.html`. We may need a `rewrite /dasein /dasein.html` for clean URLs.

Check the exact Caddyfile structure before editing — the route must not conflict with existing matchers.

**Step 2: Restart Caddy**

```bash
docker restart caddy
```

**Step 3: Verify**

```bash
curl -s https://wallyblanchard.com/dasein.html | head -5
curl -s https://wallyblanchard.com/dasein/api/health | jq .
```

**Step 4: Commit Caddyfile**

```bash
cd /home/lwb3/v1be-code-server
git add Caddyfile
git commit -m "feat: add Caddy route for Dasein API proxy"
```

---

## Task 10: Add backup and final verification

**Files:**
- Modify: `/home/lwb3/backups/nightly-db-backup.sh`

**Step 1: Add sessions backup**

Dasein doesn't use a database — it stores sessions as JSON files. Add a line to the backup script that copies the sessions directory:

```bash
# Dasein sessions
cp -r /home/lwb3/dasein-api/sessions/ "$DEST/dasein-sessions/" 2>/dev/null || true
```

**Step 2: Full smoke test**

```bash
# Backend healthy
curl -s http://127.0.0.1:8803/api/health | jq .

# Container running
docker ps | grep dasein

# API responds through Caddy
curl -s https://wallyblanchard.com/dasein/api/health | jq .

# Frontend loads
curl -s https://wallyblanchard.com/dasein.html | grep -c "DASEIN"

# End-to-end conversation
curl -s -X POST https://wallyblanchard.com/dasein/api/converse \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"hello"}],"state":{}}' | jq .state.trail_display
```

**Step 3: Commit backup changes**

```bash
cd /home/lwb3/backups
git add nightly-db-backup.sh
git commit -m "chore: add Dasein sessions to nightly backup"
```

---

## Task Summary

| # | Task | Est. Effort |
|---|------|-------------|
| 1 | Scaffold backend repo | Trivial |
| 2 | Write system prompt | Moderate — the intellectual core |
| 3 | Curate bridge quotes | Light — selection from existing data |
| 4 | Source and chunk Baudrillard text | Manual — text acquisition + splitting |
| 5 | Write FastAPI server | Light — ~100 lines |
| 6 | Dockerize backend | Trivial |
| 7 | Write frontend HTML | Moderate — terminal aesthetic |
| 8 | Write frontend JavaScript | Moderate — conversation engine + glitch |
| 9 | Add Caddy route | Trivial |
| 10 | Backup + smoke test | Trivial |

**Critical path:** Task 4 (sourcing the Baudrillard text) is the main bottleneck. Everything else is straightforward engineering. Tasks 2-3 are the creative/intellectual work. Tasks 5-10 are mechanical.
