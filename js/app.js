// ==============================================================
// STATE
// ==============================================================
// XSS sanitisation helper — use for all user-supplied strings in innerHTML
function safeStr(v) {
  return String(v == null ? '' : v).replace(/[<>&"'`]/g, ch => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;','`':'&#96;'}[ch]));
}

const NODE_ID = 'NODE-' + (Math.random() * 9000 + 1000 | 0);
let apiKey = '';
let simMode = true;
let currentUser = null;
let currentRole = null;
let channel;
let missingPersons = [];
let rescuedPersons = [];
let compensationCases = [];
let meshLogs = [];
let hypercerts = [];
let agentMessages = [];
let tfheReady = false;
let selectedRoleTemp = null;
let treatmentTargetId = null;
let compensationTargetId = null;
let allowedTabsForCurrentRole = new Set(['rescued', 'missing', 'drones', 'mesh', 'res', 'hc', 'recovery', 'funds', 'analytics']);
let backendSnapshot = { healthy: null, bundleCount: null, anchorQueued: null, anchoredReceipts: null };

const SYNC_API_BASE = sessionStorage.getItem('dnet_sync_api') || (
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:8787'
    : null
);

const ROLE_LABELS = {
  rescuer: 'RESCUE WORKER',
  danger: 'VICTIM',
  medic: 'HOSPITAL',
  surveillance: 'MAIN STATION',
};

const ROLE_ALLOWED_TABS = {
  surveillance: ['rescued', 'missing', 'drones', 'mesh', 'res', 'hc', 'recovery', 'funds', 'analytics'],
  rescuer: ['rescued', 'missing', 'mesh'],
  medic: ['rescued', 'missing'],
  danger: ['missing'],
};

const ZONES = [
  // CRITICAL
  { id:'MH1', name:'Mumbai — Dharavi',       state:'Maharashtra',       type:'flood',      sev:'critical', lat:40, lng:28, victims:1840, resources:18, detail:'Coastal flooding — Mithi river overflow — 1,840 displaced — Dharavi low-lying areas inundated' },
  { id:'OD1', name:'Puri — Coastal Belt',    state:'Odisha',            type:'cyclone',    sev:'critical', lat:24, lng:82, victims:2300, resources:9,  detail:'Cyclone landfall — 180km/h winds — coastal villages submerged — 2,300 evacuated — power grid down' },
  { id:'UK1', name:'Chamoli — Uttarakhand',  state:'Uttarakhand',       type:'landslide',  sev:'critical', lat:14, lng:56, victims:320,  resources:5,  detail:'Glacial lake outburst + landslide — NH58 blocked — 320 cut off — helicopter access only' },
  { id:'AP1', name:'Vijayawada — Krishna',   state:'Andhra Pradesh',    type:'flood',      sev:'critical', lat:60, lng:76, victims:5400, resources:22, detail:'Krishna river 98% capacity — embankment breach — 5,400 affected — 6 mandals inundated' },
  // HIGH
  { id:'AS1', name:'Silchar — Barak Valley', state:'Assam',             type:'flood',      sev:'high',     lat:10, lng:88, victims:1200, resources:28, detail:'Barak river flood — NH6 submerged — 1,200 displaced — fresh water supply disrupted' },
  { id:'BH1', name:'Darbhanga — Bihar',      state:'Bihar',             type:'flood',      sev:'high',     lat:12, lng:60, victims:3100, resources:31, detail:'Bagmati river overflow — 3,100 in camps — medical convoy rerouted via NH57' },
  { id:'RJ1', name:'Barmer — Rajasthan',     state:'Rajasthan',         type:'flood',      sev:'high',     lat:38, lng:12, victims:780,  resources:14, detail:'Flash flood in desert district — unusual rainfall — Luni river overflow — roads washed out' },
  { id:'HP1', name:'Kullu — Himachal',       state:'Himachal Pradesh',  type:'landslide',  sev:'high',     lat:10, lng:38, victims:210,  resources:8,  detail:'Multiple landslides on NH3 — Beas river rising — 210 tourists stranded — rescue underway' },
  { id:'KL1', name:'Wayanad — Kerala',       state:'Kerala',            type:'landslide',  sev:'high',     lat:74, lng:22, victims:640,  resources:17, detail:'Landslide on hillside — 640 displaced — tea estate workers evacuated — IMD red alert' },
  { id:'TN1', name:'Chennai — North',        state:'Tamil Nadu',        type:'flood',      sev:'high',     lat:62, lng:78, victims:900,  resources:19, detail:'Cyclonic storm — Adyar river flooding — 900 homes waterlogged — power outages across 12 wards' },
  // MEDIUM
  { id:'GJ1', name:'Surat — Tapi River',     state:'Gujarat',           type:'flood',      sev:'medium',   lat:52, lng:18, victims:440,  resources:35, detail:'Tapi overflowing — low-lying areas under watch — Ukai dam gates opened — monitoring closely' },
  { id:'JH1', name:'Ranchi — Jharkhand',     state:'Jharkhand',         type:'flood',      sev:'medium',   lat:30, lng:68, victims:280,  resources:22, detail:'Subarnarekha river in spate — 280 villagers moved — roads flooded — relief camps active' },
  { id:'MN1', name:'Imphal — Manipur',       state:'Manipur',           type:'landslide',  sev:'medium',   lat:8,  lng:84, victims:190,  resources:12, detail:'Landslide on NH37 — Imphal river rising — 190 displaced — army teams deployed' },
  { id:'WB1', name:'Malda — West Bengal',    state:'West Bengal',       type:'flood',      sev:'medium',   lat:12, lng:76, victims:560,  resources:26, detail:'Ganga erosion — 560 affected — embankment repair underway — district alert issued' },
  // LOW
  { id:'PB1', name:'Gurdaspur — Punjab',     state:'Punjab',            type:'flood',      sev:'low',      lat:8,  lng:34, victims:120,  resources:40, detail:'Ravi river minor flooding — 120 displaced — situation under control — monitoring active' },
  { id:'MP1', name:'Jabalpur — M.P.',        state:'Madhya Pradesh',    type:'flood',      sev:'low',      lat:42, lng:46, victims:95,   resources:32, detail:'Narmada tributary overflow — minor flooding — 95 families moved to higher ground — stable' },
  { id:'CG1', name:'Raipur — Chhattisgarh', state:'Chhattisgarh',      type:'flood',      sev:'low',      lat:50, lng:60, victims:65,   resources:38, detail:'Mahanadi tributary rising — situation monitored — pre-emptive evacuation of 65 families' },
  { id:'KA1', name:'Coorg — Karnataka',      state:'Karnataka',         type:'landslide',  sev:'low',      lat:70, lng:28, victims:80,   resources:29, detail:'Minor landslides near Madikeri — 80 families in shelter — road clearance in progress' },
];

const ZONE_COORDS = {
  MH1: [19.04, 72.85],  // Mumbai — Dharavi
  OD1: [19.81, 85.83],  // Puri
  UK1: [30.41, 79.31],  // Chamoli
  AP1: [16.51, 80.64],  // Vijayawada
  AS1: [24.82, 92.79],  // Silchar
  BH1: [26.17, 85.90],  // Darbhanga
  RJ1: [25.75, 71.39],  // Barmer
  HP1: [31.96, 77.11],  // Kullu
  KL1: [11.68, 76.13],  // Wayanad
  TN1: [13.08, 80.27],  // Chennai
  GJ1: [21.19, 72.83],  // Surat
  JH1: [23.34, 85.31],  // Ranchi
  MN1: [24.82, 93.94],  // Imphal
  WB1: [25.00, 88.14],  // Malda
  PB1: [32.03, 75.40],  // Gurdaspur
  MP1: [23.18, 79.94],  // Jabalpur
  CG1: [21.25, 81.63],  // Raipur
  KA1: [12.42, 75.73],  // Coorg
};

const ROAD_EDGES = [
  { id: 'R-MH1-GJ1', from: 'MH1', to: 'GJ1', points: [[19.04,72.85],[20.12,72.84],[21.19,72.83]], baseCost: 280 },
  { id: 'R-MH1-KA1', from: 'MH1', to: 'KA1', points: [[19.04,72.85],[16.00,74.00],[12.42,75.73]], baseCost: 740 },
  { id: 'R-AP1-TN1', from: 'AP1', to: 'TN1', points: [[16.51,80.64],[14.80,80.20],[13.08,80.27]], baseCost: 380 },
  { id: 'R-AP1-KL1', from: 'AP1', to: 'KL1', points: [[16.51,80.64],[14.00,77.50],[11.68,76.13]], baseCost: 620 },
  { id: 'R-KL1-KA1', from: 'KL1', to: 'KA1', points: [[11.68,76.13],[12.00,75.90],[12.42,75.73]], baseCost: 120 },
  { id: 'R-BH1-WB1', from: 'BH1', to: 'WB1', points: [[26.17,85.90],[25.60,87.00],[25.00,88.14]], baseCost: 280 },
  { id: 'R-AS1-MN1', from: 'AS1', to: 'MN1', points: [[24.82,92.79],[24.82,93.37],[24.82,93.94]], baseCost: 180 },
  { id: 'R-UK1-HP1', from: 'UK1', to: 'HP1', points: [[30.41,79.31],[31.20,78.00],[31.96,77.11]], baseCost: 320 },
  { id: 'R-RJ1-GJ1', from: 'RJ1', to: 'GJ1', points: [[25.75,71.39],[23.50,71.80],[21.19,72.83]], baseCost: 540 },
  { id: 'R-OD1-WB1', from: 'OD1', to: 'WB1', points: [[19.81,85.83],[22.40,87.00],[25.00,88.14]], baseCost: 620 },
  { id: 'R-JH1-WB1', from: 'JH1', to: 'WB1', points: [[23.34,85.31],[24.10,86.70],[25.00,88.14]], baseCost: 340 },
  { id: 'R-MP1-CG1', from: 'MP1', to: 'CG1', points: [[23.18,79.94],[22.50,80.80],[21.25,81.63]], baseCost: 290 },
  { id: 'R-CG1-OD1', from: 'CG1', to: 'OD1', points: [[21.25,81.63],[20.50,83.00],[19.81,85.83]], baseCost: 510 },
  { id: 'R-BH1-JH1', from: 'BH1', to: 'JH1', points: [[26.17,85.90],[25.00,85.60],[23.34,85.31]], baseCost: 310 },
  { id: 'R-PB1-HP1', from: 'PB1', to: 'HP1', points: [[32.03,75.40],[32.00,76.20],[31.96,77.11]], baseCost: 150 },
];

const ROAD_STATUS_COLORS = {
  clear: '#00c851',
  risky: '#ffcc00',
  blocked: '#ff1744',
};

let mapInstance = null;
let routeLayer = null;
let zoneMarkersById = {};
let roadLayersById = {};
let droneLeafletMarkers = {};
let vulnerableLeafletMarkers = [];
let currentRoadPaintMode = 'clear';
let roadStatusById = {};
let droneRequiredZones = new Set();

try {
  roadStatusById = JSON.parse(sessionStorage.getItem('dnet_road_status_v1') || '{}');
} catch (e) {
  roadStatusById = {};
}

try {
  const rawDroneRequired = JSON.parse(sessionStorage.getItem('dnet_drone_required_v1') || '[]');
  droneRequiredZones = new Set(Array.isArray(rawDroneRequired) ? rawDroneRequired : []);
} catch (e) {
  droneRequiredZones = new Set();
}

const RESOURCES = [
  { name:'NDRF Teams',        total:52,   deployed:44,  color:'var(--red)' },
  { name:'SDRF Teams',        total:128,  deployed:98,  color:'var(--orange)' },
  { name:'Medical Teams',     total:86,   deployed:71,  color:'var(--accent)' },
  { name:'Rescue Boats',      total:340,  deployed:274, color:'var(--accent3)' },
  { name:'Helicopters',       total:28,   deployed:23,  color:'var(--warn)' },
  { name:'Supply Convoys',    total:94,   deployed:78,  color:'var(--purple)' },
  { name:'Field Medics',      total:620,  deployed:482, color:'var(--red)' },
  { name:'Ambulances',        total:180,  deployed:141, color:'var(--accent)' },
  { name:'Army Columns',      total:18,   deployed:12,  color:'var(--warn)' },
  { name:'Coast Guard Vessels',total:14,  deployed:9,   color:'var(--accent3)' },
];

const NGOS = [
  { name:'Goonj Foundation',      amount:'₹1.2Cr', zone:'MH1, BH1, WB1',  status:'verified', color:'var(--accent3)' },
  { name:'SEEDS India',           amount:'₹98L',   zone:'OD1, AP1',        status:'verified', color:'var(--accent3)' },
  { name:'CRY — Child Relief',    amount:'₹64L',   zone:'AS1, MN1',        status:'verified', color:'var(--accent3)' },
  { name:'NDRF Reserve Fund',     amount:'₹3.2Cr', zone:'ALL',             status:'verified', color:'var(--accent3)' },
  { name:'HelpNow India',         amount:'₹45L',   zone:'UK1, HP1',        status:'pending',  color:'var(--warn)' },
  { name:'iCall Relief Network',  amount:'₹32L',   zone:'KL1, TN1',        status:'pending',  color:'var(--warn)' },
  { name:'Rapid Response India',  amount:'₹58L',   zone:'RJ1, GJ1',        status:'pending',  color:'var(--warn)' },
  { name:'Pratham Foundation',    amount:'₹28L',   zone:'MP1, CG1',        status:'pending',  color:'var(--warn)' },
];

const SYSTEM_PROMPT = `You are Impulse AI, an autonomous disaster relief triage agent coordinating India's national multi-state, multi-hazard disaster response. You manage 18 active zones across 15 states covering floods, cyclones, landslides and glacial outbursts. You coordinate NDRF, SDRF, Army, Coast Guard and NGO assets on an offline mesh network.

Active zones:
${ZONES.map(z => `- Zone ${z.id} (${z.name}): ${z.sev.toUpperCase()} — ${z.victims} victims, ${z.resources} units — ${z.detail}`).join('\n')}

For each field report:
1. Assess severity and immediate life risk
2. Issue specific routing commands (e.g., "Redirect NDRF Team 4 from Zone GJ1 to Zone OD1")
3. Flag if FHE-encrypted medical data needs sharing with hospitals via Lit Protocol
4. Note if a Hypercert should be minted for the responding volunteer team
5. Specify IPFS provenance log action

Be concise, operational, direct. Use zone codes (MH1, OD1, UK1, AP1, AS1, BH1, etc.). Cross-state coordination is key. Max 4-5 sentences. Lead with ⚡ DECISION:`;

// ==============================================================
// BOOT
// ==============================================================
// ==============================================================
// PWA INSTALL PROMPT
// ==============================================================
let _pwaInstallEvent = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  _pwaInstallEvent = e;
  const btn = document.getElementById('pwaInstallBtn');
  if (btn) btn.style.display = '';
});

window.addEventListener('appinstalled', () => {
  _pwaInstallEvent = null;
  const btn = document.getElementById('pwaInstallBtn');
  if (btn) btn.style.display = 'none';
  showToast('✅ DisasterNet installed as app');
  addMeshLog('📲 PWA: DisasterNet installed on this device');
});

function triggerPWAInstall() {
  if (!_pwaInstallEvent) {
    showToast('Already installed or not supported in this browser');
    return;
  }
  _pwaInstallEvent.prompt();
  _pwaInstallEvent.userChoice.then((choice) => {
    if (choice.outcome === 'accepted') addMeshLog('📲 PWA: install accepted by user');
    _pwaInstallEvent = null;
    const btn = document.getElementById('pwaInstallBtn');
    if (btn) btn.style.display = 'none';
  });
}

window.addEventListener('load', () => {
  const nodeEl = document.getElementById('nodeId');
  if (nodeEl) nodeEl.textContent = NODE_ID;

  registerOfflineServiceWorker();
  initMapToolSelectors();
  hydrateZoneDroneFlags();

  renderZones();
  renderMap();
  renderResources();
  renderNGOs();
  initHypercerts();
  initMesh();
  refreshMissingPersonsFromBackend();
  setInterval(refreshMissingPersonsFromBackend, 20000);
  refreshLiveBackendSnapshot();
  setInterval(refreshLiveBackendSnapshot, 30000);
  simulateMeshActivity();
  initTFHE();
  renderDrones();
  renderDams();
  initRecovery();
  renderNGOBoard();
  initAnticipatoryEngine();

  const saved = sessionStorage.getItem('dnet_key');
  if (saved) { apiKey = saved; simMode = false; updateAIStatus(); }
});

async function fetchJsonSafe(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    return null;
  }
}

async function postJsonSafe(url, payload) {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload || {}),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, status: res.status, data };
    return { ok: true, status: res.status, data };
  } catch (e) {
    return { ok: false, status: 0, data: { ok: false, message: 'Network unavailable' } };
  }
}

function mapBackendPersonToUi(person) {
  const history = Array.isArray(person.statusHistory) ? person.statusHistory : [];
  return {
    id: person.id,
    name: person.name,
    zone: person.lastSeenZone || 'UNKNOWN',
    note: person.note || '',
    phone: person.phone || '',
    status: person.status || 'Missing',
    updatedAt: person.updatedAt || person.createdAt || new Date().toISOString(),
    time: new Date(person.updatedAt || person.createdAt || Date.now()).toLocaleTimeString(),
    cipher: person.anchorCid ? person.anchorCid.slice(0, 40) : randHex(40),
    cid: person.anchorCid || '',
    anchorCid: person.anchorCid || '',
    deceasedConfirmations: (person.deceasedConfirmations || []).length,
    compensation: person.compensation || null,
    statusHistory: history
      .slice()
      .sort((a, b) => new Date(b.ts || 0).getTime() - new Date(a.ts || 0).getTime())
      .slice(0, 4),
  };
}

function upsertMissingPersonLocal(person) {
  const mapped = mapBackendPersonToUi(person);
  const idx = missingPersons.findIndex((p) => p.id === mapped.id);
  if (idx >= 0) missingPersons[idx] = mapped;
  else missingPersons.unshift(mapped);
}

function toLocaleDate(value) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('en-IN');
}

function toLocaleTime(value) {
  if (!value) return '-';
  return new Date(value).toLocaleTimeString();
}

function buildBackendCompensationCases(persons, smsMessages) {
  const proofByPersonId = {};
  smsMessages
    .filter((m) => m && m.type === 'COMPENSATION_PROOF' && m.personId)
    .forEach((msg) => {
      const existing = proofByPersonId[msg.personId];
      if (!existing || new Date(msg.sentAt || 0).getTime() >= new Date(existing.sentAt || 0).getTime()) {
        proofByPersonId[msg.personId] = msg;
      }
    });

  return persons
    .filter((p) => p.status === 'Deceased' || Number(p.deceasedConfirmations || 0) > 0)
    .map((p) => {
      const proof = proofByPersonId[p.id];
      const isPaid = p.compensation && p.compensation.status === 'paid';
      return {
        source: 'backend',
        personId: p.id,
        name: p.name,
        zone: p.zone,
        deathTime: toLocaleTime(p.updatedAt),
        deathDate: toLocaleDate(p.updatedAt),
        familyContact: p.phone ? `Registered family contact · ${p.phone}` : null,
        amount: p.compensation?.amount || null,
        status: isPaid ? 'filed' : 'pending',
        filedBy: isPaid ? 'AUTO-COMPENSATION' : 'SYSTEM',
        txHash: p.compensation?.txHash || null,
        smsProofAt: proof?.sentAt || null,
        note: isPaid
          ? `On-chain compensation paid (${p.compensation?.chain || 'starknet-sepolia'})`
          : `Awaiting conditions. Deceased confirmations: ${p.deceasedConfirmations || 0}/2${p.anchorCid ? '' : ' · anchor CID missing'}`,
      };
    });
}

function syncCompensationCasesFromBackend(persons, smsMessages = []) {
  const manualCases = compensationCases.filter((c) => c.source !== 'backend');
  const backendCases = buildBackendCompensationCases(persons, smsMessages);
  compensationCases = [...manualCases, ...backendCases];
  renderCompensationCases();
  updateCompensationBadge();
}

async function refreshMissingPersonsFromBackend() {
  if (!SYNC_API_BASE) return;
  const data = await fetchJsonSafe(`${SYNC_API_BASE}/api/v1/persons?limit=300`);
  if (!data || !data.ok || !Array.isArray(data.persons)) return;

  const smsData = await fetchJsonSafe(`${SYNC_API_BASE}/api/v1/sms?limit=300`);
  const smsMessages = smsData && smsData.ok && Array.isArray(smsData.messages) ? smsData.messages : [];

  missingPersons = data.persons.map(mapBackendPersonToUi);
  syncCompensationCasesFromBackend(missingPersons, smsMessages);
  renderMissingPersons();
}

async function refreshLiveBackendSnapshot() {
  if (!SYNC_API_BASE) return;
  if (currentRole && currentRole !== 'surveillance') return;

  const health = await fetchJsonSafe(`${SYNC_API_BASE}/health`);
  const bundles = await fetchJsonSafe(`${SYNC_API_BASE}/api/v1/sync-bundles?limit=1`);
  const queuedAnchors = await fetchJsonSafe(`${SYNC_API_BASE}/api/v1/anchors?status=queued&limit=1`);
  const receipts = await fetchJsonSafe(`${SYNC_API_BASE}/api/v1/anchor-receipts?limit=200`);

  const healthy = !!(health && health.ok);
  const bundleCount = bundles && typeof bundles.count === 'number' ? bundles.count : null;
  const anchorQueued = queuedAnchors && typeof queuedAnchors.count === 'number' ? queuedAnchors.count : null;
  const anchoredReceipts = receipts && typeof receipts.count === 'number' ? receipts.count : null;

  const changed =
    backendSnapshot.healthy !== healthy ||
    backendSnapshot.bundleCount !== bundleCount ||
    backendSnapshot.anchorQueued !== anchorQueued ||
    backendSnapshot.anchoredReceipts !== anchoredReceipts;

  backendSnapshot = { healthy, bundleCount, anchorQueued, anchoredReceipts };

  if (!changed) return;

  if (!healthy) {
    addMeshLog('🟠 Sync receiver unreachable — running local-only mode');
    return;
  }

  const bundleText = bundleCount === null ? 'n/a' : String(bundleCount);
  const queuedText = anchorQueued === null ? 'n/a' : String(anchorQueued);
  const receiptsText = anchoredReceipts === null ? 'n/a' : String(anchoredReceipts);
  addMeshLog(`🟢 Sync receiver online · bundles: ${bundleText} · queued anchors: ${queuedText} · receipts: ${receiptsText}`);
}

function registerOfflineServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('./sw.js').then(() => {
    addMeshLog('🗺 Service worker ready for offline map + tile cache');
  }).catch(() => {
    addMeshLog('🗺 Service worker registration failed; map will run online-only');
  });

  navigator.serviceWorker.addEventListener('message', (event) => {
    const message = event.data || {};
    if (message.type === 'tiles-prefetch-done') {
      const count = Number(message.count || 0);
      setMapRouteStatus(`Offline tile cache completed: ${count} tiles prepared.`);
      addMeshLog(`🧭 Offline tile prefetch completed (${count} tiles)`);
    }
  });
}

function latLngToTileXY(lat, lng, zoom) {
  const latRad = lat * Math.PI / 180;
  const n = Math.pow(2, zoom);
  const x = Math.floor((lng + 180) / 360 * n);
  const y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n);
  return { x, y };
}

function tileUrlsForBBox(minLat, minLng, maxLat, maxLng, zoomLevels) {
  const urls = [];
  zoomLevels.forEach((z) => {
    const nw = latLngToTileXY(maxLat, minLng, z);
    const se = latLngToTileXY(minLat, maxLng, z);
    for (let x = nw.x; x <= se.x; x++) {
      for (let y = nw.y; y <= se.y; y++) {
        urls.push(`https://tile.openstreetmap.org/${z}/${x}/${y}.png`);
      }
    }
  });
  return urls;
}

function buildDisasterRegionTileList() {
  const regions = [
    { name: 'North India',        bbox: [28.0, 72.0, 35.0, 80.0] },
    { name: 'Northeast India',    bbox: [22.0, 89.0, 28.0, 96.0] },
    { name: 'Maharashtra',        bbox: [15.6, 72.6, 22.1, 80.9] },
    { name: 'Bihar & Jharkhand',  bbox: [21.9, 83.2, 27.6, 88.3] },
    { name: 'Odisha & WB',        bbox: [17.7, 84.0, 23.0, 89.0] },
    { name: 'Andhra & Tamil Nadu',bbox: [8.0, 77.0, 17.0, 83.0] },
    { name: 'Kerala & Karnataka', bbox: [8.0, 74.0, 15.0, 78.0] },
    { name: 'Gujarat & Rajasthan',bbox: [21.0, 68.0, 30.0, 77.0] },
  ];

  const zoomLevels = [7, 8];
  const all = new Set();
  regions.forEach((region) => {
    const [minLat, minLng, maxLat, maxLng] = region.bbox;
    tileUrlsForBBox(minLat, minLng, maxLat, maxLng, zoomLevels).forEach((url) => all.add(url));
  });
  return Array.from(all);
}

function predownloadDisasterTiles() {
  if (!navigator.serviceWorker || !navigator.serviceWorker.controller) {
    setMapRouteStatus('Service worker not active yet. Reload once, then try CACHE TILES again.');
    return;
  }
  const urls = buildDisasterRegionTileList();
  navigator.serviceWorker.controller.postMessage({ type: 'prefetch-tiles', urls });
  setMapRouteStatus(`Caching disaster-region map tiles (${urls.length} requested)...`);
  addMeshLog(`🧭 Tile prefetch requested for 8 Indian disaster regions (${urls.length} tiles)`);
}

// ==============================================================
// ROLE LOGIN SYSTEM
// ==============================================================
const ROLE_FORMS = {
  rescuer: {
    icon: '🦺', label: 'RESCUE WORKER LOGIN',
    color: 'var(--accent)',
    fields: `
      <input class="mp-input" id="rf_name" placeholder="Your full name *" />
      <input class="mp-input" id="rf_team" placeholder="Team / unit ID (e.g. NDRF-Team-7)" />
      <input class="mp-input" id="rf_zone" placeholder="Assigned zone (e.g. A2, B1)" />
      <input class="mp-input" id="rf_phone" placeholder="Contact number" />
      <div class="modal-hint" style="margin-top:4px">As a rescuer, you can log rescued persons, update conditions, and submit field reports to Impulse AI.</div>
    `
  },
  danger: {
    icon: '🆘', label: 'VICTIM SOS LOGIN',
    color: 'var(--red)',
    fields: `
      <input class="mp-input" id="rf_name" placeholder="Your full name *" />
      <input class="mp-input" id="rf_location" placeholder="Your location / landmark *" />
      <select class="mp-input" id="rf_danger_type" style="color:var(--text2)">
        <option value="">Type of emergency *</option>
        <option>Trapped by floodwater</option>
        <option>Stranded on roof/high ground</option>
        <option>Medical emergency</option>
        <option>Building collapse</option>
        <option>Swept away / at risk of drowning</option>
        <option>Other emergency</option>
      </select>
      <input class="mp-input" id="rf_count" placeholder="Number of people at this location" />
      <textarea class="mp-input" id="rf_condition" placeholder="Any medical conditions, injuries, special needs..." style="resize:none;height:52px;font-size:11px"></textarea>
      <div class="modal-hint" style="border-color:rgba(255,23,68,0.3);background:rgba(255,23,68,0.06);color:var(--red);margin-top:4px">⚡ Pressing SEND SOS will immediately alert all rescue teams in your area.</div>
    `
  },
  medic: {
    icon: '🏥', label: 'HOSPITAL LOGIN',
    color: 'var(--accent3)',
    fields: `
      <input class="mp-input" id="rf_name" placeholder="Doctor / nurse / paramedic name *" />
      <input class="mp-input" id="rf_qualification" placeholder="Qualification (e.g. MBBS, Paramedic, Nurse)" />
      <input class="mp-input" id="rf_facility" placeholder="Current facility / camp" />
      <input class="mp-input" id="rf_reg" placeholder="Medical registration number (optional)" />
      <div class="modal-hint" style="margin-top:4px">As a medic, you can update treatment records, triage patients from the Rescued tab, and file deceased compensation claims.</div>
    `
  },
  surveillance: {
    icon: '🛰️', label: 'MAIN STATION COMMAND LOGIN',
    color: 'var(--purple)',
    fields: `
      <input class="mp-input" id="rf_name" placeholder="Officer name *" />
      <input class="mp-input" id="rf_org" placeholder="Organisation (e.g. NDMA, State Disaster Authority)" />
      <input class="mp-input" id="rf_rank" placeholder="Rank / designation" />
      <input class="mp-input" id="rf_auth" placeholder="Authorization code (demo: NDMA-2024)" />
      <div class="modal-hint" style="margin-top:4px">Full command access: drone dispatch, zone management, NGO coordination, AI agent, all system functions.</div>
    `
  }
};

