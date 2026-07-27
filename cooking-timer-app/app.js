// Generic step-sequence timer engine, driven by RECIPES (see recipes.js).

const RING_RADIUS = 90;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

const els = {
  screenSelect: document.getElementById("screen-select"),
  screenTimer: document.getElementById("screen-timer"),
  screenDone: document.getElementById("screen-done"),
  recipeList: document.getElementById("recipe-list"),
  recipeName: document.getElementById("recipe-name"),
  stepDots: document.getElementById("step-dots"),
  ringProgress: document.getElementById("ring-progress"),
  timeLeft: document.getElementById("time-left"),
  stepCount: document.getElementById("step-count"),
  instruction: document.getElementById("instruction"),
  nextUp: document.getElementById("next-up"),
  btnPause: document.getElementById("btn-pause"),
  btnSkip: document.getElementById("btn-skip"),
  btnReset: document.getElementById("btn-reset"),
  btnBack: document.getElementById("btn-back"),
  btnMute: document.getElementById("btn-mute"),
  btnAgain: document.getElementById("btn-again"),
};

els.ringProgress.style.strokeDasharray = String(RING_CIRCUMFERENCE);

const state = {
  recipeKey: null,
  steps: [],
  stepIndex: 0,
  remainingMs: 0,
  running: false,
  started: false,
  intervalId: null,
  lastTick: null,
  muted: false,
};

// ---------- Audio ----------

let audioCtx = null;

function beep(freq = 880, duration = 150) {
  if (state.muted) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration / 1000);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration / 1000);
  } catch (e) {
    /* Web Audio unavailable, ignore */
  }
}

function speak(text) {
  if (state.muted || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.rate = 1;
  utter.pitch = 1;
  window.speechSynthesis.speak(utter);
}

// ---------- Recipe selection ----------

function renderRecipeList() {
  els.recipeList.innerHTML = "";
  Object.entries(RECIPES).forEach(([key, recipe]) => {
    const card = document.createElement("button");
    card.className = "recipe-card";
    card.innerHTML = `
      <p class="subtitle">${recipe.subtitle}</p>
      <h3>${recipe.name}</h3>
      <p class="description">${recipe.description}</p>
    `;
    card.addEventListener("click", () => selectRecipe(key));
    els.recipeList.appendChild(card);
  });
}

function selectRecipe(key) {
  const recipe = RECIPES[key];
  state.recipeKey = key;
  state.steps = recipe.steps;
  state.stepIndex = 0;
  state.remainingMs = recipe.steps[0].duration * 1000;
  state.running = false;
  state.started = false;
  clearInterval(state.intervalId);

  els.recipeName.textContent = recipe.name;
  buildStepDots();
  renderStep();

  els.btnPause.textContent = "Start";
  showScreen("timer");
}

// ---------- Step rendering ----------

function buildStepDots() {
  els.stepDots.innerHTML = "";
  state.steps.forEach(() => {
    const dot = document.createElement("span");
    dot.className = "dot";
    els.stepDots.appendChild(dot);
  });
  updateStepDots();
}

function updateStepDots() {
  [...els.stepDots.children].forEach((dot, i) => {
    dot.classList.toggle("done", i < state.stepIndex);
    dot.classList.toggle("active", i === state.stepIndex);
  });
}

function formatTime(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function renderStep() {
  const step = state.steps[state.stepIndex];
  const next = state.steps[state.stepIndex + 1];

  els.instruction.textContent = step.label;
  els.nextUp.textContent = next ? `Next: ${next.label}` : "Final side — then rest the steak";
  els.stepCount.textContent = `Step ${state.stepIndex + 1} of ${state.steps.length}`;
  els.timeLeft.textContent = formatTime(state.remainingMs);
  updateRing(1);
  els.ringProgress.classList.remove("warning");
  updateStepDots();
}

function updateRing(fraction) {
  const offset = RING_CIRCUMFERENCE * (1 - fraction);
  els.ringProgress.style.strokeDashoffset = String(offset);
}

// ---------- Timer engine ----------

function tick() {
  const now = Date.now();
  const delta = now - state.lastTick;
  state.lastTick = now;
  state.remainingMs -= delta;

  if (state.remainingMs <= 0) {
    advanceStep();
    return;
  }

  const step = state.steps[state.stepIndex];
  const fraction = state.remainingMs / (step.duration * 1000);
  els.timeLeft.textContent = formatTime(state.remainingMs);
  updateRing(fraction);
  els.ringProgress.classList.toggle("warning", state.remainingMs <= 5000);
}

function advanceStep() {
  state.stepIndex += 1;

  if (state.stepIndex >= state.steps.length) {
    finish();
    return;
  }

  const step = state.steps[state.stepIndex];
  state.remainingMs = step.duration * 1000;
  beep();
  speak(step.label);
  renderStep();
}

function announceCurrentStep() {
  const step = state.steps[state.stepIndex];
  beep();
  speak(step.label);
}

function startInterval() {
  clearInterval(state.intervalId);
  state.lastTick = Date.now();
  state.intervalId = setInterval(tick, 100);
}

function togglePause() {
  if (!state.started) {
    state.started = true;
    state.running = true;
    announceCurrentStep();
    startInterval();
    els.btnPause.textContent = "Pause";
    return;
  }

  if (state.running) {
    state.running = false;
    clearInterval(state.intervalId);
    els.btnPause.textContent = "Resume";
  } else {
    state.running = true;
    startInterval();
    els.btnPause.textContent = "Pause";
  }
}

function skipStep() {
  if (!state.started) {
    // Skipping before starting just moves the preview forward.
    if (state.stepIndex < state.steps.length - 1) {
      state.stepIndex += 1;
      state.remainingMs = state.steps[state.stepIndex].duration * 1000;
      renderStep();
    }
    return;
  }
  advanceStep();
}

function resetTimer() {
  clearInterval(state.intervalId);
  window.speechSynthesis && window.speechSynthesis.cancel();
  state.stepIndex = 0;
  state.remainingMs = state.steps[0].duration * 1000;
  state.running = false;
  state.started = false;
  els.btnPause.textContent = "Start";
  renderStep();
}

function finish() {
  clearInterval(state.intervalId);
  state.running = false;
  beep(1200, 300);
  speak("Searing complete. Rest the steak before slicing.");
  showScreen("done");
}

// ---------- Screen navigation ----------

function showScreen(name) {
  els.screenSelect.classList.toggle("hidden", name !== "select");
  els.screenTimer.classList.toggle("hidden", name !== "timer");
  els.screenDone.classList.toggle("hidden", name !== "done");
}

function goBack() {
  clearInterval(state.intervalId);
  window.speechSynthesis && window.speechSynthesis.cancel();
  showScreen("select");
}

function toggleMute() {
  state.muted = !state.muted;
  els.btnMute.textContent = state.muted ? "🔇" : "🔊";
  els.btnMute.classList.toggle("muted", state.muted);
  if (state.muted) window.speechSynthesis && window.speechSynthesis.cancel();
}

// ---------- Wire up ----------

els.btnPause.addEventListener("click", togglePause);
els.btnSkip.addEventListener("click", skipStep);
els.btnReset.addEventListener("click", resetTimer);
els.btnBack.addEventListener("click", goBack);
els.btnMute.addEventListener("click", toggleMute);
els.btnAgain.addEventListener("click", () => {
  showScreen("select");
});

renderRecipeList();
