const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const payBtn = document.getElementById("pay-btn");
const modal = document.getElementById("modal");
const confirmBtn = document.getElementById("confirm-btn");
const cancelBtn = document.getElementById("cancel-btn");
const chatForm = document.getElementById("chat-form");
const chatInput = document.getElementById("chat-input");
const rankingBtn = document.getElementById("ranking-btn");
const rankingContainer = document.getElementById("ranking-container");
const rankingList = document.getElementById("ranking-list");
const closeRanking = document.getElementById("close-ranking");
const exploreBtn = document.getElementById("explore-btn");

const supabaseUrl = 'https://pssgeostogsjnvcontdk.supabase.co';
const supabaseKey = 'sb_publishable_vp__hrZFoy7uqo8R_M3XhQ_pG-805oO';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

let currentUser = null;
async function checkUser() {
  const { data: { session } } = await supabase.auth.getSession();
  currentUser = session?.user || null;
}
checkUser();

const catNames = ["치즈냥", "턱시도냥", "카오스냥", "흰색냥", "고등어냥", "스핑크스냥", "호랑이", "핑크냥", "픽셀냥", "무지개냥"];

const state = {
  time: 0,
  seed: 0,
  boilTimer: 0,
  stage: "hidden", 
  payState: "idle",
  mouse: { x: 0, y: 0 },
  catType: 0,
  structureType: Math.floor(Math.random() * 4),
  isCatPresent: true,
  cat: {
    x: 0, y: 0,
    vx: 0, vy: 0,
    scaleX: 1, scaleY: 1,
    vScaleX: 0, vScaleY: 0,
    baseX: 0, baseY: 0,
    hiddenX: 0, hiddenY: 0,
    targetX: 0, targetY: 0,
    gazeX: 0, gazeY: 0,
    targetGazeX: 0, targetGazeY: 0,
    gazeTimer: 0,
    stepPhase: 0, hopPhase: 0,
    blinkTimer: 0, blink: 0,
    wary: 0, earPrick: 0, affection: 0,
    breathing: 0,
    tailSegments: Array(8).fill({x: 0, y: 0}),
    tilt: 0, vTilt: 0,
  },
  particles: [],
  churu: { x: 0, y: 0, visible: false },
  userMessage: "", userMessageTimer: 0,
  systemMessage: "", systemMessageTimer: 0,
  chatCount: 0, affectionCount: 0,
  isChatDisabled: false,
};

const palette = {
  bgTop: "#fdfbf7", bgBottom: "#f5f0e8", ink: "#3d3a33",
  catWhite: "#ffffff", catCheese: "#e07a5f", catBlack: "#2b2b2b",
  catGrey: "#a8a2a0", catDarkGrey: "#5c5957",
  catSphynx: "#e6b8af", catTiger: "#f77f00", catPink: "#ffb5a7",
  blush: "#f2b5d4", churu: "#fba3b1", gold: "#ffd700",
};

function lerp(a, b, t) { return a + (b - a) * t; }

function getWobble(points, seed, amount = 1.5) {
  return points.map((p, i) => {
    const angle = (i / points.length) * Math.PI * 2 + seed;
    return { x: p.x + Math.cos(angle * 3) * amount, y: p.y + Math.sin(angle * 2) * amount };
  });
}

function generateWobblyRectPoints(x, y, w, h, radius, segments = 20) {
  const points = [];
  for (let i = 0; i <= segments / 4; i++) points.push({ x: x + radius + (i / (segments / 4)) * (w - 2 * radius), y: y });
  points.push({ x: x + w, y: y + radius });
  for (let i = 0; i <= segments / 4; i++) points.push({ x: x + w, y: y + radius + (i / (segments / 4)) * (h - 2 * radius) });
  points.push({ x: x + w - radius, y: y + h });
  for (let i = 0; i <= segments / 4; i++) points.push({ x: x + w - radius - (i / (segments / 4)) * (w - 2 * radius), y: y + h });
  points.push({ x: x, y: y + h - radius });
  for (let i = 0; i <= segments / 4; i++) points.push({ x: x, y: y + h - radius - (i / (segments / 4)) * (h - 2 * radius) });
  points.push({ x: x + radius, y: y });
  return points;
}

// --- Listeners ---
canvas.addEventListener("mousemove", (event) => {
  const rect = canvas.getBoundingClientRect();
  state.mouse.x = event.clientX - rect.left;
  state.mouse.y = event.clientY - rect.top;
});

payBtn.addEventListener("click", () => {
  if (state.isChatDisabled || !state.isCatPresent) return;
  modal.classList.remove("hidden");
});

cancelBtn.addEventListener("click", () => modal.classList.add("hidden"));
confirmBtn.addEventListener("click", () => { modal.classList.add("hidden"); startPayment(); });
rankingBtn.addEventListener("click", showRanking);
closeRanking.addEventListener("click", () => rankingContainer.classList.add("hidden"));