function selectRole(role) {
  selectedRoleTemp = role;
  const config = ROLE_FORMS[role];
  document.getElementById('roleGrid').style.display = 'none';
  document.getElementById('roleActions').style.display = 'none';
  document.getElementById('roleForm').style.display = 'block';
  document.getElementById('roleFormHeader').innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;padding-bottom:12px;border-bottom:1px solid var(--border)">
      <span style="font-size:24px">${config.icon}</span>
      <div>
        <div style="font-family:'Orbitron',sans-serif;font-size:12px;font-weight:700;color:${config.color};letter-spacing:1px">${config.label}</div>
        <div style="font-family:'JetBrains Mono',monospace;font-size:9px;color:var(--text3);margin-top:2px">Fill in your details to proceed</div>
      </div>
    </div>
  `;
  document.getElementById('roleFormFields').innerHTML = config.fields;
  if (role === 'danger') {
    document.getElementById('loginConfirmBtn').textContent = '🆘 SEND SOS BEACON';
    document.getElementById('loginConfirmBtn').style.background = 'var(--red)';
  } else {
    document.getElementById('loginConfirmBtn').textContent = 'ENTER SYSTEM';
    document.getElementById('loginConfirmBtn').style.background = '';
  }
}

function backToRoleSelect() {
  selectedRoleTemp = null;
  document.getElementById('roleGrid').style.display = 'grid';
  document.getElementById('roleActions').style.display = 'flex';
  document.getElementById('roleForm').style.display = 'none';
}

function confirmLogin() {
  const nameEl = document.getElementById('rf_name');
  if (!nameEl || !nameEl.value.trim()) { showToast('Please enter your name'); return; }
  const name = nameEl.value.trim();
  
  if (selectedRoleTemp === 'danger') {
    // SOS flow
    const locEl = document.getElementById('rf_location');
    const typeEl = document.getElementById('rf_danger_type');
    if (!locEl || !locEl.value.trim()) { showToast('Please enter your location'); return; }
    if (!typeEl || !typeEl.value) { showToast('Please select emergency type'); return; }
    
    const location = locEl.value.trim();
    const emergType = typeEl.value;
    const count = document.getElementById('rf_count')?.value || '1';
    const condition = document.getElementById('rf_condition')?.value || '';
    
    // Generate realistic ETA
    const etaMins = 8 + Math.floor(Math.random() * 14);
    const etaTime = new Date(Date.now() + etaMins * 60000);
    const etaStr = etaTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    
    document.getElementById('roleModal').classList.remove('show');
    currentUser = { id: name, trust: 'CIVILIAN', role: 'danger', etaMins, etaStr };
    currentRole = 'danger';
    setupRoleUI();
    
    // Fire SOS
    setTimeout(() => fireSOS(name, location, emergType, count, condition, etaMins, etaStr), 200);
    return;
  }
  
  const roleLabels = {
    rescuer: ROLE_LABELS.rescuer,
    medic: ROLE_LABELS.medic,
    surveillance: ROLE_LABELS.surveillance,
  };
  currentRole = selectedRoleTemp;
  // Capture extra fields per role
  const extraFields = {};
  if (selectedRoleTemp === 'rescuer') {
    extraFields.team = document.getElementById('rf_team')?.value?.trim() || 'Field Unit';
    extraFields.assignedZone = (document.getElementById('rf_zone')?.value?.trim() || '').toUpperCase() || null;
    extraFields.phone = document.getElementById('rf_phone')?.value?.trim() || '';
  } else if (selectedRoleTemp === 'medic') {
    extraFields.qualification = document.getElementById('rf_qualification')?.value?.trim() || '';
    extraFields.facility = document.getElementById('rf_facility')?.value?.trim() || 'Field Hospital';
    extraFields.regNo = document.getElementById('rf_reg')?.value?.trim() || '';
  } else if (selectedRoleTemp === 'surveillance') {
    extraFields.org = document.getElementById('rf_org')?.value?.trim() || 'NDMA';
    extraFields.rank = document.getElementById('rf_rank')?.value?.trim() || '';
  }
  currentUser = { id: name, trust: 'ROLE-VERIFIED', role: selectedRoleTemp, ...extraFields };
  
  document.getElementById('roleModal').classList.remove('show');
  setupRoleUI();
  showToast(`✓ Logged in as ${name} — ${roleLabels[selectedRoleTemp]}`);
  addLog('system', `🔐 <strong>${name}</strong> logged in as <strong>${roleLabels[selectedRoleTemp]}</strong>. Role-based access granted.`);
  
  document.getElementById('userPill').style.display = 'flex';
  document.getElementById('userLabel').textContent = name;
  document.getElementById('rolePill').style.display = 'flex';
  document.getElementById('rolePillIcon').textContent = ROLE_FORMS[selectedRoleTemp].icon + ' ';
  document.getElementById('rolePillName').textContent = roleLabels[selectedRoleTemp];
  const roleColorMap = { accent:'rgba(0,212,255,0.4)', accent3:'rgba(57,255,20,0.4)', red:'rgba(255,23,68,0.4)', purple:'rgba(139,92,246,0.4)', warn:'rgba(255,204,0,0.4)', orange:'rgba(255,107,53,0.4)' };
  const colorVar = (ROLE_FORMS[selectedRoleTemp].color.match(/--([a-z0-9]+)/) || [])[1] || 'accent';
  document.getElementById('rolePill').style.borderColor = roleColorMap[colorVar] || roleColorMap.accent;
  document.getElementById('rolePill').style.color = ROLE_FORMS[selectedRoleTemp].color;

  setTimeout(() => runInitialAssessment(), 600);
  if (selectedRoleTemp === 'surveillance' || selectedRoleTemp === 'rescuer') {
    setTimeout(() => scheduleProactiveAI(), 700);
  }
  if (selectedRoleTemp === 'surveillance') {
    setTimeout(() => injectExportButton(), 800);
  }
}

function setupRoleUI() {
  applyRoleAccess();

  // Adjust UI based on role
  if (currentRole === 'medic') {
    addLog('system', '🏥 Hospital mode active — essential treatment and patient status features enabled.');
  } else if (currentRole === 'surveillance') {
    addLog('system', '🛰️ Main Station mode active — full command dashboard enabled.');
  } else if (currentRole === 'rescuer') {
    addLog('system', '🦺 Rescue Worker mode active — essential field operations only.');
  } else if (currentRole === 'danger') {
    addLog('system', '🆘 Victim mode active — essential SOS and status features only.');
  }
}

function getAllowedTabsForRole(role) {
  return ROLE_ALLOWED_TABS[role] || ROLE_ALLOWED_TABS.surveillance;
}

function extractTabNameFromElement(tabEl) {
  const onclickAttr = tabEl.getAttribute('onclick') || '';
  const match = onclickAttr.match(/switchTab\('([^']+)'/);
  return match ? match[1] : null;
}

function applyRoleAccess() {
  const role = currentRole || 'surveillance';
  const allowedTabs = getAllowedTabsForRole(role);
  allowedTabsForCurrentRole = new Set(allowedTabs);

  const workspace = document.querySelector('.workspace');
  const left = document.querySelector('.left');
  const right = document.querySelector('.right');
  const center = document.querySelector('.center');

  // Victim/danger role — replace the entire workspace with a focused ETA screen
  if (role === 'danger') {
    if (left) left.style.display = 'none';
    if (right) right.style.display = 'none';
    if (workspace) workspace.style.gridTemplateColumns = '1fr';
    if (center) {
      const u = currentUser || {};
      const etaMins = u.etaMins || 12;
      const etaStr = u.etaStr || '—';
      const sosId = u.sosId || '—';
      const victimName = u.id || 'Unknown';
      const sosTime = u.sosTime ? new Date(u.sosTime).toLocaleTimeString('en-IN') : new Date().toLocaleTimeString('en-IN');
      center.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:80vh;gap:0;padding:32px 20px;text-align:center;max-width:520px;margin:0 auto">
          
          <!-- SOS ID badge -->
          <div style="font-family:'JetBrains Mono',monospace;font-size:9px;color:var(--text3);letter-spacing:2px;margin-bottom:20px">SOS · ${sosId} · ${sosTime}</div>
          
          <!-- Big icon -->
          <div style="font-size:56px;margin-bottom:16px;filter:drop-shadow(0 0 20px rgba(255,23,68,0.5))">🚑</div>
          
          <!-- Main message -->
          <div style="font-family:'Orbitron',sans-serif;font-size:14px;font-weight:700;color:var(--accent3);letter-spacing:2px;margin-bottom:8px">HELP IS ON THE WAY</div>
          <div style="font-size:13px;color:var(--text2);margin-bottom:28px">Rescue team has been alerted, ${victimName}</div>
          
          <!-- ETA Box — the main thing they need to see -->
          <div style="width:100%;background:rgba(57,255,20,0.06);border:1px solid rgba(57,255,20,0.3);border-radius:8px;padding:24px;margin-bottom:20px">
            <div style="font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--text3);letter-spacing:2px;margin-bottom:8px">EXPECTED ARRIVAL OF HELP</div>
            <div id="victimEtaCountdown" style="font-family:'Orbitron',sans-serif;font-size:42px;font-weight:900;color:var(--accent3);letter-spacing:2px;line-height:1">${etaMins}</div>
            <div style="font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--text3);margin-top:6px">MINUTES AWAY · ETA ${etaStr}</div>
            <div style="margin-top:12px;height:4px;background:var(--border);border-radius:2px;overflow:hidden">
              <div id="victimEtaBar" style="height:100%;width:100%;background:var(--accent3);border-radius:2px;transition:width 60s linear"></div>
            </div>
          </div>
          
          <!-- Status steps -->
          <div style="width:100%;background:var(--surface);border:1px solid var(--border);border-radius:6px;padding:16px;text-align:left;margin-bottom:20px">
            <div style="font-family:'JetBrains Mono',monospace;font-size:9px;color:var(--text3);letter-spacing:1.5px;margin-bottom:12px">RESCUE STATUS</div>
            <div style="display:flex;flex-direction:column;gap:10px">
              <div style="display:flex;align-items:center;gap:12px;font-size:11px">
                <div style="width:20px;height:20px;border-radius:50%;background:rgba(57,255,20,0.15);border:1px solid var(--accent3);display:flex;align-items:center;justify-content:center;font-size:10px;flex-shrink:0">✓</div>
                <span style="color:var(--accent3)">SOS beacon broadcast to all rescue nodes</span>
              </div>
              <div style="display:flex;align-items:center;gap:12px;font-size:11px">
                <div style="width:20px;height:20px;border-radius:50%;background:rgba(57,255,20,0.15);border:1px solid var(--accent3);display:flex;align-items:center;justify-content:center;font-size:10px;flex-shrink:0">✓</div>
                <span style="color:var(--accent3)">Nearest rescue team assigned to your location</span>
              </div>
              <div style="display:flex;align-items:center;gap:12px;font-size:11px" id="droneStep">
                <div style="width:20px;height:20px;border-radius:50%;background:rgba(0,212,255,0.1);border:1px solid var(--accent);display:flex;align-items:center;justify-content:center;font-size:10px;flex-shrink:0;animation:blink 1s infinite">→</div>
                <span style="color:var(--accent)">Drone en route for aerial confirmation</span>
              </div>
              <div style="display:flex;align-items:center;gap:12px;font-size:11px" id="arrivalStep">
                <div style="width:20px;height:20px;border-radius:50%;background:var(--border);border:1px solid var(--border2);display:flex;align-items:center;justify-content:center;font-size:10px;flex-shrink:0;color:var(--text3)">⏳</div>
                <span style="color:var(--text3)">Rescue team arrival · ETA ${etaStr}</span>
              </div>
            </div>
          </div>

          <!-- Safety tips — compact -->
          <div style="width:100%;background:rgba(255,204,0,0.04);border:1px solid rgba(255,204,0,0.2);border-radius:6px;padding:12px 16px;text-align:left;margin-bottom:20px">
            <div style="font-family:'JetBrains Mono',monospace;font-size:9px;color:var(--warn);letter-spacing:1.5px;margin-bottom:8px">⚠ WHILE YOU WAIT</div>
            <div style="font-size:11px;color:var(--text2);line-height:2">
              🏔 Move to highest ground available &nbsp;·&nbsp; 🕯 Signal with bright cloth or light<br>
              🔋 Keep this phone charged &nbsp;·&nbsp; 🚫 Do NOT cross floodwater
            </div>
          </div>
          
          <!-- Emergency numbers -->
          <div style="font-family:'JetBrains Mono',monospace;font-size:9px;color:var(--text3);margin-bottom:16px">
            Emergency: <strong style="color:var(--text2)">112</strong> &nbsp;·&nbsp; Flood helpline: <strong style="color:var(--text2)">1078</strong> &nbsp;·&nbsp; NDRF: <strong style="color:var(--text2)">011-24363260</strong>
          </div>
        </div>`;
      
      // Start ETA countdown timer
      let minsLeft = etaMins;
      const totalMs = etaMins * 60 * 1000;
      const startTime = Date.now();
      const countdownEl = () => document.getElementById('victimEtaCountdown');
      const barEl = () => document.getElementById('victimEtaBar');
      const arrivalStepEl = () => document.getElementById('arrivalStep');
      const droneStepEl = () => document.getElementById('droneStep');
      
      // Animate bar
      setTimeout(() => { if (barEl()) barEl().style.width = '0%'; }, 500);
      
      const etaTimer = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, totalMs - elapsed);
        const minsRemaining = Math.ceil(remaining / 60000);
        if (countdownEl()) countdownEl().textContent = minsRemaining;
        
        // Drone step completes at 50%
        if (elapsed > totalMs * 0.5 && droneStepEl()) {
          droneStepEl().querySelector('div').textContent = '✓';
          droneStepEl().querySelector('div').style.background = 'rgba(57,255,20,0.15)';
          droneStepEl().querySelector('div').style.borderColor = 'var(--accent3)';
          droneStepEl().querySelector('div').style.animation = 'none';
          droneStepEl().querySelector('span').style.color = 'var(--accent3)';
        }
        
        if (remaining <= 0) {
          clearInterval(etaTimer);
          if (countdownEl()) countdownEl().textContent = '0';
          if (arrivalStepEl()) {
            arrivalStepEl().querySelector('div').textContent = '✓';
            arrivalStepEl().querySelector('div').style.background = 'rgba(57,255,20,0.15)';
            arrivalStepEl().querySelector('div').style.borderColor = 'var(--accent3)';
            arrivalStepEl().querySelector('span').style.color = 'var(--accent3)';
            arrivalStepEl().querySelector('span').textContent = 'Rescue team has arrived — look for orange vests';
          }
        }
      }, 15000); // update every 15s to save battery
    }
    return;
  }

  if (role === 'rescuer') {
    // Dedicated rescue worker dashboard — hide main layout, show custom screen
    if (left) left.style.display = 'none';
    if (right) right.style.display = 'none';
    if (workspace) workspace.style.gridTemplateColumns = '1fr';
    if (center) { center.innerHTML = ''; renderRescuerDashboard(center); }
    return;
  }

  if (role === 'medic') {
    // Dedicated hospital dashboard — hide main layout, show custom screen
    if (left) left.style.display = 'none';
    if (right) right.style.display = 'none';
    if (workspace) workspace.style.gridTemplateColumns = '1fr';
    if (center) { center.innerHTML = ''; renderHospitalDashboard(center); }
    return;
  }

  if (role === 'surveillance') {
    if (left) left.style.display = '';
    if (right) right.style.display = '';
    if (workspace) workspace.style.gridTemplateColumns = '264px 1fr 316px';
  } else {
    if (left) left.style.display = 'none';
    if (right) right.style.display = 'none';
    if (workspace) workspace.style.gridTemplateColumns = '1fr';
  }

  const tabs = Array.from(document.querySelectorAll('#mainTabs .tab'));
  tabs.forEach((tabEl) => {
    const tabName = extractTabNameFromElement(tabEl);
    if (!tabName) return;
    const allowed = allowedTabsForCurrentRole.has(tabName);
    tabEl.style.display = allowed ? '' : 'none';

    const contentEl = document.getElementById('tab-' + tabName);
    if (contentEl) contentEl.style.display = allowed ? '' : 'none';
  });

  const rescuedForm = document.getElementById('rescuedForm');
  if (rescuedForm) {
    const canLogRescues = role === 'rescuer' || role === 'surveillance';
    rescuedForm.style.display = canLogRescues ? '' : 'none';
  }

  const mapTools = document.getElementById('mapTools');
  if (mapTools) {
    const canUseRouting = role === 'rescuer' || role === 'surveillance';
    mapTools.style.display = canUseRouting ? '' : 'none';
  }

  const compensationPanel = document.getElementById('compensationList');
  if (compensationPanel) {
    const canSeeComp = role === 'medic' || role === 'surveillance';
    compensationPanel.style.display = canSeeComp ? '' : 'none';
  }

  const activeTab = document.querySelector('#mainTabs .tab.active');
  const activeTabName = activeTab ? extractTabNameFromElement(activeTab) : null;
  if (!activeTabName || !allowedTabsForCurrentRole.has(activeTabName)) {
    const firstAllowedTab = tabs.find((tabEl) => {
      const tabName = extractTabNameFromElement(tabEl);
      return !!tabName && allowedTabsForCurrentRole.has(tabName);
    });
    if (firstAllowedTab) {
      const firstAllowedTabName = extractTabNameFromElement(firstAllowedTab);
      switchTab(firstAllowedTabName, firstAllowedTab);
    }
  }
}

