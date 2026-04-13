# Sense: Personalized Learning Architecture

Sense is a high-performance learning platform that constructs an interactive 3D cognitive landscape based on user browsing behavior and interests. It utilizes a hybrid feed of Gemini-generated AI educational shorts and YouTube Shorts, backed by a sophisticated video caching and personalization engine.

## Architecture Overview

The system is partitioned into four primary layers:
1.  **Ingestion (Chrome Extension):** Passive topic collection and synchronization with the user's cognitive graph.
2.  **Intelligence (Python/FastAPI):** Orchestrates personalization, video generation via Gemini Veo 3.1, and content mixing.
3.  **Persistence (Supabase/MongoDB):** Multi-tenant storage for user profiles, interests, video metadata, and cached assets.
4.  **Presentation (React 19):** High-fidelity UI featuring an R3F-powered 3D knowledge graph and a low-latency vertical video feed.

## Core Features

### Cognitive Mapping & Knowledge Graph
- **Interactive 3D Visualization:** Built on `react-force-graph-3d` and Three.js.
- **Dynamic Sensitivity:** Optimized rotation (1.5x), zoom (2.0x), and pan (1.5x) speeds for high-density navigation.
- **Relational Scoring:** Nodes represent topics; edges represent cross-domain similarity and user interest weight.

### Intelligence Pipeline & Feed Mixing
- **Parallel Generation:** Background triggering of Gemini Veo 3.1 Fast for personalized video content.
- **Hybrid Feed Logic:** 4:2 interleave ratio between cached AI videos and YouTube Shorts.
- **Personalization Engine:** Scores content based on interest vectors derived from onboarding and passive collection.

### Video Caching System
- **LRU-inspired Storage:** Automated 7-day cache expiry with view tracking.
- **Batch Processing:** High-concurrency storage and retrieval for AI-generated assets.
- **Sub-second Retrieval:** Optimized Supabase queries for serving the first 5-6 items of the personalized feed.

## Technical Stack

### Frontend
- **Runtime:** React 19, Vite/Craco
- **Styling:** Tailwind CSS 3.4, Shadcn/UI
- **Graphics:** Three.js, React Three Fiber, Framer Motion 12
- **State/Hooks:** React Hook Form, Zod, Sonner (Toasts)

### Backend
- **Framework:** FastAPI (Python 3.11+)
- **Security:** Supabase Auth (JWT), HTTP Bearer tokens
- **Database:** Supabase (PostgreSQL), Motor (Async MongoDB client)
- **AI/External:** Gemini API (Video Gen), YouTube Data API v3

### Chrome Extension
- Manifest V3, standard background/content script orchestration for topic extraction.

## API Reference

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/feed/personalized` | GET | Returns interleaved AI + YT content stream |
| `/api/videos/generate` | POST | Triggers parallel AI video generation (blocking) |
| `/api/feed/generate-background` | POST | Triggers non-blocking background generation |
| `/api/graph/data` | GET | Returns D3-compatible node/link structure |
| `/api/feed/cache-stats` | GET | Returns user-specific cache utilization |

## Local Development

### Prerequisites
- Python 3.11+
- Node.js 18+
- Supabase CLI / Project Credentials

### Backend Setup
```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
# Configure .env with SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GEMINI_API_KEY
python server.py
```

### Frontend Setup
```bash
cd frontend
yarn install
yarn start
```

### Chrome Extension
1. Open `chrome://extensions/`
2. Enable Developer Mode
3. Load unpacked: `/chrome-extension`

## Directory Structure
```text
.
├── backend/                # FastAPI services and intelligence logic
│   ├── intelligence/       # Core personalization pipeline
│   ├── services/           # Video gen, cache, and YouTube integration
│   └── server.py           # API entry point
├── frontend/               # React 19 application
│   ├── src/components/ui/  # Shadcn/UI primitives
│   └── src/pages/          # Knowledge Graph and Feed implementations
├── chrome-extension/       # Manifest V3 topic collector
└── tests/                  # Backend and integration suites
```
