let playlist = [];
let lyrics = [];
let current = 0;
let randomMode = true;
let seeking = false;
let needResume = false;

const audio = document.getElementById("audio");
const cover = document.getElementById("cover");
const record = document.querySelector(".record");
const songName = document.getElementById("song-name");
const songArtist = document.getElementById("song-artist");
const progressBar = document.getElementById("progress-bar");
const progressFill = document.getElementById("progress-fill");
const playBtn = document.getElementById("play");
const prevBtn = document.getElementById("prev");
const nextBtn = document.getElementById("next");
const themeBtn = document.getElementById("theme-btn");
const themePanel = document.getElementById("theme-panel");
const playlistBtn = document.getElementById("playlist-btn");
const playlistPanel = document.getElementById("playlist-panel");

const lyricCurrent = document.getElementById("lyric-current");
const lyricNext = document.getElementById("lyric-next");

function restorePlayerState() {

    const state =
        JSON.parse(
            localStorage.getItem("wh-player-state")
        );

    if (!state) return false;

    if (state.current >= playlist.length) {
        return false;
    }

    loadSong(state.current);

    audio.addEventListener(
        "loadedmetadata",
        () => {

            audio.currentTime =
                state.currentTime || 0;

            if (!state.paused) {
                audio.play()
                    .then(() => {
                        playBtn.innerHTML = '<i class="fas fa-pause"></i>';
                        record.classList.add("playing");
                    })

                    .catch(() => {
                        needResume = true;
                        // 浏览器禁止自动播放
                        playBtn.innerHTML = '<i class="fas fa-play"></i>';
                        record.classList.remove("playing");
                        lyricCurrent.textContent = "▶ 点击继续收听";
                        lyricNext.textContent = `${song.name} · ${song.artist}`;
                    });
            }

        },
        { once: true }
    );

    return true;
}

fetch("wh_player/music.json")
    .then(response => {

        if (!response.ok) {
            throw new Error(
                "music.json not found"
            );
        }

        return response.json();
    })
    .then(data => {

        playlist = data;

        renderPlaylist();
        const restored = restorePlayerState();

        if (!restored && playlist.length) {

            loadSong(0);
        }
    })
    .catch(() => {

        showInitMessage();
    });

function showInitMessage() {

    playlistPanel.innerHTML = `

        <div
            style="
            padding:16px;
            color:white;
            font-size:12px;
            line-height:1.6;">

            <strong>
                未发现 music.json
            </strong>

            <br><br>

            请执行：

            <pre>
python generate_music_json.py
            </pre>

            然后刷新页面。
            <br>
            详细信息参照README。

        </div>

    `;
}

function loadSong(index) {
    current = index;
    const song = playlist[index];

    cover.src =
        song.cover ||
        "images/default-cover.jpg";

    songName.textContent =
        `${song.name} · ${song.artist}`;

    audio.src = song.url;

    lyrics = [];

    if (song.lrc) {
        fetch(song.lrc)
            .then(r => r.text())
            .then(text => {
                lyrics = parseLrc(text);
            });
        lyricCurrent.textContent = `${song.name} - ${song.artist}`;
    } else {
        lyricCurrent.textContent = "暂无歌词"
    }

    lyricNext.textContent = `${song.name} - ${song.artist}`

    highlightPlaylist();
}

function parseLrc(text) {

    const result = [];

    const lines = text.split(/\r?\n/);

    for (const line of lines) {

        // 匹配：
        // [00:12.50]歌词
        // [01:05.30]歌词
        const matches = [
            ...line.matchAll(/\[(\d+):(\d+(?:\.\d+)?)\]/g)
        ];

        if (!matches.length) {
            continue;
        }

        const lyricText = line
            .replace(/\[(\d+):(\d+(?:\.\d+)?)\]/g, "")
            .trim();

        for (const match of matches) {

            const minute = Number(match[1]);
            const second = Number(match[2]);

            if (
                Number.isNaN(minute) ||
                Number.isNaN(second)
            ) {
                continue;
            }

            result.push({
                time: minute * 60 + second,
                text: lyricText
            });
        }
    }

    return result.sort(
        (a, b) => a.time - b.time
    );
}

function updateLyrics(currentTime) {

    if (needResume) return;

    if (!lyrics.length) return;

    for (
        let i = lyrics.length - 1;
        i >= 0;
        i--
    ) {
        if (currentTime >= lyrics[i].time) {
            lyricCurrent.textContent = lyrics[i].text || "";
            lyricNext.textContent =
                i < lyrics.length - 1 ? lyrics[i + 1].text : "";
            break;
        }
    }
}

function playSong() {
    needResume = false;
    audio.play();
    playBtn.innerHTML =
        '<i class="fas fa-pause"></i>';
    document.querySelector(".record").classList.add("playing");
}

function pauseSong() {
    audio.pause();
    playBtn.innerHTML =
        '<i class="fas fa-play"></i>';
    document.querySelector(".record").classList.remove("playing");
}

playBtn.onclick = () => {
    if (audio.paused) {
        playSong();
    } else {
        pauseSong();
    }
};