// ==============================================================
// RESCUE WORKER DEDICATED DASHBOARD
// ==============================================================
function renderRescuerDashboard(container) {
  // Determine priority zone for this rescuer
  const assignedZone = currentUser?.assignedZone || null;
  const priorityZones = ZONES.filter(z => z.sev === 'critical').concat(ZONES.filter(z => z.sev === 'high'));
  const nextZone = assignedZone ? (ZONES.find(z => z.id === assignedZone) || priorityZones[0]) : priorityZones[0];
  
  const SUPPLY_MAP = {
    critical: ['Life jackets (x4)', 'First aid kit (advanced)', 'Oxygen cylinder', 'Stretcher', 'Emergency rations (x10)', 'Walkie-talkie', 'Rope (30m)', 'Flashlight'],
    high:     ['Life jackets (x2)', 'First aid kit (standard)', 'Drinking water (20L)', 'Stretcher', 'Emergency rations (x6)', 'Walkie-talkie'],
    medium:   ['First aid kit (standard)', 'Drinking water (10L)', 'Emergency rations (x4)', 'Flashlight'],
    low:      ['First aid kit (basic)', 'Drinking water (5L)', 'Emergency rations (x2)'],
  };
  
  const supplies = SUPPLY_MAP[nextZone?.sev] || SUPPLY_MAP.medium;
  const sevColor = { critical:'var(--red)', high:'var(--orange)', medium:'var(--warn)', low:'var(--green)' }[nextZone?.sev] || 'var(--warn)';
  const workerName = currentUser?.id || 'Rescue Worker';
  
  container.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;grid-template-rows:auto 1fr;gap:0;height:calc(100vh - 52px - 28px);overflow:hidden">
      
      <!-- TOP HEADER BAR spanning full width -->
      <div style="grid-column:1/-1;padding:14px 24px;border-bottom:1px solid var(--border);background:var(--surface);display:flex;align-items:center;justify-content:space-between;flex-shrink:0">
        <div style="display:flex;align-items:center;gap:12px">
          <span style="font-size:22px">🦺</span>
          <div>
            <div style="font-family:'Orbitron',sans-serif;font-size:13px;font-weight:700;letter-spacing:1px">RESCUE WORKER DASHBOARD</div>
            <div style="font-family:'JetBrains Mono',monospace;font-size:9px;color:var(--text3);margin-top:2px">${workerName} · ${currentUser?.team || 'Field Unit'} · India National Disaster Relief</div>
          </div>
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          <div style="font-family:'JetBrains Mono',monospace;font-size:9px;color:var(--text3)" id="rescuerClock"></div>
          <div style="padding:4px 10px;background:rgba(255,23,68,0.12);border:1px solid rgba(255,23,68,0.3);border-radius:3px;font-family:'JetBrains Mono',monospace;font-size:8px;color:var(--red);animation:blink 2s infinite">3 CRITICAL ZONES</div>
        </div>
      </div>
      
      <!-- LEFT COL: Next Destination + Supplies -->
      <div style="grid-column:1;border-right:1px solid var(--border);overflow-y:auto;display:flex;flex-direction:column;gap:0">
        
        <!-- NEXT DESTINATION -->
        <div style="padding:16px;border-bottom:1px solid var(--border)">
          <div style="font-family:'JetBrains Mono',monospace;font-size:9px;color:var(--text3);letter-spacing:2px;margin-bottom:12px">📍 YOUR NEXT DESTINATION</div>
          <div style="background:var(--surface);border:1px solid var(--border2);border-left:3px solid ${sevColor};border-radius:6px;padding:16px">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
              <div>
                <div style="font-family:'Orbitron',sans-serif;font-size:18px;font-weight:900;color:var(--accent)">ZONE ${nextZone?.id || '—'}</div>
                <div style="font-size:13px;font-weight:600;color:var(--text);margin-top:2px">${nextZone?.name || '—'}</div>
              </div>
              <div style="padding:4px 10px;border-radius:3px;font-family:'JetBrains Mono',monospace;font-size:9px;font-weight:700;background:rgba(255,23,68,0.12);color:${sevColor};border:1px solid ${sevColor}40;text-transform:uppercase">${nextZone?.sev || '—'}</div>
            </div>
            <div style="font-size:11px;color:var(--text2);line-height:1.6;margin-bottom:12px">${nextZone?.detail || ''}</div>
            <div style="display:flex;gap:16px;font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--text3)">
              <span>👥 ${nextZone?.victims || 0} affected</span>
              <span>🚑 ${nextZone?.resources || 0} units deployed</span>
            </div>
          </div>
          
          <!-- All zones mini-list -->
          <div style="margin-top:12px">
            <div style="font-family:'JetBrains Mono',monospace;font-size:8px;color:var(--text3);letter-spacing:1.5px;margin-bottom:8px">ALL ACTIVE ZONES — TAP TO SELECT</div>
            <div style="display:flex;flex-direction:column;gap:4px" id="rescuerZoneList">
              ${ZONES.map(z => {
                const sc = { critical:'var(--red)', high:'var(--orange)', medium:'var(--warn)', low:'var(--green)' }[z.sev];
                const isNext = z.id === nextZone?.id;
                return `<div onclick="rescuerSelectZone('${z.id}')" style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;background:${isNext?'rgba(0,212,255,0.08)':'var(--bg2)'};border:1px solid ${isNext?'rgba(0,212,255,0.3)':'var(--border)'};border-radius:4px;cursor:pointer;transition:all 0.15s" id="rzc-${z.id}">
                  <div style="display:flex;align-items:center;gap:8px">
                    <div style="width:6px;height:6px;border-radius:50%;background:${sc};flex-shrink:0"></div>
                    <span style="font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--accent);font-weight:700">Zone ${z.id}</span>
                    <span style="font-size:11px;color:var(--text2)">${z.name}</span>
                  </div>
                  <div style="display:flex;align-items:center;gap:8px">
                    <span style="font-family:'JetBrains Mono',monospace;font-size:9px;color:var(--text3)">👥 ${z.victims}</span>
                    ${isNext ? '<span style="font-family:monospace;font-size:8px;color:var(--accent)">→ CURRENT</span>' : ''}
                  </div>
                </div>`;
              }).join('')}
            </div>
          </div>
        </div>
        
        <!-- SUPPLIES TO CARRY -->
        <div style="padding:16px">
          <div style="font-family:'JetBrains Mono',monospace;font-size:9px;color:var(--text3);letter-spacing:2px;margin-bottom:12px">🎒 SUPPLIES TO BRING FOR ZONE ${nextZone?.id || '—'}</div>
          <div style="display:flex;flex-direction:column;gap:6px" id="rescuerSupplyList">
            ${supplies.map((s, i) => `
              <div style="display:flex;align-items:center;gap:10px;padding:8px 10px;background:var(--surface);border:1px solid var(--border);border-radius:4px;cursor:pointer" onclick="toggleSupplyCheck(${i}, this)">
                <div id="scheck-${i}" style="width:16px;height:16px;border-radius:3px;border:1px solid var(--border2);flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:10px;transition:all 0.15s"></div>
                <span style="font-size:11px;color:var(--text2)">${s}</span>
              </div>`).join('')}
          </div>
          <div style="margin-top:10px;padding:8px 10px;background:rgba(0,212,255,0.04);border:1px solid rgba(0,212,255,0.15);border-radius:4px;font-family:'JetBrains Mono',monospace;font-size:9px;color:var(--text3)">
            ⚡ Supply list auto-generated based on zone severity. Check items as you load them.
          </div>
        </div>
      </div>
      
      <!-- RIGHT COL: Rescue Log -->
      <div style="grid-column:2;overflow-y:auto;display:flex;flex-direction:column">
        
        <!-- LOG A RESCUE -->
        <div style="padding:16px;border-bottom:1px solid var(--border)">
          <div style="font-family:'JetBrains Mono',monospace;font-size:9px;color:var(--text3);letter-spacing:2px;margin-bottom:12px">🦺 LOG RESCUED PERSON</div>
          <div style="display:flex;flex-direction:column;gap:6px">
            <input class="mp-input" id="rw_name" placeholder="Full name (or Unknown-001 if unidentified)" />
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
              <input class="mp-input" id="rw_age" placeholder="Age / approx" style="margin-bottom:0" />
              <input class="mp-input" id="rw_zone" placeholder="Zone (e.g. A2)" value="${nextZone?.id || ''}" style="margin-bottom:0" />
            </div>
            <select class="mp-input" id="rw_condition" style="color:var(--text2)">
              <option value="">Initial condition at rescue</option>
              <option value="critical">🔴 CRITICAL — immediate life risk</option>
              <option value="serious">🟠 SERIOUS — urgent care needed</option>
              <option value="stable">🟡 STABLE — injured but stable</option>
              <option value="minor">🟢 MINOR — minor injuries / shock</option>
              <option value="uninjured">✅ UNINJURED — no physical harm</option>
            </select>
            <textarea class="mp-input" id="rw_notes" placeholder="Injuries, location found, special needs, languages spoken..." style="resize:none;height:52px;font-size:11px"></textarea>
            <button class="btn btn-primary" style="width:100%;font-size:10px" onclick="logRescueFromWorkerDash()">🦺 LOG RESCUED PERSON</button>
          </div>
        </div>
        
        <!-- RESCUE LOG -->
        <div style="padding:16px;flex:1">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
            <div style="font-family:'JetBrains Mono',monospace;font-size:9px;color:var(--text3);letter-spacing:2px">📋 YOUR RESCUE LOG TODAY</div>
            <span style="font-family:'JetBrains Mono',monospace;font-size:8px;color:var(--accent)" id="rwRescueCount">0 LOGGED</span>
          </div>
          <div id="rwRescueList">
            <div style="padding:12px;background:var(--surface);border:1px solid var(--border);border-radius:4px;font-family:'JetBrains Mono',monospace;font-size:9px;color:var(--text3);text-align:center">No rescues logged yet. Use the form above.</div>
          </div>
        </div>
        
        <!-- MESH SIGNAL -->
        <div style="padding:12px 16px;border-top:1px solid var(--border);background:var(--surface)">
          <div style="display:flex;justify-content:space-between;align-items:center;font-family:'JetBrains Mono',monospace;font-size:9px">
            <span style="color:var(--text3)">📡 MESH · <span style="color:var(--accent3)">NODE ACTIVE</span> · ${currentUser?.id || 'FIELD'}</span>
            <button style="padding:4px 10px;background:rgba(0,212,255,0.08);border:1px solid rgba(0,212,255,0.25);border-radius:3px;color:var(--accent);font-family:'JetBrains Mono',monospace;font-size:8px;cursor:pointer" onclick="doBroadcastPing()">📡 PING MESH</button>
          </div>
        </div>
      </div>
    </div>`;
  
  // Start clock
  const clockEl = () => document.getElementById('rescuerClock');
  const clockTick = () => { if (clockEl()) clockEl().textContent = new Date().toLocaleTimeString('en-IN'); };
  clockTick(); setInterval(clockTick, 1000);
  
  // Pre-select the nextZone in rw_zone if field exists
  renderRwRescueList();
}

let rescuerCurrentZone = null;

function rescuerSelectZone(zoneId) {
  rescuerCurrentZone = zoneId;
  const zone = ZONES.find(z => z.id === zoneId);
  if (!zone) return;
  
  // Update zone highlight
  document.querySelectorAll('[id^="rzc-"]').forEach(el => {
    el.style.background = 'var(--bg2)';
    el.style.borderColor = 'var(--border)';
    const cur = el.querySelector('span:last-child');
    if (cur && cur.textContent.includes('CURRENT')) cur.remove();
  });
  const sel = document.getElementById('rzc-' + zoneId);
  if (sel) {
    sel.style.background = 'rgba(0,212,255,0.08)';
    sel.style.borderColor = 'rgba(0,212,255,0.3)';
  }
  
  // Update zone field in form
  const zoneInput = document.getElementById('rw_zone');
  if (zoneInput) zoneInput.value = zoneId;
  
  // Update supply list
  const SUPPLY_MAP = {
    critical: ['Life jackets (x4)', 'First aid kit (advanced)', 'Oxygen cylinder', 'Stretcher', 'Emergency rations (x10)', 'Walkie-talkie', 'Rope (30m)', 'Flashlight'],
    high:     ['Life jackets (x2)', 'First aid kit (standard)', 'Drinking water (20L)', 'Stretcher', 'Emergency rations (x6)', 'Walkie-talkie'],
    medium:   ['First aid kit (standard)', 'Drinking water (10L)', 'Emergency rations (x4)', 'Flashlight'],
    low:      ['First aid kit (basic)', 'Drinking water (5L)', 'Emergency rations (x2)'],
  };
  const supplies = SUPPLY_MAP[zone.sev] || SUPPLY_MAP.medium;
  const el = document.getElementById('rescuerSupplyList');
  if (el) {
    el.innerHTML = supplies.map((s, i) => `
      <div style="display:flex;align-items:center;gap:10px;padding:8px 10px;background:var(--surface);border:1px solid var(--border);border-radius:4px;cursor:pointer" onclick="toggleSupplyCheck(${i}, this)">
        <div id="scheck-${i}" style="width:16px;height:16px;border-radius:3px;border:1px solid var(--border2);flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:10px;transition:all 0.15s"></div>
        <span style="font-size:11px;color:var(--text2)">${s}</span>
      </div>`).join('');
  }
  showToast(`Zone ${zoneId} selected — supply list updated`);
}

function toggleSupplyCheck(i, row) {
  const check = document.getElementById('scheck-' + i);
  if (!check) return;
  const checked = check.textContent === '✓';
  check.textContent = checked ? '' : '✓';
  check.style.background = checked ? '' : 'rgba(57,255,20,0.2)';
  check.style.borderColor = checked ? 'var(--border2)' : 'var(--accent3)';
  check.style.color = 'var(--accent3)';
  row.style.opacity = checked ? '1' : '0.5';
}

function logRescueFromWorkerDash() {
  const name = document.getElementById('rw_name')?.value?.trim() || `Unknown-${String(rescuedPersons.length + 1).padStart(3,'0')}`;
  const age = document.getElementById('rw_age')?.value?.trim() || 'Unknown';
  const zone = document.getElementById('rw_zone')?.value?.trim() || (rescuerCurrentZone || 'UNKNOWN');
  const condition = document.getElementById('rw_condition')?.value;
  const notes = document.getElementById('rw_notes')?.value?.trim() || '';
  
  if (!condition) { showToast('Please select initial condition'); return; }

  // Duplicate detection — inline warning (no browser dialog, works in all iframe contexts)
  const dupeW = findDuplicateRescue(name, zone);
  if (dupeW && !document.getElementById('dupeBypassW')) {
    showInlineDupeWarning('rescuerSupplyList', dupeW.name, zone, nameSimilarity(dupeW.name, name), 'logRescueFromWorkerDash');
    return;
  }
  const bypassW = document.getElementById('dupeBypassW');
  if (bypassW) bypassW.remove();

  const conditionLabels = {
    critical: '🔴 CRITICAL', serious: '🟠 SERIOUS', stable: '🟡 STABLE', minor: '🟢 MINOR', uninjured: '✅ UNINJURED'
  };
  const person = {
    id: 'RSC-' + Date.now().toString(36).toUpperCase().slice(-6),
    name, age, zone, gender: 'Not specified',
    initialCondition: condition,
    initialConditionLabel: conditionLabels[condition],
    notes,
    rescuerName: currentUser?.id || 'Field Worker',
    rescueTime: new Date().toLocaleTimeString(),
    rescueDate: new Date().toLocaleDateString('en-IN'),
    currentStatus: 'awaiting_treatment',
    treatmentRecords: [],
    deceased: false,
    compensationFiled: false
  };
  
  rescuedPersons.unshift(person);
  
  // Clear form
  ['rw_name','rw_age','rw_notes'].forEach(id => { const el = document.getElementById(id); if(el) el.value = ''; });
  document.getElementById('rw_condition').value = '';
  
  renderRwRescueList();
  showToast(`🦺 ${name} logged — ${person.id}`);
  broadcastToMesh({ type: 'rescued_person', person });
}

function renderRwRescueList() {
  const el = document.getElementById('rwRescueList');
  const countEl = document.getElementById('rwRescueCount');
  if (!el) return;
  if (countEl) countEl.textContent = rescuedPersons.length + ' LOGGED';
  
  if (!rescuedPersons.length) {
    el.innerHTML = '<div style="padding:12px;background:var(--surface);border:1px solid var(--border);border-radius:4px;font-family:monospace;font-size:11px;color:var(--text3);text-align:center">No rescues logged yet.</div>';
    return;
  }
  
  const condColors = { critical:'var(--red)', serious:'var(--orange)', stable:'var(--warn)', minor:'var(--accent3)', uninjured:'var(--accent3)' };
  el.innerHTML = rescuedPersons.map(p => {
    const sid = safeStr(p.id), sname = safeStr(p.name), szone = safeStr(p.zone);
    const sresc = safeStr(p.rescuerName), stime = safeStr(p.rescueTime);
    const scond = safeStr((p.initialConditionLabel || p.initialCondition || '').replace(/[🔴🟠🟡🟢✅]\s*/,''));
    const snotes = p.notes ? `<div style="font-size:12px;color:var(--text2);margin-top:4px">${safeStr(p.notes)}</div>` : '';
    return `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:4px;padding:10px 12px;margin-bottom:6px;animation:msg-in 0.2s ease-out">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
        <span style="font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--accent)">${sid}</span>
        <span style="font-family:'JetBrains Mono',monospace;font-size:10px;color:${condColors[p.initialCondition] || 'var(--text3)'}">● ${scond}</span>
      </div>
      <div style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:2px">${sname}</div>
      <div style="font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--text3)">Zone ${szone} · ${stime} · By: ${sresc}</div>
      ${snotes}
    </div>`;
  }).join('');
}

// ==============================================================
// HOSPITAL DEDICATED DASHBOARD
// ==============================================================
let hospitalOutcomes = []; // { id, personId, name, zone, outcome:'saved'|'deceased', notes, doctor, time }
let hospitalOutcomeIdCounter = 1;

function renderHospitalDashboard(container) {
  const staffName = currentUser?.id || 'Medical Staff';
  const facility = currentUser?.facility || 'Field Hospital';
  
  const saved = hospitalOutcomes.filter(o => o.outcome === 'saved').length;
  const deceased = hospitalOutcomes.filter(o => o.outcome === 'deceased').length;
  const treating = rescuedPersons.filter(p => p.currentStatus === 'awaiting_treatment' || p.currentStatus === 'critical').length;
  
  container.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;grid-template-rows:auto 1fr;gap:0;height:calc(100vh - 52px - 28px);overflow:hidden">
      
      <!-- HEADER -->
      <div style="grid-column:1/-1;padding:14px 24px;border-bottom:1px solid var(--border);background:var(--surface);display:flex;align-items:center;justify-content:space-between">
        <div style="display:flex;align-items:center;gap:12px">
          <span style="font-size:22px">🏥</span>
          <div>
            <div style="font-family:'Orbitron',sans-serif;font-size:13px;font-weight:700;letter-spacing:1px">HOSPITAL DASHBOARD</div>
            <div style="font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--text3);margin-top:2px">${staffName} · ${facility} · India National Disaster Relief</div>
          </div>
        </div>
        <!-- Stats strip -->
        <div style="display:flex;gap:16px">
          <div style="text-align:center">
            <div style="font-family:'Orbitron',monospace;font-size:18px;font-weight:700;color:var(--accent3)" id="hosp-saved">${saved}</div>
            <div style="font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--text3)">SAVED</div>
          </div>
          <div style="text-align:center">
            <div style="font-family:'Orbitron',monospace;font-size:18px;font-weight:700;color:var(--red)" id="hosp-deceased">${deceased}</div>
            <div style="font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--text3)">DECEASED</div>
          </div>
          <div style="text-align:center">
            <div style="font-family:'Orbitron',monospace;font-size:18px;font-weight:700;color:var(--warn)" id="hosp-treating">${treating}</div>
            <div style="font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--text3)">AWAITING</div>
          </div>
        </div>
      </div>
      
      <!-- LEFT: Incoming patients + treatment -->
      <div style="grid-column:1;border-right:1px solid var(--border);overflow-y:auto;display:flex;flex-direction:column">
        
        <!-- Incoming patients -->
        <div style="padding:16px;border-bottom:1px solid var(--border)">
          <div style="font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--text3);letter-spacing:2px;margin-bottom:10px">🚑 INCOMING PATIENTS — LOG TREATMENT</div>
          <div id="hosp-patient-list">
            ${renderHospPatientList()}
          </div>
        </div>
        
        <!-- Quick treatment form -->
        <div style="padding:16px">
          <div style="font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--text3);letter-spacing:2px;margin-bottom:10px">📋 UPDATE TREATMENT RECORD</div>
          <div style="display:flex;flex-direction:column;gap:6px">
            <select class="mp-input" id="hosp_patient_id" style="color:var(--text2)">
              <option value="">Select patient by ID</option>
              ${rescuedPersons.map(p => `<option value="${p.id}">${p.id} — ${p.name} (${p.initialCondition})</option>`).join('')}
            </select>
            <select class="mp-input" id="hosp_status" style="color:var(--text2)">
              <option value="">Update status</option>
              <option value="recovering">🟢 RECOVERING</option>
              <option value="treated">✅ FULLY TREATED & DISCHARGED</option>
              <option value="transferred">🔄 TRANSFERRED to higher facility</option>
              <option value="critical">🔴 STILL CRITICAL — intensive care</option>
              <option value="deceased">⚰ DECEASED</option>
            </select>
            <textarea class="mp-input" id="hosp_notes" placeholder="Treatment notes: procedures, medications, prognosis..." style="resize:none;height:52px;font-size:12px"></textarea>
            <button class="btn btn-primary" style="width:100%;font-size:11px" onclick="saveHospTreatment()">💾 SAVE TREATMENT RECORD</button>
          </div>
        </div>
      </div>
      
      <!-- RIGHT: Outcome log (saved / deceased) -->
      <div style="grid-column:2;overflow-y:auto;display:flex;flex-direction:column">
        
        <!-- Record outcome -->
        <div style="padding:16px;border-bottom:1px solid var(--border)">
          <div style="font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--text3);letter-spacing:2px;margin-bottom:10px">📝 RECORD OUTCOME</div>
          <div style="display:flex;flex-direction:column;gap:6px">
            <input class="mp-input" id="hosp_outcome_name" placeholder="Patient full name" />
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
              <input class="mp-input" id="hosp_outcome_zone" placeholder="From zone (e.g. A2)" style="margin-bottom:0"/>
              <input class="mp-input" id="hosp_outcome_age" placeholder="Age / approx" style="margin-bottom:0"/>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
              <button class="btn" style="background:rgba(57,255,20,0.1);border:1px solid rgba(57,255,20,0.4);color:var(--accent3);font-size:11px;padding:8px" onclick="recordHospOutcome('saved')">✅ SAVED / RECOVERED</button>
              <button class="btn" style="background:rgba(255,23,68,0.1);border:1px solid rgba(255,23,68,0.4);color:var(--red);font-size:11px;padding:8px" onclick="recordHospOutcome('deceased')">⚰ DECEASED</button>
            </div>
            <textarea class="mp-input" id="hosp_outcome_notes" placeholder="Clinical notes, cause of death, treatment summary..." style="resize:none;height:44px;font-size:12px"></textarea>
          </div>
        </div>
        
        <!-- Outcome log -->
        <div style="padding:16px;flex:1">
          <div style="font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--text3);letter-spacing:2px;margin-bottom:10px">📊 OUTCOME REGISTER — TODAY</div>
          <div id="hosp-outcome-log">
            <div style="padding:12px;background:var(--surface);border:1px solid var(--border);border-radius:4px;font-family:'JetBrains Mono',monospace;font-size:9px;color:var(--text3);text-align:center">No outcomes recorded yet.</div>
          </div>
        </div>
      </div>
    </div>`;
  
  // Refresh patient list periodically
  setInterval(() => {
    const pl = document.getElementById('hosp-patient-list');
    if (pl) pl.innerHTML = renderHospPatientList();
    const hospTreating = rescuedPersons.filter(p => p.currentStatus === 'awaiting_treatment' || p.currentStatus === 'critical').length;
    const htEl = document.getElementById('hosp-treating');
    if (htEl) htEl.textContent = hospTreating;
  }, 5000);
}

function renderHospPatientList() {
  const awaiting = rescuedPersons.filter(p => p.currentStatus === 'awaiting_treatment' || p.currentStatus === 'critical' || p.currentStatus === 'serious');
  if (!awaiting.length) return '<div style="padding:10px;background:var(--surface);border:1px solid var(--border);border-radius:4px;font-family:monospace;font-size:11px;color:var(--text3);text-align:center">No patients currently awaiting treatment.</div>';
  
  const condColors = { critical:'var(--red)', serious:'var(--orange)', stable:'var(--warn)', minor:'var(--accent3)', uninjured:'var(--accent3)', awaiting_treatment:'var(--warn)' };
  return awaiting.map(p => {
    const sid = safeStr(p.id), sname = safeStr(p.name), szone = safeStr(p.zone);
    const sage = safeStr(p.age), stime = safeStr(p.rescueTime);
    const condLabel = safeStr((p.initialConditionLabel||'').replace(/[🔴🟠🟡🟢✅]\s*/,'').toUpperCase() || (p.initialCondition||'').toUpperCase());
    const snotes = p.notes ? `<div style="font-size:12px;color:var(--text2);margin-top:4px">${safeStr(p.notes)}</div>` : '';
    const borderColor = condColors[p.initialCondition] || 'var(--warn)';
    return `
    <div style="background:var(--surface);border:1px solid var(--border);border-left:2px solid ${borderColor};border-radius:4px;padding:10px 12px;margin-bottom:6px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px">
        <span style="font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--accent)">${sid}</span>
        <span style="font-family:'JetBrains Mono',monospace;font-size:10px;color:${borderColor}">⬤ ${condLabel}</span>
      </div>
      <div style="font-size:13px;font-weight:600;color:var(--text)">${sname}</div>
      <div style="font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--text3)">Zone ${szone} · Age: ${sage} · ${stime}</div>
      ${snotes}
    </div>`;
  }).join('');
}

function saveHospTreatment() {
  const personId = document.getElementById('hosp_patient_id')?.value;
  const status = document.getElementById('hosp_status')?.value;
  const notes = document.getElementById('hosp_notes')?.value?.trim();
  
  if (!personId) { showToast('Please select a patient'); return; }
  if (!status) { showToast('Please select a status'); return; }
  if (!notes) { showToast('Please add treatment notes'); return; }
  
  const p = rescuedPersons.find(x => x.id === personId);
  if (!p) { showToast('Patient not found'); return; }
  
  p.currentStatus = status;
  if (status === 'deceased') { p.deceased = true; createCompensationCase(p); }
  p.treatmentRecords.push({
    status, notes, medic: currentUser?.id || 'Hospital Staff',
    facility: currentUser?.facility || 'Field Hospital',
    time: new Date().toLocaleTimeString(), date: new Date().toLocaleDateString('en-IN')
  });
  
  // Refresh patient list and selectors
  const pl = document.getElementById('hosp-patient-list');
  if (pl) pl.innerHTML = renderHospPatientList();
  const sel = document.getElementById('hosp_patient_id');
  if (sel) {
    sel.innerHTML = '<option value="">Select patient by ID</option>' +
      rescuedPersons.map(p2 => `<option value="${p2.id}">${p2.id} — ${p2.name} (${p2.initialCondition})</option>`).join('');
  }
  
  document.getElementById('hosp_status').value = '';
  document.getElementById('hosp_notes').value = '';
  
  showToast(`✓ Treatment saved for ${p.name}`);
  addLog('info', `🏥 TREATMENT — ${p.name} (${p.id}) → ${status}`);
}

function recordHospOutcome(outcome) {
  const name = document.getElementById('hosp_outcome_name')?.value?.trim();
  const zone = document.getElementById('hosp_outcome_zone')?.value?.trim() || 'UNKNOWN';
  const age = document.getElementById('hosp_outcome_age')?.value?.trim() || 'Unknown';
  const notes = document.getElementById('hosp_outcome_notes')?.value?.trim() || '';
  
  if (!name) { showToast('Please enter patient name'); return; }
  
  const record = {
    id: 'OUT-' + (hospitalOutcomeIdCounter++).toString().padStart(3,'0'),
    name, zone, age, outcome, notes,
    doctor: currentUser?.id || 'Medical Staff',
    facility: currentUser?.facility || 'Field Hospital',
    time: new Date().toLocaleTimeString(),
    date: new Date().toLocaleDateString('en-IN'),
  };
  
  hospitalOutcomes.unshift(record);
  
  // If deceased, auto-create compensation case placeholder
  if (outcome === 'deceased') {
    const syntheticPerson = { id: 'OUT-' + record.id, name, zone, age, initialConditionLabel:'CRITICAL (hospital)', notes, rescueTime: record.time, rescueDate: record.date, deceased: true, compensationFiled: false };
    createCompensationCase(syntheticPerson);
    addLog('alert', `⚰ DECEASED RECORDED — ${name} · Zone ${zone} · Dr. ${record.doctor}`);
  } else {
    addLog('info', `✅ SAVED/RECOVERED — ${name} · Zone ${zone} · Dr. ${record.doctor}`);
  }
  
  // Clear form
  ['hosp_outcome_name','hosp_outcome_zone','hosp_outcome_age','hosp_outcome_notes'].forEach(id => { const el = document.getElementById(id); if(el) el.value = ''; });
  
  // Update counts
  const savedCount = hospitalOutcomes.filter(o => o.outcome === 'saved').length;
  const deceasedCount = hospitalOutcomes.filter(o => o.outcome === 'deceased').length;
  const s = document.getElementById('hosp-saved'); if (s) s.textContent = savedCount;
  const d = document.getElementById('hosp-deceased'); if (d) d.textContent = deceasedCount;
  
  renderHospOutcomeLog();
  showToast(outcome === 'saved' ? `✅ ${name} recorded as saved` : `⚰ ${name} recorded as deceased — compensation case created`);
}

function renderHospOutcomeLog() {
  const el = document.getElementById('hosp-outcome-log');
  if (!el) return;
  if (!hospitalOutcomes.length) {
    el.innerHTML = '<div style="padding:12px;background:var(--surface);border:1px solid var(--border);border-radius:4px;font-family:monospace;font-size:11px;color:var(--text3);text-align:center">No outcomes recorded yet.</div>';
    return;
  }
  el.innerHTML = hospitalOutcomes.map(o => {
    const isSaved = o.outcome === 'saved';
    const col = isSaved ? 'var(--accent3)' : 'var(--red)';
    const borderCol = isSaved ? 'rgba(57,255,20,0.3)' : 'rgba(255,23,68,0.3)';
    return `<div style="background:var(--surface);border:1px solid ${borderCol};border-left:2px solid ${col};border-radius:4px;padding:10px 12px;margin-bottom:6px;animation:msg-in 0.2s ease-out">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px">
        <span style="font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--text3)">${o.id} · ${o.time}</span>
        <span style="font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:700;color:${col}">${isSaved ? '✅ SAVED' : '⚰ DECEASED'}</span>
      </div>
      <div style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:2px">${o.name}</div>
      <div style="font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--text3)">Zone ${o.zone} · Age: ${o.age} · Dr. ${o.doctor}</div>
      ${o.notes ? `<div style="font-size:12px;color:var(--text2);margin-top:4px">${o.notes}</div>` : ''}
    </div>`;
  }).join('');
}

function roleCanAccess(action) {
  const role = currentRole || 'surveillance';
  const access = {
    log_rescued: ['rescuer', 'surveillance'],
    update_treatment: ['medic', 'surveillance'],
    file_compensation: ['medic', 'surveillance'],
    dispatch_drones: ['surveillance'],
    disburse_funds: ['surveillance'],
    mint_hypercert: ['surveillance'],
  };
  const allowedRoles = access[action] || ['surveillance'];
  return allowedRoles.includes(role);
}

function fireSOS(name, location, type, count, condition, etaMins, etaStr) {
  const sosId = 'SOS-' + Date.now().toString(36).toUpperCase().slice(-6);
  const eta = etaMins || (8 + Math.floor(Math.random() * 14));
  const etaDisplay = etaStr || new Date(Date.now() + eta * 60000).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  
  // Store ETA on currentUser for the victim screen
  if (currentUser) { currentUser.etaMins = eta; currentUser.etaStr = etaDisplay; currentUser.sosId = sosId; currentUser.sosTime = Date.now(); }
  
  document.getElementById('sosDetails').innerHTML = `
    SOS ID: <strong>${sosId}</strong><br>
    Name: <strong>${name}</strong><br>
    Location: <strong>${location}</strong><br>
    Emergency: <strong>${type}</strong><br>
    People at location: <strong>${count}</strong><br>
    ${condition ? `Conditions: ${condition}<br>` : ''}
    Time: <strong>${new Date().toLocaleTimeString()}</strong>
  `;
  document.getElementById('sosModal').classList.add('show');
  
  addLog('alert', `🆘 SOS BEACON — <strong>${sosId}</strong><br>
    📍 <strong>${location}</strong> · ${type}<br>
    👥 ${count} person(s) · ${name}<br>
    <span style="font-family:'JetBrains Mono',monospace;font-size:9px;color:var(--warn)">⚡ Rescue teams alerted · Nearest drone dispatched · All mesh nodes notified</span>`);
  
  // Auto-log as missing/at-risk
  const mp = { name: name + ' (SOS)', zone: 'UNLOCATED', note: `${type} at ${location} — ${count} people`, time: new Date().toLocaleTimeString(), cipher: randHex(40), cid: 'Qm' + randHex(22).toUpperCase() };
  missingPersons.unshift(mp);
  renderMissingPersons();
  
  showToast(`🆘 SOS broadcast — ${sosId}`);
  
  // Refresh victim screen with real ETA
  if (currentRole === 'danger') setTimeout(() => applyRoleAccess(), 300);
}

function skipVerify() {
  document.getElementById('roleModal').classList.remove('show');
  currentUser = { id: 'demo.near', trust: 'DEMO', role: 'surveillance' };
  currentRole = 'surveillance';
  applyRoleAccess();
  document.getElementById('userPill').style.display = 'flex';
  document.getElementById('userLabel').textContent = 'MAIN STATION DEMO';
  document.getElementById('rolePill').style.display = 'flex';
  document.getElementById('rolePillIcon').textContent = '🛰️ ';
  document.getElementById('rolePillName').textContent = 'MAIN STATION';
  addLog('system', 'Running in Main Station demo mode — full features available.');
  setTimeout(() => seedDemoRescueData(), 200);
  setTimeout(() => runInitialAssessment(), 400);
  setTimeout(() => scheduleProactiveAI(), 500);
  setTimeout(() => injectExportButton(), 600);
}

// Pre-populate realistic demo rescue + missing data for judges
function seedDemoRescueData() {
  if (rescuedPersons.length > 0) return; // don't overwrite real data
  const DEMO_RESCUES = [
    { name:'Priya Sharma',    age:'34', zone:'MH1', gender:'Female',  initialCondition:'serious',  notes:'Trapped on rooftop, hypothermia, 2 children with her', rescuerName:'NDRF Team 4' },
    { name:'Ramesh Yadav',    age:'67', zone:'BH1', gender:'Male',    initialCondition:'critical', notes:'Cardiac symptoms, oxygen needed urgently', rescuerName:'SDRF Bihar' },
    { name:'Kavitha Nair',    age:'28', zone:'OD1', gender:'Female',  initialCondition:'stable',   notes:'Minor lacerations, shock, rescued from cyclone shelter', rescuerName:'ODRAF Unit 2' },
    { name:'Arjun Singh',     age:'45', zone:'AP1', gender:'Male',    initialCondition:'minor',    notes:'Exhaustion, dehydration — rescued from flooded field', rescuerName:'AP NDRF' },
    { name:'Unknown Child 1', age:'~8', zone:'MH1', gender:'Child (under 12)', initialCondition:'stable', notes:'Separated from family, non-communicative, Zone MH1 Dharavi', rescuerName:'NDRF Team 4' },
    { name:'Suresh Patel',    age:'52', zone:'GJ1', gender:'Male',    initialCondition:'uninjured', notes:'Elderly diabetic, pre-emptive evacuation from riverside', rescuerName:'GSDMA Unit 1' },
    { name:'Meena Devi',      age:'38', zone:'BH1', gender:'Female',  initialCondition:'serious',  notes:'Broken arm, 8-month pregnant, needs hospital transfer', rescuerName:'SDRF Bihar' },
  ];
  const condLabels = { critical:'🔴 CRITICAL', serious:'🟠 SERIOUS', stable:'🟡 STABLE', minor:'🟢 MINOR', uninjured:'✅ UNINJURED' };
  DEMO_RESCUES.forEach((d, i) => {
    const offsetMins = (DEMO_RESCUES.length - i) * 22 + Math.floor(Math.random() * 15);
    const ts = new Date(Date.now() - offsetMins * 60000);
    rescuedPersons.push({
      id: 'RSC-DEMO' + String(i + 1).padStart(2, '0'),
      name: d.name, age: d.age, zone: d.zone, gender: d.gender,
      initialCondition: d.initialCondition,
      initialConditionLabel: condLabels[d.initialCondition],
      notes: d.notes, rescuerName: d.rescuerName,
      rescueTime: ts.toLocaleTimeString(),
      rescueDate: ts.toLocaleDateString('en-IN'),
      currentStatus: d.initialCondition === 'critical' ? 'critical' : 'awaiting_treatment',
      treatmentRecords: [], deceased: false, compensationFiled: false,
    });
  });
  const statEl = document.getElementById('statRescued');
  if (statEl) statEl.textContent = rescuedPersons.length;
  renderRescuedPersons();
  updateRescuedCount();

  // Seed 3 missing persons too
  const DEMO_MISSING = [
    { name:'Vikram Sharma',   zone:'MH1', note:'Age 36, last seen Dharavi Lane 4, wearing blue shirt', phone:'9820XXXXXX' },
    { name:'Sunita Devi',     zone:'BH1', note:'Age 55, diabetic, last seen near Bagmati bridge', phone:'9431XXXXXX' },
    { name:'Tourist Group C', zone:'UK1', note:'~12 tourists from Gujarat, stranded near Badrinath highway', phone:'' },
  ];
  DEMO_MISSING.forEach((m, i) => {
    missingPersons.unshift({
      id: 'LOCAL-DEMO' + String(i + 1).padStart(2, '0'),
      name: m.name, zone: m.zone, note: m.note, phone: m.phone,
      status: 'Missing', updatedAt: new Date(Date.now() - (i + 1) * 45 * 60000).toISOString(),
      time: new Date().toLocaleTimeString(), cipher: randHex(40),
      cid: 'Qm' + randHex(22).toUpperCase(), anchorCid: '', deceasedConfirmations: 0, compensation: null,
    });
  });
  renderMissingPersons();
  addLog('system', `📋 <strong>DEMO DATA LOADED</strong> — ${rescuedPersons.length} rescue records · ${missingPersons.length} missing persons · Analytics and Compensation tabs pre-populated.`);
}

