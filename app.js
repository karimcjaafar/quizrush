/* ================= QuizRush =================
   Modes:
   - classic: 10 questions, per-question 15s timer, speed + streak scoring
   - sudden:  endless until first wrong answer (or timeout)
   - blitz:   3-minute global clock + 3 lives, answer as many as possible
   Questions: Open Trivia DB (https://opentdb.com)
=============================================== */

// ---------- Sound (Web Audio, no asset files) ----------
const Sound = (() => {
  let ctx = null;
  let enabled = localStorage.getItem("quizrush-sound") !== "off";

  function ac() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      // iOS: play through the media channel so the silent/ring switch doesn't
      // mute the game (the most common "I get no sound" report on iPhone)
      try { if (navigator.audioSession) navigator.audioSession.type = "playback"; } catch { /* older iOS */ }
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  // Earthy filtered-noise "whoosh" — like wind or breath, for screen changes.
  // Warm and organic rather than a clunky synth sweep.
  function whoosh({ dur = 0.75, vol = 0.05, from = 700, to = 220, when = 0, peak = 0.3 } = {}) {
    if (!enabled) return;
    try {
      vol *= Number(localStorage.getItem("quizrush-vol-sfx") ?? 100) / 100;
      if (vol <= 0) return;
      const c = ac();
      const t = c.currentTime + when;
      const buf = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1; // white noise
      const src = c.createBufferSource(); src.buffer = buf;
      const filt = c.createBiquadFilter();
      filt.type = "lowpass"; filt.Q.value = 0.6;
      filt.frequency.setValueAtTime(from, t);
      filt.frequency.exponentialRampToValueAtTime(to, t + dur);
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(vol, t + dur * peak);   // swell in
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);  // and settle out
      src.connect(filt).connect(g).connect(c.destination);
      src.start(t); src.stop(t + dur + 0.05);
    } catch { /* audio never crashes the game */ }
  }

  function tone(freq, { type = "sine", dur = 0.3, vol = 0.12, when = 0, slide = null, attack = 0.025 } = {}) {
    if (!enabled) return;
    try {
      // Apply the active sound pack's character (SOUND_PACKS is defined below;
      // tones only ever fire after the script has fully parsed)
      const packId = localStorage.getItem("quizrush-soundpack") || "classic";
      const pack = SOUND_PACKS.find((p) => p.id === packId) || SOUND_PACKS[0];
      freq *= pack.pitch;
      dur *= pack.durMult;
      vol *= Number(localStorage.getItem("quizrush-vol-sfx") ?? 100) / 100; // user mixer
      if (vol <= 0) return;
      if (pack.wave) type = pack.wave;
      if (slide) slide *= pack.pitch;

      const c = ac();
      const t = c.currentTime + when;
      const osc = c.createOscillator();
      const gain = c.createGain();
      const filter = c.createBiquadFilter();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      if (slide) osc.frequency.exponentialRampToValueAtTime(slide, t + dur);
      // soft attack + long release instead of an abrupt full-volume start,
      // and a lowpass to round off the harsh top end
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(vol, t + attack);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      filter.type = "lowpass";
      filter.frequency.value = 1150; // darker: roll off all the harsh top end
      osc.connect(gain).connect(filter).connect(c.destination);
      osc.start(t);
      osc.stop(t + dur + 0.1);
    } catch { /* audio is never worth crashing the game over */ }
  }

  // The QuizRush signature: one C-major-pentatonic motif (do–mi–sol–la) whose
  // fragments recur through every cue, so the whole app sounds like one system.
  // Small random pitch/volume jitter keeps repeated sounds from fatiguing.
  const R = (a, b) => a + Math.random() * (b - a);
  const NOTE = { C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, A5: 880, C6: 1046.5, E6: 1318.5, G6: 1568, C7: 2093 };

  return {
    get enabled() { return enabled; },
    toggle() {
      enabled = !enabled;
      try { localStorage.setItem("quizrush-sound", enabled ? "on" : "off"); } catch { /* play on */ }
      return enabled;
    },
    // iOS unlocks audio only inside a user gesture — prime the context on the
    // very first touch so every later cue can play
    unlock() { try { if (enabled) ac(); } catch { /* audio optional */ } },
    // All cues favor sine waves, low volumes, soft attacks and longer tails —
    // musical rather than arcade-y.
    // Hierarchy: clicks are the quietest, navigation/coin moderate,
    // correct/notify stronger, big rewards richest.
    // Everything sits LOW and warm, sine-based, with soft attacks — adult and
    // unobtrusive. Never bright, never piercing, never a sudden hit.
    click()   { tone(146.83, { type: "sine", dur: 0.11, vol: 0.035, attack: 0.02 }); },              // low soft tap (D3)
    start()   { tone(130.81, { type: "sine", dur: 0.55, vol: 0.06, slide: 196, attack: 0.14 }); },   // low warm rise
    // Earthy transition: a soft breath of filtered noise + a low warm swell.
    swoosh(up = true) {
      whoosh(up ? { dur: 0.9, vol: 0.05, from: 260, to: 620 } : { dur: 0.9, vol: 0.05, from: 620, to: 180 });
      tone(up ? 110 : 196, { type: "sine", dur: 0.85, vol: 0.05, slide: up ? 174 : 104, attack: 0.22 });
    },
    reveal()  { tone(146.83, { type: "sine", dur: 0.7, vol: 0.04, slide: 196, attack: 0.22 }); },     // low soft swell (D3→G3)
    correct() {
      // a warm, low, gentle two-note lift — confident but soft, never bright
      tone(196.0, { type: "sine", dur: 0.3, vol: 0.06, attack: 0.05 });                  // G3
      tone(261.63, { type: "sine", dur: 0.55, vol: 0.05, when: 0.12, attack: 0.06 });    // C4
    },
    coin() {  // soft, low, muted — a warm token 'tuk', never a sparkle
      const v = R(0.97, 1.03);
      tone(196.0 * v, { type: "sine", dur: 0.17, vol: 0.035, attack: 0.03 });
      tone(130.81 * v, { type: "sine", dur: 0.2, vol: 0.02, attack: 0.03 });
    },
    gem() {  // rarer, more precious than coin: a soft warm bell-swell, still low
      tone(130.81, { type: "sine", dur: 1.1, vol: 0.05, attack: 0.14 });                 // C3 body
      tone(196.0,  { type: "sine", dur: 1.0, vol: 0.04, when: 0.08, attack: 0.16 });      // G3 fifth
      tone(261.63, { type: "sine", dur: 0.9, vol: 0.03, when: 0.16, attack: 0.18 });      // C4 shimmer, gentle
    },
    notify() {  // two low warm notes, calm and unhurried
      tone(130.81, { type: "sine", dur: 0.45, vol: 0.05, attack: 0.06 });
      tone(196.0, { type: "sine", dur: 0.6, vol: 0.04, when: 0.18, attack: 0.07 });
    },
    wrong()   { tone(164.81, { type: "sine", dur: 0.5, vol: 0.06, slide: 123.47, attack: 0.07 }); },  // low soft descend E3→B2
    somber() {
      tone(146.83, { type: "sine", dur: 2.0, vol: 0.06, slide: 110, attack: 0.4 });      // D3 → A2, slow dark fall
      tone(196.0, { type: "sine", dur: 1.7, vol: 0.03, slide: 146.83, attack: 0.45 });
    },
    tick() {  // a soft low muted pulse, barely there — no piercing clock
      this._tock = !this._tock;
      tone(this._tock ? 174.61 : 146.83, { type: "sine", dur: 0.07, vol: 0.03, attack: 0.015 });
    },
    fanfare() {  // warm low resolution, slow and rounded
      [130.81, 164.81, 196.0].forEach((f, i) => tone(f, { type: "sine", dur: 0.9, vol: 0.055, when: i * 0.18, attack: 0.08 }));
      tone(261.63, { type: "sine", dur: 1.3, vol: 0.045, when: 0.55, attack: 0.12 });
    },
    best() {  // a warm low chord that swells in — serious, not a bright arpeggio
      [65.41, 130.81, 164.81, 196.0].forEach((f) => tone(f, { type: "sine", dur: 1.9, vol: 0.05, attack: 0.28 }));
      tone(261.63, { type: "sine", dur: 1.4, vol: 0.035, when: 0.5, attack: 0.25 });
    },
    levelUp() {  // low warm pad + a slow, dignified low rise
      tone(65.41, { type: "sine", dur: 2.6, vol: 0.06, attack: 0.35 });   // C2 bass
      tone(98.0, { type: "sine", dur: 2.6, vol: 0.04, attack: 0.35 });    // G2
      [130.81, 164.81, 196.0, 261.63].forEach((f, i) => tone(f, { type: "sine", dur: 1.0, vol: 0.05, when: 0.4 + i * 0.35, attack: 0.14 }));
    },
    // The grand cinematic score (~14s): dark sub impact → slow riser → a
    // resolving major chord swell → a calm held resolve. Serious, not childish.
    cinematic() {
      whoosh({ dur: 2.4, vol: 0.06, from: 240, to: 60 });                 // dark opening breath
      tone(41.2, { type: "sine", dur: 2.6, vol: 0.16, attack: 0.02 });    // sub impact
      tone(82.4, { type: "sine", dur: 2.6, vol: 0.07, attack: 0.02 });
      tone(60, { type: "sawtooth", dur: 7, vol: 0.028, slide: 520, attack: 1.6 });   // slow riser
      tone(90, { type: "sawtooth", dur: 7, vol: 0.016, slide: 760, attack: 1.6 });
      tone(130.81, { type: "sine", dur: 8, vol: 0.03, attack: 1.0 });     // C3 drone through the build
      const t0 = 7.6;                                                     // the climax chord (C major, wide)
      [130.81, 164.81, 196.0, 261.63, 392.0].forEach((f, i) =>
        tone(f, { type: "triangle", dur: 5.5, vol: 0.05, when: t0 + i * 0.12, attack: 0.5 }));
      whoosh({ dur: 3.6, vol: 0.05, from: 300, to: 1500, when: 7.4, peak: 0.55 }); // rising swell
      tone(523.25, { type: "sine", dur: 3.6, vol: 0.05, when: 8.3, attack: 0.7 }); // calm high resolve
    },
  };
})();

// ---------- Background music (generative, no audio files) ----------
// A faint loop: soft bass + sustained pad + plucked arpeggio over C–G–Am–F.
// Light randomization keeps it from feeling mechanical on repeat.
// ---------- Music: file-based background player ----------
// The player's own MP3 tracks (music/) replace the earlier synthesized engine.
// "auto" (default) plays a calm bed in the menus and a driving track in-game;
// or the player can pick a specific song in Customize. Same public API as before
// (start/stop/intro/skipIntro/duck/dip/setVolume/applyTrackChange/toggle) so every
// call site keeps working. Volume, mute and ducking are honoured; the browser
// caches the files after first play (service worker) for offline use.
const Music = (() => {
  const FILES = {
    ambient: "music/ambient-synth-overture.mp3",
    neon:    "music/soft-neon.mp3",
    trance:  "music/trance-overture.mp3",
  };
  const MENU_TRACK = "ambient"; // calm, for menus / traversing screens
  const GAME_TRACK = "trance";  // more drive, for an active round

  let enabled = localStorage.getItem("quizrush-music") !== "off";
  let audio = null, currentKey = null;
  let fadeTimer = null, swapTimer = null, duckTimer = null;

  const MUSIC_MAX = 0.25; // global softening cap — keep the bed quiet and gentle
  const userVol = () => Math.max(Number(localStorage.getItem("quizrush-vol-music") ?? 100) / 100, 0) * MUSIC_MAX;
  const chosen = () => localStorage.getItem("quizrush-music-track") || "auto";
  const inGame = () => (typeof state !== "undefined" && state && !state.ended);

  // Which file to play: an explicit pick always wins; otherwise auto by context.
  function resolveKey(which) {
    const pick = chosen();
    if (pick !== "auto" && FILES[pick]) return pick;
    if (which === "anthem") return MENU_TRACK;
    return inGame() ? GAME_TRACK : MENU_TRACK;
  }

  function ensureAudio() {
    if (!audio) {
      audio = new Audio();
      audio.loop = true;
      audio.preload = "auto";
    }
    return audio;
  }

  // Route the music through a gentle EQ once: trim heavy bass + soften sharp
  // highs, for a warm bed rather than a loud one. Falls back to direct playback
  // if Web Audio routing isn't available.
  let actx = null, graphed = false;
  function ensureGraph() {
    if (graphed) { if (actx && actx.state === "suspended") actx.resume().catch(() => {}); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC || !audio) return;
      actx = new AC();
      const src = actx.createMediaElementSource(audio);
      const low = actx.createBiquadFilter(); low.type = "lowshelf"; low.frequency.value = 180; low.gain.value = -8;
      const high = actx.createBiquadFilter(); high.type = "highshelf"; high.frequency.value = 3800; high.gain.value = -7;
      src.connect(low); low.connect(high); high.connect(actx.destination);
      graphed = true;
      if (actx.state === "suspended") actx.resume().catch(() => {});
    } catch { /* EQ unavailable — plays directly, just quieter */ }
  }

  // Smoothly ramp audio.volume toward target over ms.
  function fadeTo(target, ms) {
    clearInterval(fadeTimer);
    if (!audio) return;
    target = Math.min(1, Math.max(0, target));
    const from = audio.volume, t0 = performance.now();
    fadeTimer = setInterval(() => {
      const k = Math.min(1, (performance.now() - t0) / ms);
      audio.volume = Math.min(1, Math.max(0, from + (target - from) * k));
      if (k >= 1) clearInterval(fadeTimer);
    }, 40);
  }

  // Switch to a track with a short cross-dip (fade out old → swap → fade in new).
  function playKey(key) {
    ensureAudio();
    if (!FILES[key]) return;
    clearTimeout(swapTimer); // cancel any pending stop/pause first (mute→unmute race)
    if (currentKey === key && !audio.paused) { fadeTo(userVol(), 400); return; }
    const startNew = () => {
      currentKey = key;
      ensureGraph();
      audio.src = FILES[key];
      try { audio.currentTime = 0; } catch { /* not yet seekable */ }
      audio.volume = 0;
      const p = audio.play();
      if (p && p.catch) p.catch(() => { /* autoplay blocked until a gesture */ });
      fadeTo(userVol(), 800);
    };
    if (!audio.paused && audio.src) {
      fadeTo(0, 260);
      swapTimer = setTimeout(startNew, 280);
    } else {
      startNew();
    }
  }

  return {
    get enabled() { return enabled; },
    get playing() { return !!(audio && !audio.paused); },
    get activeKey() { return currentKey; },
    get ctxState() { return actx ? actx.state : "none"; },
    toggle() {
      enabled = !enabled;
      try { localStorage.setItem("quizrush-music", enabled ? "on" : "off"); } catch { /* play on */ }
      if (!enabled) this.stop(); else this.start();
      return enabled;
    },
    // which: "anthem" forces the menu bed; omit for context-based (menu vs game).
    // An explicit track choice in Customize overrides both.
    start(which) {
      if (!enabled) return;
      playKey(resolveKey(which));
    },
    // Force a specific track regardless of the Customize pick (e.g. Blitz's fixed bed).
    play(key) {
      if (!enabled) return;
      playKey(key);
    },
    stop() {
      clearTimeout(swapTimer);
      if (!audio) return;
      fadeTo(0, 600);
      swapTimer = setTimeout(() => { try { audio.pause(); currentKey = null; } catch { /* gone */ } }, 640);
    },
    // On the splash: begin the menu bed (the gate tap is the audio unlock).
    intro() {
      if (!enabled) return;
      playKey(MENU_TRACK);
    },
    skipIntro() { if (enabled) this.start("anthem"); },
    // Briefly dip under a transition, then swell back.
    duck() {
      if (!audio || audio.paused) return;
      const base = userVol();
      fadeTo(base * 0.4, 180);
      clearTimeout(duckTimer);
      duckTimer = setTimeout(() => fadeTo(base, 900), 400);
    },
    // Hold low under a long cinematic, then swell back.
    dip(depth = 0.14, holdMs = 13000) {
      if (!audio || audio.paused) return;
      const base = userVol();
      fadeTo(base * depth, 700);
      clearTimeout(duckTimer);
      duckTimer = setTimeout(() => fadeTo(base, 1300), Math.max(0, holdMs));
    },
    // Live volume from the mixer slider (0..1).
    setVolume(v) {
      if (audio && !audio.paused) fadeTo(v * MUSIC_MAX, 150);
    },
    // The Customize track picker changed: switch live, respecting the new choice.
    applyTrackChange() {
      if (!enabled) return;
      this.start(inGame() ? undefined : "anthem");
    },
  };
})();
const OTDB_API = "https://opentdb.com";
const TTA_API = "https://the-trivia-api.com/v2";
// The Trivia API is CC BY-NC (non-commercial). Flip this to false for a
// commercial build: the broker then runs on Open Trivia DB + our own bank only.
const INCLUDE_NC_SOURCES = true;
const QUESTION_TIME = 20;      // seconds per question (classic / custom / sudden)
const DAILY_TIME = { easy: 10, medium: 15, hard: 20 }; // daily: thinking time scales with difficulty
const BLITZ_TIME = 180;        // seconds total (blitz — 3-minute round)
const BLITZ_LIVES = 3;         // wrong answers allowed before the blitz round ends
const BLITZ_TRACK = "trance";  // the driving overture — Blitz's signature bed (see Music.FILES)
const RING_CIRC = 213.6;       // 2πr of the timer ring

const MODES = {
  classic: { label: "Classic", emoji: "🎯" },
  custom:  { label: "Your Rules", emoji: "🎛️" },
  sudden:  { label: "Sudden Death", emoji: "💀" },
  blitz:   { label: "Blitz", emoji: "⏱️" },
  whoami:  { label: "Who Am I?", emoji: "🕵️" },
  dingbats: { label: "Say What You See", emoji: "👀" },
};

const DINGBAT_ROUND = 8;      // puzzles per round
const DINGBAT_VALUE = 300;    // starting worth; wrong guesses and hints reduce it
const DINGBAT_WRONG_COST = 50;
const DINGBAT_HINT_COST = 100;
const DINGBAT_FLOOR = 100;    // a solve is never worth less than this

const WHOAMI_ROUND = 5;                    // characters per round
const WHOAMI_POINTS = [400, 300, 200, 100]; // payout by clue stage when solved

// Classic ladder: every level is a 10-question blend that tilts harder as you
// climb — mostly easy at L1, nearly all hard at L10, all hard beyond. The
// clock stays constant; the pass bar rises near the top.
// Gentle early game — Level 1 is all-easy from common topics, ramping to
// all-hard (expert) by Level 10. Easy really means easy so nobody bounces off.
const LEVEL_MIXES = [
  { easy: 10, medium: 0, hard: 0 },  // L1
  { easy: 9,  medium: 1, hard: 0 },  // L2
  { easy: 7,  medium: 3, hard: 0 },  // L3
  { easy: 5,  medium: 4, hard: 1 },  // L4
  { easy: 3,  medium: 5, hard: 2 },  // L5
  { easy: 2,  medium: 5, hard: 3 },  // L6
  { easy: 1,  medium: 4, hard: 5 },  // L7
  { easy: 0,  medium: 3, hard: 7 },  // L8
  { easy: 0,  medium: 1, hard: 9 },  // L9
  { easy: 0,  medium: 0, hard: 10 }, // L10
];
const levelMix = (lvl) => (lvl <= 10 ? LEVEL_MIXES[lvl - 1] : { easy: 0, medium: 0, hard: 10 });
const LEVEL_RULES = (lvl) => ({ mix: levelMix(lvl), need: lvl <= 6 ? 7 : lvl <= 8 ? 8 : 9 });
const mixLabel = (m) =>
  ["easy", "medium", "hard"].filter((d) => m[d]).map((d) => `${m[d]} ${d}`).join(" · ");
// Early levels draw from the most universally-known topics; later levels widen
const levelScope = (lvl) => (lvl <= 3 ? "common" : "core");

