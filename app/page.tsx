"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import Matter from "matter-js";

// ===================== Game Constants =====================
const CANVAS_W = 400;
const CANVAS_H = 720;
const CLOUD_STRIP_H = 120; // y=0..120 reserved for cloud area above container
const CONTAINER_TOP = CLOUD_STRIP_H; // top of physics container interior
const CONTAINER_BOTTOM = CANVAS_H; // bottom of physics container interior (cosmetic frame ends earlier)
const DEATH_LINE_Y = CONTAINER_TOP + 36; // if a settled fruit's center is above this for too long, game over
const DEATH_GRACE = 1.8; // seconds above the line before triggering game over
const MAX_DROP_LEVEL = 5; // levels 0..4 may spawn from the cloud

// ===================== Fruit Definitions =====================
type FruitDef = {
  level: number;
  name: string;
  radius: number;
  color: string;
  highlight: string;
  outline: string;
  decoration?: "stem" | "leaf" | "stripes" | "spots" | "pineapple";
};

const FRUITS: FruitDef[] = [
  { level: 0,  name: "Cherry",     radius: 18,  color: "#ff5c6e", highlight: "#ffb1bb", outline: "#a31b30", decoration: "stem" },
  { level: 1,  name: "Strawberry", radius: 24,  color: "#ff3a4f", highlight: "#ffaab4", outline: "#9c1929", decoration: "spots" },
  { level: 2,  name: "Grape",      radius: 32,  color: "#a063e8", highlight: "#d6b3ff", outline: "#5a2da8", decoration: "leaf" },
  { level: 3,  name: "Lemon",      radius: 40,  color: "#ffd83d", highlight: "#fff7b3", outline: "#b88a00", decoration: "leaf" },
  { level: 4,  name: "Orange",     radius: 50,  color: "#ff9234", highlight: "#ffd2a5", outline: "#a85700", decoration: "leaf" },
  { level: 5,  name: "Apple",      radius: 60,  color: "#ff5a45", highlight: "#ffb6a6", outline: "#9b1d10", decoration: "leaf" },
  { level: 6,  name: "Peach",      radius: 72,  color: "#ffb3c1", highlight: "#ffe1e7", outline: "#cc6f86", decoration: "leaf" },
  { level: 7,  name: "Pineapple",  radius: 86,  color: "#ffd84a", highlight: "#fff1a6", outline: "#a87a00", decoration: "pineapple" },
  { level: 8,  name: "Melon",      radius: 100, color: "#a8e063", highlight: "#dcf2b3", outline: "#558a2a", decoration: "leaf" },
  { level: 9,  name: "Watermelon", radius: 116, color: "#3ec06b", highlight: "#a4e5be", outline: "#1c5f33", decoration: "stripes" },
  { level: 10, name: "Mega Melon", radius: 132, color: "#ff7eb0", highlight: "#ffc7df", outline: "#a64178", decoration: "leaf" },
];

// ===================== Friends (static for leaderboard) =====================
const FRIENDS = [
  { name: "Mochi",   avatar: "🐰", score: 24850 },
  { name: "Yuki",    avatar: "🐱", score: 19320 },
  { name: "Pico",    avatar: "🐻", score: 14210 },
  { name: "Bubbles", avatar: "🦄", score: 9870 },
];

// ===================== Drawing Helpers =====================
// ===== Color helpers =====
function hexToRgba(hex: string, a: number): string {
  const c = hex.replace("#", "");
  const n = parseInt(c, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

// ===== Face primitives =====
type Ctx = CanvasRenderingContext2D;

function drawClosedEyes(ctx: Ctx, fy: number, sep: number, sz: number, color = "#2d1a0a") {
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(3, sz * 0.65);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(-sep, fy, sz, 1.05 * Math.PI, 1.95 * Math.PI);
  ctx.moveTo(sep + sz, fy);
  ctx.arc(sep, fy, sz, 1.05 * Math.PI, 1.95 * Math.PI);
  ctx.stroke();
}

function drawDotEyes(ctx: Ctx, fy: number, sep: number, sz: number, color = "#2d1a0a") {
  // Big black pupils
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(-sep, fy, sz * 1.0, sz * 1.18, 0, 0, Math.PI * 2);
  ctx.ellipse(sep, fy, sz * 1.0, sz * 1.18, 0, 0, Math.PI * 2);
  ctx.fill();
  // Big top sparkle (the kawaii signature)
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(-sep + sz * 0.32, fy - sz * 0.5, sz * 0.58, 0, Math.PI * 2);
  ctx.arc(sep + sz * 0.32, fy - sz * 0.5, sz * 0.58, 0, Math.PI * 2);
  ctx.fill();
  // Tiny lower sparkle
  ctx.beginPath();
  ctx.arc(-sep - sz * 0.4, fy + sz * 0.45, sz * 0.22, 0, Math.PI * 2);
  ctx.arc(sep - sz * 0.4, fy + sz * 0.45, sz * 0.22, 0, Math.PI * 2);
  ctx.fill();
}

function drawSquintyEyes(ctx: Ctx, fy: number, sep: number, sz: number, color = "#2d1a0a") {
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2.6, sz * 0.55);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(-sep - sz * 0.75, fy + sz * 0.55);
  ctx.lineTo(-sep, fy - sz * 0.3);
  ctx.lineTo(-sep + sz * 0.75, fy + sz * 0.55);
  ctx.moveTo(sep - sz * 0.75, fy + sz * 0.55);
  ctx.lineTo(sep, fy - sz * 0.3);
  ctx.lineTo(sep + sz * 0.75, fy + sz * 0.55);
  ctx.stroke();
}

function drawCheeks(ctx: Ctx, fy: number, sep: number, w: number, h: number) {
  // Outer soft glow
  ctx.fillStyle = "rgba(255, 110, 150, 0.35)";
  ctx.beginPath();
  ctx.ellipse(-sep, fy, w * 1.25, h * 1.25, 0, 0, Math.PI * 2);
  ctx.ellipse(sep, fy, w * 1.25, h * 1.25, 0, 0, Math.PI * 2);
  ctx.fill();
  // Bright inner blush
  ctx.fillStyle = "rgba(255, 105, 145, 0.85)";
  ctx.beginPath();
  ctx.ellipse(-sep, fy, w, h, 0, 0, Math.PI * 2);
  ctx.ellipse(sep, fy, w, h, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawSmile(ctx: Ctx, fy: number, w: number, color = "#2d1a0a") {
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2.2, w * 0.26);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(0, fy, w, 0.18 * Math.PI, 0.82 * Math.PI);
  ctx.stroke();
}

function drawTongueMouth(ctx: Ctx, fy: number, w: number) {
  // Mouth interior (dark)
  ctx.fillStyle = "#2d1a0a";
  ctx.beginPath();
  ctx.ellipse(0, fy, w * 0.78, w * 0.55, 0, 0, Math.PI);
  ctx.fill();
  // Outline
  ctx.strokeStyle = "#2d1a0a";
  ctx.lineWidth = Math.max(2, w * 0.12);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-w * 0.78, fy);
  ctx.lineTo(w * 0.78, fy);
  ctx.stroke();
  // Pink tongue
  ctx.fillStyle = "#ff5e95";
  ctx.beginPath();
  ctx.ellipse(0, fy + w * 0.2, w * 0.5, w * 0.32, 0, 0, Math.PI);
  ctx.fill();
  // Tongue highlight
  ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
  ctx.beginPath();
  ctx.ellipse(-w * 0.1, fy + w * 0.22, w * 0.18, w * 0.08, 0, 0, Math.PI);
  ctx.fill();
}

function drawHighlight(ctx: Ctx, x: number, y: number, rx: number, ry: number) {
  // Big chunky main highlight
  ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, -0.55, 0, Math.PI * 2);
  ctx.fill();
  // Brighter inner core
  ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
  ctx.beginPath();
  ctx.ellipse(x + rx * 0.1, y - ry * 0.15, rx * 0.55, ry * 0.5, -0.55, 0, Math.PI * 2);
  ctx.fill();
  // Tiny separate sparkle
  ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
  ctx.beginPath();
  ctx.ellipse(x + rx * 0.9, y - ry * 1.3, rx * 0.3, ry * 0.4, -0.55, 0, Math.PI * 2);
  ctx.fill();
}

