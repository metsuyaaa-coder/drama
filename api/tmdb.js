/* Proxy TMDB pour le formulaire de demande (Vercel).
   Variable d'environnement requise : TMDB_TOKEN (Read Access Token TMDB).
   Recherche des séries ET des films coréens, chinois, japonais et thaïlandais. */
var ORIGINS = ["ko", "zh", "cn", "ja", "th"];
var BAD_GENRES = [16, 99, 10763, 10764, 10767]; /* animation, documentaire, actualités, télé-réalité, talk-show */

module.exports = async function (req, res) {
  var token = process.env.TMDB_TOKEN;
  if (!token) { res.status(500).json({ error: "TMDB_TOKEN manquant" }); return; }
  var q = String((req.query && req.query.query) || "").trim().slice(0, 100);
  var lang = String((req.query && req.query.language) || "");
  if (!/^[a-z]{2,3}(-[A-Za-z]{2,4})?$/.test(lang)) lang = "en-US";
  if (q.length < 2) { res.status(200).json({ results: [] }); return; }

  function get(kind, page) {
    var u = new URL("https://api.themoviedb.org/3/search/" + kind);
    u.searchParams.set("query", q);
    u.searchParams.set("language", lang);
    u.searchParams.set("include_adult", "false");
    u.searchParams.set("page", String(page));
    return fetch(u.toString(), { headers: { Authorization: "Bearer " + token, accept: "application/json" } }).then(function (r) {
      if (!r.ok) throw new Error("TMDB " + r.status);
      return r.json();
    }).then(function (j) {
      return (j.results || []).map(function (x) { return Object.assign({}, x, { media_type: kind }); });
    });
  }
  function soft(p) { return p.catch(function () { return []; }); }
  try {
    var lists = await Promise.all([get("tv", 1), soft(get("tv", 2)), get("movie", 1), soft(get("movie", 2))]);
    var results = [].concat(lists[0], lists[1], lists[2], lists[3])
      .filter(function (x) {
        return ORIGINS.indexOf(x.original_language) > -1 && !(x.genre_ids || []).some(function (g) { return BAD_GENRES.indexOf(g) > -1; });
      })
      .sort(function (a, b) { return (b.popularity || 0) - (a.popularity || 0); });
    res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
    res.status(200).json({ results: results });
  } catch (e) {
    res.status(502).json({ error: String(e && e.message || "TMDB injoignable") });
  }
};
