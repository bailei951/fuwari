(function () {
  const QUESTIONS = Array.isArray(window.__QUESTIONS__) ? window.__QUESTIONS__ : [];

  const STORAGE_KEYS = {
    wrongSet: "quiz_wrong_set_v1",
    answered: "quiz_answered_v1",
    mode: "quiz_mode_v2",
    view: "quiz_view_v1",
    typeFilter: "quiz_type_filter_v1",
    indexMap: "quiz_index_map_v2",
    examSession: "quiz_exam_session_v1",
  };

  const elStats = document.getElementById("stats");
  const elViewSelect = document.getElementById("viewSelect");
  const elPracticeControls = document.getElementById("practiceControls");
  const elExamControls = document.getElementById("examControls");
  const elModeSelect = document.getElementById("modeSelect");
  const elTypeSelect = document.getElementById("typeSelect");
  const elJumpInput = document.getElementById("jumpInput");
  const elJumpBtn = document.getElementById("jumpBtn");
  const elResetProgressBtn = document.getElementById("resetProgressBtn");
  const elClearWrongBtn = document.getElementById("clearWrongBtn");
  const elTfCount = document.getElementById("tfCount");
  const elSingleCount = document.getElementById("singleCount");
  const elMultiCount = document.getElementById("multiCount");
  const elExamTotal = document.getElementById("examTotal");
  const elStartExamBtn = document.getElementById("startExamBtn");
  const elSubmitExamBtn = document.getElementById("submitExamBtn");
  const elResetExamBtn = document.getElementById("resetExamBtn");

  const elQIndex = document.getElementById("qIndex");
  const elQType = document.getElementById("qType");
  const elExamStatus = document.getElementById("examStatus");
  const elQPrompt = document.getElementById("qPrompt");
  const elAnswerForm = document.getElementById("answerForm");
  const elPrevBtn = document.getElementById("prevBtn");
  const elNextBtn = document.getElementById("nextBtn");
  const elSubmitBtn = document.getElementById("submitBtn");
  const elResult = document.getElementById("result");
  const elExamResult = document.getElementById("examResult");
  const elToggleWrongBtn = document.getElementById("toggleWrongBtn");

  function safeJsonParse(str, fallback) {
    try {
      return JSON.parse(str);
    } catch {
      return fallback;
    }
  }

  function loadWrongSet() {
    const raw = localStorage.getItem(STORAGE_KEYS.wrongSet);
    const arr = safeJsonParse(raw || "[]", []);
    return new Set(Array.isArray(arr) ? arr.map((x) => Number(x)).filter((n) => Number.isFinite(n)) : []);
  }

  function saveWrongSet(set) {
    localStorage.setItem(STORAGE_KEYS.wrongSet, JSON.stringify(Array.from(set)));
  }

  function loadAnsweredMap() {
    const raw = localStorage.getItem(STORAGE_KEYS.answered);
    const obj = safeJsonParse(raw || "{}", {});
    if (!obj || typeof obj !== "object") return {};
    return obj;
  }

  function saveAnsweredMap(map) {
    localStorage.setItem(STORAGE_KEYS.answered, JSON.stringify(map));
  }

  function getView() {
    const raw = localStorage.getItem(STORAGE_KEYS.view);
    return raw === "exam" ? "exam" : "practice";
  }

  function setView(view) {
    localStorage.setItem(STORAGE_KEYS.view, view);
  }

  function getMode() {
    const raw = localStorage.getItem(STORAGE_KEYS.mode);
    return raw === "wrong" ? "wrong" : "all";
  }

  function setMode(mode) {
    localStorage.setItem(STORAGE_KEYS.mode, mode);
  }

  function getTypeFilter() {
    const raw = localStorage.getItem(STORAGE_KEYS.typeFilter);
    if (raw === "tf" || raw === "single" || raw === "multi") return raw;
    return "all";
  }

  function setTypeFilter(type) {
    localStorage.setItem(STORAGE_KEYS.typeFilter, type);
  }

  function loadIndexMap() {
    const raw = localStorage.getItem(STORAGE_KEYS.indexMap);
    const obj = safeJsonParse(raw || "{}", {});
    if (!obj || typeof obj !== "object") return {};
    return obj;
  }

  function saveIndexMap(map) {
    localStorage.setItem(STORAGE_KEYS.indexMap, JSON.stringify(map));
  }

  function getIndexKey(view, mode, typeFilter, examId) {
    if (view === "exam") return `exam:${examId || "none"}`;
    return `practice:${mode}:${typeFilter}`;
  }

  function loadIndex(view, mode, typeFilter, examId, indexMap) {
    const key = getIndexKey(view, mode, typeFilter, examId);
    const n = Number(indexMap[key]);
    if (!Number.isFinite(n) || n < 0) return 0;
    return n;
  }

  function saveIndex(view, mode, typeFilter, examId, idx, indexMap) {
    const key = getIndexKey(view, mode, typeFilter, examId);
    indexMap[key] = idx;
    saveIndexMap(indexMap);
  }

  function normalizeAnswer(answer, type) {
    if (type === "tf") {
      if (answer === "对" || answer === "错") return answer;
      if (answer === "true" || answer === "True") return "对";
      if (answer === "false" || answer === "False") return "错";
    }
    return String(answer || "").replace(/\s+/g, "");
  }

  function buildAnswerFromForm(q) {
    if (q.type === "multi") {
      const keys = Array.from(elAnswerForm.querySelectorAll('input[type="checkbox"]:checked'))
        .map((x) => x.value)
        .sort();
      return keys.join("");
    }
    if (q.type === "single") {
      const picked = elAnswerForm.querySelector('input[type="radio"]:checked');
      return picked ? picked.value : "";
    }
    if (q.type === "tf") {
      const picked = elAnswerForm.querySelector('input[type="radio"]:checked');
      return picked ? picked.value : "";
    }
    const picked = elAnswerForm.querySelector('input[type="radio"]:checked, input[type="checkbox"]:checked');
    return picked ? picked.value : "";
  }

  function setResult(text, kind) {
    elResult.textContent = text;
    elResult.classList.remove("ok", "bad");
    if (kind === "ok") elResult.classList.add("ok");
    if (kind === "bad") elResult.classList.add("bad");
  }

  function typeLabel(type) {
    if (type === "single") return "单选题";
    if (type === "multi") return "多选题";
    if (type === "tf") return "判断题";
    return "未知题型";
  }

  function computePracticePool(mode, typeFilter, wrongSet) {
    let base = QUESTIONS;
    if (mode === "wrong") {
      const idSet = new Set(Array.from(wrongSet));
      base = QUESTIONS.filter((q) => idSet.has(Number(q.id)));
    }
    if (typeFilter === "all") return base.slice();
    return base.filter((q) => q.type === typeFilter);
  }

  function shuffled(list) {
    const arr = list.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = arr[i];
      arr[i] = arr[j];
      arr[j] = t;
    }
    return arr;
  }

  function normalizeCount(value) {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) return 0;
    return Math.floor(n);
  }

  function buildExam(idsByType, cfg) {
    const picked = [];
    const tfIds = shuffled(idsByType.tf).slice(0, cfg.tf);
    const singleIds = shuffled(idsByType.single).slice(0, cfg.single);
    const multiIds = shuffled(idsByType.multi).slice(0, cfg.multi);
    picked.push(...tfIds, ...singleIds, ...multiIds);
    return shuffled(picked);
  }

  function loadExamSession() {
    const raw = localStorage.getItem(STORAGE_KEYS.examSession);
    const obj = safeJsonParse(raw || "null", null);
    if (!obj || typeof obj !== "object") return null;
    if (!Array.isArray(obj.ids)) return null;
    if (!obj.config || typeof obj.config !== "object") return null;
    if (!obj.answers || typeof obj.answers !== "object") obj.answers = {};
    return obj;
  }

  function saveExamSession(session) {
    localStorage.setItem(STORAGE_KEYS.examSession, JSON.stringify(session));
  }

  function clearExamSession() {
    localStorage.removeItem(STORAGE_KEYS.examSession);
  }

  function computeExamPool(session) {
    const byId = new Map(QUESTIONS.map((q) => [Number(q.id), q]));
    const ids = session && Array.isArray(session.ids) ? session.ids : [];
    return ids.map((id) => byId.get(Number(id))).filter(Boolean);
  }

  let wrongSet = loadWrongSet();
  let answeredMap = loadAnsweredMap();
  let indexMap = loadIndexMap();
  let view = getView();
  let mode = getMode();
  let typeFilter = getTypeFilter();
  let examSession = loadExamSession();
  let pool = [];
  let idx = 0;

  function updateStats() {
    const wrongCount = wrongSet.size;
    const doneCount = Object.keys(answeredMap).length;
    const examTotal = examSession && Array.isArray(examSession.ids) ? examSession.ids.length : 0;
    elStats.textContent = `总题数：${QUESTIONS.length}，已做：${doneCount}，错题本：${wrongCount}，考试题量：${examTotal}`;
  }

  function setViewUI() {
    elViewSelect.value = view;
    elPracticeControls.style.display = view === "practice" ? "flex" : "none";
    elExamControls.style.display = view === "exam" ? "flex" : "none";
    elSubmitBtn.style.display = view === "exam" ? "none" : "inline-block";
    elExamResult.style.display = view === "exam" ? "block" : "none";
    elResult.style.display = view === "exam" ? "none" : "block";
  }

  function updateExamTotalUI() {
    const tf = normalizeCount(elTfCount.value);
    const single = normalizeCount(elSingleCount.value);
    const multi = normalizeCount(elMultiCount.value);
    const total = tf + single + multi;
    elExamTotal.textContent = `总题量：${total}`;
  }

  function computeActivePool() {
    if (view === "exam") {
      if (!examSession) return [];
      return computeExamPool(examSession);
    }
    return computePracticePool(mode, typeFilter, wrongSet);
  }

  function getExamId(session) {
    if (!session) return "none";
    const ts = Number(session.createdAt || 0);
    const n = Array.isArray(session.ids) ? session.ids.length : 0;
    return `${ts}-${n}`;
  }

  function render() {
    updateStats();
    setViewUI();
    elModeSelect.value = mode;
    elTypeSelect.value = typeFilter;
    updateExamTotalUI();

    pool = computeActivePool();
    if (pool.length === 0) {
      elQIndex.textContent = view === "exam" ? "暂无考试卷" : mode === "wrong" ? "错题本为空" : "没有题目";
      elQType.textContent = "";
      elExamStatus.textContent = view === "exam" ? "点击“开始考试”随机出卷。" : "";
      elQPrompt.textContent = "";
      elAnswerForm.innerHTML = "";
      elExamResult.textContent = "";
      setResult(view === "practice" ? (mode === "wrong" ? "先把错题加入错题本，再来这里刷错题。" : "请先生成题库数据。") : "", "");
      elToggleWrongBtn.textContent = "加入错题本";
      elToggleWrongBtn.disabled = true;
      return;
    }

    idx = Math.max(0, Math.min(idx, pool.length - 1));
    saveIndex(view, mode, typeFilter, getExamId(examSession), idx, indexMap);

    const q = pool[idx];
    const qId = Number(q.id);
    const answered = view === "exam" && examSession ? examSession.answers[String(qId)] : answeredMap[String(qId)];

    elQIndex.textContent = `第 ${idx + 1} / ${pool.length} 题（题号：${qId}）`;
    elQType.textContent = typeLabel(q.type);
    elQPrompt.textContent = q.prompt || "";

    elAnswerForm.innerHTML = "";

    const inputName = "ans";
    const correct = normalizeAnswer(q.answer, q.type);

    if (view === "exam" && examSession) {
      const total = pool.length;
      const done = Object.keys(examSession.answers || {}).length;
      const ok = Object.values(examSession.answers || {}).filter((x) => x && x.ok).length;
      elExamStatus.textContent = `考试中：已作答 ${done}/${total}，当前正确 ${ok}`;
    } else {
      elExamStatus.textContent = "";
    }

    if (q.type === "tf") {
      const tfOpts = [
        { key: "对", text: "对" },
        { key: "错", text: "错" },
      ];
      tfOpts.forEach((opt) => {
        const id = `opt_${qId}_${opt.key}`;
        const wrap = document.createElement("div");
        wrap.className = "opt";
        wrap.innerHTML = `
          <input id="${id}" type="radio" name="${inputName}" value="${opt.key}" />
          <label for="${id}">${opt.text}</label>
        `;
        elAnswerForm.appendChild(wrap);
      });
    } else {
      const opts = Array.isArray(q.options) ? q.options : [];
      const isMulti = q.type === "multi";
      opts.forEach((opt) => {
        const id = `opt_${qId}_${opt.key}`;
        const wrap = document.createElement("div");
        wrap.className = "opt";
        wrap.innerHTML = `
          <input id="${id}" type="${isMulti ? "checkbox" : "radio"}" name="${inputName}" value="${opt.key}" />
          <label for="${id}">${opt.key}、${opt.text}</label>
        `;
        elAnswerForm.appendChild(wrap);
      });
    }

    const inWrong = wrongSet.has(qId);
    elToggleWrongBtn.disabled = false;
    elToggleWrongBtn.textContent = inWrong ? "从错题本移除" : "加入错题本";

    if (answered && typeof answered === "object") {
      const lastPick = normalizeAnswer(answered.pick || "", q.type);
      const lastOk = Boolean(answered.ok);
      if (q.type === "multi") {
        const set = new Set(lastPick.split(""));
        Array.from(elAnswerForm.querySelectorAll('input[type="checkbox"]')).forEach((input) => {
          input.checked = set.has(input.value);
        });
      } else {
        const input = elAnswerForm.querySelector(`input[value="${CSS.escape(lastPick)}"]`);
        if (input) input.checked = true;
      }
      if (view === "practice") {
        setResult(lastOk ? `正确。正确答案：${correct}` : `错误。正确答案：${correct}`, lastOk ? "ok" : "bad");
      }
    } else {
      if (view === "practice") setResult("未提交。", "");
    }

    elPrevBtn.disabled = idx === 0;
    elNextBtn.disabled = idx === pool.length - 1;
  }

  function submit() {
    if (pool.length === 0) return;
    const q = pool[idx];
    const qId = Number(q.id);

    const pick = normalizeAnswer(buildAnswerFromForm(q), q.type);
    const correct = normalizeAnswer(q.answer, q.type);
    const ok = pick !== "" && pick === correct;

    if (view === "exam" && examSession) {
      examSession.answers[String(qId)] = { pick, ok, ts: Date.now(), type: q.type };
      saveExamSession(examSession);
    } else {
      answeredMap[String(qId)] = { pick, ok, ts: Date.now(), type: q.type };
      saveAnsweredMap(answeredMap);
    }

    if (ok) {
      if (view === "practice") setResult(`正确。正确答案：${correct}`, "ok");
    } else {
      if (view === "practice") setResult(pick ? `错误。正确答案：${correct}` : `未选择答案。正确答案：${correct}`, "bad");
    }
    updateStats();
    if (view === "exam") render();
  }

  function goto(delta) {
    if (pool.length === 0) return;
    idx = Math.max(0, Math.min(idx + delta, pool.length - 1));
    saveIndex(view, mode, typeFilter, getExamId(examSession), idx, indexMap);
    render();
  }

  function jumpToQuestionId(targetId) {
    const n = Number(targetId);
    if (!Number.isFinite(n) || n <= 0) return;
    const found = pool.findIndex((q) => Number(q.id) === n);
    if (found >= 0) {
      idx = found;
      saveIndex(view, mode, typeFilter, getExamId(examSession), idx, indexMap);
      render();
      return;
    }
    if (view === "practice") setResult("当前范围内没有该题号。", "bad");
  }

  function toggleWrong() {
    if (pool.length === 0) return;
    const q = pool[idx];
    const qId = Number(q.id);
    if (wrongSet.has(qId)) {
      wrongSet.delete(qId);
    } else {
      wrongSet.add(qId);
    }
    saveWrongSet(wrongSet);
    if (view === "practice" && mode === "wrong") {
      const newPool = computePracticePool(mode, typeFilter, wrongSet);
      if (newPool.length === 0) idx = 0;
      else if (idx >= newPool.length) idx = newPool.length - 1;
    }
    render();
  }

  function resetProgress() {
    answeredMap = {};
    saveAnsweredMap(answeredMap);
    idx = 0;
    saveIndex(view, mode, typeFilter, getExamId(examSession), idx, indexMap);
    render();
  }

  function clearWrong() {
    wrongSet = new Set();
    saveWrongSet(wrongSet);
    if (view === "practice" && mode === "wrong") idx = 0;
    render();
  }

  function startExam() {
    const cfg = {
      tf: normalizeCount(elTfCount.value),
      single: normalizeCount(elSingleCount.value),
      multi: normalizeCount(elMultiCount.value),
    };
    const idsByType = {
      tf: QUESTIONS.filter((q) => q.type === "tf").map((q) => Number(q.id)),
      single: QUESTIONS.filter((q) => q.type === "single").map((q) => Number(q.id)),
      multi: QUESTIONS.filter((q) => q.type === "multi").map((q) => Number(q.id)),
    };
    const ids = buildExam(idsByType, cfg);
    examSession = {
      ids,
      createdAt: Date.now(),
      config: cfg,
      answers: {},
    };
    saveExamSession(examSession);
    view = "exam";
    setView(view);
    idx = 0;
    saveIndex(view, mode, typeFilter, getExamId(examSession), idx, indexMap);
    elExamResult.textContent = "";
    render();
  }

  function resetExam() {
    clearExamSession();
    examSession = null;
    idx = 0;
    elExamResult.textContent = "";
    render();
  }

  function scoreExam() {
    if (!examSession) return;
    const total = Array.isArray(examSession.ids) ? examSession.ids.length : 0;
    const answers = examSession.answers || {};
    const done = Object.keys(answers).length;
    const ok = Object.values(answers).filter((x) => x && x.ok).length;
    const pct = total > 0 ? Math.round((ok / total) * 1000) / 10 : 0;

    const byType = { tf: { ok: 0, total: 0 }, single: { ok: 0, total: 0 }, multi: { ok: 0, total: 0 } };
    const byId = new Map(QUESTIONS.map((q) => [Number(q.id), q]));
    for (const id of examSession.ids) {
      const q = byId.get(Number(id));
      if (!q) continue;
      if (byType[q.type]) byType[q.type].total += 1;
      const a = answers[String(Number(id))];
      if (a && a.ok && byType[q.type]) byType[q.type].ok += 1;
    }

    const lines = [
      `已作答：${done}/${total}`,
      `得分：${ok}/${total}（${pct}%）`,
      `判断：${byType.tf.ok}/${byType.tf.total}，单选：${byType.single.ok}/${byType.single.total}，多选：${byType.multi.ok}/${byType.multi.total}`,
    ];
    elExamResult.textContent = lines.join("；");
  }

  function migrateLegacyModeKey() {
    const v2 = localStorage.getItem(STORAGE_KEYS.mode);
    if (v2) return;
    const v1 = localStorage.getItem("quiz_mode_v1");
    if (v1 === "wrong" || v1 === "all") {
      localStorage.setItem(STORAGE_KEYS.mode, v1);
    }
  }

  function migrateLegacyIndexKeys() {
    const map = loadIndexMap();
    const hasAny = Object.keys(map).length > 0;
    if (hasAny) return;
    const oldAll = Number(localStorage.getItem("quiz_index_all_v1"));
    const oldWrong = Number(localStorage.getItem("quiz_index_wrong_v1"));
    if (Number.isFinite(oldAll) && oldAll >= 0) map["practice:all:all"] = oldAll;
    if (Number.isFinite(oldWrong) && oldWrong >= 0) map["practice:wrong:all"] = oldWrong;
    saveIndexMap(map);
  }

  function onReady() {
    migrateLegacyModeKey();
    migrateLegacyIndexKeys();

    wrongSet = loadWrongSet();
    answeredMap = loadAnsweredMap();
    indexMap = loadIndexMap();
    view = getView();
    mode = getMode();
    typeFilter = getTypeFilter();
    examSession = loadExamSession();

    if (view === "exam" && !examSession) view = "practice";
    setView(view);
    pool = computeActivePool();
    if (view === "practice" && pool.length === 0) {
      if (mode === "wrong" && wrongSet.size === 0) {
        mode = "all";
        setMode(mode);
      }
      if (typeFilter !== "all") {
        typeFilter = "all";
        setTypeFilter(typeFilter);
      }
      pool = computeActivePool();
    }

    idx = loadIndex(view, mode, typeFilter, getExamId(examSession), indexMap);
    idx = Math.min(idx, Math.max(pool.length - 1, 0));

    render();
  }

  elViewSelect.addEventListener("change", () => {
    view = elViewSelect.value === "exam" ? "exam" : "practice";
    if (view === "exam" && !examSession) view = "exam";
    setView(view);
    idx = loadIndex(view, mode, typeFilter, getExamId(examSession), indexMap);
    render();
  });

  elModeSelect.addEventListener("change", () => {
    mode = elModeSelect.value === "wrong" ? "wrong" : "all";
    setMode(mode);
    idx = loadIndex(view, mode, typeFilter, getExamId(examSession), indexMap);
    render();
  });

  elTypeSelect.addEventListener("change", () => {
    typeFilter = elTypeSelect.value;
    setTypeFilter(typeFilter);
    idx = loadIndex(view, mode, typeFilter, getExamId(examSession), indexMap);
    render();
  });

  elJumpBtn.addEventListener("click", () => jumpToQuestionId(elJumpInput.value));
  elJumpInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      jumpToQuestionId(elJumpInput.value);
    }
  });

  elTfCount.addEventListener("input", updateExamTotalUI);
  elSingleCount.addEventListener("input", updateExamTotalUI);
  elMultiCount.addEventListener("input", updateExamTotalUI);
  elStartExamBtn.addEventListener("click", startExam);
  elSubmitExamBtn.addEventListener("click", scoreExam);
  elResetExamBtn.addEventListener("click", resetExam);

  elResetProgressBtn.addEventListener("click", resetProgress);
  elClearWrongBtn.addEventListener("click", clearWrong);
  elPrevBtn.addEventListener("click", () => goto(-1));
  elNextBtn.addEventListener("click", () => goto(1));
  elSubmitBtn.addEventListener("click", submit);
  elToggleWrongBtn.addEventListener("click", toggleWrong);
  elAnswerForm.addEventListener("submit", (e) => e.preventDefault());

  if (!Array.isArray(QUESTIONS) || QUESTIONS.length === 0) {
    setResult("未检测到题库数据：请先运行清洗脚本生成 web/questions.js。", "bad");
  }

  onReady();
})();
