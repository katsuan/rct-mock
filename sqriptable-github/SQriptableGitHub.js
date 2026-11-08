// ======================================
// SQriptable GitHub
// ======================================
//
// GitHub の草（日ごとの contribution）と、最新の行動3件を、iPhone から GitHub の API で直接読んで見せるウィジェット。
// 1ファイルで動く（ほかのスクリプトはいらない）。見た目（色・字・右上の時刻）は同じシリーズのほかのウィジェットとそろえてある。
//
// 使い方
//   1. GitHub の Settings → Developer settings → Personal access tokens でトークンを作る
//      （fine-grained なら「Account permissions」はなしでよい。非公開リポジトリの行動も出すなら、そのリポジトリの読み取りを許す）
//   2. アプリで開いて「🔑 トークンを入れる」。iPhone の Keychain にだけしまう
//   3. ウィジェットに置く。Parameter は空でよい
//
// 大きさ
//   小 … きょうの数と続いた日数、ここ数週の草
//   中 … 草と、最新の行動3件
//   大 … 長い草（月の名前つき）、きょう・続いた日数・この1年、最新の行動3件（2行ずつ）
//   ロック画面 … 1行は「🌱5 🔥12日」、丸はきょうの数、長方形は短い草
//
// しまう場所
//   - トークン … iPhone の Keychain だけ（ファイルには書かない）
//   - 前に読めた値 … この端末の SQriptableGitHub/cache.json（読めないときに「前の値」として出す）

const GH = {
  API: "https://api.github.com",
  KEY_TOKEN: "sqgh_token",
  DIR: "SQriptableGitHub",
  // 次に描き直してほしい間隔（分）
  REFRESH_MIN: 30,
  // 出す行動の数
  EVENTS: 3,
};

// 草の色（GitHub の段階 NONE・FIRST_QUARTILE〜FOURTH_QUARTILE に合わせて5段）。ライトとダークで別の色
const GRASS = {
  light: ["#E6E3EE", "#9BE9A8", "#40C463", "#30A14E", "#216E39"],
  dark: ["#26222F", "#0E4429", "#006D32", "#26A641", "#39D353"],
};
const LEVELS = ["NONE", "FIRST_QUARTILE", "SECOND_QUARTILE", "THIRD_QUARTILE", "FOURTH_QUARTILE"];

// ---------- 色・字（同じシリーズのほかのウィジェットと同じ部品） ----------
const COLORS = { light: "#D1D5DB", white: "#FFFFFF" };
const THEME = {
  light: { bg: "#F4F2FB", text: "#1B1730", sub: "#6B6585", line: "#1B1730" },
  dark: { bg: "#121018", text: "#F4F2FA", sub: "#A49EB9", line: "#FFFFFF" },
};

function themeColor_(key, alpha = 1) {
  return Color.dynamic(new Color(THEME.light[key], alpha), new Color(THEME.dark[key], alpha));
}

// いま描いている大きさ。アプリで開いて「○で見る」を選んだときは config.widgetFamily が空なので、ここで覚える
let currentFamily = null;

function widgetFamily_(fallback = "medium") {
  return currentFamily || config.widgetFamily || fallback;
}

function isAccessory_() {
  return /^accessory/.test(widgetFamily_());
}

function addText(target, text, options = {}) {
  const item = target.addText(String(text));
  const size = options.size || 12;
  item.font = options.font === "bold" ? Font.boldSystemFont(size) : options.font === "semibold" ? Font.semiboldSystemFont(size) : Font.systemFont(size);
  item.textColor = resolveColor(options.color);
  if (options.lineLimit !== undefined) item.lineLimit = options.lineLimit;
  if (options.minScale !== undefined) item.minimumScaleFactor = options.minScale;
  return item;
}

function resolveColor(name) {
  if (!isAccessory_()) return name === "light" ? themeColor_("sub") : themeColor_("text");
  return name === "light" ? new Color(COLORS.light) : new Color(COLORS.white);
}

/** 草の1マスの色（段階 0〜4）。ロック画面は白の濃さで */
function grassColor_(level) {
  if (isAccessory_()) return new Color("#FFFFFF", [0.18, 0.4, 0.6, 0.8, 1][level] || 0.18);
  return Color.dynamic(new Color(GRASS.light[level]), new Color(GRASS.dark[level]));
}

