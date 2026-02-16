const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const payBtn = document.getElementById("pay-btn");
const modal = document.getElementById("modal");
const confirmBtn = document.getElementById("confirm-btn");
const cancelBtn = document.getElementById("cancel-btn");

const state = {
  time: 0,
  seed: 0,
  boilTimer: 0,
  mode: "watch",
  payState: "idle",
  mouse: { x: 0, y: 0 },
  cat: {
    x: 0,
    y: 0,
    baseX: 0,
    baseY: 0,
    targetX: 0,
    targetY: 0,
    opacity: 1,
    stepPhase: 0,
    blinkTimer: 0,
    blink: 0,
  },
  churu: {
    x: 0,
    y: 0,
    visible: false,
  },
  message: "",
};

const palette = {
  bgTop: "#fdfbf7",
  bgBottom: "#f5f0e8",
  ink: "#4a4740",
  cat: "#ffffff",
  catShadow: "#e8e3da",
  blush: "#f9ccd2",
  churu: "#fba3b1",
  churuEdge: "#e98090",
  pink: "#f8bfc8",
};

// --- Wobbly Helpers ---

function getWobble(points, seed, amount = 1.5) {
  // Simple deterministic pseudo-noise for wobbly lines
  return points.map((p, i) => {
    const angle = (i / points.length) * Math.PI * 2 + seed;
    const dx = Math.cos(angle * 3) * amount;
    const dy = Math.sin(angle * 2) * amount;
    return { x: p.x + dx, y: p.y + dy };
  });
}

function drawWobblyPath(ctx, points, closed = true) {
  if (points.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    const p0 = points[i - 1];
    const p1 = points[i];
    const cp = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
    ctx.quadraticCurveTo(p0.x, p0.y, cp.x, cp.y);
  }
  if (closed) {
    ctx.closePath();
  }
  ctx.stroke();
}

function generateWobblyRectPoints(x, y, w, h, radius, segments = 20) {
  const points = [];
  // Simplified path for a "bean" or wobbly rectangular shape
  // Top
  for (let i = 0; i <= segments / 4; i++) {
    const t = i / (segments / 4);
    points.push({ x: x + radius + t * (w - 2 * radius), y: y });
  }
  // Right top corner
  points.push({ x: x + w, y: y + radius });
  // Right
  for (let i = 0; i <= segments / 4; i++) {
    const t = i / (segments / 4);
    points.push({ x: x + w, y: y + radius + t * (h - 2 * radius) });
  }
  // Bottom Right
  points.push({ x: x + w - radius, y: y + h });
  // Bottom
  for (let i = 0; i <= segments / 4; i++) {
    const t = i / (segments / 4);
    points.push({ x: x + w - radius - t * (w - 2 * radius), y: y + h });
  }
  // Bottom Left
  points.push({ x: x, y: y + h - radius });
  // Left
  for (let i = 0; i <= segments / 4; i++) {
    const t = i / (segments / 4);
    points.push({ x: x, y: y + h - radius - t * (h - 2 * radius) });
  }
  // Top Left
  points.push({ x: x + radius, y: y });

  return points;
}

// -----------------------

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  state.cat.baseX = window.innerWidth * 0.5;
  state.cat.baseY = window.innerHeight * 0.55;
  if (state.payState === "idle") {
    state.cat.x = state.cat.baseX;
    state.cat.y = state.cat.baseY;
  }
  state.cat.targetX = state.cat.baseX;
  state.cat.targetY = state.cat.baseY;
  state.churu.x = window.innerWidth * 0.5;
  state.churu.y = window.innerHeight * 0.85; // Lower on screen (monitor foreground)
}

window.addEventListener("resize", resize);
resize();

canvas.addEventListener("mousemove", (event) => {
  const rect = canvas.getBoundingClientRect();
  state.mouse.x = event.clientX - rect.left;
  state.mouse.y = event.clientY - rect.top;
});

payBtn.addEventListener("click", () => {
  modal.classList.remove("hidden");
});

cancelBtn.addEventListener("click", () => {
  modal.classList.add("hidden");
});

confirmBtn.addEventListener("click", () => {
  modal.classList.add("hidden");
  startPayment();
});