// ---------- Core vs niche categories for mixed rounds ----------
// Classic / Sudden / Blitz stick to core trivia; niche topics (celebrities,
// niche pop-culture) are left to their own Specials packs, appearing here only
// rarely. "Common" is the most broadly-known subset used for very-easy play.
const CORE_TRIVIA_CATIDS = ["general", "geography", "sport", "science", "history", "entertainment", "arts", "politics", "popculture"];
const COMMON_TRIVIA_CATIDS = ["general", "geography", "sport", "science", "history", "entertainment"];
// OpenTDB's Sports category (21) is heavily American (NFL/NBA/MLB), which
// alienates a UK audience — sport in the mix comes from The Trivia API (UK-made,
// football/cricket/rugby leaning) instead. 21 is still used by the Sport pack.
const CORE_OTDB = [9, 22, 23, 17, 11, 12, 25, 10, 24];
const COMMON_OTDB = CORE_OTDB;
const CORE_TTA = ["general_knowledge", "geography", "history", "science", "society_and_culture", "arts_and_literature", "sport_and_leisure", "music", "film_and_tv"];
// "Common" gentleness comes from serving easy-difficulty questions across the
// same broad topics, not from narrowing categories (which just floods one topic)
const COMMON_TTA = CORE_TTA;

// UK-focused content filter: drop questions too niche/alienating for a UK
// audience (American football above all, plus other US-only sports). Applied
// to every API-sourced question so they can never appear from the live sources.
const UNFRIENDLY = [
  /american football|\bnfl\b|super bowl|superbowl|quarterback|touchdown|linebacker|gridiron|\bnfc\b|\bafc east|afc west|afc north|afc south\b/i,
  /\bmlb\b|major league baseball|world series/i,
  /\bnba\b|\bnhl\b/i,
  /nascar|indycar|daytona 500/i,
];
function isUnfriendly(q) {
  const hay = (q.text + " " + q.correct + " " + (q.answers || q.wrong || []).join(" ")).toLowerCase();
  return UNFRIENDLY.some((re) => re.test(hay));
}

// Sub-topic key so a single round never clusters on one specific sport — three
// different sports is fine; three American-football (or three of anything) isn't.
const SPORT_SUBS = [
  [/american football|nfl|super bowl/i, "amfootball"],
  [/\bcricket\b|wicket|bowler|batsman/i, "cricket"],
  [/\brugby\b|scrum|try |six nations/i, "rugby"],
  [/tennis|wimbledon|grand slam|\bace\b/i, "tennis"],
  [/\bgolf\b|par |birdie|the open\b/i, "golf"],
  [/basketball|\bnba\b|slam dunk/i, "basketball"],
  [/baseball|\bmlb\b|home run/i, "baseball"],
  [/box(ing|er)|heavyweight|knockout/i, "boxing"],
  [/formula 1|f1\b|grand prix|nascar/i, "motorsport"],
  [/olympic|olympics/i, "olympics"],
  [/football|soccer|fifa|premier league|world cup/i, "football"],
];
function topicKey(q) {
  if (q.catId !== "sport") return q.catId || "?";
  const hay = (q.text + " " + (q.answers || []).join(" ")).toLowerCase();
  const sub = SPORT_SUBS.find(([re]) => re.test(hay));
  return sub ? "sport:" + sub[1] : "sport";
}

const TIER_LABEL = { easy: "Easy", medium: "Medium", hard: "Hard" };
const capDiff = (d) => TIER_LABEL[d] || d;

// Sudden Death difficulty ramp by served position: gentle start, brutal tail
const SUDDEN_RAMP = [
  ["easy", "Very Easy"], ["easy", "Very Easy"], ["easy", "Very Easy"],
  ["easy", "Easy"], ["easy", "Easy"], ["easy", "Easy"],
  ["medium", "Medium"], ["medium", "Medium"], ["medium", "Medium"],
  ["hard", "Hard"], ["hard", "Hard"], ["hard", "Hard"], ["hard", "Hard"],
];
const suddenTier = (i) => SUDDEN_RAMP[i] || ["hard", "Expert"]; // beyond the ramp: Expert forever

const BADGES = [
  { id: "first",      emoji: "🎬", name: "Opening Night",   desc: "Play your first game" },
  { id: "streak5",    emoji: "🔥", name: "On Fire",         desc: "Reach a 5-answer streak" },
  { id: "streak10",   emoji: "🌋", name: "Unstoppable",     desc: "Reach a 10-answer streak" },
  { id: "perfect",    emoji: "💯", name: "Perfectionist",   desc: "Score 10/10 in a Classic round" },
  { id: "survivor10", emoji: "🛡️", name: "Survivor",        desc: "Clear 10 questions in Sudden Death" },
  { id: "blitz15",    emoji: "⚡", name: "Lightning Round", desc: "15 correct in one Blitz" },
  { id: "sharp",      emoji: "🎯", name: "Sharpshooter",    desc: "100% accuracy, 5+ questions" },
  { id: "owl",        emoji: "🦉", name: "Night Owl",       desc: "Finish a game after midnight" },
  { id: "allmodes",   emoji: "🎮", name: "Triple Threat",   desc: "Play all three trivia modes" },
  { id: "hardcore",   emoji: "🧠", name: "Hard Boiled",     desc: "Score 9/10 or better on a Classic level" },
  { id: "climber",    emoji: "🪜", name: "Climber",         desc: "Reach Level 3 in Classic" },
  { id: "summit",     emoji: "🏔️", name: "Summit",          desc: "Reach Level 6 in Classic" },
  { id: "ten",        emoji: "🔟", name: "Perfect Ten",     desc: "Reach Level 10 in Classic" },
  { id: "daily",      emoji: "📅", name: "Daily Devotee",   desc: "Solve a Daily Challenge" },
];

// Player titles, earned by XP level
const TITLES = [
  { level: 1,  name: "Trivia Novice" },
  { level: 3,  name: "Pub Quizzer" },
  { level: 5,  name: "Quiz Whiz" },
  { level: 8,  name: "Trivia Ace" },
  { level: 12, name: "Quizmaster" },
  { level: 16, name: "Trivia Sage" },
  { level: 20, name: "Grand Sage" },
];
const titleForLevel = (lvl) => [...TITLES].reverse().find((t) => lvl >= t.level).name;

// Sound packs — same synthesized cues, different character. Unlocked by badge count.
const SOUND_PACKS = [
  { id: "classic",  name: "Classic",   badges: 0,  wave: null,       pitch: 1,    durMult: 1 },
  { id: "arcade",   name: "Arcade",    badges: 5,  wave: "square",   pitch: 1.5,  durMult: 0.8 },
  { id: "gameshow", name: "Game Show", badges: 9,  wave: "triangle", pitch: 0.75, durMult: 1.35 },
];

// App icons (PWA) — unlocked by badge count. Swapping updates the manifest link,
// which takes effect when the app is added to a home screen.
const APP_ICONS = [
  { id: "bolt",  name: "Bolt",  badges: 0,  emoji: "⚡" },
  { id: "star",  name: "Star",  badges: 6,  emoji: "⭐" },
  { id: "crown", name: "Crown", badges: 10, emoji: "👑" },
];

// Category mastery medals: total correct answers per category
const MASTERY = [
  { at: 120, medal: "🥇" },
  { at: 50,  medal: "🥈" },
  { at: 20,  medal: "🥉" },
];

// Unlockable music tracks — criteria deliberately span different systems, so
// different play styles unlock different songs. Checked lazily at paint time.
// The player's own tracks. "Auto" plays a calm bed in menus and a driving track
// in a round; the three songs can also be chosen outright. All freely available.
const MUSIC_TRACKS = [
  { id: "auto",    name: "Auto",          icon: "✨", req: "Calm in menus, driving in a round", unlock: () => true },
  { id: "ambient", name: "Ambient Synth", icon: "🌌", req: "",                                  unlock: () => true },
  { id: "neon",    name: "Soft Neon",     icon: "🌆", req: "",                                  unlock: () => true },
  { id: "trance",  name: "Trance",        icon: "🎛️", req: "",                                  unlock: () => true },
];

// Unlockable color themes — the Daily Challenge reward. Unlocks are keyed to the
// best daily streak ever reached, so a broken streak never re-locks a theme.
const THEMES = [
  { id: "midnight", name: "Midnight", streak: 0 },
  { id: "sunset",   name: "Sunset",   streak: 1 },
  { id: "ocean",    name: "Ocean",    streak: 3 },
  { id: "forest",   name: "Forest",   streak: 7 },
  { id: "gold",     name: "Gold",     streak: 14 },
];

// QuizRush's own category taxonomy. Each maps to source-specific queries:
// `otdb` = Open Trivia DB category ids, `tta` / `ttaTags` = The Trivia API filters.
// An empty list means that source doesn't cover the category and is skipped.
const CATEGORIES = [
  { id: "sport",     name: "Sport & Games",        emoji: "🏅", otdb: [21, 16],                       tta: ["sport_and_leisure"] },
  { id: "science",   name: "Science & Tech",       emoji: "🔬", otdb: [17, 18, 19, 27, 28, 30],       tta: ["science"] },
  { id: "history",   name: "History",              emoji: "🏛️", otdb: [23, 20],                      tta: ["history"] },
  { id: "geography", name: "Geography",            emoji: "🌍", otdb: [22],                           tta: ["geography"] },
  { id: "politics",  name: "Politics & Society",   emoji: "🗳️", otdb: [24],                          tta: ["society_and_culture"] },
  { id: "entertainment", name: "Music & Entertainment", emoji: "🎬", otdb: [11, 12, 13, 14, 15, 29, 31, 32], tta: ["film_and_tv", "music"] },
  { id: "arts",      name: "Arts & Literature",    emoji: "📚", otdb: [10, 25],                       tta: ["arts_and_literature"] },
  { id: "celebs",    name: "Celebrity Culture",    emoji: "⭐", otdb: [26],                           tta: [], ttaTags: ["actors", "musicians", "singers"] },
  { id: "popculture", name: "Pop Culture",         emoji: "🕶️", otdb: [], tta: [], bank: true },
  { id: "food",      name: "Food & Drink",         emoji: "🍕", otdb: [],                             tta: ["food_and_drink"] },
  { id: "general",   name: "General Knowledge",    emoji: "🧠", otdb: [9],                            tta: ["general_knowledge"] },
  { id: "logic",     name: "Logic & Riddles",      emoji: "🧩", otdb: [],                             tta: [], bank: true },
  { id: "numbers",   name: "Number Games",         emoji: "🔢", otdb: [],                             tta: [], bank: true },
  { id: "flags",     name: "Flags",                emoji: "🚩", otdb: [],                             tta: [], bank: true },
  // Specialist packs: bank-only, live on the Specials shelf, hidden from the
  // Your Rules category chips so the core quiz stays uncluttered.
  { id: "animals",   name: "Animals & Nature",     emoji: "🐾", otdb: [], tta: [], bank: true, special: true },
  { id: "myth",      name: "Mythology",            emoji: "🔱", otdb: [], tta: [], bank: true, special: true },
  { id: "decades",   name: "Music Decades",        emoji: "🎸", otdb: [], tta: [], bank: true, special: true },
  { id: "space",     name: "Space",                emoji: "🚀", otdb: [], tta: [], bank: true, special: true },
  { id: "worldcup",  name: "World Cup",            emoji: "⚽", otdb: [], tta: [], bank: true, special: true },
  { id: "starwars",  name: "Star Wars",            emoji: "🛸", otdb: [], tta: [], bank: true, special: true },
  { id: "british",   name: "British Quiz",         emoji: "🇬🇧", otdb: [], tta: [], bank: true, special: true },
  // Picture rounds beyond flags: hidden from Your Rules chips (special) but
  // they live in the Picture Round menu, not the Specialist Packs menu
  { id: "shapes",    name: "Country Shapes",       emoji: "🗺️", otdb: [], tta: [], bank: true, special: true, picture: true },
  { id: "emovies",   name: "Emoji Films",          emoji: "🎬", otdb: [], tta: [], bank: true, special: true, picture: true },
];

// Maps source-category display names back to our taxonomy, so mastery stats
// can attribute questions from mixed "Any" games. Unknown names are skipped.
const NAME_TO_CAT = {};
CATEGORIES.forEach((c) => { NAME_TO_CAT[c.name.toLowerCase()] = c.id; });
Object.assign(NAME_TO_CAT, {
  "sports": "sport", "board games": "sport", "sport & leisure": "sport",
  "science & nature": "science", "computers": "science", "mathematics": "science",
  "gadgets": "science", "animals": "science", "vehicles": "science", "science": "science",
  "history": "history", "mythology": "history",
  "geography": "geography",
  "politics": "politics", "society & culture": "politics",
  "film": "entertainment", "music": "entertainment", "television": "entertainment",
  "video games": "entertainment", "musicals & theatres": "entertainment",
  "comics": "entertainment", "anime & manga": "entertainment",
  "cartoon & animations": "entertainment", "film & tv": "entertainment",
  "books": "arts", "art": "arts", "arts & literature": "arts",
  "celebrities": "celebs",
  "food & drink": "food",
  "general knowledge": "general",
});

// ---------- Persistent player data ----------
function getJSON(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}
// Storage writes must never break gameplay (private browsing / full quota)
function setJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* play on */ }
}
function safeSetItem(key, value) {
  try { localStorage.setItem(key, value); } catch { /* play on */ }
}

const player = {
  get xp() { return Number(localStorage.getItem("quizrush-xp") || 0); },
  set xp(v) { safeSetItem("quizrush-xp", String(v)); },
  get badges() { return getJSON("quizrush-badges", []); },
  set badges(v) { setJSON("quizrush-badges", v); },
  get modesPlayed() { return getJSON("quizrush-modes", []); },
  set modesPlayed(v) { setJSON("quizrush-modes", v); },
  get daily() { return getJSON("quizrush-daily", null); }, // { date, status: "pending"|"right"|"wrong", score }
  set daily(v) { setJSON("quizrush-daily", v); },
  get dailyStreak() { return getJSON("quizrush-daily-streak", { count: 0, last: "" }); },
  set dailyStreak(v) { setJSON("quizrush-daily-streak", v); },
  get bestDailyStreak() { return Number(localStorage.getItem("quizrush-daily-best") || 0); },
  set bestDailyStreak(v) { safeSetItem("quizrush-daily-best", String(v)); },
  get theme() { return localStorage.getItem("quizrush-theme") || "midnight"; },
  set theme(v) { safeSetItem("quizrush-theme", v); },
  get bestClassicLevel() { return Number(localStorage.getItem("quizrush-best-level") || 1); },
  set bestClassicLevel(v) { safeSetItem("quizrush-best-level", String(v)); },
  get tokens() { return Number(localStorage.getItem("quizrush-tokens") || 0); },
  set tokens(v) { safeSetItem("quizrush-tokens", String(Math.max(0, v))); },
  // Gems: the rare, precious currency. Earned only at big moments (milestone
  // levels, perfect rounds, daily-streak milestones) or bought; spent on exclusive
  // things. `gold` is just a friendlier alias for the plentiful `tokens` currency.
  get gold() { return this.tokens; },
  set gold(v) { this.tokens = v; },
  get gems() { return Number(localStorage.getItem("quizrush-gems") || 0); },
  set gems(v) { safeSetItem("quizrush-gems", String(Math.max(0, v))); },
  get streakFreezes() { return Number(localStorage.getItem("quizrush-freezes") || 0); },
  set streakFreezes(v) { safeSetItem("quizrush-freezes", String(Math.max(0, v))); },
  get ownedThemes() { return getJSON("quizrush-owned-themes", []); },
  set ownedThemes(v) { setJSON("quizrush-owned-themes", v); },
  get lastLoginBonus() { return localStorage.getItem("quizrush-login-bonus") || ""; },
  set lastLoginBonus(v) { safeSetItem("quizrush-login-bonus", v); },
  get catStats() { return getJSON("quizrush-catstats", {}); },
  set catStats(v) { setJSON("quizrush-catstats", v); },
  get soundPack() { return localStorage.getItem("quizrush-soundpack") || "classic"; },
  set soundPack(v) { safeSetItem("quizrush-soundpack", v); },
  get appIcon() { return localStorage.getItem("quizrush-appicon") || "bolt"; },
  set appIcon(v) { safeSetItem("quizrush-appicon", v); },
  get profile() { return getJSON("quizrush-profile", null); }, // { name, avatar }
  set profile(v) { setJSON("quizrush-profile", v); },
  get musicTrack() { return localStorage.getItem("quizrush-music-track") || "auto"; },
  set musicTrack(v) { safeSetItem("quizrush-music-track", v); },
};

const AVATARS = ["😀","😎","🤓","🥸","🦊","🐼","🐸","🦁","🐯","🦉","🐙","🦄","🐢","👾","🤖","🚀","🌟","🍕","🎸","🧠"];

function recordCatStat(catId, wasCorrect) {
  if (!catId) return;
  const stats = player.catStats;
  const s = stats[catId] || { correct: 0, answered: 0 };
  s.answered++;
  if (wasCorrect) s.correct++;
  stats[catId] = s;
  player.catStats = stats;
}

function medalFor(catId) {
  const s = player.catStats[catId];
  if (!s) return "";
  return MASTERY.find((m) => s.correct >= m.at)?.medal || "";
}

// ---------- Token economy ----------
// Free to play forever; tokens are earned through play and spent on comforts
// (lifeline refills, Sudden Death revives, streak freezes) and optional
// cosmetics. Real-money token packs are SIMULATED until launch (DEMO_STORE).
const START_TOKENS = 25;      // one-time welcome grant
const LOGIN_BONUS = 5;        // first open of the day
const LEVELUP_TOKENS = 5;     // per XP level gained in a game
const BADGE_TOKENS = 10;      // per new badge earned
const STREAK_FREEZE_COST = 40;
const MAX_FREEZES = 3;

// ---------- Gems: the rare, precious currency ----------
// Gems are hard to earn (big moments only) and unlock exclusive things Gold can't.
// Being the superior currency, they can also be melted down into a pile of Gold.
const GEM_MILESTONE = { 5: 2, 10: 5 };  // Classic milestone levels → gems
const GEM_PERFECT = 1;                  // a flawless 10/10 Classic level
const GEM_STREAK = { 3: 1, 7: 3, 14: 5, 30: 12 }; // daily-streak milestones → gems
const GOLD_PER_GEM = 60;                // exchange rate when melting gems into Gold

// Premium themes — now EXCLUSIVE (gem-priced): the rare currency buys the rare
// cosmetics. Palettes are defined in style.css.
const SHOP_THEMES = [
  { id: "aurora",  name: "Aurora",  gems: 12 },
  { id: "crimson", name: "Crimson", gems: 12 },
  { id: "mono",    name: "Mono",    gems: 8 },
];

// Real-money packs — shown with real prices so testers see the true flow, but
// purchases are free in demo mode. Flip DEMO_STORE off + wire Stripe at launch.
const DEMO_STORE = true;
const TOKEN_PACKS = [
  { id: "small",  tokens: 50,  price: "£0.99" },
  { id: "medium", tokens: 150, price: "£1.99", tag: "Popular" },
  { id: "large",  tokens: 500, price: "£4.99", tag: "Best value" },
];
// Premium gem packs — the exclusive currency, small amounts, honestly priced.
const GEM_PACKS = [
  { id: "gsmall",  gems: 10, price: "£1.99" },
  { id: "gmedium", gems: 30, price: "£4.99", tag: "Popular" },
  { id: "glarge",  gems: 75, price: "£9.99", tag: "Best value" },
];

// Award gems for a big moment: bank them, then celebrate (animation + toast).
// Kept deliberately rare so a gem always feels earned. Returns the amount given.
function awardGems(n, reason) {
  if (!n || n <= 0) return 0;
  player.gems += n;
  window.__gemGain = (window.__gemGain || 0) + n;
  if (reason) toast(`💎 +${n} — ${reason}`);
  try { Sound.gem && Sound.gem(); } catch {}
  paintCurrencies();
  return n;
}

