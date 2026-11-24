import { VIEW_W, VIEW_H, STEP, MAX_FRAME, SCREEN, SAVE_KEY, PLAYER, CAMERA, WORLD_W, WORLD_H, CAR_TYPES, WEAPONS, MISSIONS, RESPECT, PLACES } from './config.js';
import { createRandom } from './random.js';
import { createInput } from './input.js';
import { createWorld3D } from './world3d.js';
import { createVehicles } from './vehicles3d.js';
import { createPlayer } from './player3d.js';
import { createPedestrians } from './pedestrians3d.js';
import { createPolice } from './police3d.js';
import { createCombat } from './combat3d.js';
import { createMissions } from './missions.js';
import { createHUD } from './hud.js';
import { stageShot } from './shots.js';

const params = new URLSearchParams(location.search);
const shotName = params.get('shot');
const seed = parseInt(params.get('seed')) || 1;

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setSize(VIEW_W, VIEW_H);
renderer.setPixelRatio(1);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.outputEncoding = THREE.sRGBEncoding;
document.body.prepend(renderer.domElement);
renderer.domElement.style.display = 'block';
renderer.domElement.style.position = 'absolute';
renderer.domElement.style.top = '0';
renderer.domElement.style.left = '0';
renderer.domElement.style.zIndex = '0';

const camera = new THREE.PerspectiveCamera(55, VIEW_W / VIEW_H, 0.5, 2000);
camera.position.set(0, 20, 50);
camera.lookAt(0, 0, 0);

const random = createRandom(seed);

const world3d = createWorld3D(random);
const scene = world3d.scene;

window._gameAudio = {
  startEngine: function() {},
  stopEngine: function() {},
  setEngineRPM: function(rpm) {},
  setEngineVol: function(vol) {},
  playExplosion: function() {},
  playGunshot: function(w) {},
  playPickup: function() {},
  playUIClick: function() {},
  playSiren: function(on) {},
  toggleRadio: function() {},
  cycleRadioStation: function() {},
  updateRadio: function(dt) {},
  getRadioName: function() { return ''; },
  resumeAudio: function() {},
};

const audio = window._gameAudio;

import('./audio.js').then(function(m) {
  window._gameAudio.resumeAudio = m.resumeAudio || (function() {});
  window._gameAudio.playGunshot = m.playGunshot || (function() {});
  window._gameAudio.playExplosion = m.playExplosion || (function() {});
  window._gameAudio.playPickup = m.playPickup || (function() {});
  window._gameAudio.playUIClick = m.playUIClick || (function() {});
  window._gameAudio.playSiren = m.playSiren || (function() {});
  window._gameAudio.toggleRadio = m.toggleRadio || (function() {});
  window._gameAudio.cycleRadioStation = m.cycleRadioStation || (function() {});
  window._gameAudio.updateRadio = m.updateRadio || (function() {});
  window._gameAudio.getRadioName = m.getRadioName || (function() { return ''; });
  window._gameAudio.startEngine = m.startEngine || (function() {});
  window._gameAudio.stopEngine = m.stopEngine || (function() {});
  window._gameAudio.setEngineRPM = m.setEngineRPM || (function() {});
  window._gameAudio.setEngineVol = m.setEngineVol || (function() {});
  window._gameAudio.resumeAudio();
}).catch(function() {});

const vehicles = createVehicles(world3d, random, audio);
const player = createPlayer(world3d);
const pedestrians = createPedestrians(world3d, random);
const combat = createCombat(world3d);
const police = createPolice(world3d, vehicles, random, audio);
const missions = createMissions(world3d, player, vehicles, police, combat, audio);
const hud = createHUD(player, police, combat, missions, vehicles);

const canvas = renderer.domElement;
const input = createInput(canvas);

var playUIClick = function() {
  if (window._gameAudio.playUIClick) window._gameAudio.playUIClick();
};

var screen = SCREEN.TITLE;
var accumulator = 0;
var lastTime = 0;
var gameTime = 0;

var camTargetX = 0, camTargetZ = 0, camTargetAngle = 0;
var camCurrentX = 0, camCurrentZ = 0, camCurrentY = 20, camCurrentAngle = 0;

