/* ================= QuizRush =================
   Modes:
   - classic: 10 questions, per-question 15s timer, speed + streak scoring
   - sudden:  endless until first wrong answer (or timeout)
   - blitz:   60s global clock, answer as many as possible
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

  function tone(freq, { type = "sine", dur = 0.3, vol = 0.12, when = 0, slide = null, attack = 0.025 } = {}) {
    if (!enabled) return;
    try {
      // Apply the active sound pack's character (SOUND_PACKS is defined below;
      // tones only ever fire after the script has fully parsed)
      const packId = localStorage.getItem("quizrush-soundpack") || "classic";
      const pack = SOUND_PACKS.find((p) => p.id === packId) || SOUND_PACKS[0];
      freq *= pack.pitch;
      dur *= pack.durMult;
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
      filter.frequency.value = 2400;
      osc.connect(gain).connect(filter).connect(c.destination);
      osc.start(t);
      osc.stop(t + dur + 0.1);
    } catch { /* audio is never worth crashing the game over */ }
  }

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
    click()   { tone(480, { dur: 0.09, vol: 0.05, attack: 0.01 }); },
    start()   { tone(330, { dur: 0.4, vol: 0.08, slide: 660, attack: 0.06 }); },
    correct() {
      tone(523.25, { dur: 0.35, vol: 0.1, attack: 0.02 });                  // C5
      tone(659.25, { dur: 0.5, vol: 0.1, when: 0.09, attack: 0.03 });       // E5
    },
    wrong()   { tone(196, { dur: 0.5, vol: 0.1, slide: 165, attack: 0.04 }); }, // soft low sigh, no buzz
    tick()    { tone(880, { dur: 0.05, vol: 0.03, attack: 0.008 }); },
    fanfare() {
      [523.25, 659.25, 783.99].forEach((f, i) =>
        tone(f, { dur: 0.45, vol: 0.09, when: i * 0.15, attack: 0.03 }));
      tone(1046.5, { dur: 0.9, vol: 0.09, when: 0.45, attack: 0.05 });
    },
    best() {
      tone(261.63, { dur: 1.3, vol: 0.045, attack: 0.12 }); // warm low pad underneath
      [523.25, 587.33, 659.25, 783.99, 1046.5].forEach((f, i) =>
        tone(f, { dur: 0.5, vol: 0.09, when: i * 0.12, attack: 0.03 }));
    },
    levelUp() {
      // ~2s gentle jingle: sustained C+G pad with a slow rising arpeggio on top
      tone(261.63, { dur: 1.9, vol: 0.045, attack: 0.15 });
      tone(392, { dur: 1.9, vol: 0.035, attack: 0.15 });
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
        tone(f, { dur: 0.6, vol: 0.09, when: 0.15 + i * 0.22, attack: 0.04 }));
      tone(1318.5, { dur: 1.0, vol: 0.07, when: 1.05, attack: 0.06 });
    },
  };
})();

