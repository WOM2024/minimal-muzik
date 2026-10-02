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
| **Remote** (in your hand) | Phone or second tablet on the same device/browser context or connected through PeerJS | `playlist.html` |

The phone does not mirror the TV. It acts as a separate remote: change tracks, build a playlist, browse categories, search for content, and control playback while the main screen displays the selected video.

Same-browser communication uses `BroadcastChannel` and browser storage events where supported. Cross-device communication uses PeerJS and a room code. A QR code can make it easier to open the remote page.

> **Important:** A room code is a connection identifier, not a secure authentication mechanism. Do not use it to protect sensitive content or assume that anyone who knows the code is authorized.

---

## Why it exists

- **TV and car-oriented interface:** Large touch targets and playback controls intended for a screen that may be farther away.
- **Phone as a remote:** Manage playback and playlists from a second device instead of repeatedly interacting with the main screen.
- **Content discovery:** Browse categories and search for videos or songs through supported external services.
- **Favorites:** Keep a list of favorite items in the browser on the device where they were saved.
- **Minimal setup:** The project consists of static files and can be hosted on GitHub Pages or another static web host.
- **No project account system:** The project does not require a SuperYT account or a project-managed database. External services may still process connection and request data.

---

## Features

### Player — `index.html`

- Category-based browsing, including Turkish Pop, Turkish Rock, Arabesque, Rap, Slow, International Pop, Classical, Lofi, and Popular.
- Text-based video/song search through configured Invidious instances.
- Category query variations intended to provide different results.
- Favorites saved in browser `localStorage`.
- Progressive loading of search results using pagination and `IntersectionObserver`.
- Embedded video playback through the player endpoints and APIs configured in the source code.
- Playback queue with previous/next controls.
- Automatic attempt to advance to the next item when playback ends, subject to player and browser behavior.
- Player-focused/full-screen interface, subject to browser permissions and the capabilities of the embedded player.
- Media Session integration where supported, including play/pause and previous/next actions.
- Room-code and QR/link flow for opening the remote interface.
- Responsive layout intended for mobile, tablet, TV-browser, and car-head-unit use.

### Remote — `playlist.html`

- Connect to the player using a room code or a QR/link URL.
- **Shuffle mode:** Control the current player flow where supported by the synchronization logic.
- **Manual mode:** Build and manage a queue from the remote device.
- Browse ready-made chart/category playlist options.
- Search for videos or songs and add individual results to the queue.
- Add, remove, and clear queued items.
- Import a playlist where the relevant external endpoint provides the required data.
- Previous/next controls and selection of an item to play.
- Display current playback information when that information is available from the player.
- Connection status and reconnection attempts.
- Touch-friendly, responsive layout for phones and tablets.

### Remote-control paths

| **Action** | **Expected result** |
| --- | --- |
| Select an item on `index.html` | Attempts to play the selected item |
| Use remote next/previous | Sends a playback command to the player |
| Select an item from the remote queue | Requests playback of that item |
| Import or synchronize a queue | Attempts to update the player queue |
| Use steering-wheel/headset media controls | Works only when the browser and device expose the relevant Media Session actions |
| Current track ends | Attempts to advance to the next item when supported |

> **Fullscreen and autoplay limitations:** Browsers generally require a user gesture before allowing audible autoplay or programmatic fullscreen. A remote command cannot reliably bypass these browser security rules. Exact behavior depends on the browser, device, and embedded player.

---

## Files

```text
SUPERYT-Minimal-Music/
├── index.html       # Main player and content discovery
├── playlist.html    # Remote control and playlist manager
├── README.md        # Project documentation
├── superyt-logo.png # Project logo
└── LICENSE          # License information
```

The exact files in your repository may differ. Check that all referenced assets are included before publishing.

---

## Deploy on GitHub Pages

1. Create a GitHub repository and upload the project files to its root directory.
2. Open **Settings → Pages**.
3. Under **Build and deployment**, select **Deploy from a branch**.
4. Select the `main` (or `master`) branch and the `/(root)` folder, then save.
5. After GitHub Pages publishes the site, open the generated URL:

```text
https://YOUR_USER.github.io/YOUR_REPO/
https://YOUR_USER.github.io/YOUR_REPO/playlist.html
```

No build step or custom backend is required for static hosting. However, playback, search, and cross-device control rely on external services and browser features; GitHub Pages does not operate or guarantee those services.

---

## Typical setups

### Living-room TV

1. Open the hosted `index.html` page in the TV browser, or use a computer connected to the TV.
2. Find the room code or QR/link on the player page, if available.
3. Open `playlist.html` on your phone using the link or QR code.
4. Search for content or manage the playlist from the phone.

