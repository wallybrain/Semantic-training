# Walpurgis — Browser Modular Synth & Sequencer

**Date:** 2026-02-20
**Location:** `wallyblanchard.com/synth.html`
**Status:** Design approved

## Overview

Walpurgis is a self-contained browser-based modular synthesizer and step sequencer, served as a static page on wallyblanchard.com. It uses FAUST DSP programs pre-compiled to WebAssembly for the audio engine, and a custom canvas-based patching UI with the site's existing CRT terminal aesthetic.

Visitors click Start, hear a pre-wired sequence immediately, and can repatch, tweak knobs, and explore. Patches can be saved to localStorage or shared via URL.

## Architecture

### Technology

- **DSP:** FAUST `.dsp` source files, pre-compiled to WASM + JS wrappers via `faust2wasm`
- **Audio runtime:** Web Audio API AudioWorklet loads WASM modules
- **UI:** Vanilla JS + HTML5 Canvas for the patching interface
- **Styling:** CSS matching existing CRT terminal aesthetic (VT323, Courier Prime, scanlines)
- **No framework, no bundler, no backend**

### File Structure

```
/home/lwb3/Semantic-training/
├── synth.html                  # The page
├── synth/
│   ├── modules/                # Pre-compiled FAUST -> WASM outputs
│   │   ├── vco.wasm + vco.js
│   │   ├── noise.wasm + noise.js
│   │   ├── vcf.wasm + vcf.js
│   │   ├── vca.wasm + vca.js
│   │   ├── env.wasm + env.js
│   │   ├── lfo.wasm + lfo.js
│   │   ├── seq.wasm + seq.js
│   │   ├── clk.wasm + clk.js
│   │   ├── dly.wasm + dly.js
│   │   ├── rev.wasm + rev.js
│   │   ├── mix.wasm + mix.js
│   │   └── out.wasm + out.js
│   ├── engine.js               # Audio engine: loads WASM, manages routing
│   ├── patcher.js              # Canvas patching UI: modules, cables, interaction
│   ├── state.js                # Save/load: localStorage + URL hash
│   └── faust/                  # Source .dsp files (for future editing/recompilation)
│       ├── vco.dsp
│       ├── noise.dsp
│       ├── vcf.dsp
│       ├── vca.dsp
│       ├── env.dsp
│       ├── lfo.dsp
│       ├── seq.dsp
│       ├── clk.dsp
│       ├── dly.dsp
│       ├── rev.dsp
│       ├── mix.dsp
│       └── out.dsp
```

### Build Pipeline

1. Write/edit FAUST `.dsp` files in `synth/faust/`
2. Compile each with `faust2wasm` (produces `.wasm` + `.js` wrapper per module)
3. Place compiled outputs in `synth/modules/`
4. `synth.html` loads modules at runtime via AudioWorklet

Build is a one-time step (or whenever a module DSP changes). The served page is fully static.

## Modules

### Signal Types

- **Audio** (green jacks) — sample-rate signals
- **Control** (cyan jacks) — parameter modulation (pitch CV, gate, envelope, LFO)

### Module Specifications

| Module | Inputs | Outputs | Controls |
|--------|--------|---------|----------|
| **VCO** | FM (audio), pitch CV (ctrl) | audio out | waveform (saw/sq/sin/tri), coarse pitch, fine tune, FM depth |
| **NOISE** | — | audio out | color (white-pink blend) |
| **VCF** | audio in, cutoff CV (ctrl) | audio out | cutoff, resonance, mode (LP/HP/BP), CV depth |
| **VCA** | audio in, CV in (ctrl) | audio out | gain, CV depth |
| **ENV** | gate in (ctrl) | CV out | attack, decay, sustain, release |
| **LFO** | — | CV out | rate, waveform (sin/sq/saw/tri), depth |
| **SEQ** | clock in (ctrl) | pitch CV out, gate out | 8 step knobs (pitch), 8 step toggles (gate on/off), step count |
| **CLK** | — | clock out | BPM (20-300), swing |
| **DLY** | audio in, time CV (ctrl) | audio out | time, feedback, mix (dry/wet) |
| **REV** | audio in | audio out | size, damping, mix (dry/wet) |
| **MIX** | 4x audio in | audio out | 4x level knobs, master level |
| **OUT** | audio in L, audio in R | — | master volume, scope visualization |

### Default Patch (Pre-Wired on Load)

```
CLK clock out -> SEQ clock in
SEQ pitch CV  -> VCO pitch CV
SEQ gate      -> ENV gate in
VCO audio out -> VCF audio in
VCF audio out -> VCA audio in
ENV CV out    -> VCA CV in
VCA audio out -> OUT audio in L
VCA audio out -> OUT audio in R
```

