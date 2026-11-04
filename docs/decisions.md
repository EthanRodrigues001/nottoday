# NotToday: settled decisions (grilling session, in progress)

Vocabulary is in `../GLOSSARY.md`. Expo and UI facts are in `expo-notes.md`. UI images are in `../references/ui/`, the ASCII header code is `../references/GradientASCII.tsx`.

## Problem

One person (the user) has study, work, job applications and fun projects, and does not follow through. They want a daily planner that makes slipping visible, remembers birthdays every year, and finds assignments in WhatsApp messages without any external AI service. Keep the app light.

## Settled

- **Platform**: Android only, latest Expo SDK, Expo dev build (not Expo Go). iOS cannot read other apps' notifications.
- **Storage**: local-only SQLite. No account, no cloud. JSON export/import for backup.
- **WhatsApp ingestion**: (a) Android notification listener for live messages, plus (b) WhatsApp "Export chat" import for history and training. No linked-device client. WhatsApp's own database cannot be read (private storage, encrypted backups).
- **Chats scanned**: every chat except muted and archived ones.
- **Classifier**: TypeScript, on-device. Hand-written rules (deadline words, date and time extraction) plus a small naive Bayes or logistic regression model that learns from the user's Inbox taps. No Rust, no neural net, no external AI. Speed is not a concern (microseconds per message).
- **Suggestions never become Tasks on their own.** They land in the Inbox; the user accepts or dismisses with one tap. Dismissing teaches the model.
- **Suggestion types**: deadline task (assignments are just deadline tasks) and birthday.
- **Not today**: choices are Tomorrow, Pick a date, Someday. An undone Task rolls to the next day by itself and gains a Slip. Slip count is shown; 3 or more Slips flags the Task for a decision.
- **Birthdays**: yearly repeating entry shown on its day in Today, with a Wished mark that resets each year. "happy birthday" messages the user sent (from an export) can propose a birthday entry via the Inbox.
- **Reminders**: one morning digest at a chosen time, plus one evening nudge if something due today is open. No notification per detected message.
- **Recurrence**: birthdays only in version 1. No general repeating tasks.
- **UI**: references chosen (see `expo-notes.md`). Decisions about libraries and drag-and-drop are made when building.
- **Training flow** (user delegated the call): no up-front labelling. Only the user's own Inbox taps train the model (ground truth). An imported export fills history only and never trains the model on rule guesses. Saved recent messages let the user mark a missed assignment afterwards.
- **ASCII header**: run `references/GradientASCII.tsx` as an Expo DOM component (`"use dom"`) in the header only, low speed, no repeating intro, still when backgrounded. Revisit with a Skia port only if it is slow on the user's phone.
- **Today screen**: one list in the user's drag order. Week strip on top (refs 01, 04), optional time on a task, done tasks drop into a collapsed "Done" section at the bottom (no Completed/Pending tabs), birthdays at the top of the list with the Wished check. No Morning/Workload/Night groups.
- **Drag to bottom**: dragging a task toward the bottom of the screen exposes "Not today" and "Delete" targets.
- **Week strip**: past days and today show a ring of how much of that day's list is done; future days with items show a small dot. Tapping a day opens that day's list.
- **Add**: black "+" opens a bottom sheet with title, optional day and time, defaulting to Today.
- **Subtasks**: not in version 1.

