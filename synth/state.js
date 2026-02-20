// Walpurgis State — save/load via localStorage and URL hash sharing
var WalpurgisState = (function() {
    'use strict';

    var STORAGE_KEY = 'walpurgis_patches';

    function getAllPatches() {
        try {
            var raw = localStorage.getItem(STORAGE_KEY);
            return raw ? JSON.parse(raw) : {};
        } catch (e) {
            return {};
        }
    }

    function setAllPatches(patches) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(patches));
    }

    function save(name, state) {
        var patches = getAllPatches();
        patches[name] = state;
        setAllPatches(patches);
    }

    function load(name) {
        var patches = getAllPatches();
        return patches[name] || null;
    }

    function remove(name) {
        var patches = getAllPatches();
        delete patches[name];
        setAllPatches(patches);
    }

    function listPatches() {
        return Object.keys(getAllPatches()).sort();
    }

    function toHash(state) {
        try {
            var json = JSON.stringify(state);
            var encoded = btoa(unescape(encodeURIComponent(json)));
            window.location.hash = encoded;
        } catch (e) {
            console.error('Failed to encode state to hash:', e);
        }
    }

    function fromHash() {
        var hash = window.location.hash.slice(1);
        if (!hash) return null;
        try {
            var json = decodeURIComponent(escape(atob(hash)));
            return JSON.parse(json);
        } catch (e) {
            console.warn('Failed to decode hash state:', e);
            return null;
        }
    }

    return {
        save: save,
        load: load,
        remove: remove,
        listPatches: listPatches,
        toHash: toHash,
        fromHash: fromHash
    };
})();
