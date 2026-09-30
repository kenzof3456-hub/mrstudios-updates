const ACTIONS = new Set([
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
      j.need_web == null ? !LOCAL_NO_WEB.has(j.action) : Boolean(j.need_web);
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
    case "answer":
    default:
      return { type: "question", query: q, need_web: plan.need_web !== false };
  }
}

function plannerPrompt(who, langName) {
  return [
    `You are Jarvis planning one desktop turn for ${who}.`,
    `Reply JSON only: {"action":"answer|search|craft|tv|open_app|close_app|execute|remember|datetime|look_screen|refuse|voice|profile","query":"","app":"","need_web":true}`,
    `Language of ${who}: ${langName}. Think, then pick one action that uses tools or memory if needed.`,
    "need_web true unless the action is local (datetime, open_app, close_app, remember, profile, execute, look_screen, voice, refuse). Open questions, people, TV extras, and code docs MUST search.",
    "Never pirate. Never dump a status paragraph. Address him only as instructed.",
  ].join(" ");
}

module.exports = { parsePlan, intentFromPlan, plannerPrompt, ACTIONS, LOCAL_NO_WEB };
