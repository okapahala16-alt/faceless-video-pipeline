# QA report: earth-stops-5s, Fase 1

Reviewer: qa-reviewer (independen, tidak mengubah kode). Tanggal: 2026-11-03.
Build yang dinilai: `public/timeline.json` + `public/audio/mix.wav` (md5 `1887303042f04d19ecaa95f257fa88f2`).
Stills: `out/stills/*_guides.png` (dirender 14:31, lebih baru dari semua file di `src/`, jadi mewakili kode sekarang).
Frame tambahan QA (tidak menimpa out/stills, dirender ke scratchpad):
`/tmp/claude-0/-home-user/70c5c89b-04e4-567a-aca3-c8e1c3d889da/scratchpad/qa_stills/element-{0239,0240,0241,0248,0362,0395,0470,0500,2039,2040,2041}.png`
dan `/tmp/claude-0/-home-user/70c5c89b-04e4-567a-aca3-c8e1c3d889da/scratchpad/qa_loop/element-{0000,2549}.png`.
Audio diukur independen dengan numpy/scipy + `pipeline/audio_fx.lufs()`. Build ulang ke scratchpad
(`/tmp/claude-0/-home-user/70c5c89b-04e4-567a-aca3-c8e1c3d889da/scratchpad/rebuild/`) menghasilkan md5 mix.wav dan timeline.json yang identik dengan public/.

## Ringkasan

| Hasil | Jumlah |
|---|---|
| LULUS | 32 |
| GAGAL | 2 (A1 audio punch di pita HP, H1 glitch HUD 1 frame di 68,0) |
| Catatan (tidak memblokir) | 7 |
| DI LUAR SCOPE | Fase 2, 3, 4 (lihat bawah) |

## GAGAL

### A1. Punch impact 44,0 dan 68,0 tidak terdengar di speaker HP (GAGAL, sedang) → sound-designer
Klaim full-band terverifikasi (lihat A4), tapi seluruh "punch" ada di bawah 150 Hz. Di atas 150 Hz
(kira-kira yang bisa diputar speaker HP, tempat mayoritas penonton TikTok/Shorts) impact tidak lebih keras dari 1 dtk sebelumnya:

| Waktu | RMS 0-0,3 dtk vs 1 dtk sebelum, full band | sama, high-pass 150 Hz | K-weighted |
|---|---|---|---|
| 44,0 | +12,1 dB | **-0,2 dB** | +7,4 dB |
| 68,0 | +11,4 dB | **-1,3 dB** | +5,1 dB |

Trace 100 ms di atas 150 Hz: 44,0 → riser 43,0-43,4 di -15,5 dB, dip pre-duck -31,6 dB, hit -16,0 dB, lalu turun ke -20..-23 dB;
68,0 → sweep -15,5 dB, dip -27,0 dB, hit -15,3 dB, lalu -20..-22 dB. Artinya di HP klimaks cuma terasa sebagai klik singkat
setelah jeda, lalu lebih pelan dari build-up. Riser 34,5-43,5 juga hampir datar di atas 150 Hz (-24 dB konstan sampai ~41 dtk).
Saran: tambah lapisan transien mid (body/crack 200 Hz-3 kHz) di impact huge, atau turunkan sweep/riser sesaat sebelum hit,
supaya hit di pita >150 Hz minimal +6 dB di atas 1 dtk sebelumnya. Jaga limiter tetap ≤3 dB.

### H1. Frame 2040 (68,000 dtk) HUD menampilkan "0:00.000" di bawah label "EARTH IS" (GAGAL, ringan) → scene-builder
Bukti: `.../qa_stills/element-2040.png` menunjukkan "EARTH IS / 0:00.000 / DAY LENGTH +5 S"; frame 2041 baru "SPINNING".
Glitch satu frame tepat di frame klimaks. Penyebab: `src/Overlay.tsx` `hudAt()` → `done: v === to && t > b.start`; beat spin
punya `from:0,to:0`, jadi di frame pertama beat (t == b.start) belum "done". Perbaikan: anggap done bila from === to (atau `t >= b.start`).
Cek ulang Kuta setelah diubah (Kuta tidak memakai `end`, jadi seharusnya aman).

