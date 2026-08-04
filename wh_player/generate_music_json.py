from pathlib import Path
from mutagen import File
from mutagen.id3 import APIC
from mutagen.id3 import USLT
from mutagen.flac import FLAC
import json, os

MUSIC_DIR = Path("wh_player/music")
COVER_DIR = Path("wh_player/covers")
LRC_DIR = Path("wh_player/lyrics")
JSON_PATH = Path("wh_player/music.json")

COVER_DIR.mkdir(exist_ok=True)

songs = []

import re

def normalize_lrc(content):

    result = []

    for line in content.splitlines():

        line = line.strip()

        if not line:
            continue

        # 提取所有时间戳
        stamps = list(
            re.finditer(
                r"\[(\d+:\d+(?:\.\d+)?)\]",
                line
            )
        )

        if not stamps:
            continue

        # 第一时间戳
        first_time = stamps[0].group()

        # 去掉所有时间戳
        lyric = re.sub(
            r"\[\d+:\d+(?:\.\d+)?\]",
            "",
            line
        ).strip()

        if lyric:

            result.append(
                f"{first_time}{lyric}"
            )

    return "\n".join(result)

def extract_lyrics(audio):

    try:

        # FLAC
        if isinstance(audio, FLAC):

            if "LYRICS" in audio:
                return "\n".join(
                    audio["LYRICS"]
                )

        # MP3
        if hasattr(audio, "tags"):

            for tag in audio.tags.values():

                if isinstance(tag, USLT):

                    return tag.text

        # M4A
        if hasattr(audio, "tags"):

            if "©lyr" in audio.tags:

                lyric = audio.tags["©lyr"]

                if isinstance(lyric, list):
                    return lyric[0]

                return str(lyric)

    except Exception as e:

        print(
            "歌词提取失败",
            e
        )

    return ""

for f in MUSIC_DIR.iterdir():

    if f.suffix.lower() not in {
        ".mp3", ".flac", ".m4a",
        ".aac", ".ogg", ".wav"
    }:
        continue

    try:
        audio = File(f)
        tags = audio.tags or {}

        title  = str(tags.get("TIT2", [f.stem])[0]) \
                 if isinstance(tags.get("TIT2"), list) \
                 else str(tags.get("TIT2") or tags.get("title",[f.stem])[0])

        artist = str(tags.get("TPE1", ["未知歌手"])[0]) \
                 if isinstance(tags.get("TPE1"), list) \
                 else str(tags.get("TPE1") or tags.get("artist",["未知歌手"])[0])

        album  = str(tags.get("TALB", [""])[0]) \
                 if isinstance(tags.get("TALB"), list) \
                 else str(tags.get("TALB") or tags.get("album",[""])[0])

        cover = ""
        
        lyrics = extract_lyrics(audio)
        lyrics = normalize_lrc(lyrics)
        lrc_path = ""

        if lyrics:
            lrc_file = (LRC_DIR / f"{f.stem}.lrc")
            lrc_file.parent.mkdir(exist_ok=True)
            lrc_file.write_text(lyrics,encoding="utf-8")
            lrc_path = lrc_file.as_posix()


        if isinstance(audio, FLAC) and audio.pictures:

            cover_file = COVER_DIR / f"{f.stem}.jpg"

            if not cover_file.exists():
                cover_file.write_bytes(
                    audio.pictures[0].data
                )

            cover = cover_file.as_posix()

        elif hasattr(audio, "tags"):

            for tag in audio.tags.values():

                if isinstance(tag, APIC):

                    cover_file = COVER_DIR / f"{f.stem}.jpg"

                    if not cover_file.exists():
                        cover_file.write_bytes(
                            tag.data
                        )

                    cover = cover_file.as_posix()
                    break

        songs.append({
            "name": title,
            "artist": artist,
            "album": album,
            "cover": cover,
            "url": f"{MUSIC_DIR}/{f.name}",
            "lrc": lrc_path
        })

        print("✓", title)

    except Exception as e:
        print("✗", f.name, e)

with open(
    JSON_PATH,
    "w",
    encoding="utf-8"
) as fp:

    json.dump(
        songs,
        fp,
        ensure_ascii=False,
        indent=2
    )

print(f"\n生成 {len(songs)} 首歌曲")