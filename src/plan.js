const ACTIONS = new Set([
  "chat",
  "answer",
  "search",
  "craft",
  "tv",
  "open_app",
  "close_app",
  "execute",
  "remember",
  "datetime",
  "look_screen",
  "refuse",
  "voice",
  "profile",
]);

const LOCAL_NO_WEB = new Set([
  "chat",
  "answer",
  "open_app",
  "close_app",
  "datetime",
  "remember",
  "execute",
  "look_screen",
  "refuse",
  "voice",
  "profile",
]);

function parsePlan(raw) {
  if (!raw) return null;
  const m = String(raw).match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const j = JSON.parse(m[0]);
    if (!j || !ACTIONS.has(j.action)) return null;
    const needWeb =
      j.need_web == null
        ? j.action === "search" || j.action === "tv"
        : Boolean(j.need_web);
    return {
      action: j.action,
      query: String(j.query || "").trim(),
      app: String(j.app || "").trim(),
      need_web: needWeb,
    };
  } catch {
    return null;
  }
}

function intentFromPlan(plan, fallbackQuery) {
  const q = plan.query || fallbackQuery || "";
  switch (plan.action) {
    case "craft":
      return { type: "craft", query: q };
    case "tv":
      return { type: "tv", query: q };
    case "open_app":
      return { type: "open_app", app: plan.app || q };
    case "close_app":
      return { type: "close_app", app: plan.app || q };
    case "execute":
      return { type: "do_last", execute: true };
    case "remember":
      return { type: "remember", fact: q };
    case "datetime":
      return { type: "datetime" };
    case "look_screen":
      return { type: "look_screen", query: q };
    case "refuse":
      return { type: "agency_refuse", query: q };
    case "voice":
      return { type: "set_voice", query: q };
    case "profile":
      return { type: "profile" };
    case "search":
      return { type: "question", query: q, need_web: true };
    case "chat":
      return { type: "question", query: q, need_web: false };
    case "answer":
    default:
      return { type: "question", query: q, need_web: plan.need_web === true };
  }
}

function plannerPrompt(who, langName) {
  return [
    `You are Jarvis planning one desktop turn for ${who}.`,
    `Reply JSON only: {"action":"chat|answer|search|craft|tv|open_app|close_app|execute|remember|datetime|look_screen|refuse|voice|profile","query":"","app":"","need_web":false}`,
    `Language of ${who}: ${langName}. Chat is the default. Small talk, follow-ups, opinions, a measured joke — not a command parser.`,
    "Pick search/tv/datetime/open_app/craft/execute only when this turn needs that tool. need_web true for unknown facts, people, TV extras, code docs. need_web false for conversation.",
    "Never pirate. Never dump a status paragraph. Address him only as instructed.",
  ].join(" ");
}

module.exports = { parsePlan, intentFromPlan, plannerPrompt, ACTIONS, LOCAL_NO_WEB };
