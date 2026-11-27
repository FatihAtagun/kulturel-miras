# Kültür Atlası

Türkiye'nin 81 ilinin kendine özgü kültürel mirasını (yemek, tarım ürünleri, el sanatları, halk oyunları, tarihi/doğal miras, UNESCO alanları ve etkinlikler) etkileşimli bir harita üzerinden sunan statik web sitesi.

`index.html` dosyasını tarayıcıda açmak yeterli; derleme ya da sunucu gerekmez (`file://` ile çalışır).

## Yapı

| Dosya | İçerik |
| --- | --- |
| `index.html` | Sayfa iskeleti, header, anasayfa ve diğer görünümlerin kapsayıcıları |
| `styles.css` | Gece/gündüz tema token'ları, animasyonlar, tüm sayfa stilleri |
| `script.js` | Harita bileşeni, hover kartı, hash tabanlı yönlendirme, sayfalar, arama |
| `js/cities.js` | 81 il için kültürel miras verisi (düzenlemek için burası) |
| `js/turkey-paths.js` | `assets/turkey.svg`'den çıkarılmış il sınırları |

## Sayfalar

- `#/` — Anasayfa: haritada ilin üzerine gelince bilgi kartı; yan menüden Miras / Etkinlik / Favori görünümleri
- `#/sehirler` — 81 il, bölge filtresi ve arama (`#/sehirler/ege` gibi)
- `#/kesfet` — Kategoriye göre keşif, günün şehri, "Hangi şehrin?" mini oyunu
- `#/miras` — UNESCO Dünya Mirası alanları ve bölgelere göre miras
- `#/etkinlikler` — 12 aylık etkinlik takvimi
- `#/sehir/<il>` — İl detay sayfası (`#/sehir/konya`)
- `#/favoriler` — Favori iller (tarayıcıda saklanır)

Kısayollar: `Ctrl/⌘ + K` veya `/` ile arama.

## Veri ekleme

`js/cities.js` içinde ilgili ilin dizilerine yeni öğe eklemek yeterli. Etkinlikler `{ ad, ay }` biçimindedir (ay: 1–12).

## Hero arka plan

Hero bölümü `assets/hero-background.png` dosyasını kullanır; dosya yoksa `assets/hero-blend.svg` görünür.
