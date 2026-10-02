(() => {
  const canvas = document.getElementById("orb");
  const ctx = canvas.getContext("2d", { alpha: false });
  let state = "idle";
  let level = 0;
  let target = 0;
  let freq = 0.4;
  let freqTarget = 0.4;
  let lastAmp = 0;
  let lastSpawn = 0;
  let t0 = performance.now();
  let dpr = 1;

  const meridians = 26;
  const parallels = 14;
  const ringCount = 9;
  const sparkN = 420;
  const sparks = [];

  for (let i = 0; i < sparkN; i++) {
    sparks.push({
      theta: Math.random() * Math.PI * 2,
      phi: Math.acos(2 * Math.random() - 1),
      speed: 0.22 + Math.random() * 0.85,
      orbit: 0.55 + Math.random() * 0.62,
      trail: Math.random() * Math.PI * 2,
      size: 0.5 + Math.random() * 2.2,
      band: Math.random() < 0.35,
    });
  }

  const rings = [];
  for (let i = 0; i < ringCount; i++) {
    rings.push({
      ax: (i * 0.7 + 0.2) % Math.PI,
      ay: (i * 1.1 + 0.4) % Math.PI,
      az: i * 0.55,
      speed: 0.12 + i * 0.045,
      tilt: 0.35 + (i % 3) * 0.22,
    });
  }

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.floor(innerWidth * dpr);
    canvas.height = Math.floor(innerHeight * dpr);
    canvas.style.width = innerWidth + "px";
    canvas.style.height = innerHeight + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener("resize", resize);
  resize();

  const ripples = [];

  function setState(next) {
    state = next;
    document.body.dataset.mode = next;
    if (next === "speak" && ripples.length < 2) {
      ripples.push({ t: performance.now(), dir: 1, seed: 0 });
    }
  }

  function setLevel(n, f) {
    target = Math.max(0, Math.min(1, n));
    if (typeof f === "number" && !Number.isNaN(f)) {
      freqTarget = Math.max(0, Math.min(1, f));
    }
  }

  function rotX(p, a) {
    const c = Math.cos(a);
    const s = Math.sin(a);
    return { x: p.x, y: p.y * c - p.z * s, z: p.y * s + p.z * c };
  }
  function rotY(p, a) {
    const c = Math.cos(a);
    const s = Math.sin(a);
    return { x: p.x * c + p.z * s, y: p.y, z: -p.x * s + p.z * c };
  }
  function rotZ(p, a) {
    const c = Math.cos(a);
    const s = Math.sin(a);
    return { x: p.x * c - p.y * s, y: p.x * s + p.y * c, z: p.z };
  }

  function sph(theta, phi, r) {
    return {
      x: r * Math.sin(phi) * Math.cos(theta),
      y: r * Math.cos(phi),
      z: r * Math.sin(phi) * Math.sin(theta),
    };
  }

  function project(p, cx, cy, scale) {
    const z = p.z + 3.2;
    const f = scale / z;
    return { x: cx + p.x * f, y: cy + p.y * f, z: p.z, a: Math.max(0.08, (p.z + 1.15) / 2.2) };
  }

  function drawOrganicRing(cx, cy, rx, ry, rot, wobble, seed, stroke, width) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = width;
    ctx.beginPath();
    const n = 80;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2 + rot;
      const w =
        1 +
        wobble * 0.045 * Math.sin(a * 3 + seed) +
        wobble * 0.03 * Math.sin(a * 7 - seed * 1.7);
      const x = cx + Math.cos(a) * rx * w;
      const y = cy + Math.sin(a) * ry * w;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
  }

  function drawPolyline(pts, stroke, width) {
    if (pts.length < 2) return;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();
  }

  function draw(now) {
    const w = innerWidth;
    const h = innerHeight;
    const cx = w / 2;
    const cy = h * 0.46;
    const dt = Math.min(40, now - t0);
    t0 = now;
    const t = now / 1000;
    level += (target - level) * Math.min(1, dt / 90);
    freq += (freqTarget - freq) * Math.min(1, dt / 120);

    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "#03060c";
    ctx.fillRect(0, 0, w, h);

    const room = ctx.createRadialGradient(cx, cy, 40, cx, cy * 1.4, Math.max(w, h) * 0.72);
    room.addColorStop(0, "rgba(8, 28, 48, 0.55)");
    room.addColorStop(0.45, "rgba(4, 10, 18, 0.2)");
    room.addColorStop(1, "rgba(1, 2, 6, 0)");
    ctx.fillStyle = room;
    ctx.fillRect(0, 0, w, h);

    let ringTight = 1;
    let rotSpeed = 0.18;
    let sparkAmt = 0.22;
    let wave = 0;
    if (state === "idle") {
      target = 0;
      ringTight = 1;
      rotSpeed = 0.16;
      sparkAmt = 0.2;
    } else if (state === "listen") {
      ringTight = 0.78 + 0.05 * Math.sin(t * 5);
      rotSpeed = 0.42;
      sparkAmt = 0.5;
      target = 0.35 + 0.12 * Math.sin(t * 7);
      if (ripples.length < 5 && Math.random() < 0.08) {
        ripples.push({ t: now, dir: -1, seed: Math.random() });
      }
    } else {
      rotSpeed = 0.22 + level * 0.55;
      sparkAmt = 0.35 + level * 0.7;
      wave = level;
      const rising = level > lastAmp + 0.03;
      const cool = 70 + (1 - level) * 90;
      if (level > 0.06 && rising && now - lastSpawn > cool && ripples.length < 10) {
        lastSpawn = now;
        const shells = level > 0.62 ? 3 : level > 0.32 ? 2 : 1;
        for (let s = 0; s < shells; s++) {
          ripples.push({
            t: now + s * (55 + (1 - freq) * 40),
            dir: 1,
            seed: Math.random() * 8,
            born: level,
            hz: freq,
          });
        }
      }
      lastAmp = level;
    }

    const yaw = t * rotSpeed;
    const pitch = Math.sin(t * 0.17) * 0.18;
    const baseR = Math.min(w, h) * 0.38;
    const scale = baseR * 1.85;

    function xf(p) {
      let q = rotY(p, yaw);
      q = rotX(q, pitch);
      return project(q, cx, cy, scale);
    }

    const bloom = ctx.createRadialGradient(cx, cy, 6, cx, cy, baseR * 2.4);
    bloom.addColorStop(0, `rgba(160, 230, 255, ${0.14 + level * 0.18})`);
    bloom.addColorStop(0.25, `rgba(40, 160, 220, ${0.1 + level * 0.12})`);
    bloom.addColorStop(1, "rgba(3, 8, 16, 0)");
    ctx.fillStyle = bloom;
    ctx.beginPath();
    ctx.arc(cx, cy, baseR * 2.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalCompositeOperation = "lighter";

    const coreR = baseR * 0.16 * (1 + level * 0.35);
    const core = ctx.createRadialGradient(cx - 6, cy - 8, 2, cx, cy, coreR * 2.2);
    core.addColorStop(0, "rgba(230, 252, 255, 0.95)");
    core.addColorStop(0.35, "rgba(90, 210, 255, 0.55)");
    core.addColorStop(1, "rgba(20, 80, 140, 0)");
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(cx, cy, coreR * 2.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    const amp = state === "speak" ? level : 0;
    for (let i = ripples.length - 1; i >= 0; i--) {
      const rp = ripples[i];
      if (now < rp.t) continue;
      const life = rp.dir > 0 ? 1300 : 900;
      const age = (now - rp.t) / life;
      if (age >= 1) {
        ripples.splice(i, 1);
        continue;
      }
      const grow = rp.dir > 0 ? age : 1 - age;
      const born = rp.born != null ? rp.born : amp;
      const reach = rp.dir > 0 ? 0.55 + born * 1.05 : 1.35;
      const rad = baseR * (0.18 + grow * reach);
      const fade = 1 - age;
      const alpha = fade * (rp.dir > 0 ? 0.22 + born * 0.45 : 0.4);
      const thin = rp.dir > 0 ? 0.55 + born * 1.35 : 1.6;
      drawOrganicRing(
        cx,
        cy,
        rad,
        rad * 0.9,
        (rp.hz || 0) * age * 0.4,
        0.8 + (rp.hz || 0.4),
        rp.seed || 1,
        `rgba(120, 230, 255, ${alpha})`,
        thin
      );
      if (rp.dir > 0 && born > 0.25) {
        drawOrganicRing(
          cx,
          cy,
          rad * 0.98,
          rad * 0.88,
          0,
          0.6,
          rp.seed + 2,
          `rgba(210, 250, 255, ${alpha * 0.35})`,
          0.45
        );
      }
      if (rp.dir > 0 && born > 0.5 && age < 0.45) {
        const dust = 10 + Math.floor(born * 18);
        for (let d = 0; d < dust; d++) {
          const a = (d / dust) * Math.PI * 2 + rp.seed;
          const jitter = 0.92 + ((d * 17) % 9) * 0.012;
          ctx.fillStyle = `rgba(180, 240, 255, ${fade * 0.18 * born})`;
          ctx.beginPath();
          ctx.arc(cx + Math.cos(a) * rad * jitter, cy + Math.sin(a) * rad * 0.9 * jitter, 0.8 + born, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    if (state === "listen") {
      for (let k = 0; k < 3; k++) {
        const phase = (t * 1.1 + k / 3) % 1;
        const rad = baseR * (1.35 - phase * 1.05);
        ctx.strokeStyle = `rgba(80, 190, 255, ${(1 - phase) * 0.45})`;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rad, rad * 0.9, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    for (let m = 0; m < meridians; m++) {
      const theta = (m / meridians) * Math.PI * 2;
      const pts = [];
      const n = 40;
      for (let i = 0; i <= n; i++) {
        const phi = (i / n) * Math.PI;
        const bump =
          state === "speak" ? 1 + amp * 0.1 * Math.sin(phi * 5 - t * (6 + freq * 8) + m * 0.3) : ringTight;
        const pr = xf(sph(theta, phi, bump));
        pts.push(pr);
        if (state === "speak" && amp > 0.2 && i > 0) {
          const pulse = 0.5 + 0.5 * Math.sin(phi * 6 - t * (8 + freq * 10) + m);
          if (pulse > 0.72) {
            ctx.strokeStyle = `rgba(160, 240, 255, ${0.18 * pulse * amp * pr.a})`;
            ctx.lineWidth = 1.2 * pulse * (0.5 + amp);
            ctx.beginPath();
            ctx.moveTo(pts[i - 1].x, pts[i - 1].y);
            ctx.lineTo(pr.x, pr.y);
            ctx.stroke();
          }
        }
      }
      drawPolyline(
        pts,
        `rgba(100, 210, 255, ${0.22 + 0.28 * (state === "speak" ? level : 0.45)})`,
        0.85
      );
    }

    for (let p = 1; p < parallels; p++) {
      const phi = (p / parallels) * Math.PI;
      const pts = [];
      const n = 64;
      for (let i = 0; i <= n; i++) {
        const theta = (i / n) * Math.PI * 2;
        pts.push(xf(sph(theta, phi, ringTight)));
      }
      drawPolyline(pts, "rgba(70, 180, 230, 0.2)", 0.65);
    }

    for (let r = 0; r < rings.length; r++) {
      const ring = rings[r];
      const spin = t * ring.speed * (state === "listen" ? 1.8 : 1) + ring.az;
      const pts = [];
      const n = 96;
      const rad = ringTight * (0.78 + (r % 4) * 0.08);
      for (let i = 0; i <= n; i++) {
        const a = (i / n) * Math.PI * 2;
        let p = { x: Math.cos(a) * rad, y: Math.sin(a) * rad * 0.18, z: Math.sin(a) * rad };
        p = rotX(p, ring.ax + ring.tilt);
        p = rotY(p, ring.ay + spin);
        pts.push(xf(p));
      }
      const alpha = 0.38 + (r % 2) * 0.16 + (state === "listen" ? 0.2 : 0);
      drawPolyline(pts, `rgba(90, 210, 255, ${alpha})`, 1.35 + (r === 0 ? 0.8 : 0));
      drawPolyline(pts, `rgba(210, 248, 255, ${alpha * 0.42})`, 0.5);
    }

    for (const s of sparks) {
      s.theta += s.speed * 0.016 * (state === "idle" ? 0.85 : 1.6);
      if (s.band) s.phi = Math.PI / 2 + Math.sin(t * 0.6 + s.trail) * 0.18;
      s.trail += 0.05;
      const show = Math.sin(s.trail + t) * 0.5 + 0.5;
      if (state === "idle" && show < 0.28 && !s.band) continue;
      const p = xf(sph(s.theta, s.phi, s.orbit * ringTight));
      const glow = (0.4 + show * 0.7) * p.a * Math.min(1, sparkAmt + 0.25);
      ctx.fillStyle = `rgba(180, 240, 255, ${Math.min(0.98, glow)})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, s.size * (0.75 + show), 0, Math.PI * 2);
      ctx.fill();
      const back = xf(sph(s.theta - 0.32, s.phi, s.orbit * ringTight));
      const mid = xf(sph(s.theta - 0.16, s.phi, s.orbit * ringTight));
      ctx.strokeStyle = `rgba(70, 190, 255, ${glow * 0.55})`;
      ctx.lineWidth = s.size * 0.85;
      ctx.beginPath();
      ctx.moveTo(back.x, back.y);
      ctx.lineTo(mid.x, mid.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }

    ctx.globalCompositeOperation = "source-over";
    const vig = ctx.createRadialGradient(cx, cy, baseR * 0.8, cx, cy, Math.max(w, h) * 0.7);
    vig.addColorStop(0, "rgba(0,0,0,0)");
    vig.addColorStop(1, "rgba(2, 4, 8, 0.55)");
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, w, h);

    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);

  window.orbSetState = setState;
  window.orbSetLevel = setLevel;
})();
