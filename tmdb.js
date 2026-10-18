/* Proxy TMDB pour le formulaire de demande (Vercel).
   Ajoute la variable d'environnement TMDB_TOKEN (ton jeton "Read Access Token" TMDB) dans Vercel > Settings > Environment Variables.
   Seule la recherche est autorisée : la clé n'est jamais envoyée au navigateur. */
module.exports = async function (req, res) {
  var token = process.env.TMDB_TOKEN;
  if (!token) { res.status(500).json({ error: "TMDB_TOKEN manquant" }); return; }
  var q = String((req.query && req.query.query) || "").trim().slice(0, 100);
  var lang = String((req.query && req.query.language) || "");
  if (!/^[a-z]{2,3}(-[A-Za-z]{2,4})?$/.test(lang)) lang = "en-US";
  if (q.length < 2) { res.status(200).json({ results: [] }); return; }
  var u = new URL("https://api.themoviedb.org/3/search/multi");
  u.searchParams.set("query", q);
  u.searchParams.set("language", lang);
  u.searchParams.set("include_adult", "false");
  try {
    var r = await fetch(u.toString(), { headers: { Authorization: "Bearer " + token, accept: "application/json" } });
    var j = await r.json();
    res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
    res.status(r.ok ? 200 : 502).json(r.ok ? j : { error: "TMDB " + r.status });
  } catch (e) {
    res.status(502).json({ error: "TMDB injoignable" });
  }
};