Visitor hears a filtered synth sequence immediately on clicking Start.

## Visual Design

### CRT Terminal Aesthetic

Consistent with wallyblanchard.com's existing design language:

- **Background:** `#0e0a1e` (deep dark purple)
- **Module background:** `#06060f` (near-black)
- **Primary color:** `#66d9a0` (muted teal-green) for audio signals, knob arcs, text
- **Accent color:** `#00ccff` (cyan) for control signals
- **Fonts:** VT323 (module labels, readouts), Courier Prime (descriptions)
- **Effects:** Scanline overlay, grain texture, subtle glow on active elements

### Module Appearance

Each module is a **terminal window:**
- Dark background with green border
- Header bar with fake traffic-light buttons (hollow squares) and module name (`> VCO`)
- Input jacks on left edge, output jacks on right edge
- Jacks are small circles: green border = audio, cyan border = control
- Knobs are circular canvas-drawn arcs with VT323 value readout
- Toggles (SEQ gate steps) are small squares, filled green when active

### Patch Cables

- Bezier curves between connected jacks
- Green glow for audio, cyan glow for control
- Slight gravity droop (control points below midpoint)
- Brighten on hover
- Small `x` appears on hover to disconnect

### SEQ Module

Wider than other modules. 8 columns of pitch knob + gate toggle. A bright green playhead bar sweeps across the active step.

### OUT Module

Includes a live oscilloscope — green waveform trace on dark background, phosphor-glow style.

### Workspace

- Full-viewport canvas, pannable by dragging empty space
- Subtle grid dots for spatial reference
- Scanline overlay on top (pointer-events: none)

### Top Bar (Fixed)

```
[WALPURGIS] ................. [START/STOP] [BPM: 120] [SAVE] [LOAD] [SHARE] ... STATUS: STANDBY ... [home]
```

- `WALPURGIS` in VT323, glowing green
- Start/Stop toggles audio context
- BPM display reads from CLK module
- Save/Load/Share buttons for state management
- Status indicator: `SIGNAL CHAIN ACTIVE` / `STANDBY`
- `[home]` nav link back to index

### Bottom Status Bar

```
SYSTEM ONLINE | MODULES: 12 | SAMPLE RATE: 48000 | 2026-02-20 14:32:01 UTC
```

Same style as other pages on the site.

## Interaction

### Patching

- Click output jack -> cable follows cursor -> click input jack to connect
- Right-click cable or click `x` on hover to disconnect
- Multiple cables can leave one output (fan-out)
- Each input accepts one cable (last-connected wins, previous cable removed)

### Knobs

- Click and drag vertically (up = increase, down = decrease)
- Green arc shows current value, VT323 number readout below
- Double-click to reset to default value

### Module Dragging

- Drag by header bar to reposition
- Cables stay attached and re-route in real time

### Keyboard Shortcuts

- `Space` — start/stop audio
- `R` — reset to default patch (with confirmation)
- `Esc` — cancel in-progress cable drag

## Save / Load

### localStorage (Personal Saves)

- Save button opens a terminal-styled input for patch name
- Patches stored in `localStorage` under key `walpurgis_patches`
- Load button shows a list of saved patches to recall
- Delete option per saved patch

### URL Hash (Sharing)

- Share button serializes current state to compact JSON, base64-encodes it, sets `window.location.hash`
- Copies the URL to clipboard with a brief `COPIED` flash
- On page load, if a hash is present, decode and restore the patch

### State Shape

```json
{
  "modules": {
    "vco": { "x": 200, "y": 100, "params": { "waveform": 0, "coarse": 48, "fine": 0, "fmDepth": 0 } },
    ...
  },
  "cables": [
    { "from": "clk.clock", "to": "seq.clock" },
    { "from": "seq.pitch", "to": "vco.pitchCv" },
    ...
  ]
}
```

Compact enough to fit in a URL hash for 12 modules.

## Extensibility

The architecture supports adding new modules later:
1. Write a new `.dsp` file
2. Compile to WASM
3. Register the module in `engine.js` (define inputs, outputs, parameters)
4. It appears in the workspace

No changes to the patching UI, cable system, or save/load needed. The module registry is data-driven.

## Non-Goals (v1)

- No module add/remove UI (all 12 always present)
- No MIDI support
- No audio recording/export
- No preset library beyond user saves
- No mobile optimization (canvas patching needs mouse precision)
- No live FAUST recompilation in browser (pre-compiled only)

## Navigation Integration

Add `[synth]` to the nav links on `index.html` alongside `[home]`, `[listen]`, `[fnord]`, `[library]`. Same style as existing nav links.
