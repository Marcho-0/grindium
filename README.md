# Grind

A phone-first daily planner. It shows what you should be doing right now, what is next, how much free time is left today, and your whole week at a glance. Runs as an installable web app (PWA). No account, no server, no tracking: everything stays on your phone.

**Version 0.2.0:** Today, Week, Sleep and Settings screens, a full planner (edit, add, delete), your seeded weekly schedule, done/skip tracking, English and Polish, light and dark mode, offline use, backup export/import.

## Planner

Every block is editable, and changes are saved on the phone.

- **Edit:** tap any block on Today or on a day (Week, then tap a day). Change title, category, start and end, copy it to other days, or delete it.
- **Add:** tap the **Add event** button, or tap a free-time slot to add something right there. Choose a **Prepared** event (26 ready-made ones: gym, groceries, laundry steps, room cleaning, study, hobby, meal prep, vet visit, and more) or create a **Custom** one with your own title and category.
- **Overlaps:** adding or moving an event over existing blocks shows a warning first. Confirm and the covered blocks are shortened, split or removed.
- **Free time** is handled automatically: deleting an event frees its time, and adding one takes time out of free slots.
- **Reset this day** restores one day to the default schedule. Past your bedtime? You get a soft note, not a block.

## Sleep tab

Helps you pick a bedtime and wake-up time that land on the end of a sleep cycle, so you are less likely to wake up groggy.

- Wake-up times for your bedtime (4, 5 and 6 cycles), and the best bedtime for any day's wake-up taken from your schedule. One tap sets it as your bedtime.
- A night timeline with light sleep, deep sleep and REM (dream) windows per cycle.
- Circadian anchors: morning daylight window, last caffeine, wind-down start, and a check on how far your weekend wake-up drifts from weekdays.
- Fine-tune the time you take to fall asleep and your cycle length (default 15 min and 90 min).

These are estimates from an average cycle. The app cannot measure your sleep, and real cycles vary from night to night.

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

Edit the files, commit, and bump the version in `sw.js` (`const CACHE = "grind-v0.2.1"`). Phones pick up the new files the next time the app opens, usually after one extra launch.

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

- **v0.2.x:** quota tasks with progress (gym 2/4), "running late" shifting, Budget screen with free-time protection
- **v0.3:** timers and actual versus planned, day modes (light day, sick day, day off), calendar export with alarms
- **Later:** chained tasks, hobby blocks, stats
