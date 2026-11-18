/**
 * 进度条 seek mixin — Pointer Events 统一鼠标 / 触屏
 * 依赖 CSS：#progress-bar { touch-action: none; overflow: visible }
 */

export function applyProgressMixin(WishPlayer) {

  /** 点击/按下进度条 → 开始 seek */
  WishPlayer.prototype._seekStart = function (e) {
    if (!this._dom.audio.duration) return;
    e.preventDefault();
    e.stopPropagation();
    this._seeking = true;
    this._doSeek(e);
  };

  /** 拖动中（由 window pointermove 触发）*/
  WishPlayer.prototype._seekMove = function (e) {
    if (!this._seeking) return;
    this._doSeek(e);
  };

  /** 结束 seek */
  WishPlayer.prototype._seekEnd = function () {
    this._seeking = false;
  };

  /** 根据 clientX 计算百分比并设置 currentTime */
  WishPlayer.prototype._doSeek = function (e) {
    const a = this._dom.audio;
    if (!a.duration) return;
    const r = this._dom.progressBar.getBoundingClientRect();
    const p = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    a.currentTime = a.duration * p;
    this._updateProgress(p * 100);
  };

  /**
   * 统一进度渲染：填充宽度 + 零值隐藏圆点 + aria-valuenow 同步
   * @param {number} pct 0–100
   */
  WishPlayer.prototype._updateProgress = function (pct) {
    pct = Math.max(0, Math.min(100, pct));
    const fill = this._dom.progressFill;
    fill.style.width = pct + "%";
    fill.classList.toggle("is-zero", pct === 0);
    this._dom.progressBar.setAttribute("aria-valuenow", Math.round(pct));
  };
}
