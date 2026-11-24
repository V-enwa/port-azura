// Procedural 3D city for Port Azura. Builds the entire scene from canvas textures: roads,
// buildings, beach, water, marina, docks, street lamps, palm trees, sky, and lighting.

import {
  WORLD_W, WORLD_H, ROAD, BLOCK, BUILDING, DISTRICTS, PLACES,
  COLOURS, NEON_COLOURS, CAR_TYPES, MESH,
} from './config.js';

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
}

function rgbToStyle(r, g, b) {
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

function makeCanvas(w, h, drawFn) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  drawFn(ctx, w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function jitterColour(random, hex, amt) {
  const c = hexToRgb(hex);
  c.r = Math.min(255, Math.max(0, c.r + random.float(-amt, amt)));
  c.g = Math.min(255, Math.max(0, c.g + random.float(-amt, amt)));
  c.b = Math.min(255, Math.max(0, c.b + random.float(-amt, amt)));
  return rgbToStyle(c.r, c.g, c.b);
}

function pastelStyle(random, hex) {
  const c = hexToRgb(hex);
  const r = Math.min(255, c.r + random.float(20, 60));
  const g = Math.min(255, c.g + random.float(20, 60));
  const b = Math.min(255, c.b + random.float(20, 60));
  return rgbToStyle(r, g, b);
}

function createSkyTexture() {
  return makeCanvas(512, 512, (ctx, w, h) => {
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#1a1040');
    grad.addColorStop(0.35, '#2d1b4e');
    grad.addColorStop(0.55, '#8b3a5e');
    grad.addColorStop(0.7, '#e8744a');
    grad.addColorStop(0.85, '#f0a060');
    grad.addColorStop(1, '#3a2a3a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    for (let i = 0; i < 80; i++) {
      const sx = Math.random() * w;
      const sy = Math.random() * h * 0.6;
      ctx.fillStyle = 'rgba(255,255,255,' + (0.3 + Math.random() * 0.7) + ')';
      ctx.fillRect(sx, sy, 2, 2);
    }
  });
}

function createRoadTexture() {
  return makeCanvas(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#3a3a3a';
    ctx.fillRect(0, 0, w, h);

    for (let i = 0; i < 3000; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      const shade = 50 + Math.random() * 30;
      ctx.fillStyle = 'rgb(' + shade + ',' + shade + ',' + shade + ')';
      ctx.fillRect(x, y, 2, 2);
    }

    ctx.lineWidth = 3;
    ctx.strokeStyle = '#dddddd';
    ctx.beginPath(); ctx.moveTo(0, 6); ctx.lineTo(w, 6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, h - 6); ctx.lineTo(w, h - 6); ctx.stroke();

    ctx.strokeStyle = '#ffe680';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([24, 16]);
    ctx.beginPath();
    ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2);
    ctx.stroke();
    ctx.setLineDash([]);
  });
}

function createSidewalkTexture() {
  return makeCanvas(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#c8c8c8';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 600; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      const shade = 190 + Math.random() * 30;
      ctx.fillStyle = 'rgb(' + shade + ',' + shade + ',' + shade + ')';
      ctx.fillRect(x, y, 2, 2);
    }
    ctx.strokeStyle = '#b0b0b0';
    ctx.lineWidth = 1;
    for (let x = 32; x < w; x += 32) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let y = 0; y < h; y += 64) {
      ctx.beginPath(); ctx.moveTo(0, y + 32); ctx.lineTo(w, y + 32); ctx.stroke();
    }
  });
}

function createGrassTexture() {
  return makeCanvas(256, 256, (ctx, w, h) => {
    ctx.fillStyle = COLOURS.grass;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 600; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      const shade = Math.random();
      if (shade < 0.33) ctx.fillStyle = COLOURS.grass;
      else if (shade < 0.66) ctx.fillStyle = COLOURS.grassShadow;
      else ctx.fillStyle = '#5a8f4a';
      ctx.fillRect(x, y, 3 + Math.random() * 4, 3 + Math.random() * 4);
    }
  });
}

function createPlazaTexture() {
  return makeCanvas(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#a89880';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 400; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      const shade = 150 + Math.random() * 40;
      ctx.fillStyle = 'rgb(' + shade + ',' + (shade - 10) + ',' + (shade - 20) + ')';
      ctx.fillRect(x, y, 2, 3);
    }
    ctx.strokeStyle = '#9a8a72';
    ctx.lineWidth = 1;
    for (let x = 32; x < w; x += 32) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let y = 32; y < h; y += 32) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
  });
}

function createGravelTexture() {
  return makeCanvas(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#8a8072';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 500; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      const shade = 100 + Math.random() * 60;
      ctx.fillStyle = 'rgb(' + shade + ',' + shade + ',' + shade + ')';
      ctx.fillRect(x, y, 2 + Math.random() * 2, 2 + Math.random() * 2);
    }
  });
}

function createSandTexture() {
  return makeCanvas(256, 256, (ctx, w, h) => {
    ctx.fillStyle = COLOURS.sand;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 600; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      ctx.fillStyle = Math.random() < 0.5 ? COLOURS.sand : COLOURS.sandShadow;
      ctx.fillRect(x, y, 2 + Math.random() * 2, 2 + Math.random() * 2);
    }
  });
}

function createWaterTexture() {
  return makeCanvas(512, 512, (ctx, w, h) => {
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, COLOURS.waterShallow);
    grad.addColorStop(0.4, COLOURS.water);
    grad.addColorStop(1, '#0d4a5e');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 200; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      ctx.strokeStyle = 'rgba(255,255,255,' + (0.05 + Math.random() * 0.1) + ')';
      ctx.lineWidth = 1 + Math.random() * 2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.random() * 30 - 15, y + 2);
      ctx.stroke();
    }
  });
}