function dateKeyOffset(n) {
  const d = new Date(Date.now() + n * 86400000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Run once at startup: welcome grant + daily login bonus + auto streak-freeze
function runEconomyOnLoad() {
  if (!localStorage.getItem("quizrush-welcomed-tokens")) {
    player.tokens += START_TOKENS;
    safeSetItem("quizrush-welcomed-tokens", "1");
  }
  const today = todayKey();
  if (player.lastLoginBonus !== today) {
    player.tokens += LOGIN_BONUS;
    player.lastLoginBonus = today;
    window.__loginBonus = LOGIN_BONUS; // surfaced as a toast after render
  }
  // Streak freeze: if exactly yesterday was missed and a freeze is held, spend
  // it to bridge the gap so a valued streak survives one skipped day.
  const s = player.dailyStreak;
  if (s.count > 0 && s.last === dateKeyOffset(-2) && player.streakFreezes > 0) {
    player.streakFreezes -= 1;
    player.dailyStreak = { count: s.count, last: yesterdayKey() };
    window.__freezeUsed = true;
  }
}

// ---------- Backend (leaderboards + global answer stats) ----------
// Points at the Cloudflare Worker in backend/. The localStorage override
// exists for local development; if the server is ever unreachable, every Net
// call fails silently and the game plays on unaffected.
const BACKEND_URL = localStorage.getItem("quizrush-backend") || "https://quizrush-api.karimcjaafar.workers.dev";

// Every backend call is time-boxed: a slow or hung server can never stall
// gameplay (the cause of the "froze for a second on answering" reports).
function fetchTimeout(url, opts = {}, ms = 3000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(t));
}

const Net = {
  deviceId() {
    let id = localStorage.getItem("quizrush-device");
    if (!id) {
      id = Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem("quizrush-device", id);
    }
    return id;
  },
  async post(path, body) {
    if (!BACKEND_URL) return null;
    try {
      const res = await fetchTimeout(BACKEND_URL + path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      return res.ok ? res.json() : null;
    } catch { return null; }
  },
  async get(path) {
    if (!BACKEND_URL) return null;
    try {
      const res = await fetchTimeout(BACKEND_URL + path);
      return res.ok ? res.json() : null;
    } catch { return null; }
  },
};

// Stable anonymous key for a question (text + visual)
function qHash(q) {
  const s = q.text + (q.big || "");
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

function queueAnswerStat(q, wasCorrect) {
  if (!BACKEND_URL || !state) return;
  (state.pendingAnswers = state.pendingAnswers || []).push({ k: qHash(q), c: wasCorrect ? 1 : 0 });
}

function flushAnswerStats() {
  if (state?.pendingAnswers?.length) {
    Net.post("/answers", state.pendingAnswers);
    state.pendingAnswers = [];
  }
}

// After the reveal, show how the world did on this question
async function showGlobalStat(q) {
  const el = $("global-stat");
  el.hidden = true;
  if (!BACKEND_URL) return;
  const stats = await Net.get(`/stats?k=${qHash(q)}`);
  const total = (stats?.right || 0) + (stats?.wrong || 0);
  if (total >= 5 && state && state.questions[state.index] === q) {
    el.textContent = `🌍 ${Math.round((stats.right / total) * 100)}% of players got this right`;
    el.hidden = false;
  }
}

// ---------- "Tell me more": inline learning via Wikipedia ----------
// Free, CORS-friendly, no key. Falls back to a search link when a topic has
// no clean summary page.
async function renderLearn(panel, topic) {
  panel.hidden = false;
  panel.innerHTML = `<p class="learn-loading">Looking it up…</p>`;
  const searchLink = `<a href="https://en.wikipedia.org/w/index.php?search=${encodeURIComponent(topic)}" target="_blank" rel="noopener">Search Wikipedia →</a>`;
  try {
    const res = await fetch("https://en.wikipedia.org/api/rest_v1/page/summary/" + encodeURIComponent(topic));
    const d = res.ok ? await res.json() : null;
    if (d?.extract && d.type === "standard") {
      const url = d.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(topic)}`;
      panel.innerHTML =
        `<h4>${escapeHtml(d.title)}</h4><p>${escapeHtml(d.extract)}</p>` +
        `<a href="${escapeHtml(url)}" target="_blank" rel="noopener">Read more on Wikipedia →</a>`;
    } else {
      panel.innerHTML = `<p>No quick summary for this one.</p>${searchLink}`;
    }
  } catch {
    panel.innerHTML = searchLink;
  }
}

// Eligible when pausing is fair: not blitz (global clock), not party (shared
// device pacing), and not a reveal that ends the game anyway.
function offerLearnMore() {
  const eligible = ["classic", "custom", "sudden"].includes(state.mode);
  $("learn-row").hidden = !eligible;
  $("btn-learn").hidden = !eligible;
  $("btn-learn-continue").hidden = true;
}

// ---------- Nemesis questions ----------
// Questions you miss come back in later games (tagged 😈, worth 1.5×) until
// you beat them. Capped so the list stays a grudge, not a graveyard.
const NEMESIS_CAP = 30;

// Question identity = text + visual (picture rounds share their prompt text)
const nemesisKey = (q) => q.text + (q.big || "") + (q.vid || "");

function recordNemesis(q) {
  // the daily stays a one-shot; party answers belong to guests, not the owner
  if (state?.mode === "daily" || state?.mode === "party") return;
  const list = getJSON("quizrush-nemesis", []);
  if (list.some((n) => nemesisKey(n) === nemesisKey(q))) return;
  list.push({ category: q.category, catId: q.catId || "", difficulty: q.difficulty,
              text: q.text, big: q.big || "", correct: q.correct, answers: q.answers });
  while (list.length > NEMESIS_CAP) list.shift();
  setJSON("quizrush-nemesis", list);
}

function clearNemesis(q) {
  setJSON("quizrush-nemesis", getJSON("quizrush-nemesis", []).filter((n) => nemesisKey(n) !== nemesisKey(q)));
}

function pickNemeses(catId, difficulty, max = 2) {
  const list = getJSON("quizrush-nemesis", []).filter((n) =>
    (!difficulty || n.difficulty === difficulty) && (!catId || n.catId === catId));
  return shuffle(list).slice(0, max)
    .map((n) => ({ ...n, answers: shuffle(n.answers), nemesis: true }));
}

// Level L starts at 75·L·(L−1) total XP, so each level costs 150·L XP
function levelFromXp(xp) {
  let lvl = 1;
  while (xp >= 75 * (lvl + 1) * lvl) lvl++;
  return lvl;
}
function levelProgress(xp) {
  const lvl = levelFromXp(xp);
  const floor = 75 * lvl * (lvl - 1);
  return { lvl, into: xp - floor, needed: 150 * lvl };
}

// ---------- Daily challenge ----------
function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function yesterdayKey() {
  const d = new Date(Date.now() - 86400000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// One exact question per date, picked deterministically from our own bank —
// every player gets the same daily, and the content is fully owned (no license).
// The category hops pseudo-randomly day to day (hash, not rotation). Pool
// sizes are pinned so appending bank questions never reshuffles past or future
// dailies — only ever append to the bank, and bump a pool size deliberately.
const DAILY_POOLS = [
  ["logic", 45], ["numbers", 15], ["flags", 80],
  ["sport", 10], ["science", 10], ["history", 10], ["geography", 10],
  ["politics", 10], ["entertainment", 10], ["arts", 10], ["celebs", 10],
  ["food", 10], ["general", 10],
  // broad specialist packs join the rotation; fandom packs (worldcup,
  // starwars, british) stay pack-only so dailies remain universal
  ["animals", 24], ["myth", 24], ["decades", 24], ["space", 24],
  ["shapes", 30], ["emovies", 24],
];
function dailyQuestion() {
  const d = new Date();
  const seed = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  const h = (seed * 2654435761) >>> 0; // scramble so categories don't cycle predictably
  const [dayCat, poolSize] = DAILY_POOLS[h % DAILY_POOLS.length];
  const pool = QUIZRUSH_BANK.filter((q2) => q2.cat === dayCat).slice(0, poolSize);
  const q = pool[(h >>> 8) % pool.length];
  const cat = CATEGORIES.find((c) => c.id === q.cat);
  return {
    question: {
      category: cat?.name || "Riddle & Rune",
      catId: q.cat,
      difficulty: q.difficulty,
      text: q.text,
      correct: q.correct,
      answers: shuffle([q.correct, ...q.wrong]),
      big: q.big || "",       // flags / emoji rebuses show their picture
      svgPath: q.svgPath || "", // country-shape silhouettes
      vid: q.vid || "",
    },
    difficulty: q.difficulty,
    cat,
  };
}

// The streak only counts if it's still alive (success today or yesterday)
function liveDailyStreak() {
  const s = player.dailyStreak;
  return s.last === todayKey() || s.last === yesterdayKey() ? s.count : 0;
}

// ---------- DOM ----------
const $ = (id) => document.getElementById(id);
const screens = {
  hub: $("screen-hub"),
  descent: $("screen-descent"),
  home: $("screen-home"),
  progress: $("screen-progress"),
  customize: $("screen-customize"),
  shop: $("screen-shop"),
  rulessetup: $("screen-rulessetup"),
  brainmenu: $("screen-brainmenu"),
  picturemenu: $("screen-picturemenu"),
  specialsmenu: $("screen-specialsmenu"),
  partysetup: $("screen-partysetup"),
  game: $("screen-game"),
  whoami: $("screen-whoami"),
  dingbats: $("screen-dingbats"),
  results: $("screen-results"),
};

// The tab bar lives on the three top-level surfaces only
const TAB_SCREENS = ["home", "progress", "customize"];
function syncTabbar(name) {
  const isTab = TAB_SCREENS.includes(name);
  $("tabbar").classList.toggle("hidden", !isTab);
  if (isTab) {
    document.querySelectorAll(".tabbar button").forEach((b) =>
      b.classList.toggle("active", b.dataset.tab === name));
  }
}

// ---------- State ----------
let state = null;
let lastFetchAt = 0; // OpenTDB allows ~1 request / 5s per IP

// ---------- Helpers ----------
function decodeHTML(str) {
  const el = document.createElement("textarea");
  el.innerHTML = str;
  return el.value;
}

// Server-sourced strings (other players' names) must never reach innerHTML raw
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// dim the living background while playing (so it never distracts mid-question)
function setAmbient(name) {
  const dim = ["game", "results", "whoami", "dingbats"].includes(name);
  const bg = $("ambient-bg");
  if (bg) bg.style.opacity = dim ? "0" : "1";
  // the top status bar rides the menus, not the game / results / setup screens
  const hideBar = ["game", "results", "whoami", "dingbats", "partysetup", "shop"].includes(name);
  const tb = $("topbar");
  if (tb) tb.classList.toggle("hidden", hideBar);
  document.body.classList.toggle("has-topbar", !hideBar); // pads menu screens below the bar
}
// instant screen swap (used under the section-sweep cover)
function switchInstant(name) {
  Object.values(screens).forEach((s) => s.classList.remove("active", "screen-exit"));
  screens[name].classList.add("active");
  syncTabbar(name);
  setAmbient(name);
}
// a moving graphic that wipes up over the screen, swaps the section beneath it,
// then wipes off to reveal it — used when choosing a path from the hub
function sectionSweep(target, icon, label, grad) {
  let ov = $("section-sweep");
  if (!ov) {
    ov = document.createElement("div");
    ov.id = "section-sweep";
    ov.innerHTML = '<div class="sweep-inner"><span class="sweep-icon"></span><span class="sweep-label"></span></div>';
    document.body.appendChild(ov);
  }
  ov.style.background = grad;
  ov.querySelector(".sweep-icon").textContent = icon;
  ov.querySelector(".sweep-label").textContent = label;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) { switchInstant(target); return; }
  ov.classList.remove("out");
  void ov.offsetWidth; // reflow so the transition restarts
  ov.classList.add("in");
  Sound.swoosh(true);
  setTimeout(() => switchInstant(target), 460);
  setTimeout(() => { ov.classList.add("out"); }, 540);
  setTimeout(() => { ov.classList.remove("in", "out"); }, 1200);
}

function showScreen(name) {
  const target = screens[name];
  const current = Object.values(screens).find((s) => s.classList.contains("active"));
  if (current === target) return;
  setAmbient(name);
  // Two-phase transition: outgoing screen glides away, then the new one enters
  if (!current || matchMedia("(prefers-reduced-motion: reduce)").matches) {
    Object.values(screens).forEach((s) => s.classList.remove("active", "screen-exit"));
    target.classList.add("active");
    syncTabbar(name);
    return;
  }
  // deliberate two-phase transition with an audio sweep that tracks the motion
  const goingDeeper = !TAB_SCREENS.includes(name) || name === "game" || name === "results";
  Sound.swoosh(goingDeeper);
  Music.duck(); // dip the music so the transition breathes
  current.classList.add("screen-exit");
  setTimeout(() => {
    Object.values(screens).forEach((s) => s.classList.remove("active", "screen-exit"));
    target.classList.add("active");
    syncTabbar(name);
  }, 620);
}

function setLoading(on, text) {
  $("loading-overlay").hidden = !on;
  if (text) $("loading-text").textContent = text;
}

// ---------- High scores ----------
function getBest(mode) {
  return Number(localStorage.getItem("quizrush-best-" + mode) || 0);
}
function setBest(mode, score) {
  localStorage.setItem("quizrush-best-" + mode, String(score));
}
function renderBests() {
  for (const mode of Object.keys(MODES)) {
    const best = getBest(mode);
    let text = best > 0 ? `★ ${best.toLocaleString()}` : "";
    if (mode === "classic" && player.bestClassicLevel > 1) {
      text = `Lv ${player.bestClassicLevel}${text ? " · " + text : ""}`;
    }
    $("best-" + mode).textContent = text;
  }
}

// ---------- Question broker ----------
// Fans a request out to both sources in parallel, normalizes to one shape,
// dedupes, and shuffles. Either source failing or coming back thin is fine
// as long as the other delivers.

function normalizeText(s) {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// OpenTDB session token: prevents repeat questions within ~6 hours of play
async function otdbToken() {
  const stored = localStorage.getItem("quizrush-otdb-token");
  if (stored) return stored;
  try {
    const res = await fetch(`${OTDB_API}/api_token.php?command=request`);
    const data = await res.json();
    if (data.token) {
      localStorage.setItem("quizrush-otdb-token", data.token);
      return data.token;
    }
  } catch { /* token is an optimization, never a requirement */ }
  return "";
}

async function fetchFromOTDB({ amount, otdbCats, difficulty }) {
  // Respect OpenTDB's rate limit (1 request per 5 seconds)
  const wait = lastFetchAt + 5200 - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));

  const params = new URLSearchParams({ amount: String(Math.min(amount, 50)), type: "multiple" });
  // OpenTDB only takes one category per request; rotate through the mapped ids
  if (otdbCats?.length) params.set("category", String(otdbCats[Math.floor(Math.random() * otdbCats.length)]));
  if (difficulty) params.set("difficulty", difficulty);
  const token = await otdbToken();
  if (token) params.set("token", token);

  lastFetchAt = Date.now();
  const res = await fetch(`${OTDB_API}/api.php?${params}`);
  if (res.status === 429) throw new Error("rate-limited");
  const data = await res.json();
  if (data.response_code === 3 || data.response_code === 4) {
    // token expired (3) or its question pool is exhausted (4) — drop it and
    // let the next game mint a fresh one
    localStorage.removeItem("quizrush-otdb-token");
    return [];
  }
  if (data.response_code !== 0 || !data.results?.length) return [];

  return data.results.map((q) => ({
    category: decodeHTML(q.category).replace(/^(Entertainment|Science): /, ""),
    difficulty: q.difficulty,
    text: decodeHTML(q.question),
    correct: decodeHTML(q.correct_answer),
    answers: shuffle([q.correct_answer, ...q.incorrect_answers].map(decodeHTML)),
  }));
}

function prettyTTACategory(c) {
  return c.split("_")
    .map((w) => (w === "and" ? "&" : w === "tv" ? "TV" : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}

async function fetchFromTTA({ amount, ttaCats, ttaTags, difficulty }) {
  const params = new URLSearchParams({ limit: String(Math.min(amount, 50)), types: "text_choice" });
  if (ttaCats?.length) params.set("categories", ttaCats.join(","));
  if (ttaTags?.length) params.set("tags", ttaTags.join(","));
  if (difficulty) params.set("difficulties", difficulty);

  const res = await fetch(`${TTA_API}/questions?${params}`);
  if (!res.ok) return [];
  const data = await res.json();
  if (!Array.isArray(data)) return [];

  return data.map((q) => ({
    category: prettyTTACategory(q.category || "general"),
    difficulty: q.difficulty || "medium",
    text: q.question?.text || "",
    correct: q.correctAnswer,
    answers: shuffle([q.correctAnswer, ...q.incorrectAnswers]),
  })).filter((q) => q.text && q.answers.length === 4);
}

// The local question pool: our hand-written originals (QUIZRUSH_BANK, which also
// holds flags / specials / daily) PLUS the large imported bank (bank-imported.js,
// OpenTriviaQA / CC BY-SA, cleaned + UK-filtered + difficulty-graded). Imported
// questions only add core-trivia categories, so flags/pictures/daily are untouched.
const IMPORTED = (typeof IMPORTED_BANK !== "undefined" && Array.isArray(IMPORTED_BANK)) ? IMPORTED_BANK : [];
// Wikidata-generated questions (CC0): world-balanced history + UK sport history.
const GENERATED = (typeof GENERATED_BANK !== "undefined" && Array.isArray(GENERATED_BANK)) ? GENERATED_BANK : [];
const GENERATED_SPORT = (typeof GENERATED_SPORT_BANK !== "undefined" && Array.isArray(GENERATED_SPORT_BANK)) ? GENERATED_SPORT_BANK : [];
const GENERATED_EXTRA = (typeof GENERATED_EXTRA_BANK !== "undefined" && Array.isArray(GENERATED_EXTRA_BANK)) ? GENERATED_EXTRA_BANK : [];
// Curated "Quizzer Accepted" set, normalised into all app formats (built from
// saga-questions.js by scratchpad/build-saga-bank.mjs).
const GENERATED_SAGA = (typeof GENERATED_SAGA_BANK !== "undefined" && Array.isArray(GENERATED_SAGA_BANK)) ? GENERATED_SAGA_BANK : [];
// Karim's authored MCQ bank (bank-user.js), imported from the Google Sheet.
const USER = (typeof USER_BANK !== "undefined" && Array.isArray(USER_BANK)) ? USER_BANK : [];
// Per request (2026-07): use Karim's authored bank alongside the app's own
// originals; the imported OpenTriviaQA bank and the earlier generated/made banks
// are SET ASIDE for the time being (still loaded, just not drawn from). To bring
// the full ~35k pool back, restore the extra args in the concat below:
//   QUIZRUSH_BANK.concat(USER, IMPORTED, GENERATED, GENERATED_SPORT, GENERATED_EXTRA, GENERATED_SAGA)
const BANK_ALL = QUIZRUSH_BANK.concat(USER);
void [IMPORTED, GENERATED, GENERATED_SPORT, GENERATED_EXTRA, GENERATED_SAGA]; // set aside; keep refs

function fetchFromBank({ amount, catId, difficulty }) {
  const pool = BANK_ALL.filter(
    (q) => (!catId || q.cat === catId) && (!difficulty || q.difficulty === difficulty)
  );
  return shuffle(pool).slice(0, amount).map((q) => ({
    category: CATEGORIES.find((c) => c.id === q.cat)?.name || "QuizRush",
    catId: q.cat,
    difficulty: q.difficulty,
    text: q.text,
    big: q.big || "",
    svgPath: q.svgPath || "",
    vid: q.vid || "",
    correct: q.correct,
    answers: shuffle([q.correct, ...q.wrong]),
  }));
}

// Weighted local pool for mixed Classic / Sudden / Blitz rounds. Universal topics
// dominate; entertainment & celebs are down-weighted because the imported bank's
// entertainment skews US pop-culture — fine as a garnish, wrong as the main course
// for a UK audience. (Players who pick Entertainment/Celebs explicitly get the full pool.)
const CORE_MIX_WEIGHT = {
  general: 1, geography: 1, science: 1, history: 1,
  arts: 0.6, sport: 0.5, politics: 0.3, entertainment: 0.45, popculture: 0.35, celebs: 0.15,
};
function buildLocalCore(scope, amount) {
  const cats = scope === "common" ? COMMON_TRIVIA_CATIDS : CORE_TRIVIA_CATIDS;
  let pool = [];
  for (const c of cats) {
    const per = Math.max(4, Math.round(amount * (CORE_MIX_WEIGHT[c] ?? 0.5)));
    pool = pool.concat(fetchFromBank({ amount: per, catId: c, difficulty: "" }));
  }
  return pool;
}

// Smart difficulty: weight the mix by the player's track record — strong
// players get pushed, struggling players get room to build confidence.
function smartWeights(catId) {
  let acc = 0.55;
  const s = catId ? player.catStats[catId] : null;
  if (s && s.answered >= 8) {
    acc = s.correct / s.answered;
  } else {
    const t = Object.values(player.catStats)
      .reduce((a, x) => ({ correct: a.correct + x.correct, answered: a.answered + x.answered }), { correct: 0, answered: 0 });
    if (t.answered >= 15) acc = t.correct / t.answered;
  }
  if (acc >= 0.75) return { easy: 0.1, medium: 0.3, hard: 0.6 };
  if (acc >= 0.55) return { easy: 0.2, medium: 0.5, hard: 0.3 };
  return { easy: 0.5, medium: 0.35, hard: 0.15 };
}

// Reorder a chosen set so the same topic never lands back-to-back and each topic
// is spread as evenly as the set allows (no "three geography in a row" clusters).
// Classic max-heap-by-remaining interleave: always take from the largest topic
// bucket that isn't the one we just served. Keys are sub-topic aware (splits sport
// by discipline), so two different sports may sit adjacent but two footballs won't.
function spaceOut(items) {
  if (items.length < 3) return items;
  const buckets = new Map();
  for (const q of items) {
    const k = topicKey(q);
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k).push(q);
  }
  const out = [];
  let last = null;
  while (out.length < items.length) {
    const avail = [...buckets.entries()].filter(([, a]) => a.length);
    avail.sort((a, b) => b[1].length - a[1].length);
    // prefer the fullest bucket that isn't the last-served topic
    const pick = avail.find(([k]) => k !== last) || avail[0];
    out.push(pick[1].shift());
    last = pick[0];
  }
  return out;
}

// Compose a level's blend from an unfiltered pool: take the requested count
// of each tier, then fill any shortfall starting from medium (adjacent to both).
function composeMix(pool, mix, amount) {
  const by = { easy: [], medium: [], hard: [] };
  // core categories first within each difficulty, so niche only fills gaps
  const coreFirst = [...pool].sort(
    (a, b) => (CORE_TRIVIA_CATIDS.includes(a.catId) ? 0 : 1) - (CORE_TRIVIA_CATIDS.includes(b.catId) ? 0 : 1)
  );
  coreFirst.forEach((q) => (by[q.difficulty] || by.medium).push(q));

  const picked = [], chosen = new Set(), catCount = {};
  const grab = (list, need, cap) => {
    for (const q of list) {
      if (need <= 0) break;
      if (chosen.has(q)) continue;
      // Cap by CATEGORY, not sub-topic: sport splits into ~10 disciplines, so a
      // sub-topic cap let sport grab one slot per discipline and flood the round.
      // Category capping keeps every topic to its fair share (and still stops
      // "three football" — they're all `sport`). spaceOut handles same-discipline adjacency.
      const c = q.catId || topicKey(q);
      if (cap && (catCount[c] || 0) >= cap) continue; // spread across categories
      chosen.add(q); picked.push(q); catCount[c] = (catCount[c] || 0) + 1; need--;
    }
    return need;
  };
  for (const d of ["hard", "medium", "easy"]) {
    let need = mix[d] || 0;
    // graduated caps spread topics as evenly as the pool allows before doubling up
    for (const cap of [1, 2, 3, Infinity]) {
      if (need <= 0) break;
      need = grab(shuffle(by[d]), need, cap);
    }
  }
  for (const cap of [2, 3, Infinity]) grab(shuffle([...by.hard, ...by.medium, ...by.easy]), amount - picked.length, cap); // top up
  return shuffle(picked).slice(0, amount);
}

// Sudden Death: serve in a difficulty ramp (very easy → expert), spreading
// topics and labelling each question's tier.
function applySuddenRamp(pool, count) {
  const by = { easy: [], medium: [], hard: [] };
  // common topics first in the easy bucket so the opening questions are gentle
  [...pool].sort((a, b) => (COMMON_TRIVIA_CATIDS.includes(a.catId) ? 0 : 1) - (COMMON_TRIVIA_CATIDS.includes(b.catId) ? 0 : 1))
    .forEach((q) => (by[q.difficulty] || by.medium).push(q));
  const nearest = { easy: ["easy", "medium", "hard"], medium: ["medium", "easy", "hard"], hard: ["hard", "medium", "easy"] };
  const out = [], catCount = {};
  for (let i = 0; i < count; i++) {
    const [want, label] = suddenTier(i);
    let q = null;
    for (const d of nearest[want]) {
      // prefer a topic not seen too often yet
      const idx = by[d].findIndex((x) => (catCount[x.catId] || 0) < 2);
      const j = idx >= 0 ? idx : (by[d].length ? 0 : -1);
      if (j >= 0) { q = by[d].splice(j, 1)[0]; break; }
    }
    if (!q) break;
    q.tier = label;
    catCount[q.catId] = (catCount[q.catId] || 0) + 1;
    out.push(q);
  }
  return out;
}

// Blitz: every question a different difficulty from the last, round-robin.
function applyBlitzTiers(pool, count) {
  const by = { easy: [], medium: [], hard: [] };
  pool.forEach((q) => (by[q.difficulty] || by.medium).push(q));
  Object.values(by).forEach((a) => shuffle(a));
  const order = ["easy", "medium", "hard"], out = [];
  let k = 0;
  while (out.length < count) {
    let placed = false;
    for (let s = 0; s < 3; s++) {
      const d = order[(k + s) % 3];
      if (by[d].length) { const q = by[d].shift(); q.tier = capDiff(d); out.push(q); k++; placed = true; break; }
    }
    if (!placed) break;
  }
  return out;
}

// Fetch a broad pool from CORE (or COMMON) trivia topics only — the engine for
// mixed Classic / Sudden / Blitz rounds. Now LOCAL-FIRST: the bundled bank is the
// source of truth (instant, offline, commercially licensed), so rounds never
// freeze on a slow network and never depend on the non-commercial Trivia API.
// OpenTDB (CC BY-SA, commercial-OK) is folded in only as a best-effort supplement
// when it happens to answer quickly — it is never awaited long enough to stall.
async function fetchCoreMix({ scope = "core", amount = 60 } = {}) {
  const local = buildLocalCore(scope, amount);
  // Best-effort freshness from OpenTDB; if it isn't ready within ~1.2s, ship local alone.
  const otdbCats = scope === "common" ? COMMON_OTDB : CORE_OTDB;
  let extra = [];
  try {
    extra = await Promise.race([
      fetchFromOTDB({ amount: 20, otdbCats, difficulty: "" }).catch(() => []),
      new Promise((r) => setTimeout(() => r([]), 1200)),
    ]);
    extra = (extra || []).filter((q) => !isUnfriendly(q));
    extra.forEach((q) => { q.catId = NAME_TO_CAT[q.category.toLowerCase()] || ""; });
  } catch { extra = []; }
  const pool = local.concat(extra);
  // de-dupe by text+visual
  const seen = new Set();
  return pool.filter((q) => {
    const k = normalizeText(q.text) + (q.big || "");
    if (!normalizeText(q.text) || seen.has(k)) return false;
    seen.add(k); return true;
  });
}

async function getQuestions({ catId = "", difficulty = "", amount = 10, mix = null, exclude = null, scope = "core" }) {
  if (difficulty === "smart") {
    // fetch at the tier the player's record points to, so the difficulty is
    // real rather than whatever mix the sources happened to return
    const w = smartWeights(catId);
    const dominant = Object.entries(w).sort((a, b) => b[1] - a[1])[0][0];
    return getQuestions({ catId, difficulty: dominant, amount });
  }
  const cat = CATEGORIES.find((c) => c.id === catId);
  let merged, otdbRejected = false;

  if (mix && !catId) {
    // Mixed Classic / Sudden / Blitz: core trivia only, category-controlled
    merged = await fetchCoreMix({ scope, amount: 60 });
    otdbRejected = merged.length === 0;
  } else {
    const useOtdb = !cat || cat.otdb.length > 0;
    const useTta = INCLUDE_NC_SOURCES && (!cat || cat.tta.length > 0 || cat.ttaTags?.length > 0);
    const srcAmount = amount;
    const bankAmount = cat?.bank ? amount : cat ? 0 : Math.ceil(amount * 0.15);

    const [otdb, tta] = await Promise.allSettled([
      useOtdb ? fetchFromOTDB({ amount: srcAmount, otdbCats: cat?.otdb, difficulty }) : Promise.resolve([]),
      useTta ? fetchFromTTA({ amount: srcAmount, ttaCats: cat?.tta, ttaTags: cat?.ttaTags, difficulty }) : Promise.resolve([]),
    ]);
    otdbRejected = otdb.status === "rejected" && otdb.reason?.message === "rate-limited";

    const pool = [otdb, tta].flatMap((r) => (r.status === "fulfilled" ? r.value : []))
      .concat(bankAmount ? fetchFromBank({ amount: bankAmount, catId, difficulty }) : []);
    const seen = new Set();
    merged = shuffle(pool).filter((q) => {
      const key = normalizeText(q.text) + (q.big || "") + (q.vid || "");
      if (!normalizeText(q.text) || seen.has(key)) return false;
      if (!q.svgPath && !q.big && isUnfriendly(q)) return false; // UK filter (skip our own bank picture qs)
      seen.add(key);
      return true;
    });
    merged.forEach((q) => { q.catId = catId || NAME_TO_CAT[q.category.toLowerCase()] || ""; });
  }

  if (!merged.length) {
    throw new Error(otdbRejected ? "rate-limited" : "no-questions");
  }

  // No-repeat memory: skip questions this run has already served, unless that
  // would leave the round short — better an occasional repeat than a thin level
  let available = exclude?.size ? merged.filter((q) => !exclude.has(nemesisKey(q))) : merged;
  if (available.length < amount) available = merged;

  // For blended levels, shape the pool to the requested tier proportions
  const shaped = mix ? composeMix(available, mix, amount) : available;
  shaped.forEach((q) => { q.tier = capDiff(q.difficulty); }); // default label; sudden overrides

  // Sprinkle in up to two nemesis questions seeking revenge
  const nemeses = pickNemeses(catId, mix ? "" : difficulty);
  if (nemeses.length) {
    const qKey = (q) => q.text + (q.big || "");
    const nemesisKeys = new Set(nemeses.map(qKey));
    const base = shaped.filter((q) => !nemesisKeys.has(qKey(q))).slice(0, Math.max(amount - nemeses.length, 1));
    return spaceOut(shuffle(base.concat(nemeses)).slice(0, amount));
  }
  // Space topics apart so a round never clusters (e.g. three geography back-to-back)
  return spaceOut(shaped.slice(0, amount));
}

// ---------- Game flow ----------
// Double-tapping a mode card must never start two games: the first game's
// orphaned timers would drain the visible countdown at double speed and fire
// phantom timeouts. One start per 800ms, and any live intervals are killed.
let lastStartAt = 0;
function startGuard() {
  const now = Date.now();
  if (now - lastStartAt < 800) return false;
  lastStartAt = now;
  if (state) {
    clearInterval(state.qTimer);
    clearInterval(state.blitzTimer);
  }
  return true;
}

async function startGame(mode, overrides = {}) {
  if (!startGuard()) return;
  const opts = { amount: 10 };
  let questions;

  if (mode === "daily") {
    // One shot per day: the attempt is consumed the moment the question is shown.
    // Leaving mid-question stays "pending" and is converted to a loss on next load.
    if (player.daily?.date === todayKey()) return;
    const dq = dailyQuestion();
    questions = [dq.question];
    opts.difficulty = dq.difficulty;
    player.daily = { date: todayKey(), status: "pending", score: 0 };
  } else {
    if (mode === "classic") {
      // The ladder sets its own rules: mixed categories (unless a themed card
      // like Riddles or Flags locked one) and a per-level difficulty blend.
      opts.catId = overrides.catId ?? "";
      opts.mix = levelMix(1);
      opts.scope = overrides.catId ? "core" : levelScope(1);
    } else if (mode === "custom") {
      // Your Rules: the player picks both knobs
      opts.catId = document.querySelector("#chips-category .chip.active").dataset.value;
      opts.difficulty = document.querySelector("#chips-difficulty .chip.active").dataset.value;
    }

    setLoading(true, "Fetching questions…");
    try {
      if (mode === "sudden") {
        const pool = await fetchCoreMix({ scope: "core", amount: 60 });
        questions = applySuddenRamp(pool, 50);
      } else if (mode === "blitz") {
        const pool = await fetchCoreMix({ scope: "core", amount: 60 });
        questions = applyBlitzTiers(pool, 50);
      } else {
        questions = await getQuestions(opts);
      }
      if (!questions.length) throw new Error("no-questions");
    } catch (err) {
      setLoading(false);
      alert(
        err.message === "rate-limited"
          ? "The trivia service is rate-limiting us — wait a few seconds and try again."
          : "Couldn't load questions right now — check your connection and try again."
      );
      return;
    }
    setLoading(false);
  }

  state = {
    mode,
    questions,
    index: 0,
    score: 0,
    correct: 0,
    answered: 0,
    streak: 0,
    bestStreak: 0,
    difficulty: opts.difficulty || "",
    catId: opts.catId || "",
    level: 1,
    usedQKeys: new Set(questions.map((q) => nemesisKey(q))), // run-scoped no-repeat memory
    levelCorrect: 0,
    maxLevelCorrect: 0,
    awaitingContinue: false,
    questionTime: mode === "daily" ? DAILY_TIME[opts.difficulty] : QUESTION_TIME,
    // The third lifeline is Freeze in Blitz (pause the clock), +time everywhere else.
    thirdKind: mode === "blitz" ? "freeze" : "time",
    // The daily is a pure one-shot test — no helpers
    lifelines: mode === "daily"
      ? { fifty: false, skip: false, time: false }
      : mode === "blitz"
      ? { fifty: true, skip: true, freeze: true }
      : { fifty: true, skip: true, time: true },
    locked: false,
    qTimer: null,
    qTimeLeft: QUESTION_TIME,
    blitzTimer: null,
    blitzTimeLeft: BLITZ_TIME,
    lives: BLITZ_LIVES, // blitz only: wrong answers cost a life; 0 ends the round
  };

  // Mode-specific chrome
  $("blitz-timer").hidden = mode !== "blitz";
  $("blitz-lives").hidden = mode !== "blitz";
  if (mode === "blitz") paintBlitzLives();
  $("timer-ring-wrap").style.display = mode === "blitz" ? "none" : "";
  $("game-progress").style.visibility = mode === "blitz" || mode === "daily" ? "hidden" : "visible";
  document.querySelector(".progress-track").style.display = mode === "classic" || mode === "custom" ? "" : "none";
  $("lifelines").style.display = mode === "daily" ? "none" : "";
  $("streak-badge").style.display = "";
  $("game-tokens").style.display = "";
  $("party-turn").hidden = true;
  $("lf-time-label").textContent = mode === "blitz" ? "❄️ Freeze" : "⏰ +7s";
  $("lf-time").title = mode === "blitz" ? "Freeze the clock for 8 seconds" : "Extra time";
  paintLifelines();

  updateScoreUI();
  showScreen("game");
  Sound.start();

  if (mode === "blitz") {
    // Blitz gets its own driving track, pinned regardless of the Customize pick,
    // playing uninterrupted from the countdown through the whole round.
    Music.play(BLITZ_TRACK);
    // 3… 2… 1… GO! before the clock starts running
    playCountdown(() => {
      startBlitzClock();
      renderQuestion();
    });
  } else {
    Music.start();
    renderQuestion();
  }
}

function renderQuestion() {
  if (!state || state.ended) return; // quit landed inside the dissolve window
  const q = state.questions[state.index];
  if (!q) return endGame(); // pool exhausted (sudden/blitz)

  state.locked = false;

  // Every 5th Blitz question is a Golden Question — worth +15s if you nail it.
  state.golden = state.mode === "blitz" && (state.index + 1) % 5 === 0;

  document.activeElement?.blur?.(); // no leftover focus highlight on a fresh question
  const card = $("question-card");
  card.classList.remove("dissolve-out", "shake", "assemble");
  card.classList.toggle("golden", !!state.golden);
  $("golden-tag").hidden = !state.golden;
  void card.offsetWidth;
  card.classList.add("assemble"); // pieces drift together, staggered
  setTimeout(() => card.classList.remove("assemble"), 1600);
  Sound.reveal();

  $("q-category").textContent = (q.nemesis ? "😈 Revenge · " : "") + q.category;
  const diff = $("q-difficulty");
  diff.textContent = q.tier || q.difficulty; // tier label (Very Easy…Expert) when set
  diff.className = "q-difficulty " + q.difficulty;

  $("question-text").textContent = q.text;
  const vis = $("q-visual");
  if (q.svgPath) {
    // our own generated silhouette data — safe to inject
    vis.innerHTML = `<svg viewBox="0 0 100 100" class="shape-svg"><path d="${q.svgPath}"/></svg>`;
    vis.hidden = false;
  } else {
    vis.textContent = q.big || "";
    vis.hidden = !q.big;
  }

  if (state.mode === "classic" || state.mode === "custom" || state.mode === "daily") {
    const prefix = state.mode === "classic" ? `Lv ${state.level} · ` : "";
    $("progress-label").textContent = `${prefix}${state.index + 1} / ${state.questions.length}`;
    $("progress-fill").style.width = `${(state.index / state.questions.length) * 100}%`;
  } else {
    $("progress-label").textContent =
      state.mode === "sudden" ? `Question ${state.index + 1}`
      : state.mode === "party" ? `${state.index + 1} / ${state.questions.length}`
      : "";
  }
  paintLifelines();

  $("revive-offer").hidden = true;
  $("global-stat").hidden = true;
  $("learn-row").hidden = true;
  $("learn-panel").hidden = true;
  const answersEl = $("answers");
  answersEl.innerHTML = "";
  answersEl.classList.add("hover-lock"); // don't hover-highlight a button the resting mouse already sits on
  q.answers.forEach((ans) => {
    const btn = document.createElement("button");
    btn.className = "answer-btn";
    btn.textContent = ans;
    btn.addEventListener("click", () => selectAnswer(btn, ans));
    answersEl.appendChild(btn);
  });

  if (state.mode !== "blitz") startQuestionTimer();
}

// ---------- Timers ----------
function startQuestionTimer() {
  clearInterval(state.qTimer);
  state.qTimeLeft = state.questionTime;
  let lastTickSec = Math.ceil(state.questionTime);
  paintRing();
  state.qTimer = setInterval(() => {
    state.qTimeLeft -= 0.1;
    const sec = Math.ceil(state.qTimeLeft);
    if (sec < lastTickSec && sec <= 5 && sec > 0) Sound.tick();
    lastTickSec = sec;
    if (state.qTimeLeft <= 0) {
      state.qTimeLeft = 0;
      paintRing();
      clearInterval(state.qTimer);
      onTimeout();
    } else {
      paintRing();
    }
  }, 100);
}

function paintRing() {
  const frac = Math.min(state.qTimeLeft / state.questionTime, 1); // +time lifeline can exceed the base

  const ring = $("ring-fill");
  ring.style.strokeDashoffset = String(RING_CIRC * (1 - frac));
  ring.classList.toggle("warn", frac <= 0.5 && frac > 0.25);
  ring.classList.toggle("danger", frac <= 0.25);
  // final five seconds: the ring pulses along with the tick-tock
  $("timer-ring-wrap").classList.toggle("urgent", state.qTimeLeft <= 5 && state.qTimeLeft > 0);
  $("timer-num").textContent = String(Math.ceil(state.qTimeLeft));
}

function startBlitzClock() {
  state.blitzTimeLeft = BLITZ_TIME;
  runBlitzClock();
}

// Runs the countdown from the CURRENT blitzTimeLeft (so Freeze can pause and
// resume without restarting the whole clock).
function runBlitzClock() {
  clearInterval(state.blitzTimer);
  let lastTickSec = Math.ceil(state.blitzTimeLeft);
  paintBlitz();
  state.blitzTimer = setInterval(() => {
    state.blitzTimeLeft -= 0.1;
    const sec = Math.ceil(state.blitzTimeLeft);
    if (sec < lastTickSec && sec <= 5 && sec > 0) Sound.tick();
    lastTickSec = sec;
    if (state.blitzTimeLeft <= 0) {
      state.blitzTimeLeft = 0;
      paintBlitz();
      clearInterval(state.blitzTimer);
      endGame();
    } else {
      paintBlitz();
    }
  }, 100);
}

function paintBlitz() {
  const frac = state.blitzTimeLeft / BLITZ_TIME;
  $("blitz-timer-fill").style.transform = `scaleX(${frac})`;
  $("blitz-timer-fill").classList.toggle("danger", state.blitzTimeLeft <= 15); // final 15s runs red
  $("blitz-timer").classList.toggle("urgent", state.blitzTimeLeft <= 5 && state.blitzTimeLeft > 0);
  $("blitz-timer-label").textContent = fmtClock(state.blitzTimeLeft);
}

// m:ss for the blitz clock (e.g. 180 → "3:00", 9 → "0:09")
function fmtClock(secs) {
  const s = Math.max(0, Math.ceil(secs));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// Blitz lives: three hearts, dimmed as they're spent on wrong answers.
function paintBlitzLives() {
  const el = $("blitz-lives");
  if (!el) return;
  let html = "";
  for (let i = 0; i < BLITZ_LIVES; i++) {
    html += `<span class="life${i < state.lives ? "" : " lost"}">♥</span>`;
  }
  el.innerHTML = html;
}

// Spend a life on a wrong blitz answer; returns true if that was the last one.
function loseBlitzLife() {
  state.lives = Math.max(0, state.lives - 1);
  paintBlitzLives();
  const lost = $("blitz-lives")?.querySelector(".life.lost:last-of-type");
  if (lost) { lost.classList.remove("pop"); void lost.offsetWidth; lost.classList.add("pop"); }
  return state.lives <= 0;
}

// ---------- Lifelines (one use of each per game) ----------
function paintLifelines() {
  if (!state?.lifelines) return;
  // The third slot (button #lf-time) is Freeze in Blitz, +time elsewhere.
  const slots = [["fifty", "lf-fifty"], ["skip", "lf-skip"], [state.thirdKind || "time", "lf-time"]];
  for (const [kind, id] of slots) {
    const btn = $(id);
    const avail = state.lifelines[kind];
    const refillable = !avail && state.mode !== "daily" && player.tokens >= 2;
    const lockedNow = state.locked && !(kind === "time" && state.mode === "blitz");
    btn.disabled = lockedNow || (!avail && !refillable);
    btn.classList.toggle("used", !avail && !refillable);
    btn.classList.toggle("refill", refillable);
    if (refillable) btn.title = "Used — tap to refill for 2 Gold";
  }
}

// Tapping a spent lifeline with enough tokens buys it back (2 🪙), then a
// second tap uses it as normal.
function lifelineClick(kind, useFn) {
  if (!state?.lifelines) return;
  if (!state.lifelines[kind] && state.mode !== "daily" && player.tokens >= 2) {
    player.tokens -= 2;
    state.lifelines[kind] = true;
    Sound.click();
    updateScoreUI();
    paintLifelines();
    return;
  }
  useFn();
}

function useFifty() {
  if (!state || state.locked || !state.lifelines.fifty) return;
  state.lifelines.fifty = false;
  const q = state.questions[state.index];
  const wrongBtns = [...document.querySelectorAll(".answer-btn")]
    .filter((b) => b.textContent !== q.correct && !b.disabled);
  shuffle(wrongBtns).slice(0, 2).forEach((b) => {
    b.disabled = true;
    b.classList.add("dim");
  });
  Sound.click();
  paintLifelines();
}

function useSkip() {
  if (!state || state.locked || !state.lifelines.skip) return;
  state.lifelines.skip = false;
  state.locked = true; // no answering a question you skipped
  clearInterval(state.qTimer);
  Sound.click();
  paintLifelines();
  nextQuestion();
}

function useTime() {
  if (!state || state.locked || !state.lifelines.time) return;
  state.lifelines.time = false;
  state.qTimeLeft += 7;
  paintRing();
  Sound.click();
  paintLifelines();
}

// Blitz's third lifeline: freeze the global clock for 8s to think on a hard one.
function useFreeze() {
  if (!state || state.mode !== "blitz" || state.locked || state.frozen || !state.lifelines.freeze) return;
  state.lifelines.freeze = false;
  state.frozen = true;
  clearInterval(state.blitzTimer); // pause the countdown where it is
  $("blitz-timer").classList.add("frozen");
  Sound.click();
  paintLifelines();
  toast("❄️ Clock frozen — 8s to think");
  clearTimeout(state.freezeTimer);
  state.freezeTimer = setTimeout(() => {
    if (!state || state.ended || state.mode !== "blitz") return;
    state.frozen = false;
    $("blitz-timer").classList.remove("frozen");
    runBlitzClock(); // resume from where it paused
  }, 8000);
}

// ---------- Answering ----------
function selectAnswer(btn, answer) {
  if (state.locked) return;
  state.locked = true;
  clearInterval(state.qTimer);
  paintLifelines();

  const q = state.questions[state.index];
  const isCorrect = answer === q.correct;
  state.answered++;
  if (state.mode !== "party") recordCatStat(q.catId, isCorrect); // guests don't write the owner's stats
  queueAnswerStat(q, isCorrect);
  showGlobalStat(q);

  const buttons = [...document.querySelectorAll(".answer-btn")];
  buttons.forEach((b) => {
    b.disabled = true;
    if (b.textContent === q.correct) b.classList.add("correct");
    else if (b === btn) b.classList.add("wrong");
    else b.classList.add("dim");
  });

  if (state.mode === "party") {
    const p = state.players[state.current];
    if (isCorrect) {
      p.correct++;
      const diffMult = { easy: 1, medium: 1.5, hard: 2 }[q.difficulty] || 1;
      const speedBonus = Math.round(100 * (state.qTimeLeft / state.questionTime));
      const points = Math.round((100 + speedBonus) * diffMult);
      p.score += points;
      popPoints("+" + points.toLocaleString());
      flash("green");
    } else {
      $("question-card").classList.add("shake");
      flash("red");
    }
    updateScoreUI();
    setTimeout(nextQuestion, 1200);
    return;
  }

  if (isCorrect) {
    state.correct++;
    state.levelCorrect++;
    state.streak++;
    if (state.mode === "daily") state.dailySolveTime = (state.questionTime - state.qTimeLeft).toFixed(1);
    state.bestStreak = Math.max(state.bestStreak, state.streak);
    const points = scoreFor(q);
    state.score += points;
    if (state.mode === "blitz" && state.golden) {
      state.blitzTimeLeft += 15; // nailing a Golden Question buys 15 more seconds
      paintBlitz();
      popPoints("✨ +15s");
    } else if (state.mode === "blitz") {
      popPoints("+1"); // Blitz is scored in correct answers, not points
    } else {
      popPoints("+" + points.toLocaleString());
    }
    flash(state.golden ? "gold" : "green");
    if (q.nemesis) clearNemesis(q); // revenge complete
  } else {
    state.streak = 0;
    recordNemesis(q);
    $("question-card").classList.add("shake");
    flash("red");
    if (state.mode === "sudden") {
      updateScoreUI();
      setTimeout(() => (player.tokens >= 3 ? showReviveOffer() : endGame()), 1100);
      return;
    }
    if (state.mode === "blitz" && loseBlitzLife()) {
      updateScoreUI();
      clearInterval(state.blitzTimer); // out of lives ends the round before the clock
      setTimeout(endGame, 900);
      return;
    }
  }

  updateScoreUI();
  offerLearnMore();
  const delay = state.mode === "blitz" ? 550 : 1000;
  state.advanceTimer = setTimeout(nextQuestion, delay);
}

function scoreFor(q) {
  const diffMult = { easy: 1, medium: 1.5, hard: 2 }[q.difficulty] || 1;
  // streak bonus: +10% per consecutive correct answer, capped at 2x
  const streakMult = Math.min(1 + (state.streak - 1) * 0.1, 2);
  const nemesisMult = q.nemesis ? 1.5 : 1; // slaying a nemesis pays extra

  if (state.mode === "blitz") {
    return Math.round(100 * diffMult * streakMult * nemesisMult);
  }
  const speedBonus = Math.round(100 * (state.qTimeLeft / state.questionTime));
  return Math.round((100 + speedBonus) * diffMult * streakMult * nemesisMult);
}

function onTimeout() {
  if (state.locked) return;
  state.locked = true;
  state.answered++;
  state.streak = 0;

  const q = state.questions[state.index];
  if (state.mode !== "party") recordCatStat(q.catId, false);
  recordNemesis(q);
  queueAnswerStat(q, false);
  showGlobalStat(q);
  document.querySelectorAll(".answer-btn").forEach((b) => {
    b.disabled = true;
    if (b.textContent === q.correct) b.classList.add("correct");
    else b.classList.add("dim");
  });
  $("question-card").classList.add("shake");
  flash("red");
  updateScoreUI();

  if (state.mode === "sudden") {
    setTimeout(() => (player.tokens >= 3 ? showReviveOffer() : endGame()), 1100);
  } else {
    offerLearnMore();
    state.advanceTimer = setTimeout(nextQuestion, 1000);
  }
}

// Sudden Death second chance: spend 3 tokens to survive a wrong answer
function showReviveOffer() {
  if (!state || state.ended) return; // player quit during the reveal delay
  $("revive-offer").hidden = false;
  $("revive-balance").textContent = `You have ${player.tokens} Gold`;
  // on small screens the offer can render below the fold — bring it into view
  $("revive-offer").scrollIntoView({ behavior: "smooth", block: "center" });
}


function nextQuestion() {
  if (!state || state.ended) return; // late timeout after the game already ended
  state.index++;
  if (state.mode === "party") {
    if (state.index >= state.questions.length) return endGame();
    state.current = state.index % state.players.length;
    return showPassOverlay(); // the next player taps ready before seeing anything
  }
  if (state.index >= state.questions.length && state.mode === "classic") return levelComplete();
  if (state.index >= state.questions.length && (state.mode === "daily" || state.mode === "custom")) return endGame();
  const card = $("question-card");
  card.classList.add("dissolve-out"); // liquid blur away, then reassemble
  setTimeout(renderQuestion, 600);
}

// Gentle full-screen vignette pulse: green for right, red for wrong.
// Paired with a haptic tap on devices that support it (Android; iOS ignores it).
function flash(kind) {
  const el = $("feedback-flash");
  el.className = "feedback-flash " + kind;
  void el.offsetWidth; // restart the animation
  el.classList.add("pulse");
  try { navigator.vibrate?.(kind === "red" ? [60, 40, 60] : 35); } catch { /* optional */ }
}

function popPoints(text) {
  const pop = $("points-pop");
  pop.textContent = text;
  pop.classList.remove("show");
  void pop.offsetWidth; // restart animation
  pop.classList.add("show");
}

// Currency icons — inline SVG so they render crisply and identically everywhere.
// (The coin emoji showed as a dull grey ball on some systems.) Gold is a bullion
// bar; Gems are a cut diamond. Both scale into visible piles for the shop packs.
const GOLD_BAR_SVG = `<svg class="cur-ico" viewBox="0 0 30 20" aria-hidden="true"><path d="M6 4h18l4 13H2z" fill="#f4b52e" stroke="#9c6a15" stroke-width="1.4"/><path d="M6.4 4.3h17.2l1.3 4.6H4.7z" fill="#ffe491"/></svg>`;
const GEM_SVG = `<svg class="cur-ico" viewBox="0 0 24 22" aria-hidden="true"><path d="M6 2h12l5 6-11 13L1 8z" fill="#57c8ff" stroke="#2b7fb0" stroke-width="1.3"/><path d="M1 8h22M6 2l6 19M18 2l-6 19" stroke="#e2f6ff" stroke-width=".8" fill="none" opacity=".7"/></svg>`;
const goldLabel = (n) => `<span class="cur">${GOLD_BAR_SVG}<b>${n}</b></span>`;
const gemLabel = (n) => `<span class="cur cur-gem">${GEM_SVG}<b>${n}</b></span>`;
// A pile whose size grows with the pack — small buys a bar, big buys a hoard.
const pile = (svg, count, cls) =>
  `<span class="pile ${cls}">${Array.from({ length: count }, () => svg).join("")}</span>`;
const goldPileFor = (amt) => pile(GOLD_BAR_SVG, amt >= 400 ? 6 : amt >= 120 ? 3 : 1, "gold-pile");
const gemPileFor = (amt) => pile(GEM_SVG, amt >= 60 ? 6 : amt >= 25 ? 3 : 1, "gem-pile");

// Paint both currencies everywhere they appear, and celebrate on a gain: Gold
// gives a quick bump; Gems get a rarer, more precious shine. Called wherever a
// balance might have changed, so the HUD, player bar and shop stay in sync.
let goldSeen = null, gemsSeen = null;
function bumpEl(id, cls) {
  const el = $(id);
  if (!el) return;
  el.classList.remove(cls);
  void el.offsetWidth; // restart the animation
  el.classList.add(cls);
}
function paintCurrencies() {
  const g = player.gold, m = player.gems;
  ["game-tokens", "player-tokens", "tb-gold"].forEach((id) => { const el = $(id); if (el) el.innerHTML = goldLabel(g); });
  ["game-gems", "player-gems", "tb-gem"].forEach((id) => { const el = $(id); if (el) el.innerHTML = gemLabel(m); });
  const sg = $("shop-gold-bal"); if (sg) sg.innerHTML = goldLabel(g);
  const sm = $("shop-gem-bal"); if (sm) sm.innerHTML = gemLabel(m);
  if (goldSeen !== null && g > goldSeen) { ["game-tokens", "player-tokens"].forEach((id) => bumpEl(id, "token-bump")); try { Sound.coin(); } catch {} }
  if (gemsSeen !== null && m > gemsSeen) { ["game-gems", "player-gems"].forEach((id) => bumpEl(id, "gem-bump")); }
  goldSeen = g; gemsSeen = m;
}
// Back-compat shim: older call sites pass the gold value but we now repaint both.
function tokenJuice() { paintCurrencies(); }

function updateScoreUI() {
  if (state.mode === "party") {
    const p = state.players[state.current];
    $("score-value").textContent = p.score.toLocaleString();
    $("party-turn").textContent = "🎮 " + p.name;
    return;
  }
  // Blitz is scored purely by correct answers, not points.
  $("score-value").textContent = state.mode === "blitz"
    ? String(state.correct)
    : state.score.toLocaleString();
  paintCurrencies();
  const badge = $("streak-badge");
  badge.textContent = "🔥 " + state.streak;
  badge.classList.toggle("hot", state.streak >= 3);
  badge.classList.remove("bump");
  void badge.offsetWidth;
  if (state.streak > 0) badge.classList.add("bump");
}

// ---------- Who Am I? ----------
// Typed answers with misspelling tolerance: strip accents/punctuation/case,
// then accept anything within edit distance 1 (short names) or 2 (longer).
function normalizeGuess(s) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
}

function editDistance(a, b) {
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

function guessMatches(guess, entry) {
  const g = normalizeGuess(guess);
  if (!g) return false;
  return [entry.answer, ...(entry.aliases || [])].some((t) => {
    const norm = normalizeGuess(t);
    return editDistance(g, norm) <= (norm.length < 6 ? 1 : 2);
  });
}

function startWhoami() {
  if (!startGuard()) return;
  state = {
    mode: "whoami",
    characters: shuffle(WHOAMI_BANK).slice(0, WHOAMI_ROUND),
    index: 0,
    stage: 0,          // how many clues are visible - 1
    resolved: false,
    score: 0,
    correct: 0,
    answered: 0,
    streak: 0,
    bestStreak: 0,
  };
  showScreen("whoami");
  Sound.start();
  Music.start();
  renderWhoamiCharacter();
}

function renderWhoamiCharacter() {
  state.stage = 0;
  state.resolved = false;
  const card = document.querySelector("#screen-whoami .question-card");
  card.classList.remove("assemble", "shake");
  void card.offsetWidth;
  card.classList.add("assemble");
  setTimeout(() => card.classList.remove("assemble"), 1600);
  $("whoami-progress").textContent = `${state.index + 1} / ${WHOAMI_ROUND}`;
  $("whoami-reveal").hidden = true;
  $("btn-learn-who").hidden = true;
  $("learn-panel-who").hidden = true;
  $("whoami-input-row").style.display = "";
  $("whoami-actions").style.display = "";
  $("btn-next-char").hidden = true;
  $("whoami-input").value = "";
  $("whoami-input").placeholder = "Type your guess…";
  paintWhoami();
  $("whoami-input").focus();
}

function paintWhoami() {
  const ch = state.characters[state.index];
  $("clues").innerHTML = ch.facts.slice(0, state.stage + 1)
    .map((f, i) => `<div class="clue"><span class="clue-num">${i + 1}</span>${f}</div>`)
    .join("");
  $("whoami-stage").textContent = `Clue ${state.stage + 1} · ${WHOAMI_POINTS[state.stage]} pts`;
  $("whoami-score").textContent = state.score.toLocaleString();
  const badge = $("whoami-streak");
  badge.textContent = "🔥 " + state.streak;
  badge.classList.toggle("hot", state.streak >= 3);
  $("btn-next-clue").disabled = state.stage >= 3;
}

function advanceWhoamiClue() {
  if (state.resolved) return;
  if (state.stage < 3) {
    state.stage++;
    Sound.click();
    paintWhoami();
  }
}

function submitWhoamiGuess() {
  if (state.resolved) return;
  const guess = $("whoami-input").value;
  if (!normalizeGuess(guess)) return;
  const ch = state.characters[state.index];

  if (guessMatches(guess, ch)) {
    const points = WHOAMI_POINTS[state.stage];
    state.score += points;
    state.correct++;
    state.answered++;
    state.streak++;
    state.bestStreak = Math.max(state.bestStreak, state.streak);
    flash("green");
    resolveWhoami(`✓ ${ch.answer} · +${points} pts`, true);
  } else {
    $("whoami-input").value = "";
    $("whoami-input").placeholder = "Not quite — try again…";
    document.querySelector("#screen-whoami .question-card").classList.remove("shake");
    void document.querySelector("#screen-whoami .question-card").offsetWidth;
    document.querySelector("#screen-whoami .question-card").classList.add("shake");
    flash("red");
    if (state.stage < 3) {
      state.stage++; // a wrong guess burns a clue
      paintWhoami();
    } else {
      state.answered++;
      state.streak = 0;
      resolveWhoami(`It was ${ch.answer}`, false);
    }
  }
}

function giveUpWhoami() {
  if (state.resolved) return;
  const ch = state.characters[state.index];
  state.answered++;
  state.streak = 0;
  resolveWhoami(`It was ${ch.answer}`, false);
}

function resolveWhoami(text, won) {
  state.resolved = true;
  const ch = state.characters[state.index];
  // show all clues plus the reveal banner
  state.stage = 3;
  $("clues").innerHTML = ch.facts
    .map((f, i) => `<div class="clue"><span class="clue-num">${i + 1}</span>${f}</div>`)
    .join("");
  const reveal = $("whoami-reveal");
  reveal.hidden = false;
  reveal.textContent = text;
  reveal.classList.toggle("won", won);
  $("whoami-input-row").style.display = "none";
  $("whoami-actions").style.display = "none";
  const next = $("btn-next-char");
  next.hidden = false;
  next.textContent = state.index + 1 >= WHOAMI_ROUND ? "See results" : "Next character";
  $("btn-learn-who").hidden = false; // flow is already paused here — free to read
  paintWhoami();
  $("whoami-stage").textContent = won ? "Solved!" : "Missed";
}

function nextWhoamiCharacter() {
  Sound.click();
  state.index++;
  if (state.index >= WHOAMI_ROUND) return endGame();
  renderWhoamiCharacter();
}

// ---------- Party mode (pass-and-play) ----------
const PARTY_PER_PLAYER = 5;

async function startParty(names) {
  if (!startGuard()) return;
  setLoading(true, "Fetching questions…");
  let questions;
  try {
    questions = await getQuestions({ amount: names.length * PARTY_PER_PLAYER });
  } catch (err) {
    setLoading(false);
    alert(err.message === "rate-limited"
      ? "The trivia service is rate-limiting us — wait a few seconds and try again."
      : "Couldn't load questions — try again in a moment.");
    return;
  }
  setLoading(false);

  state = {
    mode: "party",
    players: names.map((n) => ({ name: n, score: 0, correct: 0 })),
    current: 0,
    questions,
    index: 0,
    score: 0, correct: 0, answered: 0, streak: 0, bestStreak: 0,
    level: 1, levelCorrect: 0, maxLevelCorrect: 0, awaitingContinue: false,
    difficulty: "", catId: "",
    lifelines: { fifty: false, skip: false, time: false },
    locked: false,
    qTimer: null, qTimeLeft: QUESTION_TIME, questionTime: QUESTION_TIME,
    blitzTimer: null, blitzTimeLeft: BLITZ_TIME,
  };

  $("blitz-timer").hidden = true;
  $("blitz-lives").hidden = true;
  $("timer-ring-wrap").style.display = "";
  $("game-progress").style.visibility = "visible";
  document.querySelector(".progress-track").style.display = "none";
  $("lifelines").style.display = "none";
  $("streak-badge").style.display = "none";
  $("game-tokens").style.display = "none";
  $("party-turn").hidden = false;
  updateScoreUI();
  showScreen("game");
  Sound.start();
  Music.start();
  showPassOverlay();
}

function showPassOverlay() {
  clearInterval(state.qTimer);
  $("pass-name").textContent = state.players[state.current].name;
  $("pass-overlay").hidden = false;
}

function endParty() {
  const ranked = [...state.players].sort((a, b) => b.score - a.score);
  const tie = ranked.length > 1 && ranked[0].score === ranked[1].score;
  $("results-emoji").textContent = "🏆";
  $("results-title").textContent = tie ? "It's a tie!" : `${ranked[0].name} wins!`;
  $("new-best").hidden = true;
  countUp($("results-score"), ranked[0].score);
  $("results-score-label").textContent = tie ? "top score" : `${ranked[0].name}'s score`;
  $("results-xp").innerHTML = "";
  $("results-badges").hidden = true;
  $("btn-share").hidden = true;
  const medals = ["🥇", "🥈", "🥉", "4️⃣"];
  const podium = $("party-podium");
  podium.hidden = false;
  podium.innerHTML = ranked.map((p, i) =>
    `<div class="podium-row"><span>${medals[i]} ${p.name}</span><span>${p.correct} ✓ · ${p.score.toLocaleString()} pts</span></div>`).join("");
  document.querySelector(".results-stats").style.display = "none";
  $("btn-again").textContent = "Rematch";
  $("btn-home").textContent = "Home";
  showScreen("results");
  confetti();
  Sound.best();
}

// ---------- Classic level ladder ----------
function levelComplete() {
  clearInterval(state.qTimer);
  state.maxLevelCorrect = Math.max(state.maxLevelCorrect, state.levelCorrect);
  // pass bar scales with round length so thin bank categories stay fair
  const needed = Math.ceil(state.questions.length * LEVEL_RULES(state.level).need / 10);
  if (state.levelCorrect < needed) return endGame(); // run over

  const nextLevel = state.level + 1;
  const prevBest = player.bestClassicLevel;
  if (nextLevel > player.bestClassicLevel) player.bestClassicLevel = nextLevel;
  player.gold += 1; // clearing a level pays a Gold
  // Gems are rare: only a milestone level reached for the FIRST time, plus any
  // flawless (10/10) level — both real achievements, so a gem always feels earned.
  if (GEM_MILESTONE[nextLevel] && nextLevel > prevBest) awardGems(GEM_MILESTONE[nextLevel], `Level ${nextLevel} milestone`);
  if (state.levelCorrect === state.questions.length && state.questions.length >= 10) awardGems(GEM_PERFECT, "flawless level");

  state.awaitingContinue = true;
  $("btn-share").hidden = true;
  $("results-emoji").textContent = "🚀";
  $("results-title").textContent = `Level ${state.level} cleared!`;
  $("new-best").hidden = true;
  $("results-score").textContent = state.score.toLocaleString();
  $("results-score-label").textContent = "points so far";
  const nr = LEVEL_RULES(nextLevel);
  $("results-xp").innerHTML =
    `${state.levelCorrect} / ${state.questions.length} correct · +1 Gold — ` +
    `next: Level ${nextLevel} · ${mixLabel(nr.mix)} · ${nr.need}/10 to pass`;
  $("results-badges").hidden = true;
  $("stat-correct").textContent = String(state.correct);
  $("stat-accuracy").textContent = (state.answered ? Math.round((state.correct / state.answered) * 100) : 0) + "%";
  $("stat-streak").textContent = String(state.bestStreak);
  $("btn-again").textContent = `Continue to Level ${nextLevel}`;
  $("btn-home").textContent = "End run";
  playLevelUpCinematic(nextLevel, () => showScreen("results"));
}

async function continueClassicRun() {
  if (!startGuard()) return;
  const nextLevel = state.level + 1;
  setLoading(true, `Loading Level ${nextLevel}…`);
  let questions;
  try {
    questions = await getQuestions({ catId: state.catId, mix: levelMix(nextLevel), amount: 10, exclude: state.usedQKeys, scope: state.catId ? "core" : levelScope(nextLevel) });
  } catch {
    setLoading(false);
    alert("Couldn't load the next level — ending the run here so your score counts.");
    return endGame();
  }
  setLoading(false);

  questions.forEach((q) => state.usedQKeys?.add(nemesisKey(q)));
  Object.assign(state, {
    questions,
    index: 0,
    level: nextLevel,
    levelCorrect: 0,
    difficulty: "",
    questionTime: QUESTION_TIME, // constant clock — the blend does the escalating
    awaitingContinue: false,
    locked: false,
    lifelines: { fifty: true, skip: true, time: true }, // fresh set each level
  });
  showScreen("game");
  Sound.start();
  renderQuestion();
}

// ---------- Dingbats ----------
// Typed emoji-film puzzles (converted from the MCQ film bank at load).
const EMOJI_FILM_PUZZLES = (typeof EMOJI_FILMS !== "undefined" ? EMOJI_FILMS : []).map((f) => {
  const aliases = [];
  if (/^The /i.test(f.a)) aliases.push(f.a.replace(/^The /i, ""));
  const extra = {
    "Avengers: Infinity War": ["infinity war", "avengers"],
    "Harry Potter": ["harry potter and the philosophers stone"],
    "E.T.": ["et the extra terrestrial", "extra terrestrial"],
    "The Lord of the Rings": ["lord of the rings", "lotr"],
    "Star Wars": ["a new hope"],
  }[f.a];
  if (extra) aliases.push(...extra);
  return { type: "emoji", topic: "Emoji Film", display: f.e, answer: f.a, aliases,
           hint: `A film starting with "${f.a.replace(/^(The|A) /i, "")[0]}".` };
});

function startDingbats(pool) {
  if (!startGuard()) return;
  const source = pool && pool.length ? pool : DINGBAT_BANK;
  state = {
    mode: "dingbats",
    puzzles: shuffle(source).slice(0, DINGBAT_ROUND),
    index: 0,
    value: DINGBAT_VALUE,
    resolved: false,
    score: 0,
    correct: 0,
    answered: 0,
    streak: 0,
    bestStreak: 0,
  };
  showScreen("dingbats");
  Sound.start();
  Music.start();
  renderDingbat();
}

// Hangman-style blanks: one tile per letter, punctuation shown literally
function blanksFor(answer) {
  return answer.split(" ").map((word) =>
    `<span class="blank-word">${[...word].map((ch) =>
      /[a-zA-Z0-9]/.test(ch)
        ? `<span class="blank"></span>`
        : `<span class="blank lit">${escapeHtml(ch)}</span>`
    ).join("")}</span>`
  ).join("");
}

function renderDingbat() {
  const p = state.puzzles[state.index];
  state.value = DINGBAT_VALUE;
  state.resolved = false;
  const card = document.querySelector("#screen-dingbats .question-card");
  card.classList.remove("assemble", "shake");
  void card.offsetWidth;
  card.classList.add("assemble");
  setTimeout(() => card.classList.remove("assemble"), 1600);
  $("dingbats-progress").textContent = `${state.index + 1} / ${DINGBAT_ROUND}`;
  $("dingbat-cat").textContent = "👀 " + (p.topic || "Say What You See");
  const disp = $("dingbat-display");
  disp.textContent = p.display;
  disp.className = "dingbat-display " + p.type;
  $("dingbat-blanks").innerHTML = blanksFor(p.answer);
  $("dingbat-hint").hidden = true;
  $("dingbat-reveal").hidden = true;
  $("dingbat-input-row").style.display = "";
  $("dingbat-actions").style.display = "";
  $("btn-next-dingbat").hidden = true;
  $("btn-dingbat-hint").disabled = false;
  $("dingbat-input").value = "";
  $("dingbat-input").placeholder = "What does it say?";
  paintDingbats();
  $("dingbat-input").focus();
}

function paintDingbats() {
  $("dingbats-value").textContent = state.resolved ? "" : `Worth ${state.value} pts`;
  $("dingbats-score").textContent = state.score.toLocaleString();
  const badge = $("dingbats-streak");
  badge.textContent = "🔥 " + state.streak;
  badge.classList.toggle("hot", state.streak >= 3);
}

function submitDingbatGuess() {
  if (state.resolved) return;
  const guess = $("dingbat-input").value;
  if (!normalizeGuess(guess)) return;
  const p = state.puzzles[state.index];

  if (guessMatches(guess, p)) {
    state.score += state.value;
    state.correct++;
    state.answered++;
    state.streak++;
    state.bestStreak = Math.max(state.bestStreak, state.streak);
    flash("green");
    resolveDingbat(`✓ ${p.answer} · +${state.value} pts`, true);
  } else {
    state.value = Math.max(state.value - DINGBAT_WRONG_COST, DINGBAT_FLOOR);
    $("dingbat-input").value = "";
    $("dingbat-input").placeholder = "Not quite — try again…";
    const card = document.querySelector("#screen-dingbats .question-card");
    card.classList.remove("shake");
    void card.offsetWidth;
    card.classList.add("shake");
    flash("red");
    paintDingbats();
  }
}

function hintDingbat() {
  if (state.resolved || !$("dingbat-hint").hidden) return;
  state.value = Math.max(state.value - DINGBAT_HINT_COST, DINGBAT_FLOOR);
  const hintEl = $("dingbat-hint");
  hintEl.textContent = "💡 " + state.puzzles[state.index].hint;
  hintEl.hidden = false;
  $("btn-dingbat-hint").disabled = true;
  Sound.click();
  paintDingbats();
}

function giveUpDingbat() {
  if (state.resolved) return;
  state.answered++;
  state.streak = 0;
  resolveDingbat(`It says: ${state.puzzles[state.index].answer}`, false);
}

function resolveDingbat(text, won) {
  state.resolved = true;
  const reveal = $("dingbat-reveal");
  reveal.hidden = false;
  reveal.textContent = text;
  reveal.classList.toggle("won", won);
  $("dingbat-input-row").style.display = "none";
  $("dingbat-actions").style.display = "none";
  const next = $("btn-next-dingbat");
  next.hidden = false;
  next.textContent = state.index + 1 >= DINGBAT_ROUND ? "See results" : "Next puzzle";
  paintDingbats();
}

function nextDingbat() {
  Sound.click();
  state.index++;
  if (state.index >= DINGBAT_ROUND) return endGame();
  renderDingbat();
}

// ---------- End of game ----------
function endGame() {
  // a stray double-fire (frantic taps, late timeouts) must never award twice
  if (!state || state.ended) return;
  state.ended = true;
  clearInterval(state.qTimer);
  clearInterval(state.blitzTimer);
  clearTimeout(state.freezeTimer); // no late clock-resume after the round is over
  $("blitz-timer").classList.remove("frozen");
  Music.start("anthem"); // hand the stage back to the menu theme
  flushAnswerStats();
  if (state.mode === "party") return endParty();
  state.awaitingContinue = false;
  state.maxLevelCorrect = Math.max(state.maxLevelCorrect || 0, state.levelCorrect || 0);
  // restore results-screen chrome the level interstitial or a party may have changed
  $("btn-again").textContent = "Play again";
  $("btn-home").textContent = "Home";
  $("results-score-label").textContent = state.mode === "blitz" ? "correct" : "points";
  $("party-podium").hidden = true;
  if (state.mode !== "daily") $("daily-board").innerHTML = "";
  document.querySelector(".results-stats").style.display = "";

  const { mode, score, correct, answered, bestStreak } = state;
  const accuracy = answered ? Math.round((correct / answered) * 100) : 0;
  // Blitz's headline number is correct answers, not points (XP still uses points below).
  const headline = mode === "blitz" ? correct : score;

  // Daily is once per day, so a cross-day "best" doesn't apply
  const isBest = mode !== "daily" && headline > getBest(mode);
  if (isBest) setBest(mode, headline);

  // Daily outcome: streak, bonus XP, and theme unlocks
  let dailyWon = false;
  let dailyBonus = 0;
  let newThemes = [];
  if (mode === "daily") {
    dailyWon = correct > 0;
    player.daily = { date: todayKey(), status: dailyWon ? "right" : "wrong", score, time: state.dailySolveTime || null };
    if (dailyWon) {
      const s = player.dailyStreak;
      const count = s.last === yesterdayKey() ? s.count + 1 : 1;
      player.dailyStreak = { count, last: todayKey() };
      dailyBonus = { easy: 100, medium: 150, hard: 200 }[state.difficulty] || 100;
      player.tokens += 2; // solving the daily pays two tokens
      const prevBest = player.bestDailyStreak;
      if (count > prevBest) {
        player.bestDailyStreak = count;
        newThemes = THEMES.filter((t) => t.streak > prevBest && t.streak <= count);
        // Gems for hitting a daily-streak milestone in new territory (no farm by rebuilding)
        if (GEM_STREAK[count]) awardGems(GEM_STREAK[count], `${count}-day streak`);
      }
    } else {
      player.dailyStreak = { count: 0, last: "" };
    }

    // Global board: submit this result, then show today's top scores
    $("daily-board").innerHTML = "";
    const solveTime = Number(state.dailySolveTime) || 0;
    (async () => {
      const prof = player.profile || { name: "Player", avatar: "😀" };
      await Net.post("/daily", {
        date: todayKey(), id: Net.deviceId(), name: prof.name, avatar: prof.avatar,
        score, time: solveTime, won: dailyWon,
      });
      const board = await Net.get(`/leaderboard?date=${todayKey()}`);
      if (!board?.top?.length) return;
      $("daily-board").innerHTML =
        `<h4>🌍 Today's daily — ${Number(board.players)} played, ${Number(board.solved)} solved</h4>` +
        board.top.slice(0, 5).map((r, i) =>
          `<div class="podium-row"><span>${["🥇", "🥈", "🥉", "4️⃣", "5️⃣"][i]} ${escapeHtml(r.avatar)} ${escapeHtml(r.name)}</span>` +
          `<span>${r.won ? "✅" : "❌"} ${Number(r.score).toLocaleString()}${r.time ? " · " + Number(r.time) + "s" : ""}</span></div>`).join("");
    })();
  }

  // XP + level
  const xpGained = Math.round(score / 10) + correct * 2 + dailyBonus;
  const lvlBefore = levelFromXp(player.xp);
  player.xp += xpGained;
  const lvlAfter = levelFromXp(player.xp);
  if (lvlAfter > lvlBefore) player.tokens += (lvlAfter - lvlBefore) * LEVELUP_TOKENS; // level-up pays tokens
  const titleChanged = titleForLevel(lvlAfter) !== titleForLevel(lvlBefore);
  $("results-xp").innerHTML =
    `+${xpGained} XP` +
    (mode === "daily" && dailyWon ? ` · +2 Gold · 🔥 ${liveDailyStreak()}-day daily streak` : "") +
    (lvlAfter > lvlBefore ? ` <span class="level-up">⬆ Level ${lvlAfter}!</span>` : "") +
    (titleChanged ? ` <span class="level-up">🎖 ${titleForLevel(lvlAfter)}</span>` : "");

  // Badges
  const earned = new Set(player.badges);
  const modes = new Set(player.modesPlayed);
  if (["classic", "sudden", "blitz"].includes(mode)) modes.add(mode);
  player.modesPlayed = [...modes];

  const checks = {
    first: true,
    streak5: bestStreak >= 5,
    streak10: bestStreak >= 10,
    perfect: mode === "classic" && state.maxLevelCorrect >= state.questions.length,
    survivor10: mode === "sudden" && correct >= 10,
    blitz15: mode === "blitz" && correct >= 15,
    sharp: answered >= 5 && correct === answered,
    owl: new Date().getHours() < 5,
    allmodes: modes.size >= 3,
    hardcore: mode === "classic" && state.maxLevelCorrect >= 9,
    climber: mode === "classic" && player.bestClassicLevel >= 3,
    summit: mode === "classic" && player.bestClassicLevel >= 6,
    ten: mode === "classic" && player.bestClassicLevel >= 10,
    daily: mode === "daily" && dailyWon,
  };
  const newBadges = BADGES.filter((b) => checks[b.id] && !earned.has(b.id));
  if (newBadges.length) {
    player.badges = [...earned, ...newBadges.map((b) => b.id)];
    player.tokens += newBadges.length * BADGE_TOKENS; // each new badge pays tokens
  }
  const badgesEl = $("results-badges");
  badgesEl.hidden = !newBadges.length && !newThemes.length;
  badgesEl.innerHTML =
    newBadges.map((b) => `<span class="badge-chip">${b.emoji} ${b.name}</span>`).join("") +
    newThemes.map((t) => `<span class="badge-chip">🎨 ${t.name} theme unlocked!</span>`).join("");

  $("results-emoji").textContent =
    mode === "daily" ? (dailyWon ? "🗓️" : "😔")
    : isBest ? "🏆" : accuracy >= 70 ? "🎉" : accuracy >= 40 ? "💪" : "😅";
  $("results-title").textContent = {
    classic: `Run ended at Level ${state.level}`,
    custom: "Round complete!",
    daily: dailyWon ? "Daily solved!" : "Not today…",
    sudden: `Survived ${correct} question${correct === 1 ? "" : "s"}!`,
    blitz: state.lives <= 0 ? "Out of lives!" : "Time's up!",
    whoami: `Identified ${correct} of ${answered}!`,
    dingbats: `Decoded ${correct} of ${answered}!`,
  }[mode];
  $("new-best").hidden = !isBest;
  $("stat-correct").textContent = String(correct);
  $("stat-accuracy").textContent = accuracy + "%";
  $("stat-streak").textContent = String(bestStreak);
  $("btn-share").hidden = mode !== "daily";
  renderHome();

  // A genuine failure (missed daily, a poor run) is treated soberly — quieter,
  // slower, desaturated — rather than with celebration. A personal best is
  // never sombre, even on low accuracy.
  const somber = !isBest && ((mode === "daily" && !dailyWon) || (answered >= 4 && accuracy < 35));
  const perfect = (mode === "classic" || mode === "custom") && state.maxLevelCorrect >= 10;
  $("screen-results").classList.toggle("somber", somber);

  const reveal = (quiet) => {
    showScreen("results");
    stageResultsReveal(headline, somber);
    showBadgeToast(newBadges);
    if (quiet) return;
    if (somber) Sound.somber();
    else if (isBest || newBadges.length) Sound.best();
    else Sound.fanfare();
    if (!somber && (isBest || perfect)) setTimeout(confetti, 950);
  };

  if (mode === "daily" && dailyWon) {
    playCelebration({ big: "DAILY SOLVED!", sub: `🔥 ${liveDailyStreak()}-day streak` }, () => reveal(true));
  } else if (titleChanged) {
    // reaching a new rank is a grand, earned moment
    playMilestone({ kicker: "NEW RANK", title: titleForLevel(lvlAfter).toUpperCase(), sub: `Reached Level ${lvlAfter}` }, () => reveal(true));
  } else {
    reveal(false);
  }
}

// ---------- Daily share card ----------
const DAILY_EPOCH = new Date("2026-07-23"); // Daily #1

function dailyShareText() {
  const d = player.daily;
  const { cat, difficulty } = dailyQuestion();
  const num = Math.round((new Date(todayKey()) - DAILY_EPOCH) / 86400000) + 1;
  const diffLabel = difficulty[0].toUpperCase() + difficulty.slice(1);
  const who = player.profile ? `${player.profile.avatar} ${player.profile.name}` : "";
  const lines = [`🐉 Riddle & Rune Daily #${num} — ${cat?.emoji || "🧠"} ${diffLabel}`];
  if (d?.status === "right") {
    lines.push(`✅ ${who ? who + " solved" : "Solved"}${d.time ? ` in ${d.time}s` : ""} · ${d.score.toLocaleString()} pts` +
      (liveDailyStreak() > 1 ? ` · 🔥 ${liveDailyStreak()}-day streak` : ""));
  } else {
    lines.push("❌ Not today… back tomorrow!");
  }
  return lines.join("\n");
}

$("btn-share").addEventListener("click", async () => {
  const text = dailyShareText();
  Sound.click();
  try {
    if (navigator.share) {
      await navigator.share({ text });
    } else {
      await navigator.clipboard.writeText(text);
      $("btn-share").textContent = "✓ Copied!";
      setTimeout(() => { $("btn-share").textContent = "📣 Share result"; }, 2000);
    }
  } catch { /* user cancelled the share sheet */ }
});

// ---------- Score count-up ----------
function countUp(el, target, dur = 900) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
    el.textContent = target.toLocaleString();
    return;
  }
  const t0 = performance.now();
  const step = (t) => {
    const p = Math.min((t - t0) / dur, 1);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(target * eased).toLocaleString();
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// Reveal the results one element at a time (result → score → progression →
// stats → actions) so each beat feels considered. The score counts up on cue;
// a lost run reveals more slowly and quietly.
function stageResultsReveal(score, somber) {
  const card = document.querySelector("#screen-results .results-card");
  card.classList.add("reveal-stage");
  card.classList.toggle("somber-reveal", somber);
  const kids = [...card.children].filter((el) => !el.hidden && getComputedStyle(el).display !== "none");
  kids.forEach((el) => el.classList.remove("shown"));
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
    kids.forEach((el) => el.classList.add("shown"));
    countUp($("results-score"), score);
    card.classList.remove("reveal-stage", "somber-reveal");
    return;
  }
  const gap = somber ? 560 : 430;
  const start = 700;
  kids.forEach((el, i) => setTimeout(() => {
    el.classList.add("shown");
    if (el.id === "results-score") countUp($("results-score"), score, somber ? 1500 : 1000);
  }, start + i * gap));
  setTimeout(() => card.classList.remove("reveal-stage", "somber-reveal"), start + kids.length * gap + 900);
}

// ---------- Level-up cinematic ----------
// Rare, grand moments (reaching Level 5 or the Level 10 summit) get the full
// ~14s cinematic; ordinary level clears get the shorter beat.
const MILESTONE_LEVELS = { 5: { kicker: "MILESTONE REACHED", sub: "The climb is well underway" },
                           10: { kicker: "THE SUMMIT", sub: "Level 10 — few make it this far" } };

function playMilestone({ kicker = "MILESTONE", title, sub = "" }, then) {
  const ov = $("cinema");
  $("cinema-kicker").textContent = kicker;
  $("cinema-title").textContent = title;
  $("cinema-sub").textContent = sub;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const DUR = reduced ? 2600 : 14000;
  const dust = $("cinema-dust");
  dust.innerHTML = "";
  if (!reduced) {
    for (let i = 0; i < 40; i++) {
      const p = document.createElement("i");
      p.style.left = Math.random() * 100 + "%";
      p.style.setProperty("--dx", (Math.random() * 80 - 40) + "px");
      p.style.animationDuration = (6 + Math.random() * 7) + "s";
      p.style.animationDelay = (Math.random() * 6) + "s";
      const sz = 2 + Math.random() * 3;
      p.style.width = p.style.height = sz + "px";
      dust.appendChild(p);
    }
  }
  ov.hidden = false;
  ov.classList.remove("play", "out");
  void ov.offsetWidth;
  ov.classList.add("play");
  Music.dip(0.14, DUR);
  Sound.cinematic();
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    ov.classList.add("out");
    setTimeout(() => { ov.hidden = true; ov.classList.remove("play", "out"); }, 1100);
    then();
  };
  ov.onclick = finish; // tap to continue at any point
  setTimeout(finish, DUR);
}

function playLevelUpCinematic(nextLevel, then) {
  const milestone = MILESTONE_LEVELS[nextLevel];
  if (milestone) return playMilestone({ kicker: milestone.kicker, title: `LEVEL ${nextLevel}`, sub: milestone.sub }, then);
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) { Sound.levelUp(); return then(); }
  const ov = $("levelup-overlay");
  $("lu-num").textContent = String(nextLevel);
  ov.hidden = false;
  ov.classList.remove("play");
  void ov.offsetWidth;
  ov.classList.add("play");
  confetti();
  Music.duck();
  Sound.levelUp();
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    ov.hidden = true;
    then();
  };
  ov.onclick = finish; // tap to skip
  setTimeout(finish, 3400);
}

