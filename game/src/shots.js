import { createRandom } from './random.js';
import { PLACES, ROAD, BLOCK, PEDESTRIAN, MESH, COLOURS, STEP, CAR_TYPES } from './config.js';

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
  var trafficCars = (gameModules && gameModules.vehicles) ? (gameModules.vehicles.trafficCars || []) : [];
  var pedData = (gameModules && gameModules.pedestrians) ? (gameModules.pedestrians.getPeds ? gameModules.pedestrians.getPeds() : (gameModules.pedestrians.peds || [])) : [];
  var pCars = police ? (police.policeCars || []) : [];
  var roads = (gameModules && gameModules.world3d) ? (gameModules.world3d.roads || []) : [];

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
    wantedLevel: police.getWantedLevel ? police.getWantedLevel() : 0,
    objective: missions.currentObjective ? missions.currentObjective() : '',
    dialogue: missions.currentDialogue ? missions.currentDialogue() : '',
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
    numSteps = 120;

    var car = vehicles.createCar('sports', 300, 200, Math.PI / 4, false);
    if (car) {
      vehicles.enterCar(car, player.player.mesh);
      player.player.inCar = true;
      player.player.car = car;
      car.speed = 25;
      car.aiSpeed = 30;
    }

    police.addWanted(10);
    police.dispatchPolice(player.player.x, player.player.z);

    for (let i = 0; i < 3; i++) {
      var behindDist = 20 + i * 20;
      var bx = 300 - Math.cos(Math.PI / 4) * behindDist;
      var bz = 200 - Math.sin(Math.PI / 4) * behindDist;
      var cruiser = vehicles.createCar('police', bx, bz, Math.PI / 4, false);
      if (cruiser) {
        cruiser.isPursuitCar = true;
        cruiser.sirenOn = true;
        cruiser.aiSpeed = 38;
        cruiser.speed = 25;
        police.policeCars.push(cruiser);
      }
    }

    police.dispatchPolice(player.player.x, player.player.z);

    if (audio) {
      try { if (audio.cycleRadioStation) {
        var radioAttempts = 0;
        while ((audio.getRadioName ? audio.getRadioName() : '') !== 'Neon Nights' && radioAttempts < 20) {
          audio.cycleRadioStation();
          radioAttempts++;
        }
      }} catch(_) {}
    }
  }

  if (name === 'mission') {
    numSteps = 180;

    player.setPlayerPosition(PLACES.coralFin.x, PLACES.coralFin.z, 0);
    combat.switchWeapon(2);

    var mission = missions.startMission(4);
    if (mission) {
      missions.showDialogue("Bea: They're coming for the bar, Rio! Hold them off!");
    }

    if (mission && mission.enemies) {
      var enemyPositions = [
        { x: PLACES.coralFin.x + 10,  z: PLACES.coralFin.z },
        { x: PLACES.coralFin.x + 12,  z: PLACES.coralFin.z + 6 },
        { x: PLACES.coralFin.x + 8,   z: PLACES.coralFin.z - 6 },
        { x: PLACES.coralFin.x + 15,  z: PLACES.coralFin.z + 3 },
        { x: PLACES.coralFin.x + 14,  z: PLACES.coralFin.z - 3 },
        { x: PLACES.coralFin.x + 7,   z: PLACES.coralFin.z - 2 },
      ];
      for (let i = 0; i < mission.enemies.length; i++) {
        var e = mission.enemies[i];
        var ep = enemyPositions[i] || enemyPositions[0];
        e.x = ep.x;
        e.z = ep.z;
        if (e.mesh) {
          e.mesh.position.x = ep.x;
          e.mesh.position.z = ep.z;
        }
      }
    }
  }

  if (name === 'drive') {
    numSteps = 120;

    var sedan = vehicles.createCar('sedan', 380, 64, 0, false);
    if (sedan) {
      vehicles.enterCar(sedan, player.player.mesh);
      player.player.inCar = true;
      player.player.car = sedan;
      sedan.speed = 20;
      sedan.aiSpeed = 25;
    }

    const roads = findCasinoRowRoads(world3d);
    const nearbyRoads = roads.length > 0 ? roads : world3d.roads;

    for (let i = 0; i < 18; i++) {
      var road = rng.pick(nearbyRoads);
      var isVert = Math.abs(Math.sin(road.angle)) > 0.7;
      var angle = isVert ? Math.PI / 2 : 0;
      var laneOff = rng.float(-ROAD.laneWidth, ROAD.laneWidth);
      var cx, cz;
      if (isVert) {
        cx = road.x + laneOff;
        cz = road.z + rng.float(0, road.length);
      } else {
        cx = road.x + rng.float(0, road.length);
        cz = road.z + laneOff;
      }
      var types = ['sedan', 'sedan', 'taxi', 'sports', 'comet', 'truck'];
      var tcar = vehicles.createCar(rng.pick(types), cx, cz, angle, false);
      if (tcar) {
        tcar.speed = rng.float(8, 20);
      }
    }

    for (let i = 0; i < 10; i++) {
      var pos = getSidewalkPos(rng, nearbyRoads);
      var ped = pedestrians.createPed(pos.x, pos.z, rng.angle());
      if (ped) pedestrians.peds.push(ped);
    }

    police.resetWanted();

    if (missions.activeMission) {
      missions.cleanupMission(missions.activeMission);
      missions.activeMission = null;
    }
    missions.setBeacon(PLACES.casino.x, PLACES.casino.z);
    beaconX = PLACES.casino.x;
    beaconZ = PLACES.casino.z;
    missions.showDialogue('Go to the Port Azura Casino');

    if (audio) {
      try { if (audio.cycleRadioStation) {
        var radioAttempts = 0;
        while ((audio.getRadioName ? audio.getRadioName() : '') !== 'Coast FM' && radioAttempts < 20) {
          audio.cycleRadioStation();
          radioAttempts++;
        }
      }} catch(_) {}
    }
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

    if (name === 'chase' && i % 20 === 0 && vehicles.playerCar) {
      police.dispatchPolice(player.player.x, player.player.z);
    }
  }