exploreBtn.addEventListener("click", () => {
  if (state.isChatDisabled) return;
  if (Math.random() < 0.15) {
    state.isCatPresent = false;
    state.catType = -1;
    state.systemMessage = "이 골목에는 고양이가 없네요...";
    state.systemMessageTimer = 4;
    chatInput.disabled = true;
    chatInput.placeholder = "고양이가 없습니다...";
  } else {
    state.isCatPresent = true;
    state.catType = Math.floor(Math.random() * 10);
    state.structureType = Math.floor(Math.random() * 4);
    state.systemMessage = "새로운 길고양이를 발견했습니다!";
    state.systemMessageTimer = 4;
    chatInput.disabled = false;
    chatInput.placeholder = "고양이를 불러보세요...";
  }
  resetCat(); // Restart the alley state
});

chatForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const msg = chatInput.value.trim();
  if (!msg || state.isChatDisabled) return;
  chatInput.value = "";
  handleUserChat(msg);
});

async function startPayment() {
  if (state.payState !== "idle") return;
  if (!currentUser) {
    await supabase.auth.signInWithOAuth({
      provider: 'kakao',
      options: { redirectTo: window.location.origin }
    });
    return;
  }
  state.isChatDisabled = true;
  setTimeout(() => { triggerChuruAnimation(); }, 500);
}

function handleUserChat(text) {
  state.userMessage = text;
  state.userMessageTimer = 3.5;
  if (!state.isCatPresent) return;

  if (state.stage === "hidden") processHiddenStageChat(text);
  else if (state.stage === "center") processCenterStageChat(text);
}

function emitSystemMsg(text) {
  state.systemMessage = text;
  state.systemMessageTimer = 4;
}

function processHiddenStageChat(text) {
  state.isChatDisabled = true;
  const food = ["추르", "츄르", "캔", "참치", "사료", "churu", "feed"];
  const call = ["우쭈쭈", "고양아", "이리와", "여기와", "come here"];
  const offense = ["좆냥", "털바퀴", "bad cat"];
  const special = ["떼껄룩", "때껄룩"];
  
  let reaction = null, prob = Math.random() * 100;
  
  if (offense.some(k => text.includes(k))) reaction = { type: "wary", msg: "고양이가 당신을 매우 경계하고 있습니다..." };
  else if (special.some(k => text.includes(k))) reaction = { type: "special", msg: "때껄룩" };
  else if (food.some(k => text.includes(k))) {
    if (prob < 80) reaction = { type: "approach", msg: "" };
    else reaction = { type: "earPrick", msg: "고양이가 당신의 가방을 유심히 봅니다." };
  } else if (call.some(k => text.includes(k))) {
    if (prob < 70) reaction = { type: "ignore", msg: "고양이가 당신을 한번 쳐다보고 무시합니다." };
    else if (prob < 80) reaction = { type: "blink", msg: "고양이가 눈을 천천히 깜빡입니다." };
    else if (prob < 90) reaction = { type: "earPrick", msg: "고양이가 귀를 쫑긋거립니다." };
    else reaction = { type: "approach", msg: "" };
  } else {
    if (prob < 4) reaction = { type: "approach", msg: "" };
    else if (prob < 10) reaction = { type: "wary", msg: "고양이가 낯설어합니다." };
    else if (prob < 30) reaction = { type: "earPrick", msg: "고양이가 관찰합니다." };
    else if (prob < 50) reaction = { type: "blink", msg: "고양이가 졸린 듯 합니다." };
    else reaction = { type: "ignore", msg: "고양이는 별 관심이 없습니다." };
  }
  setTimeout(() => executeReaction(reaction), 500);
}

function processCenterStageChat(text) {
  state.isChatDisabled = true;
  state.chatCount++;
  let prob = Math.random() * 100, reaction = null;
  if (prob < 32) reaction = { type: "earPrick", msg: "고양이가 당신 말에 귀 기울입니다." };
  else if (prob < 64) reaction = { type: "blink", msg: "고양이가 눈인사를 보냅니다." };
  else if (prob < 96) reaction = { type: "ignore", msg: "고양이가 잠시 한눈을 팝니다." };
  else reaction = { type: "affection", msg: "고양이가 당신의 손길을 허락합니다!" };
  
  setTimeout(() => {
    executeReaction(reaction, () => {
      if (state.chatCount >= 3) setTimeout(returnToHidden, 1500);
    });
  }, 500);
}

function executeReaction(reaction, callback) {
  if (reaction.msg && reaction.type !== "special") emitSystemMsg(reaction.msg);
  
  if (reaction.type === "approach") triggerApproach();
  else if (reaction.type === "wary") state.cat.targetWary = 1;
  else if (reaction.type === "earPrick") state.cat.targetEarPrick = 1;
  else if (reaction.type === "blink") state.cat.blink = 1;
  else if (reaction.type === "affection") {
    state.cat.targetAffection = 1;
    state.affectionCount++;
  } else if (reaction.type === "special") emitSystemMsg("때껄룩!");
  
  setTimeout(() => {
    state.cat.targetWary = 0; state.cat.targetEarPrick = 0; state.cat.targetAffection = 0;
    state.isChatDisabled = false;
    if (callback) callback();
  }, 2500);
}

function triggerApproach() {
  state.stage = "approaching";
  state.cat.targetX = state.cat.baseX; state.cat.targetY = state.cat.baseY;
  payBtn.classList.remove("hidden");
  emitSystemMsg("고양이가 슬며시 다가왔습니다.");
}

