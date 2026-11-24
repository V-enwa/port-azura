import { COLOURS, WORLD_W, WORLD_H, WEAPONS, RESPECT, VEHICLE_DISPLAY } from './config.js';

export function createHUD(player, police, combat, missions, vehicles) {
  var els = {};
  try {
    els.cash = document.getElementById('hud-cash');
    els.respect = document.getElementById('hud-respect');
    els.wantedStars = document.getElementById('hud-wanted-stars');
    els.objective = document.getElementById('hud-objective');
    els.minimap = document.getElementById('minimap-canvas');
    els.jobCard = document.getElementById('hud-job-card');
    els.dispatchPanel = document.getElementById('hud-dispatch');
    els.dispatchUnits = document.getElementById('hud-dispatch-units');
    els.dispatchUnitCount = document.querySelector('#hud-dispatch .unit-count');
    els.airSupport = document.getElementById('hud-air-support');
    els.weaponStrip = document.getElementById('hud-weapon-strip');
    els.vehicleCard = document.getElementById('hud-vehicle-card');
    els.radioStrip = document.getElementById('hud-radio-strip');
    els.dialogueBox = document.getElementById('hud-dialogue-box');
    els.playerStatus = document.getElementById('hud-player-status');
  } catch (e) {
    return { update: function() {} };
  }

  var starSpans = els.wantedStars ? els.wantedStars.querySelectorAll('span') || [] : [];

  function safeText(el, text) { if (el) el.textContent = text; }
  function safeDisplay(el, show) { if (el) el.style.display = show ? 'block' : 'none'; }

  function updateHUD(data) {
    if (!data) data = {};

    // --- CASH ---
    safeText(els.cash, '$' + (data.cash || 0));

    // --- WANTED STARS ---
    var wl = data.wantedLevel || 0;
    for (var i = 0; i < starSpans.length; i++) {
      starSpans[i].className = (i < wl) ? 'star-filled' : 'star-empty';
    }

    // --- MISSION OBJECTIVE (bottom-centre) ---
    var obj = data.objective || '';
    safeText(els.objective, obj);
    safeDisplay(els.objective, obj.length > 0);

    // --- JOB CARD (top-left, when mission active) ---
    var jobData = data.job || null;
    if (jobData) {
      safeDisplay(els.jobCard, true);
      var jc = els.jobCard;
      var jtEl = jc.querySelector('.job-title');
      var joEl = jc.querySelector('.job-objective');
      var jnEl = jc.querySelector('.job-next');
      var jsEl = jc.querySelector('.job-stage');
      var jtTimer = jc.querySelector('.job-timer');
      safeText(jtEl, 'JOB ' + jobData.number + ' \u00B7 ' + jobData.contact);
      safeText(joEl, jobData.title);
      safeText(jnEl, (jobData.nextStep ? 'NEXT: ' + jobData.nextStep : ''));
      safeText(jsEl, 'Stage ' + jobData.stage + '/' + jobData.totalStages);
      if (jobData.timer) {
        safeText(jtTimer, jobData.timer);
        jtTimer.style.color = jobData.timerUrgent ? '#e74c3c' : '#f39c12';
        safeDisplay(jtTimer, true);
      } else {
        safeDisplay(jtTimer, false);
      }
    } else {
      safeDisplay(els.jobCard, false);
    }

    // --- DISPATCH PANEL (when wanted >= 2) ---
    var units = data.dispatchUnits || [];
    var heliDeployed = data.heliDeployed || false;
    if (wl >= 2 && units.length > 0) {
      safeDisplay(els.dispatchPanel, true);
      var count = units.length + (heliDeployed ? 1 : 0);
      safeText(els.dispatchUnitCount, '(' + count + ' units)');
      var html = '';
      for (var u = 0; u < units.length; u++) {
        var unit = units[u];
        var tacticClass = unit.tactic ? 'tactic-' + unit.tactic : '';
        html += '<div class="unit-row">' +
          '<span class="unit-callsign">' + unit.callsign + '</span>' +
          '<span class="unit-dist">' + unit.distance + 'm</span>' +
          '<span class="tactic-chip ' + tacticClass + '">' + unit.tacticLabel + '</span>' +
          '</div>';
      }
      if (heliDeployed) {
        html += '<div class="unit-row">' +
          '<span class="unit-callsign">AIR-7</span>' +
          '<span class="unit-dist">&mdash;</span>' +
          '<span class="tactic-chip tactic-spotlight">SPOTLIGHT</span>' +
          '</div>';
      }
      els.dispatchUnits.innerHTML = html;
    } else {
      safeDisplay(els.dispatchPanel, false);
    }

    // --- AIR SUPPORT BANNER (top-centre) ---
    safeDisplay(els.airSupport, heliDeployed);

    // --- WEAPON STRIP (top-right) ---
    var weapons = data.weapons || [];
    var activeWeaponIdx = data.activeWeapon || 0;
    var whtml = '';
    for (var w = 0; w < weapons.length; w++) {
      var wp = weapons[w];
      var hasAmmo = (wp.clip > 0 || wp.total > 0) || (wp.clip === Infinity || wp.total === Infinity);
      var isActive = w === activeWeaponIdx;
      var cls = isActive ? 'weapon-slot active' : 'weapon-slot';
      var ammoText = '';
      if (hasAmmo) {
        var c = wp.clip === Infinity ? '\u221E' : wp.clip;
        var t = wp.total === Infinity ? '\u221E' : wp.total;
        ammoText = c + '/' + t;
      } else {
        ammoText = '\u2014';
      }
      whtml += '<div class="' + cls + '">' +
        '<span class="weapon-key">' + (w) + '</span>' +
        '<span class="weapon-name">' + wp.name + '</span>' +
        '<span class="weapon-ammo">' + ammoText + '</span>' +
        '</div>';
    }
    els.weaponStrip.innerHTML = whtml;

    // --- VEHICLE CARD (bottom-right, when driving) ---
    var vehData = data.vehicle || null;
    if (vehData) {
      safeDisplay(els.vehicleCard, true);
      var vc = els.vehicleCard;
      safeText(vc.querySelector('.vehicle-name'), vehData.name || '');
      safeText(vc.querySelector('.vspd-num'), vehData.speed || 0);
      var dmgPct = vehData.damagePct || 100;
      vc.querySelector('.vehicle-damage-fill').style.width = dmgPct + '%';
      vc.querySelector('.vehicle-damage-fill').style.background = dmgPct > 60 ? '#2ecc71' : (dmgPct > 25 ? '#f39c12' : '#e74c3c');
      safeText(vc.querySelector('.vehicle-damage-pct'), Math.round(dmgPct) + '%');
    } else {
      safeDisplay(els.vehicleCard, false);
    }

    // --- RADIO STRIP (bottom-centre, when driving) ---
    var radioData = data.radio || null;
    if (radioData) {
      safeDisplay(els.radioStrip, true);
      safeText(els.radioStrip.querySelector('.radio-station'), radioData.station || '');
      safeText(els.radioStrip.querySelector('.radio-track'), radioData.track || '');
    } else {
      safeDisplay(els.radioStrip, false);
    }

    // --- DIALOGUE BOX (bottom-centre, above radio) ---
    var dlData = data.dialogue || null;
    if (dlData && dlData.text && dlData.text.length > 0) {
      safeDisplay(els.dialogueBox, true);
      var speaker = dlData.speaker || '';
      var text = dlData.text || '';
      safeText(els.dialogueBox.querySelector('.speaker-name'), speaker);
      safeText(els.dialogueBox.querySelector('.dialogue-text'), text);
      var avatar = els.dialogueBox.querySelector('.speaker-avatar');
      if (speaker) {
        avatar.textContent = speaker.charAt(0).toUpperCase();
        var avColors = { B: '#e74c3c', R: '#f39c12', P: '#3498db', D: '#2c3e50' };
        avatar.style.background = avColors[speaker.charAt(0)] || '#555';
      } else {
        avatar.style.background = '#555';
      }
    } else {
      safeDisplay(els.dialogueBox, false);
    }

    // --- PLAYER STATUS (bottom-left) ---
    var health = data.health || 0;
    var maxHealth = data.maxHealth || 100;
    var healthPct = maxHealth > 0 ? (health / maxHealth * 100) : 0;
    var armour = data.armour || 0;
    var maxArmour = data.maxArmour || 100;
    var armourPct = maxArmour > 0 ? (armour / maxArmour * 100) : 0;

    var ps = els.playerStatus;
    var healthBarRow = ps.querySelectorAll('.status-bar-row')[0];
    var armourBarRow = ps.querySelectorAll('.status-bar-row')[1];
    healthBarRow.querySelector('.status-bar-fill').style.width = Math.max(0, Math.min(100, healthPct)) + '%';
    safeText(healthBarRow.querySelector('.status-bar-num'), Math.round(health));
    armourBarRow.querySelector('.status-bar-fill').style.width = Math.max(0, Math.min(100, armourPct)) + '%';
    safeText(armourBarRow.querySelector('.status-bar-num'), Math.round(armour));

    var rankIdx = data.rankIndex || 0;
    var rankName = RESPECT.ranks[rankIdx] || 'Drifter';
    var xpVal = data.respect || 0;
    var rankThresholds = RESPECT.thresholds;
    var currentThreshold = rankIdx < rankThresholds.length - 1 ? rankThresholds[rankIdx + 1] : rankThresholds[rankIdx] + 1;
    var prevThreshold = rankThresholds[rankIdx] || 0;
    var xpPct = currentThreshold > prevThreshold ? ((xpVal - prevThreshold) / (currentThreshold - prevThreshold) * 100) : 100;
    safeText(ps.querySelector('.rank-line'), 'RANK ' + (rankIdx + 1) + ' \u00B7 ' + rankName);
    ps.querySelector('.xp-fill').style.width = Math.max(0, Math.min(100, xpPct)) + '%';

    // --- RESPECT (top-right, just text) ---
    safeText(els.respect, rankName);

    // --- MINIMAP ---
    if (els.minimap) {
      drawMinimap(data);
    }
  }

  function drawMinimap(data) {
    var canvas = els.minimap;
    var ctx = canvas.getContext('2d');
    var w = canvas.width;
    var h = canvas.height;
    if (w !== 180 || h !== 180) {
      canvas.width = 180;
      canvas.height = 180;
    }
    w = canvas.width;
    h = canvas.height;

    ctx.fillStyle = COLOURS.minimapBg || 'rgba(0,0,0,0.85)';
    ctx.fillRect(0, 0, w, h);

    var px = data.playerX || 0;
    var pz = data.playerZ || 0;
    var pa = data.playerAngle || 0;

    var minimapRange = 80;

    function worldToMinimap(wx, wz) {
      var dx = (wx - px) / minimapRange;
      var dz = (wz - pz) / minimapRange;
      return { x: w / 2 + dz * (w / 2), y: h / 2 - dx * (h / 2) };
    }

    function isOnMinimap(sx, sy) {
      return sx >= 0 && sx <= w && sy >= 0 && sy <= h;
    }

    if (data.worldRoads) {
      ctx.strokeStyle = '#555555';
      ctx.lineWidth = 1;
      for (var r = 0; r < data.worldRoads.length; r++) {
        var road = data.worldRoads[r];
        var isVert = Math.abs(Math.sin(road.angle)) > 0.7;
        var len = road.length || 100;
        var rx = road.x;
        var rz = road.z;
        for (var seg = 0; seg < len; seg += 16) {
          var sx, sy, ex, ey;
          if (isVert) {
            var p1 = worldToMinimap(rx, rz + seg);
            var p2 = worldToMinimap(rx, rz + Math.min(seg + 16, len));
            sx = p1.x;
            sy = p1.y;
            ex = p2.x;
            ey = p2.y;
          } else {
            var p1 = worldToMinimap(rx + seg, rz);
            var p2 = worldToMinimap(rx + Math.min(seg + 16, len), rz);
            sx = p1.x;
            sy = p1.y;
            ex = p2.x;
            ey = p2.y;
          }
          if (isOnMinimap(sx, sy) || isOnMinimap(ex, ey)) {
            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.lineTo(ex, ey);
            ctx.stroke();
          }
        }
      }
    }

    if (data.cars) {
      for (var c = 0; c < data.cars.length; c++) {
        var car = data.cars[c];
        if (!car.alive || car.exploding) continue;
        var cp = worldToMinimap(car.x, car.z);
        if (!isOnMinimap(cp.x, cp.y)) continue;
        ctx.fillStyle = car.isPolice ? '#ff4444' : '#cccccc';
        ctx.fillRect(cp.x - 1, cp.y - 1, 2, 2);
      }
    }

    if (data.policeCars) {
      for (var pc = 0; pc < data.policeCars.length; pc++) {
        var pcar = data.policeCars[pc];
        if (!pcar || !pcar.alive || pcar.exploding) continue;
        var pcp = worldToMinimap(pcar.x, pcar.z);
        if (!isOnMinimap(pcp.x, pcp.y)) continue;
        ctx.fillStyle = '#ff0000';
        ctx.fillRect(pcp.x - 2, pcp.y - 2, 3, 3);
      }
    }

    if (data.pedestrians) {
      for (var ped = 0; ped < data.pedestrians.length; ped++) {
        var p = data.pedestrians[ped];
        if (!p.alive) continue;
        var pp = worldToMinimap(p.x, p.z);
        if (!isOnMinimap(pp.x, pp.y)) continue;
        ctx.fillStyle = '#44ff44';
        ctx.fillRect(pp.x - 1, pp.y - 1, 1, 1);
      }
    }

    if (data.missionBeaconX !== undefined && data.missionBeaconZ !== undefined) {
      var bp = worldToMinimap(data.missionBeaconX, data.missionBeaconZ);
      if (isOnMinimap(bp.x, bp.y)) {
        ctx.fillStyle = COLOURS.wantedStar || '#f5c842';
        var pulseSize = 3 + Math.sin(Date.now() * 0.005) * 1.5;
        ctx.beginPath();
        ctx.arc(bp.x, bp.y, pulseSize, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    var pp = worldToMinimap(px, pz);
    ctx.save();
    ctx.translate(pp.x, pp.y);
    ctx.rotate(-pa + Math.PI / 2);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -4);
    ctx.lineTo(-3, 3);
    ctx.lineTo(3, 3);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = '#cccccc';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('N', w - 12, 14);

    ctx.strokeStyle = '#444444';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, w, h);
  }

  return { update: updateHUD };
}