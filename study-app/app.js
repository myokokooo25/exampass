const SUBJECT_BY_CATEGORY = {
  "1": "鉄骨構造",
  "2": "鉄骨加工",
  "3": "品質管理",
  "4": "安全衛生",
  "5": "建築法規",
};

const STUDY_ORDER = ["2", "3", "1", "4", "5"];
const EXAM_WEIGHTS = { "1": 9, "2": 20, "3": 15, "4": 3, "5": 3 };
const PRIORITY_LABEL = { "2": "①", "3": "②", "1": "③", "4": "④", "5": "⑤" };

const els = {
  status: document.getElementById("status"),

  modePlan: document.getElementById("modePlan"),
  modeSearch: document.getElementById("modeSearch"),
  modeQuiz: document.getElementById("modeQuiz"),
  modeVocab: document.getElementById("modeVocab"),

  viewPlan: document.getElementById("viewPlan"),
  viewSearch: document.getElementById("viewSearch"),
  viewQuiz: document.getElementById("viewQuiz"),
  viewVocab: document.getElementById("viewVocab"),

  category: document.getElementById("category"),
  query: document.getElementById("query"),
  btnSearch: document.getElementById("btnSearch"),
  btnReset: document.getElementById("btnReset"),
  btnClearProgress: document.getElementById("btnClearProgress"),

  plan: document.getElementById("plan"),
  results: document.getElementById("results"),
  vocab: document.getElementById("vocab"),

  btnPrev: document.getElementById("btnPrev"),
  btnNext: document.getElementById("btnNext"),
  btnShuffle: document.getElementById("btnShuffle"),
  quizCard: document.getElementById("quizCard"),
};

const STORAGE_KEY = "tekko_exam_progress_v2";

let QUESTIONS = [];
let FLASHCARDS = [];
let quizList = [];
let quizIndex = 0;
let quizReveal = false;

function defaultState() {
  return {
    done: {},
    vocab: {},
    errors: {},
    daily: {},
    examDate: "",
    planStart: new Date().toISOString().slice(0, 10),
  };
}

function loadState() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return { ...defaultState(), ...raw, done: raw.done || {}, vocab: raw.vocab || {}, errors: raw.errors || {}, daily: raw.daily || {} };
  } catch {
    return defaultState();
  }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function isQuestionDone(id) {
  return Boolean(loadState().done[`q:${id}`]);
}

function isVocabDone(id) {
  return Boolean(loadState().vocab[`v:${id}`]);
}

function setMode(mode) {
  for (const [btn, view] of [
    [els.modePlan, els.viewPlan],
    [els.modeQuiz, els.viewQuiz],
    [els.modeVocab, els.viewVocab],
    [els.modeSearch, els.viewSearch],
  ]) {
    const is = btn.id === mode;
    btn.classList.toggle("is-active", is);
    view.classList.toggle("is-active", is);
  }
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderRichText(s) {
  if (!s) return "";
  return String(s)
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<(?!ruby|\/ruby|rt|\/rt)\/?[^>]+>/gi, "");
}

