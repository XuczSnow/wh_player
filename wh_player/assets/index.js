/**
 * Wish House Player v2.5 — 入口模块（drop-in：空容器自动注入 DOM）
 *
 * 文件结构：
 *   lyrics.js    纯函数 parseLrc / findLyricIndex
 *   utils.js     THEMES 常量 / isValidTheme / pickRandom
 *   store.js     持久化 mixin（state / position / theme，含 _applyTheme）
 *   progress.js  进度条 seek mixin
 *   drag.js      播放器拖拽 mixin
 *   playlist.js  播放列表渲染 mixin
 *   index.js     WishPlayer 类 + 自动初始化（本文件）
 *
 * 使用方式（浏览器）：
 *   <script type="module" src="wh_player/assets/index.js"></script>
 *
 * 使用方式（SPA 手动实例化）：
 *   import { WishPlayer } from './wh_player/assets/index.js';
 *   const p = new WishPlayer(root, { musicSource: '/api/music.json' });
 *   p.destroy();
 *
 * 使用方式（Node.js 单测）：
 *   node wh_player/assets/test.js
 */

import { parseLrc, findLyricIndex } from "./lyrics.js";
import { isValidTheme, pickRandom } from "./utils.js";
import { applyStoreMixin }     from "./store.js";
import { applyProgressMixin } from "./progress.js";
import { applyDragMixin }     from "./drag.js";
import { applyPlaylistMixin } from "./playlist.js";

// ── drop-in DOM 模板（改动 1：空容器时自动注入，两页 HTML 无需重复 80 行 DOM）──
// 选择器须与 _buildDom 的 querySelector 严格一致；图标用 FA5 类名（fa-random / fa-volume-up）。
const WH_PLAYER_TEMPLATE = `
  <div class="record">
    <img id="cover" alt="专辑封面" width="80" height="80">
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
      <button id="prev" aria-label="上一首" title="上一首"><i class="fas fa-step-backward"></i></button>
      <button id="play" aria-label="播放 / 暂停" title="播放 / 暂停"><i class="fas fa-play"></i></button>
      <button id="next" aria-label="下一首" title="下一首"><i class="fas fa-step-forward"></i></button>
      <button id="random-btn" class="active" aria-label="随机 / 顺序播放" title="随机播放"><i class="fas fa-random"></i></button>
      <button id="theme-btn" aria-label="切换主题" title="切换主题"><i class="fas fa-palette"></i></button>
      <button id="playlist-btn" aria-label="播放列表" title="播放列表"><i class="fas fa-list"></i></button>
      <div class="volume-group">
        <button id="mute-btn" aria-label="静音" title="静音"><i class="fas fa-volume-up"></i></button>
        <input id="volume-slider" type="range" min="0" max="100" value="80" aria-label="音量">
      </div>
    </div>
  </div>

  <div id="theme-panel" role="listbox" aria-label="主题选择">
    <div class="theme-item" data-theme="sky" role="option" tabindex="0"><span class="theme-color sky"></span>Sky Blue</div>
    <div class="theme-item" data-theme="lavender" role="option" tabindex="0"><span class="theme-color lavender"></span>Lavender Mist</div>
    <div class="theme-item" data-theme="coral" role="option" tabindex="0"><span class="theme-color coral"></span>Coral Sunset</div>
    <div class="theme-item" data-theme="sand" role="option" tabindex="0"><span class="theme-color sand"></span>Golden Sand</div>
    <div class="theme-item" data-theme="aurora" role="option" tabindex="0"><span class="theme-color aurora"></span>Aurora Blue</div>
    <div class="theme-item" data-theme="mint" role="option" tabindex="0"><span class="theme-color mint"></span>Mint Green</div>
  </div>

  <div id="playlist-panel" role="list" aria-label="播放列表"></div>

  <audio id="audio" preload="metadata"></audio>`;

// #10：同页多实例注册表（键盘守卫用）。单实例时保持全页快捷键；
// 多实例时仅当事件源落在本播放器内部才响应，避免抢占。
const _registry =
  (typeof window !== "undefined")
    ? (window.__whPlayerInstances = window.__whPlayerInstances || [])
    : [];

// ── 组装类原型 ───────────────────────────────────────────────

class WishPlayer {