function createBuildingTexture(random, w, h, baseColor, neonColor) {
  return makeCanvas(w, h, (ctx, cw, ch) => {
    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 0, cw, ch);

    const cellW = cw / 5;
    const cellH = ch / 6;
    const winW = cellW * 0.55;
    const winH = cellH * 0.5;

    for (let row = 0; row < 6; row++) {
      for (let col = 0; col < 5; col++) {
        const cx = col * cellW + (cellW - winW) / 2;
        const cy = row * cellH + (cellH - winH) / 2 + ch * 0.05;

        const lit = random() > 0.35;
        ctx.fillStyle = lit ? '#ffffcc' : '#2a2a2a';
        ctx.fillRect(cx, cy, winW, winH);

        if (lit) {
          ctx.fillStyle = 'rgba(255,255,200,0.15)';
          ctx.fillRect(cx, cy, winW, winH * 0.5);
        }
      }
    }

    ctx.strokeStyle = '#444444';
    ctx.lineWidth = 1;
    for (let row = 0; row <= 6; row++) {
      ctx.beginPath();
      ctx.moveTo(0, row * cellH);
      ctx.lineTo(cw, row * cellH);
      ctx.stroke();
    }

    if (neonColor && random() > 0.6) {
      ctx.strokeStyle = neonColor;
      ctx.lineWidth = 3;
      ctx.shadowColor = neonColor;
      ctx.shadowBlur = 8;
      const ny = ch * 0.85;
      ctx.beginPath();
      ctx.moveTo(cw * 0.1, ny);
      ctx.lineTo(cw * 0.9, ny);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
  });
}

function createNeonSignTexture(random, text, neonColor) {
  return makeCanvas(256, 64, (ctx, w, h) => {
    ctx.fillStyle = '#111111';
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = '#333333';
    ctx.lineWidth = 2;
    ctx.strokeRect(4, 4, w - 8, h - 8);

    ctx.font = 'bold 28px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.fillStyle = neonColor;
    ctx.shadowColor = neonColor;
    ctx.shadowBlur = 12;
    ctx.fillText(text, w / 2, h / 2 - 2);

    ctx.strokeStyle = neonColor;
    ctx.lineWidth = 1;
    ctx.strokeText(text, w / 2, h / 2 - 2);

    ctx.shadowBlur = 0;

    const flicker = 'rgba(255,255,255,' + (0.3 + Math.random() * 0.4) + ')';
    ctx.fillStyle = flicker;
    ctx.fillRect(10, h - 10, (w - 20) * Math.random(), 4);
  });
}

function createRoofTexture() {
  return makeCanvas(128, 128, (ctx, w, h) => {
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#555555');
    grad.addColorStop(0.5, '#4a4a4a');
    grad.addColorStop(1, '#3a3a3a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = '#3a3a3a';
    ctx.lineWidth = 1;
    for (let y = 16; y < h; y += 16) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
  });
}

function createGarageTexture() {
  return makeCanvas(256, 128, (ctx, w, h) => {
    ctx.fillStyle = '#888888';
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = '#666666';
    for (let i = 0; i < 5; i++) {
      const x = 12 + i * (w - 24) / 5;
      ctx.fillRect(x, 10, (w - 24) / 5 - 6, h - 40);
      ctx.strokeStyle = '#444444';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, 10, (w - 24) / 5 - 6, h - 40);

      const handleY = 10 + (h - 40) / 2;
      ctx.fillStyle = '#555555';
      ctx.fillRect(x + 6, handleY - 6, 10, 12);
      ctx.fillStyle = '#666666';
    }

    ctx.fillStyle = '#777777';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText("BEA'S GARAGE", w / 2, h - 10);
  });
}

function createHospitalTexture() {
  return makeCanvas(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#f5f5f5';
    ctx.fillRect(0, 0, w, h);

    for (let row = 0; row < 6; row++) {
      for (let col = 0; col < 6; col++) {
        const x = 8 + col * 40;
        const y = 8 + row * 40;
        ctx.fillStyle = '#ddffff';
        ctx.fillRect(x, y, 30, 25);
        ctx.strokeStyle = '#ccdddd';
        ctx.strokeRect(x, y, 30, 25);
      }
    }

    ctx.fillStyle = '#ff3333';
    ctx.fillRect(w / 2 - 30, h / 2 - 30, 60, 60);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(w / 2 - 10, h / 2 - 30, 20, 60);
    ctx.fillRect(w / 2 - 30, h / 2 - 10, 60, 20);
  });
}

function createPoliceTexture() {
  return makeCanvas(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#4a5568';
    ctx.fillRect(0, 0, w, h);

    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 5; col++) {
        const x = 10 + col * 48;
        const y = 10 + row * 48;
        ctx.fillStyle = '#dddddd';
        ctx.fillRect(x, y, 36, 32);
        ctx.strokeStyle = '#bbbbbb';
        ctx.strokeRect(x, y, 36, 32);
      }
    }

    ctx.font = 'bold 22px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#1a3a6a';
    ctx.fillText('PAPD', w / 2, h / 2 + 8);

    ctx.strokeStyle = '#1a3a6a';
    ctx.lineWidth = 8;
    ctx.strokeRect(8, 8, w - 16, h - 16);
    ctx.strokeStyle = '#2a4a7a';
    ctx.lineWidth = 2;
    ctx.strokeRect(12, 12, w - 24, h - 24);
  });
}

