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
    return new THREE.MeshPhongMaterial({ color: hexColor, specular: 0x444444, shininess: 40 });
  }

  function createCabinMaterial() {
    return new THREE.MeshPhongMaterial({
      color: 0x1a1a33,
      specular: 0x666666,
      shininess: 80,
      transparent: true,
      opacity: 0.55,
    });
  }

  function createWheelMaterial() {
    return new THREE.MeshPhongMaterial({ color: 0x1a1a1a, specular: 0x111111, shininess: 10 });
  }

  function createHubMaterial() {
    return new THREE.MeshPhongMaterial({ color: 0xaaaaaa, specular: 0x444444, shininess: 30 });
  }

  function createHeadlightMaterial() {
    return new THREE.MeshBasicMaterial({ color: 0xffffdd });
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
    const isTaxi = type === 'taxi';
    const isPolice = type === 'police';
    const isTruck = type === 'truck';
    const isPlayer = !parked && type === 'sports';

    const group = new THREE.Group();

    const bodyColor = cfg.colour;
    const bodyMat = createBodyMaterial(bodyColor);
    const trimMat = new THREE.MeshPhongMaterial({ color: 0x3a3a3a, specular: 0x222222, shininess: 20 });
    const cabFrameMat = new THREE.MeshPhongMaterial({ color: bodyColor, specular: 0x444444, shininess: 30 });

    // --- Lower body slab (the main body) ---
    const bodyGeo = new THREE.BoxGeometry(cl * 0.84, bodyH * 0.8, cw * 0.9);
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.set(0, wr + bodyH * 0.42, 0);
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    // --- Hood section (front, slightly lower than cabin roof) ---
    const hoodGeo = new THREE.BoxGeometry(cl * 0.24, bodyH * 0.38, cw * 0.88);
    const hood = new THREE.Mesh(hoodGeo, bodyMat);
    hood.position.set(cl * 0.32, wr + bodyH * 0.65, 0);
    hood.castShadow = true;
    group.add(hood);

    // --- Trunk section (rear) ---
    const trunkGeo = new THREE.BoxGeometry(cl * 0.16, bodyH * 0.32, cw * 0.88);
    const trunk = new THREE.Mesh(trunkGeo, bodyMat);
    trunk.position.set(-cl * 0.34, wr + bodyH * 0.60, 0);
    trunk.castShadow = true;
    group.add(trunk);

    // --- Front bumper (dark grey bar) ---
    const fBumperGeo = new THREE.BoxGeometry(0.3, bodyH * 0.28, cw * 0.8);
    const fBumper = new THREE.Mesh(fBumperGeo, trimMat);
    fBumper.position.set(cl / 2 - 0.35, wr + bodyH * 0.18, 0);
    group.add(fBumper);

    // --- Rear bumper (dark grey bar) ---
    const rBumperGeo = new THREE.BoxGeometry(0.3, bodyH * 0.28, cw * 0.8);
    const rBumper = new THREE.Mesh(rBumperGeo, trimMat);
    rBumper.position.set(-cl / 2 + 0.35, wr + bodyH * 0.18, 0);
    group.add(rBumper);

    // --- Grille panel (front fascia, dark grey) ---
    const grilleGeo = new THREE.BoxGeometry(0.08, bodyH * 0.35, cw * 0.55);
    const grille = new THREE.Mesh(grilleGeo, trimMat);
    grille.position.set(cl / 2 - 0.12, wr + bodyH * 0.48, 0);
    group.add(grille);

    // --- Headlights (pale blocks set into front fascia) ---
    const hlGeo = new THREE.BoxGeometry(0.15, bodyH * 0.14, 0.7);
    const hlMat = createHeadlightMaterial();
    const hlL = new THREE.Mesh(hlGeo, hlMat);
    hlL.position.set(cl / 2 - 0.08, wr + bodyH * 0.48, cw * 0.3);
    group.add(hlL);
    const hlR = new THREE.Mesh(hlGeo, hlMat);
    hlR.position.set(cl / 2 - 0.08, wr + bodyH * 0.48, -cw * 0.3);
    group.add(hlR);

    // --- Taillights (red blocks at rear) ---
    const tlGeo = new THREE.BoxGeometry(0.12, bodyH * 0.12, 0.55);
    const tlMat = createTaillightMaterial();
    const tlL = new THREE.Mesh(tlGeo, tlMat);
    tlL.position.set(-cl / 2 + 0.08, wr + bodyH * 0.48, cw * 0.3);
    group.add(tlL);
    const tlR = new THREE.Mesh(tlGeo, tlMat);
    tlR.position.set(-cl / 2 + 0.08, wr + bodyH * 0.48, -cw * 0.3);
    group.add(tlR);

    // --- Wheel arch trim (dark grey flares above each wheel) ---
    const wheelArches = [
      { x: cl * 0.3, z: cw / 2 + 0.05 },
      { x: cl * 0.3, z: -cw / 2 - 0.05 },
      { x: -cl * 0.3, z: cw / 2 + 0.05 },
      { x: -cl * 0.3, z: -cw / 2 - 0.05 },
    ];
    for (var ai = 0; ai < wheelArches.length; ai++) {
      var ap = wheelArches[ai];
      var archGeo = new THREE.BoxGeometry(1.2, bodyH * 0.18, 2.2);
      var arch = new THREE.Mesh(archGeo, trimMat);
      arch.position.set(ap.x, wr + bodyH * 0.32, ap.z);
      group.add(arch);
    }

    // --- Cabin (tall body-coloured box with glass) ---
    const cabW = cw * 0.78;
    const cabL = cl * 0.36;
    const cabY = wr + bodyH * 0.8 + cabinH / 2;
    const cabZ = -0.2;

    // Cabin frame — body colour
    const cabinFrameGeo = new THREE.BoxGeometry(cabL, cabinH, cabW);
    const cabinFrame = new THREE.Mesh(cabinFrameGeo, cabFrameMat);
    cabinFrame.position.set(-cl * 0.02, cabY, cabZ);
    cabinFrame.castShadow = true;
    group.add(cabinFrame);

    // Cabin glass — dark, glossy, slightly smaller than frame
    const glassGeo = new THREE.BoxGeometry(cabL * 0.85, cabinH * 0.72, cabW * 0.82);
    const cabinMat = createCabinMaterial();
    const glass = new THREE.Mesh(glassGeo, cabinMat);
    glass.position.set(-cl * 0.02, cabY, cabZ);
    group.add(glass);

    // A-pillars (body-coloured vertical strips at cabin front corners)
    const aPillarGeo = new THREE.BoxGeometry(0.15, cabinH * 0.8, cabW * 0.06);
    for (var ap2 = -1; ap2 <= 1; ap2 += 2) {
      var aPillar = new THREE.Mesh(aPillarGeo, cabFrameMat);
      aPillar.position.set(cl * 0.1, cabY, cabZ + ap2 * (cabW * 0.4));
      group.add(aPillar);
    }

    // Flat roof cap
    const roofGeo = new THREE.BoxGeometry(cabL * 0.96, 0.1, cabW * 0.96);
    const roof = new THREE.Mesh(roofGeo, cabFrameMat);
    roof.position.set(-cl * 0.02, cabY + cabinH / 2 + 0.05, cabZ);
    group.add(roof);

    // --- Police door panels ---
    if (isPolice) {
      var doorGeo = new THREE.BoxGeometry(cl * 0.25, bodyH * 0.55, 0.06);
      var doorMat = new THREE.MeshPhongMaterial({ color: 0xf0f0f0, specular: 0x444444, shininess: 30 });
      var doorL = new THREE.Mesh(doorGeo, doorMat);
      doorL.position.set(-cl * 0.05, wr + bodyH * 0.38, cw / 2 - 0.2);
      group.add(doorL);
      var doorR = new THREE.Mesh(doorGeo.clone(), doorMat);
      doorR.position.set(-cl * 0.05, wr + bodyH * 0.38, -(cw / 2 - 0.2));
      group.add(doorR);
    }

    // --- Taxi sign (roof sign) ---
    if (isTaxi) {
      var signGeo = new THREE.BoxGeometry(cl * 0.15, 0.22, cw * 0.35);
      var signMat = new THREE.MeshBasicMaterial({ color: 0xf5c842 });
      var sign = new THREE.Mesh(signGeo, signMat);
      sign.position.set(0, cabY + cabinH / 2 + 0.16, cabZ);
      group.add(sign);

      var signTextGeo = new THREE.BoxGeometry(cl * 0.08, 0.16, cw * 0.2);
      var signTextMat = new THREE.MeshBasicMaterial({ color: 0x222222 });
      var signText = new THREE.Mesh(signTextGeo, signTextMat);
      signText.position.set(0, cabY + cabinH / 2 + 0.26, cabZ);
      group.add(signText);
    }

    // --- Truck variant (cargo box) ---
    if (isTruck) {
      var cargoGeo = new THREE.BoxGeometry(cl * 0.55, bodyH * 0.8, cw - 0.4);
      var cargoMat = new THREE.MeshPhongMaterial({ color: 0x999999, specular: 0x222222, shininess: 20 });
      var cargo = new THREE.Mesh(cargoGeo, cargoMat);
      cargo.position.set(-cl * 0.22, wr + bodyH * 0.55, 0);
      cargo.castShadow = true;
      group.add(cargo);
    }

    // --- Wheels (solid black tyre disc + light grey filled hub) ---
    var tyreGeo = new THREE.CylinderGeometry(wr, wr, 0.7, 20);
    var hubDiscGeo = new THREE.CylinderGeometry(wr * 0.7, wr * 0.7, 0.1, 20);
    var hubInnerGeo = new THREE.CylinderGeometry(wr * 0.35, wr * 0.35, 0.07, 16);
    var tyreMat = createWheelMaterial();
    var hubMat = createHubMaterial();

    var wheelPositions = [
      { x: cl * 0.3, z: cw / 2 + 0.05 },
      { x: cl * 0.3, z: -cw / 2 - 0.05 },
      { x: -cl * 0.3, z: cw / 2 + 0.05 },
      { x: -cl * 0.3, z: -cw / 2 - 0.05 },
    ];

    var wheelMeshes = [];
    for (var wi = 0; wi < wheelPositions.length; wi++) {
      var pos = wheelPositions[wi];
      var wheelGroup = new THREE.Group();

      var tyre = new THREE.Mesh(tyreGeo, tyreMat);
      tyre.rotation.z = Math.PI / 2;
      tyre.castShadow = true;
      tyre.receiveShadow = true;
      wheelGroup.add(tyre);

      var hubDisc = new THREE.Mesh(hubDiscGeo, hubMat);
      hubDisc.rotation.z = Math.PI / 2;
      hubDisc.position.z = -0.36;
      wheelGroup.add(hubDisc);

      var hubInner = new THREE.Mesh(hubInnerGeo, tyreMat);
      hubInner.rotation.z = Math.PI / 2;
      hubInner.position.z = -0.42;
      wheelGroup.add(hubInner);

      var boltDotGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.03, 6);
      var boltDotMat = new THREE.MeshPhongMaterial({ color: 0x222222, specular: 0x111111, shininess: 5 });
      for (var bi = 0; bi < 5; bi++) {
        var ba = (bi / 5) * Math.PI * 2 + (wi % 2) * Math.PI / 5;
        var bd = wr * 0.5;
        var bolt = new THREE.Mesh(boltDotGeo, boltDotMat);
        bolt.position.set(Math.cos(ba) * bd, Math.sin(ba) * bd, -0.39);
        bolt.rotation.z = Math.PI / 2;
        wheelGroup.add(bolt);
      }

      wheelGroup.position.set(pos.x, wr, pos.z);
      group.add(wheelGroup);
      wheelMeshes.push(tyre);
    }

    // --- Police lightbar (small, thin, red/blue halves) ---
    var lightbarMeshes = [];
    if (isPolice) {
      var barH = 0.08;
      var barW = cabW * 0.5;
      var barL = cabL * 0.75;
      var halfBarL = barL / 2;
      var barY = cabY + cabinH / 2 + 0.1;

      var barGeoRed = new THREE.BoxGeometry(halfBarL, barH, barW);
      var barMatRed = new THREE.MeshBasicMaterial({ color: 0xff0000 });
      var barRed = new THREE.Mesh(barGeoRed, barMatRed);
      barRed.position.set(halfBarL / 2, barY, cabZ);
      group.add(barRed);
      lightbarMeshes.push(barRed);

      var barGeoBlue = new THREE.BoxGeometry(halfBarL, barH, barW);
      var barMatBlue = new THREE.MeshBasicMaterial({ color: 0x0000ff });
      var barBlue = new THREE.Mesh(barGeoBlue, barMatBlue);
      barBlue.position.set(-halfBarL / 2, barY, cabZ);
      group.add(barBlue);
      lightbarMeshes.push(barBlue);
    }

    // --- Side mirrors ---
    var mirrorGeo = new THREE.BoxGeometry(0.12, 0.15, 0.08);
    var mirrorMat = new THREE.MeshPhongMaterial({ color: 0x1a1a2e, specular: 0x333333, shininess: 30 });
    var mirrorStemGeo = new THREE.BoxGeometry(0.06, 0.06, 0.3);
    var mirrorL = new THREE.Mesh(mirrorGeo, mirrorMat);
    mirrorL.position.set(cl * 0.06, cabY - cabinH * 0.1, cw / 2 - 0.25);
    group.add(mirrorL);
    var stemL = new THREE.Mesh(mirrorStemGeo, cabFrameMat);
    stemL.position.set(cl * 0.06, cabY - cabinH * 0.1, cw / 2 + 0.02);
    group.add(stemL);
    var mirrorR = new THREE.Mesh(mirrorGeo, mirrorMat);
    mirrorR.position.set(cl * 0.06, cabY - cabinH * 0.1, -(cw / 2 - 0.25));
    group.add(mirrorR);
    var stemR = new THREE.Mesh(mirrorStemGeo, cabFrameMat);
    stemR.position.set(cl * 0.06, cabY - cabinH * 0.1, -(cw / 2 + 0.02));
    group.add(stemR);

    group.position.set(x, 0, z);
    group.rotation.y = angle;
    world3d.scene.add(group);

    var car = {
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
      car.flamesMesh.position.y = MESH.wheelRadius + MESH.carBodyH * 0.65;
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
      car.smokeMesh.position.y = MESH.wheelRadius + MESH.carBodyH * 0.35;
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
      car.smokeMesh.position.y = MESH.wheelRadius + MESH.carBodyH * 0.35 + Math.sin(Date.now() * 0.01) * 0.2;
    }
    if (car.flamesMesh) {
      car.flamesMesh.position.y = MESH.wheelRadius + MESH.carBodyH * 0.65 + Math.sin(Date.now() * 0.02) * 0.3;
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