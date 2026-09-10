import Link from "next/link";
import Nav from "@/components/Nav";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Sources · Deep Waters",
  description:
    "The datasets behind the Bench's study lenses, who made them, and the licences they are used under."
};

/**
 * Where the study material comes from.
 *
 * Four of these datasets are CC BY 4.0, which requires attribution — this
 * page is that condition being met, not a courtesy. It is public for the
 * same reason: an attribution nobody can reach is not an attribution.
 *
 * The list is kept in step with scripts/README.md and the licence headers
 * in the import scripts themselves. If a dataset is added, changed or
 * removed there, it changes here in the same commit.
 */

type Source = {
  /** The lens it feeds. Short: .meta is mono metadata at 9.5px, and a
      whole sentence set in it is a sentence nobody reads. */
  what: string;
  /** Who made it, and through whom it reaches us. */
  credit: string;
  licence: string;
  href: string;
  /** Anything true that the licence line alone would leave out. */
  note?: string;
};

const SOURCES: Source[] = [
  {
    what: "KJV text and Strong's tagging",
    credit: "CrossWire Sword KJV module, via scrollmapper/bible_databases",
    licence: "Text and tagging public domain; the repository is MIT",
    href: "https://github.com/scrollmapper/bible_databases"
  },
  {
    what: "Greek lexicon",
    credit:
      "TBESG, Translators Brief lexicon of Extended Strongs for Greek, based on Abbott-Smith — STEPBible.org, Tyndale House Cambridge",
    licence: "CC BY 4.0",
    href: "https://github.com/STEPBible/STEPBible-Data"
  },
  {
    what: "Hebrew lexicon",
    credit:
      "Strong's Hebrew and Brown-Driver-Briggs — the Open Scriptures Hebrew Bible project",
    licence: "CC BY 4.0",
    href: "https://github.com/openscriptures/HebrewLexicon"
  },
  {
    what: "Cross references",
    credit:
      "OpenBible.info, drawn primarily from the Treasury of Scripture Knowledge, ordered by reader votes",
    licence: "CC BY 4.0",
    href: "https://www.openbible.info/labs/cross-references/"
  },
  {
    what: "Commentary",
    credit: "Matthew Henry, Commentary on the Whole Bible — 1662–1714",
    licence: "CC0 1.0; the text itself is public domain",
    href: "https://codeberg.org/revisedcommonversion/matthew-henry-commentary"
  },
  {
    what: "Exposition, Old Testament",
    credit:
      "Karl Friedrich Keil and Franz Delitzsch, Biblical Commentary on the Old Testament, 1864 — CrossWire Sword module KD, built from Wikisource",
    licence: "Public domain, stated in the module's own configuration",
    href: "https://crosswire.org/sword/modules/ModDisp.jsp?modType=Commentaries"
  },
  {
    what: "Exposition, New Testament",
    credit:
      "A. T. Robertson, Word Pictures in the New Testament, 1930–1933 — CrossWire Sword module RWP",
    licence:
      "Volumes 1–4 public domain. Volumes 5 and 6 remain in copyright and are used under the module's grant of free non-commercial distribution",
    href: "https://crosswire.org/sword/modules/ModDisp.jsp?modType=Commentaries",
    note:
      "Volumes 5 and 6 are John and Hebrews, the General Epistles and Revelation — © 1932 and 1933, renewed 1960 by Broadman Press. They are here only because Deep Waters is not a commercial app and takes no money for access. If that ever changes, they come out."
  }
];

export default async function SourcesPage() {
  // Public: signed out is a perfectly ordinary way to arrive here, so this
  // asks who you are without insisting. Signed in you keep the app bar;
  // signed out you get a way back to the front door instead.
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  return (
    <>
      {user ? (
        <Nav />
      ) : (
        <header className="max-w-3xl mx-auto px-6 pt-6">
          <Link href="/" className="meta hover:text-rog-purple transition-colors">
            &larr; Deep Waters
          </Link>
        </header>
      )}

      <main className="max-w-3xl mx-auto px-6 py-10">
        <p className="meta">Sources</p>
        <h1 className="mt-3 text-[28px] md:text-[34px] font-semibold tracking-[-0.03em] text-rog-ink leading-tight">
          Where the study material comes from
        </h1>
        <p className="mt-4 max-w-[34rem] text-[13.5px] leading-5 text-rog-muted">
          The Bench reads scholarship other people made and gave away. Several
          of these are licensed{" "}
          <a
            href="https://creativecommons.org/licenses/by/4.0/"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2"
          >
            CC BY 4.0
          </a>
          , which asks that they be credited wherever they are used. This page
          is that credit. Nothing here has been altered beyond reformatting it
          for the screen.
        </p>

        <ul className="mt-10 border-t border-rog-line">
          {SOURCES.map((s) => (
            <li key={s.credit + s.what} className="border-b border-rog-line py-6">
              <p className="meta">{s.what}</p>
              <p className="mt-2 text-[15px] leading-6 text-rog-ink">{s.credit}</p>
              <p className="mt-2 text-[13.5px] leading-5 text-rog-muted">
                {s.licence}
              </p>
              {s.note && (
                <p className="mt-2 max-w-[34rem] text-[13.5px] leading-5 text-rog-muted">
                  {s.note}
                </p>
              )}
              <a
                href={s.href}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-block meta hover:text-rog-purple transition-colors"
              >
                {new URL(s.href).hostname.replace(/^www\./, "")} &rarr;
              </a>
            </li>
          ))}
        </ul>

        <p className="mt-8 max-w-[34rem] text-[13.5px] leading-5 text-rog-muted">
          Bible text outside the King James comes from API.Bible, under the
          terms each publisher sets for its own edition.
        </p>
      </main>
    </>
  );
}
