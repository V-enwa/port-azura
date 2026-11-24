// Port Azura 3D — every tuning constant and colour.
// Distances in world units (1 unit ≈ 1 meter-ish). Times in seconds.

export const VIEW_W = 1280;
export const VIEW_H = 720;

export const WORLD_W = 3200;
export const WORLD_H = 3200;

export const STEP = 1 / 60;
export const MAX_FRAME = 0.25;

export const DUSK_HOUR = 18;
export const SHADOW_LENGTH = 240;

export const PLAYER = {
  speed: 8,
  sprintSpeed: 14,
  radius: 0.7,
  maxHealth: 100,
  maxArmour: 100,
  healthRegenDelay: 5,
  healthRegenRate: 5,
};

export const CAMERA = {
  lerp: 5,
  distance: 12,
  height: 4,
  lookAhead: 0.3,
  maxLead: 4,
  minPitch: 0.2,
  maxPitch: 1.2,
  orbitSpeed: 2,
};

export const ROAD = {
  width: 12,
  laneWidth: 4,
};

export const BLOCK = {
  size: 64,
  sidewalk: 4,
};

export const BUILDING = {
  minSize: 8,
  maxSize: 24,
  minHeight: 6,
  maxHeight: 30,
  gap: 2,
};

export const CAR_TYPES = {
  sedan: { name: 'Sedan', speed: 30, accel: 20, brake: 35, weight: 1, health: 100, colour: '#7ec8e3' },
  taxi: { name: 'Taxi', speed: 28, accel: 18, brake: 32, weight: 1.1, health: 100, colour: '#f5c842' },
  truck: { name: 'Truck', speed: 22, accel: 10, brake: 24, weight: 2.5, health: 200, colour: '#8b8b8b' },
  sports: { name: 'Sports', speed: 44, accel: 30, brake: 40, weight: 0.8, health: 80, colour: '#e74c3c' },
  police: { name: 'Cruiser', speed: 38, accel: 28, brake: 38, weight: 1.2, health: 150, colour: '#1a1a2e' },
  comet: { name: 'Comet', speed: 40, accel: 28, brake: 36, weight: 0.9, health: 90, colour: '#f39c12' },
  gold_comet: { name: 'Gold Comet', speed: 42, accel: 30, brake: 38, weight: 0.9, health: 100, colour: '#f1c40f' },
};

export const TRAFFIC = {
  maxCars: 25,
  spawnInterval: 2,
  maxParked: 30,
  minFollowDist: 12,
  stopDist: 8,
};

export const PEDESTRIAN = {
  maxPeds: 40,
  spawnInterval: 1.2,
  speed: 2,
  fleeSpeed: 7,
  chatDistance: 3,
  diveRange: 2,
  diveSpeed: 10,
};

export const COMBAT = {
  weaponSwitchDelay: 0.3,
  meleeRange: 1.5,
  meleeDamage: 15,
  meleeRate: 0.4,
};

export const WEAPONS = [
  { name: 'Fists', ammo: Infinity, damage: 15, range: 1.5, rate: 0.4, spread: 0, pellets: 1, reload: 0, clip: Infinity, colour: '#ffffff', tracerColour: '#ffffff' },
  { name: 'Pistol', ammo: 60, damage: 25, range: 100, rate: 0.35, spread: 0.03, pellets: 1, reload: 1.0, clip: 12, colour: '#cccccc', tracerColour: '#ffff00' },
  { name: 'SMG', ammo: 120, damage: 18, range: 80, rate: 0.08, spread: 0.08, pellets: 1, reload: 1.8, clip: 30, colour: '#888888', tracerColour: '#ffff88' },
  { name: 'Shotgun', ammo: 30, damage: 12, range: 50, rate: 0.7, spread: 0.18, pellets: 6, reload: 2.5, clip: 6, colour: '#8b4513', tracerColour: '#ffaa44' },
  { name: 'Rifle', ammo: 40, damage: 45, range: 150, rate: 0.15, spread: 0.01, pellets: 1, reload: 2.0, clip: 8, colour: '#2c3e50', tracerColour: '#ff4444' },
];

export const POLICE = {
  chaseSpeed: 38,
  ramForce: 15,
  shootRange: 60,
  shootRate: 0.5,
  shootDamage: 12,
  accuracy: 0.4,
  roadblockDist: 80,
  heliSpeed: 8,
  heliSpotlightRadius: 30,
  wantedDecayRate: 0.3,
  sightRange: 80,
  coneAngle: Math.PI / 3,
};

export const WANTED_RATES = {
  crimeMult: { shoot: 0.8, kill: 2, steal: 1.5, hitCar: 0.3, hitPed: 0.5 },
  levelThresholds: [0, 0.5, 1.5, 3, 5, 7],
  decayRate: 0.15,
  decayDelay: 3,
};

