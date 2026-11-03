# Script Package: What if Earth stopped spinning for 5 seconds?

Format 1 (What if countdown). Lokasi: Copacabana, Rio de Janeiro. Durasi 85 detik. Tanpa VO, caption bahasa Inggris gaya editorial.

Isi package (taruh semua di `docs/scripts/earth-stops-5s/`):
- `script.json`: script siap pakai
- `brief.md`: brief scene 3D untuk scene-builder
- `sources.md`: verifikasi setiap angka dan klaim
- `README.md`: dokumen ini (timeline + rencana audio)

## Alur cerita

| Babak | Waktu | Skala | Isi |
|---|---|---|---|
| Hook | 0 sampai 8 dtk | Normal | Judul + Copacabana damai + countdown |
| Personal | 8 sampai 21 dtk | Kamu | Tanah berhenti, kamu tidak. Anehnya tidak ada angin |
| Kota | 21 sampai 43,5 dtk | Copacabana | Udara menabrak gedung, laut menjauh dari pantai |
| Planet | 43,5 sampai 62,5 dtk | Bumi | Terjadi di seluruh dunia. Tempat paling tenang: pesawat |
| Twist | 62,5 sampai 81,5 dtk | Kembali ke pantai | Bumi berputar lagi: hantaman kedua, laut kembali, matahari telat 5 detik |
| Loop | 81,5 sampai 85 dtk | - | End card kembali ke judul |

## Timeline lengkap

Timer slow-motion: 5 detik nyata = 60 detik layar (12x), dari detik 8,0 sampai 68,0. Setiap detik nyata ditandai satu pulsa bass pelan di detik layar 20, 32, 44, 56 (dan 68 bertepatan dengan hantaman twist).

| # | Waktu | Caption | Visual | HUD / counter | Audio | Drone |
|---|---|---|---|---|---|---|
| 1 | 0,0 sampai 4,0 | (judul) What if Earth stopped *spinning* for 5 seconds? Sub: THE GROUND AT COPACABANA MOVES AT 1,541 KM/H | Copacabana sore dari atas laut, dolly pelan | - | Ambience pantai (ombak, riuh orang) | 0,05 |
| 2 | 4,0 sampai 8,0 | You're on **Copacabana** Beach, Rio de Janeiro. | Setinggi mata di kerumunan | EARTH STOPS IN 0:04.000 ke 0:00.000 | Tick tiap detik | 0,12 |
| 3 | 8,0 sampai 12,0 | The ground **stops**. You don't. | Grade split: yang tertanam jadi abu-abu, yang bebas berjejak amber | EARTH SPINS AGAIN IN 0:05.000 + TIME SLOWED DOWN 12x | **silence_cut** + impact medium, shimmer tipis | 0,25 |
| 4 | 12,0 sampai 16,5 | You're still moving east at **1,541** km/h. Faster than **sound**. | Kamera ikut melayang ke timur bersama kerumunan | Counter 0 ke 1,541 KM/H (958 MPH) | Whoosh | 0,30 |
| 5 | 16,5 sampai 21,0 | Strangely, there's **no wind**. The air is still moving with you. | Close-up orang melayang, rambut diam, partikel udara sejajar | Timer jalan | Shimmer, hening | 0,30 |
| 6 | 21,0 sampai 25,5 | Until it **slams** into everything that stopped. | Udara menabrak gedung Avenida Atlântica, front kejut | Timer | Impact medium + angin menderu | 0,45 |
| 7 | 25,5 sampai 30,0 | The strongest gust ever recorded: **408** km/h. This is almost **4x** faster. | Sama, orbit pelan | Counter 408 ke 1,541 KM/H | Angin, tick | 0,45 |
| 8 | 30,0 sampai 34,5 | The Atlantic keeps moving too. The **sea** pulls away from the beach. | Dari atas: air menjauh, dasar laut terbuka | DRIFT EAST mulai tampil (785 M) | Swell + ombak tersedot | 0,50 |
| 9 | 34,5 sampai 39,0 | Every second, the sea and the crowd drift **428 metres** east. | Sama, kamera naik | DRIFT EAST naik (946 ke 1,106 M) | Drone saja | 0,50 |
| 10 | 39,0 sampai 43,5 | By the end, the water's edge will be **two kilometres** out. | Top-down peta: garis pantai asli vs tepi air | DRIFT EAST | Sweep naik + turun mulai 41,5 | 0,55 |
| 11 | 43,5 sampai 48,5 | And it's happening **everywhere** on Earth at once. | Tarik mundur ke bola Bumi, pita angin amber | Timer | **Impact huge di 44,0** + noise wall | 0,75 |
| 12 | 48,5 sampai 53,0 | Five **quadrillion** tonnes of air, most of it moving faster than sound. | Orbit bola Bumi | Timer | Noise wall + 2 swell | 0,80 |
| 13 | 53,0 sampai 57,5 | At the equator: **1,670** km/h. At the poles: **zero**. | Miring ke kutub, gradien kecepatan | Label di globe | Noise wall | 0,80 |
| 14 | 57,5 sampai 62,5 | The calmest place on Earth right now? A **plane** at 35,000 feet. | Pesawat jet tenang di atas awan, warna normal | Timer | Noise wall teredam jauh (low-pass), shimmer | 0,40 |
| 15 | 62,5 sampai 68,0 | Then the five seconds **run out**. | Kembali ke kerumunan yang sudah di atas air | Timer menuju 0 | Noise wall naik, tick, sweep naik + turun | 0,60 |
| 16 | 68,0 sampai 73,0 | Earth spins again. Everything that had stopped is hit a **second time**. | Grade kembali normal dengan flash, debu besar ke barat | EARTH: SPINNING AGAIN + DAY LENGTH +5 S | **Impact huge** + noise wall penuh lalu meluruh | 0,90 |
| 17 | 73,0 sampai 77,0 | And the sea that left is **coming back**. | Dinding air menuju pantai | Sama | Swell panjang + thud | 0,60 |
| 18 | 77,0 sampai 81,5 | Tomorrow, the sun will rise **five seconds late**. | Horizon fajar, sepi | Sama | **silence_cut**, shimmer sangat tipis | 0,20 |
| 19 | 81,5 sampai 85,0 | (end card) Sub: IMPOSSIBLE IN REALITY. THE PHYSICS IS REAL. | Hitam, judul, loop | - | Drone memudar ke hening | 0 ke 0 |

