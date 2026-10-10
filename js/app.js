/* Grind v0.1: Today, Week, Settings. No framework, no build step. */
(function () {
  "use strict";
  var VERSION = "0.2.0";
  var t = Grind.i18n.t;
  var COLORS = {};
  Grind.cats.forEach(function (c) { COLORS[c.id] = c.color; });

  var S = Grind.store.load();
  Grind.i18n.setLang(S.settings.lang);

  var $app = document.getElementById("app");
  var $tabs = document.getElementById("tabs");
  var $toast = document.getElementById("toast");
  var $file = document.getElementById("file");
  var $sheet = document.getElementById("sheet");
  var ui = { view: "today", day: null };
  var sleepUI = { day: null, n: 5 };
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
      var tail;
      if (free) tail = '<span class="plus" aria-hidden="true">+</span>';
      else if (o.live) {
        tail = '<button class="check" data-act="toggle" data-id="' + b.id + '" aria-pressed="' + (st === "done") +
          '" aria-label="' + esc(t("act.done") + ": " + title(b)) + '">' + (st === "done" ? CHECK : "") + "</button>";
      } else tail = "<span></span>";
      var meta = st === "skipped" ? t("state.skipped") : (free ? dur(e - s) : t("cat." + b.cat) + ", " + dur(e - s));
      return '<li class="row' + (cur ? " cur" : "") + (past ? " past" : "") + (free ? " is-free" : "") +
        (st === "skipped" ? " skipped" : "") + '"' + (free ? "" : ' style="--cat:' + COLORS[b.cat] + '"') + ">" +
        '<span class="t">' + b.start + '</span><span class="bar"></span>' +
        '<button class="txt" data-act="' + (free ? "addAt" : "edit") + '" data-id="' + b.id + '"><b>' + esc(title(b)) + "</b><small>" + esc(meta) + "</small></button>" +
        tail + "</li>";
    }).join("");
    var bed = '<li class="row bedtime"><span class="t">' + esc(S.settings.bedtime) + '</span><span class="bar"></span>' +
      '<span class="txt"><b>' + esc(t("bedtime")) + "</b>" + (o.live && o.hint ? "<small>" + esc(bedHint()) + "</small>" : "") + "</span><span></span></li>";
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
    if (!blocks.length) return head + banners() + fab(n.day);

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
      rail(blocks, { live: true, min: n.min, key: n.key, hint: true }) + fab(n.day);
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
      esc(dayName(ui.day, "long")) + '</h1><p class="date">' + esc(t("plan.hint")) + "</p></header>" + dayBar(blocks, live ? n.min : null) +
      rail(blocks, { live: live, min: n.min, key: n.key, hint: live }) +
      '<p class="resetday"><button class="btn ghost" data-act="resetDay">' + esc(t("plan.resetDay")) + "</button></p>" + fab(ui.day);
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


  /* ---------- planner: prepared events, custom events, editing ---------- */
  var TEMPLATES = [
    { key: "wake", cat: "care", dur: 30 }, { key: "stretch", cat: "care", dur: 15 },
    { key: "workBlock", cat: "work", dur: 240 },
    { key: "breakfast", cat: "meals", dur: 15 }, { key: "lunch", cat: "meals", dur: 60 },
    { key: "dinner", cat: "meals", dur: 75 }, { key: "mealPrep", cat: "meals", dur: 90 },
    { key: "cats", cat: "cats", dur: 15 }, { key: "litter", cat: "cats", dur: 10 }, { key: "vet", cat: "cats", dur: 60 },
    { key: "room", cat: "clean", dur: 20, arg: "kitchen" },
    { key: "gym", cat: "gym", dur: 105 }, { key: "walk", cat: "gym", dur: 30 },
    { key: "groceriesMain", cat: "groceries", dur: 75 }, { key: "groceriesTop", cat: "groceries", dur: 30 },
    { key: "startLaundry", cat: "laundry", dur: 10 }, { key: "hangLaundry", cat: "laundry", dur: 10 }, { key: "foldLaundry", cat: "laundry", dur: 10 },
    { key: "study", cat: "study", dur: 90 }, { key: "language", cat: "study", dur: 30 },
    { key: "hobby", cat: "hobby", dur: 60 }, { key: "reading", cat: "hobby", dur: 30 },
    { key: "call", cat: "social", dur: 30 }, { key: "friends", cat: "social", dur: 120 },
    { key: "errands", cat: "other", dur: 45 }, { key: "appointment", cat: "other", dur: 60 }
  ];
  var ROOMS = ["kitchen", "bathroom", "bedroom", "living", "hall", "catarea", "reset"];
  var sheet = null;

  function uid() { return "u" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function defTitle(key, arg) { return t("key." + key, arg ? { room: t("room." + arg) } : null); }
  function clampMin(m) { return Math.max(0, Math.min(1439, m)); }

  function carve(day, s, e) {            /* make [s,e) empty on a day by trimming, splitting or removing blocks */
    var out = [];
    S.blocks.forEach(function (b) {
      if (b.day !== day) { out.push(b); return; }
      var bs = toMin(b.start), be = toMin(b.end);
      if (be <= s || bs >= e) { out.push(b); return; }
      if (bs < s) { var l = clone(b); l.end = toStr(s); out.push(l); }
      if (be > e) { var r = clone(b); if (bs < s) r.id = uid(); r.start = toStr(e); out.push(r); }
    });
    S.blocks = out;
  }
  function normaliseDay(day) {           /* fill gaps with free time, merge neighbouring free blocks */
    var bl = blocksFor(day).filter(function (b) { return toMin(b.end) > toMin(b.start); });
    var filled = [], prev = null;
    bl.forEach(function (b) {
      if (prev && toMin(b.start) > toMin(prev.end)) filled.push({ id: uid(), day: day, start: prev.end, end: b.start, key: "free", cat: "free" });
      filled.push(b); prev = b;
    });
    var merged = [];
    filled.forEach(function (b) {
      var last = merged[merged.length - 1];
      if (last && last.cat === "free" && b.cat === "free" && last.end === b.start) last.end = b.end; else merged.push(b);
    });
    S.blocks = S.blocks.filter(function (b) { return b.day !== day; }).concat(merged);
  }
  function suggest(day, d, slot) {       /* a sensible start and end for a new event */
    if (slot) { var a = toMin(slot.start); return { start: a, end: Math.min(toMin(slot.end), a + d) }; }
    var n = nowInfo(), minStart = day === n.day ? Math.ceil(n.min / 5) * 5 : 0;
    var free = blocksFor(day).filter(function (b) { return b.cat === "free"; });
    for (var i = 0; i < free.length; i++) {
      var st = Math.max(toMin(free[i].start), minStart);
      if (toMin(free[i].end) - st >= d) return { start: st, end: st + d };
    }
    return { start: 12 * 60, end: Math.min(1439, 12 * 60 + d) };
  }
  function formFrom(tpl, day, slot) {
    var d = tpl ? tpl.dur : 60, tm = suggest(day, d, slot);
    return { id: null, day: day, key: tpl ? tpl.key : null, arg: tpl ? (tpl.arg || null) : null,
      title: tpl ? defTitle(tpl.key, tpl.arg) : "", cat: tpl ? tpl.cat : "other", start: toStr(clampMin(tm.start)), end: toStr(clampMin(tm.end)), days: [day] };
  }
  function openAdd(day, slot) { sheet = { mode: "add", step: "list", day: day, slot: slot || null, f: null, warn: null, armed: false, error: null }; renderSheet(); }
  function openEdit(id) {
    var b = S.blocks.filter(function (x) { return x.id === id; })[0];
    if (!b) return;
    sheet = { mode: "edit", step: "form", day: b.day, slot: null, warn: null, armed: false, error: null,
      f: { id: b.id, day: b.day, key: b.key || null, arg: b.arg || null, title: title(b), cat: b.cat, start: b.start, end: b.end, days: [] } };
    renderSheet();
  }
  function closeSheet() { sheet = null; renderSheet(); }

  function chipsHtml() {
    var f = sheet.f, edit = sheet.mode === "edit";
    return [0, 1, 2, 3, 4, 5, 6].map(function (d) {
      var on = edit ? (d === f.day || f.days.indexOf(d) !== -1) : f.days.indexOf(d) !== -1;
      return '<button type="button" class="chip" data-act="sheetDay" data-day="' + d + '" aria-pressed="' + on + '"' + (edit && d === f.day ? " disabled" : "") + ">" + esc(dayName(d, "short")) + "</button>";
    }).join("");
  }
  function pickHtml() {
    var rank = {}; Grind.cats.forEach(function (c, i) { rank[c.id] = i; });
    var list = TEMPLATES.map(function (x, i) { return { x: x, i: i }; }).sort(function (a, b) { return rank[a.x.cat] - rank[b.x.cat] || a.i - b.i; });
    var lastCat = null, items = "";
    list.forEach(function (o) {
      if (o.x.cat !== lastCat) { items += '<li class="grp">' + esc(t("cat." + o.x.cat)) + "</li>"; lastCat = o.x.cat; }
      items += '<li><button class="tpl" style="--cat:' + COLORS[o.x.cat] + '" data-act="pickTpl" data-i="' + o.i + '"><span class="tpl-bar"></span><span class="tpl-txt"><b>' +
        esc(defTitle(o.x.key, o.x.arg)) + "</b><small>" + esc(dur(o.x.dur)) + "</small></span></button></li>";
    });
    return '<div class="seg2"><button data-act="sheetTab" data-tab="prepared" aria-pressed="true">' + esc(t("plan.tabPrepared")) +
      '</button><button data-act="sheetTab" data-tab="custom" aria-pressed="false">' + esc(t("plan.tabCustom")) + "</button></div>" +
      '<p class="hint">' + esc(t("plan.pickHint")) + '</p><ul class="tpls">' + items + "</ul>";
  }
  function formHtml() {
    var f = sheet.f, edit = sheet.mode === "edit", s = toMin(f.start), e = toMin(f.end);
    var catOpts = Grind.cats.filter(function (c) { return c.id !== "free"; }).map(function (c) {
      return '<option value="' + c.id + '"' + (c.id === f.cat ? " selected" : "") + ">" + esc(t("cat." + c.id)) + "</option>";
    }).join("");
    var room = "";
    if (f.key === "room") {
      room = '<div class="field"><label for="pf-room">' + esc(t("plan.room")) + '</label><select id="pf-room">' + ROOMS.map(function (r) {
        return '<option value="' + r + '"' + (r === f.arg ? " selected" : "") + ">" + esc(t("room." + r)) + "</option>";
      }).join("") + "</select></div>";
    }
    var notes = "";
    if (sheet.error) notes += '<div class="warn-box" role="alert">' + esc(sheet.error) + "</div>";
    if (sheet.warn) notes += '<div class="warn-box" role="alert">' + esc(t("plan.conflict", { list: sheet.warn.join("; ") })) + "</div>";
    if (e > toMin(S.settings.bedtime)) notes += '<p class="hint">' + esc(t("plan.pastBed", { time: S.settings.bedtime })) + "</p>";
    var back = (!edit && !sheet.custom) ? '<button class="back" data-act="sheetBack">' + esc(t("plan.back")) + "</button>" : "";
    return back +
      '<div class="field"><label for="pf-title">' + esc(t("plan.title")) + '</label><input id="pf-title" type="text" value="' + esc(f.title) + '" placeholder="' + esc(t("plan.titlePlaceholder")) + '" maxlength="80" autocomplete="off"></div>' +
      room +
      '<div class="field"><label for="pf-cat">' + esc(t("plan.category")) + '</label><select id="pf-cat">' + catOpts + "</select></div>" +
      '<div class="times"><div class="field"><label for="pf-start">' + esc(t("plan.start")) + '</label><input id="pf-start" type="time" step="300" value="' + esc(f.start) + '"></div>' +
      '<div class="field"><label for="pf-end">' + esc(t("plan.end")) + '</label><input id="pf-end" type="time" step="300" value="' + esc(f.end) + '"></div></div>' +
      (e > s ? '<p class="hint">' + esc(t("plan.duration", { time: dur(e - s) })) + "</p>" : "") +
      '<div class="field"><span class="lab">' + esc(edit ? t("plan.alsoAdd") : t("plan.days")) + '</span><div class="chips">' + chipsHtml() + "</div></div>" +
      notes +
      '<div class="sheet-actions"><button class="btn" data-act="saveSheet">' + esc(sheet.armed ? t("plan.replace") : (edit ? t("plan.save") : t("plan.addBtn"))) + "</button>" +
      (edit ? '<button class="btn danger" data-act="deleteEvent">' + esc(t("plan.delete")) + "</button>" : "") +
      '<button class="btn ghost" data-act="closeSheet">' + esc(t("plan.cancel")) + "</button></div>";
  }
  function renderSheet() {
    document.body.classList.toggle("sheet-open", !!sheet);
    if (!sheet) { $sheet.innerHTML = ""; return; }
    var inner = (sheet.mode === "add" && sheet.step === "list") ? pickHtml() : formHtml();
    $sheet.innerHTML = '<div class="backdrop" data-act="closeSheet"></div><div class="sheet" role="dialog" aria-modal="true" aria-label="' +
      esc(sheet.mode === "edit" ? t("plan.edit") : t("plan.add")) + '"><div class="sheet-head"><h2>' + esc(sheet.mode === "edit" ? t("plan.edit") : t("plan.add")) +
      '</h2><button class="x" data-act="closeSheet" aria-label="' + esc(t("plan.close")) + '">\u00d7</button></div>' + inner + "</div>";
  }
  function saveSheet() {
    var f = sheet.f, s = toMin(f.start), e = toMin(f.end), edit = sheet.mode === "edit";
    var name = f.title.trim();
    var targets = edit ? [f.day].concat(f.days.filter(function (d) { return d !== f.day; })) : f.days.slice();
    sheet.error = null;
    if (!name) sheet.error = t("plan.errorTitle");
    else if (!f.start || !f.end || e <= s) sheet.error = t("plan.errorTime");
    else if (!targets.length) sheet.error = t("plan.errorDays");
    if (sheet.error) { sheet.armed = false; sheet.warn = null; renderSheet(); return; }

    if (!sheet.armed) {
      var clash = [];
      targets.forEach(function (d) {
        S.blocks.forEach(function (b) {
          if (b.day !== d || b.cat === "free" || (edit && b.id === f.id)) return;
          if (toMin(b.start) < e && toMin(b.end) > s) clash.push(dayName(d, "short") + " " + title(b) + " " + b.start + "\u2013" + b.end);
        });
      });
      if (clash.length) { sheet.warn = clash; sheet.armed = true; renderSheet(); return; }
    }
    var useKey = f.key && name === defTitle(f.key, f.arg);
    targets.forEach(function (d) {
      var own = edit && d === f.day;
      if (own) S.blocks = S.blocks.filter(function (b) { return b.id !== f.id; });
      carve(d, s, e);
      var nb = { id: own ? f.id : uid(), day: d, start: f.start, end: f.end, cat: f.cat };
      if (useKey) { nb.key = f.key; if (f.arg) nb.arg = f.arg; } else nb.title = name;
      S.blocks.push(nb);
      normaliseDay(d);
    });
    save(); sheet = null; renderSheet(); toast(t("plan.saved")); render(true);
  }
  function deleteEvent() {
    var f = sheet.f;
    S.blocks = S.blocks.filter(function (b) { return b.id !== f.id; });
    normaliseDay(f.day);
    save(); sheet = null; renderSheet(); toast(t("plan.deleted")); render(true);
  }
  function fab(day) { return '<button class="fab" data-act="addEvent" data-day="' + day + '"><span aria-hidden="true">+</span> ' + esc(t("plan.add")) + "</button>"; }

  /* ---------- sleep: cycles, REM windows, circadian anchors ---------- */
  /* Typical share of each cycle spent in deep sleep and REM. Early cycles are deep-heavy, late cycles REM-heavy. */
  var REM_SHARE = [0.10, 0.17, 0.23, 0.27, 0.30, 0.33];
  var DEEP_SHARE = [0.30, 0.25, 0.15, 0.08, 0.04, 0.02];
  function wrap(m) { return ((Math.round(m) % 1440) + 1440) % 1440; }
  function circ(a, b) { var d = Math.abs(wrap(a) - wrap(b)); return Math.min(d, 1440 - d); }
  function wakeOf(day) { var bl = blocksFor(day); return bl.length ? toMin(bl[0].start) : 420; }
  function cfg() { return { lat: S.settings.sleep.latency, cyc: S.settings.sleep.cycle }; }
  function wakeTimes(bed) {
    var c = cfg();
    return [4, 5, 6].map(function (n) { return { n: n, sleep: n * c.cyc, wake: wrap(bed + c.lat + n * c.cyc) }; });
  }
  function bedTimes(wake) {
    var c = cfg();
    return [6, 5, 4].map(function (n) { return { n: n, sleep: n * c.cyc, bed: wrap(wake - n * c.cyc - c.lat), wake: wake }; });
  }
  function bedHint() {
    var n = nowInfo(), tm = (n.day + 1) % 7, W = wakeOf(tm), cur = toMin(S.settings.bedtime);
    var best = bedTimes(W).filter(function (o) { return o.n >= 5; })
      .sort(function (a, b) { return circ(a.bed, cur) - circ(b.bed, cur); })[0];
    if (circ(best.bed, cur) <= 10) return t("sleep.fits", { wake: toStr(W) });
    return t("sleep.tomorrow", { wake: toStr(W), bed: toStr(best.bed) });
  }
  function stageSegs(i, L) {
    var k = Math.min(i - 1, 5), rem = REM_SHARE[k] * L, deep = DEEP_SHARE[k] * L, light = L - rem - deep;
    return { rem: rem, parts: [["light", light * 0.4], ["deep", deep], ["light", light * 0.6], ["rem", rem]] };
  }
  function optRow(big, line, tags, extra) {
    return big + '<span class="opt-txt"><span>' + esc(line) + "</span>" + (tags ? "<small>" + esc(tags) + "</small>" : "") + "</span>" + (extra || "");
  }

  function viewSleep() {
    var c = cfg(), n = nowInfo();
    if (sleepUI.day == null) sleepUI.day = (n.day + 1) % 7;
    var B = toMin(S.settings.bedtime), W = wakeOf(sleepUI.day);
    var dn = dayName(sleepUI.day, "long");

    var wakeRows = wakeTimes(B), nearest = wakeRows.slice().sort(function (a, b) { return circ(a.wake, W) - circ(b.wake, W); })[0];
    var wakeList = wakeRows.map(function (o) {
      var tags = [o.sleep >= 420 ? t("sleep.enough") : t("sleep.short")];
      if (o === nearest && circ(o.wake, W) <= 45) tags.push(t("sleep.closest", { day: dn }));
      return '<li class="opt">' + optRow('<b class="big">' + toStr(o.wake) + "</b>", t("sleep.cycles", { n: o.n }) + ", " + dur(o.sleep), tags.join(", ")) + "</li>";
    }).join("");

    var chips = [0, 1, 2, 3, 4, 5, 6].map(function (d) {
      return '<button class="chip" data-act="sleepDay" data-day="' + d + '" aria-pressed="' + (d === sleepUI.day) + '">' + esc(dayName(d, "short")) + "</button>";
    }).join("");
    var bedRows = bedTimes(W), sel = bedRows.filter(function (o) { return o.n === sleepUI.n; })[0] || bedRows[1];
    var bedList = bedRows.map(function (o) {
      var tags = o.sleep >= 420 ? t("sleep.enough") : t("sleep.short");
      return '<li><button class="opt pick" data-act="sleepN" data-n="' + o.n + '" aria-pressed="' + (o === sel) + '">' +
        optRow('<b class="big">' + toStr(o.bed) + "</b>", t("sleep.cycles", { n: o.n }) + ", " + dur(o.sleep), t("sleep.wakeAt", { time: toStr(o.wake) }) + ", " + tags) + "</button></li>";
    }).join("");

    /* night timeline for the selected bedtime */
    var onset = sel.bed + c.lat, rows = "";
    for (var i = 1; i <= sel.n; i++) {
      var st = onset + (i - 1) * c.cyc, seg = stageSegs(i, c.cyc);
      var remStart = wrap(st + c.cyc - seg.rem), end = wrap(st + c.cyc);
      var bar = seg.parts.map(function (p) { return '<i class="st ' + p[0] + '" style="flex:' + p[1].toFixed(2) + '"></i>'; }).join("");
      rows += '<li class="cyc"><div class="cyc-head"><b>' + esc(t("sleep.cycleN", { n: i })) + "</b><span>" + toStr(wrap(st)) + "\u2013" + toStr(end) + "</span></div>" +
        '<div class="cyc-bar">' + bar + "</div><small>" + esc(t("sleep.remAt", { range: toStr(remStart) + "\u2013" + toStr(end) })) + "</small></li>";
    }
    var legend = '<ul class="legend"><li><i class="sw st light"></i>' + esc(t("sleep.light")) + '</li><li><i class="sw st deep"></i>' + esc(t("sleep.deep")) +
      '</li><li><i class="sw st rem"></i>' + esc(t("sleep.rem")) + "</li></ul>";

    /* circadian anchors and weekday/weekend drift */
    var wd = (wakeOf(0) + wakeOf(1) + wakeOf(2) + wakeOf(3) + wakeOf(4)) / 5, we = (wakeOf(5) + wakeOf(6)) / 2, diff = Math.round(we - wd);
    var drift = diff > 60
      ? t("sleep.drift", { x: dur(diff), time: toStr(Math.round((wd + 60) / 5) * 5) })
      : t("sleep.aligned");
    var anchors = "<ul class=\"anchors\"><li>" + esc(t("sleep.daylight", { from: toStr(W), to: toStr(wrap(W + 60)) })) + "</li><li>" +
      esc(t("sleep.caffeine", { time: toStr(wrap(sel.bed - 480)) })) + "</li><li>" + esc(t("sleep.winddown", { time: toStr(wrap(sel.bed - 60)) })) +
      "</li></ul><p class=\"drift\">" + esc(drift) + "</p>";

    var latOpts = [5, 10, 15, 20, 30].map(function (v) { return '<option value="' + v + '"' + (v === c.lat ? " selected" : "") + ">" + v + " " + t("min") + "</option>"; }).join("");
    var cycOpts = [80, 85, 90, 95, 100, 105, 110].map(function (v) { return '<option value="' + v + '"' + (v === c.cyc ? " selected" : "") + ">" + v + " " + t("min") + "</option>"; }).join("");

    return '<header class="top"><h1>' + esc(t("sleep.title")) + '</h1><p class="date">' + esc(t("sleep.intro")) + "</p></header>" +
      '<section class="panel"><label for="sleepBed">' + esc(t("sleep.bedtime")) + '</label><input id="sleepBed" type="time" value="' + esc(S.settings.bedtime) + '">' +
      "<small>" + esc(t("sleep.bedtimeHelp", { bed: toStr(B), onset: toStr(wrap(B + c.lat)) })) + "</small>" +
      "<h3>" + esc(t("sleep.wakeTitle")) + '</h3><ul class="opts">' + wakeList + "</ul></section>" +
      '<section class="panel"><h3>' + esc(t("sleep.bestFor")) + '</h3><div class="chips">' + chips + '</div><ul class="opts">' + bedList + "</ul>" +
      '<button class="btn" data-act="applyBed">' + esc(t("sleep.useBed")) + "</button></section>" +
      '<section class="panel"><h3>' + esc(t("sleep.night")) + "</h3>" + legend + '<ol class="cycles">' + rows + "</ol><small>" + esc(t("sleep.lastRem")) + "</small></section>" +
      '<section class="panel"><h3>' + esc(t("sleep.anchors")) + "</h3>" + anchors + "</section>" +
      '<section class="panel"><h3>' + esc(t("sleep.tune")) + '</h3><label for="sleepLat">' + esc(t("sleep.latency")) + '</label><select id="sleepLat">' + latOpts + "</select>" +
      '<label for="sleepCyc">' + esc(t("sleep.cycleLen")) + '</label><select id="sleepCyc">' + cycOpts + "</select></section>" +
      '<p class="foot">' + esc(t("sleep.caveat")) + "</p>";
  }

  var ICONS = {
    today: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 7v5l3 2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    week: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4v16M10 4v16M15 4v16M20 4v16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-dasharray="7 3"/></svg>',
    sleep: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
    settings: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h9M17 8h3M4 16h3M11 16h9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="15" cy="8" r="2.2" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="9" cy="16" r="2.2" fill="none" stroke="currentColor" stroke-width="2"/></svg>'
  };
  function renderTabs() {
    var cur = ui.view === "day" ? "week" : ui.view;
    $tabs.innerHTML = ["today", "week", "sleep", "settings"].map(function (v) {
      return '<button data-act="nav" data-view="' + v + '"' + (cur === v ? ' aria-current="page"' : "") + ">" + ICONS[v] + "<span>" + esc(t("nav." + v)) + "</span></button>";
    }).join("");
  }

  function render(keepScroll) {
    var y = window.scrollY;
    Grind.i18n.setLang(S.settings.lang);
    document.documentElement.lang = S.settings.lang;
    var html = ui.view === "week" ? viewWeek() : ui.view === "day" ? viewDay() : ui.view === "settings" ? viewSettings() : ui.view === "sleep" ? viewSleep() : viewToday();
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
    else if (act === "addEvent") openAdd(+el.dataset.day, null);
    else if (act === "addAt") { var fb = S.blocks.filter(function (x) { return x.id === el.dataset.id; })[0]; if (fb) openAdd(fb.day, { start: fb.start, end: fb.end }); }
    else if (act === "edit") openEdit(el.dataset.id);
    else if (act === "closeSheet") closeSheet();
    else if (act === "sheetTab") {
      if (el.dataset.tab === "custom") { sheet.step = "form"; sheet.custom = true; sheet.f = formFrom(null, sheet.day, sheet.slot); renderSheet(); var ti = document.getElementById("pf-title"); if (ti) ti.focus(); }
    }
    else if (act === "pickTpl") { sheet.step = "form"; sheet.custom = false; sheet.f = formFrom(TEMPLATES[+el.dataset.i], sheet.day, sheet.slot); renderSheet(); }
    else if (act === "sheetBack") { sheet.step = "list"; sheet.f = null; sheet.warn = null; sheet.armed = false; sheet.error = null; renderSheet(); }
    else if (act === "sheetDay") {
      var dd = +el.dataset.day, arr = sheet.f.days, ix = arr.indexOf(dd);
      if (ix === -1) arr.push(dd); else arr.splice(ix, 1);
      sheet.armed = false; sheet.warn = null; sheet.error = null; renderSheet();
    }
    else if (act === "saveSheet") saveSheet();
    else if (act === "deleteEvent") deleteEvent();
    else if (act === "resetDay") {
      if (window.confirm(t("plan.resetDayConfirm"))) {
        var dday = ui.day;
        S.blocks = S.blocks.filter(function (b) { return b.day !== dday; }).concat(clone(Grind.seed.filter(function (b) { return b.day === dday; })));
        save(); toast(t("plan.dayReset")); render(true);
      }
    }
    else if (act === "sleepDay") { sleepUI.day = +el.dataset.day; render(true); }
    else if (act === "sleepN") { sleepUI.n = +el.dataset.n; render(true); }
    else if (act === "applyBed") {
      var W = wakeOf(sleepUI.day), o = bedTimes(W).filter(function (x) { return x.n === sleepUI.n; })[0];
      if (o) { S.settings.bedtime = toStr(o.bed); save(); toast(t("sleep.applied", { time: toStr(o.bed) })); render(true); }
    }
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
  document.addEventListener("input", function (e) {
    if (sheet && sheet.f && e.target.id === "pf-title") { sheet.f.title = e.target.value; sheet.armed = false; sheet.warn = null; }
  });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && sheet) closeSheet(); });
  document.addEventListener("change", function (e) {
    if (sheet && sheet.f) {
      var f = sheet.f, id = e.target.id, touched = true;
      if (id === "pf-cat") f.cat = e.target.value;
      else if (id === "pf-room") {
        var wasDefault = f.title === defTitle(f.key, f.arg); f.arg = e.target.value; if (wasDefault) f.title = defTitle(f.key, f.arg);
      }
      else if (id === "pf-start") f.start = e.target.value;
      else if (id === "pf-end") f.end = e.target.value;
      else touched = false;
      if (touched) { sheet.armed = false; sheet.warn = null; sheet.error = null; renderSheet(); return; }
    }
    if (e.target.id === "lang") { S.settings.lang = e.target.value; save(); render(true); }
    else if (e.target.id === "bedtime" && /^\d\d:\d\d$/.test(e.target.value)) { S.settings.bedtime = e.target.value; save(); }
    else if (e.target.id === "sleepBed" && /^\d\d:\d\d$/.test(e.target.value)) { S.settings.bedtime = e.target.value; save(); render(true); }
    else if (e.target.id === "sleepLat") { S.settings.sleep.latency = +e.target.value; save(); render(true); }
    else if (e.target.id === "sleepCyc") { S.settings.sleep.cycle = +e.target.value; save(); render(true); }
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
