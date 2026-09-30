(() => {
  const canvas = document.getElementById("orb");
  const ctx = canvas.getContext("2d");
  let state = "idle";
  let level = 0;
  let target = 0;
  let t0 = performance.now();
  const ripples = [];

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.floor(innerWidth * dpr);
    canvas.height = Math.floor(innerHeight * dpr);
    canvas.style.width = innerWidth + "px";
    canvas.style.height = innerHeight + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener("resize", resize);
  resize();

  function setState(next) {
    state = next;
    document.body.dataset.mode = next;
    if (next === "speak") {
      for (let i = 0; i < 3; i++) {
        ripples.push({ born: performance.now() + i * 120, life: 1400 });
      }
    }
  }

  function setLevel(n) {
    target = Math.max(0, Math.min(1, n));
  }

  function draw(now) {
    const w = innerWidth;
    const h = innerHeight;
    const cx = w / 2;
    const cy = h * 0.46;
    const dt = now - t0;
    t0 = now;
    level += (target - level) * Math.min(1, dt / 80);

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#02050a";
    ctx.fillRect(0, 0, w, h);

    const idlePulse = 0.5 + 0.5 * Math.sin(now / 900);
    let radius = 78;
    let glow = 0.35;
    if (state === "idle") {
      radius += idlePulse * 6;
      glow = 0.28 + idlePulse * 0.12;
      target = idlePulse * 0.15;
    } else if (state === "listen") {
      radius += 4 * Math.sin(now / 220);
      glow = 0.55;
      target = 0.35 + 0.2 * Math.sin(now / 180);
    } else {
      radius += 10 + level * 28;
      glow = 0.45 + level * 0.5;
      if (now % 280 < 16) ripples.push({ born: now, life: 1200 + level * 400 });
    }

    const g = ctx.createRadialGradient(cx, cy, 8, cx, cy, radius * 4.2);
    g.addColorStop(0, `rgba(120, 220, 255, ${0.16 + glow * 0.25})`);
    g.addColorStop(0.35, "rgba(20, 70, 110, 0.18)");
    g.addColorStop(1, "rgba(2, 5, 10, 0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 4.2, 0, Math.PI * 2);
    ctx.fill();

    const core = ctx.createRadialGradient(
      cx - radius * 0.25,
      cy - radius * 0.3,
      4,
      cx,
      cy,
      radius
    );
    core.addColorStop(0, "#e7fbff");
    core.addColorStop(0.25, "#7adfff");
    core.addColorStop(0.7, "#1a8ec4");
    core.addColorStop(1, "#06304a");
    ctx.shadowColor = `rgba(80, 210, 255, ${0.6 + glow})`;
    ctx.shadowBlur = 40 + glow * 50;
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.strokeStyle = "rgba(180, 240, 255, 0.35)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.72, 0, Math.PI * 2);
    ctx.stroke();

    if (state === "listen") {
      for (let i = 0; i < 4; i++) {
        const k = (now / 900 + i / 4) % 1;
        const r = radius * (1.15 + (1 - k) * 1.35);
        ctx.strokeStyle = `rgba(90, 210, 255, ${0.45 * k})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    const keep = [];
    for (const rip of ripples) {
      const age = now - rip.born;
      if (age < 0 || age > rip.life) continue;
      const p = age / rip.life;
      const r = radius + p * (90 + level * 80);
      ctx.strokeStyle = `rgba(90, 210, 255, ${(1 - p) * (0.25 + level * 0.55)})`;
      ctx.lineWidth = 3 * (1 - p) * (1 + level);
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
      keep.push(rip);
    }
    ripples.length = 0;
    ripples.push(...keep.slice(-14));

    if (state === "speak") {
      const bars = 28;
      for (let i = 0; i < bars; i++) {
        const ang = (i / bars) * Math.PI * 2 + now / 700;
        const amp = (0.35 + 0.65 * level) * (0.55 + 0.45 * Math.abs(Math.sin(now / 90 + i)));
        const inner = radius + 10;
        const outer = inner + 8 + amp * 42;
        ctx.strokeStyle = `rgba(120, 230, 255, ${0.25 + amp * 0.5})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(ang) * inner, cy + Math.sin(ang) * inner);
        ctx.lineTo(cx + Math.cos(ang) * outer, cy + Math.sin(ang) * outer);
        ctx.stroke();
      }
    }

    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);

  window.orbSetState = setState;
  window.orbSetLevel = setLevel;
})();