## LULUS (Fase 1)

### Grade dan efek
| # | Item | Bukti |
|---|---|---|
| G1 | Grade split: tertanam slate, bebas berwarna | 03_stop_f300, 04_speed_f428, 06_wall_f698, 08/09/10/11/12/13, 15_timer_f1958: pasir, gedung, kios, palem, Leme, Sugarloaf jadi abu slate; orang, payung, handuk, bola, laut tetap berwarna. `PALETTE.anchoredGrade = #5B6672` (src/grade.ts) |
| G2 | Rentang grade: split stop s/d poles + timer, normal di plane dan mulai spin | timeline.json grade per beat; 14_plane_f1800 normal, 15_timer split, 16_spin normal |
| G3 | Transisi 8,0 dalam 2 frame | f239 hijau/krem (Leme px (41,88,39)), f240 setengah (53,80,65), f241 slate (61,72,85) |
| G4 | Kembali normal di 68,0 dalam 2 frame | f2039 split, f2040 setengah (pasir (186,180,166)), f2041 normal (210,199,168) |
| G5 | Jejak gerak amber | 03_stop_f300, extra_f330, 04_speed_f428, 15_timer_f1958, extra_f1925/1950/1985: garis amber di belakang tubuh; src/FreeFx.tsx Trails mengarah ke barat (berlawanan EAST) = benar untuk jejak |
| G6 | Drift kerumunan/props ke timur | `EAST = (-0.6, 0, -0.8)` (src/sim.ts:171) = menjauhi pantai ke laut, sedikit ke Leme (-x). f362→f470: kerumunan + payung melayang di atas laut, kota menjauh. 10-13: pasir kosong (kerumunan latar + payung ikut pergi). Kecepatan 428,2/12 m/s sesuai brief |
| G7 | Partikel udara amber (calm) | 05_calm_f563, extra_f560, f500: garis amber tipis sejajar; AirFlow ikut `driftAt` (tanpa angin relatif) |
| G8 | Freeze + shake kecil di 8,0 | f239/f240/f241 framing identik (freeze 0,2 dtk, `STOP_FREEZE`), f248 framing tersentak (shake 0,3 dtk, amplitudo 0,25 m, `eventShake`) |

### Shot
| # | Item | Bukti |
|---|---|---|
| S1 | copa_crowd_level (ground, stop, timer) | 02_ground_f180, extra_f130/150/200: setinggi mata, menghadap timur laut ke Leme + Sugarloaf. Ground→stop kontinu (f239=f240). Timer: kerumunan sudah di atas air (f1925-1985) |
| S2 | tracking_east_with_crowd | f362, f395, f428, f470: kamera ikut kerumunan, kota menjauh |
| S3 | tracking_east_close | f500, f560, f563: close-up satu orang melayang |
| S4 | Tidak ada payung/prop di depan kamera 4-16 dtk dan 64-66 dtk | f130, f150, f180, f200, f239-248, f300, f330, f362, f395, f428, f430, f470, f1925, f1950, f1958, f1985: tidak ada payung/kanopi/prop menutup lensa (cull umbrella 3,2 m di World.tsx:239 bekerja). Lihat catatan C1 soal tubuh orang |

