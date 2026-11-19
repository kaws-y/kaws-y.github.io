# kaws-y.github.io — 个人博客与系统架构师知识库

> 基于 Jekyll + GitHub Pages 的静态博客，内容以学习笔记为主：前端/后端/区块链技术手册、软考高级「系统架构设计师」备考体系（14 章知识库 + 7 个案例专题）。
>
> 本文件为仓库说明文档，已在 `_config.yml` 的 `exclude` 中，**不会被发布到站点**。

---

## 一、架构与技术栈

### 1.1 整体架构

```
浏览器
  │  HTTPS
  ▼
GitHub Pages（用户站点托管）
  │  push 到 master 分支 → 官方 Jekyll 构建 → 全静态 HTML/CSS/JS
  ▼
静态资源（同仓库直出：HTML / CSS / JS / 图片 / 字体 / PDF）
  │
  ├── 浏览器端 JS ──► 第三方服务（Gitalk 评论、anchor-js、MathJax）
  └── Service Worker（PWA 离线缓存，stale-while-revalidate）
```

无服务端、无数据库。所有页面在**构建期**由 Jekyll 生成静态文件；运行期的动态能力（评论、目录锚点、公式渲染、导航交互）全部由浏览器端 JS 完成。

### 1.2 技术栈清单

| 层 | 技术 | 说明 |
| --- | --- | --- |
| 站点生成 | Jekyll 4.x（kramdown GFM + rouge 高亮） | GitHub Pages 自动构建；本地可用 `jekyll build` 验证 |
| 分页 | jekyll-paginate（每页 10 篇） | 唯一启用插件，兼容 Pages 白名单 |
| 主题 | Hux Blog 模板（fork 自 BY/Hux） | 自维护，通过 `less/` 编译定制 |
| 页面框架 | jQuery 1.x + Bootstrap 3 | 模板自带，`_includes/footer.html` 统一加载 |
| 样式构建 | Less + Grunt（uglify / less / banner / watch） | 本地开发工具，产物 `css/`、`js/` 直接提交 |
| 字体 | 本地 `fonts/`（eot/svg/ttf/woff/woff2）+ font-awesome 4.6.3（cdnjs CDN） | |
| 评论 | Gitalk（GitHub Issues）+ md5.min.js 生成评论 ID | `site.gitalk.enable` 开关 |
| 目录/锚点 | jquery.nav.js + anchor-js 1.1.1（cdnjs CDN） | `catalog: true` 的文章启用 |
| 公式 | MathJax v3（cdnjs，按文章开关 `mathjax: true`） | 2026-11 新增，仅公式文章加载 |
| PWA | manifest.json + sw.js + offline.html | `service-worker: true` 开关 |
| 分析 | Google Analytics / 百度统计（预留，当前未启用） | `ga_track_id` / `ba_track_id` |

---

## 二、目录结构与文件存储约定

```
kaws-y.github.io/
├── _config.yml              # 站点配置（主题/评论/插件/排除项）
├── index.html               # 首页（文章列表 + 分页）
├── 1-resources.html         # 学习资料页（架构备考导航）
├── 2-tags.html              # 标签云
├── 3-about.html             # 关于页
├── 404.html / feed.xml / offline.html / sw.js
├── CNAME                    # 自定义域名绑定（当前为空 = 未绑定）
│
├── _posts/                  # ★ 博客文章（唯一正文源）
│   └── YYYY-MM-DD-标题.md   #   命名即 URL slug（支持中文）
│                            #   front matter: layout/title/subtitle/
│                            #   date/author/header-img/catalog/tags
│                            #   可选: mathjax（公式文章设 true）
├── _layouts/                # 布局：default / page / post / keynote
├── _includes/               # 组件：head.html / nav.html / footer.html
│
├── docs/架构师知识库/        # ★ 备考知识库（14 章 + 案例专题）
│   ├── README.md            #   章节索引与三轮复习顺序
│   ├── 01~14-*.md           #   正文（无 front matter → 原样发布，可直链）
│   ├── 案例专题/            #   7 个实战专题（云原生/SOA/DDD…）
│   └── wiki/                #   原始 PDF 与提取文本（已被 exclude，不发布）
│
├── img/                     # 站点图片（头图/图标/素材，约 60 文件）
├── img-post/                # 文章配图
├── files/                   # 可直链下载的 PDF 资料（约 16 个）
├── fonts/                   # 自托管网页字体
├── css/  js/                # 前端产物（Grunt 编译后提交）
├── less/                    # 样式源码（exclude，不发布）
├── pwa/                     # manifest.json
├── Gruntfile.js / package.json / node_modules/   # 本地构建工具链（exclude）
└── .gitignore
```

