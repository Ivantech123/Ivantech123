// Генерирует SVG для профиля (шапка, карточки проектов, статистика)
// и обновляет блок активности в README. Запускается в Actions раз в сутки.
import { readFile, writeFile, mkdir } from "node:fs/promises";

const USER = "Ivantech123";
const ROOT = new URL("../", import.meta.url);
const TOKEN = process.env.GITHUB_TOKEN;

// Проекты на главной: описание своё, остальное берётся из API.
const FEATURED = [
  ["Prosvet_antizapret_app", "Prosvet", "Обход DPI-блокировок на zapret/zapret2: сам подбирает рабочую стратегию и следит за ней."],
  ["Stenograv_app", "Стенограф", "Расшифровка диктофонных записей в текст прямо на компьютере, без интернета. whisper.cpp на GPU."],
  ["Harbor", "Harbor", "Независимый браузер на базе Firefox: пространства, split-view и глубокая настройка интерфейса."],
  ["Multi_calude", "Multi_calude", "Несколько аккаунтов Claude Code в одном терминале: переключение сессий и лимиты на виду."],
  ["ULN", "ULN", "United Lawyer Network — p2p-сеть для юристов без серверов: посты и зашифрованная переписка."],
  ["SUDRF-PARSER-", "SUDRF Parser", "Парсер судебных дел с сайтов судов общей юрисдикции по всей стране."],
];

const THEMES = {
  dark: { fg: "#e6edf3", muted: "#8b949e", faint: "#30363d", line: "#30363d", bar: ["#f0f6fc", "#b1bac4", "#8b949e", "#6e7681", "#484f58", "#30363d"] },
  light: { fg: "#1f2328", muted: "#59636e", faint: "#d0d7de", line: "#d0d7de", bar: ["#1f2328", "#424a53", "#59636e", "#818b98", "#afb8c1", "#d0d7de"] },
};

const SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";
const MONO = "ui-monospace,SFMono-Regular,'SF Mono',Menlo,Consolas,'Liberation Mono',monospace";

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

async function api(path) {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: { Accept: "application/vnd.github+json", "User-Agent": USER, ...(TOKEN && { Authorization: `Bearer ${TOKEN}` }) },
  });
  if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text()}`);
  return res.json();
}

function wrap(text, max) {
  const lines = [""];
  for (const word of text.split(" ")) {
    const cur = lines[lines.length - 1];
    if (cur && (cur + " " + word).length > max) lines.push(word);
    else lines[lines.length - 1] = cur ? cur + " " + word : word;
  }
  return lines;
}

// ---------- шапка с печатающейся строкой ----------
const PHRASES = [
  "пишу на Rust, TypeScript, Python",
  "собираю десктоп-приложения на Tauri 2",
  "делаю инструменты для юристов",
  "люблю софт, который работает без облака",
];

function header(t) {
  const W = 1000, H = 230, fs = 22, cw = 13.2; // ширина символа задаётся через textLength
  const slot = 4.5, total = slot * PHRASES.length;
  const x0 = 64, y = 168;
  const k = (s) => (s / total).toFixed(4);

  const lines = PHRASES.map((p, i) => {
    const prompt = "$ ";
    const full = (prompt + p).length * cw;
    const pw = prompt.length * cw;
    const s = i * slot;
    // видимость только в своём слоте
    const vis = s === 0 ? ["0;" + k(slot), "1;0"] : ["0;" + k(s) + ";" + k(s + slot), "0;1;0"];
    // печать по символу, пауза, стирание
    const steps = [], vals = [];
    const n = p.length;
    for (let c = 0; c <= n; c++) { steps.push(+k(s + (2.2 * c) / n)); vals.push(pw + c * cw); }
    for (let c = n; c >= 0; c--) { steps.push(+k(s + 3.6 + (0.7 * (n - c)) / n)); vals.push(pw + c * cw); }
    const kt = [0, ...steps, 1].map((v, j, a) => (j && v <= a[j - 1] ? +(a[j - 1] + 0.00001).toFixed(5) : v));
    const vv = [0, ...vals, 0];
    return `
  <g opacity="0">
    <animate attributeName="opacity" dur="${total}s" repeatCount="indefinite" calcMode="discrete" keyTimes="${vis[0]}" values="${vis[1]}"/>
    <clipPath id="c${i}"><rect x="${x0}" y="${y - 24}" height="34" width="0">
      <animate attributeName="width" dur="${total}s" repeatCount="indefinite" calcMode="discrete" keyTimes="${kt.join(";")}" values="${vv.join(";")}"/>
    </rect></clipPath>
    <text x="${x0}" y="${y}" clip-path="url(#c${i})" font-family="${MONO}" font-size="${fs}" fill="${t.fg}" textLength="${full}" lengthAdjust="spacingAndGlyphs" xml:space="preserve"><tspan fill="${t.muted}">${prompt}</tspan>${esc(p)}</text>
    <rect y="${y - 19}" width="11" height="24" fill="${t.fg}" x="${x0}">
      <animate attributeName="x" dur="${total}s" repeatCount="indefinite" calcMode="discrete" keyTimes="${kt.join(";")}" values="${vv.map((v) => x0 + v + 3).join(";")}"/>
      <animate attributeName="opacity" dur="1s" repeatCount="indefinite" calcMode="discrete" keyTimes="0;0.5" values="1;0"/>
    </rect>
  </g>`;
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="12" fill="none" stroke="${t.line}"/>
  <text x="${x0}" y="58" font-family="${MONO}" font-size="14" fill="${t.muted}" letter-spacing="1">~/ivantech123</text>
  <text x="${x0}" y="118" font-family="${SANS}" font-size="52" font-weight="600" fill="${t.fg}" letter-spacing="-1.5">Иван Андреев</text>
  <line x1="${x0}" y1="138" x2="${W - x0}" y2="138" stroke="${t.faint}"/>
  <text x="${W - x0}" y="58" text-anchor="end" font-family="${MONO}" font-size="14" fill="${t.muted}">full-stack · desktop · AI</text>${lines.join("")}
</svg>
`;
}

