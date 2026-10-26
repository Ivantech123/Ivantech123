// Вклады с публичной страницы профиля (токен не нужен): змейка и карточка серий.
const SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";
const MONTHS = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];

const plural = (n, [one, few, many]) =>
  n % 10 === 1 && n % 100 !== 11 ? one : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? few : many;

export const SNAKE = {
  dark: { dots: ["#161b22", "#30363d", "#6e7681", "#b1bac4", "#f0f6fc"], snake: "#f0f6fc", muted: "#8b949e" },
  light: { dots: ["#ebedf0", "#c8ccd1", "#9198a1", "#59636e", "#1f2328"], snake: "#1f2328", muted: "#59636e" },
};

export async function contributions(user) {
  const res = await fetch(`https://github.com/users/${user}/contributions`, { headers: { "User-Agent": user } });
  if (!res.ok) throw new Error(`contributions: ${res.status}`);
  const html = await res.text();
  const tips = {};
  for (const m of html.matchAll(/<tool-tip[^>]*for="([^"]+)"[^>]*>([^<]*)/g)) tips[m[1]] = m[2];
  const days = [];
  for (const m of html.matchAll(/<td[^>]*data-date="([^"]+)"[^>]*>/g)) {
    const id = m[0].match(/id="(contribution-day-component-(\d+)-(\d+))"/);
    if (!id) continue;
    const level = +(m[0].match(/data-level="(\d)"/)?.[1] ?? 0);
    const tip = tips[id[1]] || "";
    const count = /^No /.test(tip) ? 0 : +(tip.match(/^(\d+)/)?.[1] ?? (level ? 1 : 0));
    days.push({ date: m[1], row: +id[2], col: +id[3], level, count });
  }
  if (!days.length) throw new Error("contributions: пустой календарь");
  return days.sort((a, b) => a.date.localeCompare(b.date));
}

