#!/usr/bin/env node
// Pings YouTube oEmbed for every videoId in src/lib/exercise-library.ts.
// Prints a table and writes /tmp/yt-report.json.
import fs from "node:fs";

const src = fs.readFileSync("src/lib/exercise-library.ts", "utf8");
const re = /"([^"]+)":\s*\{\s*videoId:\s*"([A-Za-z0-9_-]{6,})"/g;
const entries = [];
let m;
while ((m = re.exec(src))) entries.push({ name: m[1], id: m[2] });

const seen = new Map();
for (const e of entries) {
  if (!seen.has(e.id)) seen.set(e.id, []);
  seen.get(e.id).push(e.name);
}

console.log(`Found ${entries.length} entries / ${seen.size} unique videoIds`);

async function check(id) {
  const url = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${id}&format=json`;
  try {
    const res = await fetch(url, { method: "GET" });
    return { id, status: res.status, ok: res.ok };
  } catch (e) {
    return { id, status: 0, ok: false, error: e.message };
  }
}

const ids = [...seen.keys()];
const results = [];
const CONC = 10;
for (let i = 0; i < ids.length; i += CONC) {
  const batch = ids.slice(i, i + CONC);
  const r = await Promise.all(batch.map(check));
  results.push(...r);
}

const bad = results.filter((r) => !r.ok);
console.log(`\nOK: ${results.length - bad.length}  BAD: ${bad.length}`);
if (bad.length) {
  console.log("\nBROKEN:");
  for (const b of bad) {
    console.log(`  ${b.id} [${b.status}]  →  ${seen.get(b.id).join(", ")}`);
  }
}

fs.writeFileSync(
  "/tmp/yt-report.json",
  JSON.stringify({ total: results.length, bad, badNames: bad.flatMap((b) => seen.get(b.id)) }, null, 2),
);
console.log("\nReport: /tmp/yt-report.json");