### Teks dan UI
| # | Item | Bukti |
|---|---|---|
| T1 | Caption editorial terbaca di latar ramai | pita gelap + radial di belakang caption; 02, 03, 04 (kerumunan), 06/07 (calçadão), 15: semua terbaca |
| T2 | Maks 2 baris, tanpa kata yatim | 18 caption dicek di stills 02-18: semua 1-2 baris, tidak ada baris satu kata (`textWrap: balance`). Lihat C3 |
| T3 | Highlight amber tampil | semua beat ber-caption, mis. 02 "Copacabana", 04 "1,541"/"sound", 05 "no wind", 07 "408"/"4x" |
| T4 | Caption di dalam safe zone | caption y ~1170-1300, x 90-940 di semua stills; tidak masuk zona merah |
| T5 | Subjudul title card terbaca di HP | 01_title_f60: "THE GROUND AT COPACABANA / MOVES AT 1,541 KM/H" 34 px, dua baris seimbang, kontras cukup |
| T6 | Counter card tidak menabrak HUD | 04_speed, 07_record, 08_sea, 09_meters, 10_shore, f395, f470: card mulai y≈426, HUD sub selesai y≈395 (jarak ~30 px) |
| T7 | HUD terbaca | label/clock/sub terbaca di semua stills; kontras median teks vs latar ±5,2-5,5:1 bahkan di fasad krem (14_plane, 16_spin), 6,1:1 di langit (05_calm). Lihat C2 |
| T8 | HUD "EARTH IS" / "SPINNING" satu baris (spin, return, sunrise) | 16_spin_f2115, 17_return_f2250, 18_sunrise_f2378, f2041 |
| T9 | Angka HUD benar | f240 0:05.000; f245 4.986; f1950 (65,0 dtk) 0:00.250 = 5 − 57/12; f2039 0:00.002 |

### Audio
| # | Item | Hasil terukur |
|---|---|---|
| A2 | Loudness -14..-16 LUFS | **-14,74 LUFS** integrated (BS.1770-4). Klaim -14,74: cocok |
| A3 | Limiter ≤ ~3 dB | **2,9 dB** maks (output pipeline saat build ulang identik; target diturunkan otomatis ke -14,75). Klaim 2,92: cocok. Per impact: 44,0 0,0 dB, 56,0 1,7 dB, 68,0 1,7 dB |
| A4 | Tanpa clipping | peak -1,00 dBFS, true peak (4x) -0,38 dBTP, 0 sampel di full scale, maks 2 sampel berturut di ceiling (bukan flat-top). PCM 16 bit |
| A5 | Punch full band 44,0 / 68,0 | RMS 0-0,25 dtk vs 1 dtk sebelum: **+12,2 dB @44** (klaim +12,2 cocok), **+11,5 dB @68** (klaim +11,8, selisih 0,3 dB, wajar beda jendela). Onset tepat: 44,0000 dtk (frame 1320,00), 68,0006 dtk (frame 2040,02). Tapi lihat GAGAL A1 |
| A6 | Tick satu klik per detik 4-7 dtk | cross-correlation dengan `fx.tick()`: tepat 4 klik di 4,000 / 5,000 / 6,000 / 7,000 dtk (ncc 0,74-0,84), tidak ada klik ganda. Onset >3 kHz 3,8-8,2: 4,003, 5,003, 6,003, 7,003, (7,167 ambience), 8,003 (impact) |
| A7 | Riser/gemuruh 34,5-43,5 | audioEvents: undertow 34,5-43,5, riser 35,5-43,5, sweep 41,5-43,5. Full band naik dari -23 ke -13..-15 dBFS (0,5 dtk RMS). Catatan pita HP di A1 |
| A8 | silence_cut 8,0 | ambience >2 kHz turun dari ±-50 dB (7,0-7,9) ke -70..-74 dB (8,4-8,9) setelah impact meluruh; onset impact 8,0001 dtk |
| A9 | silence_cut 77,0 | full band -21 → -32 dB di 77,0-77,1; >2 kHz -48 → -73 dB |

### Umum
| # | Item | Bukti |
|---|---|---|
| U1 | Tidak ada logo/merek/karakter berhak cipta | semua stills: tidak ada logo, teks merek, atau patung Cristo; font open source (EB Garamond, Space Mono, Archivo Black via @fontsource); drone `music: null`, ambience synth |
| U2 | End card loop ke judul | 19_end_f2498 dan frame 2549 vs frame 0: judul, aksen "spinning", subjudul sama posisi. Lihat C4 |
| U3 | Durasi 85,0 dtk | timeline.json duration 85.0; mix.wav 85,000 dtk 48 kHz stereo; jumlah beat 19 |

