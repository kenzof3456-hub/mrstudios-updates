const { searchWeb, formatSearchAnswer, fetchJson } = require("./search");
const { say } = require("./voice");

function nrm(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
}

const COUNTRIES = [
  { re: /\b(mexico|mex)\b/, code: "MX", tz: "America/Mexico_City", name: { es: "México", en: "Mexico" } },
  { re: /\b(espana|spain)\b/, code: "ES", tz: "Europe/Madrid", name: { es: "España", en: "Spain" } },
  { re: /\b(estados unidos|eeuu|usa|united states|\bu\.?s\.?a?\b)\b/, code: "US", tz: "America/New_York", name: { es: "EE. UU.", en: "United States" } },
  { re: /\b(reino unido|inglaterra|gran bretana|uk|united kingdom|britain)\b/, code: "GB", tz: "Europe/London", name: { es: "Reino Unido", en: "United Kingdom" } },
  { re: /\b(japon|japan)\b/, code: "JP", tz: "Asia/Tokyo", name: { es: "Japón", en: "Japan" } },
  { re: /\b(argentina)\b/, code: "AR", tz: "America/Argentina/Buenos_Aires", name: { es: "Argentina", en: "Argentina" } },
  { re: /\b(colombia)\b/, code: "CO", tz: "America/Bogota", name: { es: "Colombia", en: "Colombia" } },
  { re: /\b(chile)\b/, code: "CL", tz: "America/Santiago", name: { es: "Chile", en: "Chile" } },
  { re: /\b(peru)\b/, code: "PE", tz: "America/Lima", name: { es: "Perú", en: "Peru" } },
  { re: /\b(brasil|brazil)\b/, code: "BR", tz: "America/Sao_Paulo", name: { es: "Brasil", en: "Brazil" } },
  { re: /\b(francia|france)\b/, code: "FR", tz: "Europe/Paris", name: { es: "Francia", en: "France" } },
  { re: /\b(alemania|germany)\b/, code: "DE", tz: "Europe/Berlin", name: { es: "Alemania", en: "Germany" } },
  { re: /\b(italia|italy)\b/, code: "IT", tz: "Europe/Rome", name: { es: "Italia", en: "Italy" } },
  { re: /\b(corea|korea)\b/, code: "KR", tz: "Asia/Seoul", name: { es: "Corea", en: "Korea" } },
  { re: /\b(china)\b/, code: "CN", tz: "Asia/Shanghai", name: { es: "China", en: "China" } },
  { re: /\b(canada)\b/, code: "CA", tz: "America/Toronto", name: { es: "Canadá", en: "Canada" } },
  { re: /\b(australia)\b/, code: "AU", tz: "Australia/Sydney", name: { es: "Australia", en: "Australia" } },
  { re: /\b(india)\b/, code: "IN", tz: "Asia/Kolkata", name: { es: "India", en: "India" } },
  { re: /\b(tailandia|thailand)\b/, code: "TH", tz: "Asia/Bangkok", name: { es: "Tailandia", en: "Thailand" } },
  { re: /\b(portugal)\b/, code: "PT", tz: "Europe/Lisbon", name: { es: "Portugal", en: "Portugal" } },
  { re: /\b(paises bajos|holanda|netherlands|holland)\b/, code: "NL", tz: "Europe/Amsterdam", name: { es: "Países Bajos", en: "Netherlands" } },
  { re: /\b(suecia|sweden)\b/, code: "SE", tz: "Europe/Stockholm", name: { es: "Suecia", en: "Sweden" } },
  { re: /\b(noruega|norway)\b/, code: "NO", tz: "Europe/Oslo", name: { es: "Noruega", en: "Norway" } },
  { re: /\b(islandia|iceland)\b/, code: "IS", tz: "Atlantic/Reykjavik", name: { es: "Islandia", en: "Iceland" } },
  { re: /\b(nueva zelanda|new zealand)\b/, code: "NZ", tz: "Pacific/Auckland", name: { es: "Nueva Zelanda", en: "New Zealand" } },
  { re: /\b(irlanda|ireland)\b/, code: "IE", tz: "Europe/Dublin", name: { es: "Irlanda", en: "Ireland" } },
  { re: /\b(sudafrica|south africa)\b/, code: "ZA", tz: "Africa/Johannesburg", name: { es: "Sudáfrica", en: "South Africa" } },
  { re: /\b(filipinas|philippines)\b/, code: "PH", tz: "Asia/Manila", name: { es: "Filipinas", en: "Philippines" } },
  { re: /\b(turquia|turkey)\b/, code: "TR", tz: "Europe/Istanbul", name: { es: "Turquía", en: "Turkey" } },
];

