# FocusBlock

**Block distracting sites until you earn access with a short quiz.**

FocusBlock is a Chrome extension that helps you stay focused. When focus mode is on, blocked sites redirect to a quiz. Pass with 80% or higher to unlock that site for 30 minutes.

<p align="center">
  <img src="public/icons/icon-128.png" alt="FocusBlock icon" width="96" height="96" />
</p>

---

## Download

**[Download FocusBlock (latest release)](https://github.com/rajeshkadiyalaaa/FocusBlock-Extension/releases/latest/download/focusblock-extension.zip)**

Or browse all releases: [github.com/rajeshkadiyalaaa/FocusBlock-Extension/releases](https://github.com/rajeshkadiyalaaa/FocusBlock-Extension/releases)

> **Note for maintainers:** Create a GitHub Release and attach `focusblock-extension.zip` (from `npm run pack`) with that exact filename so the download link above works.

---

## Install (Chrome)

1. Download and **unzip** `focusblock-extension.zip`
2. Open **`chrome://extensions`**
3. Turn on **Developer mode** (top right)
4. Click **Load unpacked**
5. Select the **unzipped folder** (the one containing `manifest.json`)
6. Pin **FocusBlock** to your toolbar

Chrome may show a “Disable developer mode extensions” banner — you can dismiss it. This is normal for extensions installed outside the Chrome Web Store.

---

## What it does

### Focus toggle
Turn blocking on or off from the popup. When focus is **ON**, listed sites are blocked. When **OFF**, everything works normally.

### Custom block list
Add or remove domains (YouTube, Netflix, Instagram, etc.). Defaults are included, but you control the list.

### Quiz gate
Visiting a blocked site opens a full-page quiz instead of the distraction.

- **5 questions** — score **4/5 (80%)** or higher to unlock
- **30-minute unlock** — timer shows in the popup and on the page
- **Fail?** — new questions; try again

### Two quiz modes

| Mode | When | Questions |
|------|------|-----------|
| **Warm-up** | No API key or no learning topic set | Built-in aptitude & reasoning MCQs |
| **Personalized** | OpenRouter API key + learning goal in Settings | AI-generated questions about your topic |

If AI generation fails, FocusBlock falls back to warm-up questions automatically.

### Settings (optional)
- **OpenRouter API key** — for personalized quizzes ([get a free key](https://openrouter.ai/keys))
- **Learning goal** — e.g. “Database Management Systems, SQL optimization”

Leave settings blank to use warm-up questions only — no account required.

### Dark mode
Follows your system theme automatically.

---

## How it works

```
Blocked site  →  Quiz page  →  Pass (≥80%)  →  30 min access  →  Auto re-lock
```

- Blocking uses Chrome’s declarative net request rules
- Already-open tabs are redirected when you turn focus on
- Unlock timers and settings stay on your device (`chrome.storage.local`)
- Quiz API calls go from your browser directly to OpenRouter (if configured)

---

## Build from source

**Requirements:** Node.js 18+

```bash
git clone https://github.com/rajeshkadiyalaaa/FocusBlock-Extension.git
cd FocusBlock-Extension
npm install
npm run build
```

Load the **`dist/`** folder in `chrome://extensions` → **Load unpacked**.

Create a zip for sharing:

```bash
npm run pack
```

Outputs `focusblock-extension.zip` in the project root.

---

## Default blocked sites

- netflix.com
- youtube.com
- instagram.com
- facebook.com
- twitter.com
- tiktok.com

You can change this list anytime in the popup.

---

## Privacy

- Settings, block list, and unlock timers are stored **locally in your browser**
- No analytics or backend server run by FocusBlock
- If you add an OpenRouter key, quiz requests go **directly from your browser to OpenRouter**

---

## Tech stack

- Chrome Manifest V3
- React 19 + TypeScript + Vite
- Tailwind CSS v4
- OpenRouter (optional, free models)

---

## License

Apache-2.0