- **Chats scanned (refined)**: the app cannot see WhatsApp's mute or archive state, so scanning is controlled by an in-app Chats list (every chat seen, a switch each, new chats on). Muted chats mostly never notify anyway.
- **Suggestion dates**: resolved relative to when the message was sent, not today. Shown on the Inbox card and editable. A suggestion with no date becomes a Someday task if accepted.
- **Drag-to-bottom**: dropping on "Not today" moves the task to tomorrow with an Undo/Change bar; dropping on "Delete" deletes immediately with an Undo bar, no confirmation. Tapping "Not today" on a task opens the full Tomorrow / Pick a date / Someday choice. The user wants extra "cool gestures" (see Gestures below, pending approval).
- **Animation craft**: use the installed `apple-design` skill (`.claude/skills/apple-design`, from emilkowalski/skills, web-oriented, reviewed). Map it to React Native with the expo-animation skill: springs for anything touched, damping 1.0 default and about 0.8 only after a flick, hand off release velocity, interruptible motion, rubber-band at edges, momentum projection, haptics on the same frame, reduced motion respected. Use its eight design principles (purpose, agency, responsibility, familiarity, flexibility, simplicity, craft, delight) when reviewing screens.
- **Birthdays (refined)**: birth year optional (shows "turns N"); Wished stores the date; unwished birthdays stay on Today as Belated for 3 days, the Wished mark still works until the year ends.
- **Birthday names from exports**: 1:1 chats use the chat name. Group chats: try to find the name from the message by matching tokens against that chat's participant names (from the export) and capitalised names after "happy birthday" / "hbd"; if no confident match, ask.
- **Listener health**: Today shows a banner when notification access is off or the listener has been silent too long; Settings shows the time of the last message seen. See Failure modes.
- **Message retention**: scanned message text kept for 14 days then purged automatically (setting to shorten or turn off). Accepted suggestions keep a short snippet. Nothing leaves the device.
- **WhatsApp size**: the user's WhatsApp is 15 GB+ of messages and images, but only chat text is needed. The app must never copy or read media.
- **Build order**: (1) Today, tasks, Not today, drag, birthdays, reminders, no WhatsApp; (2) notification listener, rules, Inbox; (3) export import and learning model; (4) ASCII header and polish.

## Failure modes to design for (from the user's "consider all such issues")

- Notification access revoked, or listener killed by ROM battery management or force-stop: banner plus last-seen time; guide to autostart and battery settings.
- No notification is posted while the chat is open on screen, for muted chats, or when WhatsApp is in a state that suppresses it: scanning can miss messages; export import and "mark a missed one" cover this.
- WhatsApp notification shapes: grouped "N new messages" summaries, per-sender titles in groups, truncated long text, edited or deleted messages ("This message was deleted"), replays of the same notification when it updates. De-duplicate and ignore summaries.
- Own reminders: Android 13+ needs the POST_NOTIFICATIONS permission; Android 12+ exact alarms may be denied by default, so the morning digest should use an approach that works without exact-alarm permission or ask for it with a clear reason.
- Rollover: do not depend on a midnight background job. Compute rolled-over tasks and Slips when the app opens or the digest fires, from stored due dates.
- Time and dates: store a calendar date for "due day" and an optional time; handle time zone and daylight-saving changes, and the locale-dependent day/month order in exports (infer it from the file).
- Language: messages may mix languages; rules and tests must reflect what the user's chats actually contain.
- Data loss: SQLite lives in app storage and is lost on uninstall; JSON export/import is the backup.
- Notification text is sensitive: never log message text, keep it out of crash reports, no analytics.

- **Export import**: an Import screen accepting many files at once. Read only the chat text (`.txt`, or the `.txt` entry of a zip), never media. Skip any file over about 50 MB with "re-export without media". The user exports only the chats that matter (teachers, class groups, birthday people).
- **Inbox**: a tab with a badge count, also mentioned in the morning digest. Card shows chat, sender, snippet, resolved date (editable); actions Add, Dismiss, Never from this chat (turns that chat off on the Chats list).
- **Languages**: English, Hinglish (Hindi in Roman script) and Hindi (Devanagari) from the start. Tokenisation must handle Devanagari; date words need Hindi/Hinglish forms (kal, parso, aaj, agle hafte, somvar and so on), to be verified against the user's real messages.
- **Failure modes** above are accepted as requirements.
- **Gestures**: press-and-hold lifts a task and starts the drag (others part around it); drop on bottom Not today / Delete targets (they grow toward the finger); swipe right = done (check draws itself, haptic); swipe left = Not today to tomorrow with the Undo bar; week strip flicks between weeks with momentum; completing the last task of the day gives a small celebration. Swipes and drops share one Undo bar so nothing is destructive.