/** SF Symbols を1つ置く（線アイコン。字と同じ大きさ・うすい色）。描けないときは何も置かない */
function addIcon_(stack, name, size, color) {
  if (!name || typeof SFSymbol === "undefined") return null;
  try {
    const sym = SFSymbol.named(name);
    if (!sym) return null;
    sym.applyFont(Font.systemFont(size));
    const img = sym.image;
    const view = stack.addImage(img);
    const s = (img && img.size) || {};
    const ratio = s.width > 0 && s.height > 0 ? s.width / s.height : 1;
    view.imageSize = new Size(Math.round(size * ratio * 10) / 10, size);
    view.tintColor = color || themeColor_("sub");
    return view;
  } catch (e) {
    return null;
  }
}

function widgetSize_(family) {
  return widgetSizeFor(family, Device.screenSize(), Device.isPad());
}

// ======================================
// 大きさ（Apple の HIG の表から）
// ======================================
const IPHONE_WIDGET_SIZES = [
  [430, 932, 170, 364, 382, 76, 172, 76],
  [428, 926, 170, 364, 382, 76, 172, 76],
  [414, 896, 169, 360, 379, 76, 160, 72],
  [414, 736, 159, 348, 357, 76, 170, 76],
  [393, 852, 158, 338, 354, 72, 160, 72],
  [390, 844, 158, 338, 354, 72, 160, 72],
  [375, 812, 155, 329, 345, 72, 157, 72],
  [360, 780, 155, 329, 345, 72, 157, 72],
  [375, 667, 148, 321, 324, 68, 153, 68],
  [320, 568, 141, 292, 311, 68, 153, 68],
];
// iPad：[幅, 高さ, 小, 中の幅（＝大の一辺）, 特大の幅]。描く大きさ（Canvas）。iPad の大は正方形
const IPAD_WIDGET_SIZES = [
  [1192, 1590, 188, 412, 860],
  [1024, 1366, 170, 378, 795],
  [970, 1389, 162, 350, 726],
  [954, 1373, 162, 350, 726],
  [834, 1194, 155, 342, 715],
  [820, 1180, 155, 342, 715],
  [834, 1112, 150, 327, 682],
  [810, 1080, 146, 320, 669],
  [768, 1024, 141, 305, 634],
  [744, 1133, 141, 305, 634],
];

/** 画面の大きさ（縦向き）と iPad かどうかから、その機種の行を選ぶ */
function pickWidgetSizeRow(screen, pad) {
  const w = Math.min(screen.width, screen.height);
  const h = Math.max(screen.width, screen.height);
  const table = pad ? IPAD_WIDGET_SIZES : IPHONE_WIDGET_SIZES;
  const exact = table.find((row) => row[0] === w && row[1] === h);
  if (exact) return exact;
  const fits = table.filter((row) => row[0] <= w && row[1] <= h).sort((a, b) => b[2] - a[2])[0];
  if (fits) return fits;
  // どの機種より小さい：いちばん小さい行を、幅と高さの比の小さいほうで縮める
  const least = table.slice().sort((a, b) => a[2] - b[2])[0];
  const k = Math.min(w / least[0], h / least[1]);
  return least.map((v, i) => (i < 2 ? v : Math.floor(v * k)));
}

/** ウィジェットの大きさ（ポイント）。{ w, h } */
function widgetSizeFor(family, screen, pad) {
  const row = pickWidgetSizeRow(screen, pad);
  if (pad) {
    const [, , s, m, xl] = row;
    return {
      small: { w: s, h: s },
      medium: { w: m, h: s },
      large: { w: m, h: m },
      extraLarge: { w: xl, h: m },
      // iPad のロック画面は表がないので、iPhone のいちばん小さい値（切れないほう）
      accessoryCircular: { w: 68, h: 68 },
      accessoryRectangular: { w: 153, h: 68 },
    }[family] || { w: m, h: s };
  }
  const [, , s, m, l, circle, rectW, rectH] = row;
  return {
    small: { w: s, h: s },
    medium: { w: m, h: s },
    large: { w: m, h: l },
    // iPhone に特大はない（iPad や、パソコンで見た目を確かめるとき用）
    extraLarge: { w: m * 2 + 20, h: l },
    accessoryCircular: { w: circle, h: circle },
    accessoryRectangular: { w: rectW, h: rectH },
  }[family] || { w: m, h: s };
}

// ======================================
// 時刻の書き方
// ======================================

/** 「18:00」（時も2けた） */
function clockOf_(date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

/** 「11/6」 */
function monthDayOf_(date) {
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

/** 行動の時刻。きょうなら「20:08」、きのうなら「きのう 20:08」、それより前は「11/5 20:08」 */
function whenText_(iso, now) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const day = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(now) - day(d)) / 86400000);
  if (diff <= 0) return clockOf_(d);
  if (diff === 1) return `きのう ${clockOf_(d)}`;
  return `${monthDayOf_(d)} ${clockOf_(d)}`;
}

