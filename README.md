# 🎵 Wish House Player

专为个人主页打造的 Fluent Design 风格悬浮音乐播放器，基于 HTML5 Audio 构建。
ES Module 架构，零依赖（仅需 Font Awesome 图标），支持歌词同步、黑胶动画、主题切换、播放列表、音量控制、键盘快捷键、位置记忆与歌曲交叉淡化。

**v2.5 起支持 drop-in 集成**：页面只需放一个空 `<div id="wh-player">`，组件 JS 会自动注入全部播放器 DOM，多页无需再复制 80 行模板。

<div align="center">

![Version](https://img.shields.io/badge/version-2.5-blue)
![ES Module](https://img.shields.io/badge/ES%20Module-brightgreen)
![HTML5](https://img.shields.io/badge/HTML5-orange)
![JavaScript](https://img.shields.io/badge/JavaScript-yellow)
![MIT](https://img.shields.io/badge/license-MIT-green)

</div>

---

## 🚀 快速开始

```bash
# 1. 放入音乐（文件需含歌曲名/歌手元数据）
#    将 .mp3 / .flac / .m4a / .aac / .ogg / .wav 放入 wh_player/music/

# 2. 生成音乐库（脚本路径基于自身位置解析，可在任意目录运行）
pip install -r requirements.txt
python wh_player/generate_music_json.py            # 默认前缀 wh_player（对应 example.html）
python wh_player/generate_music_json.py --prefix modules/wh_player/wh_player   # 主页集成前缀

# 3. 启动本地服务器（ES Module 需要 HTTP 协议，file:// 双击不可用）
python -m http.server 8080

# 4. 浏览器打开
http://localhost:8080/example.html
```

> ⚠️ 直接双击 `example.html`（`file://` 协议）会被浏览器 CORS 策略拦截 ES Module 加载，必须通过 HTTP 访问。
> 部署到 Nginx / GitHub Pages / 任意静态服务器后无此限制。

---

## ✨ 功能

### 🎼 播放

- 播放 / 暂停（含自动播放策略 catch，拦截时提示"点击继续收听"）
- 上一首 / 下一首，顺序 / 随机切换（`pickRandom` 排除当前曲）
- 自动连续播放，进度条点击 / 拖动（Pointer Events，鼠标 + 触屏）
- 音量滑块 + 静音按钮
- 切歌交叉淡化（默认 300ms，`cfg.crossfade` 可调，设 `0` 关闭）：淡出当前曲 → 切歌 → 淡入新曲，音量线性过渡无爆音；播放中切歌自动续播，暂停中切歌保持暂停

### 🎤 歌词

- LRC 解析为纯函数 `parseLrc`（无 DOM 依赖，可单测）
- 内嵌歌词提取（FLAC `LYRICS` / MP3 `USLT` / M4A `©lyr` / OGG Vorbis `LYRICS`）
- 同步定位用二分查找 `findLyricIndex`，O(log n)
- 当前句高亮 + 下一句预览，快速切歌时过期响应被丢弃（竞态守卫）
- 加载失败可见提示（`404` 视为"暂无歌词"，其他错误提示"歌词加载失败"）

### 💿 封面

- MP3 / FLAC / M4A / OGG 封面提取（Python 脚本）
- 黑胶旋转 + 播放时主题色发光
- 封面缺失回退默认图

### 🎨 主题

内置六套主题，切换只改 CSS 变量 `--wh-accent`，不重绘 DOM：

| Theme         | 颜色      |
|---------------|-----------|
| Sky Blue      | `#6fc3df` |
| Lavender Mist | `#8d82c4` |
| Coral Sunset  | `#ec8d81` |
| Golden Sand   | `#e7b788` |
| Aurora Blue   | `#8ea9e8` |
| Mint Green    | `#87c5a4` |

### 📑 播放列表

- 事件委托（任意歌曲数量内存友好）
- 当前歌曲高亮 + 自动滚动到可视区
- 毛玻璃面板 + 平滑弹出动画

### ⌨️ 键盘快捷键

| 按键    | 功能        |
|---------|------------|
| `Space` | 播放/暂停   |
| `→` / `←` | 快进 / 后退 5 s |
| `↑` / `↓` | 音量 +10% / −10% |
| `M`     | 静音切换    |

> 在输入框（`INPUT` / `TEXTAREA`）聚焦时快捷键自动失效。

### 🖱️ 拖动与记忆

- 桌面端按住歌曲信息区（`.meta`）可自由拖动，位置持久化到 `localStorage`
- 恢复时含类型守卫 + 视口 clamp（窗口变窄不会把播放器推出屏幕）

### ✅ 状态持久化

刷新页面后恢复：当前歌曲、播放进度、暂停状态、播放器位置、主题、音量、静音、随机/顺序模式。

持久化策略：`timeupdate` 每 5 秒节流保存 + `pause` / `play` / `seeked` / `beforeunload` 立即保存，避免高频写 `localStorage`。

---

## 📦 项目结构

```
wh_player/                          外层目录（example.html 所在位置）
├── example.html                    演示页
├── requirements.txt                Python 依赖（mutagen）
├── fontawesome-6.7.2/              本地 Font Awesome 6.7.2（all.min.css + webfonts/，已离线化）
│   ├── all.min.css
│   └── webfonts/                   fa-solid / fa-regular / fa-brands（woff2 + ttf）
└── wh_player/                      组件目录
    ├── assets/
    │   ├── index.js                入口：WishPlayer 类 + 自动初始化
    │   ├── lyrics.js               纯函数 parseLrc / findLyricIndex
    │   ├── utils.js                THEMES / isValidTheme / pickRandom
    │   ├── store.js                持久化 mixin（state / position / theme）
    │   ├── progress.js             进度条 seek mixin（Pointer Events）
    │   ├── drag.js                 播放器拖拽 mixin
    │   ├── playlist.js             列表渲染 + 事件委托 mixin
    │   ├── player.css              样式（CSS 变量 / 无障碍 / 前缀）
    │   ├── package.json            type: module（Node 测试用）
    │   └── test.js                 纯函数冒烟测试
    ├── covers/                     封面输出目录
    ├── lyrics/                     LRC 输出目录
    ├── music/                      音乐源文件（gitignore）
    ├── generate_music_json.py      音乐库扫描脚本
    └── music.json                  由脚本生成（gitignore）
```

---

## 🏗️ 架构

### 模块职责

`index.js` 定义 `WishPlayer` 类主体，通过 mixin 扩展挂载各功能模块：

| 文件 | 导出 | 职责 |
|------|------|------|
| `index.js` | `WishPlayer` `WH_PLAYER_TEMPLATE` | 构造函数、DOM 查询（**空容器时自动注入 `WH_PLAYER_TEMPLATE`**）、事件绑定、初始化、歌曲加载（含歌词竞态守卫）、播放控制、交叉淡化切歌（`_crossfadeTo` / `_animateVolume` / `_cancelFade`）、音量、键盘（多实例作用域隔离）、错误处理、`destroy()`、自动初始化 |
| `lyrics.js` | `parseLrc` `findLyricIndex` | 纯函数，无 DOM 依赖 |
| `utils.js` | `THEMES` `isValidTheme` `pickRandom` | 常量与纯函数 |
| `store.js` | `applyStoreMixin` | `_saveState` / `_restoreState` / `_savePosition` / `_restorePosition` / `_clampToViewport` / `_applyTheme`（状态含音量/静音/随机，恢复含 `readyState` 竞态处理） |
| `progress.js` | `applyProgressMixin` | `_seekStart` / `_seekMove` / `_seekEnd` / `_doSeek` / `_updateProgress` |
| `drag.js` | `applyDragMixin` | `_dragStart` / `_dragMove` / `_dragEnd` |
| `playlist.js` | `applyPlaylistMixin` | `_renderPlaylist` / `_highlightPlaylist` |
| `player.css` | — | CSS 变量体系、`-webkit-` 前缀、`prefers-reduced-motion`、`:focus-visible` |

关键设计：

- **事件委托**：播放列表面板只在面板根节点绑定一次 `click`，歌曲数无内存压力
- **Pointer Events**：拖拽与进度条统一 `pointerdown/move/up`，鼠标触屏一套代码；进度条含 `touch-action: none` 防滚动干扰
- **事件生命周期**：所有 `addEventListener` 注册时记录到 `_listeners`，`destroy()` 统一移除并清理音频、toast 定时器与交叉淡化 rAF，SPA 路由卸载无泄漏
- **DOM 隔离**：所有元素查询相对 `root`（`root.querySelector`），`<audio>` 等元素须放在播放器容器内，支持同页多实例（多实例时键盘快捷键自动按实例作用域隔离）
- **纯函数可测**：歌词解析 / 选曲 / 主题校验无任何 DOM 依赖，Node 直接 `import`
- **交叉淡化**：切歌用 `requestAnimationFrame` 线性插值 `audio.volume` 完成淡出→切歌→淡入，零新增依赖；`state.volume` 只作目标值不被动画污染，用户手动调音量会即时打断淡化；自然结束（`ended`）强制续播，手动切歌跟随当前播放状态

### 本地测试

```bash
node wh_player/assets/test.js
# ✓ 全部测试通过（parseLrc / findLyricIndex / pickRandom / THEMES）
```

---

## 📄 music.json 格式

```json
[
  {
    "name":   "七里香",
    "artist": "周杰伦",
    "album":  "七里香",
    "cover":  "wh_player/covers/七里香.jpg",
    "url":    "wh_player/music/七里香.flac",
    "lrc":    "wh_player/lyrics/七里香.lrc"
  }
]
```

- 路径使用 POSIX 分隔符（`/`），相对**页面**所在目录；前缀由 `generate_music_json.py --prefix` 决定（默认 `wh_player`，主页集成传 `modules/wh_player/wh_player`）
- `cover` / `lrc` 可为空字符串，播放器分别回退默认封面、显示"暂无歌词"
- 音乐文件需含歌曲名/歌手元数据才能正确提取，推荐用 [MusicC](https://github.com/XuczSnow/MusicC) 或 foobar2000 批量写入
- 脚本内置 `clean_tag()` 清理：ID3 多值标签（如 TPE1 多歌手）内部的 NUL 分隔符归一为 `" / "`（`成龙\u0000金喜善` → `成龙 / 金喜善`），并剔除其余 C0 控制字符，保证 JSON 与 DOM 显示均无非法字符

---

## 🔌 集成到已有页面

### 1. 引入资源

组件本身零依赖，**图标**沿用宿主页面已有的 Font Awesome；页面没有 FA 时再补一份。

```html
<!-- 组件样式 + 入口（必需） -->
<link rel="stylesheet" href="/wh_player/assets/player.css">
<script type="module" src="/wh_player/assets/index.js"></script>

<!-- 图标：页面已有 Font Awesome（5.x / 6.x）则无需再加；否则二选一 -->
<link rel="stylesheet" href="/fontawesome-6.7.2/all.min.css"> <!-- 本地 FA 6.7.2 -->
<!-- 原 CDN（如需回退）：https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/css/all.min.css -->
```

> **图标类名兼容**：组件统一用 **FA5 类名**，FA5 与 FA6 都能正确显示——随机 `fa-random`（FA6 等价 `fa-shuffle`）、静音 `fa-volume-mute`（FA6 等价 `fa-volume-xmark`）；`fa-play` / `fa-palette` / `fa-list` / `fa-step-forward` / `fa-volume-up` 等两者通用。因此无论宿主页面引 FA5 还是 FA6，组件都无需改动。

### 2. 嵌入组件（drop-in，v2.5）

`data-music-source` 可覆盖默认 `music.json` 路径；默认封面由该路径同级 `covers/default-cover.jpg` 自动推导。
**空容器即可**：组件 JS 检测到容器内没有 `#audio` 时，会自动注入整套播放器 DOM（`index.js` 中的 `WH_PLAYER_TEMPLATE`），多页无需复制模板。

```html
<link rel="stylesheet" href="/wh_player/assets/player.css">
<div id="wh-player" data-wh-player data-music-source="/wh_player/music.json"></div>
<script type="module" src="/wh_player/assets/index.js"></script>
```

> 需要自定义容器内部结构（如预置静态封面图、调整默认文案）时，仍可在容器内手写完整 DOM；JS 检测到 `#audio` 已存在就跳过注入，直接复用你的结构。完整模板即 `index.js` 里的 `WH_PLAYER_TEMPLATE`，以它为准（避免文档与实现漂移）。


### 3. SPA 手动实例化

```js
import { WishPlayer } from '/wh_player/assets/index.js';

const p = new WishPlayer(document.getElementById('wh-player'), {
  musicSource:   '/api/music.json',      // 自定义播放列表来源
  fallbackCover: '/img/cover.png',       // 自定义默认封面
  defaultTheme:  'aurora',               // 首次访问主题
  storagePrefix: 'my-app-player',        // 多实例时隔离 localStorage key
  crossfade:     500,                    // 切歌交叉淡化时长（ms），0 关闭
});

// 路由卸载时
p.destroy();
```

> 自动初始化只会取页面上**第一个** `[data-wh-player]` 或 `#wh-player`。
> 多实例或需要控制生命周期时请走手动实例化，并给每个实例不同的 `storagePrefix` 与唯一 DOM id。

### 4. 重新生成音乐库

脚本路径基于自身位置解析，可在任意目录运行；`--prefix` 指定输出 JSON 中 `url`/`cover`/`lrc` 的路径前缀（默认 `wh_player`，主页集成时传 `modules/wh_player/wh_player`）：

```bash
# 在 wh_player 外层目录（example.html 所在位置）
python wh_player/generate_music_json.py

# 主页集成：指定前缀，使 music.json 中路径匹配 index.html 的引用
python wh_player/generate_music_json.py --prefix modules/wh_player/wh_player

# 自定义输出路径
python wh_player/generate_music_json.py --prefix "" --output ./my_music.json
```

---

## ♿ 无障碍

- 所有交互按钮含 `aria-label`，主题项 `role="option"` 可键盘聚焦
- 进度条 `role="slider"` + `tabindex="0"`，左右箭头键可调整
- 键盘焦点 `:focus-visible` 样式（`all: unset` 按钮已补回 `outline`）
- 黑胶旋转与过渡动画尊重 `prefers-reduced-motion`

---

## 📋 Changelog

### 2.5.0
- **drop-in 集成**：容器为空时自动注入整套播放器 DOM（`WH_PLAYER_TEMPLATE`），多页只需一个空 `<div>`，无需复制 80 行模板
- 默认封面从 `data-music-source` 同级 `covers/` 自动推导，空容器无需再写 `fallbackCover`
- 图标统一为 FA5/FA6 兼容类名，宿主页面引 FA5 或 FA6 均可正常显示

### 2.4.0
- 切歌交叉淡化（`cfg.crossfade`，默认 300ms，`0` 关闭）：淡出→切歌→淡入，线性音量过渡
- 持久化扩展：`volume` / `muted` / `randomMode` 一并保存，刷新后完整恢复
- `readyState` 竞态修复：元数据已缓存时直接 seek + 续播，进度恢复不再失效
- 歌词 404 与其他加载失败区分提示（"暂无歌词" / "歌词加载失败"）
- 多实例键盘作用域隔离（`window.__whPlayerInstances` 注册表）；`KeyM` 补 `preventDefault`；`destroy()` 清理 toast / 拖拽 / 淡化 rAF
- `generate_music_json.py` 路径基于自身解析 + `--prefix` / `--output` 参数，根目录可运行，Windows UTF-8 输出加固

### 2.3.0
- mixin 化架构（store / progress / drag / playlist）
- 进度条 / 拖拽统一 Pointer Events，事件全生命周期追踪
- 键盘快捷键、位置记忆 + 视口 clamp、六套 CSS 变量主题

---

## 📄 License

MIT