// ---------- Celebration overlay (daily solved and other big wins) ----------
function playCelebration({ big, sub = "" }, then) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) { Sound.best(); return then(); }
  const ov = $("celebrate-overlay");
  $("cel-big").textContent = big;
  $("cel-sub").textContent = sub;
  ov.hidden = false;
  ov.classList.remove("play");
  void ov.offsetWidth;
  ov.classList.add("play");
  confetti();
  Music.duck();
  Sound.best();
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    ov.hidden = true;
    then();
  };
  ov.onclick = finish;
  setTimeout(finish, 3400);
}

// ---------- Badge toast ----------
function showBadgeToast(badges) {
  if (!badges.length) return;
  const toast = $("badge-toast");
  toast.textContent = `🏆 Badge earned: ${badges.map((b) => `${b.emoji} ${b.name}`).join(" · ")}`;
  toast.hidden = false;
  toast.classList.remove("show");
  void toast.offsetWidth;
  toast.classList.add("show");
  setTimeout(() => { toast.hidden = true; }, 3100);
}

// ---------- Blitz countdown ----------
function playCountdown(then) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return then();
  const ov = $("countdown-overlay");
  const num = $("countdown-num");
  const forState = state; // if the player quits mid-countdown, stop cold
  ov.hidden = false;
  const steps = ["3", "2", "1", "GO!"];
  let i = 0;
  const tick = () => {
    if (state !== forState) { ov.hidden = true; return; }
    if (i >= steps.length) {
      ov.hidden = true;
      return then();
    }
    num.textContent = steps[i];
    num.classList.remove("tick");
    void num.offsetWidth;
    num.classList.add("tick");
    if (steps[i] === "GO!") Sound.start(); else Sound.tick();
    i++;
    setTimeout(tick, i >= steps.length ? 650 : 720);
  };
  tick();
}