  /**
   * @param {HTMLElement} root  播放器根元素（#wh-player）
   * @param {object}      cfg   可选配置
   * @param {string}      [cfg.musicSource]   music.json 路径
   * @param {string}      [cfg.fallbackCover] 默认封面路径
   * @param {string}      [cfg.defaultTheme]  默认主题名
   * @param {string}      [cfg.storagePrefix] localStorage 前缀
   * @param {number}      [cfg.crossfade=300] 切歌交叉淡化时长（ms），0 关闭
   */
  constructor(root, cfg = {}) {
    this.root = root;
    this.cfg = Object.freeze({
      musicSource:   "wh_player/music.json",
      fallbackCover: "wh_player/covers/default-cover.jpg",
      defaultTheme:  "sky",
      storagePrefix: "wh-player",
      // 交叉淡化时长（ms）。设为 0 则关闭淡化、恢复硬切歌
      crossfade:     300,
      ...cfg,
    });

    this.state = {
      playlist:   [],
      current:    0,
      lyrics:     [],
      randomMode: true,
      volume:     0.8,
      muted:      false,
      needResume: false,
    };

    this._listeners  = [];
    this._lastSave   = 0;
    this._seeking    = false;
    this._drag       = null;
    this._toastTimer = 0;
    this._fading     = false;   // 是否正处于交叉淡化过程中
    this._fadeRaf    = 0;      // 音量动画 requestAnimationFrame 句柄

    this._buildDom();
    this._bindEvents();
    this._init();

    // #10：注册到同页实例表（键盘守卫用，destroy() 时注销）
    if (!_registry.includes(this)) _registry.push(this);
  }

  // ── DOM 引用（全部相对 root 查找）────────────────────────

  _buildDom() {
    // drop-in：容器为空时自动注入完整 DOM（两页 HTML 只写一个空 div 即可）
    if (!this.root.querySelector("#audio")) {
      this.root.innerHTML = WH_PLAYER_TEMPLATE;
    }

    const q = (s) => this.root.querySelector(s);
    const d = (this._dom = {});

    d.audio         = q("#audio");
    d.cover         = q("#cover");
    // 封面默认图：模板/手写 DOM 的 cover 若未写 src，则按 fallbackCover 兜底
    if (d.cover && !d.cover.getAttribute("src"))
      d.cover.src = this.cfg.fallbackCover;
    d.record        = q(".record");
    d.songName      = q("#song-name");
    d.progressBar   = q("#progress-bar");
    d.progressFill  = q("#progress-fill");
    d.playBtn       = q("#play");
    d.prevBtn       = q("#prev");
    d.nextBtn       = q("#next");
    d.randomBtn     = q("#random-btn");
    d.themeBtn      = q("#theme-btn");
    d.themePanel    = q("#theme-panel");
    d.playlistBtn   = q("#playlist-btn");
    d.playlistPanel = q("#playlist-panel");
    d.lyricCurrent  = q("#lyric-current");
    d.lyricNext     = q("#lyric-next");
    d.muteBtn       = q("#mute-btn");
    d.volumeSlider  = q("#volume-slider");
    d.player        = this.root;
    d.dragHandle    = q(".player_content .meta");
  }

  // ── 事件注册（全部追踪，destroy() 时移除）──────────────

  _on(target, type, fn, opts) {
    target.addEventListener(type, fn, opts);
    this._listeners.push({ target, type, fn, opts });
  }

  _bindEvents() {
    const a = this._dom.audio;

    // 播放控制
    this._on(this._dom.playBtn,   "click", () => this._togglePlay());
    this._on(this._dom.prevBtn,   "click", () => this._prev());
    this._on(this._dom.nextBtn,   "click", () => this._next());
    this._on(this._dom.randomBtn, "click", () => this._toggleRandom());

    // 主题面板（事件委托）
    this._on(this._dom.themeBtn, "click", () =>
      this._togglePanel(this._dom.themePanel, this._dom.playlistPanel));
    this._on(this._dom.themePanel, "click", (e) => {
      const item = e.target.closest(".theme-item");
      if (item && isValidTheme(item.dataset.theme))
        this._applyTheme(item.dataset.theme);
    });

    // 播放列表面板（事件委托）
    this._on(this._dom.playlistBtn, "click", () =>
      this._togglePanel(this._dom.playlistPanel, this._dom.themePanel));
    this._on(this._dom.playlistPanel, "click", (e) => {
      const item = e.target.closest(".playlist-item");
      if (!item) return;
      const idx = Number(item.dataset.index);
      if (idx === this.state.current) {  // 点击当前曲：仅恢复播放，不重走淡化
        this._play();
        return;
      }
      this._crossfadeTo(idx);
    });

    // 音频事件
    this._on(a, "ended",      () => this._next(true));  // 自然结束→自动续播
    this._on(a, "timeupdate", () => this._onTimeUpdate());
    this._on(a, "error",      () => this._onAudioError());
    this._on(a, "pause",      () => this._saveState());
    this._on(a, "play",       () => this._saveState());
    this._on(a, "seeked",     () => this._saveState());

    // 进度条（Pointer Events，统一鼠标 / 触屏）
    this._on(this._dom.progressBar, "pointerdown", (e) => this._seekStart(e));
    this._on(window, "pointermove",  (e) => this._seekMove(e));
    this._on(window, "pointerup",    ()  => this._seekEnd());

    // 音量
    if (this._dom.muteBtn) {
      this._on(this._dom.muteBtn, "click", () => this._toggleMute());
      this._updateMuteIcon();
    }
    if (this._dom.volumeSlider) {
      this._on(this._dom.volumeSlider, "input", (e) =>
        this._setVolume(Number(e.target.value) / 100));
      this._dom.volumeSlider.value = Math.round(this.state.volume * 100);
    }

    // 拖拽定位（仅桌面端）
    if (this._dom.dragHandle &&
        !window.matchMedia("(max-width:768px)").matches) {
      this._on(this._dom.dragHandle, "pointerdown", (e) => this._dragStart(e));
      this._on(window, "pointermove", (e) => this._dragMove(e));
      this._on(window, "pointerup",   ()  => this._dragEnd());
    }

    // 持久化 + 键盘
    this._on(window, "beforeunload", () => this._saveState());
    this._on(window, "resize",       () => this._clampPosition());
    this._on(document, "keydown",    (e) => this._onKeydown(e));
  }

