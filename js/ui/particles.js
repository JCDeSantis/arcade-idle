// js/ui/particles.js — canvas particle effects

const canvas  = document.getElementById('particle-canvas');
const ctx     = canvas.getContext('2d');
let particles = [];
let animId    = null;

export function initParticles() {
  resize();
  window.addEventListener('resize', resize);
}

function resize() {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  canvas.style.position = 'fixed';
  canvas.style.top  = '0';
  canvas.style.left = '0';
  canvas.style.pointerEvents = 'none';
  canvas.style.zIndex = '100';
}

/** Fire score-pop particles at screen position (x, y) */
export function popParticles(x, y, color = '#00ffff', count = 12) {
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.3;
    const speed = 80 + Math.random() * 120;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 60,
      r: 2 + Math.random() * 3,
      color,
      alpha: 1,
      life: 0.6 + Math.random() * 0.4,
      age: 0,
    });
  }
  if (!animId) loop();
}

/** Big prestige burst from center of screen */
export function prestigeBurst() {
  const cx = window.innerWidth  / 2;
  const cy = window.innerHeight / 2;
  for (let i = 0; i < 80; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 100 + Math.random() * 300;
    particles.push({
      x: cx, y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      r: 3 + Math.random() * 5,
      color: ['#00ff88', '#00ffff', '#ff00ff'][Math.floor(Math.random() * 3)],
      alpha: 1,
      life: 1.0 + Math.random() * 0.5,
      age: 0,
    });
  }
  if (!animId) loop();
}

function loop() {
  const dt = 1 / 60;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  particles = particles.filter(p => p.age < p.life);

  for (const p of particles) {
    p.age += dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 200 * dt; // gravity
    p.alpha = 1 - p.age / p.life;

    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    const hexAlpha = Math.floor(p.alpha * 255).toString(16).padStart(2, '0');
    ctx.fillStyle = p.color + hexAlpha;
    ctx.fill();
  }

  if (particles.length > 0) {
    animId = requestAnimationFrame(loop);
  } else {
    animId = null;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}