### Car head unit

1. Open the player page through an `http://` or `https://` URL in a compatible browser.
2. Connect the phone to the same local network or use the configured PeerJS room connection.
3. Set up the playlist and playback before driving.
4. Do not operate the phone or interact with the interface while driving. Follow local road-safety laws and use controls only when safe and lawful.

Compatibility with car browsers, steering-wheel controls, Bluetooth buttons, and background playback is not guaranteed.

### Same-device demo

1. Open `index.html` in one browser tab.
2. Open `playlist.html` in another tab using the appropriate room code.
3. Test local synchronization if the browser supports the required APIs.

Same-device synchronization may not work when pages are opened through `file://`, in isolated browser contexts, or when browser privacy settings restrict storage or messaging.

---

## Local development

For more reliable browser API behavior, serve the files over HTTP rather than opening them directly through `file://`.

For example, if Python is installed:

```bash
python -m http.server 8080
```

Then open:

```text
http://localhost:8080/
http://localhost:8080/playlist.html
```

A static server is sufficient for local testing. It does not provide a backend for the external services used by the project.

---

## Technical overview

| **Component** | **Implementation / purpose** |
| --- | --- |
| Search and metadata | Configured public Invidious instances |
| Video playback | Embedded player/API endpoints configured in the source |
| Search-result thumbnails | URLs returned by the external search service |
| Same-browser synchronization | `BroadcastChannel` and browser storage events, where supported |
| Cross-device synchronization | PeerJS data connections |
| Room code | Browser `localStorage` or the mechanism configured in the source |
| Favorites | Browser `localStorage` |
| Media controls | `navigator.mediaSession`, where supported |
| Progressive result loading | Pagination and `IntersectionObserver` |
| QR code | External QR-generation service, if enabled in the source |
| Sponsor segment information | SponsorBlock API, if enabled in the source |

Implementation details may change as the source code evolves. Refer to the current files in the repository for the actual endpoints, storage keys, and control flow.

---

## Customization

Depending on the current source code, you can customize:

| **What** | **Where to look** |
| --- | --- |
| Categories and search variations | Category/query configuration in `index.html` |
| Search service instances | Invidious instance configuration in `index.html` |
| Ready-made playlists | Playlist/category mappings in `playlist.html` |
| Room-code behavior | Room-code constants and storage logic |
| PeerJS connection behavior | PeerJS configuration and connection logic |
| Visual appearance | CSS in `index.html` and `playlist.html` |

Always review the current source before changing configuration values. Public service instances may have different availability, rate limits, and terms.

---

## Privacy and data handling

SuperYT does not appear to include its own account system or server-side user database. However, this does **not** mean that the application makes no network requests or that no data is processed by third parties.

Depending on the features used, requests may be sent to:

- **Invidious instances** for search results and playlist metadata.
- **YouTube and embedded-player endpoints** for playback.
- **PeerJS infrastructure** for cross-device connections and control messages.
- **SponsorBlock** for segment information, if enabled.
- **QR-generation services** for creating QR images, if enabled.
- **CDN hosts** for loading JavaScript libraries.
- **Thumbnail hosts** to display search-result images.

Third-party services may receive technical information such as IP addresses, requested URLs, search terms, video identifiers, or connection metadata. Their data handling is governed by their own terms and privacy policies, not by this repository.

Favorites and other local settings stored in `localStorage` remain in the relevant browser profile unless the browser clears them or the application changes its storage behavior. Anyone with access to that browser profile may be able to access locally stored information.

Review the current privacy policies and terms of each external service before use. Do not enter sensitive or confidential information into the application.

---

## Testing status and known limitations

**This project is experimental and intended for testing.** Do not assume that every feature has been tested successfully on every browser, TV, car head unit, phone, or network.

Known limitations include:

- Public Invidious instances may be unavailable, slow, rate-limited, or incompatible with the current implementation.
- Search results and playlist metadata may be incomplete or change without notice.
- YouTube may restrict playback due to region, age, content, embedding, or account-related rules.
- Autoplay with sound may require a user gesture.
- Fullscreen behavior is controlled by browser security rules and may not work when triggered remotely.
- Media Session, steering-wheel buttons, Bluetooth controls, and background playback vary by device and browser.
- PeerJS connections may fail due to network restrictions, service outages, or browser limitations.
- A room code is not secure authentication; anyone who obtains it may be able to attempt to connect.
- Browser storage can be cleared, causing favorites or room-code settings to be lost.
- External APIs and endpoints may change or stop working.
- The project requires an internet connection for its core features and is not an offline music player.

When reporting an issue, include the browser, operating system/device, steps to reproduce, and relevant error messages. Do not publish private links, personal data, or active room codes in public issue reports.

