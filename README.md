<div align="center">

<img src="macos/assets/AppIcon.svg" alt="See-AgentFlow 图标：黑底上一条白色的八字莫比乌斯环" width="128">

# See-AgentFlow

**看见你的 AI Agent 正在做什么。**

本机 Codex 与 Claude Code 的实时调度中心。只读、纯本地、不碰模型请求，<br>
可以悬浮在桌面，也可以铺满两台显示器。

[![CI](https://github.com/JASON-QWeb/See-AgentFlow/actions/workflows/ci.yml/badge.svg)](https://github.com/JASON-QWeb/See-AgentFlow/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/JASON-QWeb/See-AgentFlow)](https://github.com/JASON-QWeb/See-AgentFlow/releases/latest)

**[下载 macOS 版](https://github.com/JASON-QWeb/See-AgentFlow/releases/latest)**

<img src="docs/images/hero-linked-displays.jpg" alt="两台显示器共同显示一条跨屏的八字莫比乌斯日志环，流线向两侧分发" width="100%">

</div>

## 调度中心

![单屏调度中心：左侧为指标和会话列表，中间是弧形日志瀑布，流线从会话汇入三个端口后向右分发](docs/images/single-display.jpg)

会话、工具调用和输出汇成一条流动的日志环。流量涌入时核心加速，停下后缓缓滑行，屏幕上的数字和文字都来自你本机的真实记录。

## 双屏联动

![动图：两块屏幕上同步流动的八字莫比乌斯环，中间黑色竖条代表显示器边框](docs/images/linked-loop.webp)

接上第二台显示器，屏保会把两块屏幕拼成一个画布，日志环跨过边框，按同一个时钟流动。只剩一块屏幕时自动回到单屏布局。

## 桌面悬浮窗

![悬浮窗浮在终端窗口之上，显示收起面板后的紧凑看板](docs/images/floating-window.jpg)

无标题栏、可自由缩放、默认置顶。窗口变小时自动收起下方面板，把空间留给动画。

## 事件控制台

![事件控制台：左侧为可搜索的事件列表，右侧显示所选事件的完整内容](docs/images/event-console.jpg)

搜索最近事件，查看完整内容和原始 JSON，或下载整个会话的原始日志。

## 三套主题

![同一画面的三段主题：Mint Terminal、Silver Stream、White Signal](docs/images/themes.jpg)

Mint Terminal、Silver Stream、White Signal。界面支持 English、简体中文和繁體中文，你的日志始终保留原文。

## 开始使用

**macOS App**（Apple Silicon，macOS 26+）：从 [Releases](https://github.com/JASON-QWeb/See-AgentFlow/releases/latest) 下载 DMG，按发布说明安装，不需要另装 Node。

**浏览器**（Node.js 22+）：

```bash
npm install
npm run build
npm start
```

然后打开 <http://127.0.0.1:4318>。更多内容见[技术细节](docs/TECHNICAL.md)。

## 只读，且只在本机

不读取认证信息，不修改 Codex / Claude 的日志和配置，不装 hooks，不走代理。服务只绑定 `127.0.0.1`，运行时不依赖任何外部服务。

---

<sub>双屏实景和悬浮窗的桌面环境为合成效果，屏幕内容是真实渲染；所有配图均使用虚构的示例日志。</sub>
