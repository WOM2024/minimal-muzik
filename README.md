# SUPERYT — Minimal Music

**A lightweight YouTube music player designed for TVs, car head units, and always-on displays — controlled remotely from your phone.**

SuperYT is an experimental, browser-based project built with static HTML, CSS, and JavaScript. The playback device displays the video, while a phone or second device can act as a remote for searching, selecting tracks, and managing playlists.

**Testing and experimental use only.** This project is provided as-is, without any guarantee of uninterrupted operation, compatibility, or availability of third-party services. Use it only in ways permitted by applicable law and the terms of the services involved.

---

## What this is

Minimal Music is designed for situations where the **playback screen is far away** and the **phone acts as the controller**.

| **Role** | **Device** | **File** |
| --- | --- | --- |
| **Player** (big screen) | Smart TV browser, car head unit / dashboard tablet, laptop connected to a TV | `index.html` |
| **Remote** (in your hand) | Phone or second tablet on the same network / browser context, or connected through PeerJS | `playlist.html` |

The phone does not mirror the TV. It acts as a separate remote: change tracks, build a playlist, browse categories, search for content, and control playback while the main screen displays the selected video.

Same-browser communication uses `BroadcastChannel` and browser storage events where supported. Cross-device communication uses PeerJS and a room code. A QR code can make it easier to open the remote page with the room code pre-filled.

> **Important:** A room code is a connection identifier, not a secure authentication mechanism. Do not use it to protect sensitive content or assume that anyone who knows the code is authorized.

---

## Why it exists

- **TV and car-oriented interface:** Large touch targets and playback controls intended for a screen that may be farther away.
- **Phone as a remote:** Manage playback and playlists from a second device instead of repeatedly interacting with the main screen.
- **Content discovery:** Browse categories and search for videos or songs through supported external services.
- **Favorites:** Keep a list of favorite items in the browser on the device where they were saved.
- **Minimal setup:** Static files only — host on GitHub Pages or any static web host. No custom backend required for the app shell.
- **No project account system:** The project does not require a SuperYT account or a project-managed database. External services may still process connection and request data.

---

## Features

### Player — `index.html`

- Category-based browsing (Turkish Pop, Turkish Rock, Arabesque, Rap, Slow, International Pop, Classical, Lofi, Popular, and Favorites).
- Text search through configured Invidious instances.
- Category query variations intended to provide different result sets over time.
- Favorites stored in browser `localStorage`.
- Progressive loading of search results (pagination + `IntersectionObserver`).
- Embedded playback via the YouTube IFrame API.
- Playback queue with previous / next controls.
- Automatic advance to the next item when a track ends (subject to player and browser behavior).
- Player chrome auto-hide and night brightness dimming (settings panel).
- **Video quality preference** (Low / Normal / High) in settings — best-effort via player viewport sizing and YouTube quality APIs; YouTube may still override adaptive bitrate.
- Media Session integration where supported (play/pause, previous/next), including steering-wheel / headset controls when the browser exposes them.
- Room code badge, regenerate code, and QR / link flow to open the remote.
- Responsive layout for mobile, tablet, TV browser, and car head-unit use.
- Optional SponsorBlock segment skipping when enabled in the source.

### Remote — `playlist.html`

- Connect with a room code or a QR / deep link (`playlist.html?c=CODE`).
- **Shuffle mode:** Control the current player flow where supported by sync logic.
- **Manual mode:** Build and manage a queue from the phone.
- Browse ready-made chart / category playlist options.
- Search for videos or songs and add results to the queue.
- Add, remove, reorder, and clear queued items.
- Import a playlist when the external endpoint provides the required data.
- Previous / next / play-pause and seek when state is available from the player.
- Live connection status with reconnection attempts (BroadcastChannel, `localStorage`, PeerJS).
- Touch-friendly layout for phones and tablets.
- **Add to Home Screen** banner (browser only — hidden in standalone / PWA mode):
  - Android Chrome: one-tap install when the browser fires `beforeinstallprompt` (HTTPS + manifest + service worker).
  - iPhone: Apple does not allow programmatic install; in-app guide for Share → Add to Home Screen.
  - Dismissible; can reappear after a cooldown period.

### Remote-control paths

| **Action** | **Expected result** |
| --- | --- |
| Select an item on `index.html` | Attempts to play the selected item |
| Remote next / previous / play-pause | Sends a playback command to the player |
| Select an item from the remote queue | Requests playback of that item |
| Import or synchronize a queue | Attempts to update the player queue |
| Seek on the remote progress bar | Requests seek on the player when supported |
| Steering-wheel / headset media keys | Works only when Media Session actions are exposed |
| Current track ends | Attempts to advance to the next item when supported |

