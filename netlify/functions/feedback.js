// netlify/functions/feedback.js
//
// VERSI GEMINI (Google AI) â€” dipakai sementara karena Gemini punya
// tier gratis (tanpa kartu kredit) untuk model seperti gemini-2.5-flash.
// Cara dapat API key gratis: buka https://aistudio.google.com/apikey
// (login dengan akun Google, klik "Create API key" â€” tidak perlu isi
// data kartu untuk tier gratis ini).
//
// Simpan key itu di Netlify sebagai environment variable bernama
// GEMINI_API_KEY (Site configuration -> Environment variables).
//
// Catatan: tier gratis Gemini punya batas jumlah permintaan per menit/hari.
// Untuk latihan menulis kelas skala kecil biasanya lebih dari cukup.

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = "gemini-2.5-flash";

// Rate limit sangat sederhana per cold-start (bukan pengganti proteksi
// serius, tapi cukup untuk mencegah pemakaian berlebihan yang tidak sengaja).
const hits = new Map();
const WINDOW_MS = 60 * 1000;
const MAX_PER_WINDOW = 10;

function isRateLimited(ip) {
  const now = Date.now();
  const entry = hits.get(ip) || { count: 0, start: now };
  if (now - entry.start > WINDOW_MS) {
    entry.count = 0;
    entry.start = now;
  }
  entry.count += 1;
  hits.set(ip, entry);
  return entry.count > MAX_PER_WINDOW;
}

// ---------------- Fallback umpan balik statis ----------------
// Dipakai kalau panggilan ke Gemini gagal (mis. limit gratis tercapai),
// supaya siswa tetap dapat semacam catatan untuk lanjut berlatih.
// Ini BUKAN analisis AI sungguhan atas draf mereka.
const FALLBACK_TEMPLATES = [
  "Draf kamu sudah punya alur yang bisa diikuti. Coba periksa lagi: apakah setiap tokoh punya alasan yang jelas untuk bertindak seperti itu? Perkuat juga deskripsi latar (waktu & tempat) di bagian awal supaya pembaca lebih cepat masuk ke suasana cerita.",
  "Konfliknya sudah mulai terasa. Coba tambahkan lebih banyak dialog atau reaksi batin tokoh utama saat menghadapi masalah, supaya pembaca ikut merasakan tekanan yang dia alami. Perhatikan juga transisi antar paragraf agar tidak terasa loncat.",
  "Bagian pembuka cukup menarik perhatian. Untuk revisi berikutnya, coba perkuat bagian klimaks: perlambat momen paling tegang dengan detail sensorik (apa yang dilihat, didengar, dirasakan tokoh) supaya lebih terasa dramatis.",
  "Struktur cerita (awal-tengah-akhir) sudah kelihatan. Sekarang coba baca ulang dan tandai kalimat yang masih 'menjelaskan' perasaan tokoh secara langsung (misalnya 'dia sedih') lalu ganti dengan menunjukkan lewat tindakan atau ekspresi.",
  "Ceritamu sudah punya penutup. Coba cek lagi apakah penutup itu menjawab konflik yang dibangun di awal, atau malah terasa terlalu terburu-buru. Menambah satu-dua kalimat refleksi tokoh di akhir bisa membuat pesan cerita terasa lebih kuat.",
];

function pickFallback(prompt) {
  const idx = prompt.length % FALLBACK_TEMPLATES.length;
  return (
    "[Catatan: layanan AI sedang tidak tersedia sementara, jadi ini adalah " +
    "catatan umum, bukan analisis khusus atas draf kamu.]\n\n" +
    FALLBACK_TEMPLATES[idx]
  );
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  if (!GEMINI_API_KEY) {
    console.error("GEMINI_API_KEY belum diatur di Netlify Environment Variables.");
    return { statusCode: 500, body: JSON.stringify({ error: "Server belum dikonfigurasi." }) };
  }

  const ip = event.headers["x-nf-client-connection-ip"] || event.headers["client-ip"] || "unknown";
  if (isRateLimited(ip)) {
    return { statusCode: 429, body: JSON.stringify({ error: "Terlalu banyak permintaan, coba lagi sebentar." }) };
  }

  let prompt;
  try {
    const parsed = JSON.parse(event.body || "{}");
    prompt = parsed.prompt;
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "Body harus JSON valid." }) };
  }

  if (!prompt || typeof prompt !== "string") {
    return { statusCode: 400, body: JSON.stringify({ error: "Field 'prompt' wajib diisi (string)." }) };
  }
  if (prompt.length > 20000) {
    return { statusCode: 400, body: JSON.stringify({ error: "Prompt terlalu panjang." }) };
  }

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Gemini API error (memakai fallback statis):", response.status, errText);
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: [{ type: "text", text: pickFallback(prompt) }] }),
      };
    }

    const data = await response.json();
    const text =
      data?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";

    if (!text) {
      console.error("Gemini merespons tanpa teks (memakai fallback statis):", JSON.stringify(data));
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: [{ type: "text", text: pickFallback(prompt) }] }),
      };
    }

    // Disamakan dengan format yang diharapkan frontend (gaya Anthropic),
    // supaya index.html tidak perlu diubah sama sekali.
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: [{ type: "text", text }] }),
    };
  } catch (err) {
    console.error("Function error (memakai fallback statis):", err);
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: [{ type: "text", text: pickFallback(prompt) }] }),
    };
  }
};
