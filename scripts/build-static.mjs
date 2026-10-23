// Builds Peep as one self-contained HTML file: the real pages,
// components and API handlers bundled to run in the browser, with all CSS,
// fonts and JS inlined. Usage: npm run build:static
//
// Writes two files to out-static/:
//   peep.html         a complete document to open directly in a browser
//   artifact.html     the same page without <html>/<head>/<body>, for hosts
//                     that supply their own document skeleton

import { build } from "esbuild";
import tailwind from "@tailwindcss/postcss";
import postcss from "postcss";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const r = (...p) => path.join(root, ...p);
const OUT = r("out-static");
// [package, stylesheet] pairs; Fraunces ships its soft-corner axis separately.
const FONTS = [
  ["fraunces", "soft.css"],
  ["nunito-sans", "index.css"],
];

// Next-only modules swapped for browser stand-ins.
const SHIMS = {
  "next/link": r("static/shims/link.tsx"),
  "next/navigation": r("static/shims/navigation.ts"),
  "next/server": r("static/shims/server.ts"),
  "@/lib/store": r("static/store.ts"),
  "@/lib/ai-extract": r("static/shims/ai-extract.ts"),
};

const shimPlugin = {
  name: "shims",
  setup(b) {
    const filter = new RegExp(`^(${Object.keys(SHIMS).map((k) => k.replace(/[/@-]/g, "\\$&")).join("|")})$`);
    b.onResolve({ filter }, (args) => ({ path: SHIMS[args.path] }));
  },
};

async function bundleJs() {
  const result = await build({
    entryPoints: [r("static/main.tsx")],
    bundle: true,
    minify: true,
    format: "iife",
    target: "es2020",
    jsx: "automatic",
    write: false,
    legalComments: "none",
    tsconfig: r("tsconfig.json"),
    define: { "process.env.NODE_ENV": '"production"' },
    plugins: [shimPlugin],
    logLevel: "warning",
  });
  // Keep the bundle safe to inline inside a <script> element.
  return result.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");
}

async function compileCss() {
  const source = readFileSync(r("app/globals.css"), "utf8");
  const out = await postcss([tailwind({ base: root })]).process(source, { from: r("app/globals.css") });
  return out.css;
}

// Latin and Latin Extended faces only, embedded as data URIs.
function inlineFonts() {
  return FONTS.map(([pkg, sheet]) => {
    const dir = r("node_modules/@fontsource-variable", pkg);
    const css = readFileSync(path.join(dir, sheet), "utf8");
    return css
      .split(/(?=\/\* )/)
      .filter((block) => /-latin(-ext)?-(wght|soft)-normal \*\//.test(block))
      .map((block) =>
        block.replace(/url\(\.\/files\/([^)]+)\)/g, (_, file) => {
          const data = readFileSync(path.join(dir, "files", file)).toString("base64");
          return `url(data:font/woff2;base64,${data})`;
        }),
      )
      .join("\n");
  }).join("\n");
}

const [js, css] = await Promise.all([bundleJs(), compileCss()]);
const style = `${inlineFonts()}\n${css}`;
const title = "Peep";
const noscript = `<noscript><p style="padding:24px;font-family:system-ui">Peep needs JavaScript to run.</p></noscript>`;

// Same as lib/theme.ts THEME_INIT: dark unless the visitor picked light, set before paint.
const themeInit = `<script>try{document.documentElement.dataset.theme=localStorage.getItem("peep-theme")==="light"?"light":"dark"}catch(e){document.documentElement.dataset.theme="dark"}</script>`;
const body = `${themeInit}\n<div id="root"></div>\n${noscript}\n<script>${js}</script>`;
const full = `<!doctype html>
<html lang="en" data-theme="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="description" content="Peep turns any pitch into a polished campaign and pairs it with brands and donors whose giving funds are verified.">
<title>${title}</title>
<style>${style}</style>
</head>
<body>
${body}
</body>
</html>
`;
const fragment = `<title>${title}</title>\n<style>${style}</style>\n${body}\n`;

mkdirSync(OUT, { recursive: true });
writeFileSync(path.join(OUT, "peep.html"), full);
writeFileSync(path.join(OUT, "artifact.html"), fragment);
const kb = (s) => `${Math.round(Buffer.byteLength(s) / 1024)} KB`;
console.log(`out-static/peep.html         ${kb(full)}  (js ${kb(js)}, css+fonts ${kb(style)})`);
console.log(`out-static/artifact.html     ${kb(fragment)}`);
