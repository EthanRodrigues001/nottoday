# Expo notes for NotToday

Distilled from the official `expo` Claude plugin (v1.13.9, installed with `claude plugin install expo@claude-plugins-official`). Skill files live in `C:\Users\Ethan Rodrigues\.claude\plugins\cache\claude-plugins-official\expo\1.13.9\skills\<skill>\SKILL.md`. Re-read the relevant skill before building that part. Load `expo-overview` first for any Expo task.

## Setup rules (expo-overview)

- New app: `npx create-expo-app@latest` (Expo docs currently show template `default@sdk-58`). Check the real SDK in `package.json` before using any API.
- Install packages with `npx expo install <pkg>`, never raw `npm add`, so versions match the SDK.
- Read docs pinned to the project SDK (`docs.expo.dev/versions/v<SDK>.0.0/...`), not `latest`.
- SDK upgrades go through the `expo-upgrade` skill.
- `@expo/ui` universal layer needs SDK 56+.

## Decisions that follow from the skills

- **Dev build, not Expo Go.** A notification listener is a native module with a config plugin, so Expo Go cannot run it. Use `expo-dev-client`; local Android builds are free (`npx expo run:android`).
- **Notification listener module**: our own local module `modules/whatsapp-listener` (see docs/decisions.md). The third-party `expo-notification-listener` was tried and does not compile on SDK 58. The user must grant "Notification access" in Android settings; some ROMs (MIUI, HyperOS, ColorOS) need autostart on and battery optimisation off.
- **Storage**: `expo-sqlite` (full) for tasks, birthdays, inbox, chat mute state, model weights. `expo-sqlite/localStorage/install` only for small settings. Never AsyncStorage. `expo-secure-store` is not needed (no secrets).
- **Lists**: Today list is short, so `@expo/ui` `List` is possible, but drag-to-reorder is not covered by any Expo skill; plan on `react-native-reanimated` + `react-native-gesture-handler` (see expo-animation `RECIPES.md`) or a reorder-list library, decided at build time. `@expo/ui` `List` is not virtualised; use `FlatList`/`FlashList` for anything long (Inbox history, chat import).
- **Navigation**: Expo Router, `NativeTabs` (from `expo-router/unstable-native-tabs`) for the bottom bar, a Stack per tab. Modals and sheets via `presentation: 'formSheet'` or `@expo/ui` `BottomSheet` (props `isPresented`/`onDismiss`, not `isOpen`). Never import `@react-navigation/*` directly on SDK 56+; use `expo-router/react-navigation`.
- **Tab switches never animate** (`animation: 'none'`).
- **Android design language**: Material 3, not iOS chrome. Use `Color.android.dynamic.*` via `expo-router` `Color` for semantic colours, or fixed brand colours where the reference demands them (the references are a custom light look, so a small fixed brand palette is expected, kept in the theme).

## Code conventions (expo-native-ui, expo-project-structure, expo-design-system)

- Layout: `src/app` is routes only; `src/components`, `src/screens`, `src/hooks`, `src/utils`, `src/theme/`, `src/db/`, `src/classifier/`. Alias `@/*` to `./src/*`. kebab-case file names.
- Theme tokens live in `src/theme/` (colors, spacing 4-pt grid, typography, radius, shadows, motion). No hex values, font sizes, or spacing literals outside it.
- Shadows: `boxShadow` strings only, never `elevation`/legacy shadow props. Corners: `borderCurve: 'continuous'`.
- `process.env.EXPO_OS` not `Platform.OS`; `expo-image` not `<img>`; `react-native-safe-area-context`; `useWindowDimensions`; `React.use` not `useContext`.
- Prefer `gap` and padding to margin; inline styles over `StyleSheet.create` unless reused.
- Every screen has four states: loading, error, empty, content. Do not flash "empty" during first load.
- Press feedback: `scale: 0.97` in 100-150 ms on button-like pressables; list rows highlight instead. Touch target 44pt (48dp). One haptic per commit (done, drop after drag), never the only feedback.
- Avoid the named "native slop" tells (expo-design-system `references/native-slop.md`): everything-in-a-card, emoji as tab icons, purple-gradient hero pushing the task below the fold, full-screen spinner blinks. Note: reference 01 and 03 use rounded cards and emoji task icons, so those are deliberate choices to justify, not defaults.

