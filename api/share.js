/* Aperçus de partage par titre pour DramaByM (Vercel, sans base de données).
   vercel.json envoie /serie/:id ici. La fonction renvoie le même index.html que d'habitude, mais avec
   le titre, le synopsis et l'image du titre dans les balises de partage (Discord, WhatsApp, Telegram, X…).
   Pour les visiteurs, rien ne change : le site s'ouvre normalement.
   Si le titre est introuvable ou si quelque chose échoue, la page normale est renvoyée. */

function esc(v) { return String(v == null ? "" : v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;"); }
function clip(v, n) { v = String(v == null ? "" : v).replace(/\s+/g, " ").trim(); return v.length > n ? v.slice(0, n - 1).replace(/\s+\S*$/, "") + "…" : v; }
function absUrl(u) { u = String(u || ""); return /^https:\/\/[^\s"<>]+$/i.test(u) ? u : ""; }

/* remplace la balise <meta> (property ou name) si elle existe, sinon l'ajoute avant </head> */
function setMeta(html, attr, key, content) {
  var tag = '<meta ' + attr + '="' + key + '" content="' + esc(content) + '">';
  var re = new RegExp('<meta\\s+[^>]*' + attr + '="' + key.replace(/[.:]/g, "\\$&") + '"[^>]*>', "i");
  return re.test(html) ? html.replace(re, function () { return tag; }) : html.replace("</head>", function () { return tag + "\n</head>"; });
}
function dropMeta(html, key) { return html.replace(new RegExp('<meta\\s+[^>]*property="' + key.replace(/[.:]/g, "\\$&") + '"[^>]*>\\s*', "i"), ""); }

module.exports = async function (req, res) {
  var host = String(req.headers["x-forwarded-host"] || req.headers.host || "");
  var proto = String(req.headers["x-forwarded-proto"] || "https").split(",")[0];
  var origin = proto + "://" + host;
  var id = String((req.query && req.query.id) || "").replace(/[^\w-]/g, "").slice(0, 40);

  var html;
  try {
    var r = await fetch(origin + "/index.html");
    html = await r.text();
    if (!r.ok || html.indexOf("<head>") < 0) throw new Error("index");
  } catch (e) {
    res.status(502).send("Site momentanément indisponible");
    return;
  }

  try {
    var item = null;
    if (id) {
      var c = await fetch(origin + "/catalog.json");
      if (c.ok) {
        var data = await c.json();
        var list = Array.isArray(data) ? data : (data && data.series) || [];
        item = list.filter(function (x) { return x && String(x.id) === id; })[0] || null;
      }
    }
    if (item && item.name) {
      var movie = item.type === "movie";
      var title = item.name + (item.year ? " (" + item.year + ")" : "") + " – DramaByM";
      var kind = movie ? "Film" : "Série";
      var intro = [kind, item.year, (item.genres || []).slice(0, 3).join(" / ")].filter(Boolean).join(" · ");
      var desc = clip(item.overview, 220) || ("Regarde " + item.name + " sur DramaByM.");
      var wide = absUrl(item.backdrop), image = wide || absUrl(item.poster);
      var url = origin + "/serie/" + encodeURIComponent(id);

      html = html.replace(/<title>[^<]*<\/title>/i, function () { return "<title>" + esc(title) + "</title>"; });
      html = setMeta(html, "property", "og:type", movie ? "video.movie" : "video.tv_show");
      html = setMeta(html, "property", "og:title", title);
      html = setMeta(html, "property", "og:description", intro + (intro ? " — " : "") + desc);
      html = setMeta(html, "property", "og:url", url);
      html = setMeta(html, "name", "description", desc);
      html = setMeta(html, "name", "twitter:title", title);
      html = setMeta(html, "name", "twitter:description", desc);
      html = dropMeta(html, "og:image:width"); html = dropMeta(html, "og:image:height");
      if (image) {
        html = setMeta(html, "property", "og:image", image);
        html = setMeta(html, "name", "twitter:image", image);
        html = setMeta(html, "property", "og:image:alt", item.name);
        html = setMeta(html, "name", "twitter:card", wide ? "summary_large_image" : "summary");
      }
    }
  } catch (e) { /* page normale */ }

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=120, stale-while-revalidate=3600");
  res.status(200).send(html);
};