function returnToHidden() {
  state.stage = "returning";
  state.cat.targetX = state.cat.hiddenX; state.cat.targetY = state.cat.hiddenY;
  payBtn.classList.add("hidden");
  state.chatCount = 0;
  emitSystemMsg("고양이가 다시 구조물 뒤로 숨었습니다.");
}

function triggerChuruAnimation() {
  state.payState = "approach";
  state.cat.targetX = state.churu.x + 55; state.cat.targetY = state.churu.y - 10;
  state.churu.visible = true;
  emitSystemMsg("고양이가 츄르를 먹기 시작합니다!");
}

function resetCat() {
  state.payState = "idle";
  state.stage = "hidden";
  state.cat.x = state.cat.hiddenX; state.cat.y = state.cat.hiddenY;
  state.cat.targetX = state.cat.hiddenX; state.cat.targetY = state.cat.hiddenY;
  state.churu.visible = false;
  state.isChatDisabled = false;
  state.chatCount = 0;
  payBtn.classList.add("hidden");
}

function spring(current, target, velocity, tension, friction, dt) {
  const force = (target - current) * tension - velocity * friction;
  velocity += force * dt;
  current += velocity * dt;
  return { val: current, vel: velocity };
}

function spawnDust(x, y) {
  for(let i=0; i<4; i++) {
    state.particles.push({
      x: x + (Math.random()-0.5)*40, 
      y: y + (Math.random()-0.5)*10,
      vx: (Math.random()-0.5)*60,
      vy: (Math.random()-0.5)*20 - 10,
      life: 1, maxLife: 0.5 + Math.random()*0.5,
      r: 3 + Math.random()*8
    });
  }
}

function update(dt) {
  state.time += dt;
  state.boilTimer += dt;
  if (state.boilTimer > 0.2) { state.seed = Math.random() * 100; state.boilTimer = 0; }

  // Update particles
  for(let i=state.particles.length-1; i>=0; i--) {
    let p = state.particles[i];
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.r += dt * 15;
    if (p.life <= 0) state.particles.splice(i, 1);
  }

  // Eye Darts
  state.cat.gazeTimer -= dt;
  if (state.cat.gazeTimer <= 0) {
    if (Math.random() < 0.3) {
      state.cat.targetGazeX = (Math.random() - 0.5) * 12;
      state.cat.targetGazeY = (Math.random() - 0.5) * 8;
      state.cat.gazeTimer = 0.5 + Math.random() * 1.5;
    } else {
      state.cat.targetGazeX = 0;
      state.cat.targetGazeY = 0;
      state.cat.gazeTimer = 1 + Math.random() * 3;
    }
  }

  if (state.userMessageTimer > 0) { state.userMessageTimer -= dt; if (state.userMessageTimer <= 0) state.userMessage = ""; }
  if (state.systemMessageTimer > 0) { state.systemMessageTimer -= dt; if (state.systemMessageTimer <= 0) state.systemMessage = ""; }

  if (!state.isCatPresent) return;

  // Spring update for Squash/Stretch
  const sX = spring(state.cat.scaleX, 1.0, state.cat.vScaleX, 100, 15, dt);
  state.cat.scaleX = sX.val; state.cat.vScaleX = sX.vel;
  const sY = spring(state.cat.scaleY, 1.0, state.cat.vScaleY, 100, 15, dt);
  state.cat.scaleY = sY.val; state.cat.vScaleY = sY.vel;
  
  // Spring update for Tilt
  const sT = spring(state.cat.tilt, 0, state.cat.vTilt, 100, 10, dt);
  state.cat.tilt = sT.val; state.cat.vTilt = sT.vel;

  state.cat.wary = lerp(state.cat.wary || 0, state.cat.targetWary || 0, 0.15);
  state.cat.earPrick = lerp(state.cat.earPrick || 0, state.cat.targetEarPrick || 0, 0.15);
  state.cat.affection = lerp(state.cat.affection || 0, state.cat.targetAffection || 0, 0.15);
  state.cat.breathing = Math.sin(state.time * 3) * 0.02;
  
  state.cat.gazeX = lerp(state.cat.gazeX, state.cat.targetGazeX, 0.3);
  state.cat.gazeY = lerp(state.cat.gazeY, state.cat.targetGazeY, 0.3);

  const speed = (state.stage === "approaching" || state.payState === "approach") ? 250 : 180;
  
  const dx = state.cat.targetX - state.cat.x;
  const dist = Math.abs(dx);
  const moveActive = (dist > 5 && state.stage !== "hidden");
  
  if (moveActive) {
    const dir = Math.sign(dx);
    state.cat.x += dir * speed * dt;
    
    // Bouncy trot hop
    let lastHop = state.cat.hopPhase;
    state.cat.hopPhase += dt * 10;
    
    // Impact check: if Math.sin crossed 0
    if (Math.sin(lastHop) * Math.sin(state.cat.hopPhase) < 0 || Math.floor(lastHop/Math.PI) !== Math.floor(state.cat.hopPhase/Math.PI)) {
      state.cat.vScaleY = -6; // Squash down (calmer)
      state.cat.vScaleX = 6;  // Stretch wide (calmer)
      spawnDust(state.cat.x, state.cat.targetY + 40);
    }
    
    const hopY = Math.abs(Math.sin(state.cat.hopPhase)) * 15;
    state.cat.y = lerp(state.cat.y, state.cat.targetY - hopY, 0.6);
    state.cat.tilt = dir * 0.05;
    state.cat.stepPhase += dt * 10;

  } else {
    state.cat.hopPhase = 0;
    state.cat.y = lerp(state.cat.y, state.cat.targetY, 0.3);
    state.cat.stepPhase += dt * 2; // slow idle legs

    if (state.stage === "approaching") { 
      state.stage = "center"; 
      state.cat.vScaleY = -10; state.cat.vScaleX = 10; // Calmer squash on arrival
      spawnDust(state.cat.x, state.cat.y + 40);
    }
    if (state.stage === "returning") state.stage = "hidden";
    if (state.payState === "approach") { state.payState = "eat"; state.eatTimer = 0; }
  }

  // Calculate generic VY for inertia
  state.cat.vy = (state.cat.y - (state.cat.lastY || state.cat.y)) / dt;
  state.cat.lastY = state.cat.y;

  if (state.payState === "eat") {
    state.eatTimer += dt;
    state.cat.targetAffection = 1;
    state.cat.hopPhase += dt * 6;
    state.cat.y = state.cat.targetY - Math.abs(Math.sin(state.cat.hopPhase)) * 4; // Calmer happy hops

    if (state.eatTimer > 8) {
      state.payState = "idle";
      state.cat.targetAffection = 0;
      returnToHidden();
      recordFeedAndFetchRank();
    }
  }

  updateTail(dt);

  state.cat.blinkTimer += dt;
  if (state.cat.blinkTimer > 3 + Math.random() * 2) { state.cat.blink = 1; state.cat.blinkTimer = 0; }
  if (state.cat.blink > 0) { state.cat.blink -= dt * 7; if (state.cat.blink < 0) state.cat.blink = 0; }
}

