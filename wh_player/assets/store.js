/**
 * 持久化 mixin — 管理 localStorage 状态 / 位置 / 主题
 * 通过 this 访问 WishPlayer 实例的 state / dom / cfg
 */

import { THEMES, isValidTheme } from "./utils.js";

export function applyStoreMixin(WishPlayer) {

  /** 应用主题：只改 CSS 变量并持久化 */
  WishPlayer.prototype._applyTheme = function (name) {
    if (!isValidTheme(name)) return;
    document.documentElement.style.setProperty("--wh-accent", THEMES[name].accent);
    localStorage.setItem(this._key("theme"), name);
  };


  /** 带版本后缀的 key */
  WishPlayer.prototype._key = function (n) {
    return `${this.cfg.storagePrefix}-${n}-v1`;
  };

  /** 保存当前播放状态 */
  WishPlayer.prototype._saveState = function () {
    this._lastSave = Date.now();
    localStorage.setItem(this._key("state"), JSON.stringify({
      version:     1,
      current:     this.state.current,
      currentTime: this._dom.audio.currentTime,
      paused:      this._dom.audio.paused,
      // #5：一并持久化音量 / 静音 / 随机模式，刷新后可完整恢复
      volume:      this.state.volume,
      muted:       this.state.muted,
      randomMode:  this.state.randomMode,
    }));
  };

  /** 从 localStorage 恢复播放状态（在 _init 中调用）*/
  WishPlayer.prototype._restoreState = function () {
    try {
      const raw = localStorage.getItem(this._key("state"));
      if (!raw) return false;
      const s = JSON.parse(raw);
      if (s.version !== 1 || s.current >= this.state.playlist.length)
        return false;

      this._loadSong(s.current);

      const a = this._dom.audio;
      // #1：seek + 自动续播。元数据可能已缓存（readyState>=1），此时
      // loadedmetadata 不会再触发，须直接执行；否则才挂一次性事件
      const applyResume = () => {
        a.currentTime = s.currentTime || 0;
        if (!s.paused) {
          a.play().then(() => {
            this._setPlayIcon(true);
            this._dom.record.classList.add("playing");
          }).catch(() => {
            this.state.needResume = true;
            this._setPlayIcon(false);
            this._dom.record.classList.remove("playing");
            // #6：仅在歌词确实为空时提示"点击继续收听"，避免覆盖歌名占位
            if (this.state.lyrics.length === 0)
              this._dom.lyricCurrent.textContent = "▶ 点击继续收听";
          });
        }
      };

      if (a.readyState >= 1) {
        applyResume();
      } else {
        // 走 this._on 注册，destroy() 时自动清理
        this._on(a, "loadedmetadata", applyResume, { once: true });
      }

      // #5：恢复音量 / 随机模式 / 静音
      if (typeof s.volume === "number") this._setVolume(s.volume);
      if (typeof s.randomMode === "boolean") {
        this.state.randomMode = s.randomMode;
        this._dom.randomBtn?.classList.toggle("active", this.state.randomMode);
        if (this._dom.randomBtn)
          this._dom.randomBtn.title =
            this.state.randomMode ? "随机播放" : "顺序播放";
      }
      if (typeof s.muted === "boolean") {
        a.muted = s.muted;
        this.state.muted = s.muted;
        this._updateMuteIcon();
      }

      return true;
    } catch {
      return false;
    }
  };

  /** 保存播放器位置 */
  WishPlayer.prototype._savePosition = function () {
    const r = this._dom.player.getBoundingClientRect();
    localStorage.setItem(this._key("position"), JSON.stringify({
      right:  window.innerWidth  - r.right,
      bottom: window.innerHeight - r.bottom,
    }));
  };

  /** 恢复播放器位置（含类型守卫 + viewport clamp）*/
  WishPlayer.prototype._restorePosition = function () {
    if (window.matchMedia("(max-width:768px)").matches) return;
    try {
      const raw = localStorage.getItem(this._key("position"));
      if (!raw) return;
      const pos = JSON.parse(raw);
      if (typeof pos?.right !== "number" || typeof pos?.bottom !== "number")
        return;

      const p = this._dom.player;
      p.style.left   = "auto";
      p.style.top    = "auto";
      p.style.right  = pos.right + "px";
      p.style.bottom = pos.bottom + "px";

      this._clampToViewport();
    } catch {
      /* 忽略损坏数据 */
    }
  };

  /** 将播放器夹回视口（窗口 resize 后调用）*/
  WishPlayer.prototype._clampToViewport = function () {
    const p = this._dom.player;
    const r = p.getBoundingClientRect();
    if (r.right > window.innerWidth)
      p.style.right = Math.max(0, window.innerWidth - r.width) + "px";
    if (r.bottom > window.innerHeight)
      p.style.bottom = Math.max(0, window.innerHeight - r.height) + "px";
  };

  /** resize 事件入口 */
  WishPlayer.prototype._clampPosition = function () {
    if (window.matchMedia("(max-width:768px)").matches) return;
    this._restorePosition();
  };
}