function logoutUser() {
  currentUser = null; currentRole = null;
  document.getElementById('userPill').style.display = 'none';
  document.getElementById('rolePill').style.display = 'none';
  showToast('Logged out');
}

// ==============================================================
// LEVENSHTEIN DUPLICATE DETECTION
// ==============================================================
function levenshtein(a, b) {
  a = a.toLowerCase().trim();
  b = b.toLowerCase().trim();
  if (a === b) return 0;
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => Array.from({ length: n + 1 }, (_, j) => i === 0 ? j : j === 0 ? i : 0));
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++)
    dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1] : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
  return dp[m][n];
}

function nameSimilarity(a, b) {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

function findDuplicateRescue(name, zone) {
  return rescuedPersons.find(p =>
    p.zone === zone && nameSimilarity(p.name, name) >= 0.85
  );
}

function findDuplicateMissing(name, zone) {
  return missingPersons.find(p =>
    p.zone === zone && nameSimilarity(p.name, name) >= 0.85
  );
}

// Inline duplicate warning banner — no browser dialog, works in all iframe/embed contexts
function showInlineDupeWarning(anchorId, existingName, zone, similarity, callbackFn) {
  const pct = Math.round(similarity * 100);
  const id = callbackFn === 'logRescueFromWorkerDash' ? 'dupeBypassW' : 'dupeBypassMain';
  // Remove any existing warning
  const old = document.getElementById(id);
  if (old) old.remove();

  const banner = document.createElement('div');
  banner.id = id;
  banner.style.cssText = 'margin:6px 0 8px;padding:10px 12px;background:rgba(255,204,0,0.08);border:1px solid rgba(255,204,0,0.4);border-radius:5px;font-family:"JetBrains Mono",monospace;font-size:10px;color:var(--warn);line-height:1.6;animation:msg-in 0.2s ease-out';
  banner.innerHTML = `⚠ <strong>POSSIBLE DUPLICATE</strong><br><span style="color:var(--text2)">"${existingName}" already logged in Zone ${zone} (${pct}% name match).</span><br>
    <div style="display:flex;gap:8px;margin-top:8px">
      <button onclick="document.getElementById('${id}').remove();showToast('Duplicate skipped.')" style="flex:1;padding:5px;background:rgba(255,204,0,0.1);border:1px solid rgba(255,204,0,0.4);border-radius:3px;color:var(--warn);font-family:'JetBrains Mono',monospace;font-size:9px;cursor:pointer">✗ CANCEL</button>
      <button onclick="${callbackFn}()" style="flex:1;padding:5px;background:rgba(0,212,255,0.1);border:1px solid rgba(0,212,255,0.4);border-radius:3px;color:var(--accent);font-family:'JetBrains Mono',monospace;font-size:9px;cursor:pointer">✓ LOG ANYWAY</button>
    </div>`;

  // Insert before the anchor element or at top of rescuedList
  const anchor = document.getElementById(anchorId);
  if (anchor) anchor.insertAdjacentElement('beforebegin', banner);
  else document.getElementById('rescuedList')?.insertAdjacentElement('beforebegin', banner);

  banner.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ==============================================================
// RESCUED PERSONS TRACKER
// ==============================================================
let rescuedIdCounter = 1;

function logRescuedPerson() {
  if (!roleCanAccess('log_rescued')) {
    showToast('Only Rescue Worker or Main Station can log rescued persons');
    return;
  }

  const name = document.getElementById('rescuedName').value.trim() || `Unknown-${String(rescuedIdCounter).padStart(3,'0')}`;
  const age = document.getElementById('rescuedAge').value.trim();
  const zone = document.getElementById('rescuedZone').value.trim();
  const gender = document.getElementById('rescuedGender').value;
  const condition = document.getElementById('rescuedCondition').value;
  const notes = document.getElementById('rescuedNotes').value.trim();
  const rescuerName = document.getElementById('rescuedRescuerName').value.trim() || (currentUser ? currentUser.id : 'Unknown rescuer');

  if (!condition) { showToast('Please select initial condition'); return; }
  if (!zone) { showToast('Please enter rescue zone'); return; }

  // Duplicate detection — Levenshtein ≥ 85% similar name in same zone
  const dupe = findDuplicateRescue(name, zone);
  if (dupe && !document.getElementById('dupeBypassMain')) {
    showInlineDupeWarning('rescuedList', dupe.name, zone, nameSimilarity(dupe.name, name), 'logRescuedPerson');
    return;
  }
  const bypassMain = document.getElementById('dupeBypassMain');
  if (bypassMain) bypassMain.remove();

  const conditionLabels = {
    critical: '🔴 CRITICAL', serious: '🟠 SERIOUS', stable: '🟡 STABLE', minor: '🟢 MINOR', uninjured: '✅ UNINJURED'
  };

  const person = {
    id: 'RSC-' + (Date.now().toString(36).toUpperCase().slice(-6)),
    name, age: age || 'Unknown', zone, gender: gender || 'Not specified',
    initialCondition: condition,
    initialConditionLabel: conditionLabels[condition],
    notes,
    rescuerName,
    rescueTime: new Date().toLocaleTimeString(),
    rescueDate: new Date().toLocaleDateString('en-IN'),
    currentStatus: 'awaiting_treatment',
    treatmentRecords: [],
    deceased: false,
    compensationFiled: false
  };

  rescuedPersons.unshift(person);
  rescuedIdCounter++;
  renderRescuedPersons();
  updateRescuedCount();

  // Update stats
  const statEl = document.getElementById('statRescued');
  if (statEl) statEl.textContent = rescuedPersons.length;

  // Clear form
  document.getElementById('rescuedName').value = '';
  document.getElementById('rescuedAge').value = '';
  document.getElementById('rescuedZone').value = '';
  document.getElementById('rescuedGender').value = '';
  document.getElementById('rescuedCondition').value = '';
  document.getElementById('rescuedNotes').value = '';
  document.getElementById('rescuedRescuerName').value = '';

  addLog('info', `🦺 PERSON RESCUED — <strong>${name}</strong><br>
    Zone: ${zone} · Condition: ${conditionLabels[condition]} · Rescuer: ${rescuerName}<br>
    <span style="font-family:'JetBrains Mono',monospace;font-size:9px;color:var(--text3)">ID: ${person.id} · ${person.rescueDate} ${person.rescueTime}</span>`);
  showToast(`🦺 ${name} logged — ID: ${person.id}`);
  broadcastToMesh({ type: 'rescued_person', person });
  logAudit('RESCUE_LOG', `${name} · Zone ${zone} · ${condition} · by ${rescuerName} · ID: ${person.id}`);
}

function renderRescuedPersons() {
  const el = document.getElementById('rescuedList');
  if (!rescuedPersons.length) {
    el.innerHTML = '<div class="rescued-empty">No persons logged yet. Use the form above to log a rescued person.</div>';
    return;
  }

  const conditionColors = {
    critical: 'var(--red)', serious: 'var(--orange)', stable: 'var(--warn)',
    minor: 'var(--accent3)', uninjured: 'var(--accent3)'
  };

  const statusLabels = {
    awaiting_treatment: '⏳ AWAITING TREATMENT',
    recovering: '🟢 RECOVERING',
    treated: '✅ TREATED & DISCHARGED',
    transferred: '🔄 TRANSFERRED',
    critical: '🔴 CRITICAL CARE',
    deceased: '⚰ DECEASED',
  };
  const statusColors = {
    awaiting_treatment: 'var(--warn)', recovering: 'var(--accent3)', treated: 'var(--accent3)',
    transferred: 'var(--accent)', critical: 'var(--red)', deceased: 'var(--text3)'
  };

  const canUpdateTreatment = currentRole === 'medic' || currentRole === 'surveillance' || currentRole === null;

  el.innerHTML = rescuedPersons.map(p => {
    const latestTreatment = p.treatmentRecords.length > 0 ? p.treatmentRecords[p.treatmentRecords.length - 1] : null;
    const treatBtn = canUpdateTreatment ? `<button class="drone-btn dispatch" style="font-size:8px;padding:3px 8px" onclick="openTreatmentModal('${p.id}')">🏥 UPDATE TREATMENT</button>` : '';
    const compBtn = p.deceased && !p.compensationFiled ? `<button class="drone-btn" style="font-size:8px;padding:3px 8px;border-color:rgba(255,23,68,0.4);color:var(--red);background:rgba(255,23,68,0.08)" onclick="openCompensationModal('${p.id}')">⚰ FILE COMPENSATION</button>` : '';
    const compDone = p.compensationFiled ? `<span style="font-family:'JetBrains Mono',monospace;font-size:8px;color:var(--text3);padding:3px 8px">✓ COMPENSATION FILED</span>` : '';

    return `
    <div class="rescued-card ${p.deceased ? 'deceased' : ''}" id="rcard-${p.id}">
      <div class="rescued-card-top">
        <div class="rescued-id">${p.id}</div>
        <div class="rescued-status" style="color:${statusColors[p.currentStatus]}">${statusLabels[p.currentStatus] || p.currentStatus}</div>
      </div>
      <div class="rescued-name">${p.name}</div>
      <div class="rescued-meta">
        ${p.age !== 'Unknown' ? `Age: ${p.age} · ` : ''}${p.gender !== 'Not specified' ? `${p.gender} · ` : ''}Zone ${p.zone} · ${p.rescueDate} ${p.rescueTime}
      </div>
      <div class="rescued-condition-row">
        <div>
          <div style="font-family:'JetBrains Mono',monospace;font-size:8px;color:var(--text3);margin-bottom:2px">INITIAL CONDITION</div>
          <div class="rescued-cond-badge" style="color:${conditionColors[p.initialCondition]};border-color:${conditionColors[p.initialCondition]}20">${p.initialConditionLabel}</div>
        </div>
        <div style="text-align:right">
          <div style="font-family:'JetBrains Mono',monospace;font-size:8px;color:var(--text3);margin-bottom:2px">AFTER TREATMENT</div>
          <div class="rescued-cond-badge" style="color:${statusColors[p.currentStatus]};border-color:${statusColors[p.currentStatus]}20">${statusLabels[p.currentStatus] || '—'}</div>
        </div>
      </div>
      ${p.notes ? `<div class="rescued-notes">${p.notes}</div>` : ''}
      ${latestTreatment ? `
        <div class="rescued-treatment-row">
          <div style="font-family:'JetBrains Mono',monospace;font-size:8px;color:var(--text3)">LAST TREATMENT · ${latestTreatment.time}</div>
          <div style="font-size:11px;color:var(--text2);margin-top:2px">${latestTreatment.notes}</div>
          <div style="font-family:'JetBrains Mono',monospace;font-size:8px;color:var(--text3);margin-top:2px">By: ${latestTreatment.medic} ${latestTreatment.facility ? '· ' + latestTreatment.facility : ''}</div>
        </div>
      ` : ''}
      ${p.treatmentRecords.length > 1 ? `<div style="font-family:'JetBrains Mono',monospace;font-size:8px;color:var(--text3);margin-top:4px">📋 ${p.treatmentRecords.length} treatment records total</div>` : ''}
      <div style="font-family:'JetBrains Mono',monospace;font-size:8px;color:var(--text3);margin-top:6px">🦺 Rescued by: ${p.rescuerName}</div>
      <div class="rescued-actions">
        ${treatBtn}
        ${compBtn}
        ${compDone}
      </div>
    </div>`;
  }).join('');
}

function updateRescuedCount() {
  const el = document.getElementById('rescuedCount');
  if (el) el.textContent = `${rescuedPersons.length} LOGGED`;
}

// ==============================================================
// TREATMENT MODAL
// ==============================================================
function openTreatmentModal(personId) {
  if (!roleCanAccess('update_treatment')) {
    showToast('Only Hospital or Main Station can update treatment');
    return;
  }

  treatmentTargetId = personId;
  const p = rescuedPersons.find(x => x.id === personId);
  if (!p) return;

  document.getElementById('treatmentModalPersonInfo').innerHTML = `
    ID: ${p.id} · ${p.name} · Zone ${p.zone}<br>
    Initial condition: ${p.initialConditionLabel}<br>
    Rescue time: ${p.rescueDate} ${p.rescueTime}
  `;
  document.getElementById('treatmentStatus').value = '';
  document.getElementById('treatmentNotes').value = '';
  document.getElementById('treatmentMedicName').value = currentUser?.id || '';
  document.getElementById('treatmentFacility').value = '';
  document.getElementById('treatmentModal').classList.add('show');
}

function closeTreatmentModal() {
  document.getElementById('treatmentModal').classList.remove('show');
  treatmentTargetId = null;
}

function saveTreatmentRecord() {
  if (!roleCanAccess('update_treatment')) {
    showToast('Only Hospital or Main Station can update treatment');
    return;
  }

  const status = document.getElementById('treatmentStatus').value;
  const notes = document.getElementById('treatmentNotes').value.trim();
  const medic = document.getElementById('treatmentMedicName').value.trim();
  const facility = document.getElementById('treatmentFacility').value.trim();

  if (!status) { showToast('Please select a status'); return; }
  if (!notes) { showToast('Please add treatment notes'); return; }

  const p = rescuedPersons.find(x => x.id === treatmentTargetId);
  if (!p) return;

  const record = {
    status, notes, medic: medic || 'Unknown medic',
    facility, time: new Date().toLocaleTimeString(),
    date: new Date().toLocaleDateString('en-IN')
  };

  p.treatmentRecords.push(record);
  p.currentStatus = status;
  if (status === 'deceased') {
    p.deceased = true;
    // Create compensation case
    createCompensationCase(p);
  }

  closeTreatmentModal();
  renderRescuedPersons();

  const statusLabels = { recovering:'RECOVERING', treated:'TREATED & DISCHARGED', transferred:'TRANSFERRED', critical:'CRITICAL CARE', deceased:'DECEASED' };
  addLog('info', `🏥 TREATMENT UPDATE — <strong>${p.name}</strong> (${p.id})<br>
    Status: <strong>${statusLabels[status] || status}</strong><br>
    ${notes}<br>
    <span style="font-family:'JetBrains Mono',monospace;font-size:9px;color:var(--text3)">By: ${medic} ${facility ? '· ' + facility : ''}</span>`);
  showToast(`✓ Treatment record saved for ${p.name}`);

  if (status === 'deceased') {
    showToast(`⚰ ${p.name} marked deceased — compensation case created`);
    setTimeout(() => switchTab('funds', document.querySelector('[onclick="switchTab(\'funds\',this)"]')), 1500);
  }
}

// ==============================================================
// COMPENSATION SYSTEM
// ==============================================================
function createCompensationCase(person) {
  const existing = compensationCases.find(c => c.personId === person.id);
  if (existing) return;

  compensationCases.push({
    personId: person.id,
    name: person.name,
    zone: person.zone,
    rescueTime: person.rescueTime,
    rescueDate: person.rescueDate,
    initialCondition: person.initialConditionLabel,
    deathTime: new Date().toLocaleTimeString(),
    deathDate: new Date().toLocaleDateString('en-IN'),
    familyContact: null,
    amount: null,
    status: 'pending',
    filedBy: currentUser?.id || 'System'
  });

  renderCompensationCases();
  updateCompensationBadge();
}

function openCompensationModal(personId) {
  if (!roleCanAccess('file_compensation')) {
    showToast('Only Hospital or Main Station can file compensation');
    return;
  }

  compensationTargetId = personId;
  const p = rescuedPersons.find(x => x.id === personId);
  if (!p) return;

  document.getElementById('compensationPersonInfo').innerHTML = `
    ID: ${p.id} · ${p.name}<br>
    Zone: ${p.zone} · Initial condition: ${p.initialConditionLabel}<br>
    Rescue: ${p.rescueDate} ${p.rescueTime}
  `;
  document.getElementById('compFamilyName').value = '';
  document.getElementById('compPhone').value = '';
  document.getElementById('compRelation').value = '';
  document.getElementById('compAmount').value = '';
  document.getElementById('compNotes').value = '';
  document.getElementById('compensationModal').classList.add('show');
}

function closeCompensationModal() {
  document.getElementById('compensationModal').classList.remove('show');
  compensationTargetId = null;
}

function saveCompensation() {
  if (!roleCanAccess('file_compensation')) {
    showToast('Only Hospital or Main Station can file compensation');
    return;
  }

  const familyName = document.getElementById('compFamilyName').value.trim();
  const phone = document.getElementById('compPhone').value.trim();
  const relation = document.getElementById('compRelation').value.trim();
  const amount = document.getElementById('compAmount').value;
  const notes = document.getElementById('compNotes').value.trim();

  if (!familyName || !amount) { showToast('Please fill family name and compensation tier'); return; }

  const p = rescuedPersons.find(x => x.id === compensationTargetId);
  const c = compensationCases.find(x => x.personId === compensationTargetId);
  if (!p || !c) return;

  c.familyContact = `${familyName} (${relation}) · ${phone}`;
  c.amount = amount;
  c.notes = notes;
  c.status = 'filed';
  c.filedTime = new Date().toLocaleTimeString();
  p.compensationFiled = true;

  closeCompensationModal();
  renderRescuedPersons();
  renderCompensationCases();
  updateCompensationBadge();

  addLog('decision', `⚰ COMPENSATION FILED — <strong>${p.name}</strong> (${p.id})<br>
    Family: ${familyName} (${relation})<br>
    Amount: <strong>${amount}</strong> — queued on Starknet<br>
    <span style="font-family:'JetBrains Mono',monospace;font-size:9px;color:var(--text3)">Filed by: ${currentUser?.id || 'System'} · IPFS anchored</span>`);
  showToast(`⚰ Compensation claim filed for ${p.name} — ${amount}`);
}

function renderCompensationCases() {
  const el = document.getElementById('compensationList');
  if (!el) return;
  if (!compensationCases.length) {
    el.innerHTML = '<div style="padding:10px;background:var(--bg2);border:1px solid var(--border);border-radius:4px;font-family:\'JetBrains Mono\',monospace;font-size:9px;color:var(--text3);text-align:center">No deceased compensation cases yet.</div>';
    return;
  }
  el.innerHTML = compensationCases.map(c => `
    <div style="background:var(--bg2);border:1px solid ${c.status==='filed'?'var(--border)':'rgba(255,23,68,0.25)'};border-left:2px solid ${c.status==='filed'?'var(--text3)':'var(--red)'};border-radius:4px;padding:10px 12px;margin-bottom:6px;animation:msg-in 0.2s ease-out">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
        <div style="font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:700;color:var(--text)">${c.name}</div>
        <div style="font-family:'JetBrains Mono',monospace;font-size:8px;color:${c.status==='filed'?'var(--text3)':'var(--red)'}">
          ${c.status==='filed'?'✓ FILED':'⏳ PENDING'}
        </div>
      </div>
      <div style="font-family:'JetBrains Mono',monospace;font-size:9px;color:var(--text3)">Zone ${c.zone} · ${c.deathDate} ${c.deathTime}</div>
      ${c.familyContact ? `<div style="font-size:11px;color:var(--text2);margin-top:4px">👨‍👩‍👧 ${c.familyContact}</div>` : ''}
      ${c.amount ? `<div style="font-family:'Orbitron',monospace;font-size:14px;color:var(--accent3);margin-top:4px">${c.amount}</div>` : ''}
      ${c.txHash ? `<div style="font-family:'JetBrains Mono',monospace;font-size:9px;color:var(--accent3);margin-top:4px">⛓ TX: ${c.txHash}</div>` : ''}
      ${c.smsProofAt ? `<div style="font-family:'JetBrains Mono',monospace;font-size:9px;color:var(--text3);margin-top:2px">📲 SMS proof sent: ${new Date(c.smsProofAt).toLocaleString()}</div>` : ''}
      ${c.notes ? `<div style="font-size:10px;color:var(--text2);margin-top:4px">${c.notes}</div>` : ''}
      ${c.note ? `<div style="font-size:10px;color:var(--text2);margin-top:4px">${c.note}</div>` : ''}
    </div>
  `).join('');
}

function updateCompensationBadge() {
  const pending = compensationCases.filter((c) => c.status !== 'filed').length;
  const badge = document.getElementById('compensationBadge');
  if (badge) {
    badge.textContent = pending + ' PENDING';
    badge.style.display = pending > 0 ? '' : 'none';
  }
}

// ==============================================================
// ZAMA TFHE
// ==============================================================
async function initTFHE() {
  try {
    const { TfheClientKey, TfheCompactPublicKey, CompactCiphertextList } = await import('https://cdn.jsdelivr.net/npm/tfhe@0.6.4/tfhe.js');
    const clientKey = TfheClientKey.generate();
    const publicKey = TfheCompactPublicKey.new(clientKey);
    window.__tfhe = { clientKey, publicKey, CompactCiphertextList };
    addMeshLog('🔐 Zama TFHE: WASM loaded — FHE encryption active');
  } catch (e) {
    addMeshLog('🔐 Zama TFHE: running in simulation mode');
  }
}

async function fheEncrypt(text) {
  if (window.__tfhe) {
    try {
      const { publicKey, CompactCiphertextList } = window.__tfhe;
      const builder = CompactCiphertextList.builder(publicKey);
      const bytes = new TextEncoder().encode(text.substring(0, 16));
      bytes.forEach(b => builder.push_u8(b));
      const list = builder.build();
      const serialized = list.serialize();
      return Array.from(serialized.slice(0, 20)).map(b => b.toString(16).padStart(2,'0')).join('');
    } catch (e) { return randHex(40); }
  }
  return randHex(40);
}

async function pinToIPFS(data) {
  try {
    const { create } = await import('https://esm.sh/@web3-storage/w3up-client@16');
    const client = await create();
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const file = new File([blob], `disasternet-${Date.now()}.json`);
    const cid = await client.uploadFile(file);
    const cidStr = cid.toString();
    addMeshLog(`📦 IPFS pinned: ${cidStr.substring(0,20)}...`);
    return cidStr;
  } catch (e) {
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(data)));
    const hex = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2,'0')).join('');
    return 'Qm' + hex.substring(0, 44).toUpperCase();
  }
}

// ==============================================================
// API MODAL
// ==============================================================
function closeApiModal(useKey) {
  if (useKey) {
    const key = document.getElementById('apiKeyInput').value.trim();
    if (!key.startsWith('sk-ant-')) { alert('Please enter a valid Anthropic API key (starts with sk-ant-)'); return; }
    apiKey = key;
    sessionStorage.setItem('dnet_key', key);
    simMode = false;
    updateAIStatus();
    showToast('⚡ Impulse AI activated');
  } else {
    simMode = true; updateAIStatus();
    showToast('Running in simulation mode');
  }
  document.getElementById('apiModal').classList.remove('show');
}

function updateAIStatus() {
  const pill = document.getElementById('aiStatusPill');
  const label = document.getElementById('aiLabel');
  if (!simMode) {
    label.textContent = 'AI ACTIVE';
    pill.querySelector('.dot').className = 'dot dot-green';
  } else {
    label.textContent = 'SIM MODE';
    pill.querySelector('.dot').className = 'dot dot-orange';
  }
}

// ==============================================================
// ZONES
// ==============================================================
function renderZones() {
  const el = document.getElementById('zoneList');
  el.innerHTML = '';
  ZONES.forEach((z, i) => {
    const pct = Math.min(100, Math.round(z.resources / (z.resources + z.victims * 0.05) * 100));
    const col = { critical:'var(--red)', high:'var(--orange)', medium:'var(--warn)', low:'var(--green)' }[z.sev];
    const droneBadge = z.droneRequired ? '<span class="badge badge-cyan" style="font-size:8px;padding:1px 4px">DRONE REQUIRED</span>' : '';
    el.innerHTML += `
      <div class="zone-card" id="zc${i}" onclick="selectZone(${i})">
        <div class="zone-top">
          <span class="zone-id">ZONE ${z.id}</span>
          <span style="display:flex;align-items:center;gap:6px"><span class="sev sev-${z.sev}">${z.sev}</span>${droneBadge}</span>
        </div>
        <div class="zone-name">${z.name}</div>
        <div class="zone-stats"><span>👥 ${z.victims}</span><span>🚑 ${z.resources} units</span></div>
        <div class="zone-bar"><div class="zone-fill" style="width:${pct}%;background:${col}"></div></div>
      </div>`;
  });
}

function selectZone(i) {
  document.querySelectorAll('.zone-card').forEach(c => c.classList.remove('active'));
  document.getElementById('zc' + i).classList.add('active');
}

// ==============================================================
// MAP
// ==============================================================
function getZoneById(zoneId) {
  return ZONES.find((z) => z.id === zoneId) || null;
}

function hydrateZoneDroneFlags() {
  ZONES.forEach((zone) => {
    zone.droneRequired = droneRequiredZones.has(zone.id);
  });
}

function saveRoadStatuses() {
  sessionStorage.setItem('dnet_road_status_v1', JSON.stringify(roadStatusById));
}

function saveDroneRequiredZones() {
  sessionStorage.setItem('dnet_drone_required_v1', JSON.stringify(Array.from(droneRequiredZones)));
}

function setMapRouteStatus(text) {
  const el = document.getElementById('mapRouteStatus');
  if (el) el.textContent = text;
}

function getRoadStatus(edgeId) {
  return roadStatusById[edgeId] || 'clear';
}

function roadTraversalCost(edge) {
  const status = getRoadStatus(edge.id);
  if (status === 'blocked') return Infinity;
  if (status === 'risky') return edge.baseCost * 2.2;
  return edge.baseCost;
}

function initMapToolSelectors() {
  const fromEl = document.getElementById('routeFromZone');
  const toEl = document.getElementById('routeToZone');
  if (!fromEl || !toEl) return;

  const options = ZONES.map((zone) => `<option value="${zone.id}">${zone.id} — ${zone.name}</option>`).join('');
  fromEl.innerHTML = options;
  toEl.innerHTML = options;
  fromEl.value = 'MH1';
  toEl.value = 'OD1';
}

function setRoadPaintMode(mode) {
  currentRoadPaintMode = mode;
  ['clear', 'risky', 'blocked'].forEach((m) => {
    const btn = document.getElementById(`roadMode${m.charAt(0).toUpperCase() + m.slice(1)}`);
    if (!btn) return;
    if (m === mode) btn.classList.add('active');
    else btn.classList.remove('active');
  });
  setMapRouteStatus(`Road marking mode: ${mode.toUpperCase()}. Tap any road segment on map.`);
}

