// Walpurgis Patcher — Canvas patching UI
var WalpurgisPatcher = (function() {
    'use strict';

    var canvas, ctxC; // canvas 2d context (ctxC to avoid collision with audio ctx)
    var W, H;
    var panX = 0, panY = 0;

    // Colors
    var C = {
        bg:         '#0e0a1e',
        moduleBg:   '#06060f',
        border:     '#337755',
        borderHi:   '#66d9a0',
        primary:    '#66d9a0',
        primaryDim: '#4daa7a',
        primaryDark:'#337755',
        accent:     '#00ccff',
        accentDim:  '#0099bb',
        text:       '#66d9a0',
        textDim:    '#4daa7a',
        headerBg:   '#1a3328',
        grid:       'rgba(102, 217, 160, 0.06)',
        knobBg:     '#111318',
        knobArc:    '#66d9a0',
        knobArcDim: '#337755',
        seqActive:  '#66d9a0',
        seqInactive:'#1a2a22'
    };

    // Layout constants
    var MOD_W = 160;         // Standard module width
    var MOD_SEQ_W = 320;     // SEQ is wider
    var MOD_HEADER_H = 24;
    var JACK_R = 7;
    var JACK_SPACING = 28;
    var JACK_MARGIN_TOP = 12;
    var KNOB_R = 16;
    var KNOB_SPACING_X = 44;
    var KNOB_SPACING_Y = 54;
    var KNOB_MARGIN_TOP = 8;

    // Module layout registry
    var moduleLayout = {};

    // Default module positions (2 rows)
    var DEFAULT_POSITIONS = {
        clk:   { x: 40,  y: 40 },
        seq:   { x: 220, y: 40 },
        vco:   { x: 560, y: 40 },
        noise: { x: 740, y: 40 },
        vcf:   { x: 920, y: 40 },
        lfo:   { x: 40,  y: 300 },
        env:   { x: 220, y: 300 },
        vca:   { x: 400, y: 300 },
        dly:   { x: 580, y: 300 },
        rev:   { x: 760, y: 300 },
        mix:   { x: 940, y: 300 },
        out:   { x: 1120, y: 300 }
    };

    // Module definitions for rendering
    var MODULE_RENDER = {
        vco:   { label: 'VCO', inputs: [], outputs: [{id:'out',label:'OUT',type:'audio'}],
                 knobs: [{id:'waveform',label:'WAVE',min:0,max:3,step:1,def:0},{id:'coarse',label:'PITCH',min:24,max:72,step:1,def:48},{id:'fine',label:'FINE',min:-50,max:50,step:1,def:0}] },
        noise: { label: 'NOISE', inputs: [], outputs: [{id:'out',label:'OUT',type:'audio'}],
                 knobs: [{id:'color',label:'COLOR',min:0,max:1,step:0.01,def:0.5}] },
        vcf:   { label: 'VCF', inputs: [{id:'in',label:'IN',type:'audio'},{id:'cutoffCv',label:'CV',type:'ctrl'}], outputs: [{id:'out',label:'OUT',type:'audio'}],
                 knobs: [{id:'cutoff',label:'CUTOFF',min:20,max:20000,step:1,def:1000,log:true},{id:'resonance',label:'RES',min:0,max:0.99,step:0.01,def:0.5},{id:'cvDepth',label:'CV',min:0,max:1,step:0.01,def:0.5}] },
        vca:   { label: 'VCA', inputs: [{id:'in',label:'IN',type:'audio'},{id:'cv',label:'CV',type:'ctrl'}], outputs: [{id:'out',label:'OUT',type:'audio'}],
                 knobs: [{id:'gain',label:'GAIN',min:0,max:1,step:0.01,def:0.8},{id:'cvDepth',label:'CV',min:0,max:1,step:0.01,def:1}] },
        env:   { label: 'ENV', inputs: [{id:'gate',label:'GATE',type:'ctrl'}], outputs: [{id:'out',label:'OUT',type:'ctrl'}],
                 knobs: [{id:'attack',label:'A',min:0.001,max:2,step:0.001,def:0.01},{id:'decay',label:'D',min:0.001,max:2,step:0.001,def:0.2},{id:'sustain',label:'S',min:0,max:1,step:0.01,def:0.6},{id:'release',label:'R',min:0.001,max:4,step:0.001,def:0.3}] },
        lfo:   { label: 'LFO', inputs: [], outputs: [{id:'out',label:'OUT',type:'ctrl'}],
                 knobs: [{id:'rate',label:'RATE',min:0.1,max:20,step:0.1,def:1},{id:'waveform',label:'WAVE',min:0,max:3,step:1,def:0},{id:'depth',label:'DEPTH',min:0,max:1,step:0.01,def:1}] },
        seq:   { label: 'SEQ', inputs: [{id:'clock',label:'CLK',type:'ctrl'}], outputs: [{id:'pitch',label:'PITCH',type:'ctrl'},{id:'gate',label:'GATE',type:'ctrl'}],
                 knobs: [], isSeq: true },
        clk:   { label: 'CLK', inputs: [], outputs: [{id:'clock',label:'CLK',type:'ctrl'}],
                 knobs: [{id:'bpm',label:'BPM',min:20,max:300,step:1,def:120},{id:'swing',label:'SWING',min:0,max:0.5,step:0.01,def:0}] },
        dly:   { label: 'DLY', inputs: [{id:'in',label:'IN',type:'audio'},{id:'timeCv',label:'CV',type:'ctrl'}], outputs: [{id:'out',label:'OUT',type:'audio'}],
                 knobs: [{id:'time',label:'TIME',min:0.01,max:2,step:0.01,def:0.3},{id:'feedback',label:'FDBK',min:0,max:0.95,step:0.01,def:0.4},{id:'mix',label:'MIX',min:0,max:1,step:0.01,def:0.3}] },
        rev:   { label: 'REV', inputs: [{id:'in',label:'IN',type:'audio'}], outputs: [{id:'out',label:'OUT',type:'audio'}],
                 knobs: [{id:'size',label:'SIZE',min:0,max:1,step:0.01,def:0.7},{id:'damping',label:'DAMP',min:0,max:1,step:0.01,def:0.5},{id:'mix',label:'MIX',min:0,max:1,step:0.01,def:0.3}] },
        mix:   { label: 'MIX', inputs: [{id:'in1',label:'1',type:'audio'},{id:'in2',label:'2',type:'audio'},{id:'in3',label:'3',type:'audio'},{id:'in4',label:'4',type:'audio'}], outputs: [{id:'out',label:'OUT',type:'audio'}],
                 knobs: [{id:'level1',label:'CH1',min:0,max:1,step:0.01,def:0.8},{id:'level2',label:'CH2',min:0,max:1,step:0.01,def:0.8},{id:'level3',label:'CH3',min:0,max:1,step:0.01,def:0.8},{id:'level4',label:'CH4',min:0,max:1,step:0.01,def:0.8},{id:'master',label:'MSTR',min:0,max:1,step:0.01,def:0.8}] },
        out:   { label: 'OUT', inputs: [{id:'inL',label:'L',type:'audio'},{id:'inR',label:'R',type:'audio'}], outputs: [],
                 knobs: [{id:'volume',label:'VOL',min:0,max:1,step:0.01,def:0.8}], hasScope: true }
    };

    // Default patch cables
    var DEFAULT_CABLES = [
        { from: 'clk.clock', to: 'seq.clock' },
        { from: 'seq.gate',  to: 'env.gate' },
        { from: 'vco.out',   to: 'vcf.in' },
        { from: 'vcf.out',   to: 'vca.in' },
        { from: 'env.out',   to: 'vca.cv' },
        { from: 'vca.out',   to: 'out.inL' },
        { from: 'vca.out',   to: 'out.inR' }
    ];

    // Interaction state
    var dragging = null;       // { type: 'module'|'knob'|'cable'|'pan', ... }
    var hoveredJack = null;    // { moduleId, portId, isOutput }
    var hoveredCable = null;   // cable index
    var cables = [];           // [{ from: 'mod.port', to: 'mod.port' }]
    var seqCurrentStep = -1;

    // Animation
    var animFrame = null;
    var scopeData = new Uint8Array(256);

    function init() {
        canvas = document.getElementById('synth-canvas');
        ctxC = canvas.getContext('2d');

        resize();
        window.addEventListener('resize', resize);

        // Mouse events
        canvas.addEventListener('mousedown', onMouseDown);
        canvas.addEventListener('mousemove', onMouseMove);
        canvas.addEventListener('mouseup', onMouseUp);
        canvas.addEventListener('dblclick', onDblClick);
        canvas.addEventListener('contextmenu', function(e) { e.preventDefault(); });

        // Build layout for each module
        buildLayouts();

        // Load default patch
        loadDefaultPatch();

        // SEQ step callback
        WalpurgisEngine.setSeqStepCallback(function(step) {
            seqCurrentStep = step;
        });

        // Start render loop
        render();
    }

    function resize() {
        var rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * window.devicePixelRatio;
        canvas.height = rect.height * window.devicePixelRatio;
        canvas.style.width = rect.width + 'px';
        canvas.style.height = rect.height + 'px';
        W = rect.width;
        H = rect.height;
        ctxC.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
    }

    function buildLayouts() {
        for (var id in MODULE_RENDER) {
            var def = MODULE_RENDER[id];
            var pos = DEFAULT_POSITIONS[id] || { x: 0, y: 0 };
            var w = def.isSeq ? MOD_SEQ_W : MOD_W;

            // Calculate module height
            var inputCount = def.inputs.length;
            var outputCount = def.outputs.length;
            var maxPorts = Math.max(inputCount, outputCount);
            var portsH = maxPorts * JACK_SPACING + JACK_MARGIN_TOP;

            var knobRows = def.isSeq ? 0 : Math.ceil(def.knobs.length / Math.floor((w - 20) / KNOB_SPACING_X));
            var knobsH = knobRows * KNOB_SPACING_Y + (knobRows > 0 ? KNOB_MARGIN_TOP : 0);

            var seqH = def.isSeq ? 120 : 0;
            var scopeH = def.hasScope ? 80 : 0;

            var h = MOD_HEADER_H + Math.max(portsH, knobsH + seqH + scopeH) + 16;

            // Calculate jack positions
            var inputJacks = [];
            def.inputs.forEach(function(inp, i) {
                inputJacks.push({
                    id: inp.id,
                    label: inp.label,
                    type: inp.type,
                    x: 0,
                    y: MOD_HEADER_H + JACK_MARGIN_TOP + i * JACK_SPACING + JACK_SPACING / 2
                });
            });

            var outputJacks = [];
            def.outputs.forEach(function(outp, i) {
                outputJacks.push({
                    id: outp.id,
                    label: outp.label,
                    type: outp.type,
                    x: w,
                    y: MOD_HEADER_H + JACK_MARGIN_TOP + i * JACK_SPACING + JACK_SPACING / 2
                });
            });

            // Calculate knob positions
            var knobPositions = [];
            if (!def.isSeq) {
                var knobsPerRow = Math.floor((w - 20) / KNOB_SPACING_X) || 1;
                var knobStartY = MOD_HEADER_H + KNOB_MARGIN_TOP + 10;
                var knobStartX = (w - Math.min(def.knobs.length, knobsPerRow) * KNOB_SPACING_X) / 2 + KNOB_SPACING_X / 2;

                def.knobs.forEach(function(k, i) {
                    var row = Math.floor(i / knobsPerRow);
                    var col = i % knobsPerRow;
                    // Recalculate startX for each row based on items in that row
                    var itemsInRow = Math.min(def.knobs.length - row * knobsPerRow, knobsPerRow);
                    var rowStartX = (w - itemsInRow * KNOB_SPACING_X) / 2 + KNOB_SPACING_X / 2;
                    knobPositions.push({
                        id: k.id,
                        label: k.label,
                        min: k.min,
                        max: k.max,
                        step: k.step,
                        def: k.def,
                        log: k.log || false,
                        x: rowStartX + col * KNOB_SPACING_X,
                        y: knobStartY + row * KNOB_SPACING_Y
                    });
                });
            }

            moduleLayout[id] = {
                id: id,
                label: def.label,
                x: pos.x,
                y: pos.y,
                w: w,
                h: h,
                inputJacks: inputJacks,
                outputJacks: outputJacks,
                knobs: knobPositions,
                isSeq: def.isSeq || false,
                hasScope: def.hasScope || false
            };
        }
    }

    function loadDefaultPatch() {
        // Reset positions
        for (var id in moduleLayout) {
            var pos = DEFAULT_POSITIONS[id];
            if (pos) {
                moduleLayout[id].x = pos.x;
                moduleLayout[id].y = pos.y;
            }
        }

        // Reset params to defaults
        var defs = WalpurgisEngine.getModuleDefs();
        for (var modId in defs) {
            for (var param in defs[modId].params) {
                WalpurgisEngine.setParam(modId, param, defs[modId].params[param]);
            }
        }

        // Set cables
        cables = DEFAULT_CABLES.map(function(c) { return { from: c.from, to: c.to }; });
        WalpurgisEngine.setConnections(cables);
        seqCurrentStep = -1;
    }

    // --- Rendering ---

    function render() {
        ctxC.clearRect(0, 0, W, H);

        // Background
        ctxC.fillStyle = C.bg;
        ctxC.fillRect(0, 0, W, H);

        // Grid dots
        drawGrid();

        ctxC.save();
        ctxC.translate(panX, panY);

        // Draw cables behind modules
        drawCables();

        // Draw cable being dragged
        if (dragging && dragging.type === 'cable') {
            drawDragCable();
        }

        // Draw modules
        for (var id in moduleLayout) {
            drawModule(moduleLayout[id]);
        }

        ctxC.restore();

        // Scope (draws in module space but needs analyser data)
        updateScope();

        animFrame = requestAnimationFrame(render);
    }

    function drawGrid() {
        ctxC.fillStyle = C.grid;
        var spacing = 20;
        var offX = panX % spacing;
        var offY = panY % spacing;
        for (var x = offX; x < W; x += spacing) {
            for (var y = offY; y < H; y += spacing) {
                ctxC.fillRect(x, y, 1, 1);
            }
        }
    }

    function drawModule(mod) {
        var x = mod.x, y = mod.y, w = mod.w, h = mod.h;

        // Module background
        ctxC.fillStyle = C.moduleBg;
        ctxC.strokeStyle = C.border;
        ctxC.lineWidth = 1.5;
        ctxC.fillRect(x, y, w, h);
        ctxC.strokeRect(x, y, w, h);

        // Header bar
        ctxC.fillStyle = C.headerBg;
        ctxC.fillRect(x, y, w, MOD_HEADER_H);
        ctxC.strokeStyle = C.border;
        ctxC.beginPath();
        ctxC.moveTo(x, y + MOD_HEADER_H);
        ctxC.lineTo(x + w, y + MOD_HEADER_H);
        ctxC.stroke();

        // Traffic light dots (hollow)
        for (var d = 0; d < 3; d++) {
            ctxC.strokeStyle = C.primaryDark;
            ctxC.lineWidth = 1;
            ctxC.strokeRect(x + 8 + d * 14, y + 6, 8, 8);
        }

        // Module label
        ctxC.fillStyle = C.primary;
        ctxC.font = '16px VT323, monospace';
        ctxC.textAlign = 'left';
        ctxC.fillText('> ' + mod.label, x + 54, y + 17);

        // Input jacks
        mod.inputJacks.forEach(function(j) {
            drawJack(x + j.x, y + j.y, j, mod.id, false);
        });

        // Output jacks
        mod.outputJacks.forEach(function(j) {
            drawJack(x + j.x, y + j.y, j, mod.id, true);
        });

        // Knobs
        mod.knobs.forEach(function(k) {
            drawKnob(x + k.x, y + k.y, k, mod.id);
        });

        // SEQ special rendering
        if (mod.isSeq) {
            drawSeqSteps(mod);
        }

        // Scope
        if (mod.hasScope) {
            drawScope(mod);
        }
    }

    function drawJack(cx, cy, jack, moduleId, isOutput) {
        var isHovered = hoveredJack &&
            hoveredJack.moduleId === moduleId &&
            hoveredJack.portId === jack.id &&
            hoveredJack.isOutput === isOutput;

        var color = jack.type === 'audio' ? C.primary : C.accent;
        var dimColor = jack.type === 'audio' ? C.primaryDark : C.accentDim;

        // Jack circle
        ctxC.beginPath();
        ctxC.arc(cx, cy, JACK_R, 0, Math.PI * 2);
        ctxC.fillStyle = isHovered ? color : C.moduleBg;
        ctxC.fill();
        ctxC.strokeStyle = isHovered ? color : dimColor;
        ctxC.lineWidth = isHovered ? 2 : 1.5;
        ctxC.stroke();

        // Glow on hover
        if (isHovered) {
            ctxC.beginPath();
            ctxC.arc(cx, cy, JACK_R + 3, 0, Math.PI * 2);
            ctxC.strokeStyle = color;
            ctxC.lineWidth = 0.5;
            ctxC.globalAlpha = 0.4;
            ctxC.stroke();
            ctxC.globalAlpha = 1;
        }

        // Label
        ctxC.fillStyle = C.textDim;
        ctxC.font = '11px VT323, monospace';
        ctxC.textAlign = isOutput ? 'right' : 'left';
        var labelX = isOutput ? cx - JACK_R - 4 : cx + JACK_R + 4;
        ctxC.fillText(jack.label, labelX, cy + 4);
    }

    function drawKnob(cx, cy, knob, moduleId) {
        var value = WalpurgisEngine.getParam(moduleId, knob.id);
        if (value === undefined) value = knob.def;

        var norm = knob.log
            ? (Math.log(value) - Math.log(knob.min)) / (Math.log(knob.max) - Math.log(knob.min))
            : (value - knob.min) / (knob.max - knob.min);
        norm = Math.max(0, Math.min(1, norm));

        // Knob background circle
        var startAngle = Math.PI * 0.75;
        var endAngle = Math.PI * 2.25;
        var valueAngle = startAngle + norm * (endAngle - startAngle);

        ctxC.beginPath();
        ctxC.arc(cx, cy, KNOB_R, startAngle, endAngle);
        ctxC.strokeStyle = C.knobArcDim;
        ctxC.lineWidth = 3;
        ctxC.stroke();

        // Value arc
        if (norm > 0.005) {
            ctxC.beginPath();
            ctxC.arc(cx, cy, KNOB_R, startAngle, valueAngle);
            ctxC.strokeStyle = C.knobArc;
            ctxC.lineWidth = 3;
            ctxC.stroke();
        }

        // Center dot
        ctxC.beginPath();
        ctxC.arc(cx, cy, 3, 0, Math.PI * 2);
        ctxC.fillStyle = C.primary;
        ctxC.fill();

        // Indicator line
        var indicatorLen = KNOB_R - 4;
        ctxC.beginPath();
        ctxC.moveTo(cx + Math.cos(valueAngle) * 5, cy + Math.sin(valueAngle) * 5);
        ctxC.lineTo(cx + Math.cos(valueAngle) * indicatorLen, cy + Math.sin(valueAngle) * indicatorLen);
        ctxC.strokeStyle = C.primary;
        ctxC.lineWidth = 2;
        ctxC.stroke();

        // Label
        ctxC.fillStyle = C.textDim;
        ctxC.font = '11px VT323, monospace';
        ctxC.textAlign = 'center';
        ctxC.fillText(knob.label, cx, cy - KNOB_R - 4);

        // Value readout
        var displayVal = formatKnobValue(knob, value);
        ctxC.fillStyle = C.primary;
        ctxC.font = '12px VT323, monospace';
        ctxC.fillText(displayVal, cx, cy + KNOB_R + 12);
    }

    function formatKnobValue(knob, value) {
        if (knob.id === 'waveform') {
            return ['SAW', 'SQR', 'SIN', 'TRI'][Math.round(value)] || '?';
        }
        if (knob.id === 'mode') {
            return ['LP', 'HP', 'BP'][Math.round(value)] || '?';
        }
        if (knob.step >= 1) return Math.round(value).toString();
        if (value >= 1000) return (value / 1000).toFixed(1) + 'k';
        if (value < 0.01) return value.toFixed(3);
        if (value < 1) return value.toFixed(2);
        return value.toFixed(1);
    }

    function drawSeqSteps(mod) {
        var x = mod.x, y = mod.y;
        var startY = y + MOD_HEADER_H + 12;
        var stepW = 32;
        var gap = 4;
        var totalW = 8 * stepW + 7 * gap;
        var startX = x + (mod.w - totalW) / 2;

        for (var i = 0; i < 8; i++) {
            var sx = startX + i * (stepW + gap);
            var isCurrent = (i === seqCurrentStep);

            // Pitch knob (smaller)
            var pitchVal = WalpurgisEngine.getParam('seq', 'step' + i) || 48;
            var pitchNorm = (pitchVal - 24) / 48;
            var knobY = startY + 20;
            var knobR = 10;

            var startAngle = Math.PI * 0.75;
            var endAngle = Math.PI * 2.25;
            var valAngle = startAngle + pitchNorm * (endAngle - startAngle);

            ctxC.beginPath();
            ctxC.arc(sx + stepW / 2, knobY, knobR, startAngle, endAngle);
            ctxC.strokeStyle = C.knobArcDim;
            ctxC.lineWidth = 2;
            ctxC.stroke();

            if (pitchNorm > 0) {
                ctxC.beginPath();
                ctxC.arc(sx + stepW / 2, knobY, knobR, startAngle, valAngle);
                ctxC.strokeStyle = isCurrent ? C.primary : C.knobArc;
                ctxC.lineWidth = 2;
                ctxC.stroke();
            }

            // MIDI note number
            ctxC.fillStyle = isCurrent ? C.primary : C.textDim;
            ctxC.font = '11px VT323, monospace';
            ctxC.textAlign = 'center';
            ctxC.fillText(Math.round(pitchVal), sx + stepW / 2, knobY + knobR + 12);

            // Gate toggle
            var gateVal = WalpurgisEngine.getParam('seq', 'gate' + i);
            var gateY = startY + 58;
            ctxC.fillStyle = gateVal ? (isCurrent ? C.primary : C.seqActive) : C.seqInactive;
            ctxC.fillRect(sx + 4, gateY, stepW - 8, 12);
            ctxC.strokeStyle = C.primaryDark;
            ctxC.lineWidth = 1;
            ctxC.strokeRect(sx + 4, gateY, stepW - 8, 12);

            // Playhead highlight
            if (isCurrent) {
                ctxC.fillStyle = 'rgba(102, 217, 160, 0.08)';
                ctxC.fillRect(sx, startY - 2, stepW, 82);
                ctxC.strokeStyle = C.primary;
                ctxC.lineWidth = 1;
                ctxC.strokeRect(sx, startY - 2, stepW, 82);
            }

            // Step number
            ctxC.fillStyle = C.primaryDark;
            ctxC.font = '10px VT323, monospace';
            ctxC.textAlign = 'center';
            ctxC.fillText((i + 1).toString(), sx + stepW / 2, startY + 82);
        }
    }

    function drawScope(mod) {
        var analyser = WalpurgisEngine.getAnalyser();
        if (!analyser) return;

        var x = mod.x + 20;
        var y = mod.y + mod.h - 90;
        var sw = mod.w - 40;
        var sh = 60;

        // Scope background
        ctxC.fillStyle = '#030308';
        ctxC.fillRect(x, y, sw, sh);
        ctxC.strokeStyle = C.primaryDark;
        ctxC.lineWidth = 1;
        ctxC.strokeRect(x, y, sw, sh);

        // Center line
        ctxC.strokeStyle = 'rgba(102, 217, 160, 0.15)';
        ctxC.beginPath();
        ctxC.moveTo(x, y + sh / 2);
        ctxC.lineTo(x + sw, y + sh / 2);
        ctxC.stroke();

        // Waveform
        analyser.getByteTimeDomainData(scopeData);
        ctxC.beginPath();
        ctxC.strokeStyle = C.primary;
        ctxC.lineWidth = 1.5;
        ctxC.shadowColor = C.primary;
        ctxC.shadowBlur = 4;

        var sliceWidth = sw / scopeData.length;
        var px = x;
        for (var i = 0; i < scopeData.length; i++) {
            var v = scopeData[i] / 128.0;
            var py = y + (v * sh / 2);
            if (i === 0) ctxC.moveTo(px, py);
            else ctxC.lineTo(px, py);
            px += sliceWidth;
        }
        ctxC.stroke();
        ctxC.shadowBlur = 0;
    }

    function updateScope() {
        var analyser = WalpurgisEngine.getAnalyser();
        if (analyser && scopeData.length !== analyser.frequencyBinCount) {
            scopeData = new Uint8Array(analyser.frequencyBinCount);
        }
    }

    // --- Cables ---

    function drawCables() {
        cables.forEach(function(cable, idx) {
            var fromPos = getJackWorldPos(cable.from, true);
            var toPos = getJackWorldPos(cable.to, false);
            if (!fromPos || !toPos) return;

            var isHovered = (idx === hoveredCable);
            var fromType = getPortType(cable.from);
            var color = fromType === 'audio' ? C.primary : C.accent;
            var dimColor = fromType === 'audio' ? C.primaryDim : C.accentDim;

            drawBezierCable(fromPos.x, fromPos.y, toPos.x, toPos.y, isHovered ? color : dimColor, isHovered);

            // Disconnect X on hover
            if (isHovered) {
                var midX = (fromPos.x + toPos.x) / 2;
                var midY = (fromPos.y + toPos.y) / 2 + 20;
                ctxC.fillStyle = '#ff6666';
                ctxC.font = '14px VT323, monospace';
                ctxC.textAlign = 'center';
                ctxC.fillText('x', midX, midY);
            }
        });
    }

    function drawDragCable() {
        if (!dragging || dragging.type !== 'cable') return;
        var fromPos = dragging.fromPos;
        var color = dragging.portType === 'audio' ? C.primary : C.accent;
        drawBezierCable(fromPos.x, fromPos.y, dragging.mouseX - panX, dragging.mouseY - panY, color, true);
    }

    function drawBezierCable(x1, y1, x2, y2, color, bright) {
        var dx = x2 - x1;
        var dy = y2 - y1;
        var dist = Math.sqrt(dx * dx + dy * dy);
        var droop = Math.min(dist * 0.3, 60);

        var cp1x = x1 + dx * 0.33;
        var cp1y = y1 + droop;
        var cp2x = x1 + dx * 0.66;
        var cp2y = y2 + droop;

        ctxC.beginPath();
        ctxC.moveTo(x1, y1);
        ctxC.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x2, y2);
        ctxC.strokeStyle = color;
        ctxC.lineWidth = bright ? 2.5 : 2;

        if (bright) {
            ctxC.shadowColor = color;
            ctxC.shadowBlur = 8;
        }

        ctxC.stroke();
        ctxC.shadowBlur = 0;
    }

    // --- Interaction ---

    function canvasToWorld(e) {
        var rect = canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left - panX,
            y: e.clientY - rect.top - panY
        };
    }

    function canvasPos(e) {
        var rect = canvas.getBoundingClientRect();
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }

    function onMouseDown(e) {
        var world = canvasToWorld(e);
        var screen = canvasPos(e);

        // Check jacks first
        var jack = hitTestJack(world.x, world.y);
        if (jack) {
            if (jack.isOutput) {
                // Start cable from output
                dragging = {
                    type: 'cable',
                    fromPort: jack.moduleId + '.' + jack.portId,
                    fromPos: getJackWorldPos(jack.moduleId + '.' + jack.portId, true),
                    portType: jack.portType,
                    mouseX: screen.x,
                    mouseY: screen.y
                };
            } else {
                // Clicked on input — disconnect existing cable to this input
                var inputPort = jack.moduleId + '.' + jack.portId;
                var existing = cables.filter(function(c) { return c.to === inputPort; });
                if (existing.length > 0) {
                    // Remove and start dragging from the output end
                    var cable = existing[0];
                    removeCable(cable.from, cable.to);
                    dragging = {
                        type: 'cable',
                        fromPort: cable.from,
                        fromPos: getJackWorldPos(cable.from, true),
                        portType: getPortType(cable.from),
                        mouseX: screen.x,
                        mouseY: screen.y
                    };
                }
            }
            return;
        }

        // Check cable hover for disconnect
        if (hoveredCable !== null && e.button === 2) {
            var c = cables[hoveredCable];
            if (c) removeCable(c.from, c.to);
            hoveredCable = null;
            return;
        }

        // Check knobs
        var knob = hitTestKnob(world.x, world.y);
        if (knob) {
            dragging = {
                type: 'knob',
                moduleId: knob.moduleId,
                knobDef: knob.knobDef,
                startY: e.clientY,
                startValue: WalpurgisEngine.getParam(knob.moduleId, knob.knobDef.id)
            };
            return;
        }

        // Check SEQ gate toggles
        var seqGate = hitTestSeqGate(world.x, world.y);
        if (seqGate !== null) {
            var current = WalpurgisEngine.getParam('seq', 'gate' + seqGate);
            WalpurgisEngine.setParam('seq', 'gate' + seqGate, current ? 0 : 1);
            return;
        }

        // Check module headers for dragging
        var mod = hitTestModuleHeader(world.x, world.y);
        if (mod) {
            dragging = {
                type: 'module',
                moduleId: mod,
                offsetX: world.x - moduleLayout[mod].x,
                offsetY: world.y - moduleLayout[mod].y
            };
            return;
        }

        // Pan canvas
        dragging = {
            type: 'pan',
            startX: e.clientX - panX,
            startY: e.clientY - panY
        };
    }

    function onMouseMove(e) {
        var world = canvasToWorld(e);
        var screen = canvasPos(e);

        if (dragging) {
            switch (dragging.type) {
                case 'module':
                    moduleLayout[dragging.moduleId].x = world.x - dragging.offsetX;
                    moduleLayout[dragging.moduleId].y = world.y - dragging.offsetY;
                    break;

                case 'knob':
                    var dy = dragging.startY - e.clientY;
                    var k = dragging.knobDef;
                    var range = k.max - k.min;
                    var sensitivity = range / 200;
                    if (k.log) {
                        var logStart = Math.log(dragging.startValue || k.min);
                        var logRange = Math.log(k.max) - Math.log(k.min);
                        var newLog = logStart + (dy / 200) * logRange;
                        var newVal = Math.exp(newLog);
                        newVal = Math.max(k.min, Math.min(k.max, newVal));
                        WalpurgisEngine.setParam(dragging.moduleId, k.id, newVal);
                    } else {
                        var newVal2 = dragging.startValue + dy * sensitivity;
                        if (k.step >= 1) newVal2 = Math.round(newVal2);
                        newVal2 = Math.max(k.min, Math.min(k.max, newVal2));
                        WalpurgisEngine.setParam(dragging.moduleId, k.id, newVal2);
                    }
                    break;

                case 'cable':
                    dragging.mouseX = screen.x;
                    dragging.mouseY = screen.y;
                    // Highlight potential target jack
                    hoveredJack = hitTestJack(world.x, world.y);
                    break;

                case 'pan':
                    panX = e.clientX - dragging.startX;
                    panY = e.clientY - dragging.startY;
                    break;
            }
        } else {
            // Hover detection
            hoveredJack = hitTestJack(world.x, world.y);
            hoveredCable = hitTestCable(world.x, world.y);
        }
    }

    function onMouseUp(e) {
        if (dragging && dragging.type === 'cable') {
            var world = canvasToWorld(e);
            var jack = hitTestJack(world.x, world.y);
            if (jack && !jack.isOutput) {
                // Complete connection
                var toPort = jack.moduleId + '.' + jack.portId;
                addCable(dragging.fromPort, toPort);
            }
        }
        dragging = null;
    }

    function onDblClick(e) {
        var world = canvasToWorld(e);
        var knob = hitTestKnob(world.x, world.y);
        if (knob) {
            WalpurgisEngine.setParam(knob.moduleId, knob.knobDef.id, knob.knobDef.def);
        }
    }

    // --- Hit testing ---

    function hitTestJack(wx, wy) {
        for (var id in moduleLayout) {
            var mod = moduleLayout[id];
            // Input jacks
            for (var i = 0; i < mod.inputJacks.length; i++) {
                var j = mod.inputJacks[i];
                var jx = mod.x + j.x;
                var jy = mod.y + j.y;
                if (dist(wx, wy, jx, jy) < JACK_R + 4) {
                    return { moduleId: id, portId: j.id, isOutput: false, portType: j.type };
                }
            }
            // Output jacks
            for (var o = 0; o < mod.outputJacks.length; o++) {
                var oj = mod.outputJacks[o];
                var ojx = mod.x + oj.x;
                var ojy = mod.y + oj.y;
                if (dist(wx, wy, ojx, ojy) < JACK_R + 4) {
                    return { moduleId: id, portId: oj.id, isOutput: true, portType: oj.type };
                }
            }
        }
        return null;
    }

    function hitTestKnob(wx, wy) {
        for (var id in moduleLayout) {
            var mod = moduleLayout[id];
            for (var k = 0; k < mod.knobs.length; k++) {
                var knob = mod.knobs[k];
                var kx = mod.x + knob.x;
                var ky = mod.y + knob.y;
                if (dist(wx, wy, kx, ky) < KNOB_R + 2) {
                    return { moduleId: id, knobDef: knob };
                }
            }
        }
        return null;
    }

    function hitTestSeqGate(wx, wy) {
        var mod = moduleLayout.seq;
        if (!mod) return null;
        var startY = mod.y + MOD_HEADER_H + 12;
        var gateY = startY + 58;
        var stepW = 32;
        var gap = 4;
        var totalW = 8 * stepW + 7 * gap;
        var startX = mod.x + (mod.w - totalW) / 2;

        for (var i = 0; i < 8; i++) {
            var sx = startX + i * (stepW + gap);
            if (wx >= sx + 4 && wx <= sx + stepW - 4 && wy >= gateY && wy <= gateY + 12) {
                return i;
            }
        }
        return null;
    }

    function hitTestModuleHeader(wx, wy) {
        for (var id in moduleLayout) {
            var mod = moduleLayout[id];
            if (wx >= mod.x && wx <= mod.x + mod.w && wy >= mod.y && wy <= mod.y + MOD_HEADER_H) {
                return id;
            }
        }
        return null;
    }

    function hitTestCable(wx, wy) {
        var threshold = 8;
        for (var i = 0; i < cables.length; i++) {
            var cable = cables[i];
            var fromPos = getJackWorldPos(cable.from, true);
            var toPos = getJackWorldPos(cable.to, false);
            if (!fromPos || !toPos) continue;

            if (pointNearBezier(wx, wy, fromPos.x, fromPos.y, toPos.x, toPos.y, threshold)) {
                return i;
            }
        }
        return null;
    }

    function pointNearBezier(px, py, x1, y1, x2, y2, threshold) {
        var dx = x2 - x1;
        var ddist = Math.sqrt(dx * dx + (y2 - y1) * (y2 - y1));
        var droop = Math.min(ddist * 0.3, 60);
        var steps = 20;
        for (var t = 0; t <= 1; t += 1 / steps) {
            var cp1x = x1 + dx * 0.33;
            var cp1y = y1 + droop;
            var cp2x = x1 + dx * 0.66;
            var cp2y = y2 + droop;
            var mt = 1 - t;
            var bx = mt * mt * mt * x1 + 3 * mt * mt * t * cp1x + 3 * mt * t * t * cp2x + t * t * t * x2;
            var by = mt * mt * mt * y1 + 3 * mt * mt * t * cp1y + 3 * mt * t * t * cp2y + t * t * t * y2;
            if (dist(px, py, bx, by) < threshold) return true;
        }
        return false;
    }

    // --- Helpers ---

    function dist(x1, y1, x2, y2) {
        var dx = x2 - x1;
        var dy = y2 - y1;
        return Math.sqrt(dx * dx + dy * dy);
    }

    function getJackWorldPos(portStr, isOutput) {
        var parts = portStr.split('.');
        var mod = moduleLayout[parts[0]];
        if (!mod) return null;

        var jacks = isOutput ? mod.outputJacks : mod.inputJacks;
        for (var i = 0; i < jacks.length; i++) {
            if (jacks[i].id === parts[1]) {
                return { x: mod.x + jacks[i].x, y: mod.y + jacks[i].y };
            }
        }
        return null;
    }

    function getPortType(portStr) {
        var parts = portStr.split('.');
        var renderDef = MODULE_RENDER[parts[0]];
        if (!renderDef) return 'audio';
        var allPorts = renderDef.inputs.concat(renderDef.outputs);
        for (var i = 0; i < allPorts.length; i++) {
            if (allPorts[i].id === parts[1]) return allPorts[i].type;
        }
        return 'audio';
    }

    function addCable(fromPort, toPort) {
        cables = cables.filter(function(c) { return c.to !== toPort; });
        cables.push({ from: fromPort, to: toPort });
        WalpurgisEngine.connect(fromPort, toPort);
    }

    function removeCable(fromPort, toPort) {
        cables = cables.filter(function(c) {
            return !(c.from === fromPort && c.to === toPort);
        });
        WalpurgisEngine.disconnect(fromPort, toPort);
    }

    function cancelCableDrag() {
        if (dragging && dragging.type === 'cable') {
            dragging = null;
        }
    }

    // --- State get/set for save/load ---

    function getState() {
        var modState = {};
        for (var id in moduleLayout) {
            var mod = moduleLayout[id];
            var defs = WalpurgisEngine.getModuleDefs();
            var params = {};
            if (defs[id]) {
                for (var p in defs[id].params) {
                    params[p] = WalpurgisEngine.getParam(id, p);
                }
            }
            modState[id] = { x: mod.x, y: mod.y, params: params };
        }
        return {
            modules: modState,
            cables: cables.map(function(c) { return { from: c.from, to: c.to }; })
        };
    }

    function setState(state) {
        if (!state) return;

        // Restore positions and params
        if (state.modules) {
            for (var id in state.modules) {
                var s = state.modules[id];
                if (moduleLayout[id]) {
                    moduleLayout[id].x = s.x;
                    moduleLayout[id].y = s.y;
                }
                if (s.params) {
                    for (var p in s.params) {
                        WalpurgisEngine.setParam(id, p, s.params[p]);
                    }
                }
            }
        }

        // Restore cables
        if (state.cables) {
            cables = state.cables.map(function(c) { return { from: c.from, to: c.to }; });
            WalpurgisEngine.setConnections(cables);
        }
    }

    // Init on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    return {
        getState: getState,
        setState: setState,
        loadDefaultPatch: loadDefaultPatch,
        cancelCableDrag: cancelCableDrag
    };
})();