  // ── 初始化 ────────────────────────────────────────────────

  async _init() {
    try {
      const res = await fetch(this.cfg.musicSource);
      if (!res.ok) throw new Error(res.status);
      this.state.playlist = await res.json();
      this._renderPlaylist();
      if (!this._restoreState() && this.state.playlist.length) {
        this._loadSong(0);
      }
    } catch {
      this._showToast("music.json 加载失败，请运行 generate_music_json.py 后刷新");
    }

    const saved = localStorage.getItem(this._key("theme"));
    this._applyTheme(
      saved && isValidTheme(saved) ? saved : this.cfg.defaultTheme);

    this._restorePosition();
  }

  // ── 歌曲加载 ──────────────────────────────────────────────

  _loadSong(idx) {
    if (idx < 0 || idx >= this.state.playlist.length) return;
    this.state.current = idx;
    const song = this.state.playlist[idx];
    const d = this._dom;

    d.cover.src = song.cover || this.cfg.fallbackCover;
    d.songName.textContent = `${song.name} · ${song.artist}`;
    d.audio.src = song.url;
    d.audio.load();

    this.state.lyrics = [];
    if (song.lrc) {
      d.lyricCurrent.textContent = `${song.name} - ${song.artist}`;
      fetch(song.lrc)
        .then(r => {
          // #7：404（文件不存在）视为"无歌词"，与其他加载失败区分
          if (r.status === 404) {
            if (this.state.current === idx)
              d.lyricCurrent.textContent = "暂无歌词";
            return null;
          }
          if (!r.ok) throw new Error(r.status);
          return r.text();
        })
        .then(text => {
          if (text === null) return;                  // 404 已在上一段处理
          if (this.state.current !== idx) return;      // 竞态守卫
          this.state.lyrics = parseLrc(text);
        })
        .catch(() => {
          if (this.state.current === idx)
            d.lyricCurrent.textContent = "歌词加载失败";
        });
    } else {
      d.lyricCurrent.textContent = "暂无歌词";
    }
    d.lyricNext.textContent = `${song.name} - ${song.artist}`;

    this._highlightPlaylist();
  }

  // ── 播放控制 ──────────────────────────────────────────────

  _play() {
    this.state.needResume = false;
    // #3：等 play() resolve 后再改 UI，避免 autoplay 被拦截时图标/黑胶动画先切再回退的闪烁
    return this._dom.audio.play().then(() => {
      this._setPlayIcon(true);
      this._dom.record.classList.add("playing");
    }).catch(() => {
      this.state.needResume = true;
      this._setPlayIcon(false);
      this._dom.record.classList.remove("playing");
    });
  }

  _pause() {
    this._dom.audio.pause();
    this._setPlayIcon(false);
    this._dom.record.classList.remove("playing");
  }

  _togglePlay() {
    if (this._fading) return;      // 交叉淡化进行中，忽略手动播放/暂停，与 _next/_prev 一致
    this._dom.audio.paused ? this._play() : this._pause();
  }

  _next(autoplay = false) {
    if (this._fading) return;      // 淡化过程中忽略切歌，避免叠加
    const n = this.state.playlist.length;
    if (!n) return;
    const target = this.state.randomMode
      ? pickRandom(this.state.current, n)
      : (this.state.current + 1) % n;
    this._crossfadeTo(target, autoplay);
  }