// ---------- карточка проекта ----------
function repoCard(t, title, desc, repo) {
  const W = 480, H = 150;
  const lines = wrap(desc, 56).slice(0, 3);
  const meta = [];
  let x = 24;
  if (repo.language) {
    meta.push(`<circle cx="${x + 5}" cy="126" r="5" fill="none" stroke="${t.fg}" stroke-width="1.5"/><text x="${x + 16}" y="130" fill="${t.muted}">${esc(repo.language)}</text>`);
    x += 16 + repo.language.length * 7.6 + 22;
  }
  meta.push(`<text x="${x}" y="130" fill="${t.muted}">★ ${repo.stargazers_count}</text>`);
  x += 50;
  if (repo.license && repo.license.spdx_id !== "NOASSERTION") meta.push(`<text x="${x}" y="130" fill="${t.muted}">${esc(repo.license.spdx_id)}</text>`);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="10" fill="none" stroke="${t.line}"/>
  <text x="24" y="40" font-family="${SANS}" font-size="19" font-weight="600" fill="${t.fg}">${esc(title)}</text>
  <text x="${W - 24}" y="40" text-anchor="end" font-family="${MONO}" font-size="16" fill="${t.muted}">↗</text>
  <g font-family="${SANS}" font-size="14" fill="${t.muted}">${lines.map((l, i) => `<text x="24" y="${70 + i * 20}">${esc(l)}</text>`).join("")}</g>
  <g font-family="${SANS}" font-size="13">${meta.join("")}</g>
</svg>
`;
}

const plural = (n, [one, few, many]) => (n % 10 === 1 && n % 100 !== 11 ? one : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? few : many);

// ---------- общая статистика ----------
function stats(t, user, repos) {
  const W = 1000, H = 170;
  const own = repos.filter((r) => !r.fork);
  const stars = own.reduce((a, r) => a + r.stargazers_count, 0);
  const langs = {};
  for (const r of own) if (r.language) langs[r.language] = (langs[r.language] || 0) + 1;
  const sorted = Object.entries(langs).sort((a, b) => b[1] - a[1]);
  const top = sorted.slice(0, 5);
  const rest = sorted.slice(5).reduce((a, [, v]) => a + v, 0);
  if (rest) top.push(["Другое", rest]);
  const sum = top.reduce((a, [, v]) => a + v, 0);

  const years = new Date().getFullYear() - new Date(user.created_at).getFullYear();
  const nums = [
    [own.length, "репозиториев"],
    [stars, "звёзд"],
    [user.followers, "подписчиков"],
    [years, plural(years, ["год", "года", "лет"]) + " на GitHub"],
  ];
  const colW = (W - 48) / nums.length;
  let bx = 24;
  const barW = W - 48;
  const bar = top.map(([, v], i) => {
    const w = (v / sum) * barW;
    const r = `<rect x="${bx.toFixed(1)}" y="104" width="${Math.max(w - 2, 1).toFixed(1)}" height="8" fill="${t.bar[i]}"/>`;
    bx += w;
    return r;
  });
  let lx = 24;
  const legend = top.map(([name, v], i) => {
    const label = `${name} ${v}`;
    const g = `<rect x="${lx}" y="132" width="10" height="10" fill="${t.bar[i]}" stroke="${t.line}"/><text x="${lx + 16}" y="141">${esc(label)}</text>`;
    lx += 16 + label.length * 7.4 + 26;
    return g;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="10" fill="none" stroke="${t.line}"/>
  ${nums.map(([n, l], i) => `<text x="${24 + i * colW}" y="56" font-family="${SANS}" font-size="34" font-weight="600" fill="${t.fg}">${n}</text><text x="${24 + i * colW}" y="78" font-family="${SANS}" font-size="13" fill="${t.muted}">${l}</text>`).join("\n  ")}
  <clipPath id="b"><rect x="24" y="104" width="${barW}" height="8" rx="4"/></clipPath>
  <g clip-path="url(#b)">${bar.join("")}</g>
  <g font-family="${SANS}" font-size="12" fill="${t.muted}">${legend.join("")}</g>
  <text x="${W - 24}" y="141" text-anchor="end" font-family="${SANS}" font-size="12" fill="${t.muted}">основной язык репозиториев</text>
</svg>
`;
}

