import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import colyseusPkg from "colyseus";
import * as schemaPkg from "@colyseus/schema";

const { Room, Server } = colyseusPkg;
const { ArraySchema, MapSchema, Schema, defineTypes } = schemaPkg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_DIR = path.resolve(__dirname, "../dist");
const ENV_FILE_PATH = path.resolve(__dirname, "../.env");
const DEFAULT_STARTUP_CACHE_PATH = path.resolve(__dirname, "./startup-cache.json");

const loadEnvFile = (filePath) => {
  if (!existsSync(filePath)) {
    return;
  }

  const content = readFileSync(filePath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    if (!key || process.env[key] !== undefined) {
      continue;
    }

    let value = trimmed.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
};

loadEnvFile(ENV_FILE_PATH);

const PORT = Number(process.env.PORT ?? 2567);
const WORLD_NAME = "world";
const MAX_CLIENTS = 32;
const SERVER_TICK_MS = 50;
const THERMAL_COUNT = 10;
const THERMAL_RESEED_SECONDS = 18;
const THERMAL_SMALL_RATIO = 0.7;
const THERMAL_SMALL_RADIUS_MIN = 5;
const THERMAL_SMALL_RADIUS_MAX = 8;
const THERMAL_LARGE_RADIUS_MIN = 12;
const THERMAL_LARGE_RADIUS_MAX = 20;
const THERMAL_BASE_HEIGHT_MIN = 32;
const THERMAL_BASE_HEIGHT_MAX = 54;
const THERMAL_HEIGHT_AMPLITUDE_MIN = 8;
const THERMAL_HEIGHT_AMPLITUDE_MAX = 16;
const THERMAL_SMALL_STRENGTH_MIN = 3.8;
const THERMAL_SMALL_STRENGTH_MAX = 5.2;
const THERMAL_LARGE_STRENGTH_MIN = 2.5;
const THERMAL_LARGE_STRENGTH_MAX = 3.8;
const THERMAL_MIN_GAP = 14;
const THERMAL_EDGE_MARGIN = 0;
const THERMAL_MAX_CENTER_RADIUS = 92;
const THERMAL_CANDIDATES_PER_SLOT = 64;
const THERMAL_FALLBACK_ATTEMPTS_PER_SLOT = 120;
const THERMAL_ACTIVATION_DELAY_MIN_SECONDS = 0;
const THERMAL_ACTIVATION_DELAY_MAX_SECONDS = 6;
const SPAWN_RING_RADIUS = 86;
const SPAWN_Y = 18;
const ORB_PICKUP_HORIZONTAL_RADIUS = 2.8;
const ORB_PICKUP_VERTICAL_TOLERANCE = 4.5;
const ORB_STEAL_HORIZONTAL_RADIUS = 2.4;
const ORB_STEAL_VERTICAL_TOLERANCE = 3.5;
const ORB_STEAL_COOLDOWN_MS = 1000;
const ORB_SCORE_INTERVAL_MS = 1000;
const ORB_SPAWN_ALTITUDE_MIN = 24;
const ORB_SPAWN_ALTITUDE_MAX = 34;
const ORB_SPAWN_RADIUS = 72;
const ORB_MIN_PLAYERS = 2;
const ORB_START_COUNTDOWN_MS = 10000;
const COIN_PICKUP_HORIZONTAL_RADIUS = 3.1;
const COIN_PICKUP_VERTICAL_TOLERANCE = 5.2;
const COIN_SPAWN_INTERVAL_MS = 5000;
const COIN_MAX_ACTIVE = 5;
const COIN_EXPIRE_AFTER_MS = 25000;
const COIN_EFFECT_DURATION_MS = 3000;
const COIN_SPAWN_MAX_CENTER_RADIUS = 82;
const COIN_SPAWN_GROUND_OFFSET = 12;
const COIN_SPAWN_ALTITUDE_MIN = 18;
const COIN_SPAWN_ALTITUDE_MAX = 38;
const COIN_MIN_GAP = 9;
const COIN_SPAWN_ATTEMPTS = 72;
const STARTUP_REFRESH_INTERVAL_MS = Number(
  process.env.TRUSTMRR_REFRESH_INTERVAL_MS ?? 24 * 60 * 60 * 1000,
);
const SAFE_STARTUP_REFRESH_INTERVAL_MS = Number.isFinite(STARTUP_REFRESH_INTERVAL_MS)
  ? Math.max(STARTUP_REFRESH_INTERVAL_MS, 60 * 60 * 1000)
  : 24 * 60 * 60 * 1000;
const STARTUP_SYNC_MAX_REQUESTS = Math.max(
  1,
  Math.floor(Number(process.env.TRUSTMRR_SYNC_MAX_REQUESTS ?? 6)),
);
const STARTUP_TARGET_POOL_SIZE = Math.max(
  12,
  Math.floor(Number(process.env.TRUSTMRR_TARGET_POOL_SIZE ?? 180)),
);
const TRUSTMRR_API_BASE_URL =
  process.env.TRUSTMRR_API_BASE_URL?.trim() || "https://trustmrr.com/api/v1";
const TRUSTMRR_STARTUPS_ENDPOINT = `${TRUSTMRR_API_BASE_URL.replace(/\/+$/, "")}/startups`;
const TRUSTMRR_PAGE_LIMIT = 50;
const STARTUP_CACHE_FILE_PATH =
  process.env.TRUSTMRR_CACHE_FILE_PATH?.trim() || DEFAULT_STARTUP_CACHE_PATH;
const STARTUP_RECENT_HISTORY_SIZE = 18;
const STARTUP_MIN_GAMEPLAY_GROWTH_PCT = 3;

const TERRAIN_SEED = 1337;
const TERRAIN_ISLAND_RADIUS = 95;
const TERRAIN_HEIGHT_BASE = -5;
const TERRAIN_MAX_HEIGHT = 34;
const TERRAIN_NOISE_SCALE = 0.028;
const TERRAIN_WATER_LEVEL = TERRAIN_HEIGHT_BASE - 1.8;
const TERRAIN_INLAND_LAKE_RADIUS_MIN = 8;
const TERRAIN_INLAND_LAKE_RADIUS_MAX = 13;
const TERRAIN_INLAND_LAKE_MAX_CENTER_RADIUS_RATIO = 0.58;
const TERRAIN_INLAND_LAKE_MIN_DIST_FROM_SPAWN = 34;
const TERRAIN_INLAND_LAKE_RIM_WIDTH = 2.6;
const TERRAIN_INLAND_LAKE_DEPTH = 3.4;
const TERRAIN_INLAND_LAKE_MIN_UNDERWATER_DEPTH = 0.7;
const TERRAIN_INLAND_LAKE_MIN_RIM_ABOVE_WATER = 0.55;

const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

const startupCatalog = {
  items: [],
  lastSyncedAtMs: 0,
  requestCount: 0,
  source: "empty",
  refreshPromise: null,
  recentlyUsedIds: [],
};

const DEV_STARTUP_FALLBACKS = [
  { id: "linear", name: "Linear", iconUrl: "", growth30d: 22 },
  { id: "figma", name: "Figma", iconUrl: "", growth30d: 18 },
  { id: "loom", name: "Loom", iconUrl: "", growth30d: -7 },
  { id: "vercel", name: "Vercel", iconUrl: "", growth30d: 14 },
  { id: "posthog", name: "PostHog", iconUrl: "", growth30d: 31 },
  { id: "snyk", name: "Snyk", iconUrl: "", growth30d: -12 },
];

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const asFiniteNumber = (value, fallback = 0) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;
const asTrimmedString = (value) => (typeof value === "string" ? value.trim() : "");
const isProduction = process.env.NODE_ENV === "production";
const ensureParentDir = (filePath) => {
  mkdirSync(path.dirname(filePath), { recursive: true });
};

const serveDist = (req, res) => {
  if (!req.url) {
    res.writeHead(400);
    res.end("Bad request");
    return;
  }

  const url = new URL(req.url, "http://localhost");
  let requestedPath = decodeURIComponent(url.pathname);
  if (requestedPath === "/") {
    requestedPath = "/index.html";
  }

  const normalized = path.normalize(requestedPath).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(DIST_DIR, normalized);
  const fileExists = existsSync(filePath);
  const isAssetRequest = path.extname(normalized).length > 0;

  let targetPath = filePath;
  if (!fileExists || !isAssetRequest) {
    targetPath = path.join(DIST_DIR, "index.html");
  }

  if (!existsSync(targetPath)) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("dist/ not found. Run npm run build first.");
    return;
  }

  const ext = path.extname(targetPath).toLowerCase();
  const contentType = CONTENT_TYPES[ext] ?? "application/octet-stream";

  try {
    const content = readFileSync(targetPath);
    res.writeHead(200, { "Content-Type": contentType });
    res.end(content);
  } catch {
    res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Failed to serve static file.");
  }
};

