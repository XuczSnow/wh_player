#!/usr/bin/env python3
"""
generate_music_json.py — 扫描 wh_player/music/，生成 music.json
依赖：pip install mutagen  （见 requirements.txt）

用法（路径基于本脚本位置，可在任意目录运行）：
    python wh_player/generate_music_json.py                 # 默认前缀 wh_player
    python wh_player/generate_music_json.py --prefix modules/wh_player/wh_player
    python wh_player/generate_music_json.py --prefix ""     # 相对页面根目录
"""

import argparse
import sys
from pathlib import Path
import json
import re

from mutagen import File
from mutagen.id3 import APIC, USLT
from mutagen.flac import FLAC
from mutagen.oggvorbis import OggVorbis

# Windows 控制台常为 GBK，无法输出 ✓/✗ 等字符；统一按 UTF-8 输出（容错 replace）
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

# 所有路径基于本脚本所在目录解析，因此可在项目任意位置运行
BASE_DIR   = Path(__file__).resolve().parent
MUSIC_DIR  = BASE_DIR / "music"
COVER_DIR  = BASE_DIR / "covers"
LRC_DIR    = BASE_DIR / "lyrics"

SUPPORTED_EXTS = {".mp3", ".flac", ".m4a", ".aac", ".ogg", ".wav"}

# 解析参数
parser = argparse.ArgumentParser(description="扫描音乐目录生成 music.json")
parser.add_argument("--prefix", default="wh_player",
                    help="输出 JSON 中 url/cover/lrc 路径前缀（默认 wh_player）")
parser.add_argument("--output", default=None,
                    help="输出 JSON 文件路径（默认 wh_player/music.json）")
args = parser.parse_args()

# POSIX 前缀（统一以 / 分隔，空表示不额外加前缀）
PREFIX = args.prefix.strip().replace("\\", "/").rstrip("/")
PREFIX = (PREFIX + "/") if PREFIX else ""

JSON_PATH = Path(args.output) if args.output else (BASE_DIR / "music.json")

# 确保目录存在
for d in (MUSIC_DIR, COVER_DIR, LRC_DIR):
    d.mkdir(parents=True, exist_ok=True)

# ── 工具函数 ─────────────────────────────────────────────────

def clean_tag(value: str) -> str:
    """
    清理 tag 字符串中的非法 / 控制字符。
    mutagen 读取 ID3 多值标签（如 TPE1 多歌手）时，值内部用 NUL(\x00) 分隔，
    直接 str() 会得到 "歌手A\x00歌手B"，浏览器 / JSON 会出现非法 NUL。
    这里把 NUL 归一为 " / "，并剔除其余 C0 控制字符（保留 \\t \\n \\r）。
    用黑名单（codepoint < 0x20）而非 ASCII 白名单，确保中文等非 ASCII 字符保留。
    """
    if not value:
        return ""
    out = value.replace("\x00", " / ")
    out = "".join(ch for ch in out if ch >= " " or ch in "\n\r\t")
    out = re.sub(r"\s+", " ", out).strip()
    return out


def get_tag(tags, *keys, default=""):
    """
    从 mutagen tags dict 中按优先级取第一个非空值。
    keys 可以是 ID3 框架名（TIT2）或通用小写名（title）。
    """
    if not tags:
        return default
    for k in keys:
        v = tags.get(k)
        if v:
            # 列表型 tag（ID3）取第一个元素
            if isinstance(v, (list, tuple)):
                v = v[0]
            return clean_tag(str(v)) or default
    return default


def extract_lyrics(audio) -> str:
    """提取内嵌歌词，支持 FLAC / MP3 / M4A。"""
    try:
        # FLAC: LYRICS 字段
        if isinstance(audio, FLAC) and "LYRICS" in audio:
            lines = audio["LYRICS"]
            if isinstance(lines, (list, tuple)):
                return "\n".join(lines)
            return str(lines)

        tags = getattr(audio, "tags", None)
        if not tags:
            return ""

        # MP3: USLT 框架
        for frame in tags.values():
            if isinstance(frame, USLT):
                return frame.text if isinstance(frame.text, str) else str(frame.text)

        # M4A / MP4: ©lyr 字段
        lyr = tags.get("©lyr")
        if lyr:
            if isinstance(lyr, (list, tuple)):
                lyr = lyr[0]
            return str(lyr)

        # OGG Vorbis: LYRICS 字段
        if isinstance(audio, OggVorbis):
            fields = audio.get("LYRICS", [])
            if fields:
                return "\n".join(fields)

    except Exception as e:
        print(f"  ⚠ 歌词提取失败：{e}")

    return ""


