import { createRandom } from './random.js';
import { PLACES, ROAD, BLOCK, PEDESTRIAN, MESH, COLOURS, STEP, CAR_TYPES, RESPECT, VEHICLE_DISPLAY } from './config.js';

function findCasinoRowRoads(world3d) {
  const roads = [];
  for (let i = 0; i < world3d.roads.length; i++) {
    const road = world3d.roads[i];
    const isVert = Math.abs(Math.sin(road.angle)) > 0.7;
    if (isVert) {
      if (road.x > 320 && road.x < 520) roads.push(road);
    } else {
      if (road.z > 0 && road.z < 200) roads.push(road);
    }
  }
  return roads;
}

function getSidewalkPos(rng, roads) {
  const road = rng.pick(roads);
  const laneOffset = ROAD.width / 2 + BLOCK.sidewalk * 0.5 + rng.float(0.5, 1.5);
  const side = rng.bool() ? 1 : -1;
  if (Math.abs(Math.sin(road.angle)) > 0.7) {
    return {
      x: road.x + laneOffset * side,
      z: road.z + rng.float(0, road.length),
    };
  }
  return {
    x: road.x + rng.float(0, road.length),
    z: road.z + laneOffset * side,
  };
}

function adjustGoldenHourLighting(scene) {
  for (let i = 0; i < scene.children.length; i++) {
    const child = scene.children[i];
    if (child.isDirectionalLight) {
      child.position.set(-200, 15, 200);
      child.color.set(0xffaa55);
      child.intensity = 1.5;
    }
    if (child.isHemisphereLight) {
      child.color.set(0xffbb77);
      child.groundColor.set(0x443322);
      child.intensity = 0.5;
    }
    if (child.isAmbientLight) {
      child.color.set(0x553311);
      child.intensity = 0.4;
    }
  }
  if (scene.fog) {
    scene.fog.color.set(0xffcc88);
    scene.fog.density = 0.0001;
  }
}

function adjustDuskLighting(scene) {
  for (let i = 0; i < scene.children.length; i++) {
    const child = scene.children[i];
    if (child.isDirectionalLight) {
      child.position.set(300, 40, -200);
      child.color.set(0xff8844);
      child.intensity = 1.2;
    }
    if (child.isHemisphereLight) {
      child.color.set(0x664422);
      child.groundColor.set(0x221111);
      child.intensity = 0.4;
    }
    if (child.isAmbientLight) {
      child.color.set(0x331122);
      child.intensity = 0.5;
    }
  }
  if (scene.fog) {
    scene.fog.color.set(0x442233);
    scene.fog.density = 0.00015;
  }
}

function resetDuskLighting(scene) {
  for (let i = 0; i < scene.children.length; i++) {
    const child = scene.children[i];
    if (child.isDirectionalLight) {
      child.position.set(200, 120, -300);
      child.color.set(0xffcc88);
      child.intensity = 0.8;
    }
    if (child.isHemisphereLight) {
      child.color.set(0x886644);
      child.groundColor.set(0x443322);
      child.intensity = 0.6;
    }
    if (child.isAmbientLight) {
      child.color.set(0x221133);
      child.intensity = 0.3;
    }
  }
  if (scene.fog) {
    scene.fog.color.set(0x332244);
    scene.fog.density = 0.00008;
  }
}

function createFakeInput() {
  return {
    moveX: function() { return 0; },
    moveY: function() { return -1; },
    isSprint: function() { return false; },
    takeActions: function() { return 0; },
    consumeSwitch: function() { return -1; },
    mouse: function() { return { x: 0, y: 0, down: false, clicked: false }; },
    consumeClick: function() {},
  };
}