const createRng = (seed) => {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
};

const fract = (n) => n - Math.floor(n);
const smoothstep = (t) => t * t * (3 - 2 * t);
const hash2 = (x, z, seed) =>
  fract(Math.sin(x * 127.1 + z * 311.7 + seed * 17.13) * 43758.5453123);

const valueNoise2 = (x, z, seed) => {
  const x0 = Math.floor(x);
  const z0 = Math.floor(z);
  const x1 = x0 + 1;
  const z1 = z0 + 1;

  const tx = smoothstep(x - x0);
  const tz = smoothstep(z - z0);

  const n00 = hash2(x0, z0, seed);
  const n10 = hash2(x1, z0, seed);
  const n01 = hash2(x0, z1, seed);
  const n11 = hash2(x1, z1, seed);

  const nx0 = n00 + (n10 - n00) * tx;
  const nx1 = n01 + (n11 - n01) * tx;
  return nx0 + (nx1 - nx0) * tz;
};

const fractalNoise = (x, z) => {
  let frequency = TERRAIN_NOISE_SCALE;
  let amplitude = 1;
  let total = 0;
  let amplitudeSum = 0;

  for (let octave = 0; octave < 4; octave += 1) {
    total +=
      (valueNoise2(x * frequency, z * frequency, TERRAIN_SEED + octave * 53) * 2 - 1) *
      amplitude;
    amplitudeSum += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }

  return total / Math.max(amplitudeSum, Number.EPSILON);
};

const ridgeNoise = (x, z) => {
  const n = valueNoise2(
    x * TERRAIN_NOISE_SCALE * 2.3,
    z * TERRAIN_NOISE_SCALE * 2.3,
    TERRAIN_SEED + 999,
  );
  return 1 - Math.abs(n * 2 - 1);
};

const islandMask = (x, z) => {
  const ratio = Math.hypot(x, z) / TERRAIN_ISLAND_RADIUS;
  if (ratio >= 1) {
    return 0;
  }
  return 1 - smoothstep(ratio * ratio);
};

const baseTerrainHeightAt = (x, z) => {
  const mask = islandMask(x, z);
  if (mask <= 0) {
    return TERRAIN_HEIGHT_BASE - 2;
  }

  const base = fractalNoise(x, z);
  const ridges = ridgeNoise(x, z);
  const mixed = base * 0.75 + ridges * 0.25;
  return TERRAIN_HEIGHT_BASE + mixed * TERRAIN_MAX_HEIGHT * mask;
};

const lakeDepthFromDistance = (distance, radius, baseHeight, waterY) => {
  const outerRadius = radius + TERRAIN_INLAND_LAKE_RIM_WIDTH;
  if (distance >= outerRadius) {
    return 0;
  }

  const tOuter = clamp(distance / outerRadius, 0, 1);
  const outerFalloff = 1 - smoothstep(tOuter);
  const innerT = clamp(1 - distance / Math.max(radius, Number.EPSILON), 0, 1);
  const bowl = innerT * innerT;
  const proceduralDepth = TERRAIN_INLAND_LAKE_DEPTH * (bowl * 0.85 + outerFalloff * 0.15);
  const minDepthToExposeWater = Math.max(0, baseHeight - (waterY - 0.18));
  return Math.max(proceduralDepth, minDepthToExposeWater * innerT);
};

const carvedHeightForLakeCandidate = (x, z, lakeX, lakeZ, lakeRadius) => {
  const baseHeight = baseTerrainHeightAt(x, z);
  const distance = Math.hypot(x - lakeX, z - lakeZ);
  return (
    baseHeight -
    lakeDepthFromDistance(distance, lakeRadius, baseHeight, TERRAIN_WATER_LEVEL)
  );
};