### 2.1 存储约定

| 内容类型 | 存放位置 | 发布方式 |
| --- | --- | --- |
| 博客正文 | `_posts/YYYY-MM-DD-slug.md` | Jekyll 渲染为 `/YYYY/MM/DD/slug/` |
| 备考知识库 | `docs/架构师知识库/*.md` | 无 front matter → **原样复制发布**，供下载与直链 |
| 原始资料（PDF/txt） | `docs/架构师知识库/wiki/` | **不发布**（`_config.yml` exclude，约 20MB） |
| 文章头图 | `img/`（front matter `header-img` 引用） | 随页面加载 |
| 可下载 PDF | `files/` | 原样发布直链 |
| 样式/脚本产物 | `css/`、`js/` | 原样发布（源码在 `less/`，本地编译） |

### 2.2 构建排除清单（`_config.yml`）

```
exclude: ["less", "node_modules", "Gruntfile.js", "package.json",
          "README.md", "docs/架构师知识库/wiki"]
```

被 exclude 的内容**不进入站点输出**，但仍在仓库中。

---

## 三、部署模式说明

当前采用 **GitHub Pages 用户站点（User Site）** 模式：

1. 仓库名与地址绑定：`kaws-y.github.io` → 站点固定为 `https://kaws-y.github.io/`（`baseurl: ""`，文章 URL 不带子路径前缀）。
2. 触发方式：`git push` 到 `master` 分支 → GitHub 官方流水线自动执行 `jekyll build` → 产物部署到全球 CDN 节点。
3. 无 CI 配置文件：仓库中没有 GitHub Actions workflow，构建完全由 Pages 托管端完成（这也是为什么只敢用 `jekyll-paginate` 这类 Pages 白名单插件）。
4. `CNAME` 文件当前为空，即**未绑定自定义域名**，域名解析、备案与 CDN 加速均无从谈起（见性能优化一节）。
5. `permalink: pretty`，中文文件名 slug 会在 URL 中被百分号编码，访问正常但分享链接较长。

**日常发布流程**：写 `_posts/` → 本地 `jekyll build` 自检 → `git push origin master` → 约 1~2 分钟后线上可见。

---

## 四、性能问题分析与优化方案

用户反馈：**点击响应慢、图片加载慢**。按根因分层如下（按见效排序）。

### 4.1 网络层（根因，优先级最高）

GitHub Pages 服务器在境外，国内直连延迟高、吞吐不稳，**这是「点击导航后白屏等待」的第一根因**——每次点击都是一次整页 HTML 往返。

| 方案 | 做法 | 效果 |
| --- | --- | --- |
| 绑定域名 + Cloudflare CDN（推荐） | 购买域名 → `CNAME` 填入 → DNS 托管到 Cloudflare → 开 CDN | 静态资源命中边缘节点，国内可用性显著改善；免费 |
| 充分利用 PWA 缓存 | 优化 `sw.js`（见 4.3） | 二次访问近乎秒开 |

### 4.2 图片层（「图片加载慢」的直接原因）

