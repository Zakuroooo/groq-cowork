# Groq Cowork

A free desktop AI assistant powered by Groq (Llama 3.3 70B) and Composio. Forked and modified from [open-claude-cowork](https://github.com/ComposioHQ/open-claude-cowork) to work with the free Groq API instead of Anthropic.

![Electron](https://img.shields.io/badge/Electron-Desktop-blue)
![Groq](https://img.shields.io/badge/Groq-Llama%203.3%2070B-orange)
![Free](https://img.shields.io/badge/Cost-Free-green)

## What is this?

A full-featured desktop chat app that connects an AI assistant to 500+ real-world tools (Gmail, GitHub, Slack, Notion, Google Drive and more) via Composio. Originally built with Claude Agent SDK — modified to use Groq's free API with Llama 3.3 70B.

## Tech Stack

| Layer | Technology |
|---|---|
| Desktop | Electron.js |
| Backend | Node.js + Express |
| AI Engine | Groq API — Llama 3.3 70B Versatile |
| Tool Integrations | Composio MCP Tool Router |
| Streaming | Server-Sent Events (SSE) |

## Setup

### 1. Clone the repo
```bash
git clone https://github.com/Zakuroooo/groq-cowork.git
cd groq-cowork
```

### 2. Install dependencies
```bash
npm install
cd server && npm install && cd ..
```

### 3. Get your free API keys
- **Groq API key** (free) → [console.groq.com](https://console.groq.com)
- **Composio API key** (free) → [app.composio.dev](https://app.composio.dev)

### 4. Set up .env
```bash
cp .env.example .env
```
Edit `.env` and add your keys:
```
GROQ_API_KEY=your_groq_key_here
COMPOSIO_API_KEY=your_composio_key_here
```

### 5. Run the app
Open two terminals:

**Terminal 1 — Backend:**
```bash
cd server && npm start
```

**Terminal 2 — Desktop app:**
```bash
npm start
```

## Features

- Multi-session chat with persistent history
- Real-time streaming responses
- 3 Groq models: Llama 3.3 70B, Llama 3.1 8B, Mixtral 8x7B
- 500+ tool integrations via Composio (GitHub, Gmail, Slack, etc.)
- Custom Skills support via `.claude/skills/`
- Modern dark-themed Electron UI

## Future Plans

- Upgrade to Claude API ($5 credit → full Agent SDK features)
- Connect more tools via Composio
- Custom UI branding
- Add personal Skills for DSA, coding workflows

## Credits

Built on top of [open-claude-cowork](https://github.com/ComposioHQ/open-claude-cowork) by ComposioHQ.
Groq provider written from scratch by [@Zakuroooo](https://github.com/Zakuroooo).