prevBtn.onclick = () => {
    current--;

    if (current < 0) {
        current = playlist.length - 1;
    }

    loadSong(current);
    playSong();
};

nextBtn.onclick = nextSong;

function nextSong() {
    if (randomMode) {
        current = Math.floor(
            Math.random() * playlist.length
        );
    } else {
        current++;
        if (current >= playlist.length) {
            current = 0;
        }
    }

    loadSong(current);
    playSong();
}

audio.addEventListener(
    "ended",
    nextSong
);

function savePlayerState() {
    localStorage.setItem(
        "wh-player-state",
        JSON.stringify({
            current,
            currentTime: audio.currentTime,
            paused: audio.paused
        })
    );
}

window.addEventListener(
    "beforeunload",
    savePlayerState
);

audio.addEventListener(
    "timeupdate",
    () => {
        if (!audio.duration)
            return;

        savePlayerState();

        const current = audio.currentTime;
        updateLyrics(current)

        const percent =
            audio.currentTime /
            audio.duration * 100;

        progressFill.style.width =
            percent + "%";
    }
);

const themes = {

    sky: {
        accent: "#6fc3df"
    },

    lavender: {
        accent: "#8d82c4"
    },

    coral: {
        accent: "#ec8d81"
    },

    sand: {
        accent: "#e7b788"
    },

    aurora: {
        accent: "#8ea9e8"
    },

    mint: {
        accent: "#87c5a4"
    }
};

document
    .querySelectorAll(".theme-item")
    .forEach(item => {

        item.onclick = () => {

            applyTheme(
                item.dataset.theme
            );
        };

    });

const savedTheme =
    localStorage.getItem(
        "player-theme"
    );

applyTheme(
    savedTheme || "forty"
);

function applyTheme(themeName) {

    const theme = themes[themeName];

    if (!theme) return;

    // document.documentElement.style.setProperty(
    //     "--player-bg",
    //     theme.bg
    // );

    document.documentElement.style.setProperty(
        "--accent",
        theme.accent
    );

    localStorage.setItem(
        "player-theme",
        themeName
    );
}

themeBtn.onclick = () => {
    themePanel.classList.toggle("show");
};

function renderPlaylist() {

    playlistPanel.innerHTML = "";

    playlist.forEach((song, index) => {

        const item = document.createElement("div");

        item.className = "playlist-item";

        item.innerHTML = `
            <span class="track-title">
                ${song.name} - ${song.artist}
            </span>
        `;

        item.onclick = () => {
            loadSong(index);
            playSong();
        };

        playlistPanel.appendChild(item);
    });
}

function highlightPlaylist() {

    document
        .querySelectorAll(".playlist-item")
        .forEach((item, index) => {
            item.classList.toggle(
                "active",
                index === current
            );
        });
}

playlistBtn.onclick = () => {
    playlistPanel.classList.toggle("show");
};

progressBar.addEventListener(
    "click",
    (e) => {

        if (!audio.duration)
            return;

        const rect =
            progressBar
                .getBoundingClientRect();

        const percent =
            (e.clientX - rect.left)
            / rect.width;

        audio.currentTime =
            audio.duration * percent;
    }
);

progressBar.addEventListener(
    "mousedown",
    () => {
        seeking = true;
    }
);

document.addEventListener(
    "mousemove",
    (e) => {

        if (
            !seeking ||
            !audio.duration
        ) {
            return;
        }

        const rect =
            progressBar
                .getBoundingClientRect();

        let percent =
            (e.clientX - rect.left)
            / rect.width;

        percent =
            Math.max(
                0,
                Math.min(1, percent)
            );

        audio.currentTime =
            audio.duration * percent;
    }
);

document.addEventListener(
    "mouseup",
    () => {

        seeking = false;
    }
);

// =========================
// 拖动播放器
// =========================

const player =
    document.getElementById(
        "wh-player"
    );

const dragHandle =
    document.querySelector(
        ".meta"
    );

let isDragging = false;
let offsetX = 0;
let offsetY = 0;

// 恢复位置

const savedPosition =
    localStorage.getItem(
        "player-position"
    );

if (savedPosition) {

    const pos =
        JSON.parse(savedPosition);

    player.style.left =
        pos.left;

    player.style.top =
        pos.top;

    player.style.right =
        "auto";

    player.style.bottom =
        "auto";
}

dragHandle.addEventListener(
    "mousedown",
    (e) => {

        isDragging = true;

        const rect =
            player.getBoundingClientRect();

        offsetX =
            e.clientX - rect.left;

        offsetY =
            e.clientY - rect.top;

        player.style.right =
            "auto";

        player.style.bottom =
            "auto";
    }
);

document.addEventListener(
    "mousemove",
    (e) => {

        if (!isDragging)
            return;

        player.style.left =
            `${e.clientX - offsetX}px`;

        player.style.top =
            `${e.clientY - offsetY}px`;
    }
);

document.addEventListener(
    "mouseup",
    () => {

        if (!isDragging)
            return;

        isDragging = false;

        localStorage.setItem(
            "player-position",
            JSON.stringify({

                left:
                    player.style.left,

                top:
                    player.style.top
            })
        );
    }
);