| 问题 | 位置 | 优化 |
| --- | --- | --- |
| **头图用 GIF 动图**：每篇文章 `header-img: img/city5.gif`，GIF 单帧调色板压缩率极差，动图通常数百 KB~数 MB，且是 CSS 背景图，**无懒加载可救** | `img/*.gif`（11 个） | ① 用 ffmpeg 转 WebM/MP4（体积降 80%+）或压成 WebP；② 或改用静态 jpg + `header-mask`；③ 压缩后保留原观感 |
| JPG/PNG 未压缩（41 jpg + 6 png） | `img/`、`img-post/` | TinyPNG / Squoosh / `cjpeg -quality 70` 批量压；转 WebP 再省 30% |
| 文章内图片同步加载 | `_posts/*.md` | 生成 HTML 后统一带 `loading="lazy" decoding="async"`（kramdown 可配或在布局层处理） |
| 大体积附件直传仓库 | `files/`（16 PDF）、`img/*.mp4` | 移到 GitHub **Releases**（不占仓库、不限 Pages 带宽），仓库放外链 |
| 仓库体积拖慢 clone | `node_modules` 未在 `.gitignore` | 补 `.gitignore`（见 4.4），`git rm -r --cached node_modules` |

### 4.3 脚本层（「点击响应慢」的第二根因）

第三方 CDN 资源在境内不稳定，阻塞或拖慢页面交互：

| 问题 | 位置 | 优化 |
| --- | --- | --- |
| font-awesome 走 cdnjs | `_includes/head.html` | 本地化到 `css/fonts/`（项目已有本地字体先例） |
| Gitalk 走 unpkg.com，且**每篇文章页都加载** | `_layouts/post.html`、`1-resources.html` | ① gitalk.css/js 下载进仓库本地化；② 改为**滚动到评论区再按需加载**；③ 或直接换 giscus（GitHub Discussions） |
| anchor-js 走 cdnjs | `_layouts/post.html` | 本地化或删除（目录已由 jquery.nav 提供） |
| **fastclick 已无必要** | `_includes/footer.html` | Chrome 32+/现代移动端早已消除 300ms 点击延迟，直接删除 |
| jQuery/Bootstrap/hux-blog 同步加载 | `_includes/footer.html` | 加 `defer`（body 尾部影响小，但 defer 更稳） |
| ghbtns.com iframe（star 按钮） | `footer.html` | 境内基本超时，删除或换静态图片 |
| `sw.js` 白名单残留原模板作者域名 `huangxuan.me`、`yanshuo.io` | `sw.js:11-16` | 删除 |
| `sw.js` 对**所有请求**（含图片/JS/CSS）都 race 网络 | `sw.js:108-148` | 静态资源（带扩展名）改 `cache-first`，仅 HTML 导航保持 `network-first`，弱网下收益巨大 |

### 4.4 仓库健康

`.gitignore` 目前只忽略了 `_site` 与 macOS 垃圾文件，建议补充：

```
node_modules/
.jekyll-cache/
.jekyll-metadata
_site*/
*.code-workspace
```

### 4.5 落地顺序建议

1. `.gitignore` 补全 + 本地化 Gitalk/anchor-js + 删 fastclick —— 半小时，零风险。
2. 头图 GIF 转 WebM/WebP + 批量压缩 JPG —— 收益最大。
3. `sw.js` 缓存策略修正 —— 二访体验质变。
4. 绑定域名 + Cloudflare —— 境内访问的根本解。

---

## 五、Supabase 对接方案（预留）

GitHub Pages 是纯静态托管，**不能跑服务端代码**；对接 Supabase 的正确姿势是 **浏览器端直连**（supabase-js v2 + 公开的 anon key + 行级安全 RLS），用于给静态博客补上轻量动态能力（阅读量、点赞、评论、访问统计）。

### 5.1 原则与红线

- 前端只能放 **anon key**（本来就是公开的），安全性完全依赖 **RLS 策略**；
- **绝不能**把 `service_role` key 写进任何前端代码/配置；
- 写操作优先用 **RPC 函数**（`security definer`）而非直接 update，保证原子性与限权。