  _prev(autoplay = false) {
    if (this._fading) return;      // 淡化过程中忽略切歌，避免叠加
    const n = this.state.playlist.length;
    if (!n) return;
    const target = (this.state.current - 1 + n) % n;
    this._crossfadeTo(target, autoplay);
  }

  /**
   * 交叉淡化切歌：淡出当前曲 → 切换并加载新曲 → 淡入。
   * cfg.crossfade 为 0 时退化为直接切换（无淡化）。
   * @param {number} idx      目标曲目索引
   * @param {boolean} [autoplay] 强制播放。自然结束（ended）续播传 true；
   *                           手动切歌时默认跟随当前播放状态（暂停则保持暂停）。
   */
  async _crossfadeTo(idx, autoplay = false) {
    const a = this._dom.audio;
    const dur = this.cfg.crossfade;
    if (dur <= 0) {
      this._cancelFade();
      this._loadSong(idx);
      if (autoplay || !a.paused) this._play();
      return;
    }

    this._cancelFade();                 // 取消可能残留的旧动画，避免双 rAF 争抢
    this._fading = true;

    // 自然结束强制续播；手动切歌跟随当前播放状态
    const shouldPlay = autoplay || !a.paused;

    // 1) 淡出当前曲目
    await this._animateVolume(a.volume, 0, dur / 2);
    a.pause();

    // 2) 切换到新曲（此时音量已为 0，切歌无爆音）
    this._loadSong(idx);

    // 3) 淡入并恢复音量
    const release = () => { this._fading = false; };
    if (shouldPlay) this._play();
    this._animateVolume(0, this.state.volume, dur / 2).then(release);
  }

  /**
   * 用 rAF 线性插值动画 audio 元素音量（不改动 state.volume 目标值，
   * 也不动滑块——滑块始终反映目标音量）。返回的 Promise 在动画完成时
   * resolve；被 _cancelFade 打断则直接停在当前值。
   */
  _animateVolume(from, to, durMs) {
    return new Promise((resolve) => {
      const a = this._dom.audio;
      if (durMs <= 0) { a.volume = to; return resolve(); }
      const start = performance.now();
      const step = (now) => {
        if (!this._fadeRaf) return resolve();   // 已被取消
        const t = Math.min(1, (now - start) / durMs);
        a.volume = from + (to - from) * t;      // 线性淡入淡出
        if (t < 1) {
          this._fadeRaf = requestAnimationFrame(step);
        } else {
          this._fadeRaf = 0;
          a.volume = to;
          resolve();
        }
      };
      this._fadeRaf = requestAnimationFrame(step);
    });
  }

  /** 取消正在进行的音量动画（供 destroy / 用户手动改音量） */
  _cancelFade() {
    if (this._fadeRaf) {
      cancelAnimationFrame(this._fadeRaf);
      this._fadeRaf = 0;
    }
    this._fading = false;
  }

  _toggleRandom() {
    this.state.randomMode = !this.state.randomMode;
    this._dom.randomBtn?.classList.toggle("active", this.state.randomMode);
    if (this._dom.randomBtn)
      this._dom.randomBtn.title =
        this.state.randomMode ? "随机播放" : "顺序播放";
  }

  _setVolume(v) {
    // 用户手动调整音量时，取消正在进行的交叉淡化动画（手动优先级最高）
    if (this._fading) this._cancelFade();
    this._dom.audio.muted = false;
    this._dom.audio.volume = v;
    this.state.volume = v;
    this.state.muted = false;
    if (this._dom.volumeSlider)
      this._dom.volumeSlider.value = Math.round(v * 100);
    this._updateMuteIcon();
  }

  _toggleMute() {
    this._dom.audio.muted = !this._dom.audio.muted;
    this.state.muted = this._dom.audio.muted;
    this._updateMuteIcon();
  }

  _updateMuteIcon() {
    const icon = this._dom.muteBtn?.querySelector("i");
    if (!icon) return;
    icon.className = this._dom.audio.muted
      ? "fas fa-volume-mute"
      : "fas fa-volume-up";
  }

  // ── timeupdate：进度 + 歌词 + 节流保存 ───────────────────

  _onTimeUpdate() {
    const a = this._dom.audio;
    if (!a.duration) return;

    if (Date.now() - this._lastSave > 5000) this._saveState();

    this._updateProgress(a.currentTime / a.duration * 100);

    if (this.state.needResume || !this.state.lyrics.length) return;
    const i = findLyricIndex(this.state.lyrics, a.currentTime);
    if (i >= 0) {
      this._dom.lyricCurrent.textContent = this.state.lyrics[i].text;
      this._dom.lyricNext.textContent =
        i + 1 < this.state.lyrics.length
          ? this.state.lyrics[i + 1].text
          : "";
    }
  }

