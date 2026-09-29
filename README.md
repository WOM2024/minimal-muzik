# Minimal Müzik

Araçlar ve mobil kullanım için tasarlanmış, hafif bir YouTube müzik deneyimi.

Karmaşık YouTube arayüzü ve reklamlardan arındırılmış, Spotify benzeri kategori keşfi + uzaktan playlist kontrolü. Tek sayfa HTML — sunucu, API anahtarı veya hesap gerekmez.

## Yasal uyarı ve sorumluluk reddi

**Bu yazılım yalnızca test, eğitim, araştırma ve kişisel deneme amaçlı üretilmiştir.**

1. **Resmi ilişki yok**  
   Bu proje YouTube, YouTube Music, Google LLC veya bağlı kuruluşlarının resmi ürünü değildir; onlar tarafından onaylanmamış, desteklenmemiş veya onaylanmamıştır. Tüm ilgili ticari markalar sahiplerine aittir.

2. **Kullanım şartları ve telif**  
   Üçüncü taraf platformların (YouTube vb.) Kullanım Şartları, Topluluk Kuralları ve telif hakkı mevzuatına uymak **tamamen kullanıcının kendi sorumluluğundadır**. Bu yazılım aracılığıyla erişilen içeriklerin yasalara uygun kullanıldığından kullanıcı sorumludur.

3. **“Olduğu gibi” (AS-IS)**  
   Yazılım hiçbir garanti olmaksızın, açık veya zımni hiçbir taahhüt içermeksizin sunulur. Ticari elverişlilik, belirli bir amaca uygunluk, kesintisiz veya hatasız çalışma **garanti edilmez**.

4. **Sorumluluk sınırı**  
   Yazar(lar), geliştirici(ler) ve katkıda bulunanlar; bu yazılımın kullanımından, kullanılamamasından veya üçüncü taraf servislerin (API, proxy, gömülü oynatıcı vb.) arızasından doğan doğrudan, dolaylı, arızi, özel veya sonuç olarak ortaya çıkan hiçbir zarardan **sorumlu tutulamaz**. Bu, veri kaybı, gelir kaybı, cihaz arızası, yasal yaptırım veya üçüncü taraf talepleri için de geçerlidir.

5. **Üçüncü taraf bağımlılık**  
   Arama ve oynatma üçüncü taraf servislere bağlıdır. Bu servisler önceden haber verilmeden değişebilir, kısıtlanabilir veya kapanabilir. Proje sahibi bunların sürekliliğini taahhüt etmez.

6. **Kabul**  
   Bu yazılımı indiren, forklayan, çalıştıran veya paylaşan kişi, yukarıdaki koşulları okuduğunu ve kabul ettiğini beyan etmiş sayılır. Kabul etmiyorsanız yazılımı kullanmayın ve cihazınızdan silin.

7. **Ticari / üretim kullanımı**  
   Yoğun trafik, ticari ürün veya kritik sistemlerde kullanım önerilmez ve desteklenmez. Böyle bir kullanım tamamen kullanıcının riski altındadır.


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

## Disclaimer

This project is provided **for testing, educational, and personal experimental use only**. It is **not** affiliated with YouTube, YouTube Music, or Google. The software is provided **“AS IS”**, without warranty of any kind. Authors shall not be liable for any damages arising from use. Compliance with third-party terms of service and copyright law is the sole responsibility of the user. Use at your own risk.
