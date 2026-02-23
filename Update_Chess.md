Critical pre-coding finding: iOS Safari has a known issue where it does not fire the DataConnection.on("data") event when serialization is set to "json" — Chrome PC sends but iOS Safari never receives. This works for other devices, just not Safari.[3] Therefore the replacement uses PeerJS's default BinaryPack serialization throughout, which handles all browsers uniformly. All other architecture decisions verified: a small percentage of users are behind symmetric NATs where NAT traversal is impossible and no connection can be made — a workaround is to proxy the connection through a TURN server; the PeerServer cloud service provides a free TURN server.[1] Free TURN credentials from OpenRelay are included as a belt-and-suspenders fallback.

html
<!-- ═══════════════════════════════════════════════════════════════════════
     CHANGE 1 OF 3  —  <head> script tags
     ─────────────────────────────────────────────────────────────────────
     DELETE every Firebase SDK <script> line, including any/all of:

       <script src="https://www.gstatic.com/firebasejs/.../firebase-app-compat.js"></script>
       <script src="https://www.gstatic.com/firebasejs/.../firebase-database-compat.js"></script>
       <script src="https://www.gstatic.com/firebasejs/.../firebase-app.js" type="module"></script>
       <script src="https://www.gstatic.com/firebasejs/.../firebase-database.js" type="module"></script>
       <script src="https://www.gstatic.com/firebasejs/.../firebase-firestore.js" type="module"></script>
       <script src="https://www.gstatic.com/firebasejs/.../firebase-auth.js" type="module"></script>

     ADD the single version-locked line below in their place.
     jsdelivr is used over unpkg for superior uptime and edge-cache coverage.
═══════════════════════════════════════════════════════════════════════ -->
<script src="https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js"></script>

javascript
/* ═══════════════════════════════════════════════════════════════════════════
   CHANGE 2 OF 3  —  Remove all Firebase initialization and listener code
   ─────────────────────────────────────────────────────────────────────────
   FIND and DELETE every block in your <script> that references any of:

     firebase              firebaseConfig          initializeApp
     getDatabase           getFirestore            getAuth
     signInAnonymously     onAuthStateChanged
     db.ref(...)           database.ref(...)       ref(db, ...)
     onValue(...)          onChildAdded(...)        onDisconnect()
     set(...)              push(...)               update(...)
     remove(...)           serverTimestamp()       ServerValue
     collection(...)       doc(...)                addDoc(...)
     onSnapshot(...)       getDocs(...)            setDoc(...)

   Also remove the firebaseConfig object literal:
     const firebaseConfig = { apiKey: "...", authDomain: "...", ... };

   The entire removed block is replaced by the OG_NET module in CHANGE 3.
═══════════════════════════════════════════════════════════════════════════ */