## Environment facts (checked 2026-10-31)

- Node 24.15, npm 11.12. Java on PATH is 1.8, but a local Android build needs JDK 17+, so install or point to a newer JDK before step 2 (dev build). Android SDK folders exist under `%LOCALAPPDATA%\Android\Sdk` (build-tools, emulator, platforms, platform-tools); `ANDROID_HOME` is not set and `adb` is not on PATH.
- Step 1 does not need a native build; it can run in Expo Go on the phone.

## Status

Grilling complete; every branch settled. Open items to resolve during build, not before: exact drag-reorder approach, ASCII-header performance on the phone, real-message tests for the classifier.

### Build step 1 progress (Expo SDK 58, RN 0.88, Reanimated 4.7, RNGH 3.3 hooks API)

Done and checked with `npx tsc --noEmit`, `npx expo lint`, `npm test` (25 passing) and `npx expo export --platform android` (bundles). Not yet run on a phone.
- `src/domain/`: `dates.ts`, `planner.ts` (create, complete, reopen, defer, delete, reorder, lazy roll-over with Slips, day progress for the rings, 3-slip flag), `birthdays.ts` (yearly occurrence, 29 Feb on 28 Feb in non-leap years, Belated for 3 days, upcoming, wishes). Pure TypeScript with `node:test` tests next to each file.
- `src/db/database.ts`: expo-sqlite schema (tasks, day_entries, birthdays, wishes) and whole-snapshot load/save in one transaction.
- `src/store/app-store.tsx`: context store, serialised saves, roll-over on open and on returning to the app on a new day, one-step Undo.
- Screens: Today (blue header, week strip with rings and dots, birthdays with Wish button, swipeable task rows, collapsed Done section), Later (Someday and Birthdays with add form), Add sheet, Task sheet (Not today: tomorrow, next days, Someday, delete). Floating pill tab bar via `expo-router/ui`, Undo bar, swipe right = done and swipe left = Not today with haptics and rubber-banding.
- Theme in `src/theme.ts`. Icons are Material (`@expo/vector-icons`) since the app is Android-only.

Not built yet in step 1: press-and-hold drag to reorder with the bottom Not today / Delete targets, the week-strip flick between weeks, last-task celebration, morning digest and evening nudge (expo-notifications is installed but not wired), a date picker beyond the next 7 days, JSON export/import backup, ASCII header (currently a plain gradient).
- Chat export parsing details (formats, languages, multi-line messages, timestamps and time zones).
- Notification-listener reliability across Android ROMs; what happens if the user revokes access.
- Data model, build order, testing approach.

### Build step 1 additions (done)

Drag-to-reorder with bottom Not today / Delete targets (`src/components/task-row.tsx`, `draggable-task-list.tsx`, `drop-zones.tsx`, `drag-state.ts`): press and hold 260 ms lifts a row (competing with the swipe pan via `useCompetingGestures`), rows part with springs, the targets grow toward the finger, drops commit with the Undo bar. Week strip flick between weeks. Celebration (success haptic and green check pop) when the last open task of today is done. Morning digest (08:00) and evening nudge (20:00) scheduled from the plan (`src/domain/digest.ts`, `src/notifications/reminders.ts`); Android falls back to inexact alarms when exact alarms are not allowed, so no extra permission. Still not built: a full date picker, JSON backup/restore, editable reminder times. All gesture code is untested on a device and needs a feel-check (long-press vs scroll, drop-target position).

### Build step 2 progress

