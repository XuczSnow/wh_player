/**
 * 常量与工具函数 — 纯逻辑，无 DOM 依赖，Node.js 可直接 import 测试
 */

// ── 主题定义 ─────────────────────────────────────────────────
// 主题切换只改 CSS 变量 --wh-accent，无需重绘 DOM

export const THEMES = Object.freeze({
  sky:      { accent: "#6fc3df" },
  lavender: { accent: "#8d82c4" },
  coral:    { accent: "#ec8d81" },
  sand:     { accent: "#e7b788" },
  aurora:   { accent: "#8ea9e8" },
  mint:     { accent: "#87c5a4" },
});

/** 判断主题名是否有效 */
export function isValidTheme(name) {
  return Boolean(THEMES[name]);
}

// ── 工具函数 ─────────────────────────────────────────────────

/**
 * 随机选曲（排除 current），length ≤ 1 时返回 0
 * @param {number} current 当前索引
 * @param {number} len 播放列表长度
 * @returns {number}
 */
export function pickRandom(current, len) {
  if (len <= 1) return 0;
  let i;
  do { i = (Math.random() * len) | 0; } while (i === current);
  return i;
}