// ---------- Background music (generative, no audio files) ----------
// A faint loop: soft bass + sustained pad + plucked arpeggio over C–G–Am–F.
// Light randomization keeps it from feeling mechanical on repeat.
const Music = (() => {
  let ctx = null, master = null, lp = null, timer = null, previewTimer = null;
  let nextBarTime = 0, barIndex = 0, playing = false, style = null;
  let enabled = localStorage.getItem("quizrush-music") !== "off";

  // Chord voicings (Hz)
  const C = [261.63, 329.63, 392.0], G = [196.0, 246.94, 293.66];
  const Am = [220.0, 261.63, 329.63], F = [174.61, 220.0, 261.63];
  const Em = [164.81, 196.0, 246.94], Dm = [146.83, 174.61, 220.0];
  const Cmaj7 = [261.63, 329.63, 392.0, 493.88], Am7 = [220.0, 261.63, 329.63, 392.0];
  const Fmaj7 = [174.61, 220.0, 261.63, 329.63], G7 = [196.0, 246.94, 293.66, 349.23];

  function ensureCtx() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      try { if (navigator.audioSession) navigator.audioSession.type = "playback"; } catch { /* older iOS */ }
      master = ctx.createGain();
      lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      master.connect(lp).connect(ctx.destination);
    }
    if (ctx.state === "suspended") ctx.resume();
  }

  function note(freq, when, dur, vol, type = "triangle", attack = 0.05) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.linearRampToValueAtTime(vol, when + attack);
    gain.gain.exponentialRampToValueAtTime(0.001, when + dur);
    osc.connect(gain).connect(master);
    osc.start(when);
    osc.stop(when + dur + 0.1);
  }

  // ----- Track styles: each renders one bar -----
  const STYLES = {
    breeze: { bar: 2.0, lp: 1600, chords: [C, G, Am, F], render(t, c, bar) {
      note(c[0] / 2, t, bar * 0.95, 0.05, "sine");
      c.forEach((f) => note(f, t, bar * 0.98, 0.016, "sine"));
      for (let i = 0; i < 8; i++) {
        if (Math.random() < 0.22) continue;
        note(c[i % 3] * (i % 4 === 3 ? 2 : 1), t + i * (bar / 8) + (Math.random() - 0.5) * 0.015, 0.22, 0.038);
      }
    } },
    ivory: { bar: 2.4, lp: 1800, chords: [Cmaj7, Am7, Fmaj7, G7], render(t, c, bar) {
      note(c[0] / 2, t, bar * 0.96, 0.045, "sine", 0.08);
      const seq = [c[0], c[2], c[3] || c[1] * 2, c[1]];
      seq.forEach((f, i) => {
        const when = t + i * (bar / 4) + (Math.random() - 0.5) * 0.02;
        note(f, when, 1.5, 0.05, "sine", 0.02);              // piano-ish body
        note(f * 2.003, when, 0.9, 0.012, "sine", 0.02);     // faint detuned shimmer
      });
    } },
    minuet: { bar: 1.8, lp: 2200, chords: [C, G, Am, Em, F, C, Dm, G], render(t, c, bar) {
      const alberti = [c[0], c[2], c[1], c[2], c[0], c[2], c[1], c[2]];
      alberti.forEach((f, i) => note(f, t + i * (bar / 8), 0.26, 0.036, "triangle", 0.01));
      note(c[2] * 2, t, 0.7, 0.045, "triangle", 0.015);       // upper voice
      note((Math.random() < 0.5 ? c[1] : c[0]) * 2, t + bar / 2, 0.7, 0.04, "triangle", 0.015);
    } },
    pulse: { bar: 1.6, lp: 2600, chords: [Am, Am, F, G], render(t, c, bar) {
      const beat = bar / 4;
      for (let i = 0; i < 4; i++) {
        note(110, t + i * beat, 0.13, 0.13, "sine", 0.005);   // kick thump
        note(45, t + i * beat, 0.13, 0.1, "sine", 0.005);
        note(c[0] / 2, t + i * beat + beat / 2, 0.14, 0.032, "square", 0.008); // offbeat bass
        note(4200, t + i * beat + beat / 2, 0.03, 0.011, "triangle", 0.004);   // hat tick
      }
      [1, 3].forEach((i) => c.forEach((f) => note(f, t + i * beat, 0.11, 0.013, "square", 0.008))); // stabs
    } },
    chip: { bar: 1.6, lp: 3000, chords: [C, G, Am, F], render(t, c, bar) {
      const riff = [c[0], c[1], c[2], c[0] * 2, c[2], c[1], c[2], c[1]];
      riff.forEach((f, i) => note(f * 2, t + i * (bar / 8), 0.16, 0.026, "square", 0.005));
      for (let i = 0; i < 4; i++) note(c[0] / 2, t + i * (bar / 4), 0.2, 0.038, "square", 0.008);
    } },
    cosmos: { bar: 3.2, lp: 1200, chords: [Am, F, C, G], render(t, c, bar) {
      note(c[0] / 4, t, bar * 0.98, 0.05, "sine", 0.9);       // sub drone
      c.forEach((f, i) => note(f, t + i * 0.25, bar * 0.9, 0.02, "sine", 0.8)); // slow swells
      if (Math.random() < 0.4) note(c[Math.floor(Math.random() * c.length)] * 4, t + Math.random() * bar * 0.6, 0.9, 0.016, "sine", 0.1); // sparkle
    } },
  };

  function currentStyle() {
    return STYLES[localStorage.getItem("quizrush-music-track") || "breeze"] || STYLES.breeze;
  }

  function tick() {
    while (nextBarTime < ctx.currentTime + 0.5) {
      style.render(nextBarTime, style.chords[barIndex % style.chords.length], style.bar);
      nextBarTime += style.bar;
      barIndex++;
    }
  }

  return {
    get enabled() { return enabled; },
    get playing() { return playing; },
    toggle() {
      enabled = !enabled;
      try { localStorage.setItem("quizrush-music", enabled ? "on" : "off"); } catch { /* play on */ }
      if (!enabled) this.stop();
      return enabled;
    },
    start() {
      if (!enabled || playing) return;
      try {
        ensureCtx();
        playing = true;
        style = currentStyle();
        lp.frequency.value = style.lp;
        master.gain.cancelScheduledValues(ctx.currentTime);
        master.gain.setValueAtTime(0.0001, ctx.currentTime);
        master.gain.linearRampToValueAtTime(1, ctx.currentTime + 1.4); // gentle fade in
        nextBarTime = ctx.currentTime + 0.05;
        barIndex = 0;
        tick();
        timer = setInterval(tick, 200);
      } catch { playing = false; /* music is never worth an error */ }
    },
    stop() {
      if (!playing) return;
      playing = false;
      clearInterval(timer);
      try {
        master.gain.cancelScheduledValues(ctx.currentTime);
        master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
        master.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.8); // fade out
      } catch { /* already gone */ }
    },
    // Called after the selected track changes: crossfade in-round, or play a
    // short preview when browsing from the home screen
    applyTrackChange() {
      clearTimeout(previewTimer);
      if (playing) {
        this.stop();
        setTimeout(() => this.start(), 900);
      } else if (!state) {
        this.start();
        previewTimer = setTimeout(() => { if (!state) this.stop(); }, 3400);
      }
    },
  };
})();

