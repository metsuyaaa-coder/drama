/* Aperçu de partage (Discord, WhatsApp, Telegram, X…) pour /serie/<id>
   Les robots ne lancent pas le JavaScript : cette fonction lit catalog.json et
   renvoie index.html avec le nom, le synopsis et la bannière de la fiche dans les balises meta. */

var TMDB = "https://image.tmdb.org/t/p/";

function esc(t) {
  return String(t == null ? "" : t)
    .replace(/&/g, "&amp;").replace(/"/g, "&quot;")
    .replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function imageUrl(path, size, origin) {
  if (!path) return "";
  path = String(path);
  if (/^https?:\/\//i.test(path)) return path;
  return TMDB + size + (path.charAt(0) === "/" ? path : "/" + path);
}

module.exports = async function (req, res) {
  var host = req.headers["x-forwarded-host"] || req.headers.host;
  var origin = "https://" + host;
  var id = String((req.query && req.query.id) || "");

  var html;
  try {
    html = await (await fetch(origin + "/index.html")).text();
  } catch (e) {
    res.statusCode = 500;
    return res.end("Erreur");
  }

  var show = null;
  try {
    var list = await (await fetch(origin + "/catalog.json")).json();
    if (!Array.isArray(list)) list = list.shows || list.catalog || list.items || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i] && String(list[i].id) === id) { show = list[i]; break; }
    }
  } catch (e) {}

  if (show && show.name) {
    var title = show.name + (show.year ? " (" + show.year + ")" : "") + " · DramaByM";
    var desc = String(show.overview || "").replace(/\s+/g, " ").trim();
    if (desc.length > 200) desc = desc.slice(0, 197).replace(/\s+\S*$/, "") + "…";
    if (!desc) desc = "À regarder sur DramaByM.";
    var image = imageUrl(show.backdrop, "w1280") || imageUrl(show.poster, "w780") || origin + "/dbm.png";
    var url = origin + "/serie/" + encodeURIComponent(id);

    var tags =
      '<meta property="og:type" content="video.other">\n' +
      '<meta property="og:site_name" content="DramaByM">\n' +
      '<meta property="og:title" content="' + esc(title) + '">\n' +
      '<meta property="og:description" content="' + esc(desc) + '">\n' +
      '<meta property="og:url" content="' + esc(url) + '">\n' +
      '<meta property="og:image" content="' + esc(image) + '">\n' +
      '<meta name="twitter:card" content="summary_large_image">\n' +
      '<meta name="twitter:title" content="' + esc(title) + '">\n' +
      '<meta name="twitter:description" content="' + esc(desc) + '">\n' +
      '<meta name="twitter:image" content="' + esc(image) + '">\n' +
      '<meta name="description" content="' + esc(desc) + '">\n';

    html = html
      .replace(/<meta property="og:[^>]*>\s*/g, "")
      .replace(/<meta name="twitter:[^>]*>\s*/g, "")
      .replace(/<title>[^<]*<\/title>/, "<title>" + esc(title) + "</title>")
      .replace('<meta name="theme-color"', tags + '<meta name="theme-color"');
  }

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=3600");
  res.statusCode = 200;
  res.end(html);
};
