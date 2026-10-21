// Vercel Function : URL embed Bunny Stream -> URL HLS signée et temporaire (aucun stockage).
// Variables d'environnement Vercel à définir :
//   BUNNY_LIBRARY_ID       ex. 123456              (ID de ta bibliothèque Bunny Stream)
//   BUNNY_PULL_ZONE_HOST   ex. vz-abc123-456.b-cdn.net
//   BUNNY_TOKEN_KEY        "Token Authentication Key" de la Pull Zone (secret, jamais côté navigateur)
const crypto = require("crypto");

const EMBED_PATH = /^\/embed\/(\d{1,10})\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/?$/i;
const HOST_OK = /^(?:[a-z0-9-]+\.)+[a-z]{2,}$/i;
const TTL_SECONDS = 900; // lien valable 15 min, le lecteur le renouvelle 60 s avant

const b64url = (buf) => buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fail = (res, status, code, message) => res.status(status).json({ error: { code, message } });

module.exports = (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return fail(res, 405, "METHOD", "POST uniquement.");

  // Mode test : flux HLS public de démonstration (Mux), actif seulement si HLS_DEMO=1. Lien « expirant » en 2 min pour tester le renouvellement.
  const DEMO = "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8";
  if (process.env.HLS_DEMO === "1" && (req.body || {}).embedUrl === DEMO)
    return res.status(200).json({ provider: "demo", manifestUrl: DEMO, expiresAt: Date.now() + 120000 });

  const lib = process.env.BUNNY_LIBRARY_ID, zone = process.env.BUNNY_PULL_ZONE_HOST, key = process.env.BUNNY_TOKEN_KEY;
  if (!lib || !zone || !key || !HOST_OK.test(zone)) return fail(res, 501, "NEEDS_CONFIGURATION", "Bunny n'est pas configuré sur le serveur.");

  // Validation de l'URL embed : hôte exact, https, pas d'identifiants/port, bibliothèque autorisée.
  let u;
  try { u = new URL(String((req.body || {}).embedUrl || "")); } catch (e) { return fail(res, 400, "INVALID_URL", "URL invalide."); }
  if (u.protocol !== "https:" || u.hostname !== "iframe.mediadelivery.net" || u.username || u.password || u.port)
    return fail(res, 400, "HOST_NOT_ALLOWED", "Hôte embed non autorisé.");
  const m = u.pathname.match(EMBED_PATH);
  if (!m) return fail(res, 422, "UNSUPPORTED_EMBED", "Format d'URL embed non reconnu.");
  if (m[1] !== String(lib)) return fail(res, 403, "LIBRARY_NOT_ALLOWED", "Bibliothèque non autorisée.");

  // Signature Token Authentication V2, directory token (voir docs Bunny « Advanced Token Authentication »)
  const videoId = m[2].toLowerCase();
  const tokenPath = "/" + videoId + "/";
  const expires = Math.floor(Date.now() / 1000) + TTL_SECONDS;
  const signingData = "token_path=" + tokenPath;
  const token = "HS256-" + b64url(crypto.createHmac("sha256", key).update(tokenPath + expires + signingData).digest());
  const manifestUrl = "https://" + zone + "/bcdn_token=" + token + "&expires=" + expires +
    "&token_path=" + encodeURIComponent(tokenPath) + tokenPath + "playlist.m3u8";

  res.status(200).json({ provider: "bunny", manifestUrl, expiresAt: expires * 1000 });
};
