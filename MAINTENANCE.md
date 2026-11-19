# VocabLens 词镜 · 云端维护手册

维护基线：**2026-11-19**。本文档是唯一权威的发布流程说明，改站点前先读它。

## 线上状态

| 项目 | 值 |
| --- | --- |
| **公开地址（唯一现行）** | **https://x-sky.github.io/vocablens/** |
| 托管方式 | GitHub Pages，仓库 https://github.com/X-sky/vocablens （public），分支 `gh-pages`，分支根目录即站点根 |
| 词库规模 | 40 组 / 129 词条 / 29 个语义分类 |
| 平台镜像（备用） | https://q3yd8d39dmqgh.space.mcode.cn ，Drive 节点 `464999192441336` |

> ✅ **地址永久固定**：站点托管在 GitHub Pages，以后每次维护都是往同一个 `gh-pages` 分支推代码，
> 网址不动，别人收藏的链接不会失效。相对路径引用，放在 `/vocablens/` 子路径下正常工作。
>
> ⚠️ **不要用平台部署当主线**：`website_deploy` 每次调用都会新建节点并新铸域名，
> `project_name` 相同也不会原地更新（2026-11-19 连续两次部署实测得到两个不同域名）。
> 工具层没有「更新已有站点」也没有「绑定自定义域名」的能力。
> 平台站只当备用镜像用；真用了必须把新地址同步到本文档、`README.md`、skill 参考文档与记忆。
>
> 旧版 https://8iorbardnid05.space.mcode.cn 已于 2026-11-19 删除 Drive 节点，现为 404。

## 目录结构

```
vocablens/
├── index.html        入口：模板结构（其余为平台注入物，见下）
├── fonts.css         自托管 Newsreader（base64 内嵌 woff2，~45 KB）
├── styles.css        全部样式（约 34 KB，含深浅色主题与响应式断点）
├── app.js            全部交互逻辑（含共核引擎），IIFE 包裹，无构建步骤
├── data/groups.js    词库，导出 window.GROUPS 数组
├── README.md         站点说明
└── MAINTENANCE.md    本文件
```

技术约束：**纯静态、零构建、零依赖**。`index.html` 在根目录，`assets` 为相对路径引用。
因此整个目录可直接丢到任何静态托管，无需 npm / 打包。

## 设计系统 v3：光学台 Optical Bench（2026-11-19 起）

v2「纸与墨」已被整体替换。**v2 的问题不是难看，是撞脸** —— 暖米纸 + 高对比衬线 + 陶土红 + 发丝线，
正是 AI 设计最常见的三件套，辨识度为零。v3 换掉了温度（暖→冷）、换掉了强调色（朱砂→镜片青）、
并且给站点找到了一个**属于它自己的视觉论点**。

### 核心隐喻

词镜是一台**量词义的仪器**：台面是冷调中性灰，刻线是发丝线，全场只有一种彩色，
而它只出现在一个地方 —— **共核**（两个近义词真正共享的那部分）。
共享处，正是最容易混淆的地方 —— 这就是整个产品的价值，视觉系统直接把它讲出来。

### 三条铁律

1. **颜色服务语义，不服务装饰**。全站只有两种彩色：
   - `--accent` 镜片青（light `#0e6a73` / dark `#5cb8c0`）= **共核 / 正确 / 当前选中 / 品牌标记**；
   - `--clay` 陶土红（light `#a8453a` / dark `#d68c7a`）= **错误 / 易踩坑**。
   其余全是墨与灰（`--ink` / `--ink-2` / `--ink-3` / `--rule` / `--rule-2`）。
   分类**不再用颜色区分**（`--cat-h` 仍写在 DOM 上，样式不消费它）。
   想加第三种彩色之前，先问它是不是在表达语义。