function updateTail(dt) {
  const tailBaseX = 0;
  const tailBaseY = 0;
  const segments = 10;
  if (!state.cat.tail) state.cat.tail = Array.from({length: segments}, () => ({x: 0, y: 0}));
  let targetAngle = Math.sin(state.time * (2 + state.cat.affection * 3)) * (0.15 + state.cat.affection * 0.2);
  if (state.cat.wary > 0.5) targetAngle = Math.sin(state.time * 25) * 0.05;
  // Tail Inertia
  targetAngle += state.cat.vy * 0.005;
  
  state.cat.tail.forEach((seg, i) => {
    const prev = i === 0 ? {x: tailBaseX, y: tailBaseY} : state.cat.tail[i-1];
    const angle = targetAngle * (i / segments);
    const tx = prev.x + Math.cos(angle) * 10;
    const ty = prev.y + Math.sin(angle) * 10 - (i * 0.6);
    seg.x = lerp(seg.x, tx, 0.3); seg.y = lerp(seg.y, ty, 0.3);
  });
}

// Custom Rainbow Gradient
let rainbowGrad;
function getRainbowGrad() {
  if (!rainbowGrad) {
    rainbowGrad = ctx.createLinearGradient(-100, -50, 100, 50);
    rainbowGrad.addColorStop(0, "#ffadad"); rainbowGrad.addColorStop(0.2, "#ffd6a5");
    rainbowGrad.addColorStop(0.4, "#fdffb6"); rainbowGrad.addColorStop(0.6, "#caffbf");
    rainbowGrad.addColorStop(0.8, "#9bf6ff"); rainbowGrad.addColorStop(1, "#a0c4ff");
  }
  return rainbowGrad;
}

function getBaseColor() {
  switch(state.catType) {
    case 1: return palette.catBlack; // Tuxedo
    case 2: return palette.catBlack; // Chaos
    case 4: return palette.catGrey; // Mackerel
    case 5: return palette.catSphynx; // Sphynx
    case 6: return palette.catTiger; // Tiger
    case 7: return palette.catPink; // Pink
    case 9: return getRainbowGrad(); // Rainbow
    default: return palette.catWhite; // Cheese(0), White(3), Pixel(8)
  }
}

function drawPixelCat() {
  const { x, y, tilt, wary, affection } = state.cat;
  const wobbleBase = Math.floor(Math.sin(state.cat.stepPhase) * 2) * 2; // blocky wobble
  ctx.save();
  ctx.translate(x, y + wobbleBase);
  if (wary > 0.2) ctx.translate(Math.floor(Math.sin(state.time * 50) * wary) * 4, 0);
  
  const pixelSize = 8;
  const grid = [
    "  p        p    ",
    " pwc      pwc   ",
    "pwwwpppppppwwp  ",
    "pwwwwwwwwwwwwp  ",
    "pwwpwwwwwpwwwp  ",
    "pwwwwwwwwwwwwp  ",
    "ppwwpwwwpwwpp   ",
    " pwwwwwwwwwwwp  ",
    "  pppppppppppp  ",
    "     pwwwwp     ",
    "   ppwwwwwwp    ",
    "  pwwwwwwwww  p ",
    " pwwwwwwwwwwpp  ",
    " pwwwwpwwpwwwp  ",
    "  pwwpp  pwwpp  ",
    "  pppp    pppp  "
  ];
  const offsetX = -grid[0].length * pixelSize * 0.5;
  const offsetY = -grid.length * pixelSize * 0.5 - 20;
  
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      const char = grid[r][c];
      if (char === 'p') ctx.fillStyle = palette.ink;
      else if (char === 'w') ctx.fillStyle = palette.catWhite;
      else if (char === 'c') ctx.fillStyle = palette.blush; 
      else continue;
      
      const walk = (r >= 13) ? Math.floor(Math.sin(state.cat.stepPhase + c)) * 4 : 0;
      ctx.fillRect(offsetX + c * pixelSize, offsetY + r * pixelSize + walk, pixelSize + 0.5, pixelSize + 0.5);
    }
  }

  // Pixel Hearts
  if (affection > 0.2) {
    const t = state.time * 4; ctx.font = "28px sans-serif";
    ctx.fillText("💕", -50, -80 - Math.floor(state.time%2)*20);
    ctx.fillText("✨", 40, -100 - Math.floor((state.time+1)%2)*20);
  }
  ctx.restore();
}

