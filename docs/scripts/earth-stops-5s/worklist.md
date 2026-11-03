# Daftar kerja scene-builder: earth-stops-5s

Disusun oleh script-integrator dari script.json, brief.md, README.md dan kode saat ini
(src/World.tsx, src/scenes/Copacabana.tsx, src/sim.ts, src/Overlay.tsx, src/timeline.ts, pipeline/).
Waktu = detik absolut dari public/timeline.json (total 85,0 dtk). "§" = bagian di brief.md.

Bukti stills: out/stills/NN_beat_fFRAME_guides.png.

## 0. Masalah validasi yang harus beres sebelum render final

| # | Masalah | Beat / bukti | Penyebab di kode |
|---|---|---|---|
| V1 | Counter card menabrak jam HUD (angka counter tertimpa "0:0x.xxx") | speed (04_speed_f428), record (07_record_f833), sea (08_sea_f968), meters (09_meters_f1103), shore (10_shore_f1238) | Overlay.tsx:59 counter `top:210,left:64` vs HUD Overlay.tsx:157 `top:190, left/right:140` center |
| V2 | Teks end HUD "SPINNING AGAIN" pecah jadi 2 baris, sub "DAY LENGTH +5 S" kecil dan tenggelam di fasad putih | spin (16_spin_f2115), return (17_return_f2250), sunrise (18_sunrise_f2378) | Overlay.tsx:159 fontSize 104 + letterSpacing 14 untuk 14 karakter > lebar 800 px; HUD tanpa pelat latar |
| V3 | Label/sub HUD sulit dibaca di atas gedung putih | sea (08), meters (09), plane (14_plane_f1800) | sama, tanpa pelat latar (catatan: shot final beda, tapi risiko tetap) |
| V4 | Highlight (README: kata tebal = amber) tidak tampil di caption editorial | semua beat ber-caption, mis. 02_ground_f180 | EditorialCaption (Overlay.tsx:99-119) mengabaikan `highlight` |

Lolos: semua nama field dan tipe sfx dikenali; semua beat punya `duration`; total 85,0 dtk = README;
caption maks 12 kata (record, sea, air, plane, spin tepat 12); semua caption di dalam safe zone (tidak ada
yang melewati y=1520 atau x=940); setiap angka di caption punya baris di sources.md. Field
`shotBrief/eventBrief/grade/note` diabaikan pipeline sesuai rencana.

Catatan kecil (tidak memblokir): angka counter DRIFT EAST (785/946/1106/1267 m) dan HUD "DAY LENGTH +5 S"
tidak punya baris sendiri di sources.md (turunan dari 428,2 m/s x (t-8)/12 dan "matahari telat 5 dtk").

## 1. Shot (shotBrief) yang BELUM ada

Shot yang ada: copaShot (Copacabana.tsx:280-290) `bay_aerial, promenade_low, skyline_from_sea, sugarloaf,
avenue, crowd_sand` + fallback Kuta (World.tsx:32-48). Tidak ada satu pun nilai shotBrief di kode.