const generateInlandLake = () => {
  const rng = createRng(TERRAIN_SEED + 911);
  const maxCenterRadius = TERRAIN_ISLAND_RADIUS * TERRAIN_INLAND_LAKE_MAX_CENTER_RADIUS_RATIO;
  const attempts = 260;
  const shoreSafety = 5;

  for (let i = 0; i < attempts; i += 1) {
    const theta = rng() * Math.PI * 2;
    const centerRadius = Math.sqrt(rng()) * maxCenterRadius;
    const x = Math.cos(theta) * centerRadius;
    const z = Math.sin(theta) * centerRadius;
    const radius =
      TERRAIN_INLAND_LAKE_RADIUS_MIN +
      (TERRAIN_INLAND_LAKE_RADIUS_MAX - TERRAIN_INLAND_LAKE_RADIUS_MIN) * rng();

    if (Math.hypot(x, z) < TERRAIN_INLAND_LAKE_MIN_DIST_FROM_SPAWN) {
      continue;
    }
    if (Math.hypot(x, z) + radius + shoreSafety > TERRAIN_ISLAND_RADIUS * 0.82) {
      continue;
    }

    const centerGround = baseTerrainHeightAt(x, z);
    if (centerGround < TERRAIN_WATER_LEVEL + 3) {
      continue;
    }

    let valid = true;
    let minRimGround = Number.POSITIVE_INFINITY;
    for (let sample = 0; sample < 16; sample += 1) {
      const angle = (sample / 16) * Math.PI * 2;
      const sx = x + Math.cos(angle) * (radius + TERRAIN_INLAND_LAKE_RIM_WIDTH);
      const sz = z + Math.sin(angle) * (radius + TERRAIN_INLAND_LAKE_RIM_WIDTH);
      if (islandMask(sx, sz) <= 0.2) {
        valid = false;
        break;
      }
      minRimGround = Math.min(minRimGround, baseTerrainHeightAt(sx, sz));
    }
    if (!valid || minRimGround < TERRAIN_WATER_LEVEL + 0.8) {
      continue;
    }

    const centerCarvedY = carvedHeightForLakeCandidate(x, z, x, z, radius);
    if (centerCarvedY > TERRAIN_WATER_LEVEL - TERRAIN_INLAND_LAKE_MIN_UNDERWATER_DEPTH) {
      continue;
    }

    let rimOk = true;
    for (let sample = 0; sample < 16; sample += 1) {
      const angle = (sample / 16) * Math.PI * 2;
      const sx = x + Math.cos(angle) * (radius + TERRAIN_INLAND_LAKE_RIM_WIDTH * 0.5);
      const sz = z + Math.sin(angle) * (radius + TERRAIN_INLAND_LAKE_RIM_WIDTH * 0.5);
      const carvedRimY = carvedHeightForLakeCandidate(sx, sz, x, z, radius);
      if (carvedRimY < TERRAIN_WATER_LEVEL + TERRAIN_INLAND_LAKE_MIN_RIM_ABOVE_WATER) {
        rimOk = false;
        break;
      }
    }
    if (!rimOk) {
      continue;
    }

    return { x, z, radius, waterY: TERRAIN_WATER_LEVEL };
  }

  const fallbackCandidates = [
    { x: 34, z: -22, radius: 10.5 },
    { x: -30, z: 25, radius: 9.8 },
    { x: 22, z: 31, radius: 9.2 },
  ];

  for (const candidate of fallbackCandidates) {
    if (Math.hypot(candidate.x, candidate.z) + candidate.radius + 4 > TERRAIN_ISLAND_RADIUS * 0.84) {
      continue;
    }
    if (Math.hypot(candidate.x, candidate.z) < TERRAIN_INLAND_LAKE_MIN_DIST_FROM_SPAWN) {
      continue;
    }
    if (baseTerrainHeightAt(candidate.x, candidate.z) < TERRAIN_WATER_LEVEL + 3) {
      continue;
    }
    const centerCarvedY = carvedHeightForLakeCandidate(
      candidate.x,
      candidate.z,
      candidate.x,
      candidate.z,
      candidate.radius,
    );
    if (centerCarvedY > TERRAIN_WATER_LEVEL - TERRAIN_INLAND_LAKE_MIN_UNDERWATER_DEPTH) {
      continue;
    }
    return {
      x: candidate.x,
      z: candidate.z,
      radius: candidate.radius,
      waterY: TERRAIN_WATER_LEVEL,
    };
  }

  return {
    x: 28,
    z: -24,
    radius: 9.5,
    waterY: TERRAIN_WATER_LEVEL,
  };
};

const inlandLake = generateInlandLake();

const isInInlandLake = (x, z) => {
  if (!inlandLake) {
    return false;
  }
  return Math.hypot(x - inlandLake.x, z - inlandLake.z) <= inlandLake.radius * 0.98;
};

const lakeDepthAt = (x, z) => {
  if (!inlandLake) {
    return 0;
  }

  const distance = Math.hypot(x - inlandLake.x, z - inlandLake.z);
  const baseHeight = baseTerrainHeightAt(x, z);
  return lakeDepthFromDistance(distance, inlandLake.radius, baseHeight, inlandLake.waterY);
};

const terrainHeightAt = (x, z) => baseTerrainHeightAt(x, z) - lakeDepthAt(x, z);

const normalizeStartup = (raw, index) => {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const startup = raw;
  const startupId =
    asTrimmedString(startup.id) ||
    asTrimmedString(startup.slug) ||
    asTrimmedString(startup.name) ||
    `startup-${index}`;
  const name = asTrimmedString(startup.name) || startupId;
  const iconUrl =
    asTrimmedString(startup.icon) ||
    asTrimmedString(startup.iconUrl) ||
    asTrimmedString(startup.logo) ||
    "";

  if (!startupId || !name) {
    return null;
  }

  return {
    id: startupId,
    name,
    iconUrl,
    growth30d: asFiniteNumber(startup.growth30d),
  };
};

const getStartupGrowthBucket = (startup) => {
  if (startup.growth30d >= STARTUP_MIN_GAMEPLAY_GROWTH_PCT) {
    return "positive";
  }
  if (startup.growth30d <= -STARTUP_MIN_GAMEPLAY_GROWTH_PCT) {
    return "negative";
  }
  return "neutral";
};

const dedupeStartups = (items) => {
  const seenIds = new Set();
  const output = [];
  for (const item of items) {
    if (!item || seenIds.has(item.id)) {
      continue;
    }
    seenIds.add(item.id);
    output.push(item);
  }
  return output;
};