function drawCat() {
  if (!state.isCatPresent) return;
  if (state.catType === 8) {
    drawPixelCat();
    return;
  }

  const { x, y, tilt, breathing, wary, earPrick, affection } = state.cat;
  const wobbleBase = Math.sin(state.cat.stepPhase) * 2;
  const seed = state.seed;

  ctx.save();
  ctx.translate(x, y + wobbleBase);
  ctx.scale(state.cat.scaleX, state.cat.scaleY);
  ctx.rotate(tilt);
  ctx.scale(1 + breathing, 1 - breathing);
  if (wary > 0.2) ctx.translate(Math.sin(state.time * 50) * wary * 2, 0);

  ctx.strokeStyle = palette.ink;
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // 1. Doodle Unified Body & Head
  const earY = earPrick * -15; 
  const earX = wary * 10;
  
  const catPts = [
    {x: -60 - earX, y: -50 + earY}, // 0: Left Ear
    {x: -25, y: -30},               // 1: Forehead L
    {x: 15, y: -30},                // 2: Forehead R
    {x: 50 + earX, y: -50 + earY},  // 3: Right Ear
    {x: 60, y: -10},                // 4: Back of Head / Right Cheek
    {x: 100, y: -10},               // 5: Upper Back
    {x: 150, y: -10},               // 6: Mid Back
    {x: 190, y: 10},                // 7: Rump
    {x: 195, y: 35}                 // 8: Rump Bottom
  ];

  const legY = 35, legH = 20;
  [180, 150, 90, 60].forEach((lx, i) => {
    let walkY = Math.sin(state.cat.stepPhase + (3-i) * 2) * 5;
    catPts.push({x: lx, y: legY}); 
    catPts.push({x: lx, y: legY + legH + walkY}); 
    catPts.push({x: lx - 10, y: legY + legH + walkY}); 
    catPts.push({x: lx - 10, y: legY}); 
  });

  catPts.push({x: 45, y: 35});       // Chest
  catPts.push({x: 20, y: 40});       // Right Chin
  catPts.push({x: -20, y: 45});      // Bottom Chin
  catPts.push({x: -55, y: 40});      // Left Chin
  catPts.push({x: -75, y: 0});       // Left Cheek

  const wCat = getWobble(catPts, seed, 1.2);

  // 2. Doodle Tail
  ctx.beginPath();
  const tailStart = {x: 190, y: 10};
  if (state.cat.tail) {
    ctx.moveTo(tailStart.x, tailStart.y);
    for (let i = 1; i < state.cat.tail.length; i++) {
       ctx.lineTo(tailStart.x + state.cat.tail[i].x, tailStart.y + state.cat.tail[i].y);
    }
  }
  ctx.stroke();

  // 3. Base Fill
  ctx.fillStyle = getBaseColor();
  ctx.beginPath(); ctx.moveTo(wCat[0].x, wCat[0].y); wCat.forEach(p => ctx.lineTo(p.x, p.y)); ctx.closePath(); 
  ctx.fill(); ctx.stroke();

  // 4. Fur Patterns
  ctx.save();
  ctx.clip(new Path2D(`M ${wCat[0].x} ${wCat[0].y} ` + wCat.map(p => `L ${p.x} ${p.y}`).join(" ")));
  if (state.catType === 0) { // Cheese
    ctx.fillStyle = palette.catCheese; 
    ctx.beginPath(); ctx.arc(-15, -30, 45, 0, Math.PI*2); ctx.fill(); // Head patch
    ctx.beginPath(); ctx.arc(140, 10, 45, 0, Math.PI*2); ctx.fill();  // Rump patch
  } else if (state.catType === 1) { // Tuxedo
    ctx.fillStyle = palette.catWhite; 
    ctx.beginPath(); ctx.ellipse(100, 40, 60, 25, 0, 0, Math.PI*2); ctx.fill(); // Belly
    ctx.beginPath(); ctx.arc(-15, 20, 35, 0, Math.PI*2); ctx.fill(); // Muzzle
    // Paws
    [180, 150, 90, 60].forEach((lx, i) => {
      let walkY = Math.sin(state.cat.stepPhase + (3-i) * 2) * 5;
      ctx.fillRect(lx - 12, legY + legH + walkY - 6, 14, 8);
    });
  } else if (state.catType === 2) { // Chaos
    ctx.fillStyle = palette.catCheese; ctx.beginPath(); ctx.arc(0, -20, 25, 0, Math.PI*2); ctx.arc(150, 10, 40, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = palette.catWhite; ctx.beginPath(); ctx.arc(100, 30, 45, 0, Math.PI*2); ctx.arc(-40, 10, 20, 0, Math.PI*2); ctx.fill();
  } else if (state.catType === 3) { // White pink ears
    ctx.fillStyle = palette.blush; ctx.beginPath(); ctx.arc(-55, -45, 15, 0, Math.PI*2); ctx.arc(45, -45, 15, 0, Math.PI*2); ctx.fill();
  } else if (state.catType === 4 || state.catType === 6) { // Stripes
    ctx.strokeStyle = (state.catType===4)? palette.catDarkGrey : palette.ink; ctx.lineWidth = 6;
    for(let i=0; i<=5; i++) { ctx.beginPath(); ctx.moveTo(i*25 + 40, -10); ctx.lineTo(i*25 + 25, 50); ctx.stroke(); }
    for(let i=-1; i<=1; i++) { ctx.beginPath(); ctx.moveTo(-15 + i*15, -40); ctx.lineTo(-15 + i*18, 0); ctx.stroke(); }
  }
  ctx.restore();

  // 5. Face Details
  const gaze = getGaze();
  const eyeY = 5, eyeX = -15; // Set center of eyes
  const gap = 30; // distance between eyes
  const blink = Math.max(0, 1 - state.cat.blink);
  
  if (affection > 0.1) {
    ctx.globalAlpha = affection * 0.6; ctx.fillStyle = palette.blush;
    ctx.beginPath(); ctx.arc(eyeX - gap - 5, eyeY + 10, 12, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(eyeX + gap + 5, eyeY + 10, 12, 0, Math.PI*2); ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Dots for eyes
  ctx.fillStyle = palette.ink;
  if (blink > 0.1) {
    const pScale = 1 + affection * 0.3 + (state.payState === "approach" ? 0.3 : 0);
    ctx.save(); ctx.translate(eyeX - gap + gaze.x*0.5, eyeY + gaze.y*0.5); ctx.scale(1, pScale);
    ctx.beginPath(); ctx.arc(0, 0, 4.5, 0, Math.PI*2); ctx.fill(); ctx.restore();
    
    ctx.save(); ctx.translate(eyeX + gap + gaze.x*0.5, eyeY + gaze.y*0.5); ctx.scale(1, pScale);
    ctx.beginPath(); ctx.arc(0, 0, 4.5, 0, Math.PI*2); ctx.fill(); ctx.restore();
  } else {
    ctx.beginPath(); ctx.moveTo(eyeX-gap-5, eyeY); ctx.lineTo(eyeX-gap+5, eyeY); 
    ctx.moveTo(eyeX+gap-5, eyeY); ctx.lineTo(eyeX+gap+5, eyeY); ctx.stroke();
  }
  
  // W Mouth (floating)
  let mY = eyeY + 15 + gaze.y, mX = eyeX + gaze.x;
  ctx.beginPath();
  ctx.moveTo(mX - 10, mY - 5);
  ctx.quadraticCurveTo(mX - 5, mY + 8, mX, mY);
  ctx.quadraticCurveTo(mX + 5, mY + 8, mX + 10, mY - 5);
  ctx.stroke();

  // Whiskers (Straight lines spreading from cheeks)
  ctx.beginPath();
  ctx.moveTo(-75, eyeY + 5); ctx.lineTo(-45, eyeY + 10);
  ctx.moveTo(-70, eyeY + 20); ctx.lineTo(-40, eyeY + 20);
  ctx.moveTo(45, eyeY + 10); ctx.lineTo(75, eyeY + 5);
  ctx.moveTo(40, eyeY + 20); ctx.lineTo(70, eyeY + 20);
  ctx.stroke();
  
  // Sphynx wrinkles
  if (state.catType === 5) {
    ctx.strokeStyle = "rgba(0,0,0,0.2)";
    ctx.beginPath(); ctx.moveTo(-30, -10); ctx.lineTo(0, -10); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-20, 0); ctx.lineTo(10, 0); ctx.stroke();
    ctx.strokeStyle = palette.ink;
  }
  
  // Hearts
  if (affection > 0.2) {
    const t = state.time * 4; ctx.font = "28px sans-serif";
    ctx.fillText("💕", -50 + Math.sin(t)*10, -100 - (state.time%2)*30);
    ctx.fillText("✨", 40 + Math.cos(t)*10, -120 - ((state.time+1)%2)*30);
  }
  ctx.restore(); // Entire Cat
}

function drawStructure() {
  if (!state.isCatPresent) return;
  const { hiddenX, hiddenY } = state.cat;
  ctx.save();
  ctx.translate(hiddenX, hiddenY);
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = palette.ink;

  const type = state.structureType;

  if (type === 0) {
    // 0: Cardboard Box
    ctx.translate(-75, -50);
    ctx.fillStyle = "#e0c9a6";
    const boxPts = generateWobblyRectPoints(0, 0, 180, 140, 15);
    const wBox = getWobble(boxPts, state.seed, 2.5);
    ctx.beginPath(); ctx.moveTo(wBox[0].x, wBox[0].y); wBox.forEach(p => ctx.lineTo(p.x, p.y)); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(15, 0); ctx.lineTo(-10, -35); ctx.lineTo(190, -35); ctx.lineTo(165, 0); ctx.stroke();
  } 
  else if (type === 1) {
    // 1: Telephone Pole
    ctx.translate(-35, -350);
    ctx.fillStyle = "#9c9b98";
    const polePts = generateWobblyRectPoints(0, 0, 70, 500, 5);
    const wPole = getWobble(polePts, state.seed, 1.5);
    ctx.beginPath(); ctx.moveTo(wPole[0].x, wPole[0].y); wPole.forEach(p => ctx.lineTo(p.x, p.y)); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, 150); ctx.lineTo(70, 155); ctx.moveTo(0, 280); ctx.lineTo(70, 275); ctx.stroke();
  }
  else if (type === 2) {
    // 2: Car
    ctx.translate(-200, -200);
    ctx.fillStyle = "#a8dadc";
    // Tires
    ctx.fillStyle = "#333";
    ctx.beginPath(); ctx.arc(100, 200, 45, 0, Math.PI*2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(450, 200, 45, 0, Math.PI*2); ctx.fill(); ctx.stroke();
    // Body
    ctx.fillStyle = "#a8dadc";
    const bodyPts = generateWobblyRectPoints(0, 70, 550, 130, 20);
    const wBody = getWobble(bodyPts, state.seed, 2);
    ctx.beginPath(); ctx.moveTo(wBody[0].x, wBody[0].y); wBody.forEach(p => ctx.lineTo(p.x, p.y)); ctx.closePath(); ctx.fill(); ctx.stroke();
    // Roof
    const roofPts = generateWobblyRectPoints(100, 0, 320, 70, 15);
    const wRoof = getWobble(roofPts, state.seed + 1, 2);
    ctx.beginPath(); ctx.moveTo(wRoof[0].x, wRoof[0].y); wRoof.forEach(p => ctx.lineTo(p.x, p.y)); ctx.closePath(); ctx.fill(); ctx.stroke();
    // Windows
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.beginPath(); ctx.roundRect(120, 15, 120, 55, 12); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.roundRect(280, 15, 120, 55, 12); ctx.fill(); ctx.stroke();
  }
  else if (type === 3) {
    // 3: Trash Can
    ctx.translate(-70, -150);
    ctx.fillStyle = "#999999";
    const canPts = generateWobblyRectPoints(0, 0, 140, 180, 10);
    const wCan = getWobble(canPts, state.seed, 2);
    ctx.beginPath(); ctx.moveTo(wCan[0].x, wCan[0].y); wCan.forEach(p => ctx.lineTo(p.x, p.y)); ctx.closePath(); ctx.fill(); ctx.stroke();
    // Corrugated lines
    for(let i=25; i<=115; i+=30) {
      ctx.beginPath(); ctx.moveTo(i, 15); ctx.lineTo(i, 165); ctx.stroke();
    }
  }

  ctx.restore();
}

function drawChuru() {
  if (!state.churu.visible) return;
  const { x, y } = state.churu;
  ctx.save();
  ctx.translate(x, y); ctx.rotate(0.1 + Math.sin(state.time * 5) * 0.05);
  ctx.fillStyle = palette.churu; ctx.strokeStyle = palette.ink; ctx.lineWidth = 3;
  const bodyPoints = getWobble([{ x: -10, y: -35 }, { x: 10, y: -35 }, { x: 10, y: 35 }, { x: -10, y: 35 }], state.seed, 2);
  ctx.beginPath(); ctx.moveTo(bodyPoints[0].x, bodyPoints[0].y); bodyPoints.forEach(p => ctx.lineTo(p.x, p.y)); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "white"; ctx.font = "bold 8px sans-serif"; ctx.fillText("CHURU", -18, 5);
  ctx.restore();
}

function drawSystemMessage() {
  if (!state.systemMessage) return;
  ctx.save();
  ctx.fillStyle = palette.ink;
  ctx.font = "bold 18px sans-serif";
  ctx.textAlign = "center";
  
  let alpha = 1;
  if (state.systemMessageTimer > 3.5) alpha = (4 - state.systemMessageTimer) * 2;
  if (state.systemMessageTimer < 0.5) alpha = state.systemMessageTimer * 2;
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
  
  const x = window.innerWidth * 0.5;
  const y = 80 - (1 - alpha) * 15;
  
  const textWidth = ctx.measureText(state.systemMessage).width;
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.beginPath(); ctx.roundRect(x - textWidth/2 - 16, y - 24, textWidth + 32, 36, 18); ctx.fill();
  
  ctx.fillStyle = palette.ink; ctx.fillText(state.systemMessage, x, y);
  ctx.restore();
}

function drawUserMessage() {
  if (!state.userMessage) return;
  ctx.save();
  ctx.fillStyle = "rgba(40, 40, 40, 0.95)"; ctx.strokeStyle = palette.gold; ctx.lineWidth = 2; ctx.font = "bold 16px sans-serif";
  const padding = 16, textWidth = ctx.measureText(state.userMessage).width;
  const bubbleW = textWidth + padding * 2, bubbleH = 45;
  const x = window.innerWidth * 0.5 - bubbleW * 0.5;
  const y = window.innerHeight * 0.85 - 80;
  
  const bubblePts = generateWobblyRectPoints(x, y, bubbleW, bubbleH, 15);
  const elapsed = 3.5 - state.userMessageTimer;
  const scale = Math.min(1, elapsed * 6);
  ctx.translate(x + bubbleW * 0.5, y + bubbleH * 0.5); ctx.scale(scale, scale);
  if (state.userMessageTimer < 0.3) ctx.globalAlpha = Math.max(0, state.userMessageTimer / 0.3);
  ctx.translate(-(x + bubbleW * 0.5), -(y + bubbleH * 0.5));
  
  const wBubble = getWobble(bubblePts, state.seed + 10, 2);
  ctx.beginPath(); ctx.moveTo(wBubble[0].x, wBubble[0].y); wBubble.forEach(p => ctx.lineTo(p.x, p.y)); ctx.closePath(); ctx.fill(); ctx.stroke();
  
  ctx.fillStyle = "white"; ctx.fillText(state.userMessage, x + padding, y + 28);
  ctx.restore();
}

function getGaze() {
  return { x: state.cat.gazeX, y: state.cat.gazeY };
}

function render() {
  ctx.fillStyle = palette.bgBottom;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  const horizon = canvas.height * 0.5;
  const grad = ctx.createLinearGradient(0, 0, 0, horizon);
  grad.addColorStop(0, palette.bgTop); grad.addColorStop(1, palette.bgBottom);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, horizon);

  // Particles
  if (state.particles && state.particles.length > 0) {
    state.particles.forEach(p => {
      ctx.fillStyle = `rgba(168, 162, 160, ${p.life / p.maxLife * 0.5})`; // grey dust
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2); ctx.fill();
    });
  }
  
  if (state.isCatPresent) {
    drawCat();
    drawStructure();
    drawChuru();
  } else {
    // Empty alley: maybe draw a tiny tumbleweed or just empty space
    drawStructure();
  }
  
  drawUserMessage();
  drawSystemMessage();
}