const ymd_ = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

// ======================================
// 読みこみ（トークンは Keychain）
// ======================================

class SetupError extends Error {}

function readToken_() {
  return Keychain.contains(GH.KEY_TOKEN) ? Keychain.get(GH.KEY_TOKEN) : "";
}

/** GitHub の API を呼んで JSON を返す（トークンがなければ SetupError、401・403 なら「トークンがちがう」） */
async function apiCall_(path, body) {
  const token = readToken_();
  if (!token) throw new SetupError("アプリで開いて、GitHub のトークンを入れてね");
  const request = new Request(`${GH.API}${path}`);
  request.method = body ? "POST" : "GET";
  request.headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
  };
  if (body) request.body = JSON.stringify(body);
  request.timeoutInterval = 20;
  const json = await request.loadJSON();
  const status = request.response && request.response.statusCode;
  if (status === 401 || status === 403) throw new SetupError("GitHub のトークンがちがうか、切れています。アプリで入れなおしてね");
  if (!json || (status && status >= 400)) throw new Error(`GitHub ${status || "?"}`);
  // GraphQL は、読めない所だけ errors にして、読めた所は data で返す。data がまったくないときだけ失敗にする
  if (json.errors && json.errors.length && !json.data) throw new Error(`GitHub ${json.errors[0].message || "error"}`);
  return json;
}

// 草：いまから1年前までの日ごとの数（GraphQL。トークンの人＝viewer の分）
const CALENDAR_QUERY = `query($from: DateTime!, $to: DateTime!) {
  viewer {
    login
    contributionsCollection(from: $from, to: $to) {
      contributionCalendar {
        totalContributions
        weeks { contributionDays { date contributionCount contributionLevel } }
      }
    }
  }
}`;

// 最後に push したリポジトリ（GraphQL。行動の一覧 events は数時間おくれることがあるので、push はこちらで見る）
const REPOS_QUERY = `query {
  viewer {
    repositories(first: 6, orderBy: { field: PUSHED_AT, direction: DESC }, ownerAffiliations: [OWNER]) {
      nodes {
        name
        pushedAt
        defaultBranchRef { name target { ... on Commit { committedDate messageHeadline } } }
      }
    }
  }
}`;

/**
 * 最後に push したリポジトリ → 行動 { icon, what, repo, at }。
 * 時刻は push した時刻。文は、そのときの最後のコミットのメッセージ（push と同じころのコミットのときだけ。
 * ほかのブランチへの push などで合わなければ「push」）
 */
function pushesOf_(json) {
  const nodes = (json && json.data && json.data.viewer && json.data.viewer.repositories && json.data.viewer.repositories.nodes) || [];
  return nodes.filter((node) => node && node.pushedAt).map((node) => {
    const branch = node.defaultBranchRef || {};
    const commit = branch.target || {};
    const near = commit.committedDate && Math.abs(Date.parse(node.pushedAt) - Date.parse(commit.committedDate)) < 10 * 60 * 1000;
    return {
      icon: "arrow.up.circle",
      what: near && commit.messageHeadline ? commit.messageHeadline : `${branch.name || ""} に push`.trim(),
      repo: node.name,
      at: node.pushedAt,
    };
  });
}

/** 行動をまとめて、時刻の新しい順に n 件（events は時刻の順に返ってこないので、ここで並べる） */
function latestEvents_(lists, n) {
  return [].concat(...lists).filter((event) => event && event.at).sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, n);
}

/** 草の日（古い日から）→ { days, total }。days は { date, count, level(0〜4) } */
function calendarDays_(json) {
  const viewer = json && json.data && json.data.viewer;
  const calendar = viewer && viewer.contributionsCollection && viewer.contributionsCollection.contributionCalendar;
  if (!calendar) return { login: viewer ? viewer.login : null, days: [], total: null };
  const days = [];
  (calendar.weeks || []).forEach((week) => (week.contributionDays || []).forEach((day) => {
    days.push({ date: day.date, count: Number(day.contributionCount) || 0, level: Math.max(0, LEVELS.indexOf(day.contributionLevel)) });
  }));
  days.sort((a, b) => a.date.localeCompare(b.date));
  return { login: viewer.login, days, total: typeof calendar.totalContributions === "number" ? calendar.totalContributions : null };
}

/**
 * 続いた日数。きょうに1つ以上あればきょうから、まだなければきのうから数える
 * （きょうまだでも、きのうまで続いていれば日数は消えない）
 */