// --- POST-SIMULATION: lock chase elements at fixed offsets ---
  if (name === 'chase' && vehicles.playerCar) {
    var pc = vehicles.playerCar;
    var ca = pc.angle;
    var pcx = pc.x;
    var pcz = pc.z;
    var cosA = Math.cos(ca);
    var sinA = Math.sin(ca);

    // Remove existing police cars
    for (var rci = police.policeCars.length - 1; rci >= 0; rci--) {
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
    police.policeCars.length = 0;

    // Remove officers
    if (police.officers) {
      for (var oi = police.officers.length - 1; oi >= 0; oi--) {
        var off = police.officers[oi];
        if (off && off.mesh && off.mesh.parent) scene.remove(off.mesh);
      }
      police.officers.length = 0;
    }

    // Place 3 cruisers at fixed offsets behind and beside player car
    var cruiserOffsets = [
      { behind: 8, lateral: 0 },
      { behind: 6, lateral: 3 },
      { behind: 10, lateral: -3 },
    ];
    for (var ci = 0; ci < 3; ci++) {
      var off = cruiserOffsets[ci];
      var cx = pcx - cosA * off.behind + sinA * off.lateral;
      var cz = pcz - sinA * off.behind - cosA * off.lateral;
      var cr = vehicles.createCar('police', cx, cz, ca, false);
      if (cr) {
        cr.isPursuitCar = true;
        cr.sirenOn = true;
        cr.speed = 25;
        cr.aiSpeed = 35;
        cr.x = cx;
        cr.z = cz;
        cr.angle = ca;
        cr.mesh.position.x = cx;
        cr.mesh.position.z = cz;
        cr.mesh.rotation.y = ca;
        if (cr.lightbarMeshes) {
          for (var lb = 0; lb < cr.lightbarMeshes.length; lb++) {
            if (cr.lightbarMeshes[lb]) cr.lightbarMeshes[lb].visible = true;
          }
        }
        police.policeCars.push(cr);
      }
    }

    // Roadblock ~25m ahead: 3 police cars parked across the road
    var rbx = pcx + cosA * 25;
    var rbz = pcz + sinA * 25;
    for (var rb = 0; rb < 3; rb++) {
      var rbcx = rbx + sinA * (rb - 1) * 5;
      var rbcz = rbz - cosA * (rb - 1) * 5;
      var rbCar = vehicles.createCar('police', rbcx, rbcz, ca, true);
      if (rbCar) {
        rbCar.alive = true;
        rbCar.roadblockStuck = true;
      }
    }

    // Helicopter above player car
    var heliGroup = new THREE.Group();
    var bodyGeo = new THREE.BoxGeometry(2, 0.8, 4);
    var bMat = new THREE.MeshPhongMaterial({ color: 0x222233 });
    var body = new THREE.Mesh(bodyGeo, bMat);
    body.position.y = 0.4;
    body.castShadow = true;
    heliGroup.add(body);

    var tailGeo = new THREE.BoxGeometry(0.3, 0.3, 1.5);
    var tail = new THREE.Mesh(tailGeo, bMat);
    tail.position.set(0, 0.3, -2.5);
    heliGroup.add(tail);

    var bladeGroup = new THREE.Group();
    var bladeGeo = new THREE.BoxGeometry(0.1, 0.05, 4);
    var bladeMat = new THREE.MeshPhongMaterial({ color: 0x444444 });
    var b1 = new THREE.Mesh(bladeGeo, bladeMat);
    bladeGroup.add(b1);
    var b2 = new THREE.Mesh(bladeGeo, bladeMat);
    b2.rotation.y = Math.PI / 2;
    bladeGroup.add(b2);
    bladeGroup.position.y = 1.0;
    heliGroup.add(bladeGroup);

    var spotLight = new THREE.SpotLight(0xffffaa, 1.5, 50, Math.PI / 6, 0.3);
    spotLight.position.set(0, -0.5, 1);
    spotLight.target.position.set(0, -35, 8);
    heliGroup.add(spotLight);
    heliGroup.add(spotLight.target);

    var coneGeo = new THREE.CylinderGeometry(0.4, 3, 8, 8, 1);
    var coneMat = new THREE.MeshBasicMaterial({
      color: 0xffffaa,
      transparent: true,
      opacity: 0.06,
      side: THREE.DoubleSide,
    });
    var cone = new THREE.Mesh(coneGeo, coneMat);
    cone.position.set(0, -4.5, 1);
    heliGroup.add(cone);

    heliGroup.position.set(pcx, 35, pcz - 8);
    scene.add(heliGroup);

    // Force wanted to 5 stars
    if (police.wantedHeat !== undefined) police.wantedHeat = 7;
    if (police.wantedLevel !== undefined) police.wantedLevel = 5;

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
    if (vehicles.playerCar) {
      var pcar = vehicles.playerCar;
      var cca = pcar.angle;
      var bX = pcar.x - Math.cos(cca) * 8;
      var bZ = pcar.z - Math.sin(cca) * 8;
      camera.position.set(bX, 2.5, bZ);
      camera.lookAt(pcar.x + Math.cos(cca) * 12, 1.2, pcar.z + Math.sin(cca) * 12);
    }

    if (audio && audio.toggleRadio) {
      try { audio.toggleRadio(); } catch (_) {}
    }

    renderHUD(hud, player, police, combat, missions, audio, gameModules, 0, 0);
  }

  if (name === 'mission') {
    player.player.angle = 0;
    var ppx = player.player.x;
    var ppz = player.player.z;
    var pa = player.player.angle;
    var behindX = ppx - Math.cos(pa) * 4;
    var behindZ = ppz - Math.sin(pa) * 4;
    var rightX = Math.sin(pa) * 1.5;
    var rightZ = -Math.cos(pa) * 1.5;
    camera.position.set(behindX + rightX, 2.2, behindZ + rightZ);
    camera.lookAt(ppx + Math.cos(pa) * 9, 1.5, ppz + Math.sin(pa) * 9);

    missions.showDialogue("Bea: They're coming for the bar, Rio! Hold them off!");
    renderHUD(hud, player, police, combat, missions, audio, gameModules, 0, 0);
  }

  if (name === 'drive') {
    if (vehicles.playerCar) {
      var dcar = vehicles.playerCar;
      var dca = dcar.angle;
      var dbehindX = dcar.x - Math.cos(dca) * 16;
      var dbehindZ = dcar.z - Math.sin(dca) * 16;
      camera.position.set(dbehindX, 5, dbehindZ);
      camera.lookAt(dcar.x + Math.cos(dca) * 15, 2, dcar.z + Math.sin(dca) * 15);
    }

    if (audio && audio.toggleRadio) {
      try { audio.toggleRadio(); } catch (_) {}
    }

    renderHUD(hud, player, police, combat, missions, audio, gameModules, beaconX, beaconZ);
  }

  renderer.render(scene, camera);
  window.__shotReady = 'ready';

  return 'ready';
}