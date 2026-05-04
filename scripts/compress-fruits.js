// One-shot script: shrink the 600x600 fruit PNGs in public/fruits/ in-place.
// Each input is ~5-6 MB; output should be ~150-400 KB after palette quantization
// + max compression. They render at ~2.5x the physics radius (max ~285px) so
// we also downscale to 300x300 — well above any on-screen size.

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const dir = path.join(__dirname, "..", "public", "fruits");
const files = fs.readdirSync(dir).filter((f) => f.endsWith(".png"));

(async () => {
  let beforeTotal = 0;
  let afterTotal = 0;
  for (const file of files) {
    const full = path.join(dir, file);
    const before = fs.statSync(full).size;
    beforeTotal += before;

    const buf = await sharp(full)
      .resize(300, 300, { fit: "inside", kernel: "nearest" })
      .png({
        compressionLevel: 9,
        palette: true,
        quality: 90,
        effort: 10,
      })
      .toBuffer();

    fs.writeFileSync(full, buf);
    const after = fs.statSync(full).size;
    afterTotal += after;
    const pct = (((before - after) / before) * 100).toFixed(1);
    console.log(
      `${file}: ${(before / 1024 / 1024).toFixed(2)} MB -> ${(after / 1024).toFixed(0)} KB (-${pct}%)`,
    );
  }
  console.log(
    `total: ${(beforeTotal / 1024 / 1024).toFixed(2)} MB -> ${(afterTotal / 1024 / 1024).toFixed(2)} MB`,
  );
})();