| Shot | Beat (waktu) | Yang diminta (§4) | Bisa pakai ulang |
|---|---|---|---|
| copa_establish | title 0,0-4,0 | ~15 m di atas laut, menghadap barat laut ke pantai, dolly maju sangat pelan; Pedra do Leme di kanan, Sugarloaf samar | `skyline_from_sea` (tapi tinggi 3,2 m), `bay_aerial` |
| copa_crowd_level | ground 4,0-8,0; stop 8,0-12,0; timer 62,5-68,0 | Setinggi mata di kerumunan, menghadap timur laut sepanjang pantai. stop: freeze sepersekian detik + shake 0,3 dtk. timer: kamera ikut melayang, kerumunan sudah jauh di atas air | `crowd_sand` (menghadap laut, bukan timur laut), `promenade_low` (menghadap sepanjang pantai) |
| tracking_east_with_crowd | speed 12,0-16,5 | Kamera ikut bergerak ke timur bersama kerumunan, pasir abu-abu meluncur di bawah | pola `kid_follow` (kamera mengikuti data sim) |
| tracking_east_close | calm 16,5-21,0 | Close-up satu orang melayang, rambut dan kain diam | `kid_follow`/`kid_side` (ikut KID_INDEX) |
| avenida_buildings_low | wall 21,0-25,5; record 25,5-30,0 (sedikit orbit) | Rendah di Avenida Atlântica, menghadap gedung dari sisi timur | `avenue` (sekarang menghadap pantai, membelakangi gedung: 06_wall_f698) |
| shoreline_high_angle | sea 30,0-34,5; meters 34,5-39,0 (pelan naik); return 73,0-77,0 (melihat ke tenggara) | ~80 m di atas garis air, menunduk 45 derajat | `bay_aerial` (45 m) |
| map_top_down | shore 39,0-43,5 | Top-down seperti peta, garis pantai asli putus-putus vs tepi air, label skala 1 km | tidak ada (lihat K6: skala dunia terlalu kecil) |
| pullback_to_globe | planet 43,5-48,5 | Tarik mundur cepat (~1,5 dtk) dari Rio ke bola Bumi, impact di 44,0 | tidak ada |
| globe_orbit | air 48,5-53,0 | Orbit pelan bola Bumi | tidak ada |
| globe_tilt_to_pole | poles 53,0-57,5 | Miring ke kutub utara | tidak ada |
| airliner_above_clouds | plane 57,5-62,5 | Samping pesawat jet di atas lapisan awan | `Clouds` (World.tsx:82) untuk awan |
| copa_wide_from_sea | spin 68,0-73,0 | Lebar dari laut | `skyline_from_sea`, `bay_aerial` |
| horizon_dawn | sunrise 77,0-81,5 | Horizon laut saat fajar, statis, matahari terbit pelan, tanpa orang | `Sky`, `Sea`, disk matahari Copacabana.tsx:301 (posisinya sudah di atas laut) |

SUDAH ada, tidak perlu dibangun: `endcard` (end 81,5-85,0) ditangani titleCard `endHold` (19_end_f2498).

Infrastruktur kamera yang dibutuhkan shot di atas (CameraRig, World.tsx:49-69):
- `Shot.fov` diabaikan, fov selalu 50 (baris 65). Perlu untuk map_top_down / globe / pullback.
- Tiap beat mulai ulang dari p0. Beat berurutan dengan shot "sama" (ground→stop, wall→record, sea→meters) akan lompat; brief minta kontinu.
- Shake hanya terikat ke T.fall / T.snap (Kuta). Perlu shake per event (earthStop 0,3 dtk, earthRespin).
- Kamera far 900 (Main.tsx) dan fog 110-560 (Copacabana.tsx:297) membatasi pullback/globe/map.

## 2. Event (eventBrief) yang BELUM ada

Event yang dikenal sim.ts (anchor(), baris 24-31): `gravityDrop, snap, massFall, kidJump, bigWave, drift, massJump`.

