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
};

els.ringProgress.style.strokeDasharray = String(RING_CIRCUMFERENCE);

const state = {
  steps: [],
  stepIndex: 0,
  remainingMs: 0,
  elapsedMs: 0,
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
  updateRing(1);
  els.ringProgress.classList.remove("warning");
  updateStepDots();
  updateElapsedDisplay();
}

function updateElapsedDisplay() {
  els.elapsedTime.textContent = formatTime(state.elapsedMs, true);
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
  state.elapsedMs += delta;
  updateElapsedDisplay();

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

// ---------- Screen navigation ----------

const SCREENS = {
  select: els.screenSelect,
  timer: els.screenTimer,
  done: els.screenDone,
  builder: els.screenBuilder,
};

const SCREEN_FOCUS_TARGET = {
  select: () => els.appTitle,
  timer: () => els.recipeName,
  done: () => els.doneHeading,
  builder: () => els.builderHeading,
};

function showScreen(name) {
  if (name === "select") renderRecipeList();
  Object.entries(SCREENS).forEach(([key, el]) => {
    el.classList.toggle("hidden", key !== name);
  });
  SCREEN_FOCUS_TARGET[name]().focus();
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
els.btnBuilderBack.addEventListener("click", () => showScreen("select"));
els.btnAddStep.addEventListener("click", () => addBuilderStep());
els.btnStartCustom.addEventListener("click", startCustomSequence);

renderRecipeList();