---

## Legal notice and user responsibility

### 1. Experimental use only

SuperYT is provided for learning, development, interoperability testing, and personal experimentation. It is **not a guarantee that any particular use is lawful**, and it is not legal advice. Users are responsible for determining whether their intended use is permitted under the laws applicable to them and the terms of the relevant services.

### 2. User responsibility

By using, modifying, hosting, or distributing this project, you are responsible for your own actions and for ensuring that your use complies with applicable laws, third-party terms, and intellectual-property rights.

Do not use the project to access content without authorization, circumvent technical restrictions, download or reproduce copyrighted content without permission, redistribute content unlawfully, or use third-party content commercially without the required rights or licenses.

Nothing in this notice transfers a user's legal obligations to the project author or overrides mandatory law.

### 3. Copyright and related rights

In Türkiye, Law No. 5846 on Intellectual and Artistic Works (FSEK) is a key part of the legal framework governing copyright and related rights. The fact that a video or song can be found or played through a third-party service does not, by itself, grant permission to download, reproduce, distribute, publicly communicate, adapt, or commercially exploit it.

Users must obtain any permissions required for their intended use and comply with applicable licenses and service terms. SuperYT is not intended to host copies of copyrighted media, and it does not grant users rights to third-party content.

### 4. Third-party services and trademarks

YouTube, Google, Invidious instance operators, PeerJS, SponsorBlock, QR-service operators, CDN providers, and content/thumbnail hosts are independent third parties. Their names and services are referenced only to describe integrations or dependencies. Their inclusion does not imply endorsement, sponsorship, partnership, or official affiliation.

Third-party services may change their terms, restrict access, remove content, collect technical data, or become unavailable. Users must review and comply with the relevant providers' current terms and policies.

### 5. Disclaimer of warranties

To the maximum extent permitted by applicable law, this project is provided **“AS IS” and “AS AVAILABLE,”** without warranties or conditions of any kind, whether express or implied. No guarantee is made that the project will be uninterrupted, secure, error-free, suitable for a particular purpose, compatible with a particular device, or continuously compatible with third-party services.

### 6. Limitation of liability

To the extent permitted by applicable law, the project author and contributors shall not be liable for indirect or consequential loss, loss of data, loss of profits, service interruption, device incompatibility, or issues arising from third-party services or from the user's use of the project.

This clause does not exclude or limit any liability that cannot lawfully be excluded or limited. The enforceability and scope of any limitation may vary by jurisdiction and circumstances. This README is not a substitute for legal advice, and it does not guarantee immunity from legal claims.

### 7. Rights-holder notices

If you believe that material in this repository infringes your copyright or other rights, contact the repository owner and identify the specific file or URL, the right you hold, the basis of your claim, and the action requested. The notice will need to be reviewed; a notice alone does not automatically establish infringement. You may also use the relevant hosting platform's formal reporting process.

### 8. Legal and service references

- [Turkish Ministry of Culture and Tourism — Copyright legislation](https://telifhaklari.ktb.gov.tr/TR-332443/kanunlar.html)
- [Law No. 5846 — Grand National Assembly of Türkiye](https://www5.tbmm.gov.tr/develop/owa/kanun_ss.durumu?kanun_no=5846)
- [YouTube Terms of Service](https://www.youtube.com/t/terms)
- [Invidious project](https://github.com/iv-org/invidious)
- [PeerJS](https://peerjs.com/)
- [SponsorBlock](https://sponsor.ajay.app/)

These links are provided for general reference and do not imply that the listed services endorse this project. Laws and their application vary by jurisdiction and facts. Seek advice from a qualified lawyer before commercial distribution or other higher-risk use.

---

## License

See the [`LICENSE`](LICENSE) file in this repository.

The supplied license file should be reviewed before publication to confirm that its copyright notice and licensing terms are appropriate for this project and that the repository's code and assets may lawfully be distributed under those terms. The MIT License does not grant rights to third-party videos, music, logos, APIs, or services.

---

## Contributing

Contributions may be submitted through issues or pull requests. Useful areas include more resilient search handling, improved TV/car usability, accessibility, playlist management, and clearer error handling.

By contributing, ensure that you have the right to submit your contribution under the repository's license. Do not include copyrighted assets, credentials, personal information, or other material that you are not authorized to publish.

---

## Disclaimer

**Use at your own risk.** The user is responsible for how the software is configured and used, for checking applicable laws and third-party terms, and for obtaining any permissions required for content they access or distribute. The project author does not guarantee availability, legality of third-party content, or compatibility with any particular device. Nothing in this README removes rights or liabilities that cannot be excluded under applicable law.
