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
    this.currentOrbScore = 0;
    this.bestOrbScore = 0;
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

class WorldState extends Schema {
  constructor() {
    super();
    this.players = new MapSchema();
    this.thermals = new ArraySchema();
    this.orb = new NetOrb();
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
  orbActive: "boolean",
  orbCountdownRemainingMs: "number",
  worldSeed: "number",
  serverTimeMs: "number",
});

const canTag = (ax, ay, az, bx, by, bz, horizontalRadius, verticalTolerance) => {
  const dx = ax - bx;
  const dz = az - bz;
  const horizontalDistance = Math.hypot(dx, dz);
  const verticalDistance = Math.abs(ay - by);
  return horizontalDistance <= horizontalRadius && verticalDistance <= verticalTolerance;
};

const respawnOrb = (state) => {
  const angle = Math.random() * Math.PI * 2;
  const distanceFromCenter = Math.sqrt(Math.random()) * ORB_SPAWN_RADIUS;
  state.orb.x = Math.cos(angle) * distanceFromCenter;
  state.orb.z = Math.sin(angle) * distanceFromCenter;
  state.orb.y = ORB_SPAWN_ALTITUDE_MIN + Math.random() * (ORB_SPAWN_ALTITUDE_MAX - ORB_SPAWN_ALTITUDE_MIN);
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

  onCreate() {
    this.maxClients = MAX_CLIENTS;
    this.setPatchRate(SERVER_TICK_MS);
    this.setState(new WorldState());
    this.scoreAccumulatorMs = 0;
    this.orbCountdownEndsAtMs = null;
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
    this.updateOrbLifecycle(Date.now());
  }
}

const httpServer = createServer();
const gameServer = new Server({ server: httpServer });
gameServer.define(WORLD_NAME, WorldRoom);

httpServer.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[multiplayer] Colyseus server listening on ws://localhost:${PORT}`);
});
