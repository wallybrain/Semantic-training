// Dasein — Philosophical text navigation conversation engine

(function() {
    'use strict';

    // Side scanners (shared pattern with fnord.js)
    ['left', 'right'].forEach(function(side) {
        var scanner = document.createElement('div');
        scanner.className = 'side-scanner side-scanner--' + side;
        document.body.appendChild(scanner);
        var glow = document.createElement('div');
        glow.className = 'side-glow side-glow--' + side;
        document.body.appendChild(glow);
    });

    var GLITCH = '\u2593\u2592\u2591\u2588\u2584\u2580\u2590\u258C\u2554\u2557\u255A\u255D\u2551\u2550\u253C\u252C\u2534\u251C\u2524\u2500\u2502\u25CF\u25C6\u25C7\u25CB\u25CE';
    var STORAGE_KEY = 'dasein';

    var API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
        ? 'http://127.0.0.1:8803/api'
        : '/dasein/api';

    var conversationEl = document.getElementById('conversation');
    var trailEl = document.getElementById('trail');
    var inputEl = document.getElementById('user-input');
    var counterEl = document.getElementById('exchange-count');

    var messages = [];
    var state = {};
    var exchangeCount = 0;
    var isBusy = false;
    var commandHistory = [];
    var historyIndex = -1;

    function loadSession() {
        try {
            var saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
            if (saved) {
                messages = saved.messages || [];
                state = saved.state || {};
                exchangeCount = saved.exchangeCount || 0;
                commandHistory = saved.commandHistory || [];
            }
        } catch (e) { /* ignore corrupt data */ }
    }

    function saveSession() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            messages: messages,
            state: state,
            exchangeCount: exchangeCount,
            commandHistory: commandHistory
        }));
    }

    function clearChildren(el) {
        while (el.firstChild) el.removeChild(el.firstChild);
    }

    function renderMessage(role, text) {
        var div = document.createElement('div');
        div.className = 'message message--' + role;
        div.textContent = text;
        conversationEl.appendChild(div);
        conversationEl.scrollTop = conversationEl.scrollHeight;
        return div;
    }

    function glitchReveal(element, finalText) {
        return new Promise(function(resolve) {
            var frame = 0;
            var max = 20;

            var interval = setInterval(function() {
                var out = '';
                for (var i = 0; i < finalText.length; i++) {
                    if (finalText[i] === '\n') {
                        out += '\n';
                    } else if (Math.random() < (frame / max)) {
                        out += finalText[i];
                    } else {
                        out += GLITCH[Math.floor(Math.random() * GLITCH.length)];
                    }
                }
                element.textContent = out;
                conversationEl.scrollTop = conversationEl.scrollHeight;
                frame++;

                if (frame >= max) {
                    clearInterval(interval);
                    element.textContent = finalText;
                    conversationEl.scrollTop = conversationEl.scrollHeight;
                    resolve();
                }
            }, 55);
        });
    }

    function updateTrail(s) {
        if (s && s.trail_display) {
            trailEl.textContent = s.trail_display;
        }
    }

    function updateCounter() {
        counterEl.textContent = 'exchanges: ' + exchangeCount;
    }

    function setInputEnabled(enabled) {
        inputEl.disabled = !enabled;
        if (enabled) inputEl.focus();
    }

    async function converse(userText) {
        if (isBusy) return;
        isBusy = true;
        setInputEnabled(false);

        messages.push({ role: 'user', content: userText });
        renderMessage('user', userText);

        commandHistory.push(userText);
        if (commandHistory.length > 50) commandHistory.shift();
        historyIndex = -1;

        var thinkingEl = renderMessage('system', '...');

        try {
            var resp = await fetch(API_BASE + '/converse', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: messages, state: state })
            });

            if (!resp.ok) throw new Error('API error: ' + resp.status);

            var data = await resp.json();

            conversationEl.removeChild(thinkingEl);

            messages.push({ role: 'assistant', content: data.response });
            state = data.state || state;
            exchangeCount++;

            var msgEl = renderMessage('assistant', '');
            await glitchReveal(msgEl, data.response);

            updateTrail(state);
            updateCounter();
            saveSession();
        } catch (err) {
            conversationEl.removeChild(thinkingEl);
            renderMessage('error', 'connection lost: ' + err.message);
        }

        isBusy = false;
        setInputEnabled(true);
    }

    function handleSpecialCommands(text) {
        var cmd = text.trim().toLowerCase();
        if (cmd === '/clear' || cmd === '/reset') {
            messages = [];
            state = {};
            exchangeCount = 0;
            clearChildren(conversationEl);
            trailEl.textContent = '';
            updateCounter();
            saveSession();
            showWelcome();
            return true;
        }
        return false;
    }

    function showWelcome() {
        renderMessage('system',
            'DASEIN — Baudrillard navigation system\n' +
            'Type to begin. The guide will meet you where you are.\n' +
            '/clear to reset session'
        );
    }

    function restoreConversation() {
        messages.forEach(function(msg) {
            renderMessage(msg.role === 'user' ? 'user' : 'assistant', msg.content);
        });
        updateTrail(state);
        updateCounter();
    }

    // Input handling
    inputEl.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            var text = inputEl.value.trim();
            if (!text) return;
            inputEl.value = '';
            if (!handleSpecialCommands(text)) {
                converse(text);
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (commandHistory.length === 0) return;
            if (historyIndex === -1) historyIndex = commandHistory.length;
            historyIndex--;
            if (historyIndex >= 0) {
                inputEl.value = commandHistory[historyIndex];
            }
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (historyIndex === -1) return;
            historyIndex++;
            if (historyIndex < commandHistory.length) {
                inputEl.value = commandHistory[historyIndex];
            } else {
                historyIndex = -1;
                inputEl.value = '';
            }
        }
    });

    // Init
    loadSession();
    if (messages.length > 0) {
        restoreConversation();
    } else {
        showWelcome();
    }
    inputEl.focus();
})();