let last = performance.now();
function loop(now) {
  const delta = (now - last) / 1000;
  last = now;
  update(delta);
  render();
  requestAnimationFrame(loop);
}

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  state.cat.baseX = window.innerWidth * 0.5;
  state.cat.baseY = window.innerHeight * 0.55;
  state.cat.hiddenX = window.innerWidth * 0.85;
  state.cat.hiddenY = window.innerHeight * 0.45;
  state.churu.x = window.innerWidth * 0.5;
  state.churu.y = window.innerHeight * 0.85;
  if(state.stage === "hidden") {
    state.cat.x = state.cat.hiddenX; state.cat.y = state.cat.hiddenY;
    state.cat.targetX = state.cat.hiddenX; state.cat.targetY = state.cat.hiddenY;
  }
}

async function recordFeedAndFetchRank() {
  if (!currentUser) return;
  state.isChatDisabled = true;
  
  await supabase.from('feed_logs').insert([
    { user_id: currentUser.id, cat_type: state.catType }
  ]);
  
  const { data: leaderboard } = await supabase.from('cat_leaderboard')
    .select('*')
    .eq('cat_type', state.catType)
    .order('rank', { ascending: true });
    
  if (leaderboard) {
    const myRankEntry = leaderboard.find(r => r.user_id === currentUser.id);
    if (myRankEntry) {
      const catName = catNames[state.catType] || "고양이";
      state.systemMessage = `🎉 축하합니다! ${catName}에게 ${myRankEntry.rank}번째로 마음을 얻었습니다!`;
      state.systemMessageTimer = 6;
      updateLeaderboardUI(leaderboard);
      rankingContainer.classList.remove("hidden");
    }
  } else {
    emitSystemMsg("고양이가 무척 행복해 보입니다!");
  }
  state.isChatDisabled = false;
}

