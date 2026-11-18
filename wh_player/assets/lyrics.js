/**
 * LRC 歌词解析 — 纯函数，无 DOM 依赖
 * 可在 Node.js 中单独测试：
 *   import { parseLrc } from './wh_player/assets/lyrics.js';
 */

/**
 * 解析 LRC 字符串 → 按时间排序的 [{ time, text }, …]
 * 元数据行 [ar:] [ti:] [offset:] 等不含 [mm:ss.xx] 时间戳，自动跳过。
 * @param {string} raw LRC 文本
 * @returns {{ time: number, text: string }[]}
 */
export function parseLrc(raw) {
  const out = [];
  if (!raw) return out;
  for (const line of raw.split(/\r?\n/)) {
    const stamps = [...line.matchAll(/\[(\d+):(\d+(?:\.\d+)?)\]/g)];
    if (!stamps.length) continue;
    const text = line.replace(/\[\d+:\d+(?:\.\d+)?\]/g, "").trim();
    if (!text) continue;
    for (const m of stamps) {
      const min = Number(m[1]), sec = Number(m[2]);
      if (Number.isNaN(min) || Number.isNaN(sec)) continue;
      out.push({ time: min * 60 + sec, text });
    }
  }
  return out.sort((a, b) => a.time - b.time);
}

/**
 * 二分查找：最后一个 time ≤ t 的歌词下标，无则 -1
 * @param {{time:number}[]} lyrics 已排序歌词数组
 * @param {number} t 当前时间（秒）
 * @returns {number}
 */
export function findLyricIndex(lyrics, t) {
  let lo = 0, hi = lyrics.length - 1, ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (lyrics[mid].time <= t) { ans = mid; lo = mid + 1; }
    else hi = mid - 1;
  }
  return ans;
}