async function startPayment() {
  if (state.payState !== "idle") return;

  try {
    const response = await fetch('/api/payment/ready', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (data.next_redirect_pc_url) {
      // Check if mobile
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      const redirectUrl = (isMobile && data.next_redirect_mobile_url) ? data.next_redirect_mobile_url : data.next_redirect_pc_url;

      window.location.href = redirectUrl;
    } else {
      const detail = data.details ? JSON.stringify(data.details) : '알 수 없는 오류';
      alert('결제 준비 중 오류가 발생했습니다: ' + detail);
    }
  } catch (error) {
    console.error('Payment Error:', error);
    alert('서버 연결에 실패했습니다.');
  }
}

function triggerChuruAnimation() {
  state.payState = "approach";
  state.mode = "approach";
  state.cat.targetX = state.churu.x + 49;
  state.cat.targetY = state.churu.y - 10;
  state.churu.visible = true;
  state.message = "맛있겠다...";
  payBtn.disabled = true;
}

// Check for payment status on load
window.addEventListener('load', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const paymentStatus = urlParams.get('payment');

  if (paymentStatus === 'success') {
    triggerChuruAnimation();
    // Clean up URL
    window.history.replaceState({}, document.title, window.location.pathname);
  } else if (paymentStatus === 'fail' || paymentStatus === 'cancel') {
    alert('결제가 취소되었거나 실패했습니다.');
    window.history.replaceState({}, document.title, window.location.pathname);
  }
});

function resetCat() {
  state.payState = "idle";
  state.mode = "watch";
  state.cat.x = state.cat.baseX;
  state.cat.y = state.cat.baseY;
  state.cat.opacity = 1;
  state.cat.targetX = state.cat.baseX;
  state.cat.targetY = state.cat.baseY;
  state.churu.visible = false;
  state.message = "";
  payBtn.disabled = false;
}

function update(dt) {
  state.time += dt;
  state.boilTimer += dt;
  if (state.boilTimer > 0.15) {
    state.seed = Math.random() * 100;
    state.boilTimer = 0;
  }

  // Ear twitch logic
  if (!state.twitchTimer || state.twitchTimer < 0) {
    if (Math.random() < 0.01) {
      state.twitchTimer = 0.4;
      state.twitchSide = Math.random() < 0.5 ? "left" : "right";
    }
  } else {
    state.twitchTimer -= dt;
  }

  state.cat.blinkTimer += dt;
  if (state.cat.blinkTimer > 3.5 + Math.random() * 1.5) {
    state.cat.blink = 1;
    state.cat.blinkTimer = 0;
  }
  if (state.cat.blink > 0) {
    state.cat.blink -= dt * 6;
    if (state.cat.blink < 0) state.cat.blink = 0;
  }

  if (state.payState === "approach") {
    const dx = state.cat.targetX - state.cat.x;
    const dy = state.cat.targetY - state.cat.y;
    const dist = Math.hypot(dx, dy);
    const speed = 120;
    if (dist > 5) {
      const step = Math.min(dist, speed * dt);
      state.cat.x += (dx / dist) * step;
      state.cat.y += (dy / dist) * step;
      state.cat.stepPhase += dt * 8;
    } else {
      state.payState = "eat";
      state.mode = "eat";
      state.eatTimer = 0;
      state.message = "맛있다...";
    }
  } else if (state.payState === "eat") {
    state.eatTimer += dt;
    state.cat.stepPhase += dt * 4;

    // Message sequence during eating
    if (state.eatTimer > 4 && state.eatTimer < 7) {
      state.message = "기분 좋다...";
    } else if (state.eatTimer > 7) {
      state.message = "또 먹고 싶다...";
    }

    if (state.eatTimer > 10) {
      state.payState = "return";
      state.mode = "watch";
      state.cat.targetX = state.cat.baseX;
      state.cat.targetY = state.cat.baseY;
      state.message = "";
      state.churu.visible = false;
    }
  } else if (state.payState === "return") {
    const dx = state.cat.targetX - state.cat.x;
    const dy = state.cat.targetY - state.cat.y;
    const dist = Math.hypot(dx, dy);
    const speed = 100;
    if (dist > 5) {
      const step = Math.min(dist, speed * dt);
      state.cat.x += (dx / dist) * step;
      state.cat.y += (dy / dist) * step;
      state.cat.stepPhase += dt * 6;
    } else {
      resetCat();
    }
  } else {
    state.cat.stepPhase += dt * 2.2;
  }
}

