/**
 * Wish House Player v2.3 — 入口模块
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

// ── 组装类原型 ───────────────────────────────────────────────

class WishPlayer {

  /**
   * @param {HTMLElement} root  播放器根元素（#wh-player）
   * @param {object}      cfg   可选配置
   * @param {string}      [cfg.musicSource]   music.json 路径
   * @param {string}      [cfg.fallbackCover] 默认封面路径
   * @param {string}      [cfg.defaultTheme]  默认主题名
   * @param {string}      [cfg.storagePrefix] localStorage 前缀
   */
  constructor(root, cfg = {}) {
    this.root = root;
    this.cfg = Object.freeze({
      musicSource:   "wh_player/music.json",
      fallbackCover: "wh_player/covers/default-cover.jpg",
      defaultTheme:  "sky",
      storagePrefix: "wh-player",
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

    this._buildDom();
    this._bindEvents();
    this._init();
  }

  // ── DOM 引用（全部相对 root 查找）────────────────────────

  _buildDom() {
    const q = (s) => this.root.querySelector(s);
    const d = (this._dom = {});

    d.audio         = q("#audio");
    d.cover         = q("#cover");
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
      this._loadSong(Number(item.dataset.index));
      this._play();
    });

    // 音频事件
    this._on(a, "ended",      () => this._next());
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
          if (!r.ok) throw new Error(r.status);
          return r.text();
        })
        .then(text => {
          // 竞态守卫：已切到其他歌曲时丢弃过期响应
          if (this.state.current !== idx) return;
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
    this._dom.audio.play().catch(() => {
      this.state.needResume = true;
      this._setPlayIcon(false);
      this._dom.record.classList.remove("playing");
    });
    this._setPlayIcon(true);
    this._dom.record.classList.add("playing");
  }

  _pause() {
    this._dom.audio.pause();
    this._setPlayIcon(false);
    this._dom.record.classList.remove("playing");
  }

  _togglePlay() {
    this._dom.audio.paused ? this._play() : this._pause();
  }

  _next() {
    const n = this.state.playlist.length;
    if (!n) return;
    this.state.current = this.state.randomMode
      ? pickRandom(this.state.current, n)
      : (this.state.current + 1) % n;
    this._loadSong(this.state.current);
    this._play();
  }

  _prev() {
    const n = this.state.playlist.length;
    if (!n) return;
    this.state.current = (this.state.current - 1 + n) % n;
    this._loadSong(this.state.current);
    this._play();
  }

  _toggleRandom() {
    this.state.randomMode = !this.state.randomMode;
    this._dom.randomBtn?.classList.toggle("active", this.state.randomMode);
    if (this._dom.randomBtn)
      this._dom.randomBtn.title =
        this.state.randomMode ? "随机播放" : "顺序播放";
  }

  _setVolume(v) {
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
      ? "fas fa-volume-xmark"
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
    this._listeners.forEach(({ target, type, fn, opts }) =>
      target.removeEventListener(type, fn, opts));
    this._listeners = [];
    this._dom.audio.pause();
    this._dom.audio.removeAttribute("src");
    this._dom.audio.load();
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
    window.whPlayer = new WishPlayer(root, {
      musicSource: root.dataset.musicSource || "wh_player/music.json",
    });
  });
  window.WishPlayer = WishPlayer;
}
