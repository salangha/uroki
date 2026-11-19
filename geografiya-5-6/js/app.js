'use strict';
/* ============================================================
   ГЕОГРАФИЯ 5–6. ЛОГИКА ПРИЛОЖЕНИЯ
   Тропа курса (принцип Дуолинго) + новые типы заданий
   ============================================================ */

const app = document.getElementById('app');
const topTitle = document.getElementById('topTitle');
const btnHome = document.getElementById('btnHome');
const btnGlossary = document.getElementById('btnGlossary');

const state = { view: 'home', topic: null, page: 0, questions: [], qi: 0, score: 0, results: [], answered: false, currentTopicId: null };

/* ---------- утилиты ---------- */
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* {idТермина|слово} -> кликабельный термин */
function termify(text) {
  return String(text).replace(/\{(\w+)\|([^}]+)\}/g, function (m, id, word) {
    return '<span class="term-link" data-term="' + id + '">' + word + '</span>';
  });
}
function bindTermLinks(root) {
  root.querySelectorAll('.term-link').forEach(function (sp) {
    sp.addEventListener('click', function () { openGlossary(sp.dataset.term); });
  });
}

function norm(s) {
  return String(s).toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
}

/* ---------- прогресс курса (localStorage) ----------
   { done: { topicId: true }, stars: { topicId: 1..3 }, best: { topicId: % } } */
function progLoad() {
  try { return JSON.parse(localStorage.getItem('geo56-progress') || '{}'); }
  catch (e) { return {}; }
}
function progSave(p) {
  try { localStorage.setItem('geo56-progress', JSON.stringify(p)); } catch (e) {}
}
function markDone(topicId, pct) {
  const p = progLoad();
  p.done = p.done || {}; p.best = p.best || {};
  const first = !p.done[topicId];
  p.done[topicId] = true;
  if (!p.best[topicId] || p.best[topicId] < pct) p.best[topicId] = pct;
  progSave(p);
  return { first: first };
}

/* ---------- режим учителя (пароль) ---------- */
function isTeacher() {
  const p = progLoad();
  return !!p.teacher;
}
function setTeacher(on) {
  const p = progLoad();
  p.teacher = !!on;
  progSave(p);
}

/* ---------- узлы тропы ---------- */
const NODES = [];
(function initNodes() {
  COURSE.forEach(function (sec, si) {
    sec.nodes.forEach(function (n, ni) {
      n.id = 'n' + si + '_' + ni;
      n.sectionTitle = sec.section;
      n.sectionIcon = sec.icon;
      if (n.kind === 'topic') n.topic = TOPICS.find(function (t) { return t.id === n.topicId; });
      NODES.push(n);
    });
  });
  TOPICS.forEach(function (t) {
    t.questions.forEach(function (q) { q._topicShort = t.short; });
  });
})();

function contentNodes() { return NODES.filter(function (n) { return n.kind === 'topic' && n.topic; }); }
function currentTopicNode() {
  const p = progLoad();
  const done = p.done || {};
  return contentNodes().find(function (n) { return !done[n.topicId]; }) || null;
}
function nodeState(n) {
  if (n.kind !== 'topic' || !n.topic) return 'soon';      // «скоро»: не блокирует тропу
  const p = progLoad();
  if ((p.done || {})[n.topicId]) return 'done';
  if (isTeacher()) return 'open';                         // учитель: всё открыто
  const cur = currentTopicNode();
  return (cur && cur.id === n.id) ? 'open' : 'lock';
}
function topicsDoneCount() {
  const p = progLoad();
  const done = p.done || {};
  return contentNodes().filter(function (n) { return done[n.topicId]; }).length;
}

/* ---------- тосты ---------- */
function toast(msg) {
  let t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(function () { t.classList.remove('show'); }, 2800);
}

/* ---------- верхняя панель ---------- */
function setHeader(title, showHome) {
  topTitle.innerHTML = title || '';
  btnHome.style.display = showHome ? '' : 'none';
}

/* ============================================================
   ЭКРАН: КАРТА КУРСА (змейка кружков, как в «Test your grammar»)
   ============================================================ */
function renderCourse() {
  state.view = 'home';
  state.topic = null;
  setHeader('География 5–6. Тропа уроков', false);
  const compact = window.innerHeight <= 520;
  const wrapW = Math.min(app.clientWidth || 900, 900);
  const cols = wrapW >= 760 ? 10 : wrapW >= 560 ? 7 : 4;
  const rowH = compact ? 64 : 78;
  const colW = 100 / cols;                                  // в % ширины
  const nodes = NODES;
  const rows = Math.ceil(nodes.length / cols);
  const H = rows * rowH + 20;
  const doneCount = topicsDoneCount();
  const total = contentNodes().length;

  const pts = [];
  let items = '';
  nodes.forEach(function (n, i) {
    const row = Math.floor(i / cols);
    const pos = i % cols;
    const col = (row % 2 === 0) ? pos : (cols - 1 - pos);   // змейка
    const x = col * colW + colW / 2;
    const y = 10 + row * rowH + rowH / 2;
    pts.push([x, y]);
    const st = nodeState(n);
    const inner = (n.kind === 'topic' || n.kind === 'soon')
      ? (n.badge ? '<span class="node-icon">' + n.badge + '</span>' : '<span class="node-num">' + n.num + '</span>')
      : '<span class="node-icon">' + (n.kind === 'praktikum' ? '🎒' : n.kind === 'kontur' ? '🗺️' : '📓') + '</span>';
    items += '<button class="circle node-' + st + '" style="left:' + x + '%;top:' + y + 'px" data-node="' + n.id + '" title="' +
      (n.kind === 'topic' ? '§' + n.num + '. ' + n.title : n.title) + '">' + inner + '</button>';
  });

  const d = pts.map(function (p, i) { return (i ? 'L' : 'M') + p[0] + ' ' + p[1]; }).join(' ');
  let html = '<div class="course-head">' +
    '<div class="course-title">🌍 Тропа уроков географии</div>' +
    '<div class="course-sub">Пройдено: <b>' + doneCount + '</b> из ' + total + '</div>' +
    (isTeacher() ? '<div class="course-legend" style="color:#2f855a;font-weight:700">🎓 Режим учителя: все параграфы открыты для свободного просмотра</div>' : '') +
    '<div class="course-legend">🟢 сдан · 🔵 открыт · ⚪ пока закрыт. Коснись кружка, чтобы начать.</div>' +
    '</div>' +
    '<div class="trail" style="height:' + H + 'px">' +
    '<svg class="trail-svg" viewBox="0 0 100 ' + H + '" preserveAspectRatio="none">' +
    '<path d="' + d + '" fill="none" stroke="#9dc3e6" stroke-width="0.5" stroke-dasharray="0.8 2.2"/></svg>' +
    items + '</div>' +
    '<div class="footer-note">Финиш — за тобой! 🏁</div>';
  app.innerHTML = html;
  app.querySelectorAll('.circle').forEach(function (el) {
    el.addEventListener('click', function () { nodeClick(el.dataset.node); });
  });
  window.scrollTo(0, 0);
}