function createMarinaWoodTexture() {
  return makeCanvas(256, 128, (ctx, w, h) => {
    ctx.fillStyle = '#8b6914';
    ctx.fillRect(0, 0, w, h);

    for (let i = 0; i < 20; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      ctx.strokeStyle = '#6b4e0a';
      ctx.lineWidth = 1 + Math.random();
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.random() * 60 - 30, y + 1);
      ctx.stroke();
    }

    for (let y = 16; y < h; y += 16) {
      ctx.strokeStyle = '#7a5a10';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
  });
}

function createPalmTrunk(random, baseY, height) {
  const segments = 8;
  const group = new THREE.Group();

  for (let i = 0; i < segments; i++) {
    const segH = height / segments;
    const radius = 0.35 - i * 0.03;
    const geo = new THREE.CylinderGeometry(radius * 0.9, radius, segH, 8);
    const mat = new THREE.MeshLambertMaterial({ color: 0x8b6914 });
    const seg = new THREE.Mesh(geo, mat);
    seg.position.y = baseY + i * segH + segH / 2;
    seg.rotation.z = random.float(-0.08, 0.08);
    seg.rotation.x = random.float(-0.08, 0.08);
    group.add(seg);
  }

  const crownH = 0.3;
  const crownGeo = new THREE.CylinderGeometry(0.4, 0.35, crownH, 8);
  const crownMat = new THREE.MeshLambertMaterial({ color: 0x6b8e23 });
  const crown = new THREE.Mesh(crownGeo, crownMat);
  crown.position.y = baseY + height - crownH / 2;
  group.add(crown);

  for (let i = 0; i < 5; i++) {
    const frondGroup = new THREE.Group();

    const frondGeo1 = new THREE.ConeGeometry(2.5 + random.float(-0.5, 0.5), 0.15, 4);
    const frondMat = new THREE.MeshLambertMaterial({
      color: random.int(2) ? 0x2d5a1e : 0x3a7a28,
    });
    const frond1 = new THREE.Mesh(frondGeo1, frondMat);
    frond1.rotation.x = Math.PI / 2;
    frond1.position.y = 2;
    frondGroup.add(frond1);

    const tipY = 1.3;
    frondGroup.position.y = baseY + height - 0.8;
    frondGroup.rotation.y = (i / 5) * Math.PI * 2 + random.float(-0.3, 0.3);
    frondGroup.rotation.z = Math.PI / 4 + random.float(-0.4, 0.4);

    group.add(frondGroup);
  }

  return group;
}

