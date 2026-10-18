/* Fiche acteur pour DramaByM (Vercel, sans base de données).
   Le site appelle : GET /api/person?name=Lee+Min-ho&titles=Boys+Over+Flowers|The+Heirs&language=fr-FR
   et reçoit { id, name, native, photo, birthday, deathday, place, gender, bio, department }.
   Variable d'environnement : la même clé TMDB que api/tmdb.js (jeton "Read Access Token" ou clé API v3).
   Noms acceptés : TMDB_TOKEN, TMDB_READ_TOKEN, TMDB_ACCESS_TOKEN, TMDB_API_READ_ACCESS_TOKEN, TMDB_BEARER, TMDB_API_KEY, TMDB_KEY. */

var API = "https://api.themoviedb.org/3";
var cache = {}; /* en mémoire (repart de zéro quand Vercel redémarre la fonction) */
var hits = {};

function limited(ip) {
  var now = Date.now(), a;
  if (Object.keys(hits).length > 3000) hits = {};
  a = (hits[ip] || []).filter(function (t) { return now - t < 3600000; });
  if (a.length >= 120) { hits[ip] = a; return true; }
  a.push(now); hits[ip] = a; return false;
}
function clean(v, n) { return String(v == null ? "" : v).replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, n); }
function fold(x) {
  x = String(x || "").toLowerCase();
  try { x = x.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); } catch (e) {}
  return x.replace(/[^a-z0-9\u00c0-\uffff]+/g, " ").trim();
}
function token() {
  var e = process.env;
  return e.TMDB_TOKEN || e.TMDB_READ_TOKEN || e.TMDB_ACCESS_TOKEN || e.TMDB_API_READ_ACCESS_TOKEN || e.TMDB_BEARER || e.TMDB_API_KEY || e.TMDB_KEY || "";
}
function tmdb(path, params, tk) {
  var u = new URL(API + path), h = { accept: "application/json" };
  Object.keys(params || {}).forEach(function (k) { u.searchParams.set(k, params[k]); });
  if (tk.length > 60) h.Authorization = "Bearer " + tk; else u.searchParams.set("api_key", tk);
  return fetch(u.toString(), { headers: h }).then(function (r) {
    if (!r.ok) throw new Error("TMDB " + r.status);
    return r.json();
  });
}

module.exports = async function (req, res) {
  if (req.method !== "GET") { res.status(405).json({ error: "GET uniquement" }); return; }

  /* uniquement depuis ton propre site */
  var host = String(req.headers.host || ""), origin = String(req.headers.origin || "");
  if (origin) { try { if (new URL(origin).host !== host) { res.status(403).json({ error: "origine refusée" }); return; } } catch (e) { res.status(403).json({ error: "origine refusée" }); return; } }

  var q = req.query || {};
  var name = clean(q.name, 80);
  if (!name) { res.status(400).json({ error: "nom manquant" }); return; }
  var lang = /^[a-z]{2}(-[A-Z]{2})?$/.test(String(q.language || "")) ? String(q.language) : "fr-FR";
  var titles = String(q.titles || "").split("|").slice(0, 16).map(function (t) { return fold(clean(t, 120)); }).filter(Boolean);

  var tk = token();
  if (!tk) { res.status(500).json({ error: "clé TMDB manquante (variable d'environnement)" }); return; }

  var ip = String((req.headers["x-forwarded-for"] || "").split(",")[0] || (req.socket && req.socket.remoteAddress) || "?").trim();
  var key = fold(name) + "|" + lang + "|" + titles.slice(0, 4).join(",");
  var hit = cache[key];
  if (hit && Date.now() - hit.t < 86400000) { res.setHeader("Cache-Control", "public, s-maxage=604800, stale-while-revalidate=86400"); res.status(200).json(hit.v); return; }
  if (limited(ip)) { res.status(429).json({ error: "trop de requêtes" }); return; }

  try {
    var s = await tmdb("/search/person", { query: name, language: lang, include_adult: "false" }, tk);
    var list = (s && s.results) || [];
    if (!list.length) { res.status(404).json({ error: "acteur introuvable" }); return; }

    /* le bon homonyme : même nom + un de ses titres connus est dans ton catalogue */
    var want = fold(name), best = null, bestScore = -1;
    list.slice(0, 8).forEach(function (r) {
      var sc = fold(r.name) === want ? 4 : 0;
      (r.known_for || []).forEach(function (k) {
        var names = [k.title, k.name, k.original_title, k.original_name].map(fold);
        if (titles.some(function (t) { return t && names.indexOf(t) > -1; })) sc += 6;
      });
      sc += Math.min(2, (r.popularity || 0) / 50);
      if (sc > bestScore) { best = r; bestScore = sc; }
    });

    var d = await tmdb("/person/" + best.id, { language: lang }, tk);
    var bio = clean(d.biography, 4000).length ? String(d.biography).replace(/\r/g, "").trim().slice(0, 4000) : "";
    if (!bio && lang !== "en-US") {
      try { var en = await tmdb("/person/" + best.id, { language: "en-US" }, tk); bio = String(en.biography || "").replace(/\r/g, "").trim().slice(0, 4000); } catch (e) {}
    }
    var native = (d.also_known_as || []).filter(function (n) { return /[^\u0000-\u024f]/.test(n); })[0] || "";
    var out = {
      id: d.id, name: d.name || best.name, native: clean(native, 60),
      photo: /^\/[\w-]+\.(jpg|png)$/i.test(d.profile_path || "") ? d.profile_path : "",
      birthday: /^\d{4}-\d{2}-\d{2}$/.test(d.birthday || "") ? d.birthday : "",
      deathday: /^\d{4}-\d{2}-\d{2}$/.test(d.deathday || "") ? d.deathday : "",
      place: clean(d.place_of_birth, 120), gender: d.gender === 1 ? 1 : d.gender === 2 ? 2 : 0,
      bio: bio, department: clean(d.known_for_department, 40)
    };
    if (Object.keys(cache).length > 400) cache = {};
    cache[key] = { t: Date.now(), v: out };
    res.setHeader("Cache-Control", "public, s-maxage=604800, stale-while-revalidate=86400");
    res.status(200).json(out);
  } catch (e) {
    res.status(502).json({ error: "TMDB injoignable" });
  }
};
