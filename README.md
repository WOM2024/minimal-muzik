# Minimal Music

**A lightweight YouTube music player built for TVs, car head units, and any always-on display — with a phone that acts as a true Wi‑Fi remote.**

No accounts. No API keys. No backend server. Two static HTML files.

---

## What this is

Minimal Music is designed for environments where the **screen is far away** and your **phone is the controller**:

| Role | Device | File |
|------|--------|------|
| **Player** (big screen) | Smart TV browser, car head unit / dash tablet, laptop on HDMI to a TV | `index.html` |
| **Remote** (in your hand) | Phone or second tablet on the same Wi‑Fi (or linked via PeerJS) | `playlist.html` |

The phone does **not** mirror the TV. It is a dedicated remote: change tracks, build playlists, pick charts, shuffle — while the TV or car keeps playing full-screen YouTube video.

Same-network control uses the browser `BroadcastChannel` API (instant). Different devices use a **persistent 6-character room code** + PeerJS. Scan a QR on the player and the remote joins that room.

---

## Why it exists

- **Car and TV first:** Large touch targets, Media Session support for steering-wheel / headset next–previous, lock-screen controls.
- **Clean playback:** No YouTube home feed cluttering the main UI.
- **Discovery without an account:** Category browse (Turkish pop, rock, arabesk, rap, slow, international pop, classical, lofi, popular) plus search and voice search.
- **Independent remote:** Playlist management lives on the phone so the driver or couch user never has to lean into the big screen.
- **Zero ops:** Host on GitHub Pages, any static host, or a one-line local server. No database, no login.

---

## Features

### Player — `index.html`

- Category discovery with rotating queries (fresh results each visit)
- Text search + microphone (voice) search
- Favorites stored in `localStorage` on the device
- Infinite scroll of results
- YouTube IFrame API playback with autoplay
- Auto-advance when a track ends
- **YouTube native fullscreen** on track start (the player iframe itself, not only the page chrome)
- Media Session API: steering wheel, Bluetooth headset, lock screen (next / previous / play / pause)
- Persistent **room code** (same device → same code every launch)
- Tap the code → QR + link for the remote

### Remote — `playlist.html`

- **Shuffle mode:** Follow and control the player’s current queue live
- **Manual mode:** Build your own queue on the phone
- Chart-style and category ready playlists
- Import a full playlist → push to the player and start
- Search, add, remove tracks one by one
- Previous / next and tap-to-play any item in the list
- Same device: `BroadcastChannel` (no server)
- Other device: PeerJS room (`?c=ROOMCODE` or QR)

### Control paths

| Input | Effect on player |
|--------|------------------|
| Tap track on `index.html` | Play + YouTube fullscreen |
| Remote next / prev / pick song | Play + YouTube fullscreen forced |
| Remote set queue / shuffle import | Queue sync + play + fullscreen |
| Steering wheel / headset Media Session | Next / prev + fullscreen retry |
| Track ends | Auto next |

> Browsers require **one user gesture** on the player device before programmatic fullscreen is allowed. Tap once on the TV/car player; after that, remote and wheel commands can re-enter YouTube fullscreen on the same iframe (the player is reused via `loadVideoById` so the iframe is not destroyed between songs).

---

## Files

```
minimal-muzik/
├── index.html      # Main player (TV / car / display)
├── playlist.html   # Wi‑Fi remote and playlist manager (phone)
├── README.md
└── LICENSE         # MIT
```

---

## Deploy on GitHub Pages

1. Create a repository and upload these files (or fork).
2. **Settings → Pages**
3. Source: **Deploy from a branch**
4. Branch: `main` (or `master`), folder: `/ (root)` → Save
5. After a minute:

```text
https://YOUR_USER.github.io/YOUR_REPO/
https://YOUR_USER.github.io/YOUR_REPO/playlist.html
```

No FTP, no Node server, no build step.

---

## Typical setups

### Living room TV

1. Open `index.html` on the TV browser (or a mini PC / stick browser pointed at your Pages URL).
2. Note the 6-character code (or open the QR).
3. On your phone, open `playlist.html?c=CODE` (or scan the QR).
4. Build or pick a playlist; control next/prev from the couch.

### Car

1. Open the player URL on the head unit or Android tablet on the dash (must be a normal `http://` or `https://` origin — not `file://`).
2. Connect the phone remote on the same Wi‑Fi hotspot (phone tether or car Wi‑Fi).
3. Use the phone as the only interface while driving; use steering-wheel next/previous via Media Session when the browser exposes it to the system.

### Same laptop (demo)

1. `index.html` in one tab, `playlist.html?c=CODE` in another — BroadcastChannel links them instantly.

---

## Usage (step by step)

1. Open **`index.html`** on the playback device.
2. Top-right: **6-character room code** (stored in `localStorage`, stable per device).
3. Tap the code → QR / copy link.
4. On the phone open the link or `playlist.html?c=YOURCODE`.
5. Remote: **Manual** → charts or category → add list, or search and add tracks.
6. Player starts; when a track ends, the next one plays.
7. Optional: tap once on the player so **YouTube fullscreen** can engage; later remote and wheel skips keep forcing fullscreen on the YouTube iframe.

---

## Local development

Serve over HTTP (required for BroadcastChannel, reliable autoplay, and YouTube embed Referer rules):

```bash
python -m http.server 8080
# or: npx serve .
```

Then open:

```text
http://localhost:8080/
http://localhost:8080/playlist.html
```

Do **not** open the HTML files as `file://` if you need remote sync or reliable embeds.

---

## Technical overview

| Piece | Implementation |
|--------|----------------|
| Search / metadata | Public Invidious instances (`SEARCH_INSTANCES` in `index.html`) |
| Playback | `youtube44.com/embed` iframe (autoplay + postMessage play/unMute); search still via Invidious |
| Embed fallback | Direct `youtube.com/embed` iframe with `referrerpolicy` / `origin` (mitigates Error 153) |
| Same-device sync | `BroadcastChannel` + `localStorage` events |
| Cross-device sync | PeerJS data connections, room id `mm-` + code |
| Room code | `localStorage` key `minimal_muzik_room_code` |
| Favorites | `localStorage` key `minimal_yt_favorites` |
| Car / headset | `navigator.mediaSession` action handlers |
| Fullscreen | `requestFullscreen()` on the **YouTube iframe** (`getIframe()`), with retries for remote and Media Session triggers |

Browser autoplay policies may require one tap before unmuted playback; after unlock, queue advance stays automatic.

---

## Customization

| What | Where |
|------|--------|
| Categories / search variants | `index.html` → `CATEGORY_VARIANTS` |
| Invidious instances | `index.html` → `SEARCH_INSTANCES` |
| Ready-made playlists | `playlist.html` → chart / category playlist maps |
| Room code storage key | `ROOM_CODE_KEY` |
| PeerJS room prefix | `ROOM_PREFIX` (`mm-`) |

---

## Privacy and limits

- No project analytics beyond what YouTube’s embed and optional CDNs (PeerJS, YouTube iframe API) load.
- Public Invidious nodes can be rate-limited or down; update `SEARCH_INSTANCES` if search fails.
- YouTube may show Error 153 if the page is opened as `file://` or if Referer is stripped; always use `http(s)://` hosting.
- Fullscreen and autoplay remain subject to browser security rules.

---

## License

MIT — use, modify, and share freely. See [LICENSE](LICENSE).

## Contributing

Pull requests welcome: more stable search instances, better car/TV UX, additional categories, and player robustness improvements.