def normalize_lrc(content: str) -> str:
    """
    将原始歌词文本规范为 LRC 行。
    - 保留行首 [mm:ss.xx] 时间戳（若行中还有其它 [mm:ss.xx]，只保留行首这一个）
    - 去掉行中所有 <mm:ss.xx> 逐字时间戳
    - 只保留含 [mm:ss.xx] 时间戳的行
    """
    out = []
    for line in content.splitlines():
        line = line.strip()
        if not line:
            continue
        # 匹配行首 [mm:ss.xx]
        m = re.match(r"\[(\d+:\d+(?:\.\d+)?)\]", line)
        if not m:
            continue
        first_ts = m.group(1)
        rest = line[m.end():]
        # 去掉行中剩余的 [mm:ss.xx]（含与行首重复的）
        rest = re.sub(r"\[\d+:\d+(?:\.\d+)?\]", "", rest)
        # 去掉所有 <mm:ss.xx> 逐字时间戳
        rest = re.sub(r"<\d+:\d+(?:\.\d+)?>", "", rest)
        rest = rest.strip()
        if rest:
            out.append(f"[{first_ts}]{rest}")
        else:
            out.append(f"[{first_ts}]")
    return "\n".join(out)


def extract_cover(audio, stem: str) -> str:
    """
    提取专辑封面，保存为 covers/<stem>.jpg（磁盘）。
    支持 FLAC / MP3(APIC) / M4A(covr)。
    返回 JSON 中使用的逻辑路径（带 PREFIX），若无封面返回空串。
    """
    cover_file = COVER_DIR / f"{stem}.jpg"
    logical = f"{PREFIX}covers/{stem}.jpg"

    # FLAC
    if isinstance(audio, FLAC) and audio.pictures:
        if not cover_file.exists():
            cover_file.write_bytes(audio.pictures[0].data)
        return logical

    # MP3 / M4A 等通用 APIC / covr
    tags = getattr(audio, "tags", None)
    if tags:
        for tag in tags.values():
            if isinstance(tag, APIC):
                if not cover_file.exists():
                    cover_file.write_bytes(tag.data)
                return logical

        # M4A / MP4 专用 covr 字段
        covr = tags.get("covr")
        if covr:
            raw = covr[0] if isinstance(covr, (list, tuple)) else covr
            if not cover_file.exists():
                cover_file.write_bytes(bytes(raw))
            return logical

    return ""


# ── 主流程 ───────────────────────────────────────────────────

songs = []

for f in MUSIC_DIR.rglob("*"):
    if f.suffix.lower() not in SUPPORTED_EXTS:
        continue

    try:
        audio = File(f)
        tags = audio.tags or {}

        title  = get_tag(tags, "TIT2", "title", "©nam", default=f.stem)
        artist = get_tag(tags, "TPE1", "artist", "©ART", default="未知歌手")
        album  = get_tag(tags, "TALB", "album",  "©alb", default="")

        # 封面
        cover = extract_cover(audio, f.stem)

        # 歌词
        raw_lyrics = extract_lyrics(audio)
        norm_lyrics = normalize_lrc(raw_lyrics)
        lrc_path = ""
        if norm_lyrics:
            lrc_file = LRC_DIR / f"{f.stem}.lrc"
            lrc_file.write_text(norm_lyrics, encoding="utf-8")
            lrc_path = f"{PREFIX}lyrics/{f.stem}.lrc"

        songs.append({
            "name":    title,
            "artist":  artist,
            "album":   album,
            "cover":   cover,
            "url":     f"{PREFIX}music/{f.name}",   # ← 逻辑路径（带 PREFIX）
            "lrc":     lrc_path,
        })

        print(f"  ✓  {title}")

    except Exception as e:
        print(f"  ✗  {f.name}  {e}")

with open(JSON_PATH, "w", encoding="utf-8") as fp:
    json.dump(songs, fp, ensure_ascii=False, indent=2)

print(f"\n共生成 {len(songs)} 首歌曲 → {JSON_PATH}")
