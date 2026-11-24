// Player module for Port Azura: 3D character mesh, walking movement with collision,
// wall sliding, walking animation, and water boundary enforcement.

import { PLAYER, WORLD_W, WORLD_H } from './config.js';

export function createPlayer(world3d) {
  var player = {
    mesh: null,
    x: 0,
    z: 0,
    angle: 0,
    speed: 0,
    health: PLAYER.maxHealth,
    armour: 0,
    weaponIdx: 0,
    inCar: false,
    car: null,
    cash: 500,
    respect: 0,
    wantedLevel: 0,
    wantedHeat: 0,
    missionActive: null,
    missionStep: 0,
  };

  var leftLeg = null;
  var rightLeg = null;
  var leftArm = null;
  var rightArm = null;
  var stepCycle = 0;
  var lastMove = false;
  var smgWeapon = null;
  var muzzleFlashMesh = null;
  var _firingPose = false;

  function buildPlayerMesh() {
    var group = new THREE.Group();

    var skinMat = new THREE.MeshPhongMaterial({ color: 0xd4a574, specular: 0x000000, shininess: 5 });
    var shirtMat = new THREE.MeshPhongMaterial({ color: 0x3366aa, specular: 0x000000, shininess: 5 });
    var pantsMat = new THREE.MeshPhongMaterial({ color: 0x222244, specular: 0x000000, shininess: 5 });
    var shoeMat = new THREE.MeshPhongMaterial({ color: 0x111111, specular: 0x000000, shininess: 10 });

    var headGeo = new THREE.SphereGeometry(0.3, 8, 6);
    var head = new THREE.Mesh(headGeo, skinMat);
    head.position.y = 1.7;
    head.castShadow = true;
    group.add(head);

    var torsoGeo = new THREE.BoxGeometry(0.7, 1.2, 0.4);
    var torso = new THREE.Mesh(torsoGeo, shirtMat);
    torso.position.y = 1.0;
    torso.castShadow = true;
    group.add(torso);

    var armGeo = new THREE.BoxGeometry(0.2, 1.0, 0.2);
    leftArm = new THREE.Mesh(armGeo, shirtMat);
    leftArm.position.set(0.45, 1.05, 0);
    leftArm.castShadow = true;
    group.add(leftArm);

    rightArm = new THREE.Mesh(armGeo, shirtMat);
    rightArm.position.set(-0.45, 1.05, 0);
    rightArm.castShadow = true;
    group.add(rightArm);

    var legGeo = new THREE.BoxGeometry(0.25, 1.0, 0.25);
    leftLeg = new THREE.Mesh(legGeo, pantsMat);
    leftLeg.position.set(0.15, -0.5, 0);
    leftLeg.castShadow = true;
    group.add(leftLeg);

    rightLeg = new THREE.Mesh(legGeo, pantsMat);
    rightLeg.position.set(-0.15, -0.5, 0);
    rightLeg.castShadow = true;
    group.add(rightLeg);

    var footGeo = new THREE.BoxGeometry(0.25, 0.15, 0.35);
    var leftFoot = new THREE.Mesh(footGeo, shoeMat);
    leftFoot.position.set(0.15, -1.1, 0.05);
    leftFoot.castShadow = true;
    group.add(leftFoot);

    var rightFoot = new THREE.Mesh(footGeo, shoeMat);
    rightFoot.position.set(-0.15, -1.1, 0.05);
    rightFoot.castShadow = true;
    group.add(rightFoot);

    player.mesh = group;
    world3d.scene.add(group);

    return player;
  }

  function boxOverlap(a, b) {
    if (a.maxX < b.minX || a.minX > b.maxX) return false;
    if (a.maxZ < b.minZ || a.minZ > b.maxZ) return false;
    return true;
  }

  function playerBounds(px, pz) {
    var r = PLAYER.radius;
    return { minX: px - r, maxX: px + r, minZ: pz - r, maxZ: pz + r };
  }

  function resolveCollision(px, pz, collisionBoxes) {
    var rb = playerBounds(px, pz);
    var resolved = false;
    for (var i = 0; i < collisionBoxes.length; i++) {
      var box = collisionBoxes[i];
      if (!boxOverlap(rb, box)) continue;

      var overlapX = Math.min(rb.maxX - box.minX, box.maxX - rb.minX);
      var overlapZ = Math.min(rb.maxZ - box.minZ, box.maxZ - rb.minZ);

      if (overlapX < overlapZ) {
        if (rb.maxX - box.minX < box.maxX - rb.minX) {
          px = box.minX - PLAYER.radius;
        } else {
          px = box.maxX + PLAYER.radius;
        }
      } else {
        if (rb.maxZ - box.minZ < box.maxZ - rb.minZ) {
          pz = box.minZ - PLAYER.radius;
        } else {
          pz = box.maxZ + PLAYER.radius;
        }
      }
      rb = playerBounds(px, pz);
      resolved = true;
    }
    return { x: px, z: pz, hit: resolved };
  }

  function updatePlayer(dt, input, collisionBoxes, cars, bridges) {
    if (player.inCar) return;

    var moveY = input.moveY();
    var moveX = input.moveX();
    var sprinting = input.isSprint();
    var spd = sprinting ? PLAYER.sprintSpeed : PLAYER.speed;

    var moved = (Math.abs(moveX) > 0.01 || Math.abs(moveY) > 0.01);

    if (moved) {
      var tx = moveX * spd * dt;
      var ty = moveY * spd * dt;
      var newX = player.x + Math.cos(player.angle) * moveY * spd * dt - Math.sin(player.angle) * moveX * spd * dt;
      var newZ = player.z + Math.sin(player.angle) * moveY * spd * dt + Math.cos(player.angle) * moveX * spd * dt;

      var resolved = resolveCollision(newX, newZ, collisionBoxes);
      player.x = resolved.x;
      player.z = resolved.z;

      if (cars) {
        for (var i = 0; i < cars.length; i++) {
          var c = cars[i];
          if (!c.alive || c.exploding) continue;
          var cb = c.bounds ? c.bounds : { minX: c.x - 3, maxX: c.x + 3, minZ: c.z - 3, maxZ: c.z + 3 };
          var pb = playerBounds(player.x, player.z);
          if (boxOverlap(pb, cb)) {
            var dx = player.x - c.x;
            var dz = player.z - c.z;
            var dist = Math.sqrt(dx * dx + dz * dz);
            if (dist < 0.01) { dx = 1; dz = 0; dist = 1; }
            player.x = c.x + (dx / dist) * (3 + PLAYER.radius + 0.5);
            player.z = c.z + (dz / dist) * (3 + PLAYER.radius + 0.5);
          }
        }
      }

      stepCycle += dt * spd * 0.6;
      lastMove = true;
    } else {
      lastMove = false;
    }

    var legSwing = Math.sin(stepCycle) * 0.5;
    if (leftLeg && rightLeg) {
      if (lastMove) {
        leftLeg.rotation.x = legSwing;
        rightLeg.rotation.x = -legSwing;
        if (leftArm) leftArm.rotation.x = -legSwing * 0.7;
        if (rightArm) rightArm.rotation.x = legSwing * 0.7;
      } else {
        leftLeg.rotation.x *= 0.9;
        rightLeg.rotation.x *= 0.9;
        if (leftArm) leftArm.rotation.x *= 0.9;
        if (rightArm) rightArm.rotation.x *= 0.9;
      }
    }

    var halfW = WORLD_W / 2;
    var halfH = WORLD_H / 2;
    player.x = Math.max(-halfW + 2, Math.min(halfW - 2, player.x));
    player.z = Math.max(-halfH + 2, Math.min(halfH - 2, player.z));

    if (world3d.seaLevel !== undefined && world3d.beachZ !== undefined) {
      var waterEdge = world3d.beachZ + 10;
      if (player.z > waterEdge) {
        player.z = waterEdge;
      }
    }

    player.mesh.position.x = player.x;
    player.mesh.position.z = player.z;
    player.mesh.rotation.y = player.angle;
  }

  function getPlayerPosition() {
    return { x: player.x, z: player.z, angle: player.angle };
  }

  function setPlayerPosition(x, z, angle) {
    player.x = x;
    player.z = z;
    if (angle !== undefined) player.angle = angle;
    player.mesh.position.x = x;
    player.mesh.position.z = z;
    player.mesh.rotation.y = player.angle;
  }

  function createSMGWeapon() {
    if (smgWeapon) return smgWeapon;
    var group = new THREE.Group();

    var metalMat = new THREE.MeshPhongMaterial({ color: 0x333333, specular: 0x111111, shininess: 30 });
    var darkMetal = new THREE.MeshPhongMaterial({ color: 0x222222, specular: 0x000000, shininess: 20 });

    var bodyGeo = new THREE.BoxGeometry(0.12, 0.14, 0.5);
    var body = new THREE.Mesh(bodyGeo, metalMat);
    body.position.set(0, 0, 0);
    body.castShadow = true;
    group.add(body);

    var barrelGeo = new THREE.CylinderGeometry(0.03, 0.04, 0.35, 6);
    var barrel = new THREE.Mesh(barrelGeo, darkMetal);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.02, 0.4);
    barrel.castShadow = true;
    group.add(barrel);

    var magGeo = new THREE.BoxGeometry(0.06, 0.25, 0.08);
    var mag = new THREE.Mesh(magGeo, metalMat);
    mag.position.set(0, -0.18, -0.05);
    group.add(mag);

    var gripGeo = new THREE.BoxGeometry(0.08, 0.16, 0.06);
    var grip = new THREE.Mesh(gripGeo, darkMetal);
    grip.position.set(0, -0.12, -0.1);
    grip.rotation.x = 0.2;
    group.add(grip);

    var stockGeo = new THREE.BoxGeometry(0.08, 0.08, 0.15);
    var stock = new THREE.Mesh(stockGeo, metalMat);
    stock.position.set(0, 0.02, -0.3);
    group.add(stock);

    player.mesh.add(group);
    smgWeapon = group;
    return group;
  }

  function setFiringPose() {
    _firingPose = true;
    createSMGWeapon();
    if (smgWeapon) {
      smgWeapon.visible = true;
      smgWeapon.position.set(0.0, 1.05, 0.5);
      smgWeapon.rotation.set(0, 0, 0);
    }
    if (leftArm) {
      leftArm.rotation.set(-1.5, 0, 0.3);
      leftArm.position.set(0.45, 1.05, 0.25);
    }
    if (rightArm) {
      rightArm.rotation.set(-1.5, 0, -0.3);
      rightArm.position.set(-0.45, 1.05, 0.3);
    }
    if (muzzleFlashMesh) {
      muzzleFlashMesh.visible = true;
      muzzleFlashMesh.position.set(0, 1.1, 0.95);
    }
  }

  function resetPose() {
    _firingPose = false;
    if (smgWeapon) smgWeapon.visible = false;
    if (leftArm) {
      leftArm.rotation.set(0, 0, 0);
      leftArm.position.set(0.45, 1.05, 0);
    }
    if (rightArm) {
      rightArm.rotation.set(0, 0, 0);
      rightArm.position.set(-0.45, 1.05, 0);
    }
  }

  function createMuzzleFlashPermanent() {
    if (muzzleFlashMesh) return muzzleFlashMesh;
    var flashGeo = new THREE.SphereGeometry(0.15, 6, 6);
    var flashMat = new THREE.MeshBasicMaterial({ color: 0xffee44, transparent: true, opacity: 0.9 });
    muzzleFlashMesh = new THREE.Mesh(flashGeo, flashMat);
    muzzleFlashMesh.visible = false;
    player.mesh.add(muzzleFlashMesh);
    return muzzleFlashMesh;
  }

  function getMuzzleFlashPos() {
    if (!_firingPose || !player.mesh) return null;
    var wp = new THREE.Vector3(0, 1.1, 0.95);
    player.mesh.localToWorld(wp);
    return wp;
  }

  buildPlayerMesh();

  return {
    player: player,
    updatePlayer: updatePlayer,
    getPlayerPosition: getPlayerPosition,
    setPlayerPosition: setPlayerPosition,
    setFiringPose: setFiringPose,
    resetPose: resetPose,
    createMuzzleFlashPermanent: createMuzzleFlashPermanent,
    getMuzzleFlashPos: getMuzzleFlashPos,
    get firingPose() { return _firingPose; },
  };
}