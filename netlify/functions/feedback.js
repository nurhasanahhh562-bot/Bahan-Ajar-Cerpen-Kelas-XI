// netlify/functions/feedback.js
//
// Ini adalah "Netlify Function" — kode ini berjalan di server Netlify,
// bukan di browser pengunjung. API key Anda disimpan sebagai Environment
// Variable di dashboard Netlify, sehingga tidak pernah terlihat oleh siapa
// pun yang membuka website Anda.
//
// Setelah dideploy, function ini otomatis bisa diakses di:
//   https://NAMA-SITUS-ANDA.netlify.app/.netlify/functions/feedback

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

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

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  if (!ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY belum diatur di Netlify Environment Variables.");
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

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1500,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Anthropic API error:", response.status, errText);
      return { statusCode: 502, body: JSON.stringify({ error: "Gagal menghubungi layanan AI." }) };
    }

    const data = await response.json();
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    };
  } catch (err) {
    console.error("Function error:", err);
    return { statusCode: 500, body: JSON.stringify({ error: "Terjadi kesalahan pada server." }) };
  }
};