function nodeClick(id) {
  const n = NODES.find(function (x) { return x.id === id; });
  if (!n) return;
  if (n.kind !== 'topic') {
    toast(n.kind === 'kontur' ? '🗺️ Материалы контурной карты скоро появятся — пришли фото, и я их добавлю!' :
      n.kind === 'praktikum' ? '🎒 Материалы практической работы скоро появятся!' :
      n.kind === 'review' ? '📓 Этот узел повторения появится вместе с новыми параграфами.' :
      '📘 Материалы этого параграфа скоро появятся — пришли фото страниц!');
    return;
  }
  if (!n.topic) {
    toast('📘 Материалы этого параграфа скоро появятся!');
    return;
  }
  const st = nodeState(n);
  if (st === 'lock' && !isTeacher()) { toast('🔒 Сначала сдай предыдущий параграф!'); return; }
  showTopicCard(n);
}

function showTopicCard(n) {
  const t = n.topic;
  const p = progLoad();
  const best = (p.best || {})[t.id];
  const card = document.createElement('div');
  card.className = 'topic-pop';
  card.innerHTML =
    '<div class="topic-pop-card">' +
    '<button class="pop-close" id="popClose">✕</button>' +
    '<div class="pop-icon">' + t.icon + '</div>' +
    '<div class="pop-section">' + n.sectionIcon + ' ' + n.sectionTitle + (n.num ? ' · §' + n.num : '') + '</div>' +
    '<div class="pop-title">' + t.title + '</div>' +
    (best !== undefined
      ? '<div class="pop-best">Лучший результат: ' + best + '%</div>'
      : '<div class="pop-best">Ещё не пройден</div>') +
    '<div class="pop-btns">' +
    '<button class="big-btn" id="popBrowse">📖 Листать</button>' +
    '<button class="big-btn green" id="popTest">✅ Тест</button>' +
    '</div></div>';
  document.body.appendChild(card);
  card.addEventListener('click', function (ev) { if (ev.target === card) card.remove(); });
  document.getElementById('popClose').addEventListener('click', function () { card.remove(); });
  document.getElementById('popBrowse').addEventListener('click', function () { card.remove(); state.topic = t; state.page = 0; showPage(); });
  document.getElementById('popTest').addEventListener('click', function () { card.remove(); state.topic = t; startTest(); });
}

/* ============================================================
   МАРШРУТЫ ПУТЕШЕСТВЕННИКОВ (TRAVELERS) НА КАРТЕ МИРА
   ============================================================ */
function routePolylines(route) {
  /* Разбивает маршрут на отрезки-полилинии; сегменты, пересекающие
     180-й меридиан, разрезаются по краям карты. */
  const lines = [];
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1], b = route[i];
    let b0 = b[0];
    if (Math.abs(b0 - a[0]) > 180) b0 += b0 > a[0] ? -360 : 360;  // кратчайший путь
    if (b0 > 180 || b0 < -180) {
      const latM = (a[1] + b[1]) / 2;
      const edgeA = a[0] >= 0 ? 180 : -180;
      lines.push([a.slice(), [edgeA, latM]]);
      lines.push([[-edgeA, latM], [b[0], b[1]]]);
    } else {
      lines.push([a.slice(), [b0, b[1]]]);
    }
  }
  return lines;
}

function routeSvgMarkup() {
  let s = '<image href="assets/worldmap.png" x="0" y="0" width="1000" height="500"/>';
  MAP_REGIONS.forEach(function (r) {
    const pts = r.poly.map(function (p) { const c = project(p[0], p[1]); return c[0].toFixed(1) + ',' + c[1].toFixed(1); }).join(' ');
    s += '<polygon class="region ' + r.kind + '" points="' + pts + '" data-id="' + r.id + '" data-name="' + r.name + '"/>';
  });
  TRAVELERS.forEach(function (tr) {
    routePolylines(tr.route).forEach(function (ln) {
      const pts = ln.map(function (p) { const c = project(p[0], p[1]); return c[0].toFixed(1) + ',' + c[1].toFixed(1); }).join(' ');
      s += '<polyline class="route-line" data-traveler="' + tr.id + '" points="' + pts + '" stroke="' + tr.color + '" stroke-width="3.5" opacity="0.92"/>';
      s += '<polyline class="route-hit" data-traveler="' + tr.id + '" points="' + pts + '"/>';
    });
  });
  TRAVELERS.forEach(function (tr, idx) {
    const c = project(tr.badgeAt[0], tr.badgeAt[1]);
    s += '<g class="route-badge-g" data-traveler="' + tr.id + '">' +
      '<circle cx="' + c[0].toFixed(1) + '" cy="' + c[1].toFixed(1) + '" r="16" fill="' + tr.color + '" stroke="#fff" stroke-width="2.5"/>' +
      '<text x="' + c[0].toFixed(1) + '" y="' + (c[1] + 6).toFixed(1) + '" text-anchor="middle" class="route-badge">' + (idx + 1) + '</text></g>';
  });
  return s;
}

function routeMapSvg(id) {
  return '<div class="map-wrap"><svg id="' + id + '" viewBox="0 0 1000 500" preserveAspectRatio="xMidYMid meet">' + routeSvgMarkup() + '</svg></div>';
}

function travelerInfoHtml(tr) {
  return (tr.img ? '<img src="' + tr.img + '" alt="">' : '') +
    '<div class="ri-title"><span class="legend-num" style="background:' + tr.color + '">' + (TRAVELERS.indexOf(tr) + 1) + '</span> ' + tr.name + '</div>' +
    '<div class="ri-years">' + tr.voyage + ' · ' + tr.country + (tr.life ? ' · ' + tr.life : '') + '</div>' +
    '<div>' + tr.fact + '</div>';
}

function highlightRoute(svg, trId) {
  svg.querySelectorAll('.route-line').forEach(function (l) {
    l.classList.toggle('hl', l.dataset.traveler === trId);
  });
}

