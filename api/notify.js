/* Notifications Discord pour DramaByM (Vercel, sans base de données).
   Variables d'environnement :
     DISCORD_WEBHOOK_URL         (obligatoire) adresse du webhook Discord, ex. https://discord.com/api/webhooks/...
     DISCORD_WEBHOOK_DEADLINKS   (facultatif)  autre webhook pour les liens morts. Sinon ils vont sur DISCORD_WEBHOOK_URL.
   Reçoit : POST JSON { kind: "request" | "deadlink" | "issue", ... }
   "issue" = signalement général depuis la page Statut des serveurs (serveur + raison).
   Liste des demandes automatique (facultatif) : ajoute GITHUB_TOKEN (jeton GitHub avec le droit « Contents : Read and write » sur le dépôt du site).
     Chaque demande reçue est alors aussi ajoutée à la page « Demandes » (ou +1 vote si le titre y est déjà).
     GITHUB_REPO (défaut metsuyaaa-coder/drama), GITHUB_BRANCH (défaut main), GITHUB_PATH (défaut catalog.json) : à changer seulement si besoin. */

var hits = {}; /* limite par visiteur, en mémoire (indicatif : elle repart de zéro quand Vercel redémarre la fonction) */
function limited(ip, kind) {
  var now = Date.now(), win = kind === "request" ? 86400000 : 3600000, max = kind === "request" ? 3 : kind === "issue" ? 5 : 10, k = kind + "|" + ip;   /* demandes : 3 par jour et par réseau (anti-spam), la vraie limite est 1 par personne et par jour (plus bas) */
  if (Object.keys(hits).length > 3000) hits = {};
  var a = (hits[k] || []).filter(function (t) { return now - t < win; });
  if (a.length >= max) { hits[k] = a; return true; }
  a.push(now); hits[k] = a; return false;
}
var vidHits = {};   /* 1 demande par jour et par identifiant d'appareil (en mémoire ; la liste GitHub garde aussi un journal) */
function clean(v, n) { return String(v == null ? "" : v).replace(/[\u0000-\u001f\u007f`]/g, " ").replace(/\s+/g, " ").trim().slice(0, n); }
function httpUrl(v) { v = clean(v, 500).replace(/\s/g, ""); return /^https?:\/\/[^\s<>]+$/i.test(v) ? v : ""; }
function hookOk(u) { return /^https:\/\/(discord|discordapp)\.com\/api\/webhooks\/\d+\/[\w-]+$/.test(u || ""); }

/* Ajoute la demande à la liste « Demandes » de catalog.json (GitHub), sans base de données. Ne bloque jamais l'envoi si ça échoue. */
async function listAdd(b, vid) {
  var token = process.env.GITHUB_TOKEN;
  if (!token) return false;
  var repo = process.env.GITHUB_REPO || "metsuyaaa-coder/drama", branch = process.env.GITHUB_BRANCH || "main", path = process.env.GITHUB_PATH || "catalog.json";
  var url = "https://api.github.com/repos/" + repo + "/contents/" + path;
  var H = function (accept) { return { Authorization: "Bearer " + token, Accept: accept || "application/vnd.github+json", "User-Agent": "dramabym-notify" }; };
  var title = clean(b.titre, 200), media = b.media === "movie" ? "movie" : "tv";
  var tmdb = String(b.tmdbId || "").replace(/\D/g, "").slice(0, 10), bl = !!b.bl;
  var kind = ({ stream: 1, dl: 1, both: 1 })[String(b.demande)] ? String(b.demande) : "stream";
  var poster = /^\/[\w-]+\.(jpg|png)$/i.test(String(b.poster || "")) ? String(b.poster) : "";
  for (var n = 0; n < 4; n++) {
    var raw = await fetch(url + "?ref=" + encodeURIComponent(branch), { headers: H("application/vnd.github.raw+json") });
    if (!raw.ok) return false;
    var meta = await fetch(url + "?ref=" + encodeURIComponent(branch), { headers: H() });
    if (!meta.ok) return false;
    var obj = await raw.json(), sha = (await meta.json()).sha;
    if (!obj || Array.isArray(obj) || typeof obj !== "object") return false;
    var rq = obj.requests && Array.isArray(obj.requests.items) ? obj.requests : { items: [], at: 0 };
    var nowT = Date.now(), log = (Array.isArray(rq.log) ? rq.log : []).filter(function (e) { return e && nowT - (+e.t || 0) < 86400000; });
    if (vid && log.some(function (e) { return e.v === vid; })) return "limit";   /* déjà une demande dans les 24 h */
    var same = rq.items.filter(function (r) {
      return !!r.bl === bl && (tmdb && r.tmdb ? String(r.tmdb) === tmdb && r.media === media : String(r.title || "").toLowerCase() === title.toLowerCase());
    })[0];
    if (same) {
      if (same.status === "done") return true;
      same.votes = (+same.votes || 0) + 1;
      same.kind = same.kind && same.kind !== kind ? "both" : kind;
    } else {
      if (rq.items.length >= 400) return false;
      rq.items.push({ id: "r" + Date.now().toString(36), title: title, status: "wait", bl: bl, kind: kind, votes: 1, tmdb: tmdb, media: tmdb ? media : "", year: clean(b.date, 20).slice(0, 4), poster: poster, origin: clean(b.origin, 40), en: clean(b.en, 150), auto: true, at: Date.now() });
    }
    if (vid) log.push({ v: vid, t: nowT });
    obj.requests = { items: rq.items, at: nowT, log: log.slice(-300) };
    var put = await fetch(url, { method: "PUT", headers: H(), body: JSON.stringify({ message: "Nouvelle demande : " + title, content: Buffer.from(JSON.stringify(obj, null, 2), "utf8").toString("base64"), sha: sha, branch: branch }) });
    if (put.ok) return true;
    if (put.status !== 409 && put.status !== 422) return false;
    await new Promise(function (res) { setTimeout(res, 700 * (n + 1)); });   /* quelqu'un a publié entre-temps : on relit et on recommence */
  }
  return false;
}

module.exports = async function (req, res) {
  if (req.method !== "POST") { res.status(405).json({ error: "POST uniquement" }); return; }

  /* uniquement depuis ton propre site */
  var host = String(req.headers.host || "");
  var origin = String(req.headers.origin || "");
  if (origin) { try { if (new URL(origin).host !== host) { res.status(403).json({ error: "origine refusée" }); return; } } catch (e) { res.status(403).json({ error: "origine refusée" }); return; } }

  var b = req.body;
  if (typeof b === "string") { try { b = JSON.parse(b); } catch (e) { b = null; } }
  if (!b || typeof b !== "object") { res.status(400).json({ error: "requête invalide" }); return; }

  var kind = b.kind === "deadlink" ? "deadlink" : b.kind === "request" ? "request" : b.kind === "issue" ? "issue" : "";
  if (!kind) { res.status(400).json({ error: "type inconnu" }); return; }

  var hook = kind === "deadlink" || kind === "issue" ? (process.env.DISCORD_WEBHOOK_DEADLINKS || process.env.DISCORD_WEBHOOK_URL) : process.env.DISCORD_WEBHOOK_URL;
  if (!hookOk(hook)) { res.status(500).json({ error: "webhook Discord manquant ou invalide" }); return; }

  var vid = clean(b.vid, 16).replace(/[^\w-]/g, "");
  if (kind === "request" && vid) {
    var nv = Date.now(); Object.keys(vidHits).length > 3000 && (vidHits = {});
    if (vidHits[vid] && nv - vidHits[vid] < 86400000) { res.status(429).json({ error: "Une demande par jour", limit: true }); return; }
  }
  var ip = String((req.headers["x-forwarded-for"] || "").split(",")[0] || req.socket && req.socket.remoteAddress || "?").trim();
  if (limited(ip, kind)) { res.status(429).json({ error: "trop de requêtes" }); return; }

  var embed;
  if (kind === "request") {
    var titre = clean(b.titre, 200);
    if (!titre) { res.status(400).json({ error: "titre manquant" }); return; }
    var media = b.media === "movie" ? "movie" : "tv";
    var id = String(b.tmdbId || "").replace(/\D/g, "").slice(0, 10);
    var demande = ({ stream: "Streaming", dl: "Téléchargement", both: "Streaming + téléchargement" })[String(b.demande)] || "Streaming";
    var fields = [
      { name: "Type", value: media === "movie" ? "Film" : "Série", inline: true },
      { name: "Origine", value: clean(b.origin, 40) || "?", inline: true },
      { name: "Année", value: clean(b.date, 20) || "?", inline: true },
      { name: "Demande", value: demande, inline: true },
      { name: "Espace", value: b.bl ? "BL" : "Site principal", inline: true },
      { name: "Discord", value: clean(b.discord, 40) || "non renseigné", inline: true },
      { name: "ID", value: vid ? "`" + vid + "`" : "inconnu", inline: true }
    ];
    var en = clean(b.en, 150), orig = clean(b.orig, 150);
    if (en) fields.push({ name: "Titre anglais", value: en, inline: true });
    if (orig) fields.push({ name: "Titre original", value: orig, inline: true });
    embed = { title: (b.bl ? "[BL] " : "") + "Nouvelle demande : " + titre, color: 0x7c5cff, fields: fields, footer: { text: "DramaByM" }, timestamp: new Date().toISOString() };
    if (id) embed.url = "https://www.themoviedb.org/" + media + "/" + id;
    var poster = String(b.poster || "");
    if (/^\/[\w-]+\.(jpg|png)$/i.test(poster)) embed.thumbnail = { url: "https://image.tmdb.org/t/p/w185" + poster };
  } else if (kind === "issue") {
    var srv = clean(b.server, 60);
    var REASONS = { slow: "Lent / buffering", allerr: "Toutes les vidéos en erreur", offline: "Serveur hors ligne", video: "Une vidéo ne marche pas", other: "Autre" };
    var rk = REASONS[String(b.reason)] ? String(b.reason) : "";
    if (!srv || !rk) { res.status(400).json({ error: "signalement incomplet" }); return; }
    var fields3 = [
      { name: "Serveur", value: srv, inline: true },
      { name: "Problème", value: REASONS[rk], inline: true }
    ];
    var ttl = clean(b.title, 120), msg = clean(b.message, 300), pg = httpUrl(b.page);
    if (ttl) fields3.push({ name: "Titre concerné", value: ttl });
    if (msg) fields3.push({ name: "Détails", value: msg });
    try { if (pg && new URL(pg).host === host) fields3.push({ name: "Page", value: "<" + pg + ">" }); } catch (e) {}
    embed = { title: "Problème signalé : " + srv, color: (rk === "offline" || rk === "allerr") ? 0xe5484d : rk === "other" ? 0x8c8c8c : 0xf5a524, fields: fields3, footer: { text: "DramaByM · page Statut" }, timestamp: new Date().toISOString() };
  } else {
    var title = clean(b.title, 200);
    var link = httpUrl(b.url);
    if (!title || !link) { res.status(400).json({ error: "signalement incomplet" }); return; }
    var sub = clean(b.sub, 100);
    var video = b.reason === "video"; /* "dead" (serveur mort, par défaut) ou "video" (la vidéo ne marche pas) */
    var fields2 = [
      { name: "Problème", value: video ? "La vidéo ne marche pas" : "Serveur mort", inline: true },
      { name: "Serveur", value: clean(b.source, 60) || "?", inline: true },
      { name: "Lien", value: "<" + link + ">" }
    ];
    var page = httpUrl(b.page);
    try { if (page && new URL(page).host === host) fields2.push({ name: "Fiche sur le site", value: "<" + page + ">" }); } catch (e) {}
    embed = { title: video ? "Vidéo qui ne marche pas" : "Serveur mort signalé", description: "**" + title + "**" + (sub ? " · " + sub : ""), color: video ? 0xf5a524 : 0xe5484d, fields: fields2, footer: { text: "DramaByM" }, timestamp: new Date().toISOString() };
  }

  var listed = false;
  if (kind === "request") {
    try {
      var la = await listAdd(b, vid);
      if (la === "limit") { res.status(429).json({ error: "Une demande par jour", limit: true }); return; }
      listed = la === true;
    } catch (e) {}
  }
  try {
    var r = await fetch(hook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "DramaByM", embeds: [embed], allowed_mentions: { parse: [] } })
    });
    if (!r.ok) { res.status(502).json({ error: "Discord a refusé (" + r.status + ")" }); return; }
    if (kind === "request" && vid) vidHits[vid] = Date.now();
    res.status(200).json({ ok: true, listed: listed });
  } catch (e) {
    res.status(502).json({ error: "Discord injoignable" });
  }
};
