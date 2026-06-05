const SUBJECT_BY_CATEGORY = {
  "1": "鉄骨構造",
  "2": "鉄骨加工",
  "3": "品質管理",
  "4": "安全衛生",
  "5": "建築法規",
};

const els = {
  status: document.getElementById("status"),

  modeSearch: document.getElementById("modeSearch"),
  modeQuiz: document.getElementById("modeQuiz"),
  modeVocab: document.getElementById("modeVocab"),

  viewSearch: document.getElementById("viewSearch"),
  viewQuiz: document.getElementById("viewQuiz"),
  viewVocab: document.getElementById("viewVocab"),

  category: document.getElementById("category"),
  query: document.getElementById("query"),
  btnSearch: document.getElementById("btnSearch"),
  btnReset: document.getElementById("btnReset"),
  btnClearProgress: document.getElementById("btnClearProgress"),

  results: document.getElementById("results"),
  vocab: document.getElementById("vocab"),

  btnPrev: document.getElementById("btnPrev"),
  btnNext: document.getElementById("btnNext"),
  btnShuffle: document.getElementById("btnShuffle"),
  quizCard: document.getElementById("quizCard"),
};

const STORAGE_KEY = "tekko_exam_progress_v1";

function loadProgress() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveProgress(p) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
}

function setMode(mode) {
  for (const [btn, view] of [
    [els.modeSearch, els.viewSearch],
    [els.modeQuiz, els.viewQuiz],
    [els.modeVocab, els.viewVocab],
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
    [
      q.id,
      q.category,
      q.question_jp,
      q.question_my,
      JSON.stringify(q.options || []),
      JSON.stringify(q.explanation || {}),
    ].join(" ")
  );
  return hay.includes(query);
}

function renderQuestion(q, { showAnswer = true } = {}) {
  const correct = q.correct_option_id;
  const options = Array.isArray(q.options) ? q.options : [];

  const progress = loadProgress();
  const key = `q:${q.id}`;
  const done = Boolean(progress[key]);

  const optsHtml = options
    .map((opt) => {
      const isCorrect = showAnswer && correct != null && opt.id === correct;
      const jp = opt.textJP ? escapeHtml(opt.textJP) : "";
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
  const expHtml = exp
    ? `
      <div class="toggle">
        <div class="badge"><strong>Explanation</strong></div>
      </div>
      <div class="opt">
        ${exp.titleMY ? `<div><strong>${escapeHtml(exp.titleMY)}</strong></div>` : ""}
        ${exp.reasonMY ? `<div style="margin-top:8px;line-height:1.6">${escapeHtml(exp.reasonMY)}</div>` : ""}
        ${exp.memoryTipMY ? `<div style="margin-top:8px;color:var(--muted)">${escapeHtml(exp.memoryTipMY)}</div>` : ""}
      </div>
    `
    : "";

  return `
    <div class="item">
      <div class="item__top">
        <div class="badge">${escapeHtml(subjectLabel(q.category))}</div>
        <div class="item__id">${escapeHtml(q.id)} ${done ? "• done" : ""}</div>
      </div>
      <div class="item__q">
        ${q.question_jp ? `<div><strong>JP:</strong> ${escapeHtml(q.question_jp)}</div>` : ""}
        ${q.question_my ? `<div style="margin-top:6px"><strong>MY:</strong> ${escapeHtml(q.question_my)}</div>` : ""}
      </div>
      ${options.length ? `<div class="item__opts">${optsHtml}</div>` : ""}
      <div class="row" style="margin-top:10px">
        <button class="btn btn--ghost" type="button" data-action="toggleDone" data-id="${escapeHtml(q.id)}">
          ${done ? "Mark not done" : "Mark done"}
        </button>
      </div>
      ${expHtml}
    </div>
  `;
}

function renderFlashcard(r) {
  const progress = loadProgress();
  const key = `v:${r.id}`;
  const done = Boolean(progress[key]);
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

let QUESTIONS = [];
let FLASHCARDS = [];

let quizList = [];
let quizIndex = 0;
let quizReveal = true;

function buildQuizList() {
  const category = els.category.value;
  const query = normalizeText(els.query.value);
  quizList = QUESTIONS.filter((q) => questionMatches(q, category, query));
  quizIndex = 0;
}

function renderQuiz() {
  if (!quizList.length) {
    els.quizCard.innerHTML = `<div class="item">No questions match the current filter.</div>`;
    return;
  }
  const q = quizList[Math.min(quizIndex, quizList.length - 1)];
  els.quizCard.innerHTML = renderQuestion(q, { showAnswer: quizReveal });

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
    const hay = normalizeText([r.kanji, r.reading, r.english, r.burmese].join(" "));
    return hay.includes(query);
  });
  els.vocab.innerHTML = matches.length ? matches.map(renderFlashcard).join("") : `<div class="item">No results.</div>`;
}

function toggleProgress(prefix, id) {
  const p = loadProgress();
  const key = `${prefix}:${id}`;
  p[key] = !p[key];
  saveProgress(p);
}

function wireDelegatedClicks(container) {
  container.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;
    const action = btn.dataset.action;
    const id = btn.dataset.id;
    if (!action || !id) return;
    if (action === "toggleDone") {
      toggleProgress("q", id);
      doSearch();
      renderQuiz();
      return;
    }
    if (action === "toggleVocab") {
      toggleProgress("v", id);
      renderVocab();
      return;
    }
  });
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

    wireDelegatedClicks(els.results);
    wireDelegatedClicks(els.quizCard);
    wireDelegatedClicks(els.vocab);

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
      localStorage.removeItem(STORAGE_KEY);
      doSearch();
      renderQuiz();
      renderVocab();
    });

    els.btnPrev.addEventListener("click", () => {
      quizIndex = Math.max(0, quizIndex - 1);
      renderQuiz();
    });
    els.btnNext.addEventListener("click", () => {
      quizIndex = Math.min(quizList.length - 1, quizIndex + 1);
      renderQuiz();
    });
    els.btnShuffle.addEventListener("click", () => {
      for (let i = quizList.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [quizList[i], quizList[j]] = [quizList[j], quizList[i]];
      }
      quizIndex = 0;
      renderQuiz();
    });

    doSearch();
    buildQuizList();
    renderQuiz();
    renderVocab();
  } catch (err) {
    console.error(err);
    setStatus("Missing data files");
    els.results.innerHTML = `
      <div class="item">
        <div class="item__q">
          <strong>Data not found.</strong><br/>
          Export first: run <code>python scripts/export_supabase.py</code> to generate
          <code>data/questions.json</code> and <code>data/flashcards.json</code>.
          Then serve the folder (e.g. <code>python -m http.server</code>) and open <code>study-app/</code>.
        </div>
      </div>
    `;
  }
}

init();

