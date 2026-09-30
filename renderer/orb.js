(() => {
  const canvas = document.getElementById("orb");
  const ctx = canvas.getContext("2d", { alpha: false });
  let state = "idle";
  let level = 0;
  let target = 0;
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

  function setState(next) {
    state = next;
    document.body.dataset.mode = next;
  }

  function setLevel(n) {
    target = Math.max(0, Math.min(1, n));
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
    let rotSpeed = 0.22;
    let sparkAmt = 0.35;
    let wave = 0;
    if (state === "idle") {
      target = 0.08 + 0.06 * Math.sin(t * 0.7);
      sparkAmt = 0.28;
    } else if (state === "listen") {
      ringTight = 0.72 + 0.04 * Math.sin(t * 6);
      rotSpeed = 0.55;
      sparkAmt = 0.55;
      target = 0.4 + 0.15 * Math.sin(t * 8);
    } else {
      ringTight = 1.04 + level * 0.08;
      rotSpeed = 0.85 + level * 0.7;
      sparkAmt = 0.75 + level * 0.4;
      wave = 0.55 + level * 1.1;
      target = Math.max(target, 0.35);
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

    for (let m = 0; m < meridians; m++) {
      const theta = (m / meridians) * Math.PI * 2;
      const pts = [];
      const n = 40;
      for (let i = 0; i <= n; i++) {
        const phi = (i / n) * Math.PI;
        const pr = xf(sph(theta, phi, ringTight));
        pts.push(pr);
        if (wave > 0.1) {
          const pulse = 0.5 + 0.5 * Math.sin(phi * 8 - t * 10 + m);
          if (i > 0 && pulse > 0.72) {
            ctx.strokeStyle = `rgba(140, 230, 255, ${0.18 * pulse * wave * pr.a})`;
            ctx.lineWidth = 2.4 * pulse * (0.6 + level);
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
