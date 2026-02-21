import { createServer } from "node:http";
import colyseusPkg from "colyseus";
import * as schemaPkg from "@colyseus/schema";

const { Room, Server } = colyseusPkg;
const { ArraySchema, MapSchema, Schema, defineTypes } = schemaPkg;

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
const THERMAL_BASE_HEIGHT_MIN = 26;
const THERMAL_BASE_HEIGHT_MAX = 42;
const THERMAL_HEIGHT_AMPLITUDE_MIN = 8;
const THERMAL_HEIGHT_AMPLITUDE_MAX = 16;
const THERMAL_SMALL_STRENGTH_MIN = 11;
const THERMAL_SMALL_STRENGTH_MAX = 15;
const THERMAL_LARGE_STRENGTH_MIN = 8;
const THERMAL_LARGE_STRENGTH_MAX = 12;
const THERMAL_MIN_GAP = 14;
const THERMAL_EDGE_MARGIN = 0;
const THERMAL_MAX_CENTER_RADIUS = 92;
const THERMAL_CANDIDATES_PER_SLOT = 64;
const THERMAL_FALLBACK_ATTEMPTS_PER_SLOT = 120;
const THERMAL_ACTIVATION_DELAY_MIN_SECONDS = 0;
const THERMAL_ACTIVATION_DELAY_MAX_SECONDS = 6;
const SPAWN_RING_RADIUS = 86;
const SPAWN_Y = 18;

const createRng = (seed) => {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
};

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
  updatedAtMs: "number",
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

class WorldState extends Schema {
  constructor() {
    super();
    this.players = new MapSchema();
    this.thermals = new ArraySchema();
    this.worldSeed = 5000;
    this.serverTimeMs = Date.now();
  }
}

defineTypes(WorldState, {
  players: { map: NetPlayer },
  thermals: [NetThermal],
  worldSeed: "number",
  serverTimeMs: "number",
});

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

    const sizeClass = bestCandidate.isSmall ? "small" : "large";
    const strength = bestCandidate.isSmall
      ? randomInRange(THERMAL_SMALL_STRENGTH_MIN, THERMAL_SMALL_STRENGTH_MAX)
      : randomInRange(THERMAL_LARGE_STRENGTH_MIN, THERMAL_LARGE_STRENGTH_MAX);
    const thermal = new NetThermal();
    thermal.id = `thermal-${seed}-${thermals.length}`;
    thermal.sizeClass = sizeClass;
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
    thermal.strength = strength;
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
      const delayed = Math.min(
        THERMAL_ACTIVATION_DELAY_MAX_SECONDS,
        Math.max(THERMAL_ACTIVATION_DELAY_MIN_SECONDS, centerDelay + jitter),
      );
      thermals[index].activationAt = batchNowSeconds + delayed;
    }
  }

  return thermals;
};

class WorldRoom extends Room {
  onCreate() {
    this.maxClients = MAX_CLIENTS;
    this.setPatchRate(SERVER_TICK_MS);
    this.setState(new WorldState());
    this.state.thermals.push(...buildThermals(this.state.worldSeed));

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

    this.setSimulationInterval(() => {
      this.state.serverTimeMs = Date.now();
    }, SERVER_TICK_MS);

    this.clock.setInterval(() => {
      this.state.worldSeed += 131;
      this.state.thermals.clear();
      this.state.thermals.push(...buildThermals(this.state.worldSeed));
    }, THERMAL_RESEED_SECONDS * 1000);
  }

  onJoin(client, options) {
    const nickname =
      typeof options?.nickname === "string" && options.nickname.trim().length > 0
        ? options.nickname.trim().slice(0, 24)
        : `Pilot-${client.sessionId.slice(0, 4)}`;

    const player = new NetPlayer();
    player.nickname = nickname;
    const angle = Math.random() * Math.PI * 2;
    player.x = Math.cos(angle) * SPAWN_RING_RADIUS;
    player.z = Math.sin(angle) * SPAWN_RING_RADIUS;
    player.yaw = Math.atan2(player.x, player.z);
    this.state.players.set(client.sessionId, player);
  }

  onLeave(client) {
    this.state.players.delete(client.sessionId);
  }
}

const httpServer = createServer();
const gameServer = new Server({ server: httpServer });
gameServer.define(WORLD_NAME, WorldRoom);

httpServer.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[multiplayer] Colyseus server listening on ws://localhost:${PORT}`);
});
