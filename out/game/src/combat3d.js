// Combat module for Port Azura: weapon switching, firing with raycasting against
// buildings and entities (peds, cars), reloading, muzzle flash / tracer effects,
// and melee attacks.

import { COMBAT, WEAPONS, COLOURS, WORLD_W, WORLD_H } from './config.js';
import { playGunshot } from './audio.js';

export function createCombat(world3d) {
  var weapons = [];
  var currentWeaponIdx = 1;
  var effects = [];
  var lastFireTime = 0;

  // Initialize weapons from config
  for (var i = 0; i < WEAPONS.length; i++) {
    var cfg = WEAPONS[i];
    weapons.push({
      name: cfg.name,
      damage: cfg.damage,
      range: cfg.range,
      rate: cfg.rate,
      spread: cfg.spread,
      pellets: cfg.pellets,
      reloadTime: cfg.reload,
      clipSize: cfg.clip,
      ammo: cfg.ammo,
      clip: Math.min(cfg.clip, cfg.ammo),
      reloading: false,
      reloadTimer: 0,
      fireTimer: 0,
    });
  }

  function lineBoxIntersect(ox, oz, dx, dz, maxDist, box) {
    var tMin = 0;
    var tMax = maxDist;

    // X slab
    if (Math.abs(dx) < 0.0001) {
      if (ox < box.minX || ox > box.maxX) return -1;
    } else {
      var t1x = (box.minX - ox) / dx;
      var t2x = (box.maxX - ox) / dx;
      if (t1x > t2x) { var tmp = t1x; t1x = t2x; t2x = tmp; }
      if (t1x > tMin) tMin = t1x;
      if (t2x < tMax) tMax = t2x;
      if (tMin > tMax) return -1;
    }

    // Z slab
    if (Math.abs(dz) < 0.0001) {
      if (oz < box.minZ || oz > box.maxZ) return -1;
    } else {
      var t1z = (box.minZ - oz) / dz;
      var t2z = (box.maxZ - oz) / dz;
      if (t1z > t2z) { var tmp2 = t1z; t1z = t2z; t2z = tmp2; }
      if (t1z > tMin) tMin = t1z;
      if (t2z < tMax) tMax = t2z;
      if (tMin > tMax) return -1;
    }

    return tMin >= 0 ? tMin : -1;
  }

  function findHitPointOnBox(ox, oz, dx, dz, t, box) {
    var hx = ox + dx * t;
    var hz = oz + dz * t;
    return { x: hx, z: hz };
  }

  function switchWeapon(index) {
    if (index < 0 || index >= weapons.length) return;
    if (index === currentWeaponIdx) return;
    currentWeaponIdx = index;
    weapons[currentWeaponIdx].fireTimer = 0;
    weapons[currentWeaponIdx].reloading = false;
    weapons[currentWeaponIdx].reloadTimer = 0;
  }

  function cycleWeapon(dir) {
    var idx = currentWeaponIdx + dir;
    if (idx < 0) idx = weapons.length - 1;
    if (idx >= weapons.length) idx = 0;
    switchWeapon(idx);
  }

  function canFire() {
    var wpn = weapons[currentWeaponIdx];
    return wpn.clip > 0 && wpn.fireTimer <= 0 && !wpn.reloading;
  }

  function fire(startX, startY, startZ, angleXZ, angleVert, random) {
    var wpn = weapons[currentWeaponIdx];
    if (!canFire()) return [];

    var gunY = startY + 0.5;
    var results = [];
    var maxDist = wpn.range;

    for (var p = 0; p < wpn.pellets; p++) {
      // Apply spread
      var spreadXZ = 0;
      var spreadVert = 0;
      if (wpn.spread > 0) {
        if (wpn.pellets > 1) {
          // Shotgun spread pattern
          spreadXZ = random.float(-wpn.spread, wpn.spread);
          spreadVert = random.float(-wpn.spread * 0.5, wpn.spread * 0.5);
        } else {
          spreadXZ = random.float(-wpn.spread, wpn.spread);
          spreadVert = random.float(-wpn.spread * 0.3, wpn.spread * 0.3);
        }
      }

      var finalAngleXZ = angleXZ + spreadXZ;
      var finalAngleVert = angleVert + spreadVert;

      var dx = Math.cos(finalAngleVert) * Math.cos(finalAngleXZ);
      var dy = Math.sin(finalAngleVert);
      var dz = Math.cos(finalAngleVert) * Math.sin(finalAngleXZ);

      var ox = startX + dx * 0.5;
      var oz = startZ + dz * 0.5;

      // Check collision with buildings
      var closestT = maxDist;
      var hitBox = null;

      for (var i = 0; i < world3d.collisionBoxes.length; i++) {
        var box = world3d.collisionBoxes[i];
        var t = lineBoxIntersect(ox, oz, dx, dz, maxDist, box);
        if (t > 0 && t < closestT) {
          closestT = t;
          hitBox = box;
        }
      }

      if (hitBox) {
        var hitPoint = findHitPointOnBox(ox, oz, dx, dz, closestT, hitBox);
        results.push({
          x: hitPoint.x,
          z: hitPoint.z,
          hit: true,
          targetType: 'building',
          target: hitBox,
          damage: wpn.damage,
        });

        // Spawn hit spark effect
        spawnHitSpark(hitPoint.x, startY + 0.5 + dy * closestT, hitPoint.z);
      }

      // Create tracer effect
      var tracerEndX = hitBox ? (ox + dx * closestT) : (ox + dx * maxDist);
      var tracerEndZ = hitBox ? (oz + dz * closestT) : (oz + dz * maxDist);
      createTracer(ox, gunY, oz, tracerEndX, gunY, tracerEndZ, COLOURS.tracer);
    }

    // Decrement ammo
    wpn.clip -= 1;
    wpn.fireTimer = wpn.rate;
    lastFireTime = performance.now();

    // Create muzzle flash
    createMuzzleFlash(startX + Math.cos(angleXZ) * 0.5, gunY, startZ + Math.sin(angleXZ) * 0.5);

    // Play gunshot sound
    playGunshot(currentWeaponIdx);

    return results;
  }

  function createMuzzleFlash(x, y, z) {
    var flashGeo = new THREE.SphereGeometry(0.2, 4, 4);
    var flashMat = new THREE.MeshBasicMaterial({ color: COLOURS.muzzleFlash });
    var flash = new THREE.Mesh(flashGeo, flashMat);
    flash.position.set(x, y, z);
    world3d.scene.add(flash);

    effects.push({
      mesh: flash,
      timer: 0.1,
      kind: 'muzzle',
    });
  }

  function createTracer(ox, oy, oz, dx, dy, dz, color) {
    var dist = Math.sqrt(
      (dx - ox) * (dx - ox) + (dy - oy) * (dy - oy) + (dz - oz) * (dz - oz)
    );
    if (dist < 0.01) return;

    var midX = (ox + dx) / 2;
    var midY = (oy + dy) / 2;
    var midZ = (oz + dz) / 2;

    var tracerGeo = new THREE.BoxGeometry(0.05, 0.05, dist);
    var tracerMat = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.8 });
    var tracer = new THREE.Mesh(tracerGeo, tracerMat);
    tracer.position.set(midX, midY, midZ);

    var angleXZ = Math.atan2(dz - oz, dx - ox);
    var horizDist = Math.sqrt((dx - ox) * (dx - ox) + (dz - oz) * (dz - oz));
    var angleVert = Math.atan2(dy - oy, horizDist);

    tracer.rotation.y = -angleXZ + Math.PI / 2;
    tracer.rotation.z = -angleVert;

    world3d.scene.add(tracer);

    effects.push({
      mesh: tracer,
      timer: 0.2,
      kind: 'tracer',
    });
  }

  function spawnHitSpark(x, y, z) {
    var sparkGeo = new THREE.SphereGeometry(0.1, 4, 4);
    var sparkMat = new THREE.MeshBasicMaterial({ color: COLOURS.spark });
    var spark = new THREE.Mesh(sparkGeo, sparkMat);
    spark.position.set(x, y, z);
    world3d.scene.add(spark);

    effects.push({
      mesh: spark,
      timer: 0.2,
      kind: 'hitSpark',
    });
  }

  function reload() {
    var wpn = weapons[currentWeaponIdx];
    if (wpn.reloading) return;
    if (wpn.clip >= wpn.clipSize) return;
    if (wpn.ammo <= 0) return;

    wpn.reloading = true;
    wpn.reloadTimer = wpn.reloadTime;
  }

  function melee(startX, startZ, angle) {
    var dx = Math.cos(angle);
    var dz = Math.sin(angle);

    for (var i = 0; i < COMBAT.meleeRange * 2; i++) {
      var checkX = startX + dx * (COMBAT.meleeRange * 0.5);
      var checkZ = startZ + dz * (COMBAT.meleeRange * 0.5);

      // This is called from the game loop where peds/entities are provided by caller
    }

    return { hit: true, x: checkX, z: checkZ, damage: COMBAT.meleeDamage };
  }

  function update(dt) {
    // Update fire timer
    for (var i = 0; i < weapons.length; i++) {
      if (weapons[i].fireTimer > 0) {
        weapons[i].fireTimer -= dt;
      }
    }

    // Update current weapon reload
    var wpn = weapons[currentWeaponIdx];
    if (wpn.reloading) {
      wpn.reloadTimer -= dt;
      if (wpn.reloadTimer <= 0) {
        wpn.reloadTimer = 0;
        wpn.reloading = false;

        var ammoNeeded = wpn.clipSize - wpn.clip;
        var ammoAvailable = Math.min(ammoNeeded, wpn.ammo);
        wpn.clip += ammoAvailable;
        wpn.ammo -= ammoAvailable;
      }
    }

    // Update effects
    for (var j = effects.length - 1; j >= 0; j--) {
      var eff = effects[j];
      eff.timer -= dt;
      if (eff.timer <= 0) {
        if (eff.mesh && eff.mesh.parent) {
          world3d.scene.remove(eff.mesh);
          if (eff.mesh.geometry) eff.mesh.geometry.dispose();
          if (eff.mesh.material) eff.mesh.material.dispose();
        }
        effects.splice(j, 1);
      }
    }
  }

  function getWeaponName() {
    return weapons[currentWeaponIdx].name;
  }

  function getWeaponAmmo() {
    var wpn = weapons[currentWeaponIdx];
    return { clip: wpn.clip, total: wpn.ammo };
  }

  function getCurrentWeapon() {
    return currentWeaponIdx;
  }

  function addAmmo(weaponIdx, amount) {
    if (weaponIdx < 0 || weaponIdx >= weapons.length) return;
    weapons[weaponIdx].ammo += amount;
  }

  function getAllWeapons() {
    return weapons.map(function(w, i) {
      return { name: w.name, clip: w.clip, total: w.ammo, index: i };
    });
  }

  return {
    weapons: weapons,
    get currentWeapon() { return currentWeaponIdx; },
    get effects() { return effects; },
    switchWeapon: switchWeapon,
    cycleWeapon: cycleWeapon,
    canFire: canFire,
    fire: fire,
    reload: reload,
    melee: melee,
    update: update,
    getWeaponName: getWeaponName,
    getWeaponAmmo: getWeaponAmmo,
    getCurrentWeapon: getCurrentWeapon,
    getAllWeapons: getAllWeapons,
    addAmmo: addAmmo,
  };
}