function normalizeText(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

async function loadJson(path) {
  const r = await fetch(path, { cache: "no-store" });
  if (!r.ok) throw new Error(`${path} HTTP ${r.status}`);
  return await r.json();
}

function subjectLabel(category) {
  return SUBJECT_BY_CATEGORY[String(category)] || `カテゴリ${category || "?"}`;
}

function questionMatches(q, category, query) {
  if (category !== "all" && String(q.category) !== String(category)) return false;
  if (!query) return true;
  const hay = normalizeText(
    [q.id, q.category, q.question_jp, q.question_my, JSON.stringify(q.options || []), JSON.stringify(q.explanation || {})].join(" ")
  );
  return hay.includes(query);
}

function getCategoryStats() {
  const state = loadState();
  const result = {};
  for (const cat of ["1", "2", "3", "4", "5"]) {
    const qs = QUESTIONS.filter((q) => String(q.category) === String(cat));
    const done = qs.filter((q) => state.done[`q:${q.id}`]).length;
    result[cat] = { total: qs.length, done, weight: EXAM_WEIGHTS[cat] || 0 };
  }
  return result;
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function daysBetween(a, b) {
  const ms = new Date(b) - new Date(a);
  return Math.max(0, Math.ceil(ms / 86400000));
}

function getTodayFocus() {
  const stats = getCategoryStats();
  for (const cat of STUDY_ORDER) {
    const s = stats[cat];
    if (!s || s.total === 0) continue;
    if (s.done < s.total) return cat;
  }
  return STUDY_ORDER[0];
}

function getDueReviews() {
  const state = loadState();
  const today = todayKey();
  return Object.entries(state.errors)
    .map(([id, err]) => ({ id, ...err, q: QUESTIONS.find((x) => x.id === id) }))
    .filter((e) => e.q && daysBetween(e.lastReview || e.date, today) >= 2)
    .slice(0, 10);
}

function getDailyTasks() {
  const state = loadState();
  const d = state.daily[todayKey()] || { vocab: false, quiz: false, review: false };
  return d;
}

function toggleDailyTask(task) {
  const state = loadState();
  const key = todayKey();
  state.daily[key] = { ...getDailyTasks(), [task]: !getDailyTasks()[task] };
  saveState(state);
  renderPlan();
}

function getDaysUntilExam() {
  const state = loadState();
  if (!state.examDate) return null;
  return daysBetween(todayKey(), state.examDate);
}

function renderQuestion(q, { showAnswer = true, quizMode = false } = {}) {
  const state = loadState();
  const done = Boolean(state.done[`q:${q.id}`]);
  const hasError = Boolean(state.errors[q.id]);
  const correct = q.correct_option_id;
  const options = Array.isArray(q.options) ? q.options : [];

  const optsHtml = options
    .map((opt) => {
      const isCorrect = showAnswer && correct != null && opt.id === correct;
      const jp = opt.textJP ? renderRichText(opt.textJP) : "";
      const my = opt.textMY ? escapeHtml(opt.textMY) : "";
      return `
        <div class="opt ${isCorrect ? "is-correct" : ""}">
          <div><strong>(${escapeHtml(opt.id)})</strong> ${jp}</div>
          ${my ? `<div class="opt__sub">${my}</div>` : ""}
        </div>
      `;
    })
    .join("");

  const exp = q.explanation && typeof q.explanation === "object" ? q.explanation : null;
  const expHtml = exp && showAnswer
    ? `
      <div class="toggle"><div class="badge"><strong>Explanation</strong></div></div>
      <div class="opt">
        ${exp.titleMY ? `<div><strong>${escapeHtml(exp.titleMY)}</strong></div>` : ""}
        ${exp.reasonMY ? `<div style="margin-top:8px;line-height:1.6">${escapeHtml(exp.reasonMY)}</div>` : ""}
        ${exp.memoryTipMY ? `<div style="margin-top:8px;color:var(--muted)">${escapeHtml(exp.memoryTipMY)}</div>` : ""}
      </div>
    `
    : "";

  const qjp = q.question_jp ? renderRichText(q.question_jp) : "";
  const qmy = q.question_my ? escapeHtml(q.question_my) : "";

  return `
    <div class="item">
      <div class="item__top">
        <div class="badge">${escapeHtml(subjectLabel(q.category))}</div>
        <div class="item__id">${escapeHtml(q.id)} ${done ? "• done" : ""} ${hasError ? "• error" : ""}</div>
      </div>
      <div class="item__q">
        ${qjp ? `<div><strong>JP:</strong> ${qjp}</div>` : ""}
        ${qmy ? `<div style="margin-top:6px"><strong>MY:</strong> ${qmy}</div>` : ""}
      </div>
      ${options.length ? `<div class="item__opts">${optsHtml}</div>` : ""}
      <div class="row" style="margin-top:10px;flex-wrap:wrap">
        <button class="btn btn--ghost" type="button" data-action="toggleDone" data-id="${escapeHtml(q.id)}">
          ${done ? "Mark not done" : "Mark done"}
        </button>
        ${quizMode ? `
          <button class="btn btn--danger" type="button" data-action="logError" data-id="${escapeHtml(q.id)}">
            မှားတယ် / Wrong
          </button>
          <button class="btn" type="button" data-action="revealAnswer" data-id="${escapeHtml(q.id)}">
            အဖြေပြပါ
          </button>
        ` : ""}
      </div>
      ${expHtml}
    </div>
  `;
}

function renderFlashcard(r) {
  const done = isVocabDone(r.id);
  return `
    <div class="item">
      <div class="item__top">
        <div class="badge">${escapeHtml(subjectLabel(r.category))}</div>
        <div class="item__id">#${escapeHtml(r.id)} ${done ? "• learned" : ""}</div>
      </div>
      <div class="item__q">
        <div><strong>${escapeHtml(r.kanji || "")}</strong> ${r.reading ? `(${escapeHtml(r.reading)})` : ""}</div>
        ${r.english ? `<div style="margin-top:6px"><strong>EN:</strong> ${escapeHtml(r.english)}</div>` : ""}
        ${r.burmese ? `<div style="margin-top:6px"><strong>MY:</strong> ${escapeHtml(r.burmese)}</div>` : ""}
      </div>
      <div class="row" style="margin-top:10px">
        <button class="btn btn--ghost" type="button" data-action="toggleVocab" data-id="${escapeHtml(r.id)}">
          ${done ? "Unlearn" : "Learned"}
        </button>
      </div>
    </div>
  `;
}

function renderPlan() {
  const state = loadState();
  const stats = getCategoryStats();
  const focus = getTodayFocus();
  const due = getDueReviews();
  const daily = getDailyTasks();
  const daysLeft = getDaysUntilExam();
  const totalDone = Object.keys(state.done).length;
  const totalErrors = Object.keys(state.errors).length;

  const categoryCards = STUDY_ORDER.map((cat) => {
    const s = stats[cat] || { total: 0, done: 0, weight: 0 };
    const pct = s.total ? Math.round((s.done / s.total) * 100) : 0;
    return `
      <div class="planCard">
        <div class="planCard__top">
          <span class="planCard__prio">${PRIORITY_LABEL[cat]}</span>
          <strong>${escapeHtml(subjectLabel(cat))}</strong>
          <span class="badge">စာမေးပွဲ ${s.weight} Q</span>
        </div>
        <div class="progressBar"><div class="progressBar__fill" style="width:${pct}%"></div></div>
        <div class="planCard__meta">${s.done} / ${s.total} လုပ်ပြီး (${pct}%)</div>
        <button class="btn btn--ghost" type="button" data-action="startCategory" data-cat="${cat}">ဒီ category စလေ့လာမယ်</button>
      </div>
    `;
  }).join("");

  const dailyChecks = [
    { key: "vocab", label: "Vocab 10–20 လုံး (10 min)", my: "မနေ့က စကားလုံးတွေ ပြန်ကျက်" },
    { key: "quiz", label: `Quiz — ${subjectLabel(focus)} (25 min)`, my: "မေးခွန်းဖြေပြီးမှ ဖတ်" },
    { key: "review", label: "မှားတဲ့မေးခွန်း ပြန်သုံးသပ် (15 min)", my: "Error log + Explanation" },
  ]
    .map(
      (t) => `
    <label class="checkRow">
      <input type="checkbox" data-action="dailyTask" data-task="${t.key}" ${daily[t.key] ? "checked" : ""} />
      <span><strong>${t.label}</strong><br/><span class="badge">${t.my}</span></span>
    </label>
  `
    )
    .join("");

  const errorList = Object.entries(state.errors)
    .map(([id, err]) => {
      const q = QUESTIONS.find((x) => x.id === id);
      return `
        <div class="planError">
          <div class="planError__top">
            <strong>${escapeHtml(id)}</strong>
            <span class="badge">${escapeHtml(subjectLabel(err.category || q?.category))}</span>
          </div>
          ${err.reason ? `<div>${escapeHtml(err.reason)}</div>` : ""}
          ${err.tip ? `<div class="badge" style="margin-top:6px">${escapeHtml(err.tip)}</div>` : ""}
          <button class="btn btn--ghost" type="button" data-action="removeError" data-id="${escapeHtml(id)}">ဖယ်မယ်</button>
        </div>
      `;
    })
    .join("");

  const dueHtml = due.length
    ? due
        .map(
          (e) => `
      <div class="planError">
        <strong>${escapeHtml(e.id)}</strong> — ပြန်သုံးသပ်ရန်
        <button class="btn btn--ghost" type="button" data-action="openQuestion" data-id="${escapeHtml(e.id)}">ဖွင့်မယ်</button>
      </div>
    `
        )
        .join("")
    : `<div class="badge">ဒီနေ့ ပြန်သုံးသပ်ရန် မေးခွန်း မရှိသေးပါ</div>`;

  els.plan.innerHTML = `
    <div class="planGrid">
      <div class="item planHero">
        <div class="planHero__title">ဒီနေ့ ဘာလေ့လာမလဲ?</div>
        <div class="planHero__focus">${PRIORITY_LABEL[focus]} ${escapeHtml(subjectLabel(focus))}</div>
        <p class="planHero__text">လေ့လာအစဉ်: <strong>2→3→1→4→5</strong> (မေးခွန်းအများဆုံး category ဦးစွာ)</p>
        <div class="row" style="flex-wrap:wrap;margin-top:12px">
          <button class="btn" type="button" data-action="startCategory" data-cat="${focus}">ဒီနေ့ Quiz စတင်မယ်</button>
          <button class="btn btn--ghost" type="button" data-action="startReview">မှားတာပြန်သုံးသပ်မယ်</button>
        </div>
      </div>

      <div class="item">
        <div class="item__top"><strong>စာမေးပွဲရက်</strong></div>
        <label class="field">
          <div class="field__label">Exam date (optional)</div>
          <input id="examDateInput" type="date" value="${escapeHtml(state.examDate || "")}" />
        </label>
        <div class="badge">${daysLeft != null ? `ကျန် ${daysLeft} ရက်` : "ရက်သတ်မှတ်မထားသေးပါ"}</div>
        <div class="badge" style="margin-top:8px">စုစုပေါင်း ${totalDone} မေးခွန်း done · Error ${totalErrors} ခု</div>
      </div>
    </div>

    <div class="planSection">
      <h3>Category တိုးတက်မှု</h3>
      <div class="planGrid planGrid--3">${categoryCards}</div>
    </div>

    <div class="planSection">
      <h3>နေ့စဉ် Routine (45–60 min)</h3>
      <div class="item">${dailyChecks}</div>
    </div>

    <div class="planGrid">
      <div class="planSection">
        <h3>Spaced Repetition — ပြန်သုံးသပ်ရန်</h3>
        <div class="item">${dueHtml}</div>
      </div>
      <div class="planSection">
        <h3>Error Log — မှားတဲ့မေးခွန်းများ</h3>
        <div class="item">${errorList || `<div class="badge">Quiz မှာ "မှားတယ်" နှိပ်ပြီး မှတ်ပါ</div>`}</div>
      </div>
    </div>

    <div class="planSection">
      <h3>လေ့လာနည်း အကြံပြု</h3>
      <div class="item planTips">
        <ol>
          <li><strong>ဖတ်ခြင်းထက် Quiz ဦးစွာ</strong> — မေးခွန်း 20–30 ခုဖြေပြီး မှားတာကိုပဲ Explanation ဖတ်</li>
          <li><strong>Error log ထားပါ</strong> — ဘာကြောင့်မှားလဲ + မှတ်မိလွယ်စာသား ၁ ကြောင်း</li>
          <li><strong>Day 0 → Day 2 → Day 7</strong> — မှားတာကို ပြန်ဖြေပါ</li>
          <li><strong>Vocab</strong> — မေးခွန်းထဲက မသိတဲ့စကားလုံးကိုပဲ 10–20 လုံးကျက်</li>
        </ol>
      </div>
    </div>
  `;

  const examInput = document.getElementById("examDateInput");
  if (examInput) {
    examInput.addEventListener("change", (e) => {
      const s = loadState();
      s.examDate = e.target.value;
      saveState(s);
      renderPlan();
    });
  }
}

function startCategoryQuiz(cat) {
  els.category.value = cat;
  els.query.value = "";
  setMode("modeQuiz");
  buildQuizList();
  quizReveal = false;
  renderQuiz();
}

function logError(id) {
  const q = QUESTIONS.find((x) => x.id === id);
  if (!q) return;
  const reason = prompt("ဘာကြောင့်မှားလဲ? (Why wrong?)", loadState().errors[id]?.reason || "");
  if (reason === null) return;
  const tip = prompt("မှတ်မိလွယ်စာသား (Memory tip)", loadState().errors[id]?.tip || q.explanation?.memoryTipMY || "");
  const state = loadState();
  state.errors[id] = {
    reason: reason || "",
    tip: tip || "",
    category: q.category,
    date: todayKey(),
    lastReview: todayKey(),
  };
  saveState(state);
  renderQuiz();
  renderPlan();
}

function removeError(id) {
  const state = loadState();
  delete state.errors[id];
  saveState(state);
  renderPlan();
}

function openQuestionInQuiz(id) {
  const idx = QUESTIONS.findIndex((q) => q.id === id);
  if (idx < 0) return;
  const q = QUESTIONS[idx];
  els.category.value = String(q.category);
  setMode("modeQuiz");
  buildQuizList();
  quizIndex = quizList.findIndex((x) => x.id === id);
  if (quizIndex < 0) quizIndex = 0;
  quizReveal = true;
  const state = loadState();
  if (state.errors[id]) {
    state.errors[id].lastReview = todayKey();
    saveState(state);
  }
  renderQuiz();
}

function buildQuizList() {
  const category = els.category.value;
  const query = normalizeText(els.query.value);
  quizList = QUESTIONS.filter((q) => questionMatches(q, category, query));
  quizIndex = Math.min(quizIndex, Math.max(0, quizList.length - 1));
}

function renderQuiz() {
  if (!quizList.length) {
    els.quizCard.innerHTML = `<div class="item">No questions match the current filter.</div>`;
    return;
  }
  const q = quizList[Math.min(quizIndex, quizList.length - 1)];
  els.quizCard.innerHTML = renderQuestion(q, { showAnswer: quizReveal, quizMode: true });

  const controls = document.createElement("div");
  controls.className = "toggle";
  controls.innerHTML = `
    <label class="row" style="gap:8px;cursor:pointer">
      <input id="reveal" type="checkbox" ${quizReveal ? "checked" : ""} />
      <span class="badge">Show answers</span>
    </label>
    <div class="badge">${quizIndex + 1} / ${quizList.length}</div>
  `;
  els.quizCard.prepend(controls);
  controls.querySelector("#reveal").addEventListener("change", (e) => {
    quizReveal = e.target.checked;
    renderQuiz();
  });
}

function doSearch() {
  const category = els.category.value;
  const query = normalizeText(els.query.value);
  const matches = QUESTIONS.filter((q) => questionMatches(q, category, query));
  els.results.innerHTML = matches.length
    ? matches.map((q) => renderQuestion(q, { showAnswer: true })).join("")
    : `<div class="item">No results.</div>`;
}

function renderVocab() {
  const category = els.category.value;
  const query = normalizeText(els.query.value);
  const matches = FLASHCARDS.filter((r) => {
    if (category !== "all" && String(r.category) !== String(category)) return false;
    if (!query) return true;
    return normalizeText([r.kanji, r.reading, r.english, r.burmese].join(" ")).includes(query);
  });
  els.vocab.innerHTML = matches.length ? matches.map(renderFlashcard).join("") : `<div class="item">No results.</div>`;
}

function handlePlanClick(e) {
  const el = e.target.closest("[data-action]");
  if (!el) return;
  const action = el.dataset.action;
  if (action === "startCategory") return startCategoryQuiz(el.dataset.cat);
  if (action === "startReview") {
    const due = getDueReviews();
    if (due.length) openQuestionInQuiz(due[0].id);
    else startCategoryQuiz(getTodayFocus());
    return;
  }
  if (action === "dailyTask") return toggleDailyTask(el.dataset.task);
  if (action === "removeError") return removeError(el.dataset.id);
  if (action === "openQuestion") return openQuestionInQuiz(el.dataset.id);
}

function handleContentClick(e) {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;
  const action = btn.dataset.action;
  const id = btn.dataset.id;
  if (action === "toggleDone") {
    const state = loadState();
    const key = `q:${id}`;
    if (state.done[key]) delete state.done[key];
    else state.done[key] = true;
    saveState(state);
    doSearch();
    renderQuiz();
    renderPlan();
    return;
  }
  if (action === "toggleVocab") {
    const state = loadState();
    const key = `v:${id}`;
    if (state.vocab[key]) delete state.vocab[key];
    else state.vocab[key] = true;
    saveState(state);
    renderVocab();
    renderPlan();
    return;
  }
  if (action === "logError") return logError(id);
  if (action === "revealAnswer") {
    quizReveal = true;
    renderQuiz();
  }
}

function setStatus(msg) {
  els.status.textContent = msg;
}

async function init() {
  try {
    setStatus("Loading data…");
    QUESTIONS = await loadJson("/data/questions.json");
    FLASHCARDS = await loadJson("/data/flashcards.json");
    setStatus(`Loaded ${QUESTIONS.length} questions · ${FLASHCARDS.length} vocab`);

    els.plan.addEventListener("click", handlePlanClick);
    els.plan.addEventListener("change", handlePlanClick);
    els.results.addEventListener("click", handleContentClick);
    els.quizCard.addEventListener("click", handleContentClick);
    els.vocab.addEventListener("click", handleContentClick);

    els.modePlan.addEventListener("click", () => {
      setMode("modePlan");
      renderPlan();
    });
    els.modeSearch.addEventListener("click", () => setMode("modeSearch"));
    els.modeQuiz.addEventListener("click", () => {
      setMode("modeQuiz");
      buildQuizList();
      renderQuiz();
    });
    els.modeVocab.addEventListener("click", () => {
      setMode("modeVocab");
      renderVocab();
    });

    els.btnSearch.addEventListener("click", () => {
      doSearch();
      buildQuizList();
      renderQuiz();
      renderVocab();
    });

    els.btnReset.addEventListener("click", () => {
      els.category.value = "all";
      els.query.value = "";
      doSearch();
      buildQuizList();
      renderQuiz();
      renderVocab();
    });

    els.btnClearProgress.addEventListener("click", () => {
      if (!confirm("Progress, error log, daily tasks အားလုံး ဖျက်မလား?")) return;
      localStorage.removeItem(STORAGE_KEY);
      doSearch();
      renderQuiz();
      renderVocab();
      renderPlan();
    });

    els.btnPrev.addEventListener("click", () => {
      quizIndex = Math.max(0, quizIndex - 1);
      quizReveal = false;
      renderQuiz();
    });
    els.btnNext.addEventListener("click", () => {
      quizIndex = Math.min(quizList.length - 1, quizIndex + 1);
      quizReveal = false;
      renderQuiz();
    });
    els.btnShuffle.addEventListener("click", () => {
      for (let i = quizList.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [quizList[i], quizList[j]] = [quizList[j], quizList[i]];
      }
      quizIndex = 0;
      quizReveal = false;
      renderQuiz();
    });

    renderPlan();
    doSearch();
    buildQuizList();
    renderQuiz();
    renderVocab();
  } catch (err) {
    console.error(err);
    setStatus("Missing data files");
    els.plan.innerHTML = `<div class="item"><strong>Data not found.</strong> data/questions.json လိုအပ်ပါတယ်။</div>`;
  }
}

init();