function bindRouteInteractions(root) {
  /* информационная карта на странице урока + легенда */
  const info = root.querySelector('#routeInfo');
  root.querySelectorAll('.route-hit, .route-badge-g').forEach(function (el) {
    el.addEventListener('click', function () {
      const tr = TRAVELERS.find(function (t) { return t.id === el.dataset.traveler; });
      if (!tr) return;
      const svg = root.querySelector('.map-wrap svg');
      if (svg) highlightRoute(svg, tr.id);
      root.querySelectorAll('.legend-row').forEach(function (r) {
        r.classList.toggle('sel', r.dataset.traveler === tr.id);
      });
      if (info) info.innerHTML = travelerInfoHtml(tr);
    });
  });
  root.querySelectorAll('.legend-row').forEach(function (row) {
    row.addEventListener('click', function () {
      const tr = TRAVELERS.find(function (t) { return t.id === row.dataset.traveler; });
      if (!tr) return;
      const svg = root.querySelector('.map-wrap svg');
      if (svg) highlightRoute(svg, tr.id);
      root.querySelectorAll('.legend-row').forEach(function (r) {
        r.classList.toggle('sel', r.dataset.traveler === tr.id);
      });
      if (info) info.innerHTML = travelerInfoHtml(tr);
    });
  });
}

function renderTravelerLegend() {
  return '<div class="route-legend">' + TRAVELERS.map(function (tr, idx) {
    return '<div class="legend-row" data-traveler="' + tr.id + '">' +
      '<span class="legend-num" style="background:' + tr.color + '">' + (idx + 1) + '</span>' +
      '<span><span class="legend-name">' + tr.name + '</span> · <span class="legend-voyage">' + tr.voyage + '</span><br>' +
      '<span class="legend-fact">' + tr.fact + '</span></span></div>';
  }).join('') + '</div>';
}

/* ============================================================
   ЭКРАН: ЛИСТАНИЕ СТРАНИЦ (стрелки вперёд-назад, без заданий)
   ============================================================ */
function renderBlock(b) {
  if (b.t === 'routemap') {
    return '<div class="map-hint">👆 Коснись линии маршрута или номера на карте — покажу путешественника.</div>' +
      routeMapSvg('routeMapSvg') +
      '<div class="route-info" id="routeInfo">Коснись любой линии на карте…</div>' +
      renderTravelerLegend();
  }
  if (b.t === 'legend') return renderTravelerLegend();
  if (b.t === 'p') return '<p class="page-p">' + termify(b.html) + '</p>';
  if (b.t === 'banner') return '<div class="banner">' + termify(b.text) + '</div>';
  if (b.t === 'list') return '<ul class="big-list">' + b.items.map(function (i) { return '<li>' + termify(i) + '</li>'; }).join('') + '</ul>';
  if (b.t === 'img') return '<figure class="page-fig"><img src="' + b.src + '" alt=""><figcaption>' + b.caption + '</figcaption></figure>';
  if (b.t === 'duo') return '<div class="duo">' + b.items.map(function (i) {
    return '<figure class="duo-item"><img src="' + i.img + '" alt=""><figcaption>' + i.caption + '</figcaption></figure>';
  }).join('') + '</div>';
  if (b.t === 'cards') return '<div class="cards">' + b.items.map(function (c, i) {
    const num = b.num ? '<div class="card-num">' + (i + 1) + '</div>' : '';
    return '<div class="card">' + num + '<div class="card-icon">' + c.icon + '</div><div class="card-title">' + c.title + '</div><div class="card-text">' + termify(c.text) + '</div></div>';
  }).join('') + '</div>';
  if (b.t === 'terms') return '<div class="cards">' + b.ids.map(function (id) {
    const g = GLOSSARY.find(function (x) { return x.id === id; });
    return '<div class="card term-card" data-term="' + id + '"><div class="card-icon">' + g.icon + '</div><div class="card-title">' + g.term + '</div><div class="card-text">' + g.def + '</div></div>';
  }).join('') + '</div>';
  if (b.t === 'quizlink') return '<div class="center"><button class="big-btn green xl" id="goTest">✅ Пройти тест</button></div>';
  return '';
}

function showPage() {
  const t = state.topic;
  state.view = 'browse';
  state.answered = false;
  const p = t.pages[state.page];
  setHeader(t.icon + ' ' + t.short + ' — страница ' + (state.page + 1) + ' из ' + t.pages.length, true);
  let html = '<div class="page"><h1 class="page-h">' + p.icon + ' ' + p.title + '</h1>';
  p.blocks.forEach(function (b) { html += renderBlock(b); });
  html += '</div>';
  html += '<div class="pager">' +
    '<button class="arrow" id="prevPage" ' + (state.page === 0 ? 'disabled' : '') + '>‹ Назад</button>' +
    '<div class="page-counter">Стр. ' + (state.page + 1) + ' из ' + t.pages.length + '</div>' +
    '<button class="arrow" id="nextPage" ' + (state.page === t.pages.length - 1 ? 'disabled' : '') + '>Вперёд ›</button>' +
    '</div>';
  app.innerHTML = html;
  bindTermLinks(app);
  bindRouteInteractions(app);
  app.querySelectorAll('.term-card').forEach(function (c) {
    c.addEventListener('click', function () { openGlossary(c.dataset.term); });
  });
  const gt = document.getElementById('goTest');
  if (gt) gt.addEventListener('click', startTest);
  document.getElementById('prevPage').addEventListener('click', function () { if (state.page > 0) { state.page--; showPage(); } });
  document.getElementById('nextPage').addEventListener('click', function () { if (state.page < t.pages.length - 1) { state.page++; showPage(); } });
  window.scrollTo(0, 0);
}

/* ============================================================
   ЭКРАН: ТЕСТ (+ подмешивание повторений)
   ============================================================ */
function startTest() {
  state.view = 'test';
  state.currentTopicId = state.topic.id;
  const p = progLoad();
  /* вопросы темы */
  const own = shuffle(state.topic.questions.slice());
  /* подмешиваем повторение из уже сданных тем (принцип Дуолинго) */
  const doneTopics = TOPICS.filter(function (t) {
    return t.id !== state.topic.id && t.questions.length && (p.done || {})[t.id];
  });
  let review = [];
  if (doneTopics.length) {
    const want = Math.min(5, Math.ceil(own.length / 6));
    review = shuffle(doneTopics.reduce(function (acc, t) { return acc.concat(t.questions); }, []))
      .slice(0, want)
      .map(function (q) { const c = Object.assign({}, q); c._review = true; return c; });
  }
  state.questions = shuffle(own.concat(review));
  state.qi = 0; state.score = 0; state.results = []; state.answered = false;
  renderQuestion();
}

