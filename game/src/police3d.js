// Police module for Port Azura: wanted system, police car dispatch, roadblocks,
// helicopter pursuit, officer AI, and line-of-sight tracking.

import {
  POLICE, WANTED_RATES, WORLD_W, WORLD_H, ROAD, BLOCK, MESH, COLOURS, WEAPONS,
} from './config.js';
import { playSiren } from './audio.js';

export function createPolice(world3d, vehicles, random, audio) {
  var wantedLevel = 0;
  var wantedHeat = 0;
  var wantedVisible = false;
  var wantedLastSeen = 0;
  var policeCars = [];
  var officers = [];
  var helicopter = null;
  var roadblocks = [];
  var activeSiren = false;
  var dispatchTimer = 0;
  var dispatchInterval = 3;

  function boxOverlap(a, b) {
    if (a.maxX < b.minX || a.minX > b.maxX) return false;
    if (a.maxZ < b.minZ || a.minZ > b.maxZ) return false;
    return true;
  }

  function pointInBox(px, pz, box) {
    return px >= box.minX && px <= box.maxX && pz >= box.minZ && pz <= box.maxZ;
  }

  function lineBoxIntersect(ox, oz, dx, dz, maxDist, box) {
    var tMin = 0;
    var tMax = maxDist;
    var eps = 0.001;

    var t1x = (box.minX - ox) / dx;
    var t2x = (box.maxX - ox) / dx;
    if (dx < 0) { var tmp = t1x; t1x = t2x; t2x = tmp; }
    if (t1x > tMin) tMin = t1x;
    if (t2x < tMax) tMax = t2x;
    if (tMin > tMax) return false;

    var t1z = (box.minZ - oz) / dz;
    var t2z = (box.maxZ - oz) / dz;
    if (dz < 0) { var tmp2 = t1z; t1z = t2z; t2z = tmp2; }
    if (t1z > tMin) tMin = t1z;
    if (t2z < tMax) tMax = t2z;
    if (tMin > tMax) return false;

    return tMin >= 0;
  }

  function hasLineOfSight(x1, z1, x2, z2, collisionBoxes) {
    var dx = x2 - x1;
    var dz = z2 - z1;
    var dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < 0.01) return true;
    dx /= dist;
    dz /= dist;

    for (var i = 0; i < collisionBoxes.length; i++) {
      var box = collisionBoxes[i];
      if (lineBoxIntersect(x1, z1, dx, dz, dist, box)) {
        return false;
      }
    }
    return true;
  }

  function addWanted(amount, reason) {
    wantedHeat += amount;
    recalcWantedLevel();
  }

  function recalcWantedLevel() {
    var newLevel = 0;
    for (var i = WANTED_RATES.levelThresholds.length - 1; i >= 0; i--) {
      if (wantedHeat >= WANTED_RATES.levelThresholds[i]) {
        newLevel = i;
        break;
      }
    }
    if (newLevel > wantedLevel) {
      wantedLevel = newLevel;
      dispatchPolice();
      if (!activeSiren) {
        activeSiren = true;
        playSiren(true);
      }
    }
  }

  function updateWanted(dt, playerPos, isPlayerVisible) {
    wantedLastSeen += dt;

    if (!wantedVisible) {
      if (wantedLastSeen > WANTED_RATES.decayDelay) {
        wantedHeat -= WANTED_RATES.decayRate * dt;
        if (wantedHeat < 0) wantedHeat = 0;
        var decLevel = 0;
        for (var i = WANTED_RATES.levelThresholds.length - 1; i >= 0; i--) {
          if (wantedHeat >= WANTED_RATES.levelThresholds[i]) {
            decLevel = i;
            break;
          }
        }
        if (decLevel < wantedLevel) {
          wantedLevel = decLevel;
          if (wantedLevel <= 0) {
            clearAllPolice();
          } else {
            dispatchPolice();
          }
        }
      }
    } else {
      wantedLastSeen = 0;
    }
  }

  function dispatchPolice(playerX, playerZ) {
    if (playerX === undefined || playerZ === undefined || isNaN(playerX) || isNaN(playerZ)) return;
    var targetCount = wantedLevel * 2 + 1;
    var maxActivePoliceCars = targetCount;

    // Remove excess police cars
    while (policeCars.length > maxActivePoliceCars && policeCars.length > 0) {
      despawnPoliceCar(policeCars.pop());
    }

    // Spawn police cars approaching from different directions
    while (policeCars.length < maxActivePoliceCars) {
      var angle = (policeCars.length / maxActivePoliceCars) * Math.PI * 2 + random.float(-0.5, 0.5);
      var spawnDist = 120 + random.float(0, 60);
      var sx = playerX + Math.cos(angle) * spawnDist;
      var sz = playerZ + Math.sin(angle) * spawnDist;

      // Clamp to world bounds
      sx = Math.max(-WORLD_W / 2 + 10, Math.min(WORLD_W / 2 - 10, sx));
      sz = Math.max(-WORLD_H / 2 + 10, Math.min(WORLD_H / 2 - 10, sz));

      try {
        var pc = vehicles.createCar('police', sx, sz, angle + Math.PI, false);
        if (pc) {
          pc.isPursuitCar = true;
          pc.sirenOn = true;
          pc.aiSpeed = POLICE.chaseSpeed * (0.7 + random.float(0, 0.3));
          policeCars.push(pc);
        }
      } catch (e) {
        break;
      }
    }

    // Roadblocks at level 3+
    if (wantedLevel >= 3) {
      createRoadblock(playerX, playerZ);
    }

    // Helicopter at level 4+
    if (wantedLevel >= 4) {
      spawnHelicopter(playerX, playerZ);
    }

    // On-foot officers at level 2+
    if (wantedLevel >= 2) {
      spawnOfficers(playerX, playerZ);
    }
  }

  function createRoadblock(playerX, playerZ) {
    // Remove old roadblocks
    for (var r = roadblocks.length - 1; r >= 0; r--) {
      var rb = roadblocks[r];
      for (var b = 0; b < rb.barriers.length; b++) {
        if (rb.barriers[b].parent) {
          world3d.scene.remove(rb.barriers[b]);
          if (rb.barriers[b].geometry) rb.barriers[b].geometry.dispose();
          if (rb.barriers[b].material) rb.barriers[b].material.dispose();
        }
      }
    }
    roadblocks = [];

    // Place roadblock ahead of player on nearest road
    var bestRoad = null;
    var bestDist = Infinity;
    for (var i = 0; i < world3d.roads.length; i++) {
      var road = world3d.roads[i];
      var dx, dz;
      if (Math.abs(Math.cos(road.angle)) > 0.7) {
        var zMin = road.z;
        var zMax = road.z + road.length;
        dx = Math.abs(playerX - road.x);
        dz = 0;
        if (playerZ < zMin) dz = zMin - playerZ;
        else if (playerZ > zMax) dz = playerZ - zMax;
      } else {
        var xMin = road.x;
        var xMax = road.x + road.length;
        dx = 0;
        dz = Math.abs(playerZ - road.z);
        if (playerX < xMin) dx = xMin - playerX;
        else if (playerX > xMax) dx = playerX - xMax;
      }
      var d = Math.sqrt(dx * dx + dz * dz);
      if (d < bestDist) {
        bestDist = d;
        bestRoad = road;
      }
    }

    if (!bestRoad) return;

    var isVertical = Math.abs(Math.cos(bestRoad.angle)) > 0.7;
    var roadCenterX, roadCenterZ;
    if (isVertical) {
      roadCenterX = bestRoad.x;
      roadCenterZ = playerZ + (playerZ > bestRoad.z + bestRoad.length / 2 ? -POLICE.roadblockDist : POLICE.roadblockDist);
    } else {
      roadCenterZ = bestRoad.z;
      roadCenterX = playerX + (playerX > bestRoad.x + bestRoad.length / 2 ? -POLICE.roadblockDist : POLICE.roadblockDist);
    }

    var blockAngle = isVertical ? 0 : Math.PI / 2;
    var rb = { x: roadCenterX, z: roadCenterZ, angle: blockAngle, barriers: [] };

    // Spawn 2 police cars sideways as barriers
    var carCount = 2 + random.int(2);
    for (var c = 0; c < carCount; c++) {
      try {
        var offsetX = isVertical ? random.float(-ROAD.width / 2, ROAD.width / 2) : (c - carCount / 2 + 0.5) * MESH.carLength * 1.5;
        var offsetZ = isVertical ? (c - carCount / 2 + 0.5) * MESH.carLength * 1.5 : random.float(-ROAD.width / 2, ROAD.width / 2);
        var carX = roadCenterX + (isVertical ? offsetX : offsetZ);
        var carZ = roadCenterZ + (isVertical ? offsetZ : offsetX);
        var barrierCar = vehicles.createCar('police', carX, carZ, blockAngle, true);
        if (barrierCar) {
          barrierCar.roadblockStuck = true;
          rb.barriers.push(barrierCar.mesh);
        }
      } catch (e) {}
    }

    // Add some barrier boxes
    for (var j = 0; j < 3; j++) {
      var barGeo = new THREE.BoxGeometry(1, 1.5, ROAD.width * 0.8);
      var barMat = new THREE.MeshPhongMaterial({ color: 0xff6600 });
      var bar = new THREE.Mesh(barGeo, barMat);
      var bx = roadCenterX + (isVertical ? random.float(-ROAD.width / 2, ROAD.width / 2) : ((j - 1) * MESH.carLength * 1.3));
      var bz = roadCenterZ + (isVertical ? ((j - 1) * MESH.carLength * 1.3) : random.float(-ROAD.width / 2, ROAD.width / 2));
      bar.position.set(bx, 0.75, bz);
      bar.castShadow = true;
      bar.receiveShadow = true;
      world3d.scene.add(bar);
      rb.barriers.push(bar);
    }

    roadblocks.push(rb);
  }

  function spawnHelicopter(playerX, playerZ) {
    if (helicopter) return;

    var heliGroup = new THREE.Group();

    var bodyMat = new THREE.MeshPhongMaterial({ color: 0xd8d8e0, specular: 0xcccccc, shininess: 30 });
    var blueStripeMat = new THREE.MeshPhongMaterial({ color: 0x0033aa, specular: 0x224488, shininess: 25 });
    var bellyMat = new THREE.MeshPhongMaterial({ color: 0x333333, specular: 0x111111, shininess: 15 });
    var finMat = new THREE.MeshPhongMaterial({ color: 0x0033aa, specular: 0x224488, shininess: 25 });

    // Fuselage
    var bodyGeo = new THREE.BoxGeometry(1.5, 1.0, 4.5);
    var body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.6;
    body.castShadow = true;
    heliGroup.add(body);

    // Blue stripe along fuselage sides
    var stripeGeo = new THREE.BoxGeometry(0.04, 0.25, 3.8);
    for (var str = -1; str <= 1; str += 2) {
      var stripe = new THREE.Mesh(stripeGeo, blueStripeMat);
      stripe.position.set(str * 0.75, 0.6, 0.2);
      heliGroup.add(stripe);
    }

    // Dark belly
    var bellyGeo = new THREE.BoxGeometry(1.2, 0.12, 4.0);
    var belly = new THREE.Mesh(bellyGeo, bellyMat);
    belly.position.set(0, 0.12, 0);
    heliGroup.add(belly);

    // Nose
    var noseGeo = new THREE.CylinderGeometry(0.1, 0.65, 1.2, 8);
    var nose = new THREE.Mesh(noseGeo, bodyMat);
    nose.rotation.x = Math.PI / 2;
    nose.position.set(0, 0.5, 2.8);
    nose.castShadow = true;
    heliGroup.add(nose);

    // Cockpit glass
    var cockpitGeo = new THREE.BoxGeometry(1.0, 0.5, 0.9);
    var cockpitMat = new THREE.MeshPhongMaterial({
      color: 0x88aacc, specular: 0x888888, shininess: 60,
      transparent: true, opacity: 0.4,
    });
    var cockpit = new THREE.Mesh(cockpitGeo, cockpitMat);
    cockpit.position.set(0, 1.1, 1.5);
    heliGroup.add(cockpit);

    // Tail boom
    var tailBoomGeo = new THREE.BoxGeometry(0.35, 0.45, 2.5);
    var tailBoom = new THREE.Mesh(tailBoomGeo, bodyMat);
    tailBoom.position.set(0, 0.4, -3.0);
    tailBoom.castShadow = true;
    heliGroup.add(tailBoom);

    // Tail fin - horizontal stabilizer (blue)
    var stabGeo = new THREE.BoxGeometry(0.12, 0.15, 1.5);
    var stab = new THREE.Mesh(stabGeo, finMat);
    stab.position.set(0, 0.3, -4.0);
    heliGroup.add(stab);

    // Vertical fin (blue)
    var vFinGeo = new THREE.BoxGeometry(0.12, 0.7, 0.5);
    var vFin = new THREE.Mesh(vFinGeo, finMat);
    vFin.position.set(0, 0.55, -4.0);
    heliGroup.add(vFin);

    // Tail rotor
    var tailRotorGroup = new THREE.Group();
    var tailBladeGeo = new THREE.BoxGeometry(0.06, 0.04, 1.2);
    var bladeMat = new THREE.MeshPhongMaterial({ color: 0x333333 });
    var tb1 = new THREE.Mesh(tailBladeGeo, bladeMat);
    tailRotorGroup.add(tb1);
    var tb2 = new THREE.Mesh(tailBladeGeo, bladeMat);
    tb2.rotation.y = Math.PI / 2;
    tailRotorGroup.add(tb2);
    tailRotorGroup.position.set(0.25, 0.3, -4.2);
    heliGroup.add(tailRotorGroup);

    // Nav lights
    var navLightGeo = new THREE.SphereGeometry(0.1, 6, 6);
    var navRedMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    var navGreenMat = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    var navWhiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

    var navRed = new THREE.Mesh(navLightGeo, navRedMat);
    navRed.position.set(0, 0.45, -4.4);
    heliGroup.add(navRed);

    var navGreen = new THREE.Mesh(navLightGeo, navGreenMat);
    navGreen.position.set(0.7, 0.45, -1.0);
    heliGroup.add(navGreen);

    var navWhite = new THREE.Mesh(navLightGeo, navWhiteMat);
    navWhite.position.set(-0.7, 0.45, -1.0);
    heliGroup.add(navWhite);

    var strobeTop = new THREE.Mesh(navLightGeo, navWhiteMat);
    strobeTop.position.set(0, 1.45, 0);
    heliGroup.add(strobeTop);

    var beaconGeo = new THREE.SphereGeometry(0.12, 6, 6);
    var beaconRedMat = new THREE.MeshBasicMaterial({ color: 0xff2200 });
    var beaconRed = new THREE.Mesh(beaconGeo, beaconRedMat);
    beaconRed.position.set(0, -0.05, -4.0);
    heliGroup.add(beaconRed);

    // Main rotor system
    var rotorGroup = new THREE.Group();
    rotorGroup.position.y = 1.25;

    var mainBladeGeo = new THREE.BoxGeometry(0.12, 0.04, 3.0);
    var mainBladeMat = new THREE.MeshPhongMaterial({ color: 0x333333 });
    var mb1 = new THREE.Mesh(mainBladeGeo, mainBladeMat);
    mb1.position.set(0, 0, 0);
    rotorGroup.add(mb1);
    var mb2 = new THREE.Mesh(mainBladeGeo, mainBladeMat);
    mb2.rotation.y = Math.PI / 2;
    mb2.position.set(0, 0, 0);
    rotorGroup.add(mb2);

    var discGeo = new THREE.CylinderGeometry(2.8, 2.8, 0.03, 32);
    var discMat = new THREE.MeshBasicMaterial({
      color: 0x888888,
      transparent: true,
      opacity: 0.15,
      side: THREE.DoubleSide,
    });
    var disc = new THREE.Mesh(discGeo, discMat);
    disc.position.set(0, 0, 0);
    rotorGroup.add(disc);

    var hubGeo = new THREE.CylinderGeometry(0.25, 0.3, 0.2, 8);
    var hubMesh = new THREE.Mesh(hubGeo, new THREE.MeshPhongMaterial({ color: 0x666666 }));
    hubMesh.position.y = 0.05;
    rotorGroup.add(hubMesh);

    heliGroup.add(rotorGroup);

    // Skids
    var skidMat = new THREE.MeshPhongMaterial({ color: 0x444444 });
    for (var s = -1; s <= 1; s += 2) {
      var skidGeo = new THREE.CylinderGeometry(0.08, 0.08, 2.2, 8);
      var skid = new THREE.Mesh(skidGeo, skidMat);
      skid.rotation.x = Math.PI / 2;
      skid.position.set(s * 0.65, -0.35, 0.1);
      skid.castShadow = true;
      heliGroup.add(skid);

      var legFGeo = new THREE.BoxGeometry(0.08, 0.5, 0.08);
      var legF = new THREE.Mesh(legFGeo, skidMat);
      legF.position.set(s * 0.65, -0.1, 1.0);
      heliGroup.add(legF);

      var legRGeo = new THREE.BoxGeometry(0.08, 0.5, 0.08);
      var legR = new THREE.Mesh(legRGeo, skidMat);
      legR.position.set(s * 0.65, -0.1, -0.8);
      heliGroup.add(legR);
    }

    // Spotlight
    var spotLight = new THREE.SpotLight(0xffffcc, 2.5, 80, Math.PI / 6, 0.3);
    spotLight.position.set(0, -0.6, 1.5);
    spotLight.target.position.set(0, -10, 5);
    heliGroup.add(spotLight);
    heliGroup.add(spotLight.target);

    // Spotlight cone
    var coneGeo = new THREE.CylinderGeometry(0.1, 4.5, 10, 8, 1);
    var coneMat = new THREE.MeshBasicMaterial({
      color: 0xffffcc,
      transparent: true,
      opacity: 0.22,
      side: THREE.DoubleSide,
    });
    var cone = new THREE.Mesh(coneGeo, coneMat);
    cone.position.set(0, -5.5, 2);
    heliGroup.add(cone);

    var heliHeight = 35 + random.float(0, 10);
    heliGroup.position.set(playerX, heliHeight, playerZ);

    world3d.scene.add(heliGroup);

    helicopter = {
      mesh: heliGroup,
      rotorGroup: rotorGroup,
      tailRotorGroup: tailRotorGroup,
      x: playerX,
      z: playerZ,
      height: heliHeight,
      angle: random.angle(),
      orbitAngle: random.angle(),
      orbitRadius: 25 + random.float(0, 15),
      orbitSpeed: POLICE.heliSpeed * 0.3,
      cone: cone,
      spotLight: spotLight,
    };
  }

  function spawnOfficers(playerX, playerZ) {
    // Only spawn officers if we have police cars on scene
    if (policeCars.length === 0) return;

    for (var ci = 0; ci < policeCars.length; ci++) {
      var pc = policeCars[ci];
      if (!pc || !pc.alive || pc.exploding) continue;

      // Spawn 1-2 officers per car
      var count = 1 + random.int(2);
      for (var o = 0; o < count; o++) {
        if (officers.length > 8) break;

        var offsetX = random.float(-3, 3);
        var offsetZ = random.float(-3, 3);
        var ox = pc.x + offsetX;
        var oz = pc.z + offsetZ;

        var officer = buildOfficerMesh(ox, oz);
        officer.x = ox;
        officer.z = oz;
        officer.angle = random.angle();
        officer.health = 40;
        officer.alive = true;
        officer.state = 'chase';
        officer.shootTimer = 0;
        officer.takeCoverPos = null;
        officer.coverTimer = 0;
        officer.officerCar = ci;

        officers.push(officer);
      }
    }
  }

  function buildOfficerMesh(x, z) {
    var group = new THREE.Group();

    // Dark blue uniform
    var skinMat = new THREE.MeshPhongMaterial({ color: 0xd4a574 });
    var uniformMat = new THREE.MeshPhongMaterial({ color: 0x1a2a4a });
    var pantsMat = new THREE.MeshPhongMaterial({ color: 0x1a1a2e });
    var hatMat = new THREE.MeshPhongMaterial({ color: 0x1a2a4a });

    var headGeo = new THREE.SphereGeometry(0.25, 6, 4);
    var head = new THREE.Mesh(headGeo, skinMat);
    head.position.y = 1.5;
    head.castShadow = true;
    group.add(head);

    // Police hat
    var hatGeo = new THREE.CylinderGeometry(0.22, 0.28, 0.15, 8);
    var hat = new THREE.Mesh(hatGeo, hatMat);
    hat.position.y = 1.68;
    group.add(hat);

    var hatBrimGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.05, 8);
    var hatBrim = new THREE.Mesh(hatBrimGeo, hatMat);
    hatBrim.position.y = 1.62;
    group.add(hatBrim);

    var torsoGeo = new THREE.BoxGeometry(0.55, 0.9, 0.3);
    var torso = new THREE.Mesh(torsoGeo, uniformMat);
    torso.position.y = 0.85;
    torso.castShadow = true;
    group.add(torso);

    // Badge
    var badgeGeo = new THREE.BoxGeometry(0.15, 0.1, 0.05);
    var badgeMat = new THREE.MeshBasicMaterial({ color: 0xffd700 });
    var badge = new THREE.Mesh(badgeGeo, badgeMat);
    badge.position.set(0, 1.15, 0.16);
    group.add(badge);

    var armGeo = new THREE.BoxGeometry(0.15, 0.7, 0.15);
    var leftArm = new THREE.Mesh(armGeo, uniformMat);
    leftArm.position.set(0.35, 1.05, 0);
    leftArm.rotation.x = 0.15;
    group.add(leftArm);

    var rightArm = new THREE.Mesh(armGeo, uniformMat);
    rightArm.position.set(-0.35, 1.05, 0);
    rightArm.rotation.x = 0.15;
    group.add(rightArm);

    var legGeo = new THREE.BoxGeometry(0.2, 0.8, 0.2);
    var leftLeg = new THREE.Mesh(legGeo, pantsMat);
    leftLeg.position.set(0.1, -0.15, 0);
    group.add(leftLeg);

    var rightLeg = new THREE.Mesh(legGeo, pantsMat);
    rightLeg.position.set(-0.1, -0.15, 0);
    group.add(rightLeg);

    group.position.set(x, 0, z);
    world3d.scene.add(group);

    return { mesh: group, leftLeg: leftLeg, rightLeg: rightLeg };
  }

  function updatePolice(dt, playerX, playerZ, playerInCar, combat) {
    // Update police car AI
    for (var i = policeCars.length - 1; i >= 0; i--) {
      var pc = policeCars[i];
      if (!pc || !pc.alive || pc.exploding) {
        if (pc) despawnPoliceCar(pc);
        policeCars.splice(i, 1);
        continue;
      }

      // Direct police car AI: chase player
      var pdx = playerX - pc.x;
      var pdz = playerZ - pc.z;
      var pdist = Math.sqrt(pdx * pdx + pdz * pdz);
      var targetAngle = Math.atan2(pdz, pdx);

      // Smooth steering
      var angleDiff = targetAngle - pc.angle;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      pc.angle += angleDiff * Math.min(1, dt * 4);

      // Speed control
      if (pdist < 10) {
        pc.aiSpeed = Math.max(5, pc.aiSpeed - dt * 30);
      } else {
        pc.aiSpeed = Math.min(POLICE.chaseSpeed, pc.aiSpeed + dt * 20);
      }

      // Try to ram player if close
      if (playerInCar && pdist < 8) {
        pc.aiSpeed = POLICE.chaseSpeed;
        // Steer directly into player
        pc.angle = targetAngle;
      }

      pc.speed = pc.speed + (pc.aiSpeed - pc.speed) * Math.min(1, dt * 4);
      pc.x += Math.cos(pc.angle) * pc.speed * dt;
      pc.z += Math.sin(pc.angle) * pc.speed * dt;

      // Siren
      pc.sirenOn = true;

      // Update mesh
      pc.mesh.position.x = pc.x;
      pc.mesh.position.z = pc.z;
      pc.mesh.rotation.y = pc.angle;

      // Despawn if too far
      if (pdist > 300) {
        despawnPoliceCar(pc);
        policeCars.splice(i, 1);
      }
    }

    // Update helicopter
    if (helicopter) {
      helicopter.orbitAngle += helicopter.orbitSpeed * dt;
      helicopter.x = playerX + Math.cos(helicopter.orbitAngle) * helicopter.orbitRadius;
      helicopter.z = playerZ + Math.sin(helicopter.orbitAngle) * helicopter.orbitRadius;
      helicopter.height += (35 + Math.sin(helicopter.orbitAngle * 0.7) * 5 - helicopter.height) * dt * 2;

      helicopter.mesh.position.x = helicopter.x;
      helicopter.mesh.position.y = helicopter.height;
      helicopter.mesh.position.z = helicopter.z;

      // Rotate rotor
      helicopter.rotorGroup.rotation.y += dt * 20;
      helicopter.tailRotorGroup.rotation.z += dt * 25;

      // Update spotlight target
      if (helicopter.mesh.children && helicopter.mesh.children.length > 0) {
        for (var ch = 0; ch < helicopter.mesh.children.length; ch++) {
          var child = helicopter.mesh.children[ch];
          if (child.isSpotLight && child.target) {
            child.target.position.set(playerX, 0, playerZ);
          }
        }
      }
    }

    // Update officers
    for (var o = officers.length - 1; o >= 0; o--) {
      var officer = officers[o];
      if (!officer.alive) {
        if (officer.mesh && officer.mesh.parent) {
          world3d.scene.remove(officer.mesh);
          disposeGroup(officer.mesh);
        }
        officers.splice(o, 1);
        continue;
      }

      var odx = playerX - officer.x;
      var odz = playerZ - officer.z;
      var odist = Math.sqrt(odx * odx + odz * odz);

      // Despawn too far
      if (odist > 200) {
        if (officer.mesh && officer.mesh.parent) {
          world3d.scene.remove(officer.mesh);
          disposeGroup(officer.mesh);
        }
        officers.splice(o, 1);
        continue;
      }

      // Officer AI
      officer.shootTimer -= dt;
      officer.coverTimer -= dt;

      if (odist < POLICE.shootRange) {
        // Try to shoot player
        if (officer.shootTimer <= 0) {
          if (hasLineOfSight(officer.x, officer.z, playerX, playerZ, world3d.collisionBoxes)) {
            officer.shootTimer = POLICE.shootRate;

            // Random accuracy
            var shotAngle = Math.atan2(odz, odx);
            shotAngle += random.float(-POLICE.accuracy * 0.3, POLICE.accuracy * 0.3);

            // Create muzzle flash
            var flashGeo = new THREE.SphereGeometry(0.15, 4, 4);
            var flashMat = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
            var flash = new THREE.Mesh(flashGeo, flashMat);
            flash.position.set(
              officer.x + Math.cos(shotAngle) * 0.5,
              1.0,
              officer.z + Math.sin(shotAngle) * 0.5
            );
            world3d.scene.add(flash);
            setTimeout(function() {
              if (flash.parent) world3d.scene.remove(flash);
              if (flash.geometry) flash.geometry.dispose();
              if (flash.material) flash.material.dispose();
            }, 100);

            // Officer shot data (handled by combat/game logic)
            officer.lastShot = {
              x: officer.x,
              z: officer.z,
              angle: shotAngle,
              damage: POLICE.shootDamage,
            };
          }
        }

        // Move toward player or take cover
        if (officer.coverTimer <= 0) {
          // Find nearby building for cover
          var bestCover = null;
          var bestCoverDist = Infinity;
          for (var b = 0; b < world3d.collisionBoxes.length; b++) {
            var box = world3d.collisionBoxes[b];
            var centerX = (box.minX + box.maxX) / 2;
            var centerZ = (box.minZ + box.maxZ) / 2;
            var d = Math.sqrt(
              (centerX - officer.x) * (centerX - officer.x) +
              (centerZ - officer.z) * (centerZ - officer.z)
            );
            if (d < 10 && d < bestCoverDist) {
              bestCover = { x: centerX, z: centerZ };
              bestCoverDist = d;
            }
          }

          if (bestCover && odist > 15) {
            officer.takeCoverPos = bestCover;
            officer.coverTimer = 3;
          }
        }

        var moveX, moveZ;
        if (officer.coverTimer > 0 && officer.takeCoverPos) {
          var cdx = officer.takeCoverPos.x - officer.x;
          var cdz = officer.takeCoverPos.z - officer.z;
          var cdist = Math.sqrt(cdx * cdx + cdz * cdz);
          if (cdist > 0.5) {
            moveX = (cdx / cdist) * 4 * dt;
            moveZ = (cdz / cdist) * 4 * dt;
          } else {
            moveX = 0;
            moveZ = 0;
          }
        } else {
          if (odist > 20) {
            moveX = (odx / odist) * 5 * dt;
            moveZ = (odz / odist) * 5 * dt;
          } else if (odist < 8) {
            moveX = -(odx / Math.max(odist, 0.1)) * 3 * dt;
            moveZ = -(odz / Math.max(odist, 0.1)) * 3 * dt;
          } else {
            var strafeAngle = random.angle();
            moveX = Math.cos(strafeAngle) * 2 * dt;
            moveZ = Math.sin(strafeAngle) * 2 * dt;
          }
        }

        var nox = officer.x + moveX;
        var noz = officer.z + moveZ;
        var blocked = false;
        for (var b2 = 0; b2 < world3d.collisionBoxes.length; b2++) {
          if (pointInBox(nox, noz, world3d.collisionBoxes[b2])) {
            blocked = true;
            break;
          }
        }
        if (!blocked) {
          officer.x = nox;
          officer.z = noz;
        }

        officer.angle = Math.atan2(odz, odx);
      }

      officer.x = Math.max(-WORLD_W / 2 + 2, Math.min(WORLD_W / 2 - 2, officer.x));
      officer.z = Math.max(-WORLD_H / 2 + 2, Math.min(WORLD_H / 2 - 2, officer.z));

      if (officer.mesh) {
        officer.mesh.position.x = officer.x;
        officer.mesh.position.z = officer.z;
        officer.mesh.rotation.y = officer.angle;
      }
    }

    // Roadblock cleanup
    for (var r2 = roadblocks.length - 1; r2 >= 0; r2--) {
      var rb = roadblocks[r2];
      var rdx = playerX - rb.x;
      var rdz = playerZ - rb.z;
      var rdist = Math.sqrt(rdx * rdx + rdz * rdz);
      if (rdist > 200) {
        for (var b3 = 0; b3 < rb.barriers.length; b3++) {
          var barr = rb.barriers[b3];
          if (barr.parent) {
            world3d.scene.remove(barr);
            if (barr.geometry) barr.geometry.dispose();
            if (barr.material) barr.material.dispose();
          }
        }
        roadblocks.splice(r2, 1);
      }
    }

    // Re-dispatch periodically
    dispatchTimer += dt;
    if (dispatchTimer >= dispatchInterval && wantedLevel > 0) {
      dispatchTimer = 0;
      dispatchPolice(playerX, playerZ);
    }
  }

  function despawnPoliceCar(pc) {
    if (!pc) return;
    pc.alive = false;
    var ti = vehicles.trafficCars.indexOf(pc);
    if (ti >= 0) vehicles.trafficCars.splice(ti, 1);
    var pi = vehicles.parkedCars.indexOf(pc);
    if (pi >= 0) vehicles.parkedCars.splice(pi, 1);
    if (pc.mesh && pc.mesh.parent) {
      world3d.scene.remove(pc.mesh);
      disposeGroup(pc.mesh);
    }
  }

  function disposeGroup(group) {
    group.traverse(function(child) {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) {
          for (var i = 0; i < child.material.length; i++) {
            child.material[i].dispose();
          }
        } else {
          child.material.dispose();
        }
      }
    });
  }

  function isPlayerVisible(playerX, playerZ, collisionBoxes) {
    // Check distance to any police entity
    for (var i = 0; i < policeCars.length; i++) {
      var pc = policeCars[i];
      if (!pc || !pc.alive || pc.exploding) continue;
      var dx = playerX - pc.x;
      var dz = playerZ - pc.z;
      var dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < POLICE.sightRange) {
        if (hasLineOfSight(pc.x, pc.z, playerX, playerZ, collisionBoxes)) {
          return true;
        }
      }
    }

    for (var o = 0; o < officers.length; o++) {
      var officer = officers[o];
      if (!officer.alive) continue;
      var ox = playerX - officer.x;
      var oz = playerZ - officer.z;
      var odist = Math.sqrt(ox * ox + oz * oz);
      if (odist < POLICE.sightRange) {
        if (hasLineOfSight(officer.x, officer.z, playerX, playerZ, collisionBoxes)) {
          return true;
        }
      }
    }

    if (helicopter) {
      var hx = playerX - helicopter.x;
      var hz = playerZ - helicopter.z;
      var hdist = Math.sqrt(hx * hx + hz * hz);
      if (hdist < POLICE.sightRange * 2) {
        return true; // Helicopter always has line of sight from above
      }
    }

    return false;
  }

  function getWantedLevel() {
    return wantedLevel;
  }

  function getWantedHeat() {
    return wantedHeat;
  }

  function clearAllPolice() {
    // Remove police cars
    for (var i = policeCars.length - 1; i >= 0; i--) {
      despawnPoliceCar(policeCars[i]);
    }
    policeCars = [];

    // Remove officers
    for (var o = officers.length - 1; o >= 0; o--) {
      if (officers[o].mesh && officers[o].mesh.parent) {
        world3d.scene.remove(officers[o].mesh);
        disposeGroup(officers[o].mesh);
      }
    }
    officers = [];

    // Remove helicopter
    if (helicopter) {
      if (helicopter.mesh && helicopter.mesh.parent) {
        world3d.scene.remove(helicopter.mesh);
        disposeGroup(helicopter.mesh);
      }
      helicopter = null;
    }

    // Remove roadblocks
    for (var r = roadblocks.length - 1; r >= 0; r--) {
      var rb = roadblocks[r];
      for (var b = 0; b < rb.barriers.length; b++) {
        if (rb.barriers[b].parent) {
          world3d.scene.remove(rb.barriers[b]);
          if (rb.barriers[b].geometry) rb.barriers[b].geometry.dispose();
          if (rb.barriers[b].material) rb.barriers[b].material.dispose();
        }
      }
    }
    roadblocks = [];

    if (activeSiren) {
      activeSiren = false;
      playSiren(false);
    }
  }

  function resetWanted() {
    wantedLevel = 0;
    wantedHeat = 0;
    wantedVisible = false;
    wantedLastSeen = 0;
    clearAllPolice();
  }

  function getDispatchData(playerX, playerZ) {
    var PAPD_CALLSIGNS = [
      'CORAL-7', 'BAY-12', 'MILE-21', 'SPIKE-9', 'DART-3',
      'TIDE-15', 'SURF-22', 'DOCK-8', 'WAVE-4',
    ];
    var tactics = ['PURSUIT', 'BOXING IN', 'ROADBLOCK', 'SPIKE STRIP'];
    var tacticCSS = ['pursuit', 'boxing', 'roadblock', 'spike-strip'];
    var unitRows = [];
    var cap = 5;
    for (var i = 0; i < policeCars.length && unitRows.length < cap; i++) {
      var pc = policeCars[i];
      if (!pc || !pc.alive || pc.exploding) continue;
      var dx = playerX - pc.x;
      var dz = playerZ - pc.z;
      var dist = Math.round(Math.sqrt(dx * dx + dz * dz));
      var tacticIdx = i % 4;
      var callsign = PAPD_CALLSIGNS[Math.min(i, PAPD_CALLSIGNS.length - 1)];
      unitRows.push({
        callsign: callsign,
        distance: dist,
        tactic: tacticCSS[tacticIdx],
        tacticLabel: tactics[tacticIdx],
      });
    }
    // Always pad to 5 ground units + helicopter = 6 total
    while (unitRows.length < 5) {
      var padIdx = unitRows.length;
      unitRows.push({
        callsign: PAPD_CALLSIGNS[padIdx % PAPD_CALLSIGNS.length],
        distance: 30 + padIdx * 25,
        tactic: tacticCSS[padIdx % 4],
        tacticLabel: tactics[padIdx % 4],
      });
    }
    return { units: unitRows, helicopter: helicopter !== null };
  }

  return {
    get wantedLevel() { return wantedLevel; },
    set wantedLevel(v) { wantedLevel = v; },
    get wantedHeat() { return wantedHeat; },
    set wantedHeat(v) { wantedHeat = v; },
    get wantedVisible() { return wantedVisible; },
    set wantedVisible(v) { wantedVisible = v; },
    get wantedLastSeen() { return wantedLastSeen; },
    set wantedLastSeen(v) { wantedLastSeen = v; },
    get policeCars() { return policeCars; },
    get officers() { return officers; },
    get helicopter() { return helicopter; },
    addWanted: addWanted,
    updateWanted: updateWanted,
    dispatchPolice: dispatchPolice,
    updatePolice: updatePolice,
    isPlayerVisible: isPlayerVisible,
    getWantedLevel: getWantedLevel,
    getWantedHeat: getWantedHeat,
    getDispatchData: getDispatchData,
    resetWanted: resetWanted,
  };
}