| Event | Beat (waktu) | Yang diminta | Bisa pakai ulang |
|---|---|---|---|
| earthStop | stop 8,0-12,0 (momen 8,0) | Grade ke split dalam 2 frame, semua orang mulai condong ke timur (§1, §3, §4) | `anchor()`, array `tilt/tiltDir` di Person (sim.ts:63-64) |
| freeDriftEast | speed 12,0-16,5; timer 62,5-68,0 (fisiknya berjalan 8,0-68,0) | Benda bebas terangkat sedikit, berputar pelan, melayang ke timur +jejak amber; 35,7 m/s di layar, total ~2,14 km (§3) | event `drift` (objPose sim.ts:133, SandBurst World.tsx:201) tapi arahnya +x dan lambat (0,9 m/s); ExtraCrowd 520 orang + 150 payung statis (Copacabana.tsx:234) |
| visibleAirCoMoving | calm 16,5-21,0 | Partikel debu/garis amber transparan mengalir ke timur sejajar orang (§1, §3) | pola SandBurst; InstancedMesh seperti ExtraCrowd |
| shockFronts | wall 21,0-25,5; record 25,5-30,0 | Front kejut putih tajam/distorsi di sisi barat gedung, kaca beterbangan abstrak (§3) | daftar posisi `Buildings` (Copacabana.tsx:127) |
| seaWithdraws | sea 30,0-34,5; meters 34,5-39,0; shore 39,0-43,5 | Air bergeser ke timur, dasar laut terbuka (pasir basah, batu, ikan kecil) (§3) | `Sea` (World.tsx:93, displacement per frame), `wave()`; laut statis Copacabana.tsx:303 harus ikut |
| globeWindBands | planet 43,5-48,5; air 48,5-53,0 | Bumi low-poly, pita aliran udara amber ke timur, tebal di tropis menipis ke kutub (§4, §5.6) | tidak ada |
| globeSpeedGradient | poles 53,0-57,5 | Gradien kecepatan, label 1,670 km/h di khatulistiwa, 0 di kutub | tidak ada (label bisa overlay 2D) |
| airlinerCruising | plane 57,5-62,5 | Pesawat jet tenang, warna normal (§3, §5.7) | `Clouds` |
| earthRespin | spin 68,0-73,0 | Tanah bergerak lagi, grade normal dengan flash, benda yang sudah berhenti terlempar ke barat, debu besar (§3) | SandBurst; flash Overlay.tsx:212 terikat T.snap (Kuta) |
| seaReturns | return 73,0-77,0 | Dinding air besar kembali ke pantai (§3) | `bigWave` (sekarang dipakai rough cut; amp 4 m, z -16→1) |

`none` (sunrise) bukan event.

## 3. Grade yang BELUM ada

Tidak ada sistem grade sama sekali di kode, juga tidak ada objek `palette` (anchoredGrade/freeGlow).

| Grade | Beat (waktu) | Yang diminta | Catatan |
|---|---|---|---|
| split | stop 8,0 s/d poles 57,5 (stop, speed, calm, wall, record, sea, meters, shore, planet, air, poles) dan timer 62,5-68,0 | Tertanam = slate #5B6672, saturasi ~0, sedikit gelap; bebas = warna asli + jejak amber #F2A33A ke timur (§1) | Cache material `M()` (World.tsx:26-27) dipakai bersama benda tertanam dan bebas (mis. #ffffff untuk awan, pos penjaga, tiang): perlu dipisah per kelas |
| normal | plane 57,5-62,5; spin 68,0-73,0; return 73,0-77,0; sunrise 77,0-81,5 (dan title/ground tanpa field) | Copacabana sore golden hour, hangat (§1) | Look sekarang = siang, langit biru, matahari di atas laut. Golden hour belum ada (lihat K3). sunrise butuh look fajar sendiri |

## 4. Fitur non-3D (pipeline/Overlay) yang belum ada

1. Highlight amber di caption editorial (README "Kata bercetak tebal = highlight"). Belum ada (V4).
2. Readout HUD kedua DRIFT EAST dihitung dari timer (§5.9, README baris 8-10). Tipe `Hud` cuma `label/from/to/rate/sub/end/decimals`. Sementara diganti counter card.
3. Counter dengan unit sekunder (958 MPH). Tipe `Counter` cuma `{label, from, to, unit, dec}`.
4. Warna aksen bisa diatur: label counter dan highlight karaoke hard-coded hijau `#7CFFB2` (Overlay.tsx:12), bukan amber palet.
5. Tata letak counter vs HUD (V1) dan teks end HUD panjang + pelat latar HUD (V2, V3).
6. Flash putih generik saat earthRespin: `snapFlash` cuma ikut T.snap.
7. Tick tunggal per detik: sfx legacy `tick` = 5 tick berjarak 0,2 dtk (build_audio.py, `sfx("tick")`), jadi "tick tiap detik" di ground (4,0-8,0) berbunyi ~20 tick, juga di record dan timer.
8. Label overlay untuk peta/globe (skala 1 km, 1,670 km/h, 0) kalau tidak dibuat di 3D.