  // ── 主题由 store.js mixin 提供（_applyTheme）──────────────

  // ── 错误处理 ──────────────────────────────────────────────

  _onAudioError() {
    const c = this._dom.audio.error?.code;
    const msg =
      { 1: "媒体中止", 2: "网络错误", 3: "解码失败", 4: "源不可用" }[c]
      || "未知错误";
    this._showToast(`播放出错：${msg}`);
  }

  _showToast(msg) {
    let t = this._dom.player.querySelector(".wh-toast");
    if (!t) {
      t = document.createElement("div");
      t.className = "wh-toast";
      this._dom.player.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(
      () => t.classList.remove("show"), 5000);
  }

  /**
   * 切换面板展开/收起；移动端两个面板全宽悬浮于同一位置，
   * 必须互斥（打开一个时收起另一个）；桌面端左右分列，不互斥。
   */
  _togglePanel(panel, other) {
    const mobile = window.matchMedia("(max-width:768px)").matches;
    if (mobile && other.classList.contains("show"))
      other.classList.remove("show");
    panel.classList.toggle("show");
  }

  // ── 键盘快捷键 ────────────────────────────────────────────

  _onKeydown(e) {
    if (["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)) return;
    // #10：多实例守卫——同页存在多个播放器时，仅当事件源落在本播放器
    // 内部才响应；单实例时保持全页快捷键（含 body / document 上按键）。
    if (_registry.length > 1 &&
        !this._dom.player.contains(e.target)) return;
    const a = this._dom.audio;
    switch (e.code) {
      case "Space":
        e.preventDefault();
        this._togglePlay();
        break;
      case "ArrowRight":
        if (!Number.isFinite(a.duration)) break;
        a.currentTime = Math.min(a.duration, a.currentTime + 5);
        break;
      case "ArrowLeft":
        a.currentTime = Math.max(0, a.currentTime - 5);
        break;
      case "ArrowUp":
        e.preventDefault();
        this._setVolume(Math.min(1, a.volume + 0.1));
        break;
      case "ArrowDown":
        e.preventDefault();
        this._setVolume(Math.max(0, a.volume - 0.1));
        break;
      case "KeyM":
        // #9：与 Space/方向键一致，阻止默认行为
        e.preventDefault();
        this._toggleMute();
        break;
    }
  }

  // ── 图标 ──────────────────────────────────────────────────

  _setPlayIcon(playing) {
    this._dom.playBtn.innerHTML =
      `<i class="fas fa-${playing ? "pause" : "play"}"></i>`;
  }

  // ── 销毁（SPA 路由卸载时调用）───────────────────────────

  destroy() {
    clearTimeout(this._toastTimer);
    this._cancelFade();                       // 取消进行中的交叉淡化动画
    this._listeners.forEach(({ target, type, fn, opts }) =>
      target.removeEventListener(type, fn, opts));
    this._listeners = [];
    this._drag = null;                       // #8：清理拖拽状态
    this._dom.player.querySelector(".wh-toast")?.remove();  // #8：移除 toast
    this._dom.audio.pause();
    this._dom.audio.removeAttribute("src");
    this._dom.audio.load();
    // #10：从同页实例表注销
    const i = _registry.indexOf(this);
    if (i !== -1) _registry.splice(i, 1);
  }
}

// 应用各 mixin（顺序无依赖冲突）
applyStoreMixin(WishPlayer);
applyProgressMixin(WishPlayer);
applyDragMixin(WishPlayer);
applyPlaylistMixin(WishPlayer);

// ── 导出 ────────────────────────────────────────────────────

export { WishPlayer };

// ── 自动初始化（浏览器环境）────────────────────────────────

if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", () => {
    const root =
      document.querySelector("[data-wh-player]")
      || document.getElementById("wh-player");
    if (!root) return;

    // 从 musicSource 推导默认封面路径（music.json 同级的 covers/default-cover.jpg），
    // 使 drop-in 空 div 无需再手写 fallbackCover。
    const musicSource = root.dataset.musicSource || "wh_player/music.json";
    const musicDir = musicSource.slice(0, musicSource.lastIndexOf("/"))
      || ".";
    window.whPlayer = new WishPlayer(root, {
      musicSource,
      fallbackCover: `${musicDir}/covers/default-cover.jpg`,
    });
  });
  window.WishPlayer = WishPlayer;
}