const buildPlayableSubset = (items, targetSize) => {
  const deduped = dedupeStartups(items);
  if (deduped.length <= targetSize) {
    return deduped;
  }

  const buckets = {
    positive: deduped.filter((item) => getStartupGrowthBucket(item) === "positive"),
    negative: deduped.filter((item) => getStartupGrowthBucket(item) === "negative"),
    neutral: deduped.filter((item) => getStartupGrowthBucket(item) === "neutral"),
  };

  const output = [];
  const seen = new Set();
  const ratios = [
    ["positive", 0.45],
    ["negative", 0.25],
    ["neutral", 0.3],
  ];

  for (const [bucketName, ratio] of ratios) {
    const bucket = buckets[bucketName];
    const targetCount = Math.min(bucket.length, Math.max(1, Math.round(targetSize * ratio)));
    for (let index = 0; index < targetCount; index += 1) {
      const startup = bucket[index];
      if (!startup || seen.has(startup.id)) {
        continue;
      }
      seen.add(startup.id);
      output.push(startup);
    }
  }

  if (output.length < targetSize) {
    for (const startup of deduped) {
      if (seen.has(startup.id)) {
        continue;
      }
      seen.add(startup.id);
      output.push(startup);
      if (output.length >= targetSize) {
        break;
      }
    }
  }

  return output;
};

const persistStartupCatalog = () => {
  try {
    ensureParentDir(STARTUP_CACHE_FILE_PATH);
    writeFileSync(
      STARTUP_CACHE_FILE_PATH,
      JSON.stringify(
        {
          items: startupCatalog.items,
          lastSyncedAtMs: startupCatalog.lastSyncedAtMs,
          requestCount: startupCatalog.requestCount,
          source: startupCatalog.source,
        },
        null,
        2,
      ),
      "utf8",
    );
  } catch (error) {
    console.warn("[startup-coins] failed to persist startup cache.", error);
  }
};

const hydrateStartupCatalogFromDisk = () => {
  if (!existsSync(STARTUP_CACHE_FILE_PATH)) {
    return false;
  }

  try {
    const parsed = JSON.parse(readFileSync(STARTUP_CACHE_FILE_PATH, "utf8"));
    const sourceItems = Array.isArray(parsed?.items) ? parsed.items : [];
    const normalizedItems = sourceItems
      .map((item, index) => normalizeStartup(item, index))
      .filter(Boolean);
    const playableSubset = buildPlayableSubset(normalizedItems, STARTUP_TARGET_POOL_SIZE);
    if (playableSubset.length === 0) {
      return false;
    }

    startupCatalog.items = playableSubset;
    startupCatalog.lastSyncedAtMs = asFiniteNumber(parsed?.lastSyncedAtMs, 0);
    startupCatalog.requestCount = asFiniteNumber(parsed?.requestCount, 0);
    startupCatalog.source = "disk-cache";
    return true;
  } catch (error) {
    console.warn("[startup-coins] failed to read startup cache from disk.", error);
    return false;
  }
};

if (!hydrateStartupCatalogFromDisk() && !isProduction) {
  startupCatalog.items = buildPlayableSubset(
    DEV_STARTUP_FALLBACKS,
    Math.min(DEV_STARTUP_FALLBACKS.length, STARTUP_TARGET_POOL_SIZE),
  );
  startupCatalog.lastSyncedAtMs = Date.now();
  startupCatalog.requestCount = 0;
  startupCatalog.source = "bootstrap-fallback";
}

const fetchStartupPage = async (apiKey, page) => {
  const url = new URL(TRUSTMRR_STARTUPS_ENDPOINT);
  url.searchParams.set("page", String(page));
  url.searchParams.set("limit", String(TRUSTMRR_PAGE_LIMIT));

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`TrustMRR ${response.status}: ${body.slice(0, 180)}`);
  }

  const payload = await response.json();
  const data = Array.isArray(payload?.data) ? payload.data : [];
  const meta = payload?.meta && typeof payload.meta === "object" ? payload.meta : null;
  const lastPage = asFiniteNumber(meta?.lastPage ?? meta?.totalPages, 0);
  const currentPage = asFiniteNumber(meta?.page, page);
  const hasMore =
    Boolean(meta?.hasMore) ||
    (lastPage > 0 ? currentPage < lastPage : data.length >= TRUSTMRR_PAGE_LIMIT);

  return { data, hasMore };
};

const syncStartupCatalog = async () => {
  if (startupCatalog.refreshPromise) {
    return startupCatalog.refreshPromise;
  }

  startupCatalog.refreshPromise = (async () => {
    const apiKey = process.env.TRUSTMRR_API_KEY?.trim();
    if (!apiKey) {
      if (!isProduction) {
        if (startupCatalog.items.length === 0) {
          startupCatalog.items = buildPlayableSubset(
            DEV_STARTUP_FALLBACKS,
            Math.min(DEV_STARTUP_FALLBACKS.length, STARTUP_TARGET_POOL_SIZE),
          );
          startupCatalog.lastSyncedAtMs = Date.now();
          startupCatalog.requestCount = 0;
          startupCatalog.source = "bootstrap-fallback";
          persistStartupCatalog();
        }
        console.warn("[startup-coins] TRUSTMRR_API_KEY missing; using development fallback startups.");
        return startupCatalog.items;
      }
      console.warn("[startup-coins] TRUSTMRR_API_KEY missing; startup coins disabled.");
      return startupCatalog.items;
    }

    const items = [];
    let page = 1;
    let hasMore = true;
    let requestCount = 0;

    while (hasMore && page <= 100 && requestCount < STARTUP_SYNC_MAX_REQUESTS) {
      const result = await fetchStartupPage(apiKey, page);
      requestCount += 1;
      for (let index = 0; index < result.data.length; index += 1) {
        const normalized = normalizeStartup(result.data[index], items.length + index);
        if (normalized) {
          items.push(normalized);
        }
      }
      hasMore = result.hasMore;
      if (items.length >= STARTUP_TARGET_POOL_SIZE) {
        break;
      }
      page += 1;
    }

    const playableSubset = buildPlayableSubset(items, STARTUP_TARGET_POOL_SIZE);
    if (playableSubset.length === 0) {
      throw new Error("TrustMRR returned no usable startups within sync budget.");
    }

    startupCatalog.items = playableSubset;
    startupCatalog.lastSyncedAtMs = Date.now();
    startupCatalog.requestCount = requestCount;
    startupCatalog.source = "api";
    persistStartupCatalog();
    console.log(
      `[startup-coins] synced ${playableSubset.length} startups from TrustMRR using ${requestCount} requests.`,
    );
    return playableSubset;
  })()
    .catch((error) => {
      if (!isProduction && startupCatalog.items.length === 0) {
        startupCatalog.items = buildPlayableSubset(
          DEV_STARTUP_FALLBACKS,
          Math.min(DEV_STARTUP_FALLBACKS.length, STARTUP_TARGET_POOL_SIZE),
        );
        startupCatalog.lastSyncedAtMs = Date.now();
        startupCatalog.requestCount = 0;
        startupCatalog.source = "bootstrap-fallback";
        persistStartupCatalog();
        console.warn("[startup-coins] TrustMRR refresh failed; using development fallback startups.", error);
        return startupCatalog.items;
      }
      console.warn("[startup-coins] refresh failed; keeping last successful cache.", error);
      return startupCatalog.items;
    })
    .finally(() => {
      startupCatalog.refreshPromise = null;
    });

  return startupCatalog.refreshPromise;
};

