const fs = require("fs");
const path = require("path");
const { safeName } = require("./attach");

function nrm(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
}

function looksLikeCraft(raw) {
  const t = nrm(raw);
  return /(codigo|code|\bscripts?\b|\bjavascript\b|\btypescript\b|\bpython\b|programa|programar|blender|gltf|wavefront|\.obj\b|geometry nodes|nodos de geometria|addon de blender|minecraft|roblox|fivem|five m|luau|\blua\b|discord(\.js)? bot|bot de discord|discord\.js|powershell|automatiz|escribe un(a)? (funcion|bot|script|addon|mod|plugin)|haz(me)? un (bot|script|addon)|write a (function|script|bot|addon|mod)|how (do i|to) (code|script|model)|modelo 3d|3d model|mesh|shader|material(es)? (en|in) blender|bpy\.|export(a|ar) (obj|gltf|fbx))/.test(
    t
  );
}

function looksLikeSaveCode(raw) {
  const t = nrm(raw);
  return /^(guarda(r|lo)? (el )?(codigo|archivo|script|file)|save (the )?(code|file|script)|exporta (el )?(codigo|archivo|script)|guardalo|save it)(\s|$)/.test(
    t
  );
}

function isPiracy(raw) {
  const t = nrm(raw);
  return /(crack(eado)?|nulled|pirate(ar|o)?|warez|leak(ed)? (mod|plugin|asset)|paid (plugin|mod) dump|keygen|serial (falso|fake))/.test(
    t
  );
}