// Змейка обходит непустые клетки (жадно, к ближайшей) ходами под прямым углом и съедает их.
export function snake(t, days) {
  const C = 14, S = 11, X = 30, Y = 24, SPEED = 9, PAUSE = 2.5, LEN = 6;
  const cols = Math.max(...days.map((d) => d.col)) + 1;
  const W = X + cols * C + 6, H = Y + 7 * C + 26;

  const left = days.filter((d) => d.level > 0);
  let pos = { col: -2, row: 0 };
  const pts = [[pos.col, pos.row]];
  const eatAt = new Map();
  let steps = 0;
  while (left.length) {
    let bi = 0, bd = Infinity;
    left.forEach((d, i) => {
      const dist = Math.abs(d.col - pos.col) + Math.abs(d.row - pos.row) + (d.col < pos.col ? 0.5 : 0);
      if (dist < bd) { bd = dist; bi = i; }
    });
    const d = left.splice(bi, 1)[0];
    if (d.row !== pos.row) { steps += Math.abs(d.row - pos.row); pos = { col: pos.col, row: d.row }; pts.push([pos.col, pos.row]); }
    if (d.col !== pos.col) { steps += Math.abs(d.col - pos.col); pos = { col: d.col, row: d.row }; pts.push([pos.col, pos.row]); }
    eatAt.set(d.date, steps / SPEED);
  }
  steps += cols + 3 - pos.col;
  pts.push([cols + 3, pos.row]);

  const move = steps / SPEED;
  const tail = (LEN - 1) / SPEED;
  const dur = +(move + tail + PAUSE).toFixed(2);
  const kt = (sec) => Math.min(sec / dur, 0.9999).toFixed(4);
  const cx = (c) => X + c * C + S / 2, cy = (r) => Y + r * C + S / 2;
  const path = "M" + pts.map(([c, r]) => `${cx(c)},${cy(r)}`).join(" L");

  const cells = days.map((d) => {
    const fill = t.dots[d.level];
    const at = eatAt.get(d.date);
    const anim = at === undefined ? ""
      : `<animate attributeName="fill" dur="${dur}s" repeatCount="indefinite" calcMode="discrete" keyTimes="0;${kt(at)}" values="${fill};${t.dots[0]}"/>`;
    return `<rect x="${X + d.col * C}" y="${Y + d.row * C}" width="${S}" height="${S}" rx="2" fill="${fill}">${anim}</rect>`;
  });

  // каждый сегмент идёт по тому же пути с отставанием на клетку
  const segs = Array.from({ length: LEN }, (_, i) => {
    const sz = +(S - i * 1.1).toFixed(1), d0 = i / SPEED;
    return `<rect x="${-sz / 2}" y="${-sz / 2}" width="${sz}" height="${sz}" rx="${(2 + i * 0.4).toFixed(1)}" fill="${t.snake}" opacity="${(1 - i * 0.13).toFixed(2)}">`
      + `<animateMotion dur="${dur}s" repeatCount="indefinite" calcMode="linear" keyPoints="0;0;1;1" keyTimes="0;${kt(d0)};${kt(d0 + move)};1" path="${path}"/></rect>`;
  }).reverse();

  const months = [];
  let last = -1;
  for (const d of days) {
    if (d.row !== 0 && d !== days[0]) continue;
    const m = +d.date.slice(5, 7) - 1;
    if (m !== last && d.col < cols - 2 && (d.col > 0 || +d.date.slice(8) <= 7)) months.push(`<text x="${X + d.col * C}" y="${Y - 8}">${MONTHS[m]}</text>`);
    last = m;
  }
  const wd = ["пн", "ср", "пт"].map((n, i) => `<text x="0" y="${Y + (1 + i * 2) * C + 9}">${n}</text>`);
  const lx = W - 6 - 5 * 14 - 46;
  const legend = t.dots.map((c, i) => `<rect x="${lx + i * 14}" y="${H - 15}" width="11" height="11" rx="2" fill="${c}"/>`).join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <g font-family="${SANS}" font-size="10" fill="${t.muted}">${months.join("")}${wd.join("")}<text x="${lx - 6}" y="${H - 6}" text-anchor="end">меньше</text><text x="${lx + 5 * 14 + 3}" y="${H - 6}">больше</text><text x="${X}" y="${H - 6}">змейка съедает вклады за год</text></g>
  ${cells.join("\n  ")}
  ${legend}
  ${segs.join("\n  ")}
</svg>
`;
}

export function streaks(days) {
  const today = new Date().toISOString().slice(0, 10);
  const past = days.filter((d) => d.date <= today);
  let longest = 0, run = 0, best = past[0];
  for (const d of past) {
    run = d.count ? run + 1 : 0;
    longest = Math.max(longest, run);
    if (d.count > best.count) best = d;
  }
  // текущая серия не обрывается, если сегодня ещё ничего не было
  let current = 0;
  for (let i = past.length - 1; i >= 0; i--) {
    if (past[i].count) current++;
    else if (i === past.length - 1) continue;
    else break;
  }
  const byDay = Array(7).fill(0);
  for (const d of past) byDay[new Date(d.date).getUTCDay()] += d.count;
  const WD = ["воскресенье", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота"];
  return {
    total: past.reduce((a, d) => a + d.count, 0),
    active: past.filter((d) => d.count).length,
    longest, current, best,
    weekday: WD[byDay.indexOf(Math.max(...byDay))],
  };
}

export function contribCard(t, st) {
  const W = 1000, H = 124;
  const date = (s) => { const [y, m, d] = s.split("-"); return `${+d} ${MONTHS[+m - 1]} ${y}`; };
  const items = [
    [st.total, plural(st.total, ["вклад", "вклада", "вкладов"]) + " за год"],
    [st.active, plural(st.active, ["активный день", "активных дня", "активных дней"])],
    [st.longest, "дн. — самая длинная серия"],
    [st.current, "дн. — текущая серия"],
    [st.best.count, "в лучший день · " + date(st.best.date)],
  ];
  const colW = (W - 48) / items.length;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="10" fill="none" stroke="${t.line}"/>
  ${items.map(([n, l], i) => `<text x="${24 + i * colW}" y="54" font-family="${SANS}" font-size="30" font-weight="600" fill="${t.fg}">${n}</text><text x="${24 + i * colW}" y="76" font-family="${SANS}" font-size="12" fill="${t.muted}">${l}</text>`).join("\n  ")}
  <line x1="24" y1="92" x2="${W - 24}" y2="92" stroke="${t.line}"/>
  <text x="24" y="111" font-family="${SANS}" font-size="12" fill="${t.muted}">чаще всего коммичу: ${st.weekday}</text>
</svg>
`;
}