const shouldRefreshStartupCatalog = (now = Date.now()) =>
  startupCatalog.items.length === 0 ||
  startupCatalog.lastSyncedAtMs <= 0 ||
  now - startupCatalog.lastSyncedAtMs >= SAFE_STARTUP_REFRESH_INTERVAL_MS;

class NetPlayer extends Schema {
  constructor() {
    super();
    this.nickname = "";
    this.x = 0;
    this.y = SPAWN_Y;
    this.z = 0;
    this.yaw = 0;
    this.bank = 0;
    this.speedbar = false;
    this.currentOrbScore = 0;
    this.bestOrbScore = 0;
    this.speedEffectPct = 0;
    this.speedEffectEndsAtMs = 0;
    this.speedEffectActive = false;
    this.lastCoinPickupPct = 0;
    this.lastCoinPickupAtMs = 0;
    this.lastCoinPickupSeq = 0;
    this.lastCoinPickupStartupName = "";
    this.updatedAtMs = Date.now();
  }
}

defineTypes(NetPlayer, {
  nickname: "string",
  x: "number",
  y: "number",
  z: "number",
  yaw: "number",
  bank: "number",
  speedbar: "boolean",
  currentOrbScore: "number",
  bestOrbScore: "number",
  speedEffectPct: "number",
  speedEffectEndsAtMs: "number",
  speedEffectActive: "boolean",
  lastCoinPickupPct: "number",
  lastCoinPickupAtMs: "number",
  lastCoinPickupSeq: "number",
  lastCoinPickupStartupName: "string",
  updatedAtMs: "number",
});

class NetOrb extends Schema {
  constructor() {
    super();
    this.x = 0;
    this.y = ORB_SPAWN_ALTITUDE_MIN;
    this.z = 0;
    this.holderSessionId = "";
    this.lastTransferAtMs = 0;
    this.spawnSeq = 0;
  }
}

defineTypes(NetOrb, {
  x: "number",
  y: "number",
  z: "number",
  holderSessionId: "string",
  lastTransferAtMs: "number",
  spawnSeq: "number",
});

class NetThermal extends Schema {
  constructor() {
    super();
    this.id = "";
    this.sizeClass = "small";
    this.activationAt = Date.now() * 0.001;
    this.groundY = 0;
    this.x = 0;
    this.z = 0;
    this.radius = 6;
    this.baseHeight = 30;
    this.heightAmplitude = 10;
    this.strength = 10;
    this.phase = 0;
  }
}

defineTypes(NetThermal, {
  id: "string",
  sizeClass: "string",
  activationAt: "number",
  groundY: "number",
  x: "number",
  z: "number",
  radius: "number",
  baseHeight: "number",
  heightAmplitude: "number",
  strength: "number",
  phase: "number",
});

class NetStartupCoin extends Schema {
  constructor() {
    super();
    this.id = "";
    this.startupId = "";
    this.name = "";
    this.iconUrl = "";
    this.growth30d = 0;
    this.x = 0;
    this.y = COIN_SPAWN_ALTITUDE_MIN;
    this.z = 0;
    this.spawnedAtMs = 0;
    this.expiresAtMs = 0;
  }
}

defineTypes(NetStartupCoin, {
  id: "string",
  startupId: "string",
  name: "string",
  iconUrl: "string",
  growth30d: "number",
  x: "number",
  y: "number",
  z: "number",
  spawnedAtMs: "number",
  expiresAtMs: "number",
});

class WorldState extends Schema {
  constructor() {
    super();
    this.players = new MapSchema();
    this.thermals = new ArraySchema();
    this.orb = new NetOrb();
    this.coins = new ArraySchema();
    this.orbActive = false;
    this.orbCountdownRemainingMs = 0;
    this.worldSeed = 5000;
    this.serverTimeMs = Date.now();
  }
}

defineTypes(WorldState, {
  players: { map: NetPlayer },
  thermals: [NetThermal],
  orb: NetOrb,
  coins: [NetStartupCoin],
  orbActive: "boolean",
  orbCountdownRemainingMs: "number",
  worldSeed: "number",
  serverTimeMs: "number",
});

const canTag = (ax, ay, az, bx, by, bz, horizontalRadius, verticalTolerance) => {
  const dx = ax - bx;
  const dz = az - bz;
  return (
    Math.hypot(dx, dz) <= horizontalRadius &&
    Math.abs(ay - by) <= verticalTolerance
  );
};

const respawnOrb = (state) => {
  const angle = Math.random() * Math.PI * 2;
  const distanceFromCenter = Math.sqrt(Math.random()) * ORB_SPAWN_RADIUS;
  state.orb.x = Math.cos(angle) * distanceFromCenter;
  state.orb.z = Math.sin(angle) * distanceFromCenter;
  state.orb.y =
    ORB_SPAWN_ALTITUDE_MIN + Math.random() * (ORB_SPAWN_ALTITUDE_MAX - ORB_SPAWN_ALTITUDE_MIN);
  state.orb.holderSessionId = "";
  state.orb.lastTransferAtMs = Date.now();
  state.orb.spawnSeq += 1;
};