## Catatan (tidak memblokir, saran)
- **C1** Tubuh orang sangat dekat lensa di awal beat stop: extra_f245 dan f248 (topi + badan menutupi ±30 % kiri), 03_stop_f300 dan extra_f330 (lengan cokelat besar melintang y 120-420 sampai x≈360, menyentuh area label HUD; teks masih terbaca, crop dicek). Bukan payung/prop, jadi lolos S4, tapi komposisinya mengganggu. → scene-builder: pertimbangkan radius cull orang >1,6 m atau fade untuk tubuh yang terangkat dekat kamera.
- **C2** HUD di atas fasad krem bertekstur jendela (14_plane, 16_spin, 17_return, 18_sunrise) kontras cukup tapi teksturnya ramai; latar ini placeholder shot Fase 2-4, cek ulang setelah shot final ada. → scene-builder.
- **C3** 13_poles_f1658: angka dan satuan terpisah baris ("1,670" / "km/h."). Bukan kata yatim, tapi kurang rapi. → script-integrator (pakai non-breaking space "1,670 km/h") atau scene-builder (nbsp otomatis antara angka dan satuan).
- **C4** Seam loop: frame 2549 pantai kosong, frame 0 pantai penuh orang (beda piksel >8 level di 13,3 % area, di balik backdrop 0,8). Judul identik, jadi loop judul lulus; kerumunan "muncul lagi" di titik loop. → script-integrator (`loopBackdrop` ke ~0,95) atau scene-builder.
- **C5** Jolt visual di 8,2 dtk (setelah freeze 0,2 dtk), impact audio di 8,0. Sesuai brief (freeze lalu hentakan), hanya untuk diketahui.
- **C6** True peak -0,38 dBTP: di bawah 0 tapi di atas -1 dBTP yang umum disarankan untuk transcode platform. → sound-designer (opsional: limiter true-peak/oversampled).
- **C7** Tick di 66,0 dan 67,0 (beat timer) tertutup sweep + noise wall (ncc <0,5, hanya 65,0 terdeteksi). Di luar daftar Fase 1, untuk diketahui. → sound-designer.

## DI LUAR SCOPE (tidak dinilai)
- **Fase 2**: seaWithdraws/seaReturns/dasar laut (08_sea, 09_meters, 10_shore, 17_return masih placeholder `skyline_from_sea`/`bay_aerial`, `bigWave`), shockFronts (06_wall, 07_record tanpa front kejut), peta top-down, earthRespin flash + debris (f2040-2041 tanpa flash), shot avenida/shoreline/map/copa_wide_from_sea. Angka counter DRIFT EAST (899 m di 32,3 dtk, 1,049 m di 36,7 dtk) ikut dinilai saat Fase 2.
- **Fase 3**: globe (planet, air, poles: 11/12/13 masih bay_aerial), pesawat (14_plane masih fasad gedung), horizon fajar (18_sunrise masih fasad gedung).
- **Fase 4**: golden hour (langit masih siang biru), landmark (Sugarloaf dome sangat besar dan masuk zona kanan di 01/10-13, Forte belum ada), tinggi gedung.

## Re-check (setelah perbaikan, 2026-11-03 ±14:55)

Build yang dinilai: mix.wav md5 `260c694d8daf092f7fce64676bf6415e`. Build ulang ke scratchpad
(`/tmp/claude-0/-home-user/70c5c89b-04e4-567a-aca3-c8e1c3d889da/scratchpad/rebuild2/`) menghasilkan md5 mix.wav dan timeline.json yang identik.
Frame re-check: `/tmp/claude-0/-home-user/70c5c89b-04e4-567a-aca3-c8e1c3d889da/scratchpad/qa_recheck/g/element-{1658,2039,2040,2041}.png` (guides),
`.../qa_recheck/n/element-{0000,2549}.png` (tanpa guides). out/stills tidak disentuh.

