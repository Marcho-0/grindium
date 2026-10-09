# Grind

A phone-first daily planner. It shows what you should be doing right now, what is next, how much free time is left today, and your whole week at a glance. Runs as an installable web app (PWA). No account, no server, no tracking: everything stays on your phone.

**Version 0.1:** Today, Week and Settings screens, your seeded weekly schedule, done/skip tracking, English and Polish, light and dark mode, offline use, backup export/import.

## Your data

Stored in the phone's local storage. Browsers can clear it under storage pressure, so use **Settings, Export backup** now and then. The app nudges you after a week without a backup.

## Project layout

| File | Purpose |
|---|---|
| `index.html` | App shell |
| `css/styles.css` | All styling, light and dark |
| `js/seed.js` | Default weekly schedule and categories |
| `js/i18n.js` | All text, English and Polish |
| `js/store.js` | Saving, loading, validating |
| `js/app.js` | Screens and behaviour |
| `sw.js`, `manifest.webmanifest`, `icons/` | Offline and install support |

To test locally: `python3 -m http.server` in this folder, then open `http://localhost:8000`.

## Roadmap

- **v0.2:** edit blocks, quota tasks with progress (gym 2/4), "running late" shifting, Budget screen with free-time protection
- **v0.3:** timers and actual versus planned, day modes (light day, sick day, day off), calendar export with alarms
- **Later:** chained tasks, hobby blocks, stats