const buildThermals = (seed) => {
  const rng = createRng(seed);
  const thermals = [];
  const randomInRange = (min, max) => min + (max - min) * rng();
  const batchNowSeconds = Date.now() * 0.001;

  while (thermals.length < THERMAL_COUNT) {
    let bestCandidate = null;

    for (let i = 0; i < THERMAL_CANDIDATES_PER_SLOT; i += 1) {
      const angle = rng() * Math.PI * 2;
      const maxRadius = Math.max(
        Math.min(THERMAL_MAX_CENTER_RADIUS, THERMAL_MAX_CENTER_RADIUS - THERMAL_EDGE_MARGIN),
        10,
      );
      const dist = Math.sqrt(rng()) * maxRadius;
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;
      const isSmall = rng() < THERMAL_SMALL_RATIO;
      const radius = isSmall
        ? randomInRange(THERMAL_SMALL_RADIUS_MIN, THERMAL_SMALL_RADIUS_MAX)
        : randomInRange(THERMAL_LARGE_RADIUS_MIN, THERMAL_LARGE_RADIUS_MAX);

      let overlapsExisting = false;
      let minClearance = Infinity;
      for (const existing of thermals) {
        const centerDistance = Math.hypot(existing.x - x, existing.z - z);
        const clearance = centerDistance - (existing.radius + radius + THERMAL_MIN_GAP);
        minClearance = Math.min(minClearance, clearance);
        if (clearance < 0) {
          overlapsExisting = true;
          break;
        }
      }
      if (overlapsExisting) {
        continue;
      }

      const edgeBias = dist / maxRadius;
      const spreadScore = Number.isFinite(minClearance) ? minClearance : maxRadius * 0.5;
      const score = spreadScore + edgeBias * 6;

      if (!bestCandidate || score > bestCandidate.score) {
        bestCandidate = { x, z, radius, isSmall, score };
      }
    }

    if (!bestCandidate) {
      let placed = false;
      for (let attempt = 0; attempt < THERMAL_FALLBACK_ATTEMPTS_PER_SLOT; attempt += 1) {
        const angle = rng() * Math.PI * 2;
        const maxRadius = Math.max(
          Math.min(THERMAL_MAX_CENTER_RADIUS, THERMAL_MAX_CENTER_RADIUS - THERMAL_EDGE_MARGIN),
          10,
        );
        const dist = Math.sqrt(rng()) * maxRadius;
        const x = Math.cos(angle) * dist;
        const z = Math.sin(angle) * dist;
        const isSmall = rng() < THERMAL_SMALL_RATIO;
        const radius = isSmall
          ? randomInRange(THERMAL_SMALL_RADIUS_MIN, THERMAL_SMALL_RADIUS_MAX)
          : randomInRange(THERMAL_LARGE_RADIUS_MIN, THERMAL_LARGE_RADIUS_MAX);

        const overlapsExisting = thermals.some((existing) => {
          const centerDistance = Math.hypot(existing.x - x, existing.z - z);
          return centerDistance < existing.radius + radius + THERMAL_MIN_GAP;
        });
        if (overlapsExisting) {
          continue;
        }
        bestCandidate = { x, z, radius, isSmall, score: 0 };
        placed = true;
        break;
      }

      if (!placed) {
        break;
      }
    }

    if (!bestCandidate) {
      break;
    }

    const thermal = new NetThermal();
    thermal.id = `thermal-${seed}-${thermals.length}`;
    thermal.sizeClass = bestCandidate.isSmall ? "small" : "large";
    thermal.activationAt = batchNowSeconds;
    thermal.groundY = 0;
    thermal.x = bestCandidate.x;
    thermal.z = bestCandidate.z;
    thermal.radius = bestCandidate.radius;
    thermal.baseHeight = randomInRange(THERMAL_BASE_HEIGHT_MIN, THERMAL_BASE_HEIGHT_MAX);
    thermal.heightAmplitude = randomInRange(
      THERMAL_HEIGHT_AMPLITUDE_MIN,
      THERMAL_HEIGHT_AMPLITUDE_MAX,
    );
    thermal.strength = bestCandidate.isSmall
      ? randomInRange(THERMAL_SMALL_STRENGTH_MIN, THERMAL_SMALL_STRENGTH_MAX)
      : randomInRange(THERMAL_LARGE_STRENGTH_MIN, THERMAL_LARGE_STRENGTH_MAX);
    thermal.phase = rng() * Math.PI * 2;
    thermals.push(thermal);
  }

  const activationRange = Math.max(
    THERMAL_ACTIVATION_DELAY_MAX_SECONDS - THERMAL_ACTIVATION_DELAY_MIN_SECONDS,
    0,
  );
  if (activationRange > 0 && thermals.length > 0) {
    const slotSize = activationRange / thermals.length;
    const ranked = thermals
      .map((_, index) => ({ index, key: rng() }))
      .sort((a, b) => a.key - b.key);

    for (let rank = 0; rank < ranked.length; rank += 1) {
      const { index } = ranked[rank];
      const centerDelay = THERMAL_ACTIVATION_DELAY_MIN_SECONDS + (rank + 0.5) * slotSize;
      const jitter = (rng() - 0.5) * slotSize * 0.7;
      thermals[index].activationAt = batchNowSeconds + clamp(
        centerDelay + jitter,
        THERMAL_ACTIVATION_DELAY_MIN_SECONDS,
        THERMAL_ACTIVATION_DELAY_MAX_SECONDS,
      );
    }
  }

  return thermals;
};

const chooseStartupForCoin = (state) => {
  if (startupCatalog.items.length === 0) {
    return null;
  }

  const activeIds = new Set();
  for (const coin of state.coins) {
    activeIds.add(coin.startupId);
  }

  const recentIds = new Set(startupCatalog.recentlyUsedIds);
  const available = startupCatalog.items.filter((startup) => !activeIds.has(startup.id));
  const freshPool = available.filter((startup) => !recentIds.has(startup.id));
  const sourcePool = freshPool.length > 0 ? freshPool : available.length > 0 ? available : startupCatalog.items;

  const buckets = {
    positive: sourcePool.filter((startup) => getStartupGrowthBucket(startup) === "positive"),
    negative: sourcePool.filter((startup) => getStartupGrowthBucket(startup) === "negative"),
    neutral: sourcePool.filter((startup) => getStartupGrowthBucket(startup) === "neutral"),
  };
  const availableBuckets = Object.entries(buckets).filter(([, items]) => items.length > 0);
  if (availableBuckets.length === 0) {
    return sourcePool[Math.floor(Math.random() * sourcePool.length)] ?? null;
  }

  const weightedChoices = [
    ["positive", 0.45],
    ["negative", 0.25],
    ["neutral", 0.3],
  ].filter(([bucketName]) => buckets[bucketName].length > 0);

  let randomValue = Math.random();
  for (const [bucketName, weight] of weightedChoices) {
    randomValue -= weight;
    if (randomValue <= 0) {
      const bucket = buckets[bucketName];
      return bucket[Math.floor(Math.random() * bucket.length)] ?? null;
    }
  }

  const [fallbackBucketName] = weightedChoices[weightedChoices.length - 1];
  const fallbackBucket = buckets[fallbackBucketName];
  return fallbackBucket[Math.floor(Math.random() * fallbackBucket.length)] ?? null;
};

