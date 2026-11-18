/**
 * 播放器拖拽 mixin — Pointer Events（仅桌面端）
 * 拖拽句柄：.player_content .meta
 * 位置通过 localStorage 持久化（见 store.js 的 _savePosition）
 */

export function applyDragMixin(WishPlayer) {

  WishPlayer.prototype._dragStart = function (e) {
    if (window.matchMedia("(max-width:768px)").matches) return;
    e.preventDefault();
    const r = this._dom.player.getBoundingClientRect();
    this._drag = { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  WishPlayer.prototype._dragMove = function (e) {
    if (!this._drag) return;
    const left = e.clientX - this._drag.x;
    const top  = e.clientY - this._drag.y;
    const p = this._dom.player;
    p.style.left  = "auto";
    p.style.top   = "auto";
    p.style.right  = Math.max(0, Math.min(
      window.innerWidth - left - p.offsetWidth,
      window.innerWidth - p.offsetWidth)) + "px";
    p.style.bottom = Math.max(0, Math.min(
      window.innerHeight - top - p.offsetHeight,
      window.innerHeight - p.offsetHeight)) + "px";
  };

  WishPlayer.prototype._dragEnd = function () {
    if (!this._drag) return;
    this._drag = null;
    this._savePosition();
  };
}