- **Own native module instead of a library.** `expo-notification-listener` 0.1.x was tried and removed: its Kotlin does not compile on SDK 58 / RN 0.88 (`HeadlessJsTaskService` unresolved), and it hands every app's notifications to JavaScript. Replaced by a local Expo module, `modules/whatsapp-listener` (Kotlin, `compileDebugKotlin` verified): `WhatsAppNotificationService` keeps only `com.whatsapp` / `com.whatsapp.w4b` notifications and appends them as JSON lines to a private file (`QueueStore`, capped at 2 MB, oldest dropped first); other apps' notifications are dropped natively before their text is read. No headless JS task, so no JS engine start per notification. The module's manifest declares the service, so no config plugin is needed. JS side: `modules/whatsapp-listener/src/index.ts` (`requireOptionalNativeModule`, so Expo Go still opens the planner), `src/whatsapp/queue.ts` (parse a queue line), `src/whatsapp/drain.ts` (read the queue and run the ingest pipeline). The Inbox provider drains the queue every 5 s while the app is open and when it returns to the foreground; while the app is closed the queue just accumulates, so new Inbox items appear when the app is next opened (and the morning digest only counts items already read).

- Pure logic with tests: `src/domain/text.ts`, `message-date.ts` (English, Hinglish, Devanagari dates and times, resolved against the day the message was sent), `classifier.ts` (deadline score, birthday wishes and names), `whatsapp.ts` (notification parsing, summaries, deleted, reactions, media, duplicates), `suggestion-title.ts`, `src/whatsapp/ingest.ts` (pipeline against a `Repo` interface; tested with an in-memory fake).
- Storage: `src/whatsapp/repository.ts` (chats, messages, suggestions, meta tables created with the main schema; 14-day purge; retention setting).
- UI: Inbox tab with badge (edit title or name, change date with day chips, Add / Dismiss / Never from this chat), Settings (scanning status and last message seen, Chats list with switches, retention choices), banner on Today when notification access is off.
- Known limits and things to verify on the real phone: WhatsApp's notification layout varies, so sender/group detection in `whatsapp.ts` is heuristic (a short "Note:" prefix in a one-to-one message is read as a sender); incoming "happy birthday" in a one-to-one chat is the user's own birthday and is ignored; the user's own sent messages are never in notifications, so those only come from the export import (step 3).
- Not started: step 3 (export import, naive Bayes model learning from Inbox taps, "mark a missed one" from saved messages), step 4 (ASCII header).

### Windows build note

A full native build from `C:UsersEthan Rodrigues.t3projects
ottoday` fails in CMake for `react-native-worklets` and `react-native-screens` (`ninja: error: mkdir(...)`: Windows path length, made worse by the long project path). Build from a short path such as `C:
t` (copy or clone the repo there), or turn on Windows long paths. Gradle needs JDK 17+: Android Studio's `jbr` works (`JAVA_HOME=C:Program FilesAndroidAndroid Studiojbr`, `ANDROID_HOME=%LOCALAPPDATA%AndroidSdk`). The first full build takes about 20 minutes.

### Tested on the user's phone (Infinix HOT 20 5G, Expo Go over USB, 2026-10-31 to 2026-11-01)