function progressHtml() {
  const pct = Math.round(state.qi / state.questions.length * 100);
  return '<div class="progress"><div class="progress-fill" style="width:' + pct + '%"></div></div>' +
    '<div class="q-counter">Вопрос ' + (state.qi + 1) + ' из ' + state.questions.length + '</div>';
}

function termChip(id) {
  if (!id) return '';
  const g = GLOSSARY.find(function (x) { return x.id === id; });
  if (!g) return '';
  return '<button class="term-chip" data-term="' + id + '">' + g.icon + ' Термин: ' + g.term + '</button>';
}

function renderQuestion() {
  const q = state.questions[state.qi];
  state.answered = false;
  setHeader(state.topic.icon + ' Тест', true);
  let html = progressHtml();
  if (q._review) html += '<div class="review-badge">🔁 Повторение</div>';
  html += '<div class="q-card"><div class="q-text">' + termify(q.text) + '</div>' + termChip(q.term);

  if (q.type === 'choice') html += '<div class="options" id="optionsBox"></div>';
  else if (q.type === 'map') html += '<div class="map-hint">👆 Коснись нужного места на карте</div><div id="mapBox"></div>';
  else if (q.type === 'coord') html += '<div class="map-hint">👆 Коснись нужной точки на карте</div><div id="coordBox"></div>';
  else if (q.type === 'route') html += '<div class="map-hint">👆 Коснись нужной линии маршрута на карте</div><div id="routeBox"></div>';
  else if (q.type === 'compass') html += '<div id="compassBox"></div><div class="options dirs" id="optionsBox"></div>';
  else if (q.type === 'image') html += '<div class="duo clickable" id="imgBox"></div>';
  else if (q.type === 'match') html += '<div class="match-hint">👆 Коснись карточки слева, затем её пары справа. Пары одного цвета.</div><div id="matchBox"></div>';
  else if (q.type === 'sentence') html += '<div class="match-hint">👆 Коснись слов в нужном порядке — они соберутся в предложение.</div><div id="sentenceBox"></div>';
  else if (q.type === 'ordering') html += '<div class="match-hint">' + (q.timeline ? '🕐 От раннего к позднему:' : '👆 Коснись пунктов в правильном порядке:') + '</div><div id="orderingBox" class="' + (q.timeline ? 'timeline' : '') + '"></div>';
  else if (q.type === 'input') html += '<div id="inputBox"></div>';

  html += '<div id="feedback"></div></div>';
  app.innerHTML = html;
  bindTermLinks(app);

  if (q.type === 'choice') {
    const box = document.getElementById('optionsBox');
    shuffle(q.options.map(function (t, i) { return { t: t, correct: i === q.correct }; })).forEach(function (o) {
      const b = document.createElement('button');
      b.className = 'option';
      b.textContent = o.t;
      b.addEventListener('click', function () {
        if (state.answered) return;
        Array.prototype.forEach.call(box.children, function (x) {
          x.disabled = true;
          if (x.textContent === q.options[q.correct]) x.classList.add('ok');
        });
        if (!o.correct) b.classList.add('no');
        finishAnswer(o.correct, o.t, q.options[q.correct]);
      });
      box.appendChild(b);
    });
  } else if (q.type === 'map') renderMap(q);
  else if (q.type === 'coord') renderCoordQuestion(q);
  else if (q.type === 'route') renderRouteQuestion(q);
  else if (q.type === 'compass') renderCompass(q);
  else if (q.type === 'image') {
    const box = document.getElementById('imgBox');
    shuffle(q.images).forEach(function (im) {
      const f = document.createElement('figure');
      f.className = 'duo-item pick';
      f.innerHTML = '<img src="' + im.src + '" alt=""><figcaption>' + im.label + '</figcaption>';
      f.addEventListener('click', function () {
        if (state.answered) return;
        Array.prototype.forEach.call(box.children, function (x) {
          if (x === f) x.classList.add(!!im.correct ? 'ok' : 'no');
          else if (x.querySelector('img').getAttribute('src') === q.images.find(function (i2) { return i2.correct; }).src) x.classList.add('ok');
        });
        finishAnswer(!!im.correct, im.name, q.correctText);
      });
      box.appendChild(f);
    });
  } else if (q.type === 'match') renderMatch(q);
  else if (q.type === 'sentence') renderSentence(q);
  else if (q.type === 'ordering') renderOrdering(q);
  else if (q.type === 'input') renderInput(q);
  window.scrollTo(0, 0);
}

function finishAnswer(ok, chosenText, correctText) {
  if (state.answered) return;
  state.answered = true;
  const q = state.questions[state.qi];
  state.results.push({ text: q.text, ok: ok, correctText: correctText, explain: q.explain });
  if (ok) state.score++;
  showFeedback(ok, chosenText, correctText, q.explain, q.term);
}