export function createWorld3D(random) {
  const scene = new THREE.Scene();
  const collisionBoxes = [];
  const roadSegments = [];
  const places = {};

  const numVertRoads = 9;
  const numHorizRoads = 6;
  const vertRoadX = Array.from({ length: numVertRoads }, (_, i) => i * BLOCK.size);
  const horizRoadZ = Array.from({ length: numHorizRoads }, (_, i) => i * BLOCK.size);

  const numBlockCols = numVertRoads - 1;
  const numBlockRows = numHorizRoads - 1;

  const gridMinX = vertRoadX[0];
  const gridMaxX = vertRoadX[numVertRoads - 1];
  const gridMinZ = horizRoadZ[0];
  const gridMaxZ = horizRoadZ[numHorizRoads - 1];

  function blockBounds(col, row) {
    const minX = vertRoadX[col] + ROAD.width / 2 + BLOCK.sidewalk;
    const maxX = vertRoadX[col + 1] - ROAD.width / 2 - BLOCK.sidewalk;
    const minZ = horizRoadZ[row] + ROAD.width / 2 + BLOCK.sidewalk;
    const maxZ = horizRoadZ[row + 1] - ROAD.width / 2 - BLOCK.sidewalk;
    return { minX, maxX, minZ, maxZ };
  }

  function getDistrictFor(col, row) {
    for (const d of DISTRICTS) {
      if (col >= d.x && col < d.x + d.w && row >= d.y && row < d.y + d.h) {
        return d;
      }
    }
    return { name: 'Outskirts', colour: '#a0a0a0' };
  }

  const seaLevel = -0.1;
  const beachZ = gridMaxZ + 20;

  const halfWorld = WORLD_W * 0.75;
  const groundGeo = new THREE.PlaneGeometry(halfWorld * 2, halfWorld * 2);
  const grassTex = createGrassTexture();
  grassTex.repeat.set(halfWorld / 16, halfWorld / 16);
  const groundMat = new THREE.MeshLambertMaterial({ map: grassTex, color: 0xffffff });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0;
  ground.receiveShadow = true;
  scene.add(ground);

  // Roads
  const roadTex = createRoadTexture();

  const roadMatNS = new THREE.MeshLambertMaterial({ map: roadTex, color: 0xcccccc });
  roadTex.repeat.set(1, (gridMaxZ - gridMinZ + ROAD.width) / ROAD.width);

  for (let i = 0; i < numVertRoads; i++) {
    const x = vertRoadX[i];
    const length = gridMaxZ - gridMinZ + ROAD.width;
    const roadGeo = new THREE.PlaneGeometry(ROAD.width, length);
    const road = new THREE.Mesh(roadGeo, roadMatNS);
    road.rotation.x = -Math.PI / 2;
    road.position.set(x, 0.02, gridMinZ - ROAD.width / 2 + length / 2);
    road.receiveShadow = true;
    scene.add(road);

    roadSegments.push({
      x, z: gridMinZ - ROAD.width / 2, angle: Math.PI / 2, length,
    });
  }

  const roadTexEW = roadTex.clone();
  roadTexEW.needsUpdate = true;
  roadTexEW.repeat.set((gridMaxX - gridMinX + ROAD.width) / ROAD.width, 1);
  const roadMatEW = new THREE.MeshLambertMaterial({ map: roadTexEW, color: 0xcccccc });

  for (let i = 0; i < numHorizRoads; i++) {
    const z = horizRoadZ[i];
    const length = gridMaxX - gridMinX + ROAD.width;
    const roadGeo = new THREE.PlaneGeometry(length, ROAD.width);
    const road = new THREE.Mesh(roadGeo, roadMatEW);
    road.rotation.x = -Math.PI / 2;
    road.position.set(gridMinX - ROAD.width / 2 + length / 2, 0.02, z);
    road.receiveShadow = true;
    scene.add(road);

    roadSegments.push({
      x: gridMinX - ROAD.width / 2, z, angle: 0, length,
    });
  }

  // Sidewalks
  const sidewalkTex = createSidewalkTexture();

  for (let col = 0; col < numBlockCols; col++) {
    for (let row = 0; row < numBlockRows; row++) {
      const bMinX = vertRoadX[col] + ROAD.width / 2;
      const bMaxX = vertRoadX[col + 1] - ROAD.width / 2;
      const bMinZ = horizRoadZ[row] + ROAD.width / 2;
      const bMaxZ = horizRoadZ[row + 1] - ROAD.width / 2;

      const swW = BLOCK.sidewalk;
      const blockW = bMaxX - bMinX;
      const blockD = bMaxZ - bMinZ;

      // Top sidewalk (nearer Z edge)
      const swGeo1 = new THREE.PlaneGeometry(blockW, swW);
      const sw1 = new THREE.Mesh(swGeo1, new THREE.MeshLambertMaterial({ map: sidewalkTex, color: 0xdddddd }));
      sw1.rotation.x = -Math.PI / 2;
      sw1.position.set(bMinX + blockW / 2, 0.03, bMinZ - swW / 2);
      sw1.receiveShadow = true;
      scene.add(sw1);

      // Bottom sidewalk
      const sw2 = new THREE.Mesh(swGeo1.clone(), new THREE.MeshLambertMaterial({ map: sidewalkTex, color: 0xdddddd }));
      sw2.rotation.x = -Math.PI / 2;
      sw2.position.set(bMinX + blockW / 2, 0.03, bMaxZ + swW / 2);
      sw2.receiveShadow = true;
      scene.add(sw2);

      // Left sidewalk (vertical)
      const swGeo2 = new THREE.PlaneGeometry(swW, blockD);
      const sw3 = new THREE.Mesh(swGeo2, new THREE.MeshLambertMaterial({ map: sidewalkTex, color: 0xdddddd }));
      sw3.rotation.x = -Math.PI / 2;
      sw3.position.set(bMinX - swW / 2, 0.03, bMinZ + blockD / 2);
      sw3.receiveShadow = true;
      scene.add(sw3);

      // Right sidewalk
      const sw4 = new THREE.Mesh(swGeo2.clone(), new THREE.MeshLambertMaterial({ map: sidewalkTex, color: 0xdddddd }));
      sw4.rotation.x = -Math.PI / 2;
      sw4.position.set(bMaxX + swW / 2, 0.03, bMinZ + blockD / 2);
      sw4.receiveShadow = true;
      scene.add(sw4);
    }
  }

  // Crosswalks at intersections
  const crosswalkTex = makeCanvas(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#c8c8c8';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#e8e8e0';
    for (let sx = 0; sx < w; sx += 12) {
      ctx.fillRect(sx, 0, 8, h);
    }
    ctx.strokeStyle = '#b0b0b0';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
  });

  for (let col = 0; col < numVertRoads; col++) {
    for (let row = 0; row < numHorizRoads; row++) {
      const x = vertRoadX[col];
      const z = horizRoadZ[row];
      const cwW = ROAD.width + BLOCK.sidewalk * 2;
      const cwD = BLOCK.sidewalk;

      const cwGeoNS = new THREE.PlaneGeometry(cwW, cwD);
      const cwNS = new THREE.Mesh(cwGeoNS, new THREE.MeshLambertMaterial({ map: crosswalkTex, color: 0xeeeeee }));
      cwNS.rotation.x = -Math.PI / 2;
      cwNS.position.set(x, 0.04, z - ROAD.width / 2 - BLOCK.sidewalk / 2);
      cwNS.receiveShadow = true;
      scene.add(cwNS);

      const cwNS2 = new THREE.Mesh(cwGeoNS.clone(), new THREE.MeshLambertMaterial({ map: crosswalkTex, color: 0xeeeeee }));
      cwNS2.rotation.x = -Math.PI / 2;
      cwNS2.position.set(x, 0.04, z + ROAD.width / 2 + BLOCK.sidewalk / 2);
      cwNS2.receiveShadow = true;
      scene.add(cwNS2);

      const cwGeoEW = new THREE.PlaneGeometry(cwD, cwW);
      const cwEW = new THREE.Mesh(cwGeoEW, new THREE.MeshLambertMaterial({ map: crosswalkTex, color: 0xeeeeee }));
      cwEW.rotation.x = -Math.PI / 2;
      cwEW.position.set(x - ROAD.width / 2 - BLOCK.sidewalk / 2, 0.04, z);
      cwEW.receiveShadow = true;
      scene.add(cwEW);

      const cwEW2 = new THREE.Mesh(cwGeoEW.clone(), new THREE.MeshLambertMaterial({ map: crosswalkTex, color: 0xeeeeee }));
      cwEW2.rotation.x = -Math.PI / 2;
      cwEW2.position.set(x + ROAD.width / 2 + BLOCK.sidewalk / 2, 0.04, z);
      cwEW2.receiveShadow = true;
      scene.add(cwEW2);
    }
  }

  // Buildings
  const roofTex = createRoofTexture();

  for (let col = 0; col < numBlockCols; col++) {
    for (let row = 0; row < numBlockRows; row++) {
      const district = getDistrictFor(col, row);
      const bounds = blockBounds(col, row);
      const areaW = bounds.maxX - bounds.minX;
      const areaD = bounds.maxZ - bounds.minZ;

      const maxBuildingW = BUILDING.maxSize + BUILDING.gap;
      const maxBuildingD = BUILDING.maxSize + BUILDING.gap;
      const lotsX = Math.max(1, Math.floor(areaW / maxBuildingW));
      const lotsZ = Math.max(1, Math.floor(areaD / maxBuildingD));
      const lotW = areaW / lotsX;
      const lotD = areaD / lotsZ;

      for (let lx = 0; lx < lotsX; lx++) {
        for (let lz = 0; lz < lotsZ; lz++) {
          if (!random.bool() && random() > 0.2) continue;

          const bw = random.float(BUILDING.minSize, Math.min(BUILDING.maxSize, lotW - BUILDING.gap));
          const bd = random.float(BUILDING.minSize, Math.min(BUILDING.maxSize, lotD - BUILDING.gap));
          const bh = random.float(BUILDING.minHeight, BUILDING.maxHeight);

          const bx = bounds.minX + lx * lotW + random.float(BUILDING.gap, lotW - bw - BUILDING.gap);
          const bz = bounds.minZ + lz * lotD + random.float(BUILDING.gap, lotD - bd - BUILDING.gap);

          const baseColor = pastelStyle(random, district.colour);
          const neonColor = random.pick(NEON_COLOURS);
          const tex = createBuildingTexture(
            random, 256, Math.min(512, Math.max(128, bh * 16)), baseColor, neonColor,
          );

          const bodyGeo = new THREE.BoxGeometry(bw, bh, bd);
          const bodyMat = new THREE.MeshLambertMaterial({ map: tex, color: 0xffffff });
          const body = new THREE.Mesh(bodyGeo, bodyMat);
          body.position.set(bx, bh / 2, bz);
          body.castShadow = true;
          body.receiveShadow = true;
          scene.add(body);

          const roofGeo = new THREE.BoxGeometry(bw + 0.3, 0.3, bd + 0.3);
          const roofMat = new THREE.MeshLambertMaterial({ map: roofTex, color: 0xeeeeee });
          const roof = new THREE.Mesh(roofGeo, roofMat);
          roof.position.set(bx, bh + 0.15, bz);
          roof.castShadow = true;
          scene.add(roof);

          collisionBoxes.push({
            minX: bx - bw / 2,
            maxX: bx + bw / 2,
            minZ: bz - bd / 2,
            maxZ: bz + bd / 2,
          });
        }
      }
    }
  }

  // Block infill (plaza/gravel between buildings)
  const plazaTex = createPlazaTexture();
  const gravelTex = createGravelTexture();

  for (let col = 0; col < numBlockCols; col++) {
    for (let row = 0; row < numBlockRows; row++) {
      const bounds = blockBounds(col, row);
      const areaW = bounds.maxX - bounds.minX;
      const areaD = bounds.maxZ - bounds.minZ;
      const district = getDistrictFor(col, row);

      const isPaved = ['Casino Row', 'Docks', 'Beachfront'].indexOf(district.name) >= 0
        || (col === 0 && row === 0);
      const useTex = isPaved ? plazaTex : gravelTex;
      const texColor = isPaved ? 0xddddcc : 0xccbbaa;

      const fillGeo = new THREE.PlaneGeometry(areaW, areaD);
      const fill = new THREE.Mesh(fillGeo, new THREE.MeshLambertMaterial({ map: useTex, color: texColor }));
      fill.rotation.x = -Math.PI / 2;
      fill.position.set(bounds.minX + areaW / 2, 0.015, bounds.minZ + areaD / 2);
      fill.receiveShadow = true;
      scene.add(fill);
    }
  }

  // Street lamps
  for (let i = 0; i < numVertRoads; i += 2) {
    const x = vertRoadX[i];
    for (let j = 0; j < numHorizRoads - 1; j++) {
      const z = horizRoadZ[j] + BLOCK.size / 2;
      createStreetLamp(scene, x + ROAD.width / 2 + 1.5, z, random);
      createStreetLamp(scene, x - ROAD.width / 2 - 1.5, z, random);
    }
  }

  for (let i = 0; i < numHorizRoads; i += 2) {
    const z = horizRoadZ[i];
    for (let j = 0; j < numVertRoads - 1; j++) {
      const x = vertRoadX[j] + BLOCK.size / 2;
      createStreetLamp(scene, x, z + ROAD.width / 2 + 1.5, random);
      createStreetLamp(scene, x, z - ROAD.width / 2 - 1.5, random);
    }
  }

  // Road palm trees (Beachfront and Marina districts)
  const treeRows = [0, 1];
  for (const row of treeRows) {
    for (let col = 0; col < numBlockCols; col++) {
      const district = getDistrictFor(col, row);
      if (district.name === 'Beachfront' || district.name === 'Marina') {
        const b = blockBounds(col, row);
        const tx = b.minX + random.float(2, (b.maxX - b.minX) - 2);
        const tz = horizRoadZ[row] - ROAD.width / 2 - random.float(1, 4);
        const treeH = 4 + random.float(0, 2);
        const tree = createPalmTrunk(random, 0, treeH);
        tree.position.set(tx, 0, tz);
        scene.add(tree);

        const tz2 = horizRoadZ[row + 1] + ROAD.width / 2 + random.float(1, 4);
        const tree2 = createPalmTrunk(random, 0, 4 + random.float(0, 2));
        tree2.position.set(tx, 0, tz2);
        scene.add(tree2);
      }
    }
  }

  // Special places
  function placeBuilding(key, px, pz, pw, pd, ph, texFn, neonColor) {
    const tex = texFn();
    const bodyGeo = new THREE.BoxGeometry(pw, ph, pd);
    const bodyMat = new THREE.MeshLambertMaterial({ map: tex, color: 0xffffff });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.set(px, ph / 2, pz);
    body.castShadow = true;
    body.receiveShadow = true;
    scene.add(body);

    collisionBoxes.push({
      minX: px - pw / 2,
      maxX: px + pw / 2,
      minZ: pz - pd / 2,
      maxZ: pz + pd / 2,
    });

    places[key] = { x: px, z: pz };
  }

  const { coralFin, garage, ammuKiosk, casino, hospital, policeStation, ferryPier } = PLACES;

  // Coral Fin bar
  const cfTex = makeCanvas(256, 512, (ctx, w, h) => {
    ctx.fillStyle = '#dda0dd';
    ctx.fillRect(0, 0, w, h);
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 4; col++) {
        const x = 8 + col * 60;
        const y = 8 + row * 55;
        ctx.fillStyle = '#ffffcc';
        ctx.fillRect(x, y, 44, 32);
        ctx.strokeStyle = '#cc88cc';
        ctx.strokeRect(x, y, 44, 32);
      }
    }
    ctx.font = 'bold 32px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff69b4';
    ctx.shadowColor = '#ff69b4';
    ctx.shadowBlur = 15;
    ctx.fillText('CORAL', w / 2, h / 2 + 30);
    ctx.fillText('FIN', w / 2, h / 2 + 65);
    ctx.shadowBlur = 0;
  });
  placeBuilding('coralFin', coralFin.x, coralFin.z, 18, 14, 22, () => cfTex);

  // Garage
  const garTex = createGarageTexture();
  placeBuilding('garage', garage.x, garage.z, 30, 16, 8, () => garTex);

  // Ammu-Kiosk
  const amTex = makeCanvas(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#556b2f';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 3; i++) {
      const y = 30 + i * 60;
      ctx.fillStyle = '#2c2c2c';
      ctx.fillRect(16, y, w - 32, 40);
      ctx.strokeStyle = '#444444';
      ctx.strokeRect(16, y, w - 32, 40);
    }
    ctx.font = 'bold 30px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff4444';
    ctx.shadowColor = '#ff0000';
    ctx.shadowBlur = 10;
    ctx.fillText('AMMU', w / 2, h - 24);
    ctx.shadowBlur = 0;
  });
  placeBuilding('ammuKiosk', ammuKiosk.x, ammuKiosk.z, 14, 10, 12, () => amTex);

  // Casino
  const casTex = makeCanvas(256, 512, (ctx, w, h) => {
    ctx.fillStyle = '#2a0a2a';
    ctx.fillRect(0, 0, w, h);
    for (let row = 0; row < 12; row++) {
      for (let col = 0; col < 5; col++) {
        const x = 6 + col * 49;
        const y = 6 + row * 40;
        const lit = row % 3 !== 0;
        ctx.fillStyle = lit ? '#ffff88' : '#3a1a3a';
        ctx.fillRect(x, y, 40, 28);
        if (lit) {
          ctx.fillStyle = 'rgba(255,255,150,0.2)';
          ctx.fillRect(x, y, 40, 10);
        }
      }
    }
    for (let i = 0; i < 5; i++) {
      const ny = 60 + i * 100;
      ctx.strokeStyle = NEON_COLOURS[i % NEON_COLOURS.length];
      ctx.lineWidth = 4;
      ctx.shadowColor = NEON_COLOURS[i % NEON_COLOURS.length];
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.moveTo(20, ny);
      ctx.lineTo(w - 20, ny);
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
    ctx.font = 'bold 36px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd700';
    ctx.shadowColor = '#ffd700';
    ctx.shadowBlur = 20;
    ctx.fillText('CASINO', w / 2, h - 20);
    ctx.shadowBlur = 0;
  });
  placeBuilding('casino', casino.x, casino.z, 28, 20, 40, () => casTex);

  // Hospital
  const hosTex = createHospitalTexture();
  placeBuilding('hospital', hospital.x, hospital.z, 22, 18, 20, () => hosTex);

  // Police station
  const polTex = createPoliceTexture();
  placeBuilding('policeStation', policeStation.x, policeStation.z, 24, 16, 18, () => polTex);

  // Ferry Pier
  const pierX = ferryPier.x;
  const pierZ = ferryPier.z;
  const pierLen = 40;
  const pierW = 8;
  const pierGeo = new THREE.BoxGeometry(pierW, 0.5, pierLen);
  const pierMat = new THREE.MeshLambertMaterial({ map: createMarinaWoodTexture(), color: 0xdddddd });
  const pier = new THREE.Mesh(pierGeo, pierMat);
  pier.position.set(pierX, 0.3, pierZ);
  pier.castShadow = true;
  pier.receiveShadow = true;
  scene.add(pier);

  for (let i = 0; i < 5; i++) {
    const px = pierX + i * 0.5 - 1;
    const postGeo = new THREE.CylinderGeometry(0.2, 0.2, 3, 8);
    const post = new THREE.Mesh(postGeo, new THREE.MeshLambertMaterial({ color: 0x8b6914 }));
    post.position.set(px, 1.8, pierZ - pierLen / 2 + 2);
    post.castShadow = true;
    scene.add(post);
    const post2 = post.clone();
    post2.position.set(px, 1.8, pierZ + pierLen / 2 - 2);
    scene.add(post2);
  }

  places['ferryPier'] = { x: pierX, z: pierZ };

  // Beach
  const beachWidth = gridMaxX - gridMinX + 120;
  const beachDepth = 80;
  const sandTex = createSandTexture();
  sandTex.repeat.set(beachWidth / 64, beachDepth / 64);
  const beachGeo = new THREE.PlaneGeometry(beachWidth, beachDepth);
  const beachMat = new THREE.MeshLambertMaterial({ map: sandTex, color: 0xffeedd });
  const beach = new THREE.Mesh(beachGeo, beachMat);
  beach.rotation.x = -Math.PI / 2;
  beach.position.set((gridMinX + gridMaxX) / 2, 0.01, beachZ + beachDepth / 2);
  beach.receiveShadow = true;
  scene.add(beach);

  // Beach palm trees
  const numBeachTrees = 25 + random.int(11);
  for (let i = 0; i < numBeachTrees; i++) {
    const tx = gridMinX + random.float(-40, (gridMaxX - gridMinX) + 40);
    const tz = beachZ + random.float(5, beachDepth + 30);
    const treeH = 5 + random.float(0, 4);
    const tree = createPalmTrunk(random, 0, treeH);
    tree.position.set(tx, 0, tz);
    tree.rotation.z = random.float(-0.15, 0.15);
    tree.rotation.x = random.float(-0.1, 0.1);
    scene.add(tree);
  }

  // Water
  const waterW = halfWorld * 1.5;
  const waterD = halfWorld * 1.5;
  const waterTex = createWaterTexture();
  waterTex.repeat.set(waterW / 64, waterD / 64);
  const waterGeo = new THREE.PlaneGeometry(waterW, waterD);
  const waterMat = new THREE.MeshPhongMaterial({
    map: waterTex,
    color: 0xaaccdd,
    transparent: true,
    opacity: 0.85,
    specular: 0x334455,
    shininess: 40,
  });
  const water = new THREE.Mesh(waterGeo, waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, seaLevel, beachZ + beachDepth + waterD / 2 + 40);
  water.receiveShadow = true;
  water.name = 'water';
  scene.add(water);

  // Marina
  const marinaX = gridMinX - 30;
  const marinaZ = horizRoadZ[2];
  const numPiers = 3;
  for (let p = 0; p < numPiers; p++) {
    const pz = marinaZ - 20 + p * 40;
    const pLen = 30 + random.float(0, 15);
    const pW = 4 + random.float(0, 2);

    const marinaPierGeo = new THREE.BoxGeometry(pW, 0.4, pLen);
    const marinaPier = new THREE.Mesh(marinaPierGeo, new THREE.MeshLambertMaterial({ map: createMarinaWoodTexture(), color: 0xdddddd }));
    marinaPier.position.set(marinaX, 0.2, pz);
    marinaPier.castShadow = true;
    marinaPier.receiveShadow = true;
    scene.add(marinaPier);

    for (let b = 0; b < 2; b++) {
      const boatX = marinaX - pW / 2 - random.float(2, 5);
      const boatZ = pz - pLen / 2 + random.float(8, pLen - 8);
      const hullGeo = new THREE.BoxGeometry(2.5, 1.2, 6);
      const hull = new THREE.Mesh(hullGeo, new THREE.MeshLambertMaterial({
        color: random.pick([0xffffff, 0xddeeff, 0xffffcc, 0xccddff]),
      }));
      hull.position.set(boatX, seaLevel + 0.5, boatZ);
      hull.castShadow = true;
      hull.receiveShadow = true;
      scene.add(hull);

      const cabinGeo = new THREE.BoxGeometry(2, 1, 2.5);
      const cabin = new THREE.Mesh(cabinGeo, new THREE.MeshLambertMaterial({
        color: random.pick([0xdddddd, 0xeeeeff, 0xffffff]),
      }));
      cabin.position.set(boatX, seaLevel + 1.5, boatZ - 0.5);
      scene.add(cabin);
    }

    for (let j = 0; j < 6; j++) {
      const postGeo = new THREE.CylinderGeometry(0.15, 0.15, 2.5, 6);
      const post = new THREE.Mesh(postGeo, new THREE.MeshLambertMaterial({ color: 0x6b4e0a }));
      post.position.set(marinaX + (j % 2 === 0 ? -pW / 2 : pW / 2), -0.7, pz - pLen / 2 + j * (pLen / 5));
      scene.add(post);
    }
  }

  // Docks (northwest area)
  const docksBaseX = gridMinX - 40;
  const docksBaseZ = horizRoadZ[2] - 60;

  for (let i = 0; i < 4; i++) {
    const dx = docksBaseX + i * 18;
    const dw = 14;
    const dd = 20;
    const dh = 8 + random.int(8);
    const dTex = makeCanvas(128, 256, (ctx, w, h) => {
      ctx.fillStyle = '#8899aa';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#667788';
      ctx.lineWidth = 2;
      for (let y = 0; y < h; y += 20) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
    });
    const dGeo = new THREE.BoxGeometry(dw, dh, dd);
    const dBuilding = new THREE.Mesh(dGeo, new THREE.MeshLambertMaterial({ map: dTex, color: 0xcccccc }));
    dBuilding.position.set(dx, dh / 2, docksBaseZ);
    dBuilding.castShadow = true;
    dBuilding.receiveShadow = true;
    scene.add(dBuilding);

    collisionBoxes.push({
      minX: dx - dw / 2, maxX: dx + dw / 2,
      minZ: docksBaseZ - dd / 2, maxZ: docksBaseZ + dd / 2,
    });
  }

  // Container boxes in docks
  for (let i = 0; i < 12; i++) {
    const cx = docksBaseX + random.float(-30, 50);
    const cz = docksBaseZ - 50 + random.float(-30, 30);
    const cw = 4 + random.float(0, 4);
    const cd = 8 + random.float(0, 4);
    const ch = 3 + random.float(0, 2);
    const cColors = [0xcc4444, 0x4488cc, 0x44aa44, 0xcccc44, 0xcc8844, 0x888888];
    const cGeo = new THREE.BoxGeometry(cw, ch, cd);
    const cBox = new THREE.Mesh(cGeo, new THREE.MeshLambertMaterial({ color: random.pick(cColors) }));
    cBox.position.set(cx, ch / 2, cz);
    cBox.castShadow = true;
    cBox.receiveShadow = true;
    scene.add(cBox);

    collisionBoxes.push({
      minX: cx - cw / 2, maxX: cx + cw / 2,
      minZ: cz - cd / 2, maxZ: cz + cd / 2,
    });
  }

  // Crane-like structures in docks
  for (let i = 0; i < 2; i++) {
    const craneX = docksBaseX + 10 + i * 40;
    const craneZ = docksBaseZ + random.float(-20, 20);

    const baseGeo = new THREE.CylinderGeometry(1.5, 2, 20, 8);
    const base = new THREE.Mesh(baseGeo, new THREE.MeshLambertMaterial({ color: 0xff6600 }));
    base.position.set(craneX, 10, craneZ);
    base.castShadow = true;
    scene.add(base);

    const armGeo = new THREE.BoxGeometry(18, 1, 1);
    const arm = new THREE.Mesh(armGeo, new THREE.MeshLambertMaterial({ color: 0xff8800 }));
    arm.position.set(craneX + 9, 20, craneZ);
    arm.castShadow = true;
    scene.add(arm);

    const cableGeo = new THREE.BoxGeometry(0.2, 8, 0.2);
    const cable = new THREE.Mesh(cableGeo, new THREE.MeshLambertMaterial({ color: 0x333333 }));
    cable.position.set(craneX + 14, 15.5, craneZ);
    scene.add(cable);
  }

  // Sky
  const skyTex = createSkyTexture();
  const skyGeo = new THREE.SphereGeometry(halfWorld * 0.9, 64, 32);
  const skyMat = new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  sky.position.y = -halfWorld * 0.15;
  scene.add(sky);

  // Lighting
  const hemiLight = new THREE.HemisphereLight(0x886644, 0x443322, 0.6);
  scene.add(hemiLight);

  const ambientLight = new THREE.AmbientLight(0x221133, 0.3);
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0xffcc88, 0.8);
  dirLight.position.set(200, 120, -300);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width = 2048;
  dirLight.shadow.mapSize.height = 2048;
  dirLight.shadow.camera.left = -300;
  dirLight.shadow.camera.right = 300;
  dirLight.shadow.camera.top = 200;
  dirLight.shadow.camera.bottom = -200;
  dirLight.shadow.camera.near = 1;
  dirLight.shadow.camera.far = 800;
  dirLight.shadow.bias = -0.0005;
  scene.add(dirLight);

  scene.fog = new THREE.FogExp2(0x332244, 0.00008);

  return {
    scene,
    collisionBoxes,
    roads: roadSegments,
    places,
    seaLevel,
    beachZ,
    waterMesh: water,
  };
}