function drawAura(ctx: Ctx, r: number, color: string) {
  const grad = ctx.createRadialGradient(0, 0, r * 0.6, 0, 0, r * 1.5);
  grad.addColorStop(0, hexToRgba(color, 0.4));
  grad.addColorStop(0.6, hexToRgba(color, 0.18));
  grad.addColorStop(1, hexToRgba(color, 0));
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, 0, r * 1.5, 0, Math.PI * 2);
  ctx.fill();
}

// ============== Cat face (used for ALL fruits) ==============
// A white kawaii cat poking out of the fruit "costume": rounded white face
// with two ears (with pink inner triangles), closed-happy eyes, pink cheeks,
// tiny W mouth, and two paws sticking out of the bottom edges of the fruit.
function drawCatFace(ctx: Ctx, r: number, _f: FruitDef) {
  const dark = "#1a1208";
  const white = "#ffffff";
  const blush = "#ff8fb3";
  const innerEar = "#ffafc4";

  // ===== Two paws at bottom edges of the fruit =====
  for (const sx of [-1, 1]) {
    // Dark outline
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.ellipse(sx * r * 0.82, r * 0.72, r * 0.18, r * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();
    // White fill
    ctx.fillStyle = white;
    ctx.beginPath();
    ctx.ellipse(sx * r * 0.82, r * 0.72, r * 0.14, r * 0.085, 0, 0, Math.PI * 2);
    ctx.fill();
    // Toe dots (3 little black bean toes)
    ctx.fillStyle = dark;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.arc(sx * r * 0.82 + i * r * 0.05, r * 0.685, Math.max(1, r * 0.018), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ===== Cat face shape: white rounded body + 2 triangle ears =====
  const cy = r * 0.18; // slightly below fruit center
  const fw = r * 0.5; // half-width of face
  const fh = r * 0.4; // half-height of face
  const eh = r * 0.24; // ear height
  const ew = r * 0.13; // ear half-base width
  const eSep = r * 0.3; // ear center distance from middle

  function buildPath(scale: number) {
    const fw1 = fw * scale,
      fh1 = fh * scale,
      eh1 = eh * scale,
      ew1 = ew * scale,
      eSep1 = eSep * scale;
    ctx.beginPath();
    // Top-left of face
    ctx.moveTo(-fw1, cy - fh1 * 0.4);
    // Up to outer base of left ear
    ctx.lineTo(-eSep1 - ew1, cy - fh1);
    // Up to left ear tip
    ctx.lineTo(-eSep1, cy - fh1 - eh1);
    // Down to inner base of left ear
    ctx.lineTo(-eSep1 + ew1, cy - fh1);
    // Across to inner base of right ear
    ctx.lineTo(eSep1 - ew1, cy - fh1);
    // Up to right ear tip
    ctx.lineTo(eSep1, cy - fh1 - eh1);
    // Down to outer base of right ear
    ctx.lineTo(eSep1 + ew1, cy - fh1);
    // Down to top-right of face
    ctx.lineTo(fw1, cy - fh1 * 0.4);
    // Curve around the rounded chin
    ctx.bezierCurveTo(
      fw1 * 1.05, cy + fh1 * 0.6,
      fw1 * 0.65, cy + fh1 * 1.18,
      0, cy + fh1 * 1.18,
    );
    ctx.bezierCurveTo(
      -fw1 * 0.65, cy + fh1 * 1.18,
      -fw1 * 1.05, cy + fh1 * 0.6,
      -fw1, cy - fh1 * 0.4,
    );
    ctx.closePath();
  }

  // Dark outline (slightly enlarged silhouette)
  buildPath(1.08);
  ctx.fillStyle = dark;
  ctx.fill();
  // White face
  buildPath(1.0);
  ctx.fillStyle = white;
  ctx.fill();

  // ===== Pink inner ear triangles =====
  ctx.fillStyle = innerEar;
  // Left ear
  ctx.beginPath();
  ctx.moveTo(-eSep - ew * 0.55, cy - fh * 0.95);
  ctx.lineTo(-eSep, cy - fh - eh * 0.65);
  ctx.lineTo(-eSep + ew * 0.55, cy - fh * 0.95);
  ctx.closePath();
  ctx.fill();
  // Right ear
  ctx.beginPath();
  ctx.moveTo(eSep - ew * 0.55, cy - fh * 0.95);
  ctx.lineTo(eSep, cy - fh - eh * 0.65);
  ctx.lineTo(eSep + ew * 0.55, cy - fh * 0.95);
  ctx.closePath();
  ctx.fill();

  // ===== Closed-happy eyes (⌒ ⌒) =====
  const eyeY = cy - r * 0.04;
  const eyeSep = r * 0.18;
  const eyeR = Math.max(2, r * 0.085);
  ctx.strokeStyle = dark;
  ctx.lineWidth = Math.max(2.5, r * 0.06);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(-eyeSep, eyeY, eyeR, 1.1 * Math.PI, 1.9 * Math.PI);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(eyeSep, eyeY, eyeR, 1.1 * Math.PI, 1.9 * Math.PI);
  ctx.stroke();

  // ===== Pink blush cheeks =====
  ctx.fillStyle = blush;
  ctx.beginPath();
  ctx.ellipse(-r * 0.28, cy + r * 0.08, r * 0.07, r * 0.045, 0, 0, Math.PI * 2);
  ctx.ellipse(r * 0.28, cy + r * 0.08, r * 0.07, r * 0.045, 0, 0, Math.PI * 2);
  ctx.fill();

  // ===== Tiny W mouth =====
  ctx.strokeStyle = dark;
  ctx.lineWidth = Math.max(2, r * 0.04);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  // Vertical line down
  ctx.beginPath();
  ctx.moveTo(0, cy + r * 0.05);
  ctx.lineTo(0, cy + r * 0.1);
  ctx.stroke();
  // Two arcs forming a tiny W
  ctx.beginPath();
  ctx.arc(-r * 0.04, cy + r * 0.1, r * 0.04, 0, Math.PI);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(r * 0.04, cy + r * 0.1, r * 0.04, 0, Math.PI);
  ctx.stroke();
}

// Decorative kawaii sparkles around the fruit
function drawSparkles(ctx: Ctx, r: number) {
  ctx.save();
  const positions: [number, number, number][] = [
    [-r * 1.1, -r * 0.85, r * 0.09],
    [r * 1.15, r * 0.4, r * 0.07],
    [r * 0.8, -r * 1.05, r * 0.06],
  ];
  for (const [px, py, sz] of positions) {
    ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
    ctx.beginPath();
    ctx.moveTo(px, py - sz);
    ctx.lineTo(px + sz * 0.25, py - sz * 0.25);
    ctx.lineTo(px + sz, py);
    ctx.lineTo(px + sz * 0.25, py + sz * 0.25);
    ctx.lineTo(px, py + sz);
    ctx.lineTo(px - sz * 0.25, py + sz * 0.25);
    ctx.lineTo(px - sz, py);
    ctx.lineTo(px - sz * 0.25, py - sz * 0.25);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

// Quantized hard-edge fill for that pixel-art "sharp shading" look
function fillRoundBody(ctx: Ctx, r: number, f: FruitDef) {
  // Thick dark outline
  ctx.fillStyle = f.outline;
  ctx.beginPath();
  ctx.arc(0, 0, r + 3, 0, Math.PI * 2);
  ctx.fill();
  // Inner darker ring (pixel-art secondary outline)
  ctx.fillStyle = shade(f.outline, -0.1);
  ctx.beginPath();
  ctx.arc(0, 0, r + 1.5, 0, Math.PI * 2);
  ctx.fill();
  // Main body — solid mid color
  ctx.fillStyle = f.color;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  // Bottom shadow band — hard-edge "pixel-shading" crescent
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = shade(f.color, -0.22);
  ctx.beginPath();
  ctx.ellipse(r * 0.15, r * 0.45, r * 1.0, r * 0.7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // Top highlight band — bright crescent
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = f.highlight;
  ctx.beginPath();
  ctx.ellipse(-r * 0.18, -r * 0.45, r * 0.85, r * 0.55, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawLeaf(ctx: Ctx, x: number, y: number, len: number, rot: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = "#5fa14a";
  ctx.strokeStyle = "#3d7a2c";
  ctx.lineWidth = Math.max(1, len * 0.07);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(len * 0.45, -len * 0.5, len * 0.95, -len * 0.2, len, len * 0.05);
  ctx.bezierCurveTo(len * 0.6, len * 0.2, len * 0.25, len * 0.15, 0, 0);
  ctx.fill();
  ctx.stroke();
  // vein
  ctx.strokeStyle = "#3d7a2c";
  ctx.lineWidth = Math.max(0.8, len * 0.04);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(len * 0.95, len * 0.02);
  ctx.stroke();
  ctx.restore();
}

// ===== Per-fruit drawers =====

function drawCherryArt(ctx: Ctx, r: number, f: FruitDef) {
  // Stem (thicker, with gradient)
  ctx.strokeStyle = "#5a2f0d";
  ctx.lineWidth = Math.max(3, r * 0.12);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(r * 0.05, -r * 0.9);
  ctx.quadraticCurveTo(r * 0.5, -r * 1.55, r * 0.85, -r * 1.3);
  ctx.stroke();
  ctx.strokeStyle = "#8a5a2a";
  ctx.lineWidth = Math.max(1.5, r * 0.06);
  ctx.beginPath();
  ctx.moveTo(r * 0.05, -r * 0.9);
  ctx.quadraticCurveTo(r * 0.5, -r * 1.55, r * 0.85, -r * 1.3);
  ctx.stroke();
  drawLeaf(ctx, r * 0.55, -r * 1.32, r * 0.5, 0.4);
  // Body
  fillRoundBody(ctx, r, f);
  drawHighlight(ctx, -r * 0.4, -r * 0.45, r * 0.3, r * 0.18);
  drawCatFace(ctx, r, f);
}

function drawStrawberryShape(ctx: Ctx, r: number, fillStyle: string | CanvasGradient) {
  ctx.fillStyle = fillStyle;
  ctx.beginPath();
  ctx.moveTo(0, r);
  ctx.bezierCurveTo(r * 1.05, r * 0.55, r * 1.1, -r * 0.4, r * 0.4, -r * 0.78);
  ctx.bezierCurveTo(r * 0.1, -r * 0.92, -r * 0.1, -r * 0.92, -r * 0.4, -r * 0.78);
  ctx.bezierCurveTo(-r * 1.1, -r * 0.4, -r * 1.05, r * 0.55, 0, r);
  ctx.fill();
}

function drawStrawberryArt(ctx: Ctx, r: number, f: FruitDef) {
  // Thick dark outline pad
  ctx.fillStyle = f.outline;
  ctx.beginPath();
  ctx.moveTo(0, r + 3);
  ctx.bezierCurveTo(r * 1.13, r * 0.55, r * 1.18, -r * 0.4, r * 0.43, -r * 0.85);
  ctx.bezierCurveTo(r * 0.1, -r * 0.99, -r * 0.1, -r * 0.99, -r * 0.43, -r * 0.85);
  ctx.bezierCurveTo(-r * 1.18, -r * 0.4, -r * 1.13, r * 0.55, 0, r + 3);
  ctx.fill();
  // Body
  drawStrawberryShape(ctx, r, f.color);
  // Top bright crescent (hard-edge highlight)
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(0, r * 0.95);
  ctx.bezierCurveTo(r * 1.05, r * 0.5, r * 1.1, -r * 0.4, r * 0.38, -r * 0.8);
  ctx.bezierCurveTo(r * 0.05, -r * 0.95, -r * 0.05, -r * 0.95, -r * 0.38, -r * 0.8);
  ctx.bezierCurveTo(-r * 1.1, -r * 0.4, -r * 1.05, r * 0.5, 0, r * 0.95);
  ctx.clip();
  ctx.fillStyle = f.highlight;
  ctx.beginPath();
  ctx.ellipse(-r * 0.15, -r * 0.6, r * 0.85, r * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();
  // Bottom hard shadow
  ctx.fillStyle = shade(f.color, -0.2);
  ctx.beginPath();
  ctx.ellipse(r * 0.1, r * 0.7, r * 0.95, r * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // Seeds
  ctx.fillStyle = "#fff2a8";
  ctx.strokeStyle = "rgba(155,80,30,0.35)";
  ctx.lineWidth = Math.max(0.6, r * 0.02);
  const seeds = [
    [-0.5, -0.3], [-0.15, -0.05], [0.25, -0.2], [0.55, 0.05], [-0.55, 0.2],
    [-0.2, 0.3], [0.2, 0.4], [0.55, 0.4], [-0.4, 0.55], [0.0, 0.6],
  ];
  for (const [sx, sy] of seeds) {
    const a = sx * 1.2;
    ctx.save();
    ctx.translate(sx * r, sy * r);
    ctx.rotate(a);
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.07, r * 0.11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
  // Crown sepals
  ctx.fillStyle = "#5fa14a";
  ctx.strokeStyle = "#3d7a2c";
  ctx.lineWidth = Math.max(1, r * 0.04);
  for (let i = -2; i <= 2; i++) {
    const a = i * 0.32;
    ctx.save();
    ctx.translate(0, -r * 0.78);
    ctx.rotate(a);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-r * 0.2, -r * 0.32);
    ctx.lineTo(0, -r * 0.5);
    ctx.lineTo(r * 0.2, -r * 0.32);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
  // Stem nub
  ctx.fillStyle = "#3d7a2c";
  ctx.beginPath();
  ctx.arc(0, -r * 0.78, r * 0.1, 0, Math.PI * 2);
  ctx.fill();
  // Big sparkle highlight
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.beginPath();
  ctx.ellipse(-r * 0.42, -r * 0.3, r * 0.22, r * 0.13, -0.55, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.beginPath();
  ctx.ellipse(-r * 0.4, -r * 0.32, r * 0.12, r * 0.07, -0.55, 0, Math.PI * 2);
  ctx.fill();
  // Cat face overlay
  drawCatFace(ctx, r, f);
}

function drawGrapeArt(ctx: Ctx, r: number, f: FruitDef) {
  // Stem
  ctx.strokeStyle = "#7a4316";
  ctx.lineWidth = Math.max(2, r * 0.07);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.85);
  ctx.lineTo(r * 0.05, -r * 0.6);
  ctx.stroke();
  // Leaf at top
  drawLeaf(ctx, r * 0.05, -r * 0.95, r * 0.55, 0.3);
  // Cluster of grapes (mound shape)
  const beads: [number, number, number][] = [
    [-r * 0.55, r * 0.55, r * 0.34],
    [0, r * 0.6, r * 0.36],
    [r * 0.55, r * 0.55, r * 0.34],
    [-r * 0.32, r * 0.15, r * 0.36],
    [r * 0.32, r * 0.15, r * 0.36],
    [0, r * 0.18, r * 0.4],
    [-r * 0.55, r * 0.05, r * 0.3],
    [r * 0.55, r * 0.05, r * 0.3],
    [-r * 0.22, -r * 0.32, r * 0.34],
    [r * 0.22, -r * 0.32, r * 0.34],
    [0, -r * 0.62, r * 0.3],
  ];
  // Sort back-to-front (top first)
  const sorted = [...beads].sort((a, b) => a[1] - b[1]);
  for (const [px, py, pr] of sorted) {
    // Thick outline
    ctx.fillStyle = f.outline;
    ctx.beginPath();
    ctx.arc(px, py, pr + 2, 0, Math.PI * 2);
    ctx.fill();
    // Solid color
    ctx.fillStyle = f.color;
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, Math.PI * 2);
    ctx.fill();
    // Hard shadow band
    ctx.save();
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = shade(f.color, -0.25);
    ctx.beginPath();
    ctx.ellipse(px + pr * 0.15, py + pr * 0.4, pr * 0.95, pr * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
    // Bright highlight band
    ctx.fillStyle = f.highlight;
    ctx.beginPath();
    ctx.ellipse(px - pr * 0.2, py - pr * 0.4, pr * 0.7, pr * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // Sparkle dot
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.beginPath();
    ctx.ellipse(px - pr * 0.3, py - pr * 0.45, pr * 0.18, pr * 0.1, -0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Cat face on the central front grape (slightly offset)
  ctx.save();
  ctx.translate(0, r * 0.05);
  drawCatFace(ctx, r * 0.85, f);
  ctx.restore();
}

function drawLemonArt(ctx: Ctx, r: number, f: FruitDef) {
  // Tiny stem
  ctx.fillStyle = "#7a4316";
  ctx.fillRect(-r * 0.05, -r * 1.0, r * 0.1, r * 0.12);
  drawLeaf(ctx, r * 0.05, -r * 0.95, r * 0.45, 0.35);
  // Body
  fillRoundBody(ctx, r, f);
  // Subtle pore texture
  ctx.fillStyle = hexToRgba("#b88a00", 0.18);
  for (let i = 0; i < 14; i++) {
    const a = i * 0.97;
    const dr = ((i * 13) % 10) / 10 * 0.5 + 0.2;
    const sx = Math.cos(a) * r * dr;
    const sy = Math.sin(a) * r * dr;
    ctx.beginPath();
    ctx.arc(sx, sy, r * 0.025, 0, Math.PI * 2);
    ctx.fill();
  }
  drawHighlight(ctx, -r * 0.4, -r * 0.45, r * 0.3, r * 0.18);
  drawCatFace(ctx, r, f);
}

function drawOrangeArt(ctx: Ctx, r: number, f: FruitDef) {
  // Stem
  ctx.fillStyle = "#7a4316";
  ctx.fillRect(-r * 0.05, -r - r * 0.05, r * 0.1, r * 0.18);
  drawLeaf(ctx, r * 0.05, -r * 0.95, r * 0.5, 0.4);
  // Body
  fillRoundBody(ctx, r, f);
  // Peel texture
  ctx.fillStyle = hexToRgba("#a85700", 0.18);
  for (let i = 0; i < 18; i++) {
    const a = i * 0.85;
    const dr = ((i * 23) % 10) / 10 * 0.65 + 0.15;
    const sx = Math.cos(a) * r * dr;
    const sy = Math.sin(a) * r * dr;
    ctx.beginPath();
    ctx.arc(sx, sy, r * 0.03, 0, Math.PI * 2);
    ctx.fill();
  }
  drawHighlight(ctx, -r * 0.4, -r * 0.45, r * 0.3, r * 0.18);
  drawCatFace(ctx, r, f);
}

function drawAppleShape(ctx: Ctx, r: number, fillStyle: string | CanvasGradient, scale = 1) {
  const s = scale;
  ctx.fillStyle = fillStyle;
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.78 * s);
  ctx.bezierCurveTo(r * 0.92 * s, -r * 0.88 * s, r * 1.02 * s, r * 0.4 * s, r * 0.08 * s, r * 0.95 * s);
  ctx.bezierCurveTo(-r * 0.08 * s, r * 0.95 * s, -r * 1.02 * s, r * 0.4 * s, -r * 0.92 * s, -r * 0.88 * s);
  ctx.bezierCurveTo(-r * 0.4 * s, -r * 0.62 * s, -r * 0.1 * s, -r * 0.92 * s, 0, -r * 0.78 * s);
  ctx.fill();
}

function drawAppleArt(ctx: Ctx, r: number, f: FruitDef) {
  // Stem
  ctx.fillStyle = "#7a4316";
  ctx.fillRect(-r * 0.06, -r * 1.0, r * 0.12, r * 0.22);
  drawLeaf(ctx, r * 0.05, -r * 0.95, r * 0.5, 0.55);
  // Body
  drawAppleShape(ctx, r, f.outline, 1.02);
  drawAppleShape(ctx, r, f.color);
  const grad = ctx.createLinearGradient(0, -r, 0, r);
  grad.addColorStop(0, hexToRgba(f.highlight, 0.7));
  grad.addColorStop(0.6, hexToRgba(f.highlight, 0));
  drawAppleShape(ctx, r, grad);
  drawHighlight(ctx, -r * 0.42, -r * 0.42, r * 0.3, r * 0.18);
  drawCatFace(ctx, r, f);
}

function drawPeachArt(ctx: Ctx, r: number, f: FruitDef) {
  drawLeaf(ctx, r * 0.05, -r * 0.95, r * 0.55, 0.5);
  fillRoundBody(ctx, r, f);
  // Cleft line down center
  ctx.strokeStyle = hexToRgba(f.outline, 0.55);
  ctx.lineWidth = Math.max(1.2, r * 0.04);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.75);
  ctx.quadraticCurveTo(r * 0.06, 0, 0, r * 0.55);
  ctx.stroke();
  drawHighlight(ctx, -r * 0.4, -r * 0.45, r * 0.3, r * 0.18);
  drawCatFace(ctx, r, f);
}

function drawPineappleArt(ctx: Ctx, r: number, f: FruitDef) {
  // Spiky leaves
  ctx.fillStyle = "#5fa14a";
  ctx.strokeStyle = "#3d7a2c";
  ctx.lineWidth = Math.max(1, r * 0.04);
  for (let i = -3; i <= 3; i++) {
    ctx.save();
    ctx.translate(0, -r * 0.85);
    ctx.rotate(i * 0.22);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-r * 0.11, -r * 0.5);
    ctx.lineTo(0, -r * 0.65);
    ctx.lineTo(r * 0.11, -r * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
  // Body — slight oval
  ctx.fillStyle = f.outline;
  ctx.beginPath();
  ctx.ellipse(0, r * 0.05, r + 1.5, r * 1.05 + 1.5, 0, 0, Math.PI * 2);
  ctx.fill();
  const grad = ctx.createRadialGradient(-r * 0.3, -r * 0.4, r * 0.05, 0, 0, r);
  grad.addColorStop(0, f.highlight);
  grad.addColorStop(0.5, f.color);
  grad.addColorStop(1, shade(f.color, -0.22));
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(0, r * 0.05, r, r * 1.05, 0, 0, Math.PI * 2);
  ctx.fill();
  // Diamond grid
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(0, r * 0.05, r * 0.92, r * 1.0, 0, 0, Math.PI * 2);
  ctx.clip();
  ctx.strokeStyle = hexToRgba("#a87a00", 0.5);
  ctx.lineWidth = Math.max(0.8, r * 0.025);
  const step = r * 0.32;
  for (let yy = -r * 1.2; yy < r * 1.4; yy += step) {
    ctx.beginPath();
    ctx.moveTo(-r * 1.4, yy);
    ctx.lineTo(r * 1.4, yy + r * 0.85);
    ctx.moveTo(-r * 1.4, yy + r * 0.85);
    ctx.lineTo(r * 1.4, yy);
    ctx.stroke();
  }
  ctx.restore();
  drawHighlight(ctx, -r * 0.38, -r * 0.45, r * 0.28, r * 0.14);
  drawCatFace(ctx, r, f);
}

function drawMelonArt(ctx: Ctx, r: number, f: FruitDef) {
  // Stem
  ctx.strokeStyle = "#7a4316";
  ctx.lineWidth = Math.max(2, r * 0.06);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.95);
  ctx.lineTo(r * 0.1, -r * 1.1);
  ctx.stroke();
  drawLeaf(ctx, r * 0.05, -r * 0.95, r * 0.55, 0.45);
  // Body
  fillRoundBody(ctx, r, f);
  // Subtle netting (concentric ovals)
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.95, 0, Math.PI * 2);
  ctx.clip();
  ctx.strokeStyle = hexToRgba("#558a2a", 0.3);
  ctx.lineWidth = Math.max(0.8, r * 0.02);
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.ellipse(0, 0, r * (0.25 + i * 0.18), r * (0.35 + i * 0.16), 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
  drawHighlight(ctx, -r * 0.38, -r * 0.42, r * 0.28, r * 0.16);
  drawCatFace(ctx, r, f);
}

function drawWatermelonArt(ctx: Ctx, r: number, f: FruitDef) {
  // Stem
  ctx.fillStyle = "#3d7a2c";
  ctx.beginPath();
  ctx.ellipse(0, -r * 0.97, r * 0.08, r * 0.1, 0, 0, Math.PI * 2);
  ctx.fill();
  fillRoundBody(ctx, r, f);
  // Stripes
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.97, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = hexToRgba("#1c5f33", 0.55);
  for (let i = -2; i <= 2; i++) {
    const xc = i * r * 0.42;
    const w = r * 0.12;
    ctx.beginPath();
    ctx.moveTo(xc - w, -r * 1.05);
    ctx.bezierCurveTo(xc - w * 0.4, 0, xc - w * 0.4, 0, xc - w, r * 1.05);
    ctx.lineTo(xc + w, r * 1.05);
    ctx.bezierCurveTo(xc + w * 0.4, 0, xc + w * 0.4, 0, xc + w, -r * 1.05);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  drawHighlight(ctx, -r * 0.38, -r * 0.42, r * 0.28, r * 0.16);
  drawCatFace(ctx, r, f);
}

function drawMegaMelonArt(ctx: Ctx, r: number, f: FruitDef) {
  fillRoundBody(ctx, r, f);
  // Sparkle stars
  ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3;
    const sx = Math.cos(a) * r * 0.6;
    const sy = Math.sin(a) * r * 0.6;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(a);
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.07);
    ctx.lineTo(r * 0.025, 0);
    ctx.lineTo(0, r * 0.07);
    ctx.lineTo(-r * 0.025, 0);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-r * 0.07, 0);
    ctx.lineTo(0, r * 0.025);
    ctx.lineTo(r * 0.07, 0);
    ctx.lineTo(0, -r * 0.025);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  drawHighlight(ctx, -r * 0.38, -r * 0.42, r * 0.28, r * 0.16);
  drawCatFace(ctx, r, f);
}

const FRUIT_DRAWERS: Array<(ctx: Ctx, r: number, f: FruitDef) => void> = [
  drawCherryArt,
  drawStrawberryArt,
  drawGrapeArt,
  drawLemonArt,
  drawOrangeArt,
  drawAppleArt,
  drawPeachArt,
  drawPineappleArt,
  drawMelonArt,
  drawWatermelonArt,
  drawMegaMelonArt,
];

function drawFruit(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  angle: number,
  level: number,
  customRadius?: number,
) {
  const lvl = Math.max(0, Math.min(FRUITS.length - 1, level));
  const f = FRUITS[lvl];
  const r = customRadius ?? f.radius;

  ctx.save();
  ctx.translate(cx, cy);

  // Ground shadow
  ctx.fillStyle = "rgba(80, 40, 10, 0.18)";
  ctx.beginPath();
  ctx.ellipse(0, r * 0.95, r * 0.85, r * 0.15, 0, 0, Math.PI * 2);
  ctx.fill();

  // Soft aura behind fruit
  drawAura(ctx, r, f.highlight);

  ctx.rotate(angle);

  const drawer = FRUIT_DRAWERS[lvl] || drawCherryArt;
  drawer(ctx, r, f);

  ctx.restore();
}

function drawCloud(ctx: CanvasRenderingContext2D, cx: number, cy: number, holdingLevel: number | null) {
  ctx.save();
  ctx.translate(cx, cy);

  // Cloud shadow
  ctx.fillStyle = "rgba(80, 60, 20, 0.18)";
  ctx.beginPath();
  ctx.ellipse(2, 28, 50, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  // Body
  ctx.fillStyle = "#fff8c5";
  ctx.strokeStyle = "#e8b53c";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(-32, 4, 18, 0, Math.PI * 2);
  ctx.arc(-12, -10, 22, 0, Math.PI * 2);
  ctx.arc(14, -8, 22, 0, Math.PI * 2);
  ctx.arc(34, 6, 18, 0, Math.PI * 2);
  ctx.arc(0, 12, 24, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Inner shadow at bottom
  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = "#e8b53c";
  ctx.beginPath();
  ctx.ellipse(0, 22, 40, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Eyes (closed-happy "^ ^" style)
  ctx.strokeStyle = "#3a2a1a";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(-12, -2, 4.5, 1.05 * Math.PI, 1.95 * Math.PI);
  ctx.moveTo(7.5, -2);
  ctx.arc(12, -2, 4.5, 1.05 * Math.PI, 1.95 * Math.PI);
  ctx.stroke();

  // Mouth (cute little smile)
  ctx.beginPath();
  ctx.moveTo(-4, 8);
  ctx.quadraticCurveTo(0, 13, 4, 8);
  ctx.stroke();

  // Cheeks
  ctx.fillStyle = "rgba(255, 130, 160, 0.55)";
  ctx.beginPath();
  ctx.ellipse(-18, 8, 4, 2.5, 0, 0, Math.PI * 2);
  ctx.ellipse(18, 8, 4, 2.5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  // Holding fruit dangling below cloud
  if (holdingLevel !== null) {
    const f = FRUITS[holdingLevel];
    const fy = cy + 26 + f.radius;
    // little string
    ctx.strokeStyle = "rgba(80, 50, 20, 0.5)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx, cy + 24);
    ctx.lineTo(cx, fy - f.radius - 2);
    ctx.stroke();

    drawFruit(ctx, cx, fy, 0, holdingLevel);
  }
}

function shade(hex: string, amt: number): string {
  const c = hex.replace("#", "");
  const num = parseInt(c, 16);
  let r = (num >> 16) + Math.round(255 * amt);
  let g = ((num >> 8) & 0xff) + Math.round(255 * amt);
  let b = (num & 0xff) + Math.round(255 * amt);
  r = Math.max(0, Math.min(255, r));
  g = Math.max(0, Math.min(255, g));
  b = Math.max(0, Math.min(255, b));
  return `rgb(${r}, ${g}, ${b})`;
}

function fmtTime(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

// ===================== Snapshot type =====================
type Snapshot = {
  bodies: { x: number; y: number; vx: number; vy: number; angle: number; angVel: number; level: number }[];
  score: number;
  current: number;
  next: number;
  coins: number;
};

type Effect = { id: number; x: number; y: number; level: number; created: number };

// ===================== Main Component =====================
export default function FruitMergeGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fxLayerRef = useRef<HTMLDivElement>(null);

  const engineRef = useRef<Matter.Engine | null>(null);
  const runnerRef = useRef<Matter.Runner | null>(null);
  const bodiesRef = useRef<Map<number, Matter.Body>>(new Map());
  const cloudXRef = useRef<number>(CANVAS_W / 2);
  const canDropRef = useRef<boolean>(true);
  const currentLevelRef = useRef<number>(0);
  const nextLevelRef = useRef<number>(0);
  const snapshotRef = useRef<Snapshot | null>(null);
  const overTopAccumRef = useRef<number>(0);
  const lastFrameRef = useRef<number>(0);
  const gameOverRef = useRef<boolean>(false);
  const scoreRef = useRef<number>(0);
  const coinsRef = useRef<number>(120);
  const lastMergeLevelRef = useRef<number>(-1);

  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [coins, setCoins] = useState(120);
  const [sessionTime, setSessionTime] = useState(0);
  const [currentLevel, setCurrentLevel] = useState(0);
  const [nextLevel, setNextLevel] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [effects, setEffects] = useState<Effect[]>([]);
  const [activeEvoLevel, setActiveEvoLevel] = useState<number>(-1);

  // Persisted state load
  useEffect(() => {
    try {
      const hs = parseInt(localStorage.getItem("kfm_high") || "0", 10);
      if (!Number.isNaN(hs)) setHighScore(hs);
      const c = parseInt(localStorage.getItem("kfm_coins") || "120", 10);
      if (!Number.isNaN(c)) {
        setCoins(c);
        coinsRef.current = c;
      }
    } catch {}
  }, []);

  // Responsive scaling
  useEffect(() => {
    const apply = () => {
      const scale = Math.min(window.innerWidth / 1440, window.innerHeight / 830);
      document.documentElement.style.setProperty("--game-scale", String(Math.min(scale, 1.15)));
    };
    apply();
    window.addEventListener("resize", apply);
    return () => window.removeEventListener("resize", apply);
  }, []);

  // Session timer
  useEffect(() => {
    if (gameOver) return;
    const id = setInterval(() => setSessionTime((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [gameOver]);

  // ============= Initialize physics + render loop =============
  useEffect(() => {
    const engine = Matter.Engine.create({ enableSleeping: false });
    engine.gravity.y = 1.4;
    engineRef.current = engine;

    const wallThickness = 80;
    const wallOpts: Matter.IBodyDefinition = {
      isStatic: true,
      restitution: 0.05,
      friction: 0.6,
      label: "wall",
    };

    const innerHeight = CANVAS_H - CONTAINER_TOP;
    const leftWall = Matter.Bodies.rectangle(
      -wallThickness / 2,
      CONTAINER_TOP + innerHeight / 2,
      wallThickness,
      innerHeight + wallThickness,
      wallOpts,
    );
    const rightWall = Matter.Bodies.rectangle(
      CANVAS_W + wallThickness / 2,
      CONTAINER_TOP + innerHeight / 2,
      wallThickness,
      innerHeight + wallThickness,
      wallOpts,
    );
    const bottomWall = Matter.Bodies.rectangle(
      CANVAS_W / 2,
      CANVAS_H + wallThickness / 2 - 4,
      CANVAS_W + wallThickness * 2,
      wallThickness,
      wallOpts,
    );
    Matter.World.add(engine.world, [leftWall, rightWall, bottomWall]);

    // Initial fruits
    currentLevelRef.current = Math.floor(Math.random() * MAX_DROP_LEVEL);
    nextLevelRef.current = Math.floor(Math.random() * MAX_DROP_LEVEL);
    setCurrentLevel(currentLevelRef.current);
    setNextLevel(nextLevelRef.current);

    // Collision merging
    const handleCollisions = (event: Matter.IEventCollision<Matter.Engine>) => {
      if (gameOverRef.current) return;
      const merged = new Set<number>();
      const merges: Array<{ a: Matter.Body; b: Matter.Body }> = [];
      for (const pair of event.pairs) {
        const a = pair.bodyA;
        const b = pair.bodyB;
        if (a.label === "wall" || b.label === "wall") continue;
        if (merged.has(a.id) || merged.has(b.id)) continue;
        const la = (a as any).plugin?.level;
        const lb = (b as any).plugin?.level;
        if (la === undefined || lb === undefined) continue;
        if (la !== lb) continue;
        if (la >= FRUITS.length - 1) continue;
        merged.add(a.id);
        merged.add(b.id);
        merges.push({ a, b });
      }
      if (merges.length === 0) return;

      for (const { a, b } of merges) {
        const newLevel = ((a as any).plugin.level as number) + 1;
        const x = (a.position.x + b.position.x) / 2;
        const y = (a.position.y + b.position.y) / 2;

        Matter.World.remove(engine.world, a);
        Matter.World.remove(engine.world, b);
        bodiesRef.current.delete(a.id);
        bodiesRef.current.delete(b.id);

        const newF = FRUITS[newLevel];
        const newBody = Matter.Bodies.circle(x, y, newF.radius, {
          restitution: 0.08,
          friction: 0.55,
          frictionStatic: 0.6,
          density: 0.0011,
          slop: 0.02,
          label: "fruit",
        });
        (newBody as any).plugin = { level: newLevel };
        // Slight upward pop for satisfying feel
        Matter.Body.setVelocity(newBody, { x: 0, y: -1.2 });
        Matter.World.add(engine.world, newBody);
        bodiesRef.current.set(newBody.id, newBody);

        // Score & coins
        const gained = (newLevel + 1) * 10;
        scoreRef.current += gained;
        setScore(scoreRef.current);
        coinsRef.current += newLevel + 1;
        setCoins(coinsRef.current);

        lastMergeLevelRef.current = newLevel;
        setActiveEvoLevel(newLevel);

        // Visual effect
        const fxId = Math.random();
        const created = performance.now();
        setEffects((prev) => [...prev, { id: fxId, x, y, level: newLevel, created }]);
        setTimeout(() => {
          setEffects((prev) => prev.filter((p) => p.id !== fxId));
        }, 900);
      }
    };
    Matter.Events.on(engine, "collisionStart", handleCollisions);

    const runner = Matter.Runner.create();
    Matter.Runner.run(runner, engine);
    runnerRef.current = runner;

    // Render loop (RAF + setInterval fallback for hidden tabs)
    let raf = 0;
    let lastTick = 0;
    const tick = (t: number) => {
      const ctx = canvasRef.current?.getContext("2d");
      if (!ctx) {
        raf = requestAnimationFrame(tick);
        return;
      }
      const dt = lastFrameRef.current ? (t - lastFrameRef.current) / 1000 : 0;
      lastFrameRef.current = t;

      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

      // Subtle interior wash
      ctx.save();
      ctx.beginPath();
      ctx.rect(2, CONTAINER_TOP + 2, CANVAS_W - 4, CANVAS_H - CONTAINER_TOP - 4);
      ctx.clip();
      const interior = ctx.createLinearGradient(0, CONTAINER_TOP, 0, CANVAS_H);
      interior.addColorStop(0, "rgba(255, 250, 220, 0.0)");
      interior.addColorStop(1, "rgba(255, 130, 50, 0.05)");
      ctx.fillStyle = interior;
      ctx.fillRect(0, CONTAINER_TOP, CANVAS_W, CANVAS_H - CONTAINER_TOP);
      ctx.restore();

      // Draw bodies
      bodiesRef.current.forEach((body) => {
        const lvl = (body as any).plugin?.level as number | undefined;
        if (lvl === undefined) return;
        drawFruit(ctx, body.position.x, body.position.y, body.angle, lvl);
      });

      // Cloud + holding fruit
      const holding = !canDropRef.current || gameOverRef.current ? null : currentLevelRef.current;
      drawCloud(ctx, cloudXRef.current, 50, holding);

      // Drop guide line
      if (holding !== null) {
        const f = FRUITS[holding];
        ctx.save();
        ctx.strokeStyle = "rgba(255, 180, 80, 0.45)";
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.moveTo(cloudXRef.current, 50 + 26 + f.radius * 2 + 4);
        ctx.lineTo(cloudXRef.current, CANVAS_H - 30);
        ctx.stroke();
        ctx.restore();
      }

      // Game-over check (any settled body above death line)
      if (!gameOverRef.current && dt > 0) {
        let above = false;
        bodiesRef.current.forEach((body) => {
          if (
            body.position.y - (FRUITS[(body as any).plugin?.level || 0].radius * 0.4) < DEATH_LINE_Y &&
            Math.abs(body.velocity.x) < 0.6 &&
            Math.abs(body.velocity.y) < 0.6
          ) {
            above = true;
          }
        });
        if (above) {
          overTopAccumRef.current += dt;
          if (overTopAccumRef.current >= DEATH_GRACE) {
            triggerGameOver();
          }
        } else {
          overTopAccumRef.current = Math.max(0, overTopAccumRef.current - dt * 0.5);
        }
      }

      lastTick = t;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    // Fallback: if tab gets hidden, RAF can pause. Tick at ~30fps via interval.
    const fallbackInterval = window.setInterval(() => {
      const now = performance.now();
      if (now - lastTick > 80) tick(now);
    }, 33);

    return () => {
      cancelAnimationFrame(raf);
      window.clearInterval(fallbackInterval);
      Matter.Events.off(engine, "collisionStart", handleCollisions);
      Matter.Runner.stop(runner);
      Matter.World.clear(engine.world, false);
      Matter.Engine.clear(engine);
      bodiesRef.current.clear();
      engineRef.current = null;
      runnerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ============= Cursor + click input on canvas =============
  const updateCloudFromEvent = useCallback((clientX: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ratio = canvas.width / rect.width;
    const x = (clientX - rect.left) * ratio;
    const f = FRUITS[currentLevelRef.current];
    const margin = f.radius + 6;
    cloudXRef.current = Math.max(margin, Math.min(CANVAS_W - margin, x));
  }, []);

  const onPointerMove: React.PointerEventHandler<HTMLCanvasElement> = (e) => {
    updateCloudFromEvent(e.clientX);
  };

  const onPointerDown: React.PointerEventHandler<HTMLCanvasElement> = (e) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    updateCloudFromEvent(e.clientX);
    drop();
  };

  const drop = useCallback(() => {
    if (!canDropRef.current || gameOverRef.current || !engineRef.current) return;
    saveSnapshot();

    const level = currentLevelRef.current;
    const f = FRUITS[level];
    const body = Matter.Bodies.circle(cloudXRef.current, 50 + 26 + f.radius, f.radius, {
      restitution: 0.08,
      friction: 0.55,
      frictionStatic: 0.6,
      density: 0.0011,
      slop: 0.02,
      label: "fruit",
    });
    (body as any).plugin = { level };
    Matter.World.add(engineRef.current.world, body);
    bodiesRef.current.set(body.id, body);

    currentLevelRef.current = nextLevelRef.current;
    nextLevelRef.current = Math.floor(Math.random() * MAX_DROP_LEVEL);
    setCurrentLevel(currentLevelRef.current);
    setNextLevel(nextLevelRef.current);
    setActiveEvoLevel(level);

    canDropRef.current = false;
    setTimeout(() => {
      if (!gameOverRef.current) canDropRef.current = true;
    }, 520);

    setCanUndo(true);
  }, []);

  // ============= Snapshots =============
  const saveSnapshot = () => {
    const bodies: Snapshot["bodies"] = [];
    bodiesRef.current.forEach((body) => {
      bodies.push({
        x: body.position.x,
        y: body.position.y,
        vx: body.velocity.x,
        vy: body.velocity.y,
        angle: body.angle,
        angVel: body.angularVelocity,
        level: (body as any).plugin.level,
      });
    });
    snapshotRef.current = {
      bodies,
      score: scoreRef.current,
      current: currentLevelRef.current,
      next: nextLevelRef.current,
      coins: coinsRef.current,
    };
  };

  const undo = useCallback(() => {
    if (!snapshotRef.current || !engineRef.current || gameOverRef.current) return;
    bodiesRef.current.forEach((body) => {
      Matter.World.remove(engineRef.current!.world, body);
    });
    bodiesRef.current.clear();

    for (const b of snapshotRef.current.bodies) {
      const f = FRUITS[b.level];
      const body = Matter.Bodies.circle(b.x, b.y, f.radius, {
        restitution: 0.08,
        friction: 0.55,
        frictionStatic: 0.6,
        density: 0.0011,
        slop: 0.02,
        label: "fruit",
      });
      (body as any).plugin = { level: b.level };
      Matter.World.add(engineRef.current.world, body);
      Matter.Body.setVelocity(body, { x: b.vx, y: b.vy });
      Matter.Body.setAngle(body, b.angle);
      Matter.Body.setAngularVelocity(body, b.angVel);
      bodiesRef.current.set(body.id, body);
    }
    scoreRef.current = snapshotRef.current.score;
    coinsRef.current = snapshotRef.current.coins;
    currentLevelRef.current = snapshotRef.current.current;
    nextLevelRef.current = snapshotRef.current.next;
    setScore(snapshotRef.current.score);
    setCoins(snapshotRef.current.coins);
    setCurrentLevel(snapshotRef.current.current);
    setNextLevel(snapshotRef.current.next);
    overTopAccumRef.current = 0;
    snapshotRef.current = null;
    setCanUndo(false);
  }, []);

  // ============= Restart =============
  const restart = useCallback(() => {
    if (!engineRef.current) return;
    bodiesRef.current.forEach((body) => {
      Matter.World.remove(engineRef.current!.world, body);
    });
    bodiesRef.current.clear();
    scoreRef.current = 0;
    setScore(0);
    overTopAccumRef.current = 0;
    snapshotRef.current = null;
    setCanUndo(false);
    setSessionTime(0);
    currentLevelRef.current = Math.floor(Math.random() * MAX_DROP_LEVEL);
    nextLevelRef.current = Math.floor(Math.random() * MAX_DROP_LEVEL);
    setCurrentLevel(currentLevelRef.current);
    setNextLevel(nextLevelRef.current);
    setActiveEvoLevel(-1);
    gameOverRef.current = false;
    setGameOver(false);
    canDropRef.current = true;
  }, []);

  // ============= Game Over =============
  const triggerGameOver = useCallback(() => {
    if (gameOverRef.current) return;
    gameOverRef.current = true;
    setGameOver(true);
    canDropRef.current = false;
    if (scoreRef.current > highScore) {
      setHighScore(scoreRef.current);
      try {
        localStorage.setItem("kfm_high", String(scoreRef.current));
      } catch {}
    }
    try {
      localStorage.setItem("kfm_coins", String(coinsRef.current));
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highScore]);

  // Keep coins persisted on changes
  useEffect(() => {
    try {
      localStorage.setItem("kfm_coins", String(coins));
    } catch {}
  }, [coins]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (gameOver) return;
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        drop();
      } else if (e.key === "z" || e.key === "Z") {
        undo();
      } else if (e.key === "r" || e.key === "R") {
        restart();
      } else if (e.key === "ArrowLeft") {
        const f = FRUITS[currentLevelRef.current];
        cloudXRef.current = Math.max(f.radius + 6, cloudXRef.current - 18);
      } else if (e.key === "ArrowRight") {
        const f = FRUITS[currentLevelRef.current];
        cloudXRef.current = Math.min(CANVAS_W - f.radius - 6, cloudXRef.current + 18);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [drop, undo, restart, gameOver]);

  // Inject score/highscore live into ref for game-over comparison
  useEffect(() => {
    scoreRef.current = score;
    if (score > highScore) {
      setHighScore(score);
      try {
        localStorage.setItem("kfm_high", String(score));
      } catch {}
    }
  }, [score, highScore]);

  // ===================== Render =====================
  const sortedFriends = [...FRIENDS, { name: "You", avatar: "🌟", score, isYou: true } as any].sort(
    (a, b) => b.score - a.score,
  );

  return (
    <div className="game-wrapper">
      <div className="game">
        <Background />

        {/* LEFT */}
        <div className="left-panel">
          <div className="score-bubble">
            <div className="score-label">SCORE</div>
            <div className="score-value">{score.toLocaleString()}</div>
            <div className="score-high">HI · {highScore.toLocaleString()}</div>
          </div>
          <div className="coin-pill">
            <span className="coin" />
            {coins.toLocaleString()}
          </div>
          <div className="leaderboard">
            <div className="leaderboard-title">★ FRIENDS ★</div>
            {sortedFriends.slice(0, 5).map((f: any, i: number) => (
              <div key={f.name} className={"lb-row" + (f.isYou ? " you" : "")}>
                <div className="lb-rank">#{i + 1}</div>
                <div className="lb-avatar">{f.avatar}</div>
                <div className="lb-name">{f.name}</div>
                <div className="lb-score">{f.score.toLocaleString()}</div>
              </div>
            ))}
            <button className="invite-btn" onClick={() => alert("Invite link copied!")}>
              + Invite Friends
            </button>
          </div>
        </div>

        {/* CENTER */}
        <div className="center-panel">
          <div className="top-bar">
            <div className="timer-pill">⏱ {fmtTime(sessionTime)}</div>
            <div className="session-pill">🍓 Session</div>
          </div>

          <div className="play-area">
            <div className="basket-banner">FRUIT BASKET</div>
            <div className="basket-stripe stripe-l" />
            <div className="basket-stripe stripe-r" />
            <div className="container-frame" />
            <div className="basket-base" />
            <div className="basket-rivet rivet-tl" />
            <div className="basket-rivet rivet-tr" />
            <div className="basket-rivet rivet-bl" />
            <div className="basket-rivet rivet-br" />
            <div className="death-line" />
            <canvas
              ref={canvasRef}
              className="game-canvas"
              width={CANVAS_W}
              height={CANVAS_H}
              onPointerMove={onPointerMove}
              onPointerDown={onPointerDown}
            />
            <div className="fx-layer" ref={fxLayerRef}>
              {effects.map((fx) => (
                <React.Fragment key={fx.id}>
                  <span className="fx-spark" style={{ left: fx.x, top: fx.y }} />
                  <span className="fx-pop" style={{ left: fx.x, top: fx.y - 16 }}>
                    +{(fx.level + 1) * 10}
                  </span>
                </React.Fragment>
              ))}
            </div>
          </div>

          <div className="bottom-controls">
            <button className="ctrl-btn" onClick={() => alert("Menu")}>
              <span className="icon">☰</span> Menu
            </button>
            <button className="ctrl-btn" onClick={restart}>
              <span className="icon">↻</span> Restart
            </button>
            <button
              className="ctrl-btn"
              onClick={undo}
              style={{ opacity: canUndo ? 1 : 0.5 }}
              disabled={!canUndo}
            >
              <span className="icon">↶</span> Undo
            </button>
          </div>
          <div className="hint">Drag cursor to move cloud · Left mouse click to drop fruit</div>
        </div>

        {/* RIGHT */}
        <div className="right-panel">
          <div className="next-bubble">
            <div className="next-label">Next!</div>
            <FruitIcon level={nextLevel} size={110} />
          </div>
          <EvolutionWheel activeLevel={activeEvoLevel} />
        </div>

        {gameOver && (
          <div className="modal-backdrop">
            <div className="modal">
              <h2>Oh no!</h2>
              <p>The fruits stacked too high…</p>
              <div className="modal-score">Score: {score.toLocaleString()}</div>
              <button className="modal-btn" onClick={restart}>
                Try Again!
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ===================== Subcomponents =====================
function FruitIcon({ level, size }: { level: number; size: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, size, size);
    drawFruit(ctx, size / 2, size / 2, 0, level, size / 2 - 6);
  }, [level, size]);
  return <canvas ref={ref} width={size} height={size} style={{ width: size, height: size }} />;
}

function EvolutionWheel({ activeLevel }: { activeLevel: number }) {
  const wheelSize = 280;
  const centerR = 60;
  const ringR = wheelSize / 2 - 22;
  const wheelFruits = FRUITS.slice(0, 10);

  return (
    <div className="evo-wheel" style={{ width: wheelSize, height: wheelSize }}>
      <div className="evo-center">
        <div className="evo-center-title">EVO</div>
        <div className="evo-center-sub">{wheelFruits.length} fruits</div>
      </div>
      {wheelFruits.map((f, i) => {
        const angle = (i / wheelFruits.length) * Math.PI * 2 - Math.PI / 2;
        const x = wheelSize / 2 + Math.cos(angle) * ringR;
        const y = wheelSize / 2 + Math.sin(angle) * ringR;
        const sz = 44;
        return (
          <div
            key={f.level}
            className={"evo-fruit" + (activeLevel === f.level ? " active" : "")}
            style={{
              left: x,
              top: y,
              width: sz,
              height: sz,
              marginLeft: -sz / 2,
              marginTop: -sz / 2,
              background: "transparent",
            }}
            title={f.name}
          >
            <FruitIcon level={f.level} size={sz} />
          </div>
        );
      })}
    </div>
  );
}

function PixelCloud({ x, y, scale = 1 }: { x: number | string; y: number; scale?: number }) {
  // Build a chunky pixel cloud out of squares
  const px = 8 * scale;
  // Each cell is one pixel block; pattern map (1 = filled, 0 = empty)
  const map = [
    "...XXXXXX...",
    "..XXXXXXXX..",
    ".XXXXXXXXXX.",
    "XXXXXXXXXXXX",
    "XXXXXXXXXXXX",
    ".XXXXXXXXXX.",
  ];
  const w = map[0].length * px;
  const h = map.length * px;
  return (
    <div style={{ position: "absolute", left: x as any, top: y, width: w, height: h, pointerEvents: "none" }}>
      {map.map((row, ry) =>
        row.split("").map((ch, cx) => {
          if (ch !== "X") return null;
          const isEdge =
            ry === 0 ||
            ry === map.length - 1 ||
            cx === 0 ||
            cx === row.length - 1 ||
            map[ry - 1]?.[cx] !== "X" ||
            map[ry + 1]?.[cx] !== "X" ||
            row[cx - 1] !== "X" ||
            row[cx + 1] !== "X";
          return (
            <div
              key={`${ry}-${cx}`}
              style={{
                position: "absolute",
                left: cx * px,
                top: ry * px,
                width: px,
                height: px,
                background: isEdge ? "#dceaf5" : "#fff",
              }}
            />
          );
        }),
      )}
    </div>
  );
}

function Background() {
  return (
    <>
      <div className="bg-sky" />
      {/* Pixel-art clouds */}
      <PixelCloud x={80} y={60} scale={1.3} />
      <PixelCloud x={"60%"} y={40} scale={1.6} />
      <PixelCloud x={"38%"} y={360} scale={0.9} />
      <PixelCloud x={1180} y={420} scale={1.1} />
      <PixelCloud x={40} y={380} scale={1.0} />

      {/* Pixel-art stair-step hills (stacked rows of rectangles) */}
      <div className="pixel-hills">
        {Array.from({ length: 18 }, (_, i) => {
          const baseW = 1540;
          const stepH = 8;
          // Front hill: gentle wave by sin pattern
          const offset = Math.sin(i * 0.5) * 28 + Math.sin(i * 0.18) * 60;
          return (
            <div
              key={`hill-back-${i}`}
              style={{
                position: "absolute",
                left: -50,
                bottom: 80 + (17 - i) * stepH,
                width: baseW,
                height: stepH,
                background: i < 4 ? "#7fcf63" : i < 12 ? "#62b94a" : "#4ea53d",
                marginLeft: offset,
              }}
            />
          );
        })}
      </div>
      <div className="bg-grass" />
    </>
  );
}
