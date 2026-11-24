import { MISSIONS, RESPECT, PLACES, SCREEN, COLOURS, WORLD_W, WORLD_H, SAVE_KEY } from './config.js';
import { playPickup, playUIClick } from './audio.js';

export function createMissions(world3d, player, vehicles, police, combat, audio) {
  var activeMission = null;
  var missionComplete = false;
  var taxiActive = false;
  var taxiFare = { passengerX: 0, passengerZ: 0, destX: 0, destZ: 0, embarked: false, fare: 0 };
  var raceActive = false;
  var raceCheckpoints = [];
  var raceOpponents = [];
  var raceCheckpointMeshes = [];
  var raceOpponentMeshes = [];
  var racePlayerCheckpointIdx = 0;
  var raceOpponentCheckpoints = [];
  var respectRanks = RESPECT.ranks.slice();
  var stuntBonus = false;
  var stuntCooldown = 0;
  var dialogueBox = '';
  var dialogueTimer = 0;
  var beaconMesh = null;
  var beaconSphere = null;
  var beaconBob = 0;
  var lastWorldData = null;

  function distToPlayer(p) {
    var dx = player.x - p.x;
    var dz = player.z - p.z;
    return Math.sqrt(dx * dx + dz * dz);
  }

  function showDialogue(text) {
    dialogueBox = text;
    dialogueTimer = 5;
  }

  function updateDialogue(dt) {
    if (dialogueTimer > 0) {
      dialogueTimer -= dt;
      if (dialogueTimer <= 0) {
        dialogueTimer = 0;
        dialogueBox = '';
      }
    }
  }

  function createBeacon(x, z) {
    destroyBeacon();
    var group = new THREE.Group();
    var pillarGeo = new THREE.CylinderGeometry(0.3, 0.1, 8, 8);
    var pillarMat = new THREE.MeshBasicMaterial({ color: COLOURS.markerPulse, transparent: true, opacity: 0.7 });
    var pillar = new THREE.Mesh(pillarGeo, pillarMat);
    pillar.position.y = 4;
    group.add(pillar);

    var sphereGeo = new THREE.SphereGeometry(0.5, 8, 8);
    var sphereMat = new THREE.MeshBasicMaterial({ color: COLOURS.markerPulse, transparent: true, opacity: 0.9 });
    beaconSphere = new THREE.Mesh(sphereGeo, sphereMat);
    beaconSphere.position.y = 8.2;
    group.add(beaconSphere);

    group.position.set(x, 0, z);
    world3d.scene.add(group);
    beaconMesh = group;
    beaconBob = 0;
  }

  function updateBeacon(dt) {
    if (!beaconMesh) return;
    beaconBob += dt * 3;
    beaconMesh.position.y = Math.sin(beaconBob) * 0.5;
    if (beaconSphere) {
      var s = 1 + Math.sin(beaconBob * 1.5) * 0.2;
      beaconSphere.scale.setScalar(s);
    }
  }

  function destroyBeacon() {
    if (beaconMesh) {
      if (beaconMesh.parent) world3d.scene.remove(beaconMesh);
      beaconMesh.traverse(function(child) {
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
      });
      beaconMesh = null;
      beaconSphere = null;
    }
  }

  function setBeacon(x, z) {
    if (x === undefined || z === undefined) {
      destroyBeacon();
      return;
    }
    createBeacon(x, z);
  }

  function completeMission(mission) {
    showDialogue('Mission complete! +$' + mission.reward.cash + '  Respect +' + mission.reward.respect);
    player.cash += mission.reward.cash;
    player.respect += mission.reward.respect;
    missionComplete = true;
    destroyBeacon();
    saveProgress(mission.id);
  }

  function saveProgress(completedMissionId) {
    try {
      var data = JSON.parse(localStorage.getItem(SAVE_KEY) || '{}');
      if (!data.completedMissions) data.completedMissions = [];
      if (data.completedMissions.indexOf(completedMissionId) === -1) {
        data.completedMissions.push(completedMissionId);
      }
      data.respect = player.respect;
      data.cash = player.cash;
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch (e) {}
  }

  function getRespectRank() {
    var r = player.respect;
    var rank = respectRanks[0];
    for (var i = RESPECT.thresholds.length - 1; i >= 0; i--) {
      if (r >= RESPECT.thresholds[i]) {
        rank = respectRanks[i];
        break;
      }
    }
    return rank;
  }

  function currentObjective() {
    if (activeMission && activeMission.objective) {
      return activeMission.objective;
    }
    if (taxiActive) {
      if (taxiFare.embarked) {
        return 'Taxi: deliver passenger to destination';
      }
      return 'Taxi: pick up passenger';
    }
    if (raceActive) {
      return 'Race: pass checkpoint ' + (racePlayerCheckpointIdx + 1) + '/' + raceCheckpoints.length;
    }
    return '';
  }

  var missions = [
    {
      id: 1,
      name: 'Homecoming Wheels',
      desc: 'Meet Bea at the Coral Fin, steal the marked Comet at the marina, deliver it to her garage.',
      start: function(mission) {
        mission.objective = 'Go to the Coral Fin';
        mission.targetX = PLACES.coralFin.x;
        mission.targetZ = PLACES.coralFin.z;
        mission.step = 0;
        mission.stepTimer = 0;
        showDialogue('Bea: Rio! Welcome home, baby. Come see me at the Coral Fin.');
        setBeacon(PLACES.coralFin.x, PLACES.coralFin.z);
      },
      update: function(mission, dt) {
        mission.stepTimer += dt;
        if (mission.step === 0) {
          if (distToPlayer(PLACES.coralFin) < 5) {
            showDialogue("Bea: There's a Comet at the marina I need picked up. Keys are in it. Bring it to my garage.");
            mission.objective = 'Steal the Comet at the marina';
            mission.step = 1;
            mission.stepTimer = 0;
            setBeacon(20, 140);
          }
        } else if (mission.step === 1) {
          if (player.inCar && player.car && player.car.type === 'comet') {
            showDialogue("Bea: That's the one! Bring it to the garage.");
            mission.objective = 'Deliver the Comet to Bea\'s Garage';
            mission.targetX = PLACES.garage.x;
            mission.targetZ = PLACES.garage.z;
            mission.step = 2;
            mission.stepTimer = 0;
            setBeacon(PLACES.garage.x, PLACES.garage.z);
          }
        } else if (mission.step === 2) {
          if (player.inCar && distToPlayer(PLACES.garage) < 5) {
            completeMission(mission);
          }
        }
      },
      reward: { cash: 300, respect: 100 }
    },
    {
      id: 2,
      name: 'Cold Drinks, Hot Cargo',
      desc: 'Collect crates at the Docks, deliver to three bars against the clock.',
      start: function(mission) {
        showDialogue("Bea: Pick up the crates at the docks. Three bars need their deliveries — clock's ticking.");
        mission.objective = 'Go to the docks and pick up crates (2:00)';
        mission.step = 0;
        mission.stepTimer = 0;
        mission.timeLeft = 120;
        mission.barDeliveries = 0;
        mission.barCount = 3;
        mission.totalTimeBonus = 0;
        mission.bars = [
          { x: 300, z: 80, name: 'Old Town Tavern' },
          { x: 150, z: 240, name: 'Beachfront Brews' },
          { x: 450, z: 200, name: 'Hillside Spirits' },
        ];
        mission.markers = [];
        for (var i = 0; i < mission.bars.length; i++) {
          var ringGeo = new THREE.RingGeometry(2, 2.5, 16);
          var ringMat = new THREE.MeshBasicMaterial({ color: COLOURS.marker, side: THREE.DoubleSide, transparent: true, opacity: 0.6 });
          var ring = new THREE.Mesh(ringGeo, ringMat);
          ring.rotation.x = -Math.PI / 2;
          ring.position.set(mission.bars[i].x, 0.1, mission.bars[i].z);
          world3d.scene.add(ring);
          mission.markers.push(ring);
        }
        setBeacon(-20, 90);
      },
      update: function(mission, dt) {
        if (mission.step === 0) {
          mission.timeLeft -= dt;
          var mins = Math.max(0, Math.floor(mission.timeLeft / 60));
          var secs = Math.max(0, Math.floor(mission.timeLeft % 60));
          mission.objective = 'Go to the docks and pick up crates (' + mins + ':' + (secs < 10 ? '0' : '') + secs + ')';
          if (mission.timeLeft <= 0) {
            showDialogue('You ran out of time! Mission failed.');
            destroyBeacon();
            cleanupMission(mission);
            activeMission = null;
            return;
          }
          var dx = player.x - (-20);
          var dz = player.z - 90;
          if (Math.sqrt(dx * dx + dz * dz) < 8) {
            showDialogue('Crates loaded! Deliver to: ' + mission.bars[0].name);
            mission.objective = 'Deliver to ' + mission.bars[0].name + ' (1/3)  Time: ' + mission.timeLeft.toFixed(0) + 's';
            mission.step = 1;
            mission.barDeliveries = 0;
            setBeacon(mission.bars[0].x, mission.bars[0].z);
          }
        } else if (mission.step >= 1 && mission.step <= 4) {
          mission.timeLeft -= dt;
          if (mission.timeLeft <= 0) {
            showDialogue('You ran out of time! Mission failed.');
            destroyBeacon();
            cleanupMission(mission);
            activeMission = null;
            return;
          }
          var target = mission.bars[mission.barDeliveries];
          mission.objective = 'Deliver to ' + target.name + ' (' + (mission.barDeliveries + 1) + '/' + mission.barCount + ')  Time: ' + mission.timeLeft.toFixed(0) + 's';
          var tdx = player.x - target.x;
          var tdz = player.z - target.z;
          if (Math.sqrt(tdx * tdx + tdz * tdz) < 6) {
            showDialogue('Delivery complete! Head to the next bar.');
            mission.barDeliveries++;
            mission.step++;
            if (mission.barDeliveries >= mission.barCount) {
              var bonus = Math.floor(mission.timeLeft * 5);
              player.cash += bonus;
              showDialogue('All deliveries done! Time bonus: +$' + bonus);
              completeMission(mission);
            } else {
              setBeacon(mission.bars[mission.barDeliveries].x, mission.bars[mission.barDeliveries].z);
            }
          }
        }
      },
      reward: { cash: 500, respect: 150 }
    },
    {
      id: 3,
      name: 'Three Stars and Rising',
      desc: 'Reach 3 wanted stars, then lose the heat without being busted.',
      start: function(mission) {
        showDialogue('Bea: Prove you can handle heat. Get to 3 stars and vanish. PAPD won\'t know what hit \'em.');
        mission.objective = 'Reach 3 wanted stars';
        mission.step = 0;
        mission.stepTimer = 0;
        destroyBeacon();
      },
      update: function(mission, dt) {
        if (mission.step === 0) {
          if (police.getWantedLevel() >= 3) {
            showDialogue('Now lose the heat! Evade the cops.');
            mission.objective = 'Lose the police (0 stars)';
            mission.step = 1;
          }
        } else if (mission.step === 1) {
          if (police.getWantedLevel() === 0) {
            showDialogue('You vanished! Nice work.');
            completeMission(mission);
          }
        }
      },
      reward: { cash: 400, respect: 120 }
    },
    {
      id: 4,
      name: 'Cobra Bites',
      desc: 'Defend the Coral Fin on foot: survive 6 Chrome Cobras.',
      start: function(mission) {
        showDialogue('Bea: Chrome Cobras are hitting the Coral Fin! Take them out!');
        mission.objective = 'Defeat 0/6 Cobras';
        mission.step = 0;
        mission.stepTimer = 0;
        mission.enemies = [];
        mission.enemiesAlive = 6;
        destroyBeacon();
        var enemyColors = [0xff4444, 0x44ff44, 0x4444ff, 0xffff44, 0xff44ff, 0x44ffff];
        for (var i = 0; i < 6; i++) {
          var eg = new THREE.Group();
          var skinMat = new THREE.MeshPhongMaterial({ color: 0xd4a574 });
          var shirtMat = new THREE.MeshPhongMaterial({ color: enemyColors[i] });
          var pantsMat = new THREE.MeshPhongMaterial({ color: 0x222244 });
          var headGeo = new THREE.SphereGeometry(0.25, 6, 4);
          var head = new THREE.Mesh(headGeo, skinMat);
          head.position.y = 1.5;
          head.castShadow = true;
          eg.add(head);
          var torsoGeo = new THREE.BoxGeometry(0.6, 1.0, 0.3);
          var torso = new THREE.Mesh(torsoGeo, shirtMat);
          torso.position.y = 0.8;
          torso.castShadow = true;
          eg.add(torso);
          var legGeo = new THREE.BoxGeometry(0.22, 0.8, 0.22);
          var leftLeg = new THREE.Mesh(legGeo, pantsMat);
          leftLeg.position.set(0.12, -0.2, 0);
          eg.add(leftLeg);
          var rightLeg = new THREE.Mesh(legGeo, pantsMat);
          rightLeg.position.set(-0.12, -0.2, 0);
          eg.add(rightLeg);
          var gunGeo = new THREE.BoxGeometry(0.08, 0.08, 0.5);
          var gunMat = new THREE.MeshPhongMaterial({ color: 0x444444 });
          var gun = new THREE.Mesh(gunGeo, gunMat);
          gun.position.set(0.35, 1.0, 0.2);
          eg.add(gun);

          var angle = (i / 6) * Math.PI * 2;
          var sx = PLACES.coralFin.x + Math.cos(angle) * 10;
          var sz = PLACES.coralFin.z + Math.sin(angle) * 10;
          eg.position.set(sx, 0, sz);

          world3d.scene.add(eg);

          mission.enemies.push({
            mesh: eg,
            x: sx,
            z: sz,
            health: 50 + Math.floor(Math.random() * 30),
            alive: true,
            shootTimer: 0.5 + Math.random() * 0.8,
            color: enemyColors[i],
          });
        }
      },
      update: function(mission, dt) {
        if (!activeMission || activeMission.id !== 4) return;
        var enemiesAlive = 0;
        for (var i = 0; i < mission.enemies.length; i++) {
          var e = mission.enemies[i];
          if (!e.alive) continue;
          enemiesAlive++;
          var edx = player.x - e.x;
          var edz = player.z - e.z;
          var edist = Math.sqrt(edx * edx + edz * edz);
          if (edist > 0.1) {
            var speed = edist < 3 ? 0 : (edist < 15 ? 1.5 : 4);
            e.x += (edx / edist) * speed * dt;
            e.z += (edz / edist) * speed * dt;
          }
          e.shootTimer -= dt;
          if (e.shootTimer <= 0 && edist < 40) {
            e.shootTimer = 0.6 + Math.random() * 0.6;
            var shotAngle = Math.atan2(edz, edx) + (Math.random() - 0.5) * 0.4;
            var shotX = e.x + Math.cos(shotAngle) * 0.6;
            var shotZ = e.z + Math.sin(shotAngle) * 0.6;
            var flashGeo = new THREE.SphereGeometry(0.12, 4, 4);
            var flashMat = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
            var flash = new THREE.Mesh(flashGeo, flashMat);
            flash.position.set(shotX, 1.0, shotZ);
            world3d.scene.add(flash);
            setTimeout(function() {
              if (flash.parent) world3d.scene.remove(flash);
              flash.geometry.dispose();
              flash.material.dispose();
            }, 100);
            if (edist < 30 && Math.random() < 0.3) {
              player.health -= 8 + Math.floor(Math.random() * 7);
              if (player.health < 0) player.health = 0;
            }
          }
          if (e.mesh) {
            e.mesh.position.x = e.x;
            e.mesh.position.z = e.z;
            e.mesh.rotation.y = Math.atan2(edz, edx);
          }
        }
        mission.enemiesAlive = enemiesAlive;
        mission.objective = 'Defeat ' + (6 - enemiesAlive) + '/6 Cobras';
        if (enemiesAlive === 0 && mission.step === 0) {
          mission.step = 1;
          showDialogue('All Cobras down! The Coral Fin is safe.');
          completeMission(mission);
        }
      },
      reward: { cash: 600, respect: 200 }
    },
    {
      id: 5,
      name: 'Harbor Sprint',
      desc: 'Win the checkpoint race along the coast against 2 rival drivers.',
      start: function(mission) {
        showDialogue('Bea: A street race down the coast. Two rivals. Get there first.');
        mission.objective = 'Race: pass checkpoint 1/' + 8;
        mission.step = 0;
        mission.stepTimer = 0;
        mission.playerCheckpointIdx = 0;
        mission.opponents = [];
        mission.opponentCheckpoints = [];
        mission.opponentMeshes = [];
        var cpX = [20, 80, 140, 200, 260, 320, 380, 440];
        var cpZ = 300;
        mission.checkpoints = [];
        mission.checkpointMeshes = [];
        for (var i = 0; i < 8; i++) {
          mission.checkpoints.push({ x: cpX[i], z: cpZ + (i % 2 === 0 ? -4 : 4), radius: 8 });
          var ringGeo = new THREE.TorusGeometry(3, 0.3, 8, 16);
          var ringMat = new THREE.MeshBasicMaterial({ color: i === 0 ? 0x00ff00 : 0xffff00, transparent: true, opacity: 0.6 });
          var ring = new THREE.Mesh(ringGeo, ringMat);
          ring.position.set(cpX[i], 2, cpZ + (i % 2 === 0 ? -4 : 4));
          ring.rotation.x = Math.PI / 2;
          world3d.scene.add(ring);
          mission.checkpointMeshes.push(ring);
        }
        setBeacon(cpX[0], cpZ - 4);
        if (vehicles && vehicles.createCar) {
          for (var o = 0; o < 2; o++) {
            var sx = 0;
            var sz = 300 + (o === 0 ? 8 : -8);
            var oc = vehicles.createCar('sports', sx, sz, Math.PI / 2, false);
            if (oc) {
              oc.aiSpeed = 38 + Math.random() * 5;
              mission.opponents.push(oc);
              mission.opponentMeshes.push(oc.mesh);
              mission.opponentCheckpoints.push(0);
            }
          }
        }
      },
      update: function(mission, dt) {
        if (!activeMission || activeMission.id !== 5) return;
        for (var i = 0; i < mission.checkpoints.length; i++) {
          var cp = mission.checkpoints[i];
          var pdx = player.x - cp.x;
          var pdz = player.z - cp.z;
          var pdist = Math.sqrt(pdx * pdx + pdz * pdz);
          if (pdist < cp.radius && mission.playerCheckpointIdx === i) {
            mission.playerCheckpointIdx++;
            if (mission.playerCheckpointIdx >= mission.checkpoints.length) {
              showDialogue('You won the Harbor Sprint!');
              completeMission(mission);
              for (var c = 0; c < mission.checkpointMeshes.length; c++) {
                if (mission.checkpointMeshes[c].parent) world3d.scene.remove(mission.checkpointMeshes[c]);
                mission.checkpointMeshes[c].geometry.dispose();
                mission.checkpointMeshes[c].material.dispose();
              }
              setBeacon(undefined, undefined);
              return;
            }
            mission.objective = 'Race: pass checkpoint ' + (mission.playerCheckpointIdx + 1) + '/8';
            setBeacon(mission.checkpoints[mission.playerCheckpointIdx].x, mission.checkpoints[mission.playerCheckpointIdx].z);
            break;
          }
        }
        for (var o = 0; o < mission.opponents.length; o++) {
          var op = mission.opponents[o];
          if (!op || !op.alive || op.exploding) continue;
          var oci = mission.opponentCheckpoints[o];
          if (oci >= mission.checkpoints.length) continue;
          var tcp = mission.checkpoints[oci];
          var odx = tcp.x - op.x;
          var odz = tcp.z - op.z;
          var odist = Math.sqrt(odx * odx + odz * odz);
          if (odist < tcp.radius + 3) {
            mission.opponentCheckpoints[o]++;
            if (mission.opponentCheckpoints[o] >= mission.checkpoints.length) {
              showDialogue('A rival won the race! Mission failed.');
              cleanupMission(mission);
              activeMission = null;
              for (var c = 0; c < mission.checkpointMeshes.length; c++) {
                if (mission.checkpointMeshes[c] && mission.checkpointMeshes[c].parent) {
                  world3d.scene.remove(mission.checkpointMeshes[c]);
                  mission.checkpointMeshes[c].geometry.dispose();
                  mission.checkpointMeshes[c].material.dispose();
                }
              }
              setBeacon(undefined, undefined);
              return;
            }
            continue;
          }
          if (odist > 0.1) {
            op.targetAngle = Math.atan2(odz, odx);
          }
          var angDiff = op.targetAngle - op.angle;
          while (angDiff > Math.PI) angDiff -= Math.PI * 2;
          while (angDiff < -Math.PI) angDiff += Math.PI * 2;
          op.angle += angDiff * Math.min(1, dt * 4);
          op.speed = Math.min(42, op.speed + dt * 25);
          op.x += Math.cos(op.angle) * op.speed * dt;
          op.z += Math.sin(op.angle) * op.speed * dt;
          if (op.mesh) {
            op.mesh.position.x = op.x;
            op.mesh.position.z = op.z;
            op.mesh.rotation.y = op.angle;
          }
        }
      },
      reward: { cash: 800, respect: 250 }
    },
    {
      id: 6,
      name: 'King of the Cove',
      desc: 'Steal the gold Comet from Casino Row, escape a 5-star pursuit, reach the ferry pier.',
      start: function(mission) {
        showDialogue("Bea: The crown jewel — a gold Comet at the casino. Grab it and get to the ferry pier. Don't get caught.");
        mission.objective = 'Steal the gold Comet at the casino';
        mission.step = 0;
        mission.stepTimer = 0;
        setBeacon(PLACES.casino.x, PLACES.casino.z);
        if (vehicles && vehicles.createCar) {
          mission.goldComet = vehicles.createCar('gold_comet', PLACES.casino.x + 15, PLACES.casino.z + 10, 0, true);
        }
      },
      update: function(mission, dt) {
        if (mission.step === 0) {
          if (player.inCar && player.car && player.car.type === 'gold_comet') {
            showDialogue('The Chrome Cobras know! Get to the ferry pier!');
            police.addWanted(7, 'heist');
            mission.objective = 'Escape to the ferry pier. Stay alive!';
            mission.targetX = PLACES.ferryPier.x;
            mission.targetZ = PLACES.ferryPier.z;
            mission.step = 1;
            mission.stepTimer = 0;
            setBeacon(PLACES.ferryPier.x, PLACES.ferryPier.z);
          }
        } else if (mission.step === 1) {
          if (player.inCar && player.car && player.car.type === 'gold_comet' && distToPlayer(PLACES.ferryPier) < 8) {
            showDialogue('You made it! The gold Comet is yours.');
            police.resetWanted();
            completeMission(mission);
          }
          if (!player.inCar || !player.car || player.car.type !== 'gold_comet') {
            mission.stepTimer += dt;
            if (mission.stepTimer > 10) {
              mission.objective = 'Get back in the gold Comet!';
            }
          } else {
            mission.stepTimer = 0;
            mission.objective = 'Escape to the ferry pier. Wanted: ' + police.getWantedLevel() + ' stars';
          }
        }
      },
      reward: { cash: 2000, respect: 500 }
    },
  ];

  function cleanupMission(mission) {
    if (mission.markers) {
      for (var i = 0; i < mission.markers.length; i++) {
        var m = mission.markers[i];
        if (m.parent) world3d.scene.remove(m);
        if (m.geometry) m.geometry.dispose();
        if (m.material) m.material.dispose();
      }
      mission.markers = [];
    }
    if (mission.checkpointMeshes) {
      for (var j = 0; j < mission.checkpointMeshes.length; j++) {
        var cm = mission.checkpointMeshes[j];
        if (cm.parent) world3d.scene.remove(cm);
        if (cm.geometry) cm.geometry.dispose();
        if (cm.material) cm.material.dispose();
      }
      mission.checkpointMeshes = [];
    }
    if (mission.enemies) {
      for (var k = 0; k < mission.enemies.length; k++) {
        var en = mission.enemies[k];
        if (en.mesh && en.mesh.parent) {
          world3d.scene.remove(en.mesh);
          en.mesh.traverse(function(child) {
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
          });
        }
      }
      mission.enemies = [];
    }
  }

  function startMission(id) {
    if (activeMission) {
      cleanupMission(activeMission);
    }
    for (var i = 0; i < missions.length; i++) {
      if (missions[i].id === id) {
        var mission = {
          id: missions[i].id,
          name: missions[i].name,
          desc: missions[i].desc,
          step: 0,
          stepTimer: 0,
          dialogue: '',
          objective: '',
          targetX: 0,
          targetZ: 0,
          markers: [],
          reward: missions[i].reward,
          start: missions[i].start,
          update: missions[i].update,
        };
        mission.start(mission);
        activeMission = mission;
        missionComplete = false;
        playUIClick();
        return mission;
      }
    }
    return null;
  }

  function updateMissions(dt) {
    updateDialogue(dt);
    updateBeacon(dt);
    if (activeMission && !missionComplete) {
      activeMission.update(activeMission, dt);
    }
    if (taxiActive) {
      updateTaxi(dt);
    }
    if (raceActive) {
      updateRace(dt);
    }
    if (stuntCooldown > 0) {
      stuntCooldown -= dt;
    }
  }

  function startTaxi() {
    if (taxiActive || activeMission) return;
    if (!player.inCar || !player.car || player.car.type !== 'taxi') {
      showDialogue('You need a taxi cab for taxi work.');
      return;
    }
    var roadIdx = Math.floor(Math.random() * world3d.roads.length);
    var road = world3d.roads[roadIdx];
    var px, pz;
    if (Math.abs(Math.cos(road.angle)) > 0.7) {
      px = road.x + (Math.random() - 0.5) * 8;
      pz = road.z + Math.random() * road.length;
    } else {
      px = road.x + Math.random() * road.length;
      pz = road.z + (Math.random() - 0.5) * 8;
    }
    var r2 = world3d.roads[Math.floor(Math.random() * world3d.roads.length)];
    var dx, dz;
    if (Math.abs(Math.cos(r2.angle)) > 0.7) {
      dx = r2.x + (Math.random() - 0.5) * 8;
      dz = r2.z + Math.random() * r2.length;
    } else {
      dx = r2.x + Math.random() * r2.length;
      dz = r2.z + (Math.random() - 0.5) * 8;
    }
    taxiFare = {
      passengerX: px,
      passengerZ: pz,
      destX: dx,
      destZ: dz,
      embarked: false,
      fare: Math.floor(30 + Math.random() * 50),
    };
    taxiActive = true;
    showDialogue('Taxi fare: pick up the passenger. Fare: $' + taxiFare.fare);
    setBeacon(px, pz);
  }

  function updateTaxi(dt) {
    if (!taxiActive) return;
    if (!player.inCar) return;
    if (!taxiFare.embarked) {
      var pdx = player.x - taxiFare.passengerX;
      var pdz = player.z - taxiFare.passengerZ;
      if (Math.sqrt(pdx * pdx + pdz * pdz) < 6) {
        showDialogue('Passenger picked up! Take them to the destination.');
        taxiFare.embarked = true;
        setBeacon(taxiFare.destX, taxiFare.destZ);
      }
    } else {
      var ddx = player.x - taxiFare.destX;
      var ddz = player.z - taxiFare.destZ;
      if (Math.sqrt(ddx * ddx + ddz * ddz) < 6) {
        player.cash += taxiFare.fare;
        showDialogue('Fare complete! Earned $' + taxiFare.fare);
        playPickup();
        taxiActive = false;
        taxiFare.embarked = false;
        destroyBeacon();
      }
    }
  }

  function startRace() {
    if (raceActive || activeMission) return;
    if (!player.inCar || !player.car) {
      showDialogue('You need a car to race.');
      return;
    }
    raceCheckpoints = [
      { x: 20, z: 300 },
      { x: 80, z: 290 },
      { x: 150, z: 310 },
      { x: 220, z: 295 },
      { x: 290, z: 305 },
      { x: 360, z: 290 },
      { x: 420, z: 310 },
      { x: 480, z: 300 },
    ];
    racePlayerCheckpointIdx = 0;
    raceOpponents = [];
    raceOpponentCheckpoints = [];
    raceCheckpointMeshes = [];
    raceOpponentMeshes = [];
    for (var i = 0; i < raceCheckpoints.length; i++) {
      var cp = raceCheckpoints[i];
      var rGeo = new THREE.TorusGeometry(4, 0.4, 8, 16);
      var rMat = new THREE.MeshBasicMaterial({ color: i === 0 ? 0x00ff00 : COLOURS.marker, transparent: true, opacity: 0.5 });
      var rMesh = new THREE.Mesh(rGeo, rMat);
      rMesh.position.set(cp.x, 2, cp.z);
      rMesh.rotation.x = Math.PI / 2;
      world3d.scene.add(rMesh);
      raceCheckpointMeshes.push(rMesh);
    }
    setBeacon(raceCheckpoints[0].x, raceCheckpoints[0].z);
    if (vehicles && vehicles.createCar) {
      for (var o = 0; o < 2; o++) {
        var sx = 0;
        var sz = 300 + (o === 0 ? 10 : -10);
        var oc = vehicles.createCar('sports', sx, sz, Math.PI / 2, false);
        if (oc) {
          oc.aiSpeed = 36 + Math.random() * 6;
          oc.targetAngle = Math.PI / 2;
          raceOpponents.push(oc);
          raceOpponentMeshes.push(oc.mesh);
          raceOpponentCheckpoints.push(0);
        }
      }
    }
    raceActive = true;
    showDialogue('Race started! Pass all checkpoints first to win.');
  }

  function updateRace(dt) {
    if (!raceActive) return;
    for (var i = 0; i < raceCheckpoints.length; i++) {
      var cp = raceCheckpoints[i];
      var px = player.x - cp.x;
      var pz = player.z - cp.z;
      if (Math.sqrt(px * px + pz * pz) < 8 && racePlayerCheckpointIdx === i) {
        racePlayerCheckpointIdx++;
        if (racePlayerCheckpointIdx >= raceCheckpoints.length) {
          player.cash += MISSIONS.racePrize;
          showDialogue('Race won! Earned $' + MISSIONS.racePrize);
          playPickup();
          cleanupRace();
          return;
        }
        setBeacon(raceCheckpoints[racePlayerCheckpointIdx].x, raceCheckpoints[racePlayerCheckpointIdx].z);
        break;
      }
    }
    for (var o = 0; o < raceOpponents.length; o++) {
      var op = raceOpponents[o];
      if (!op || !op.alive || op.exploding) continue;
      var oci = raceOpponentCheckpoints[o];
      if (oci >= raceCheckpoints.length) continue;
      var tcp = raceCheckpoints[oci];
      var odx = tcp.x - op.x;
      var odz = tcp.z - op.z;
      var odist = Math.sqrt(odx * odx + odz * odz);
      if (odist < 10) {
        raceOpponentCheckpoints[o]++;
        if (raceOpponentCheckpoints[o] >= raceCheckpoints.length) {
          showDialogue('You lost the race!');
          cleanupRace();
          return;
        }
        continue;
      }
      if (odist > 0.1) {
        op.targetAngle = Math.atan2(odz, odx);
      }
      var angDiff = op.targetAngle - op.angle;
      while (angDiff > Math.PI) angDiff -= Math.PI * 2;
      while (angDiff < -Math.PI) angDiff += Math.PI * 2;
      op.angle += angDiff * Math.min(1, dt * 3);
      op.speed = Math.min(40, op.speed + dt * 20);
      op.x += Math.cos(op.angle) * op.speed * dt;
      op.z += Math.sin(op.angle) * op.speed * dt;
      if (op.mesh) {
        op.mesh.position.x = op.x;
        op.mesh.position.z = op.z;
        op.mesh.rotation.y = op.angle;
      }
    }
  }

  function cleanupRace() {
    raceActive = false;
    destroyBeacon();
    for (var i = 0; i < raceCheckpointMeshes.length; i++) {
      var m = raceCheckpointMeshes[i];
      if (m.parent) world3d.scene.remove(m);
      if (m.geometry) m.geometry.dispose();
      if (m.material) m.material.dispose();
    }
    raceCheckpointMeshes = [];
    raceOpponents = [];
    raceOpponentMeshes = [];
    raceOpponentCheckpoints = [];
  }

  function checkStuntBonus(playerCar, dt, prevZ) {
    if (stuntCooldown > 0 || !playerCar || !playerCar.alive || playerCar.exploding) return;
    if (Math.abs(playerCar.speed) < 25) return;
    if (prevZ === undefined) return;
    var heightDelta = playerCar.z - prevZ;
    if (heightDelta > 2 && stuntCooldown <= 0) {
      stuntCooldown = 3;
      player.cash += MISSIONS.stuntBonus;
      showDialogue('Stunt bonus! +$' + MISSIONS.stuntBonus);
      playPickup();
    }
  }

  function getJobCardData() {
    if (!activeMission) return null;
    var m = activeMission;
    var stepNames = ['Approach', 'Engage', 'Complete', 'Escape', 'Deliver'];
    var stage = (m.step || 0) + 1;
    var totalStages = (m.totalSteps || 3);
    var timerStr = null;
    var timerUrgent = false;
    if (m.timeLeft !== undefined && m.timeLeft > 0) {
      var mins = Math.floor(m.timeLeft / 60);
      var secs = Math.floor(m.timeLeft % 60);
      timerStr = mins + ':' + (secs < 10 ? '0' : '') + secs;
      timerUrgent = m.timeLeft < 30;
    }
    var nextStep = stage < totalStages ? stepNames[Math.min(stage, stepNames.length - 1)] : 'Complete';
    return {
      number: m.id,
      contact: m.contact || 'Bea',
      title: m.name || '',
      nextStep: nextStep,
      stage: stage,
      totalStages: totalStages,
      timer: timerStr,
      timerUrgent: timerUrgent,
    };
  }

  return {
    missions: missions,
    get activeMission() { return activeMission; },
    set activeMission(v) { activeMission = v; },
    get missionComplete() { return missionComplete; },
    set missionComplete(v) { missionComplete = v; },
    startMission: startMission,
    updateMissions: updateMissions,
    get taxiActive() { return taxiActive; },
    startTaxi: startTaxi,
    updateTaxi: updateTaxi,
    get raceActive() { return raceActive; },
    startRace: startRace,
    updateRace: updateRace,
    getRespectRank: getRespectRank,
    showDialogue: showDialogue,
    updateDialogue: updateDialogue,
    currentObjective: currentObjective,
    currentDialogue: function() { return dialogueBox; },
    setBeacon: setBeacon,
    destroyBeacon: destroyBeacon,
    checkStuntBonus: checkStuntBonus,
    get dialogueBox() { return dialogueBox; },
    getJobCardData: getJobCardData,
    cleanupMission: cleanupMission,
  };
}