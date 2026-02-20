// Walpurgis FAUST WASM Loader — loads pre-compiled modules as AudioWorkletNodes
import { FaustWasmInstantiator, FaustMonoDspGenerator } from './lib/faustwasm.js';

window.FaustLoader = {
    async loadModule(name, audioCtx) {
        var factory = await FaustWasmInstantiator.loadDSPFactory(
            'synth/modules/' + name + '.wasm',
            'synth/modules/' + name + '.json'
        );
        factory.shaKey = name;

        var generator = new FaustMonoDspGenerator();
        var node = await generator.createNode(audioCtx, name, factory);
        return node;
    }
};