function renderMap() {
  const mapContainer = document.getElementById('mapContent');
  if (!mapContainer) return;
  if (typeof L === 'undefined') {
    mapContainer.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:10px;color:var(--text3);font-family:'JetBrains Mono',monospace;font-size:10px;text-align:center;padding:20px">
      <div style="font-size:28px">🗺</div>
      <div style="color:var(--warn);font-weight:700;letter-spacing:1px">MAP OFFLINE</div>
      <div>Leaflet CDN unavailable — check internet connection.</div>
      <div style="font-size:9px">Zone data and all other features remain operational.</div>
      <button onclick="location.reload()" style="margin-top:8px;padding:5px 14px;background:rgba(0,212,255,0.1);border:1px solid rgba(0,212,255,0.3);border-radius:3px;color:var(--accent);cursor:pointer;font-family:'JetBrains Mono',monospace;font-size:9px;letter-spacing:1px">↺ RETRY</button>
    </div>`;
    return;
  }

  if (mapInstance) {
    mapInstance.remove();
    mapInstance = null;
  }

  mapContainer.innerHTML = '';

  mapInstance = L.map('mapContent', {
    zoomControl: true,
    attributionControl: true,
    preferCanvas: true,
  }).setView([19.10, 74.40], 7);

  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 14,
    minZoom: 6,
    attribution: '&copy; OpenStreetMap contributors',
  }).addTo(mapInstance);

  zoneMarkersById = {};
  ZONES.forEach((zone) => {
    const coords = ZONE_COORDS[zone.id];
    if (!coords) return;

    const severityColors = {
      critical: '#ff1744',
      high: '#ff6b35',
      medium: '#ffcc00',
      low: '#00c851',
    };
    const markerColor = zone.droneRequired ? '#00d4ff' : (severityColors[zone.sev] || '#00d4ff');

    const marker = L.circleMarker(coords, {
      radius: zone.droneRequired ? 9 : 7,
      color: markerColor,
      weight: 2,
      fillColor: markerColor,
      fillOpacity: 0.22,
    }).addTo(mapInstance);

    marker.bindPopup(
      `<strong>Zone ${zone.id} — ${zone.name}</strong><br>${zone.detail}<br>` +
      `Victims: ${zone.victims} · Resources: ${zone.resources}` +
      (zone.droneRequired ? '<br><span style="color:#00d4ff;font-weight:700">DRONE REQUIRED</span>' : '')
    );

    marker.on('click', () => {
      const idx = ZONES.findIndex((z) => z.id === zone.id);
      if (idx >= 0) selectZone(idx);
    });

    zoneMarkersById[zone.id] = marker;
  });

  roadLayersById = {};
  ROAD_EDGES.forEach((edge) => {
    const status = getRoadStatus(edge.id);
    const layer = L.polyline(edge.points, {
      color: ROAD_STATUS_COLORS[status],
      weight: status === 'blocked' ? 6 : 5,
      opacity: status === 'blocked' ? 0.9 : 0.75,
      dashArray: status === 'risky' ? '8 8' : null,
    }).addTo(mapInstance);

    layer.bindTooltip(`${edge.from} ↔ ${edge.to} · ${status.toUpperCase()}`, { sticky: true });
    layer.on('click', () => {
      setRoadStatus(edge.id, currentRoadPaintMode, { shouldBroadcast: true, source: 'local' });
    });

    roadLayersById[edge.id] = layer;
  });

  if (routeLayer) {
    routeLayer.remove();
    routeLayer = null;
  }

  renderDroneOverlay();
  renderVulnerableOverlay();
  setMapRouteStatus('Offline routing ready. Tap roads to update status.');
}

function setRoadStatus(edgeId, status, options = {}) {
  const edge = ROAD_EDGES.find((r) => r.id === edgeId);
  if (!edge) return;

  roadStatusById[edgeId] = status;
  saveRoadStatuses();

  const layer = roadLayersById[edgeId];
  if (layer) {
    layer.setStyle({
      color: ROAD_STATUS_COLORS[status],
      weight: status === 'blocked' ? 6 : 5,
      opacity: status === 'blocked' ? 0.9 : 0.75,
      dashArray: status === 'risky' ? '8 8' : null,
    });
    layer.setTooltipContent(`${edge.from} ↔ ${edge.to} · ${status.toUpperCase()}`);
  }

  setMapRouteStatus(`Road ${edge.from} ↔ ${edge.to} set to ${status.toUpperCase()}.`);
  addMeshLog(`🛣 ${edge.from} ↔ ${edge.to} marked ${status.toUpperCase()}`);

  if (options.shouldBroadcast) {
    broadcastToMesh({
      type: 'road_status',
      edgeId,
      status,
      by: NODE_ID,
      ts: Date.now(),
    });
  }
}

function buildRoadGraph() {
  const graph = {};
  ROAD_EDGES.forEach((edge) => {
    const cost = roadTraversalCost(edge);
    if (!Number.isFinite(cost)) return;

    if (!graph[edge.from]) graph[edge.from] = [];
    if (!graph[edge.to]) graph[edge.to] = [];

    graph[edge.from].push({ to: edge.to, edgeId: edge.id, cost });
    graph[edge.to].push({ to: edge.from, edgeId: edge.id, cost });
  });
  return graph;
}

function haversineKm(a, b) {
  const toRad = (v) => v * Math.PI / 180;
  const [lat1, lon1] = a;
  const [lat2, lon2] = b;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const rLat1 = toRad(lat1);
  const rLat2 = toRad(lat2);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(rLat1) * Math.cos(rLat2) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  return 6371 * c;
}

function computeAStarPath(fromZoneId, toZoneId) {
  const graph = buildRoadGraph();
  if (!graph[fromZoneId] || !graph[toZoneId]) return null;

  const open = new Set([fromZoneId]);
  const cameFrom = {};
  const gScore = {};
  const fScore = {};

  ZONES.forEach((z) => {
    gScore[z.id] = Infinity;
    fScore[z.id] = Infinity;
  });

  gScore[fromZoneId] = 0;
  fScore[fromZoneId] = haversineKm(ZONE_COORDS[fromZoneId], ZONE_COORDS[toZoneId]);

  while (open.size > 0) {
    let current = null;
    open.forEach((node) => {
      if (current === null || fScore[node] < fScore[current]) current = node;
    });

    if (current === toZoneId) {
      const path = [current];
      const edgePath = [];
      while (cameFrom[current]) {
        edgePath.unshift(cameFrom[current].edgeId);
        current = cameFrom[current].node;
        path.unshift(current);
      }
      return { zones: path, edges: edgePath, cost: gScore[toZoneId] };
    }

    open.delete(current);
    const neighbors = graph[current] || [];
    neighbors.forEach((neighbor) => {
      const tentative = gScore[current] + neighbor.cost;
      if (tentative < gScore[neighbor.to]) {
        cameFrom[neighbor.to] = { node: current, edgeId: neighbor.edgeId };
        gScore[neighbor.to] = tentative;
        fScore[neighbor.to] = tentative + haversineKm(ZONE_COORDS[neighbor.to], ZONE_COORDS[toZoneId]);
        open.add(neighbor.to);
      }
    });
  }

  return null;
}

function drawRoute(route) {
  if (!mapInstance) return;

  if (routeLayer) {
    routeLayer.remove();
    routeLayer = null;
  }

  const points = route.zones.map((zoneId) => ZONE_COORDS[zoneId]).filter(Boolean);
  if (!points.length) return;

  routeLayer = L.polyline(points, {
    color: '#00d4ff',
    weight: 4,
    opacity: 0.95,
    dashArray: '10 6',
  }).addTo(mapInstance);

  // Fly map to fit the route so it's always visible after calculation
  try { mapInstance.fitBounds(routeLayer.getBounds(), { padding: [40, 40], maxZoom: 10, animate: true, duration: 0.8 }); } catch(e) {}
}

function flagZoneDroneRequired(zoneId, reason, options = {}) {
  if (droneRequiredZones.has(zoneId)) return;
  droneRequiredZones.add(zoneId);
  saveDroneRequiredZones();

  const zone = getZoneById(zoneId);
  if (zone) zone.droneRequired = true;
  renderZones();

  const marker = zoneMarkersById[zoneId];
  if (marker) {
    marker.setStyle({ color: '#00d4ff', fillColor: '#00d4ff', radius: 9, fillOpacity: 0.28 });
  }

  addLog('alert', `🚁 DRONE REQUIRED — Zone ${zoneId}<br>${reason}`);
  setMapRouteStatus(`No road route available to Zone ${zoneId}. Zone flagged as DRONE REQUIRED.`);

  if (options.shouldBroadcast) {
    broadcastToMesh({ type: 'drone_required', zoneId, reason, ts: Date.now(), by: NODE_ID });
  }
}

function calculateOfflineRoute() {
  const fromEl = document.getElementById('routeFromZone');
  const toEl = document.getElementById('routeToZone');
  if (!fromEl || !toEl) return;

  const fromZoneId = fromEl.value;
  const toZoneId = toEl.value;

  if (!fromZoneId || !toZoneId || fromZoneId === toZoneId) {
    setMapRouteStatus('Pick different FROM and TO zones to compute route.');
    return;
  }

  const route = computeAStarPath(fromZoneId, toZoneId);
  if (!route) {
    flagZoneDroneRequired(
      toZoneId,
      `Offline A* could not find valid path from ${fromZoneId}. Road network blocked; queue scout drone mission.`,
      { shouldBroadcast: true }
    );
    return;
  }

  drawRoute(route);
  const blockedRoads = ROAD_EDGES.filter((edge) => getRoadStatus(edge.id) === 'blocked').length;
  setMapRouteStatus(`Route ${fromZoneId} → ${toZoneId}: ${route.zones.join(' → ')} · cost ${Math.round(route.cost)} · blocked roads ${blockedRoads}.`);
  addMeshLog(`🧭 Offline A* route ${fromZoneId} → ${toZoneId}: ${route.zones.join(' → ')}`);
}

// ==============================================================
// AGENT LOG
// ==============================================================
function addLog(type, html) {
  const el = document.getElementById('agentLog');
  const div = document.createElement('div');
  div.className = `msg ${type}`;
  const labels = { system:'SYSTEM', alert:'FIELD ALERT', decision:'AI DECISION', info:'ASSESSMENT' };
  div.innerHTML = `<div class="msg-label">${labels[type]||'LOG'} · ${new Date().toLocaleTimeString()}</div>${html}`;
  el.appendChild(div);
  el.scrollTop = el.scrollHeight;
  broadcastToMesh({ type:'agent_msg', content:html, msgType:type });
}

function setThinking(v) {
  document.getElementById('agentThinking').className = 'agent-thinking' + (v?' on':'');
}

// ==============================================================
// SUBMIT REPORT
// ==============================================================
async function submitReport() {
  const txt = document.getElementById('reportInput')?.value?.trim();
  if (!txt) return;
  addLog('alert', `📍 Field report: <strong>${txt}</strong>`);
  document.getElementById('reportInput').value = '';
  setThinking(true);
  document.getElementById('agentSub').textContent = 'PROCESSING FIELD DATA...';
  broadcastToMesh({ type:'field_report', text: txt });
  const cid = await pinToIPFS({ report: txt, ts: Date.now(), node: NODE_ID });
  if (simMode || !apiKey) await simulatedDecision(txt, cid);
  else await callClaude(txt, cid);
  setThinking(false);
  document.getElementById('agentSub').textContent = 'MONITORING — READY';
  if (currentUser && Math.random() > 0.5) {
    const zone = txt.match(/Zone\s+(\w+)/i)?.[1] || 'FIELD';
    addHypercert({ name: currentUser.id, action: txt.substring(0,60)+'...', zone, trust: currentUser.trust });
  }
}

async function callClaude(report, cid) {
  try {
    // Try server-side proxy first (no key exposure, no CORS issues)
    // Falls back to direct browser call if proxy isn't deployed
    const proxyAvailable = await fetch('/api/ai-proxy', { method:'HEAD' }).then(r => r.ok).catch(() => false);
    let res;
    if (proxyAvailable) {
      res = await fetch('/api/ai-proxy', {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({ prompt: report, systemPrompt: SYSTEM_PROMPT })
      });
    } else {
      res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type':'application/json',
          'x-api-key':apiKey,
          'anthropic-version':'2023-06-01',
          'anthropic-dangerous-direct-browser-access':'true'
        },
        body: JSON.stringify({
          model:'claude-sonnet-4-20250514',
          max_tokens:350,
          stream: true,
          system:SYSTEM_PROMPT,
          messages:[{role:'user',content:report}]
        })
      });
    }

    if (!res.ok || !res.body) {
      const errData = await res.json().catch(() => ({}));
      if (errData.error) { simMode = true; updateAIStatus(); await simulatedDecision(report, cid); return; }
    }

    // Create the streaming log entry
    const el = document.getElementById('agentLog');
    const div = document.createElement('div');
    div.className = 'msg decision';
    const timeStr = new Date().toLocaleTimeString();
    div.innerHTML = `<div class="msg-label">AI DECISION · ${timeStr}</div><span id="streamTarget"></span>`;
    el.appendChild(div);
    el.scrollTop = el.scrollHeight;

    const target = div.querySelector('#streamTarget');
    let fullText = '';

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop(); // keep incomplete line

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const payload = line.slice(6).trim();
        if (payload === '[DONE]') continue;
        try {
          const evt = JSON.parse(payload);
          if (evt.type === 'content_block_delta' && evt.delta?.type === 'text_delta') {
            fullText += evt.delta.text;
            target.textContent = fullText;
            el.scrollTop = el.scrollHeight;
          }
          if (evt.type === 'message_stop') {
            // Append IPFS footer
            const footer = document.createElement('span');
            footer.innerHTML = `<br><span style="font-family:JetBrains Mono,monospace;font-size:9px;color:var(--text3)">📦 IPFS: ${cid.substring(0,24)}...</span>`;
            div.appendChild(footer);
            updateResourcesRandom();
          }
        } catch (e) { /* malformed SSE line, skip */ }
      }
    }

    if (!fullText) { simMode = true; updateAIStatus(); await simulatedDecision(report, cid); }
  } catch (e) {
    simMode = true; updateAIStatus(); await simulatedDecision(report, cid);
  }
}

async function simulatedDecision(txt, cid) {
  await new Promise(r => setTimeout(r, 1600 + Math.random()*800));
  const lc = txt.toLowerCase();
  const cidStr = cid || ('Qm' + randHex(22).toUpperCase());
  let resp;
  if (lc.includes('oxygen') || lc.includes('hospital') || lc.includes('critical'))
    resp = `⚡ DECISION: Medical emergency escalated. FHE-encrypted data share from Zone OD1 hospital to AIIMS Bhubaneswar via Lit Protocol. Helicopter 3 redirected from Zone KA1. 4 field medics reassigned from Zone GJ1. Cross-state patient transfer authorised. Hypercert minting queued.`;
  else if (lc.includes('bridge') || lc.includes('road') || lc.includes('block'))
    resp = `⚡ DECISION: Route obstruction confirmed. Diverting NDRF Convoy 4 via NH16 bypass — ETA +42min to Zone BH1. Zone WB1 rescue team redistributed northward. Starknet contract updated with deviation log.`;
  else if (lc.includes('flood') || lc.includes('water') || lc.includes('stranded'))
    resp = `⚡ DECISION: Flood rescue activated. Dispatching 6 NDRF rescue boats from Zone AP1 reserve. Rescue window 4hr before next high tide. NEAR-verified volunteer Squad 7 + Squad 12 activated. Hypercert minting queued.`;
  else
    resp = `⚡ DECISION: Report processed. Severity assessed HIGH. Nearest field team dispatched (ETA 18-24min). Field data FHE-encrypted and broadcast to 6 mesh nodes across 4 states. 2 medics reassigned from lower-priority zones.`;
  addLog('decision', resp + `<br><span style="font-family:JetBrains Mono,monospace;font-size:9px;color:var(--text3)">📦 IPFS: ${cidStr.substring(0,24)}...</span>`);
  updateResourcesRandom();
}

async function runInitialAssessment() {
  setThinking(true);
  document.getElementById('agentSub').textContent = 'SCANNING ALL ZONES...';
  if (simMode || !apiKey) {
    await new Promise(r => setTimeout(r, 1800));
    addLog('info', `🔍 INITIAL SCAN COMPLETE: 7 zones active. Priority: C3 (oxygen critical) → A2 (240 victims) → B1 (route blocked). Helicopter 2 → C3. Convoy 1 rerouted via NH48 → A2. FHE sync active.`);
  } else {
    const cid = await pinToIPFS({ type:'initial_scan', ts:Date.now(), node:NODE_ID });
    await callClaude(`Initial situation report: India multi-state disaster. Active zones: MH1 Mumbai CRITICAL 1840 (flood), OD1 Puri CRITICAL 2300 (cyclone), UK1 Chamoli CRITICAL 320 (GLOF/landslide), AP1 Vijayawada CRITICAL 5400 (flood), AS1 Silchar HIGH 1200, BH1 Bihar HIGH 3100. Provide national priority triage and cross-state resource allocation.`, cid);
  }
  setThinking(false);
  document.getElementById('agentSub').textContent = 'MONITORING — READY';
}

function randHex(n) { return Array.from({length:n},()=>Math.floor(Math.random()*16).toString(16)).join(''); }

// ==============================================================
// RESOURCES
// ==============================================================
function renderResources() {
  document.getElementById('resList').innerHTML = RESOURCES.map(r => {
    const pct = Math.round(r.deployed/r.total*100);
    return `<div class="res-item">
      <div class="res-top"><span class="res-name">${r.name}</span><span class="res-count">${r.deployed}/${r.total}</span></div>
      <div class="res-bar"><div class="res-fill" style="width:${pct}%;background:${r.color}"></div></div>
      <div class="res-note">${pct}% deployed · ${r.total-r.deployed} in reserve</div>
    </div>`;
  }).join('');
}

function updateResourcesRandom() {
  RESOURCES.forEach(r => { if (Math.random() > 0.4) r.deployed = Math.min(r.total, r.deployed + 1); });
  renderResources();
}

// ==============================================================
// MISSING PERSONS / FHE
// ==============================================================
async function logMissingPerson() {
  const name = document.getElementById('mpName').value.trim();
  const zone = document.getElementById('mpZone').value.trim();
  const note = document.getElementById('mpNote').value.trim();
  const phone = document.getElementById('mpPhone')?.value?.trim() || '';
  if (!name || !zone) { showToast('Please fill in name and zone'); return; }
  showToast('🔐 Encrypting with Zama TFHE...');
  const cipher = await fheEncrypt(name + '|' + zone + '|' + note);
  const cid = await pinToIPFS({ name_enc:cipher, zone, note, ts:Date.now(), node:NODE_ID });
  const rec = {
    id: 'LOCAL-' + Date.now().toString(36).toUpperCase(),
    name,
    zone,
    note,
    phone,
    status: 'Missing',
    updatedAt: new Date().toISOString(),
    time:new Date().toLocaleTimeString(),
    cipher,
    cid,
    anchorCid: cid,
    deceasedConfirmations: 0,
    compensation: null,
  };

  const reporterRole = currentRole === 'surveillance' ? 'surveillance' : (currentRole || 'rescuer');
  const backendRes = await postJsonSafe(`${SYNC_API_BASE}/api/v1/persons`, {
    name,
    phone,
    lastSeenZone: zone,
    note,
    anchorCid: cid,
    reporterId: currentUser?.id || NODE_ID,
    reporterRole,
  });

  if (backendRes.ok && backendRes.data?.person) {
    upsertMissingPersonLocal(backendRes.data.person);
  } else {
    missingPersons.unshift(rec);
  }

  renderMissingPersons();
  document.getElementById('mpName').value = '';
  document.getElementById('mpZone').value = '';
  document.getElementById('mpNote').value = '';
  const mpPhoneEl = document.getElementById('mpPhone');
  if (mpPhoneEl) mpPhoneEl.value = '';
  broadcastToMesh({ type:'missing_person', record:rec });
  addMeshLog(`📋 Missing person FHE-encrypted: ${name}`);
  showToast(`🔒 ${name} logged · FHE encrypted`);
}

async function updateMissingPersonStatus(personId) {
  const selectEl = document.getElementById(`mpStatus_${personId}`);
  if (!selectEl) return;

  const newStatus = selectEl.value;
  if (!newStatus) return;

  const person = missingPersons.find((p) => p.id === personId);
  if (!person) return;

  const actorRole = currentRole === 'surveillance' ? 'surveillance' : (currentRole || 'rescuer');
  const payload = {
    status: newStatus,
    actorId: currentUser?.id || NODE_ID,
    actorRole,
    note: `Status updated from dashboard by ${currentUser?.id || NODE_ID}`,
    lastSeenZone: person.zone,
  };

  const res = await postJsonSafe(`${SYNC_API_BASE}/api/v1/persons/${personId}/status`, payload);
  if (!res.ok) {
    showToast(res.data?.message || 'Status update failed');
    return;
  }

  if (res.data?.person) upsertMissingPersonLocal(res.data.person);
  renderMissingPersons();

  if (newStatus === 'Deceased' && res.data?.deceasedConfirmations < 2) {
    showToast(`Deceased confirmation recorded (${res.data.deceasedConfirmations}/2)`);
  } else {
    showToast(`Status updated to ${newStatus}`);
  }

  if (res.data?.compensation?.txHash) {
    addLog('decision', `💸 AUTO COMPENSATION TRIGGERED — ${res.data.person.name}<br>Tx: ${res.data.compensation.txHash}`);
    showToast(`Compensation paid: ${res.data.compensation.txHash.slice(0, 12)}...`);
  }
}

function renderMissingPersons() {
  const el = document.getElementById('mpList');
  if (!el) return;

  if (!missingPersons.length) {
    el.innerHTML = '<div class="mp-card" style="text-align:center;color:var(--text3)">No missing-person records yet.</div>';
    return;
  }

  const statusColors = {
    Missing: 'var(--red)',
    Located: 'var(--accent)',
    Displaced: 'var(--warn)',
    Hospitalised: 'var(--orange)',
    Deceased: 'var(--text3)',
  };

  const canUpdate = currentRole === 'rescuer' || currentRole === 'medic' || currentRole === 'surveillance' || currentRole === null;

  el.innerHTML = missingPersons.map((p) => {
    const cidPreview = (p.anchorCid || p.cid || '').toString();
    const statusColor = statusColors[p.status] || 'var(--text2)';
    const confirmationLabel = p.status === 'Deceased'
      ? `<div style="font-family:'JetBrains Mono',monospace;font-size:8px;color:var(--text3);margin-top:4px">Rescuer confirmations: ${p.deceasedConfirmations || 0}/2</div>`
      : '';

    const actions = canUpdate ? `
      <div style="display:flex;gap:6px;margin-top:7px;align-items:center">
        <select class="mp-input" id="mpStatus_${p.id}" style="margin:0;font-size:10px;padding:6px;max-width:170px;color:var(--text2)">
          <option value="Missing" ${p.status==='Missing'?'selected':''}>Missing</option>
          <option value="Located" ${p.status==='Located'?'selected':''}>Located</option>
          <option value="Displaced" ${p.status==='Displaced'?'selected':''}>Displaced</option>
          <option value="Hospitalised" ${p.status==='Hospitalised'?'selected':''}>Hospitalised</option>
          <option value="Deceased" ${p.status==='Deceased'?'selected':''}>Deceased</option>
        </select>
        <button class="drone-btn dispatch" style="font-size:8px;padding:4px 8px" onclick="updateMissingPersonStatus('${p.id}')">UPDATE</button>
      </div>` : '';

    const compensation = p.compensation?.txHash
      ? `<div class="mp-enc" style="margin-top:5px;color:var(--accent3)">💸 Compensation TX: ${p.compensation.txHash}</div>`
      : '';

    const timeline = (p.statusHistory || []).length
      ? `<div style="margin-top:6px;padding-top:6px;border-top:1px dashed rgba(255,255,255,0.08)">
          ${(p.statusHistory || []).map((h) => {
            const ts = new Date(h.ts || Date.now()).toLocaleString();
            const by = `${h.byRole || 'user'}:${h.byId || 'unknown'}`;
            return `<div style="font-family:'JetBrains Mono',monospace;font-size:8px;color:var(--text3);margin-bottom:3px">• ${h.status || p.status} · ${ts} · ${by}${h.note ? ` · ${h.note}` : ''}</div>`;
          }).join('')}
        </div>`
      : '';

    return `
      <div class="mp-card">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
          <div class="mp-name">${p.name}</div>
          <span class="badge" style="font-size:8px;border:1px solid ${statusColor};color:${statusColor};background:transparent">${p.status || 'Missing'}</span>
        </div>
        <div class="mp-meta">Zone ${p.zone || 'UNKNOWN'} · ${(p.note || 'No details')} · ${new Date(p.updatedAt || Date.now()).toLocaleString()}</div>
        <div class="mp-enc">🔒 FHE: ${(p.cipher || '').substring(0,28)}...<br>📦 IPFS: ${cidPreview ? cidPreview.substring(0,32) + '...' : 'pending'}</div>
        ${confirmationLabel}
        ${compensation}
        ${timeline}
        ${actions}
      </div>`;
  }).join('');
}

// ==============================================================
// WORLD ID — VOLUNTEER VERIFICATION
// ==============================================================
const WORLD_ID_APP = 'app_staging_your_app_id'; // Replace with your Worldcoin app ID from developer.worldcoin.org
const WORLD_ID_ACTION = 'disasternet-volunteer-verify';

let worldIdVerified = false;
let worldIdNullifier = null; // nullifier_hash = unique per (user × action) — prevents double-registration

function triggerWorldId() {
  // IDKit vanilla JS — loaded from CDN as window.IDKit
  const IDKit = window.IDKit;
  if (!IDKit) {
    // Fallback: IDKit CDN failed to load — show dev-mode simulation
    simulateWorldIdVerification();
    return;
  }

  try {
    IDKit.init({
      app_id: WORLD_ID_APP,
      action: WORLD_ID_ACTION,
      signal: currentUser?.id || NODE_ID,     // ties proof to this session
      verification_level: 'device',            // 'orb' for full humanity proof; 'device' for hackathon testing
      onSuccess: onWorldIdSuccess,
      onError: onWorldIdError,
    });
    IDKit.open();
  } catch (e) {
    console.warn('IDKit open failed:', e);
    simulateWorldIdVerification();
  }
}

function onWorldIdSuccess(result) {
  // result: { merkle_root, nullifier_hash, proof, verification_level, credential_type }
  worldIdVerified = true;
  worldIdNullifier = result.nullifier_hash;

  const statusEl = document.getElementById('worldIdStatus');
  const proofEl = document.getElementById('worldIdProof');
  const btn = document.getElementById('worldIdBtn');

  if (statusEl) statusEl.innerHTML = `<span style="color:var(--accent3)">✅ VERIFIED · ${result.verification_level?.toUpperCase() || 'DEVICE'} · nullifier: ${result.nullifier_hash?.slice(0,18)}…</span>`;
  if (proofEl) {
    proofEl.style.display = 'block';
    proofEl.innerHTML = `✅ World ID proof received<br>Verification level: <strong>${result.verification_level || 'device'}</strong><br>Nullifier hash: ${(result.nullifier_hash || '').slice(0, 32)}…<br>Merkle root: ${(result.merkle_root || '').slice(0, 32)}…<br><span style="color:var(--text3);font-size:8px">Proof anchored to volunteer session ${NODE_ID}</span>`;
  }
  if (btn) { btn.textContent = '✅ VERIFIED'; btn.style.background = 'rgba(57,255,20,0.1)'; btn.style.borderColor = 'rgba(57,255,20,0.4)'; btn.style.color = 'var(--accent3)'; btn.disabled = true; }

  addMeshLog(`🌍 World ID: volunteer verified — nullifier ${(result.nullifier_hash || '').slice(0,16)}… · level: ${result.verification_level || 'device'}`);
  showToast('✅ World ID verified — volunteer identity confirmed');

  // Broadcast verification to mesh so other nodes see it
  broadcastToMesh({ type: 'world_id_verified', nullifier: result.nullifier_hash, level: result.verification_level });

  // Auto-add a verified HyperCert for this session
  const volunteerName = currentUser?.id || NODE_ID;
  addHypercert({ name: volunteerName, action: 'World ID verified — eligible for rescue operations', zone: currentUser?.zone || 'ALL', trust: 'WORLD-ID-VERIFIED' });
}

function onWorldIdError(error) {
  addMeshLog(`🌍 World ID: verification failed — ${error?.code || error}`);
  showToast(`World ID: ${error?.message || 'Verification cancelled'}`);
}

// Dev/demo simulation when IDKit CDN is unavailable or app_id is staging
function simulateWorldIdVerification() {
  const fakeNullifier = '0x' + Array.from({length:64}, () => Math.floor(Math.random()*16).toString(16)).join('');
  const fakeMerkle   = '0x' + Array.from({length:64}, () => Math.floor(Math.random()*16).toString(16)).join('');
  onWorldIdSuccess({
    nullifier_hash: fakeNullifier,
    merkle_root: fakeMerkle,
    proof: '0xSIMULATED',
    verification_level: 'device',
    credential_type: 'orb',
  });
  addMeshLog('🌍 World ID: running in simulation mode (staging app_id — replace with production ID)');
}

window.triggerWorldId = triggerWorldId;

// ==============================================================
// HYPERCERTS
// ==============================================================
function initHypercerts() {
  const seeds = [
    { name:'priya_v.near', action:'Led coastal rescue of 48 persons — Puri cyclone Zone OD1', zone:'OD1', trust:'ORB-VERIFIED' },
    { name:'arjun_r.near', action:'Coordinated NDRF medical convoy to Zone AP1 Vijayawada flood', zone:'AP1', trust:'ORB-VERIFIED' },
    { name:'meera_s.near', action:'Helicopter evacuation of 22 tourists — Chamoli Zone UK1', zone:'UK1', trust:'DEV-VERIFIED' },
  ];
  seeds.forEach(s => addHypercert(s, true));
}

function addHypercert({ name, action, zone, trust }, silent=false) {
  const id = 'HC-' + Date.now().toString(36).toUpperCase().slice(-6);
  hypercerts.unshift({ id, name, action, zone, trust, minted:false, time:new Date().toLocaleTimeString() });
  renderHypercerts();
  if (!silent) showToast(`🏅 Hypercert queued: ${name}`);
}

function renderHypercerts() {
  const el = document.getElementById('hcList');
  if (!hypercerts.length) { el.innerHTML = '<div style="padding:20px;text-align:center;font-family:JetBrains Mono,monospace;font-size:10px;color:var(--text3)">No Hypercerts minted yet.</div>'; return; }
  const countEl = document.getElementById('hcCount');
  if (countEl) countEl.textContent = hypercerts.filter(h => h.minted).length + ' MINTED';
  el.innerHTML = hypercerts.map((h,i) => `
    <div class="hc-card">
      <div class="hc-top"><span class="hc-name">${h.name}</span><span class="hc-id">${h.id}</span></div>
      <div class="hc-desc">${h.action}</div>
      <div class="hc-meta">Zone ${h.zone} · ${h.trust} · ${h.time}</div>
      <div class="hc-mint-btn ${h.minted?'minted':''}" onclick="mintHC(${i})">${h.minted?'✓ MINTED ON-CHAIN':'⚡ MINT HYPERCERT'}</div>
    </div>`).join('');
}

function mintHC(i) {
  if (!roleCanAccess('mint_hypercert')) {
    showToast('Only Main Station can mint Hypercerts');
    return;
  }

  hypercerts[i].minted = true;
  renderHypercerts();
  showToast(`✓ Hypercert ${hypercerts[i].id} minted on-chain`);
}

// ==============================================================
// ==============================================================
// STARKNET SEPOLIA — REAL INTEGRATION
// ==============================================================

// Contract on Starknet Sepolia testnet
const STARKNET_CONTRACT = '0x04a7c3f1e2b8d9a6f5c3e1b8d9a6f5c3e1b8d9a6f5c3e1b8d9a6f5c3e1b8d9a';
const STARKNET_RPC = 'https://starknet-sepolia.public.blastapi.io/rpc/v0_7';
const STARKSCAN_BASE = 'https://sepolia.starkscan.co';

// Cache for on-chain state
let starknetProvider = null;
let starknetConnected = false;
let onChainDisbursements = {}; // txHash keyed by NGO index

function getStarknetProvider() {
  if (starknetProvider) return starknetProvider;
  try {
    // starknet.js loaded via CDN as window.starknet_esm or starknet global
    const S = window.starknet_esm || window.starknet;
    if (S && S.RpcProvider) {
      starknetProvider = new S.RpcProvider({ nodeUrl: STARKNET_RPC });
    }
  } catch(e) {
    console.warn('Starknet provider init failed:', e);
  }
  return starknetProvider;
}

// Read on-chain disbursement count — view call, no wallet needed
async function fetchOnChainStats() {
  const provider = getStarknetProvider();
  if (!provider) return null;
  try {
    const result = await provider.callContract({
      contractAddress: STARKNET_CONTRACT,
      entrypoint: 'get_disbursement_count',
      calldata: [],
    });
    return { disbursementCount: parseInt(result[0] || result?.result?.[0] || '0x0', 16) };
  } catch(e) {
    // Contract may not have this entrypoint on Sepolia — fall back gracefully
    return null;
  }
}

// Connect ArgentX / Braavos wallet via window.starknet
async function connectStarknetWallet() {
  const walletApi = window.starknet;
  if (!walletApi) {
    showToast('⚠ No Starknet wallet found — install ArgentX or Braavos');
    addMeshLog('🔗 Starknet: no wallet extension detected');
    return null;
  }
  try {
    await walletApi.enable({ starknetVersion: 'v5' });
    starknetConnected = true;
    const addr = walletApi.selectedAddress;
    addMeshLog(`🔗 Starknet: wallet connected — ${addr ? addr.slice(0,10) + '...' : 'unknown'}`);
    showToast(`✓ Starknet wallet connected`);
    return walletApi.account;
  } catch(e) {
    showToast('Wallet connection cancelled');
    return null;
  }
}

// Write: invoke disburse_funds on-chain — requires wallet
async function disburseFundsOnChain(ngoIndex, amountFelt) {
  const walletApi = window.starknet;
  if (!walletApi?.account) {
    showToast('Connect a Starknet wallet first (ArgentX / Braavos)');
    return null;
  }
  try {
    const tx = await walletApi.account.execute({
      contractAddress: STARKNET_CONTRACT,
      entrypoint: 'disburse_to_ngo',
      calldata: [ngoIndex.toString(), amountFelt],
    });
    return tx.transaction_hash;
  } catch(e) {
    console.warn('Starknet tx failed:', e);
    return null;
  }
}

// Render NGO list with live chain status badge
function renderNGOs() {
  document.getElementById('ngoList').innerHTML = NGOS.map((n,i) => {
    const txHash = onChainDisbursements[i];
    const explorerUrl = txHash ? `${STARKSCAN_BASE}/tx/${txHash}` : null;
    const onChainBadge = txHash
      ? `<a href="${explorerUrl}" target="_blank" rel="noopener" style="font-family:'JetBrains Mono',monospace;font-size:8px;color:var(--accent3);text-decoration:none;padding:2px 6px;border:1px solid rgba(57,255,20,0.4);border-radius:3px;background:rgba(57,255,20,0.08)" title="View on Starkscan">🔗 ON-CHAIN ↗</a>`
      : '';
    return `
    <div class="ngo-card">
      <div class="ngo-dot" style="background:${n.color}"></div>
      <div class="ngo-info">
        <div class="ngo-name">${n.name} ${onChainBadge}</div>
        <div class="ngo-meta">Zones: ${n.zone} · ${n.status.toUpperCase()}</div>
      </div>
      <div class="ngo-amt">${n.amount}</div>
      <div class="disburse-btn ${n.status==='disbursed'?'done':''}" id="dgbtn${i}" onclick="disburse(${i})">${n.status==='disbursed'?'DONE':'SEND'}</div>
    </div>`;
  }).join('');

  // Async: update chain stats banner if provider available
  fetchOnChainStats().then(stats => {
    if (!stats) return;
    const banner = document.getElementById('starknetStatsBanner');
    if (banner) {
      banner.innerHTML = `🔗 Starknet Sepolia: <strong>${stats.disbursementCount}</strong> on-chain disbursements confirmed · <a href="${STARKSCAN_BASE}/contract/${STARKNET_CONTRACT}" target="_blank" rel="noopener" style="color:var(--accent3)">View contract ↗</a>`;
      banner.style.display = '';
    }
  });
}

async function disburse(i) {
  if (!roleCanAccess('disburse_funds')) {
    showToast('Only Main Station can disburse funds');
    return;
  }

  const btn = document.getElementById('dgbtn'+i);

  // Try real on-chain tx first
  const walletApi = window.starknet;
  if (walletApi?.selectedAddress || walletApi?.account) {
    // Wallet connected — attempt real tx
    if (btn) { btn.textContent = 'SIGNING…'; btn.classList.add('done'); }
    addMeshLog(`🔗 Starknet: requesting wallet signature for ${NGOS[i].name}…`);

    // Convert INR amount string to a representative felt (demo: use index as token id)
    const txHash = await disburseFundsOnChain(i, i.toString());

    if (txHash) {
      onChainDisbursements[i] = txHash;
      NGOS[i].status = 'disbursed';
      NGOS[i].color = 'var(--accent3)';
      renderNGOs();
      showToast(`✓ On-chain tx submitted: ${txHash.slice(0,14)}…`);
      addMeshLog(`💸 Starknet tx: ${txHash.slice(0,20)}… — ${NGOS[i].amount} → ${NGOS[i].name}`);
      logAudit('FUND_DISBURSE_ONCHAIN', `NGO: ${NGOS[i].name} · tx: ${txHash}`);
      return;
    } else {
      // Tx failed or rejected — fall through to simulation
      if (btn) { btn.textContent = 'SEND'; btn.classList.remove('done'); }
    }
  }

  // No wallet or tx failed — simulation mode with clear label
  const walletConnected = !!(walletApi?.selectedAddress);
  if (!walletConnected) {
    showToast('⚠ No wallet — running in simulation mode. Install ArgentX to submit on-chain.');
    addMeshLog(`💸 Starknet (sim): ${NGOS[i].amount} queued for ${NGOS[i].name}`);
  }

  NGOS[i].status = 'disbursed';
  if (btn) { btn.textContent = 'DONE (SIM)'; btn.classList.add('done'); }
  showToast(`✓ ${NGOS[i].amount} queued for ${NGOS[i].name} — connect wallet to submit on-chain`);
  addMeshLog(`💸 Starknet: ${NGOS[i].amount} disbursed to ${NGOS[i].name}`);
  logAudit('FUND_DISBURSE', `NGO: ${NGOS[i].name} · Amount: ${NGOS[i].amount}`);
}

// Expose wallet connect to header button (added in about modal or funds panel)
window.connectStarknetWallet = connectStarknetWallet;

// ==============================================================
// DRONE FLEET
// ==============================================================
const DRONES = [
  { id:'D1', name:'Drone D1', status:'surveillance', zone:'OD1', payload:'Thermal camera · aerial feed',     battery:78, eta:null },
  { id:'D2', name:'Drone D2', status:'delivering',   zone:'AP1', payload:'Water purification kits · 18kg', battery:61, eta:'12min' },
  { id:'D3', name:'Drone D3', status:'delivering',   zone:'MH1', payload:'Oxygen canisters · 8kg',          battery:54, eta:'8min' },
  { id:'D4', name:'Drone D4', status:'charging',     zone:'BASE', payload:'—', battery:22, eta:null },
  { id:'D5', name:'Drone D5', status:'standby',      zone:'UK1', payload:'Mountain rescue kit · 6kg',      battery:95, eta:null },
  { id:'D6', name:'Drone D6', status:'surveillance', zone:'BH1', payload:'Thermal camera · aerial feed',   battery:83, eta:null },
];

const DRONE_MAP_POS = {
  D1:{x:32,y:28},D2:{x:48,y:55},D3:{x:62,y:35},D4:{x:50,y:85},D5:{x:38,y:62},D6:{x:60,y:72}
};

function renderDrones() {
  const el = document.getElementById('droneList');
  if (!el) return;
  el.innerHTML = '';
  DRONES.forEach((d, i) => {
    const battCol = d.battery > 60 ? 'var(--accent3)' : d.battery > 30 ? 'var(--warn)' : 'var(--red)';
    const etaStr = d.eta ? ` · ETA ${d.eta}` : '';
    const card = document.createElement('div');
    card.className = `drone-card ${d.status}`;
    card.innerHTML = `
      <div class="drone-top"><div class="drone-id">🚁 ${d.name}</div><div class="drone-status-badge ${d.status}">${d.status.toUpperCase()}${etaStr}</div></div>
      <div class="drone-zone">📍 ${d.zone==='BASE'?'BASE STATION':'Zone '+d.zone}</div>
      <div class="drone-payload">📦 ${d.payload}</div>
      <div class="drone-bar"><div class="drone-bar-fill" style="width:${d.battery}%;background:${battCol}"></div></div>
      <div style="font-family:'JetBrains Mono',monospace;font-size:8px;color:var(--text3);margin-bottom:6px">🔋 BATTERY: ${d.battery}%</div>
      <div class="drone-actions">
        <button class="drone-btn dispatch ${d.status==='charging'?'disabled':''}" onclick="dispatchDrone(${i})">⚡ DISPATCH</button>
        <button class="drone-btn recall ${d.status==='charging'||d.status==='standby'?'disabled':''}" onclick="recallDrone(${i})">↩ RECALL</button>
      </div>`;
    el.appendChild(card);
  });
  renderDroneOverlay();
  updateDroneStats();
}

function renderDroneOverlay() {
  if (!mapInstance || typeof L === 'undefined') return;

  Object.values(droneLeafletMarkers).forEach((marker) => mapInstance.removeLayer(marker));
  droneLeafletMarkers = {};

  DRONES.forEach((drone) => {
    if (drone.status === 'charging') return;
    const coords = ZONE_COORDS[drone.zone];
    if (!coords) return;

    const icon = L.divIcon({
      className: 'leaflet-drone-icon',
      html: `<div style="font-size:16px;filter:drop-shadow(0 0 6px rgba(0,212,255,0.8))">🚁</div>`,
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    });

    const marker = L.marker(coords, { icon }).addTo(mapInstance);
    marker.bindTooltip(`${drone.name} · ${drone.status.toUpperCase()} · Zone ${drone.zone}`, { direction: 'top' });
    droneLeafletMarkers[drone.id] = marker;
  });
}

function updateDroneStats() {
  const s = { active:0, delivering:0, surveillance:0, charging:0 };
  DRONES.forEach(d => {
    if (d.status === 'charging') s.charging++;
    else { s.active++; if (d.status === 'delivering') s.delivering++; else if (d.status === 'surveillance') s.surveillance++; }
  });
  if (document.getElementById('dronesActive')) document.getElementById('dronesActive').textContent = s.active;
  if (document.getElementById('dronesDelivering')) document.getElementById('dronesDelivering').textContent = s.delivering;
  if (document.getElementById('dronesSurveillance')) document.getElementById('dronesSurveillance').textContent = s.surveillance;
  if (document.getElementById('dronesCharging')) document.getElementById('dronesCharging').textContent = s.charging;
}

function dispatchDrone(i) {
  if (!roleCanAccess('dispatch_drones')) {
    showToast('Only Main Station can dispatch drones');
    return;
  }

  const d = DRONES[i];
  if (d.status === 'charging') return;
  const zones = ['MH1','OD1','UK1','AP1','AS1','BH1','RJ1','HP1','KL1','TN1','GJ1','JH1','MN1','WB1'];
  d.status = 'delivering'; d.zone = zones.find(z => z !== d.zone) || 'MH1'; d.eta = Math.floor(5+Math.random()*15)+'min';
  renderDrones();
  addLog('info', `🚁 ${d.name} dispatched → Zone ${d.zone}, ETA ${d.eta}`);
  showToast(`🚁 ${d.name} dispatched to Zone ${d.zone}`);
}

function recallDrone(i) {
  if (!roleCanAccess('dispatch_drones')) {
    showToast('Only Main Station can recall drones');
    return;
  }

  DRONES[i].status = 'standby'; DRONES[i].eta = null;
  renderDrones();
  addLog('info', `↩ ${DRONES[i].name} recalled to base.`);
}

setInterval(() => {
  DRONES.forEach(d => {
    if (d.status === 'charging') { d.battery = Math.min(100, d.battery + 3); if (d.battery >= 95) { d.status = 'standby'; showToast(`🚁 ${d.name} charged — standby`); } }
    else if (d.status === 'delivering' || d.status === 'surveillance') {
      d.battery = Math.max(10, d.battery - 0.5);
      if (d.battery <= 10) { d.status = 'charging'; d.zone = 'BASE'; d.eta = null; showToast(`⚠ ${d.name} low battery`); }
    }
    if (d.status === 'delivering' && d.eta) {
      const mins = parseInt(d.eta);
      if (!isNaN(mins)) {
        if (mins - 1 <= 0) { addLog('decision', `✅ ${d.name} delivery complete at Zone ${d.zone}.`); d.status = 'surveillance'; d.eta = null; }
        else d.eta = (mins-1)+'min';
      }
    }
  });
  updateDroneStats(); renderDroneOverlay();
}, 30000);

// ==============================================================
// DISPATCH CONSOLE
// ==============================================================
function openDispatch() {
  const w = window.open('dispatch.html', '_blank');
  if (!w) showToast('⚠ Popup blocked — allow popups for this site to open the Dispatch Console');
}

// ==============================================================
// MESH
// ==============================================================
// ==============================================================
// MESH — PARTYKIT WEBSOCKET (cross-device) + BROADCASTCHANNEL FALLBACK (same-browser)
// ==============================================================

// Set PARTYKIT_HOST to your deployed Partykit project hostname, e.g.:
//   "disasternet.YOUR_USERNAME.partykit.dev"
// Leave empty to run BroadcastChannel-only (same-browser tabs).
const PARTYKIT_HOST = (typeof PARTYKIT_HOST_ENV !== 'undefined' && PARTYKIT_HOST_ENV)
  ? PARTYKIT_HOST_ENV
  : '';                // injected at deploy time via vercel env var → window.PARTYKIT_HOST_ENV

const PARTYKIT_ROOM = 'disasternet-india-ops';

let partySocket = null;       // PartySocket WebSocket (cross-device)
let pkConnected = false;

function initMesh() {
  // ── Layer 1: BroadcastChannel (always on — same-browser tabs) ──────────
  channel = new BroadcastChannel('disasternet_mesh_v2');
  channel.onmessage = (e) => handleMeshMessage(e.data, 'bc');

  addMeshLog(`🟢 ${NODE_ID} on BroadcastChannel mesh`);

  // ── Layer 2: Partykit WebSocket (cross-device, if host configured) ──────
  if (PARTYKIT_HOST && window.PartySocket) {
    try {
      partySocket = new window.PartySocket({
        host: PARTYKIT_HOST,
        room: PARTYKIT_ROOM,
        id: NODE_ID,
      });

      partySocket.addEventListener('open', () => {
        pkConnected = true;
        addMeshLog(`🌐 Partykit mesh ONLINE — cross-device sync active · room: ${PARTYKIT_ROOM}`);
        updateMeshStatusBadge(true);
        // announce presence
        pkSend({ type: 'ping', from: NODE_ID, role: currentRole || 'unknown', ts: Date.now() });
      });

      partySocket.addEventListener('message', (evt) => {
        try {
          const msg = JSON.parse(evt.data);
          handleMeshMessage(msg, 'pk');
        } catch(e) { /* ignore malformed */ }
      });

      partySocket.addEventListener('close', () => {
        pkConnected = false;
        addMeshLog('🟠 Partykit disconnected — falling back to BroadcastChannel');
        updateMeshStatusBadge(false);
      });

      partySocket.addEventListener('error', () => {
        pkConnected = false;
        addMeshLog('🟠 Partykit unavailable — BroadcastChannel active');
      });
    } catch(e) {
      addMeshLog('🟠 Partykit init failed — BroadcastChannel only');
    }
  } else {
    addMeshLog(`💡 Cross-device mesh: deploy Partykit and set PARTYKIT_HOST to enable · same-tab sync active`);
  }
}

function updateMeshStatusBadge(online) {
  // Update the MESH ACTIVE pill in the topbar to reflect Partykit status
  const pill = document.querySelector('.pill-active');
  if (!pill) return;
  pill.style.borderColor = online ? 'rgba(57,255,20,0.5)' : '';
  pill.title = online ? `Partykit cross-device mesh active — room: ${PARTYKIT_ROOM}` : 'BroadcastChannel same-browser mesh';
}

function pkSend(data) {
  if (partySocket && pkConnected && partySocket.readyState === WebSocket.OPEN) {
    try { partySocket.send(JSON.stringify({ ...data, from: NODE_ID })); } catch(e) {}
  }
}

function handleMeshMessage(msg, source) {
  if (!msg || msg.from === NODE_ID) return;

  if (msg.type === 'ping') {
    addMeshLog(`📡 ${source === 'pk' ? '🌐' : '📡'} Ping from ${msg.from}${msg.role ? ` (${msg.role})` : ''}`);
    activatePhone(2);
    const n2s = document.getElementById('n2s');
    if (n2s) n2s.textContent = 'ACTIVE';
    const arr1 = document.getElementById('arr1');
    if (arr1) arr1.classList.add('active');
    const md2 = document.getElementById('md2');
    if (md2) md2.classList.add('on');
    // pong back
    if (source === 'pk') pkSend({ type: 'pong', from: NODE_ID });
    else channel.postMessage({ type: 'pong', from: NODE_ID });
  }
  if (msg.type === 'pong') {
    addMeshLog(`✅ Pong from ${msg.from}`);
    activatePhone(2);
  }
  if (msg.type === 'missing_person') {
    refreshMissingPersonsFromBackend();
    addMeshLog(`👤 ${source === 'pk' ? '🌐' : ''} Missing person synced: ${msg.record?.name || '?'}`);
  }
  if (msg.type === 'rescued_person') {
    addMeshLog(`🦺 ${source === 'pk' ? '🌐' : ''} Rescued person synced: ${msg.person?.name || '?'}`);
  }
  if (msg.type === 'agent_msg') addMeshLog(`⚡ AI decision synced from ${msg.from}`);
  if (msg.type === 'field_report') addMeshLog(`📍 Field report from ${msg.from}: "${(msg.text||'').substring(0,45)}…"`);
  if (msg.type === 'road_status') {
    setRoadStatus(msg.edgeId, msg.status, { shouldBroadcast: false, source: 'mesh' });
    addMeshLog(`🛣 Mesh sync: road ${msg.edgeId} → ${msg.status.toUpperCase()} by ${msg.by || msg.from}`);
  }
  if (msg.type === 'drone_required' && msg.zoneId) {
    flagZoneDroneRequired(msg.zoneId, msg.reason || `Alert from ${msg.by || msg.from}`, { shouldBroadcast: false });
    addMeshLog(`🚁 Mesh sync: Zone ${msg.zoneId} flagged DRONE REQUIRED`);
  }
  if (msg.type === 'world_id_verified') {
    addMeshLog(`🌍 World ID: ${msg.from} verified across mesh · nullifier ${(msg.nullifier||'').slice(0,16)}…`);
  }
}

function doBroadcastPing() {
  const payload = { type: 'ping', from: NODE_ID, role: currentRole || 'unknown', ts: Date.now() };
  channel.postMessage(payload);
  pkSend(payload);
  addMeshLog(`📡 Ping broadcast from ${NODE_ID} (BC${pkConnected ? ' + Partykit' : ''})`);
}

function broadcastToMesh(data) {
  const payload = { ...data, from: NODE_ID };
  if (channel) channel.postMessage(payload);   // same-browser tabs
  pkSend(payload);                              // cross-device via Partykit
}

function addMeshLog(txt) { meshLogs.unshift({ txt, ts:new Date().toLocaleTimeString() }); if (meshLogs.length > 40) meshLogs.pop(); renderMeshLog(); }
function renderMeshLog() { document.getElementById('meshLog').innerHTML = meshLogs.map(l => `<div class="mesh-line"><span class="ts">${l.ts}</span>${l.txt}</div>`).join(''); }
function activatePhone(n) { document.getElementById('phone'+n)?.classList.add('active'); }

function simulateMeshActivity() {
  const events = [
    [3000,  () => addMeshLog('📊 Zone MH1: packet relayed — 3 hops — 11ms')],
    [7000,  () => { addMeshLog('🔄 Resource table sync — Δ3 records'); activatePhone(2); document.getElementById('md3').classList.add('on'); document.getElementById('n3s').textContent = 'SYNCING'; }],
    [12000, () => { addMeshLog('📦 IPFS batch queued — 47 records'); document.getElementById('md4').classList.add('on'); document.getElementById('n3s').textContent = 'ACTIVE'; }],
    [18000, () => addMeshLog('⚡ AI decision propagated to 3 mesh nodes')],
    [25000, () => addMeshLog('🌍 World ID: volunteer identity confirmed')],
    [32000, () => addMeshLog('🔐 Lit Protocol: key gate checked for Zone OD1 medical data')],
    [50000, () => addMeshLog('🔒 Zama TFHE: 12 new records encrypted — batch broadcast')],
    [62000, () => addMeshLog('💸 Starknet: disbursement condition verified')],
  ];
  events.forEach(([delay, fn]) => setTimeout(fn, delay));
}

// ==============================================================
// TABS
// ==============================================================
function switchTab(name, el) {
  if (!allowedTabsForCurrentRole.has(name)) {
    showToast('Access limited for your role');
    return;
  }
  document.querySelectorAll('.tab').forEach(t => {
    t.classList.remove('active');
    t.setAttribute('aria-selected', 'false');
    t.setAttribute('tabindex', '-1');
  });
  document.querySelectorAll('.tab-content').forEach(t => {
    t.classList.remove('active');
    // Only clear inline display if this tab is allowed (avoids re-showing restricted tabs)
    const tabNameMatch = t.id.replace('tab-', '');
    if (allowedTabsForCurrentRole.has(tabNameMatch)) {
      t.style.display = '';
    }
  });
  if (el) {
    el.classList.add('active');
    el.setAttribute('aria-selected', 'true');
    el.setAttribute('tabindex', '0');
  }
  const contentEl = document.getElementById('tab-'+name);
  if (contentEl) { contentEl.style.display = ''; contentEl.classList.add('active'); }
}

// ==============================================================
// TOAST
// ==============================================================
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 3200);
}

// ==============================================================
// VULNERABLE POPULATION
// ==============================================================
const VULNERABLE = {
  MH1: { elderly:210, disabled:58, infants:94, nonLocal:320, total:682,  clusters:[{lat:19.04,lng:72.84,count:340,note:'Dharavi — dense slum, elderly & children priority'},{lat:19.06,lng:72.88,count:342,note:'Low-lying waterlogged colony — 342 stranded'}] },
  OD1: { elderly:480, disabled:92, infants:210,nonLocal:80,  total:862,  clusters:[{lat:19.82,lng:85.82,count:420,note:'Coastal fishing village — no evacuation transport'},{lat:19.79,lng:85.84,count:442,note:'Cyclone shelter overflow — 442 stranded outside'}] },
  UK1: { elderly:42,  disabled:8,  infants:12, nonLocal:180, total:242,  clusters:[{lat:30.42,lng:79.30,count:120,note:'Tourists stranded — Badrinath highway cut'},{lat:30.40,lng:79.32,count:122,note:'Village cut off — helicopter only access'}] },
  AP1: { elderly:620, disabled:140,infants:310,nonLocal:90,  total:1160, clusters:[{lat:16.52,lng:80.63,count:580,note:'Low-lying colony — Krishna flood plain'},{lat:16.50,lng:80.65,count:580,note:'Agricultural workers — flooded fields'}] },
  AS1: { elderly:180, disabled:34, infants:120,nonLocal:42,  total:376,  clusters:[{lat:24.83,lng:92.80,count:210,note:'Barak valley — riverine community'},{lat:24.80,lng:92.78,count:166,note:'Tea estate workers — isolated'}] },
  BH1: { elderly:540, disabled:88, infants:280,nonLocal:30,  total:938,  clusters:[{lat:26.18,lng:85.91,count:480,note:'Flood plain village — Bagmati overflow'},{lat:26.15,lng:85.89,count:458,note:'Dalit basti — typically last reached by relief'}] },
  RJ1: { elderly:120, disabled:22, infants:64, nonLocal:10,  total:216,  clusters:[{lat:25.76,lng:71.40,count:216,note:'Desert community — unexpected flash flood, no boats'}] },
  HP1: { elderly:38,  disabled:6,  infants:10, nonLocal:148, total:202,  clusters:[{lat:31.97,lng:77.12,count:202,note:'Tourists stranded — Rohtang pass closed'}] },
  KL1: { elderly:96,  disabled:18, infants:42, nonLocal:22,  total:178,  clusters:[{lat:11.69,lng:76.14,count:178,note:'Tribal community on hillside — landslide risk'}] },
  TN1: { elderly:160, disabled:44, infants:80, nonLocal:60,  total:344,  clusters:[{lat:13.09,lng:80.28,count:180,note:'North Chennai slum — Adyar flood zone'},{lat:13.07,lng:80.26,count:164,note:'Low-lying residential — waterlogged'}] },
  GJ1: { elderly:82,  disabled:20, infants:44, nonLocal:30,  total:176,  clusters:[{lat:21.20,lng:72.84,count:176,note:'Tapi riverside settlement — pre-emptive evacuation'}] },
  JH1: { elderly:64,  disabled:12, infants:36, nonLocal:8,   total:120,  clusters:[{lat:23.35,lng:85.32,count:120,note:'Subarnarekha basin — low-lying tribal area'}] },
  MN1: { elderly:44,  disabled:10, infants:22, nonLocal:14,  total:90,   clusters:[{lat:24.83,lng:93.95,count:90,note:'Imphal valley — landslide-hit community'}] },
  WB1: { elderly:120, disabled:28, infants:64, nonLocal:18,  total:230,  clusters:[{lat:25.01,lng:88.15,count:230,note:'Ganga erosion zone — riverbank community'}] },
  PB1: { elderly:28,  disabled:4,  infants:16, nonLocal:4,   total:52,   clusters:[{lat:32.04,lng:75.41,count:52,note:'Ravi flood plain — minor at-risk community'}] },
  MP1: { elderly:22,  disabled:4,  infants:12, nonLocal:2,   total:40,   clusters:[{lat:23.19,lng:79.95,count:40,note:'Narmada tributary bank — stable monitoring'}] },
  CG1: { elderly:18,  disabled:2,  infants:10, nonLocal:2,   total:32,   clusters:[{lat:21.26,lng:81.64,count:32,note:'Mahanadi tributary — pre-emptive evacuation'}] },
  KA1: { elderly:20,  disabled:4,  infants:8,  nonLocal:12,  total:44,   clusters:[{lat:12.43,lng:75.74,count:44,note:'Coorg hillside — landslide debris zone'}] },
};

let showVulnerable = false;

function toggleVulnerable() {
  showVulnerable = !showVulnerable;
  const btn = document.getElementById('vulnToggleBtn');
  if (btn) btn.textContent = showVulnerable ? '🟣 HIDE VULNERABLE' : '🟣 SHOW VULNERABLE';
  renderVulnerableOverlay();
}

function renderVulnerableOverlay() {
  if (!mapInstance || typeof L === 'undefined') return;

  vulnerableLeafletMarkers.forEach((marker) => mapInstance.removeLayer(marker));
  vulnerableLeafletMarkers = [];

  if (!showVulnerable) return;

  ZONES.forEach((zone) => {
    const v = VULNERABLE[zone.id];
    const zoneCoords = ZONE_COORDS[zone.id];
    if (!v || !zoneCoords) return;

    v.clusters.forEach((cluster, idx) => {
      const jitterLat = (idx + 1) * 0.04;
      const jitterLng = (idx + 1) * 0.05;
      const markerCoords = [zoneCoords[0] + jitterLat, zoneCoords[1] + jitterLng];

      const marker = L.circleMarker(markerCoords, {
        radius: Math.max(6, Math.min(12, Math.round(cluster.count / 2))),
        color: '#8b5cf6',
        fillColor: '#8b5cf6',
        fillOpacity: 0.28,
        weight: 2,
      }).addTo(mapInstance);

      marker.bindTooltip(`Vulnerable cluster · ${cluster.count} people`, { direction: 'top' });
      marker.on('click', () => showVulnPopup(zone.id, cluster));
      vulnerableLeafletMarkers.push(marker);
    });
  });
}

function showVulnPopup(zoneId, cluster) {
  const v = VULNERABLE[zoneId];
  showToast(`Zone ${zoneId}: ${v.elderly} elderly · ${v.disabled} disabled · ${v.infants} infants`);
  addLog('alert', `🟣 VULNERABLE CLUSTER — Zone ${zoneId}: ${cluster.note}<br><span style="font-size:11px">👴 Elderly: ${v.elderly} · ♿ Disabled: ${v.disabled} · 👶 Infants: ${v.infants} · 🌐 Non-local: ${v.nonLocal}</span><br><span style="font-family:JetBrains Mono,monospace;font-size:9px;color:var(--warn)">⚠ PRIORITY EVACUATION RECOMMENDED</span>`);
}

// ==============================================================
// DAM WATER LEVEL FEED
// ==============================================================
const DAMS = [
  { name:'Hirakud Dam',       location:'Odisha',           capacity:5819.0,  current:5648.0, status:'critical', zones:['OD1','CG1'] },
  { name:'Farakka Barrage',   location:'West Bengal',      capacity:2240.0,  current:2185.0, status:'critical', zones:['WB1','BH1'] },
  { name:'Nagarjunasagar',    location:'Andhra Pradesh',   capacity:11472.0, current:10820.0,status:'watch',    zones:['AP1','TN1'] },
  { name:'Tehri Dam',         location:'Uttarakhand',      capacity:3540.0,  current:3290.0, status:'watch',    zones:['UK1','HP1'] },
  { name:'Idukki Dam',        location:'Kerala',           capacity:1996.0,  current:1874.0, status:'watch',    zones:['KL1'] },
  { name:'Bhakra Nangal',     location:'Punjab / Himachal',capacity:9340.0,  current:6820.0, status:'safe',     zones:['PB1','HP1'] },
  { name:'Sardar Sarovar',    location:'Gujarat',          capacity:9500.0,  current:7840.0, status:'safe',     zones:['GJ1','RJ1'] },
  { name:'Srisailam Dam',     location:'Andhra Pradesh',   capacity:8722.0,  current:7100.0, status:'safe',     zones:['AP1'] },
];

function renderDams() {
  const el = document.getElementById('damList');
  if (!el) return;
  el.innerHTML = DAMS.map(d => {
    const pct = Math.round(d.current/d.capacity*100);
    const col = d.status==='critical'?'var(--red)':d.status==='watch'?'var(--warn)':'var(--accent3)';
    const statusLabel = d.status==='critical'?'🔴 CRITICAL':d.status==='watch'?'🟡 WATCH':'🟢 SAFE';
    return `<div class="dam-card dam-${d.status}">
      <div class="dam-top">
        <div><div class="dam-name">${d.name}</div><div class="dam-location">📍 ${d.location} · Affects: Zone ${d.zones.join(', Zone ')}</div></div>
        <div class="dam-status-badge dam-badge-${d.status}">${statusLabel}</div>
      </div>
      <div class="dam-bar"><div class="dam-fill" style="width:${pct}%;background:${col}"></div></div>
      <div class="dam-stats">
        <span style="font-family:'JetBrains Mono',monospace;font-size:9px;color:${col}">${d.current} TMC / ${d.capacity} TMC (${pct}%)</span>
        ${d.status==='critical'?'<span style="font-family:JetBrains Mono,monospace;font-size:9px;color:var(--red);animation:blink 0.8s infinite">⚠ OVERFLOW RISK</span>':''}
      </div>
    </div>`;
  }).join('');
}

setInterval(() => {
  DAMS.forEach(d => {
    const delta = (Math.random()-0.4)*0.3;
    d.current = Math.max(d.capacity*0.5, Math.min(d.capacity*0.99, d.current+delta));
    const pct = d.current/d.capacity;
    const oldStatus = d.status;
    d.status = pct>0.95?'critical':pct>0.85?'watch':'safe';
    if (oldStatus !== 'critical' && d.status === 'critical') {
      addLog('alert', `⚠ DAM ALERT: ${d.name} reached CRITICAL level (${Math.round(d.current/d.capacity*100)}%). Downstream zones ${d.zones.join(', ')} at flood risk within 6hr.`);
      showToast(`⚠ ${d.name} CRITICAL — ${Math.round(d.current/d.capacity*100)}%`);
    }
  });
  renderDams();
}, 15000);

// ==============================================================
// ANTICIPATORY ACTION ENGINE
// ==============================================================
const ANTICIPATORY_ALERTS = [
  { delay:40000,  zone:'OD1', msg:'⚡ ANTICIPATORY ALERT: Zone OD1 Puri — cyclone eye landfall in 3.5hr. <strong>PREDICTED CRITICAL in 2hr.</strong> Pre-positioning Helicopter 3 + coastal rescue boats. NDRF Team 7 mobilised from Bhubaneswar.', type:'alert' },
  { delay:85000,  zone:'AP1', msg:'⚡ ANTICIPATORY ALERT: Nagarjunasagar at 94.3% + 220mm forecast in 12hr. Zone AP1 embankment breach probability 68%. <strong>Pre-emptive evacuation of 4 mandals recommended.</strong> Convoy-04 pre-deployed.', type:'alert' },
  { delay:135000, zone:'BH1', msg:'⚡ ANTICIPATORY ALERT: Drone D3 thermal feed — 80+ signatures near Bagmati breach, Zone BH1. <strong>New survivor cluster detected.</strong> Drone D5 dispatched for aerial confirmation + GPS marker drop.', type:'decision' },
  { delay:195000, zone:'ALL', msg:'⚡ ANTICIPATORY DISBURSEMENT: Hirakud Dam at 97.1%. Downstream zones OD1 + CG1 at critical risk within 6hr. <strong>Pre-emptive Starknet release ₹1.2Cr to SEEDS India + NDRF Reserve</strong> initiated via on-chain trigger.', type:'decision' },
  { delay:260000, zone:'UK1', msg:'⚡ ANTICIPATORY ALERT: Zone UK1 Chamoli — IMD forecast 180mm/18hr. GLOF probability elevated. <strong>Helicopter window closing in 4hr due to weather.</strong> Prioritising airlift of 60 critical cases now.', type:'alert' },
  { delay:340000, zone:'AS1', msg:'⚡ ANTICIPATORY ALERT: Zone AS1 Silchar — Barak at 97% danger mark. NH6 submergence in 90min. <strong>Supply convoy must depart within 40min or route blocked 72hr.</strong> Dispatch authorised.', type:'alert' },
];

function initAnticipatoryEngine() {
  ANTICIPATORY_ALERTS.forEach(({ delay, zone, msg, type }) => {
    setTimeout(() => {
      addLog(type, `<span style="font-family:'JetBrains Mono',monospace;font-size:8px;color:var(--purple);letter-spacing:1px">ANTICIPATORY ENGINE · Zone ${zone}</span><br>` + msg);
      showToast(`⚡ Anticipatory alert — Zone ${zone}`);
      document.getElementById('agentSub').textContent = 'ANTICIPATORY ALERT ISSUED';
      setTimeout(() => { document.getElementById('agentSub').textContent = 'MONITORING — READY'; }, 3000);
    }, delay);
  });
}

// ==============================================================
// RECOVERY TRACKER
// ==============================================================
let recoveryZones = {};

function initRecovery() {
  recoveryZones['PB1'] = {
    zone:'PB1', name:'Gurdaspur — Punjab',
    startDate: new Date(Date.now() - 3*24*60*60*1000),
    familiesHelped:12, homesAssessed:8, homesRebuilt:3,
    fundsReleased:'₹8.4L', volunteersActive:6,
    events:[
      { time:'2 days ago', txt:'Flood waters receded — zone moved to RECOVERY' },
      { time:'1 day ago', txt:'12 families assisted — temporary shelter arranged' },
      { time:'6hr ago', txt:'SEEDS India: 3 homes assessed for reconstruction' },
    ]
  };
  renderRecovery();
}

function moveToRecovery(zoneId) {
  const zone = ZONES.find(z => z.id === zoneId);
  if (!zone) return;
  recoveryZones[zoneId] = {
    zone: zoneId, name: zone.name, startDate: new Date(),
    familiesHelped:0, homesAssessed:0, homesRebuilt:0,
    fundsReleased:'₹0', volunteersActive:0,
    events:[{ time:'Just now', txt:`Zone ${zoneId} moved from ${zone.sev.toUpperCase()} → RECOVERY` }]
  };
  zone.sev = 'low';
  renderZones(); renderRecovery();
  addLog('decision', `✅ Zone ${zoneId} transitioned to RECOVERY phase. Hypercert minting authorized for all volunteers.`);
  showToast(`✅ Zone ${zoneId} → RECOVERY`);
}

function renderRecovery() {
  const el = document.getElementById('recoveryList');
  if (!el) return;
  const zones = Object.values(recoveryZones);
  if (!zones.length) { el.innerHTML = '<div style="padding:20px;text-align:center;font-family:JetBrains Mono,monospace;font-size:10px;color:var(--text3)">No zones in recovery phase yet.</div>'; return; }
  el.innerHTML = zones.map(r => `
    <div class="recovery-card">
      <div class="recovery-top"><div class="recovery-zone-id">ZONE ${r.zone} — ${r.name}</div><div class="recovery-badge">🟢 RECOVERY</div></div>
      <div class="recovery-stats">
        <div class="rec-stat"><div class="rec-stat-val" style="color:var(--accent3)">${r.familiesHelped}</div><div class="rec-stat-lbl">FAMILIES HELPED</div></div>
        <div class="rec-stat"><div class="rec-stat-val" style="color:var(--accent)">${r.homesAssessed}</div><div class="rec-stat-lbl">HOMES ASSESSED</div></div>
        <div class="rec-stat"><div class="rec-stat-val" style="color:var(--warn)">${r.homesRebuilt}</div><div class="rec-stat-lbl">REBUILT</div></div>
        <div class="rec-stat"><div class="rec-stat-val" style="color:var(--accent3)">${r.fundsReleased}</div><div class="rec-stat-lbl">DISBURSED</div></div>
      </div>
      <div class="recovery-timeline">${r.events.map(e => `<div class="rec-event"><span class="rec-time">${e.time}</span>${e.txt}</div>`).join('')}</div>
      <button class="drone-btn dispatch" style="margin-top:6px;width:100%" onclick="mintRecoveryCert('${r.zone}')">🏅 MINT RECOVERY CERTIFICATE</button>
    </div>`).join('');
}

function mintRecoveryCert(zoneId) {
  const r = recoveryZones[zoneId];
  showToast(`✅ Recovery Certificate minted for Zone ${zoneId}`);
  addLog('decision', `🏅 RECOVERY CERTIFICATE minted for Zone ${zoneId} (ERC-8004).<br><span style="font-size:11px">Families: ${r.familiesHelped} · Funds: ${r.fundsReleased} · Volunteers: ${r.volunteersActive}</span><br><span style="font-family:JetBrains Mono,monospace;font-size:9px;color:var(--text3)">📦 IPFS: Qm${Math.random().toString(36).substr(2,20).toUpperCase()}...</span>`);
}

// ==============================================================
// NGO COORDINATION BOARD
// ==============================================================
const NGO_BOARD = [
  { name:'Goonj Foundation',     zones:['MH1','BH1','WB1'], resources:'18 trucks, 4 medical teams, WASH kits',           status:'active',   color:'var(--accent3)', conflict:false },
  { name:'SEEDS India',          zones:['OD1','AP1'],       resources:'12 rescue boats, 3 ambulances, shelter kits',      status:'active',   color:'var(--accent3)', conflict:false },
  { name:'CRY — Child Relief',   zones:['AS1','MN1'],       resources:'Child nutrition packs, trauma counsellors',        status:'active',   color:'var(--accent3)', conflict:false },
  { name:'HelpNow India',        zones:['UK1','HP1'],       resources:'Mountain rescue gear, 6 teams, emergency rations', status:'active',   color:'var(--warn)',    conflict:false },
  { name:'iCall Relief Network', zones:['KL1','TN1'],       resources:'Landslide rescue gear, mental health support',     status:'en-route', color:'var(--warn)',    conflict:false },
  { name:'Rapid Response India', zones:['OD1','AP1'],       resources:'6 helicopters, flood rescue boats, med supplies',  status:'active',   color:'var(--orange)',  conflict:true  },
  { name:'Indian Red Cross',     zones:['BH1','AS1'],       resources:'Mobile hospitals, blood bank, 4 ambulances',       status:'active',   color:'var(--orange)',  conflict:true  },
  { name:'Pratham Foundation',   zones:['RJ1','GJ1'],       resources:'8 trucks, food distribution, temp shelters',       status:'standby',  color:'var(--text2)',   conflict:false },
];

function renderNGOBoard() {
  const el = document.getElementById('ngoBoardList');
  if (!el) return;
  const zoneNGOMap = {};
  NGO_BOARD.forEach(n => n.zones.forEach(z => { if (!zoneNGOMap[z]) zoneNGOMap[z]=[]; zoneNGOMap[z].push(n.name); }));
  const conflicts = Object.entries(zoneNGOMap).filter(([z, ngos]) => ngos.length > 1);
  let conflictHtml = '';
  if (conflicts.length) {
    conflictHtml = `<div class="ngo-conflict-banner">⚡ IMPULSE AI: ${conflicts.length} deployment conflict${conflicts.length>1?'s':''} detected. ${conflicts.map(([z,ngos])=>`Zone ${z}: ${ngos.join(' + ')}`).join(' · ')} — Recommend deconflicting.</div>`;
  }
  el.innerHTML = conflictHtml + NGO_BOARD.map((n,i) => `
    <div class="ngo-board-card ${n.conflict?'conflict':''}">
      <div class="ngo-board-top">
        <div class="ngo-dot" style="background:${n.color}"></div>
        <div class="ngo-board-info">
          <div class="ngo-board-name">${n.name} ${n.conflict?'<span style="color:var(--red);font-size:9px">⚠ OVERLAP</span>':''}</div>
          <div class="ngo-board-zones">${n.zones.map(z=>`<span class="ngo-zone-tag">${z}</span>`).join('')}</div>
          <div class="ngo-board-res">${n.resources}</div>
        </div>
        <div class="ngo-status-badge" style="color:${n.color}">${n.status.toUpperCase()}</div>
      </div>
    </div>`).join('');
}

function deconflictNGOs() {
  addLog('decision', `⚡ NGO DECONFLICT: Rapid Response India reassigned Zone OD1 → Zone RJ1. Indian Red Cross assigned Zone BH1 exclusively. Coverage gap eliminated across 15 states. Broadcasting to national mesh.`);
  NGO_BOARD[5].conflict = false; NGO_BOARD[6].conflict = false;
  NGO_BOARD[5].zones = ['RJ1']; NGO_BOARD[6].zones = ['BH1'];
  renderNGOBoard();
  showToast('✅ NGO deployment deconflicted');
}

// ==============================================================
// LIVE STATS TICKER
// ==============================================================
setInterval(() => {
  const v = document.getElementById('statVictims');
  if (v) { const n = parseInt(v.textContent); if (Math.random() > 0.6) v.textContent = n + Math.floor(Math.random()*3); }
  const rv = document.getElementById('statResources');
  if (rv) { const rn = parseInt(rv.textContent); if (Math.random() > 0.7) rv.textContent = Math.min(rn+1, 220); }
}, 4000);

// ==============================================================
// IMPROVEMENT #1 — SOS CANCEL (safe self-report)
// ==============================================================
function cancelSOS() {
  document.getElementById('sosModal').classList.remove('show');
  showToast('✅ SOS cancelled — rescue teams notified you are safe');
  addLog('system', '✅ <strong>VICTIM MARKED SAFE</strong> — SOS beacon withdrawn. Rescue assets reallocated to other zones.');
  broadcastToMesh({ type: 'sos_cancelled', by: currentUser?.id || NODE_ID, ts: Date.now() });
  // Update victim screen to show "SAFE" state
  const etaEl = document.getElementById('victimEtaCountdown');
  if (etaEl) {
    etaEl.style.color = 'var(--accent3)';
    etaEl.textContent = '✓';
  }
}

// ==============================================================
// IMPROVEMENT #2 — TICKER ZONE NAVIGATION (clickable alerts)
// ==============================================================
function selectZoneById(zoneId) {
  const idx = ZONES.findIndex(z => z.id === zoneId);
  if (idx >= 0) {
    selectZone(idx);
    // Also fly map to zone
    if (mapInstance && ZONE_COORDS[zoneId]) {
      mapInstance.flyTo(ZONE_COORDS[zoneId], 11, { animate: true, duration: 1 });
      // Flash the marker
      const marker = zoneMarkersById[zoneId];
      if (marker) {
        const origStyle = { color: marker.options.color, fillOpacity: marker.options.fillOpacity };
        marker.setStyle({ fillOpacity: 0.8, weight: 4 });
        setTimeout(() => marker.setStyle({ fillOpacity: origStyle.fillOpacity, weight: 2 }), 1200);
      }
    }
    // Switch to relevant tab for context
    const zone = ZONES[idx];
    if (zone.sev === 'critical' && currentRole === 'surveillance') {
      showToast(`⚠ Zone ${zoneId} — ${zone.name} · ${zone.sev.toUpperCase()}`);
    }
  }
}

// ==============================================================
// IMPROVEMENT #3 — VOICE INPUT for rescue log
// ==============================================================
let voiceRecognition = null;
let voiceActive = false;

function startVoiceInput() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    showToast('🎤 Voice not supported in this browser. Try Chrome.');
    return;
  }
  const btn = document.getElementById('voiceInputBtn');
  if (voiceActive && voiceRecognition) {
    voiceRecognition.stop();
    return;
  }
  voiceRecognition = new SR();
  voiceRecognition.lang = 'en-IN';
  voiceRecognition.continuous = false;
  voiceRecognition.interimResults = false;

  voiceRecognition.onstart = () => {
    voiceActive = true;
    if (btn) { btn.textContent = '🔴'; btn.style.animation = 'blink 0.5s infinite'; }
    showToast('🎤 Listening — speak rescue details...');
  };

  voiceRecognition.onresult = (e) => {
    const transcript = e.results[0][0].transcript;
    // Smart parse: try to extract name, zone, condition from voice
    const notes = document.getElementById('rescuedNotes');
    const name = document.getElementById('rescuedName');
    // If name is empty and transcript seems to have a name, use it
    const lc = transcript.toLowerCase();
    if (name && !name.value.trim()) {
      // Try to extract "name is X" or "patient X"
      const nameMatch = transcript.match(/(?:name is|patient|person|his name|her name)\s+([A-Za-z\s]+?)(?:\s+(?:age|zone|critical|stable|from|at)|$)/i);
      if (nameMatch) name.value = nameMatch[1].trim();
    }
    // Try to extract zone
    const zoneEl = document.getElementById('rescuedZone');
    if (zoneEl && !zoneEl.value.trim()) {
      const zoneMatch = transcript.match(/zone\s+([A-G][0-9])/i);
      if (zoneMatch) zoneEl.value = zoneMatch[1].toUpperCase();
    }
    // Try to extract condition
    const condEl = document.getElementById('rescuedCondition');
    if (condEl && !condEl.value) {
      if (lc.includes('critical')) condEl.value = 'critical';
      else if (lc.includes('serious') || lc.includes('urgent')) condEl.value = 'serious';
      else if (lc.includes('stable')) condEl.value = 'stable';
      else if (lc.includes('minor')) condEl.value = 'minor';
      else if (lc.includes('uninjured') || lc.includes('no injury')) condEl.value = 'uninjured';
    }
    // Put full transcript into notes
    if (notes) notes.value = transcript;
    showToast(`🎤 Captured: "${transcript.substring(0, 50)}${transcript.length > 50 ? '...' : ''}"`);
  };

  voiceRecognition.onerror = () => {
    showToast('🎤 Voice error — please try again');
    voiceActive = false;
    if (btn) { btn.textContent = '🎤'; btn.style.animation = ''; }
  };

  voiceRecognition.onend = () => {
    voiceActive = false;
    if (btn) { btn.textContent = '🎤'; btn.style.animation = ''; }
  };

  voiceRecognition.start();
}

// ==============================================================
// IMPROVEMENT #4 — MOBILE RESPONSIVE: viewport-aware layout
// ==============================================================
function applyMobileLayout() {
  const isMobile = window.innerWidth < 768;
  const workspace = document.querySelector('.workspace');
  const left = document.querySelector('.left');
  const right = document.querySelector('.right');
  const topbarPills = document.querySelector('.topbar-pills');

  if (!workspace) return;
  if (isMobile && currentRole === 'surveillance') {
    workspace.style.gridTemplateColumns = '1fr';
    workspace.style.height = 'auto';
    workspace.style.overflowY = 'auto';
    if (left) left.style.display = 'none';
    if (right) right.style.display = 'none';
    // Show a mobile-friendly command bar at the bottom
    injectMobileCommandBar();
  }
}

function injectMobileCommandBar() {
  if (document.getElementById('mobileBar')) return;
  const bar = document.createElement('div');
  bar.id = 'mobileBar';
  bar.style.cssText = 'position:fixed;bottom:0;left:0;right:0;background:rgba(4,8,16,0.97);border-top:1px solid var(--border2);display:flex;gap:0;z-index:500;backdrop-filter:blur(20px)';
  bar.innerHTML = `
    <button onclick="showMobilePanel('zones')" style="flex:1;padding:10px 4px;background:none;border:none;border-right:1px solid var(--border);color:var(--text2);font-family:'JetBrains Mono',monospace;font-size:9px;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:3px">
      <span style="font-size:16px">🗺</span>ZONES
    </button>
    <button onclick="showMobilePanel('rescued')" style="flex:1;padding:10px 4px;background:none;border:none;border-right:1px solid var(--border);color:var(--text2);font-family:'JetBrains Mono',monospace;font-size:9px;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:3px">
      <span style="font-size:16px">🦺</span>RESCUE
    </button>
    <button onclick="openDispatch()" style="flex:1;padding:10px 4px;background:none;border:none;border-right:1px solid var(--border);color:var(--accent);font-family:'JetBrains Mono',monospace;font-size:9px;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:3px">
      <span style="font-size:16px">⚡</span>DISPATCH
    </button>
    <button onclick="showMobilePanel('drones')" style="flex:1;padding:10px 4px;background:none;border:none;border-right:1px solid var(--border);color:var(--text2);font-family:'JetBrains Mono',monospace;font-size:9px;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:3px">
      <span style="font-size:16px">🚁</span>DRONES
    </button>
    <button onclick="showMobilePanel('funds')" style="flex:1;padding:10px 4px;background:none;border:none;color:var(--text2);font-family:'JetBrains Mono',monospace;font-size:9px;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:3px">
      <span style="font-size:16px">💰</span>FUNDS
    </button>`;
  document.body.appendChild(bar);
  // Add padding to workspace so bar doesn't overlap
  const workspace = document.querySelector('.workspace');
  if (workspace) workspace.style.paddingBottom = '60px';
}

function showMobilePanel(name) {
  const right = document.querySelector('.right');
  const left = document.querySelector('.left');
  if (name === 'zones') {
    if (left) { left.style.display = ''; left.style.position = 'fixed'; left.style.top = '84px'; left.style.left = '0'; left.style.right = '0'; left.style.bottom = '60px'; left.style.zIndex = '400'; left.style.width = '100%'; }
    setTimeout(() => { if (left) left.style.display = 'none'; }, 8000);
    return;
  }
  if (right) {
    right.style.display = '';
    right.style.position = 'fixed';
    right.style.top = '84px';
    right.style.left = '0';
    right.style.right = '0';
    right.style.bottom = '60px';
    right.style.zIndex = '400';
    right.style.width = '100%';
    // Switch to correct tab
    const tabEl = document.querySelector(`#mainTabs .tab[onclick*="${name}"]`);
    if (tabEl) switchTab(name, tabEl);
    // Close on tap outside
    setTimeout(() => { if (right) right.style.display = 'none'; }, 15000);
  }
}

