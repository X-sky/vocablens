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
├── styles.css        全部样式（约 47 KB，含深浅色主题与响应式断点）
├── app.js            全部交互逻辑，IIFE 包裹，无构建步骤
├── data/groups.js    词库，导出 window.GROUPS 数组
├── README.md         站点说明
└── MAINTENANCE.md    本文件
```

技术约束：**纯静态、零构建、零依赖**。`index.html` 在根目录，`assets` 为相对路径引用。
因此整个目录可直接丢到任何静态托管，无需 npm / 打包。

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
   # files 必须含：index.html / styles.css / app.js / data/groups.js / README.md / MAINTENANCE.md / .nojekyll
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