## Extra skill: apple-design (project-local)

Installed with `npx skills add https://github.com/emilkowalski/skills --skill apple-design --agent claude-code` into `.claude/skills/apple-design/SKILL.md`. It is written for the web (CSS, Pointer Events) from Apple's WWDC talks; translate to React Native with Reanimated + Gesture Handler. Key mappings: Apple's damping ratio is `dampingRatio` in Reanimated's `withSpring`, Apple's response of 0.3-0.4 s is `duration` 300-400 ms; velocity handoff is the `velocity` option from the Pan gesture's `onEnd`; momentum projection is `position + (v/1000) * d / (1 - d)` with d about 0.998; rubber-band is `(o*dim*0.55)/(dim+0.55*|o|)`. Feedback on press-in, commit on release; never lock input during a transition; decompose 2D motion into independent X and Y springs. Its initial-response line applies only when invoked with no question.

## Animation rules (expo-animation)

- Reanimated 4 plus `react-native-worklets`; Reanimated 4 needs the New Architecture. `GestureHandlerRootView` at the root or gestures silently do nothing.
- Springs for anything a finger touched: `{ duration: 300-400, dampingRatio: 0.8-1, velocity }`. Timing + ease-out otherwise (`Easing.bezier(0.23, 1, 0.32, 1)`). Never ease-in, never `scale(0)`.
- Animate only `transform` and `opacity`. Never `setState` in a gesture handler. Use `.get()`/`.set()`. `scheduleOnRN` replaces `runOnJS`.
- Honour reduced motion (`useReducedMotion`).
- Judge feel on a release build, not Expo Go.

## ASCII gradient header: important constraint

`references/GradientASCII.tsx` is a **web-only** component (DOM `canvas`, `document`, `window`, `ResizeObserver`, WebGL2 shaders, a `requestAnimationFrame` loop). It cannot run in React Native as is. Two routes:

1. **Expo DOM component** (`expo-dom` skill): copy it into a file starting with `"use dom";`, add `dom?: import('expo/dom').DOMProps` to props, render it in the header area with `dom={{ scrollEnabled: false, style: { width: '100%', height: <n> } }}`. It runs in an Android WebView (WebGL2 supported on modern Android System WebView). Props must be serialisable. Keep it to the header only, not whole screens. Pointer effects (`mouseInteraction`, `clickEffect`) become touch events inside the WebView.
2. **Port the shaders to Skia** (`@shopify/react-native-skia`), more work, better battery and no WebView.

Cost to watch: it renders every frame. Mitigate with a low `speed`, `intro` off after first show, a small `cellSize`/`dpr`, and pausing when the app is backgrounded (it already pauses when offscreen or `document.hidden`).

## UI references (in `references/ui/`)

| File | What to take from it |
| --- | --- |
| `01-todo-list-week-strip-cards.png` | Week strip (M-S) with a per-day progress ring, "Today's plan" heading with an Add pill, white rounded task cards with icon tile, title, time and a round check, floating pill tab bar plus a black circular add button. User likes this one. |
| `02-subtask-rows-progress-pill.png` | Parent task with an `n/m` count and chevron, a `0%` pill, subtasks shown as faded bullet rows. |
| `03-dailyloop-home-grouped-tabs-floating-nav.png` | "DailyLoop": greeting, week card with a grey selected day, segmented `To do / Completed / Pending` (black selected pill), collapsible groups (Morning, Workload, Night) with square checkboxes and emoji, floating nav plus black add button. User likes this and 01. |
| `04-week-header-black-selected-dot.png` | Compact header: large "TUE 9" with an accent superscript, black filled circle for the selected day, small accent dot under a day that has items. |
| `05-dense-grouped-list-dark.png` | Dense dark list with status-group headers and point counts, multi-select with blue checkboxes. Reference for grouped lists and bulk select. |
| `06-blue-gradient-bg-glass-tiles.png` | Background direction: deep blue at the top fading to near white, frosted translucent tiles, floating glass tab bar. The ASCII gradient replaces the top half of this. |

Chosen direction (from the user): background like `06`, top half = the ASCII gradient header, content styles from `01`, `03`, `04`, floating pill tab bar from `01`/`03`/`06`.