const recordStartupUsage = (startupId) => {
  if (!startupId) {
    return;
  }
  startupCatalog.recentlyUsedIds = startupCatalog.recentlyUsedIds.filter((id) => id !== startupId);
  startupCatalog.recentlyUsedIds.unshift(startupId);
  if (startupCatalog.recentlyUsedIds.length > STARTUP_RECENT_HISTORY_SIZE) {
    startupCatalog.recentlyUsedIds.length = STARTUP_RECENT_HISTORY_SIZE;
  }
};

const buildCoinSpawnPoint = (state, x, z) => {
  if (Math.hypot(x, z) > COIN_SPAWN_MAX_CENTER_RADIUS) {
    return null;
  }
  if (isInInlandLake(x, z)) {
    return null;
  }

  const groundY = terrainHeightAt(x, z);
  if (!Number.isFinite(groundY) || groundY <= TERRAIN_WATER_LEVEL + 0.8) {
    return null;
  }

  const overlapsCoin = Array.from(state.coins).some(
    (coin) => Math.hypot(coin.x - x, coin.z - z) < COIN_MIN_GAP,
  );
  if (overlapsCoin) {
    return null;
  }

  return {
    x,
    z,
    y: clamp(groundY + COIN_SPAWN_GROUND_OFFSET, COIN_SPAWN_ALTITUDE_MIN, COIN_SPAWN_ALTITUDE_MAX),
  };
};

const pickCoinSpawnPoint = (state) => {
  for (let attempt = 0; attempt < COIN_SPAWN_ATTEMPTS; attempt += 1) {
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.sqrt(Math.random()) * COIN_SPAWN_MAX_CENTER_RADIUS;
    const point = buildCoinSpawnPoint(state, Math.cos(angle) * radius, Math.sin(angle) * radius);
    if (point) {
      return point;
    }
  }

  const fallbackPositions = [
    { x: 16, z: -8 },
    { x: -18, z: 20 },
    { x: 30, z: 12 },
    { x: -28, z: -18 },
  ];

  for (const fallback of fallbackPositions) {
    const point = buildCoinSpawnPoint(state, fallback.x, fallback.z);
    if (point) {
      return point;
    }
  }

  return null;
};

const spawnStartupCoin = (state, now) => {
  if (state.coins.length >= COIN_MAX_ACTIVE) {
    return false;
  }

  const startup = chooseStartupForCoin(state);
  const point = startup ? pickCoinSpawnPoint(state) : null;
  if (!startup || !point) {
    return false;
  }

  const coin = new NetStartupCoin();
  coin.id = `coin-${now}-${Math.floor(Math.random() * 1e6)}`;
  coin.startupId = startup.id;
  coin.name = startup.name;
  coin.iconUrl = startup.iconUrl;
  coin.growth30d = startup.growth30d;
  coin.x = point.x;
  coin.y = point.y;
  coin.z = point.z;
  coin.spawnedAtMs = now;
  coin.expiresAtMs = now + COIN_EXPIRE_AFTER_MS;
  state.coins.push(coin);
  recordStartupUsage(startup.id);
  return true;
};

const removeExpiredCoins = (state, now) => {
  for (let index = state.coins.length - 1; index >= 0; index -= 1) {
    if (state.coins[index].expiresAtMs <= now) {
      state.coins.splice(index, 1);
    }
  }
};

const updatePlayerCoinEffects = (state, now) => {
  for (const player of state.players.values()) {
    if (player.speedEffectEndsAtMs > now) {
      player.speedEffectActive = Math.abs(player.speedEffectPct) > Number.EPSILON;
      continue;
    }

    player.speedEffectActive = false;
    player.speedEffectPct = 0;
    player.speedEffectEndsAtMs = 0;
  }
};

const applyCoinPickup = (player, coin, now) => {
  const effectPct = coin.growth30d;
  player.speedEffectPct = effectPct;
  player.speedEffectEndsAtMs = now + COIN_EFFECT_DURATION_MS;
  player.speedEffectActive = Math.abs(effectPct) > Number.EPSILON;
  player.lastCoinPickupPct = effectPct;
  player.lastCoinPickupAtMs = now;
  player.lastCoinPickupSeq += 1;
  player.lastCoinPickupStartupName = coin.name;
};

class WorldRoom extends Room {
  beginOrbCountdown() {
    this.orbCountdownEndsAtMs = Date.now() + ORB_START_COUNTDOWN_MS;
    this.state.orbActive = false;
  }

  clearOrbState() {
    this.orbCountdownEndsAtMs = null;
    this.state.orbActive = false;
    this.state.orbCountdownRemainingMs = 0;
    this.state.orb.holderSessionId = "";
  }

  clearCoins(now = Date.now()) {
    this.state.coins.clear();
    this.nextCoinSpawnAtMs = now + COIN_SPAWN_INTERVAL_MS;
  }

  canOrbRun() {
    return this.state.players.size >= ORB_MIN_PLAYERS;
  }

  updateOrbLifecycle(now) {
    if (!this.canOrbRun()) {
      this.clearOrbState();
      return;
    }

    if (this.state.orbActive) {
      this.state.orbCountdownRemainingMs = 0;
      return;
    }

    if (this.orbCountdownEndsAtMs === null) {
      this.beginOrbCountdown();
    }

    const remaining = Math.max(0, this.orbCountdownEndsAtMs - now);
    this.state.orbCountdownRemainingMs = remaining;
    if (remaining === 0) {
      this.orbCountdownEndsAtMs = null;
      this.state.orbActive = true;
      respawnOrb(this.state);
    }
  }

  updateCoinLifecycle(now) {
    if (this.state.players.size === 0) {
      this.clearCoins(now);
      return;
    }

    if (now < this.nextCoinSpawnAtMs) {
      return;
    }

    if (startupCatalog.items.length > 0 && this.state.coins.length < COIN_MAX_ACTIVE) {
      spawnStartupCoin(this.state, now);
    }
    this.nextCoinSpawnAtMs = now + COIN_SPAWN_INTERVAL_MS;
  }

  handleCoinPickups(now) {
    if (this.state.coins.length === 0) {
      return;
    }

    const claimedPlayers = new Set();
    for (let coinIndex = this.state.coins.length - 1; coinIndex >= 0; coinIndex -= 1) {
      const coin = this.state.coins[coinIndex];
      for (const [sessionId, player] of this.state.players.entries()) {
        if (claimedPlayers.has(sessionId)) {
          continue;
        }
        if (
          canTag(
            player.x,
            player.y,
            player.z,
            coin.x,
            coin.y,
            coin.z,
            COIN_PICKUP_HORIZONTAL_RADIUS,
            COIN_PICKUP_VERTICAL_TOLERANCE,
          )
        ) {
          applyCoinPickup(player, coin, now);
          claimedPlayers.add(sessionId);
          this.state.coins.splice(coinIndex, 1);
          break;
        }
      }
    }
  }