| Item | Hasil | Bukti |
|---|---|---|
| A1 punch di pita HP | **LULUS** | 0-0,3 dtk vs 1 dtk sebelum: @44 >150 Hz **+9,3 dB**, 200 Hz-3 kHz **+7,6 dB**, K-weighted +10,7, full +14,1. @68 >150 Hz **+8,9 dB**, 200 Hz-3 kHz **+7,4 dB**, K-weighted +8,7, full +12,8 (sebelumnya -0,2 / -1,3 dB). Hit di >150 Hz -8,6 / -7,4 dB vs build-up -17 dB |
| A1 urutan klimaks | **LULUS** | level absolut setelah hit (0-0,3 dtk): 68,0 lebih keras dari 44,0 di semua pita (>150 Hz -9,4 vs -10,8 dB; 200-3k -11,4 vs -12,8; K-w -7,6 vs -8,0). Delta relatif 68 sedikit lebih kecil (+8,9 vs +9,3) karena build-up 65-68 lebih keras; tidak lebih lemah |
| Limiter ≤3 dB | **LULUS** | maks 2,8 dB (pipeline); per impact 44,0 0,0 dB, 56,0 0,1 dB, 68,0 2,7 dB |
| LUFS -14..-16 | **LULUS (dekat batas)** | **-15,76 LUFS** (turun dari -14,74; target diturunkan otomatis ke -15,75 agar limiter <3 dB). Hanya 0,24 LU di atas batas bawah |
| C6 true peak ≤ -1 dBTP | **LULUS** | **-1,05 dBTP** (4x oversampling, diukur sendiri), sample peak -1,12 dBFS |
| Clipping | **LULUS** | 0 sampel full scale, maks 1 sampel berturut di peak |
| C7 tick 65/66/67 di atas sweep | **LULUS** | ncc dengan `fx.tick()`: 65,0 0,91 / 66,0 0,84 / 67,0 0,86 (sebelumnya hanya 65,0 terdeteksi). Pita 1,5-2,2 kHz naik +23,5 / +21,4 / +18,5 dB dibanding 70 ms sebelumnya |
| Tick 4-7 (regresi) | **LULUS** | tetap tepat 4 klik di 4,0 / 5,0 / 6,0 / 7,0 (ncc 0,74-0,84), +24 dB di atas latar |
| silence_cut (regresi) | **LULUS** | 8,0: >2 kHz -42,8 → -63,6 dB; 77,0: full -19,2 → -33,5 dB |
| H1 HUD frame 2040 | **LULUS** | element-2040: "EARTH IS / SPINNING / DAY LENGTH +5 S", tidak ada "0:00.000". element-2039 masih 0:00.002 (benar), 2041 SPINNING |
| C3 caption poles | **LULUS** | element-1658: "At the equator: 1,670 km/h. / At the poles: zero." (angka + satuan satu baris, 2 baris, tanpa kata yatim); "1,670" dan "zero" amber. timeline.json memakai U+00A0 |
| C4 loop | **LULUS** | frame 0 vs 2549: beda piksel >8 level turun dari 13,3 % ke 4,5 %, maks 42 → 17 level; judul identik. Kerumunan di frame 0 masih samar terlihat, tidak mengganggu |

Status akhir Fase 1: **semua item LULUS, tidak ada GAGAL tersisa.** Catatan C1, C2, C5 dari review pertama tetap berlaku (tidak memblokir).
Catatan baru (tidak memblokir): loudness kini -15,76 LUFS, dekat batas bawah -16. Kalau ada perubahan mix lagi, sound-designer perlu menjaga agar tidak turun di bawah -16.

## Fase 2 (review 2026-11-03 ±15:30)

Build yang dinilai: `public/timeline.json` (15:21) + `public/audio/mix.wav` (md5 `260c694d8daf092f7fce64676bf6415e`).
Stills (guides): `out/stills_p2/element-{0640,0690,0840,0960,1110,1230,2042,2100,2250,2282,2300}.png`. Tidak ada render/build ulang (mode hemat).
Keputusan user yang dipakai sebagai acuan: EAST konstan (-0,6,0,-0,8); front kejut dilihat dari profil, sedikit dari darat, **laut di latar**;
skala laut = trik kamera + kabut + bidang dasar laut; shore = peta diagram.

