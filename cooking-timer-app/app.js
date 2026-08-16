// Generic step-sequence timer engine, driven by RECIPES (see recipes.js).

const RING_RADIUS = 90;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

const els = {
  screenSelect: document.getElementById("screen-select"),
  screenTimer: document.getElementById("screen-timer"),
  screenDone: document.getElementById("screen-done"),
  screenBuilder: document.getElementById("screen-builder"),
  appTitle: document.getElementById("app-title"),
  doneHeading: document.getElementById("done-heading"),
  doneSummary: document.getElementById("done-summary"),
  doneElapsedTime: document.getElementById("done-elapsed-time"),
  recipeList: document.getElementById("recipe-list"),
  recipeName: document.getElementById("recipe-name"),
  stepDots: document.getElementById("step-dots"),
  ringProgress: document.getElementById("ring-progress"),
  timeLeft: document.getElementById("time-left"),
  stepCount: document.getElementById("step-count"),
  instruction: document.getElementById("instruction"),
  nextUp: document.getElementById("next-up"),
  elapsedTime: document.getElementById("elapsed-time"),
  btnPause: document.getElementById("btn-pause"),
  btnSkip: document.getElementById("btn-skip"),
  btnReset: document.getElementById("btn-reset"),
  btnBack: document.getElementById("btn-back"),
  btnMute: document.getElementById("btn-mute"),
  btnAgain: document.getElementById("btn-again"),
  builderHeading: document.getElementById("builder-heading"),
  builderName: document.getElementById("builder-name"),
  builderSteps: document.getElementById("builder-steps"),
  builderError: document.getElementById("builder-error"),
  btnAddStep: document.getElementById("btn-add-step"),
  btnStartCustom: document.getElementById("btn-start-custom"),
  btnBuilderBack: document.getElementById("btn-builder-back"),

  screenStopwatch: document.getElementById("screen-stopwatch"),
  stopwatchHeading: document.getElementById("stopwatch-heading"),
  stopwatchTime: document.getElementById("stopwatch-time"),
  btnStopwatchPause: document.getElementById("btn-stopwatch-pause"),
  btnStopwatchReset: document.getElementById("btn-stopwatch-reset"),
  btnStopwatchBack: document.getElementById("btn-stopwatch-back"),
  btnOpenStopwatch: document.getElementById("btn-open-stopwatch"),

  screenTimerSetup: document.getElementById("screen-timer-setup"),
  timerSetupHeading: document.getElementById("timer-setup-heading"),
  timerMinutes: document.getElementById("timer-minutes"),
  timerSeconds: document.getElementById("timer-seconds"),
  timerRepeat: document.getElementById("timer-repeat"),
  timerSetupError: document.getElementById("timer-setup-error"),
  btnStartTimer: document.getElementById("btn-start-timer"),
  btnTimerSetupBack: document.getElementById("btn-timer-setup-back"),
  btnOpenTimerSetup: document.getElementById("btn-open-timer-setup"),

  screenToolTimer: document.getElementById("screen-tool-timer"),
  toolTimerHeading: document.getElementById("tool-timer-heading"),
  toolTimerRingProgress: document.getElementById("tool-timer-ring-progress"),
  toolTimerTimeLeft: document.getElementById("tool-timer-time-left"),
  toolTimerStatus: document.getElementById("tool-timer-status"),
  toolTimerElapsed: document.getElementById("tool-timer-elapsed"),
  toolTimerElapsedTime: document.getElementById("tool-timer-elapsed-time"),
  btnToolTimerPause: document.getElementById("btn-tool-timer-pause"),
  btnToolTimerReset: document.getElementById("btn-tool-timer-reset"),
  btnToolTimerBack: document.getElementById("btn-tool-timer-back"),
  btnTimerMute: document.getElementById("btn-timer-mute"),
};

els.ringProgress.style.strokeDasharray = String(RING_CIRCUMFERENCE);
els.toolTimerRingProgress.style.strokeDasharray = String(RING_CIRCUMFERENCE);

