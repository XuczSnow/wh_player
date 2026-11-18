/**
 * 播放列表 mixin — 渲染、高亮、事件委托
 * 通过事件委托（不在每项上绑定 onclick），歌曲数量多时内存友好
 */

export function applyPlaylistMixin(WishPlayer) {

  /** 重新渲染播放列表面板 */
  WishPlayer.prototype._renderPlaylist = function () {
    const panel = this._dom.playlistPanel;
    panel.innerHTML = "";
    this.state.playlist.forEach((song, i) => {
      const el = document.createElement("div");
      el.className = "playlist-item";
      el.dataset.index = i;
      el.textContent = `${song.name} - ${song.artist}`;
      panel.appendChild(el);
    });
    this._highlightPlaylist();
  };

  /** 高亮当前歌曲并滚动到可视区 */
  WishPlayer.prototype._highlightPlaylist = function () {
    this._dom.playlistPanel.querySelectorAll(".playlist-item")
      .forEach((el, i) => {
        const on = i === this.state.current;
        el.classList.toggle("active", on);
        if (on) el.scrollIntoView({ block: "nearest" });
      });
  };
}
