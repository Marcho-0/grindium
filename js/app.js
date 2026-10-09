/* Grind v0.1: Today, Week, Settings. No framework, no build step. */
(function () {
  "use strict";
  var VERSION = "0.1.0";
  var t = Grind.i18n.t;
  var COLORS = {};
  Grind.cats.forEach(function (c) { COLORS[c.id] = c.color; });

  var S = Grind.store.load();
  Grind.i18n.setLang(S.settings.lang);

  var $app = document.getElementById("app");
  var $tabs = document.getElementById("tabs");
  var $toast = document.getElementById("toast");
  var $file = document.getElementById("file");
  var ui = { view: "today", day: null };
  var deferredPrompt = null;
  var persisted = null;

  /* ---------- helpers ---------- */
  function toMin(s) { var p = s.split(":"); return +p[0] * 60 + +p[1]; }
  function toStr(m) { return String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0"); }
  function dur(m) {
    var h = Math.floor(m / 60), r = Math.round(m % 60);
    if (h && r) return h + " " + t("h") + " " + r + " " + t("min");
    if (h) return h + " " + t("h");
    return r + " " + t("min");
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function title(b) {
    if (b.title) return b.title;
    return t("key." + b.key, b.arg ? { room: t("room." + b.arg) } : null);
  }
  function dayOf(d) { return (d.getDay() + 6) % 7; }
  function dateKey(d) {
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function nowInfo() {
    var d = new Date();
    return { d: d, day: dayOf(d), key: dateKey(d), min: d.getHours() * 60 + d.getMinutes() };
  }
  function blocksFor(day) {
    return S.blocks.filter(function (b) { return b.day === day; })
      .sort(function (a, b) { return toMin(a.start) - toMin(b.start); });
  }
  function dayName(day, style) {
    return new Intl.DateTimeFormat(Grind.i18n.getLang(), { weekday: style }).format(new Date(2024, 0, 1 + day));
  }
  function save() { Grind.store.save(S); }
  function status(key, id) { return (S.log[key] || {})[id] || null; }
  function setStatus(key, id, st) {
    S.log[key] = S.log[key] || {};
    if (st) S.log[key][id] = st; else delete S.log[key][id];
    save();
  }
  function isStandalone() {
    return (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true;
  }
  function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  }
  function toast(msg) {
    $toast.textContent = msg;
    $toast.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { $toast.classList.remove("show"); }, 2600);
  }
  var CHECK = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4.5 10.5l3.6 3.6 7.4-8" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  /* ---------- shared pieces ---------- */
  function dayBar(blocks, nowMin) {
    if (!blocks.length) return "";
    var start = toMin(blocks[0].start), end = toMin(blocks[blocks.length - 1].end);
    var segs = blocks.map(function (b) {
      var free = b.cat === "free";
      return '<i class="seg' + (free ? " is-free" : "") + '"' +
        ' style="flex:' + (toMin(b.end) - toMin(b.start)) + (free ? "" : ";--cat:" + COLORS[b.cat]) + '"></i>';
    }).join("");
    var tick = "";
    if (nowMin != null && nowMin >= start && nowMin <= end) {
      tick = '<span class="tick" style="left:' + ((nowMin - start) / (end - start) * 100).toFixed(2) + '%"></span>';
    }
    return '<div class="daybar" role="img" aria-label="' + esc(t("nav.today")) + '"><div class="segs">' + segs + "</div>" + tick + "</div>" +
      '<div class="daybar-labels"><span>' + toStr(start) + "</span><span>" + toStr(end) + "</span></div>";
  }

  function rail(blocks, o) {
    var rows = blocks.map(function (b) {
      var s = toMin(b.start), e = toMin(b.end), free = b.cat === "free";
      var cur = o.live && o.min >= s && o.min < e;
      var past = o.live && e <= o.min;
      var st = o.live ? status(o.key, b.id) : null;
      var check = (o.live && !free)
        ? '<button class="check" data-act="toggle" data-id="' + b.id + '" aria-pressed="' + (st === "done") +
          '" aria-label="' + esc(t("act.done") + ": " + title(b)) + '">' + (st === "done" ? CHECK : "") + "</button>"
        : "<span></span>";
      var meta = st === "skipped" ? t("state.skipped") : (free ? dur(e - s) : t("cat." + b.cat) + ", " + dur(e - s));
      return '<li class="row' + (cur ? " cur" : "") + (past ? " past" : "") + (free ? " is-free" : "") +
        (st === "skipped" ? " skipped" : "") + '"' + (free ? "" : ' style="--cat:' + COLORS[b.cat] + '"') + ">" +
        '<span class="t">' + b.start + '</span><span class="bar"></span>' +
        '<span class="txt"><b>' + esc(title(b)) + "</b><small>" + esc(meta) + "</small></span>" + check + "</li>";
    }).join("");
    var bed = '<li class="row bedtime"><span class="t">' + esc(S.settings.bedtime) + '</span><span class="bar"></span>' +
      '<span class="txt"><b>' + esc(t("bedtime")) + "</b></span><span></span></li>";
    return '<ol class="rail">' + rows + bed + "</ol>";
  }

  function banners() {
    var out = "";
    if (!Grind.store.ok()) out += '<div class="note warn" role="alert">' + esc(t("storage.fail")) + "</div>";
    if (!isStandalone() && !S.settings.installDismissed) {
      var msg = isIOS() ? t("install.ios") : (deferredPrompt ? t("install.android") : t("install.generic"));
      out += '<div class="note"><b>' + esc(t("install.title")) + "</b><p>" + esc(msg) + "</p><div class=\"note-actions\">" +
        (deferredPrompt ? '<button class="btn" data-act="install">' + esc(t("install.button")) + "</button>" : "") +
        '<button class="btn ghost" data-act="dismissInstall">' + esc(t("install.dismiss")) + "</button></div></div>";
    }
    var hasData = Object.keys(S.log).length >= 3; /* nudge only once there is history worth protecting */
    var due = !S.lastBackup || (Date.now() - S.lastBackup > 7 * 864e5);
    if (hasData && due) {
      out += '<div class="note"><p>' + esc(S.lastBackup ? t("backup.due") : t("backup.first")) + '</p><div class="note-actions">' +
        '<button class="btn" data-act="export">' + esc(t("backup.go")) + "</button></div></div>";
    }
    return out;
  }

  /* ---------- views ---------- */
  function viewToday() {
    var n = nowInfo(), blocks = blocksFor(n.day);
    var head = '<header class="top"><h1>Grind</h1><p class="date">' +
      esc(new Intl.DateTimeFormat(Grind.i18n.getLang(), { weekday: "long", day: "numeric", month: "long" }).format(n.d)) + "</p></header>";
    if (!blocks.length) return head + banners();

    var first = blocks[0], lastB = blocks[blocks.length - 1];
    var cur = blocks.filter(function (b) { return n.min >= toMin(b.start) && n.min < toMin(b.end); })[0];
    var nxt = blocks.filter(function (b) { return toMin(b.start) > n.min; })[0];
    var card;

    if (cur) {
      var s = toMin(cur.start), e = toMin(cur.end), st = status(n.key, cur.id), free = cur.cat === "free";
      var actions = "";
      if (!free) {
        actions = st
          ? '<div class="now-actions"><span class="now-state">' + esc(t("state." + st)) + '</span><button class="btn inv ghost" data-act="undo" data-id="' + cur.id + '">' + esc(t("act.undo")) + "</button></div>"
          : '<div class="now-actions"><button class="btn inv" data-act="done" data-id="' + cur.id + '">' + esc(t("act.done")) + '</button><button class="btn inv ghost" data-act="skip" data-id="' + cur.id + '">' + esc(t("act.skip")) + "</button></div>";
      }
      card = '<section class="now" style="--cat:' + (free ? "var(--free)" : COLORS[cur.cat]) + '">' +
        '<p class="now-label"><span>' + esc(t("now.label")) + "</span><span>" + esc(t("cat." + cur.cat)) + "</span></p>" +
        "<h2>" + esc(title(cur)) + "</h2>" +
        '<p class="now-time">' + cur.start + "\u2013" + cur.end + "</p>" +
        '<p class="now-left">' + esc(t("now.left", { time: dur(e - n.min) })) + "</p>" +
        '<div class="progress"><i style="width:' + Math.round((n.min - s) / (e - s) * 100) + '%"></i></div>' +
        actions +
        (nxt ? '<p class="now-next">' + esc(t("now.next")) + ": " + esc(title(nxt)) + " " + esc(t("now.at")) + " " + nxt.start + "</p>" : "") +
        "</section>";
    } else if (n.min < toMin(first.start)) {
      card = '<section class="now" style="--cat:' + COLORS[first.cat] + '"><p class="now-label"><span>' + esc(t("now.next")) + "</span></p>" +
        "<h2>" + esc(title(first)) + "</h2>" +
        '<p class="now-time">' + esc(t("now.beforeDay", { time: first.start })) + "</p>" +
        '<p class="now-left">' + esc(t("now.startsIn", { time: dur(toMin(first.start) - n.min) })) + "</p></section>";
    } else {
      card = '<section class="now done-day"><h2>' + esc(t("now.dayDone")) + "</h2>" +
        '<p class="now-time">' + esc(t("now.dayDoneText")) + "</p></section>";
    }

    var freeLeft = blocks.reduce(function (sum, b) {
      if (b.cat !== "free") return sum;
      return sum + Math.max(0, toMin(b.end) - Math.max(toMin(b.start), n.min));
    }, 0);
    var freeLine = freeLeft > 0 ? '<p class="freeleft">' + esc(t("free.left", { time: dur(freeLeft) })) + "</p>" : "";

    return head + card + banners() + dayBar(blocks, n.min) + freeLine +
      rail(blocks, { live: true, min: n.min, key: n.key });
  }

  function viewWeek() {
    var all = S.blocks;
    var minS = Math.floor(Math.min.apply(null, all.map(function (b) { return toMin(b.start); })) / 60) * 60;
    var maxE = Math.ceil(Math.max.apply(null, all.map(function (b) { return toMin(b.end); })) / 60) * 60;
    var P = 0.52, H = Math.round((maxE - minS) * P);
    var n = nowInfo();
    var axis = "";
    for (var m = minS; m <= maxE; m += 120) axis += '<span style="top:' + Math.round((m - minS) * P) + 'px">' + toStr(m) + "</span>";
    var heads = '<span></span>', cols = '<div class="wk-axis" style="height:' + H + 'px">' + axis + "</div>";
    for (var d = 0; d < 7; d++) {
      var isToday = d === n.day;
      heads += '<button class="wk-head' + (isToday ? " today" : "") + '" data-act="openDay" data-day="' + d + '">' + esc(dayName(d, "short")) + "</button>";
      var inner = blocksFor(d).map(function (b) {
        var free = b.cat === "free";
        return '<i class="wb' + (free ? " is-free" : "") + '" style="top:' + Math.round((toMin(b.start) - minS) * P) + "px;height:" +
          Math.max(2, Math.round((toMin(b.end) - toMin(b.start)) * P) - 1) + "px" + (free ? "" : ";--cat:" + COLORS[b.cat]) + '"></i>';
      }).join("");
      var line = (isToday && n.min >= minS && n.min <= maxE) ? '<span class="nowline" style="top:' + Math.round((n.min - minS) * P) + 'px"></span>' : "";
      cols += '<button class="wk-col' + (isToday ? " today" : "") + '" data-act="openDay" data-day="' + d + '" aria-label="' + esc(dayName(d, "long")) + '" style="height:' + H + 'px">' + inner + line + "</button>";
    }
    var legend = Grind.cats.map(function (c) {
      return '<li><i style="' + (c.id === "free" ? "" : "--cat:" + c.color) + '" class="sw' + (c.id === "free" ? " is-free" : "") + '"></i>' + esc(t("cat." + c.id)) + "</li>";
    }).join("");
    return '<header class="top"><h1>' + esc(t("nav.week")) + '</h1><p class="date">' + esc(t("week.hint")) + "</p></header>" +
      '<div class="wk">' + heads + cols + "</div><ul class=\"legend\">" + legend + "</ul>";
  }

  function viewDay() {
    var n = nowInfo(), blocks = blocksFor(ui.day), live = ui.day === n.day;
    return '<header class="top"><button class="back" data-act="back">' + esc(t("day.back")) + "</button><h1>" +
      esc(dayName(ui.day, "long")) + "</h1></header>" + dayBar(blocks, live ? n.min : null) +
      rail(blocks, { live: live, min: n.min, key: n.key });
  }

  function viewSettings() {
    var langs = Grind.i18n.langs.map(function (l) {
      return '<option value="' + l[0] + '"' + (S.settings.lang === l[0] ? " selected" : "") + ">" + l[1] + "</option>";
    }).join("");
    var last = S.lastBackup
      ? new Intl.DateTimeFormat(Grind.i18n.getLang(), { dateStyle: "medium" }).format(new Date(S.lastBackup))
      : t("settings.never");
    var storageMsg = persisted === true ? t("settings.storageOk") : t("settings.storageRisk");
    return '<header class="top"><h1>' + esc(t("settings.title")) + "</h1></header>" +
      '<section class="panel"><label for="lang">' + esc(t("settings.language")) + '</label><select id="lang">' + langs + "</select></section>" +
      '<section class="panel"><label for="bedtime">' + esc(t("settings.bedtime")) + '</label><input id="bedtime" type="time" value="' + esc(S.settings.bedtime) + '">' +
      "<small>" + esc(t("settings.bedtimeHelp")) + "</small></section>" +
      '<section class="panel"><h3>' + esc(t("settings.backup")) + "</h3><small>" + esc(t("settings.lastBackup", { date: last })) + "</small>" +
      '<div class="panel-actions"><button class="btn" data-act="export">' + esc(t("settings.export")) + '</button><button class="btn ghost" data-act="import">' + esc(t("settings.import")) + "</button></div></section>" +
      '<section class="panel"><h3>' + esc(t("settings.storage")) + "</h3><small>" + esc(storageMsg) + "</small></section>" +
      '<section class="panel"><button class="btn ghost" data-act="reset">' + esc(t("settings.reset")) + "</button></section>" +
      '<p class="foot">' + esc(t("settings.privacy")) + "<br>" + esc(t("settings.version", { version: VERSION })) + "</p>";
  }

  var ICONS = {
    today: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 7v5l3 2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    week: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4v16M10 4v16M15 4v16M20 4v16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-dasharray="7 3"/></svg>',
    settings: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h9M17 8h3M4 16h3M11 16h9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="15" cy="8" r="2.2" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="9" cy="16" r="2.2" fill="none" stroke="currentColor" stroke-width="2"/></svg>'
  };
  function renderTabs() {
    var cur = ui.view === "day" ? "week" : ui.view;
    $tabs.innerHTML = ["today", "week", "settings"].map(function (v) {
      return '<button data-act="nav" data-view="' + v + '"' + (cur === v ? ' aria-current="page"' : "") + ">" + ICONS[v] + "<span>" + esc(t("nav." + v)) + "</span></button>";
    }).join("");
  }

  function render(keepScroll) {
    var y = window.scrollY;
    Grind.i18n.setLang(S.settings.lang);
    document.documentElement.lang = S.settings.lang;
    var html = ui.view === "week" ? viewWeek() : ui.view === "day" ? viewDay() : ui.view === "settings" ? viewSettings() : viewToday();
    $app.innerHTML = html;
    renderTabs();
    window.scrollTo(0, keepScroll ? y : 0);
  }

  /* ---------- backup ---------- */
  function markBackup() { S.lastBackup = Date.now(); save(); toast(t("settings.exportDone")); render(true); }
  function exportBackup() {
    var data = JSON.stringify(S, null, 2);
    var name = "grind-backup-" + dateKey(new Date()) + ".json";
    var file;
    try { file = new File([data], name, { type: "application/json" }); } catch (e) { file = null; }
    function download() {
      var a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([data], { type: "application/json" }));
      a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 1500);
      markBackup();
    }
    if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file], title: "Grind backup" }).then(markBackup).catch(function (err) {
        if (err && err.name !== "AbortError") download();
      });
    } else { download(); }
  }
  function importBackup(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var obj = JSON.parse(reader.result);
        if (!Grind.store.validate(obj)) throw new Error("invalid");
        if (!window.confirm(t("settings.importConfirm"))) return;
        S = Grind.store.normalise(obj);
        save();
        Grind.i18n.setLang(S.settings.lang);
        toast(t("settings.importDone"));
        render(true);
      } catch (e) { toast(t("settings.importError")); }
    };
    reader.readAsText(file);
  }

  /* ---------- events ---------- */
  document.addEventListener("click", function (e) {
    var el = e.target.closest("[data-act]");
    if (!el) return;
    var act = el.dataset.act, n = nowInfo();
    if (act === "nav") { ui = { view: el.dataset.view, day: null }; render(false); }
    else if (act === "openDay") { ui = { view: "day", day: +el.dataset.day }; render(false); }
    else if (act === "back") { ui = { view: "week", day: null }; render(false); }
    else if (act === "done") { setStatus(n.key, el.dataset.id, "done"); render(true); }
    else if (act === "skip") { setStatus(n.key, el.dataset.id, "skipped"); render(true); }
    else if (act === "undo") { setStatus(n.key, el.dataset.id, null); render(true); }
    else if (act === "toggle") { setStatus(n.key, el.dataset.id, status(n.key, el.dataset.id) === "done" ? null : "done"); render(true); }
    else if (act === "export") exportBackup();
    else if (act === "import") { $file.value = ""; $file.click(); }
    else if (act === "dismissInstall") { S.settings.installDismissed = true; save(); render(true); }
    else if (act === "install" && deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.finally(function () { deferredPrompt = null; render(true); });
    }
    else if (act === "reset") {
      if (window.confirm(t("settings.resetConfirm"))) {
        S.blocks = JSON.parse(JSON.stringify(Grind.seed)); save(); toast(t("settings.resetDone")); render(true);
      }
    }
  });
  document.addEventListener("change", function (e) {
    if (e.target.id === "lang") { S.settings.lang = e.target.value; save(); render(true); }
    else if (e.target.id === "bedtime" && /^\d\d:\d\d$/.test(e.target.value)) { S.settings.bedtime = e.target.value; save(); }
    else if (e.target.id === "file" && e.target.files[0]) importBackup(e.target.files[0]);
  });
  window.addEventListener("beforeinstallprompt", function (e) { e.preventDefault(); deferredPrompt = e; if (ui.view === "today") render(true); });
  window.addEventListener("appinstalled", function () { deferredPrompt = null; render(true); });
  document.addEventListener("visibilitychange", function () { if (!document.hidden && (ui.view === "today" || ui.view === "day")) render(true); });
  setInterval(function () { if (!document.hidden && (ui.view === "today" || ui.view === "day")) render(true); }, 30000);

  /* ---------- start ---------- */
  render(false);
  if (navigator.storage && navigator.storage.persisted) {
    navigator.storage.persisted().then(function (p) {
      if (p) { persisted = true; return; }
      return navigator.storage.persist ? navigator.storage.persist().then(function (r) { persisted = r; }) : null;
    }).then(function () { if (ui.view === "settings") render(true); }).catch(function () {});
  }
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () { navigator.serviceWorker.register("./sw.js").catch(function () {}); });
  }
})();