function updateCamera(dt) {
  var p = player.getPlayerPosition();
  var inCar = player.player.inCar;

  var targetX = p.x, targetZ = p.z, targetAngle = p.angle;

  if (inCar && vehicles.playerCar) {
    targetX = vehicles.playerCar.x;
    targetZ = vehicles.playerCar.z;
    targetAngle = vehicles.playerCar.angle;
  }

  camTargetX = targetX;
  camTargetZ = targetZ;
  camTargetAngle = targetAngle;

  var lerp = 1 - Math.exp(-CAMERA.lerp * dt);
  camCurrentX += (camTargetX - camCurrentX) * lerp;
  camCurrentZ += (camTargetZ - camCurrentZ) * lerp;

  var angleDiff = camTargetAngle - camCurrentAngle;
  while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
  while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
  camCurrentAngle += angleDiff * lerp;

  var dist = inCar ? CAMERA.distance * 1.5 : CAMERA.distance;
  var height = inCar ? CAMERA.height + 3 : CAMERA.height;

  var lookX = camCurrentX - Math.sin(camCurrentAngle) * dist;
  var lookZ = camCurrentZ - Math.cos(camCurrentAngle) * dist;
  var lookY = height;

  camera.position.set(lookX, lookY, lookZ);
  camera.lookAt(camCurrentX, 1.5, camCurrentZ);
}

function handleInputs() {
  var actions = input.takeActions();

  if (actions & 2) {
    if (screen === SCREEN.PLAYING) { screen = SCREEN.PAUSED; playUIClick(); }
    else if (screen === SCREEN.PAUSED) { screen = SCREEN.PLAYING; playUIClick(); }
  }

  if (screen === SCREEN.TITLE) {
    if (actions & 1) {
      startNewGame();
    }
  }

  if (screen === SCREEN.PLAYING) {
    if (actions & 4) {
      if (player.player.inCar) {
        if (vehicles.playerCar) {
          var exitPos = vehicles.exitCar({ x: vehicles.playerCar.x + 3, z: vehicles.playerCar.z + 3 });
          player.player.inCar = false;
          player.player.car = null;
          if (exitPos) {
            player.setPlayerPosition(exitPos.x, exitPos.z, player.player.angle);
          }
        }
      } else {
        for (var i = 0; i < vehicles.trafficCars.length; i++) {
          var car = vehicles.trafficCars[i];
          if (car.alive && !car.parked) {
            var dx = car.x - player.player.x;
            var dz = car.z - player.player.z;
            if (Math.sqrt(dx * dx + dz * dz) < 4) {
              vehicles.enterCar(car, player.player.mesh);
              player.player.inCar = true;
              player.player.car = car;
              break;
            }
          }
        }
        if (!player.player.inCar) {
          for (var j = 0; j < vehicles.parkedCars.length; j++) {
            var pCar = vehicles.parkedCars[j];
            if (pCar.alive) {
              var pdx = pCar.x - player.player.x;
              var pdz = pCar.z - player.player.z;
              if (Math.sqrt(pdx * pdx + pdz * pdz) < 4) {
                vehicles.enterCar(pCar, player.player.mesh);
                player.player.inCar = true;
                player.player.car = pCar;
                pCar.parked = false;
                vehicles.trafficCars.push(pCar);
                // Remove from parked
                var pi = vehicles.parkedCars.indexOf(pCar);
                if (pi >= 0) vehicles.parkedCars.splice(pi, 1);
                break;
              }
            }
          }
        }
      }
    }

    if (actions & 8) {
      combat.reload();
    }

    var swapIdx = input.consumeSwitch();
    if (swapIdx >= 0) {
      combat.switchWeapon(swapIdx);
    }
  }
}

function startNewGame() {
  player.player.health = PLAYER.maxHealth;
  player.player.armour = 0;
  player.player.cash = 500;
  player.player.respect = 0;
  player.player.wantedLevel = 0;
  player.player.wantedHeat = 0;
  player.player.inCar = false;
  player.player.car = null;
  player.player.mesh.visible = true;
  player.setPlayerPosition(PLACES.coralFin.x, PLACES.coralFin.z, 0);
  police.resetWanted();
  combat.switchWeapon(1);
  screen = SCREEN.PLAYING;
  playUIClick();
}