Kata bercetak tebal = `highlight` (warna aksen amber).

## Prinsip audio di video ini

- **Kontras utama**: ambience pantai yang hidup (0 sampai 8 dtk) lalu dipotong total di detik 8,0.
- **Pulsa detik nyata**: bass pelan di 20, 32, 44, 56. Penonton "merasakan" bahwa satu detik nyata itu lama. Ini ciri khas kita, tidak ada di referensi.
- **Dua klimaks**: 44,0 (skala planet) dan 68,0 (twist).
- **Jeda napas**: beat pesawat (57,5) sengaja diredam sebelum ledakan terakhir.
- **Akhir hening**: silence_cut di 77,0, cuma drone tipis memudar.

## Catatan untuk tim Claude Code

- `script.json` sudah memakai format asli dari `docs/SCRIPT_FORMAT.md` (scene copacabana, hud, drone, sfx v2, titleCard). **Bisa langsung dirender sebagai rough cut.**
- Untuk rough cut, `shot` memakai shot Copacabana/Kuta yang sudah ada. Shot yang sebenarnya diinginkan ada di field `shotBrief`, dan event-nya di `eventBrief` + `grade`. Field ini diabaikan pipeline, tapi jadi daftar kerja scene-builder (lihat `brief.md`).
- Event `earthStop`, `freeDriftEast`, `visibleAirCoMoving`, `shockFronts`, `seaWithdraws`, `globeWindBands`, `globeSpeedGradient`, `airlinerCruising`, `earthRespin`, `seaReturns` belum ada di kode. `return` sementara pakai `bigWave`.
- Readout HUD kedua (DRIFT EAST) diganti counter card per beat (785 ke 1.267 m). Label mph dihapus karena counter belum punya field secondary.
- Pulsa detik nyata dipasang sebagai `impact` level `small` gain 0,5 di detik absolut 20, 32, 56 (detik 44 ditangani impact huge).
- Ambience pakai `audio.ambience: "auto"`, lalu dimatikan permanen oleh `silence_cut` dengan `hold: "end"` di detik 8,0.

## Paket publikasi (draft)

- **Judul YouTube Shorts**: What if Earth stopped spinning for 5 seconds?
- **Caption TikTok / Reels**: Earth stops spinning for 5 seconds. You don't. 🌍 #physics #science #whatif #space #earth
- **Deskripsi**: tempel daftar sumber dari `sources.md`. Tambahkan kalimat: Thought experiment. Earth can't actually stop spinning.
- **Label AI**: aktifkan di semua platform.
- **Frame cover**: beat 4 (kerumunan melayang dengan jejak amber di atas pasir abu-abu).
