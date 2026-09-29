# Minimal Müzik

A lightweight YouTube music experience designed for cars and mobile devices.

A simplified, Spotify-style music discovery interface without the complexity of the standard YouTube UI. Includes category-based discovery and remote playlist control.

Single-page HTML — no server, API key, or account required.

## Legal Notice & Disclaimer

**This software is intended solely for testing, educational, research, and personal experimental purposes.**

### 1. No Official Affiliation

This project is not an official product of YouTube, YouTube Music, Google LLC, or any of their affiliates.

It is not endorsed, supported, sponsored, or approved by them.

All related trademarks and copyrights belong to their respective owners.

### 2. Terms of Service & Copyright

Users are solely responsible for complying with the Terms of Service, Community Guidelines, and copyright laws applicable to third-party platforms such as YouTube.

Any content accessed through this software must be used in accordance with applicable laws and the terms of the relevant third-party services.

Responsibility for such use rests entirely with the user.

### 3. "AS IS"

This software is provided **"AS IS"**, without warranties or guarantees of any kind, either express or implied.

No guarantee is made regarding merchantability, fitness for a particular purpose, uninterrupted operation, availability, reliability, or error-free performance.

### 4. Limitation of Liability

The author(s), developer(s), and contributor(s) shall not be held liable for any direct, indirect, incidental, special, consequential, or other damages arising from the use of, inability to use, or malfunction of this software or any third-party services involved.

This includes, but is not limited to:

* Data loss
* Loss of revenue
* Device damage or malfunction
* Service interruptions
* Legal consequences
* Claims or disputes from third parties

### 5. Third-Party Dependencies

Search and playback functionality depend on third-party services.

These services may change, become restricted, become unavailable, or shut down without prior notice.

The project owner does not guarantee the availability, stability, or continued operation of any third-party service.

### 6. Acceptance

By downloading, forking, running, or sharing this software, you acknowledge that you have read and accepted the terms described above.

If you do not agree with these terms, do not use this software and remove it from your device.

### 7. Commercial / Production Use

Use in high-traffic environments, commercial products, or critical systems is not recommended and is not supported.

Any such use is entirely at the user's own risk.

---

## Why This Project?

* **Designed for cars:** Large touch targets and Media Session support for steering-wheel / headset controls, including previous and next track controls
* **Minimal interface:** Removes the complexity of the standard YouTube interface
* **Music discovery:** Popular and varied tracks on every launch using view-based results, randomized pages, and shuffling
* **Remote control:** Manage the playlist from your phone while the music plays on another device, such as a car head unit or tablet
* **No account required:** No login, API key, or backend server required

---

## Features

### Main Player (`index.html`)

* Turkish Pop, Rock, Arabesque, Rap, Slow, International Pop, Classical, Lofi, and Popular categories
* Text search
* Voice search using the device microphone
* Favorites stored locally using `localStorage`
* Infinite scrolling
* `youtube-nocookie.com` embedded player with autoplay
* Automatically plays the next track when a video ends
* Media Session API support for lock-screen and steering-wheel/headset controls
* **Persistent playlist room code**
* A unique 6-digit code is generated for the device and remains the same across sessions
* Tap the code to open a QR code popup
* Connect another device to the playlist using the QR code or generated link

### Remote Playlist (`playlist.html`)

* **Shuffle mode:** Follow and control the order of tracks from the main player
* **Manual mode:** Build and manage your own playlist
* YouTube Music official chart lists, including available regional charts
* Ready-made playlist suggestions based on categories
* Select a playlist and transfer all tracks to the main player
* Search for songs and add or remove individual tracks
* Previous / next controls
* Select and play individual tracks from the playlist
* Same-device synchronization using `BroadcastChannel`
* Cross-device synchronization using PeerJS and a room code

---

## Project Structure

```text
minimal-muzik/
├── index.html      # Main music application
├── playlist.html   # Remote playlist controller
├── README.md
└── LICENSE         # MIT License
```

---

## GitHub Pages

GitHub Pages allows the project to run directly from your repository without requiring FTP, a web server, or a backend.

### 1. Fork or Copy the Repository

Fork this repository or create your own copy of the project in your GitHub account.

### 2. Enable GitHub Pages

Go to:

**Settings → Pages**

### 3. Configure the Source

Select:

**Source:** `Deploy from a branch`

Then choose:

**Branch:** `main`
**Folder:** `/ (root)`

Click **Save**.

After approximately 1–2 minutes, your application should be available at your GitHub Pages URL:

```text
https://YOUR_USERNAME.github.io/YOUR_REPOSITORY/
```

The remote playlist controller will be available at:

```text
https://YOUR_USERNAME.github.io/YOUR_REPOSITORY/playlist.html
```

Replace `YOUR_USERNAME` with your GitHub username and `YOUR_REPOSITORY` with the name of your repository.

For example, if your GitHub username is `example` and your repository is named `minimal-muzik`, your URLs will be:

```text
https://example.github.io/minimal-muzik/
https://example.github.io/minimal-muzik/playlist.html
```

No FTP server or backend is required. The project can run entirely as static files.

---

## Usage

### Main Device

1. Open `index.html` or your GitHub Pages URL.
2. A **6-digit room code** will appear in the top-right corner.
3. Tap the room code to open the QR code / connection popup.
4. Keep this page open on the device where the music will play.

### Remote Device

5. Scan the QR code with another device, or open:

```text
https://YOUR_USERNAME.github.io/YOUR_REPOSITORY/playlist.html?c=ROOM_CODE
```

6. Open **Manual** mode.
7. Select a YouTube Music chart or category playlist.
8. Add the tracks you want.
9. The playlist will be synchronized with the main player.
10. Control playback remotely from the second device.

---

## How Synchronization Works

The project supports two synchronization methods.

### Same Device

When `index.html` and `playlist.html` are opened on the same device and browser, communication can use:

```text
BroadcastChannel
```

This allows playlist and playback changes to be synchronized immediately between the two pages.

### Different Devices

For communication between different devices, the project uses:

```text
PeerJS
```

The 6-digit room code is used to establish the connection between the main player and the remote playlist controller.

---

## Technical Notes

### Search

Music search uses the Invidious API through a list of configured instances.

```text
SEARCH_INSTANCES
```

The project does not require a personal YouTube API key.

### Playback

Playback uses:

* YouTube IFrame Player
* `youtube-nocookie.com`
* Autoplay where supported by the browser

### Synchronization

The project uses:

* `localStorage`
* `BroadcastChannel`
* PeerJS

### Room Code

The room code is stored locally using:

```text
minimal_muzik_room_code
```

The code is generated per device/browser and is intended to remain persistent between sessions.

### Browser Autoplay

Modern browsers enforce autoplay restrictions.

Because of these restrictions, the first playback may require a user interaction, such as tapping the screen.

After the initial interaction, subsequent tracks can generally continue automatically, depending on the browser and device.

---

## Local Development

You can run the project locally without installing a backend.

### Python

```bash
python -m http.server 8080
```

Then open:

```text
http://localhost:8080
```

### Node.js

Alternatively, if Node.js is installed:

```bash
npx serve .
```

Then open the local address provided by the server.

---

## Customization

| Setting               | Location                               |
| --------------------- | -------------------------------------- |
| Categories            | `index.html` → `CATEGORY_VARIANTS`     |
| Invidious instances   | `index.html` → `SEARCH_INSTANCES`      |
| Ready-made playlists  | `playlist.html` → `CATEGORY_PLAYLISTS` |
| Room code storage key | `ROOM_CODE_KEY`                        |

---

## Compatibility

The interface is designed primarily for:

* Mobile browsers
* Android devices
* iPhones and iPads
* Car multimedia systems with modern WebView/browser support
* Desktop browsers

The layout is optimized for touch interaction and smaller screens while remaining usable on desktop browsers.

---

## Privacy

The application does not require a user account or backend database.

Favorites and the persistent room code are stored locally in the browser using `localStorage`.

The project itself does not provide a user authentication system.

However, external services used by the application may process requests according to their own privacy policies and terms.

---

## Dependencies & External Services

The project may interact with the following third-party technologies and services:

* YouTube / YouTube IFrame Player
* YouTube Music public chart information
* Invidious instances for search
* PeerJS for cross-device communication
* Browser `BroadcastChannel` API
* Browser `Media Session` API

Availability and behavior of these services are outside the control of this project.

---

## Limitations

This project intentionally remains a lightweight static application.

It does not provide:

* User accounts
* A backend database
* Server-side playlist storage
* A personal YouTube API key
* Cloud-based user profiles
* Guaranteed availability of third-party services

Because the project relies on external services, functionality may stop working or require changes if those services modify their APIs, restrictions, availability, or behavior.

---

## License

MIT License — use, modify, and share.

See [`LICENSE`](LICENSE) for the full license text.

---

## Contributing

Pull requests are welcome.

Possible contribution areas include:

* New music categories
* More reliable Invidious instances
* Player improvements
* Mobile and car interface improvements
* Playlist improvements
* Synchronization improvements
* Accessibility improvements
* Performance optimizations

If you submit a pull request, please keep the project lightweight and avoid introducing unnecessary backend dependencies.

---

## Disclaimer

This project is provided **for testing, educational, research, and personal experimental use only**.

It is **not affiliated with, endorsed by, sponsored by, or approved by YouTube, YouTube Music, Google LLC, or their affiliates**.

The software is provided **"AS IS"**, without warranty of any kind.

The authors and contributors shall not be liable for any damages arising from the use of, inability to use, or malfunction of the software or any third-party services.

Users are solely responsible for complying with applicable laws, copyright regulations, and the terms of service of any third-party platforms they access through the software.

**Use at your own risk.**