function showFeedback(ok, chosenText, correctText, explain, termId) {
  const fb = document.getElementById('feedback');
  const last = state.qi === state.questions.length - 1;
  const q = state.questions[state.qi];
  if (q.type === 'compass' && q._correctName) {
    explain = explain.replace('{dir}', q._correctName.toLowerCase());
  }
  fb.innerHTML =
    '<div class="verdict ' + (ok ? 'ok' : 'no') + '">' + (ok ? '🎉 Верно!' : '🤔 Неверно. Правильный ответ: ' + correctText) + '</div>' +
    '<div class="explain">' + termify(explain) + '</div>' +
    (termId && !ok ? termChip(termId) : '') +
    '<div class="center"><button class="big-btn green" id="nextQ">' + (last ? '🏁 К результатам' : 'Далее →') + '</button></div>';
  bindTermLinks(fb);
  const chip = fb.querySelector('.term-chip');
  if (chip) chip.addEventListener('click', function () { openGlossary(termId); });
  document.getElementById('nextQ').addEventListener('click', function () {
    if (last) showResult();
    else { state.qi++; renderQuestion(); }
  });
  fb.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/* ---------- тип: СОВМЕЩЕНИЕ (пары) ---------- */
const PAIR_COLORS = ['#38a169', '#3182ce', '#d69e2e', '#805ad5', '#e53e3e', '#dd6b20', '#319795'];
function renderMatch(q) {
  const box = document.getElementById('matchBox');
  const left = shuffle(q.pairs.map(function (p, i) { return { text: p[0], pi: i }; }));
  const right = shuffle(q.pairs.map(function (p, i) { return { text: p[1], pi: i }; }));
  const linked = {};   // li -> ri
  const riToLi = {};   // ri -> li
  let selectedLi = null;
  box.innerHTML =
    '<div class="match-cols">' +
    '<div class="match-col" id="matchLeft">' + left.map(function (l, li) {
      return '<button class="match-item" data-li="' + li + '">' + l.text + '</button>';
    }).join('') + '</div>' +
    '<div class="match-col" id="matchRight">' + right.map(function (r, ri) {
      return '<button class="match-item" data-ri="' + ri + '">' + r.text + '</button>';
    }).join('') + '</div></div>' +
    '<div class="center"><button class="big-btn green" id="matchCheck" disabled>✔ Проверить</button></div>';

  function repaint() {
    box.querySelectorAll('.match-item').forEach(function (el) {
      el.style.removeProperty('background-color');
      el.style.removeProperty('border-color');
      el.classList.remove('matched', 'selected');
    });
    Object.keys(linked).forEach(function (k) {
      const li = Number(k), ri = linked[li];
      const color = PAIR_COLORS[li % PAIR_COLORS.length];
      const lEl = box.querySelector('[data-li="' + li + '"]');
      const rEl = box.querySelector('[data-ri="' + ri + '"]');
      if (lEl) { lEl.classList.add('matched'); lEl.style.backgroundColor = color; lEl.style.borderColor = color; }
      if (rEl) { rEl.classList.add('matched'); rEl.style.backgroundColor = color; rEl.style.borderColor = color; }
    });
    if (selectedLi !== null) {
      const el = box.querySelector('[data-li="' + selectedLi + '"]');
      if (el) el.classList.add('selected');
    }
    document.getElementById('matchCheck').disabled = Object.keys(linked).length !== left.length;
  }
  box.querySelector('#matchLeft').addEventListener('click', function (ev) {
    const el = ev.target.closest('.match-item');
    if (!el || state.answered) return;
    const li = Number(el.dataset.li);
    if (linked[li] !== undefined) {          // отвязать пару
      const ri = linked[li];
      delete linked[li]; delete riToLi[ri];
      selectedLi = null; repaint(); return;
    }
    selectedLi = (selectedLi === li) ? null : li;
    repaint();
  });
  box.querySelector('#matchRight').addEventListener('click', function (ev) {
    const el = ev.target.closest('.match-item');
    if (!el || state.answered) return;
    const ri = Number(el.dataset.ri);
    if (riToLi[ri] !== undefined) {          // отвязать
      const li = riToLi[ri];
      delete linked[li]; delete riToLi[ri];
      repaint(); return;
    }
    if (selectedLi === null) { toast('Сначала выбери карточку слева 👆'); return; }
    linked[selectedLi] = ri; riToLi[ri] = selectedLi;
    selectedLi = null; repaint();
  });
  document.getElementById('matchCheck').addEventListener('click', function () {
    if (state.answered) return;
    let ok = true;
    Object.keys(linked).forEach(function (k) {
      const li = Number(k), ri = linked[li];
      const good = left[li].pi === right[ri].pi;
      const color = good ? '#38a169' : '#e53e3e';
      box.querySelector('[data-li="' + li + '"]').style.borderColor = color;
      box.querySelector('[data-ri="' + ri + '"]').style.borderColor = color;
      if (!good) ok = false;
    });
    finishAnswer(ok, '', q.correctText);
  });
}

/* ---------- тип: СОБЕРИ ПРЕДЛОЖЕНИЕ ---------- */
function renderSentence(q) {
  const box = document.getElementById('sentenceBox');
  const pool = shuffle(q.words.map(function (w, i) { return { w: w, id: i }; }));
  const slots = q.words.map(function () { return null; });
  box.innerHTML =
    '<div class="slots sent" id="sentSlots"></div>' +
    '<div class="word-pool" id="sentPool"></div>' +
    '<div class="center"><button class="big-btn green" id="sentCheck" disabled>✔ Проверить</button></div>';
  const slotsEl = box.querySelector('#sentSlots');
  const poolEl = box.querySelector('#sentPool');

  function repaint() {
    slotsEl.innerHTML = slots.map(function (s, i) {
      return '<span class="slot ' + (s !== null ? 'filled' : '') + '" data-slot="' + i + '">' + (s !== null ? s.w : '&nbsp;&nbsp;&nbsp;') + '</span>';
    }).join(' ');
    const used = {};
    slots.forEach(function (s) { if (s !== null) used[s.id] = true; });
    poolEl.innerHTML = pool.filter(function (p) { return !used[p.id]; }).map(function (p) {
      return '<button class="word-chip" data-wid="' + p.id + '">' + p.w + '</button>';
    }).join('') || '<span class="pool-empty">Все слова разложены — жми «Проверить»!</span>';
    document.getElementById('sentCheck').disabled = slots.some(function (s) { return s === null; });
  }
  poolEl.addEventListener('click', function (ev) {
    const el = ev.target.closest('.word-chip');
    if (!el || state.answered) return;
    const item = pool.find(function (p) { return p.id === Number(el.dataset.wid); });
    const free = slots.indexOf(null);
    if (free >= 0) slots[free] = item;
    repaint();
  });
  slotsEl.addEventListener('click', function (ev) {
    const el = ev.target.closest('.slot');
    if (!el || state.answered) return;
    const i = Number(el.dataset.slot);
    if (slots[i] !== null) slots[i] = null;
    repaint();
  });
  document.getElementById('sentCheck').addEventListener('click', function () {
    if (state.answered) return;
    const built = slots.map(function (s) { return s.w; }).join(' ');
    const ok = built === q.words.join(' ');
    slotsEl.classList.add(ok ? 'all-ok' : 'all-no');
    finishAnswer(ok, built, q.correctText);
  });
  repaint();
}

/* ---------- тип: ПОСЛЕДОВАТЕЛЬНОСТЬ / ЛЕНТА ВРЕМЕНИ ---------- */
function renderOrdering(q) {
  const box = document.getElementById('orderingBox');
  const pool = shuffle(q.items.map(function (w, i) { return { w: w, id: i }; }));
  const slots = q.items.map(function () { return null; });
  const isTime = !!q.timeline;
  box.innerHTML =
    '<div class="order-slots ' + (isTime ? 'timeline' : '') + '" id="ordSlots">' +
    slots.map(function (_, i) {
      return '<div class="order-slot" data-slot="' + i + '">' +
        '<span class="order-num">' + (isTime ? (i === 0 ? 'раньше ↓' : i === slots.length - 1 ? 'позже ↓' : '↓') : (i + 1) + '.') + '</span>' +
        '<span class="order-body" data-body="' + i + '">&nbsp;</span></div>';
    }).join('') + '</div>' +
    '<div class="word-pool vertical" id="ordPool"></div>' +
    '<div class="center"><button class="big-btn green" id="ordCheck" disabled>✔ Проверить</button></div>';
  const poolEl = box.querySelector('#ordPool');

  function bodyHtml(w) {
    if (isTime) {
      const m = w.split(' — ');
      if (m.length > 1) return '<b class="year-badge">' + m[0] + '</b>' + m.slice(1).join(' — ');
    }
    return w;
  }
  function repaint() {
    slots.forEach(function (s, i) {
      const body = box.querySelector('[data-body="' + i + '"]');
      const slotEl = box.querySelector('[data-slot="' + i + '"]');
      if (s === null) { body.innerHTML = '&nbsp;'; slotEl.classList.remove('filled'); }
      else { body.innerHTML = bodyHtml(s.w); slotEl.classList.add('filled'); }
    });
    const used = {};
    slots.forEach(function (s) { if (s !== null) used[s.id] = true; });
    poolEl.innerHTML = pool.filter(function (p) { return !used[p.id]; }).map(function (p) {
      return '<button class="word-chip wide" data-wid="' + p.id + '">' + bodyHtml(p.w) + '</button>';
    }).join('') || '<span class="pool-empty">Все карточки на месте — жми «Проверить»!</span>';
    document.getElementById('ordCheck').disabled = slots.some(function (s) { return s === null; });
  }
  poolEl.addEventListener('click', function (ev) {
    const el = ev.target.closest('.word-chip');
    if (!el || state.answered) return;
    const item = pool.find(function (p) { return p.id === Number(el.dataset.wid); });
    const free = slots.indexOf(null);
    if (free >= 0) slots[free] = item;
    repaint();
  });
  box.querySelector('#ordSlots').addEventListener('click', function (ev) {
    const el = ev.target.closest('.order-slot');
    if (!el || state.answered) return;
    const i = Number(el.dataset.slot);
    if (slots[i] !== null) slots[i] = null;
    repaint();
  });
  document.getElementById('ordCheck').addEventListener('click', function () {
    if (state.answered) return;
    let ok = true;
    slots.forEach(function (s, i) {
      const good = s.id === i;
      box.querySelector('[data-slot="' + i + '"]').classList.add(good ? 'row-ok' : 'row-no');
      if (!good) ok = false;
    });
    finishAnswer(ok, '', q.correctText);
  });
  repaint();
}

/* ---------- тип: ВВЕДИ ОТВЕТ ---------- */
function renderInput(q) {
  const box = document.getElementById('inputBox');
  box.innerHTML =
    '<div class="input-row">' +
    '<input id="inputField" class="answer-input" type="text" autocomplete="off" placeholder="Впиши ответ…">' +
    '<button class="big-btn green" id="inputCheck">✔ Проверить</button></div>';
  const field = document.getElementById('inputField');
  document.getElementById('inputCheck').addEventListener('click', function () {
    if (state.answered) return;
    const val = norm(field.value);
    if (!val) { toast('Сначала впиши ответ ✍️'); return; }
    const ok = q.accept.map(norm).indexOf(val) >= 0;
    field.disabled = true;
    field.classList.add(ok ? 'inp-ok' : 'inp-no');
    finishAnswer(ok, field.value, q.accept[0]);
  });
  field.addEventListener('keydown', function (ev) {
    if (ev.key === 'Enter') document.getElementById('inputCheck').click();
  });
}

/* ---------- интерактивная контурная карта ---------- */
function project(lon, lat) {
  // карта точно равнопромежуточная: 180°з..180°в / 90°с..90°ю -> viewBox 1000x500
  return [ (lon + 180) / 360 * 1000, (90 - lat) / 180 * 500 ];
}
function renderMap(q) {
  const box = document.getElementById('mapBox');
  let polys = '';
  MAP_REGIONS.forEach(function (r) {
    const pts = r.poly.map(function (p) { const c = project(p[0], p[1]); return c[0].toFixed(1) + ',' + c[1].toFixed(1); }).join(' ');
    polys += '<polygon class="region ' + r.kind + '" points="' + pts + '" data-id="' + r.id + '" data-name="' + r.name + '"/>';
  });
  box.innerHTML = '<div class="map-wrap"><svg id="mapSvg" viewBox="0 0 1000 500" preserveAspectRatio="xMidYMid meet">' +
    '<image href="assets/worldmap.png" x="0" y="0" width="1000" height="500"/>' +
    polys + '</svg></div>';
  const svg = document.getElementById('mapSvg');
  svg.addEventListener('click', function (ev) {
    const t = ev.target;
    if (!t.classList || !t.classList.contains('region')) return;
    if (state.answered) return;
    const targets = Array.isArray(q.target) ? q.target : [q.target];
    const ok = targets.indexOf(t.dataset.id) >= 0;
    const chosen = t.dataset.name;
    const target = MAP_REGIONS.find(function (r) { return r.id === targets[0]; });
    t.classList.add(ok ? 'hit-ok' : 'hit-no');
    if (!ok) {
      targets.forEach(function (tid) {
        const tp = svg.querySelector('[data-id="' + tid + '"]');
        if (tp) tp.classList.add('hit-ok');
      });
    }
    svg.querySelectorAll('.region').forEach(function (p) { p.style.pointerEvents = 'none'; });
    finishAnswer(ok, chosen, target.name);
  });
}

/* ---------- тип: ТОЧКА ПО КООРДИНАТАМ ---------- */
function gridSvgMarkup() {
  let s = '<image href="assets/worldmap.png" x="0" y="0" width="1000" height="500"/>';
  /* градусная сетка: линии через каждые 30°, экватор и нулевой меридиан выделены */
  for (let lon = -150; lon <= 150; lon += 30) {
    const x = project(lon, 0)[0];
    s += '<line x1="' + x + '" y1="0" x2="' + x + '" y2="500" stroke="' + (lon === 0 ? '#2b6cb0' : '#8fa8c8') + '" stroke-width="' + (lon === 0 ? 3 : 1.5) + '" opacity="' + (lon === 0 ? 0.9 : 0.5) + '" stroke-dasharray="' + (lon === 0 ? 'none' : '8 6') + '"/>';
    s += '<text x="' + (x + 6) + '" y="490" class="grid-label">' + Math.abs(lon) + '°' + (lon === 0 ? '' : lon > 0 ? 'в' : 'з') + '</text>';
  }
  for (let lat = -60; lat <= 60; lat += 30) {
    const y = project(0, lat)[1];
    s += '<line x1="0" y1="' + y + '" x2="1000" y2="' + y + '" stroke="' + (lat === 0 ? '#2b6cb0' : '#8fa8c8') + '" stroke-width="' + (lat === 0 ? 3 : 1.5) + '" opacity="' + (lat === 0 ? 0.9 : 0.5) + '" stroke-dasharray="' + (lat === 0 ? 'none' : '8 6') + '"/>';
    s += '<text x="8" y="' + (y - 6) + '" class="grid-label">' + Math.abs(lat) + '°' + (lat === 0 ? '' : lat > 0 ? 'с' : 'ю') + '</text>';
  }
  return s;
}

function renderCoordQuestion(q) {
  const box = document.getElementById('coordBox');
  box.innerHTML = '<div class="map-wrap"><svg id="coordSvg" viewBox="0 0 1000 500" preserveAspectRatio="xMidYMid meet">' +
    gridSvgMarkup() + '<rect class="coord-tap" x="0" y="0" width="1000" height="500" fill="transparent"/></svg></div>';
  const svg = document.getElementById('coordSvg');
  const tol = q.tol || 30;                                  /* допуск в единицах viewBox (1 ед. ≈ 0,36°) */
  svg.querySelector('.coord-tap').addEventListener('click', function (ev) {
    if (state.answered) return;
    const rect = svg.getBoundingClientRect();
    const vx = (ev.clientX - rect.left) / rect.width * 1000;
    const vy = (ev.clientY - rect.top) / rect.height * 500;
    const [tx, ty] = project(q.target[0], q.target[1]);
    const ok = Math.hypot(vx - tx, vy - ty) <= tol;
    const marks = '<circle cx="' + vx.toFixed(1) + '" cy="' + vy.toFixed(1) + '" r="10" fill="' + (ok ? '#38a169' : '#e53e3e') + '" stroke="#fff" stroke-width="3"/>' +
      '<circle cx="' + tx.toFixed(1) + '" cy="' + ty.toFixed(1) + '" r="12" fill="none" stroke="#38a169" stroke-width="4"/>' +
      '<circle cx="' + tx.toFixed(1) + '" cy="' + ty.toFixed(1) + '" r="5" fill="#38a169"/>';
    svg.insertAdjacentHTML('beforeend', marks);
    svg.querySelector('.coord-tap').style.pointerEvents = 'none';
    finishAnswer(ok, Math.round(vx / 1000 * 360 - 180) + '° / ' + Math.round(90 - vy / 500 * 180) + '°', q.correctText);
  });
}

/* ---------- тип: МАРШРУТ ПУТЕШЕСТВЕННИКА ---------- */
function renderRouteQuestion(q) {
  const box = document.getElementById('routeBox');
  box.innerHTML = routeMapSvg('routeQSvg');
  const svg = document.getElementById('routeQSvg');
  svg.querySelectorAll('.route-hit, .route-badge-g').forEach(function (el) {
    el.addEventListener('click', function () {
      if (state.answered) return;
      const tr = TRAVELERS.find(function (t) { return t.id === el.dataset.traveler; });
      if (!tr) return;
      const ok = tr.id === q.target;
      svg.querySelectorAll('.route-line').forEach(function (l) {
        const good = l.dataset.traveler === q.target;
        if (good || l.dataset.traveler === tr.id) {
          l.classList.add('hl');
          l.setAttribute('stroke', good ? '#38a169' : '#e53e3e');
          l.setAttribute('opacity', '1');
        }
      });
      svg.querySelectorAll('.route-hit').forEach(function (h) { h.style.pointerEvents = 'none'; h.style.display = 'none'; });
      finishAnswer(ok, tr.name, q.correctText);
    });
  });
}

/* ---------- интерактивный компас ---------- */
function renderCompass(q) {
  const box = document.getElementById('compassBox');
  const deg = [0, 90, 180, 270][Math.floor(Math.random() * 4)];
  box.innerHTML =
    '<div class="compass-wrap">' +
    '<svg viewBox="0 0 200 200" class="compass-svg">' +
    '<circle cx="100" cy="100" r="92" fill="#fdf6e3" stroke="#8d6e63" stroke-width="4"/>' +
    '<circle cx="100" cy="100" r="78" fill="none" stroke="#d7ccc8" stroke-width="2"/>' +
    Array.from({length: 24}, function (_, i) {
      const a = i * 15 * Math.PI / 180;
      const r1 = 86, r2 = i % 6 === 0 ? 74 : 80;
      return '<line x1="' + (100 + r1 * Math.sin(a)) + '" y1="' + (100 - r1 * Math.cos(a)) + '" x2="' + (100 + r2 * Math.sin(a)) + '" y2="' + (100 - r2 * Math.cos(a)) + '" stroke="#a1887f" stroke-width="2"/>';
    }).join('') +
    '<text x="100" y="38" text-anchor="middle" class="compass-letter">С</text>' +
    '<text x="168" y="108" text-anchor="middle" class="compass-letter">В</text>' +
    '<text x="100" y="176" text-anchor="middle" class="compass-letter">Ю</text>' +
    '<text x="32" y="108" text-anchor="middle" class="compass-letter">З</text>' +
    '<g id="needle" style="transform-origin:100px 100px; transform:rotate(' + deg + 'deg); transition: transform 1.2s ease;">' +
    '<polygon points="100,30 112,100 88,100" fill="#e53935"/>' +
    '<polygon points="100,170 112,100 88,100" fill="#90a4ae"/>' +
    '<circle cx="100" cy="100" r="9" fill="#6d4c41" stroke="#4e342e" stroke-width="2"/>' +
    '</g></svg></div>';
  const box2 = document.getElementById('optionsBox');
  const names = ['С', 'В', 'Ю', 'З'];
  const full = ['Север', 'Восток', 'Юг', 'Запад'];
  const correctIdx = deg / 90;
  q._correctName = full[correctIdx];
  names.forEach(function (n, i) {
    const b = document.createElement('button');
    b.className = 'option dir-btn';
    b.innerHTML = '<span class="dir-letter">' + n + '</span> ' + full[i];
    b.addEventListener('click', function () {
      if (state.answered) return;
      Array.prototype.forEach.call(box2.children, function (x) { x.disabled = true; });
      box2.children[correctIdx].classList.add('ok');
      if (i !== correctIdx) b.classList.add('no');
      finishAnswer(i === correctIdx, full[i], q._correctName);
    });
    box2.appendChild(b);
  });
}

/* ============================================================
   ЭКРАН: РЕЗУЛЬТАТЫ (+ звёзды и открытие следующего параграфа)
   ============================================================ */
function showResult() {
  state.view = 'result';
  const total = state.questions.length;
  const pct = Math.round(state.score / total * 100);
  const res = markDone(state.currentTopicId, pct);
  let face, word;
  if (pct >= 90) { face = '🏆'; word = 'Отлично! Ты отлично знаешь тему!'; }
  else if (pct >= 70) { face = '👍'; word = 'Хорошо! Ещё чуть-чуть — и будет отлично.'; }
  else if (pct >= 50) { face = '🙂'; word = 'Неплохо! Полистай страницы урока и попробуй снова.'; }
  else { face = '📚'; word = 'Полистай страницы урока, загляни в словарь и пройди тест ещё раз.'; }
  let html = '<div class="result-card">' +
    '<div class="result-face">' + face + '</div>' +
    '<div class="result-score">Правильных ответов: ' + state.score + ' из ' + total + ' (' + pct + '%)</div>' +
    '<div class="result-word">' + word + '</div>' +
    (res.first ? '<div class="result-unlock">🎉 Следующий параграф открыт!</div>' : '') +
    '</div>';
  const wrong = state.results.filter(function (r) { return !r.ok; });
  if (wrong.length) {
    html += '<h2 class="result-h">Разбор ошибок</h2>';
    wrong.forEach(function (r) {
      html += '<div class="mistake"><div class="mistake-q">' + r.text + '</div>' +
        '<div class="mistake-a">✅ Правильный ответ: <b>' + r.correctText + '</b></div>' +
        '<div class="mistake-e">' + termify(r.explain) + '</div></div>';
    });
  }
  html += '<div class="center row-btns">' +
    '<button class="big-btn green" id="againBtn">🔁 Пройти заново</button>' +
    '<button class="big-btn" id="browseBtn">📖 Полистать страницы</button>' +
    '<button class="big-btn" id="homeBtn">🗺 На тропу уроков</button></div>';
  app.innerHTML = html;
  bindTermLinks(app);
  document.getElementById('againBtn').addEventListener('click', startTest);
  document.getElementById('browseBtn').addEventListener('click', function () { state.page = 0; showPage(); });
  document.getElementById('homeBtn').addEventListener('click', renderCourse);
  window.scrollTo(0, 0);
}

/* ============================================================
   СЛОВАРЬ (модальное окно, доступно с любого экрана)
   ============================================================ */
const modal = document.getElementById('glossaryModal');

function openGlossary(termId) {
  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  renderGlossary(termId);
}
function closeGlossary() {
  modal.classList.add('hidden');
  document.body.style.overflow = '';
}

function renderGlossary(highlightId) {
  const search = document.getElementById('glossSearch');
  if (highlightId) search.value = '';
  const q = (search.value || '').trim().toLowerCase();
  const list = document.getElementById('glossList');
  const items = GLOSSARY.filter(function (g) {
    return !q || g.term.toLowerCase().includes(q) || g.def.toLowerCase().includes(q);
  });
  list.innerHTML = items.map(function (g) {
    return '<div class="gloss-item' + (g.id === highlightId ? ' gloss-active' : '') + '" id="gl-' + g.id + '">' +
      '<div class="gloss-term">' + g.icon + ' ' + g.term + '</div>' +
      '<div class="gloss-def">' + g.def + '</div></div>';
  }).join('') || '<div class="gloss-empty">Ничего не нашлось. Попробуй другое слово.</div>';
  const elx = document.getElementById('gl-' + highlightId);
  if (elx) elx.scrollIntoView({ block: 'center' });
}

btnGlossary.addEventListener('click', function () { openGlossary(); });
document.getElementById('glossClose').addEventListener('click', closeGlossary);
document.getElementById('glossSearch').addEventListener('input', function () { renderGlossary(); });
modal.addEventListener('click', function (ev) { if (ev.target === modal) closeGlossary(); });
document.addEventListener('keydown', function (ev) {
  if (ev.key === 'Escape') {
    closeGlossary();
    const pop = document.querySelector('.topic-pop');
    if (pop) pop.remove();
  }
  if (state.view === 'browse' && document.getElementById('glossaryModal').classList.contains('hidden')) {
    if (ev.key === 'ArrowLeft') document.getElementById('prevPage').click();
    if (ev.key === 'ArrowRight') document.getElementById('nextPage').click();
  }
});

/* ---------- режим учителя: окно входа ---------- */
const btnTeacher = document.getElementById('btnTeacher');
const TEACHER_PASSWORD = 'magratea';

function showTeacherModal() {
  const old = document.querySelector('.topic-pop');
  if (old) old.remove();
  const card = document.createElement('div');
  card.className = 'topic-pop';
  const on = isTeacher();
  card.innerHTML =
    '<div class="topic-pop-card">' +
    '<button class="pop-close" id="tClose">✕</button>' +
    '<div class="pop-icon">🎓</div>' +
    '<div class="pop-title">Режим учителя</div>' +
    (on
      ? '<div class="pop-best">Включён: все параграфы открыты, можно листать уроки в любом порядке без тестов.</div>' +
        '<div class="pop-btns"><button class="big-btn" id="tOff">Выключить</button></div>'
      : '<div class="pop-best">Введите пароль, чтобы открыть все параграфы для свободного просмотра.</div>' +
        '<div class="pop-btns">' +
        '<input id="tPass" class="answer-input" type="password" placeholder="Пароль…" autocomplete="off">' +
        '<button class="big-btn green" id="tOk">Войти</button></div>'
    ) +
    '</div>';
  document.body.appendChild(card);
  card.addEventListener('click', function (ev) { if (ev.target === card) card.remove(); });
  document.getElementById('tClose').addEventListener('click', function () { card.remove(); });
  const input = document.getElementById('tPass');
  if (input) {
    const tryPass = function () {
      if (norm(input.value) === TEACHER_PASSWORD) {
        setTeacher(true);
        card.remove();
        toast('🎓 Режим учителя включён — все параграфы открыты!');
        renderCourse();
      } else {
        toast('Неверный пароль 🤔');
        input.value = '';
        input.focus();
      }
    };
    document.getElementById('tOk').addEventListener('click', tryPass);
    input.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') tryPass(); });
    setTimeout(function () { input.focus(); }, 60);
  }
  const off = document.getElementById('tOff');
  if (off) off.addEventListener('click', function () {
    setTeacher(false);
    card.remove();
    toast('Режим учителя выключен');
    renderCourse();
  });
}
btnTeacher.addEventListener('click', showTeacherModal);

btnHome.addEventListener('click', renderCourse);

/* старт: карта курса */
renderCourse();