  onCreate() {
    this.maxClients = MAX_CLIENTS;
    this.setPatchRate(SERVER_TICK_MS);
    this.setState(new WorldState());
    this.scoreAccumulatorMs = 0;
    this.orbCountdownEndsAtMs = null;
    this.nextCoinSpawnAtMs = Date.now() + COIN_SPAWN_INTERVAL_MS;
    this.state.thermals.push(...buildThermals(this.state.worldSeed));
    if (shouldRefreshStartupCatalog()) {
      void syncStartupCatalog();
    }

    this.onMessage("pose", (client, pose) => {
      const player = this.state.players.get(client.sessionId);
      if (!player || !pose || typeof pose !== "object") {
        return;
      }

      player.x = Number.isFinite(pose.x) ? pose.x : player.x;
      player.y = Number.isFinite(pose.y) ? pose.y : player.y;
      player.z = Number.isFinite(pose.z) ? pose.z : player.z;
      player.yaw = Number.isFinite(pose.yaw) ? pose.yaw : player.yaw;
      player.bank = Number.isFinite(pose.bank) ? pose.bank : player.bank;
      player.speedbar = Boolean(pose.speedbar);
      player.updatedAtMs = Date.now();
    });

    this.onMessage("crash", (client) => {
      if (this.state.orbActive && this.state.orb.holderSessionId === client.sessionId) {
        const holder = this.state.players.get(client.sessionId);
        if (holder) {
          holder.currentOrbScore = 0;
        }
        respawnOrb(this.state);
      }
    });

    this.setSimulationInterval((deltaTime) => {
      this.state.serverTimeMs = Date.now();
      const now = this.state.serverTimeMs;
      const orb = this.state.orb;

      updatePlayerCoinEffects(this.state, now);
      removeExpiredCoins(this.state, now);
      this.updateCoinLifecycle(now);
      this.handleCoinPickups(now);
      this.updateOrbLifecycle(now);

      if (!this.state.orbActive) {
        this.scoreAccumulatorMs = 0;
        return;
      }

      if (orb.holderSessionId) {
        const holder = this.state.players.get(orb.holderSessionId);
        if (!holder) {
          respawnOrb(this.state);
        } else {
          orb.x = holder.x;
          orb.y = holder.y + 0.9;
          orb.z = holder.z;
        }
      }

      if (!orb.holderSessionId) {
        for (const [sessionId, player] of this.state.players.entries()) {
          if (
            canTag(
              player.x,
              player.y,
              player.z,
              orb.x,
              orb.y,
              orb.z,
              ORB_PICKUP_HORIZONTAL_RADIUS,
              ORB_PICKUP_VERTICAL_TOLERANCE,
            )
          ) {
            player.currentOrbScore = 0;
            orb.holderSessionId = sessionId;
            orb.lastTransferAtMs = now;
            orb.x = player.x;
            orb.y = player.y + 0.9;
            orb.z = player.z;
            break;
          }
        }
      } else if (now - orb.lastTransferAtMs >= ORB_STEAL_COOLDOWN_MS) {
        const holder = this.state.players.get(orb.holderSessionId);
        if (!holder) {
          respawnOrb(this.state);
        } else {
          for (const [sessionId, player] of this.state.players.entries()) {
            if (sessionId === orb.holderSessionId) {
              continue;
            }
            if (
              canTag(
                player.x,
                player.y,
                player.z,
                holder.x,
                holder.y,
                holder.z,
                ORB_STEAL_HORIZONTAL_RADIUS,
                ORB_STEAL_VERTICAL_TOLERANCE,
              )
            ) {
              holder.currentOrbScore = 0;
              player.currentOrbScore = 0;
              orb.holderSessionId = sessionId;
              orb.lastTransferAtMs = now;
              orb.x = player.x;
              orb.y = player.y + 0.9;
              orb.z = player.z;
              break;
            }
          }
        }
      }

      this.scoreAccumulatorMs += deltaTime;
      while (this.scoreAccumulatorMs >= ORB_SCORE_INTERVAL_MS) {
        if (orb.holderSessionId) {
          const holder = this.state.players.get(orb.holderSessionId);
          if (holder) {
            holder.currentOrbScore += 1;
            holder.bestOrbScore = Math.max(holder.bestOrbScore, holder.currentOrbScore);
          }
        }
        this.scoreAccumulatorMs -= ORB_SCORE_INTERVAL_MS;
      }
    }, SERVER_TICK_MS);

    this.clock.setInterval(() => {
      this.state.worldSeed += 131;
      this.state.thermals.clear();
      this.state.thermals.push(...buildThermals(this.state.worldSeed));
    }, THERMAL_RESEED_SECONDS * 1000);

    this.clock.setInterval(() => {
      if (shouldRefreshStartupCatalog()) {
        void syncStartupCatalog();
      }
    }, SAFE_STARTUP_REFRESH_INTERVAL_MS);
  }

  onJoin(client, options) {
    const nickname =
      typeof options?.nickname === "string" && options.nickname.trim().length > 0
        ? options.nickname.trim().slice(0, 24)
        : `Pilot-${client.sessionId.slice(0, 4)}`;

    const player = new NetPlayer();
    player.nickname = nickname;
    player.currentOrbScore = 0;
    player.bestOrbScore = 0;
    const angle = Math.random() * Math.PI * 2;
    player.x = Math.cos(angle) * SPAWN_RING_RADIUS;
    player.z = Math.sin(angle) * SPAWN_RING_RADIUS;
    player.yaw = Math.atan2(player.x, player.z);
    this.state.players.set(client.sessionId, player);
    this.updateOrbLifecycle(Date.now());
  }

  onLeave(client) {
    if (this.state.orbActive && this.state.orb.holderSessionId === client.sessionId) {
      respawnOrb(this.state);
    }
    this.state.players.delete(client.sessionId);
    if (this.state.players.size === 0) {
      this.clearCoins(Date.now());
    }
    this.updateOrbLifecycle(Date.now());
  }
}

const httpServer = createServer((req, res) => {
  serveDist(req, res);
});
const gameServer = new Server({ server: httpServer });
gameServer.define(WORLD_NAME, WorldRoom);

httpServer.listen(PORT, () => {
  console.log(`[multiplayer] Colyseus server listening on ws://localhost:${PORT}`);
});