function streakOf_(days, today) {
  const byDate = new Map(days.map((d) => [d.date, d.count]));
  const cursor = new Date(`${today}T12:00:00`);
  if (!(byDate.get(today) > 0)) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  for (;;) {
    const key = ymd_(cursor);
    if (!(byDate.get(key) > 0)) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/** リポジトリの名前。自分のリポジトリなら持ち主を省く（octo/my-app → my-app） */
function repoName_(full, login) {
  const name = String(full || "");
  return login && name.toLowerCase().startsWith(`${login.toLowerCase()}/`) ? name.slice(login.length + 1) : name;
}

/**
 * 行動1件 → { icon, what, repo, at }（出さない種類は null）。
 * 種類は GitHub の events の type。what は「main に3つ push」のような短い文
 */
function describeEvent_(event, login) {
  const p = event.payload || {};
  const repo = repoName_(event.repo && event.repo.name, login);
  const at = event.created_at;
  const branch = String(p.ref || "").replace(/^refs\/heads\//, "");
  const pick = (icon, what) => ({ icon, what, repo, at });
  switch (event.type) {
    case "PushEvent": {
      const n = typeof p.size === "number" ? p.size : (p.commits || []).length;
      return pick("arrow.up.circle", `${branch || "ブランチ"} に${n > 1 ? `${n}つ` : ""} push`);
    }
    case "PullRequestEvent": {
      const num = p.number || (p.pull_request && p.pull_request.number);
      if (p.action === "closed") return pick("arrow.triangle.merge", p.pull_request && p.pull_request.merged ? `PR #${num} をマージ` : `PR #${num} を閉じた`);
      if (p.action === "opened" || p.action === "reopened") return pick("arrow.triangle.pull", `PR #${num} を作成`);
      return null;
    }
    case "PullRequestReviewEvent":
      return pick("checkmark.bubble", `PR #${p.pull_request && p.pull_request.number} をレビュー`);
    case "IssuesEvent": {
      const num = p.issue && p.issue.number;
      if (p.action === "opened") return pick("exclamationmark.circle", `Issue #${num} を作成`);
      if (p.action === "closed") return pick("checkmark.circle", `Issue #${num} を閉じた`);
      return null;
    }
    case "IssueCommentEvent":
      return pick("text.bubble", `#${p.issue && p.issue.number} にコメント`);
    case "CreateEvent":
      if (p.ref_type === "repository") return pick("plus.circle", "リポジトリを作成");
      if (p.ref_type === "branch") return pick("arrow.triangle.branch", `ブランチ ${p.ref} を作成`);
      if (p.ref_type === "tag") return pick("tag", `タグ ${p.ref} を作成`);
      return null;
    case "ReleaseEvent":
      return pick("tag", `リリース ${(p.release && (p.release.tag_name || p.release.name)) || ""} を公開`.replace("  ", " "));
    case "WatchEvent":
      return pick("star", "スター");
    case "ForkEvent":
      return pick("tuningfork", "フォーク");
    case "PublicEvent":
      return pick("globe", "公開にした");
    default:
      return null;
  }
}

/**
 * いまの GitHub のようす。草（ここ1年）と最新の行動を同時に読む。
 * どれも読めなければ、前に読めた値を stale つきで返す（なければ null）
 */
async function readGitHub(now = new Date()) {
  const from = new Date(now.getTime() - 365 * 86400000);
  const calendar = await readOne_(() => apiCall_("/graphql", { query: CALENDAR_QUERY, variables: { from: from.toISOString(), to: now.toISOString() } }));
  const { login, days, total } = calendar.json ? calendarDays_(calendar.json) : { login: null, days: [], total: null };
  // 行動の一覧はユーザー名がいる（草の答えの viewer.login。読めなければ前の値の名前）
  const cached = readCache_();
  const who = login || (cached && cached.login) || null;
  const [repos, events] = await Promise.all([
    readOne_(() => apiCall_("/graphql", { query: REPOS_QUERY })),
    who ? readOne_(() => apiCall_(`/users/${encodeURIComponent(who)}/events?per_page=30`)) : Promise.resolve({ error: "no login" }),
  ]);
  if (!calendar.json && !repos.json && !events.json) {
    return cached ? Object.assign({}, cached, { stale: true }) : null;
  }
  const today = ymd_(now);
  const todayRow = days.find((d) => d.date === today);
  const view = {
    login: who,
    days: days.length ? days : (cached && cached.days) || [],
    total: total ?? (cached ? cached.total : null),
    today: todayRow ? todayRow.count : days.length ? 0 : null,
    streak: days.length ? streakOf_(days, today) : cached ? cached.streak : null,
    // push は最後に push したリポジトリから（新しい）、PR・Issue・スターなどは行動の一覧から
    events: repos.json || Array.isArray(events.json)
      ? latestEvents_([
        pushesOf_(repos.json),
        (Array.isArray(events.json) ? events.json : []).filter((event) => !repos.json || event.type !== "PushEvent").map((event) => describeEvent_(event, who)),
      ], GH.EVENTS)
      : (cached && cached.events) || [],
    sync: `${monthDayOf_(now)} ${clockOf_(now)}`,
    syncAt: now.toISOString(),
  };
  writeCache_(view);
  return view;
}

/** 1つ読む（読めなければ { error }。トークンのまちがいは投げる） */
async function readOne_(load) {
  try {
    return { json: await load() };
  } catch (error) {
    if (error instanceof SetupError) throw error;
    return { error: String((error && error.message) || error) };
  }
}

/** この端末の SQriptableGitHub/ のファイル（cache.json＝前に読めた値、last-try.json＝アプリで前回試した大きさ） */
function store_(name = "cache.json") {
  const fm = FileManager.local();
  const dir = fm.joinPath(fm.documentsDirectory(), GH.DIR);
  if (!fm.fileExists(dir)) fm.createDirectory(dir, true);
  return { fm, file: fm.joinPath(dir, name) };
}

function readCache_() {
  const { fm, file } = store_();
  try {
    return fm.fileExists(file) ? JSON.parse(fm.readString(file)) : null;
  } catch (error) {
    return null;
  }
}

function writeCache_(value) {
  const { fm, file } = store_();
  try {
    fm.writeString(file, JSON.stringify(value));
  } catch (error) {
    // 残せなくても表示は続ける
  }
}

// ======================================
// ウィジェット
// ======================================

async function buildWidget(family) {
  currentFamily = family;
  if (!readToken_()) return messageWidget_("🔑 アプリで開いて、GitHub のトークンを入れてね");
  let view;
  try {
    view = await readGitHub(new Date());
  } catch (error) {
    if (error instanceof SetupError) return messageWidget_(`🔑 ${error.message}`);
    throw error;
  }
  if (!view) return messageWidget_("GitHub が読めませんでした。少しあとで、もう一度");
  const widget = family.startsWith("accessory") ? renderAccessory_(view, family) : renderHome_(view, family);
  if (view.login) widget.url = `https://github.com/${encodeURIComponent(view.login)}`;
  widget.refreshAfterDate = new Date(Date.now() + GH.REFRESH_MIN * 60 * 1000);
  return widget;
}

function messageWidget_(text) {
  const widget = new ListWidget();
  if (isAccessory_()) {
    addText(widget, text, { size: 11, lineLimit: 3, minScale: 0.6 });
    return widget;
  }
  widget.backgroundColor = themeColor_("bg");
  addText(widget, "GitHub", { font: "bold", size: 13, lineLimit: 1 });
  widget.addSpacer(6);
  addText(widget, text, { size: 12, color: "light", lineLimit: 4, minScale: 0.7 });
  widget.addSpacer();
  return widget;
}

/**
 * 草を描く。いちばん右の列がきょうの週（日曜はじまり。GitHub と同じ並び）、上から日〜土。
 * weeks 週ぶん、1マス cell・すきま gap。monthLabels で上に月の名前
 */
function addGrass_(parent, days, weeks, cell, gap, options = {}) {
  // 古い日から並んでいるので、最後の週から weeks 週ぶん。週は日曜で区切る
  const columns = [];
  let column = [];
  days.forEach((day) => {
    const dow = new Date(`${day.date}T12:00:00`).getDay();
    if (dow === 0 && column.length) {
      columns.push(column);
      column = [];
    }
    column.push(Object.assign({ dow }, day));
  });
  if (column.length) columns.push(column);
  const shown = columns.slice(-weeks);

  const wrap = parent.addStack();
  wrap.layoutVertically();
  if (options.monthLabels) {
    // 月の名前：その月の1週目の列の上に「11月」
    const labels = wrap.addStack();
    labels.size = new Size(shown.length * (cell + gap) - gap, 10);
    let lastMonth = null;
    let used = 0;
    shown.forEach((col, i) => {
      const month = Number(col[0].date.slice(5, 7));
      // はみ出す所（右はし）には置かない
      if (month !== lastMonth && i * (cell + gap) >= used && i * (cell + gap) + 20 <= shown.length * (cell + gap) - gap) {
        if (i * (cell + gap) > used) labels.addSpacer(i * (cell + gap) - used);
        const box = labels.addStack();
        box.size = new Size(20, 10);
        addText(box, `${month}月`, { size: 8, color: "light", lineLimit: 1 });
        used = i * (cell + gap) + 20;
      }
      lastMonth = month;
    });
    labels.addSpacer();
    wrap.addSpacer(3);
  }
  const grid = wrap.addStack();
  grid.layoutHorizontally();
  grid.topAlignContent();
  shown.forEach((col, i) => {
    if (i > 0) grid.addSpacer(gap);
    const stack = grid.addStack();
    stack.layoutVertically();
    // 週のはじめの列（いちばん古い週）は、日曜からでないことがあるので上をあける
    const first = col[0].dow;
    if (first > 0) stack.addSpacer(first * (cell + gap));
    col.forEach((day, j) => {
      if (j > 0) stack.addSpacer(gap);
      const box = stack.addStack();
      box.size = new Size(cell, cell);
      box.cornerRadius = Math.max(1, Math.round(cell * 0.22));
      box.backgroundColor = grassColor_(day.level);
    });
  });
  return wrap;
}

/** 幅 width に入る週の数（1マス cell・すきま gap。多くても 53 週） */
function weeksFor_(width, cell, gap) {
  return Math.max(1, Math.min(53, Math.floor((width + gap) / (cell + gap))));
}

/** 「アイコン 文字」の1行（行動の1件、続いた日数など） */
function addIconLine_(parent, icon, text, size, options = {}) {
  const line = parent.addStack();
  line.centerAlignContent();
  if (addIcon_(line, icon, size)) line.addSpacer(4);
  addText(line, text, Object.assign({ size, lineLimit: 1, minScale: 0.7 }, options));
  return line;
}

/**
 * ホーム画面（小・中・大）。上から
 *   GitHub と、右上に取った時刻／（小・大）きょう・続いた日数／草／（中・大）最新の行動3件
 */
function renderHome_(view, family) {
  const widget = new ListWidget();
  widget.backgroundColor = themeColor_("bg");
  const compact = family === "small";
  const large = family === "large";
  // 中は高さが足りないので、上下を少し詰める
  const pad = compact || family === "medium" ? 12 : 14;
  widget.setPadding(pad, pad, pad, pad);
  const inner = widgetSize_(family).w - pad * 2;

  // 見出し：GitHub（大は名前も）と、取った時刻
  const top = widget.addStack();
  top.centerAlignContent();
  addText(top, "GitHub", { font: "bold", size: compact ? 13 : 15, lineLimit: 1 });
  if (!compact && view.login) {
    top.addSpacer(6);
    addText(top, view.login, { size: 11, color: "light", lineLimit: 1, minScale: 0.7 });
  }
  top.addSpacer();
  const time = compact ? view.sync.replace(/^\d+\/\d+\s*/, "") : `取得 ${view.sync}`;
  addText(top, view.stale ? `${time}（前の値）` : time, { size: compact ? 8 : 9, color: "light", lineLimit: 1, minScale: 0.7 });

  const todayText = view.today === null || view.today === undefined ? "-" : view.today.toLocaleString();
  const streakText = typeof view.streak === "number" ? `${view.streak}日` : "-";

  if (compact) {
    // 小：大きなきょうの数と、続いた日数。下に草
    // 小の高さ（中身は約134pt）：見出し 16・数字 36・草 68 に、あいだの余白
    widget.addSpacer(4);
    const nums = widget.addStack();
    nums.bottomAlignContent();
    // 幅を決めた2つの枠（決めないと、見出しの字が押しつぶされる）
    const half = Math.floor(inner / 2);
    const today = nums.addStack();
    today.layoutVertically();
    today.size = new Size(half, 0);
    addIconLine_(today, "leaf", "きょう", 9, { color: "light" });
    addText(today, todayText, { font: "bold", size: 20, lineLimit: 1, minScale: 0.6 });
    const streak = nums.addStack();
    streak.layoutVertically();
    streak.size = new Size(inner - half, 0);
    addIconLine_(streak, "flame", "続いた日", 9, { color: "light" });
    addText(streak, streakText, { font: "bold", size: 20, lineLimit: 1, minScale: 0.6 });
    widget.addSpacer();
    const cell = 8;
    const gap = 2;
    addGrass_(widget, view.days, weeksFor_(inner, cell, gap), cell, gap);
    return widget;
  }

  if (large) {
    // 大：きょう・続いた日数・この1年を横に
    widget.addSpacer(10);
    const stats = widget.addStack();
    stats.centerAlignContent();
    const stat = (icon, label, value) => {
      const box = stats.addStack();
      box.layoutVertically();
      box.size = new Size(Math.floor(inner / 3), 0);
      addIconLine_(box, icon, label, 10, { color: "light" });
      box.addSpacer(2);
      addText(box, value, { font: "bold", size: 20, lineLimit: 1, minScale: 0.6 });
    };
    stat("leaf", "きょう", todayText);
    stat("flame", "続いた日", streakText);
    stat("calendar", "この1年", typeof view.total === "number" ? view.total.toLocaleString() : "-");
    widget.addSpacer(12);
    const cell = 12;
    const gap = 2;
    addGrass_(widget, view.days, weeksFor_(inner, cell, gap), cell, gap, { monthLabels: true });
    widget.addSpacer(12);
    renderEvents_(widget, view, inner, true);
    widget.addSpacer();
    return widget;
  }

  // 中：草と、最新の行動3件（中身の高さは約134pt：見出し 18・草 47・行動 3行 × 16 に、あいだの余白）
  widget.addSpacer(6);
  const cell = 5;
  const gap = 2;
  addGrass_(widget, view.days, weeksFor_(inner, cell, gap), cell, gap);
  widget.addSpacer(4);
  renderEvents_(widget, view, inner, false);
  widget.addSpacer();
  return widget;
}

/**
 * 最新の行動。1件1行「アイコン 何をした · リポジトリ」と、右に時刻。
 * 大（two）は2行：1行目に何をした、2行目にリポジトリと時刻
 */
function renderEvents_(widget, view, inner, two) {
  const events = view.events || [];
  if (!events.length) {
    addText(widget, "最近の行動はまだありません", { size: 10, color: "light", lineLimit: 1 });
    return;
  }
  const now = view.syncAt ? new Date(view.syncAt) : new Date();
  const timeW = two ? 0 : 64;
  const iconSize = two ? 13 : 10;
  // アイコンは幅を決めた枠に入れる（絵の幅がちがっても、文の始まりがそろう）
  const iconW = Math.round(iconSize * 1.5);
  events.forEach((event, i) => {
    if (i > 0) widget.addSpacer(two ? 8 : 2);
    const row = widget.addStack();
    row.centerAlignContent();
    row.size = new Size(inner, 0);
    const icon = row.addStack();
    icon.size = new Size(iconW, iconSize + 4);
    icon.centerAlignContent();
    // 伸びる余白は入れない（最低 8pt あり、枠が狭くなって絵が切れる）
    addIcon_(icon, event.icon, iconSize);
    row.addSpacer(4);
    const textW = inner - iconW - 4 - (two ? 0 : timeW + 4);
    if (two) {
      const col = row.addStack();
      col.layoutVertically();
      col.size = new Size(textW, 0);
      addText(col, event.what, { font: "semibold", size: 12, lineLimit: 1, minScale: 0.7 });
      addText(col, `${event.repo} · ${whenText_(event.at, now)}`, { size: 10, color: "light", lineLimit: 1, minScale: 0.7 });
      row.addSpacer();
      return;
    }
    // リポジトリ（太字）を先に、何をした（コミットのメッセージは長いので、はみ出たら「…」）をあとに
    // リポジトリは字の数から幅を決めた枠に入れる（決めないと、長いメッセージに押されて「sqripta…」になる）。
    // 英数字は字の大きさの約0.62倍、日本語は約1倍の幅。広くても半分まで
    const text = row.addStack();
    text.centerAlignContent();
    text.size = new Size(textW, 0);
    const repoW = Math.min(Math.round(textW * 0.5), Math.ceil([...String(event.repo)].reduce((w, ch) => w + (ch.charCodeAt(0) < 0x2000 ? 6.4 : 10.4), 0)) + 2);
    const repo = text.addStack();
    repo.size = new Size(repoW, 0);
    addText(repo, event.repo, { font: "semibold", size: 10, lineLimit: 1, minScale: 0.7 });
    text.addSpacer(6);
    const what = text.addStack();
    what.size = new Size(Math.max(1, textW - repoW - 6), 0);
    addText(what, event.what, { size: 10, color: "light", lineLimit: 1 });
    row.addSpacer(4);
    // 時刻は幅を決めた右の列（どの行でも同じ位置）
    const at = row.addStack();
    at.size = new Size(timeW, 0);
    at.addSpacer();
    addText(at, whenText_(event.at, now), { size: 9, color: "light", lineLimit: 1, minScale: 0.7 });
  });
}

/** ロック画面：1行は「🌱5 🔥12日」、丸はきょうの数、長方形は短い草と続いた日数 */
function renderAccessory_(view, family) {
  const widget = new ListWidget();
  const todayText = view.today === null || view.today === undefined ? "-" : String(view.today);
  const streakText = typeof view.streak === "number" ? `${view.streak}日` : "-";
  if (family === "accessoryInline") {
    widget.addText(`🌱${todayText} 🔥${streakText}`);
    return widget;
  }
  widget.setPadding(0, 0, 0, 0);
  if (family === "accessoryCircular") {
    widget.addSpacer();
    const row = widget.addStack();
    row.addSpacer();
    addText(row, todayText, { font: "bold", size: 22, lineLimit: 1, minScale: 0.6 });
    row.addSpacer();
    const label = widget.addStack();
    label.addSpacer();
    addText(label, `🔥${streakText}`, { size: 10, lineLimit: 1, minScale: 0.6 });
    label.addSpacer();
    widget.addSpacer();
    return widget;
  }
  const box = widgetSize_("accessoryRectangular");
  const head = widget.addStack();
  head.centerAlignContent();
  addText(head, `🌱 ${todayText}`, { font: "bold", size: 12, lineLimit: 1 });
  head.addSpacer();
  addText(head, `🔥${streakText}`, { size: 11, lineLimit: 1 });
  widget.addSpacer(3);
  // 高さ（約72pt）：見出し 15・草 7 × 4 + 6 × 2 = 40
  const cell = 4;
  const gap = 2;
  addGrass_(widget, view.days, weeksFor_(box.w - 4, cell, gap), cell, gap);
  return widget;
}

// ======================================
// アプリで開いたとき：トークン・ウィジェットを見る
// ======================================

async function say_(title, message) {
  const alert = new Alert();
  alert.title = title;
  alert.message = message || "";
  alert.addAction("OK");
  await alert.presentAlert();
}

const TRY_FAMILIES = [
  ["小", "small", "presentSmall"],
  ["中", "medium", "presentMedium"],
  ["大", "large", "presentLarge"],
  ["ロック画面（丸）", "accessoryCircular", "presentAccessoryCircular"],
  ["ロック画面（長方形）", "accessoryRectangular", "presentAccessoryRectangular"],
  ["ロック画面（1行）", "accessoryInline", "presentAccessoryInline"],
];

async function appMenu() {
  for (;;) {
    const alert = new Alert();
    alert.title = "🌱 SQriptable GitHub";
    alert.message = readToken_() ? "🔑 トークンは入っています" : "🔑 まだトークンがありません";
    alert.addAction(readToken_() ? "🔑 トークンを入れなおす" : "🔑 トークンを入れる");
    TRY_FAMILIES.forEach(([label]) => alert.addAction(`👀 ${label}で見る`));
    alert.addCancelAction("閉じる");
    const index = await alert.presentSheet();
    if (index < 0) return;
    if (index === 0) {
      await setToken_();
      continue;
    }
    const [, family, present] = TRY_FAMILIES[index - 1];
    const widget = await buildWidget(family);
    await widget[present]();
  }
}

/** トークンを Keychain にしまい、つながるか確かめる（viewer の login を読む） */
async function setToken_() {
  const alert = new Alert();
  alert.title = "🔑 GitHub のトークン";
  alert.message = "GitHub の Settings → Developer settings → Personal access tokens で作ったトークン。この iPhone の Keychain にだけしまいます";
  alert.addSecureTextField("トークン", "");
  alert.addAction("しまう");
  alert.addCancelAction("やめる");
  if ((await alert.presentAlert()) < 0) return;
  const token = String(alert.textFieldValue(0) || "").trim();
  if (!token) {
    await say_("入っていません", "トークンを入れてね");
    return;
  }
  Keychain.set(GH.KEY_TOKEN, token);
  try {
    const json = await apiCall_("/graphql", { query: "query { viewer { login } }" });
    await say_("✅ つながりました", `${json.data.viewer.login} の草を出します`);
  } catch (error) {
    await say_("つながりませんでした", error.message);
  }
}

// ======================================
// 入口
// ======================================

async function main() {
  if (config.runsInWidget || config.runsInAccessoryWidget) {
    Script.setWidget(await buildWidget(config.widgetFamily || "medium"));
  } else if (config.runsInApp) {
    await appMenu();
  }
  Script.complete();
}

await main();
