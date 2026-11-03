# Brief Scene 3D: earth-stops-5s

Untuk: scene-builder. Pasangan file: script.json, sources.md.

## 1. Konsep visual (identitas kita, bukan tiruan referensi)

Referensi memakai wireframe biru-putih. Kita memakai konsep **"yang berhenti vs yang masih bergerak"**, dan konsep ini sekaligus menjelaskan fisikanya:

- **Grade "normal"**: Copacabana sore hari (golden hour), warna hangat dan natural.
- **Grade "split"** (mulai beat `stop` sampai beat `timer`):
  - Semua yang **tertanam di Bumi** (tanah, pasir permukaan, gedung, jalan, bukit, dasar laut, tiang, pohon) berubah jadi **abu-abu slate dingin** (`palette.anchoredGrade` #5B6672), saturasi hampir nol, sedikit lebih gelap.
  - Semua yang **bebas bergerak** (orang, payung, bola, handuk, air laut, butiran pasir lepas, burung, partikel udara) tetap berwarna dan diberi **jejak gerak amber** (`palette.freeGlow` #F2A33A) mengarah ke timur.
  - **Udara dibuat terlihat**: partikel debu/garis tipis amber transparan yang mengalir ke timur. Ini signature visual seri kita.
- Grade kembali **normal** di beat `spin` (Bumi berputar lagi).

## 2. Geografi Copacabana (wajib akurat)

- Pantai sekitar 4 km, membentang dari **Forte de Copacabana (ujung barat daya)** ke **Leme (ujung timur laut)**. Arah garis pantai kira-kira **37 derajat dari utara** (timur laut).
- **Laut ada di sisi tenggara** pantai. **Avenida Atlântica** + deretan gedung tinggi (12 sampai 20 lantai, fasad apartemen 1950 sampai 1970an) di sisi barat laut.
- Trotoar (calçadão) bermotif **gelombang hitam-putih** sepanjang pantai.
- Ujung timur laut: **Pedra do Leme**, bukit batu hijau. Di kejauhan utara: puncak **Sugarloaf** (Pão de Açúcar) sebagai siluet.
- Ujung barat daya: benteng rendah Forte de Copacabana.
- Sore hari: matahari turun di **barat**, di belakang gedung. Bayangan gedung jatuh panjang ke pasir.
- Isi pantai: sekitar 200 orang (pakai karakter low-poly yang ada), payung warna-warni, kursi, net voli pantai, kios kelapa, pos penjaga pantai (posto).

**Sistem koordinat**: tetapkan +X = timur sungguhan. Garis pantai diputar 37 derajat dari utara. Semua gerakan "drift" mengarah tepat ke +X (timur), **bukan** sejajar pantai. Artinya: orang dan air bergeser **menjauhi pantai ke arah laut** sambil sedikit menyamping ke arah Leme.

## 3. Aturan fisika (tergayakan, tapi jangan salah arah)

- Kecepatan relatif benda bebas terhadap tanah: 428 m/s ke timur. Dengan slow-motion 12x, di layar sekitar 35,7 m/s. Dalam 60 detik layar, benda bebas berpindah sekitar 2,14 km.
- Orang: kaki tertahan gesekan, tubuh terdorong ke timur. Tampilkan **terangkat sedikit, berputar pelan, melayang ke timur dengan jejak amber**. Gaya kalem dan hampir indah, bukan brutal.
- **Tidak ada gore, darah, atau tabrakan tubuh close-up.** Potong kamera sebelum tabrakan. (Aman untuk kebijakan platform.)
- Air laut: seluruh massa air bergeser ke timur. Di pantai, air **menjauh** dan dasar laut terbuka (pasir basah, batu, ikan menggelepar kecil boleh).
- Udara: di beat `calm` partikel udara bergerak **sejajar** dengan orang (tidak ada angin relatif). Mulai beat `wall`, udara dekat permukaan menabrak gedung dan membentuk **front kejut** (garis putih tajam/distorsi di sisi barat gedung).
- Pesawat di beat `plane`: bergerak normal, tenang, di atas awan. Tidak terpengaruh.
- Beat `spin`: tanah tiba-tiba bergerak lagi ke timur. Benda yang **sudah berhenti** (menabrak sesuatu) kini terlempar **ke barat** relatif terhadap tanah. Benda yang masih melayang kembali "cocok" dengan tanah.
- Beat `return`: air yang tadi terdorong ke timur kembali sebagai **gelombang besar menuju pantai** (gravitasi mengembalikan air).

## 4. Shot per beat

| Beat | Shot | Kamera | Isi visual | Event |
|---|---|---|---|---|
| title | copa_establish | Rendah di atas laut (sekitar 15 m), menghadap barat laut ke pantai, sangat pelan dolly maju | Pantai ramai, gedung, Pedra do Leme di kanan, Sugarloaf samar. Judul di atas | none |
| ground | copa_crowd_level | Setinggi mata di tengah kerumunan, menghadap timur laut sepanjang pantai | Orang main voli, jual kelapa, anak lari. Damai | none |
| stop | copa_crowd_level | Sama, freeze kamera sepersekian detik lalu hentakan kecil (shake 0,3 dtk) | Grade berubah ke split dalam 2 frame. Semua orang mulai condong ke timur | earthStop |
| speed | tracking_east_with_crowd | Kamera ikut bergerak ke timur bersama kerumunan (seakan kamera juga "bebas") | Pasir abu-abu meluncur cepat di bawah, orang berwarna melayang. Counter kecepatan | freeDriftEast |
| calm | tracking_east_close | Close-up satu orang melayang, rambut dan kain diam (tidak berkibar) | Partikel udara amber sejajar dengan orang. Hening | visibleAirCoMoving |
| wall | avenida_buildings_low | Rendah di Avenida Atlântica, menghadap gedung dari sisi timur | Udara menabrak sisi barat gedung, front kejut putih, kaca beterbangan (abstrak) | shockFronts |
| record | avenida_buildings_low | Sama, sedikit orbit | Counter 408 ke 1,541 | shockFronts |
| sea | shoreline_high_angle | Tinggi (sekitar 80 m) di atas garis air, menunduk 45 derajat | Air menjauh dari pantai ke timur, dasar laut terbuka | seaWithdraws |
| meters | shoreline_high_angle | Sama, pelan naik | Readout DRIFT EAST di HUD bertambah | seaWithdraws |
| shore | map_top_down | Top-down tinggi seperti peta | Garis pantai asli (garis putih putus-putus) vs tepi air yang makin jauh. Label skala 1 km | seaWithdraws |
| planet | pullback_to_globe | Tarik mundur cepat dari Rio ke bola Bumi (sekitar 1,5 dtk), impact di detik 44,0 absolut | Bumi low-poly, pita-pita aliran udara amber ke timur | globeWindBands |
| air | globe_orbit | Orbit pelan bola Bumi | Pita angin tebal di daerah tropis, menipis ke kutub | globeWindBands |
| poles | globe_tilt_to_pole | Miring ke arah kutub utara | Gradien kecepatan: label 1,670 km/h di khatulistiwa, 0 di kutub | globeSpeedGradient |
| plane | airliner_above_clouds | Samping pesawat jet di atas lapisan awan | Pesawat tenang, normal (tidak di-grade split, karena memang tidak terpengaruh) | airlinerCruising |
| timer | copa_crowd_level | Kembali ke pantai, kamera ikut melayang | Kerumunan sudah jauh di atas air. Tension | freeDriftEast |
| spin | copa_wide_from_sea | Lebar dari laut | Tanah bergerak lagi, grade kembali normal dengan flash, benda yang berhenti terlempar ke barat, debu besar | earthRespin |
| return | shoreline_high_angle | Tinggi, melihat ke tenggara | Dinding air besar kembali menuju pantai | seaReturns |
| sunrise | horizon_dawn | Horizon laut saat fajar, statis | Matahari terbit pelan. Tenang, sepi. Tidak ada orang | none |
| end | endcard_black | Statis | End card, loop ke judul | none |

## 5. Komponen baru yang dibutuhkan (daftar kerja)

1. Lingkungan Copacabana (pantai, laut, gedung Avenida Atlântica, calçadão bermotif gelombang, Pedra do Leme, siluet Sugarloaf, benteng). Pakai ulang laut, orang, payung, bola, handuk, kelapa dari scene Kuta.
2. Sistem grade split (anchored vs free) + jejak gerak amber.
3. Partikel udara terlihat.
4. Front kejut di gedung.
5. Air laut menarik diri + dasar laut terbuka + gelombang kembali.
6. Bola Bumi low-poly dengan pita angin dan gradien kecepatan.
7. Pesawat jet di atas awan.
8. Horizon fajar.
9. Readout HUD kedua (DRIFT EAST) yang dihitung dari timer.

Semua komponen dibuat reusable (lingkungan, grade, globe, pesawat) untuk video berikutnya.