javascript
/* ═══════════════════════════════════════════════════════════════════════════
   CHANGE 3 OF 3  —  Paste this entire module where the Firebase code was.
   ─────────────────────────────────────────────────────────────────────────
   OG-NET  |  Obsidian Gambit Online Multiplayer  |  PeerJS 1.5.4 / WebRTC
   ─────────────────────────────────────────────────────────────────────────

   ARCHITECTURE SUMMARY
   ─────────────────────
   • Host creates a Peer with ID  "og7-<ROOMID>"  on PeerJS cloud signaling.
   • Guest creates an anonymous Peer and calls connect("og7-<ROOMID>").
   • All game data flows over a single reliable WebRTC DataChannel (ordered,
     loss-retransmit — guaranteed delivery, in-order at the SCTP layer).
   • An application-layer envelope  { type, seq, ts, data }  adds monotonic
     sequencing for duplicate detection and out-of-order buffering as a
     defense-in-depth layer on top of SCTP ordering guarantees.
   • A ping/pong keepalive detects stale connections that SCTP did not close.
   • Exponential-backoff reconnection rebuilds the DataChannel (and the Peer
     itself if destroyed) while preserving full game state.
   • On reconnect the host re-sends a complete state sync (FEN + move list +
     clock) so the guest is never left in a desynchronised position.
   • Page Visibility and window online/offline events trigger reconnect
     attempts immediately when the device returns from background or network
     restores, covering iOS Safari backgrounding and mobile network switches.

   SERIALIZATION NOTE
   ───────────────────
   PeerJS default BinaryPack is used — NOT serialization:"json".
   JSON serialization has a confirmed iOS Safari DataChannel receive bug
   (PeerJS issue #786).  BinaryPack works uniformly across all targets.
   JavaScript objects are passed directly to conn.send() and arrive
   deserialized at the other end; no manual JSON.stringify/parse needed.

   ICE / NAT TRAVERSAL
   ────────────────────
   Five Google STUN servers + Cloudflare STUN cover the majority of NAT
   topologies.  Three OpenRelay TURN endpoints (UDP-80, TCP-443, TLS-443)
   cover symmetric NAT environments (mobile carriers, corporate networks).
   TURN is only used as a last resort when direct/STUN paths fail.

   PUBLIC API  (window.OG_NET)
   ────────────────────────────
   OG_NET.on(event, fn)                          ← register callback
   OG_NET.hostGame(playerName, onRoomReady)       ← host; fires onRoomReady(roomId)
   OG_NET.joinGame(playerName, roomId, onFail)    ← join; fires onFail(msg) on error
   OG_NET.sendMove(moveObj)                       ← {from,to,promotion,fen}
   OG_NET.sendChat(text)                          ← plain string
   OG_NET.sendResign()
   OG_NET.sendTimeUpdate(whiteMs, blackMs, turn)
   OG_NET.sendStateSync(fen, moves, wMs, bMs, turn)
   OG_NET.disconnect()
   OG_NET.getRoomId()        → string
   OG_NET.getOpponentName()  → string
   OG_NET.isHost()           → bool
   OG_NET.isConnected()      → bool

   EVENTS  (via OG_NET.on)
   ────────────────────────
   'opponentJoined'   fn(name)                   ← first handshake received
   'opponentMove'     fn({from,to,promotion,fen})
   'opponentChat'     fn({sender, text})
   'opponentResign'   fn()
   'timeUpdate'       fn({white, black, turn})
   'stateSync'        fn({fen, moves, white, black, turn})
   'disconnected'     fn()                       ← connection lost
   'reconnected'      fn()                       ← host MUST call sendStateSync here
   'error'            fn(message)                ← fatal / unrecoverable
═══════════════════════════════════════════════════════════════════════════ */

