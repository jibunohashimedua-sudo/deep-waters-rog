// Download the raw study datasets into scripts/.data.
//
// Nothing here is committed: the sources are large, they belong to their
// projects, and each is fetched from the place that publishes it so the
// licence travels with it. Run this before any import script.
//
//   node scripts/fetch-datasets.mjs
import { mkdirSync, existsSync, writeFileSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { DATA } from "./lib-db.mjs";

const SOURCES = [
  {
    file: "KJV-osis.json",
    url: "https://raw.githubusercontent.com/scrollmapper/bible_databases/master/sources/en/KJV/KJV-osis.json",
    what: "KJV with per-word Strong's tagging (CrossWire Sword KJV module via scrollmapper, MIT)"
  },
  {
    file: "TBESG.txt",
    url: "https://raw.githubusercontent.com/STEPBible/STEPBible-Data/master/Lexicons/TBESG%20-%20Translators%20Brief%20lexicon%20of%20Extended%20Strongs%20for%20Greek%20-%20STEPBible.org%20CC%20BY.txt",
    what: "Greek lexicon keyed to extended Strong's (STEPBible, CC BY 4.0)"
  },
  {
    file: "HebrewStrong.xml",
    url: "https://raw.githubusercontent.com/openscriptures/HebrewLexicon/master/HebrewStrong.xml",
    what: "Strong's Hebrew dictionary (OpenScriptures Hebrew Bible, CC BY 4.0)"
  },
  {
    file: "BrownDriverBriggs.xml",
    url: "https://raw.githubusercontent.com/openscriptures/HebrewLexicon/master/BrownDriverBriggs.xml",
    what: "Brown-Driver-Briggs Hebrew lexicon (OSHB, CC BY 4.0)"
  },
  {
    file: "LexicalIndex.xml",
    url: "https://raw.githubusercontent.com/openscriptures/HebrewLexicon/master/LexicalIndex.xml",
    what: "Strong's ↔ BDB index (OSHB, CC BY 4.0)"
  },
  {
    file: "cross_references.txt",
    url: "https://a.openbible.info/data/cross-references.zip",
    zip: true,
    what: "Cross references from the Treasury of Scripture Knowledge (OpenBible.info, CC BY 4.0)"
  }
];

const MH_REPO = "https://codeberg.org/revisedcommonversion/matthew-henry-commentary";

mkdirSync(DATA, { recursive: true });

for (const s of SOURCES) {
  const out = join(DATA, s.file);
  if (existsSync(out)) {
    console.log(`have  ${s.file} (${(statSync(out).size / 1e6).toFixed(1)} MB)`);
    continue;
  }
  console.log(`fetch ${s.file} — ${s.what}`);
  if (s.zip) {
    const zip = join(DATA, "cross-references.zip");
    execFileSync("curl", ["-sL", "-o", zip, s.url]);
    execFileSync("unzip", ["-o", "-q", zip, "-d", DATA]);
  } else {
    const res = await fetch(s.url);
    if (!res.ok) throw new Error(`${s.url} responded ${res.status}`);
    writeFileSync(out, Buffer.from(await res.arrayBuffer()));
  }
}

const mh = join(DATA, "matthew-henry");
if (existsSync(mh)) {
  console.log("have  matthew-henry (Matthew Henry's Commentary, CC0 1.0)");
} else {
  console.log("clone matthew-henry — Matthew Henry's Commentary on the Whole Bible (CC0 1.0)");
  execFileSync("git", ["clone", "--depth", "1", "--quiet", MH_REPO, mh]);
}

console.log("\nAll sources present in scripts/.data");