function simulateStep(dt, gameModules, fakeInput) {
  const { player, vehicles, pedestrians, police, combat, missions, world3d } = gameModules;
  const pos = player.getPlayerPosition();

  if (!player.player.inCar) {
    player.updatePlayer(dt, fakeInput, world3d.collisionBoxes, vehicles.trafficCars, []);
  }

  vehicles.updateTraffic(dt);

  if (player.player.inCar && vehicles.playerCar) {
    vehicles.updatePlayerCar(dt, fakeInput);
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
}

function renderHUD(hud, player, police, combat, missions, audio, gameModules, beaconX, beaconZ) {
  if (!hud || !hud.update) return;
  var p = player.getPlayerPosition();
  var wInfo = combat.getWeaponAmmo ? combat.getWeaponAmmo() : { clip: 0, total: 0 };
  var allWeapons = combat.getAllWeapons ? combat.getAllWeapons() : [];
  var trafficCars = (gameModules && gameModules.vehicles) ? (gameModules.vehicles.trafficCars || []) : [];
  var pedData = (gameModules && gameModules.pedestrians) ? (gameModules.pedestrians.getPeds ? gameModules.pedestrians.getPeds() : (gameModules.pedestrians.peds || [])) : [];
  var pCars = police ? (police.policeCars || []) : [];
  var roads = (gameModules && gameModules.world3d) ? (gameModules.world3d.roads || []) : [];
  var wantedLvl = police.getWantedLevel ? police.getWantedLevel() : 0;
  var dispatchData = (police.getDispatchData && wantedLvl >= 2) ? police.getDispatchData(p.x, p.z) : null;
  var jobData = missions.getJobCardData ? missions.getJobCardData() : null;
  var rawDialogue = missions.currentDialogue ? missions.currentDialogue() : '';

  var dialogueData = null;
  if (rawDialogue && rawDialogue.length > 0) {
    var colonIdx = rawDialogue.indexOf(':');
    var speaker = colonIdx > 0 ? rawDialogue.substring(0, colonIdx).trim() : '';
    var text = colonIdx > 0 ? rawDialogue.substring(colonIdx + 1).trim() : rawDialogue;
    dialogueData = { speaker: speaker, text: text };
  }

  var vehData = null;
  var veh = gameModules && gameModules.vehicles && gameModules.vehicles.playerCar;
  if (player.player.inCar && veh) {
    var vType = veh.type || 'sedan';
    var vName = VEHICLE_DISPLAY[vType] || vType;
    vehData = {
      name: vName,
      speed: Math.round(Math.abs(veh.speed) * 3.6),
      damagePct: (veh.health && veh.maxHealth) ? (veh.health / veh.maxHealth * 100) : 100,
    };
  }

  var radioData = null;
  if (audio && audio.getRadioName) {
    var rn = audio.getRadioName();
    if (rn && rn.length > 0) {
      radioData = { station: rn, track: 'Now Playing' };
    }
  }

  var xpVal = player.player.respect;
  var rankIdx = 0;
  for (var ri = RESPECT.thresholds.length - 1; ri >= 0; ri--) {
    if (xpVal >= RESPECT.thresholds[ri]) { rankIdx = ri; break; }
  }

  hud.update({
    cash: player.player.cash,
    respect: player.player.respect,
    rank: 'Drifter',
    health: player.player.health,
    maxHealth: 100,
    armour: player.player.armour,
    maxArmour: 100,
    weaponName: combat.getWeaponName ? combat.getWeaponName() : '',
    clip: wInfo.clip,
    totalAmmo: wInfo.total,
    wantedLevel: wantedLvl,
    objective: missions.currentObjective ? missions.currentObjective() : '',
    dialogue: dialogueData,
    radioStation: (audio && audio.getRadioName) ? audio.getRadioName() : '',
    playerX: p.x,
    playerZ: p.z,
    playerAngle: p.angle,
    cars: trafficCars,
    pedestrians: pedData,
    policeCars: pCars,
    worldRoads: roads,
    missionBeaconX: beaconX || 0,
    missionBeaconZ: beaconZ || 0,
    job: jobData,
    dispatchUnits: dispatchData ? dispatchData.units : [],
    heliDeployed: dispatchData ? dispatchData.helicopter : false,
    weapons: allWeapons,
    activeWeapon: combat.getCurrentWeapon ? combat.getCurrentWeapon() : 0,
    vehicle: vehData,
    radio: radioData,
    rankIndex: rankIdx,
  });
}

export async function stageShot(name, seed, gameModules, renderer, scene, camera) {
  const { world3d, player, vehicles, police, combat, missions, pedestrians, hud, audio, input } = gameModules;
  const rng = createRandom(seed);
  const fakeInput = createFakeInput();

  player.player.health = 100;
  player.player.armour = 0;
  player.player.cash = 500;
  player.player.respect = 0;
  player.player.inCar = false;
  player.player.car = null;
  player.player.mesh.visible = true;

  police.resetWanted();

  if (vehicles.playerCar) {
    vehicles.exitCar({ x: 0, z: 0 });
  }

  if (missions.activeMission) {
    missions.cleanupMission(missions.activeMission);
    missions.activeMission = null;
  }

  resetDuskLighting(scene);

  var numSteps = 180;
  var dt = STEP;
  var beaconX = 0, beaconZ = 0;

  if (name === 'cover') {
    numSteps = 180;

    player.setPlayerPosition(PLACES.casino.x, PLACES.casino.z, -Math.PI / 2);

    adjustDuskLighting(scene);

    const roads = findCasinoRowRoads(world3d);
    const nearbyRoads = roads.length > 0 ? roads : world3d.roads;

    for (let i = 0; i < 20; i++) {
      const road = rng.pick(nearbyRoads);
      const isVert = Math.abs(Math.sin(road.angle)) > 0.7;
      const angle = isVert ? Math.PI / 2 : 0;
      const laneOff = rng.float(-ROAD.laneWidth, ROAD.laneWidth);
      var cx, cz;
      if (isVert) {
        cx = road.x + laneOff;
        cz = road.z + rng.float(0, road.length);
      } else {
        cx = road.x + rng.float(0, road.length);
        cz = road.z + laneOff;
      }
      var types = ['sedan', 'sedan', 'sedan', 'taxi', 'truck', 'sports', 'comet'];
      var car = vehicles.createCar(rng.pick(types), cx, cz, angle, false);
      if (car) {
        car.speed = rng.float(car.aiSpeed * 0.3, car.aiSpeed * 0.7);
      }
    }

    for (let i = 0; i < 15; i++) {
      var pos = getSidewalkPos(rng, nearbyRoads);
      var ped = pedestrians.createPed(pos.x, pos.z, rng.angle());
      if (ped) pedestrians.peds.push(ped);
    }
  }

  if (name === 'chase') {
    numSteps = 5;

    var car = vehicles.createCar('sports', 200, 64, 0, false);
    if (car) {
      vehicles.enterCar(car, player.player.mesh);
      player.player.inCar = true;
      player.player.car = car;
      car.speed = 0;
      car.aiSpeed = 0;
    }

    police.addWanted(7);
  }

  if (name === 'mission') {
    numSteps = 180;

    // Player in front of Coral Fin, facing east down the street
    var missionPX = 0;
    var missionPZ = 64;
    var missionHeading = 0; // east (+x)
    player.setPlayerPosition(missionPX, missionPZ, missionHeading);
    combat.switchWeapon(2);

    var mission = missions.startMission(4);
    if (mission) {
      missions.showDialogue("Bea: Rio! The Cobras are hitting the Fin — hold the door!");
    }

    if (mission && mission.enemies) {
      var cosH = Math.cos(missionHeading);
      var sinH = Math.sin(missionHeading);

      // Enemies placed directly in front of player, 6-10 m ahead, in camera view
      var enemyDefs = [
        { forward: 7,  lateral: -2.5 },
        { forward: 8,  lateral: 1.5 },
        { forward: 10, lateral: -0.5 },
      ];

      for (var ei = 0; ei < mission.enemies.length; ei++) {
        var e = mission.enemies[ei];
        if (ei < 3) {
          var def = enemyDefs[ei];
          var ex = missionPX + cosH * def.forward + sinH * def.lateral;
          var ez = missionPZ + sinH * def.forward - cosH * def.lateral;
          e.x = ex;
          e.z = ez;
          e.health = 999; // survive sim
          if (e.mesh) {
            e.mesh.position.x = ex;
            e.mesh.position.z = ez;
          }
        } else {
          e.alive = false;
          if (e.mesh && e.mesh.parent) {
            scene.remove(e.mesh);
          }
        }
      }
    }
  }

  if (name === 'drive') {
    numSteps = 120;

    // Beachfront boulevard: horizontal road at z=320, car heading east (+x)
    var driveRoadZ = 320;
    var driveCarX = 120;
    var driveHeading = 0;

    var sedan = vehicles.createCar('sedan', driveCarX, driveRoadZ, driveHeading, false);
    if (sedan) {
      vehicles.enterCar(sedan, player.player.mesh);
      player.player.inCar = true;
      player.player.car = sedan;
      sedan.speed = 22;
      sedan.aiSpeed = 27;
    }

    // Traffic cars directly on the road at z=320, staggered ahead for depth
    var traffic1 = vehicles.createCar('taxi', driveCarX + 14, driveRoadZ, driveHeading, false);
    if (traffic1) { traffic1.speed = 14; traffic1.aiSpeed = 20; }

    var traffic2 = vehicles.createCar('comet', driveCarX + 28, driveRoadZ, driveHeading, false);
    if (traffic2) { traffic2.speed = 16; traffic2.aiSpeed = 22; }

    var traffic3 = vehicles.createCar('sports', driveCarX + 42, driveRoadZ, driveHeading, false);
    if (traffic3) { traffic3.speed = 12; traffic3.aiSpeed = 18; }

    // Oncoming truck on the opposite lane (z=308, ~12m south)
    var oncoming = vehicles.createCar('truck', driveCarX + 30, driveRoadZ - 12, driveHeading + Math.PI, false);
    if (oncoming) { oncoming.speed = 8; oncoming.aiSpeed = 14; }

    // Palm trees lining the boulevard — avoid top-right corner intrusion
    var palmPositions = [
      { x: 85, z: 326 }, { x: 95, z: 326 }, { x: 105, z: 326 },
      { x: 140, z: 326 }, { x: 155, z: 326 },
      { x: 88, z: 314 }, { x: 100, z: 314 },
      // Removed (145, 314) which intrudes top-right corner
    ];
    for (var pi = 0; pi < palmPositions.length; pi++) {
      var pp = palmPositions[pi];
      var trunkGeo = new THREE.CylinderGeometry(0.15, 0.25, 4.5, 6);
      var trunk = new THREE.Mesh(trunkGeo, new THREE.MeshPhongMaterial({ color: 0x8b6914 }));
      trunk.position.set(pp.x, 2.25, pp.z);
      trunk.castShadow = true;
      scene.add(trunk);
      var crownGeo = new THREE.CylinderGeometry(0.1, 1.8, 2.5, 8);
      var crown = new THREE.Mesh(crownGeo, new THREE.MeshPhongMaterial({ color: 0x3a7a28 }));
      crown.position.set(pp.x, 5.8, pp.z);
      crown.castShadow = true;
      scene.add(crown);
      for (var fi = 0; fi < 5; fi++) {
        var frondAngle = (fi / 5) * Math.PI * 2 + rng.float(-0.3, 0.3);
        var frondLen = 2 + rng.float(0, 1.5);
        var frondGeo = new THREE.ConeGeometry(0.25, frondLen, 4);
        var frond = new THREE.Mesh(frondGeo, new THREE.MeshPhongMaterial({ color: rng.bool() ? 0x2d5a1e : 0x3a7a28 }));
        frond.position.set(pp.x + Math.cos(frondAngle) * 1.0, 6.5, pp.z + Math.sin(frondAngle) * 1.0);
        frond.rotation.z = (Math.PI / 2) + rng.float(-0.3, 0.3);
        frond.rotation.y = frondAngle;
        scene.add(frond);
      }
    }

    police.resetWanted();

    if (missions.activeMission) {
      missions.cleanupMission(missions.activeMission);
      missions.activeMission = null;
    }

    // Beacon 80m down the road
    beaconX = driveCarX + 80;
    beaconZ = driveRoadZ;
    missions.setBeacon(beaconX, beaconZ);
    missions.showDialogue('Cruise the Beachfront Boulevard');

    if (audio) {
      try {
        if (audio.toggleRadio) audio.toggleRadio();
        if (audio.cycleRadioStation) {
          var radioAttempts = 0;
          while ((audio.getRadioName ? audio.getRadioName() : '') !== 'Coast FM' && radioAttempts < 20) {
            audio.cycleRadioStation();
            radioAttempts++;
          }
        }
      } catch(_) {}
    }

    adjustGoldenHourLighting(scene);
  }

  // Run simulation
  for (let i = 0; i < numSteps; i++) {
    if (name === 'mission' && i % 30 === 0) {
      var missionRef = missions.activeMission;
      var nearest = null;
      var nearestDist = Infinity;
      if (missionRef && missionRef.enemies) {
        for (let j = 0; j < missionRef.enemies.length; j++) {
          var en = missionRef.enemies[j];
          if (!en.alive) continue;
          var dx = en.x - player.player.x;
          var dz = en.z - player.player.z;
          var d = Math.sqrt(dx * dx + dz * dz);
          if (d < nearestDist) {
            nearestDist = d;
            nearest = en;
          }
        }
      }

      if (nearest) {
        var aimAngle = Math.atan2(nearest.z - player.player.z, nearest.x - player.player.x);
        player.player.angle = aimAngle;
        combat.fire(player.player.x, 0.5, player.player.z, aimAngle, 0, rng);

        if (nearestDist < 30) {
          nearest.health -= 18;
          if (nearest.health <= 0) {
            nearest.alive = false;
          }
        }
      }
    }

    simulateStep(dt, gameModules, fakeInput);
  }

// --- POST-SIMULATION: cinematic chase standoff ---
  if (name === 'chase' && vehicles.playerCar) {
    var pc = vehicles.playerCar;

    // Lock player car at standoff position on horizontal road z=64, heading east
    pc.x = 200;
    pc.z = 64;
    pc.angle = 0;
    pc.mesh.position.x = 200;
    pc.mesh.position.z = 64;
    pc.mesh.rotation.y = 0;
    pc.speed = 0;
    pc.aiSpeed = 0;
    player.player.x = 200;
    player.player.z = 64;
    player.player.angle = 0;

    // Remove excess police cars — keep 3 for dispatch panel
    for (var rci = police.policeCars.length - 1; rci >= 3; rci--) {
      var pcc = police.policeCars[rci];
      if (pcc) {
        pcc.alive = false;
        var ti2 = vehicles.trafficCars.indexOf(pcc);
        if (ti2 >= 0) vehicles.trafficCars.splice(ti2, 1);
        var pi2 = vehicles.parkedCars.indexOf(pcc);
        if (pi2 >= 0) vehicles.parkedCars.splice(pi2, 1);
        if (pcc.mesh && pcc.mesh.parent) scene.remove(pcc.mesh);
      }
    }
    if (police.policeCars.length > 3) police.policeCars.length = 3;

    // Position the visible pursuit cruiser ~13 m north, facing us
    var cruiserX = 195;
    var cruiserZ = 52;
    var cruiserHeading = Math.PI;
    if (police.policeCars.length > 0) {
      var cr = police.policeCars[0];
      cr.x = cruiserX;
      cr.z = cruiserZ;
      cr.angle = cruiserHeading;
      cr.mesh.position.x = cruiserX;
      cr.mesh.position.z = cruiserZ;
      cr.mesh.rotation.y = cruiserHeading;
      cr.speed = 0;
      cr.aiSpeed = 0;
      cr.sirenOn = true;
      cr.isPursuitCar = true;
      if (cr.lightbarMeshes) {
        for (var lb = 0; lb < cr.lightbarMeshes.length; lb++) {
          if (cr.lightbarMeshes[lb]) cr.lightbarMeshes[lb].visible = true;
        }
      }
    }

    // Position remaining 2 police cars at distance (for dispatch panel entries)
    if (police.policeCars.length > 1) {
      police.policeCars[1].x = 160;
      police.policeCars[1].z = 68;
      police.policeCars[1].mesh.position.x = 160;
      police.policeCars[1].mesh.position.z = 68;
    }
    if (police.policeCars.length > 2) {
      police.policeCars[2].x = 240;
      police.policeCars[2].z = 58;
      police.policeCars[2].mesh.position.x = 240;
      police.policeCars[2].mesh.position.z = 58;
    }

    // Position AIR-7 helicopter inside camera frame (upper portion, readable shape)
    if (police.helicopter && police.helicopter.mesh) {
      var hm = police.helicopter.mesh;
      hm.position.set(185, 13, 80);
      hm.rotation.y = -0.35;
    }

    // Force wanted to 5 stars, heat to 7
    police.wantedHeat = 7;
    police.wantedLevel = 5;

    // Show radio dispatch line
    if (missions && missions.showDialogue) {
      missions.showDialogue('PAPD dispatch: all units respond, 5-star felony pursuit');
    }

    if (audio && audio.playSiren) {
      try { audio.playSiren(true); } catch (_) {}
    }
  }

  // Camera and render
  if (name === 'cover') {
    camera.position.set(PLACES.casino.x + 40, 9, PLACES.casino.z + 45);
    camera.lookAt(PLACES.casino.x, 4, PLACES.casino.z - 10);

    var titleEl = document.getElementById('title-screen');
    if (titleEl) titleEl.style.display = 'flex';
    var hudEl = document.getElementById('hud');
    if (hudEl) hudEl.style.display = 'none';
  }

  if (name === 'chase') {
    // External cinematic camera: front-quarter side, ~14 m away, 4.5 m high
    var camX = 212;
    var camY = 4.5;
    var camZ = 72;
    camera.position.set(camX, camY, camZ);
    camera.lookAt(197, 1.5, 62);

    renderHUD(hud, player, police, combat, missions, audio, gameModules, 0, 0);
  }

  if (name === 'mission') {
    player.player.angle = missionHeading;
    var ppx = player.player.x;
    var ppz = player.player.z;
    var pa = player.player.angle;
    var cosPA = Math.cos(pa);
    var sinPA = Math.sin(pa);
    // Pull camera back and up to clearly frame player + enemies ahead
    var behindX = ppx - cosPA * 6;
    var behindZ = ppz - sinPA * 6;
    camera.position.set(behindX, 3.1, behindZ);
    var lookX = ppx + cosPA * 10;
    var lookZ = ppz + sinPA * 10;
    camera.lookAt(lookX, 1.4, lookZ);

    missions.showDialogue("Bea: Rio! The Cobras are hitting the Fin — hold the door!");
    renderHUD(hud, player, police, combat, missions, audio, gameModules, 0, 0);
  }

  if (name === 'drive') {
    if (vehicles.playerCar) {
      var dcar = vehicles.playerCar;
      var dca = dcar.angle;
      var dbehindX = dcar.x - Math.cos(dca) * 10;
      var dbehindZ = dcar.z - Math.sin(dca) * 10;
      camera.position.set(dbehindX, 4.0, dbehindZ);
      camera.lookAt(dcar.x + Math.cos(dca) * 20, 1.8, dcar.z + Math.sin(dca) * 20);
    }

    renderHUD(hud, player, police, combat, missions, audio, gameModules, beaconX, beaconZ);
  }

  renderer.render(scene, camera);
  window.__shotReady = 'ready';

  return 'ready';
}