/* api/profil.js : profils DramaByM (fonction Vercel, aucune dépendance)

   Variables d'environnement à définir dans Vercel :
   - KV_REST_API_URL et KV_REST_API_TOKEN (ajoutées toutes seules quand tu connectes Upstash Redis
     depuis Vercel > Storage / Marketplace). UPSTASH_REDIS_REST_URL / _TOKEN marchent aussi.
   - OWNER_PHRASE : TA phrase secrète de propriétaire (longue, que toi seul connais). Le profil qui
     se connecte avec elle est propriétaire : il peut nommer ou retirer des admins.
   - PROFILE_PEPPER : une longue chaîne au hasard. Elle sert à brouiller les phrases avant stockage. */

const crypto = require("crypto");

const DB_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const DB_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const PEPPER = process.env.PROFILE_PEPPER || DB_TOKEN || "dramabym";

const WORDS = [
  "oppa", "unnie", "noona", "hyung", "soju", "kimchi", "ramyeon", "bibimbap", "kimbap", "hanbok",
  "seoul", "busan", "jeju", "namsan", "itaewon", "gangnam", "hongdae", "chaebol", "idol", "aegyo",
  "daebak", "saranghae", "hwaiting", "makgeolli", "tteokbokki", "hotteok", "mandu", "galbi", "bulgogi",
  "chimaek", "banchan", "hallyu", "webtoon", "hanok", "umbrella", "piggyback", "cliffhanger", "twist",
  "rooftop", "sunrise", "firstlove", "secret", "destiny", "redstring", "cherry", "blossom", "lantern",
  "moonlight", "starlight", "lotus", "phoenix", "dragon", "tiger", "magpie", "crane", "plum", "bamboo",
  "pine", "jade", "pearl", "silk", "scroll", "palace", "queen", "prince", "princess", "general",
  "scholar", "swordsman", "throne", "rain", "snow", "autumn", "spring", "ocean", "island", "lighthouse",
  "ferris", "subway", "streetfood", "convenience", "dormitory", "campus", "romance", "revenge", "mystery",
  "thriller", "fantasy", "goblin", "gumiho", "angel", "reaper", "detective", "doctor", "lawyer", "chef",
  "actor", "singer", "dancer", "novelist", "poet", "painter", "violin", "guitar", "piano", "melody",
  "letter", "diary", "ticket", "passport", "sunset", "midnight", "daybreak", "whisper", "promise",
  "memory", "wish", "luck", "fate", "dream", "echo", "ember", "frost", "breeze", "thunder"
].filter(function (w, i, a) { return a.indexOf(w) === i; });

function normPhrase(p) {
  return String(p || "").toLowerCase().trim().replace(/[\s_]+/g, "-").replace(/-+/g, "-").slice(0, 80);
}
function hashPhrase(p) { return crypto.createHmac("sha256", PEPPER).update(p).digest("hex"); }
const OWNER_PHRASE = normPhrase(process.env.OWNER_PHRASE || "");
const OWNER_HASH = OWNER_PHRASE ? hashPhrase(OWNER_PHRASE) : "";

function genPhrase() {
  const w = [];
  for (let i = 0; i < 4; i++) w.push(WORDS[crypto.randomInt(WORDS.length)]);
  return w.join("-") + "-" + String(crypto.randomInt(10000)).padStart(4, "0");
}
function cleanName(x) {
  const n = String(x || "").replace(/[\u0000-\u001f<>]/g, "").replace(/\s+/g, " ").trim().slice(0, 24);
  return n.length >= 2 ? n : "";
}