// ---------- Confetti ----------
function confetti() {
  const colors = ["#7c5cff", "#ff5c9e", "#ffce54", "#34d98a", "#2fb4ff"];
  const wrap = document.createElement("div");
  wrap.className = "confetti";
  for (let i = 0; i < 70; i++) {
    const p = document.createElement("i");
    p.style.left = Math.random() * 100 + "%";
    p.style.background = colors[i % colors.length];
    p.style.animationDelay = Math.random() * 0.5 + "s";
    p.style.animationDuration = 1.4 + Math.random() * 1.3 + "s";
    p.style.transform = `rotate(${Math.random() * 360}deg)`;
    wrap.appendChild(p);
  }
  document.body.appendChild(wrap);
  setTimeout(() => wrap.remove(), 3500);
}

function quitGame() {
  if (state?.mode === "daily") return endGame(); // quitting the daily counts as a loss
  flushAnswerStats();
  clearInterval(state?.qTimer);
  clearInterval(state?.blitzTimer);
  clearTimeout(state?.freezeTimer);
  $("blitz-timer").classList.remove("frozen");
  Music.start("anthem"); // back to the menu theme
  state = null;
  showScreen("home");
}

// ---------- Home screen rendering ----------
function paintPlayerBar() {
  const { lvl, into, needed } = levelProgress(player.xp);
  $("lvl-num").textContent = String(lvl);
  $("xp-fill").style.width = `${Math.min((into / needed) * 100, 100)}%`;
  $("xp-label").textContent = `${into} / ${needed} XP`;
  const p = player.profile;
  $("player-name").textContent = p ? `${p.avatar} ${p.name}` : "";
  $("player-title").textContent = "🎖 " + titleForLevel(lvl);
  paintCurrencies();
  paintTopbar();
}

