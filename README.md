<p align="center">
  <img src=".github/assets/banner.png" alt="notToday: a pixel blackbird holding a blue cup, next to the app name" width="100%" />
</p>

<p align="center">
  <a href="https://github.com/EthanRodrigues001/nottoday/releases/latest"><img alt="Latest release" height="16" src="https://shieldcn.dev/github/release/EthanRodrigues001/nottoday.svg?variant=secondary&size=xs&height=16" /></a>
  <a href="https://github.com/EthanRodrigues001/nottoday/releases"><img alt="Downloads" height="16" src="https://shieldcn.dev/github/dt/EthanRodrigues001/nottoday.svg?variant=secondary&size=xs&height=16" /></a>
  <a href="https://github.com/EthanRodrigues001/nottoday/commits/main"><img alt="Last commit" height="16" src="https://shieldcn.dev/github/last-commit/EthanRodrigues001/nottoday.svg?variant=secondary&size=xs&height=16" /></a>
  <a href="#install"><img alt="Android" height="16" src="https://shieldcn.dev/badge/Android-APK-3ddc84.svg?logo=android&variant=secondary&size=xs&height=16" /></a>
  <a href="https://expo.dev"><img alt="Expo SDK 58" height="16" src="https://shieldcn.dev/badge/Expo-SDK%2058-000020.svg?logo=expo&variant=secondary&size=xs&height=16" /></a>
</p>

<p align="center">
  <b>notToday</b> is a daily planner for Android that shows what is due today, lets you push the rest off with one gesture, and counts every day a task slipped.<br/>
  It also reads your WhatsApp notifications on the phone and suggests deadlines and birthdays, which you accept or dismiss.
</p>

<p align="center">
  <a href="#install">Install</a> ·
  <a href="#features">Features</a> ·
  <a href="#whatsapp-suggestions">WhatsApp</a> ·
  <a href="#privacy">Privacy</a> ·
  <a href="#develop">Develop</a> ·
  <a href="#credits-and-licence">Credits</a>
</p>

---

## Why notToday

Most planners let an unfinished task sit there, overdue and ignored. notToday makes slipping visible and makes deferring a decision.

- **A task lives on one day.** Today shows only what is due today. Anything unfinished rolls to the next day and gains a **slip**, shown on the row. At three slips the row asks you to decide.
- **Deferring is one gesture.** *Not today* sends a task to tomorrow, a day you pick, or *Someday*. Swipe left, or drag the task to the target at the bottom.
- **It finds work you would forget.** Deadlines and birthdays in WhatsApp messages turn into suggestions. Nothing is added until you tap Add.

notToday does not sync, has no account, and has no iOS version, because iOS cannot read other apps' notifications.

> [!NOTE]
> **Status:** a personal project, currently version 1.0.2, built and used on one phone (Infinix HOT 20 5G). Live WhatsApp scanning and reminders have not been tested across other Android makers; some ROMs kill background services, so the app shows a banner when scanning has gone quiet.

## Install

notToday is for **Android** and is distributed as an APK, not through the Play Store.