Metro on port 8081 with `adb reverse tcp:8081 tcp:8081`, opened with `exp://localhost:8081`. Verified by hand and screenshots: add task, swipe right = done (ring fills, Undo bar), swipe left = Not today to tomorrow (dot appears on tomorrow), press-and-hold lifts a row and reorders, dropping on the Not today target moves the task, data survives closing the app, Inbox and Later tabs render, roll-over across midnight (task shows "slipped 1 day", yesterday's ring shows 1 of 2).

Bugs found on the phone and fixed: tab bar `TabList` must be a direct child of `Tabs` or no screens register; Android `formSheet` did not render, so Add and Task are now `presentation: 'modal'` with a close button; `selectable` task titles swallowed the long-press (text selection), so rows are not selectable; reminders threw in Expo Go (channels unsupported) and now fail quietly; the app did not notice midnight while open (now a timer to midnight plus the foreground check); white status-bar text on light screens; the selected-day ring track was invisible.

Not testable in Expo Go: WhatsApp scanning (native module), reminders, Inbox with real data, Settings notification access. Needs a development build. A local full build fails at the C++ link step for worklets and screens (undefined libc++ symbols) on this PC's NDK 27.1; EAS cloud build is the planned route. Not yet tried: Delete target, Birthdays flow, week flick, Task options sheet, celebration, 3-slip flag.

### UI refinement round (2026-11-01)

- **Typography**: Inter (Regular, Medium, Semibold, Bold) for everything you read and tap, Instrument Serif for the big screen titles (Today, Inbox, Later) and the empty-state line. Loaded in `src/app/_layout.tsx`; `src/components/text.tsx` and `text-input.tsx` map `fontWeight` to the right font file (Android needs one file per weight). The type scale in `src/theme.ts` (`display`, `title`, `headline`, `body`, `subhead`, `caption`, `overline`) follows apple-design section 15: tighter tracking and line height as size grows, near zero for body, a little open for small text. There is no dedicated typography skill in emilkowalski/skills; installed `emil-design-eng` and `animate-expo` alongside `apple-design` in `.claude/skills`.
- **Header**: one dark rounded panel (`colors.night`, 32 radius) holding the ASCII gradient (`src/components/header-backdrop.tsx`), the title, the week strip and a settings button. The earlier CSS blue gradient under the ASCII canvas was the "second gradient" and is gone; with the animation switched off a still radial glow of the same colours is used instead.
- **Tab bar**: floating dark pill, open tab is a white pill with its name, other tabs icon-only, count badge on Inbox, white round add button. Undo bar is white so it does not stack as a second dark bar.
- **Data loss fix**: tasks vanished twice after code reloads. Cause: reads and the delete-then-insert save shared one connection, so a read could land mid-save and the half-empty result was written back. Fix: `loadSnapshot` and `saveSnapshot` now run through one queue in `src/db/database.ts`, the store writes nothing until the saved data has been read, and the first load only writes back if the roll-over changed something. Held up through 3 hot reloads and 3 rapid restarts on the phone; the three test tasks that existed before the fix were lost.
- **ASCII DOM component fixes** (in `scripts/make-ascii-dom.js`, regenerate with `node scripts/make-ascii-dom.js`): container pinned to the viewport (a percentage height collapsed to a 2x2 canvas), WebGL context no longer killed on cleanup (React runs effects twice in development), shader errors and the first frame are logged.
- **File reading**: picked files are read with `fetch` (`src/lib/read-picked-file.ts`), because the new file API refuses picked paths in Expo Go.

### Calendar, drawer, details and reminder times (2026-11-01)

References 07 to 11 in `references/ui/` (kept local, not in the repository) (calendar popover, task list with a meta line, month calendar with a day list, quick-add drawer, task details).

- **Month calendar** (`src/components/month-calendar.tsx`): Monday-first grid from `monthGrid` in `dates.ts`; arrows or a sideways flick change month; dark disc for the chosen day (drawn in SVG, because a rounded View whose colour changes shows as a square on Android), orange number for today, dot under days that have tasks or a birthday. `disablePast` for picking due dates.
- **Calendar screen** (`src/app/calendar.tsx`, button in the Today header): pick a day, see its birthdays and tasks, tick them, "Add to this day", or "Open on Today" (passes a `day` route param that Today reads once and clears).
- **Add drawer** (`src/app/add.tsx`): a bottom sheet over a dimmed Today (`transparentModal`, backdrop fades, sheet slides with the iOS sheet curve, 300 ms). Title, notes, Due chips (Today, Tomorrow, Next week = 7 days from today, Someday, Pick a date which opens the month and hides the keyboard), time stepper, round send button. Tapping the backdrop or Android back closes it.
- **Task details** (`src/app/task/[id].tsx`, opened from the "..." on a row or from the Calendar screen): editable title, Due date row (opens the same picker; a new day counts as "Not today" for the old day), time stepper, notes, delete, "Mark as complete" or "Reopen". Text is saved when the screen closes, except after delete or complete, so the Undo notice is not wiped.
- **Notes** are a new `notes` column on `tasks` (added by `ALTER TABLE` for existing databases) and a field in backups (older backups without it still restore). Subtasks, priority, lists and tags from reference 11 were not built: they need their own data model and the app has no use for them yet.
- **Reminder times** are editable in Settings (quarter-hour steps, no keyboard) and kept in the `meta` table as `reminder_times`; `rescheduleReminders` takes them as an argument.
- `editTask` in `planner.ts` and `monthGrid`, `addMonths`, `shiftTime` in `dates.ts` are covered by tests (147 in total).
- **Not decided**: what "notification stack" in the user's message was meant to be. Nothing was built for it.

### Importing many chats at once (2026-11-01)

WhatsApp exports one chat at a time and has no bulk export, so history import was made as cheap as possible instead: pick many `.txt` files in one go (Android's picker supports long-press multi-select), choose "which name is you" once (the name found in nearly every chat is pre-selected by `guessMe`; the choice is remembered in `meta.my_names`), then all chats are read together. Zips with media are skipped with a per-file reason. Live scanning (development build) covers everything from now on without any export, so the export is only for old history. Verified on the phone with three sample chats (4 deadlines, 2 birthdays found). A share-to-app route (Export chat, then Share straight to notToday) was considered; it needs an Android share intent in the native build and is not built.

Verified on the phone (2026-11-01): Wish toggles on and off and survives a reload; adding a task from the drawer with the keyboard's Enter key; drag to the Delete target (targets light up while dragging, drop shows "Deleted" with Undo). Still unchecked on the phone: backup and restore, the last-task celebration, the week flick after the latest changes.

### Inbox and Later redesign (2026-11-01)

- **Inbox card** (`src/app/(tabs)/inbox.tsx`): one source line (sender in chat, date) with a "..." menu holding "Never from this chat" (after a confirm); the title as an editable wrapping heading (before it was a single-line box that scrolled sideways, so long titles looked cut off); the quoted message only when it says something the title does not; one date chip that opens the due-date picker (tasks) or the jump calendar (birthdays) inside the card; Dismiss and Add on one row. Header says how many are waiting; the empty state matches Today.
- **Birthdays use a calendar, not typing**: `src/app/birthday.tsx` is a bottom drawer (name, then a Birthday row that opens the month grid). The month and year in the calendar title open pickers (`jump` prop), so a birth year is two taps instead of scrolling month by month. The birth year is optional behind a switch and only drives "turns 21". The old DD/MM/Year boxes on Later are gone.
- **Later**: grouped rows with a tinted icon, "in 13 days · turns 18", an Add button in the section header, dashed empty states, rows animate out when removed.
- `suggestionTitle` now capitalises the first letter after a dropped greeting.
- Shared `dayLabel` (`src/lib/day-label.ts`) replaces two copies of the same date wording.
- **No system dialogs**: questions use `src/components/confirm-sheet.tsx` (bottom sheet, red main button for destructive actions) instead of `Alert.alert`, which on Android draws a plain dialog with blue capital-letter buttons. Used for "Never from this chat" and for backup restore messages.
- The grey gear bubble on the top left of every phone screenshot is Expo Go's own tools button, not part of the app; it is absent in the development build.

### Repeating tasks (2026-11-01)

Daily, weekly, monthly or yearly, chosen in the add drawer (Repeat row under Time) or in Task details. Rules, all in `src/domain/repeat.ts` and `planner.ts` and covered by tests:

- **One open occurrence at a time.** Ticking a repeating task off creates the next one (same title, time and notes). The finished one stays as history, so rings and the Done list stay true. Un-ticking it takes the new one away again.
- **When the next one lands.** The first day after today that the repeat falls on, or after the task's own day when it was ticked early (a weekly task due Saturday and ticked on Monday comes back next Saturday, not on Tuesday). A daily task that slipped three days comes back tomorrow, not for each missed day.
- **No drift.** Every day is counted from the task's first day (`repeatFrom`), so "the 31st" goes 28 Feb then 31 Mar, and 29 Feb goes to 28 Feb in other years. "Not today" puts one occurrence off without moving that first day; picking a new day in Task details moves the whole repeat.
- **Deleting an occurrence ends the series**, since nothing is waiting behind it. The Undo bar brings it back. Moving it to Someday also ends it (a task with no day cannot repeat).
- Stored as `repeat`, `repeat_from`, `series` on `tasks` (added to existing databases on open; older backups restore as plain tasks). Birthdays already repeat every year on their own and are separate.
- Not built: custom intervals ("every 2 weeks", "weekdays only"), and showing several future occurrences on the calendar at once (only the next one exists).

### Sheets and toast motion (2026-11-01, apple-design + animate-expo)

- **One `Sheet`** (`src/components/sheet.tsx`) for the add drawer, birthday drawer and confirm sheet. It springs up from the bottom (300 ms, damping ratio 0.8, `overshootClamping` because it hangs from the screen edge), follows the finger 1:1 when dragged by its handle, and on release goes where the throw is heading (projected from release velocity with Apple's 0.998 deceleration) with that velocity handed to the spring. Past the top it rubber-bands. Grabbing it mid-flight stops it where it is. The dim background's opacity is tied to the sheet's position, so it fades with the drag. Android Back and tapping the dim close it with the same animation. Reduced motion skips the slide. The routes use `animation: 'none'`; the sheet animates itself.
- **Confirm sheet** lives in a React Native `Modal`, which needs its own `GestureHandlerRootView` and forwards Back to the sheet.
- **Toast** (`src/components/toast.tsx`, replaces `undo-bar.tsx`): kind-coloured icon badge (done, moved, deleted), message, Undo pill, a thin line that runs out over 5 s, rises in with a strong ease-out, leaves downward, flicks away sideways or down. The store now tags each notice with a kind.
- Found on the phone: a gesture threshold of `activeOffsetY: [8, 200]` is invalid in RNGH v3 (first value must be negative) and crashed the screen when the first toast appeared. Lint and types do not catch this; only running it did.

## Priority, custom repeats and updates

- **Priority is position.** There is no priority field. The first task of a day's list is the top priority, and dragging reorders priority. The first task gets a warm gradient wash, a hairline in the accent colour and a halo on its checkbox; the next two get a softer ring. A text label ("Top priority") was tried and dropped as noisy. The wash is a separate overlay whose opacity animates, because gradients cannot be interpolated.
- **Custom repeats** are a unit (`repeat`) plus a gap (`every`, 1 to 99): "every 3 days" is `daily` with `every = 3`. Occurrences are still counted from the first day (`occurrence(anchor, repeat, n, every)`), so nothing drifts. Switching the unit keeps the number; choosing "Never" resets it to 1. Old rows and backups without `every` read as 1.
- **Updates come from GitHub Releases.** The app asks `releases/latest` of `EthanRodrigues001/nottoday` when it opens (at most every 6 hours) and from Settings > About. A release counts when its tag is a higher version than the installed one and it has an `.apk` asset. The APK is downloaded with `expo-file-system` and opened with `File.preview` (Android's installer), which needs `REQUEST_INSTALL_PACKAGES`. Pre-releases and drafts are ignored. The repository (or at least its releases) must be public, or the app gets a 404 and shows nothing.
- **Signing key.** An update only installs over an older version if both are signed with the same key. Release builds are signed by `plugins/with-release-signing.js` using a key outside the repository (`~/.nottoday/nottoday-release.jks`, passwords in `~/.gradle/gradle.properties`). Losing that key means every installed copy must be uninstalled before a newer build can be installed, which erases its data, so back it up.
- **Releasing.** Raise `version` and `android.versionCode` in `app.json`, build with `gradlew assembleRelease`, and publish a GitHub release tagged `v<version>` with the APK attached.
- **Windows build quirk.** Building from the long project path fails in the C++ steps (path too long for ninja). Map a short drive first (`subst P: <project>`) and build from `P:\android`.