> **Fullscreen and autoplay limitations:** Browsers generally require a user gesture before allowing audible autoplay or programmatic fullscreen. A remote command cannot reliably bypass these rules. Exact behavior depends on the browser, device, and embedded player.

---

## Files

```text
minimal-muzik-main/
├── index.html                      # Main player and content discovery
├── playlist.html                   # Remote control and playlist manager
├── manifest-playlist.webmanifest   # Web app manifest (remote install / standalone)
├── sw-playlist.js                  # Minimal service worker (Android installability + light offline shell)
├── superyt-logo.png                # Project logo
├── superyt-logo.ico                # Favicon
├── README.md                       # This documentation
└── LICENSE                         # License information
```

Confirm that all referenced assets are present before publishing.

---

## Deploy on GitHub Pages

1. Create a GitHub repository and upload the project files to its root (or the folder you will publish).
2. Open **Settings → Pages**.
3. Under **Build and deployment**, select **Deploy from a branch**.
4. Select the `main` (or `master`) branch and the `/(root)` folder, then save.
5. After the site is published, open:

```text
https://YOUR_USER.github.io/YOUR_REPO/
https://YOUR_USER.github.io/YOUR_REPO/playlist.html
```

No build step or custom backend is required for static hosting. Playback, search, and cross-device control still depend on external services and browser features; GitHub Pages does not operate or guarantee those services.

**HTTPS is required** for reliable PeerJS, camera QR flows, Add to Home Screen / install prompts, and service workers. Opening via `file://` is not recommended.

---

## Typical setups

### Living-room TV

1. Open the hosted `index.html` on the TV browser (or a computer connected to the TV).
2. Note the room code or open the QR / link from the player.
3. Open `playlist.html` on the phone via the link or QR (code can be pre-filled with `?c=`).
4. Search, queue, and control playback from the phone.

### Car head unit

1. Open the player over `http://` or `https://` in a compatible browser.
2. Connect the phone on the same network or via PeerJS room connection.
3. Prepare the playlist and playback **before** driving.
4. Do not operate the phone or the interface while driving. Follow local road-safety laws.

Compatibility with car browsers, steering-wheel controls, Bluetooth buttons, and background playback is **not** guaranteed.

### Same-device demo

1. Open `index.html` in one tab.
2. Open `playlist.html` in another tab with the same room code.
3. Test local sync if the browser supports BroadcastChannel / storage events.

Same-device sync may fail under `file://`, strict privacy settings, or isolated browser profiles.

---

## Local development

Serve over HTTP instead of `file://`:

```bash
python -m http.server 8080
```

Then open:

```text
http://localhost:8080/
http://localhost:8080/playlist.html
```

A static server is enough for the app shell. It does not replace the external services the project calls.

---

## Technical overview

| **Component** | **Implementation / purpose** |
| --- | --- |
| Search and metadata | Configured public Invidious instances |
| Video playback | YouTube IFrame API |
| Thumbnails | URLs from the external search service / YouTube image hosts |
| Same-browser sync | `BroadcastChannel` + `localStorage` events |
| Cross-device sync | PeerJS data connections (`mm-{room}` host id) |
| Room code | Persisted in `localStorage` on the player; remote joins by code |
| Favorites | Browser `localStorage` |
| Media controls | `navigator.mediaSession` where supported |
| Progressive results | Pagination + `IntersectionObserver` |
| QR code | External QR image service (player UI) |
| Sponsor segments | SponsorBlock API (if enabled in source) |
| Remote install banner | `beforeinstallprompt` + manifest + service worker (Android); iOS guided Share sheet |
| Quality preference | Viewport-size hint + YouTube quality range APIs (best-effort) |

Details may change with the source. Check the current files for endpoints, storage keys, and control flow.

---

## Customization

| **What** | **Where to look** |
| --- | --- |
| Categories and search variations | Category / query config in `index.html` |
| Search service instances | Invidious instance list in `index.html` |
| Ready-made playlists | Playlist / category mappings in `playlist.html` |
| Room-code behavior | Room constants and storage logic in both HTML files |
| PeerJS connection behavior | Peer host / client logic in both HTML files |
| Quality defaults | Quality preference + CSS viewport classes in `index.html` |
| Add to Home Screen copy / dismiss | A2HS block in `playlist.html` |
| Visual appearance | CSS in `index.html` and `playlist.html` |

Public service instances may differ in availability, rate limits, and terms.

---

## Privacy and data handling

SuperYT does not include its own account system or server-side user database. That does **not** mean there are no network requests or third-party processing.

Depending on features used, requests may go to:

- **Invidious instances** — search and playlist metadata
- **YouTube / embedded player** — playback
- **PeerJS infrastructure** — cross-device control
- **SponsorBlock** — segment data (if enabled)
- **QR-generation services** — QR images (if used)
- **CDN hosts** — libraries (e.g. PeerJS)
- **Thumbnail hosts** — search-result images

