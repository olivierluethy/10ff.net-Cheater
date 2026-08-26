"use strict";

// 10ff.net Cheater — content script (typing engine).
//
// Runs on https://10ff.net/*. It reads settings from chrome.storage.local,
// auto-types the highlighted word on each tick, and publishes telemetry
// (race state, live delay, finished sessions) back to storage so the popup
// can render the current state even after being closed and reopened.

const FALLBACK_SETTINGS = {
  speedMode: "human",
  intervalMs: 250,
  randomize: true,
  randomJitter: 150,
  accuracy: 100,
  minIntervalMs: 30,
  maxIntervalMs: 2000,
};

const MAX_SESSIONS = 20;
const SPEED_REPORT_THROTTLE_MS = 200;

let settings = { ...FALLBACK_SETTINGS };
let running = false;
let timerId = null;
let waitId = null;
let session = null;
let lastSpeedWrite = 0;

// --- settings sync -------------------------------------------------------

chrome.storage.local.get("settings", (data) => {
  if (data.settings) settings = { ...FALLBACK_SETTINGS, ...data.settings };
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (changes.settings) {
    // Applies live — a delay/accuracy change mid-race takes effect next tick.
    settings = { ...FALLBACK_SETTINGS, ...changes.settings.newValue };
  }
});

// A fresh page load means no race is running.
setRaceState("idle");

// --- messaging from the popup -------------------------------------------

chrome.runtime.onMessage.addListener((request) => {
  if (request && request.action === "startHack") start();
  if (request && request.action === "stopHack") stop();
});

// --- engine --------------------------------------------------------------

function start() {
  if (running) return; // guard: ignore repeat starts

  running = true;
  setRaceState("running");

  if (document.querySelector(".overlayer.active")) {
    // Countdown is on screen; begin the moment it clears.
    toast("Countdown running — auto-typing when the race starts", "wait");
    waitForRace();
  } else {
    beginTyping();
  }
}

function waitForRace() {
  waitId = setInterval(() => {
    if (!running) {
      clearInterval(waitId);
      return;
    }
    if (!document.querySelector(".overlayer.active")) {
      clearInterval(waitId);
      beginTyping();
    }
  }, 100);
}

function beginTyping() {
  session = { start: Date.now(), words: 0, correct: 0, typos: 0 };
  toast("Auto-typing started", "go");
  tick();
}

function tick() {
  if (!running) return;

  // Race over for this player?
  if (document.querySelector(".map .player-end.player-me")) {
    finish();
    return;
  }

  const highlight = document.querySelector(".highlight");
  const input = document.querySelector(".interface input");

  if (highlight && input && highlight.textContent) {
    const word = highlight.textContent;
    const makeTypo =
      settings.accuracy < 100 && Math.random() * 100 >= settings.accuracy;
    const typed = makeTypo ? corrupt(word) : word;

    input.focus();
    input.value = typed + " ";
    input.dispatchEvent(new Event("input", { bubbles: true }));

    session.words += 1;
    if (makeTypo) session.typos += 1;
    else session.correct += 1;
  }

  const interval = computeInterval(settings);
  reportSpeed(interval);
  timerId = setTimeout(tick, interval);
}

function finish() {
  running = false;
  clearTimeout(timerId);
  const record = summarize(session, settings);
  saveSession(record);
  clearLiveSpeed();
  setRaceState("finished");
  toast(`Race finished — ${record.wpm} WPM · ${record.accuracy}% accuracy`, "done");
  session = null;
}

function stop() {
  running = false;
  clearTimeout(timerId);
  clearInterval(waitId);
  session = null;
  clearLiveSpeed();
  setRaceState("idle");
}

// --- pure helpers --------------------------------------------------------

// Base delay, optionally jittered, then clamped to the configured bounds.
function computeInterval(s) {
  let base = Number(s.intervalMs) || FALLBACK_SETTINGS.intervalMs;
  if (s.randomize) {
    const jitter = Number(s.randomJitter) || 0;
    base += (Math.random() * 2 - 1) * jitter;
  }
  const min = Number(s.minIntervalMs) || FALLBACK_SETTINGS.minIntervalMs;
  const max = Number(s.maxIntervalMs) || FALLBACK_SETTINGS.maxIntervalMs;
  return Math.max(min, Math.min(max, Math.round(base)));
}