2. **三档声音**：
   - `--font-display`（Newsreader）= 英文词头 / 例句 / 数字 —— 内容是文学性的；
   - `--font-han`（Songti SC → Noto Serif CJK SC）= 中文标题 —— 与衬线同族；
   - `--font-sans`（系统无衬线）= 正文 / UI / 按钮 —— 框架是技术性的；
   - `--font-mono`（等宽）= 微型标签（分类、序号、计数）—— 仪器上的刻字。
   英文词头与中文正文**刻意不同族**：词是主角，中文是注解。
3. **靠线条和留白分结构**。卡片**无边框无底色**，只用一条顶部发丝线分栏；直角或 2–10px 小圆角；
   阴影只做极浅投影。**禁止**：渐变、玻璃拟态（backdrop-filter）、发光阴影、彩色光斑、
   噪点、超大圆角胶囊、装饰性插画。

### 关键色板

| 令牌 | 含义 | light | dark |
| --- | --- | --- | --- |
| `--bg-base` | 台面底色 | `#f0f1ef` | `#14171a` |
| `--bg-raised` | 抬起的面（卡片/弹层） | `#fafaf9` | `#1c2024` |
| `--bg-sunk` | 凹陷面（选项底、译文块） | `#e6e8e5` | `#0f1214` |
| `--ink` / `--ink-2` / `--ink-3` | 墨三级 | `#15181b` / `#565c61` / `#8a9096` | 反色 |
| `--rule` / `--rule-2` | 发丝线 | `#e0e2df` / `#c2c6c2` | 透明白 13% / 26% |
| `--accent` | 镜片青（唯一彩色） | `#0e6a73` | `#5cb8c0` |
| `--clay` | 陶土红（错误 / 坑） | `#a8453a` | `#d68c7a` |

主题默认 **light**（`app.js` 里 `load('vocablens.theme', 'light')`）；老用户 localStorage 存着 dark 的沿用暗色。

### 内容定性：分歧点类型 `groupType`（2026-11-19 起）

用户提出的内容硬伤：**「有些近义词如果只有词性差别，那是不是不应该归类为近义词？」** —— 是的。
所以站点总称从「近义词」改为「**易混词**」，并给每一组标出分歧点：

| `groupType` | 含义 | 组数 | 卡片徽标 |
| --- | --- | --- | --- |
| `sense` | 意思相近，差别在用法与场合 | 32 | 不显示（默认安静） |
| `root` | 同一词根，词性不同 | 5 | 同根 · 词性不同 |
| `form` | 写法几乎一样，意思却不同 | 3 | 形近 · 意思不同 |

非同类的 8 组：`extinct/exterminate`、`impetus/motivation/motivate`、`scrutiny/scrutinise`、
`affect/effect`、`economic/economical/economy`（root）；`lie/lay`、`few/a few/little/a little`、
`used to/be used to/be accustomed to`（form）。

- 字段在 `data/groups.js` 的每个组对象里，位置紧跟 `id`。
- `library.mjs` 已支持：`patch` 可改 `groupType`，`validate` 会校验取值（缺失给警告）。
- UI：`app.js` 的 `TYPE_META` 定义类型文案；卡片上**只给非同类的组挂徽标**，
  详情面板顶部给一行「分歧点」说明。**别把 `sense` 也挂出来** —— 默认安静，非同类才提示。
- 典型陷阱：`root` 组里 `impetus` 与 `motivation` 其实还是意思相近（真正同根的是
  motivation/motivate），`economic/economical/economy` 也混了两种关系 —— 所以这类组的
  说明写成「**这组里关键的一对**出自同一个词根」，不要断言「这几个词都同根」。
- 改类型前先想清楚：这组是「意思差」还是「用不了」。用不了就 `root`/`form`，别硬塞成近义词。

### 签名元素：共核（`app.js` 的共核引擎）

这是 v3 的灵魂，也是站点唯一「别人抄不走」的东西。它**从真实数据算出来**，不是装饰。

- **英文共核**：两词共享 ≥4 个字母的词素，且贴在其中至少一个词的**词首或词尾**
  （如 institute / institution → `institut`；objective / subjective → `bjective`）。
