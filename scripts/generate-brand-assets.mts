/**
 * Generate the committed brand rasters in public/brand/ from their sources, so
 * the PNGs are reproducible rather than hand-made binaries:
 *
 *   avatar-{400,1000}.png    ← public/brand/avatar.svg, via sharp
 *   x-header-1500x500.png    ← composed here, via next/og (satori)
 *
 *   npm run brand:assets
 *
 * Re-run after any change to the mark or the brand palette in src/lib/og.tsx.
 */
import { writeFile } from "node:fs/promises";
import path from "node:path";

import { ImageResponse } from "next/og";
import sharp from "sharp";

import { OG } from "@/lib/og";

const BRAND_DIR = path.join(process.cwd(), "public", "brand");

/**
 * Minimal React-element factory. Satori accepts plain `{type, props, key}`
 * objects, which keeps this a .mts script with no JSX build config.
 */
type El = { type: string; key: null; props: Record<string, unknown> };
function h(
  type: string,
  props: Record<string, unknown> = {},
  ...children: unknown[]
): El {
  return {
    type,
    key: null,
    props: {
      ...props,
      ...(children.length
        ? { children: children.length === 1 ? children[0] : children }
        : {}),
    },
  };
}

/** The compass mark, stroke-only (no plate) — for use as a watermark. */
function compassOutline(size: number, strokeWidth = 1.5) {
  return h(
    "svg",
    { width: size, height: size, viewBox: "0 0 32 32" },
    h("circle", {
      cx: 16,
      cy: 16,
      r: 10,
      fill: "none",
      stroke: OG.gold,
      strokeWidth,
    }),
    h("polygon", { points: "16,7 19,16 16,25 13,16", fill: OG.gold }),
  );
}

/** The compass mark on its dark plate, as it appears in the favicon/avatar. */
function compassPlate(size: number) {
  return h(
    "svg",
    { width: size, height: size, viewBox: "0 0 32 32" },
    h("rect", { width: 32, height: 32, rx: 7, fill: OG.bg }),
    h("circle", {
      cx: 16,
      cy: 16,
      r: 10,
      fill: "none",
      stroke: OG.gold,
      strokeWidth: 2,
    }),
    h("polygon", { points: "16,7 19,16 16,25 13,16", fill: OG.gold }),
    h("circle", { cx: 16, cy: 16, r: 1.6, fill: OG.bg }),
  );
}

async function buildAvatars() {
  const svg = path.join(BRAND_DIR, "avatar.svg");
  for (const size of [400, 1000]) {
    await sharp(svg, { density: 600 })
      .resize(size, size)
      .png({ compressionLevel: 9 })
      .toFile(path.join(BRAND_DIR, `avatar-${size}.png`));
    console.log(`[brand] wrote avatar-${size}.png`);
  }
}

async function buildXHeader() {
  const WIDTH = 1500;
  const HEIGHT = 500;

  const banner = h(
    "div",
    {
      style: {
        display: "flex",
        width: "100%",
        height: "100%",
        background: OG.bgGradient,
        position: "relative",
        alignItems: "center",
      },
    },
    // Oversized watermark, bled off the right edge. Decorative only: X crops
    // the sides on narrow viewports, so nothing meaningful lives out here.
    h(
      "div",
      {
        style: {
          display: "flex",
          position: "absolute",
          right: -90,
          top: 10,
          opacity: 0.13,
        },
      },
      compassOutline(480, 1.25),
    ),
    // Content block. Lifted off the vertical centre (paddingBottom) so it stays
    // clear of the profile photo, which overlaps the banner's bottom-left corner.
    // On X desktop that photo occupies roughly x 40–372, y 334–500 in these
    // coordinates; this padding lands the last line at y≈312. Verified by
    // compositing a mock avatar over the output — don't reduce it without
    // re-checking, the disclaimer line is the first thing to get clipped.
    h(
      "div",
      {
        style: {
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          height: "100%",
          paddingLeft: 96,
          paddingBottom: 115,
        },
      },
      h(
        "div",
        { style: { display: "flex", alignItems: "center", gap: 22 } },
        compassPlate(84),
        h(
          "div",
          { style: { display: "flex", fontSize: 76, fontWeight: 700 } },
          h("span", { style: { color: OG.gold } }, "Gold"),
          h("span", { style: { color: OG.fg } }, "Compass"),
        ),
      ),
      h(
        "div",
        {
          style: {
            display: "flex",
            marginTop: 26,
            fontSize: 36,
            color: OG.fg,
          },
        },
        "Clear, cited gold-market guidance for everyday investors",
      ),
      h(
        "div",
        {
          style: {
            display: "flex",
            marginTop: 18,
            fontSize: 25,
            color: OG.muted,
          },
        },
        h("span", { style: { color: OG.gold } }, "goldcompass.app"),
        h("span", {}, " · Outlook · Live prices · Insights · Calculator"),
      ),
      h(
        "div",
        {
          style: {
            display: "flex",
            marginTop: 14,
            fontSize: 21,
            color: OG.muted,
          },
        },
        "Educational only — not financial advice",
      ),
    ),
  );

  const res = new ImageResponse(banner as never, { width: WIDTH, height: HEIGHT });
  const out = path.join(BRAND_DIR, "x-header-1500x500.png");
  await writeFile(out, Buffer.from(await res.arrayBuffer()));
  console.log(`[brand] wrote x-header-1500x500.png`);
}

async function main() {
  await buildAvatars();
  await buildXHeader();
  console.log("[brand] done.");
}

main().catch((err) => {
  console.error("[brand] FAILED:", err);
  process.exit(1);
});
