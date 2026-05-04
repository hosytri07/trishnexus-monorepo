'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

/**
 * Phase 35 — Landing "Coming Soon" với hiệu ứng tổng hợp:
 *  Layer 0: Starfield 280 sao + shooting star ngẫu nhiên (Effect 3)
 *  Layer 1: Nebula 3 vùng radial pulse — palette emerald + blue (Effect 3)
 *  Layer 2: Sphere 1800 particle xoay → morph "TrishTEAM" + mouse trail
 *           (Effect 1 + Effect 2)
 *  Layer 3: Vignette tối 4 góc (Effect 3)
 *  Layer 4: Warp ring nở mỗi khi qua phút mới + entrance load (Effect 3)
 *  Layer 10: UI overlay — badge, tagline, countdown, footer
 *
 * Countdown realtime đến 09:00 sáng 07/05/2026 GMT+7. Quá hạn → reload sau
 * 5s; middleware unlock site, redirect /coming-soon → /.
 */

const TARGET_ISO = '2026-05-07T09:00:00+07:00';
const TARGET_TS = new Date(TARGET_ISO).getTime();

function pad(n: number) {
  return n.toString().padStart(2, '0');
}

export default function ComingSoonPage() {
  const starfieldRef = useRef<HTMLCanvasElement | null>(null);
  const fxRef = useRef<HTMLCanvasElement | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const chimeCtxRef = useRef<AudioContext | null>(null);
  const chimeRef = useRef<(() => void) | null>(null);
  const [now, setNow] = useState<number | null>(null);
  const [warpKey, setWarpKey] = useState(0);
  const [audioOn, setAudioOn] = useState(false);

  // Countdown ticker
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const remaining = useMemo(() => {
    if (now === null) return null;
    const diff = Math.max(0, TARGET_TS - now);
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    return { days, hours, minutes, seconds, finished: diff === 0 };
  }, [now]);

  useEffect(() => {
    if (remaining?.finished) {
      const id = setTimeout(() => window.location.reload(), 5000);
      return () => clearTimeout(id);
    }
  }, [remaining?.finished]);

  // Trigger warp ring mỗi khi qua phút (giây = 0)
  useEffect(() => {
    if (remaining && remaining.seconds === 0 && !remaining.finished) {
      setWarpKey((k) => k + 1);
      // Chime sync với warp ring nếu audio bật
      chimeRef.current?.();
    }
  }, [remaining?.seconds, remaining?.finished]);

  // Entrance warp ring lúc mount
  useEffect(() => {
    const t = setTimeout(() => setWarpKey(1), 200);
    return () => clearTimeout(t);
  }, []);

  // ── Audio: <audio> loop "Moonlight Drive" + chime synth mỗi phút ─────
  useEffect(() => {
    const el = audioElRef.current;
    if (!el) return;

    if (audioOn) {
      // Fade-in nhẹ: bắt đầu vol 0 → 0.45 trong 2s
      el.volume = 0;
      el.currentTime = 0;
      const playP = el.play();
      if (playP && typeof playP.catch === 'function') {
        playP.catch(() => {
          // Autoplay block — user gesture đã có nên ít khi xảy ra
        });
      }
      let v = 0;
      const target = 0.45;
      const step = target / 40; // 40 ticks * 50ms = 2s
      const fadeId = setInterval(() => {
        v = Math.min(target, v + step);
        if (audioElRef.current) audioElRef.current.volume = v;
        if (v >= target) clearInterval(fadeId);
      }, 50);

      // Setup chime context (riêng, không liên quan audio file)
      const Ctx = (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext) as typeof AudioContext;
      if (Ctx && !chimeCtxRef.current) {
        chimeCtxRef.current = new Ctx();
      }
      chimeRef.current = () => {
        const c = chimeCtxRef.current;
        if (!c) return;
        const t0 = c.currentTime;
        // Tone 1: 880Hz (A5)
        const osc1 = c.createOscillator();
        const g1 = c.createGain();
        osc1.type = 'sine';
        osc1.frequency.value = 880;
        osc1.connect(g1).connect(c.destination);
        g1.gain.setValueAtTime(0, t0);
        g1.gain.linearRampToValueAtTime(0.18, t0 + 0.01);
        g1.gain.exponentialRampToValueAtTime(0.001, t0 + 1.4);
        osc1.start(t0);
        osc1.stop(t0 + 1.5);
        // Tone 2: 1320Hz (E6) overtone
        const osc2 = c.createOscillator();
        const g2 = c.createGain();
        osc2.type = 'sine';
        osc2.frequency.value = 1320;
        osc2.connect(g2).connect(c.destination);
        g2.gain.setValueAtTime(0, t0);
        g2.gain.linearRampToValueAtTime(0.08, t0 + 0.01);
        g2.gain.exponentialRampToValueAtTime(0.001, t0 + 0.9);
        osc2.start(t0);
        osc2.stop(t0 + 1.0);
      };

      return () => {
        clearInterval(fadeId);
      };
    } else {
      // Tắt: fade-out 0.6s rồi pause
      const startVol = el.volume;
      let v = startVol;
      const fadeId = setInterval(() => {
        v = Math.max(0, v - startVol / 12);
        if (audioElRef.current) audioElRef.current.volume = v;
        if (v <= 0) {
          clearInterval(fadeId);
          if (audioElRef.current) audioElRef.current.pause();
        }
      }, 50);
      chimeRef.current = null;
      return () => {
        clearInterval(fadeId);
      };
    }
  }, [audioOn]);

  // Cleanup chime context khi unmount
  useEffect(() => {
    return () => {
      if (chimeCtxRef.current) {
        chimeCtxRef.current.close().catch(() => {});
        chimeCtxRef.current = null;
      }
    };
  }, []);

  // ── Layer 0: Starfield + shooting stars ──────────────────────────────
  useEffect(() => {
    const canvas = starfieldRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let W = 0;
    let H = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    type Star = {
      x: number;
      y: number;
      r: number;
      base: number;
      tw: number;
      twS: number;
      vy: number;
      col: string;
    };
    type Shooter = {
      x: number;
      y: number;
      len: number;
      speed: number;
      angle: number;
      life: number;
    };

    let stars: Star[] = [];
    let shooters: Shooter[] = [];

    function resize() {
      if (!canvas || !ctx) return;
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      canvas.style.width = W + 'px';
      canvas.style.height = H + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function init() {
      stars = Array.from({ length: 280 }, () => ({
        x: Math.random() * W,
        y: Math.random() * H,
        r: Math.random() * 1.5 + 0.1,
        base: Math.random() * 0.8 + 0.15,
        tw: Math.random() * Math.PI * 2,
        twS: Math.random() * 0.018 + 0.003,
        vy: Math.random() * 0.1 + 0.02,
        // 10% sao có màu emerald soft, còn lại trắng
        col: Math.random() < 0.1 ? '#a7f3d0' : '#ffffff',
      }));
    }

    function shoot() {
      shooters.push({
        x: Math.random() * W * 0.7 + W * 0.15,
        y: Math.random() * H * 0.4,
        len: 80 + Math.random() * 140,
        speed: 10 + Math.random() * 10,
        angle: Math.PI / 5,
        life: 1,
      });
    }

    let raf = 0;
    function draw() {
      raf = requestAnimationFrame(draw);
      if (!ctx) return;
      ctx.clearRect(0, 0, W, H);

      for (const s of stars) {
        s.tw += s.twS;
        ctx.globalAlpha = s.base * (0.35 + 0.65 * Math.abs(Math.sin(s.tw)));
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = s.col;
        ctx.fill();
        s.y += s.vy;
        if (s.y > H + 2) s.y = -2;
      }

      if (Math.random() < 0.004) shoot();
      shooters = shooters.filter((s) => s.life > 0);
      for (const s of shooters) {
        ctx.save();
        ctx.globalAlpha = s.life * 0.85;
        const g = ctx.createLinearGradient(
          s.x,
          s.y,
          s.x - s.len * Math.cos(s.angle),
          s.y - s.len * Math.sin(s.angle)
        );
        g.addColorStop(0, '#fff');
        g.addColorStop(0.5, 'rgba(167, 243, 208, 0.5)');
        g.addColorStop(1, 'transparent');
        ctx.strokeStyle = g;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(
          s.x - s.len * Math.cos(s.angle),
          s.y - s.len * Math.sin(s.angle)
        );
        ctx.stroke();
        ctx.restore();
        s.x += s.speed * Math.cos(s.angle);
        s.y += s.speed * Math.sin(s.angle);
        s.life -= 0.022;
      }
      ctx.globalAlpha = 1;
    }

    function onResize() {
      resize();
      init();
    }

    resize();
    init();
    raf = requestAnimationFrame(draw);
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  // ── Layer 2: Sphere particle + text morph + mouse trail ──────────────
  useEffect(() => {
    const canvas = fxRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let W = 0;
    let H = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    function resize() {
      if (!canvas || !ctx) return;
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      canvas.style.width = W + 'px';
      canvas.style.height = H + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener('resize', resize);

    const palette = [
      '#10b981',
      '#22c55e',
      '#34d399',
      '#4ade80',
      '#6ee7b7',
      '#86efac',
      '#a7f3d0',
    ];

    const NUM = 1500;

    function makeSphere(n: number) {
      const a: [number, number, number][] = [];
      for (let i = 0; i < n; i++) {
        const phi = Math.acos(1 - (2 * (i + 0.5)) / n);
        const th = Math.PI * (1 + Math.sqrt(5)) * i;
        a.push([
          Math.sin(phi) * Math.cos(th),
          Math.sin(phi) * Math.sin(th),
          Math.cos(phi),
        ]);
      }
      return a;
    }
    const spherePts = makeSphere(NUM);

    function sampleText(word: string, count: number) {
      const OW = 2000;
      const OH = 600;
      const oc = document.createElement('canvas');
      oc.width = OW;
      oc.height = OH;
      const c = oc.getContext('2d');
      if (!c) return [] as { wx: number; wy: number }[];

      let fs = 280;
      const fontFamily = `'Plus Jakarta Sans', system-ui, sans-serif`;
      c.font = `800 ${fs}px ${fontFamily}`;
      while (c.measureText(word).width > OW * 0.92 && fs > 40) {
        fs -= 4;
        c.font = `800 ${fs}px ${fontFamily}`;
      }

      c.clearRect(0, 0, OW, OH);
      c.fillStyle = '#fff';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(word, OW / 2, OH / 2);

      const data = c.getImageData(0, 0, OW, OH).data;

      const step = 4;
      const pool: [number, number][] = [];
      for (let y = 0; y < OH; y += step) {
        for (let x = 0; x < OW; x += step) {
          if (data[(y * OW + x) * 4 + 3] > 80) pool.push([x, y]);
        }
      }
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }

      let x0 = OW;
      let x1 = 0;
      let y0 = OH;
      let y1 = 0;
      for (const [x, y] of pool) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
      const tw = x1 - x0;
      const th = y1 - y0;

      const availW = W * 0.78;
      const availH = H * 0.32;
      const sc = Math.min(availW / tw, availH / th);
      const cx = W / 2;
      const cy = H * 0.38;

      return pool.slice(0, count).map(([x, y]) => ({
        wx: cx + (x - x0 - tw / 2) * sc,
        wy: cy + (y - y0 - th / 2) * sc,
      }));
    }

    type P = {
      x: number;
      y: number;
      hx: number;
      hy: number;
      hz: number;
      tx: number | null;
      ty: number | null;
      phase: number;
      spd: number;
      sz: number;
      color: string;
      prog: number;
      state: 'sphere' | 'morphing' | 'text';
    };

    const P: P[] = [];
    const sphereCenter = () => ({ cx: W / 2, cy: H * 0.38 });
    const sphereR = () => Math.min(W, H) * 0.2;

    for (let i = 0; i < NUM; i++) {
      const [hx, hy, hz] = spherePts[i];
      const { cx, cy } = sphereCenter();
      const R = sphereR();
      P.push({
        x: cx + hx * R,
        y: cy + hy * R,
        hx,
        hy,
        hz,
        tx: null,
        ty: null,
        phase: Math.random() * Math.PI * 2,
        spd: 0.5 + Math.random() * 0.7,
        sz: 0.7 + Math.random() * 1.4,
        color: palette[Math.floor(Math.random() * palette.length)],
        prog: 0,
        state: 'sphere',
      });
    }

    let ry = 0;
    let rx = 0.15;
    let mRY = 0;
    let mRX = 0;
    let cRY = 0;
    let cRX = 0;
    let textMode = false;
    let t = 0;

    type Trail = {
      x: number;
      y: number;
      size: number;
      sx: number;
      sy: number;
      color: string;
    };
    let trail: Trail[] = [];

    function onMove(e: MouseEvent) {
      if (!textMode) {
        mRY = (e.clientX / W - 0.5) * 0.55;
        mRX = (e.clientY / H - 0.5) * -0.28;
      }
      for (let i = 0; i < 4; i++) {
        const hue = 130 + Math.random() * 40;
        trail.push({
          x: e.clientX,
          y: e.clientY,
          size: Math.random() * 6 + 1,
          sx: Math.random() * 2.4 - 1.2,
          sy: Math.random() * 2.4 - 1.2,
          color: `hsl(${hue}, 80%, 60%)`,
        });
      }
    }
    document.addEventListener('mousemove', onMove);

    function proj(nx: number, ny: number, nz: number) {
      const cy = Math.cos(ry);
      const sy = Math.sin(ry);
      const x = nx * cy + nz * sy;
      const z = -nx * sy + nz * cy;
      const cx2 = Math.cos(rx);
      const sx2 = Math.sin(rx);
      const y2 = ny * cx2 - z * sx2;
      const z2 = ny * sx2 + z * cx2;
      const f = 2.2 / (2.2 + z2);
      const R = sphereR();
      const center = sphereCenter();
      return {
        sx: center.cx + x * R * f,
        sy: center.cy + y2 * R * f,
        sc: f,
      };
    }

    function ease(tt: number) {
      return tt < 0.5 ? 4 * tt * tt * tt : 1 - Math.pow(-2 * tt + 2, 3) / 2;
    }

    let raf = 0;
    function draw(ts: number) {
      raf = requestAnimationFrame(draw);
      if (!ctx) return;
      t = ts * 0.001;
      cRY += (mRY - cRY) * 0.05;
      cRX += (mRX - cRX) * 0.05;
      ry = t * 0.16 + cRY;
      rx = 0.15 + cRX;

      // Trail fade — bỏ lại vệt particle mờ dần
      ctx.fillStyle = 'rgba(5, 11, 21, 0.18)';
      ctx.fillRect(0, 0, W, H);

      // Glow nhẹ quanh sphere center
      const center = sphereCenter();
      const g = ctx.createRadialGradient(
        center.cx,
        center.cy,
        0,
        center.cx,
        center.cy,
        Math.min(W, H) * 0.42
      );
      g.addColorStop(0, 'rgba(16, 185, 129, 0.12)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);

      for (const p of P) {
        let px: number | null = null;
        let py: number | null = null;
        let alpha = 1;

        if (p.state === 'sphere') {
          const w = Math.sin(p.phase + t * p.spd) * 0.018;
          const { sx, sy, sc } = proj(p.hx * (1 + w), p.hy * (1 + w), p.hz);
          px = sx;
          py = sy;
          alpha = (0.3 + 0.7 * Math.abs(Math.sin(p.phase + t))) * sc;
        } else if (p.state === 'morphing') {
          p.prog = Math.min(1, p.prog + 0.02);
          if (p.prog < 0) {
            px = null;
          } else {
            const e = ease(Math.max(0, p.prog));
            const { sx, sy } = proj(p.hx, p.hy, p.hz);
            px = sx + ((p.tx ?? sx) - sx) * e;
            py = sy + ((p.ty ?? sy) - sy) * e;
            p.x = px;
            p.y = py;
            alpha = 0.35 + 0.65 * Math.max(0, p.prog);
            if (p.prog >= 1) p.state = 'text';
          }
        } else {
          px = p.x + Math.sin(p.phase + t * p.spd) * 0.9;
          py = p.y + Math.cos(p.phase + t * p.spd * 0.9) * 0.9;
          alpha = 0.55 + 0.45 * Math.abs(Math.sin(p.phase + t * 0.6));
        }

        if (px === null || py === null) continue;
        const sz = p.sz * (0.9 + 0.12 * Math.sin(p.phase + t));
        ctx.save();
        ctx.globalAlpha = Math.min(1, alpha * 0.55);
        const gr = ctx.createRadialGradient(px, py, 0, px, py, sz * 4);
        gr.addColorStop(0, p.color);
        gr.addColorStop(1, 'transparent');
        ctx.fillStyle = gr;
        ctx.beginPath();
        ctx.arc(px, py, sz * 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = Math.min(1, alpha);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(px, py, sz, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Mouse trail
      for (let i = trail.length - 1; i >= 0; i--) {
        const tp = trail[i];
        tp.x += tp.sx;
        tp.y += tp.sy;
        if (tp.size > 0.2) tp.size -= 0.12;
        ctx.fillStyle = tp.color;
        ctx.beginPath();
        ctx.arc(tp.x, tp.y, tp.size, 0, Math.PI * 2);
        ctx.fill();
        if (tp.size <= 0.3) trail.splice(i, 1);
      }
    }
    raf = requestAnimationFrame(draw);

    const morphTimer = setTimeout(() => {
      const targets = sampleText('TrishTEAM', NUM);
      textMode = true;
      for (let i = 0; i < NUM; i++) {
        const p = P[i];
        if (i < targets.length) {
          p.tx = targets[i].wx;
          p.ty = targets[i].wy;
          p.prog = -(i / NUM) * 0.45;
          p.state = 'morphing';
        } else {
          p.state = 'sphere';
        }
      }
    }, 800);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      document.removeEventListener('mousemove', onMove);
      clearTimeout(morphTimer);
    };
  }, []);

  return (
    <div className="coming-soon-root">
      <style jsx global>{`
        html,
        body {
          margin: 0;
          padding: 0;
          background: #050b15;
          color: #e8efff;
          min-height: 100vh;
          overflow: hidden;
        }
        * {
          box-sizing: border-box;
        }
      `}</style>

      <style jsx>{`
        .coming-soon-root {
          position: fixed;
          inset: 0;
          width: 100%;
          height: 100vh;
          overflow: hidden;
          background: #050b15;
        }

        /* Layer 0: starfield canvas */
        canvas.starfield {
          position: fixed;
          inset: 0;
          z-index: 0;
          pointer-events: none;
        }

        /* Layer 1: nebula */
        .nebula {
          position: fixed;
          inset: 0;
          z-index: 1;
          pointer-events: none;
          background:
            radial-gradient(
              ellipse 60% 45% at 15% 25%,
              rgba(16, 185, 129, 0.16) 0%,
              transparent 65%
            ),
            radial-gradient(
              ellipse 50% 55% at 85% 75%,
              rgba(59, 130, 246, 0.12) 0%,
              transparent 65%
            ),
            radial-gradient(
              ellipse 35% 25% at 55% 5%,
              rgba(74, 222, 128, 0.12) 0%,
              transparent 60%
            );
          animation: nebPulse 14s ease-in-out infinite alternate;
        }
        @keyframes nebPulse {
          from { opacity: 0.55; }
          to { opacity: 1; }
        }

        /* Layer 2: fx canvas (sphere + trail) */
        canvas.fx {
          position: fixed;
          inset: 0;
          z-index: 2;
          pointer-events: none;
        }

        /* Layer 3: vignette */
        .vignette {
          position: fixed;
          inset: 0;
          z-index: 3;
          pointer-events: none;
          background: radial-gradient(
            ellipse 75% 75% at 50% 50%,
            transparent 45%,
            rgba(5, 0, 15, 0.85) 100%
          );
        }

        /* Layer 4: warp ring */
        .warp-ring {
          position: fixed;
          z-index: 4;
          left: 50%;
          top: 50%;
          width: 0;
          height: 0;
          transform: translate(-50%, -50%);
          border-radius: 50%;
          border: 2px solid rgba(74, 222, 128, 0.85);
          box-shadow:
            0 0 24px rgba(74, 222, 128, 0.55),
            inset 0 0 24px rgba(74, 222, 128, 0.35);
          opacity: 0;
          pointer-events: none;
          animation: warpExpand 0.9s ease-out forwards;
        }
        @keyframes warpExpand {
          from {
            width: 0;
            height: 0;
            opacity: 0.9;
            border-width: 3px;
          }
          to {
            width: 120vmax;
            height: 120vmax;
            opacity: 0;
            border-width: 0.5px;
          }
        }

        /* Layer 10: UI overlay */
        .overlay {
          position: fixed;
          inset: 0;
          z-index: 10;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 40px 20px 32px;
          pointer-events: none;
          overflow-y: auto;
        }
        .overlay > * {
          pointer-events: auto;
        }

        .badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 6px 14px;
          border-radius: 999px;
          background: rgba(16, 185, 129, 0.12);
          border: 1px solid rgba(74, 222, 128, 0.35);
          color: #4ade80;
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          backdrop-filter: blur(12px);
          margin-top: 8px;
          animation: badgeIn 0.9s ease-out 0.2s both;
        }
        .badge .dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #4ade80;
          box-shadow: 0 0 12px #4ade80;
          animation: pulse 1.6s ease-in-out infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.8); }
        }
        @keyframes badgeIn {
          from { opacity: 0; transform: translateY(-12px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .sphere-spacer {
          flex: 1 1 auto;
          min-height: clamp(280px, 42vh, 460px);
        }

        .tagline {
          font-size: clamp(14px, 1.6vw, 17px);
          color: rgba(232, 239, 255, 0.72);
          line-height: 1.6;
          max-width: 580px;
          text-align: center;
          margin: 0 0 28px;
          padding: 0 12px;
          animation: fadeUp 1.2s ease-out 0.7s both;
        }

        .countdown {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
          width: 100%;
          max-width: 640px;
          margin: 0 auto 24px;
          animation: fadeUp 1.2s ease-out 1s both;
        }
        @media (max-width: 520px) {
          .countdown { gap: 8px; }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .cd-box {
          background: rgba(11, 22, 38, 0.7);
          border: 1px solid rgba(74, 222, 128, 0.18);
          border-radius: 18px;
          padding: 18px 12px 14px;
          backdrop-filter: blur(14px);
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
          text-align: center;
          transition: transform 250ms ease-out, border-color 250ms ease-out;
        }
        .cd-box:hover {
          transform: translateY(-2px);
          border-color: rgba(74, 222, 128, 0.5);
        }

        .cd-num {
          font-size: clamp(28px, 6vw, 48px);
          font-weight: 700;
          color: #ffffff;
          font-variant-numeric: tabular-nums;
          letter-spacing: -0.02em;
          line-height: 1;
        }
        .cd-label {
          font-size: 10px;
          color: rgba(232, 239, 255, 0.55);
          text-transform: uppercase;
          letter-spacing: 0.12em;
          font-weight: 600;
          margin-top: 8px;
        }

        .target-line {
          font-size: 13px;
          color: rgba(232, 239, 255, 0.6);
          letter-spacing: 0.04em;
          text-align: center;
          animation: fadeUp 1.2s ease-out 1.2s both;
        }
        .target-line strong {
          color: #4ade80;
          font-weight: 600;
        }

        .footer {
          margin-top: 18px;
          font-size: 11px;
          color: rgba(232, 239, 255, 0.35);
          letter-spacing: 0.08em;
          animation: fadeUp 1.2s ease-out 1.4s both;
          text-align: center;
          padding: 0 12px;
        }
        .footer .music-credit a {
          color: rgba(74, 222, 128, 0.6);
          text-decoration: none;
          transition: color 0.2s;
        }
        .footer .music-credit a:hover {
          color: #4ade80;
        }

        .finished {
          color: #4ade80;
          font-size: clamp(20px, 3vw, 28px);
          font-weight: 700;
          margin: 16px 0;
          text-align: center;
        }

        /* Audio toggle góc trên phải */
        .audio-toggle {
          position: fixed;
          top: 24px;
          right: 24px;
          z-index: 11;
          width: 44px;
          height: 44px;
          border-radius: 50%;
          border: 1px solid rgba(74, 222, 128, 0.35);
          background: rgba(11, 22, 38, 0.7);
          backdrop-filter: blur(12px);
          color: #4ade80;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          transition: all 0.25s ease-out;
          padding: 0;
          animation: fadeUp 1s ease-out 0.4s both;
        }
        .audio-toggle:hover {
          border-color: rgba(74, 222, 128, 0.7);
          box-shadow: 0 0 20px rgba(74, 222, 128, 0.35);
          transform: scale(1.06);
        }
        .audio-toggle:active {
          transform: scale(0.94);
        }
        .audio-toggle.on {
          background: rgba(16, 185, 129, 0.18);
          border-color: rgba(74, 222, 128, 0.7);
          box-shadow: 0 0 20px rgba(74, 222, 128, 0.4);
        }
        .audio-toggle svg {
          width: 18px;
          height: 18px;
        }
        .audio-hint {
          position: fixed;
          top: 76px;
          right: 24px;
          z-index: 11;
          font-size: 10px;
          color: rgba(232, 239, 255, 0.45);
          letter-spacing: 0.08em;
          text-transform: uppercase;
          background: rgba(11, 22, 38, 0.6);
          backdrop-filter: blur(8px);
          padding: 4px 10px;
          border-radius: 6px;
          pointer-events: none;
          animation: hintFade 5s ease-out 1s forwards;
          opacity: 0;
        }
        @keyframes hintFade {
          0% { opacity: 0; transform: translateY(-4px); }
          15% { opacity: 1; transform: translateY(0); }
          80% { opacity: 1; }
          100% { opacity: 0; }
        }
      `}</style>

      <canvas ref={starfieldRef} className="starfield" aria-hidden />
      <div className="nebula" aria-hidden />
      <canvas ref={fxRef} className="fx" aria-hidden />
      <div className="vignette" aria-hidden />

      <audio
        ref={audioElRef}
        src="/audio/moonlight-drive.mp3"
        loop
        preload="auto"
        aria-hidden
      />

      {warpKey > 0 && (
        <div key={warpKey} className="warp-ring" aria-hidden />
      )}

      <button
        type="button"
        className={`audio-toggle ${audioOn ? 'on' : ''}`}
        onClick={() => setAudioOn((v) => !v)}
        aria-label={audioOn ? 'Tắt nhạc nền' : 'Bật nhạc nền'}
        title={audioOn ? 'Tắt nhạc nền' : 'Bật nhạc nền'}
      >
        {audioOn ? (
          // speaker on
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" />
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
          </svg>
        ) : (
          // speaker off
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" />
            <line x1="22" y1="9" x2="16" y2="15" />
            <line x1="16" y1="9" x2="22" y2="15" />
          </svg>
        )}
      </button>
      {!audioOn && <div className="audio-hint">Bật nhạc nền</div>}

      <div className="overlay">
        <div className="badge">
          <span className="dot" />
          <span>Sắp ra mắt</span>
        </div>

        <div className="sphere-spacer" aria-hidden />

        <p className="tagline">
          Hệ sinh thái phần mềm + tri thức cho kỹ sư xây dựng và giao thông
          Việt Nam. Chúng tôi đang hoàn thiện những công đoạn cuối cùng.
        </p>

        {remaining === null ? (
          <div className="countdown" aria-hidden>
            <div className="cd-box"><div className="cd-num">--</div><div className="cd-label">Ngày</div></div>
            <div className="cd-box"><div className="cd-num">--</div><div className="cd-label">Giờ</div></div>
            <div className="cd-box"><div className="cd-num">--</div><div className="cd-label">Phút</div></div>
            <div className="cd-box"><div className="cd-num">--</div><div className="cd-label">Giây</div></div>
          </div>
        ) : remaining.finished ? (
          <div className="finished">Đang khởi động hệ thống…</div>
        ) : (
          <div className="countdown">
            <div className="cd-box">
              <div className="cd-num">{pad(remaining.days)}</div>
              <div className="cd-label">Ngày</div>
            </div>
            <div className="cd-box">
              <div className="cd-num">{pad(remaining.hours)}</div>
              <div className="cd-label">Giờ</div>
            </div>
            <div className="cd-box">
              <div className="cd-num">{pad(remaining.minutes)}</div>
              <div className="cd-label">Phút</div>
            </div>
            <div className="cd-box">
              <div className="cd-num">{pad(remaining.seconds)}</div>
              <div className="cd-label">Giây</div>
            </div>
          </div>
        )}

        <div className="target-line">
          Ra mắt vào <strong>09:00 sáng Thứ Năm, 07/05/2026</strong> (giờ Việt Nam)
        </div>

        <div className="footer">
          © 2026 TrishTEAM · trishteam.io.vn
          <span className="music-credit">
            {' · '}Music: <a href="https://www.bensound.com" target="_blank" rel="noopener noreferrer">Moonlight Drive — Bensound</a>
          </span>
        </div>
      </div>
    </div>
  );
}
