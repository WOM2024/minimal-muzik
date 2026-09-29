# Minimal Müzik

Araçlar ve mobil kullanım için tasarlanmış, hafif bir YouTube müzik deneyimi.

Karmaşık YouTube arayüzü ve reklamlardan arındırılmış, Spotify benzeri kategori keşfi + uzaktan playlist kontrolü. Tek sayfa HTML — sunucu, API anahtarı veya hesap gerekmez.

**Canlı demo (GitHub Pages):**  
`*wom2024.github.io/minimal-muzik*`

---

## Neden bu proje?

- **Araç kullanımı:** Büyük dokunma alanları, direksiyon / kulaklık Media Session kontrolleri (önceki–sonraki)
- **Sade arayüz:** YouTube’un kalabalık tasarımı ve reklamları yok
- **Keşif:** Her açılışta popüler ve çeşitlenen şarkılar (views + rastgele sayfa + karıştırma)
- **Uzaktan kontrol:** Telefondan arabaya / tablete playlist yönetimi (QR + kalıcı oda kodu)

---

## Özellikler

### Ana oynatıcı (`index.html`)
- Türkçe Pop, Rock, Arabesk, Rap, Slow, Yabancı Pop, Klasik, Lofi, Popüler kategorileri
- Metin arama + sesli arama (mikrofon)
- Favoriler (cihazda localStorage)
- Sonsuz kaydırma
- youtube-nocookie embed + autoplay
- Video bitince otomatik sonraki parça
- Media Session (kilit ekranı / direksiyon)
- **Kalıcı playlist kodu** (aynı cihazda her açılışta aynı kod)
- Koda dokununca QR popup → diğer cihaz playlist’e bağlanır

### Uzaktan playlist (`playlist.html`)
- **Shuffle** modu: ana listedeki sırayı canlı izle / kontrol et
- **Manuel** modu: kendi listeni oluştur
- YouTube Music resmi chart listeleri (Türkiye Top 100 vb.)
- Kategoriye göre hazır playlist önerileri
- Playlist seç → tüm şarkılar aktarılır, otomatik çalar
- Şarkı arama, tek tek ekle / çıkar
- Önceki / sonraki ve listeden seçim
- Aynı cihaz: BroadcastChannel (anında)
- Farklı cihaz: PeerJS oda kodu ile bağlantı

---

## Dosyalar

```
minimal-muzik/
├── index.html      # Ana müzik uygulaması
├── playlist.html   # Uzaktan playlist kontrolü
├── README.md
└── LICENSE         # MIT
```

---

## GitHub Pages ile kullanma

1. Bu repoyu açın veya fork’layın
2. **Settings → Pages**
3. Source: **Deploy from a branch**
4. Branch: `main`, folder: `/ (root)` → Save
5. 1–2 dakika sonra:

```
http://wom2024.github.io/minimal-muzik/
https://wom2024.github.io/minimal-muzik/playlist.html
```

FTP veya sunucu gerekmez. Statik dosyalar yeterlidir.

---

## Kullanım

1. `index.html` (veya Pages adresi) açılır
2. Sağ üstte **6 haneli kod** görünür (cihaza özel, kalıcı)
3. Koda dokunun → QR / link
4. İkinci cihazda QR okutun veya `playlist.html?c=KOD` açın
5. Playlist’ten **Manuel** → YouTube Music / kategori → listeyi **Ekle**
6. Ana ekranda müzik çalar; bitince sıradaki şarkıya geçer

---

## Teknik notlar

- Arama: Invidious API (`SEARCH_INSTANCES`)
- Oynatma: YouTube IFrame API + youtube-nocookie.com embed
- Senkron: localStorage + BroadcastChannel + PeerJS
- Oda kodu: localStorage (`minimal_muzik_room_code`) — cihaza göre sabit

Tarayıcı autoplay kuralları nedeniyle ilk çalmada bir kez dokunmak gerekebilir; sonrası otomatik devam eder.

---

## Yerelde çalıştırma

```bash
python -m http.server 8080
# veya: npx serve .
```

`http://localhost:8080` adresini açın.

---

## Özelleştirme

| Ne | Nerede |
|----|--------|
| Kategoriler | `index.html` → `CATEGORY_VARIANTS` |
| Invidious sunucuları | `SEARCH_INSTANCES` |
| Hazır playlist’ler | `playlist.html` → `CATEGORY_PLAYLISTS` |
| Oda kodu anahtarı | `ROOM_CODE_KEY` |

---

## Lisans

MIT — kullan, değiştir, paylaş.

## Katkı

PR’ler memnuniyetle karşılanır: yeni kategoriler, daha stabil Invidious instance’ları, oynatıcı iyileştirmeleri.