1. Download **`notToday-1.0.2.apk`** from the [latest release](https://github.com/EthanRodrigues001/nottoday/releases/latest).
2. Open it and allow your browser or file manager to install unknown apps when Android asks.
3. Open notToday. For WhatsApp suggestions, go to **Settings** and grant notification access.

The app looks for a newer release when it opens (at most every six hours) and under **Settings → About → Check for updates**. It downloads the APK and hands it to Android's installer.

> [!IMPORTANT]
> Updates only install over an older copy if both are signed with the same key. Every release is signed with one key. If you build the app yourself, your build has a different signature and cannot update over this APK, or the other way round; uninstall first, which erases the app's data, so use *Back up* in Settings before that.

## Features

- **Today.** One list in your own order, a week strip with a progress ring per day, birthdays at the top, and finished tasks folded into *Done*. The first task of the day is the top priority and is marked, so dragging reorders priority.
- **Gestures.** Swipe right to finish, swipe left for *Not today*, press and hold to lift a task and drag it to *Not today* or *Delete*. Everything has an Undo.
- **Repeats.** Daily, weekly, monthly or yearly, with a gap such as every 3 days. Counted from the first day, so *the 31st* does not drift.
- **Birthdays.** Yearly, with an optional birth year ("turns 21") and a *Wished* mark that resets each year. An unwished birthday stays on Today for three more days.
- **Later and Calendar.** *Someday* tasks and birthdays on one tab, and a month calendar to see or add to any day.
- **Reminders.** A morning digest at 08:00 and an evening nudge at 20:00 if something due today is still open. Both times are editable in Settings. No notification per WhatsApp message.
- **Backup.** Export everything to a JSON file and restore it later.

## WhatsApp suggestions

The **Inbox** tab holds possible tasks and birthdays found in your messages, and a badge shows how many are waiting.

- **Live.** A small Android notification service keeps only WhatsApp (and WhatsApp Business) notifications, and drops every other app's before reading its text. Messages are scored on the phone by hand-written rules for deadline words and dates in English, Hinglish and Hindi, plus a small model that learns from what you accept and dismiss.
- **History.** *Settings → Import chat exports* takes several exported `.txt` chats at once and finds deadlines ahead and birthdays you wished.
- **Control.** Each chat has a switch in Settings, and *Never from this chat* is on every suggestion. Dates are resolved from when the message was sent, and you can edit the title and date before adding.

## Privacy

Everything stays on the phone: tasks, birthdays and WhatsApp data are in a local SQLite database, with no account, analytics or server.

- **Notifications:** only WhatsApp's are kept. Message text is kept for 14 days by default and then deleted (you can shorten it in Settings). Accepted suggestions keep a short snippet. Message text is not logged.
- **Media:** imports read chat text only and skip files over about 50 MB; the app never reads WhatsApp's media or database.
- **Network:** the only request is the update check to `api.github.com`, plus the APK download when you choose to update.
- **Uninstalling erases your data.** Back up first.

## Develop

```bash
npm install
npx expo prebuild --platform android   # native code is generated, not committed
npx expo run:android                   # needs a development build; Expo Go lacks the WhatsApp module
npm run typecheck
npm run lint
npm test                               # 179 tests for the planner, dates, repeats, classifier, import and updates
```

Expo SDK 58, React Native 0.88, React 19, expo-router, expo-sqlite, Reanimated and Gesture Handler. Layout:

- `src/app/`: screens (Today, Inbox, Later, Calendar, Settings, Import, update) and sheets.
- `src/domain/`: pure TypeScript logic with `node:test` tests next to it (`planner.ts`, `repeat.ts`, `birthdays.ts`, `message-date.ts`, `classifier.ts`, `naive-bayes.ts`, `chat-export.ts`).
- `src/whatsapp/`: the notification queue reader, ingest pipeline and chat repository.
- `modules/whatsapp-listener/`: the Kotlin notification service as a local Expo module.
- `plugins/with-release-signing.js`: signs release builds with a key kept outside the repository.
- `docs/decisions.md` and `GLOSSARY.md`: the decisions and the words used for them.

On Windows, build from a short path such as `D:\nt`; the C++ steps fail on long project paths.

**Releasing:** raise `version` and `android.versionCode` in `app.json`, run `gradlew assembleRelease` in `android/`, and publish a GitHub release tagged `v<version>` with the APK attached.

Bugs and ideas go in [Issues](https://github.com/EthanRodrigues001/nottoday/issues).

## Credits and licence

No licence is declared yet, so the code is all rights reserved by default.

- Built in [T3 Code](https://t3.codes).
- Typefaces: Inter and Instrument Serif through `@expo-google-fonts` (both SIL Open Font License).
- Icons: Material icons through `@expo/vector-icons`.
- Badges by [shieldcn](https://shieldcn.dev).
