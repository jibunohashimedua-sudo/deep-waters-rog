# Study datasets

The Bench's lenses read reference data that lives in Supabase rather than
in the repo — it is large, and it belongs to the projects that publish it.
These scripts fetch it and load it.

```bash
node scripts/fetch-datasets.mjs     # download sources into scripts/.data
node scripts/import-all.mjs         # load them (idempotent, safe to re-run)
node scripts/import-all.mjs --dry-run   # parse and count, write nothing
```

`SUPABASE_SERVICE_ROLE_KEY` and `NEXT_PUBLIC_SUPABASE_URL` are read from
`.env.local`. The tables are read-only to signed-in readers; only the
service role can write them, which is why these run from a shell and not
from the app.

Run `supabase/migrations/2026_09_12_study_datasets.sql` first.

## Sources and licences

| Data | Source | Licence |
|---|---|---|
| KJV text + per-word Strong's tagging | CrossWire Sword KJV module, via [scrollmapper/bible_databases](https://github.com/scrollmapper/bible_databases) | Text and tagging public domain; repo MIT |
| Greek lexicon | [TBESG](https://github.com/STEPBible/STEPBible-Data), STEPBible.org (Abbott-Smith based) | CC BY 4.0 |
| Hebrew lexicon | Strong's Hebrew + Brown-Driver-Briggs, [OpenScriptures HebrewLexicon](https://github.com/openscriptures/HebrewLexicon) | CC BY 4.0 |
| Cross references | [OpenBible.info](https://www.openbible.info/labs/cross-references/), from the Treasury of Scripture Knowledge | CC BY 4.0 |
| Commentary | [Matthew Henry's Commentary](https://codeberg.org/revisedcommonversion/matthew-henry-commentary) | CC0 1.0; text public domain |
| Vine's Expository Dictionary | — | **Not loaded.** No edition found under a licence clean enough to import |

`scripts/.data/` is not committed.