function createStreetLamp(scene, x, z, random) {
  const group = new THREE.Group();

  const poleGeo = new THREE.CylinderGeometry(0.15, 0.2, 6, 8);
  const pole = new THREE.Mesh(poleGeo, new THREE.MeshLambertMaterial({ color: 0x444444 }));
  pole.position.y = 3;
  pole.castShadow = true;
  group.add(pole);

  const armGeo = new THREE.BoxGeometry(2, 0.15, 0.15);
  const arm = new THREE.Mesh(armGeo, new THREE.MeshLambertMaterial({ color: 0x444444 }));
  arm.position.set(1, 6, 0);
  group.add(arm);

  const lampGeo = new THREE.SphereGeometry(0.4, 8, 8);
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffcc66 });
  const lamp = new THREE.Mesh(lampGeo, lampMat);
  lamp.position.set(2, 5.8, 0);
  group.add(lamp);

  const glowGeo = new THREE.SphereGeometry(0.5, 8, 8);
  const glowMat = new THREE.MeshBasicMaterial({
    color: 0xffaa33,
    transparent: true,
    opacity: 0.3,
  });
  const glow = new THREE.Mesh(glowGeo, glowMat);
  glow.position.copy(lamp.position);
  group.add(glow);

  group.position.set(x, 0, z);
  scene.add(group);
}