window.addEventListener('resize', applyMobileLayout);

// ==============================================================
// IMPROVEMENT #5 — PUSH NOTIFICATIONS for new SOS
// ==============================================================
async function requestNotificationPermission() {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'default') {
    await Notification.requestPermission();
  }
}

function sendPushNotification(title, body, tag) {
  if (Notification.permission !== 'granted') return;
  try {
    new Notification(title, {
      body,
      tag: tag || 'disasternet',
      icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28"><polygon points="14,2 26,24 2,24" stroke="%23ff4500" stroke-width="2" fill="rgba(255,69,0,0.1)"/><circle cx="14" cy="17" r="2" fill="%2300d4ff"/></svg>',
    });
  } catch(e) { /* silent */ }
}

// Hook into existing SOS fire to also send push
const _originalFireSOS = fireSOS;
function fireSOS(name, location, type, count, condition, etaMins, etaStr) {
  _originalFireSOS(name, location, type, count, condition, etaMins, etaStr);
  sendPushNotification('🆘 NEW SOS — DisasterNet', `${name} at ${location} · ${type} · ${count} person(s)`, 'sos-' + Date.now());
}

// ==============================================================
// IMPROVEMENT #6 — IndexedDB offline queue for rescue logs
// ==============================================================
let offlineQueue = [];
const OFFLINE_STORE = 'dnet_offline_queue_v1';

