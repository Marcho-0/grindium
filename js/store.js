/* Local storage with validation. Everything stays on the device. */
window.Grind = window.Grind || {};
Grind.store = (function () {
  var KEY = "grind.v1";
  var ok = true;
  var catIds = Grind.cats.map(function (c) { return c.id; });

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function fresh() {
    return {
      v: 1,
      blocks: clone(Grind.seed),
      log: {},
      settings: { lang: Grind.i18n.detect(), bedtime: "22:30", installDismissed: false, sleep: { latency: 15, cycle: 90 } },
      lastBackup: null
    };
  }

  function validate(o) {
    if (!o || o.v !== 1 || !Array.isArray(o.blocks) || o.blocks.length === 0) return false;
    var time = /^\d\d:\d\d$/;
    var good = o.blocks.every(function (b) {
      return b && typeof b.id === "string" && Number.isInteger(b.day) && b.day >= 0 && b.day <= 6 &&
        time.test(b.start || "") && time.test(b.end || "") && b.start < b.end &&
        catIds.indexOf(b.cat) !== -1 && (typeof b.key === "string" || typeof b.title === "string");
    });
    if (!good) return false;
    if (o.log != null && typeof o.log !== "object") return false;
    return true;
  }

  function normalise(o) {
    var base = fresh();
    o.log = o.log || {};
    o.settings = Object.assign(base.settings, o.settings || {});
    if (!/^\d\d:\d\d$/.test(o.settings.bedtime)) o.settings.bedtime = "22:30";
    if (o.settings.lang !== "en" && o.settings.lang !== "pl") o.settings.lang = base.settings.lang;
    var sl = Object.assign({ latency: 15, cycle: 90 }, o.settings.sleep || {});
    sl.latency = Math.min(45, Math.max(0, +sl.latency || 15));
    sl.cycle = Math.min(120, Math.max(60, +sl.cycle || 90));
    o.settings.sleep = sl;
    o.lastBackup = typeof o.lastBackup === "number" ? o.lastBackup : null;
    return o;
  }

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) {
        var s = JSON.parse(raw);
        if (validate(s)) return normalise(s);
      }
    } catch (e) { ok = false; }
    return fresh();
  }

  function prune(state) {
    var keys = Object.keys(state.log).sort();
    while (keys.length > 90) delete state.log[keys.shift()];
  }

  function save(state) {
    try {
      prune(state);
      localStorage.setItem(KEY, JSON.stringify(state));
      ok = true;
    } catch (e) { ok = false; }
    return ok;
  }

  return {
    load: load, save: save, fresh: fresh, validate: validate, normalise: normalise,
    ok: function () { return ok; }
  };
})();