function updateLeaderboardUI(leaderboard) {
  rankingList.innerHTML = "";
  leaderboard.slice(0, 10).forEach(entry => {
    const li = document.createElement("li");
    li.innerHTML = `<span><strong>${entry.rank}위</strong>: ${entry.nickname || '익명'}</span> <span>🐟 ${entry.total_feeds}츄르</span>`;
    rankingList.appendChild(li);
  });
}

function showRanking() {
  if (!state.isCatPresent || state.catType === undefined || state.catType === -1) {
    rankingList.innerHTML = "<li>현재 골목에 고양이가 없습니다.</li>";
    rankingContainer.classList.remove("hidden");
    return;
  }
  rankingList.innerHTML = "<li>로딩 중...</li>";
  rankingContainer.classList.remove("hidden");
  
  supabase.from('cat_leaderboard')
    .select('*')
    .eq('cat_type', state.catType)
    .order('rank', { ascending: true })
    .limit(10)
    .then(({ data }) => {
      if (data && data.length > 0) {
        updateLeaderboardUI(data);
      } else {
        rankingList.innerHTML = "<li>아직 이 고양이에게 츄르를 준 닝겐이 없습니다!</li>";
      }
    });
}

window.addEventListener("resize", resize);
resize();
resetCat();
requestAnimationFrame(loop);