// Introduce a plausible typo (adjacent swap or dropped char) so a word is
// scored wrong. Used to hit a configured accuracy below 100%.
function corrupt(word) {
  if (word.length < 2) return word + "x";
  const chars = word.split("");
  const i = Math.floor(Math.random() * chars.length);
  if (Math.random() < 0.5 && i < chars.length - 1) {
    const t = chars[i];
    chars[i] = chars[i + 1];
    chars[i + 1] = t;
  } else {
    chars.splice(i, 1);
  }
  const result = chars.join("");
  return result === word ? word.slice(0, -1) : result;
}

function summarize(s, cfg) {
  const elapsedMs = Date.now() - s.start;
  const minutes = elapsedMs / 60000;
  const wpm = minutes > 0 ? Math.round(s.words / minutes) : 0;
  const accuracy = s.words ? Math.round((s.correct / s.words) * 100) : 100;
  return {
    ts: Date.now(),
    wpm,
    accuracy,
    words: s.words,
    durationMs: elapsedMs,
    mode: cfg.speedMode,
    intervalMs: cfg.intervalMs,
    randomize: cfg.randomize,
  };
}

// --- storage writes ------------------------------------------------------

function setRaceState(state) {
  chrome.storage.local.set({ raceState: state });
}

function reportSpeed(ms) {
  const now = Date.now();
  if (now - lastSpeedWrite < SPEED_REPORT_THROTTLE_MS) return;
  lastSpeedWrite = now;
  chrome.storage.local.set({ liveSpeed: ms });
}

function clearLiveSpeed() {
  lastSpeedWrite = 0;
  chrome.storage.local.set({ liveSpeed: null });
}

function saveSession(record) {
  chrome.storage.local.get("sessions", (data) => {
    const sessions = Array.isArray(data.sessions) ? data.sessions : [];
    sessions.push(record);
    while (sessions.length > MAX_SESSIONS) sessions.shift();
    chrome.storage.local.set({ sessions });
  });
}

// --- on-page toast (feedback even when the popup is closed) ---------------

let toastEl = null;

function toast(message, kind) {
  ensureToastStyles();
  if (!toastEl) {
    toastEl = document.createElement("div");
    toastEl.className = "cheater-toast";
    document.body.appendChild(toastEl);
  }
  toastEl.textContent = message;
  toastEl.dataset.kind = kind || "info";
  // Force reflow so re-showing an existing toast restarts the transition.
  void toastEl.offsetWidth;
  toastEl.classList.add("cheater-toast--show");
  clearTimeout(toastEl._hideTimer);
  toastEl._hideTimer = setTimeout(() => {
    toastEl.classList.remove("cheater-toast--show");
  }, 2600);
}

function ensureToastStyles() {
  if (document.getElementById("cheater-toast-styles")) return;
  const style = document.createElement("style");
  style.id = "cheater-toast-styles";
  style.textContent = `
    .cheater-toast {
      position: fixed;
      left: 50%;
      bottom: 24px;
      transform: translate(-50%, 16px);
      z-index: 2147483647;
      max-width: 340px;
      padding: 11px 16px;
      border-radius: 10px;
      font: 600 13px/1.4 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
      color: #eaeef8;
      background: #111a2e;
      border: 1px solid #26314f;
      border-left: 3px solid #3d7bff;
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.22s ease, transform 0.22s ease;
    }
    .cheater-toast--show { opacity: 1; transform: translate(-50%, 0); }
    .cheater-toast[data-kind="wait"] { border-left-color: #ffab3d; }
    .cheater-toast[data-kind="go"]   { border-left-color: #3d7bff; }
    .cheater-toast[data-kind="done"] { border-left-color: #2fd6a6; }
    @media (prefers-reduced-motion: reduce) {
      .cheater-toast { transition: opacity 0.22s ease; transform: translate(-50%, 0); }
    }
  `;
  (document.head || document.documentElement).appendChild(style);
}