function saveGame() {
  try {
    var data = {
      health: player.player.health,
      armour: player.player.armour,
      cash: player.player.cash,
      respect: player.player.respect,
      x: player.player.x,
      z: player.player.z,
      angle: player.player.angle,
      weaponIdx: combat.getCurrentWeapon(),
      wantedLevel: police.getWantedLevel(),
      missionsComplete: missions.missions ? missions.missions.filter(function(m) { return m.complete; }).map(function(m) { return m.id; }) : [],
      currentMission: missions.activeMission ? missions.activeMission.id : null,
      missionStep: missions.activeMission ? missions.activeMission.step : 0,
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch(e) {}
}

function loadGame() {
  try {
    var raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    var data = JSON.parse(raw);
    player.player.health = data.health || PLAYER.maxHealth;
    player.player.armour = data.armour || 0;
    player.player.cash = data.cash || 500;
    player.player.respect = data.respect || 0;
    player.setPlayerPosition(data.x || 0, data.z || 0, data.angle || 0);
    if (data.weaponIdx !== undefined) combat.switchWeapon(data.weaponIdx);
    return true;
  } catch(e) { return false; }
}

function resetGameState() {
  player.player.health = PLAYER.maxHealth;
  player.player.armour = 0;
  player.player.inCar = false;
  player.player.car = null;
  player.player.mesh.visible = true;
  player.player.cash = 500;
  player.player.respect = 0;
  player.player.wantedLevel = 0;
  player.player.wantedHeat = 0;
  player.setPlayerPosition(PLACES.coralFin.x, PLACES.coralFin.z, 0);
  police.resetWanted();
  combat.switchWeapon(1);
  if (missions.activeMission) {
    missions.cleanupMission(missions.activeMission);
    missions.activeMission = null;
  }
}

function step(dt) {
  handleInputs();

  var pos = player.getPlayerPosition();

  if (!player.player.inCar) {
    player.updatePlayer(dt, input, world3d.collisionBoxes, vehicles.trafficCars, []);
  }

  vehicles.updateTraffic(dt);
  if (player.player.inCar && vehicles.playerCar) {
    vehicles.updatePlayerCar(dt, input);
    player.player.x = vehicles.playerCar.x;
    player.player.z = vehicles.playerCar.z;
    player.player.angle = vehicles.playerCar.angle;
  }

  pedestrians.updateAll(dt, player.player.x, player.player.z, false, vehicles.trafficCars);

  police.updatePolice(dt, player.player.x, player.player.z, player.player.inCar, combat);
  police.updateWanted(dt, { x: player.player.x, z: player.player.z }, false);

  combat.update(dt);

  missions.updateMissions(dt);
  missions.updateDialogue(dt);

  if (player.player.health <= 0) {
    screen = SCREEN.WASTED;
  }

  gameTime += dt;
}

function gameLoop(timestamp) {
  requestAnimationFrame(gameLoop);

  if (!lastTime) lastTime = timestamp;
  var dt = (timestamp - lastTime) / 1000;
  if (dt > MAX_FRAME) dt = MAX_FRAME;
  if (dt <= 0) dt = STEP;
  lastTime = timestamp;

  if (screen === SCREEN.PLAYING) {
    accumulator += dt;
    while (accumulator >= STEP) {
      step(STEP);
      accumulator -= STEP;
    }
  }

  updateCamera(dt * (screen === SCREEN.PLAYING ? 1 : 0.1));

  audio.updateRadio(dt);

  renderer.render(scene, camera);

  if (hud && hud.update && screen !== SCREEN.TITLE) {
    var p = player.getPlayerPosition();
    var wInfo = combat.getWeaponAmmo ? combat.getWeaponAmmo() : { clip: 0, total: 0 };
    hud.update({
      cash: player.player.cash,
      respect: player.player.respect,
      rank: RESPECT.ranks[0],
      health: player.player.health,
      maxHealth: PLAYER.maxHealth,
      armour: player.player.armour,
      maxArmour: PLAYER.maxArmour,
      weaponName: combat.getWeaponName ? combat.getWeaponName() : '',
      clip: wInfo.clip,
      totalAmmo: wInfo.total,
      wantedLevel: police.getWantedLevel ? police.getWantedLevel() : 0,
      objective: missions.currentObjective ? missions.currentObjective() : '',
      dialogue: missions.currentDialogue ? missions.currentDialogue() : '',
      radioStation: audio.getRadioName ? audio.getRadioName() : '',
      playerX: p.x,
      playerZ: p.z,
      playerAngle: p.angle,
      cars: vehicles.trafficCars || [],
      pedestrians: pedestrians.getPeds ? pedestrians.getPeds() : [],
      policeCars: police.policeCars || [],
      worldRoads: world3d.roads || [],
      missionBeaconX: 0,
      missionBeaconZ: 0,
    });
  }
}

if (shotName) {
  resetGameState();

  var existingPedCount = pedestrians.peds.length;
  for (var pi = existingPedCount - 1; pi >= 0; pi--) {
    var ped = pedestrians.peds[pi];
    if (ped.mesh && ped.mesh.parent) {
      world3d.scene.remove(ped.mesh);
      ped.mesh.traverse(function(child) {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) {
            for (var k = 0; k < child.material.length; k++) child.material[k].dispose();
          } else {
            child.material.dispose();
          }
        }
      });
    }
  }
  pedestrians.peds.length = 0;

  var trafficLen = vehicles.trafficCars.length;
  for (var ti = trafficLen - 1; ti >= 0; ti--) {
    var tCar = vehicles.trafficCars[ti];
    if (tCar.mesh && tCar.mesh.parent) {
      world3d.scene.remove(tCar.mesh);
      tCar.mesh.traverse(function(child) {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) {
            for (var k = 0; k < child.material.length; k++) child.material[k].dispose();
          } else {
            child.material.dispose();
          }
        }
      });
    }
  }
  vehicles.trafficCars.length = 0;

  var parkedLen = vehicles.parkedCars.length;
  for (var pj = parkedLen - 1; pj >= 0; pj--) {
    var pCar = vehicles.parkedCars[pj];
    if (pCar.mesh && pCar.mesh.parent) {
      world3d.scene.remove(pCar.mesh);
      pCar.mesh.traverse(function(child) {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) {
            for (var k = 0; k < child.material.length; k++) child.material[k].dispose();
          } else {
            child.material.dispose();
          }
        }
      });
    }
  }
  vehicles.parkedCars.length = 0;

  var gameModules = {
    world3d: world3d,
    player: player,
    vehicles: vehicles,
    police: police,
    combat: combat,
    missions: missions,
    pedestrians: pedestrians,
    hud: hud,
    audio: window._gameAudio,
    input: input,
  };

  stageShot(shotName, seed, gameModules, renderer, scene, camera).then(function() {
    console.log('Shot ready:', shotName);
  });
} else {
  lastTime = performance.now();
  requestAnimationFrame(gameLoop);

  setInterval(saveGame, 30000);
}

window.addEventListener('blur', function() {
  if (screen === SCREEN.PLAYING) screen = SCREEN.PAUSED;
});

if (!shotName) {
  var titleEl = document.getElementById('title-screen');
  if (titleEl) titleEl.style.display = 'flex';

  var btnNew = document.getElementById('btn-new-game');
  var btnContinue = document.getElementById('btn-continue');

  if (btnNew) {
    btnNew.addEventListener('click', function() {
      var ts = document.getElementById('title-screen');
      if (ts) ts.style.display = 'none';
      resetGameState();
      startNewGame();
      activatePlaying();
    });
  }

  if (btnContinue) {
    btnContinue.addEventListener('click', function() {
      var ts = document.getElementById('title-screen');
      if (ts) ts.style.display = 'none';
      if (loadGame()) {
        screen = SCREEN.PLAYING;
        playUIClick();
      } else {
        resetGameState();
        startNewGame();
      }
      activatePlaying();
    });
  }
}

function activatePlaying() {
  screen = SCREEN.PLAYING;
  if (!lastTime) {
    lastTime = performance.now();
    requestAnimationFrame(gameLoop);
  }
}