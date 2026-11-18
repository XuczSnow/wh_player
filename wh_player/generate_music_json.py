#!/usr/bin/env python3
"""
generate_music_json.py — 扫描 wh_player/music/，生成 music.json
依赖：pip install mutagen  （见 requirements.txt）
"""

from pathlib import Path
import json
import re

from mutagen import File
from mutagen.id3 import APIC, USLT
from mutagen.flac import FLAC
from mutagen.oggvorbis import OggVorbis

MUSIC_DIR  = Path("wh_player/music")
COVER_DIR  = Path("wh_player/covers")
LRC_DIR    = Path("wh_player/lyrics")
JSON_PATH  = Path("wh_player/music.json")

SUPPORTED_EXTS = {".mp3", ".flac", ".m4a", ".aac", ".ogg", ".wav"}

# 确保目录存在
for d in (MUSIC_DIR, COVER_DIR, LRC_DIR):
    d.mkdir(parents=True, exist_ok=True)

# ── 工具函数 ─────────────────────────────────────────────────

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
            return str(v).strip() or default
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
    只保留含 [mm:ss.xx] 时间戳的行；无时间戳的纯文本行直接丢弃。
    """
    out = []
    for line in content.splitlines():
        line = line.strip()
        if not line:
            continue
        stamps = list(re.finditer(r"\[(\d+:\d+(?:\.\d+)?)\]", line))
        if not stamps:
            continue
        lyric = re.sub(r"\[\d+:\d+(?:\.\d+)?\]", "", line).strip()
        if lyric:
            out.append(f"{stamps[0].group()}{lyric}")
    return "\n".join(out)


def extract_cover(audio, stem: str) -> str:
    """
    提取专辑封面，保存为 wh_player/covers/<stem>.jpg。
    支持 FLAC / MP3(APIC) / M4A(covr)。
    返回 POSIX 相对路径，若无封面返回空串。
    """
    cover_file = COVER_DIR / f"{stem}.jpg"

    # FLAC
    if isinstance(audio, FLAC) and audio.pictures:
        if not cover_file.exists():
            cover_file.write_bytes(audio.pictures[0].data)
        return cover_file.as_posix()

    # MP3 / M4A 等通用 APIC / covr
    tags = getattr(audio, "tags", None)
    if tags:
        for tag in tags.values():
            if isinstance(tag, APIC):
                if not cover_file.exists():
                    cover_file.write_bytes(tag.data)
                return cover_file.as_posix()

        # M4A / MP4 专用 covr 字段
        covr = tags.get("covr")
        if covr:
            raw = covr[0] if isinstance(covr, (list, tuple)) else covr
            if not cover_file.exists():
                cover_file.write_bytes(bytes(raw))
            return cover_file.as_posix()

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
            lrc_path = lrc_file.as_posix()

        songs.append({
            "name":    title,
            "artist":  artist,
            "album":   album,
            "cover":   cover,
            "url":     (MUSIC_DIR / f.name).as_posix(),   # ← POSIX 路径
            "lrc":     lrc_path,
        })

        print(f"  ✓  {title}")

    except Exception as e:
        print(f"  ✗  {f.name}  {e}")

with open(JSON_PATH, "w", encoding="utf-8") as fp:
    json.dump(songs, fp, ensure_ascii=False, indent=2)

print(f"\n共生成 {len(songs)} 首歌曲 → {JSON_PATH}")
