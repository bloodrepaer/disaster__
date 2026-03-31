# DisasterNet — AI Coordination Platform for India Disaster Relief

> **Live demo:** https://disaster-sand-psi.vercel.app  
> **Theme:** Frontiers of Collaboration — cross-disciplinary, community-driven, joint decision-making  
> **Demo video:** (https://acesse.one/0xbi464)

DisasterNet is a browser-based, multi-role coordination platform designed for India's national disaster response infrastructure (NDRF, ODRAF, state agencies). It connects four distinct operational roles — Victim, Rescue Worker, Hospital, and Command Station — through a shared real-time data mesh, live AI triage, decentralised storage, and on-chain fund disbursement.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        BROWSER CLIENT                           │
│                                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐   │
│  │  VICTIM  │  │  RESCUE  │  │ HOSPITAL │  │   COMMAND    │   │
│  │  (SOS)   │  │ WORKER   │  │  TRIAGE  │  │   STATION    │   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └──────┬───────┘   │
│       │              │              │                │           │
│       └──────────────┴──────────────┴────────────────┘           │
│                        BroadcastChannel Mesh                     │
│                    (same-origin P2P simulation)                  │
│                                                                 │
│  ┌─────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐    │
│  │ Zama    │  │  IPFS /  │  │ Starknet │  │  Anthropic   │    │
│  │ FHE     │  │ Storacha │  │ Sepolia  │  │  AI Proxy    │    │
│  │ (WASM)  │  │ Pinning  │  │ (planned)│  │  (Edge Fn)   │    │
│  └─────────┘  └──────────┘  └──────────┘  └──────────────┘    │
│                                                                 │
│  ┌────────────────────────────────────────────────────────┐    │
│  │         Service Worker — Offline Map Tile Cache         │    │
│  │         (pre-caches India disaster zone tiles)          │    │
│  └────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────┴──────────┐
                    │   Vercel Edge API  │
                    │  /api/ai-proxy.js  │
                    │ (keeps key server) │
                    └────────────────────┘
```

---

## Role Flows

| Role | Entry | Core Actions |
|---|---|---|
| **Victim** | SOS form | Beacon activation → rescue ETA countdown → status tracking |
| **Rescue Worker** | Name + zone | Log rescued persons → duplicate detection → IPFS anchor |
| **Hospital** | Facility name | Triage queue → treatment records → deceased compensation |
| **Command Station** | Demo login | AI dispatch → drone control → zone map → fund disbursement |

---

## Tech Stack

### Live Integrations ✅
| Technology | Usage | Status |
|---|---|---|
| **Anthropic Claude** (Sonnet 4) | AI triage agent — real-time streaming decisions | ✅ Live (via `/api/ai-proxy` or direct browser) |
| **Zama TFHE** | FHE-encrypted medical record sharing (WASM loaded dynamically) | ✅ WASM import live |
| **IPFS / Storacha** | Field report anchoring via `@web3-storage/w3up-client` | ✅ Pinning attempted |
| **Service Worker** | Offline map tile caching for India disaster zones | ✅ Registered + active |
| **BroadcastChannel** | Same-origin P2P mesh for multi-tab role sync | ✅ Live (same-browser) |
| **HyperCerts** | Volunteer credentialing with `.near` identity seeds | ✅ Seed data + display |
| **Family Search OTP** | OTP-gated family status lookup with demo fallback | ✅ Full demo mode |
| **Starknet Sepolia** | On-chain fund disbursement — RPC reads live; wallet writes via ArgentX/Braavos | ✅ Live (starknet.js v6) |
| **PWA Install Prompt** | `beforeinstallprompt` captured — "Install App" button in header | ✅ Live |
| **Sync Backend (Vercel KV)** | Real multi-user persistence — persons, status updates, OTP, compensation | ✅ Live (Edge Functions + Redis) |
| **World ID (IDKit)** | Sybil-resistant volunteer verification — device + orb proof levels | ✅ Live (IDKit v1, simulation fallback) |
| **Partykit WebSocket mesh** | Real-time cross-device relay — all message types · BroadcastChannel fallback | ✅ Live (deploy partykit.json) |

### Roadmapped Integrations ⚠️
| Technology | Planned | Current state |
|---|---|---|
| **World ID** | Volunteer identity verification | Display-only — SDK integration roadmapped |
| **WebRTC / WebSocket relay** | True cross-device mesh networking | BroadcastChannel (same-browser only) |
| **Backend sync API** | `/api/v1/persons`, `/api/v1/sms`, anchors | Not deployed — family-search uses demo fallback |

---

## Running Locally

### Prerequisites
- Node.js 18+ (for local dev server)
- An [Anthropic API key](https://console.anthropic.com) (optional — simulation mode works without)

### Steps

```bash
# 1. Clone / unzip and enter directory
cd disaster_net_80

# 2. Start a local static server (no build step needed)
npx serve . -p 3000
# or: python3 -m http.server 3000

# 3. Open http://localhost:3000

# 4. (Optional) Activate live AI:
#    Click the ⚡ icon in the header → paste your Anthropic API key
```

### Deploying to Vercel (with server-side AI key)

```bash
npm i -g vercel
vercel --prod

# Set environment variable in Vercel dashboard:
# ANTHROPIC_API_KEY = sk-ant-api03-...
```

Once `ANTHROPIC_API_KEY` is set, the AI triage agent runs through `/api/ai-proxy` and judges don't need to supply their own key.

---

## Project Structure

```
disaster_net_80/
├── index.html          # Main app — all four role dashboards
├── dispatch.html       # Dedicated command dispatch console
├── family-search.html  # Public family status lookup (OTP-gated)
├── sw.js               # Service worker — offline tile cache
├── vercel.json         # Vercel routing + security headers
├── api/
│   └── ai-proxy.js     # Edge Function — server-side Anthropic proxy
├── js/
│   └── app.js          # All application logic (~4,000 lines)
└── css/
    └── styles.css      # Terminal-aesthetic dark UI (~2,344 lines)
```

---

## Key Features

### SOS → Rescue → Hospital → Compensation Pipeline
The complete operational loop mirrors real NDRF procedures:
1. **Victim** activates SOS beacon → rescue ETA shown
2. **Rescue Worker** logs person with zone, condition, notes → IPFS anchor CID generated
3. **Hospital** picks up triage queue → updates treatment status
4. **Command Station** sees full picture → AI advises cross-state resource moves
5. Deceased cases automatically queue for **Starknet compensation filing**

### AI Command Agent
- Streams decisions token-by-token from Claude Sonnet 4
- System prompt uses real NDRF zone codes (MH1, OD1, UK1, AP1…)
- Gracefully degrades to pre-scripted simulation if no API key
- Server-side proxy (`/api/ai-proxy`) keeps key out of browser when deployed

### Offline-First Service Worker
- Pre-caches OpenStreetMap tiles for all 18 active Indian disaster zones
- A* routing algorithm for inter-state convoy pathfinding
- Works without internet after first load (critical for disaster conditions)

### FHE Medical Record Sharing
- Zama TFHE WASM loaded dynamically at runtime
- Encrypts sensitive patient data before cross-facility sharing
- Decryption key never leaves the originating hospital tab

### Family Search with OTP
- Public-facing page: search by name or phone number
- Detailed records gated behind OTP sent to registered family phone
- Full demo-mode fallback (OTP: `123456`) when backend is offline

### Duplicate Rescue Detection
- Levenshtein distance comparison on rescued person names within the same zone
- Warns rescuers before logging a possible duplicate (reduces overcounting)

---

## Built vs. Planned

### Completed during hackathon
- [x] 4-role access control system with onboarding
- [x] SOS beacon → rescue → hospital → compensation pipeline
- [x] Live Anthropic AI streaming via server-side proxy
- [x] Zama TFHE WASM dynamic import
- [x] IPFS/Storacha field report anchoring
- [x] Service worker with map tile pre-caching
- [x] BroadcastChannel mesh (same-browser multi-tab)
- [x] 18-zone interactive India map with A* routing
- [x] Drone dispatch console with battery countdown
- [x] Family search page with OTP demo fallback
- [x] HyperCerts volunteer credentialing display
- [x] Duplicate rescue detection (Levenshtein)
- [x] Deceased compensation filing flow
- [x] Judge walkthrough overlay
- [x] Vercel Edge Function AI proxy
- [x] Starknet Sepolia: live RPC reads + wallet-driven disbursement writes (starknet.js v6)
- [x] PWA install prompt (`beforeinstallprompt` + "INSTALL APP" header button)
- [x] Sync backend: Vercel KV (Redis) Edge Functions — real multi-user persons, OTP, compensation auto-trigger
- [x] World ID IDKit — device verification widget in HyperCerts tab, proof broadcast over mesh
- [x] Partykit WebSocket relay — real-time cross-device mesh, BroadcastChannel fallback for same-browser

### Post-hackathon roadmap
- [ ] Screen reader audit + WCAG 2.1 AA compliance
- [ ] Drone live telemetry feed
- [ ] CWC dam API live integration

---

## Deploying the Real-Time Mesh (Partykit)

```bash
# 1. Deploy Partykit server (free tier available)
npx partykit deploy --name disasternet

# 2. Add env var to Vercel project:
#    PARTYKIT_HOST = "disasternet.YOUR_USERNAME.partykit.dev"

# 3. Add to index.html <head> (or inject via Vercel edge middleware):
#    <script>window.PARTYKIT_HOST_ENV = "disasternet.YOUR_USERNAME.partykit.dev"</script>
```

Once deployed, any number of users on different devices and networks can collaborate in the same room. All message types — missing persons, rescued persons, AI decisions, road status, World ID proofs — flow in real time between every connected node.

---

## Deploying the Sync Backend (Vercel KV)

The sync backend is a set of Vercel Edge Functions backed by **Vercel KV** (managed Redis). No separate server needed.

### Steps

```bash
# 1. Deploy to Vercel
npm i -g vercel
vercel --prod

# 2. Add KV store in Vercel dashboard
#    Project → Storage → Create KV Store → Connect to project
#    (This auto-sets KV_URL, KV_REST_API_URL, KV_REST_API_TOKEN env vars)

# 3. Set AI key (optional)
#    Project → Settings → Environment Variables
#    ANTHROPIC_API_KEY = sk-ant-api03-...
```

Once KV is connected, the frontend auto-detects the live backend on page load (`/health` returns 200) and switches out of simulation mode. Persons logged by any user are shared across all connected devices in real time.

---

## Team

Built by a 2-person team at their first hackathon.

| Name | Role |
|---|---|
| **Jash Taparia** | Developer — architecture, integrations, application logic |
| **Mihir Gune** | Designer — UI/UX, terminal aesthetic, user flows |

The project grew from a shared interest in how technology can meaningfully support disaster-affected communities in India. Working on DisasterNet provided first-hand insight into the coordination gaps that exist across NDRF field operations, hospital triage, and command-level decision-making — and shaped every design and technical decision in the platform.

---

## Demo Video

A walkthrough of the full interface is available here: (https://acesse.one/0xbi464)

The demo covers:
1. **Victim** — SOS beacon activation and rescue ETA
2. **Rescue Worker** — logging a rescued person with duplicate detection
3. **Hospital** — triage queue and treatment record update
4. **Command Station** — Impulse AI streaming a triage decision
5. **Family Search** — OTP-gated status lookup (demo OTP: `123456`)

---

## Security Notes

- API key is stored in `sessionStorage` only (not `localStorage`) — cleared on tab close
- When `/api/ai-proxy` is deployed with `ANTHROPIC_API_KEY`, no key is ever sent to the browser
- All user-supplied fields rendered via `innerHTML` are sanitised through `safeStr()` to prevent XSS
- Security headers (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`) set via `vercel.json`

---

## Relevance to "Frontiers of Collaboration"

DisasterNet demonstrates three distinct collaboration models simultaneously:
1. **Cross-disciplinary** — medical staff, field rescuers, and command coordinators share a live data mesh
2. **Community-driven** — NGO deconfliction board, World ID volunteer verification, HyperCerts accountability
3. **Joint decision-making** — AI triage agent recommends; human command station approves and dispatches

The Starknet disbursement queue and HyperCerts layer extend collaborative accountability beyond any single organisation, creating an auditable, decentralised record of the entire relief operation.