;(() => {
  'use strict';

  /* ── Runtime constants ───────────────────────────────────────────────── */

  const ID_PFX       = 'og7-';
  const PROTO_VER    = '7.0';
  // Unambiguous charset: no 0/O, 1/I/L confusion
  const ROOM_CHARS   = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const ROOM_LEN     = 6;
  const MAX_RECON    = 14;
  const RECON_BASE   = 1500;    // ms
  const RECON_CAP    = 32000;   // ms
  const OPEN_TIMEOUT = 22000;   // ms — abort if DataChannel never opens
  const PING_MS      = 7000;
  const PONG_LIMIT   = 12000;
  const SEEN_CAP     = 512;     // dedup ring-buffer depth

  const ICE_CFG = {
    sdpSemantics : 'unified-plan',
    iceServers   : [
      /* STUN — free, no credentials */
      { urls: 'stun:stun.l.google.com:19302'  },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' },
      { urls: 'stun:stun.cloudflare.com:3478' },
      /* TURN — free OpenRelay; only activated for symmetric NAT */
      {
        urls       : 'turn:openrelay.metered.ca:80',
        username   : 'openrelayproject',
        credential : 'openrelayproject',
      },
      {
        urls       : 'turn:openrelay.metered.ca:443',
        username   : 'openrelayproject',
        credential : 'openrelayproject',
      },
      {
        urls       : 'turn:openrelay.metered.ca:443?transport=tcp',
        username   : 'openrelayproject',
        credential : 'openrelayproject',
      },
    ],
  };

  /* ── Mutable module state ────────────────────────────────────────────── */

  let _peer       = null;   // Peer instance
  let _conn       = null;   // DataConnection instance
  let _isHost     = false;
  let _roomId     = null;
  let _myName     = '';
  let _oppName    = '';
  let _connected  = false;
  let _started    = false;  // true after first handshake; survives reconnects

  // Per-DataChannel sequence counters — reset every time a new channel opens
  let _outSeq  = 0;
  let _inSeq   = -1;
  let _buf     = [];   // out-of-order hold [{type,seq,data}]
  let _seen    = [];   // dedup ring

  // Timer handles
  let _openTmr  = null;
  let _reconTmr = null;
  let _pingIval = null;
  let _pongTmr  = null;
  let _reconCnt = 0;

  // Callback registry
  const _cb = {
    opponentJoined : null,
    opponentMove   : null,
    opponentChat   : null,
    opponentResign : null,
    timeUpdate     : null,
    stateSync      : null,
    disconnected   : null,
    reconnected    : null,
    error          : null,
  };

  /* ── Utilities ───────────────────────────────────────────────────────── */

  const _genRoomId = () => {
    let s = '';
    for (let i = 0; i < ROOM_LEN; i++)
      s += ROOM_CHARS[Math.floor(Math.random() * ROOM_CHARS.length)];
    return s;
  };

  const _pid      = r  => ID_PFX + r;
  const _kt       = t  => { clearTimeout(t);  return null; };
  const _ki       = t  => { clearInterval(t); return null; };
  const _killAll  = () => {
    _openTmr  = _kt(_openTmr);
    _reconTmr = _kt(_reconTmr);
    _pingIval = _ki(_pingIval);
    _pongTmr  = _kt(_pongTmr);
  };

  const _fire = (evt, ...a) => { if (_cb[evt]) _cb[evt](...a); };

  // Dedup ring — returns true if seq was already seen
  const _dedupe = seq => {
    if (_seen.includes(seq)) return true;
    _seen.push(seq);
    if (_seen.length > SEEN_CAP) _seen.shift();
    return false;
  };

  // Reset per-DataChannel state when a new channel opens
  const _resetSeq = () => {
    _outSeq = 0;
    _inSeq  = -1;
    _buf    = [];
    _seen   = [];
  };

  /* ── Peer factory ────────────────────────────────────────────────────── */

  const _spawnPeer = (withId, onReady, onFatal) => {
    let p;
    try {
      p = withId
        ? new Peer(_pid(withId), { config: ICE_CFG, debug: 0 })
        : new Peer(              { config: ICE_CFG, debug: 0 });
    } catch (e) {
      if (onFatal) onFatal('WebRTC unavailable: ' + e.message);
      return;
    }

    p.on('open', () => {
      _peer = p;
      onReady(p);
    });

    p.on('error', err => _handlePeerErr(err, onFatal));

    // Signaling server dropped — re-register without destroying DataChannel
    p.on('disconnected', () => {
      if (p && !p.destroyed) {
        try { p.reconnect(); } catch (_) { /* PeerJS internal — harmless */ }
      }
    });

    p.on('close', () => {
      if (_peer === p) _peer = null;
    });
  };

  const _handlePeerErr = (err, onFatal) => {
    const t = err && err.type;
    switch (t) {
      case 'peer-unavailable':
        if (onFatal) onFatal('Room not found. Verify the Room ID and try again.');
        break;
      case 'unavailable-id':
        if (onFatal) onFatal('Room ID already hosted. Try hosting again for a new ID.');
        break;
      case 'invalid-id':
        if (onFatal) onFatal('Invalid Room ID format.');
        break;
      case 'browser-incompatible':
        if (onFatal) onFatal('Your browser does not support WebRTC. Please update it.');
        break;
      case 'ssl-unavailable':
        if (onFatal) onFatal('SSL required for WebRTC. Please use HTTPS.');
        break;
      case 'network':
      case 'socket-error':
      case 'socket-closed':
      case 'webrtc':
        // Recoverable network fault
        if (_started) {
          _scheduleRecon();
        } else {
          if (onFatal) onFatal('Network error. Check your internet connection.');
        }
        break;
      case 'server-error':
        if (onFatal) onFatal('PeerJS signaling server unreachable. Please retry.');
        break;
      default:
        console.error('[OG-NET] Peer error:', t, err);
        _fire('error', (err && err.message) || t || 'Unknown network error');
    }
  };

  /* ── Connection wiring ───────────────────────────────────────────────── */

  const _armHost = p => {
    // Remove any previous 'connection' listeners before re-arming
    p.removeAllListeners('connection');
    p.on('connection', incoming => {
      // Reject a second simultaneous guest while current channel is alive
      if (_connected && _conn && _conn.open) {
        incoming.close();
        return;
      }
      _wireConn(incoming, null);
    });
  };

  const _connectGuest = (id, onFail) => {
    // Use default BinaryPack serialization — avoids iOS Safari json recv bug
    const c = _peer.connect(_pid(id), { reliable: true });
    _wireConn(c, onFail);
  };

  const _wireConn = (c, onFail) => {
    _conn = c;

    // Abort if channel never opens (cold start, firewall, peer gone offline)
    _openTmr = setTimeout(() => {
      if (!_connected) {
        _teardown(true);
        if (onFail) onFail('Connection timed out. Please retry.');
      }
    }, OPEN_TIMEOUT);

    c.on('open', () => {
      _openTmr    = _kt(_openTmr);
      _connected  = true;
      _reconCnt   = 0;
      _resetSeq(); // fresh sequence space per DataChannel session

      // Immediate handshake — both sides fire simultaneously
      _tx('handshake', {
        name : _myName,
        role : _isHost ? 'host' : 'guest',
        v    : PROTO_VER,
      });

      _startPing();
    });

    c.on('data',  raw => _recv(raw));
    c.on('close', ()  => _connLost());
    c.on('error', err => { console.error('[OG-NET] DataChannel error:', err); _connLost(); });
  };

  /* ── Receive pipeline ────────────────────────────────────────────────── */

  const _recv = raw => {
    if (!raw || typeof raw !== 'object') return;
    const { type, seq, data } = raw;

    // ── Control frames: bypass ordering, no seq required ─────────────────
    if (type === 'ping') {
      // Reflect ts so sender can measure RTT if desired
      _low({ type: 'pong', seq: -1, ts: raw.ts, data: null });
      return;
    }
    if (type === 'pong') {
      _pongTmr = _kt(_pongTmr);
      return;
    }

    // ── Sequenced frames ─────────────────────────────────────────────────
    if (typeof seq !== 'number') return;

    // Duplicate detection (belt-and-suspenders over SCTP ordering)
    if (_dedupe(seq)) return;

    // In-order: deliver immediately
    if (seq === _inSeq + 1) {
      _dispatch(type, data);
      _inSeq = seq;
      _drain();
      return;
    }

    // Already processed (after dedupe — extra guard)
    if (seq <= _inSeq) return;

    // Out-of-order: buffer, sorted ascending
    if (!_buf.some(m => m.seq === seq)) {
      _buf.push({ type, seq, data });
      _buf.sort((a, b) => a.seq - b.seq);
    }
  };

  const _drain = () => {
    while (_buf.length && _buf[0].seq === _inSeq + 1) {
      const m = _buf.shift();
      _dispatch(m.type, m.data);
      _inSeq = m.seq;
    }
  };

  const _dispatch = (type, data) => {
    switch (type) {

      case 'handshake':
        _oppName = (data && data.name) ? data.name : 'Opponent';
        if (!_started) {
          // First connection — start the online game
          _started = true;
          _fire('opponentJoined', _oppName);
        } else {
          // Reconnection path — host must push full state sync
          _fire('reconnected');
        }
        break;

      case 'move'  : _fire('opponentMove',   data); break;
      case 'chat'  : _fire('opponentChat',   data); break;
      case 'resign': _fire('opponentResign'       ); break;
      case 'time'  : _fire('timeUpdate',     data); break;
      case 'sync'  : _fire('stateSync',      data); break;

      default:
        // Forward-compatible: silently ignore unknown future message types
        break;
    }
  };

  /* ── Transmit ────────────────────────────────────────────────────────── */

  const _tx = (type, data) => _low({
    type,
    seq  : _outSeq++,
    ts   : Date.now(),
    data,
  });

  const _low = envelope => {
    if (!_conn || !_conn.open) return;
    try {
      _conn.send(envelope);
    } catch (e) {
      console.error('[OG-NET] Send error:', e);
    }
  };

  /* ── Keep-alive (detects stale connections SCTP did not self-close) ──── */

  const _startPing = () => {
    _pingIval = _ki(_pingIval);
    _pingIval = setInterval(() => {
      if (!_conn || !_conn.open) return;
      _low({ type: 'ping', seq: -1, ts: Date.now(), data: null });
      _pongTmr = setTimeout(() => {
        console.warn('[OG-NET] Pong timeout — treating connection as dead');
        _connLost();
      }, PONG_LIMIT);
    }, PING_MS);
  };

  const _stopPing = () => {
    _pingIval = _ki(_pingIval);
    _pongTmr  = _kt(_pongTmr);
  };

  /* ── Disconnect & reconnect ──────────────────────────────────────────── */

  const _connLost = () => {
    // Guard against double-firing (close + error can both fire)
    if (!_connected && !_started) return;
    _connected = false;
    _stopPing();
    _fire('disconnected');
    if (_started) _scheduleRecon();
  };

  const _scheduleRecon = () => {
    if (_reconTmr) return; // already queued
    if (_reconCnt >= MAX_RECON) {
      _teardown(true);
      _fire('error', 'Connection lost permanently after ' + MAX_RECON + ' retries.');
      return;
    }
    // Exponential backoff with jitter  (±10 %)
    const base  = Math.min(RECON_BASE * Math.pow(1.5, _reconCnt), RECON_CAP);
    const jitter = base * 0.1 * (Math.random() * 2 - 1);
    const delay  = Math.round(base + jitter);
    _reconCnt++;
    _reconTmr = setTimeout(() => {
      _reconTmr = null;
      _doRecon();
    }, delay);
  };

  const _doRecon = () => {
    const dead = !_peer || _peer.destroyed;
    if (dead) {
      // Full peer rebuild required
      _spawnPeer(
        _isHost ? _roomId : null,
        p => (_isHost ? _armHost(p) : _connectGuest(_roomId, null)),
        null  // non-fatal during reconnect — just retry next cycle
      );
    } else {
      // Peer signaling socket still alive — only DataChannel rebuild needed
      if (_isHost) {
        _armHost(_peer);
      } else {
        _connectGuest(_roomId, null);
      }
    }
  };

  /* ── Teardown & reset ────────────────────────────────────────────────── */

  const _teardown = hard => {
    _killAll();
    _connected = false;

    if (_conn) {
      if (typeof _conn.removeAllListeners === 'function') _conn.removeAllListeners();
      try { _conn.close(); } catch (_) { /* ignore — may already be closed */ }
      _conn = null;
    }

    if (hard && _peer) {
      if (typeof _peer.removeAllListeners === 'function') _peer.removeAllListeners();
      try { _peer.destroy(); } catch (_) { /* ignore */ }
      _peer = null;
    }
  };

  const _fullReset = () => {
    _teardown(true);
    _isHost    = false;
    _roomId    = null;
    _myName    = '';
    _oppName   = '';
    _connected = false;
    _started   = false;
    _reconCnt  = 0;
    _resetSeq();
  };

  /* ── Page Visibility — handle iOS Safari / Android backgrounding ─────── */

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && !_connected && _started) {
      // Page returned from background and connection is down — try immediately
      _scheduleRecon();
    }
  });

  /* ── Network online event — recover after total network loss ─────────── */

  window.addEventListener('online', () => {
    if (!_connected && _started) _scheduleRecon();
  });

  /* ── Public API ──────────────────────────────────────────────────────── */

  window.OG_NET = {

    on (event, fn) {
      if (Object.prototype.hasOwnProperty.call(_cb, event)) _cb[event] = fn;
      return this; // chainable
    },

    hostGame (playerName, onRoomReady) {
      _fullReset();
      _isHost = true;
      _myName = playerName || 'White';
      _roomId = _genRoomId();
      _spawnPeer(
        _roomId,
        p => {
          _armHost(p);
          if (onRoomReady) onRoomReady(_roomId);
        },
        msg => _fire('error', msg)
      );
    },

    joinGame (playerName, roomId, onFail) {
      _fullReset();
      _isHost = false;
      _myName = playerName || 'Black';
      // Sanitise input: uppercase, strip characters outside allowed set
      _roomId = String(roomId).trim().toUpperCase().replace(/[^A-Z2-9]/g, '');
      _spawnPeer(
        null,
        p => _connectGuest(_roomId, onFail),
        onFail
      );
    },

    sendMove (moveObj) {
      _tx('move', moveObj);
    },

    sendChat (text) {
      _tx('chat', { sender: _myName, text: String(text) });
    },

    sendResign () {
      _tx('resign', {});
    },

    sendTimeUpdate (whiteMs, blackMs, turn) {
      _tx('time', { white: whiteMs, black: blackMs, turn: turn });
    },

    sendStateSync (fen, moveHistory, whiteMs, blackMs, turn) {
      _tx('sync', {
        fen   : fen,
        moves : moveHistory,
        white : whiteMs,
        black : blackMs,
        turn  : turn,
      });
    },

    disconnect () {
      _fullReset();
    },

    getRoomId ()       { return _roomId;    },
    getOpponentName () { return _oppName;   },
    isHost ()          { return _isHost;    },
    isConnected ()     { return _connected; },
  };

})();
/* ═══════════════════════════════════════════════════════════════════════════
   END OF OG-NET MODULE
═══════════════════════════════════════════════════════════════════════════ */


