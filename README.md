# 🎵 Wish House Player

专为个人主页打造的 Fluent Design 风格悬浮音乐播放器，基于 HTML5 Audio 构建。
ES Module 架构，零依赖（仅需 Font Awesome 图标），支持歌词同步、黑胶动画、主题切换、播放列表、音量控制、键盘快捷键与位置记忆。

<div align="center">

![Version](https://img.shields.io/badge/version-2.3-blue)
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

# 2. 生成音乐库
pip install -r requirements.txt
python wh_player/generate_music_json.py

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

### 🎤 歌词

- LRC 解析为纯函数 `parseLrc`（无 DOM 依赖，可单测）
- 内嵌歌词提取（FLAC `LYRICS` / MP3 `USLT` / M4A `©lyr` / OGG Vorbis `LYRICS`）
- 同步定位用二分查找 `findLyricIndex`，O(log n)
- 当前句高亮 + 下一句预览，快速切歌时过期响应被丢弃（竞态守卫）
- 加载失败可见提示

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

刷新页面后恢复：当前歌曲、播放进度、暂停状态、播放器位置、主题。

持久化策略：`timeupdate` 每 5 秒节流保存 + `pause` / `play` / `seeked` / `beforeunload` 立即保存，避免高频写 `localStorage`。

---

## 📦 项目结构

```
wh_player/                          外层目录（example.html 所在位置）
├── example.html                    演示页
├── requirements.txt                Python 依赖（mutagen）
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
| `index.js` | `WishPlayer` | 构造函数、DOM 查询、事件绑定、初始化、歌曲加载（含歌词竞态守卫）、播放控制、音量、键盘、错误处理、`destroy()`、自动初始化 |
| `lyrics.js` | `parseLrc` `findLyricIndex` | 纯函数，无 DOM 依赖 |
| `utils.js` | `THEMES` `isValidTheme` `pickRandom` | 常量与纯函数 |
| `store.js` | `applyStoreMixin` | `_saveState` / `_restoreState` / `_savePosition` / `_restorePosition` / `_clampToViewport` / `_applyTheme` |
| `progress.js` | `applyProgressMixin` | `_seekStart` / `_seekMove` / `_seekEnd` / `_doSeek` / `_updateProgress` |
| `drag.js` | `applyDragMixin` | `_dragStart` / `_dragMove` / `_dragEnd` |
| `playlist.js` | `applyPlaylistMixin` | `_renderPlaylist` / `_highlightPlaylist` |
| `player.css` | — | CSS 变量体系、`-webkit-` 前缀、`prefers-reduced-motion`、`:focus-visible` |

关键设计：

- **事件委托**：播放列表面板只在面板根节点绑定一次 `click`，歌曲数无内存压力
- **Pointer Events**：拖拽与进度条统一 `pointerdown/move/up`，鼠标触屏一套代码；进度条含 `touch-action: none` 防滚动干扰
- **事件生命周期**：所有 `addEventListener` 注册时记录到 `_listeners`，`destroy()` 统一移除并清理音频与 toast 定时器，SPA 路由卸载无泄漏
- **DOM 隔离**：所有元素查询相对 `root`（`root.querySelector`），`<audio>` 等元素须放在播放器容器内，支持同页多实例
- **纯函数可测**：歌词解析 / 选曲 / 主题校验无任何 DOM 依赖，Node 直接 `import`

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

- 路径使用 POSIX 分隔符（`/`），相对**页面**所在目录
- `cover` / `lrc` 可为空字符串，播放器分别回退默认封面、显示"暂无歌词"
- 音乐文件需含歌曲名/歌手元数据才能正确提取，推荐用 [MusicC](https://github.com/XuczSnow/MusicC) 或 foobar2000 批量写入

---

## 🔌 集成到已有页面

### 1. 引入资源

```html
<!-- Font Awesome 图标（或替换为本地图标方案） -->
<link rel="stylesheet"
      href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/css/all.min.css">
<link rel="stylesheet" href="/wh_player/assets/player.css">
<script type="module" src="/wh_player/assets/index.js"></script>
```

### 2. 嵌入组件

`data-music-source` 可覆盖默认 `music.json` 路径。
**注意：`<audio>`、主题面板、列表面板都必须在容器内部**（JS 通过 `root.querySelector` 查找，组件才能隔离）。

```html
<div id="wh-player" data-wh-player data-music-source="/wh_player/music.json">
  <div class="record">
    <img id="cover" src="/wh_player/covers/default-cover.jpg" alt="专辑封面" width="80" height="80">
  </div>

  <div class="player_content">
    <div class="meta">
      <div id="song-name">未播放</div>
      <div id="lyrics-container">
        <div id="lyric-current">暂无歌词</div>
        <div id="lyric-next"></div>
      </div>
    </div>

    <div class="progress-wrap">
      <div id="progress-bar" role="slider" aria-label="播放进度"
           aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" tabindex="0">
        <div id="progress-fill"></div>
      </div>
    </div>

    <div class="controls">
      <button id="prev" aria-label="上一首"><i class="fas fa-step-backward"></i></button>
      <button id="play" aria-label="播放 / 暂停"><i class="fas fa-play"></i></button>
      <button id="next" aria-label="下一首"><i class="fas fa-step-forward"></i></button>
      <button id="random-btn" class="active" aria-label="随机 / 顺序播放" title="随机播放">
        <i class="fas fa-shuffle"></i>
      </button>
      <button id="theme-btn" aria-label="切换主题"><i class="fas fa-palette"></i></button>
      <button id="playlist-btn" aria-label="播放列表"><i class="fas fa-list"></i></button>
      <div class="volume-group">
        <button id="mute-btn" aria-label="静音"><i class="fas fa-volume-up"></i></button>
        <input id="volume-slider" type="range" min="0" max="100" value="80" aria-label="音量">
      </div>
    </div>
  </div>

  <div id="theme-panel" role="listbox" aria-label="主题选择">
    <div class="theme-item" data-theme="sky"      role="option" tabindex="0"><span class="theme-color sky"></span>Sky Blue</div>
    <div class="theme-item" data-theme="lavender" role="option" tabindex="0"><span class="theme-color lavender"></span>Lavender Mist</div>
    <div class="theme-item" data-theme="coral"    role="option" tabindex="0"><span class="theme-color coral"></span>Coral Sunset</div>
    <div class="theme-item" data-theme="sand"     role="option" tabindex="0"><span class="theme-color sand"></span>Golden Sand</div>
    <div class="theme-item" data-theme="aurora"   role="option" tabindex="0"><span class="theme-color aurora"></span>Aurora Blue</div>
    <div class="theme-item" data-theme="mint"     role="option" tabindex="0"><span class="theme-color mint"></span>Mint Green</div>
  </div>

  <div id="playlist-panel" role="list" aria-label="播放列表"></div>

  <audio id="audio" preload="metadata"></audio>
</div>
```

### 3. SPA 手动实例化

```js
import { WishPlayer } from '/wh_player/assets/index.js';

const p = new WishPlayer(document.getElementById('wh-player'), {
  musicSource:   '/api/music.json',      // 自定义播放列表来源
  fallbackCover: '/img/cover.png',       // 自定义默认封面
  defaultTheme:  'aurora',               // 首次访问主题
  storagePrefix: 'my-app-player',        // 多实例时隔离 localStorage key
});

// 路由卸载时
p.destroy();
```

> 自动初始化只会取页面上**第一个** `[data-wh-player]` 或 `#wh-player`。
> 多实例或需要控制生命周期时请走手动实例化，并给每个实例不同的 `storagePrefix` 与唯一 DOM id。

### 4. 重新生成音乐库

```bash
python wh_player/generate_music_json.py
```

---

## ♿ 无障碍

- 所有交互按钮含 `aria-label`，主题项 `role="option"` 可键盘聚焦
- 进度条 `role="slider"` + `tabindex="0"`，左右箭头键可调整
- 键盘焦点 `:focus-visible` 样式（`all: unset` 按钮已补回 `outline`）
- 黑胶旋转与过渡动画尊重 `prefers-reduced-motion`

---

## 📄 License

MIT
