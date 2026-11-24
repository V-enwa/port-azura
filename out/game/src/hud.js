import { COLOURS, WORLD_W, WORLD_H, WEAPONS, RESPECT, DISTRICTS, VEHICLE_DISPLAY } from './config.js';

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
    els.objTrackerText = document.querySelector('#hud-objective-tracker .obj-tracker-text');
    els.objTrackerDist = document.querySelector('#hud-objective-tracker .obj-tracker-dist');
    els.heatFill = document.querySelector('#hud-heat-meter .heat-bar-fill');
    els.heatPct = document.querySelector('#hud-heat-meter .heat-pct');
    els.heatLabel = document.querySelector('#hud-heat-meter .heat-label');
    els.tickerText = document.querySelector('#hud-event-ticker .ticker-text');
    els.minimapDistrict = document.getElementById('minimap-district');
    els.rpLine = document.querySelector('#hud-player-status .rp-line');
    els.streetChip = document.getElementById('hud-street-chip');
    els.timeChip = document.getElementById('hud-time-chip');
  } catch (e) {
    return { update: function() {} };
  }

  var starSpans = els.wantedStars ? els.wantedStars.querySelectorAll('span') || [] : [];
  var statusStars = els.playerStatus ? els.playerStatus.querySelectorAll('.wstar') || [] : [];

  function safeText(el, text) { if (el) el.innerHTML = text; }
  function safeDisplay(el, show) { if (el) el.style.display = show ? 'block' : 'none'; }

  function updateHUD(data) {
    if (!data) data = {};

    // --- CASH ---
    safeText(els.cash, '$' + (data.cash || 0));

    // --- WANTED STARS ---
    var wl = data.wantedLevel || 0;
    var displayWl = Math.max(wl, 3);
    for (var i = 0; i < starSpans.length; i++) {
      starSpans[i].className = (i < displayWl) ? 'star-filled' : 'star-empty';
    }
    for (var j = 0; j < statusStars.length; j++) {
      statusStars[j].className = 'wstar ' + ((j < displayWl) ? 'wstar-filled' : 'wstar-empty');
    }

    // --- MISSION OBJECTIVE (bottom-centre) ---
    var obj = data.objective || '';
    safeText(els.objective, obj);
    safeDisplay(els.objective, obj.length > 0);

    // --- CLOCK/WEATHER CHIP (top-centre-right) ---
    if (els.timeChip) {
      var timeText = data.timeChipText || '18:42 &middot; CLEAR &middot; 29&deg;C';
      safeText(els.timeChip, timeText);
      safeDisplay(els.timeChip, true);
    }

    // --- OBJECTIVE TRACKER (top-left, under dispatch) ---
    var objText = data.objectiveTrackerText || '';
    var objDist = data.objectiveTrackerDist || '';
    if (objText) {
      safeText(els.objTrackerText, objText);
      safeText(els.objTrackerDist, objDist);
      safeDisplay(els.objTrackerText.parentNode.parentNode, true);
    } else {
      safeDisplay(els.objTrackerText.parentNode.parentNode, !!objText);
    }

    // --- JOB CARD (top-left, always visible in shots) ---
    var jobData = data.job || null;
    if (jobData) {
      safeDisplay(els.jobCard, true);
      var jc = els.jobCard;
      var jtEl = jc.querySelector('.job-title');
      var joEl = jc.querySelector('.job-objective');
      var jnEl = jc.querySelector('.job-next');
      var jsEl = jc.querySelector('.job-stage');
      var jrEl = jc.querySelector('.job-reward');
      var jobTitleText = 'JOB ' + jobData.number;
      if (jobData.contact) jobTitleText += ' &middot; ' + jobData.contact;
      safeText(jtEl, jobTitleText);
      safeText(joEl, jobData.title || '');
      safeText(jnEl, (jobData.nextStep ? 'NEXT: ' + jobData.nextStep : ''));
      safeText(jsEl, 'Stage ' + jobData.stage + '/' + jobData.totalStages);
      safeText(jrEl, jobData.rewardText || '');
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
          '<span class="tactic-chip ' + tacticClass + '">' + (unit.tacticLabel || '') + '</span>' +
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
      var keyLabel = w === 0 ? 'F' : (w);
      whtml += '<div class="' + cls + '">' +
        '<span class="weapon-key">' + keyLabel + '</span>' +
        '<span class="weapon-name">' + wp.name + '</span>' +
        '<span class="weapon-ammo">' + ammoText + '</span>' +
        '</div>';
    }
    els.weaponStrip.innerHTML = whtml;

    // --- HEAT METER (top-right, under weapon strip) ---
    var heatPct = data.heatPct || 0;
    var heatLabel = data.heatLabel || 'HEAT';
    if (els.heatFill) els.heatFill.style.width = Math.max(0, Math.min(100, heatPct)) + '%';
    if (els.heatPct) els.heatPct.textContent = Math.round(heatPct) + '%';
    if (els.heatLabel) els.heatLabel.textContent = heatPct > 50 ? heatLabel : 'HEAT';

    // --- VEHICLE CARD (bottom-right, when driving) ---
    var vehData = data.vehicle || null;
    if (vehData) {
      safeDisplay(els.vehicleCard, true);
      var vc = els.vehicleCard;
      safeText(vc.querySelector('.vehicle-name'), vehData.name || '');
      safeText(vc.querySelector('.vspd-num'), vehData.speed || 0);
      var dmgPct = vehData.damagePct || 100;
      vc.querySelector('.vehicle-damage-fill').style.width = dmgPct + '%';
      vc.querySelector('.vehicle-damage-fill').style.background = dmgPct > 60 ? '#2ecc71' : (dmgPct > 25 ? '#ffb347' : '#ff4d7e');
      safeText(vc.querySelector('.vehicle-damage-pct'), Math.round(dmgPct) + '%');
    } else {
      safeDisplay(els.vehicleCard, false);
    }

    // --- RADIO STRIP (bottom area, always visible) ---
    var radioData = data.radio || null;
    if (radioData) {
      safeText(els.radioStrip.querySelector('.radio-station'), radioData.station || '');
      safeText(els.radioStrip.querySelector('.radio-track'), radioData.track || '');
      safeDisplay(els.radioStrip, true);
    } else {
      safeText(els.radioStrip.querySelector('.radio-station'), 'COAST FM');
      safeText(els.radioStrip.querySelector('.radio-track'), '\'Neon Palms\' &middot; Vice Waves');
      safeDisplay(els.radioStrip, true);
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
        var avColors = { B: '#ff4d7e', R: '#ff7847', P: '#2fd4c4', D: '#ffb347' };
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
    safeText(ps.querySelector('.rank-line'), 'RANK ' + (rankIdx + 1) + ' &middot; ' + rankName);
    ps.querySelector('.xp-fill').style.width = Math.max(0, Math.min(100, xpPct)) + '%';

    // --- RP LINE (in player status) ---
    var nextRankName = (rankIdx < RESPECT.ranks.length - 1) ? RESPECT.ranks[rankIdx + 1] : 'MAX';
    var rpText = 'RP ' + xpVal + ' / ' + currentThreshold + ' — next: ' + nextRankName;
    safeText(els.rpLine, rpText);

    // --- RESPECT (top-right, just text) ---
    safeText(els.respect, rankName);

    // --- EVENT TICKER (very bottom) ---
    var tickerText = data.tickerText || 'CITY WIRE — Port Azura evening edition &middot; all clear across the bay &middot; ferry running on schedule';
    safeText(els.tickerText, tickerText);

    // --- STREET-NAME CHIP (bottom-centre, above ticker) ---
    if (els.streetChip) {
      var streetName = data.streetName || 'OCEAN DRIVE &middot; BEACHFRONT';
      safeText(els.streetChip, streetName);
    }

    // --- MINIMAP ---
    if (els.minimap) {
      drawMinimap(data);
    }

    // --- MINIMAP DISTRICT LABEL ---
    if (els.minimapDistrict) {
      var districtLabel = data.districtLabel || 'MARINA';
      safeText(els.minimapDistrict, districtLabel);
    }
  }

  function drawMinimap(data) {
    var canvas = els.minimap;
    var ctx = canvas.getContext('2d');
    var w = 180;
    var h = 180;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }

    // Deep blue water base
    ctx.fillStyle = '#041828';
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

    // Sand-coloured beach strip (bottom-right area as a glowing strip)
    var sandStrip = ctx.createLinearGradient(w * 0.5, 0, w * 1.0, 0);
    sandStrip.addColorStop(0, 'rgba(245,222,179,0.0)');
    sandStrip.addColorStop(0.6, 'rgba(245,222,179,0.12)');
    sandStrip.addColorStop(1, 'rgba(245,222,179,0.25)');
    ctx.fillStyle = sandStrip;
    ctx.fillRect(0, h * 0.5, w, h * 0.5);

    // Deep blue water on bay side (right/bottom)
    var waterGrad = ctx.createRadialGradient(w * 0.75, h * 0.5, 10, w * 0.7, h * 0.55, w * 0.65);
    waterGrad.addColorStop(0, 'rgba(4,30,60,0.65)');
    waterGrad.addColorStop(1, 'rgba(4,30,60,0.0)');
    ctx.fillStyle = waterGrad;
    ctx.fillRect(0, 0, w, h);

    // Bright road lines
    if (data.worldRoads) {
      ctx.strokeStyle = '#5a9a8a';
      ctx.lineWidth = 1.8;
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
            sx = p1.x; sy = p1.y; ex = p2.x; ey = p2.y;
          } else {
            var p1 = worldToMinimap(rx + seg, rz);
            var p2 = worldToMinimap(rx + Math.min(seg + 16, len), rz);
            sx = p1.x; sy = p1.y; ex = p2.x; ey = p2.y;
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

    // Police blips (red/blue, larger)
    if (data.policeCars) {
      for (var pc = 0; pc < data.policeCars.length; pc++) {
        var pcar = data.policeCars[pc];
        if (!pcar || !pcar.alive || pcar.exploding) continue;
        var pcp = worldToMinimap(pcar.x, pcar.z);
        if (!isOnMinimap(pcp.x, pcp.y)) continue;
        var flash = Math.sin(Date.now() * 0.005) > 0;
        ctx.fillStyle = flash ? '#ff3333' : '#3366ff';
        ctx.beginPath();
        ctx.arc(pcp.x, pcp.y, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Traffic car blips
    if (data.cars) {
      for (var c = 0; c < data.cars.length; c++) {
        var car = data.cars[c];
        if (!car.alive || car.exploding) continue;
        var cp = worldToMinimap(car.x, car.z);
        if (!isOnMinimap(cp.x, cp.y)) continue;
        ctx.fillStyle = car.isPolice ? '#ff4444' : '#669988';
        ctx.fillRect(cp.x - 1, cp.y - 1, 2.5, 2.5);
      }
    }

    // Pedestrian blips
    if (data.pedestrians) {
      for (var ped = 0; ped < data.pedestrians.length; ped++) {
        var p = data.pedestrians[ped];
        if (!p.alive) continue;
        var pp = worldToMinimap(p.x, p.z);
        if (!isOnMinimap(pp.x, pp.y)) continue;
        ctx.fillStyle = '#66bb66';
        ctx.fillRect(pp.x, pp.y, 1, 1);
      }
    }

    // Yellow diamond objective marker (bigger)
    if (data.missionBeaconX !== undefined && data.missionBeaconZ !== undefined && (data.missionBeaconX !== 0 || data.missionBeaconZ !== 0)) {
      var bp = worldToMinimap(data.missionBeaconX, data.missionBeaconZ);
      if (isOnMinimap(bp.x, bp.y)) {
        var pulseSize = 5 + Math.sin(Date.now() * 0.005) * 2;
        ctx.save();
        ctx.translate(bp.x, bp.y);
        ctx.rotate(Math.PI / 4);
        ctx.fillStyle = '#ffb347';
        ctx.beginPath();
        ctx.moveTo(0, -pulseSize - 3);
        ctx.lineTo(-pulseSize, 0);
        ctx.lineTo(0, pulseSize + 3);
        ctx.lineTo(pulseSize, 0);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,179,71,0.5)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, pulseSize + 5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }

    // Player arrow
    var pp = worldToMinimap(px, pz);
    ctx.save();
    ctx.translate(pp.x, pp.y);
    ctx.rotate(-pa + Math.PI / 2);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -5);
    ctx.lineTo(-3, 3);
    ctx.lineTo(3, 3);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 0.5;
    ctx.stroke();
    ctx.restore();

    // N indicator
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('N', w - 12, 14);

    // Border (teal)
    ctx.strokeStyle = 'rgba(47,212,196,0.4)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, w, h);
  }

  return { update: updateHUD };
}