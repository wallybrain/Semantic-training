(function() {
    var outputEl = document.getElementById('output');
    var inputEl = document.getElementById('game-input');
    var statusEl = document.getElementById('game-status');
    var terminalEl = document.getElementById('terminal');
    var welcomeEl = document.getElementById('welcome');
    var loadingEl = document.getElementById('loading');
    var inputArea = document.getElementById('input-area');
    var saveStatus = document.getElementById('save-status');

    var currentGame = null;
    var glk = null;
    var vm = null;
    var commandHistory = [];
    var historyIndex = -1;

    var gameFiles = {
        zork1: 'games/zork1.z3',
        zork2: 'games/zork2.z3',
        zork3: 'games/zork3.z3'
    };

    var gameNames = {
        zork1: 'Zork I: The Great Underground Empire',
        zork2: 'Zork II: The Wizard of Frobozz',
        zork3: 'Zork III: The Dungeon Master'
    };

    // Bind game selector buttons (no inline onclick — CSP blocks it)
    document.querySelectorAll('.game-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            loadGame(btn.getAttribute('data-game'));
        });
    });

    function loadGame(gameId) {
        if (currentGame === gameId) return;
        currentGame = gameId;

        // Update button states
        var btns = document.querySelectorAll('.game-btn');
        btns.forEach(function(btn) {
            btn.classList.toggle('active', btn.getAttribute('data-game') === gameId);
        });

        // Show loading
        welcomeEl.style.display = 'none';
        terminalEl.style.display = 'none';
        inputArea.style.display = 'none';
        loadingEl.style.display = 'block';

        // Fetch story file
        console.log('Fetching:', gameFiles[gameId]);
        fetch(gameFiles[gameId])
            .then(function(res) {
                console.log('Fetch response:', res.status, res.ok);
                if (!res.ok) throw new Error('Failed to load ' + gameFiles[gameId] + ' (HTTP ' + res.status + ')');
                return res.arrayBuffer();
            })
            .then(function(buf) {
                console.log('Story loaded, bytes:', buf.byteLength);
                startGame(gameId, new Uint8Array(buf));
            })
            .catch(function(err) {
                console.error('Load error:', err);
                loadingEl.style.display = 'none';
                welcomeEl.style.display = 'flex';
                alert('Error loading game: ' + err.message);
            });
    }

    function startGame(gameId, storyData) {
        // Clear previous game state
        while (outputEl.firstChild) {
            outputEl.removeChild(outputEl.firstChild);
        }
        statusEl.textContent = '';
        commandHistory = [];
        historyIndex = -1;

        // Show terminal
        loadingEl.style.display = 'none';
        terminalEl.style.display = 'block';
        inputArea.style.display = 'flex';
        statusEl.style.display = 'block';

        // Check for saved game
        var saveKey = 'zork_save_' + gameId;
        var hasSave = localStorage.getItem(saveKey);
        if (hasSave) {
            saveStatus.textContent = 'save found';
        } else {
            saveStatus.textContent = '';
        }

        // Create Glk shim and VM
        try {
            glk = new GlkShim(outputEl, inputEl, statusEl, { gameId: gameId });

            vm = new ZVM();
            glk.setVM(vm);

            vm.prepare(storyData, { Glk: glk });
            vm.init();
        } catch (err) {
            console.error('ZVM init error:', err);
            outputEl.appendChild(document.createTextNode('[Error starting game: ' + err.message + ']'));
        }

        inputEl.focus();
    }

    // Handle input
    inputEl.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            var text = inputEl.value;
            inputEl.value = '';

            if (text.length > 0) {
                commandHistory.push(text);
                historyIndex = commandHistory.length;
            }

            if (glk && glk.pendingLineCallback) {
                glk.submitLine(text);
            } else if (glk && glk.pendingCharCallback) {
                glk.submitChar(text.charCodeAt(0) || 13);
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (historyIndex > 0) {
                historyIndex--;
                inputEl.value = commandHistory[historyIndex];
            }
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (historyIndex < commandHistory.length - 1) {
                historyIndex++;
                inputEl.value = commandHistory[historyIndex];
            } else {
                historyIndex = commandHistory.length;
                inputEl.value = '';
            }
        }
    });

    // Handle char input for key presses anywhere
    document.addEventListener('keydown', function(e) {
        if (glk && glk.pendingCharCallback && document.activeElement !== inputEl) {
            glk.submitChar(e.which || e.keyCode);
        }
    });

    // Click terminal to focus input
    terminalEl.addEventListener('click', function() {
        inputEl.focus();
    });
})();
