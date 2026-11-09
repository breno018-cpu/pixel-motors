import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import defaultBridgeImg from '@/assets/bridge-dither.png';

type Dot = {
  x: number;
  y: number;
  baseX: number;
  baseY: number;
  vx: number;
  vy: number;
  radius: number;
};

type DitherFieldProps = {
  src?: string;
  className?: string;
  cellSize?: number;
  disturbRadius?: number;
  threshold?: number;
  ink?: string;
  accent?: string;
  onReady?: () => void;
};

/**
 * Authentic Halftone Dither Field (San Francisco Bay Bridge & Skyline):
 * Renders the full-screen artwork using circular halftone micro-dots in pure black (#000000).
 * No cubes or squares: authentic round halftone screening.
 * When the pointer moves, dots near the cursor are pushed away with spring physics
 * and dynamically illuminate in brand red (#ED1C24).
 */
export function DitherField({
  src = defaultBridgeImg,
  className,
  cellSize = 4,
  disturbRadius = 150,
  ink = '#000000',
  accent = '#ED1C24',
  onReady,
}: DitherFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = canvas?.parentElement;
    if (!canvas || !wrap) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    const restCtx = document.createElement('canvas').getContext('2d', { alpha: false });
    const sampleCtx = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
    if (!restCtx || !sampleCtx) return;

    const rest = restCtx.canvas;
    const sample = sampleCtx.canvas;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let dots: Dot[] = [];
    let raf = 0;
    let running = true;
    let frameReady = false;
    let readyFired = false;
    let dpr = 1;
    let width = 0;
    let height = 0;
    let pointerX = -9999;
    let pointerY = -9999;
    let targetX = -9999;
    let targetY = -9999;
    let hasPointer = false;

    const fireReady = () => {
      if (readyFired) return;
      readyFired = true;
      onReadyRef.current?.();
    };

    const blitRest = () => {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(rest, 0, 0);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const sizeSurfaces = () => {
      const rect = wrap.getBoundingClientRect();
      width = Math.max(1, Math.floor(rect.width));
      height = Math.max(1, Math.floor(rect.height));
      dpr = Math.min(window.devicePixelRatio || 1, 2);

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      rest.width = canvas.width;
      rest.height = canvas.height;
      sample.width = width;
      sample.height = height;
    };

    const rebuild = (img: HTMLImageElement) => {
      try {
        sizeSurfaces();
        const iw = img.naturalWidth || img.width;
        const ih = img.naturalHeight || img.height;
        if (!iw || !ih) return;

        // Cover the canvas width and height, anchored to the bottom
        const scale = Math.max(width / iw, height / ih) * 1.04;
        const drawW = iw * scale;
        const drawH = ih * scale;
        const dx = (width - drawW) / 2;
        const dy = height - drawH * 0.98;

        const step = Math.max(3, Math.round(cellSize));

        sampleCtx.setTransform(1, 0, 0, 1, 0, 0);
        sampleCtx.fillStyle = '#ffffff';
        sampleCtx.fillRect(0, 0, width, height);
        sampleCtx.imageSmoothingEnabled = true;
        sampleCtx.drawImage(img, dx, dy, drawW, drawH);

        // Soft white fade at the very bottom edge of the screen
        const bottomFade = sampleCtx.createLinearGradient(0, height * 0.82, 0, height);
        bottomFade.addColorStop(0, 'rgba(255,255,255,0)');
        bottomFade.addColorStop(0.7, 'rgba(255,255,255,0.7)');
        bottomFade.addColorStop(1, 'rgba(255,255,255,1)');
        sampleCtx.fillStyle = bottomFade;
        sampleCtx.fillRect(0, height * 0.82, width, height * 0.18);

        // Sample luminance into circular halftone dots
        let data: Uint8ClampedArray;
        try {
          data = sampleCtx.getImageData(0, 0, width, height).data;
        } catch {
          dots = [];
          return;
        }

        const next: Dot[] = [];
        const yStart = Math.max(0, Math.floor(dy));
        const yEnd = Math.min(height, Math.ceil(dy + drawH));

        for (let y = yStart; y < yEnd; y += step) {
          for (let x = 0; x < width; x += step) {
            let sum = 0;
            let count = 0;
            for (let oy = 0; oy < step; oy++) {
              for (let ox = 0; ox < step; ox++) {
                const ix = Math.min(width - 1, x + ox);
                const iy = Math.min(height - 1, y + oy);
                const i = (iy * width + ix) * 4;
                sum +=
                  0.2126 * (data[i] ?? 255) +
                  0.7152 * (data[i + 1] ?? 255) +
                  0.0722 * (data[i + 2] ?? 255);
                count++;
              }
            }

            const lum = sum / Math.max(1, count);
            if (lum > 244) continue; // Pure white background has no dot

            // Darkness drives circular dot radius (no cubes/squares!)
            const darkness = Math.max(0.08, 1 - lum / 255);
            // Light areas (sky) have delicate dots (~0.75px), dark structures have solid dots (~2.2px)
            const dotRadius = Math.max(0.7, darkness * (step * 0.58));

            const centerX = x + step / 2;
            const centerY = y + step / 2;

            next.push({
              x: centerX,
              y: centerY,
              baseX: centerX,
              baseY: centerY,
              vx: 0,
              vy: 0,
              radius: dotRadius,
            });
          }
        }

        dots = next;

        // Render rest surface with 100% PURE BLACK CIRCLES (#000000)
        restCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
        restCtx.fillStyle = '#ffffff';
        restCtx.fillRect(0, 0, width, height);

        restCtx.fillStyle = ink; // Pure black #000000
        restCtx.beginPath();
        for (let i = 0; i < dots.length; i++) {
          const d = dots[i];
          restCtx.moveTo(d.baseX + d.radius, d.baseY);
          restCtx.arc(d.baseX, d.baseY, d.radius, 0, Math.PI * 2);
        }
        restCtx.fill();

        frameReady = true;
        blitRest();
        fireReady();
      } catch (error) {
        console.error('[DitherField] failed to build field', error);
        dots = [];
        frameReady = false;
      }
    };

    const syncPointer = (clientX: number, clientY: number) => {
      const rect = wrap.getBoundingClientRect();
      const inside =
        clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
      if (!inside) {
        hasPointer = false;
        targetX = -9999;
        targetY = -9999;
        return;
      }
      hasPointer = true;
      targetX = clientX - rect.left;
      targetY = clientY - rect.top;
    };

    const onPointerMove = (event: PointerEvent) => syncPointer(event.clientX, event.clientY);
    const onPointerLeaveWindow = () => {
      hasPointer = false;
      targetX = -9999;
      targetY = -9999;
    };

    const draw = () => {
      if (!running) return;
      raf = window.requestAnimationFrame(draw);
      if (!frameReady) return;

      pointerX += (targetX - pointerX) * (hasPointer ? 0.5 : 0.14);
      pointerY += (targetY - pointerY) * (hasPointer ? 0.5 : 0.14);

      blitRest();
      if (dots.length === 0) return;

      const radius = disturbRadius;
      const radiusSq = radius * radius;
      const affectSq = radius * 1.35 * (radius * 1.35);
      const voidRadius = Math.max(14, radius * 0.35);
      const active: Dot[] = [];

      for (let i = 0; i < dots.length; i++) {
        const dot = dots[i];
        const bdx = dot.baseX - pointerX;
        const bdy = dot.baseY - pointerY;
        const baseDistSq = bdx * bdx + bdy * bdy;
        const moving = Math.abs(dot.vx) + Math.abs(dot.vy) > 0.02;
        const near = hasPointer && baseDistSq < affectSq;

        if (!near && !moving) {
          if (dot.x !== dot.baseX || dot.y !== dot.baseY) {
            dot.x = dot.baseX;
            dot.y = dot.baseY;
            dot.vx = 0;
            dot.vy = 0;
          }
          continue;
        }

        let forceX = 0;
        let forceY = 0;

        if (hasPointer) {
          const pdx = dot.x - pointerX;
          const pdy = dot.y - pointerY;
          const distSq = pdx * pdx + pdy * pdy;
          if (distSq < radiusSq) {
            const dist = Math.sqrt(distSq) || 0.0001;
            const nx = pdx / dist;
            const ny = pdy / dist;
            const t = 1 - dist / radius;
            const falloff = t * t * (3 - 2 * t);
            const push = voidRadius + falloff * (radius * 0.65);
            const extra = Math.max(0, push - dist);

            forceX = nx * (extra + falloff * 30);
            forceY = ny * (extra + falloff * 30);

            if (dist < voidRadius) {
              dot.x = pointerX + nx * voidRadius;
              dot.y = pointerY + ny * voidRadius;
              forceX += nx * (voidRadius - dist) * 2.2;
              forceY += ny * (voidRadius - dist) * 2.2;
            }
          }
        }

        const ax = (dot.baseX + forceX - dot.x) * 0.2;
        const ay = (dot.baseY + forceY - dot.y) * 0.2;
        dot.vx = (dot.vx + ax) * 0.75;
        dot.vy = (dot.vy + ay) * 0.75;
        dot.x += dot.vx;
        dot.y += dot.vy;
        active.push(dot);
      }

      if (active.length === 0) return;

      // Clear circular white void around the cursor
      const clearPad = radius + voidRadius + 8;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(pointerX, pointerY, clearPad, 0, Math.PI * 2);
      ctx.fill();

      // Render repelled active dots around cursor as red circles (#ED1C24)
      ctx.fillStyle = accent; // Brand Red #ED1C24
      ctx.beginPath();
      for (let i = 0; i < active.length; i++) {
        const dot = active[i];
        ctx.moveTo(dot.x + dot.radius, dot.y);
        ctx.arc(dot.x, dot.y, dot.radius, 0, Math.PI * 2);
      }
      ctx.fill();
    };

    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      if (!running) return;
      rebuild(img);
      if (!reduced) raf = window.requestAnimationFrame(draw);
    };
    img.onerror = () => fireReady();
    img.src = src;

    const resizeObserver = new ResizeObserver(() => {
      if (img.complete && img.naturalWidth > 0) rebuild(img);
    });
    resizeObserver.observe(wrap);

    if (!reduced) {
      window.addEventListener('pointermove', onPointerMove, { passive: true });
      window.addEventListener('pointerdown', onPointerMove, { passive: true });
      window.addEventListener('blur', onPointerLeaveWindow);
      document.addEventListener('mouseleave', onPointerLeaveWindow);
    }

    return () => {
      running = false;
      window.cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerdown', onPointerMove);
      window.removeEventListener('blur', onPointerLeaveWindow);
      document.removeEventListener('mouseleave', onPointerLeaveWindow);
    };
  }, [src, cellSize, disturbRadius, ink, accent]);

  return <canvas ref={canvasRef} className={cn('absolute inset-0', className)} aria-hidden="true" />;
}
