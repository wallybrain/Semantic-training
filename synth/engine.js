// Walpurgis Audio Engine — FAUST WASM AudioWorklet modules
import './faust-loader.js';

var WalpurgisEngine = (function() {
    'use strict';

    var ctx = null;
    var running = false;
    var modules = {};     // moduleId -> { node, type, params, meta }
    var connections = [];  // { from: 'mod.port', to: 'mod.port' }
    var _onReady = null;
    var _seqStepCallback = null;
    var _analyser = null;

    // Module type definitions: default params and port layout
    // Inputs/outputs match compiled FAUST module audio channel counts
    var MODULE_DEFS = {
        vco:   { inputs: [], outputs: ['out'], params: { waveform: 0, coarse: 48, fine: 0 } },
        noise: { inputs: [], outputs: ['out'], params: { color: 0.5 } },
        vcf:   { inputs: ['in', 'cutoffCv'], outputs: ['out'], params: { cutoff: 1000, resonance: 0.5, cvDepth: 0.5 } },
        vca:   { inputs: ['in', 'cv'], outputs: ['out'], params: { gain: 0.8, cvDepth: 1.0 } },
        env:   { inputs: ['gate'], outputs: ['out'], params: { attack: 0.01, decay: 0.2, sustain: 0.6, release: 0.3 } },
        lfo:   { inputs: [], outputs: ['out'], params: { rate: 1, waveform: 0, depth: 1 } },
        seq:   { inputs: ['clock'], outputs: ['pitch', 'gate'],
                 params: { step0: 48, step1: 48, step2: 48, step3: 48, step4: 48, step5: 48, step6: 48, step7: 48,
                           gate0: 1, gate1: 1, gate2: 1, gate3: 1, gate4: 0, gate5: 1, gate6: 0, gate7: 1 } },
        clk:   { inputs: [], outputs: ['clock'], params: { bpm: 120, swing: 0 } },
        dly:   { inputs: ['in', 'timeCv'], outputs: ['out'], params: { time: 0.3, feedback: 0.4, mix: 0.3 } },
        rev:   { inputs: ['in'], outputs: ['out'], params: { size: 0.5, damping: 0.5, mix: 0.3 } },
        mix:   { inputs: ['in1', 'in2', 'in3', 'in4'], outputs: ['out'], params: { level1: 0.8, level2: 0.8, level3: 0.8, level4: 0.8, master: 0.8 } },
        out:   { inputs: ['inL', 'inR'], outputs: [], params: { volume: 0.8 } }
    };

    // Map logical port names to FAUST audio channel indices
    // Only modules with audio inputs/outputs get entries
    var PORT_MAP = {
        vco:   { inputs: {}, outputs: { out: 0 } },
        noise: { inputs: {}, outputs: { out: 0 } },
        vcf:   { inputs: { in: 0, cutoffCv: 1 }, outputs: { out: 0 } },
        vca:   { inputs: { in: 0, cv: 1 }, outputs: { out: 0 } },
        env:   { inputs: { gate: 0 }, outputs: { out: 0 } },
        lfo:   { inputs: {}, outputs: { out: 0 } },
        seq:   { inputs: { clock: 0 }, outputs: { pitch: 0, gate: 1 } },
        clk:   { inputs: {}, outputs: { clock: 0 } },
        dly:   { inputs: { in: 0, timeCv: 1 }, outputs: { out: 0 } },
        rev:   { inputs: { in: 0 }, outputs: { out: 0 } },
        mix:   { inputs: { in1: 0, in2: 1, in3: 2, in4: 3 }, outputs: { out: 0 } },
        out:   { inputs: { inL: 0, inR: 1 }, outputs: {} }
    };

    // Map our param names to FAUST parameter addresses
    // Built dynamically from the FAUST JSON metadata at load time
    var paramAddressMap = {};  // moduleId -> { paramName -> faustAddress }

    function buildParamAddressMap(moduleId, faustNode) {
        paramAddressMap[moduleId] = {};
        var params = faustNode.getParams();
        var def = MODULE_DEFS[moduleId];
        if (!params || !def) return;

        // FAUST addresses look like /MODULE_NAME/param_name
        // Match by suffix (the param label/shortname)
        params.forEach(function(addr) {
            var parts = addr.split('/');
            var name = parts[parts.length - 1];
            // Map FAUST param names to our engine param names
            // SEQ uses step0_pitch/step0_gate vs our step0/gate0
            if (moduleId === 'seq') {
                var m = name.match(/^step(\d+)_(pitch|gate)$/);
                if (m) {
                    var idx = m[1];
                    var type = m[2];
                    if (type === 'pitch') {
                        paramAddressMap[moduleId]['step' + idx] = addr;
                    } else {
                        paramAddressMap[moduleId]['gate' + idx] = addr;
                    }
                    return;
                }
            }
            // OUT uses master_volume vs our volume
            if (moduleId === 'out' && name === 'master_volume') {
                paramAddressMap[moduleId]['volume'] = addr;
                return;
            }
            paramAddressMap[moduleId][name] = addr;
        });
    }

    function createModule(type, id) {
        return {
            type: type,
            id: id,
            params: Object.assign({}, MODULE_DEFS[type].params),
            faustNode: null,    // FaustAudioWorkletNode
            splitter: null,     // ChannelSplitterNode for multi-output
            merger: null,       // ChannelMergerNode for multi-input
            analyser: null      // only for OUT module
        };
    }

    function init() {
        for (var type in MODULE_DEFS) {
            modules[type] = createModule(type, type);
        }
    }

    async function start() {
        if (running) return;
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        running = true;

        // Load all FAUST modules in parallel
        var loadPromises = [];
        var moduleIds = Object.keys(modules);

        for (var i = 0; i < moduleIds.length; i++) {
            var id = moduleIds[i];
            loadPromises.push(loadFaustModule(id));
        }

        await Promise.all(loadPromises);

        // Set up OUT module: connect to destination + analyser
        setupOutModule();

        // Apply saved params
        for (var mid in modules) {
            var mod = modules[mid];
            if (mod.faustNode) {
                for (var p in mod.params) {
                    setFaustParam(mid, p, mod.params[p]);
                }
            }
        }

        // Rebuild connections
        connections.forEach(function(conn) {
            connectNodes(conn.from, conn.to);
        });

        if (_onReady) _onReady();
    }

    async function loadFaustModule(id) {
        var mod = modules[id];
        try {
            var node = await window.FaustLoader.loadModule(id, ctx);
            mod.faustNode = node;

            // Build param address map from FAUST metadata
            buildParamAddressMap(id, node);

            // FaustAudioWorkletNode uses channelCount for multi-I/O (all on port 0)
            var meta = JSON.parse(node.getJSON());
            var numOutputs = meta.outputs || 0;
            var numInputs = meta.inputs || 0;

            if (numOutputs > 1) {
                mod.splitter = ctx.createChannelSplitter(numOutputs);
                node.connect(mod.splitter);
            }

            if (numInputs > 1) {
                mod.merger = ctx.createChannelMerger(numInputs);
                mod.merger.connect(node);
            }
        } catch (e) {
            console.warn('Failed to load FAUST module ' + id + ':', e);
        }
    }

    function setupOutModule() {
        var outMod = modules.out;
        if (!outMod || !outMod.faustNode) return;

        // OUT module has 2 outputs (L, R) — connect to destination
        if (outMod.splitter) {
            // Split stereo output to destination
            var merger = ctx.createChannelMerger(2);
            outMod.splitter.connect(merger, 0, 0);  // L
            outMod.splitter.connect(merger, 1, 1);  // R
            merger.connect(ctx.destination);

            // Analyser on left channel
            _analyser = ctx.createAnalyser();
            _analyser.fftSize = 2048;
            outMod.splitter.connect(_analyser, 0);
        } else {
            // Mono fallback
            outMod.faustNode.connect(ctx.destination);
            _analyser = ctx.createAnalyser();
            _analyser.fftSize = 2048;
            outMod.faustNode.connect(_analyser);
        }
    }

    function stop() {
        if (!running) return;
        running = false;

        for (var id in modules) {
            var mod = modules[id];
            if (mod.faustNode) {
                try { mod.faustNode.disconnect(); } catch(e) {}
                if (mod.faustNode.destroy) mod.faustNode.destroy();
                mod.faustNode = null;
            }
            if (mod.splitter) {
                try { mod.splitter.disconnect(); } catch(e) {}
                mod.splitter = null;
            }
            if (mod.merger) {
                try { mod.merger.disconnect(); } catch(e) {}
                mod.merger = null;
            }
        }

        _analyser = null;
        paramAddressMap = {};

        if (ctx) {
            ctx.close();
            ctx = null;
        }
    }

    // --- Connections ---
    // FAUST AudioWorkletNodes have channelCount = number of audio channels
    // For multi-channel modules we use splitter/merger to route individual channels

    function getOutputNode(moduleId, portName) {
        var mod = modules[moduleId];
        if (!mod || !mod.faustNode) return null;

        var portMap = PORT_MAP[moduleId];
        if (!portMap || portMap.outputs[portName] === undefined) return null;

        var channelIdx = portMap.outputs[portName];

        if (mod.splitter) {
            // Return splitter + channel index
            return { node: mod.splitter, output: channelIdx };
        } else {
            // Single output — return the FAUST node directly
            return { node: mod.faustNode, output: 0 };
        }
    }

    function getInputNode(moduleId, portName) {
        var mod = modules[moduleId];
        if (!mod || !mod.faustNode) return null;

        var portMap = PORT_MAP[moduleId];
        if (!portMap || portMap.inputs[portName] === undefined) return null;

        var channelIdx = portMap.inputs[portName];

        if (mod.merger) {
            // Route to specific merger input channel
            return { node: mod.merger, input: channelIdx };
        } else {
            // Single input — connect directly to the FAUST node
            return { node: mod.faustNode, input: 0 };
        }
    }

    function connect(fromPort, toPort) {
        connections = connections.filter(function(c) { return c.to !== toPort; });
        connections.push({ from: fromPort, to: toPort });
        if (running) connectNodes(fromPort, toPort);
    }

    function disconnect(fromPort, toPort) {
        connections = connections.filter(function(c) {
            return !(c.from === fromPort && c.to === toPort);
        });
        if (running) disconnectNodes(fromPort, toPort);
    }

    function disconnectInput(toPort) {
        var removed = connections.filter(function(c) { return c.to === toPort; });
        connections = connections.filter(function(c) { return c.to !== toPort; });
        if (running) {
            removed.forEach(function(c) { disconnectNodes(c.from, c.to); });
        }
    }

    function connectNodes(fromPort, toPort) {
        var fromParts = fromPort.split('.');
        var toParts = toPort.split('.');
        var src = getOutputNode(fromParts[0], fromParts[1]);
        var dst = getInputNode(toParts[0], toParts[1]);
        if (!src || !dst) return;

        try {
            if (dst.input !== undefined) {
                src.node.connect(dst.node, src.output, dst.input);
            } else {
                src.node.connect(dst.node, src.output);
            }
        } catch(e) {
            console.warn('Connection failed:', fromPort, '->', toPort, e);
        }
    }

    function disconnectNodes(fromPort, toPort) {
        var fromParts = fromPort.split('.');
        var toParts = toPort.split('.');
        var src = getOutputNode(fromParts[0], fromParts[1]);
        var dst = getInputNode(toParts[0], toParts[1]);
        if (!src || !dst) return;

        try {
            if (dst.input !== undefined) {
                src.node.disconnect(dst.node, src.output, dst.input);
            } else {
                src.node.disconnect(dst.node, src.output);
            }
        } catch(e) {}
    }

    // --- Parameters ---

    function setFaustParam(moduleId, param, value) {
        var mod = modules[moduleId];
        if (!mod || !mod.faustNode) return;

        var addrMap = paramAddressMap[moduleId];
        if (!addrMap) return;

        var addr = addrMap[param];
        if (addr) {
            mod.faustNode.setParamValue(addr, value);
        }
    }

    function setParam(moduleId, param, value) {
        var mod = modules[moduleId];
        if (!mod) return;
        mod.params[param] = value;

        if (running && mod.faustNode) {
            setFaustParam(moduleId, param, value);
        }

        // BPM display update
        if (moduleId === 'clk' && param === 'bpm') {
            var el = document.getElementById('bpm-display');
            if (el) el.textContent = 'BPM: ' + Math.round(value);
        }
    }

    function getParam(moduleId, param) {
        var mod = modules[moduleId];
        return mod ? mod.params[param] : undefined;
    }

    function getAnalyser() {
        return _analyser;
    }

    function getSampleRate() {
        return ctx ? ctx.sampleRate : null;
    }

    function getModuleDefs() {
        return MODULE_DEFS;
    }

    function getConnections() {
        return connections.slice();
    }

    function setConnections(conns) {
        if (running) {
            connections.forEach(function(c) { disconnectNodes(c.from, c.to); });
        }
        connections = conns.slice();
        if (running) {
            connections.forEach(function(c) { connectNodes(c.from, c.to); });
        }
    }

    function setSeqStepCallback(callback) {
        _seqStepCallback = callback;
        // TODO: hook into SEQ module's clock edge detection for step highlight
    }

    function onReady(callback) {
        _onReady = callback;
    }

    init();

    return {
        start: start,
        stop: stop,
        connect: connect,
        disconnect: disconnect,
        disconnectInput: disconnectInput,
        setParam: setParam,
        getParam: getParam,
        getAnalyser: getAnalyser,
        getSampleRate: getSampleRate,
        getModuleDefs: getModuleDefs,
        getConnections: getConnections,
        setConnections: setConnections,
        setSeqStepCallback: setSeqStepCallback,
        onReady: onReady
    };
})();

window.WalpurgisEngine = WalpurgisEngine;
