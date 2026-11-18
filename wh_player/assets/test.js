/**
 * 纯函数冒烟测试
 * 运行：node wh_player/assets/test.js
 * 只测试无 DOM 依赖的模块（lyrics / utils），
 * mixin 与类主体需要浏览器环境，不在 Node 中验证。
 */

import assert from "node:assert/strict";
import { parseLrc, findLyricIndex } from "./lyrics.js";
import { THEMES, isValidTheme, pickRandom } from "./utils.js";

// ── parseLrc ────────────────────────────────────────────────

// 基本解析
const basic = parseLrc("[00:01.00]你好\n[00:03.50]世界");
assert.deepEqual(basic, [
  { time: 1, text: "你好" },
  { time: 3.5, text: "世界" },
]);

// 未排序输入 → 输出按时间排序
const unsorted = parseLrc("[01:00.00]后\n[00:05.00]前");
assert.deepEqual(unsorted.map((l) => l.text), ["前", "后"]);

// 一行多时间戳
const multi = parseLrc("[00:01.00][00:02.00]重复行");
assert.equal(multi.length, 2);
assert.equal(multi[0].text, "重复行");
assert.equal(multi[1].text, "重复行");

// 元数据行跳过
const meta = parseLrc("[ar:Someone]\n[ti:Song]\n[00:01.00]歌词");
assert.equal(meta.length, 1);
assert.equal(meta[0].text, "歌词");

// 空 / null
assert.deepEqual(parseLrc(""), []);
assert.deepEqual(parseLrc(null), []);

// ── findLyricIndex ──────────────────────────────────────────

const lyrics = [
  { time: 0, text: "a" },
  { time: 5, text: "b" },
  { time: 10, text: "c" },
];

assert.equal(findLyricIndex(lyrics, 0), 0);
assert.equal(findLyricIndex(lyrics, 4.99), 0);
assert.equal(findLyricIndex(lyrics, 5), 1);
assert.equal(findLyricIndex(lyrics, 9.99), 1);
assert.equal(findLyricIndex(lyrics, 10), 2);
assert.equal(findLyricIndex(lyrics, 99), 2);
assert.equal(findLyricIndex([], 5), -1);

// ── pickRandom ──────────────────────────────────────────────

assert.equal(pickRandom(0, 1), 0);
assert.equal(pickRandom(0, 0), 0);
for (let i = 0; i < 200; i++) {
  const r = pickRandom(3, 10);
  assert.ok(r >= 0 && r < 10, `pickRandom 越界: ${r}`);
  assert.notEqual(r, 3, "pickRandom 不应返回当前索引");
}

// ── THEMES / isValidTheme ───────────────────────────────────

assert.ok(isValidTheme("sky"));
assert.ok(isValidTheme("mint"));
assert.ok(!isValidTheme("forty"), "幽灵主题名 forty 应被拒绝");
assert.ok(!isValidTheme(undefined));
assert.equal(Object.keys(THEMES).length, 6);
for (const [name, t] of Object.entries(THEMES)) {
  assert.ok(/^#[0-9a-f]{6}$/i.test(t.accent), `主题 ${name} 颜色格式非法`);
}

console.log("✓ 全部测试通过（parseLrc / findLyricIndex / pickRandom / THEMES）");
