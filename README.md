# 🎵 Wish House Player

一个专为个人主页打造的 Fluent Design 风格悬浮音乐播放器，基于 HTML5 Audio 构建，支持歌词、黑胶动画、主题切换、播放列表与位置记忆。

<div align="center">

![Version](https://img.shields.io/badge/version-2.0-blue)
![HTML5](https://img.shields.io/badge/HTML5-orange)
![JavaScript](https://img.shields.io/badge/JavaScript-yellow)
![MIT](https://img.shields.io/badge/license-MIT-green)

</div>

## ✨ Preview

### 播放器

### 播放列表

## 🚀 Features

### 🎼 播放功能

- 播放 / 暂停
- 上一首 / 下一首
- 自动连续播放
- 播放进度同步
- 点击跳转进度
- 拖动进度条

### 🎤 歌词系统

- LRC歌词
- 内嵌歌词提取
- 歌词同步
- 当前歌词高亮
- 下一句预览

### 💿 专辑封面

支持：

- MP3封面
- FLAC封面
- M4A封面
- OGG封面

特性：

- 黑胶唱片效果
- 圆形封面
- 播放时旋转
- 主题色发光效果

### 🎨 主题系统

内置六套主题：

| Theme         | Color   |
|---------------|---------|
| Sky Blue      | #6fc3df |
| Lavender Mist | #8d82c4 |
| Coral Sunset  | #ec8d81 |
| Golden Sand   | #e7b788 |
| Aurora Blue   | #8ea9e8 |
| Mint Green    | #87c5a4 |

### 📑 播放列表

- 当前歌曲高亮
- 平滑弹出动画
- 毛玻璃背景
- 自动滚动
- 点击切换歌曲

### 🖱️ 拖动与记忆

- 播放器支持自由拖动

### ✅ 刷新页面保存进度

刷新页面同时会保存以下进度，以保证多页面使用:

- 当前歌曲
- 播放进度
- 播放状态
- 播放器位置
- 当前主题

## 📄 music.json

```json
[
  {
    "name": "七里香",
    "artist": "周杰伦",
    "cover": "covers/七里香.jpg",
    "url": "music/七里香.flac",
    "lrc": "lyrics/七里香.lrc"
  }
]
```

## 🐍 音乐库生成

项目提供 Python 脚本自动扫描:

```shell
python generate_music_json.py
```

自动提取：

歌曲名、歌手、专辑、封面、歌词

生成：

```
covers/
lyrics/
music.json
```

## 集成建议

### 1. 引入CCS及JS

```html
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/css/all.min.css" />
<link rel="stylesheet" href="wh_player/assets/player.css" />
```

```html
<script src="wh_player/assets/player.js"></script>
```


### 2. 增加HTML组件

```html
	<div id="wh-player">
		<div class="record">
			<img id="cover" src="wh_player/covers/default-cover.jpg" altnfo>
		</div>
		<div class="plyer_content">
			<div class="meta">
				<div id="song-name">未播放</div>
				<div id="lyrics-container">
					<div id="lyric-current">暂无歌词</div>
					<div id="lyric-next"></div>
				</div>
			</div>

			<div class="progress-wrap">
				<div id="progress-bar">
					<div id="progress-fill"></div>
				</div>
			</div>

			<div class="controls">
				<button id="prev">
					<i class="fas fa-step-backward"></i>
				</button>

				<button id="play">
					<i class="fas fa-play"></i>
				</button>

				<button id="next">
					<i class="fas fa-step-forward"></i>
				</button>

				<button id="theme-btn">
					<i class="fas fa-palette"></i>
				</button>

				<button id="playlist-btn">
					<i class="fas fa-list"></i>
				</button>
			</div>
		</div>
		<div id="theme-panel">

			<div class="theme-item" data-theme="sky">
				<span class="theme-color sky"></span>
				Sky Blue
			</div>

			<div class="theme-item" data-theme="lavender">
				<span class="theme-color lavender"></span>
				Lavender Mist
			</div>

			<div class="theme-item" data-theme="coral">
				<span class="theme-color coral"></span>
				Coral Sunset
			</div>

			<div class="theme-item" data-theme="sand">
				<span class="theme-color sand"></span>
				Golden Sand
			</div>

			<div class="theme-item" data-theme="aurora">
				<span class="theme-color aurora"></span>
				Aurora Blue
			</div>

			<div class="theme-item" data-theme="mint">
				<span class="theme-color mint"></span>
				Mint Green
			</div>

		</div>
		<div id="playlist-panel"></div>
	</div>

	<audio id="audio"></audio>
```

### 3.生成音乐库

将音乐放置到music目录下

```shell
python generate_music_json.py
```

生成music.json，以goon给播放器读取

*music下的音乐文件元数据需要包含歌曲名、歌手名等信息，才可以成功提取；如果不知道如何写入音乐元数据，请使用专业音乐播放器如foobar，或者采用[MusicC](https://github.com/XuczSnow/MusicC)批量管理*

### 4.运行主网页

用你喜欢的方式运行主网页
