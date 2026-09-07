import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { articleFromLines, linesOf, type Article } from "@/lib/rhapsodyPdf";

export const runtime = "nodejs";
export const maxDuration = 60;

type Ask = { date: string; page: number };

/**
 * Read the article text for a set of dates straight out of the month's PDF.
 * Admin only. The PDF is fetched server-side from the private bucket, so the
 * browser never sees where it lives.
 */
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: me, error: meError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (meError) return NextResponse.json({ error: meError.message }, { status: 500 });
  if (me?.role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let payload: { edition_id?: string; pages_per?: number; days?: Ask[] };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const editionId = payload.edition_id;
  const pagesPer = Math.min(Math.max(Number(payload.pages_per) || 1, 1), 6);
  const days = (payload.days ?? []).filter(
    (d) => typeof d?.date === "string" && Number.isInteger(d?.page) && d.page >= 1
  );
  if (!editionId || days.length === 0) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  const { data: edition, error: edError } = await supabase
    .from("rhapsody_editions")
    .select("file_path")
    .eq("id", editionId)
    .maybeSingle();
  if (edError) return NextResponse.json({ error: edError.message }, { status: 500 });
  if (!edition?.file_path) return NextResponse.json({ error: "edition not found" }, { status: 404 });

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
  const { data: file, error: dlError } = await service.storage
    .from("rhapsody")
    .download(edition.file_path);
  if (dlError || !file) {
    return NextResponse.json({ error: dlError?.message ?? "couldn't read the PDF" }, { status: 500 });
  }

  try {
    const { getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(await file.arrayBuffer()));
    const total = pdf.numPages;

    // Each page is read once, however many days point at it.
    const cache = new Map<number, ReturnType<typeof linesOf>>();
    const readPage = async (pn: number) => {
      if (cache.has(pn)) return cache.get(pn)!;
      const content = await (await pdf.getPage(pn)).getTextContent();
      const lines = linesOf(content.items as Parameters<typeof linesOf>[0]);
      cache.set(pn, lines);
      return lines;
    };

    const articles: Record<string, Article> = {};
    const skipped: string[] = [];
    for (const d of days) {
      const pages: number[] = [];
      for (let i = 0; i < pagesPer; i++) if (d.page + i <= total) pages.push(d.page + i);
      if (!pages.length) {
        skipped.push(d.date);
        continue;
      }
      const perPage = [];
      for (const pn of pages) perPage.push({ pn, lines: await readPage(pn) });
      articles[d.date] = articleFromLines(perPage);
    }

    return NextResponse.json({ articles, skipped, total_pages: total });
  } catch (e) {
    const message = e instanceof Error ? e.message : "couldn't read the PDF";
    console.error("[deep-waters] rhapsody extract:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