// ---------- лента активности ----------
const ago = (d) => {
  const days = Math.floor((Date.now() - new Date(d)) / 864e5);
  return days === 0 ? "сегодня" : days === 1 ? "вчера" : `${days} дн. назад`;
};

function activity(events) {
  const out = [];
  const seen = new Set();
  for (const e of events) {
    const repo = e.repo.name.replace(`${USER}/`, "");
    if (repo === USER) continue;
    const link = `[${repo}](https://github.com/${e.repo.name})`;
    let line;
    if (e.type === "PushEvent") {
      if (seen.has("push" + repo)) continue;
      seen.add("push" + repo);
      const msg = e.payload.commits?.at(-1)?.message?.split("\n")[0];
      line = `⬆ ${link}${msg ? ` — ${msg.slice(0, 70).replace(/[|<>]/g, "")}` : ""}`;
    } else if (e.type === "ReleaseEvent") line = `📦 ${link} — релиз ${e.payload.release.tag_name}`;
    else if (e.type === "CreateEvent" && e.payload.ref_type === "repository") line = `✦ новый репозиторий ${link}`;
    else if (e.type === "PullRequestEvent" && e.payload.action === "opened") line = `⇄ PR в ${link}: ${e.payload.pull_request.title}`;
    else if (e.type === "IssuesEvent" && e.payload.action === "opened") line = `◌ issue в ${link}: ${e.payload.issue.title}`;
    else if (e.type === "WatchEvent" && !e.repo.name.startsWith(USER + "/")) line = `☆ отметил ${link}`;
    else continue;
    out.push(`- ${line} <sub>· ${ago(e.created_at)}</sub>`);
    if (out.length === 6) break;
  }
  return out.join("\n") || "- пока тихо";
}

const user = await api(`/users/${USER}`);
const repos = await api(`/users/${USER}/repos?per_page=100&type=owner`);
const events = await api(`/users/${USER}/events/public?per_page=60`);
const byName = Object.fromEntries(repos.map((r) => [r.name, r]));

await mkdir(new URL("assets/", ROOT), { recursive: true });
for (const [mode, t] of Object.entries(THEMES)) {
  await writeFile(new URL(`assets/header-${mode}.svg`, ROOT), header(t));
  await writeFile(new URL(`assets/stats-${mode}.svg`, ROOT), stats(t, user, repos));
  for (const [name, title, desc] of FEATURED) {
    if (!byName[name]) continue;
    await writeFile(new URL(`assets/repo-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${mode}.svg`, ROOT), repoCard(t, title, desc, byName[name]));
  }
}

const readmeUrl = new URL("README.md", ROOT);
const readme = await readFile(readmeUrl, "utf8");
await writeFile(
  readmeUrl,
  readme.replace(/(<!--ACTIVITY:START-->)[\s\S]*?(<!--ACTIVITY:END-->)/, `$1\n${activity(events)}\n$2`),
);
console.log("ok");