- **中文义核**：两词「核心义」共享 ≥2 字，且在双方释义里都**贴边**
  （是完整词段，或贴着某词段的首/尾）—— 这样才不会跨词误配出「来的财」这种碎片。
- **只认差异性共核**：如果某个片段全组都有（组内 ≥3 词时），它属于共性不是差异，不标。
- 保守优先：宁可漏标，不可误标。当前 40 组中 **22 组**有共核，其余 18 组没有 —— 不要为了「看起来有」而放宽规则。
- 引擎在 `app.js`（`groupCores` / `enCore` / `zhCore` / `markWord` / `markMeaning` / `coreStrip`），
  **不要手改**。改规则前先跑 `/workspace/.work/audit_cores.py`（需先起本地服务）核对输出。

呈现位置：
- 卡片词头 → 共享词素标青 + 下划线（`<span class="core">`），卡片页脚有「共核 xxx」提示；
- 详情面板顶部 → **共核条**（`.core-strip` + `.core-chip`）列出本组全部共核并解释含义；
- 速查对照表 / 逐词详解 → 中文义核标青。

### 文案规范：写人话，不写 AI 腔

用户在 v3 明确提过一条要求：**「如果让别人来看，这些标语之类的像不像人类写的」**。
改任何用户可见文字前，照下面五条自问一遍。

1. **这是人说的话吗？** 真人写文案会具体、会口语、会留白；AI 写文案爱排比、爱对仗、爱下结论。
2. **禁句式**（这些是 AI 文案的指纹，出现即改）：
   - 「把 A 变成 B」式口号 —— 例：~~把「意思差不多」变成「用得出来」~~ → 改成「两个词都认识，就是用不对」
   - 带引号的伪口语 —— 例：~~「意思差不多」~~，引号里若是口语就该直接说
   - 「更…地…」「…让你…」这类讲好处不讲事实的句子 —— 例：~~更清晰地理解相近词~~ → 改成「查一个词，看它和谁容易混」
   - 强调词堆砌：「真正」「恰好」「轻松」「立即」「彻底」
   - 全称承诺：「每个…都…」
   - 同一句话在页面里重复讲三遍（v3 里「共享处最容易混淆」曾出现三次，只留一处）
3. **宁可短，不要全**：导语写一件事就够，别把 5 个功能罗列成一句话。
   例：~~每个词组给出核心义、语感差异、真实例句、选词提示与易踩坑提醒~~ → 「每组词写清核心义、语感差别和真实例句」
4. **说事实，不说口号**：能换成具体信息就别抒情。「答完立刻给解析」比「用选择题检验理解」有用。
5. **同一概念用同一个词**：全站统一叫「语感差别」（表格列、导语、词条卡），
   不要一会儿「细微差别」一会儿「语感差异」。

**已经定稿的用语**（改之前先想清楚要不要动）：

| 位置 | 用语 |
| --- | --- |
| 品牌标语 | 词镜 · 看清词的边界 |
| 首屏大标题 | 两个词都认识，就是用不对 |
| 首屏导语 | 每组词写清核心义、语感差别和真实例句，并把两个词共用的那部分直接标在词上。 |
| 共核条说明 | 青色标出的是这几个词共用的部分。 |
| 标本说明 | 两个词共用的部分，也是最容易混的地方。 |
| 侧栏副标题 | 查一个词，看它和谁容易混 / 按语义领域逐组查看 / 翻卡记忆 · 标记掌握 / 做完立刻给解析 / 存下来的易混词 |

**数据层文案**（`data/groups.js` 的 summary / choiceTip / pitfall / nuance）也按同一标准审：
写具体的事实与真实坑点，不写「有助于…」「提升…」。历史遗留的**编辑备注泄漏**已清两处
（track down 的「因此不放入这个单词组中」、ancestry 的「本组不必展开」）——
以后新增词条时注意：**不要把词库维护说明写进 pitfall**，那是给编辑看的，不是给用户看的。

