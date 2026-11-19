/* ============================================================
   VocabLens 词镜 · 应用逻辑
   纯前端 · 无构建依赖 · 数据来自 window.GROUPS
   ============================================================ */
(function () {
  'use strict';

  var GROUPS = (window.GROUPS || []).filter(function (g) { return g && g.id && g.notes && g.words; });
  var BY_ID = Object.create(null);
  GROUPS.forEach(function (g) { BY_ID[g.id] = g; });

  /* ---------------- 工具 ---------------- */
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function escapeRe(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function load(key, fb) { try { var raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fb; } catch (e) { return fb; } }
  function save(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) {} }
  function pad(n) { return String(n).padStart(2, '0'); }
  function todayKey() { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }

  /* ---------------- 状态 ---------------- */
  var state = {
    view: 'search',
    query: '',
    category: 'all',
    favorites: new Set(load('vocablens.favorites', [])),
    mastered: new Set(load('vocablens.mastered', [])),
    today: load('vocablens.today', { date: '', ids: [] }),
    studyIndex: 0,
    studyOnlyNew: false,
    studyFlipped: false,
    quiz: null,
    sheetId: null,
    lastFocus: null
  };
  if (state.today.date !== todayKey()) state.today = { date: todayKey(), ids: [] };

  /* ---------------- 分类与色相 ---------------- */
  var CATS = (function () {
    var seen = {}, out = [];
    GROUPS.forEach(function (g) { if (!seen[g.category]) { seen[g.category] = 1; out.push(g.category); } });
    return out.sort(function (a, b) { return a.localeCompare(b, 'zh-Hans-CN'); });
  })();

  var PALETTE = [258, 192, 32, 338, 152, 218, 276, 8, 168, 46, 300, 200, 246, 128];
  var HUE = {};
  CATS.forEach(function (c, i) {
    var base = PALETTE[i % PALETTE.length];
    var cycle = Math.floor(i / PALETTE.length);
    HUE[c] = (base + cycle * 24) % 360;
  });
  function hue(cat) { return HUE[cat] === undefined ? 258 : HUE[cat]; }

  /* ---------------- DOM ---------------- */
  var content = $('#content');
  var sheet = $('#sheet');
  var scrim = $('#scrim');
  var toastEl = $('#toast');
  var searchInput = $('#searchInput');
  var searchField = $('#searchField');
  var clearBtn = $('#clearBtn');
  var chipRow = $('#categoryChips');
  var favBadge = $('#favBadge');
  var favDot = $('#favDot');
  var statToday = $('#statToday');
  var topStats = $('#topStats');

  /* ---------------- 提示 ---------------- */
  var toastTimer;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 2200);
  }

  /* ---------------- 朗读 ---------------- */
  function speak(text) {
    if (!('speechSynthesis' in window)) { toast('当前浏览器不支持朗读'); return; }
    try {
      window.speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(text);
      u.lang = 'en-US';
      u.rate = 0.92;
      u.pitch = 1;
      window.speechSynthesis.speak(u);
    } catch (e) { toast('朗读失败'); }
  }

  /* ---------------- 搜索 ---------------- */
  function terms() {
    return state.query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  }

  function haystack(g) {
    if (!g._hay) {
      var parts = [g.category, g.summary, g.choiceTip, g.pitfall].concat(g.tags || []);
      (g.notes || []).forEach(function (n) {
        parts.push(n.word, n.meaning, n.nuance, n.example, n.translation);
      });
      g._hay = parts.join(' ').toLowerCase();
    }
    return g._hay;
  }

  function scoreGroup(g, ts) {
    var words = g.words.map(function (w) { return w.toLowerCase(); });
    var score = 0;
    var matchedAll = true;
    for (var i = 0; i < ts.length; i++) {
      var t = ts[i];
      var hit = 0;
      if (words.indexOf(t) >= 0) hit = 100;
      else if (words.some(function (w) { return w.indexOf(t) === 0; })) hit = 70;
      else if ((g.tags || []).some(function (x) { return x.toLowerCase().indexOf(t) >= 0; })) hit = 45;
      else if (g.category.toLowerCase().indexOf(t) >= 0) hit = 40;
      else if (haystack(g).indexOf(t) >= 0) hit = 20;
      if (!hit) { matchedAll = false; break; }
      score += hit;
    }
    return matchedAll ? score : 0;
  }

  function searchGroups() {
    var ts = terms();
    var pool = GROUPS;
    if (state.category !== 'all') {
      pool = pool.filter(function (g) { return g.category === state.category; });
    }
    if (!ts.length) return pool;
    var scored = [];
    pool.forEach(function (g) {
      var s = scoreGroup(g, ts);
      if (s > 0) scored.push({ g: g, s: s });
    });
    scored.sort(function (a, b) { return b.s - a.s || a.g.id.localeCompare(b.g.id); });
    return scored.map(function (x) { return x.g; });
  }

  function hl(text, ts) {
    var out = esc(text);
    if (!ts || !ts.length) return out;
    var pat = ts.slice().sort(function (a, b) { return b.length - a.length; })
      .map(escapeRe).filter(function (p) { return p.length; }).join('|');
    if (!pat) return out;
    try {
      return out.replace(new RegExp('(' + pat + ')', 'gi'), '<mark class="hl">$1</mark>');
    } catch (e) { return out; }
  }

  /* ---------------- 卡片渲染 ---------------- */
  function speakBtn(text, label) {
    return '<button class="speak-btn" data-speak="' + esc(text) + '" aria-label="朗读 ' + esc(label || text) + '" title="朗读">' +
      '<svg class="ic" aria-hidden="true"><use href="#i-sound"/></svg></button>';
  }

  function groupCard(g, idx, ts) {
    var h = hue(g.category);
    var fav = state.favorites.has(g.id);
    var notes = (g.notes || []).slice(0, 2);
    var words = g.words.map(function (w) {
      return '<span class="word-pill' + (g.lexicalType === 'phrase' ? ' is-phrase' : '') + '">' + hl(w, ts) + '</span>';
    }).join('<span class="word-sep">/</span>');

    var examples = notes.map(function (n) {
      return '<div class="gc-ex"><b>' + hl(n.word, ts) + '</b><span>' + hl(n.example, ts) + '</span></div>';
    }).join('');

    var tags = (g.tags || []).slice(0, 2).map(function (t) {
      return '<span class="tag">' + hl(t, ts) + '</span>';
    }).join('');

    return '<article class="group-card" style="--cat-h:' + h + '" data-card="' + g.id + '">' +
      '<div class="gc-top">' +
        '<span class="gc-num">' + (idx + 1) + '</span>' +
        '<span class="gc-cat"><svg class="ic" aria-hidden="true"><use href="#i-tag"/></svg>' + esc(g.category) + '</span>' +
        '<span class="gc-spacer"></span>' +
        speakBtn(g.words.join(', '), g.words.join('、')) +
        '<button class="gc-fav" data-fav="' + g.id + '" aria-pressed="' + fav + '" aria-label="' + (fav ? '取消收藏' : '收藏') + ' ' + esc(g.words.join('、')) + '">' +
          '<svg class="ic" aria-hidden="true"><use href="#' + (fav ? '#i-bookmark-fill' : '#i-bookmark') + '"/></svg>' +
        '</button>' +
      '</div>' +
      '<button class="gc-body" data-open="' + g.id + '" aria-label="查看 ' + esc(g.words.join('、')) + ' 的详细辨析">' +
        '<div class="gc-words">' + words + '</div>' +
        '<p class="gc-summary">' + hl(g.summary, ts) + '</p>' +
        '<div class="gc-examples">' + examples + '</div>' +
      '</button>' +
      '<div class="gc-foot">' + tags +
        '<button class="link-btn gc-more" data-open="' + g.id + '">查看辨析<svg class="ic" aria-hidden="true"><use href="#i-right"/></svg></button>' +
      '</div>' +
    '</article>';
  }

  function cardGrid(groups, ts) {
    if (!groups.length) return '';
    return '<div class="card-grid">' + groups.map(function (g, i) { return groupCard(g, i, ts); }).join('') + '</div>';
  }

  function emptyState(icon, title, desc) {
    return '<div class="empty"><div class="empty-ic"><svg class="ic" aria-hidden="true"><use href="#' + icon + '"/></svg></div>' +
      '<strong>' + esc(title) + '</strong><p>' + esc(desc) + '</p></div>';
  }

  /* ---------------- 视图：搜索 ---------------- */
  function heroBlock() {
    var favN = state.favorites.size;
    var masterN = state.mastered.size;
    return '<section class="hero">' +
      '<div class="hero-main">' +
        '<span class="hero-badge"><svg class="ic" aria-hidden="true"><use href="#i-sparkle"/></svg>词义辨析实验室</span>' +
        '<h2>看清 ' + GROUPS.length + ' 组高频近义词之间的边界</h2>' +
        '<p>每个词组都给出核心义、语感差异、真实例句、选词提示与易踩坑提醒，把「意思差不多」变成「用得出来」。</p>' +
        '<div class="hero-actions">' +
          '<button class="btn btn-primary" data-goto="study"><svg class="ic" aria-hidden="true"><use href="#i-cards"/></svg>开始学习</button>' +
          '<button class="btn btn-ghost" data-goto="quiz"><svg class="ic" aria-hidden="true"><use href="#i-quiz"/></svg>随机测验</button>' +
        '</div>' +
      '</div>' +
      '<div class="stat-strip">' +
        '<div><b>' + GROUPS.length + '</b><span>词组</span></div>' +
        '<div><b>' + GROUPS.reduce(function (n, g) { return n + g.words.length; }, 0) + '</b><span>词条</span></div>' +
        '<div><b>' + CATS.length + '</b><span>语义分类</span></div>' +
        '<div><b>' + favN + '</b><span>已收藏</span></div>' +
        '<div><b>' + masterN + '</b><span>已掌握</span></div>' +
      '</div>' +
    '</section>';
  }

  function renderSearch() {
    var ts = terms();
    var groups = searchGroups();
    var html = '';

    if (!ts.length && state.category === 'all') html += heroBlock();

    if (ts.length || state.category !== 'all') {
      html += '<div class="view-intro"><h1>' +
        (ts.length ? '搜索结果' : '分类筛选') +
        '</h1><p>' + groups.length + ' 组词义辨析' +
        (state.category !== 'all' ? ' · 分类：' + esc(state.category) : '') + '</p></div>';
    } else {
      html += '<div class="section-head"><h2>全部词组</h2><p>' + groups.length + ' 组</p></div>';
    }

    html += groups.length
      ? cardGrid(groups, ts)
      : emptyState('#i-search', '没有找到相关词组', '试试英文单词、中文含义、语义分类或例句里的用词。');

    content.innerHTML = html;
  }

  /* ---------------- 视图：浏览 ---------------- */
  function renderBrowse() {
    var ts = terms();
    var cats = state.category === 'all' ? CATS : CATS.filter(function (c) { return c === state.category; });
    var html = '<div class="view-intro"><h1>分类浏览</h1><p>按语义领域逐组浏览，' + GROUPS.length + ' 组词义辨析共 ' +
      GROUPS.reduce(function (n, g) { return n + g.words.length; }, 0) + ' 个词条。</p></div>';

    if (!cats.length) { content.innerHTML = html + emptyState('#i-grid', '该分类暂无内容', '换一个语义分类试试。'); return; }

    cats.forEach(function (cat) {
      var gs = GROUPS.filter(function (g) { return g.category === cat; });
      html += '<section class="cat-section" style="--cat-h:' + hue(cat) + '">' +
        '<div class="section-head"><h2>' + esc(cat) + '</h2><p>' + gs.length + ' 组</p>' +
        '<span class="spacer"></span>' +
        '<button class="link-btn" data-cat="' + esc(cat) + '">只看这类<svg class="ic" aria-hidden="true"><use href="#i-right"/></svg></button>' +
        '</div>' +
        cardGrid(gs, ts) +
      '</section>';
    });
    content.innerHTML = html;
  }

  /* ---------------- 视图：收藏 ---------------- */
  function renderFavorites() {
    var groups = GROUPS.filter(function (g) { return state.favorites.has(g.id); });
    var html = '<div class="view-intro"><h1>我的收藏</h1><p>' +
      (groups.length ? '已收藏 ' + groups.length + ' 组词义辨析，随时回看。' : '点击任意词组右上角的书签，把易混词收进来。') +
      '</p></div>';
    html += groups.length
      ? cardGrid(groups, terms())
      : emptyState('#i-bookmark', '还没有收藏', '进入词组详情即可收藏，收藏会保存在本地浏览器中。');
    content.innerHTML = html;
  }

  /* ---------------- 视图：学习卡片 ---------------- */
  function studyDeck() {
    var deck = GROUPS.filter(function (g) { return !state.studyOnlyNew || !state.mastered.has(g.id); });
    return deck.length ? deck : GROUPS;
  }

  function noteBlock(n, h) {
    return '<div class="note-card">' +
      '<div class="note-head">' +
        '<span class="note-word' + (/\s/.test(n.word) ? ' is-phrase' : '') + '">' + esc(n.word) + '</span>' +
        speakBtn(n.word, n.word) +
        '<span class="note-meaning">' + esc(n.meaning) + '</span>' +
      '</div>' +
      '<p class="note-nuance">' + esc(n.nuance) + '</p>' +
      '<div class="note-ex"><p>' + esc(n.example) + '</p><p class="tr">' + esc(n.translation) + '</p></div>' +
    '</div>';
  }

  function tipBlock(kind, text) {
    if (!text) return '';
    var isTip = kind === 'tip';
    return '<div class="tip-box ' + (isTip ? 'tip-tip' : 'tip-pit') + '">' +
      '<svg class="ic" aria-hidden="true"><use href="#' + (isTip ? '#i-bulb' : '#i-alert') + '"/></svg>' +
      '<div><strong>' + (isTip ? '选词提示　' : '易踩坑　') + '</strong>' + esc(text) + '</div></div>';
  }

  function renderStudy() {
    var deck = studyDeck();
    if (state.studyIndex >= deck.length) state.studyIndex = 0;
    var g = deck[state.studyIndex];
    var ts = terms();
    var flipped = state.studyFlipped;

    var front = '<div class="flip-face front">' +
      '<span class="study-cat"><svg class="ic" aria-hidden="true"><use href="#i-tag"/></svg>' + esc(g.category) + '</span>' +
      '<div class="study-words">' + g.words.map(function (w) {
        return '<span class="word-pill' + (g.lexicalType === 'phrase' ? ' is-phrase' : '') + '">' + hl(w, ts) + '</span>';
      }).join('') + '</div>' +
      '<p class="gc-summary" style="text-align:center">' + hl(g.summary, ts) + '</p>' +
      '<div class="flip-hint"><svg class="ic" aria-hidden="true"><use href="#i-cards"/></svg>点击卡片查看逐词辨析</div>' +
    '</div>';

    var back = '<div class="flip-face back">' +
      '<div class="summary-box">' + hl(g.summary, ts) + '</div>' +
      '<div style="margin-top:14px">' + g.notes.map(function (n) { return noteBlock(n, hue(g.category)); }).join('') + '</div>' +
      tipBlock('tip', g.choiceTip) +
      tipBlock('pit', g.pitfall) +
    '</div>';

    var html = '<div class="study-wrap">' +
      '<div class="study-bar">' +
        '<button class="icon-btn" data-study="prev" aria-label="上一组"><svg class="ic" aria-hidden="true"><use href="#i-left"/></svg></button>' +
        '<div class="progress-track"><div class="progress-fill" style="width:' + Math.round(((state.studyIndex + 1) / deck.length) * 100) + '%"></div></div>' +
        '<span class="study-count">' + (state.studyIndex + 1) + ' / ' + deck.length + '</span>' +
        '<button class="icon-btn" data-study="next" aria-label="下一组"><svg class="ic" aria-hidden="true"><use href="#i-right"/></svg></button>' +
      '</div>' +
      '<div class="flip' + (flipped ? ' is-flipped' : '') + '" data-flip role="button" tabindex="0" aria-label="翻转卡片查看辨析">' +
        '<div class="flip-inner">' + front + back + '</div>' +
      '</div>' +
      '<div class="study-actions">' +
        '<button class="btn btn-ghost" data-study="speak"><svg class="ic" aria-hidden="true"><use href="#i-sound"/></svg>朗读全组</button>' +
        '<button class="btn btn-ghost" data-master="' + g.id + '" aria-pressed="' + state.mastered.has(g.id) + '">' +
          '<svg class="ic" aria-hidden="true"><use href="#i-check-circle"/></svg>' + (state.mastered.has(g.id) ? '已掌握' : '标记掌握') + '</button>' +
      '</div>' +
      '<div style="display:flex;justify-content:center;margin-top:14px">' +
        '<button class="mastered-toggle" data-onlynew="1" aria-pressed="' + state.studyOnlyNew + '">' +
          '<svg class="ic" aria-hidden="true"><use href="#i-layers"/></svg>只看未掌握</button>' +
      '</div>' +
    '</div>';

    content.innerHTML = html;
  }

  /* ---------------- 视图：测验 ---------------- */
  function quizQuestionPool(scope) {
    if (scope === 'fav') {
      var f = GROUPS.filter(function (g) { return state.favorites.has(g.id); });
      if (f.length) return f;
    }
    if (scope === 'new') {
      var n = GROUPS.filter(function (g) { return !state.mastered.has(g.id); });
      if (n.length) return n;
    }
    return GROUPS;
  }

  function wordCandidates(g) {
    var same = [], all = [];
    GROUPS.forEach(function (x) {
      x.words.forEach(function (w) {
        all.push(w);
        if (x.category === g.category) same.push(w);
      });
    });
    return shuffle(same.concat(shuffle(all)));
  }

  function meaningCandidates(g) {
    var same = [], all = [];
    GROUPS.forEach(function (x) {
      x.notes.forEach(function (n) {
        all.push(n.meaning);
        if (x.category === g.category) same.push(n.meaning);
      });
    });
    return shuffle(same.concat(shuffle(all)));
  }

  function takeDistractors(correct, candidates, n) {
    var out = [], seen = {};
    seen[correct] = 1;
    for (var i = 0; i < candidates.length && out.length < n; i++) {
      var c = candidates[i];
      if (!c || seen[c]) continue;
      seen[c] = 1; out.push(c);
    }
    return out;
  }

  function makeGap(n) {
    var stems = [n.word, n.word.replace(/e$/, ''), n.word.replace(/ing$/, ''), n.word.replace(/ed$/, ''),
      n.word.replace(/es$/, ''), n.word.replace(/s$/, ''), n.word.replace(/y$/, 'ie')];
    for (var i = 0; i < stems.length; i++) {
      var s = stems[i];
      if (!s || s.length < 2) continue;
      var re = new RegExp('\\b' + escapeRe(s) + '(?:e|es|s|ed|d|ing)?\\b', 'i');
      var m = n.example.match(re);
      if (m) {
        var before = n.example.slice(0, m.index);
        var after = n.example.slice(m.index + m[0].length);
        return { text: before + ' ____ ' + after, ok: true };
      }
    }
    return { ok: false };
  }

  function buildQuiz(count, scope) {
    var pool = quizQuestionPool(scope);
    var groups = shuffle(pool);
    var qs = [];
    var used = {};

    groups.forEach(function (g) {
      if (qs.length >= count) return;
      var notes = shuffle(g.notes);
      var types = shuffle(['zh2en', 'en2zh', 'gap']);
      notes.forEach(function (n) {
        if (qs.length >= count) return;
        var key = g.id + '|' + n.word + '|' + types[0];
        if (used[key]) return;
        used[key] = 1;

        var type = types[0];
        var q = null;

        if (type === 'gap') {
          var gap = makeGap(n);
          if (gap.ok) {
            var opts = shuffle([n.word].concat(takeDistractors(n.word, wordCandidates(g), 3)));
            q = {
              type: 'gap', group: g.id, note: n,
              prompt: gap.text, sub: '选出填入空格的正确单词',
              options: opts.map(function (o) { return { text: o, isEn: true }; }),
              answer: opts.indexOf(n.word)
            };
          } else { type = 'en2zh'; }
        }

        if (!q && type === 'en2zh') {
          var mOpts = shuffle([n.meaning].concat(takeDistractors(n.meaning, meaningCandidates(g), 3)));
          q = {
            type: 'en2zh', group: g.id, note: n,
            prompt: n.word, sub: '选出最贴切的中文释义',
            options: mOpts.map(function (o) { return { text: o, isEn: false }; }),
            answer: mOpts.indexOf(n.meaning)
          };
        }

        if (!q) {
          var wOpts = shuffle([n.word].concat(takeDistractors(n.word, wordCandidates(g), 3)));
          q = {
            type: 'zh2en', group: g.id, note: n,
            prompt: n.meaning, sub: '选出对应的英文单词',
            options: wOpts.map(function (o) { return { text: o, isEn: true }; }),
            answer: wOpts.indexOf(n.word)
          };
        }

        qs.push(q);
        types.push(types.shift());
      });
    });

    return qs;
  }

  function renderQuiz() {
    var q = state.quiz;

    if (!q) {
      content.innerHTML = '<div class="quiz-wrap">' +
        '<div class="view-intro" style="text-align:center"><h1>随堂测验</h1>' +
        '<p>从真实例句和释义里挑出正确的词，做完立刻给出辨析讲解。</p></div>' +
        '<div class="quiz-card" style="text-align:center">' +
          '<div class="stat-strip" style="justify-content:center;margin-top:0">' +
            '<div><b>3</b><span>题型</span></div>' +
            '<div><b>' + GROUPS.length + '</b><span>题库组</span></div>' +
            '<div><b>' + GROUPS.reduce(function (n, x) { return n + x.notes.length; }, 0) + '</b><span>可用题目</span></div>' +
          '</div>' +
          '<p style="margin:18px 0 10px;font-size:13px;color:var(--on-surface-3)">每轮题量</p>' +
          '<div class="options" style="grid-template-columns:repeat(3,1fr)">' +
            [8, 12, 20].map(function (c) {
              return '<button class="option" data-quizcount="' + c + '" style="justify-content:center">' + c + ' 题</button>';
            }).join('') +
          '</div>' +
          '<p style="margin:18px 0 10px;font-size:13px;color:var(--on-surface-3)">出题范围</p>' +
          '<div class="options" style="grid-template-columns:repeat(3,1fr)">' +
            '<button class="option" data-quizscope="all" style="justify-content:center">全部</button>' +
            '<button class="option" data-quizscope="fav" style="justify-content:center">我的收藏</button>' +
            '<button class="option" data-quizscope="new" style="justify-content:center">未掌握</button>' +
          '</div>' +
        '</div>' +
      '</div>';
      return;
    }

    if (q.phase === 'done') {
      var right = q.answers.filter(function (a) { return a.ok; }).length;
      var pct = Math.round((right / q.questions.length) * 100);
      var wrongs = q.answers.filter(function (a) { return !a.ok; });
      var html = '<div class="quiz-wrap"><div class="quiz-card quiz-result">' +
        '<div class="quiz-ring" style="--pct:' + pct + '"><div class="val">' + pct + '<small>%</small></div></div>' +
        '<h2 style="font-size:20px;font-weight:700;margin-bottom:6px">' +
          (pct === 100 ? '全对，厉害！' : pct >= 60 ? '基础不错，再练一轮' : '别急，先回看辨析卡片') +
        '</h2>' +
        '<p style="color:var(--on-surface-2);font-size:14px">答对 ' + right + ' / ' + q.questions.length + ' 题</p>' +
        '<div style="display:flex;gap:10px;margin-top:20px">' +
          '<button class="btn btn-primary" data-quiz="restart"><svg class="ic" aria-hidden="true"><use href="#i-refresh"/></svg>再来一轮</button>' +
          '<button class="btn btn-ghost" data-goto="study">回看卡片</button>' +
        '</div>';
      if (wrongs.length) {
        html += '<div class="wrong-list">' + wrongs.map(function (a) {
          var qq = a.q;
          return '<button class="wrong-item" data-open="' + qq.group + '">' +
            '<svg class="ic" aria-hidden="true"><use href="#i-x"/></svg>' +
            '<span><b>' + esc(qq.note.word) + '</b> · 你选了「' + esc(qq.options[a.picked] ? qq.options[a.picked].text : '—') + '」</span>' +
          '</button>';
        }).join('') + '</div>';
      }
      html += '</div></div>';
      content.innerHTML = html;
      return;
    }

    var cur = q.questions[q.idx];
    var answered = q.picked !== null && q.picked !== undefined;
    var typeLabel = { 'zh2en': '中文 → 英文', 'en2zh': '英文 → 中文', 'gap': '例句填空' }[cur.type];

    var body = '<div class="quiz-card">' +
      '<span class="quiz-type"><svg class="ic" aria-hidden="true"><use href="#i-quiz"/></svg>' + typeLabel + '</span>' +
      '<div class="quiz-prompt' + (cur.type === 'en2zh' ? ' is-en' : '') + '">' + esc(cur.prompt) + '</div>' +
      '<p class="quiz-sub">' + esc(cur.sub) + '</p>' +
      '<div class="options">' + cur.options.map(function (o, i) {
        var cls = '';
        if (answered) {
          if (i === cur.answer) cls = ' correct';
          else if (i === q.picked) cls = ' wrong';
          else cls = ' dimmed';
        }
        return '<button class="option' + cls + '" data-opt="' + i + '"' + (answered ? ' disabled' : '') + '>' +
          '<span class="key">' + 'ABCD'[i] + '</span><span class="txt' + (o.isEn ? ' is-en' : '') + '">' + esc(o.text) + '</span></button>';
      }).join('') + '</div>';

    if (answered) {
      var ok = q.picked === cur.answer;
      body += '<div class="quiz-feedback">' +
        '<div class="verdict ' + (ok ? 'ok' : 'no') + '">' +
          '<svg class="ic" aria-hidden="true"><use href="#' + (ok ? '#i-check-circle' : '#i-x') + '"/></svg>' +
          (ok ? '答对了' : '正确答案是 ' + esc(cur.options[cur.answer].text)) +
        '</div>' +
        '<p><b>' + esc(cur.note.word) + '</b> — ' + esc(cur.note.meaning) + '。' + esc(cur.note.nuance) + '</p>' +
        '<p style="margin-top:8px;color:var(--on-surface-3)">' + esc(cur.note.example) + '<br>' + esc(cur.note.translation) + '</p>' +
      '</div>';
    }
    body += '</div>';

    var footer = '<div class="quiz-bar">' +
      '<div class="progress-track"><div class="progress-fill" style="width:' + Math.round(((q.idx + (answered ? 1 : 0)) / q.questions.length) * 100) + '%"></div></div>' +
      '<span class="study-count">' + (q.idx + 1) + ' / ' + q.questions.length + '</span>' +
      (answered
        ? '<button class="btn btn-primary" data-quiz="next" style="flex:0 0 auto">' + (q.idx === q.questions.length - 1 ? '查看结果' : '下一题') + '</button>'
        : '<button class="btn btn-ghost" data-quiz="skip" style="flex:0 0 auto">跳过</button>') +
      '</div>';

    content.innerHTML = '<div class="quiz-wrap">' + body + footer + '</div>';
  }

  /* ---------------- 详情抽屉 ---------------- */
  function openSheet(id) {
    var g = BY_ID[id];
    if (!g) return;
    state.sheetId = id;
    var h = hue(g.category);
    var fav = state.favorites.has(g.id);

    $('#sheetCat').innerHTML = '<svg class="ic" aria-hidden="true"><use href="#i-tag"/></svg>' + esc(g.category);
    $('#sheetTitle').innerHTML = g.words.map(function (w) {
      return '<span class="word-pill" style="background:transparent;border:none;padding:0;font-size:25px">' + esc(w) + '</span>';
    }).join('<span class="word-sep" style="font-size:18px;margin:0 8px">/</span>');
    $('#sheetTags').innerHTML = (g.tags || []).map(function (t) { return '<span class="tag">' + esc(t) + '</span>'; }).join('');

    var matrix = '<div class="blk"><div class="blk-label"><svg class="ic" aria-hidden="true"><use href="#i-layers"/></svg>速查对照</div>' +
      '<table class="matrix"><thead><tr><th>词</th><th>核心义</th><th>细微差别</th></tr></thead><tbody>' +
      g.notes.map(function (n) {
        return '<tr><td class="mw">' + esc(n.word) + '</td><td class="mm">' + esc(n.meaning) + '</td><td class="mn">' + esc(n.nuance) + '</td></tr>';
      }).join('') + '</tbody></table></div>';

    var notes = '<div class="blk"><div class="blk-label"><svg class="ic" aria-hidden="true"><use href="#i-cards"/></svg>逐词详解</div>' +
      g.notes.map(function (n) { return noteBlock(n, h); }).join('') + '</div>';

    var rel = '';
    if ((g.relatedExpressions || []).length) {
      rel = '<div class="blk"><div class="blk-label"><svg class="ic" aria-hidden="true"><use href="#i-sparkle"/></svg>相关搭配</div><div class="rel-row">' +
        g.relatedExpressions.map(function (r) {
          return '<button class="rel-chip" data-rel="' + esc(r) + '">' + esc(r) + '</button>';
        }).join('') + '</div></div>';
    }

    $('#sheetBody').innerHTML =
      '<div class="blk"><div class="blk-label"><svg class="ic" aria-hidden="true"><use href="#i-sparkle"/></svg>一句话区别</div>' +
      '<div class="summary-box">' + esc(g.summary) + '</div></div>' +
      matrix + notes +
      '<div class="blk">' + tipBlock('tip', g.choiceTip) + '</div>' +
      '<div class="blk">' + tipBlock('pit', g.pitfall) + '</div>' +
      rel;

    $('#sheetFoot').innerHTML =
      '<button class="btn btn-ghost" data-fav="' + g.id + '" aria-pressed="' + fav + '">' +
        '<svg class="ic" aria-hidden="true"><use href="#' + (fav ? '#i-bookmark-fill' : '#i-bookmark') + '"/></svg>' +
        (fav ? '已收藏' : '收藏') +
      '</button>' +
      '<button class="btn btn-ghost" data-speak="' + esc(g.words.join(', ')) + '" aria-label="朗读整组" style="flex:0 0 auto">' +
        '<svg class="ic" aria-hidden="true"><use href="#i-sound"/></svg></button>' +
      '<button class="btn btn-primary" data-study-open="' + g.id + '">在卡片中复习</button>';

    sheet.style.setProperty('--cat-h', h);
    sheet.hidden = false;
    scrim.hidden = false;
    document.body.style.overflow = 'hidden';
    state.lastFocus = document.activeElement;
    requestAnimationFrame(function () {
      scrim.classList.add('show');
      sheet.classList.add('open');
    });
    $('#sheetClose').focus({ preventScroll: true });
  }

  function closeSheet() {
    if (sheet.hidden) return;
    sheet.classList.remove('open');
    scrim.classList.remove('show');
    document.body.style.overflow = '';
    setTimeout(function () {
      if (!sheet.classList.contains('open')) {
        sheet.hidden = true;
        scrim.hidden = true;
      }
    }, 460);
    state.sheetId = null;
    if (state.lastFocus && state.lastFocus.focus) state.lastFocus.focus({ preventScroll: true });
  }

  /* ---------------- 收藏 ---------------- */
  function toggleFav(id) {
    var g = BY_ID[id];
    if (!g) return;
    if (state.favorites.has(id)) {
      state.favorites.delete(id);
      toast('已取消收藏');
    } else {
      state.favorites.add(id);
      toast('已收藏「' + g.words.join('、') + '」');
    }
    save('vocablens.favorites', Array.from(state.favorites));
    syncFavUI();
    if (state.sheetId === id) {
      var btn = $('#sheetFoot [data-fav]');
      if (btn) {
        var fav = state.favorites.has(id);
        btn.setAttribute('aria-pressed', String(fav));
        btn.innerHTML = '<svg class="ic" aria-hidden="true"><use href="#' + (fav ? '#i-bookmark-fill' : '#i-bookmark') + '"/></svg>' + (fav ? '已收藏' : '收藏');
      }
    }
    if (state.view === 'favorites' || state.view === 'search' || state.view === 'browse') render();
  }

  function syncFavUI() {
    var n = state.favorites.size;
    if (favBadge) { favBadge.textContent = n; favBadge.hidden = n === 0; }
    if (favDot) favDot.hidden = n === 0;
    var t = state.today.ids.length;
    if (statToday) statToday.textContent = t;
    if (topStats) topStats.hidden = t === 0;
  }

  /* ---------------- 学习记录 ---------------- */
  function markStudied(id) {
    if (state.today.ids.indexOf(id) >= 0) return;
    state.today.ids.push(id);
    save('vocablens.today', state.today);
    syncFavUI();
  }

  /* ---------------- 视图切换 ---------------- */
  var VIEW_META = {
    search: { title: '搜索辨析', sub: '更清晰地理解相近词' },
    browse: { title: '分类浏览', sub: '按语义领域逐组查看' },
    study: { title: '学习卡片', sub: '翻卡记忆 · 标记掌握' },
    quiz: { title: '随堂测验', sub: '用选择题检验理解' },
    favorites: { title: '我的收藏', sub: '收藏的词义辨析' }
  };

  function setView(v) {
    if (!VIEW_META[v]) v = 'search';
    state.view = v;
    $$('[data-view]').forEach(function (b) {
      if (b.getAttribute('aria-current') === 'page') b.removeAttribute('aria-current');
    });
    $$('[data-view="' + v + '"]').forEach(function (b) { b.setAttribute('aria-current', 'page'); });
    render();
    window.scrollTo({ top: 0, behavior: 'auto' });
    if (v !== 'search') { searchInput.blur(); }
  }

  function render() {
    if (state.view === 'search') renderSearch();
    else if (state.view === 'browse') renderBrowse();
    else if (state.view === 'study') renderStudy();
    else if (state.view === 'quiz') renderQuiz();
    else renderFavorites();
    syncFavUI();
  }

  /* ---------------- 分类 chips ---------------- */
  function renderChips() {
    var counts = {};
    GROUPS.forEach(function (g) { counts[g.category] = (counts[g.category] || 0) + 1; });
    var html = '<button class="chip" data-cat="all" aria-selected="' + (state.category === 'all') + '">全部 <span class="cnt">' + GROUPS.length + '</span></button>';
    CATS.forEach(function (c) {
      html += '<button class="chip" data-cat="' + esc(c) + '" aria-selected="' + (state.category === c) + '" style="--c-h:' + hue(c) + '">' +
        '<span class="chip-dot"></span>' + esc(c) + ' <span class="cnt">' + counts[c] + '</span></button>';
    });
    chipRow.innerHTML = html;
  }

  function setCategory(cat) {
    state.category = cat;
    renderChips();
    if (state.view === 'favorites' || state.view === 'study' || state.view === 'quiz') {
      state.view = 'search';
      setView('search');
    } else {
      render();
    }
  }

  /* ---------------- 事件绑定 ---------------- */
  content.addEventListener('click', function (e) {
    var t = e.target;

    var goto = t.closest('[data-goto]');
    if (goto) { setView(goto.getAttribute('data-goto')); return; }

    var fav = t.closest('[data-fav]');
    if (fav) { e.stopPropagation(); toggleFav(fav.getAttribute('data-fav')); return; }

    var spk = t.closest('[data-speak]');
    if (spk) {
      e.stopPropagation();
      var btn = spk;
      btn.classList.add('playing');
      speak(btn.getAttribute('data-speak'));
      setTimeout(function () { btn.classList.remove('playing'); }, 1400);
      return;
    }

    var open = t.closest('[data-open]');
    if (open) { openSheet(open.getAttribute('data-open')); return; }

    var cat = t.closest('[data-cat]');
    if (cat) { setCategory(cat.getAttribute('data-cat')); return; }

    var flip = t.closest('[data-flip]');
    if (flip) {
      state.studyFlipped = !state.studyFlipped;
      if (state.studyFlipped && state.studyIndex >= 0) {
        var deck = studyDeck();
        if (deck[state.studyIndex]) markStudied(deck[state.studyIndex].id);
      }
      renderStudy();
      return;
    }

    var st = t.closest('[data-study]');
    if (st) {
      var act = st.getAttribute('data-study');
      var deck2 = studyDeck();
      if (act === 'prev') { state.studyIndex = (state.studyIndex - 1 + deck2.length) % deck2.length; state.studyFlipped = false; }
      else if (act === 'next') { state.studyIndex = (state.studyIndex + 1) % deck2.length; state.studyFlipped = false; }
      else if (act === 'speak') { speak(deck2[state.studyIndex].words.join(', ')); }
      renderStudy();
      return;
    }

    var master = t.closest('[data-master]');
    if (master) {
      var mid = master.getAttribute('data-master');
      if (state.mastered.has(mid)) { state.mastered.delete(mid); toast('已取消「已掌握」标记'); }
      else { state.mastered.add(mid); toast('已掌握，继续下一组'); }
      save('vocablens.mastered', Array.from(state.mastered));
      if (state.studyOnlyNew) {
        var d = studyDeck();
        if (state.studyIndex >= d.length) state.studyIndex = 0;
      }
      renderStudy();
      return;
    }

    var onlynew = t.closest('[data-onlynew]');
    if (onlynew) {
      state.studyOnlyNew = !state.studyOnlyNew;
      state.studyIndex = 0;
      state.studyFlipped = false;
      renderStudy();
      return;
    }

    var opt = t.closest('[data-opt]');
    if (opt && state.quiz && state.quiz.picked === null) {
      state.quiz.picked = parseInt(opt.getAttribute('data-opt'), 10);
      state.quiz.answers.push({ q: state.quiz.questions[state.quiz.idx], picked: state.quiz.picked, ok: state.quiz.picked === state.quiz.questions[state.quiz.idx].answer });
      renderQuiz();
      return;
    }

    var qc = t.closest('[data-quizcount]');
    if (qc) { startQuiz(parseInt(qc.getAttribute('data-quizcount'), 10), state.quizScope || 'all'); return; }

    var qs = t.closest('[data-quizscope]');
    if (qs) { state.quizScope = qs.getAttribute('data-quizscope'); toast('已选择范围，点击题量开始'); return; }

    var qa = t.closest('[data-quiz]');
    if (qa) {
      var a = qa.getAttribute('data-quiz');
      if (a === 'next') {
        if (state.quiz.idx >= state.quiz.questions.length - 1) { state.quiz.phase = 'done'; }
        else { state.quiz.idx++; state.quiz.picked = null; }
        renderQuiz();
      } else if (a === 'skip') {
        state.quiz.picked = null;
        state.quiz.answers.push({ q: state.quiz.questions[state.quiz.idx], picked: -1, ok: false });
        if (state.quiz.idx >= state.quiz.questions.length - 1) state.quiz.phase = 'done';
        else state.quiz.idx++;
        renderQuiz();
      } else if (a === 'restart') {
        startQuiz(state.quiz.count, state.quiz.scope);
      }
      return;
    }
  });

  content.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') {
      var flip = e.target.closest && e.target.closest('[data-flip]');
      if (flip) { e.preventDefault(); flip.click(); }
    }
  });

  chipRow.addEventListener('click', function (e) {
    var c = e.target.closest('[data-cat]');
    if (c) setCategory(c.getAttribute('data-cat'));
  });

  $$('[data-view]').forEach(function (b) {
    b.addEventListener('click', function () { setView(b.getAttribute('data-view')); });
  });

  /* 搜索 */
  var searchTimer;
  searchInput.addEventListener('input', function () {
    clearBtn.hidden = !searchInput.value;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(function () {
      state.query = searchInput.value;
      if (state.view !== 'search') { state.view = 'search'; syncNav(); }
      render();
    }, 110);
  });

  clearBtn.addEventListener('click', function () {
    searchInput.value = '';
    state.query = '';
    clearBtn.hidden = true;
    render();
    searchInput.focus();
  });

  function syncNav() {
    $$('[data-view]').forEach(function (b) {
      if (b.getAttribute('aria-current') === 'page') b.removeAttribute('aria-current');
    });
    $$('[data-view="' + state.view + '"]').forEach(function (b) { b.setAttribute('aria-current', 'page'); });
  }

  /* 抽屉内事件 */
  sheet.addEventListener('click', function (e) {
    var t = e.target;
    var fav = t.closest('[data-fav]');
    if (fav) { toggleFav(fav.getAttribute('data-fav')); return; }
    var spk = t.closest('[data-speak]');
    if (spk) { speak(spk.getAttribute('data-speak')); return; }
    var rel = t.closest('[data-rel]');
    if (rel) {
      var v = rel.getAttribute('data-rel');
      closeSheet();
      searchInput.value = v;
      state.query = v;
      clearBtn.hidden = false;
      setView('search');
      setTimeout(function () { searchInput.focus(); }, 120);
      return;
    }
    var so = t.closest('[data-study-open]');
    if (so) {
      var id = so.getAttribute('data-study-open');
      closeSheet();
      var deck = studyDeck();
      var idx = deck.findIndex(function (g) { return g.id === id; });
      state.studyIndex = idx >= 0 ? idx : 0;
      state.studyFlipped = false;
      setView('study');
    }
  });

  $('#sheetClose').addEventListener('click', closeSheet);
  scrim.addEventListener('click', closeSheet);

  /* 主题 */
  function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', t === 'dark' ? '#090812' : '#f2f1f9');
    save('vocablens.theme', t);
  }
  $('#themeBtn').addEventListener('click', function () {
    var cur = document.documentElement.getAttribute('data-theme');
    applyTheme(cur === 'dark' ? 'light' : 'dark');
    measureHeader();
  });

  /* ---------- 顶栏：高度实测 + 滚动方向折叠 ---------- */
  var topbar = $('#topbar');
  var PH_FULL = '搜索英文词、中文释义或语义分类';
  var PH_SHORT = '搜索词义…';
  var compact = false;
  var lastY = window.scrollY;
  var scrollRaf = 0;

  /* 实测展开态高度写入 --topbar-h。顶栏固定定位，内容区据此留出等高空白，
     折叠时正文不会因为顶栏变矮而跳动。 */
  function measureHeader() {
    var wasCompact = topbar.classList.contains('compact');
    topbar.classList.add('measuring');
    topbar.classList.remove('compact');
    var h = topbar.offsetHeight;
    if (wasCompact) topbar.classList.add('compact');
    topbar.classList.remove('measuring');
    document.documentElement.style.setProperty('--topbar-h', h + 'px');
  }

  function setCompact(on) {
    if (compact === on) return;
    compact = on;
    topbar.classList.toggle('compact', on);
    searchInput.placeholder = on ? PH_SHORT : PH_FULL;
  }

  function isNarrow() { return window.innerWidth < 1024; }

  function onScroll() {
    topbar.classList.toggle('scrolled', window.scrollY > 4);
    var y = window.scrollY;
    /* 正在使用搜索框时保持顶栏展开（直接查 activeElement，不依赖 focus 事件） */
    var typing = document.activeElement === searchInput;
    if (!isNarrow() || typing) { setCompact(false); lastY = y; return; }
    var dy = y - lastY;
    if (y <= 30) setCompact(false);        /* 回到顶部完全展开 */
    else if (dy > 6) setCompact(true);     /* 上滑（内容向上走）→ 收起 */
    else if (dy < -6) setCompact(false);   /* 下滑 → 展开 */
    lastY = y;
  }

  window.addEventListener('scroll', function () {
    if (scrollRaf) return;
    scrollRaf = requestAnimationFrame(function () {
      scrollRaf = 0;
      onScroll();
    });
  }, { passive: true });

  var resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      if (!isNarrow()) setCompact(false);
      measureHeader();
      lastY = window.scrollY;
    }, 120);
  });

  /* 触碰搜索框时立即展开顶栏（focus 事件在部分环境下不触发，pointerdown 更可靠） */
  searchInput.addEventListener('focus', function () { setCompact(false); });
  searchInput.addEventListener('pointerdown', function () { setCompact(false); });
  searchField.addEventListener('pointerdown', function () { setCompact(false); });

  /* 键盘快捷键 */
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { if (!sheet.hidden) { closeSheet(); return; } }
    var typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
    if (typing) return;
    if (e.key === '/') { e.preventDefault(); setView('search'); setTimeout(function () { searchInput.focus(); }, 60); }
    else if (e.key === '?') {
      toast('快捷键：/ 搜索 · Esc 关闭 · 点击卡片翻面');
    }
  });

  /* 测验启动 */
  function startQuiz(count, scope) {
    var questions = buildQuiz(count, scope);
    if (!questions.length) { toast('当前范围没有可用题目'); return; }
    state.quiz = { questions: questions, idx: 0, picked: null, answers: [], phase: 'ask', count: count, scope: scope };
    setView('quiz');
  }

  /* ---------------- 初始化 ---------------- */
  applyTheme(load('vocablens.theme', 'dark'));
  renderChips();
  setView('search');
  syncFavUI();
  $('#sideGroupCount').textContent = GROUPS.length;
  $('#sideWordCount').textContent = GROUPS.reduce(function (n, g) { return n + g.words.length; }, 0);
  measureHeader();
  requestAnimationFrame(measureHeader);
  setTimeout(measureHeader, 400);   /* 字体就绪后复测一次 */
})();