// Persistent top status bar (level + progress; gold/gems come from paintCurrencies)
function paintTopbar() {
  const { lvl, into, needed } = levelProgress(player.xp);
  const l = $("tb-lvl"); if (l) l.textContent = "Lv " + lvl;
  const f = $("tb-xp-fill"); if (f) f.style.width = `${Math.min((into / needed) * 100, 100)}%`;
}

function paintCategoryChips() {
  const active = document.querySelector("#chips-category .chip.active")?.dataset.value ?? "";
  $("chips-category").innerHTML =
    `<button class="chip ${active === "" ? "active" : ""}" data-value="">🎲 Any</button>` +
    CATEGORIES.filter((c) => !c.special).map((c) => {
      const medal = medalFor(c.id);
      return `<button class="chip ${active === c.id ? "active" : ""}" data-value="${c.id}">` +
        `${c.emoji} ${c.name}${medal ? " " + medal : ""}</button>`;
    }).join("");
}

function paintSoundPacks() {
  const badgeCount = player.badges.length;
  $("pack-row").innerHTML = SOUND_PACKS.map((p) => {
    const unlocked = badgeCount >= p.badges;
    const active = player.soundPack === p.id;
    return `<button class="chip pack-chip ${active ? "active" : ""}" data-pack="${p.id}"
      ${unlocked ? "" : "disabled"} title="${unlocked ? p.name : `Earn ${p.badges} badges to unlock`}">
      ${unlocked ? "" : "🔒 "}${p.name}</button>`;
  }).join("");
}

