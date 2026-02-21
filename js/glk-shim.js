/*
 * Minimal Glk shim for ZVM (ifvms.js)
 * Routes Z-machine I/O to a terminal-style DOM interface.
 * Save/restore via localStorage using Quetzal format.
 */

function GlkShim(outputEl, inputEl, statusEl, opts) {
    this.outputEl = outputEl;
    this.inputEl = inputEl;
    this.statusEl = statusEl;
    this.opts = opts || {};

    this.mainwin = { id: 201, type: 3, str: { id: 301 }, rock: 201 };
    this.upperwin = null;
    this.statuswin = null;
    this.currentWin = this.mainwin;
    this.windows = [this.mainwin];
    this.nextWinId = 202;
    this.nextStrId = 302;

    this.pendingLineCallback = null;
    this.pendingCharCallback = null;
    this.selectEvent = null;

    this.vm = null;
    this.upperContent = [];
    this.upperHeight = 0;
    this.upperWidth = 80;
    this.upperRow = 0;
    this.upperCol = 0;

    this._currentFileref = null;
    this._pendingFileref = false;
}

GlkShim.prototype = {
    setVM: function(vm) { this.vm = vm; },

    RefBox: function() {
        this._val = 0;
        this.set_value = function(v) { this._val = v; };
        this.get_value = function() { return this._val; };
    },

    RefStruct: function() {
        this._fields = [];
        this.push_field = function(v) { this._fields.push(v); };
        this.set_field = function(i, v) { this._fields[i] = v; };
        this.get_field = function(i) { return this._fields[i]; };
    },

    glk_gestalt: function(sel) {
        if (sel === 0x1100) return 0;
        if (sel === 0x0004) return 1;
        return 0;
    },

    // Window management
    glk_window_open: function(splitwin, method, size, wintype, rock) {
        var win = {
            id: this.nextWinId++,
            type: wintype,
            rock: rock,
            str: { id: this.nextStrId++ },
            parent: splitwin,
            size: size
        };
        this.windows.push(win);

        if (rock === 202) {
            this.statuswin = win;
            this.upperHeight = size || 1;
            this._initUpper();
            return win;
        }
        if (rock === 0) {
            // Temp window for measuring — return and close immediately
            return win;
        }
        if (wintype === 4) {
            this.upperwin = win;
            this.upperHeight = size;
            this._initUpper();
            return win;
        }
        return win;
    },

    _initUpper: function() {
        this.upperContent = [];
        for (var r = 0; r < this.upperHeight; r++) {
            this.upperContent[r] = [];
            for (var c = 0; c < this.upperWidth; c++) {
                this.upperContent[r][c] = ' ';
            }
        }
        this.upperRow = 0;
        this.upperCol = 0;
    },

    glk_window_close: function(win) {
        if (win === this.upperwin) this.upperwin = null;
        if (win === this.statuswin) this.statuswin = null;
        var idx = this.windows.indexOf(win);
        if (idx > -1) this.windows.splice(idx, 1);
        return { 0: 0 };
    },

    glk_window_clear: function(win) {
        if (win === this.mainwin) {
            while (this.outputEl.firstChild) {
                this.outputEl.removeChild(this.outputEl.firstChild);
            }
        } else if (win === this.upperwin || win === this.statuswin) {
            this._initUpper();
            this._renderStatus();
        }
    },

    glk_window_get_size: function(win, widthbox, heightbox) {
        var w = this.upperWidth;
        var h = (win === this.mainwin) ? 25 : this.upperHeight;
        if (widthbox && widthbox.set_value) widthbox.set_value(w);
        if (heightbox && heightbox.set_value) heightbox.set_value(h);
    },

    glk_window_get_stream: function(win) {
        return win ? win.str : null;
    },

    glk_window_get_parent: function(win) {
        return win ? win.parent : null;
    },

    glk_window_set_arrangement: function(parent, method, size) {
        if (this.upperwin) {
            this.upperHeight = size;
            this._initUpper();
        }
    },

    glk_window_move_cursor: function(win, col, row) {
        this.upperRow = row;
        this.upperCol = col;
    },

    glk_set_window: function(win) {
        this.currentWin = win || this.mainwin;
    },

    glk_set_style: function() {},
    glk_stylehint_set: function() {},
    glk_stylehint_clear: function() {},
    garglk_set_reversevideo: function() {},
    garglk_set_reversevideo_stream: function() {},
    garglk_set_zcolors_stream: function() {},

    // Text output
    glk_put_jstring: function(str) {
        if (this.currentWin === this.upperwin || this.currentWin === this.statuswin) {
            this._writeUpper(str);
        } else {
            this._appendText(str);
        }
    },

    glk_put_jstring_stream: function(stream, str) {
        if ((this.upperwin && stream === this.upperwin.str) ||
            (this.statuswin && stream === this.statuswin.str)) {
            this._writeUpper(str);
        } else if (stream === this.mainwin.str) {
            this._appendText(str);
        }
        // For save streams, append to data buffer
        if (stream && stream._saveBuffer !== undefined) {
            stream._saveBuffer += str;
        }
    },

    glk_put_char_stream_uni: function() {},

    // Buffer I/O for save/restore
    glk_put_buffer_stream: function(stream, data) {
        if (!stream) return;
        // Store binary data as base64 in localStorage
        var key = stream._saveKey;
        if (key) {
            var binary = '';
            var bytes = new Uint8Array(data);
            for (var i = 0; i < bytes.length; i++) {
                binary += String.fromCharCode(bytes[i]);
            }
            try {
                localStorage.setItem(key, btoa(binary));
                this._appendText('[Game saved.]\n');
                if (this.opts.onSave) this.opts.onSave();
            } catch (e) {
                this._appendText('[Save failed: storage full.]\n');
            }
        }
    },

    glk_get_buffer_stream: function(stream, buf) {
        if (!stream || !stream._saveKey) return 0;
        var saved = localStorage.getItem(stream._saveKey);
        if (!saved) return 0;
        try {
            var binary = atob(saved);
            var len = Math.min(binary.length, buf.length);
            for (var i = 0; i < len; i++) {
                buf[i] = binary.charCodeAt(i);
            }
            return len;
        } catch (e) {
            return 0;
        }
    },

    _writeUpper: function(str) {
        for (var i = 0; i < str.length; i++) {
            if (this.upperRow < this.upperHeight && this.upperCol < this.upperWidth) {
                this.upperContent[this.upperRow][this.upperCol] = str[i];
                this.upperCol++;
                if (this.upperCol >= this.upperWidth) {
                    this.upperCol = 0;
                    this.upperRow++;
                }
            }
        }
        this._renderStatus();
    },

    _renderStatus: function() {
        if (!this.statusEl) return;
        var lines = [];
        for (var r = 0; r < this.upperHeight; r++) {
            lines.push(this.upperContent[r].join(''));
        }
        this.statusEl.textContent = lines.join('\n');
        this.statusEl.style.display = this.upperHeight > 0 ? 'block' : 'none';
    },

    _appendText: function(str) {
        var parts = str.split('\n');
        for (var i = 0; i < parts.length; i++) {
            if (i > 0) {
                this.outputEl.appendChild(document.createElement('br'));
            }
            if (parts[i].length > 0) {
                this.outputEl.appendChild(document.createTextNode(parts[i]));
            }
        }
        this._scrollToBottom();
    },

    _scrollToBottom: function() {
        var container = this.outputEl.parentElement;
        if (container) container.scrollTop = container.scrollHeight;
    },

    // Line input
    glk_request_line_event_uni: function(win, buf) {
        this.pendingLineCallback = { win: win, buf: buf };
        this.inputEl.style.display = '';
        this.inputEl.value = '';
        this.inputEl.focus();
    },

    // Char input
    glk_request_char_event_uni: function(win) {
        this.pendingCharCallback = { win: win };
        this.inputEl.style.display = '';
        this.inputEl.focus();
    },

    glk_get_line_stream_uni: function() { return 0; },
    glk_get_char_stream_uni: function() { return -1; },

    // Event selection
    glk_select: function(event) {
        this.selectEvent = event;
    },

    submitLine: function(text) {
        if (!this.pendingLineCallback) return;
        var buf = this.pendingLineCallback.buf;
        var len = Math.min(text.length, buf.length);
        for (var i = 0; i < len; i++) {
            buf[i] = text.charCodeAt(i);
        }
        this.pendingLineCallback = null;
        this._appendText(text + '\n');

        if (this.selectEvent) {
            this.selectEvent.set_field(0, 3);
            this.selectEvent.set_field(1, this.mainwin);
            this.selectEvent.set_field(2, len);
            this.selectEvent.set_field(3, 0);
        }
        this.vm.resume();
    },

    submitChar: function(charcode) {
        if (!this.pendingCharCallback) return;
        this.pendingCharCallback = null;

        if (this.selectEvent) {
            this.selectEvent.set_field(0, 2);
            this.selectEvent.set_field(1, this.mainwin);
            this.selectEvent.set_field(2, charcode);
        }
        this.vm.resume();
    },

    // File I/O — save/restore via localStorage
    glk_fileref_create_by_prompt: function(usage, mode, rock) {
        var key = 'zork_save_' + (this.opts.gameId || 'default');
        this._currentFileref = { key: key, mode: mode, usage: usage };
        this._pendingFileref = true;
    },

    glk_fileref_destroy: function() {},

    glk_stream_open_file: function(fref, mode) {
        return this._openSaveStream(mode);
    },

    glk_stream_open_file_uni: function(fref, mode) {
        return this._openSaveStream(mode);
    },

    _openSaveStream: function(mode) {
        var key = this._currentFileref ? this._currentFileref.key : 'zork_save';
        return {
            id: this.nextStrId++,
            _saveKey: key,
            _saveBuffer: '',
            mode: mode
        };
    },

    glk_stream_close: function(stream) {
        // No-op — save is handled in glk_put_buffer_stream
    },

    // Called by ZVM after each cycle
    update: function() {
        this._scrollToBottom();

        // Auto-resume for fileref blocking calls
        if (this._pendingFileref && this.vm) {
            this._pendingFileref = false;
            var self = this;
            // Use setTimeout to avoid call stack issues
            setTimeout(function() {
                // Resume with the fileref object
                self.vm.resume(self._currentFileref);
            }, 0);
        }
    },

    // Save/restore allstate for autosave (no-ops for our simple shim)
    save_allstate: function() { return null; },
    restore_allstate: function() {},

    fatal_error: function(err) {
        console.error('ZVM Fatal:', err);
        this._appendText('\n[Error: ' + (err.message || err) + ']\n');
    }
};