### 结构约定（改 CSS 前必读）

- 桌面端顶栏：品牌 / 搜索 / 操作 三段 + 分类图例另起一行。搜索框是**下划线式**（只有下边框）。
- 分类标签是**等宽图例**（`.chip` + `.cnt`），不是胶囊；选中态是底部 2px 青色下划线。
- 侧栏选中态是**左侧 2px 青色竖条**；侧栏宽 `--sidebar-w: 228px`。
- 卡片网格：≥760px 两列 `repeat(2, minmax(0, 1fr))`，窄屏 `minmax(0, 1fr)`。
  轨道**必须**写 `minmax(0, 1fr)`，写 `1fr` 会被内容撑爆导致横向溢出。
- 词头列表（`.gc-words` / `.study-words` / `#sheetTitle`）是 **flex 逐词换行**：
  词与词之间没有空格，若不用 flex，浏览器会把 `academy/institute/...` 当成一个不可断的长词硬断。
- `:where(.content) > *` 用 `:where()` 归零，是为了让内层视图（`.quiz-wrap` 680px / `.study-wrap` 720px）
  的 `max-width` 能压过内容区规则。**别改成普通 `.content > *`**，否则测验/学习页会被撑成全宽。
- `app.js` 内联用了 `var(--on-surface-2)` / `var(--on-surface-3)`，改令牌时**保留这两个别名**。
- 移动端窄屏（<600px）速查对照表会改成**堆叠块**（`.matrix td` 转 block + `::before` 前置标签）。

### 字体：Newsreader 自托管

- 文件：`fonts.css`（**新增文件，发布时必须一起推**），里面是 base64 内嵌的 woff2。
- 字源：Newsreader（Production Type, SIL OFL 1.1），可变字重 wght 200–800，仅内嵌 Latin 子集，~34KB。
- **为什么内联而不是走 CDN**：Google Fonts / jsDelivr 在国内都不稳；内联后运行时零外部请求，
  离线也能正确渲染。改字体时重新生成：
  ```bash
  # 取 Latin 子集 woff2
  curl -sL -A "Mozilla/5.0" "https://fonts.googleapis.com/css2?family=Newsreader:wght@400;600&display=swap&text=<ASCII+标点>" -o gf.css
  # 从 gf.css 里取出 woff2 URL 下载，再 base64 写进 fonts.css 的 @font-face
  ```
- 回退栈已配好：Newsreader → Iowan Old Style → Palatino → Georgia，中文宋体同理。

### 品牌标记

`index.html` 里的 logo 是**两个交叠的圆**，交叠处填青 —— 几何上这个交叠区就叫「透镜」（vesica），
既是「词镜」的名字，也是「共核」的图示。换色靠 `fill="var(--accent)"` + `stroke="currentColor"`，
所以明暗主题自动适配。favicon 是同款图形写死的 hex 版。

## 发布流程

1. **改**：`/workspace/vocablens/` 下的文件
2. **验**：本地起服务 → Playwright 截图 + 控制台零报错

   ```bash
   cd /workspace/vocablens && python3 -m http.server 8899
   # 浏览器：/root/.cache/ms-playwright/chromium-1243/chrome-linux/chrome
   # 本沙箱的 playwright 只缺 headless shell，必须显式传 executable_path
   ```

3. **发**：推 GitHub `gh-pages` 分支（主线，地址不变）

   ```bash
   # 组装 files 数组并推送
   mcode-tools connector call connector__github__push_files --args-file /workspace/.tmp-push.json
   # args.json = {owner:"X-sky", repo:"vocablens", branch:"gh-pages", message, files:[{path, content}]}
   # files 必须含：index.html / fonts.css / styles.css / app.js / data/groups.js / README.md / MAINTENANCE.md / .nojekyll
   ```

   ⚠️ 推送 = 把站点发布到**公网**，任何人拿到链接都能访问。发布前必须先向用户说明并取得确认。

   ⚠️ `.nojekyll` 必须保留，否则 Pages 会走 Jekyll 处理流程。