function paintMusicTracks() {
  $("track-row").innerHTML = MUSIC_TRACKS.map((t) => {
    const unlocked = t.unlock();
    const active = player.musicTrack === t.id;
    return `<button class="chip pack-chip ${active ? "active" : ""}" data-track="${t.id}"
      ${unlocked ? "" : "disabled"} title="${unlocked ? t.name : `${t.name} — ${t.req}`}">
      ${unlocked ? t.icon : "🔒"} ${t.name}</button>`;
  }).join("");
}

function applyAppIcon(id) {
  player.appIcon = id;
  $("manifest-link").href = id === "bolt" ? "manifest.json" : `manifest-${id}.json`;
  $("touch-icon-link").href = `icon-${id}.png`;
  $("favicon-link").href = `icon-${id}.svg`;
}

function paintAppIcons() {
  const badgeCount = player.badges.length;
  $("icon-row").innerHTML = APP_ICONS.map((ic) => {
    const unlocked = badgeCount >= ic.badges;
    const active = player.appIcon === ic.id;
    return `<button class="chip pack-chip ${active ? "active" : ""}" data-icon="${ic.id}"
      ${unlocked ? "" : "disabled"} title="${unlocked ? ic.name : `Earn ${ic.badges} badges to unlock`}">
      ${unlocked ? ic.emoji : "🔒"} ${ic.name}</button>`;
  }).join("");
}

function paintDaily() {
  const { cat, difficulty } = dailyQuestion();
  const d = player.daily;
  const played = d?.date === todayKey();
  const streak = liveDailyStreak();
  $("daily-desc").textContent =
    `${cat?.emoji || "🧠"} ${cat?.name || "QuizRush"} • ${difficulty[0].toUpperCase() + difficulty.slice(1)} • ` +
    `one question, ${DAILY_TIME[difficulty]}s — one shot per day`;
  $("daily-status").textContent =
    (played ? (d.status === "right" ? "✓ solved" : "✗ missed") : "") +
    (streak > 0 ? ` 🔥${streak}` : "");
  $("daily-card").classList.toggle("played", played);
}

function paintBadges() {
  const earned = new Set(player.badges);
  $("badges-count").textContent = `${earned.size} / ${BADGES.length}`;
  $("badges-grid").innerHTML = BADGES.map((b) => `
    <div class="badge ${earned.has(b.id) ? "earned" : "locked"}" title="${b.desc}">
      <span class="badge-emoji">${b.emoji}</span>
      <span class="badge-name">${b.name}</span>
    </div>`).join("");
}

function applyTheme(id) {
  document.documentElement.dataset.theme = id;
  player.theme = id;
}

function themeUnlocked(id) {
  const t = THEMES.find((x) => x.id === id);
  if (t) return player.bestDailyStreak >= t.streak;
  if (SHOP_THEMES.some((x) => x.id === id)) return player.ownedThemes.includes(id);
  return id === "midnight";
}

function paintThemes() {
  const rows = THEMES.map((t) => ({ id: t.id, name: t.name, unlocked: themeUnlocked(t.id), need: `reach a ${t.streak}-day daily streak` }))
    .concat(SHOP_THEMES.map((t) => ({ id: t.id, name: t.name, unlocked: themeUnlocked(t.id), need: `buy in the Shop · ${t.gems} Gems` })));
  $("theme-row").innerHTML = rows.map((t) => {
    const active = player.theme === t.id;
    const title = t.unlocked ? t.name : `${t.name} — ${t.need}`;
    return `<button class="theme-swatch swatch-${t.id} ${active ? "active" : ""} ${t.unlocked ? "" : "locked"}"
      data-theme-id="${t.id}" title="${title}" ${t.unlocked ? "" : "disabled"}>${t.unlocked ? "" : "🔒"}</button>`;
  }).join("");
  document.querySelectorAll(".theme-swatch:not(.locked)").forEach((btn) => {
    btn.addEventListener("click", () => {
      applyTheme(btn.dataset.themeId);
      Sound.click();
      paintThemes();
    });
  });
}

// ---------- Shop ----------
function toast(msg) {
  const t = $("badge-toast");
  t.textContent = msg;
  t.hidden = false;
  t.classList.remove("show");
  void t.offsetWidth;
  t.classList.add("show");
  Sound.notify();
  Music.duck();
  setTimeout(() => { t.hidden = true; }, 3100);
}

function paintShop() {
  paintCurrencies(); // fills #shop-gold-bal + #shop-gem-bal
  $("shop-demo-note").textContent = DEMO_STORE
    ? "Preview mode — these show real prices but nothing is charged yet."
    : "";

  // Spend Gold: common comforts.
  const freezeFull = player.streakFreezes >= MAX_FREEZES;
  const goldSpend = [
    `<button class="shop-item" data-buy="freeze" ${freezeFull ? "disabled" : ""}>
       <span class="shop-emoji">🧊</span>
       <span class="shop-info"><b>Streak Freeze</b><small>Saves your daily streak if you miss a day (hold ${player.streakFreezes}/${MAX_FREEZES})</small></span>
       <span class="shop-cost">${freezeFull ? "Full" : goldLabel(STREAK_FREEZE_COST)}</span>
     </button>`,
  ];
  $("shop-spend").innerHTML = goldSpend.join("");

  // Spend Gems: exclusive cosmetics + melt down into Gold.
  const gemSpend = [
    ...SHOP_THEMES.map((t) => {
      const owned = player.ownedThemes.includes(t.id);
      return `<button class="shop-item gem-item" data-buy="theme:${t.id}" ${owned ? "disabled" : ""}>
        <span class="shop-emoji swatch-${t.id} shop-swatch"></span>
        <span class="shop-info"><b>${t.name} theme</b><small>Exclusive — gems only</small></span>
        <span class="shop-cost gem-cost">${owned ? "Owned ✓" : gemLabel(t.gems)}</span>
      </button>`;
    }),
    `<button class="shop-item gem-item" data-buy="melt">
       <span class="shop-emoji">${GOLD_BAR_SVG}</span>
       <span class="shop-info"><b>Sack of Gold</b><small>Melt 1 gem into ${GOLD_PER_GEM} gold</small></span>
       <span class="shop-cost gem-cost">${gemLabel(1)}</span>
     </button>`,
  ];
  const gemEl = $("shop-gem-spend"); if (gemEl) gemEl.innerHTML = gemSpend.join("");

  // Real-money Gold packs (simulated) — the pile grows with the pack size
  $("shop-packs").innerHTML = TOKEN_PACKS.map((p) =>
    `<button class="shop-item" data-pack="${p.id}">
       <span class="shop-emoji shop-pile">${goldPileFor(p.tokens)}</span>
       <span class="shop-info"><b>${p.tokens} Gold</b>${p.tag ? `<small>${p.tag}</small>` : "<small>Top-up</small>"}</span>
       <span class="shop-cost price">${p.price}</span>
     </button>`).join("");

  // Real-money Gem packs (simulated) — the hoard grows with the pack size
  const gemPackEl = $("shop-gem-packs");
  if (gemPackEl) gemPackEl.innerHTML = GEM_PACKS.map((p) =>
    `<button class="shop-item gem-item" data-gempack="${p.id}">
       <span class="shop-emoji shop-pile">${gemPileFor(p.gems)}</span>
       <span class="shop-info"><b>${p.gems} Gems</b>${p.tag ? `<small>${p.tag}</small>` : "<small>Premium</small>"}</span>
       <span class="shop-cost price">${p.price}</span>
     </button>`).join("");
}

function openShop() { Sound.click(); paintShop(); showScreen("shop"); }

function buyShopItem(what) {
  if (what === "freeze") {
    if (player.streakFreezes >= MAX_FREEZES) return;
    if (player.gold < STREAK_FREEZE_COST) return notEnough("gold");
    player.gold -= STREAK_FREEZE_COST;
    player.streakFreezes += 1;
    Sound.correct(); toast("🧊 Streak Freeze bought!");
  } else if (what === "melt") {
    if (player.gems < 1) return notEnough("gems");
    player.gems -= 1;
    player.gold += GOLD_PER_GEM;
    Sound.correct(); toast(`+${GOLD_PER_GEM} Gold from 1 Gem`);
  } else if (what.startsWith("theme:")) {
    const id = what.slice(6);
    const t = SHOP_THEMES.find((x) => x.id === id);
    if (!t || player.ownedThemes.includes(id)) return;
    if (player.gems < t.gems) return notEnough("gems");
    player.gems -= t.gems;
    player.ownedThemes = [...player.ownedThemes, id];
    applyTheme(id);
    Sound.best(); confetti(); toast(`🎨 ${t.name} theme unlocked!`);
  }
  paintShop(); renderHome();
}

function buyTokenPack(id) {
  const p = TOKEN_PACKS.find((x) => x.id === id);
  if (!p) return;
  if (DEMO_STORE) {
    player.gold += p.tokens;
    Sound.best(); confetti();
    toast(`✅ Demo purchase — +${p.tokens} Gold (no charge)`);
    paintShop(); renderHome();
  } else {
    // launch: hand off to Stripe checkout here
  }
}

function buyGemPack(id) {
  const p = GEM_PACKS.find((x) => x.id === id);
  if (!p) return;
  if (DEMO_STORE) {
    awardGems(p.gems, "demo purchase (no charge)");
    Sound.best(); confetti();
    paintShop(); renderHome();
  } else {
    // launch: hand off to Stripe checkout here
  }
}

function notEnough(kind = "gold") {
  toast(kind === "gems"
    ? "Not enough Gems — earn them at milestones, perfect rounds and daily streaks!"
    : "Not enough Gold — keep playing to earn more!");
}

function paintStreakLine() {
  const live = liveDailyStreak();
  const best = player.bestDailyStreak;
  const fz = player.streakFreezes ? ` · 🧊 ${player.streakFreezes}` : "";
  $("streak-line").textContent =
    (live > 0 ? `🔥 ${live}-day daily streak · best ${best}` :
    best > 0 ? `Daily streak paused · best ${best} — play today's to restart it` :
    "Solve a Daily Challenge to start a streak") + fz;
}

function paintMastery() {
  const rows = CATEGORIES
    .map((c) => ({ c, s: player.catStats[c.id] }))
    .filter((x) => x.s?.answered > 0)
    .sort((a, b) => b.s.answered - a.s.answered);
  $("mastery-list").innerHTML = rows.length
    ? rows.map(({ c, s }) => {
        const acc = Math.round((s.correct / s.answered) * 100);
        return `<div class="mastery-row">
          <span class="mastery-name">${c.emoji} ${c.name} ${medalFor(c.id)}</span>
          <div class="mastery-track"><div class="mastery-fill" style="width:${acc}%"></div></div>
          <span class="mastery-num">${acc}% · ${s.correct}✓</span>
        </div>`;
      }).join("")
    : `<p class="settings-note">Play some rounds and your per-category accuracy will build here.</p>`;
}

function renderHome() {
  renderBests();
  paintPlayerBar();
  paintDaily();
  paintBadges();
  paintThemes();
  paintCategoryChips();
  paintSoundPacks();
  paintMusicTracks();
  paintAppIcons();
  paintStreakLine();
  paintMastery();
}

// ---------- Wiring ----------
// Hub (two paths): The Descent (saga) vs Quick Play (classic quiz)
document.querySelectorAll('[data-action="descent"]').forEach((b) =>
  b.addEventListener("click", () => { Sound.click(); sectionSweep("descent", "🐉", "The Reckoning", "linear-gradient(165deg, #2a1140 0%, #5a1e2e 100%)"); }));
document.querySelectorAll('[data-action="quickplay"]').forEach((b) =>
  b.addEventListener("click", () => { Sound.click(); renderHome(); sectionSweep("home", "🎯", "Traditional Trivia", "linear-gradient(165deg, #101a34 0%, #1a2f4a 100%)"); }));
document.querySelectorAll('[data-action="hub"]').forEach((b) =>
  b.addEventListener("click", () => { Sound.click(); showScreen("hub"); }));

document.querySelectorAll(".mode-card").forEach((card) => {
  card.addEventListener("click", () => {
    if (card.disabled) return;
    if (card.dataset.action === "emojifilms") return startDingbats(EMOJI_FILM_PUZZLES);
    if (card.dataset.action === "partysetup") { Sound.click(); renderPartyNames(); return showScreen("partysetup"); }
    if (card.dataset.mode === "whoami") return startWhoami();
    if (card.dataset.mode === "dingbats") return startDingbats();
    if (card.dataset.mode === "custom") { Sound.click(); return showScreen("rulessetup"); }
    startGame(card.dataset.mode, card.dataset.cat ? { catId: card.dataset.cat } : {});
  });
});

// Tab bar
document.querySelectorAll(".tabbar button").forEach((btn) => {
  btn.addEventListener("click", () => {
    Sound.click();
    renderHome(); // repaint whichever tab we're entering
    showScreen(btn.dataset.tab);
  });
});