export const MISSIONS = {
  taxiBaseFare: 10,
  taxiPerUnit: 0.3,
  taxiTipMin: 5,
  raceLaps: 2,
  racePrize: 500,
  stuntBonus: 100,
};

export const RESPECT = {
  ranks: ['Drifter', 'Runner', 'Wheelman', 'Shotcaller', 'Cove King'],
  thresholds: [0, 200, 500, 1200, 2500],
};

export const DISTRICTS = [
  { name: 'Marina', x: 0, y: 0, w: 2, h: 2, colour: '#b8d4e3' },
  { name: 'Old Town', x: 2, y: 0, w: 2, h: 2, colour: '#e8d5b7' },
  { name: 'Beachfront', x: 4, y: 0, w: 2, h: 2, colour: '#f5deb3' },
  { name: 'Casino Row', x: 6, y: 0, w: 2, h: 2, colour: '#dda0dd' },
  { name: 'Docks', x: 0, y: 2, w: 2, h: 2, colour: '#b0c4de' },
  { name: 'Hills', x: 4, y: 2, w: 4, h: 1, colour: '#90ee90' },
];

export const COLOURS = {
  sky: '#1a1a3e',
  skyDusk: '#2d1b4e',
  horizonDusk: '#e8744a',
  water: '#1a6b8a',
  waterShallow: '#1e88ab',
  sand: '#f5deb3',
  sandShadow: '#d4c4a0',
  road: '#444444',
  roadLine: '#cccccc',
  sidewalk: '#b0b0b0',
  grass: '#4a7c3f',
  grassShadow: '#3d6935',
  buildingWall: '#f5ebe0',
  buildingRoof: '#d4a574',
  hudBg: 'rgba(0,0,0,0.7)',
  hudText: '#ffffff',
  hudAccent: '#f39c12',
  wantedStar: '#f5c842',
  wantedStarEmpty: '#555555',
  healthBar: '#2ecc71',
  healthBg: '#333333',
  armourBar: '#3498db',
  minimapBg: 'rgba(0,0,0,0.85)',
  dialogueBg: 'rgba(0,0,0,0.8)',
  marker: '#f39c12',
  markerPulse: '#e74c3c',
  tracer: '#ffff00',
  muzzleFlash: '#ffaa00',
  explosion: '#ff4400',
  smoke: '#888888',
  spark: '#ffdd44',
  neonPink: '#ff69b4',
  neonBlue: '#00bfff',
  neonGreen: '#39ff14',
  neonYellow: '#ffd700',
  policeLightbar: '#003399',
};

export const VEHICLE_DISPLAY = {
  sedan: 'Aurelia LX',
  taxi: 'PA Taxi',
  truck: 'Titan Hauler',
  sports: 'Vireo GT',
  police: 'PAPD Interceptor',
  comet: 'Cyclone',
  gold_comet: 'Cyclone GLD',
};

export const PAPD_CALLSIGNS = [
  'CORAL-7', 'BAY-12', 'MILE-21', 'PIER-3', 'REEF-9',
  'TIDE-15', 'SURF-22', 'DOCK-8', 'WAVE-4',
];

export const NEON_COLOURS = ['#ff69b4', '#00bfff', '#39ff14', '#ffd700', '#ff4500', '#9400d3'];

export const PLACES = {
  coralFin: { x: 10, z: 100, name: "Bea's Coral Fin", type: 'bar' },
  garage: { x: 120, z: 100, name: "Bea's Garage", type: 'garage' },
  ammuKiosk: { x: 200, z: 100, name: 'Ammu-Kiosk', type: 'shop' },
  casino: { x: 400, z: 60, name: 'Port Azura Casino', type: 'casino' },
  hospital: { x: 100, z: 200, name: 'Port Azura General', type: 'hospital' },
  policeStation: { x: 260, z: 60, name: 'PAPD Station', type: 'police' },
  ferryPier: { x: 20, z: 340, name: 'Ferry Pier', type: 'pier' },
};

export const SAVE_KEY = 'port-azura.save';

export const SCREEN = { TITLE: 0, PLAYING: 1, PAUSED: 2, BUSTED: 3, WASTED: 4, MISSION_COMPLETE: 5 };

export const FONT = 'monospace';

export const MESH = {
  carBodyH: 1.0,
  carWidth: 3.5,
  carLength: 7,
  wheelRadius: 0.75,
  cabinH: 0.75,
  pedHeadR: 0.35,
  pedTorso: { w: 0.8, h: 1.4, d: 0.5 },
  pedLeg: { w: 0.35, h: 1.2, d: 0.35 },
};