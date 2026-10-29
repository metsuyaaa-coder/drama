/* Sauvegarde en ligne des profils DramaByM (Vercel, sans base de données).
   Les profils sont stockés CHIFFRÉS dans ton dépôt GitHub, sur une branche à part (« profiles », sans déploiement) : un fichier par profil.
   Le serveur ne voit jamais la phrase secrète ni les données en clair : tout est chiffré dans le navigateur.
   Variables d'environnement : GITHUB_TOKEN (obligatoire, droit « Contents : Read and write »), GITHUB_REPO (défaut metsuyaaa-coder/drama),
   PROFILES_BRANCH (défaut profiles), GITHUB_BRANCH (branche principale, défaut main).
   Reçoit : POST JSON { op: "ping" | "get" | "put" | "del", id, auth, blob, at } */
var crypto = require("crypto");

var hits = {};   /* limite par visiteur, en mémoire (indicatif) */
function limited(ip, op) {
  var now = Date.now(), win = 3600000, max = op === "get" ? 40 : 30, k = (op === "get" ? "g" : "w") + "|" + ip;
  if (Object.keys(hits).length > 3000) hits = {};
  var a = (hits[k] || []).filter(function (t) { return now - t < win; });
  if (a.length >= max) { hits[k] = a; return true; }
  a.push(now); hits[k] = a; return false;
}
function sha256(s) { return crypto.createHash("sha256").update(s).digest("hex"); }
function same(a, b) { try { return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b)); } catch (e) { return false; } }

function gh() {
  var token = process.env.GITHUB_TOKEN, repo = process.env.GITHUB_REPO || "metsuyaaa-coder/drama";
  var branch = process.env.PROFILES_BRANCH || "profiles", main = process.env.GITHUB_BRANCH || "main";
  var base = "https://api.github.com/repos/" + repo;
  var H = { Authorization: "Bearer " + token, Accept: "application/vnd.github+json", "User-Agent": "dramabym-profile", "Content-Type": "application/json" };
  function call(method, url, body) { return fetch(base + url, { method: method, headers: H, body: body ? JSON.stringify(body) : undefined }); }
  async function ensureBranch() {
    var r = await call("GET", "/git/ref/heads/" + branch);
    if (r.ok) return true;
    if (r.status !== 404) return false;
    var m = await call("GET", "/git/ref/heads/" + main);
    if (!m.ok) return false;
    var sha = (await m.json()).object.sha;
    var c = await call("POST", "/git/refs", { ref: "refs/heads/" + branch, sha: sha });
    return c.ok || c.status === 422;   /* 422 : créée entre-temps */
  }
  async function read(id) {
    var r = await call("GET", "/contents/p/" + id + ".json?ref=" + encodeURIComponent(branch));
    if (r.status === 404) return null;
    if (!r.ok) throw new Error("lecture " + r.status);
    var j = await r.json();
    return { sha: j.sha, data: JSON.parse(Buffer.from(j.content || "", "base64").toString("utf8")) };
  }
  async function write(id, obj, sha) {
    var body = { message: "profil", content: Buffer.from(JSON.stringify(obj), "utf8").toString("base64"), branch: branch };
    if (sha) body.sha = sha;
    return call("PUT", "/contents/p/" + id + ".json", body);
  }
  async function del(id, sha) { return call("DELETE", "/contents/p/" + id + ".json", { message: "profil supprimé", sha: sha, branch: branch }); }
  return { ensureBranch: ensureBranch, read: read, write: write, del: del };
}

module.exports = async function (req, res) {
  if (req.method !== "POST") { res.status(405).json({ error: "POST uniquement" }); return; }
  var host = String(req.headers.host || ""), origin = String(req.headers.origin || "");
  if (origin) { try { if (new URL(origin).host !== host) { res.status(403).json({ error: "origine refusée" }); return; } } catch (e) { res.status(403).json({ error: "origine refusée" }); return; } }
  var b = req.body;
  if (typeof b === "string") { try { b = JSON.parse(b); } catch (e) { b = null; } }
  if (!b || typeof b !== "object") { res.status(400).json({ error: "requête invalide" }); return; }

  var op = String(b.op || "");
  if (op === "ping") { res.status(200).json({ ok: true, cloud: !!process.env.GITHUB_TOKEN }); return; }
  if (!process.env.GITHUB_TOKEN) { res.status(501).json({ error: "sauvegarde en ligne non configurée" }); return; }
  if (op !== "get" && op !== "put" && op !== "del") { res.status(400).json({ error: "opération inconnue" }); return; }

  var id = String(b.id || ""), auth = String(b.auth || "");
  if (!/^[0-9a-f]{48}$/.test(id)) { res.status(400).json({ error: "identifiant invalide" }); return; }
  if (op !== "get" && !/^[0-9a-f]{64}$/.test(auth)) { res.status(400).json({ error: "authentification invalide" }); return; }
  var ip = String((req.headers["x-forwarded-for"] || "").split(",")[0] || req.socket && req.socket.remoteAddress || "?").trim();
  if (limited(ip, op)) { res.status(429).json({ error: "trop de requêtes, réessaie plus tard" }); return; }

  try {
    var g = gh(), cur;
    if (op === "get") {
      cur = await g.read(id);
      if (!cur || !cur.data || !cur.data.blob) { res.status(404).json({ ok: false, error: "introuvable" }); return; }
      res.status(200).json({ ok: true, blob: cur.data.blob, at: +cur.data.at || 0 });
      return;
    }
    if (op === "put") {
      var blob = String(b.blob || "");
      if (!blob || blob.length > 300000 || !/^[A-Za-z0-9+\/=]+$/.test(blob)) { res.status(400).json({ error: "données invalides" }); return; }
      if (!(await g.ensureBranch())) { res.status(502).json({ error: "branche impossible à créer" }); return; }
    }
    for (var n = 0; n < 3; n++) {
      cur = await g.read(id);
      if (cur && !same(sha256(auth), String(cur.data.authHash || ""))) { res.status(403).json({ error: "accès refusé" }); return; }
      if (op === "del") {
        if (!cur) { res.status(200).json({ ok: true }); return; }
        var d = await g.del(id, cur.sha);
        if (d.ok) { res.status(200).json({ ok: true }); return; }
      } else {
        var w = await g.write(id, { authHash: sha256(auth), blob: String(b.blob), at: Math.min(+b.at || Date.now(), Date.now() + 60000) }, cur && cur.sha);
        if (w.ok) { res.status(200).json({ ok: true }); return; }
        if (w.status !== 409 && w.status !== 422) { res.status(502).json({ error: "écriture GitHub refusée (HTTP " + w.status + ")" }); return; }
      }
      await new Promise(function (r) { setTimeout(r, 500 * (n + 1)); });
    }
    res.status(502).json({ error: "conflit, réessaie" });
  } catch (e) {
    res.status(502).json({ error: "GitHub injoignable" });
  }
};
