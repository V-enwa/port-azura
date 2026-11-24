// Pedestrians module for Port Azura: AI pedestrians that walk sidewalks,
// flee from gunfire, dive from speeding cars, and react to the world.

import {
  PEDESTRIAN, WORLD_W, WORLD_H, ROAD, BLOCK, MESH,
} from './config.js';

var SHIRT_COLORS = [0xcc3333, 0x3366cc, 0x33aa33, 0xcccc33, 0x9933cc, 0xee8833, 0xeeeeee];

export function createPedestrians(world3d, random) {
  var peds = [];
  var spawnTimer = 0;

  function buildPedMesh(shirtColor) {
    var group = new THREE.Group();

    var headGeo = new THREE.SphereGeometry(0.25, 6, 4);
    var headMat = new THREE.MeshPhongMaterial({ color: 0xd4a574, specular: 0x000000, shininess: 5 });
    var head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 1.5;
    head.castShadow = true;
    group.add(head);

    var torsoGeo = new THREE.BoxGeometry(0.55, 0.9, 0.3);
    var torsoMat = new THREE.MeshPhongMaterial({ color: shirtColor, specular: 0x000000, shininess: 5 });
    var torso = new THREE.Mesh(torsoGeo, torsoMat);
    torso.position.y = 0.85;
    torso.castShadow = true;
    group.add(torso);

    var armGeo = new THREE.BoxGeometry(0.15, 0.7, 0.15);
    var armMat = new THREE.MeshPhongMaterial({ color: shirtColor, specular: 0x000000, shininess: 5 });

    var leftArm = new THREE.Mesh(armGeo, armMat);
    leftArm.position.set(0.35, 1.05, 0);
    leftArm.rotation.x = 0.15;
    leftArm.castShadow = true;
    group.add(leftArm);

    var rightArm = new THREE.Mesh(armGeo, armMat);
    rightArm.position.set(-0.35, 1.05, 0);
    rightArm.rotation.x = 0.15;
    rightArm.castShadow = true;
    group.add(rightArm);

    var legGeo = new THREE.BoxGeometry(0.2, 0.8, 0.2);
    var legMat = new THREE.MeshPhongMaterial({ color: 0x333344, specular: 0x000000, shininess: 5 });

    var leftLeg = new THREE.Mesh(legGeo, legMat);
    leftLeg.position.set(0.1, -0.15, 0);
    leftLeg.castShadow = true;
    group.add(leftLeg);

    var rightLeg = new THREE.Mesh(legGeo, legMat);
    rightLeg.position.set(-0.1, -0.15, 0);
    rightLeg.castShadow = true;
    group.add(rightLeg);

    return { group: group, leftLeg: leftLeg, rightLeg: rightLeg };
  }

  function createPed(x, z, angle) {
    var shirtColor = random.pick(SHIRT_COLORS);
    var meshData = buildPedMesh(shirtColor);
    meshData.group.position.set(x, 0, z);
    meshData.group.rotation.y = angle;
    world3d.scene.add(meshData.group);

    var ped = {
      mesh: meshData.group,
      x: x,
      z: z,
      angle: angle,
      speed: 0,
      state: 'idle',
      stateTimer: random.float(1, 4),
      targetX: x,
      targetZ: z,
      fleeX: 0,
      fleeZ: 0,
      fleeTimer: 0,
      alive: true,
      health: 50,
      shirtColor: shirtColor,
      legMeshes: [meshData.leftLeg, meshData.rightLeg],
      walkTimer: 0,
      deathTimer: 0,
      diveTimer: 0,
      diveDirX: 0,
      diveDirZ: 0,
    };

    return ped;
  }

  function pointInBox(px, pz, box) {
    return px >= box.minX && px <= box.maxX && pz >= box.minZ && pz <= box.maxZ;
  }

  function update(ped, dt, playerX, playerZ, playerFiring, cars) {
    if (!ped.alive) {
      ped.deathTimer -= dt;
      if (ped.deathTimer <= 0) {
        if (ped.mesh && ped.mesh.parent) {
          world3d.scene.remove(ped.mesh);
          disposeGroup(ped.mesh);
        }
      }
      return;
    }

    // Process dive state first (interrupts everything)
    if (ped.diveTimer > 0) {
      ped.diveTimer -= dt;
      ped.x += ped.diveDirX * PEDESTRIAN.diveSpeed * dt;
      ped.z += ped.diveDirZ * PEDESTRIAN.diveSpeed * dt;
      ped.x = clampWorldX(ped.x);
      ped.z = clampWorldZ(ped.z);
      ped.mesh.position.x = ped.x;
      ped.mesh.position.z = ped.z;
      return;
    }

    // Check dive from speeding cars
    if (cars) {
      for (var ci = 0; ci < cars.length; ci++) {
        var car = cars[ci];
        if (!car.alive || car.exploding) continue;
        if (Math.abs(car.speed) <= 15) continue;
        var cdx = ped.x - car.x;
        var cdz = ped.z - car.z;
        var cdist = Math.sqrt(cdx * cdx + cdz * cdz);
        if (cdist < PEDESTRIAN.diveRange + MESH.carWidth * 0.7) {
          var carDirX = Math.cos(car.angle);
          var carDirZ = Math.sin(car.angle);
          ped.diveDirX = -carDirZ;
          ped.diveDirZ = carDirX;
          ped.diveTimer = 0.4;
          ped.state = 'idle';
          ped.stateTimer = 0.8;
          break;
        }
      }
    }

    // Player firing check
    if (playerFiring) {
      var dx = ped.x - playerX;
      var dz = ped.z - playerZ;
      var dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < 100) {
        ped.state = 'flee';
        ped.fleeTimer = 3;
        if (dist > 0.01) {
          ped.fleeX = dx / dist;
          ped.fleeZ = dz / dist;
        } else {
          ped.fleeX = random.float(-1, 1);
          ped.fleeZ = random.float(-1, 1);
          var flen = Math.sqrt(ped.fleeX * ped.fleeX + ped.fleeZ * ped.fleeZ);
          if (flen < 0.01) { ped.fleeX = 1; ped.fleeZ = 0; } else {
            ped.fleeX /= flen;
            ped.fleeZ /= flen;
          }
        }
        ped.speed = PEDESTRIAN.fleeSpeed;
      }
    }

    ped.stateTimer -= dt;

    if (ped.state === 'flee') {
      ped.fleeTimer -= dt;
      ped.x += ped.fleeX * PEDESTRIAN.fleeSpeed * dt;
      ped.z += ped.fleeZ * PEDESTRIAN.fleeSpeed * dt;
      ped.walkTimer += dt;

      if (ped.fleeTimer <= 0) {
        ped.state = 'idle';
        ped.stateTimer = random.float(1, 3);
        ped.speed = 0;
      }
    } else if (ped.state === 'walk') {
      var tdx = ped.targetX - ped.x;
      var tdz = ped.targetZ - ped.z;
      var tdist = Math.sqrt(tdx * tdx + tdz * tdz);
      if (tdist < 0.5) {
        ped.state = 'idle';
        ped.stateTimer = random.float(1, 4);
        ped.speed = 0;
        ped.walkTimer = 0;
      } else {
        var ndx = tdx / tdist;
        var ndz = tdz / tdist;
        ped.angle = Math.atan2(tdz, tdx);
        ped.speed = PEDESTRIAN.speed;
        ped.x += ndx * PEDESTRIAN.speed * dt;
        ped.z += ndz * PEDESTRIAN.speed * dt;
        ped.walkTimer += dt;
      }
    } else if (ped.state === 'idle') {
      ped.walkTimer *= 0.9;
      ped.speed = 0;
      if (ped.stateTimer <= 0) {
        ped.state = 'walk';
        ped.stateTimer = random.float(3, 8);
        var angle = random.angle();
        var walkDist = random.float(3, 15);
        ped.targetX = ped.x + Math.cos(angle) * walkDist;
        ped.targetZ = ped.z + Math.sin(angle) * walkDist;
        ped.targetX = clampWorldX(ped.targetX);
        ped.targetZ = clampWorldZ(ped.targetZ);
      }
    }

    // Check collision with buildings
    var hitBuilding = false;
    for (var i = 0; i < world3d.collisionBoxes.length; i++) {
      var box = world3d.collisionBoxes[i];
      if (pointInBox(ped.x, ped.z, box)) {
        hitBuilding = true;
        break;
      }
    }
    if (hitBuilding) {
      // Reverse direction
      if (ped.state === 'walk') {
        ped.x -= (ped.targetX - ped.x) * 0.1;
        ped.z -= (ped.targetZ - ped.z) * 0.1;
        ped.state = 'idle';
        ped.stateTimer = random.float(1, 2);
      } else if (ped.state === 'flee') {
        ped.x -= ped.fleeX * PEDESTRIAN.fleeSpeed * dt * 2;
        ped.z -= ped.fleeZ * PEDESTRIAN.fleeSpeed * dt * 2;
        ped.fleeX = -ped.fleeX;
        ped.fleeZ = -ped.fleeZ;
      }
    }

    // Clamp to world bounds
    var clamped = false;
    if (ped.x < clampMinX()) { ped.x = clampMinX(); clamped = true; }
    if (ped.x > clampMaxX()) { ped.x = clampMaxX(); clamped = true; }
    if (ped.z < clampMinZ()) { ped.z = clampMinZ(); clamped = true; }
    if (ped.z > clampMaxZ()) { ped.z = clampMaxZ(); clamped = true; }
    if (clamped && ped.state === 'walk') {
      ped.state = 'idle';
      ped.stateTimer = random.float(1, 2);
    }

    // Walking animation - swing legs by rotating Z
    if (ped.state === 'walk' || ped.state === 'flee') {
      var swing = Math.sin(ped.walkTimer * 8) * 0.4;
      if (ped.legMeshes[0]) ped.legMeshes[0].rotation.z = swing;
      if (ped.legMeshes[1]) ped.legMeshes[1].rotation.z = -swing;
    } else {
      if (ped.legMeshes[0]) ped.legMeshes[0].rotation.z *= 0.9;
      if (ped.legMeshes[1]) ped.legMeshes[1].rotation.z *= 0.9;
    }

    ped.mesh.position.x = ped.x;
    ped.mesh.position.z = ped.z;
    ped.mesh.rotation.y = ped.angle;

    // Health check
    if (ped.health <= 0) {
      ped.alive = false;
      ped.deathTimer = 2;
      ped.mesh.rotation.x = Math.PI / 2;
      ped.speed = 0;
    }
  }

  function clampWorldX(x) {
    var half = WORLD_W / 2;
    return Math.max(-half + 2, Math.min(half - 2, x));
  }

  function clampWorldZ(z) {
    var half = WORLD_H / 2;
    return Math.max(-half + 2, Math.min(half - 2, z));
  }

  function clampMinX() { return -WORLD_W / 2 + 2; }
  function clampMaxX() { return WORLD_W / 2 - 2; }
  function clampMinZ() { return -WORLD_H / 2 + 2; }
  function clampMaxZ() { return WORLD_H / 2 - 2; }

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

  function getSidewalkPosition() {
    var road = random.pick(world3d.roads);
    var laneOffset = ROAD.width / 2 + BLOCK.sidewalk * 0.5 + random.float(0.5, 1.5);
    if (random.bool()) laneOffset = -laneOffset;

    var x, z;
    if (Math.abs(Math.cos(road.angle)) > 0.7) {
      // Vertical road
      x = road.x + laneOffset;
      z = road.z + random.float(0, road.length);
    } else {
      // Horizontal road
      x = road.x + random.float(0, road.length);
      z = road.z + laneOffset;
    }
    return { x: x, z: z };
  }

  function spawnPed() {
    if (peds.length >= PEDESTRIAN.maxPeds) return;
    var pos = getSidewalkPosition();
    // Ensure not inside a building
    for (var i = 0; i < world3d.collisionBoxes.length; i++) {
      if (pointInBox(pos.x, pos.z, world3d.collisionBoxes[i])) {
        // Try again with different position
        pos = getSidewalkPosition();
        i = -1;
      }
    }
    var angle = random.angle();
    var ped = createPed(pos.x, pos.z, angle);
    peds.push(ped);
  }

  function updateAll(dt, playerX, playerZ, playerFiring, cars) {
    // Remove dead peds
    for (var i = peds.length - 1; i >= 0; i--) {
      var ped = peds[i];
      if (!ped.alive && ped.deathTimer <= 0) {
        peds.splice(i, 1);
      }
    }

    // Spawn new peds
    spawnTimer += dt;
    if (spawnTimer >= PEDESTRIAN.spawnInterval && peds.length < PEDESTRIAN.maxPeds) {
      spawnTimer = 0;
      if (random() < 0.7) {
        spawnPed();
      }
    }

    // Update all peds
    for (var j = 0; j < peds.length; j++) {
      update(peds[j], dt, playerX, playerZ, playerFiring, cars);
    }
  }

  function getPeds() {
    var alive = [];
    for (var i = 0; i < peds.length; i++) {
      if (peds[i].alive) {
        alive.push(peds[i]);
      }
    }
    return alive;
  }

  // Pre-spawn some peds
  for (var i = 0; i < 10; i++) {
    spawnPed();
  }

  return {
    createPed: createPed,
    update: update,
    updateAll: updateAll,
    getPeds: getPeds,
    peds: peds,
  };
}