function drawBackground() {
  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0, palette.bgTop);
  grad.addColorStop(1, palette.bgBottom);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawChuru() {
  if (!state.churu.visible) return;
  const { x, y } = state.churu;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(0.05); // Slight tilt
  ctx.fillStyle = palette.churu;
  ctx.strokeStyle = palette.ink;
  ctx.lineWidth = 2.5;

  // Body (Vertical)
  const bodyPoints = getWobble([
    { x: -8, y: -30 }, { x: 8, y: -30 }, { x: 8, y: 30 }, { x: -8, y: 30 }
  ], state.seed);

  ctx.beginPath();
  ctx.moveTo(bodyPoints[0].x, bodyPoints[0].y);
  bodyPoints.forEach(p => ctx.lineTo(p.x, p.y));
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Edge/Tear part at the top
  ctx.fillStyle = palette.churuEdge;
  ctx.beginPath();
  ctx.moveTo(bodyPoints[0].x, bodyPoints[0].y);
  ctx.lineTo(bodyPoints[0].x, bodyPoints[0].y + 15);
  ctx.lineTo(bodyPoints[1].x, bodyPoints[1].y + 15);
  ctx.lineTo(bodyPoints[1].x, bodyPoints[1].y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.restore();
}

function drawCat() {
  const { x, y } = state.cat;
  const wobbleBase = Math.sin(state.cat.stepPhase) * 1.5;
  const seed = state.seed;

  // Sizes for horizontal layout
  const bodyW = 140;
  const bodyH = 60;
  const headSize = 85;

  ctx.save();
  ctx.translate(x, y + wobbleBase);
  ctx.globalAlpha = state.cat.opacity;
  ctx.strokeStyle = palette.ink;
  ctx.lineWidth = 3.5;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // 1. Tail (Pointy and slightly curved)
  const tailTime = state.time * 2.5;
  const tailPts = getWobble([
    { x: bodyW * 0.45, y: -bodyH * 0.1 },
    { x: bodyW * 0.7 + Math.sin(tailTime) * 10, y: -bodyH * 0.3 },
    { x: bodyW * 0.9 + Math.cos(tailTime) * 15, y: -bodyH * 0.2 }
  ], seed + 4, 3);
  ctx.beginPath();
  ctx.moveTo(tailPts[0].x, tailPts[0].y);
  tailPts.forEach((p, i) => { if (i > 0) ctx.lineTo(p.x, p.y); });
  ctx.stroke();

  // 2. Legs (4 stubs)
  const legY = bodyH * 0.45;
  const legOffXOuter = bodyW * 0.35;
  const legOffXInner = bodyW * 0.15;
  const legH = 20;

  ctx.fillStyle = palette.cat;
  [-legOffXOuter, -legOffXInner, legOffXInner, legOffXOuter].forEach((lx, i) => {
    const walkY = Math.sin(state.cat.stepPhase + i * 1.5) * 5;
    const pts = getWobble([
      { x: lx - 8, y: legY },
      { x: lx - 5, y: legY + legH + walkY },
      { x: lx + 5, y: legY + legH + walkY },
      { x: lx + 8, y: legY }
    ], seed + 10 + i, 2);
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    pts.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.fill();
    ctx.stroke();

    // Toe Beans (Pink dots)
    ctx.save();
    ctx.fillStyle = palette.pink;
    ctx.beginPath();
    ctx.arc(lx + Math.sin(seed + i) * 2, legY + legH + walkY - 2, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });

  // 3. Body (Horizontal rectangle)
  const bodyPts = generateWobblyRectPoints(-bodyW * 0.5, -bodyH * 0.5, bodyW, bodyH, 20);
  const wobblyBody = getWobble(bodyPts, seed, 3);
  ctx.fillStyle = palette.cat;
  ctx.beginPath();
  ctx.moveTo(wobblyBody[0].x, wobblyBody[0].y);
  wobblyBody.forEach(p => ctx.lineTo(p.x, p.y));
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  //  HEAD (Integrated ears - look at sketch spikes)
  ctx.save();
  ctx.translate(-bodyW * 0.35, -bodyH * 0.2); // Move head to the front

  const headW = headSize, headH = headSize * 0.85;
  const headX = -headW * 0.5, headY = -headH * 0.8;

  // Ear twitch
  const twitch = (state.twitchTimer > 0) ? Math.sin(state.twitchTimer * 40) * 6 : 0;

  // Custom path for head with integrated ear peaks
  const hPts = [
    { x: headX + 15, y: headY }, // Top left start
    { x: headX, y: headY - 30 + twitch }, // Left ear peak
    { x: headX - 10, y: headY + 30 }, // Left cheek
    { x: headX + 20, y: headY + headH }, // Chin
    { x: headX + headW - 20, y: headY + headH }, // Chin right
    { x: headX + headW + 10, y: headY + 30 }, // Right cheek
    { x: headX + headW, y: headY - 30 + (state.twitchSide === "right" ? twitch : 0) }, // Right ear peak
    { x: headX + headW - 15, y: headY } // Top right end
  ];
  const wHead = getWobble(hPts, seed, 4);
  ctx.beginPath();
  ctx.moveTo(wHead[0].x, wHead[0].y);
  wHead.forEach(p => ctx.lineTo(p.x, p.y));
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Face on the head
  const gaze = getGaze();
  const eyeY = headY + headH * 0.35;
  const eyeX = headW * 0.3;
  const blink = Math.max(0, 1 - state.cat.blink);

  // Eyes
  ctx.fillStyle = palette.ink;
  if (blink > 0.1) {
    ctx.beginPath();
    ctx.arc(-eyeX + gaze.x * 0.7, eyeY + gaze.y * 0.7, 3, 0, Math.PI * 2);
    ctx.arc(eyeX + gaze.x * 0.7, eyeY + gaze.y * 0.7, 3, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.moveTo(-eyeX - 5 + gaze.x, eyeY + gaze.y); ctx.lineTo(-eyeX + 5 + gaze.x, eyeY + gaze.y);
    ctx.moveTo(eyeX - 5 + gaze.x, eyeY + gaze.y); ctx.lineTo(eyeX + 5 + gaze.x, eyeY + gaze.y);
    ctx.stroke();
  }

  // Pink Nose
  ctx.fillStyle = palette.pink;
  ctx.beginPath();
  ctx.arc(gaze.x * 0.5, eyeY + 15 + gaze.y * 0.5, 4, 0, Math.PI * 2);
  ctx.fill();

  // Mouth (w) and Tongue
  const mx = 0, my = eyeY + 18;

  if (state.mode === "eat") {
    // Natural snapping lick animation
    const lickCycle = state.eatTimer * 22;
    const lickForm = Math.max(0, Math.sin(lickCycle));
    const lickSnap = Math.pow(lickForm, 0.6); // Snappier out-and-in

    ctx.save();
    ctx.translate(mx, my + 2);
    ctx.rotate(Math.sin(lickCycle) * 0.1); // Slight side-to-side lap

    ctx.fillStyle = palette.pink;
    ctx.strokeStyle = palette.ink;
    ctx.lineWidth = 1.8;

    // Tongue shape (U-shaped and stretchy)
    const tw = 7, th = 10 + lickSnap * 15;
    ctx.beginPath();
    ctx.moveTo(-tw, 0);
    ctx.lineTo(-tw, th - 5);
    ctx.quadraticCurveTo(-tw, th, 0, th);
    ctx.quadraticCurveTo(tw, th, tw, th - 5);
    ctx.lineTo(tw, 0);
    ctx.fill();
    ctx.stroke();

    // Central groove detail
    ctx.beginPath();
    ctx.lineWidth = 1.2;
    ctx.moveTo(0, th * 0.3);
    ctx.lineTo(0, th * 0.8);
    ctx.stroke();

    ctx.restore();
  }

  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-10, my);
  ctx.quadraticCurveTo(-5, my + 8, mx, my);
  ctx.quadraticCurveTo(5, my + 8, 10, my);
  ctx.stroke();

  // Whiskers (sketch style)
  ctx.lineWidth = 2.5;
  const wSeed = seed + 5;
  ctx.beginPath();
  ctx.moveTo(-headW * 0.45, eyeY + 10); ctx.lineTo(-headW * 0.75 + Math.sin(wSeed) * 5, eyeY + 5);
  ctx.moveTo(-headW * 0.45, eyeY + 20); ctx.lineTo(-headW * 0.75 + Math.sin(wSeed + 1) * 5, eyeY + 25);
  ctx.moveTo(headW * 0.45, eyeY + 10); ctx.lineTo(headW * 0.75 + Math.sin(wSeed + 2) * 5, eyeY + 5);
  ctx.moveTo(headW * 0.45, eyeY + 20); ctx.lineTo(headW * 0.75 + Math.sin(wSeed + 3) * 5, eyeY + 25);
  ctx.stroke();

  // Hat (zigzag scribble)
  const hatX = -15, hatY = headY - 10;
  ctx.beginPath();
  ctx.moveTo(hatX, hatY);
  for (let i = 0; i < 5; i++) {
    ctx.lineTo(hatX + i * 8, hatY - (i % 2 === 0 ? 12 : 4) + Math.sin(seed + i) * 3);
  }
  ctx.stroke();

  // Purr Hearts
  if (state.mode === "eat") {
    const t = state.eatTimer * 5;
    ctx.fillStyle = palette.blush;
    ctx.font = "20px var(--font)";
    ctx.fillText("♥", -80 + Math.sin(t) * 10, -120 - state.eatTimer * 40);
    ctx.fillText("♥", 80 + Math.cos(t) * 10, -150 - state.eatTimer * 50);
  }

  ctx.restore(); // End Head
  ctx.restore(); // End Entire Cat
}


function getGaze() {
  const dx = state.mouse.x - state.cat.x;
  const dy = state.mouse.y - (state.cat.y - 40);
  const dist = Math.hypot(dx, dy) || 1;
  const max = 8;
  return {
    x: (dx / dist) * max,
    y: (dy / dist) * max,
  };
}

function drawMessage() {
  if (!state.message) return;
  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.strokeStyle = palette.ink;
  ctx.lineWidth = 2;
  ctx.font = "bold 16px var(--font)";
  const padding = 12;
  const textWidth = ctx.measureText(state.message).width;
  const bubbleW = textWidth + padding * 2;
  const bubbleH = 38;
  const x = state.cat.x - bubbleW * 0.5;
  const y = state.cat.y - 210;

  const bubblePts = generateWobblyRectPoints(x, y, bubbleW, bubbleH, 12);
  const wobblyBubble = getWobble(bubblePts, state.seed, 2);

  ctx.beginPath();
  ctx.moveTo(wobblyBubble[0].x, wobblyBubble[0].y);
  wobblyBubble.forEach(p => ctx.lineTo(p.x, p.y));
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = palette.ink;
  ctx.fillText(state.message, x + padding, y + 24);
  ctx.restore();
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawBackground();
  drawCat();
  drawChuru();
  drawMessage();
}

let last = performance.now();
let useExternalTime = false;

function step(ms) {
  const dt = ms / 1000;
  update(dt);
  render();
}

function loop(now) {
  const delta = now - last;
  last = now;
  if (!useExternalTime) {
    step(delta);
  } else {
    render();
  }
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);

window.advanceTime = (ms) => {
  useExternalTime = true;
  const steps = Math.max(1, Math.round(ms / (1000 / 60)));
  for (let i = 0; i < steps; i += 1) {
    step(1000 / 60);
  }
};

window.render_game_to_text = () => {
  const payload = {
    mode: state.mode,
    payment: state.payState,
    cat: {
      x: Math.round(state.cat.x),
      y: Math.round(state.cat.y),
      opacity: Number(state.cat.opacity.toFixed(2)),
    },
    gaze: {
      x: Math.round(state.mouse.x),
      y: Math.round(state.mouse.y),
    },
    churuVisible: state.churu.visible,
    message: state.message,
    coordinateSystem: "origin: top-left, x: right, y: down",
  };
  return JSON.stringify(payload);
};

window.addEventListener("keydown", (event) => {
  if (event.key === "f") {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }
});
