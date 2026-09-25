# Deploy Bengkel Cerpen ke Netlify

Struktur folder ini sudah siap deploy langsung ke Netlify:

```
netlify-site/
├── index.html                     ← halaman Bengkel Cerpen
├── netlify.toml                   ← konfigurasi Netlify
└── netlify/
    └── functions/
        └── feedback.js            ← "backend" Anda (Netlify Function)
```

Netlify Function menggantikan server Express — jalan otomatis tanpa Anda
perlu mengurus hosting server sendiri. API key disimpan di Netlify sebagai
Environment Variable, tidak pernah terlihat di kode frontend.

## Cara deploy

### Opsi A — Drag & drop (paling cepat, tanpa Git)

1. Buka https://app.netlify.com → **Add new site** → **Deploy manually**.
2. Seret (drag & drop) seluruh folder `netlify-site` ke area upload.
   *(Catatan: cara drag & drop kadang tidak menyertakan folder functions
   dengan baik. Jika fitur AI tidak jalan setelah cara ini, pakai Opsi B.)*

### Opsi B — Lewat GitHub (disarankan, lebih stabil untuk Functions)

1. Buat repository baru di GitHub, upload isi folder `netlify-site`
   (termasuk `netlify.toml` dan folder `netlify/functions/`).
2. Di Netlify: **Add new site** → **Import an existing project** →
   hubungkan ke repo GitHub tersebut.
3. Build settings biasanya terbaca otomatis dari `netlify.toml`. Klik **Deploy**.

### Opsi C — Netlify CLI

```bash
npm install -g netlify-cli
cd netlify-site
netlify deploy --prod
```

## Setel API Key di Netlify

1. Di dashboard situs Anda: **Site configuration** → **Environment variables**.
2. Klik **Add a variable**:
   - Key: `ANTHROPIC_API_KEY`
   - Value: (API key Anda dari https://console.anthropic.com/settings/keys)
3. Simpan, lalu **trigger deploy ulang** (Deploys → Trigger deploy →
   Deploy site) supaya function membaca environment variable yang baru.

## Uji coba

Setelah deploy selesai, buka situs Anda dan coba fitur "Umpan Balik AI".
Anda juga bisa mengecek langsung apakah function-nya hidup:

```bash
curl -X POST https://situs-anda.netlify.app/.netlify/functions/feedback \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Balas dengan kata: halo"}'
```

Kalau muncul error `"Server belum dikonfigurasi"`, berarti environment
variable `ANTHROPIC_API_KEY` belum ter-set atau situs belum di-deploy ulang
setelah menambahkannya.

## Catatan biaya & batas pemakaian

- Paket gratis Netlify mencakup kuota Function invocations bulanan yang
  cukup besar untuk penggunaan kelas/sekolah biasa — cek dashboard Netlify
  untuk angka pastinya jika situs mulai ramai.
- Rate limit sederhana (10 permintaan/menit per IP) sudah ada di dalam
  `feedback.js` untuk mencegah pemakaian API key yang membengkak tak
  terduga. Sesuaikan `MAX_PER_WINDOW` sesuai kebutuhan.