const state = {
  steps: [],
  stepIndex: 0,
  remainingMs: 0,
  elapsedMs: 0,
  running: false,
  started: false,
  intervalId: null,
  lastTick: null,
};

let muted = false;
const muteButtons = [els.btnMute, els.btnTimerMute];

// ---------- Audio ----------

let audioCtx = null;

function beep(freq = 880, duration = 150) {
  if (muted) return;
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
  if (muted || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.rate = 1;
  utter.pitch = 1;
  window.speechSynthesis.speak(utter);
}

// ---------- Recipe selection ----------

const CUSTOM_RECIPES_KEY = "steakTimerCustomRecipes";

function loadCustomRecipes() {
  try {
    const stored = JSON.parse(localStorage.getItem(CUSTOM_RECIPES_KEY));
    return Array.isArray(stored) ? stored : [];
  } catch (e) {
    return [];
  }
}

function saveCustomRecipes(list) {
  localStorage.setItem(CUSTOM_RECIPES_KEY, JSON.stringify(list));
}

function deleteCustomRecipe(id) {
  saveCustomRecipes(loadCustomRecipes().filter((r) => r.id !== id));
  renderRecipeList();
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function pluralize(n, word) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function renderRecipeList() {
  els.recipeList.innerHTML = "";
  Object.values(RECIPES).forEach((recipe) => {
    els.recipeList.appendChild(buildRecipeCard(recipe));
  });
  loadCustomRecipes().forEach((recipe) => {
    els.recipeList.appendChild(buildRecipeCard(recipe, { removable: true }));
  });
  els.recipeList.appendChild(buildAddCard());
}

function buildRecipeCard(recipe, { removable = false } = {}) {
  const card = document.createElement("div");
  card.className = "recipe-card";

  const main = document.createElement("button");
  main.type = "button";
  main.className = "recipe-card-main";
  main.innerHTML = `
    <p class="subtitle">${escapeHtml(recipe.subtitle || "")}</p>
    <h3>${escapeHtml(recipe.name)}</h3>
    <p class="description">${escapeHtml(recipe.description || "")}</p>
  `;
  main.addEventListener("click", () => selectRecipe(recipe));
  card.appendChild(main);

  if (removable) {
    const del = document.createElement("button");
    del.type = "button";
    del.className = "recipe-card-delete";
    del.setAttribute("aria-label", `Delete ${recipe.name}`);
    del.textContent = "×";
    del.addEventListener("click", () => deleteCustomRecipe(recipe.id));
    card.appendChild(del);
  }

  return card;
}

function buildAddCard() {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "recipe-card-add";
  btn.innerHTML = `<span class="add-icon" aria-hidden="true">+</span> Create your own sequence`;
  btn.addEventListener("click", openBuilder);
  return btn;
}

function selectRecipe(recipe) {
  state.steps = recipe.steps;
  state.stepIndex = 0;
  state.remainingMs = recipe.steps[0].duration * 1000;
  state.elapsedMs = 0;
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

function formatTime(ms, roundDown = false) {
  const totalSeconds = Math.max(0, roundDown ? Math.floor(ms / 1000) : Math.ceil(ms / 1000));
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
  updateRing(els.ringProgress, 1);
  els.ringProgress.classList.remove("warning");
  updateStepDots();
  updateElapsedDisplay();
}

function updateElapsedDisplay() {
  els.elapsedTime.textContent = formatTime(state.elapsedMs, true);
}

function updateRing(ringEl, fraction) {
  const offset = RING_CIRCUMFERENCE * (1 - fraction);
  ringEl.style.strokeDashoffset = String(offset);
}

// ---------- Timer engine ----------

function tick() {
  const now = Date.now();
  const delta = now - state.lastTick;
  state.lastTick = now;
  state.remainingMs -= delta;
  state.elapsedMs += delta;
  updateElapsedDisplay();

  if (state.remainingMs <= 0) {
    advanceStep();
    return;
  }

  const step = state.steps[state.stepIndex];
  const fraction = state.remainingMs / (step.duration * 1000);
  els.timeLeft.textContent = formatTime(state.remainingMs);
  updateRing(els.ringProgress, fraction);
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
  state.elapsedMs = 0;
  state.running = false;
  state.started = false;
  els.btnPause.textContent = "Start";
  renderStep();
}

function finish() {
  clearInterval(state.intervalId);
  state.running = false;
  els.doneSummary.textContent = `${pluralize(state.steps.length, "step")} complete. Rest before slicing.`;
  els.doneElapsedTime.textContent = formatTime(state.elapsedMs, true);
  beep(1200, 300);
  speak("Searing complete. Rest the steak before slicing.");
  showScreen("done");
}

// ---------- Custom sequence builder ----------

function openBuilder() {
  els.builderName.value = "";
  els.builderSteps.innerHTML = "";
  els.builderError.classList.add("hidden");
  addBuilderStep();
  addBuilderStep();
  showScreen("builder");
}

function addBuilderStep() {
  const n = els.builderSteps.children.length + 1;
  const row = document.createElement("div");
  row.className = "step-row";
  row.innerHTML = `
    <input type="text" class="step-label-input" value="${escapeHtml(`Sear side ${n}`)}" aria-label="Step ${n} label" maxlength="40">
    <input type="number" class="step-duration-input" value="30" min="1" max="3600" aria-label="Step ${n} duration in seconds">
    <span class="step-duration-unit" aria-hidden="true">sec</span>
    <button type="button" class="step-remove-btn" aria-label="Remove step ${n}">×</button>
  `;
  row.querySelector(".step-remove-btn").addEventListener("click", () => {
    if (els.builderSteps.children.length <= 1) return;
    row.remove();
    updateBuilderStepA11y();
  });
  els.builderSteps.appendChild(row);
  updateBuilderStepA11y();
}

function updateBuilderStepA11y() {
  const rows = [...els.builderSteps.children];
  rows.forEach((row, i) => {
    const n = i + 1;
    row.querySelector(".step-label-input").setAttribute("aria-label", `Step ${n} label`);
    row.querySelector(".step-duration-input").setAttribute("aria-label", `Step ${n} duration in seconds`);
    const removeBtn = row.querySelector(".step-remove-btn");
    removeBtn.setAttribute("aria-label", `Remove step ${n}`);
    removeBtn.disabled = rows.length <= 1;
  });
}

function collectBuilderSteps() {
  return [...els.builderSteps.children].map((row) => {
    const label = row.querySelector(".step-label-input").value.trim();
    const rawDuration = parseInt(row.querySelector(".step-duration-input").value, 10);
    const duration = Number.isFinite(rawDuration) ? Math.min(3600, Math.max(1, rawDuration)) : NaN;
    return { label, duration };
  });
}

function startCustomSequence() {
  const steps = collectBuilderSteps();
  const invalidIndex = steps.findIndex((s) => !s.label || !Number.isFinite(s.duration));

  if (invalidIndex !== -1) {
    els.builderError.textContent = steps[invalidIndex].label
      ? `Step ${invalidIndex + 1} needs a duration.`
      : `Step ${invalidIndex + 1} needs a label.`;
    els.builderError.classList.remove("hidden");
    return;
  }
  els.builderError.classList.add("hidden");

  const recipe = {
    id: `custom-${Date.now()}`,
    name: els.builderName.value.trim() || "Custom Sequence",
    subtitle: `${pluralize(steps.length, "step")} · custom`,
    description: steps.map((s) => s.label).join(" → "),
    steps,
  };

  const customRecipes = loadCustomRecipes();
  customRecipes.push(recipe);
  saveCustomRecipes(customRecipes);

  selectRecipe(recipe);
}

// ---------- Stopwatch ----------

const swState = {
  elapsedMs: 0,
  running: false,
  intervalId: null,
  lastTick: null,
};

function formatStopwatch(ms) {
  const total = Math.max(0, ms);
  const totalSeconds = Math.floor(total / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  const tenths = Math.floor((total % 1000) / 100);
  return `${m}:${String(s).padStart(2, "0")}.${tenths}`;
}

function openStopwatch() {
  clearInterval(swState.intervalId);
  swState.elapsedMs = 0;
  swState.running = false;
  els.stopwatchTime.textContent = formatStopwatch(0);
  els.btnStopwatchPause.textContent = "Start";
  showScreen("stopwatch");
}

function stopwatchTick() {
  const now = Date.now();
  swState.elapsedMs += now - swState.lastTick;
  swState.lastTick = now;
  els.stopwatchTime.textContent = formatStopwatch(swState.elapsedMs);
}

function toggleStopwatch() {
  if (swState.running) {
    swState.running = false;
    clearInterval(swState.intervalId);
    els.btnStopwatchPause.textContent = "Resume";
  } else {
    swState.running = true;
    swState.lastTick = Date.now();
    swState.intervalId = setInterval(stopwatchTick, 100);
    els.btnStopwatchPause.textContent = "Pause";
  }
}

function resetStopwatch() {
  clearInterval(swState.intervalId);
  swState.elapsedMs = 0;
  swState.running = false;
  els.stopwatchTime.textContent = formatStopwatch(0);
  els.btnStopwatchPause.textContent = "Start";
}

// ---------- Custom timer ----------

const ctState = {
  durationMs: 0,
  remainingMs: 0,
  elapsedMs: 0,
  repeat: false,
  running: false,
  started: false,
  finished: false,
  intervalId: null,
  lastTick: null,
};

function openTimerSetup() {
  clearInterval(ctState.intervalId);
  els.timerSetupError.classList.add("hidden");
  showScreen("timer-setup");
}

function startCustomTimer() {
  const minutes = parseInt(els.timerMinutes.value, 10) || 0;
  const seconds = parseInt(els.timerSeconds.value, 10) || 0;
  const totalSeconds = minutes * 60 + seconds;

  if (totalSeconds < 1) {
    els.timerSetupError.textContent = "Set a duration of at least 1 second.";
    els.timerSetupError.classList.remove("hidden");
    return;
  }
  els.timerSetupError.classList.add("hidden");

  ctState.durationMs = totalSeconds * 1000;
  ctState.remainingMs = ctState.durationMs;
  ctState.elapsedMs = 0;
  ctState.repeat = els.timerRepeat.checked;
  ctState.running = false;
  ctState.started = false;
  ctState.finished = false;

  els.toolTimerElapsed.classList.toggle("hidden", !ctState.repeat);
  renderCustomTimer();
  els.btnToolTimerPause.textContent = "Start";
  showScreen("tool-timer");
}

function renderCustomTimer() {
  els.toolTimerTimeLeft.textContent = formatTime(ctState.remainingMs);
  updateRing(els.toolTimerRingProgress, 1);
  els.toolTimerRingProgress.classList.remove("warning");
  els.toolTimerStatus.textContent = "";
  if (ctState.repeat) {
    els.toolTimerElapsedTime.textContent = formatTime(ctState.elapsedMs, true);
  }
}

function customTimerTick() {
  const now = Date.now();
  const delta = now - ctState.lastTick;
  ctState.lastTick = now;
  ctState.remainingMs -= delta;
  if (ctState.repeat) {
    ctState.elapsedMs += delta;
    els.toolTimerElapsedTime.textContent = formatTime(ctState.elapsedMs, true);
  }

  if (ctState.remainingMs <= 0) {
    beep(1200, 300);
    speak("Time's up");

    if (ctState.repeat) {
      ctState.remainingMs += ctState.durationMs;
      if (ctState.remainingMs <= 0) ctState.remainingMs = ctState.durationMs;
      els.toolTimerTimeLeft.textContent = formatTime(ctState.remainingMs);
      updateRing(els.toolTimerRingProgress, ctState.remainingMs / ctState.durationMs);
      return;
    }

    clearInterval(ctState.intervalId);
    ctState.running = false;
    ctState.finished = true;
    els.toolTimerTimeLeft.textContent = "0:00";
    updateRing(els.toolTimerRingProgress, 0);
    els.toolTimerStatus.textContent = "Time's up!";
    els.btnToolTimerPause.textContent = "Start";
    return;
  }

  els.toolTimerTimeLeft.textContent = formatTime(ctState.remainingMs);
  updateRing(els.toolTimerRingProgress, ctState.remainingMs / ctState.durationMs);
  els.toolTimerRingProgress.classList.toggle("warning", ctState.remainingMs <= 5000);
}

function startCustomTimerInterval() {
  clearInterval(ctState.intervalId);
  ctState.lastTick = Date.now();
  ctState.intervalId = setInterval(customTimerTick, 100);
}

function toggleCustomTimer() {
  if (ctState.finished) {
    resetCustomTimer();
  }

  if (!ctState.started) {
    ctState.started = true;
    ctState.running = true;
    startCustomTimerInterval();
    els.btnToolTimerPause.textContent = "Pause";
    return;
  }

  if (ctState.running) {
    ctState.running = false;
    clearInterval(ctState.intervalId);
    els.btnToolTimerPause.textContent = "Resume";
  } else {
    ctState.running = true;
    startCustomTimerInterval();
    els.btnToolTimerPause.textContent = "Pause";
  }
}

function resetCustomTimer() {
  clearInterval(ctState.intervalId);
  window.speechSynthesis && window.speechSynthesis.cancel();
  ctState.remainingMs = ctState.durationMs;
  ctState.elapsedMs = 0;
  ctState.running = false;
  ctState.started = false;
  ctState.finished = false;
  renderCustomTimer();
  els.btnToolTimerPause.textContent = "Start";
}

// ---------- Screen navigation ----------

const SCREENS = {
  select: els.screenSelect,
  timer: els.screenTimer,
  done: els.screenDone,
  builder: els.screenBuilder,
  stopwatch: els.screenStopwatch,
  "timer-setup": els.screenTimerSetup,
  "tool-timer": els.screenToolTimer,
};

const SCREEN_FOCUS_TARGET = {
  select: () => els.appTitle,
  timer: () => els.recipeName,
  done: () => els.doneHeading,
  builder: () => els.builderHeading,
  stopwatch: () => els.stopwatchHeading,
  "timer-setup": () => els.timerSetupHeading,
  "tool-timer": () => els.toolTimerHeading,
};

function showScreen(name) {
  clearInterval(state.intervalId);
  clearInterval(swState.intervalId);
  clearInterval(ctState.intervalId);
  if (name === "select") renderRecipeList();
  Object.entries(SCREENS).forEach(([key, el]) => {
    el.classList.toggle("hidden", key !== name);
  });
  SCREEN_FOCUS_TARGET[name]().focus();
}

function goBack() {
  window.speechSynthesis && window.speechSynthesis.cancel();
  showScreen("select");
}

function toggleMute() {
  muted = !muted;
  muteButtons.forEach((btn) => {
    btn.textContent = muted ? "🔇" : "🔊";
    btn.classList.toggle("muted", muted);
  });
  if (muted) window.speechSynthesis && window.speechSynthesis.cancel();
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
els.btnBuilderBack.addEventListener("click", () => showScreen("select"));
els.btnAddStep.addEventListener("click", () => addBuilderStep());
els.btnStartCustom.addEventListener("click", startCustomSequence);

els.btnOpenStopwatch.addEventListener("click", openStopwatch);
els.btnStopwatchPause.addEventListener("click", toggleStopwatch);
els.btnStopwatchReset.addEventListener("click", resetStopwatch);
els.btnStopwatchBack.addEventListener("click", () => showScreen("select"));

els.btnOpenTimerSetup.addEventListener("click", openTimerSetup);
els.btnTimerSetupBack.addEventListener("click", () => showScreen("select"));
els.btnStartTimer.addEventListener("click", startCustomTimer);
els.btnToolTimerPause.addEventListener("click", toggleCustomTimer);
els.btnToolTimerReset.addEventListener("click", resetCustomTimer);
els.btnToolTimerBack.addEventListener("click", () => showScreen("select"));
els.btnTimerMute.addEventListener("click", toggleMute);

renderRecipeList();