const OTDB_API = "https://opentdb.com";
const TTA_API = "https://the-trivia-api.com/v2";
// The Trivia API is CC BY-NC (non-commercial). Flip this to false for a
// commercial build: the broker then runs on Open Trivia DB + our own bank only.
const INCLUDE_NC_SOURCES = true;
const QUESTION_TIME = 15;      // seconds per question (classic / sudden)
const DAILY_TIME = { easy: 10, medium: 15, hard: 20 }; // daily: thinking time scales with difficulty
const BLITZ_TIME = 60;         // seconds total (blitz)
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
const LEVEL_MIXES = [
  { easy: 8, medium: 2, hard: 0 },  // L1
  { easy: 6, medium: 4, hard: 0 },  // L2
  { easy: 4, medium: 5, hard: 1 },  // L3
  { easy: 3, medium: 5, hard: 2 },  // L4
  { easy: 2, medium: 5, hard: 3 },  // L5
  { easy: 1, medium: 4, hard: 5 },  // L6
  { easy: 1, medium: 3, hard: 6 },  // L7
  { easy: 0, medium: 3, hard: 7 },  // L8
  { easy: 0, medium: 2, hard: 8 },  // L9
  { easy: 0, medium: 1, hard: 9 },  // L10
];
const levelMix = (lvl) => (lvl <= 10 ? LEVEL_MIXES[lvl - 1] : { easy: 0, medium: 0, hard: 10 });
const LEVEL_RULES = (lvl) => ({ mix: levelMix(lvl), need: lvl <= 6 ? 7 : lvl <= 8 ? 8 : 9 });
const mixLabel = (m) =>
  ["easy", "medium", "hard"].filter((d) => m[d]).map((d) => `${m[d]} ${d}`).join(" · ");

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
const MUSIC_TRACKS = [
  { id: "breeze", name: "Breeze", icon: "🍃", req: "", unlock: () => true },
  { id: "ivory",  name: "Ivory",  icon: "🎹", req: "Reach player level 3",     unlock: () => levelFromXp(player.xp) >= 3 },
  { id: "minuet", name: "Minuet", icon: "🎻", req: "Earn 4 badges",            unlock: () => player.badges.length >= 4 },
  { id: "pulse",  name: "Pulse",  icon: "🎛️", req: "Reach Level 4 in Classic", unlock: () => player.bestClassicLevel >= 4 },
  { id: "chip",   name: "8-Bit",  icon: "👾", req: "Earn a category medal",    unlock: () => CATEGORIES.some((c) => medalFor(c.id)) },
  { id: "cosmos", name: "Cosmos", icon: "🌌", req: "3-day daily streak",       unlock: () => player.bestDailyStreak >= 3 },
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
  get catStats() { return getJSON("quizrush-catstats", {}); },
  set catStats(v) { setJSON("quizrush-catstats", v); },
  get soundPack() { return localStorage.getItem("quizrush-soundpack") || "classic"; },
  set soundPack(v) { safeSetItem("quizrush-soundpack", v); },
  get appIcon() { return localStorage.getItem("quizrush-appicon") || "bolt"; },
  set appIcon(v) { safeSetItem("quizrush-appicon", v); },
  get profile() { return getJSON("quizrush-profile", null); }, // { name, avatar }
  set profile(v) { setJSON("quizrush-profile", v); },
  get musicTrack() { return localStorage.getItem("quizrush-music-track") || "breeze"; },
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

// ---------- Backend (leaderboards + global answer stats) ----------
// Points at the Cloudflare Worker in backend/. Empty string = offline mode:
// every Net call silently no-ops, so the game never depends on the server.
const BACKEND_URL = localStorage.getItem("quizrush-backend") || "";

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
      const res = await fetch(BACKEND_URL + path, {
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
      const res = await fetch(BACKEND_URL + path);
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

// ---------- Nemesis questions ----------
// Questions you miss come back in later games (tagged 😈, worth 1.5×) until
// you beat them. Capped so the list stays a grudge, not a graveyard.
const NEMESIS_CAP = 30;

const nemesisKey = (q) => q.text + (q.big || "");

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
      category: cat?.name || "QuizRush",
      catId: q.cat,
      difficulty: q.difficulty,
      text: q.text,
      correct: q.correct,
      answers: shuffle([q.correct, ...q.wrong]),
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
  home: $("screen-home"),
  brainmenu: $("screen-brainmenu"),
  picturemenu: $("screen-picturemenu"),
  specialsmenu: $("screen-specialsmenu"),
  partysetup: $("screen-partysetup"),
  game: $("screen-game"),
  whoami: $("screen-whoami"),
  dingbats: $("screen-dingbats"),
  results: $("screen-results"),
};

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

function showScreen(name) {
  const target = screens[name];
  const current = Object.values(screens).find((s) => s.classList.contains("active"));
  if (current === target) return;
  // Two-phase transition: outgoing screen glides away, then the new one enters
  if (!current || matchMedia("(prefers-reduced-motion: reduce)").matches) {
    Object.values(screens).forEach((s) => s.classList.remove("active", "screen-exit"));
    target.classList.add("active");
    return;
  }
  current.classList.add("screen-exit");
  setTimeout(() => {
    Object.values(screens).forEach((s) => s.classList.remove("active", "screen-exit"));
    target.classList.add("active");
  }, 290);
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

function fetchFromBank({ amount, catId, difficulty }) {
  const pool = QUIZRUSH_BANK.filter(
    (q) => (!catId || q.cat === catId) && (!difficulty || q.difficulty === difficulty)
  );
  return shuffle(pool).slice(0, amount).map((q) => ({
    category: CATEGORIES.find((c) => c.id === q.cat)?.name || "QuizRush",
    difficulty: q.difficulty,
    text: q.text,
    big: q.big || "",
    correct: q.correct,
    answers: shuffle([q.correct, ...q.wrong]),
  }));
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

// Compose a level's blend from an unfiltered pool: take the requested count
// of each tier, then fill any shortfall starting from medium (adjacent to both).
function composeMix(pool, mix, amount) {
  const by = { easy: [], medium: [], hard: [] };
  pool.forEach((q) => (by[q.difficulty] || by.medium).push(q));
  const picked = [];
  for (const d of ["hard", "medium", "easy"]) picked.push(...by[d].splice(0, mix[d] || 0));
  const leftovers = [...by.medium, ...by.easy, ...by.hard];
  while (picked.length < amount && leftovers.length) picked.push(leftovers.shift());
  return shuffle(picked).slice(0, amount);
}

async function getQuestions({ catId = "", difficulty = "", amount = 10, mix = null, exclude = null }) {
  if (difficulty === "smart") {
    // fetch at the tier the player's record points to, so the difficulty is
    // real rather than whatever mix the sources happened to return
    const w = smartWeights(catId);
    const dominant = Object.entries(w).sort((a, b) => b[1] - a[1])[0][0];
    return getQuestions({ catId, difficulty: dominant, amount });
  }
  const cat = CATEGORIES.find((c) => c.id === catId);
  const useOtdb = !cat || cat.otdb.length > 0;
  const useTta = INCLUDE_NC_SOURCES && (!cat || cat.tta.length > 0 || cat.ttaTags?.length > 0);
  // Mixed levels over-fetch an unfiltered pool so every tier is well stocked
  const srcAmount = mix ? 50 : amount;
  const srcDifficulty = mix ? "" : difficulty;
  // Bank-backed categories get the full bank (all of it for blended levels, so
  // the no-repeat filter has the whole pool to draw on); "Any" games get a
  // light sprinkle so riddles season mixed rounds without dominating them.
  const bankAmount = cat?.bank ? (mix ? 500 : srcAmount) : cat ? 0 : Math.ceil(amount * 0.15);

  const [otdb, tta] = await Promise.allSettled([
    useOtdb ? fetchFromOTDB({ amount: srcAmount, otdbCats: cat?.otdb, difficulty: srcDifficulty }) : Promise.resolve([]),
    useTta ? fetchFromTTA({ amount: srcAmount, ttaCats: cat?.tta, ttaTags: cat?.ttaTags, difficulty: srcDifficulty }) : Promise.resolve([]),
  ]);

  const pool = [otdb, tta].flatMap((r) => (r.status === "fulfilled" ? r.value : []))
    .concat(bankAmount ? fetchFromBank({ amount: bankAmount, catId, difficulty: srcDifficulty }) : []);
  const seen = new Set();
  const merged = shuffle(pool).filter((q) => {
    // picture questions share their prompt text, so the visual is part of identity
    const key = normalizeText(q.text) + (q.big || "");
    if (!normalizeText(q.text) || seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  if (!merged.length) {
    const rateLimited = otdb.status === "rejected" && otdb.reason?.message === "rate-limited";
    throw new Error(rateLimited ? "rate-limited" : "no-questions");
  }
  // Tag with our taxonomy id so mastery stats can attribute every answer
  merged.forEach((q) => { q.catId = catId || NAME_TO_CAT[q.category.toLowerCase()] || ""; });

  // No-repeat memory: skip questions this run has already served, unless that
  // would leave the round short — better an occasional repeat than a thin level
  let available = exclude?.size ? merged.filter((q) => !exclude.has(nemesisKey(q))) : merged;
  if (available.length < amount) available = merged;

  // For blended levels, shape the pool to the requested tier proportions
  const shaped = mix ? composeMix(available, mix, amount) : available;

  // Sprinkle in up to two nemesis questions seeking revenge
  const nemeses = pickNemeses(catId, mix ? "" : difficulty);
  if (nemeses.length) {
    const qKey = (q) => q.text + (q.big || "");
    const nemesisKeys = new Set(nemeses.map(qKey));
    const base = shaped.filter((q) => !nemesisKeys.has(qKey(q))).slice(0, Math.max(amount - nemeses.length, 1));
    return shuffle(base.concat(nemeses)).slice(0, amount);
  }
  return shaped.slice(0, amount);
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
    } else if (mode === "custom") {
      // Your Rules: the player picks both knobs
      opts.catId = document.querySelector("#chips-category .chip.active").dataset.value;
      opts.difficulty = document.querySelector("#chips-difficulty .chip.active").dataset.value;
    } else {
      opts.amount = 50; // big pool for endless / blitz runs
    }

    setLoading(true, "Fetching questions…");
    try {
      questions = await getQuestions(opts);
    } catch (err) {
      setLoading(false);
      alert(
        err.message === "rate-limited"
          ? "The trivia service is rate-limiting us — wait a few seconds and try again."
          : "Couldn't load questions for those settings. Try a different category or difficulty."
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
    // The daily is a pure one-shot test — no helpers
    lifelines: mode === "daily"
      ? { fifty: false, skip: false, time: false }
      : { fifty: true, skip: true, time: true },
    locked: false,
    qTimer: null,
    qTimeLeft: QUESTION_TIME,
    blitzTimer: null,
    blitzTimeLeft: BLITZ_TIME,
  };

  // Mode-specific chrome
  $("blitz-timer").hidden = mode !== "blitz";
  $("timer-ring-wrap").style.display = mode === "blitz" ? "none" : "";
  $("game-progress").style.visibility = mode === "blitz" || mode === "daily" ? "hidden" : "visible";
  document.querySelector(".progress-track").style.display = mode === "classic" || mode === "custom" ? "" : "none";
  $("lifelines").style.display = mode === "daily" ? "none" : "";
  $("streak-badge").style.display = "";
  $("game-tokens").style.display = "";
  $("party-turn").hidden = true;
  $("lf-time-label").textContent = mode === "blitz" ? "⏰ +5s" : "⏰ +7s";
  paintLifelines();

  updateScoreUI();
  showScreen("game");
  Sound.start();
  Music.start();

  if (mode === "blitz") {
    // 3… 2… 1… GO! before the clock starts running
    playCountdown(() => {
      startBlitzClock();
      renderQuestion();
    });
  } else {
    renderQuestion();
  }
}

function renderQuestion() {
  const q = state.questions[state.index];
  if (!q) return endGame(); // pool exhausted (sudden/blitz)

  state.locked = false;

  const card = $("question-card");
  card.classList.remove("slide-out", "shake");
  card.classList.add("slide-in");
  card.addEventListener("animationend", () => card.classList.remove("slide-in"), { once: true });

  $("q-category").textContent = (q.nemesis ? "😈 Revenge · " : "") + q.category;
  const diff = $("q-difficulty");
  diff.textContent = q.difficulty;
  diff.className = "q-difficulty " + q.difficulty;

  $("question-text").textContent = q.text;
  $("q-visual").textContent = q.big || "";
  $("q-visual").hidden = !q.big;

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
  const answersEl = $("answers");
  answersEl.innerHTML = "";
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
  $("timer-num").textContent = String(Math.ceil(state.qTimeLeft));
}

function startBlitzClock() {
  clearInterval(state.blitzTimer);
  state.blitzTimeLeft = BLITZ_TIME;
  let lastTickSec = Math.ceil(BLITZ_TIME);
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
  $("blitz-timer-fill").classList.toggle("danger", frac <= 0.2);
  $("blitz-timer-label").textContent = String(Math.ceil(state.blitzTimeLeft));
}

// ---------- Lifelines (one use of each per game) ----------
function paintLifelines() {
  if (!state?.lifelines) return;
  for (const kind of ["fifty", "skip", "time"]) {
    const btn = $("lf-" + kind);
    const avail = state.lifelines[kind];
    const refillable = !avail && state.mode !== "daily" && player.tokens >= 2;
    const lockedNow = state.locked && !(kind === "time" && state.mode === "blitz");
    btn.disabled = lockedNow || (!avail && !refillable);
    btn.classList.toggle("used", !avail && !refillable);
    btn.classList.toggle("refill", refillable);
    if (refillable) btn.title = "Used — tap to refill for 2 🪙";
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
  if (!state || !state.lifelines.time) return;
  if (state.mode !== "blitz" && state.locked) return;
  state.lifelines.time = false;
  if (state.mode === "blitz") {
    state.blitzTimeLeft += 5;
    paintBlitz();
  } else {
    state.qTimeLeft += 7;
    paintRing();
  }
  Sound.click();
  paintLifelines();
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
      Sound.correct();
      flash("green");
    } else {
      $("question-card").classList.add("shake");
      Sound.wrong();
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
    popPoints("+" + points.toLocaleString());
    Sound.correct();
    flash("green");
    if (q.nemesis) clearNemesis(q); // revenge complete
  } else {
    state.streak = 0;
    recordNemesis(q);
    $("question-card").classList.add("shake");
    Sound.wrong();
    flash("red");
    if (state.mode === "sudden") {
      updateScoreUI();
      setTimeout(() => (player.tokens >= 3 ? showReviveOffer() : endGame()), 1100);
      return;
    }
  }

  updateScoreUI();
  const delay = state.mode === "blitz" ? 550 : 1000;
  setTimeout(nextQuestion, delay);
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
  Sound.wrong();
  flash("red");
  updateScoreUI();

  if (state.mode === "sudden") {
    setTimeout(() => (player.tokens >= 3 ? showReviveOffer() : endGame()), 1100);
  } else {
    setTimeout(nextQuestion, 1000);
  }
}

// Sudden Death second chance: spend 3 tokens to survive a wrong answer
function showReviveOffer() {
  if (!state || state.ended) return; // player quit during the reveal delay
  $("revive-offer").hidden = false;
  $("revive-balance").textContent = `You have ${player.tokens} 🪙`;
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
  card.classList.add("slide-out");
  card.addEventListener("animationend", () => renderQuestion(), { once: true });
}

// Gentle full-screen vignette pulse: green for right, red for wrong.
// Paired with a haptic tap on devices that support it (Android; iOS ignores it).
function flash(kind) {
  const el = $("feedback-flash");
  el.className = "feedback-flash " + kind;
  void el.offsetWidth; // restart the animation
  el.classList.add("pulse");
  try { navigator.vibrate?.(kind === "green" ? 35 : [60, 40, 60]); } catch { /* optional */ }
}

function popPoints(text) {
  const pop = $("points-pop");
  pop.textContent = text;
  pop.classList.remove("show");
  void pop.offsetWidth; // restart animation
  pop.classList.add("show");
}

function updateScoreUI() {
  if (state.mode === "party") {
    const p = state.players[state.current];
    $("score-value").textContent = p.score.toLocaleString();
    $("party-turn").textContent = "🎮 " + p.name;
    return;
  }
  $("score-value").textContent = state.score.toLocaleString();
  $("game-tokens").textContent = "🪙 " + player.tokens;
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
  $("whoami-progress").textContent = `${state.index + 1} / ${WHOAMI_ROUND}`;
  $("whoami-reveal").hidden = true;
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
    Sound.correct();
    flash("green");
    resolveWhoami(`✓ ${ch.answer} · +${points} pts`, true);
  } else {
    $("whoami-input").value = "";
    $("whoami-input").placeholder = "Not quite — try again…";
    document.querySelector("#screen-whoami .question-card").classList.remove("shake");
    void document.querySelector("#screen-whoami .question-card").offsetWidth;
    document.querySelector("#screen-whoami .question-card").classList.add("shake");
    Sound.wrong();
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
  Sound.wrong();
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
  if (nextLevel > player.bestClassicLevel) player.bestClassicLevel = nextLevel;
  player.tokens += 1; // clearing a level pays a token

  state.awaitingContinue = true;
  $("btn-share").hidden = true;
  $("results-emoji").textContent = "🚀";
  $("results-title").textContent = `Level ${state.level} cleared!`;
  $("new-best").hidden = true;
  $("results-score").textContent = state.score.toLocaleString();
  $("results-score-label").textContent = "points so far";
  const nr = LEVEL_RULES(nextLevel);
  $("results-xp").innerHTML =
    `${state.levelCorrect} / ${state.questions.length} correct · +1 🪙 — ` +
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
    questions = await getQuestions({ catId: state.catId, mix: levelMix(nextLevel), amount: 10, exclude: state.usedQKeys });
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
function startDingbats() {
  if (!startGuard()) return;
  state = {
    mode: "dingbats",
    puzzles: shuffle(DINGBAT_BANK).slice(0, DINGBAT_ROUND),
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

function renderDingbat() {
  const p = state.puzzles[state.index];
  state.value = DINGBAT_VALUE;
  state.resolved = false;
  $("dingbats-progress").textContent = `${state.index + 1} / ${DINGBAT_ROUND}`;
  const disp = $("dingbat-display");
  disp.textContent = p.display;
  disp.className = "dingbat-display " + p.type;
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
    Sound.correct();
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
    Sound.wrong();
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
  Sound.wrong();
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
  Music.stop();
  flushAnswerStats();
  if (state.mode === "party") return endParty();
  state.awaitingContinue = false;
  state.maxLevelCorrect = Math.max(state.maxLevelCorrect || 0, state.levelCorrect || 0);
  // restore results-screen chrome the level interstitial or a party may have changed
  $("btn-again").textContent = "Play again";
  $("btn-home").textContent = "Home";
  $("results-score-label").textContent = "points";
  $("party-podium").hidden = true;
  if (state.mode !== "daily") $("daily-board").innerHTML = "";
  document.querySelector(".results-stats").style.display = "";

  const { mode, score, correct, answered, bestStreak } = state;
  const accuracy = answered ? Math.round((correct / answered) * 100) : 0;

  // Daily is once per day, so a cross-day "best" doesn't apply
  const isBest = mode !== "daily" && score > getBest(mode);
  if (isBest) setBest(mode, score);

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
  const titleChanged = titleForLevel(lvlAfter) !== titleForLevel(lvlBefore);
  $("results-xp").innerHTML =
    `+${xpGained} XP` +
    (mode === "daily" && dailyWon ? ` · +2 🪙 · 🔥 ${liveDailyStreak()}-day daily streak` : "") +
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
    blitz: "Time's up!",
    whoami: `Identified ${correct} of ${answered}!`,
    dingbats: `Decoded ${correct} of ${answered}!`,
  }[mode];
  $("new-best").hidden = !isBest;
  countUp($("results-score"), score);
  $("stat-correct").textContent = String(correct);
  $("stat-accuracy").textContent = accuracy + "%";
  $("stat-streak").textContent = String(bestStreak);

  $("btn-share").hidden = mode !== "daily";
  renderHome();

  const reveal = () => {
    showScreen("results");
    showBadgeToast(newBadges);
  };
  if (mode === "daily" && dailyWon) {
    // the emotional peak of a streak day gets the full cinematic
    playCelebration({ big: "DAILY SOLVED!", sub: `🔥 ${liveDailyStreak()}-day streak` }, reveal);
  } else {
    reveal();
    if (isBest || ((mode === "classic" || mode === "custom") && state.maxLevelCorrect >= 10)) confetti();
    if (isBest || newBadges.length) Sound.best();
    else Sound.fanfare();
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
  const lines = [`⚡ QuizRush Daily #${num} — ${cat?.emoji || "🧠"} ${diffLabel}`];
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

// ---------- Level-up cinematic ----------
function playLevelUpCinematic(nextLevel, then) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) { Sound.levelUp(); return then(); }
  const ov = $("levelup-overlay");
  $("lu-num").textContent = String(nextLevel);
  ov.hidden = false;
  ov.classList.remove("play");
  void ov.offsetWidth;
  ov.classList.add("play");
  confetti();
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
  Music.stop();
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
  $("player-tokens").textContent = "🪙 " + player.tokens;
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

function paintThemes() {
  const best = player.bestDailyStreak;
  $("theme-row").innerHTML = THEMES.map((t) => {
    const unlocked = best >= t.streak;
    const active = player.theme === t.id;
    const title = unlocked ? t.name : `${t.name} — reach a ${t.streak}-day daily streak`;
    return `<button class="theme-swatch swatch-${t.id} ${active ? "active" : ""} ${unlocked ? "" : "locked"}"
      data-theme-id="${t.id}" title="${title}" ${unlocked ? "" : "disabled"}>${unlocked ? "" : "🔒"}</button>`;
  }).join("");
  document.querySelectorAll(".theme-swatch:not(.locked)").forEach((btn) => {
    btn.addEventListener("click", () => {
      applyTheme(btn.dataset.themeId);
      Sound.click();
      paintThemes();
    });
  });
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
}

// ---------- Wiring ----------
document.querySelectorAll(".mode-card").forEach((card) => {
  card.addEventListener("click", () => {
    if (card.disabled) return;
    if (card.dataset.action === "brainmenu") { Sound.click(); return showScreen("brainmenu"); }
    if (card.dataset.action === "picturemenu") { Sound.click(); return showScreen("picturemenu"); }
    if (card.dataset.action === "specialsmenu") { Sound.click(); paintSpecials(); return showScreen("specialsmenu"); }
    if (card.dataset.action === "partysetup") { Sound.click(); renderPartyNames(); return showScreen("partysetup"); }
    if (card.dataset.mode === "whoami") return startWhoami();
    if (card.dataset.mode === "dingbats") return startDingbats();
    startGame(card.dataset.mode, card.dataset.cat ? { catId: card.dataset.cat } : {});
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
  $("specials-grid").innerHTML = CATEGORIES.filter((c) => c.special).map((c) => {
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
$("lf-time").addEventListener("click", () => lifelineClick("time", useTime));

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

function paintSoundButton() {
  const btn = $("btn-sound");
  btn.textContent = Sound.enabled ? "🔊" : "🔇";
  btn.title = Sound.enabled ? "Mute sounds" : "Unmute sounds";
}
$("btn-sound").addEventListener("click", () => {
  Sound.toggle();
  paintSoundButton();
  Sound.click(); // audible confirmation when turning sound on
});

function paintMusicButton() {
  const btn = $("btn-music");
  btn.classList.toggle("off", !Music.enabled);
  btn.title = Music.enabled ? "Mute music" : "Unmute music";
}
$("btn-music").addEventListener("click", () => {
  Music.toggle();
  paintMusicButton();
  // turning it back on mid-round should resume immediately
  if (Music.enabled && state && !state.ended) Music.start();
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

applyTheme(THEMES.some((t) => t.id === player.theme && player.bestDailyStreak >= t.streak) ? player.theme : "midnight");
{
  const badgeCount = player.badges.length;
  if (!SOUND_PACKS.some((p) => p.id === player.soundPack && badgeCount >= p.badges)) player.soundPack = "classic";
  const icon = APP_ICONS.find((i) => i.id === player.appIcon && badgeCount >= i.badges) ? player.appIcon : "bolt";
  applyAppIcon(icon);
  if (!MUSIC_TRACKS.find((t) => t.id === player.musicTrack)?.unlock()) player.musicTrack = "breeze";
}
paintSoundButton();
paintMusicButton();
renderHome();

// Prime the audio engine on the first touch anywhere (iOS gesture requirement)
document.addEventListener("pointerdown", () => Sound.unlock(), { once: true });

// Intro splash: plays ~2.3s (tap to skip), then the home screen cascades in
{
  const splash = $("splash");
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    splash.classList.add("out");
    setTimeout(() => splash.remove(), 700);
    document.body.classList.add("intro-done");
  };
  splash.addEventListener("click", finish);
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) finish();
  else setTimeout(finish, 4600);
}

// First visit (or missing profile): orientation + profile setup in one card.
// Tapping your name on the home screen reopens it for edits.
function openProfileSetup() {
  const p = player.profile;
  $("profile-name").value = p?.name || "";
  const current = p?.avatar || AVATARS[0];
  $("avatar-grid").innerHTML = AVATARS.map((a) =>
    `<button class="avatar-chip ${a === current ? "active" : ""}" data-avatar="${a}">${a}</button>`).join("");
  $("welcome-overlay").hidden = false;
}

$("avatar-grid").addEventListener("click", (e) => {
  const chip = e.target.closest(".avatar-chip");
  if (!chip) return;
  document.querySelectorAll(".avatar-chip").forEach((c) => c.classList.remove("active"));
  chip.classList.add("active");
  Sound.click();
});

$("btn-welcome").addEventListener("click", () => {
  player.profile = {
    name: $("profile-name").value.trim().slice(0, 16) || "Player",
    avatar: document.querySelector(".avatar-chip.active")?.dataset.avatar || AVATARS[0],
  };
  localStorage.setItem("quizrush-welcomed", "1");
  $("welcome-overlay").hidden = true;
  paintPlayerBar();
  Sound.start();
});

$("player-name").addEventListener("click", () => { Sound.click(); openProfileSetup(); });

if (!player.profile) openProfileSetup();