function extractFiles(markdown, hint) {
  const text = String(markdown || "");
  const files = [];
  const re = /(?:FILE:\s*([^\s\n]+)\s*)?```(\w+)?\n([\s\S]*?)```/g;
  let m;
  let i = 0;
  while ((m = re.exec(text))) {
    const lang = (m[2] || "txt").toLowerCase();
    const body = m[3].replace(/\s+$/g, "") + "\n";
    const named = m[1] ? path.basename(m[1].replace(/['"]/g, "")) : "";
    files.push({
      name: named || guessName(hint, lang, i),
      language: lang,
      content: body,
    });
    i += 1;
  }
  return files;
}

function guessName(hint, lang, i) {
  const h = nrm(hint);
  const n = i ? `_${i + 1}` : "";
  if (/blender/.test(h)) return `blender_addon${n}.py`;
  if (/discord/.test(h)) return `discord_bot${n}.js`;
  if (/fivem|five m/.test(h)) return `client${n}.lua`;
  if (/roblox/.test(h)) return `roblox${n}.lua`;
  if (/gltf/.test(h)) return `model${n}.gltf`;
  if (/\bobj\b/.test(h)) return `model${n}.obj`;
  const ext =
    {
      python: ".py",
      py: ".py",
      javascript: ".js",
      js: ".js",
      lua: ".lua",
      luau: ".lua",
      json: ".json",
      powershell: ".ps1",
      bash: ".sh",
      html: ".html",
      css: ".css",
      glsl: ".glsl",
    }[lang] || ".txt";
  return `jarvis_script${n}${ext}`;
}

function pirateReply(lang) {
  return lang === "en"
    ? "I won't pirate paid mods or assets. I can write original scripts and explain Blender/game APIs instead."
    : "No pirateo mods ni assets de pago. Sí escribo scripts originales y te explico APIs de Blender o del juego.";
}

function localFallback(query, lang) {
  const t = nrm(query);
  if (/blender|bpy|geometry nodes/.test(t)) {
    const code = `import bpy

# Original helper: add a unit cube at the origin and export glTF next to the blend.
def add_cube_and_export(path="//cube.glb"):
    bpy.ops.mesh.primitive_cube_add(size=2, location=(0, 0, 0))
    obj = bpy.context.active_object
    obj.name = "JarvisCube"
    bpy.ops.export_scene.gltf(filepath=bpy.path.abspath(path), export_format="GLB")
    return obj.name

if __name__ == "__main__":
    print("Created", add_cube_and_export())
`;
    return {
      reply:
        (lang === "en"
          ? "Blender Python — original cube + glTF export. Paste in the Scripting tab, or say “save the file”.\n\n"
          : "Python de Blender: cubo original y export glTF. Pégalo en Scripting, o di «guarda el archivo».\n\n") +
        "```python\n" +
        code +
        "```",
      files: [{ name: "blender_addon.py", language: "python", content: code }],
    };
  }
  if (/discord(\.js)? bot|bot de discord|discord\.js/.test(t)) {
    const code = `const { Client, GatewayIntentBits } = require("discord.js");

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

client.on("ready", () => console.log("Ready as", client.user.tag));
client.on("messageCreate", (msg) => {
  if (msg.author.bot) return;
  if (msg.content === "!ping") msg.reply("pong");
});

client.login(process.env.DISCORD_TOKEN);
`;
    return {
      reply:
        (lang === "en"
          ? "Minimal discord.js bot. Put DISCORD_TOKEN in the env. Say “save the file” to write it.\n\n"
          : "Bot mínimo de discord.js. DISCORD_TOKEN en el entorno. Di «guarda el archivo».\n\n") +
        "```javascript\n" +
        code +
        "```",
      files: [{ name: "discord_bot.js", language: "javascript", content: code }],
    };
  }
  if (/fivem|five m/.test(t)) {
    const code = `-- client.lua (original). Put in a resource; do not copy paid scripts.
CreateThread(function()
  print("[jarvis] FiveM client resource started")
end)

RegisterCommand("jarvisping", function()
  TriggerEvent("chat:addMessage", { args = { "Jarvis", "pong" } })
end, false)
`;
    return {
      reply:
        (lang === "en"
          ? "Original FiveM client stub. Drop in a resource folder. Not a paid leak.\n\n"
          : "Stub original de FiveM (client). Carpeta de recurso. No es un leak de pago.\n\n") +
        "```lua\n" +
        code +
        "```",
      files: [{ name: "client.lua", language: "lua", content: code }],
    };
  }
  if (/roblox/.test(t)) {
    const code = `-- LocalScript (Roblox Lua). Original starter, not a copied game.
local Players = game:GetService("Players")
local player = Players.LocalPlayer
print("Jarvis hello", player.Name)

player.Chatted:Connect(function(msg)
  if msg:lower() == "/ping" then
    print("pong")
  end
end)
`;
    return {
      reply:
        (lang === "en"
          ? "Original Roblox LocalScript. Paste in StarterPlayerScripts.\n\n"
          : "LocalScript original de Roblox. Pégalo en StarterPlayerScripts.\n\n") +
        "```lua\n" +
        code +
        "```",
      files: [{ name: "roblox.lua", language: "lua", content: code }],
    };
  }
  if (/\.obj\b|wavefront|\bobj\b/.test(t) && !/gltf/.test(t)) {
    const code = `# Jarvis unit triangle (Wavefront OBJ)
v 0 0 0
v 1 0 0
v 0 1 0
f 1 2 3
`;
    return {
      reply:
        (lang === "en"
          ? "Tiny original OBJ triangle. Import in Blender.\n\n"
          : "OBJ mínimo (triángulo original). Impórtalo en Blender.\n\n") +
        "```obj\n" +
        code +
        "```",
      files: [{ name: "triangle.obj", language: "txt", content: code }],
    };
  }
  if (/gltf/.test(t)) {
    const code = `{
  "asset": { "version": "2.0", "generator": "Jarvis" },
  "scenes": [{ "nodes": [0] }],
  "nodes": [{ "mesh": 0 }],
  "meshes": [{ "primitives": [{ "attributes": { "POSITION": 1 }, "indices": 0 }] }],
  "buffers": [{ "uri": "data:application/octet-stream;base64,AAABAAIAAAAAAAAAAAAAAAAAAAAAAIA/AAAAAAAAAAAAAAAAAACAPwAAAAA=", "byteLength": 44 }],
  "bufferViews": [
    { "buffer": 0, "byteOffset": 0, "byteLength": 6, "target": 34963 },
    { "buffer": 0, "byteOffset": 8, "byteLength": 36, "target": 34962 }
  ],
  "accessors": [
    { "bufferView": 0, "componentType": 5123, "count": 3, "type": "SCALAR" },
    { "bufferView": 1, "componentType": 5126, "count": 3, "type": "VEC3", "max": [1,1,0], "min": [0,0,0] }
  ]
}
`;
    return {
      reply:
        (lang === "en"
          ? "Tiny valid-ish glTF triangle JSON. Import in Blender. Original, not a ripped asset.\n\n"
          : "glTF mínimo (triángulo). Impórtalo en Blender. Original, no es un asset robado.\n\n") +
        "```json\n" +
        code +
        "```",
      files: [{ name: "triangle.gltf", language: "json", content: code }],
    };
  }
  return null;
}

function craftSystem(langName) {
  return [
    `You are Jarvis, a capable coding and 3D-creation assistant. Reply in ${langName}.`,
    "Write real, complete, useful code in fenced markdown blocks.",
    "Before each block, a line: FILE: filename.ext",
    "Cover: general programming, game/mod scripts (Minecraft, Roblox Lua, FiveM) when asked, automation, Discord bots, Windows PowerShell/JS, Blender (bpy addons, geometry nodes concepts, meshes, materials, export).",
    "You may emit glTF JSON or OBJ. Explain steps briefly after the code.",
    "Original work only. Never pirate paid mods, leaked plugins, cracked assets, or copyrighted game files.",
    "Tone: warm, a spark of wit, not extra. End with: they can say “guarda el archivo” / “save the file”.",
  ].join(" ");
}

function writeCraftFile(dir, file) {
  fs.mkdirSync(dir, { recursive: true });
  const name = safeName(file.name || "jarvis_script.txt");
  const dest = path.join(dir, name);
  fs.writeFileSync(dest, file.content, "utf8");
  return dest;
}

let lastFiles = [];
function setLastFiles(files) {
  lastFiles = Array.isArray(files) ? files : [];
  return lastFiles;
}
function getLastFiles() {
  return lastFiles;
}

module.exports = {
  looksLikeCraft,
  looksLikeSaveCode,
  isPiracy,
  extractFiles,
  guessName,
  pirateReply,
  localFallback,
  craftSystem,
  writeCraftFile,
  setLastFiles,
  getLastFiles,
};