4. **核**：等约 1 分钟让 Pages 构建，然后

   ```bash
   curl -sSL -o /dev/null -w "%{http_code}\n" https://x-sky.github.io/vocablens/
   ```

   再用 Playwright 打开该地址，确认词库条数与本地一致、新词搜得到、弹层详情正常、
   5 个视图可点、控制台零报错。刚推完时可能有几十秒传播延迟（短暂 404）。

5. **备**：平台镜像（`website_deploy`）只在用户明确要求时用；它会新铸域名，
   用了就得把新 URL 与新节点 ID 同步到本文件、`README.md`、skill 的 `references/site-ops.md`
   与 agent memory 的 `vocablens-maintenance` 主题，并把旧节点在 Drive 里改名为「（旧版·已冻结）」。

   注：删除 Drive 节点会让该站点的已发布 URL **直接 404 下线**（2026-11-19 实测，删除后可能有几秒到几十秒的
   缓存延迟）。所以想下线某个旧站，删掉它的 Drive 节点即可，不必改代码。

## ⚠️ 平台注入物：不要写进源文件

部署时平台会往 `index.html` 尾部注入两段代码：

- `<div id="minimax-floating-ball">` + 配套 `<style>` / `<script>` —— 悬浮球挂件
- `<script data-minimax-analytics="minimax-website-analytics-v1">` —— 页面流量统计（含本次部署签发的 token）

**本地源文件里绝不能留这两段**。从线上抓回来的副本是带注入的，直接拿去再发一次就会重复注入：
页面出现两个挂件，且流量被重复计数。

剥离方式：删除 `index.html` 尾部到 `</body>` 之前的这两块（当前版本对应第 182–293 行与 162–181 行，
行号会随改动漂移，务必用 `grep -n "minimax" index.html` 定位后再删，不要硬套行号）。

剥离后自检：`grep -c "minimax" index.html` 应为 `0`。

## 词库数据结构（`data/groups.js`）

文件头标注「自动生成，请勿直接编辑 / 生成命令：node tools/merge-data.mjs」——那是原项目的
生成脚本，**不在部署产物里**。当前直接维护 `groups.js` 即可，只要字段结构不变。

```js
window.GROUPS = [
  {
    id: "academy-university",       // kebab-case 英文，组内唯一
    words: ["academy", "institute"],// 组内词条，全小写
    category: "教育与组织",          // 29 个语义分类之一
    tags: ["专门机构", "教育制度"],
    summary: "这组词的差别在哪里，一句话概括。",
    choiceTip: "选词时的判断路径。",
    pitfall: "容易踩的坑。",
    lexicalType: "word",            // word / phrase / preposition 等
    version: 1,
    updatedAt: "2026-11-19 10:30:00",
    relatedExpressions: ["higher education", "degree"],
    notes: [
      {
        word: "academy",
        translation: "学院；专门培训机构",  // 中文释义
        meaning: "英文义",                // 核心义
        nuance: "语感差异",                // 与同组词的细微差别
        example: "She trained at a national dance academy.",
        lexicalType: "word"
      }
    ]
  }
]
```

新增或删除词组后，同步更新文件头注释里的三行计数（词组 / 词条 / 语义分类），
`index.html` 首页与「词库」页的统计数字是运行时从 `GROUPS` 实时算的，不用手改。

## 功能自检清单

改完至少跑一遍：

- [ ] 首页统计数字正确（38 组 / 118 词条 / 29 分类）
- [ ] 搜索命中：搜 `happy` → 情感与情绪组；搜中文/大小写混输均可
- [ ] 分类浏览：点分类标签可过滤
- [ ] 学习模式：卡片翻页正常
- [ ] 随堂测验：出题、判分、讲解正常
- [ ] 我的收藏：书签增删后刷新仍在（localStorage）
- [ ] 深浅色主题切换、桌面 + 移动端窄屏布局正常
- [ ] 控制台零报错