async function db() {
  const cmd = Array.prototype.slice.call(arguments);
  const r = await fetch(DB_URL, {
    method: "POST",
    headers: { Authorization: "Bearer " + DB_TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify(cmd)
  });
  const j = await r.json();
  if (j.error) throw new Error(j.error);
  return j.result;
}

async function loadProfile(h) {
  const raw = await db("GET", "p:" + h);
  let p = raw ? JSON.parse(raw) : null;
  if (!p && h === OWNER_HASH) {
    p = { name: "Propriétaire", role: "owner", list: [], created: Date.now() };
    await db("SET", "p:" + h, JSON.stringify(p));
    await db("SADD", "profiles", h);
  }
  if (p && h === OWNER_HASH) p.role = "owner";
  return p;
}
function pub(h, p) {
  return { id: h.slice(0, 12), name: p.name, role: p.role || "user", list: p.list || [], created: p.created || 0 };
}
const isStaff = function (p) { return p.role === "admin" || p.role === "owner"; };
const RANK = { owner: 0, admin: 1, user: 2 };

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Méthode non autorisée" });
  if (!DB_URL || !DB_TOKEN) return res.status(503).json({ error: "Base de données non configurée" });

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  body = body || {};
  const action = String(body.action || "");
  const ip = String(req.headers["x-forwarded-for"] || "unknown").split(",")[0].trim();

  try {
    /* Création : la phrase est générée ici et renvoyée une seule fois */
    if (action === "create") {
      const n = await db("INCR", "rl:c:" + ip);
      if (n === 1) await db("EXPIRE", "rl:c:" + ip, 3600);
      if (n > 5) return res.status(429).json({ error: "Trop de créations depuis cette connexion, réessaie plus tard" });
      const name = cleanName(body.name);
      if (!name) return res.status(400).json({ error: "Choisis un pseudo de 2 à 24 caractères" });
      for (let t = 0; t < 5; t++) {
        const phrase = genPhrase(), h = hashPhrase(phrase);
        if (h === OWNER_HASH) continue;
        const p = { name: name, role: "user", list: [], created: Date.now() };
        const ok = await db("SET", "p:" + h, JSON.stringify(p), "NX");
        if (ok === "OK") {
          await db("SADD", "profiles", h);
          return res.status(200).json({ phrase: phrase, profile: pub(h, p) });
        }
      }
      return res.status(500).json({ error: "Création impossible, réessaie" });
    }

    /* Toutes les autres actions demandent la phrase */
    const fails = parseInt(await db("GET", "rl:f:" + ip), 10) || 0;
    if (fails >= 15) return res.status(429).json({ error: "Trop d'essais, réessaie dans quelques minutes" });
    const phrase = normPhrase(String(req.headers.authorization || "").replace(/^Bearer\s*/i, ""));
    const h = phrase ? hashPhrase(phrase) : "";
    const me = h ? await loadProfile(h) : null;
    if (!me) {
      const f = await db("INCR", "rl:f:" + ip);
      if (f === 1) await db("EXPIRE", "rl:f:" + ip, 900);
      return res.status(401).json({ error: "Phrase secrète inconnue" });
    }

    if (action === "login") return res.status(200).json({ profile: pub(h, me) });

    if (action === "save") {
      if (!Array.isArray(body.list)) return res.status(400).json({ error: "Liste invalide" });
      const seen = {};
      me.list = body.list.map(String).filter(function (x) {
        if (!x || x.length > 40 || seen[x]) return false;
        seen[x] = 1; return true;
      }).slice(0, 500);
      await db("SET", "p:" + h, JSON.stringify(me));
      return res.status(200).json({ ok: true });
    }

    if (action === "users") {
      if (!isStaff(me)) return res.status(403).json({ error: "Réservé aux admins" });
      const hs = (await db("SMEMBERS", "profiles") || []).slice(0, 500);
      const vals = hs.length ? await db.apply(null, ["MGET"].concat(hs.map(function (x) { return "p:" + x; }))) : [];
      const users = [];
      hs.forEach(function (x, i) {
        if (!vals[i]) return;
        const p = JSON.parse(vals[i]);
        if (x === OWNER_HASH) p.role = "owner";
        users.push({ id: x.slice(0, 12), name: p.name, role: p.role || "user", count: (p.list || []).length, created: p.created || 0 });
      });
      users.sort(function (a, b) { return (RANK[a.role] - RANK[b.role]) || (b.created - a.created); });
      return res.status(200).json({ users: users });
    }

    if (action === "setrole" || action === "remove") {
      if (me.role !== "owner") return res.status(403).json({ error: "Réservé au propriétaire" });
      const hs = await db("SMEMBERS", "profiles") || [];
      const target = hs.filter(function (x) { return x.slice(0, 12) === String(body.target || ""); })[0];
      if (!target) return res.status(404).json({ error: "Profil introuvable" });
      if (target === OWNER_HASH) return res.status(400).json({ error: "Le propriétaire ne peut pas être modifié" });
      if (action === "remove") {
        await db("DEL", "p:" + target);
        await db("SREM", "profiles", target);
        return res.status(200).json({ ok: true });
      }
      const role = body.role === "admin" ? "admin" : body.role === "user" ? "user" : "";
      if (!role) return res.status(400).json({ error: "Rôle invalide" });
      const raw = await db("GET", "p:" + target);
      if (!raw) return res.status(404).json({ error: "Profil introuvable" });
      const p = JSON.parse(raw);
      p.role = role;
      await db("SET", "p:" + target, JSON.stringify(p));
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: "Action inconnue" });
  } catch (e) {
    return res.status(500).json({ error: "Erreur serveur" });
  }
};