### 5.2 对接步骤（以「文章阅读量」为例）

**① 建表与自增函数**（Supabase Dashboard → SQL Editor）：

```sql
create table page_stats (
  page_path text primary key,
  view_count bigint not null default 0
);

-- Atomic view counter
create or replace function increment_view(p_path text)
returns void language sql security definer as $$
  insert into page_stats (page_path, view_count) values (p_path, 1)
  on conflict (page_path) do update set view_count = page_stats.view_count + 1;
$$;

alter table page_stats enable row level security;
create policy "read any" on page_stats for select using (true);
-- Anonymous increment via RPC function, no table update policy
```

**② 前端接入**（`_includes/` 新建 `page-stats.html`，由 `post.html` 引入）：

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script>
  const supabase = window.supabase.createClient(
    'https://<PROJECT_REF>.supabase.co',
    '<ANON_KEY>'
  );
  const path = decodeURIComponent(location.pathname);

  supabase.rpc('increment_view', { p_path: path }).then(() =>
    supabase.from('page_stats')
      .select('view_count')
      .eq('page_path', path)
      .single()
      .then(({ data }) => {
        const el = document.getElementById('view-count');
        if (el && data) el.textContent = data.view_count;
      })
  );
</script>
```

密钥建议放 `_config.yml`（`supabase.url` / `supabase.anonKey`），模板中用 `{{ site.supabase.anonKey }}` 注入——注意 `_config.yml` 进仓库，所以这里只能是 anon key。

**③ PWA 配合**：把 `<PROJECT_REF>.supabase.co` 加进 `sw.js` 的 `HOSTNAME_WHITELIST` 才会被缓存策略接管。

### 5.3 进阶路线

| 场景 | 方案 |
| --- | --- |
| 评论系统（替代 Gitalk） | `comments` 表 + RLS（select 公开、insert 仅登录用户）+ **Supabase Auth**（邮箱/GitHub OAuth） |
| 点赞（防刷） | RPC + 每访客一个匿名 `visitor_id`（localStorage）+ upsert 唯一约束 |
| 构建期注入数据（如「热门文章」） | GitHub Actions 定时跑脚本调 Supabase REST API → 生成静态 JSON/MD 提交回仓库，**零运行时开销**，最契合静态架构 |
| 写敏感逻辑 | Supabase Edge Functions（Deno），前端 fetch 调用 |

### 5.4 风险提示

- `*.supabase.co` 域名境内访问延迟不稳定，与 GitHub Pages 同样建议经 Cloudflare 代理或自定义域名；
- 免费额度：数据库 500MB、带宽 5GB/月，个人博客量级完全够用；
- 阅读量可被脚本刷：可加简单的频率限制 RPC（同 path 60s 内只计一次，靠客户端约定 + 服务端时间戳）。

---

## 六、本地开发

```bash
# 依赖：Ruby + Jekyll 4.x（本机已验证 jekyll 4.4.1）
bundle install                # 如有 Gemfile
jekyll serve                 # http://localhost:4000 预览
jekyll build --destination _site_verify   # 构建自检（用后删除）

# 样式/脚本修改（改 less/ 或 js/hux-blog.js 后）
npm install
grunt                        # 编译 less → css、压缩 js 并打 banner
```

---

## 致谢

1. 这个模板是从这里 [BY](https://github.com/qiubaiying/qiubaiying.github.io) fork 的, 感谢作者BY。
2. BY的模板应该是从这个模板 [Hux](https://github.com/Huxpro/huxpro.github.io) fork 的, 也一起感谢一下。
3. 感谢 Jekyll、Github Pages 和 Bootstrap!

## License

遵循 MIT 许可证。有关详细,请参阅 [LICENSE](https://github.com/kaws-y/kaws-y.github.io/blob/master/LICENSE)。