$("btn-learn").addEventListener("click", () => {
  clearTimeout(state?.advanceTimer); // pause the game while reading
  Sound.click();
  $("btn-learn").hidden = true;
  $("btn-learn-continue").hidden = false;
  renderLearn($("learn-panel"), state.questions[state.index].correct);
});
$("btn-learn-continue").addEventListener("click", () => {
  Sound.click();
  $("learn-row").hidden = true;
  $("learn-panel").hidden = true;
  nextQuestion();
});
$("btn-learn-who").addEventListener("click", () => {
  Sound.click();
  $("btn-learn-who").hidden = true;
  renderLearn($("learn-panel-who"), state.characters[state.index].answer);
});

$("btn-rules-back").addEventListener("click", () => { Sound.click(); showScreen("home"); });
$("btn-rules-start").addEventListener("click", () => { Sound.click(); startGame("custom"); });
$("btn-edit-profile").addEventListener("click", () => { Sound.click(); openProfileSetup(); });

// Shop entry points, back, and purchase delegation
$("player-tokens").addEventListener("click", openShop);
$("btn-open-shop").addEventListener("click", openShop);
["tb-gold", "tb-gem", "tb-shop"].forEach((id) => $(id)?.addEventListener("click", openShop));
$("tb-level")?.addEventListener("click", () => { Sound.click(); renderHome(); showScreen("progress"); });
$("btn-shop-back").addEventListener("click", () => { Sound.click(); showScreen("customize"); });
const shopBuyHandler = (e) => {
  const b = e.target.closest(".shop-item");
  if (b && !b.disabled) buyShopItem(b.dataset.buy);
};
$("shop-spend").addEventListener("click", shopBuyHandler);
$("shop-gem-spend")?.addEventListener("click", shopBuyHandler);
$("shop-packs").addEventListener("click", (e) => {
  const b = e.target.closest(".shop-item");
  if (b) buyTokenPack(b.dataset.pack);
});
$("shop-gem-packs")?.addEventListener("click", (e) => {
  const b = e.target.closest(".shop-item");
  if (b) buyGemPack(b.dataset.gempack);
});
$("player-gems")?.addEventListener("click", openShop);

// Volume mixer
$("vol-sfx").value = localStorage.getItem("quizrush-vol-sfx") ?? 100;
$("vol-music").value = localStorage.getItem("quizrush-vol-music") ?? 100;
$("vol-sfx").addEventListener("input", () => {
  safeSetItem("quizrush-vol-sfx", $("vol-sfx").value);
  Sound.click(); // instant audible feedback at the new level
});
$("vol-music").addEventListener("input", () => {
  safeSetItem("quizrush-vol-music", $("vol-music").value);
  Music.setVolume(Number($("vol-music").value) / 100);
});

document.querySelectorAll(".collection-tile").forEach((tile) => {
  tile.addEventListener("click", () => {
    Sound.click();
    if (tile.dataset.menu === "specialsmenu") paintSpecials();
    showScreen(tile.dataset.menu);
  });
});

$("btn-brain-back").addEventListener("click", () => { Sound.click(); showScreen("home"); });
$("btn-picture-back").addEventListener("click", () => { Sound.click(); showScreen("home"); });
$("btn-specials-back").addEventListener("click", () => { Sound.click(); showScreen("home"); });

const SPECIAL_DESCS = {
  animals: "From cheetahs to axolotls — the whole animal kingdom.",
  myth: "Gods, monsters and heroes of Greece, Egypt and the North.",
  decades: "Six decades of music, from Elvis to the 27 Club.",
  space: "Planets, missions and the far edges of the universe.",
  worldcup: "Every final, legend and Maracanazo since 1930.",
  starwars: "A long time ago, in a galaxy far, far away…",
  british: "Lochs, castles, scones and saints — quintessentially UK.",
};

function paintSpecials() {
  $("specials-grid").innerHTML = CATEGORIES.filter((c) => c.special && !c.picture).map((c) => {
    const medal = medalFor(c.id);
    return `<button class="mode-card" data-mode="classic" data-cat="${c.id}">
      <div class="mode-icon">${c.emoji}</div>
      <div class="mode-info"><h2>${c.name}${medal ? " " + medal : ""}</h2><p>${SPECIAL_DESCS[c.id] || ""}</p></div>
    </button>`;
  }).join("");
}

// pack cards are re-rendered (for mastery medals), so clicks go via delegation
$("specials-grid").addEventListener("click", (e) => {
  const card = e.target.closest(".mode-card");
  if (!card) return;
  startGame("classic", { catId: card.dataset.cat });
});
$("btn-party-back").addEventListener("click", () => { Sound.click(); showScreen("home"); });

function partyPlayerCount() {
  return Number(document.querySelector("#chips-players .chip.active").dataset.value);
}

function renderPartyNames() {
  const count = partyPlayerCount();
  const existing = [...document.querySelectorAll(".party-name-input")].map((i) => i.value);
  $("party-names").innerHTML = Array.from({ length: count }, (_, i) =>
    `<input class="party-name-input" type="text" maxlength="14" placeholder="Player ${i + 1}"
      value="${(existing[i] || (i === 0 && player.profile?.name) || "").replace(/"/g, "&quot;")}" autocomplete="off" />`).join("");
}

$("chips-players").addEventListener("click", (e) => {
  const chip = e.target.closest(".chip");
  if (!chip) return;
  chip.parentElement.querySelectorAll(".chip").forEach((c) => c.classList.remove("active"));
  chip.classList.add("active");
  Sound.click();
  renderPartyNames();
});

$("btn-party-start").addEventListener("click", () => {
  const names = [...document.querySelectorAll(".party-name-input")]
    .map((input, i) => input.value.trim() || `Player ${i + 1}`);
  Sound.click();
  startParty(names);
});

$("btn-pass-ready").addEventListener("click", () => {
  $("pass-overlay").hidden = true;
  Sound.click();
  renderQuestion();
});

$("btn-quit-dingbats").addEventListener("click", () => { Sound.click(); quitGame(); });
$("btn-dingbat-guess").addEventListener("click", submitDingbatGuess);
$("dingbat-input").addEventListener("keydown", (e) => { if (e.key === "Enter") submitDingbatGuess(); });
$("btn-dingbat-hint").addEventListener("click", hintDingbat);
$("btn-dingbat-giveup").addEventListener("click", giveUpDingbat);
$("btn-next-dingbat").addEventListener("click", nextDingbat);

// A fresh question renders with .hover-lock so a button the mouse already rests on
// isn't shown pre-highlighted; the first real pointer move unlocks normal hover.
document.addEventListener("pointermove", () => {
  const a = $("answers");
  if (a.classList.contains("hover-lock")) a.classList.remove("hover-lock");
}, { passive: true });

// Desktop QoL: answer with keys 1–4
document.addEventListener("keydown", (e) => {
  if (!screens.game.classList.contains("active") || !state || state.locked) return;
  const n = Number(e.key);
  if (n >= 1 && n <= 4) {
    const btn = document.querySelectorAll(".answers .answer-btn")[n - 1];
    if (btn && !btn.disabled) btn.click();
  }
});

$("btn-revive").addEventListener("click", () => {
  player.tokens -= 3;
  $("revive-offer").hidden = true;
  Sound.start();
  updateScoreUI();
  nextQuestion();
});
$("btn-no-revive").addEventListener("click", () => {
  $("revive-offer").hidden = true;
  endGame();
});

$("btn-quit-whoami").addEventListener("click", () => { Sound.click(); quitGame(); });
$("btn-guess").addEventListener("click", submitWhoamiGuess);
$("whoami-input").addEventListener("keydown", (e) => { if (e.key === "Enter") submitWhoamiGuess(); });
$("btn-next-clue").addEventListener("click", advanceWhoamiClue);
$("btn-give-up").addEventListener("click", giveUpWhoami);
$("btn-next-char").addEventListener("click", nextWhoamiCharacter);

$("daily-card").addEventListener("click", () => startGame("daily"));
$("lf-fifty").addEventListener("click", () => lifelineClick("fifty", useFifty));
$("lf-skip").addEventListener("click", () => lifelineClick("skip", useSkip));
$("lf-time").addEventListener("click", () =>
  state?.mode === "blitz"
    ? lifelineClick("freeze", useFreeze)
    : lifelineClick("time", useTime));

// Category chips re-render (for mastery medals), so use delegation for clicks
["chips-category", "chips-difficulty"].forEach((id) => {
  $(id).addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    chip.parentElement.querySelectorAll(".chip").forEach((c) => c.classList.remove("active"));
    chip.classList.add("active");
    Sound.click();
  });
});

$("pack-row").addEventListener("click", (e) => {
  const chip = e.target.closest(".pack-chip");
  if (!chip || chip.disabled) return;
  player.soundPack = chip.dataset.pack;
  paintSoundPacks();
  Sound.correct(); // audible preview of the new pack
});

$("track-row").addEventListener("click", (e) => {
  const chip = e.target.closest(".pack-chip");
  if (!chip || chip.disabled) return;
  player.musicTrack = chip.dataset.track;
  paintMusicTracks();
  Sound.click();
  Music.applyTrackChange(); // crossfade in-round, or a short preview from home
});

$("icon-row").addEventListener("click", (e) => {
  const chip = e.target.closest(".pack-chip");
  if (!chip || chip.disabled) return;
  applyAppIcon(chip.dataset.icon);
  paintAppIcons();
  Sound.click();
});

// One button to rule them all: mute/unmute sound effects AND music together.
function paintSoundButton() {
  const btn = $("btn-sound");
  const on = Sound.enabled || Music.enabled;
  btn.textContent = on ? "🔊" : "🔇";
  btn.title = on ? "Mute all" : "Unmute all";
}
$("btn-sound").addEventListener("click", () => {
  const muteNow = Sound.enabled || Music.enabled; // if anything is audible, silence everything
  if (Sound.enabled !== !muteNow) Sound.toggle();
  if (Music.enabled !== !muteNow) Music.toggle();
  paintSoundButton();
  if (!muteNow) { // just unmuted
    Sound.click(); // audible confirmation
    if (Music.enabled && state && !state.ended) Music.start();
  }
});

$("btn-quit").addEventListener("click", () => { Sound.click(); quitGame(); });
$("btn-home").addEventListener("click", () => {
  Sound.click();
  if (state?.awaitingContinue) return endGame(); // "End run" on the level interstitial
  showScreen("home");
});
$("btn-again").addEventListener("click", () => {
  Sound.click();
  if (state?.awaitingContinue) return continueClassicRun();
  const mode = state.mode;
  showScreen("home");
  if (mode === "daily") return; // daily is once per day — back to the menu
  if (mode === "whoami") return startWhoami();
  if (mode === "dingbats") return startDingbats();
  if (mode === "party") return startParty(state.players.map((p) => p.name)); // rematch
  startGame(mode, state.catId ? { catId: state.catId } : {});
});

// A daily left "pending" (opened the question, never answered — swiped away,
// closed the tab, refreshed) is a loss. No way around it.
{
  const d = player.daily;
  if (d?.status === "pending") {
    player.daily = { date: d.date, status: "wrong", score: 0 };
    if (d.date === todayKey()) player.dailyStreak = { count: 0, last: "" };
  }
}

runEconomyOnLoad();
applyTheme(themeUnlocked(player.theme) ? player.theme : "midnight");
{
  const badgeCount = player.badges.length;
  if (!SOUND_PACKS.some((p) => p.id === player.soundPack && badgeCount >= p.badges)) player.soundPack = "classic";
  const icon = APP_ICONS.find((i) => i.id === player.appIcon && badgeCount >= i.badges) ? player.appIcon : "bolt";
  applyAppIcon(icon);
  if (!MUSIC_TRACKS.find((t) => t.id === player.musicTrack)?.unlock()) player.musicTrack = "auto";
}
paintSoundButton();
renderHome();

// Prime the audio engine on the first touch anywhere (iOS gesture requirement)
document.addEventListener("pointerdown", () => Sound.unlock(), { once: true });

// ---------- Living background: gentle drifting motes + slow glows ----------
(() => {
  const cv = $("ambient-bg");
  if (!cv) return;
  const ctx = cv.getContext("2d");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const COLORS = ["255,198,75", "200,166,255", "124,224,255", "255,122,60"]; // gold, rune, frost, ember
  // pre-render a soft glow sprite per colour once (cheaper than per-frame shadowBlur — smooth on phones)
  const sprites = {};
  for (const col of COLORS) {
    const s = document.createElement("canvas"); s.width = s.height = 48;
    const c = s.getContext("2d");
    const g = c.createRadialGradient(24, 24, 0, 24, 24, 24);
    g.addColorStop(0, `rgba(${col},1)`); g.addColorStop(0.3, `rgba(${col},0.65)`); g.addColorStop(1, `rgba(${col},0)`);
    c.fillStyle = g; c.fillRect(0, 0, 48, 48);
    sprites[col] = s;
  }
  let W, H, DPR, motes = [], glows = [], t = 0;
  function resize() {
    DPR = Math.min(2, window.devicePixelRatio || 1);
    W = window.innerWidth; H = window.innerHeight;
    cv.width = W * DPR; cv.height = H * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  function seed() {
    const n = Math.min(80, Math.round((W * H) / 9000));
    motes = [];
    for (let i = 0; i < n; i++) motes.push({
      x: Math.random() * W, y: Math.random() * H,
      r: 0.8 + Math.random() * 2.4, vy: -(3 + Math.random() * 10) / 60,
      sway: 0.3 + Math.random() * 0.9, phase: Math.random() * 6.28,
      col: COLORS[(Math.random() * COLORS.length) | 0], a: 0.18 + Math.random() * 0.5,
    });
    glows = [
      { x: 0.25, y: 0.3, r: 0.5, col: "124,92,255", a: 0.11, vx: 0.00003, vy: 0.00002 },
      { x: 0.75, y: 0.62, r: 0.55, col: "255,122,60", a: 0.07, vx: -0.00002, vy: 0.00003 },
      { x: 0.55, y: 0.12, r: 0.42, col: "124,224,255", a: 0.06, vx: 0.000025, vy: -0.00002 },
    ];
  }
  function frame() {
    t += 1;
    ctx.clearRect(0, 0, W, H);
    for (const g of glows) {
      g.x += g.vx; g.y += g.vy;
      if (g.x < 0.1 || g.x > 0.9) g.vx *= -1;
      if (g.y < 0.05 || g.y > 0.85) g.vy *= -1;
      const cx = g.x * W, cy = g.y * H, rad = g.r * Math.max(W, H);
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
      grad.addColorStop(0, `rgba(${g.col},${g.a})`);
      grad.addColorStop(1, `rgba(${g.col},0)`);
      ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
    }
    for (const m of motes) {
      m.y += m.vy; m.phase += 0.01;
      m.x += Math.sin(m.phase) * m.sway * 0.3;
      if (m.y < -6) { m.y = H + 6; m.x = Math.random() * W; }
      const tw = 0.55 + 0.45 * Math.sin(t * 0.03 + m.phase);
      ctx.globalAlpha = m.a * tw;
      const sz = m.r * 6;
      ctx.drawImage(sprites[m.col], m.x - sz / 2, m.y - sz / 2, sz, sz);
    }
    ctx.globalAlpha = 1;
    if (!reduce) requestAnimationFrame(frame);
  }
  resize(); seed();
  addEventListener("resize", () => { resize(); seed(); });
  requestAnimationFrame(frame);
})();

// Offline + instant loads
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => { /* optional */ });

// Intro: tap gate (also the browser's audio unlock) → 10-second show with the
// intro score → whiteout → home, where the anthem loops. Tap again to skip.
{
  const splash = $("splash");
  const video = $("splash-video");
  const skip = $("splash-skip");
  const mute = $("splash-mute");
  if (mute) mute.onclick = (e) => { e.stopPropagation(); const on = Music.toggle(); mute.textContent = on ? "🔊" : "🔇"; };
  let phase = "gate"; // gate → show → done
  let showTimer = null;
  const INTRO_KEY = "rr-intro-seen-v2";
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let seen = false; try { seen = localStorage.getItem(INTRO_KEY) === "1"; } catch { /* private mode */ }
  const finish = (slow) => {
    if (phase === "done") return;
    phase = "done";
    clearTimeout(showTimer);
    try { video.pause(); } catch { /* ignore */ }
    Music.start("anthem"); // menu bed once the film is done
    // the film ends on black, so a long slow fade reveals the menu gently
    splash.classList.add(slow ? "out-slow" : "out");
    setTimeout(() => splash.remove(), slow ? 3200 : 700);
    document.body.classList.add("intro-done");
    // economy notices, once the stage is clear
    setTimeout(() => {
      if (window.__freezeUsed) { toast("🧊 Streak freeze used — your streak is safe!"); window.__freezeUsed = false; }
      else if (window.__loginBonus) { toast(`📅 Daily login bonus: +${window.__loginBonus} Gold`); window.__loginBonus = 0; }
    }, slow ? 3400 : 900);
  };
  splash.addEventListener("click", () => {
    if (phase === "gate") {
      Sound.unlock(); // the gate tap is the browser's audio-unlock gesture
      Music.start("anthem"); // one continuous bed, from here through the intro into the menus
      if (reduced) return finish(false); // reduced-motion users skip straight to the hub
      phase = "show";
      $("splash-gate").hidden = true;
      video.hidden = false;
      skip.hidden = false;
      if (mute) { mute.hidden = false; mute.textContent = Music.enabled ? "🔊" : "🔇"; }
      try { localStorage.setItem(INTRO_KEY, "1"); } catch { /* private mode */ }
      video.src = "media/riddle-rune-intro.mp4"; // load only when we actually play it
      video.onended = () => finish(true);  // film ended on black → slow, smooth reveal
      video.onerror = () => finish(false); // offline / decode failure → just enter
      video.play().catch(() => finish(false)); // autoplay blocked → skip to home
      showTimer = setTimeout(() => finish(false), 42000); // safety net if the film stalls
    } else {
      finish(false); // tap / Skip during the film → quicker
    }
  });
}

// First visit (or missing profile): orientation + profile setup in one card.
// Tapping your name on the home screen reopens it for edits.
// First-run onboarding is a small wizard: name → avatar → what-things-are.
// Editing an existing profile (tapping your name) reuses steps 1–2 only.
let wizFirstRun = false;
function showWizStep(n) {
  document.querySelectorAll("#welcome-card .wiz-step").forEach((s) => { s.hidden = Number(s.dataset.step) !== n; });
}
function openProfileSetup(firstRun) {
  wizFirstRun = !!firstRun;
  const p = player.profile;
  $("profile-name").value = p?.name || "";
  const current = p?.avatar || AVATARS[0];
  $("avatar-grid").innerHTML = AVATARS.map((a) =>
    `<button class="avatar-chip ${a === current ? "active" : ""}" data-avatar="${a}">${a}</button>`).join("");
  $("wiz-next-2").textContent = firstRun ? "Next →" : "Save";
  showWizStep(1);
  $("welcome-overlay").hidden = false;
  setTimeout(() => { try { $("profile-name").focus(); } catch { /* ignore */ } }, 60);
}

$("avatar-grid").addEventListener("click", (e) => {
  const chip = e.target.closest(".avatar-chip");
  if (!chip) return;
  document.querySelectorAll(".avatar-chip").forEach((c) => c.classList.remove("active"));
  chip.classList.add("active");
  Sound.click();
});

function saveProfileAndClose() {
  player.profile = {
    name: $("profile-name").value.trim().slice(0, 16) || "Player",
    avatar: document.querySelector(".avatar-chip.active")?.dataset.avatar || AVATARS[0],
  };
  try { localStorage.setItem("quizrush-welcomed", "1"); } catch { /* private mode */ }
  const ov = $("welcome-overlay");
  ov.classList.add("closing");
  setTimeout(() => { ov.hidden = true; ov.classList.remove("closing"); }, 480);
  paintPlayerBar();
  Music.start("anthem"); // keep the same bed playing (no-op if already going)
}

$("wiz-next-1").addEventListener("click", () => {
  if (!$("profile-name").value.trim()) { $("profile-name").focus(); return; } // a name is required first
  Sound.click(); showWizStep(2);
});
$("profile-name").addEventListener("keydown", (e) => { if (e.key === "Enter") $("wiz-next-1").click(); });
$("wiz-next-2").addEventListener("click", () => {
  Sound.click();
  if (wizFirstRun) showWizStep(3); else saveProfileAndClose(); // editing ends after the avatar
});
$("wiz-done").addEventListener("click", () => { Sound.click(); saveProfileAndClose(); });

$("player-name").addEventListener("click", () => { Sound.click(); openProfileSetup(false); });

if (!player.profile) openProfileSetup(true);
