(function () {
  "use strict";
  const C = window.BIRTHDAY_CONTENT;
  const $ = (id) => document.getElementById(id);
  const journey = new window.Journey();
  const world = $("world"), ctx = world.getContext("2d");
  const cover = $("cover-canvas"), coverCtx = cover.getContext("2d");
  cover.width = 1440; cover.height = 900;
  const W = 1440, H = 900;
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let playing = false, lastTime = 0, frameTime = 0, nearest = null, toastTimer;
  let closeHandler = null, audioContext = null, musicTimer = null, musicOn = false, melodyIndex = 0, audioBus = null;
  const keys = new Set();
  const player = { x: 720, y: 767, walking: false, facing: 1 };
  const flowers = [{ x: 285, y: 532 }, { x: 385, y: 475 }, { x: 420, y: 607 }];
  const lamps = [{ x: 1000, y: 383 }, { x: 1270, y: 512 }, { x: 1080, y: 594 }];
  const chapterStars = [{ x: 345, y: 570 }, { x: 699, y: 363 }, { x: 1180, y: 635 }];
  const finale = { x: 745, y: 638 };
  const random = (n) => { const value = Math.sin(n * 127.1 + 311.7) * 43758.5453; return value - Math.floor(value); };
  const text = (value) => String(value ?? "").replaceAll("{recipient}", C.recipient).replaceAll("{sender}", C.sender);
  const element = (tag, className, content) => { const el = document.createElement(tag); if (className) el.className = className; if (content !== undefined) el.textContent = text(content); return el; };
  const chapter = () => C.chapters[journey.chapter];

  // Drawing uses local vector shapes only; the game never fetches external assets.
  function ellipse(g, x, y, rx, ry, fill, rotation = 0) { g.beginPath(); g.ellipse(x, y, rx, ry, rotation, 0, Math.PI * 2); g.fillStyle = fill; g.fill(); }
  function rounded(g, x, y, w, h, r, fill, stroke) { g.beginPath(); g.roundRect(x, y, w, h, r); if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.strokeStyle = stroke; g.lineWidth = 2; g.stroke(); } }
  function line(g, points, color, width = 2) { g.beginPath(); points.forEach((p, i) => i ? g.lineTo(...p) : g.moveTo(...p)); g.strokeStyle = color; g.lineWidth = width; g.lineCap = "round"; g.lineJoin = "round"; g.stroke(); }
  function star(g, x, y, size, fill, alpha = 1) {
    g.save(); g.globalAlpha = alpha; g.beginPath();
    for (let i = 0; i < 8; i++) { const r = i % 2 ? size * .26 : size; const a = i * Math.PI / 4 - Math.PI / 2; const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r; i ? g.lineTo(px, py) : g.moveTo(px, py); }
    g.closePath(); g.fillStyle = fill; g.fill(); g.restore();
  }
  function leaf(g, x, y, s, rotation, fill) { ellipse(g, x, y, s * .47, s, fill, rotation); }
  function bush(g, x, y, s, seed) {
    ellipse(g, x, y + 12 * s, 43 * s, 16 * s, "#68836816");
    for (let i = 0; i < 8; i++) {
      const a = i * 2.4; const xx = x + Math.cos(a) * (12 + random(seed + i) * 16) * s;
      const yy = y + Math.sin(a) * 14 * s;
      ellipse(g, xx, yy, (17 + random(seed + i + 1) * 10) * s, 19 * s, ["#a4b590", "#b7c5a1", "#9aaf88", "#c3ccaa"][i % 4]);
    }
    for (let i = 0; i < 8; i++) { const xx = x + (random(seed + i + 43) - .5) * 55 * s, yy = y + (random(seed + i + 93) - .5) * 25 * s; ellipse(g, xx, yy, 2.6 * s, 3.8 * s, "#dce3bb", -.7); }
  }
  function tree(g, x, y, s, seed) {
    ellipse(g, x + 12, y + 7, 52 * s, 18 * s, "#65805c14");
    line(g, [[x, y], [x - 3 * s, y - 75 * s]], "#9a9e75", 9 * s);
    line(g, [[x, y - 38 * s], [x - 29 * s, y - 64 * s]], "#9a9e75", 5 * s);
    bush(g, x, y - 98 * s, s * 1.55, seed);
    bush(g, x - 29 * s, y - 73 * s, s * .85, seed + 7);
    bush(g, x + 27 * s, y - 76 * s, s, seed + 15);
    for (let i = 0; i < 5; i++) ellipse(g, x + (random(seed + i) - .5) * 75 * s, y - (70 + random(seed + i + 5) * 50) * s, 3 * s, 3 * s, "#f2ebc9");
  }
  function blossom(g, x, y, s, bloom, seed) {
    const sway = reducedMotion ? 0 : Math.sin(frameTime / 1200 + seed) * 2;
    line(g, [[x, y], [x + sway, y - 17 * s]], "#7f956c", 2 * s);
    leaf(g, x - 4 * s, y - 6 * s, 5 * s, -.8, "#9bad80");
    leaf(g, x + 4 * s, y - 9 * s, 5 * s, .8, "#b0bd8e");
    if (bloom) {
      for (let i = 0; i < 5; i++) { const a = i * Math.PI * 2 / 5; ellipse(g, x + sway + Math.cos(a) * 5 * s, y - 19 * s + Math.sin(a) * 5 * s, 4.5 * s, 5 * s, ["#e7b9ac", "#f2d2bd", "#f5eed2"][seed % 3], a); }
      ellipse(g, x + sway, y - 19 * s, 3 * s, 3 * s, "#d8b466");
    } else { ellipse(g, x + sway, y - 18 * s, 4 * s, 6 * s, "#a5ae7b"); }
  }
  function glow(g, x, y, r, color = "#efce77") {
    const gradient = g.createRadialGradient(x, y, 0, x, y, r); gradient.addColorStop(0, color + "90"); gradient.addColorStop(1, color + "00"); ellipse(g, x, y, r, r, gradient);
  }
  function label(g, title, subtitle, x, y) {
    rounded(g, x - 102, y - 23, 204, 49, 9, "#f9f5e6b8");
    g.textAlign = "center"; g.fillStyle = "#6f8262"; g.font = "18px Georgia, SimSun, serif"; g.fillText(title, x, y);
    g.fillStyle = "#91a17f"; g.font = "8px Segoe UI, sans-serif"; g.letterSpacing = "2px"; g.fillText(subtitle, x, y + 18); g.letterSpacing = "0px";
  }
  function path(g, points, width) {
    g.beginPath(); g.moveTo(...points[0]);
    for (let i = 1; i < points.length; i += 3) g.bezierCurveTo(...points[i], ...points[i + 1], ...points[i + 2]);
    g.strokeStyle = "#e0dec3"; g.lineWidth = width + 8; g.lineCap = "round"; g.stroke();
    g.strokeStyle = "#f0e9d0"; g.lineWidth = width; g.stroke();
    g.strokeStyle = "#f7efd9"; g.lineWidth = width * .55; g.stroke();
  }
  function drawHouse(g) {
    ellipse(g, 700, 331, 161, 42, "#67795515");
    rounded(g, 589, 221, 220, 115, 7, "#f5e9d1", "#d1bd99");
    rounded(g, 601, 231, 195, 92, 4, "#f9efdb");
    for (let i = 0; i < 7; i++) line(g, [[601, 241 + i * 13], [795, 241 + i * 13]], "#e9dcc3", 1);
    rounded(g, 743, 133, 26, 57, 4, "#bba48a");
    g.beginPath(); g.moveTo(567, 238); g.lineTo(697, 128); g.lineTo(832, 238); g.closePath(); g.fillStyle = "#929e7b"; g.fill();
    g.beginPath(); g.moveTo(580, 232); g.lineTo(697, 138); g.lineTo(816, 232); g.closePath(); g.fillStyle = "#acb493"; g.fill();
    for (let y = 175; y < 230; y += 14) { const half = (y - 135) * 1.15; line(g, [[697 - half, y], [697 + half, y]], "#99a582", 2); }
    ellipse(g, 697, 195, 16, 17, "#f6edd3"); line(g, [[697, 181], [697, 209]], "#bbb28c", 2); line(g, [[684, 195], [710, 195]], "#bbb28c", 2);
    rounded(g, 674, 264, 48, 72, [23, 23, 0, 0], "#a0ac87", "#889576");
    ellipse(g, 710, 304, 3, 3, "#eeddab");
    for (const x of [616, 753]) {
      rounded(g, x, 262, 30, 31, 3, "#e1c98d", "#b4b38e"); glow(g, x + 15, 277, 32, "#f3d990");
      line(g, [[x + 15, 263], [x + 15, 291]], "#c2b08b", 2); line(g, [[x + 1, 278], [x + 29, 278]], "#c2b08b", 2);
      rounded(g, x - 3, 297, 36, 8, 2, "#b3ac88");
      for (let j = 0; j < 4; j++) blossom(g, x + j * 8 + 3, 299, .65, true, j);
    }
    rounded(g, 665, 335, 65, 10, 3, "#d4cbb0"); rounded(g, 653, 345, 88, 11, 3, "#e0d8bc");
    for (const x of [573, 824]) { ellipse(g, x, 331, 17, 7, "#a0ac7c"); rounded(g, x - 12, 309, 24, 24, [2, 2, 7, 7], "#cca890"); bush(g, x, 307, .45, x); }
  }
  function drawPond(g) {
    ellipse(g, 1134, 457, 158, 106, "#c2cbae", -.18);
    ellipse(g, 1134, 451, 146, 97, "#b1c6b6", -.18);
    ellipse(g, 1134, 448, 134, 85, "#c4d6c5", -.18);
    ellipse(g, 1115, 431, 109, 63, "#d3dfce", -.18);
    for (let i = 0; i < 10; i++) { const x = 1042 + random(i + 95) * 165, y = 412 + random(i + 16) * 88; line(g, [[x, y], [x + 15 + (reducedMotion ? 0 : Math.sin(frameTime / 1600 + i) * 4), y]], "#ecf0dcaa", 1.5); }
    for (let i = 0; i < 5; i++) { const x = 1053 + random(i + 75) * 143, y = 435 + random(i + 55) * 72; ellipse(g, x, y, 13, 6, "#91af8b", -.2); if (i % 2 === 0) { ellipse(g, x, y - 5, 5, 5, "#f0d1c0"); ellipse(g, x, y - 5, 2, 2, "#d2b579"); } }
    for (let i = 0; i < 7; i++) { const x = 1254 + random(i + 45) * 34, y = 415 + i * 12; line(g, [[x, y], [x - 6, y - 32]], "#99ae83", 2); ellipse(g, x - 6, y - 33, 2.5, 7, "#b7a780"); }
    for (let i = 0; i < 7; i++) rounded(g, 1010 + i * 14, 534 - i * 4, 12, 46, 2, i % 2 ? "#c4b798" : "#d6c7a7");
    line(g, [[1010, 534], [1108, 506]], "#b6ab8c", 4);
  }
  function drawLantern(g, p, on) {
    if (on) glow(g, p.x, p.y - 32, 53);
    line(g, [[p.x, p.y], [p.x, p.y - 50]], "#9c9773", 3);
    line(g, [[p.x, p.y - 50], [p.x + 10, p.y - 50], [p.x + 10, p.y - 44]], "#9c9773", 3);
    rounded(g, p.x, p.y - 43, 20, 27, 5, on ? "#fae3a0" : "#d6dcc0", "#aaa884");
    line(g, [[p.x + 7, p.y - 42], [p.x + 7, p.y - 17]], on ? "#f3cc76" : "#c1c9aa", 1.5);
    ellipse(g, p.x, p.y + 2, 13, 4, "#7f906222");
  }
  function drawCourtyard(g, coverMode) {
    const lit = coverMode || journey.chapter === 3;
    ellipse(g, 745, 667, 132, 63, "#d9d8b8"); ellipse(g, 745, 662, 128, 58, "#ede7cd");
    g.save(); g.setLineDash([3, 11]); g.beginPath(); g.ellipse(745, 662, 119, 48, 0, 0, Math.PI * 2); g.strokeStyle = "#d2c6a2"; g.lineWidth = 2; g.stroke(); g.restore();
    for (const x of [617, 873]) { line(g, [[x, 659], [x, 514]], "#b5a57c", 5); ellipse(g, x, 510, 6, 7, "#d4c08d"); bush(g, x, 655, .45, x); }
    g.beginPath(); g.moveTo(617, 522); g.quadraticCurveTo(745, 572, 873, 522); g.strokeStyle = "#b4af87"; g.lineWidth = 2; g.stroke();
    for (let i = 0; i < 9; i++) { const t = i / 8, x = 617 + 256 * t, y = 522 + 100 * t * (1 - t); if (lit) glow(g, x, y + 8, 28); star(g, x, y + 8, 7, lit ? "#f2cb75" : "#c2c5a0"); }
    if (lit) {
      line(g, [[713, 663], [709, 700]], "#bdac84", 6); line(g, [[778, 663], [783, 700]], "#bdac84", 6);
      ellipse(g, 745, 656, 63, 26, "#d3bda0"); ellipse(g, 745, 650, 66, 25, "#fff4dc");
      rounded(g, 719, 616, 51, 33, [5, 5, 12, 12], "#e9b9a9"); ellipse(g, 744, 617, 25, 10, "#fff5df");
      for (let i = 0; i < 5; i++) ellipse(g, 725 + i * 10, 623, 4, 6, "#fff3dc");
      for (const x of [734, 745, 756]) { line(g, [[x, 612], [x, 599]], "#aab998", 3); ellipse(g, x, 594, 3, 6, "#eac168"); glow(g, x, 594, 23); }
      rounded(g, 656, 664, 27, 24, 3, "#c2cbaa"); line(g, [[669, 665], [669, 687]], "#f1e8cb", 3);
      rounded(g, 802, 670, 31, 22, 3, "#dfbbaa"); line(g, [[817, 671], [817, 691]], "#fff0d2", 3);
    } else {
      for (let i = 0; i < 3; i++) star(g, 721 + i * 24, 650, 9, "#c5c7a3");
    }
  }
  function avatar(g, x, y, sender = false) {
    const bob = player.walking && !sender && !reducedMotion ? Math.sin(frameTime / 75) * 2 : 0;
    ellipse(g, x, y + 3, 14, 5, "#4e654627");
    g.save(); g.translate(x, y + bob);
    const stride = player.walking && !sender ? Math.sin(frameTime / 85) * 4 : 0;
    line(g, [[-5, -5], [-5 + stride, 2]], "#7b745e", 4); line(g, [[5, -5], [5 - stride, 2]], "#7b745e", 4);
    if (sender) rounded(g, -12, -27, 24, 23, [8, 8, 3, 3], "#80927d");
    else { g.beginPath(); g.moveTo(-9, -28); g.lineTo(9, -28); g.lineTo(17, -5); g.quadraticCurveTo(0, 1, -17, -5); g.closePath(); g.fillStyle = "#cc9b89"; g.fill(); line(g, [[-8, -16], [9, -16]], "#e9c2ad", 2); }
    line(g, [[-11, -23], [-16, -12]], "#eacba8", 5); line(g, [[11, -23], [16, -12]], "#eacba8", 5);
    ellipse(g, 0, -37, 13, 16, "#746e58");
    if (!sender) { ellipse(g, -10, -30, 5, 12, "#746e58"); ellipse(g, 10, -30, 5, 12, "#746e58"); }
    ellipse(g, 0, -35, 10, 11, "#efd5b6");
    ellipse(g, -4, -36, 1.1, 1.5, "#605e50"); ellipse(g, 4, -36, 1.1, 1.5, "#605e50");
    ellipse(g, -7, -32, 2.6, 1.7, "#e9b5a2"); ellipse(g, 7, -32, 2.6, 1.7, "#e9b5a2");
    g.beginPath(); g.arc(0, -33, 3, .4, Math.PI - .4); g.strokeStyle = "#b88b78"; g.lineWidth = 1; g.stroke();
    ellipse(g, -1, -45, 12, 5, "#746e58", -.18);
    if (!sender) { ellipse(g, 10, -45, 6, 3, "#f0dec0", -.5); ellipse(g, 14, -48, 3, 5, "#f0dec0", -.5); }
    g.restore();
  }
  function marker(g, x, y, kind, active) {
    if (!active) return;
    const bob = reducedMotion ? 0 : Math.sin(frameTime / 550) * 3;
    glow(g, x, y - 58 + bob, 35);
    ellipse(g, x, y - 58 + bob, 14, 14, "#fffcdfed");
    g.textAlign = "center"; g.font = "15px Georgia"; g.fillStyle = "#b4934f"; g.fillText(kind, x, y - 53 + bob);
  }
  function draw(g, coverMode = false) {
    g.clearRect(0, 0, W, H);
    const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, "#e8edda"); bg.addColorStop(1, "#e4e9d3"); g.fillStyle = bg; g.fillRect(0, 0, W, H);
    ellipse(g, 688, 460, 625, 401, "#eef0dc");
    // Deterministic paper grain and meadow marks stay stable between frames.
    for (let i = 0; i < 850; i++) { const x = random(i + 3) * W, y = random(i + 850) * H; ellipse(g, x, y, .6 + random(i + 56), .6, i % 2 ? "#a9b69319" : "#ffffff55"); }
    for (let i = 0; i < 130; i++) { const x = random(i + 43) * W, y = random(i + 433) * H; line(g, [[x - 3, y], [x - 5, y - 5]], "#bbc7a367", 1); line(g, [[x, y], [x + 1, y - 7]], "#bbc7a367", 1); }
    path(g, [[716, 885], [640, 753], [674, 736], [731, 653], [829, 498], [682, 467], [700, 344]], 46);
    path(g, [[723, 648], [576, 700], [416, 701], [345, 570], [261, 451], [485, 386], [697, 371]], 40);
    path(g, [[737, 655], [885, 716], [1095, 742], [1197, 623], [1358, 469], [1246, 298], [1051, 329], [884, 345], [818, 428], [696, 375]], 39);
    for (let i = 0; i < 24; i++) { const y = 190 + i * 22; line(g, [[80, y], [80, y - 27]], "#ccd0af", 6); if (i < 23) line(g, [[80, y - 13], [80, y + 10]], "#d6d5b8", 3); }
    for (let i = 0; i < 12; i++) tree(g, 105 + i * 110, 142 + Math.sin(i * 1.8) * 32, .8 + random(i) * .27, i * 7);
    drawHouse(g); drawPond(g);
    ellipse(g, 339, 556, 159, 107, "#d9dfbe", -.4);
    ellipse(g, 337, 549, 146, 96, "#e6e5c8", -.4);
    for (let i = 0; i < 31; i++) { const a = i * 2.4, r = 40 + random(i + 171) * 90; const x = 337 + Math.cos(a) * r, y = 546 + Math.sin(a) * r * .65; blossom(g, x, y, .65 + random(i + 261) * .35, true, i); }
    flowers.forEach((p, i) => { ellipse(g, p.x, p.y + 7, 21, 10, "#b5b79155"); blossom(g, p.x, p.y, 1.9, coverMode || journey.tasks[0].has("flower-" + i), i); marker(g, p.x, p.y, "♧", !coverMode && journey.chapter === 0 && !journey.tasks[0].has("flower-" + i)); });
    lamps.forEach((p, i) => { const lit = coverMode || journey.tasks[2].has("lamp-" + i); drawLantern(g, p, lit); marker(g, p.x + 10, p.y - 5, "✧", !coverMode && journey.chapter === 2 && !lit); });
    drawCourtyard(g, coverMode);
    // A little reading bench beside the flowers.
    rounded(g, 167, 626, 62, 11, 3, "#c4b58e"); rounded(g, 169, 609, 60, 9, 2, "#cdbf9d");
    for (const x of [178, 219]) line(g, [[x, 616], [x, 649]], "#aaa483", 4);
    for (let i = 0; i < 16; i++) { const x = 149 + random(i + 72) * 1140, y = 735 + random(i + 22) * 140; if (Math.abs(x - 716) > 90) { bush(g, x, y, .5 + random(i + 113) * .3, i * 4); if (i % 3 === 0) blossom(g, x, y - 6, 1, true, i); } }
    tree(g, 150, 408, 1.45, 13); tree(g, 1364, 370, 1.6, 90); tree(g, 1315, 746, 1.1, 42); tree(g, 191, 823, 1.35, 24);
    bush(g, 931, 260, 1, 112); bush(g, 501, 271, 1.1, 102); bush(g, 916, 751, .65, 99);
    for (let i = 0; i < 30; i++) { const x = random(i + 264) * W, y = 180 + random(i + 527) * 680; if (i % 4 === 0) blossom(g, x, y, .55, true, i); }
    label(g, "相遇花园", "WHERE OUR STORY BLOOMS", 331, 407);
    label(g, "陪伴小屋", "A LIGHT LEFT ON FOR YOU", 699, 93);
    label(g, "心愿湖畔", "WISH UPON A LITTLE STAR", 1137, 291);
    label(g, journey.ended ? "生日快乐" : "生日庭院", "ALL THE STARS LEAD TO YOU", 747, 753);
    if (!coverMode) {
      if (journey.chapter === 1) marker(g, 699, 354, "✉", true);
      if (journey.ready() && journey.chapter !== 1) { const p = chapterStars[journey.chapter]; glow(g, p.x, p.y - 28, 65); star(g, p.x, p.y - 28 + Math.sin(frameTime / 550) * (reducedMotion ? 0 : 4), 20, "#d9b357"); }
      if (journey.chapter === 3) { avatar(g, 800, 616, true); marker(g, finale.x, finale.y - 10, "♡", !journey.ended); }
      avatar(g, player.x, player.y);
      // Small arrow on the ground subtly identifies the controllable character.
      ellipse(g, player.x, player.y + 11, 3, 2, "#f9f8e3");
    } else { avatar(g, 807, 641); avatar(g, 840, 641, true); }
    for (let i = 0; i < 28; i++) { const t = reducedMotion ? 0 : frameTime / 2000; const x = 150 + random(i + 88) * 1150 + Math.sin(t + i * 3) * 10, y = 250 + random(i + 211) * 500 + Math.cos(t * .7 + i) * 8; const a = .25 + (Math.sin(t + i) + 1) * .25; glow(g, x, y, 9, "#f4df8c"); ellipse(g, x, y, 1.8, 1.8, `rgba(255,250,199,${a})`); }
    if (journey.ended && !coverMode) { for (let i = 0; i < 18; i++) { const x = 590 + random(i + 629) * 300, y = 430 + random(i + 978) * 120; star(g, x, y + Math.sin(frameTime / 900 + i) * (reducedMotion ? 0 : 4), 3 + random(i + 644) * 4, "#d5b263", .7); } }
  }

  function obstacles(x, y) {
    return (x > 577 && x < 823 && y > 166 && y < 345)
      || (((x - 1134) / 151) ** 2 + ((y - 451) / 101) ** 2 < 1)
      || (journey.chapter === 3 && ((x - 745) / 73) ** 2 + ((y - 652) / 39) ** 2 < 1);
  }
  function targets() {
    if (journey.chapter === 0) return journey.ready() ? [{ ...chapterStars[0], id: "star", label: "拾起相遇之星" }] : flowers.map((p, i) => ({ ...p, id: "flower-" + i, label: "给这朵小花浇水" })).filter((p) => !journey.tasks[0].has(p.id));
    if (journey.chapter === 1) return [{ x: 699, y: 363, id: "letter", label: "读一读小屋里的信" }];
    if (journey.chapter === 2) return journey.ready() ? [{ ...chapterStars[2], id: "star", label: "收下湖畔的心愿" }] : lamps.map((p, i) => ({ ...p, id: "lamp-" + i, label: "点亮这盏湖灯" })).filter((p) => !journey.tasks[2].has(p.id));
    return [{ ...finale, id: "finale", label: journey.ended ? "重读生日信" : "走进属于你的生日" }];
  }
  function update(dt) {
    player.walking = false;
    if (!playing || $("story-dialog").open || $("photo-dialog").open || document.hidden) return;
    let dx = (keys.has("d") || keys.has("ArrowRight") ? 1 : 0) - (keys.has("a") || keys.has("ArrowLeft") ? 1 : 0);
    let dy = (keys.has("s") || keys.has("ArrowDown") ? 1 : 0) - (keys.has("w") || keys.has("ArrowUp") ? 1 : 0);
    const length = Math.hypot(dx, dy);
    if (length) {
      dx = dx / length * dt * 195; dy = dy / length * dt * 195;
      const nx = Math.max(95, Math.min(W - 80, player.x + dx)), ny = Math.max(160, Math.min(H - 65, player.y + dy));
      if (!obstacles(nx, player.y)) player.x = nx;
      if (!obstacles(player.x, ny)) player.y = ny;
      player.walking = true;
    }
    nearest = targets().map((p) => ({ ...p, distance: Math.hypot(p.x - player.x, p.y - player.y) })).sort((a, b) => a.distance - b.distance)[0];
    if (nearest?.distance > 76) nearest = null;
    $("interact-button").hidden = !nearest;
    if (nearest) $("interact-button").querySelector("span").textContent = nearest.label;
  }
  function loop(timestamp) {
    const dt = Math.min((timestamp - lastTime) / 1000 || 0, .04); lastTime = timestamp;
    if (!document.hidden) { frameTime = timestamp; update(dt); if (playing) draw(ctx); else draw(coverCtx, true); }
    requestAnimationFrame(loop);
  }
  function updateHUD() {
    const n = journey.chapter;
    $("chapter-kicker").textContent = n < 3 ? `CHAPTER 0${n + 1} / A LITTLE BIRTHDAY JOURNEY` : "THE FINALE / ALL MY LOVE";
    $("chapter-title").textContent = n < 3 ? chapter().title : journey.ended ? "星光都为你亮起" : "生日庭院";
    $("objective").textContent = n < 3 ? (journey.ready() ? chapter().taskDone : chapter().objective) + (n !== 1 && !journey.ready() ? `（${journey.tasks[n].size}/3）` : "") : journey.ended ? "慢慢看看相册，或再读一次生日信" : "到中央庭院，见一见等着你的人";
    $("star-progress").setAttribute("aria-label", `已找到 ${n} 颗星星`);
    [...$("star-progress").children].forEach((el, i) => { el.className = i < n ? "found" : ""; el.textContent = i < n ? "✦" : "✧"; });
    $("memory-count").textContent = String(n * 2);
    $("interact-button").hidden = true; nearest = null;
  }
  function toast(message) {
    clearTimeout(toastTimer); $("toast").textContent = text(message); $("toast").hidden = false;
    toastTimer = setTimeout(() => { $("toast").hidden = true; }, 3200);
  }
  function closeDialog() {
    $("story-dialog").close(); closeHandler = null; keys.clear(); world.focus({ preventScroll: true });
  }
  function showDialog(kicker, title, options = {}) {
    clearTimeout(toastTimer); $("toast").hidden = true;
    keys.clear(); player.walking = false; nearest = null; $("interact-button").hidden = true;
    $("dialog-kicker").textContent = text(kicker);
    $("dialog-content").replaceChildren(); $("dialog-actions").replaceChildren();
    if (options.emblem) $("dialog-content").append(element("div", "dialog-emblem", options.emblem));
    const heading = element("h2", "dialog-title", title); heading.id = "dialog-title"; $("dialog-content").append(heading);
    $("dialog-note").textContent = options.note ?? "";
    $("dialog-note").hidden = !$("dialog-note").textContent;
    closeHandler = options.close ?? null; $("dialog-close").hidden = !closeHandler;
    if (!$("story-dialog").open) $("story-dialog").showModal();
    $("story-dialog").scrollTop = 0;
    return $("dialog-content");
  }
  function paragraphs(parent, values, className = "dialog-prose") {
    const block = element("div", className); values.forEach((value) => block.append(element("p", "", value))); parent.append(block); return block;
  }
  function action(label, handler, secondary = false) {
    const button = element("button", secondary ? "secondary-button" : "primary-button", label);
    button.addEventListener("click", handler); $("dialog-actions").append(button); return button;
  }
  function focusAction() { $("dialog-actions").querySelector("button")?.focus({ preventScroll: true }); }
  function makePhoto(photo, full = false) {
    const img = new Image(); img.alt = text(photo.alt || photo.caption); img.src = photo.src || "";
    img.addEventListener("error", () => {
      const fallback = element("div", "photo-fallback"); fallback.append(element("b", "", "✧"), element("span", "", "这里，等一张属于我们的照片"));
      img.replaceWith(fallback);
    }, { once: true });
    if (full) return img;
    const figure = element("figure", "photo-card"), button = element("button"); button.setAttribute("aria-label", "完整查看：" + text(photo.caption));
    button.append(img); button.addEventListener("click", () => openPhoto(photo));
    figure.append(button, element("figcaption", "", photo.caption)); return figure;
  }
  function photoGrid(parent, photos) { const grid = element("div", "photo-grid"); photos.forEach((p) => grid.append(makePhoto(p))); parent.append(grid); }
  function openPhoto(photo) { $("photo-view").replaceChildren(makePhoto(photo, true), element("figcaption", "", photo.caption)); $("photo-dialog").showModal(); $("photo-close").focus(); }
  function showInvitation() {
    const body = showDialog("A LETTER FOR YOU", C.invitation.title, { emblem: "✉" });
    paragraphs(body, C.invitation.paragraphs); paragraphs(body, [C.invitation.controls], "gift-pause");
    action("沿着花香，出发吧 →", closeDialog); focusAction();
  }
  function showChoice(kind) {
    const c = chapter();
    const body = showDialog(kind === "letter" ? "A LIGHT LEFT ON FOR YOU" : "MAKE A LITTLE WISH", kind === "letter" ? "有一盏灯，为你留着" : "把心愿交给湖光", { emblem: kind === "letter" ? "✉" : "✧" });
    paragraphs(body, [kind === "letter" ? c.letterIntro : c.wishIntro]);
    c.choices.forEach((choice) => action(choice.label, () => {
      journey.choose(journey.chapter, choice.id);
      if (kind === "letter") journey.doTask(1, "letter");
      const reply = showDialog("A LITTLE ANSWER", "那就这样约定了", { emblem: "♡" });
      paragraphs(reply, [choice.response]); action("把这一刻收进回忆 →", beginMemory); focusAction();
    }, true));
    focusAction();
  }
  function beginMemory() {
    if (!journey.openMemory()) return;
    showMemory();
  }
  function showMemory() {
    const c = chapter(); const body = showDialog(`CHAPTER 0${journey.chapter + 1} · ${c.star}`, c.subtitle, { emblem: "✦" });
    photoGrid(body, c.photos); const divider = element("div", "chapter-divider", "OUR LITTLE MEMORIES"); body.append(divider); paragraphs(body, c.memory);
    action(c.gift.enabled ? "看看星星带来的礼物 →" : "收下这颗星星，继续旅程 →", () => {
      if (!journey.openGift()) return;
      if (c.gift.enabled) showGiftToken(); else completeChapter();
    }); focusAction();
  }
  function showGiftToken() {
    const c = chapter(), gift = c.gift;
    const body = showDialog("A LITTLE MAGIC, JUST FOR YOU", "你找到了一件小小的宝物");
    body.append(element("div", "gift-token", gift.symbol), element("div", "gift-real", gift.token));
    paragraphs(body, [gift.reveal]); action("让它来到现实里 →", showGiftReveal); focusAction();
  }
  function showGiftReveal() {
    const gift = chapter().gift;
    const body = showDialog("FROM THIS LITTLE WORLD, TO YOUR HANDS", gift.realName);
    body.append(element("div", "gift-token", gift.symbol)); paragraphs(body, [gift.message]);
    const pause = element("div", "gift-pause"); pause.append(element("strong", "", "此刻，看看陪在你身边的人"), element("span", "", "让屏幕里的心意，变成手心里的礼物。\n不用着急，花园会在这里等你。")); body.append(pause);
    action("收到啦，继续旅程 →", completeChapter); focusAction();
  }
  function completeChapter() {
    const c = chapter();
    if (!journey.completeChapter()) return;
    closeDialog(); updateHUD(); chime(); toast(`✦ ${c.star}已点亮。${journey.chapter < 3 ? "下一段心意，正在等你。" : "三颗星星，终于照亮了生日庭院。"}`);
  }
  function endingLetter() {
    const body = showDialog("HAPPY BIRTHDAY, MY DEAR", C.ending.title, { close: closeDialog });
    body.append(element("div", "final-stars", "✦ ✦ ✦")); paragraphs(body, [C.ending.intro], "confetti-message");
    paragraphs(body, C.ending.letter, "dialog-prose letter-body");
    body.append(element("div", "letter-signature", "永远认真地祝福你\n" + C.sender + "\n" + C.birthdayLabel));
    if (journey.choices[2]) { const wish = C.chapters[2].choices.find((c) => c.id === journey.choices[2]); if (wish) body.append(element("div", "wish-chip", "今晚的小心愿：" + wish.label)); }
    action("翻翻我们的回忆相册", showJournal); action("再在花园里待一会儿", closeDialog, true); focusAction();
  }
  function showJournal() {
    const body = showDialog("OUR POCKETFUL OF MEMORIES", "口袋里的回忆", { close: closeDialog, emblem: "▤" });
    if (!journey.stars.length) body.append(element("div", "journal-empty", "这里还空着，不过没关系。\n去花园走走吧，第一颗星星正在等你。"));
    journey.stars.forEach((index) => {
      const c = C.chapters[index], section = element("section", "journal-section"); section.append(element("h3", "", "✦ " + c.title)); photoGrid(section, c.photos);
      const details = element("details"); details.append(element("summary", "", "重读这一页的心里话")); paragraphs(details, c.memory); section.append(details);
      if (journey.choices[index]) { const chosen = c.choices?.find((choice) => choice.id === journey.choices[index]); if (chosen) { const note = element("div", "journal-gift"); note.append(element("strong", "", chosen.label), element("span", "", chosen.response)); section.append(note); } }
      if (c.gift.enabled) { const gift = element("div", "journal-gift"); gift.append(element("strong", "", `${c.gift.symbol} ${c.gift.token} → ${c.gift.realName}`), element("span", "", c.gift.message)); section.append(gift); }
      body.append(section);
    });
    if (journey.ended) action("重读生日信", endingLetter);
    action("回到花园", closeDialog, true); focusAction();
  }
  function interact() {
    if (!nearest || !playing || $("story-dialog").open || $("photo-dialog").open) return;
    const id = nearest.id, n = journey.chapter;
    if (id.startsWith("flower-") || id.startsWith("lamp-")) {
      if (journey.doTask(n, id)) { chime(); toast(chapter().taskMessages[journey.tasks[n].size - 1]); updateHUD(); }
    } else if (id === "letter") showChoice("letter");
    else if (id === "star") { if (n === 2) showChoice("wish"); else beginMemory(); }
    else if (id === "finale") { journey.finish(); updateHUD(); chime(); endingLetter(); }
  }
  function restart() {
    const body = showDialog("START A NEW LITTLE JOURNEY", "要从第一封邀请重新开始吗？", { close: closeDialog });
    paragraphs(body, ["当前页面里的星星、照片解锁和心愿选择会清空。原来的照片与文字文件不会改变。"]);
    action("留在这段旅程", closeDialog); action("重新打开邀请", () => {
      closeDialog(); journey.reset(); keys.clear(); player.x = 720; player.y = 767; player.walking = false; clearTimeout(toastTimer); $("toast").hidden = true;
      playing = false; $("landing").hidden = false; $("game").hidden = true; updateHUD(); $("start-button").focus({ preventScroll: true });
    }, true); focusAction();
  }

  // Original, quiet pentatonic music; browsers allow playback after a user gesture.
  function tone(frequency, duration, volume, delay = 0) {
    if (!audioContext || !musicOn || document.hidden) return;
    const start = audioContext.currentTime + delay, oscillator = audioContext.createOscillator(), gain = audioContext.createGain();
    oscillator.type = "sine"; oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0, start); gain.gain.linearRampToValueAtTime(volume, start + .06); gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
    oscillator.connect(gain); gain.connect(audioBus); oscillator.start(start); oscillator.stop(start + duration + .1);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  }
  function musicStep() {
    const notes = [523.25, 659.25, 783.99, 659.25, 587.33, 523.25, 440, 392, 440, 523.25, 587.33, 659.25, 587.33, 523.25, 440, 392];
    tone(notes[melodyIndex % notes.length], 2.4, .045);
    if (melodyIndex % 4 === 0) tone(notes[melodyIndex % notes.length] / 4, 4.5, .045);
    melodyIndex++;
  }
  async function setMusic(on) {
    try {
      if (!audioContext && on) { const Audio = window.AudioContext || window.webkitAudioContext; if (!Audio) throw new Error("unsupported"); audioContext = new Audio(); audioBus = audioContext.createGain(); audioBus.connect(audioContext.destination); }
      if (audioContext && on) await audioContext.resume();
      musicOn = on; clearInterval(musicTimer); musicTimer = null;
      if (audioBus) audioBus.gain.setTargetAtTime(on && !document.hidden ? 1 : 0, audioContext.currentTime, .035);
      if (on) { musicStep(); musicTimer = setInterval(musicStep, 1500); }
      $("sound-button").textContent = on ? "♫ 音乐开" : "♫ 音乐关"; $("sound-button").setAttribute("aria-pressed", String(on));
    } catch { musicOn = false; $("sound-button").textContent = "♫ 声音不可用"; $("sound-button").setAttribute("aria-pressed", "false"); }
  }
  function chime() { [659.25, 783.99, 1046.5].forEach((f, i) => tone(f, 1.2, .04, i * .12)); }
  function clearKeys() { keys.clear(); player.walking = false; }
  window.addEventListener("keydown", (event) => {
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if (!playing || $("story-dialog").open || $("photo-dialog").open || event.ctrlKey || event.metaKey || event.altKey) return;
    if (["w", "a", "s", "d", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(key)) { event.preventDefault(); keys.add(key); }
    if (key === "e") { event.preventDefault(); if (!event.repeat) interact(); }
  });
  window.addEventListener("keyup", (event) => keys.delete(event.key.length === 1 ? event.key.toLowerCase() : event.key));
  window.addEventListener("blur", clearKeys);
  document.addEventListener("visibilitychange", () => { clearKeys(); if (audioBus) audioBus.gain.setTargetAtTime(musicOn && !document.hidden ? 1 : 0, audioContext.currentTime, .035); });
  $("story-dialog").addEventListener("cancel", (event) => { event.preventDefault(); if (closeHandler) closeHandler(); });
  $("dialog-close").addEventListener("click", () => { if (closeHandler) closeHandler(); });
  $("photo-close").addEventListener("click", () => $("photo-dialog").close());
  $("photo-dialog").addEventListener("close", clearKeys);
  $("start-button").addEventListener("click", () => { playing = true; $("landing").hidden = true; $("game").hidden = false; updateHUD(); if (!audioContext) void setMusic(true); showInvitation(); });
  $("interact-button").addEventListener("click", interact);
  $("journal-button").addEventListener("click", showJournal);
  $("restart-button").addEventListener("click", restart);
  $("sound-button").addEventListener("click", () => void setMusic(!musicOn));
  $("fullscreen-button").addEventListener("click", async () => {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); }
    catch { if (playing) toast("可以按浏览器的 F11 键进入全屏。"); else $("fullscreen-button").textContent = "请按 F11 全屏"; }
  });
  document.addEventListener("fullscreenchange", () => { $("fullscreen-button").textContent = document.fullscreenElement ? "⛶ 退出全屏" : "⛶ 全屏"; clearKeys(); });
  document.querySelector(".brand").addEventListener("click", (event) => { event.preventDefault(); if (playing) restart(); });
  $("cover-recipient").textContent = `给${C.recipient}，一封生日邀请`;
  $("cover-intro").textContent = text(C.coverIntro);
  document.title = "把星星送到你身边 · " + C.recipient;
  updateHUD(); requestAnimationFrame(loop);
})();
