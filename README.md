# Grind

A phone-first daily planner. It shows what you should be doing right now, what is next, how much free time is left today, and your whole week at a glance. Runs as an installable web app (PWA). No account, no server, no tracking: everything stays on your phone.

**Version 0.1:** Today, Week and Settings screens, your seeded weekly schedule, done/skip tracking, English and Polish, light and dark mode, offline use, backup export/import.

## Put it on GitHub and onto your home screen

1. Create a new repository on GitHub (public is fine, and required for Pages on free accounts).
2. Upload **the contents of this folder** to the repository root, so `index.html` sits at the top level, not inside a subfolder.
3. In the repository go to **Settings, Pages**. Under *Build and deployment* choose **Deploy from a branch**, pick `main` and `/ (root)`, and save.
4. After a minute your app is live at `https://<your-username>.github.io/<repository-name>/`.
5. Open that address on your phone:
   - **iPhone (Safari):** Share button, then **Add to Home Screen**.
   - **Android (Chrome):** menu, then **Install app** (or tap the Install button inside Grind).
6. **Use the installed icon from now on.** On iPhone the installed app has its own storage, so anything you tapped in the browser does not carry over.

## Updating the app

Edit the files, commit, and bump the version in `sw.js` (`const CACHE = "grind-v0.1.1"`). Phones pick up the new files the next time the app opens, usually after one extra launch.

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