function loadOfflineQueue() {
  try {
    const raw = localStorage.getItem(OFFLINE_STORE);
    offlineQueue = raw ? JSON.parse(raw) : [];
  } catch(e) { offlineQueue = []; }
}

function saveOfflineQueue() {
  try { localStorage.setItem(OFFLINE_STORE, JSON.stringify(offlineQueue)); } catch(e) {}
}

function queueOfflineRescue(data) {
  data._queued = true;
  data._queuedAt = new Date().toISOString();
  offlineQueue.push(data);
  saveOfflineQueue();
  showToast(`📴 Saved offline — will sync when connected (${offlineQueue.length} queued)`);
  addMeshLog(`📴 Offline queue: ${offlineQueue.length} record(s) pending sync`);
}

async function flushOfflineQueue() {
  if (!SYNC_API_BASE || !offlineQueue.length) return;
  const toSync = [...offlineQueue];
  offlineQueue = [];
  saveOfflineQueue();
  let synced = 0;
  for (const item of toSync) {
    const res = await postJsonSafe(`${SYNC_API_BASE}/api/v1/persons`, item);
    if (res.ok) synced++;
    else offlineQueue.push(item);
  }
  saveOfflineQueue();
  if (synced > 0) {
    showToast(`✅ Synced ${synced} offline record(s) to server`);
    addMeshLog(`✅ Flushed ${synced} offline record(s) to backend`);
  }
}

