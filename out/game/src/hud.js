import { COLOURS, WORLD_W, WORLD_H, WEAPONS } from './config.js';

export function createHUD(player, police, combat, missions, vehicles) {
  var els = {};
  try {
    els.cash = document.getElementById('hud-cash');
    els.respect = document.getElementById('hud-respect');
    els.healthFill = document.getElementById('hud-health-fill');
    els.armourFill = document.getElementById('hud-armour-fill');
    els.weaponName = document.getElementById('hud-weapon-name');
    els.weaponAmmo = document.getElementById('hud-weapon-ammo');
    els.wantedStars = document.getElementById('hud-wanted-stars');
    els.objective = document.getElementById('hud-objective');
    els.dialogue = document.getElementById('hud-dialogue');
    els.radio = document.getElementById('hud-radio');
    els.minimap = document.getElementById('minimap-canvas');
  } catch (e) {
    return { update: function() {} };
  }

  var starSpans = els.wantedStars ? els.wantedStars.querySelectorAll('span') || [] : [];

  function safeText(el, text) {
    if (el) el.textContent = text;
  }

  function safeStyle(el, prop, val) {
    if (el) el.style[prop] = val;
  }

  function safeDisplay(el, show) {
    if (el) el.style.display = show ? '' : 'none';
  }

  function updateHUD(data) {
    if (!data) data = {};

    safeText(els.cash, '$' + (data.cash || 0));

    safeText(els.respect, data.rank || '');

    var healthPct = data.maxHealth > 0 ? (data.health / data.maxHealth * 100) : 0;
    safeStyle(els.healthFill, 'width', Math.max(0, Math.min(100, healthPct)) + '%');

    var armourPct = data.maxArmour > 0 ? (data.armour / data.maxArmour * 100) : 0;
    safeStyle(els.armourFill, 'width', Math.max(0, Math.min(100, armourPct)) + '%');

    safeText(els.weaponName, data.weaponName || '');
    safeText(els.weaponAmmo, (data.clip || 0) + '/' + (data.totalAmmo || 0));

    var wl = data.wantedLevel || 0;
    for (var i = 0; i < starSpans.length; i++) {
      if (i < wl) {
        starSpans[i].className = 'star-filled';
      } else {
        starSpans[i].className = 'star-empty';
      }
    }

    safeText(els.objective, data.objective || '');

    var dl = data.dialogue || '';
    safeText(els.dialogue, dl);
    safeDisplay(els.dialogue, dl.length > 0);

    safeText(els.radio, data.radioStation || '');

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

    var halfWorldW = WORLD_W / 2;
    var halfWorldH = WORLD_H / 2;
    var minimapRange = 80;

    function worldToMinimap(wx, wz) {
      var dx = (wx - px) / minimapRange;
      var dz = (wz - pz) / minimapRange;
      var rx = dx * (w / 2);
      var rz = dz * (h / 2);
      return {
        x: w / 2 + rz,
        y: h / 2 - rx,
      };
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

  return {
    update: updateHUD,
  };
}