| Item | Hasil | Bukti | Saran → subagent |
|---|---|---|---|
| shockFronts (wall/record) | **GAGAL (sedang)** | 0640/0690/0840: cangkang putih ada di muka barat (sisi kamera) + streak + serpihan, profil gedung terbaca. Tapi **laut tidak terlihat**: 0 % piksel biru di area aman (latar = dasar laut slate + kabut; tepi air ±450-800 m, FOG avenida far 760 m). Streak hanya muncul di sisi/lee gedung (`ShockFronts` mulai di flank), tidak ada aliran yang datang dan membelok di muka angin, jadi "udara menabrak" lemah; separuh bawah gedung blow-out putih (additive + kabut) | scene-builder: FOG avenida far ≥1500-2000 atau arahkan kamera sampai tepi air masuk sepertiga atas; tambah streak yang datang dari barat dan melengkung di depan cangkang (stagnasi); kurangi opacity shell di bawah ±30 % tinggi gedung |
| seaWithdraws (sea/meters) | **GAGAL (sedang)** | 0960/1110: air hanya di baris y 169-397 = **tepat di belakang blok HUD** (0:03.000); pantai/calçadão hanya di y >1520 = **zona UI bawah**; ±1100 px tengah = dasar laut abu rata. Tepi air 32,0→37,0 hanya bergeser ±20 px (kamera ikut naik). Hubungan pantai↔air tidak terbaca di HP. Piringan matahari menabrak counter DRIFT EAST (0960 di atas card, 1110 di belakang angka) | scene-builder: turunkan pitch/ketinggian sehingga garis pantai lama di y ±1250-1450 dan tepi air di y ±550-750; jangan naikkan kamera searah tarikan air; pindahkan/sembunyikan matahari dari area card |
| map_top_down (shore) | **GAGAL** | 1230: label **"1,090 M EAST" vs counter "DRIFT EAST 1,188 M"** di frame yang sama (selisih 98 m). Sumber: peta = `driftAt×0,985` (ramp 4 dtk + WATER_K), counter = interpolasi 1106→1267 ber-ease. Label "1,090 M EAST" memotong garis putus-putus dan garis tepi air; "WATER'S" menimpa garis tepi; bingkai peta (top 575) tertimpa border bawah counter card (y 580-581). Catatan: baris kotak kota sejajar garis putus-putus terbaca seperti garis putus kedua | scene-builder: satu fungsi jarak untuk counter + label (counter dan 3D juga beda: 32,0 counter 867 vs driftAt 785); geser label ke tengah area arsir dengan latar gelap; peta top ≥600 |
| earthRespin (spin) | **LULUS + catatan** | 2042 (68,07): flash putih (`flashR` 0,65), grade normal (hijau/putih). 2100: dinding debu besar menutup kota. Catatan: dari kamera laut "ke barat" = menjauh, arah tidak terbaca; shake 0,5 m posisi dengan lookAt tetap ke kota 285 m → subjek hampir tidak bergoyang (belum bisa dicek tanpa render) | scene-builder: tambah shake rotasi (offset look) |
| seaReturns (return) | **GAGAL (ringan)** | 2250 (75,0): hanya pita laut tipis di horizon (hitungan: dinding 25 m di 750 m ≈ 40 px), terbaca laut tenang. Dinding baru terbaca ±75,7-76,2 (2282: y 665-1200), muka datar gradasi gelap tanpa buih/puncak, seperti tirai kabut | scene-builder: FOV lebih sempit / kamera lebih tinggi agar dinding terbaca sejak ±74; buih/semburan di puncak, warna muka lebih terang |
| Sinkron thuds 76,2 | **LULUS + catatan** | mix.wav <150 Hz: -33,1 → -23,8 dB di 76,23 dtk; dinding tiba (u=1) 76,20 → Δ ±25 ms (<1 frame). Tapi >150 Hz tidak naik (-23,1 → -22,8; 200 Hz-3 kHz -23,5 → -24,3 dB): tak terdengar di speaker HP | sound-designer: lapisan splash/crash mid-high di 76,2 |
| Caption/HUD/safe zone | **LULUS** | semua caption dan HUD di dalam zona aman dan terbaca; 0640 caption samar = fade-in (o 0,18), wajar |
| Gore | **LULUS** | tidak ada tubuh/darah di semua stills |