Third parties may receive technical data (IP, URLs, search terms, video ids, connection metadata). Their policies apply, not this repository.

Favorites and settings in `localStorage` stay in that browser profile until cleared. Anyone with access to the profile may see that data.

Do not enter sensitive or confidential information into the application.

---

## Testing status and known limitations

**This project is experimental.** Do not assume every feature works on every browser, TV, head unit, phone, or network.

Known limitations include:

- Public Invidious instances may be slow, rate-limited, or offline.
- Search results and playlist metadata can be incomplete or change without notice.
- YouTube may block playback (region, age, embedding, account rules).
- Autoplay with sound may require a user gesture.
- Remote commands cannot force fullscreen or bypass autoplay policies.
- **Video quality settings are best-effort**; YouTube adaptive streaming may ignore or override them.
- Media Session, steering-wheel, Bluetooth, and background playback vary widely.
- PeerJS may fail under firewalls, CGNAT, or signaling outages.
- A room code is **not** authentication.
- Browser storage can be cleared (favorites / room code lost).
- Core features need the internet; this is not an offline music library.
- **Add to Home Screen:** one-tap install works only when the browser allows it (typically Android Chrome on HTTPS). iOS never allows programmatic install.
- Scanning a QR code opens the URL in the browser; there is no reliable way to force an already-installed home-screen web app to open instead (especially on iOS).

When reporting issues, include browser, OS/device, steps to reproduce, and relevant console errors. Do not post private links, personal data, or active room codes in public reports.

---

## Legal notice and user responsibility

### 1. Experimental use only

SuperYT is for learning, development, interoperability testing, and personal experimentation. It is **not** a guarantee that any particular use is lawful, and it is not legal advice. Users must decide whether their use is permitted under applicable law and third-party terms.

### 2. User responsibility

By using, modifying, hosting, or distributing this project, you are responsible for compliance with laws, service terms, and intellectual-property rights.

Do not use the project to access content without authorization, circumvent technical restrictions, download or reproduce copyrighted content without permission, redistribute content unlawfully, or use third-party content commercially without the required rights.

### 3. Copyright and related rights

In Türkiye, Law No. 5846 on Intellectual and Artistic Works (FSEK) is a key part of the copyright framework. Finding or playing a work through a third-party service does not by itself grant permission to download, reproduce, distribute, publicly communicate, adapt, or commercially exploit it.

SuperYT is not intended to host copies of copyrighted media and does not grant rights to third-party content.

### 4. Third-party services and trademarks

YouTube, Google, Invidious operators, PeerJS, SponsorBlock, QR services, CDN providers, and content hosts are independent third parties. Names are referenced only to describe integrations. No endorsement or partnership is implied.

Those services may change terms, restrict access, or become unavailable. Users must follow their current policies.

### 5. Disclaimer of warranties

To the maximum extent permitted by law, this project is provided **"AS IS" and "AS AVAILABLE,"** without warranties of any kind. No guarantee of uninterrupted, secure, error-free, or device-compatible operation, or of continuous compatibility with third-party services.

### 6. Limitation of liability

To the extent permitted by law, the author and contributors are not liable for indirect or consequential loss, data loss, lost profits, service interruption, device incompatibility, or issues arising from third-party services or from use of the project.

Liability that cannot lawfully be excluded remains. This README is not legal advice.

### 7. Rights-holder notices

If you believe material in this repository infringes your rights, contact the repository owner with the specific file or URL, the right claimed, the basis of the claim, and the action requested. You may also use the hosting platform's formal process.

### 8. Legal and service references

- [YouTube Terms of Service](https://www.youtube.com/t/terms)
- [Invidious project](https://github.com/iv-org/invidious)
- [PeerJS](https://peerjs.com/)
- [SponsorBlock](https://sponsor.ajay.app/)

Links are for reference only and do not imply endorsement.

---

## License

See the [`LICENSE`](LICENSE) file in this repository.

Review the license before publication. The MIT License does not grant rights to third-party videos, music, logos, APIs, or services.

---

## Contributing

Issues and pull requests are welcome. Useful areas include more resilient search, TV/car usability, accessibility, playlist tools, and clearer error handling.

Only submit material you have the right to contribute under the repository license. Do not include copyrighted assets, credentials, or personal data.

---

## Disclaimer

**Use at your own risk.** You are responsible for configuration and use, for checking applicable laws and third-party terms, and for obtaining any permissions required for content you access or distribute. The author does not guarantee availability, legality of third-party content, or compatibility with any particular device. Nothing in this README removes rights or liabilities that cannot be excluded under applicable law.