SUDAH didukung, tidak perlu dibangun: low-pass noise_wall (pakai `hi`, bandpass `lo..hi`; beat plane sudah `hi:300, color:brown`); pulsa detik nyata (impact small di 20/32/56 + huge di 44); silence_cut `hold:"end"`; titleCard + loop end card; HUD "continue" dan teks `end`.

## 5. Selisih brief.md vs geometri Copacabana.tsx

K1. Sistem koordinat. Scene: pantai sejajar sumbu X, laut di -z, darat di +z (sama dengan Kuta supaya sim.ts dipakai bersama, Copacabana.tsx:2-4). Dari letak Leme/Sugarloaf (-x) dan laut (-z), arah kompas yang tersirat: -x = timur laut (37 derajat), -z = tenggara, +x = barat daya (Forte), +z = barat laut. Timur sungguhan = vektor (-0,60, 0, -0,80): menjauhi pantai ke laut, sedikit ke arah Leme (cocok dengan teks §2). Brief meminta +X = timur: itu berarti memutar dunia ~-127 derajat di sumbu Y, yang menyentuh sim.ts (spawn kerumunan, wave() di sumbu z), Sea, semua shot kamera. Alternatif: koordinat tetap, pakai konstanta EAST. Perlu keputusan. Event `drift` yang ada mendorong ke +x = barat daya sepanjang pantai (salah arah ~127 derajat).

K2. Posisi laut. Laut di sisi tenggara: cocok. Tapi `Sea` cuma 260 x 120 m (z 0 sampai -120) dan laut statis 1400 x 700 di y -0,35 tidak bergerak; tidak ada dasar laut. Laut menjauh 2 km tidak bisa dengan geometri ini.

K3. Waktu/matahari. directionalLight [-14, 34, -26] dan disk matahari [-90, 85, -320] ada di atas laut (timur/tenggara), elevasi ~50 derajat, langit biru siang. Brief: sore golden hour, matahari di barat di belakang gedung (arah +z/+x di scene), bayangan gedung panjang ke pasir. Dampak: shot yang menghadap gedung dari laut (copa_establish, copa_wide_from_sea) jadi melawan cahaya, fasad depan gelap; shadow camera ±40 m tidak menjangkau gedung di z 56+ sampai pasir. Arah matahari sekarang malah cocok untuk horizon_dawn.

K4. Landmark. Pedra do Leme: hanya icosahedron hijau generik di (-180, 8, -20) (baris 182), posisi benar, belum berbatu. Forte de Copacabana: tidak ada (di +180 cuma bukit hijau, baris 183). Sugarloaf: dua Dome di x -250/-212, z -70/-58 (baris 184-185), arah timur laut di balik Leme sudah benar, tapi tinggi 118 m dalam jarak ~250 m membuatnya sangat besar (10_shore_f1238 sampai 13_poles_f1658, masuk zona kanan). Brief: siluet samar di kejauhan.

K5. Tinggi gedung. Kode: 9 sampai 14 lantai x 3,1 m = 28 sampai 43 m (baris 134). Brief: 12 sampai 20 lantai. Mengubah jumlah lantai mengubah urutan mulberry32(53), jadi deret gedung bergeser.

K6. Skala. Pantai yang dimodelkan ~380 m (strip -190..190, gedung -160..160), pantai asli 4 km. Drift 2,14 km, "two kilometres out" dan label skala 1 km di map_top_down semua keluar dari dunia yang ada (fog sampai 560, kamera far 900). Perlu layer peta skala besar atau trik skala.

K7. Kerumunan latar (520 orang + 150 payung, ExtraCrowd) statis dan tidak bereaksi ke event; brief minta semua yang bebas melayang. Terlihat di shot lebar.

K8. Kontradiksi di dalam brief: front kejut ada di sisi barat gedung (sisi yang diterpa udara), tapi kamera avenida_buildings_low "menghadap gedung dari sisi timur" (sisi pantai), sehingga front kejut ada di balik gedung. Perlu klarifikasi penulis brief.

K9. Kecil: kursi pantai belum ada (pos penjaga, kios, net voli sudah ada).