function guessNamedPlace(raw) {
  const t = nrm(raw);
  const m = t.match(
    /\b(?:en|in)\s+(?:el |la |los |las |the )?([a-z][a-z\s]{1,36}?)(?:\s+(hoy|today|ahora|tonight))?$/
  );
  if (!m) return null;
  const name = m[1]
    .replace(/\b(tv|tele|television|programacion|guia|listings|schedule|canal)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!name || name.length < 3) return null;
  if (/^(hoy|tv|tele|la|el)$/.test(name)) return null;
  return {
    code: "",
    tz: "UTC",
    name: { es: name, en: name },
  };
}

function looksLikeTv(raw) {
  const t = nrm(raw);
  return /(que echan|que echa|que hay en (la )?(tv|tele|television)|que pasan en (la )?(tv|tele)|programacion( de)? (tv|tele)|guia( de)? (tv|tele)|tv listings|what('?s| is) on (tv|television)|whats on tv|tv schedule|horario( de)? (tv|tele|la serie|la novela)|reparto de|cast of|quien(es)? actua|actores de|stars in|en que canal|what channel|serie de television|novela|prime time|cartelera (de )?(tv|tele)|netflix|disney\+|prime video|max |hulu|crunchyroll)/.test(
    t
  );
}

function isTvPiracy(raw) {
  const t = nrm(raw);
  return /(cuevana|repelis|pelisplus|gnula|veronline|streamrip|stream rip|ripear|torrent|magnet:|ver (el )?capitulo gratis|descargar (el )?(capitulo|capitulo de)|iptv pirate|lista m3u ilegal)/.test(
    t
  );
}

function parseCountry(raw, lang) {
  const t = nrm(raw);
  for (const c of COUNTRIES) {
    if (c.re.test(t)) return c;
  }
  const named = guessNamedPlace(raw);
  if (named) return named;
  if (lang === "en") return COUNTRIES.find((c) => c.code === "US");
  return COUNTRIES.find((c) => c.code === "MX");
}

function isCastAsk(raw) {
  return /(reparto|cast of|quien(es)? actua|actores de|who stars|who plays)/.test(nrm(raw));
}

function localDate(tz) {
  try {
    return new Date().toLocaleDateString("en-CA", { timeZone: tz });
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function formatStamp(iso, tz) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("es-MX", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return String(iso).slice(11, 16);
  }
}

function showNeedle(raw) {
  return String(raw || "")
    .replace(/^(que echan|que hay|whats on tv|what's on tv|reparto de|cast of|horario de|actores de)\s*/i, "")
    .replace(/\b(en|in|hoy|today|ahora|tonight)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function pirateTvReply(lang) {
  return lang === "en"
    ? "I won't point to pirated streams. Official apps or legal listings only."
    : "No te paso rips ni páginas pirata. Solo guía legal o apps oficiales.";
}

function formatListings(items, country, lang) {
  if (!items || !items.length) return "";
  const head =
    lang === "en"
      ? `Tonight-ish in ${country.name.en} (${country.tz}):`
      : `En ${country.name.es} (${country.tz}):`;
  const lines = items.slice(0, 8).map((it) => {
    const t = it.time || formatStamp(it.airstamp, country.tz) || "—";
    const ch = it.channel || "—";
    const title = it.title || "—";
    return `· ${t}  ${ch}  —  ${title}`;
  });
  return say(head, lines.join("\n"));
}

function tvSystem(langName) {
  return [
    `You are Jarvis. Reply in ${langName}. Call him Señor.`,
    "TV listings: name channel, local time with timezone, and what the show is.",
    "Legal sources only. Never pirate streams, rips, or illegal IPTV.",
    "You may name official apps (Netflix, Disney+, Prime Video, Max, Crunchyroll) if the sources say so.",
    "If extras or cast are asked, combine several public pages, not one snippet, and cite 2–5 short URLs.",
    "If schedule is thin, say so. Warm, concise.",
  ].join(" ");
}

async function tvmazeSchedule(country) {
  const date = localDate(country.tz);
  const json = await fetchJson(
    `https://api.tvmaze.com/schedule?country=${encodeURIComponent(country.code)}&date=${date}`
  );
  if (!Array.isArray(json)) return [];
  return json.slice(0, 12).map((ep) => ({
    title: ep.name && ep.show && ep.show.name ? `${ep.show.name}: ${ep.name}` : (ep.show && ep.show.name) || ep.name,
    channel: (ep.show && ep.show.network && ep.show.network.name) || (ep.show && ep.show.webChannel && ep.show.webChannel.name) || "",
    time: ep.airtime || formatStamp(ep.airstamp, country.tz),
    airstamp: ep.airstamp,
  }));
}

async function tvmazeShow(query, wantCast) {
  const q = encodeURIComponent(query.slice(0, 80));
  const hits = await fetchJson(`https://api.tvmaze.com/search/shows?q=${q}`);
  if (!Array.isArray(hits) || !hits[0] || !hits[0].show) return null;
  const show = hits[0].show;
  let cast = [];
  if (wantCast && show.id) {
    const people = await fetchJson(`https://api.tvmaze.com/shows/${show.id}/cast`);
    if (Array.isArray(people)) {
      cast = people.slice(0, 8).map((p) => (p.person && p.person.name) || "").filter(Boolean);
    }
  }
  return {
    name: show.name,
    summary: String(show.summary || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 280),
    network: (show.network && show.network.name) || (show.webChannel && show.webChannel.name) || "",
    official: show.officialSite || "",
    status: show.status || "",
    cast,
  };
}

async function lookupTv(query, lang) {
  const country = parseCountry(query, lang);
  const wantCast = isCastAsk(query);
  const listings = country.code ? await tvmazeSchedule(country) : [];
  const needle = showNeedle(query);
  let show = null;
  if (needle && needle.length > 2 && (wantCast || !/^(tv|tele|television)$/i.test(needle))) {
    show = await tvmazeShow(needle, wantCast);
  }
  const webQ = wantCast
    ? `${needle} cast official`
    : `${country.name.en} TV schedule today legal listings`;
  const web = await searchWeb(webQ);
  return { country, listings, show, web, wantCast, date: localDate(country.tz) };
}

function formatTvAnswer(lang, pack) {
  const bits = [];
  if (pack.show) {
    bits.push(
      lang === "en"
        ? `${pack.show.name}${pack.show.network ? " · " + pack.show.network : ""}.`
        : `${pack.show.name}${pack.show.network ? " · " + pack.show.network : ""}.`
    );
    if (pack.show.summary) bits.push(pack.show.summary);
    if (pack.show.cast && pack.show.cast.length) {
      bits.push(
        lang === "en" ? `Cast: ${pack.show.cast.join(", ")}.` : `Reparto: ${pack.show.cast.join(", ")}.`
      );
    }
    if (pack.show.official) bits.push(pack.show.official);
  }
  const list = formatListings(pack.listings, pack.country, lang);
  if (list) bits.push(list);
  if (pack.web && pack.web.length) bits.push(formatSearchAnswer(pack.country.name[lang === "en" ? "en" : "es"] + " TV", pack.web, lang));
  bits.push(
    lang === "en"
      ? "Legal listings only, Señor. No pirate streams."
      : "Guía legal, Señor. Nada de rips."
  );
  return say(bits);
}

module.exports = {
  looksLikeTv,
  isTvPiracy,
  parseCountry,
  isCastAsk,
  pirateTvReply,
  lookupTv,
  formatTvAnswer,
  tvSystem,
  formatListings,
};
