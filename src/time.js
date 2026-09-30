function formatNow(locale = "es-MX") {
  const now = new Date();
  const weekday = new Intl.DateTimeFormat(locale, { weekday: "long" }).format(now);
  const date = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(now);
  const time = new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(now);
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const cap = weekday.charAt(0).toUpperCase() + weekday.slice(1);
  return {
    weekday: cap,
    date,
    time,
    timeZone: tz,
    text: `Rabbit, son las ${time}. Hoy es ${cap}, ${date} (zona ${tz}).`,
  };
}

module.exports = { formatNow };