## 已知非问题

- 线上副本若报 `ERR_CERT_AUTHORITY_INVALID`，来源是平台注入的统计脚本请求
  `agent.minimax.cn`（沙箱出口证书校验失败），与站点代码无关。
- 平台挂件与统计脚本由部署流程自动注入，本地源不含它们属于**正确状态**。

## 变更记录

| 日期 | 动作 |
| --- | --- |
| 2026-11-19 | 建立云端维护基线：从线上抓回 4 个文件，剥离平台注入的挂件与统计脚本，补齐本手册与 README |
| 2026-11-19 | 新增词组 `robust-sturdy-solid-durable-tough-resilient`（sturdy / robust / solid / durable / tough / resilient，分类：程度与质量）；词库 37 → 38 组、112 → 118 词条、分类仍 29 个；本地验证通过（搜索命中、首页统计一致、控制台零报错）；**已入库待发布**（本轮未发布到公网），备份 zip 已刷新 |
| 2026-11-19 | 新增词组 `heritage-legacy-tradition-inheritance-ancestry`（heritage / legacy / tradition / inheritance / ancestry，分类：历史与记忆）与 `modify-alter-convert-overhaul-transform-adapt`（modify / alter / convert / overhaul / transform / adapt，分类：动作与变化）；词库 38 → 40 组、118 → 129 词条、分类仍 29 个；发布到公网，新地址 https://q3yd8d39dmqgh.space.mcode.cn （节点 `464999192441336`）；旧站 https://8iorbardnid05.space.mcode.cn 冻结在 37 组 / 112 词条，节点改名为「旧版·已冻结」 |
| 2026-11-19 | 机制更正：实测确认平台**每次部署都新建节点与新域名**，`project_name` 相同也不会原地更新（连续两次部署分别得到 `g5xy9n84k8r6s` 与 `q3yd8d39dmqgh`）。手册、技能文档与记忆中的「原地更新、URL 不变」说法已全部改正。删除 Drive 节点不会让已发布 URL 下线，旧网址仍可访问 |
| 2026-11-19 | **迁移到 GitHub Pages**：新建公开仓库 https://github.com/X-sky/vocablens ，站点文件推到 `gh-pages` 分支根目录（含 `.nojekyll`），线上地址固定为 **https://x-sky.github.io/vocablens/** ，以后维护只推同一分支、网址不再变；Pages 对新仓库自动开启，无需手动开关；旧版 https://8iorbardnid05.space.mcode.cn 已删除 Drive 节点，现为 404；平台站 https://q3yd8d39dmqgh.space.mcode.cn 保留为备用镜像 |
| 2026-11-19 | **UI 重设计 v2（Paper & Ink）**：用户反馈原版「AI 味太重」。`styles.css` 整体重写（1400 行 → 约 1200 行）：去掉极光光斑 + 噪点 + 全站玻璃拟态 + 紫青霓虹渐变 + 彩色分类 + 超大圆角胶囊；改为衬线/宋体排版、发丝分隔线、单一朱砂强调色、直角小圆角。`index.html` 移除 aurora/grain 两个装饰层、换掉渐变 favicon 与品牌图标、默认主题改为 light；`app.js` 改 hero 眉题文案、去掉 chip 彩色圆点、主题默认值改 light。修掉移动端 `.card-grid` 轨道用 `1fr` 导致卡片被 nowrap 例句撑爆的横向溢出（改 `minmax(0, 1fr)`）。v1 源文件备份在 `/workspace/vocablens-backup-v1/`。功能自检全过：搜索/分类筛选/收藏/详情弹层/测验判分/翻卡/主题切换/`/` 快捷键/移动端导航，控制台零报错 |