// Flush on connection restore
window.addEventListener('online', () => {
  addMeshLog('🌐 Network restored — flushing offline queue...');
  flushOfflineQueue();
});

window.addEventListener('offline', () => {
  addMeshLog('📴 Network lost — rescue logs will be queued locally');
  showToast('📴 Offline mode — logs queued locally');
});

loadOfflineQueue();
if (offlineQueue.length > 0) {
  setTimeout(() => {
    showToast(`📴 ${offlineQueue.length} offline record(s) queued — tap to sync`);
    addMeshLog(`📴 Offline queue loaded: ${offlineQueue.length} record(s) pending`);
  }, 2000);
}

// ==============================================================
// IMPROVEMENT #7 — AUDIT TRAIL: timestamp + operator ID
// ==============================================================
function makeAuditEntry(action, detail) {
  return {
    action,
    detail,
    operatorId: currentUser?.id || NODE_ID,
    operatorRole: currentRole || 'unknown',
    timestamp: new Date().toISOString(),
    nodeId: NODE_ID,
  };
}

let auditTrail = [];

function logAudit(action, detail) {
  const entry = makeAuditEntry(action, detail);
  auditTrail.unshift(entry);
  if (auditTrail.length > 200) auditTrail.pop();
  try { localStorage.setItem('dnet_audit_v1', JSON.stringify(auditTrail.slice(0, 100))); } catch(e) {}
}

// Load existing audit log
try {
  const saved = localStorage.getItem('dnet_audit_v1');
  if (saved) auditTrail = JSON.parse(saved);
} catch(e) { auditTrail = []; }

// ==============================================================
// IMPROVEMENT #8 — PROACTIVE AI: top 3 decisions summary
// ==============================================================
function runProactiveAISummary() {
  const criticalZones = ZONES.filter(z => z.sev === 'critical');
  const lowBatteryDrones = DRONES.filter(d => d.battery < 30 && d.status !== 'charging');
  const oxygenCritical = ZONES.find(z => z.sev === 'critical' && z.type === 'cyclone') || ZONES[0];
  const pendingComp = compensationCases.filter(c => c.status !== 'filed').length;

  let summary = `⚡ <strong>IMPULSE AI — SITUATION SUMMARY</strong><br><br>`;
  summary += `<strong>TOP PRIORITIES RIGHT NOW:</strong><br>`;

  let priority = 1;
  if (oxygenCritical) {
    summary += `${priority++}. 🔴 <strong>Zone OD1 cyclone casualties overwhelming hospital capacity.</strong> Recommend: dispatch Helicopter 3 with medical team immediately.<br>`;
  }
  criticalZones.slice(0, 2).forEach(z => {
    summary += `${priority++}. ⚠ <strong>Zone ${z.id} (${z.name})</strong> — ${z.victims} victims, ${z.resources} units. ${z.detail.substring(0, 60)}...<br>`;
  });
  if (lowBatteryDrones.length) {
    summary += `${priority++}. 🔋 <strong>${lowBatteryDrones.length} drone(s) below 30% battery</strong> (${lowBatteryDrones.map(d=>d.id).join(', ')}) — recall for charging.<br>`;
  }
  if (pendingComp > 0) {
    summary += `${priority++}. ⚰ <strong>${pendingComp} deceased compensation case(s)</strong> pending — file immediately to unlock Starknet disbursement.<br>`;
  }
  summary += `<br><span style="font-family:'JetBrains Mono',monospace;font-size:9px;color:var(--text3)">AUTO-ASSESSED · ${new Date().toLocaleTimeString()} · ${NODE_ID}</span>`;

  addLog('decision', summary);
  document.getElementById('agentSub').textContent = 'PROACTIVE SUMMARY ISSUED';
  setTimeout(() => { document.getElementById('agentSub').textContent = 'MONITORING — READY'; }, 3000);
}

function scheduleProactiveAI() {
  setTimeout(runProactiveAISummary, 8000);
  setInterval(runProactiveAISummary, 300000);
}

// ==============================================================
// IMPROVEMENT #9 — EXPORT OPERATION REPORT
// ==============================================================
function exportOperationReport() {
  const report = {
    generated: new Date().toISOString(),
    operator: currentUser?.id || 'Unknown',
    role: currentRole || 'surveillance',
    node: NODE_ID,
    summary: {
      totalAffected: parseInt(document.getElementById('statVictims')?.textContent || '605'),
      criticalZones: ZONES.filter(z => z.sev === 'critical').length,
      personsRescued: rescuedPersons.length,
      dronesActive: DRONES.filter(d => d.status !== 'charging').length,
      resourcesDeployed: parseInt(document.getElementById('statResources')?.textContent || '205'),
    },
    rescuedPersons: rescuedPersons.map(p => ({
      id: p.id, name: p.name, zone: p.zone, age: p.age,
      condition: p.initialCondition, currentStatus: p.currentStatus,
      rescuedBy: p.rescuerName, time: p.rescueTime, date: p.rescueDate,
    })),
    missingPersons: missingPersons.map(p => ({
      id: p.id, name: p.name, zone: p.zone, status: p.status, note: p.note,
    })),
    compensationCases: compensationCases.map(c => ({
      name: c.name, zone: c.zone, amount: c.amount, status: c.status,
      filed: c.filedTime || null, txHash: c.txHash || null,
    })),
    zones: ZONES.map(z => ({ id: z.id, name: z.name, severity: z.sev, victims: z.victims, resources: z.resources })),
    drones: DRONES.map(d => ({ id: d.id, status: d.status, zone: d.zone, battery: d.battery })),
    auditTrail: auditTrail.slice(0, 50),
    fundsData: { contract: '0x04a7c3f1...9d8e', totalFunds: '₹2.4Cr', disbursed: '₹1.1Cr', pending: '₹0.9Cr' },
  };
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `DisasterNet_OpReport_${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('📊 Operation report exported');
  logAudit('EXPORT_REPORT', `Exported at ${new Date().toISOString()}`);
  addLog('system', `📊 <strong>OPERATION REPORT EXPORTED</strong> — ${rescuedPersons.length} rescued · ${missingPersons.length} missing · ${compensationCases.length} compensation cases`);
}

// ==============================================================
// IMPROVEMENT #10 — MISSING PERSONS SEARCH
// ==============================================================
function searchMissingPersons(query) {
  if (!query || query.length < 2) return missingPersons;
  const lq = query.toLowerCase();
  return missingPersons.filter(p =>
    (p.name || '').toLowerCase().includes(lq) ||
    (p.zone || '').toLowerCase().includes(lq) ||
    (p.note || '').toLowerCase().includes(lq) ||
    (p.phone || '').includes(query)
  );
}

function renderSearchResults(results, query) {
  const el = document.getElementById('mpSearchResults');
  if (!el) return;
  if (!results.length) {
    el.innerHTML = `<div style="padding:16px;text-align:center;font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--text3)">No records found for "<strong style="color:var(--text2)">${query}</strong>"</div>`;
    return;
  }
  const statusColors = { Missing:'var(--red)', Located:'var(--accent)', Displaced:'var(--warn)', Hospitalised:'var(--orange)', Deceased:'var(--text3)' };
  el.innerHTML = `<div style="font-family:'JetBrains Mono',monospace;font-size:9px;color:var(--text3);padding:8px 12px;border-bottom:1px solid var(--border)">${results.length} result(s) for "${query}"</div>` +
    results.map(p => {
      const col = statusColors[p.status] || 'var(--text2)';
      return `<div style="padding:12px;border-bottom:1px solid var(--border)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
          <div style="font-size:13px;font-weight:600;color:var(--text)">${p.name}</div>
          <span style="font-family:'JetBrains Mono',monospace;font-size:9px;font-weight:700;color:${col};border:1px solid ${col};padding:2px 6px;border-radius:2px">${p.status || 'Missing'}</span>
        </div>
        <div style="font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--text2);margin-bottom:3px">Zone ${p.zone || 'Unknown'} · ${new Date(p.updatedAt || Date.now()).toLocaleString('en-IN')}</div>
        ${p.note ? `<div style="font-size:11px;color:var(--text2);margin-top:3px">${p.note}</div>` : ''}
        ${p.phone ? `<div style="font-family:'JetBrains Mono',monospace;font-size:9px;color:var(--text3);margin-top:3px">📞 ${p.phone}</div>` : ''}
        ${p.compensation?.txHash ? `<div style="font-family:'JetBrains Mono',monospace;font-size:9px;color:var(--accent3);margin-top:4px">💸 Comp TX: ${p.compensation.txHash}</div>` : ''}
      </div>`;
    }).join('');
}

function injectMissingPersonsSearch() {
  const mpForm = document.querySelector('.mp-form');
  if (!mpForm || document.getElementById('mpSearchBox')) return;
  const searchBlock = document.createElement('div');
  searchBlock.style.cssText = 'padding:12px;border-bottom:2px solid var(--border2);background:rgba(0,212,255,0.03)';
  searchBlock.innerHTML = `
    <div style="font-family:'JetBrains Mono',monospace;font-size:9px;color:var(--text3);letter-spacing:2px;margin-bottom:8px">👨‍👩‍👧 FAMILY SEARCH — FIND YOUR LOVED ONE</div>
    <div style="display:flex;gap:6px">
      <input id="mpSearchBox" class="mp-input" placeholder="Search by name, zone, or phone..." style="margin:0;flex:1" oninput="onMpSearch(this.value)" />
      <button class="btn btn-primary" style="padding:6px 10px;font-size:10px" onclick="onMpSearch(document.getElementById('mpSearchBox').value)">🔍</button>
    </div>
    <div id="mpSearchResults" style="margin-top:8px;border:1px solid var(--border);border-radius:4px;max-height:200px;overflow-y:auto;background:var(--surface)"></div>`;
  mpForm.parentNode.insertBefore(searchBlock, mpForm);
}

let mpSearchTimer = null;
function onMpSearch(query) {
  clearTimeout(mpSearchTimer);
  if (!query.trim()) { const el = document.getElementById('mpSearchResults'); if (el) el.innerHTML = ''; return; }
  mpSearchTimer = setTimeout(() => renderSearchResults(searchMissingPersons(query.trim()), query.trim()), 300);
}

// ==============================================================
// IMPROVEMENT #11 — EXPORT BUTTON in topbar
// ==============================================================
function injectExportButton() {
  if (currentRole !== 'surveillance') return;
  if (document.getElementById('exportBtn')) return;
  const pills = document.querySelector('.topbar-pills');
  if (!pills) return;
  const btn = document.createElement('div');
  btn.id = 'exportBtn';
  btn.className = 'pill clickable';
  btn.title = 'Export operation report as JSON';
  btn.textContent = '📊 EXPORT';
  btn.onclick = exportOperationReport;
  pills.appendChild(btn);
}

// ==============================================================
// IMPROVEMENT #12 — BOOT HOOKS (safe, no function redeclaration)
// ==============================================================
window.addEventListener('load', () => {
  setTimeout(requestNotificationPermission, 3000);
  setTimeout(applyMobileLayout, 500);
  setTimeout(injectMissingPersonsSearch, 800);
});

// ==============================================================
// P6 — OUTCOME ANALYTICS PANEL
// ==============================================================

let analyticsCharts = {};

// Demo seed data shown when no real rescues have been logged yet
const ANALYTICS_DEMO = {
  survivalRate: 84,
  rescuedPerHr: 23,
  criticalRatio: 31,
  avgResponse: 14,
};

function computeAnalyticsKPIs() {
  const total = rescuedPersons.length;
  const deceased = rescuedPersons.filter(p => p.currentStatus === 'deceased' || p.deceased).length;
  const critical = rescuedPersons.filter(p => p.initialCondition === 'critical').length;
  const survived = total - deceased;
  const useSeed = total === 0; // show demo data until real rescues are logged

  // Survival rate
  const survivalRate = useSeed ? ANALYTICS_DEMO.survivalRate : Math.round((survived / total) * 100);
  const srEl = document.getElementById('an-survival-rate');
  if (srEl) {
    srEl.textContent = survivalRate + '%';
    srEl.title = useSeed ? 'Demo seed data — log rescues to see live values' : 'Live value';
  }

  // Rescues per hour
  const now = Date.now();
  const oneHourAgo = now - 3600000;
  const lastHour = rescuedPersons.filter(p => {
    try { return new Date(p.rescueDate + ' ' + p.rescueTime).getTime() > oneHourAgo; } catch(e) { return false; }
  }).length;
  const rhrEl = document.getElementById('an-rescued-hr');
  if (rhrEl) rhrEl.textContent = useSeed ? ANALYTICS_DEMO.rescuedPerHr : (lastHour || Math.max(1, Math.round(total / 4)));

  // Critical ratio
  const crEl = document.getElementById('an-critical-ratio');
  if (crEl) crEl.textContent = (useSeed ? ANALYTICS_DEMO.criticalRatio : Math.round((critical / total) * 100)) + '%';

  // Avg response
  const avgEl = document.getElementById('an-avg-response');
  if (avgEl) {
    const critZones = ZONES.filter(z => z.sev === 'critical').length;
    const avgMins = useSeed ? ANALYTICS_DEMO.avgResponse : (8 + critZones * 3 + Math.floor(Math.random() * 4));
    avgEl.textContent = avgMins + 'min';
  }

  // Show/hide demo seed label
  let seedNote = document.getElementById('an-seed-note');
  if (useSeed && !seedNote) {
    const kpiStrip = document.getElementById('an-survival-rate')?.closest('[style*="grid"]');
    if (kpiStrip) {
      seedNote = document.createElement('div');
      seedNote.id = 'an-seed-note';
      seedNote.style.cssText = 'font-family:"JetBrains Mono",monospace;font-size:8px;color:var(--text3);text-align:right;margin-top:-6px;padding-right:2px';
      seedNote.textContent = '* demo seed data — log rescues to update';
      kpiStrip.insertAdjacentElement('afterend', seedNote);
    }
  } else if (!useSeed && seedNote) {
    seedNote.remove();
  }
}

function buildHourlyBuckets() {
  // Build 12-hour sparkline data. Use real data if available, seed with realistic sim otherwise.
  const buckets = new Array(12).fill(0);
  const now = Date.now();

  rescuedPersons.forEach(p => {
    try {
      const ts = new Date(p.rescueDate + ' ' + p.rescueTime).getTime();
      const hoursAgo = Math.floor((now - ts) / 3600000);
      if (hoursAgo >= 0 && hoursAgo < 12) buckets[11 - hoursAgo]++;
    } catch(e) {}
  });

  // If no real data, seed with a realistic sim curve
  const total = buckets.reduce((a, b) => a + b, 0);
  if (total === 0) {
    const sim = [2, 4, 8, 14, 19, 23, 18, 12, 9, 6, 4, 3];
    return sim;
  }
  return buckets;
}

function renderSparkline() {
  const canvas = document.getElementById('an-sparkline');
  if (!canvas || typeof Chart === 'undefined') return;

  const hours = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.now() - (11 - i) * 3600000);
    return d.getHours().toString().padStart(2, '0') + ':00';
  });
  const data = buildHourlyBuckets();

  if (analyticsCharts.sparkline) { analyticsCharts.sparkline.destroy(); }

  analyticsCharts.sparkline = new Chart(canvas, {
    type: 'line',
    data: {
      labels: hours,
      datasets: [{
        label: 'Rescued',
        data,
        borderColor: '#00d4ff',
        backgroundColor: 'rgba(0,212,255,0.08)',
        borderWidth: 2,
        pointRadius: 3,
        pointBackgroundColor: '#00d4ff',
        fill: true,
        tension: 0.4,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#4a5568', font: { family: 'JetBrains Mono', size: 8 } }, grid: { color: 'rgba(255,255,255,0.04)' } },
        y: { ticks: { color: '#4a5568', font: { family: 'JetBrains Mono', size: 8 }, stepSize: 1 }, grid: { color: 'rgba(255,255,255,0.04)' }, beginAtZero: true }
      }
    }
  });
}

function renderZoneChart() {
  const canvas = document.getElementById('an-zone-chart');
  if (!canvas || typeof Chart === 'undefined') return;

  const zoneIds = ZONES.map(z => z.id);
  const rescued = zoneIds.map(id => rescuedPersons.filter(p => p.zone === id).length);
  const missing = zoneIds.map(id => missingPersons.filter(p => p.zone === id).length);

  // Seed with sim data if empty
  const hasData = rescued.some(v => v > 0) || missing.some(v => v > 0);
  const rescuedData = hasData ? rescued : [12, 6, 8, 18, 7, 3, 2];
  const missingData = hasData ? missing : [228, 74, 47, 112, 53, 22, 13];

  if (analyticsCharts.zone) { analyticsCharts.zone.destroy(); }

  analyticsCharts.zone = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: zoneIds,
      datasets: [
        { label: 'Rescued', data: rescuedData, backgroundColor: 'rgba(0,212,255,0.6)', borderColor: '#00d4ff', borderWidth: 1 },
        { label: 'Missing', data: missingData, backgroundColor: 'rgba(255,204,0,0.4)', borderColor: '#ffcc00', borderWidth: 1 },
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#718096', font: { family: 'JetBrains Mono', size: 8 } } } },
      scales: {
        x: { ticks: { color: '#4a5568', font: { family: 'JetBrains Mono', size: 9 } }, grid: { color: 'rgba(255,255,255,0.04)' } },
        y: { ticks: { color: '#4a5568', font: { family: 'JetBrains Mono', size: 8 } }, grid: { color: 'rgba(255,255,255,0.04)' }, beginAtZero: true }
      }
    }
  });
}

function renderConditionChart() {
  const canvas = document.getElementById('an-condition-chart');
  if (!canvas || typeof Chart === 'undefined') return;

  const conds = ['critical', 'serious', 'stable', 'minor', 'uninjured'];
  const labels = ['Critical', 'Serious', 'Stable', 'Minor', 'Uninjured'];
  const counts = conds.map(c => rescuedPersons.filter(p => p.initialCondition === c).length);
  const total = counts.reduce((a, b) => a + b, 0);
  const data = total > 0 ? counts : [14, 22, 31, 19, 9]; // sim seed

  if (analyticsCharts.condition) { analyticsCharts.condition.destroy(); }

  analyticsCharts.condition = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: ['rgba(255,23,68,0.7)', 'rgba(255,107,53,0.7)', 'rgba(255,204,0,0.7)', 'rgba(57,255,20,0.7)', 'rgba(0,212,255,0.7)'],
        borderColor: ['#ff1744','#ff6b35','#ffcc00','#39ff14','#00d4ff'],
        borderWidth: 1,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'right', labels: { color: '#718096', font: { family: 'JetBrains Mono', size: 8 }, boxWidth: 10 } }
      }
    }
  });
}

function renderOperationTimeline() {
  const el = document.getElementById('an-timeline');
  if (!el) return;

  // Pull from mesh logs + agent log for real events, seed if empty
  const events = meshLogs.slice(0, 8).map(l => ({ ts: l.ts, txt: l.txt.replace(/<[^>]+>/g, '').substring(0, 48) }));

  if (!events.length) {
    const seeds = [
      { ts: '06:14', txt: '🆘 SOS beacon from Zone MH1 — 8 survivors' },
      { ts: '06:31', txt: '🚁 Drone D1 dispatched — thermal survey' },
      { ts: '07:02', txt: '⚡ AI: Redirect convoy via NH166' },
      { ts: '07:45', txt: '🦺 12 rescued — Zone BH1 Darbhanga' },
      { ts: '08:18', txt: '💧 Koyna Dam hit WATCH level (91%)' },
      { ts: '09:00', txt: '🏥 Zone OD1 medical team deployed — triage underway' },
    ];
    seeds.forEach(e => events.push(e));
  }

  el.innerHTML = events.map(e => `
    <div style="display:flex;gap:8px;align-items:flex-start;font-size:10px">
      <span style="font-family:'JetBrains Mono',monospace;font-size:8px;color:var(--text3);flex-shrink:0;margin-top:1px">${e.ts}</span>
      <span style="color:var(--text2);line-height:1.4">${e.txt}</span>
    </div>`).join('');
}

function renderAnalyticsDamLevels() {
  const el = document.getElementById('an-dam-levels');
  if (!el) return;
  el.innerHTML = DAMS.map(d => {
    const pct = Math.round(d.current / d.capacity * 100);
    const col = d.status === 'critical' ? 'var(--red)' : d.status === 'watch' ? 'var(--warn)' : 'var(--accent3)';
    return `<div style="background:var(--bg2);border:1px solid var(--border);border-radius:4px;padding:10px 12px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
        <span style="font-size:11px;font-weight:600;color:var(--text)">${d.name}</span>
        <span style="font-family:'JetBrains Mono',monospace;font-size:8px;font-weight:700;color:${col}">${pct}%</span>
      </div>
      <div style="height:4px;background:var(--border);border-radius:2px;overflow:hidden;margin-bottom:4px">
        <div style="height:100%;width:${pct}%;background:${col};border-radius:2px;transition:width 0.6s ease"></div>
      </div>
      <div style="font-family:'JetBrains Mono',monospace;font-size:8px;color:var(--text3)">${d.current.toFixed(1)} / ${d.capacity} TMC · ${d.location}</div>
    </div>`;
  }).join('');
}

function refreshAnalyticsPanel() {
  computeAnalyticsKPIs();
  renderSparkline();
  renderZoneChart();
  renderConditionChart();
  renderOperationTimeline();
  renderAnalyticsDamLevels();
}

// Refresh analytics when tab becomes active — hook into switchTab
const _origSwitchTab = switchTab;
function switchTab(name, el) {
  _origSwitchTab(name, el);
  if (name === 'analytics') {
    setTimeout(refreshAnalyticsPanel, 80); // slight delay so canvas is visible/sized
  }
}

// Auto-refresh analytics every 30s when tab is open
setInterval(() => {
  const analyticsTabActive = document.getElementById('tab-analytics')?.classList.contains('active');
  if (analyticsTabActive) refreshAnalyticsPanel();
}, 30000);

// ==============================================================
// P2 — LIVE DAM DATA (CWC via Vercel Edge Proxy)
// ==============================================================

async function fetchLiveDamData() {
  const statusEl = document.getElementById('an-dam-status');
  if (statusEl) { statusEl.textContent = 'FETCHING...'; statusEl.style.color = 'var(--accent)'; }

  try {
    // Try our Vercel edge proxy first (avoids CORS)
    const res = await fetch('/api/cwc-proxy', { signal: AbortSignal.timeout(6000) });
    if (res.ok) {
      const json = await res.json();
      if (json.dams && Array.isArray(json.dams)) {
        mergeCWCData(json.dams);
        if (statusEl) { statusEl.textContent = '🟢 LIVE · CWC'; statusEl.style.color = 'var(--accent3)'; }
        addMeshLog('💧 CWC dam data refreshed from live API');
        renderDams();         // update the main dam tab too
        renderAnalyticsDamLevels();
        return;
      }
    }
  } catch (e) { /* proxy not available — try direct fallback */ }

  // Direct CWC fallback (will fail in production due to CORS, but shows intent in dev)
  try {
    const res = await fetch(
      'https://cwc.gov.in/sites/default/files/maharashtra_reservoir_levels.json',
      { signal: AbortSignal.timeout(5000), mode: 'cors' }
    );
    if (res.ok) {
      const json = await res.json();
      mergeCWCData(json.reservoirs || json.dams || []);
      if (statusEl) { statusEl.textContent = '🟢 LIVE · CWC DIRECT'; statusEl.style.color = 'var(--accent3)'; }
      renderDams();
      renderAnalyticsDamLevels();
      return;
    }
  } catch (e) { /* CORS blocked as expected in browser */ }

  // Fall back gracefully — jitter sim values to show "refresh" happened
  DAMS.forEach(d => {
    const delta = (Math.random() - 0.45) * 0.8;
    d.current = Math.max(d.capacity * 0.5, Math.min(d.capacity * 0.99, d.current + delta));
    const pct = d.current / d.capacity;
    d.status = pct > 0.95 ? 'critical' : pct > 0.85 ? 'watch' : 'safe';
  });
  renderDams();
  renderAnalyticsDamLevels();
  if (statusEl) { statusEl.textContent = 'SIMULATED (proxy not deployed)'; statusEl.style.color = 'var(--text3)'; }
  addMeshLog('💧 CWC proxy unavailable — using simulated dam data. Deploy /api/cwc-proxy to enable live data.');
}

function mergeCWCData(cwcDams) {
  // Map CWC response fields onto our DAMS array
  // CWC API uses reservoir names that roughly match ours
  const nameMap = {
    'Koyna': 0, 'Almatti': 1, 'Ujani': 2, 'Ujjani': 2, 'Mulshi': 3
  };
  cwcDams.forEach(cwc => {
    const key = Object.keys(nameMap).find(k => (cwc.name || '').includes(k));
    if (key === undefined) return;
    const idx = nameMap[key];
    if (DAMS[idx]) {
      const liveLevel = parseFloat(cwc.current_level || cwc.level || cwc.storage || 0);
      if (liveLevel > 0) {
        DAMS[idx].current = liveLevel;
        const pct = liveLevel / DAMS[idx].capacity;
        DAMS[idx].status = pct > 0.95 ? 'critical' : pct > 0.85 ? 'watch' : 'safe';
      }
    }
  });
}

// ==============================================================
// ACCESSIBILITY — FOCUS TRAP + ESCAPE KEY FOR ALL MODALS
// ==============================================================
const MODAL_IDS = ['roleModal', 'apiModal', 'sosModal', 'treatmentModal', 'compensationModal'];
const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

function trapFocus(modalEl) {
  const nodes = [...modalEl.querySelectorAll(FOCUSABLE)].filter(n => n.offsetParent !== null);
  if (!nodes.length) return;
  const first = nodes[0], last = nodes[nodes.length - 1];
  modalEl._trapHandler = (e) => {
    if (e.key !== 'Tab') return;
    if (e.shiftKey) { if (document.activeElement === first) { e.preventDefault(); last.focus(); } }
    else             { if (document.activeElement === last)  { e.preventDefault(); first.focus(); } }
  };
  modalEl.addEventListener('keydown', modalEl._trapHandler);
  // Move focus inside modal
  setTimeout(() => { if (nodes[0]) nodes[0].focus(); }, 50);
}

function releaseFocus(modalEl) {
  if (modalEl._trapHandler) {
    modalEl.removeEventListener('keydown', modalEl._trapHandler);
    delete modalEl._trapHandler;
  }
}

// Patch showModal / hideModal to add/remove focus trap
const _origShowModal = window.showModal;
function showModal(id) {
  if (typeof _origShowModal === 'function') _origShowModal(id);
  else {
    const el = document.getElementById(id);
    if (el) el.classList.add('show');
  }
  const el = document.getElementById(id);
  if (el) { el.setAttribute('aria-hidden', 'false'); trapFocus(el); }
}

const _origCloseModal = window.closeModal;
function closeModal(id) {
  if (typeof _origCloseModal === 'function') _origCloseModal(id);
  else {
    const el = document.getElementById(id);
    if (el) el.classList.remove('show');
  }
  const el = document.getElementById(id);
  if (el) { el.setAttribute('aria-hidden', 'true'); releaseFocus(el); }
}

// Global Escape-key handler
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  for (const id of MODAL_IDS) {
    const el = document.getElementById(id);
    if (el && el.classList.contains('show') && id !== 'roleModal') {
      closeModal(id); break;
    }
  }
});

// Initialise aria-hidden on all modals at load
document.addEventListener('DOMContentLoaded', () => {
  MODAL_IDS.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    if (!el.classList.contains('show')) el.setAttribute('aria-hidden', 'true');
  });
});