/* ═══════════════════════════════════════════════════════════════════════════
   INTEGRATION REFERENCE  —  replace every Firebase call in your UI handlers
   ─────────────────────────────────────────────────────────────────────────
   Locate these patterns in the existing chess.html <script> and swap them:

   ── REGISTER CALLBACKS (call once inside your DOMContentLoaded / init) ──

   OG_NET
     .on('opponentJoined',  name  => {
       // REPLACES: db.ref('.../guest').on('value', snap => { if(snap.val())... })
       // your existing: updateOpponentLabel(name); startOnlineGame();
     })
     .on('opponentMove',    move  => {
       // REPLACES: db.ref('.../moves').on('child_added', snap => applyMove(snap.val()))
       // your existing: applyOpponentMove(move);
     })
     .on('opponentChat',    msg   => {
       // REPLACES: db.ref('.../chat').on('child_added', snap => showMsg(snap.val()))
       // your existing: displayChatMessage(msg.sender, msg.text);
     })
     .on('opponentResign',  ()    => {
       // REPLACES: db.ref('.../resign').on('value', ...)
       // your existing: handleOpponentResign();
     })
     .on('timeUpdate',      t     => {
       // REPLACES: db.ref('.../clock').on('value', snap => syncClock(snap.val()))
       // your existing: syncClockFromNetwork(t.white, t.black, t.turn);
     })
     .on('stateSync',       s     => {
       // NEW path: full resync after reconnect (guest side)
       // your existing: restoreGameFromSync(s.fen, s.moves, s.white, s.black, s.turn);
     })
     .on('disconnected',    ()    => {
       // REPLACES: Firebase onDisconnect / connection-state listeners
       // your existing: showReconnectingBanner();
     })
     .on('reconnected',     ()    => {
       // NEW path — host MUST push full state so guest resyncs
       // your existing: hideReconnectingBanner();
       if (OG_NET.isHost()) {
         OG_NET.sendStateSync(
           getCurrentFen(),        // your existing FEN accessor
           getMoveHistory(),       // your existing moves accessor
           getWhiteTimeMs(),       // your existing clock accessor
           getBlackTimeMs(),       // your existing clock accessor
           getCurrentTurn()        // 'w' or 'b'
         );
       }
     })
     .on('error', msg => {
       // your existing: showOnlineErrorModal(msg); closeAllOnlineModals();
     });


   ── HOST BUTTON ──────────────────────────────────────────────────────────

   // REMOVE:
   //   db.ref('rooms/' + id).set({ host: name, status: 'waiting', ... });
   //   db.ref('rooms/' + id).onDisconnect().remove();
   //   db.ref('rooms/' + id + '/guest').on('value', ...);
   //   db.ref('rooms/' + id + '/moves').on('child_added', ...);
   //   db.ref('rooms/' + id + '/chat').on('child_added', ...);

   document.getElementById('hostBtn').addEventListener('click', () => {
     const name = document.getElementById('onlineNameInput').value.trim() || 'White';
     OG_NET.hostGame(name, roomId => {
       document.getElementById('roomIdDisplay').textContent = roomId;
       showWaitingPanel(); // your existing call
     });
   });


   ── JOIN BUTTON ───────────────────────────────────────────────────────────

   // REMOVE:
   //   db.ref('rooms/' + enteredId + '/guest').set(name);
   //   db.ref('rooms/' + enteredId + '/moves').on('child_added', ...);
   //   db.ref('rooms/' + enteredId + '/chat').on('child_added', ...);

   document.getElementById('connectBtn').addEventListener('click', () => {
     const name = document.getElementById('onlineNameInput').value.trim() || 'Black';
     const id   = document.getElementById('roomIdInput').value.trim();
     if (!id) { showOnlineError('Please enter a Room ID.'); return; }
     OG_NET.joinGame(name, id, errMsg => showOnlineError(errMsg));
   });


   ── COPY ROOM ID ──────────────────────────────────────────────────────────

   document.getElementById('copyRoomIdBtn').addEventListener('click', () => {
     const id = OG_NET.getRoomId();
     if (!id) return;
     if (navigator.clipboard && navigator.clipboard.writeText) {
       navigator.clipboard.writeText(id).catch(() => _copyFallback(id));
     } else {
       _copyFallback(id);
     }
   });

   function _copyFallback(text) {
     // Covers iOS Safari < 13.4 which lacks clipboard API
     const el = document.createElement('textarea');
     el.value = text;
     el.setAttribute('readonly', '');
     el.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0';
     document.body.appendChild(el);
     el.focus();
     el.select();
     try { document.execCommand('copy'); } catch (_) { /* best-effort */ }
     document.body.removeChild(el);
   }


   ── CANCEL / LEAVE ────────────────────────────────────────────────────────

   // REMOVE:
   //   db.ref('rooms/' + roomId).off();
   //   db.ref('rooms/' + roomId).remove();

   // REPLACE WITH:
   OG_NET.disconnect();
   // then call your existing backToOnlineMenu() / showMainMenu() etc.


   ── SEND MOVE (inside your existing makeMove / executeMove function) ───────

   // REMOVE:
   //   db.ref('rooms/' + roomId + '/moves').push(moveObj);

   // REPLACE WITH:
   OG_NET.sendMove(moveObj);
   // If you also sync the clock after each move:
   OG_NET.sendTimeUpdate(getWhiteTimeMs(), getBlackTimeMs(), getCurrentTurn());


   ── SEND CHAT ─────────────────────────────────────────────────────────────

   // REMOVE:
   //   db.ref('rooms/' + roomId + '/chat').push({ sender: myName, text: msg });

   // REPLACE WITH:
   OG_NET.sendChat(chatInputEl.value.trim());


   ── RESIGN ────────────────────────────────────────────────────────────────

   // REMOVE:
   //   db.ref('rooms/' + roomId + '/resign').set(side);

   // REPLACE WITH:
   OG_NET.sendResign();

═══════════════════════════════════════════════════════════════════════════ */

Learn more:

PeerJS Documentation
changelogs.md · peers/peerjs release history
iOS Safari not receiving DataConnection message · Issue #786 · peers/peerjs
peerjs@1.5.5 - jsDocs.io
peerjs/changelog.md at master · nttcom/peerjs
SkyWay Documents
Error when sending RN · Issue #642 · peers/peerjs
peerjs Changelog
How to use TURN server with PeerJs - DEV Community
Serialization should be async · Issue #131 · peers/peerjs