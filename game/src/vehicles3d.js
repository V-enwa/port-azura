// Vehicles module for Port Azura: traffic cars, parked cars, player car, AI driving,
// collisions, damage/explosion, and carjacking.

import { CAR_TYPES, TRAFFIC, MESH, WORLD_W, WORLD_H, ROAD, BLOCK } from './config.js';
import { playExplosion, playSiren, startEngine, stopEngine, setEngineRPM, setEngineVol } from './audio.js';

export function createVehicles(world3d, random, audio) {
  const trafficCars = [];
  const parkedCars = [];
  let playerCar = null;
  const effects = [];
  let trafficTimer = 0;
  let parkTimer = 0;

  function createBodyMaterial(hexColor) {
    return new THREE.MeshPhongMaterial({ color: hexColor, specular: 0x222222, shininess: 30 });
  }

  function createCabinMaterial() {
    return new THREE.MeshPhongMaterial({
      color: 0x222233,
      specular: 0x444444,
      shininess: 60,
      transparent: true,
      opacity: 0.7,
    });
  }

  function createWheelMaterial() {
    return new THREE.MeshLambertMaterial({ color: 0x111111 });
  }

  function createHeadlightMaterial() {
    return new THREE.MeshBasicMaterial({ color: 0xffffff });
  }

  function createTaillightMaterial() {
    return new THREE.MeshBasicMaterial({ color: 0xff0000 });
  }

  function createCar(type, x, z, angle, parked) {
    if (!CAR_TYPES[type]) type = 'sedan';
    const cfg = CAR_TYPES[type];
    const cl = MESH.carLength;
    const cw = MESH.carWidth;
    const bodyH = MESH.carBodyH;
    const cabinH = MESH.cabinH;
    const wr = MESH.wheelRadius;

    const group = new THREE.Group();

    const bodyGeo = new THREE.BoxGeometry(cl, bodyH, cw);
    const bodyMat = createBodyMaterial(cfg.colour);
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = bodyH / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    let cabin;
    if (type !== 'truck') {
      const cabinGeo = new THREE.BoxGeometry(cl * 0.5, cabinH, cw * 0.85);
      const cabinMat = createCabinMaterial();
      cabin = new THREE.Mesh(cabinGeo, cabinMat);
      cabin.position.set(0, bodyH / 2 + cabinH / 2, -0.3);
      group.add(cabin);
    } else {
      const truckBodyGeo = new THREE.BoxGeometry(cl * 1.2, bodyH * 1.3, cw * 0.95);
      const truckBody = new THREE.Mesh(truckBodyGeo, bodyMat);
      truckBody.position.set(cl * 1.2 / 2 - cl / 2 + 0.5, bodyH * 1.3 / 2, 0);
      truckBody.castShadow = true;
      truckBody.receiveShadow = true;
      group.add(truckBody);

      const cargoGeo = new THREE.BoxGeometry(cl * 1.2, bodyH * 0.5, cw * 0.9);
      const cargo = new THREE.Mesh(cargoGeo, new THREE.MeshPhongMaterial({ color: 0x999999 }));
      cargo.position.set(-cl * 0.3, bodyH * 1.3 + bodyH * 0.25, 0);
      cargo.castShadow = true;
      group.add(cargo);
    }

    const wheelGeoLateral = new THREE.CylinderGeometry(wr, wr, 0.5, 8);
    const wheelGeoVertical = new THREE.CylinderGeometry(wr, wr, 0.5, 8);
    const wheelMat = createWheelMaterial();

    const wheelOffsets = [
      { x: cl * 0.32, y: wr, z: cw / 2 + 0.1 },
      { x: cl * 0.32, y: wr, z: -cw / 2 - 0.1 },
      { x: -cl * 0.32, y: wr, z: cw / 2 + 0.1 },
      { x: -cl * 0.32, y: wr, z: -cw / 2 - 0.1 },
    ];

    const wheelMeshes = wheelOffsets.map(function(pos) {
      const wheel = new THREE.Mesh(wheelGeoLateral, wheelMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(pos.x, pos.y, pos.z);
      wheel.castShadow = true;
      group.add(wheel);
      return wheel;
    });

    const hlGeo = new THREE.BoxGeometry(0.3, 0.2, 0.8);
    const hlMat = createHeadlightMaterial();
    const headlightL = new THREE.Mesh(hlGeo, hlMat);
    headlightL.position.set(cl / 2 - 0.1, bodyH * 0.65, cw * 0.3);
    group.add(headlightL);
    const headlightR = new THREE.Mesh(hlGeo, hlMat);
    headlightR.position.set(cl / 2 - 0.1, bodyH * 0.65, -cw * 0.3);
    group.add(headlightR);

    const tlGeo = new THREE.BoxGeometry(0.3, 0.15, 0.6);
    const tlMat = createTaillightMaterial();
    const taillightL = new THREE.Mesh(tlGeo, tlMat);
    taillightL.position.set(-cl / 2 + 0.1, bodyH * 0.65, cw * 0.3);
    group.add(taillightL);
    const taillightR = new THREE.Mesh(tlGeo, tlMat);
    taillightR.position.set(-cl / 2 + 0.1, bodyH * 0.65, -cw * 0.3);
    group.add(taillightR);

    const isPolice = type === 'police';
    const lightbarMeshes = [];
    if (isPolice) {
      const barGeo = new THREE.BoxGeometry(cl * 0.4, 0.15, cw * 0.7);
      const barRed = new THREE.Mesh(barGeo, new THREE.MeshBasicMaterial({ color: 0xff0000 }));
      const barBlue = new THREE.Mesh(barGeo, new THREE.MeshBasicMaterial({ color: 0x0000ff }));
      if (type !== 'truck') {
        barRed.position.set(0, bodyH / 2 + cabinH + 0.15/2, cw * 0.05);
        barBlue.position.set(0, bodyH / 2 + cabinH + 0.15/2, -cw * 0.05);
      } else {
        barRed.position.set(0, bodyH * 1.3 + 0.15/2, cw * 0.05);
        barBlue.position.set(0, bodyH * 1.3 + 0.15/2, -cw * 0.05);
      }
      group.add(barRed);
      group.add(barBlue);
      lightbarMeshes.push(barRed, barBlue);
    }

    group.position.set(x, 0, z);
    group.rotation.y = angle;
    world3d.scene.add(group);

    const car = {
      type: type,
      mesh: group,
      x: x,
      z: z,
      angle: angle,
      speed: 0,
      health: cfg.health,
      maxHealth: cfg.health,
      alive: true,
      exploding: false,
      explodeTimer: 0,
      smokeMesh: null,
      flamesMesh: null,
      aiTarget: { x: x, z: z },
      aiSpeed: random.float(cfg.speed * 0.4, cfg.speed * 0.8),
      isPolice: isPolice,
      sirenOn: false,
      lightbarMeshes: lightbarMeshes,
      headlightGlow: null,
      taillightGlow: null,
      wheelMeshes: wheelMeshes,
      damageSmoke: false,
      parked: parked || false,
    };

    if (parked) {
      parkedCars.push(car);
    } else {
      trafficCars.push(car);
    }

    return car;
  }

  function getCarBounds(car) {
    const cl = car.type === 'truck' ? MESH.carLength * 1.3 : MESH.carLength;
    const cw = MESH.carWidth;
    const cos = Math.cos(car.angle);
    const sin = Math.sin(car.angle);
    const hw = cw / 2;
    const hl = cl / 2;
    const cx = car.x;
    const cz = car.z;
    const corners = [
      { x: cx + cos * (-hl) - sin * (-hw), z: cz + sin * (-hl) + cos * (-hw) },
      { x: cx + cos * (-hl) - sin * (hw), z: cz + sin * (-hl) + cos * (hw) },
      { x: cx + cos * (hl) - sin * (-hw), z: cz + sin * (hl) + cos * (-hw) },
      { x: cx + cos * (hl) - sin * (hw), z: cz + sin * (hl) + cos * (hw) },
    ];
    let minX = Infinity, maxX = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    for (var i = 0; i < corners.length; i++) {
      if (corners[i].x < minX) minX = corners[i].x;
      if (corners[i].x > maxX) maxX = corners[i].x;
      if (corners[i].z < minZ) minZ = corners[i].z;
      if (corners[i].z > maxZ) maxZ = corners[i].z;
    }
    return { minX: minX, maxX: maxX, minZ: minZ, maxZ: maxZ, angle: car.angle };
  }

  function boxBoxOverlap(a, b) {
    if (a.maxX < b.minX || a.minX > b.maxX) return false;
    if (a.maxZ < b.minZ || a.minZ > b.maxZ) return false;
    return true;
  }

  function carCollidesWorld(car, collisionBoxes) {
    var bounds = getCarBounds(car);
    for (var i = 0; i < collisionBoxes.length; i++) {
      var box = collisionBoxes[i];
      if (boxBoxOverlap(bounds, box)) return true;
    }
    return false;
  }

  function carCollidesCar(a, b) {
    if (!a.alive || !b.alive || a.exploding || b.exploding) return false;
    var ba = getCarBounds(a);
    var bb = getCarBounds(b);
    var pad = 0.5;
    ba.minX -= pad;
    ba.maxX += pad;
    ba.minZ -= pad;
    ba.maxZ += pad;
    bb.minX -= pad;
    bb.maxX += pad;
    bb.minZ -= pad;
    bb.maxZ += pad;
    return boxBoxOverlap(ba, bb);
  }

  function pushCarsApart(a, b) {
    var ba = getCarBounds(a);
    var bb = getCarBounds(b);
    var dx = a.x - b.x;
    var dz = a.z - b.z;
    var dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < 0.01) { dx = 1; dz = 0; dist = 1; }
    var overlapX = (ba.maxX - ba.minX + bb.maxX - bb.minX) / 2 - Math.abs(dx);
    var overlapZ = (ba.maxZ - ba.minZ + bb.maxZ - bb.minZ) / 2 - Math.abs(dz);
    var overlap = Math.min(overlapX, overlapZ);
    if (overlap > 0) {
      var nx = dx / dist;
      var nz = dz / dist;
      var push = overlap * 0.5 + 0.1;
      a.x += nx * push;
      a.z += nz * push;
      b.x -= nx * push;
      b.z -= nz * push;
      a.speed *= 0.5;
      b.speed *= 0.5;
    }
  }

  function findNearestRoad(x, z) {
    var best = null;
    var bestDist = Infinity;
    for (var i = 0; i < world3d.roads.length; i++) {
      var road = world3d.roads[i];
      var dx, dz;
      if (Math.abs(Math.cos(road.angle)) > 0.7) {
        dx = Math.abs(x - road.x);
        var zMin = road.z;
        var zMax = road.z + road.length;
        if (z < zMin) { dz = zMin - z; }
        else if (z > zMax) { dz = z - zMax; }
        else { dz = 0; }
      } else {
        dz = Math.abs(z - road.z);
        var xMin = road.x;
        var xMax = road.x + road.length;
        if (x < xMin) { dx = xMin - x; }
        else if (x > xMax) { dx = x - xMax; }
        else { dx = 0; }
      }
      var dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < bestDist) {
        bestDist = dist;
        best = road;
      }
    }
    return best;
  }

  function getRoadDirection(road) {
    if (Math.abs(Math.cos(road.angle)) > 0.7) {
      return { dx: 0, dz: 1, angle: Math.PI / 2 };
    }
    return { dx: 1, dz: 0, angle: 0 };
  }

  function getForwardPos(car) {
    return {
      x: car.x + Math.cos(car.angle) * (MESH.carLength / 2),
      z: car.z + Math.sin(car.angle) * (MESH.carLength / 2),
    };
  }

  function getRearPos(car) {
    return {
      x: car.x - Math.cos(car.angle) * (MESH.carLength / 2),
      z: car.z - Math.sin(car.angle) * (MESH.carLength / 2),
    };
  }

  function isCarAhead(a, b) {
    if (!b.alive || b.exploding) return false;
    var dx = b.x - a.x;
    var dz = b.z - a.z;
    var dot = dx * Math.cos(a.angle) + dz * Math.sin(a.angle);
    return dot > 0;
  }

  function distance(a, b) {
    var dx = a.x - b.x;
    var dz = a.z - b.z;
    return Math.sqrt(dx * dx + dz * dz);
  }

  function updateCarAI(car, dt, allCars) {
    if (!car.alive || car.exploding || car.parked) return;

    var road = findNearestRoad(car.x, car.z);
    if (!road) {
      road = world3d.roads[random.int ? random.int(world3d.roads.length) : Math.floor(Math.random() * world3d.roads.length)];
    }
    var rdir = getRoadDirection(road);
    car.aiTarget.x = car.x + rdir.dx * 200;
    car.aiTarget.z = car.z + rdir.dz * 200;

    var targetAngle = Math.atan2(car.aiTarget.z - car.z, car.aiTarget.x - car.x);
    if (!car.parked) {
      var angleDiff = targetAngle - car.angle;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      car.angle += angleDiff * Math.min(1, dt * 3);

      var stop = false;
      for (var i = 0; i < allCars.length; i++) {
        var other = allCars[i];
        if (other === car || !other.alive || other.exploding || other.parked) continue;
        if (isCarAhead(car, other)) {
          var dist = distance(car, other);
          if (dist < TRAFFIC.stopDist) {
            stop = true;
            break;
          }
          if (dist < TRAFFIC.minFollowDist) {
            car.aiSpeed = Math.max(2, other.speed * 0.8);
            break;
          }
        }
      }

      for (var j = 0; j < parkedCars.length; j++) {
        var parked = parkedCars[j];
        if (isCarAhead(car, parked)) {
          var d = distance(car, parked);
          if (d < TRAFFIC.stopDist) {
            stop = true;
            break;
          }
        }
      }

      if (playerCar && playerCar !== car && isCarAhead(car, playerCar)) {
        var pd = distance(car, playerCar);
        if (pd < TRAFFIC.stopDist) stop = true;
        else if (pd < TRAFFIC.minFollowDist) car.aiSpeed = Math.max(2, playerCar.speed * 0.8);
      }

      var margin = 30;
      if (car.x < -WORLD_W / 2 + margin) { car.angle = 0; }
      if (car.x > WORLD_W / 2 - margin) { car.angle = Math.PI; }
      if (car.z < -WORLD_H / 2 + margin) { car.angle = Math.PI / 2; }
      if (car.z > WORLD_H / 2 - margin) { car.angle = -Math.PI / 2; }

      if (carCollidesWorld(car, world3d.collisionBoxes)) {
        car.angle += Math.PI * 0.7;
        car.speed = -car.speed * 0.4;
      }

      if (stop) {
        car.aiSpeed = Math.max(0, car.aiSpeed - dt * CAR_TYPES[car.type].brake * 3);
      } else {
        car.aiSpeed = Math.min(CAR_TYPES[car.type].speed * 0.8, car.aiSpeed + dt * CAR_TYPES[car.type].accel * 2);
      }

      car.speed = car.speed + (car.aiSpeed - car.speed) * Math.min(1, dt * 4);
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.z += Math.sin(car.angle) * car.speed * dt;
      car.mesh.position.x = car.x;
      car.mesh.position.z = car.z;
      car.mesh.rotation.y = car.angle;

      var wheelSpeed = car.speed * dt * 8;
      for (var w = 0; w < car.wheelMeshes.length; w++) {
        car.wheelMeshes[w].rotation.x += wheelSpeed;
      }

      if (car.sirenOn && !car.parked) {
        var flicker = Math.sin(Date.now() * 0.01) > 0;
        for (var l = 0; l < car.lightbarMeshes.length; l++) {
          if (car.lightbarMeshes[l]) {
            car.lightbarMeshes[l].visible = flicker || (l === 0);
          }
        }
      }
    }
  }

  function spawnTraffic() {
    if (trafficCars.length >= TRAFFIC.maxCars) return;
    var types = ['sedan', 'sedan', 'sedan', 'sedan', 'sedan', 'taxi', 'taxi', 'truck', 'sports', 'police', 'comet'];
    var t = random.pick(types);
    var road = random.pick(world3d.roads);
    var rdir = getRoadDirection(road);
    var laneOffset = random.float(-ROAD.laneWidth, ROAD.laneWidth);
    var x, z;
    if (Math.abs(Math.cos(road.angle)) > 0.7) {
      x = road.x + laneOffset;
      z = road.z + random.float(0, road.length * 0.3);
    } else {
      x = road.x + random.float(0, road.length * 0.3);
      z = road.z + laneOffset;
    }
    var car = createCar(t, x, z, rdir.angle, false);
    car.speed = car.aiSpeed * 0.5;
  }

  function spawnParked() {
    if (parkedCars.length >= TRAFFIC.maxParked) return;
    var road = random.pick(world3d.roads);
    var rdir = getRoadDirection(road);
    var x, z;
    if (Math.abs(Math.cos(road.angle)) > 0.7) {
      x = road.x + (random.bool() ? ROAD.width / 2 + BLOCK.sidewalk * 0.5 : -ROAD.width / 2 - BLOCK.sidewalk * 0.5);
      z = road.z + random.float(0, road.length);
    } else {
      x = road.x + random.float(0, road.length);
      z = road.z + (random.bool() ? ROAD.width / 2 + BLOCK.sidewalk * 0.5 : -ROAD.width / 2 - BLOCK.sidewalk * 0.5);
    }
    var types = ['sedan', 'sedan', 'sedan', 'taxi', 'truck', 'comet'];
    createCar(random.pick(types), x, z, rdir.angle, true);
  }

  function updateTraffic(dt) {
    trafficTimer += dt;
    if (trafficTimer >= TRAFFIC.spawnInterval) {
      trafficTimer = 0;
      spawnTraffic();
    }
    parkTimer += dt;
    if (parkTimer >= 4) {
      parkTimer = 0;
      if (parkedCars.length < TRAFFIC.maxParked) spawnParked();
    }

    for (var i = trafficCars.length - 1; i >= 0; i--) {
      var car = trafficCars[i];
      if (car.exploding) {
        updateExplosion(car, dt);
        continue;
      }
      if (!car.alive) {
        cleanupCar(car);
        trafficCars.splice(i, 1);
        continue;
      }
      updateCarAI(car, dt, trafficCars);
      if (Math.abs(car.x) > WORLD_W || Math.abs(car.z) > WORLD_H) {
        cleanupCar(car);
        trafficCars.splice(i, 1);
        continue;
      }
    }

    for (var j = trafficCars.length - 1; j >= 0; j--) {
      for (var k = j + 1; k < trafficCars.length; k++) {
        if (carCollidesCar(trafficCars[j], trafficCars[k])) {
          pushCarsApart(trafficCars[j], trafficCars[k]);
          applyDamage(trafficCars[j], 5 * dt);
          applyDamage(trafficCars[k], 5 * dt);
        }
      }
    }

    for (var pi = 0; pi < parkedCars.length; pi++) {
      for (var ti = 0; ti < trafficCars.length; ti++) {
        if (carCollidesCar(parkedCars[pi], trafficCars[ti])) {
          pushCarsApart(parkedCars[pi], trafficCars[ti]);
          applyDamage(trafficCars[ti], 8 * dt);
        }
      }
    }

    if (playerCar && playerCar.alive && !playerCar.exploding) {
      for (var ci = 0; ci < trafficCars.length; ci++) {
        if (carCollidesCar(playerCar, trafficCars[ci])) {
          pushCarsApart(playerCar, trafficCars[ci]);
          applyDamage(playerCar, 3 * dt);
          applyDamage(trafficCars[ci], 6 * dt);
        }
      }
      for (var pj = 0; pj < parkedCars.length; pj++) {
        if (carCollidesCar(playerCar, parkedCars[pj])) {
          pushCarsApart(playerCar, parkedCars[pj]);
          applyDamage(playerCar, 5 * dt);
        }
      }
      if (carCollidesWorld(playerCar, world3d.collisionBoxes)) {
        applyDamage(playerCar, 10 * dt);
      }
    }

    updateEffects(dt);
  }

  function createSmokeTexture() {
    var canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    var ctx = canvas.getContext('2d');
    var grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,0.9)');
    grad.addColorStop(0.3, 'rgba(200,200,200,0.6)');
    grad.addColorStop(0.7, 'rgba(100,100,100,0.2)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(canvas);
  }

  var smokeTex = null;

  function getSmokeTex() {
    if (!smokeTex) smokeTex = createSmokeTexture();
    return smokeTex;
  }

  function updateEffects(dt) {
    for (var i = effects.length - 1; i >= 0; i--) {
      var eff = effects[i];
      eff.life -= dt;
      if (eff.life <= 0) {
        if (eff.mesh) {
          world3d.scene.remove(eff.mesh);
          if (eff.mesh.geometry) eff.mesh.geometry.dispose();
          if (eff.mesh.material) eff.mesh.material.dispose();
        }
        effects.splice(i, 1);
        continue;
      }
      eff.mesh.position.x += eff.vx * dt;
      eff.mesh.position.y += eff.vy * dt;
      eff.mesh.position.z += eff.vz * dt;
      eff.mesh.scale.setScalar(eff.mesh.scale.x + dt * 2);
      if (eff.mesh.material && eff.mesh.material.opacity !== undefined) {
        eff.mesh.material.opacity = Math.max(0, eff.life / eff.maxLife);
      }
    }
  }

  function applyDamage(car, amount) {
    if (!car.alive || car.exploding) return;
    car.health -= amount;
    if (car.health <= 0) {
      car.health = 0;
      explode(car);
      return;
    }
    var healthPct = car.health / car.maxHealth;
    if (healthPct < 0.25 && !car.flamesMesh) {
      var tex = getSmokeTex();
      var fireMat = new THREE.MeshBasicMaterial({
        map: tex,
        color: 0xff4400,
        transparent: true,
        opacity: 0.8,
        side: THREE.DoubleSide,
      });
      var fireGeo = new THREE.PlaneGeometry(2, 2);
      car.flamesMesh = new THREE.Mesh(fireGeo, fireMat);
      car.flamesMesh.position.y = MESH.carBodyH * 0.8;
      car.mesh.add(car.flamesMesh);
    }
    if (healthPct < 0.5 && !car.damageSmoke) {
      car.damageSmoke = true;
      var tex2 = getSmokeTex();
      var smokeMat = new THREE.MeshBasicMaterial({
        map: tex2,
        color: 0x555555,
        transparent: true,
        opacity: 0.5,
        side: THREE.DoubleSide,
      });
      var smokeGeo = new THREE.PlaneGeometry(2, 2);
      car.smokeMesh = new THREE.Mesh(smokeGeo, smokeMat);
      car.smokeMesh.position.y = MESH.carBodyH * 0.5;
      car.mesh.add(car.smokeMesh);
    }
  }

  function updateExplosion(car, dt) {
    car.explodeTimer -= dt;
    if (car.flamesMesh) {
      car.flamesMesh.material.opacity = Math.max(0, car.explodeTimer / 2);
    }
    if (car.smokeMesh) {
      car.smokeMesh.material.opacity = Math.max(0, car.explodeTimer / 2);
    }
    if (car.explodeTimer <= 0) {
      cleanupCar(car);
      car.alive = false;
    }
  }

  function explode(car) {
    if (car.exploding) return;
    car.exploding = true;
    car.explodeTimer = 2;
    car.speed = 0;
    audio.playExplosion();

    var tex = getSmokeTex();
    for (var i = 0; i < 12; i++) {
      var particleMat = new THREE.MeshBasicMaterial({
        color: random.pick([0xff4400, 0xff8800, 0xffcc00, 0x333333, 0xff6600]),
        transparent: true,
        opacity: 1,
      });
      var particleGeo = new THREE.SphereGeometry(0.3 + random.float(0, 0.5), 4, 4);
      var particle = new THREE.Mesh(particleGeo, particleMat);
      particle.position.copy(car.mesh.position);
      particle.position.y += 1;
      world3d.scene.add(particle);
      var speed = 4 + random.float(0, 8);
      var angle = random.angle();
      effects.push({
        mesh: particle,
        vx: Math.cos(angle) * speed,
        vy: 2 + random.float(0, 5),
        vz: Math.sin(angle) * speed,
        life: 1 + random.float(0, 1),
        maxLife: 1.5,
      });
    }

    for (var j = 0; j < 8; j++) {
      var smokeMat = new THREE.MeshBasicMaterial({
        map: tex,
        color: random.pick([0x888888, 0x666666, 0x444444, 0x333333]),
        transparent: true,
        opacity: 0.7,
        side: THREE.DoubleSide,
      });
      var smokeGeo = new THREE.PlaneGeometry(2 + random.float(0, 2), 2 + random.float(0, 2));
      var smoke = new THREE.Mesh(smokeGeo, smokeMat);
      smoke.position.copy(car.mesh.position);
      smoke.position.y += random.float(0.5, 2);
      world3d.scene.add(smoke);
      effects.push({
        mesh: smoke,
        vx: random.float(-2, 2),
        vy: 1 + random.float(0, 3),
        vz: random.float(-2, 2),
        life: 2 + random.float(0, 2),
        maxLife: 3,
      });
    }
  }

  function cleanupCar(car) {
    if (car.mesh && car.mesh.parent) {
      world3d.scene.remove(car.mesh);
      disposeGroup(car.mesh);
    }
    if (car === playerCar) {
      playerCar = null;
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

  function enterCar(car, playerMesh) {
    if (!car || !car.alive || car.exploding) return false;
    var idx = trafficCars.indexOf(car);
    if (idx !== -1) {
      trafficCars.splice(idx, 1);
    }
    var pi = parkedCars.indexOf(car);
    if (pi !== -1) {
      parkedCars.splice(pi, 1);
    }
    car.parked = false;
    if (playerCar) exitCar({ x: car.x + 3, z: car.z + 3 });
    playerCar = car;
    if (playerMesh) playerMesh.visible = false;
    startEngine(30);
    if (car.isPolice && !car.sirenOn) {
      car.sirenOn = true;
      playSiren(true);
    }
    return true;
  }

  function exitCar(pos) {
    if (!playerCar) return false;
    var exitX = pos ? pos.x : playerCar.x + 3;
    var exitZ = pos ? pos.z : playerCar.z + 3;
    if (playerCar.isPolice && playerCar.sirenOn) {
      playerCar.sirenOn = false;
      playSiren(false);
    }
    stopEngine();
    var car = playerCar;
    playerCar = null;
    trafficCars.push(car);
    return { x: exitX, z: exitZ };
  }

  function updatePlayerCar(dt, input) {
    if (!playerCar || !playerCar.alive || playerCar.exploding) return;
    var car = playerCar;
    var cfg = CAR_TYPES[car.type];
    var throttle = input.moveY();
    var steering = input.moveX();
    var handbrake = input.isSprint ? input.isSprint() : false;

    if (throttle > 0.1) {
      car.speed += cfg.accel * throttle * dt;
    } else if (throttle < -0.1) {
      car.speed += cfg.brake * throttle * dt;
    } else {
      car.speed *= Math.pow(0.01, dt);
    }

    car.speed = Math.max(-cfg.speed * 0.5, Math.min(cfg.speed, car.speed));

    var steerRate = steering * 3.5 * (Math.abs(car.speed) / cfg.speed);
    if (handbrake) {
      steerRate *= 2;
      car.speed *= 0.98;
    }
    car.angle += steerRate * dt;

    car.x += Math.cos(car.angle) * car.speed * dt;
    car.z += Math.sin(car.angle) * car.speed * dt;

    var boundsMargin = 5;
    car.x = Math.max(-WORLD_W / 2 + boundsMargin, Math.min(WORLD_W / 2 - boundsMargin, car.x));
    car.z = Math.max(-WORLD_H / 2 + boundsMargin, Math.min(WORLD_H / 2 - boundsMargin, car.z));

    car.mesh.position.x = car.x;
    car.mesh.position.z = car.z;
    car.mesh.rotation.y = car.angle;

    var wheelSpin = car.speed * dt * 8;
    for (var w = 0; w < car.wheelMeshes.length; w++) {
      car.wheelMeshes[w].rotation.x += wheelSpin;
    }

    var rpm = Math.abs(car.speed) * 40 + 30;
    setEngineRPM(rpm);

    if (car.sirenOn) {
      var flicker = Math.sin(Date.now() * 0.01) > 0;
      for (var l = 0; l < car.lightbarMeshes.length; l++) {
        if (car.lightbarMeshes[l]) {
          car.lightbarMeshes[l].visible = flicker || (l === 0);
        }
      }
    }

    if (car.damageSmoke && car.smokeMesh) {
      car.smokeMesh.position.y = MESH.carBodyH * 0.5 + Math.sin(Date.now() * 0.01) * 0.2;
    }
    if (car.flamesMesh) {
      car.flamesMesh.position.y = MESH.carBodyH * 0.8 + Math.sin(Date.now() * 0.02) * 0.3;
    }
  }

  for (var i = 0; i < 8; i++) {
    spawnTraffic();
  }
  for (var j = 0; j < 15; j++) {
    spawnParked();
  }

  return {
    trafficCars: trafficCars,
    parkedCars: parkedCars,
    get playerCar() { return playerCar; },
    createCar: createCar,
    updateCarAI: updateCarAI,
    spawnTraffic: spawnTraffic,
    spawnParked: spawnParked,
    updateTraffic: updateTraffic,
    getCarBounds: getCarBounds,
    carCollidesWorld: carCollidesWorld,
    carCollidesCar: carCollidesCar,
    applyDamage: applyDamage,
    explode: explode,
    enterCar: enterCar,
    exitCar: exitCar,
    updatePlayerCar: updatePlayerCar,
    effects: effects,
  };
}