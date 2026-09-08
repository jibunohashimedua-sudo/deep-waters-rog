import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { CARE_NOTE_MAX, capText } from "@/lib/limits";
import { todayForCurrentRequest } from "@/lib/serverToday";
import type { CareEntry, PulsePerson } from "@/lib/pulse";

/**
 * The care log, for one person at a time.
 *
 * GET  ?user=<uuid>  — that person's activity facts and their care log.
 * POST               — append a "reached out" tick or a note.
 *
 * Both are gated the way /pulse is: the flag, read from the profile.
 * A caller without it gets a 404 rather than a 403, because a 403 would
 * tell them there was something here.
 *
 * The gate here is belt; RLS on care_log is braces. The table's select
 * policy is `is_pastoral_user() and subject_user_id <> auth.uid()`, so a
 * member hitting PostgREST directly gets an empty array whatever this
 * route does, and no member can read a log about themselves.
 *
 * Nothing in either response carries a private reflection or a private
 * verse note. The only text that crosses this wire is what a pastor
 * wrote in the log.
 */

const NOT_FOUND = NextResponse.json({ error: "Not found" }, { status: 404 });

async function pastoralUser() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.is_pastoral !== true) return null;
  return { supabase, userId: user.id };
}

/** The log for one subject, with the author names merged in. Two plain
    queries rather than one nested join — the habit this project keeps
    after HTTP 300s out of ambiguous relationships. */
async function readLog(
  supabase: ReturnType<typeof createClient>,
  subjectId: string
): Promise<CareEntry[]> {
  const { data: rows, error } = await supabase
    .from("care_log")
    .select("id, subject_user_id, author_user_id, kind, body, created_at")
    .eq("subject_user_id", subjectId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("[deep-waters] care log read:", error.message);
    return [];
  }
  const list = rows ?? [];
  if (list.length === 0) return [];

  const authorIds = Array.from(new Set(list.map((r) => r.author_user_id)));
  const { data: authors } = await supabase
    .from("profiles")
    .select("id, name")
    .in("id", authorIds)
    .limit(authorIds.length);
  const names = new Map((authors ?? []).map((a) => [a.id, a.name as string]));

  return list.map((r) => ({
    ...r,
    kind: r.kind as CareEntry["kind"],
    author_name: names.get(r.author_user_id) ?? "Someone"
  }));
}

export async function GET(request: Request) {
  const session = await pastoralUser();
  if (!session) return NOT_FOUND;
  const { supabase } = session;

  const subjectId = new URL(request.url).searchParams.get("user");
  if (!subjectId) {
    return NextResponse.json({ error: "Which person?" }, { status: 400 });
  }

  const [{ data: personRows, error: pErr }, log] = await Promise.all([
    supabase.rpc("pulse_person", {
      p_user_id: subjectId,
      p_today: todayForCurrentRequest()
    }),
    readLog(supabase, subjectId)
  ]);

  if (pErr) {
    console.error("[deep-waters] pulse_person:", pErr.message);
    return NextResponse.json({ error: "Could not load this person" }, { status: 500 });
  }

  const person = ((personRows ?? []) as PulsePerson[])[0] ?? null;
  if (!person) return NOT_FOUND;

  return NextResponse.json({ ok: true, person, log });
}

export async function POST(request: Request) {
  const session = await pastoralUser();
  if (!session) return NOT_FOUND;
  const { supabase, userId } = session;

  const { subject_user_id, kind, body } = await request.json();
  if (!subject_user_id) {
    return NextResponse.json({ error: "Which person?" }, { status: 400 });
  }
  if (kind !== "reached_out" && kind !== "note") {
    return NextResponse.json({ error: "unknown kind" }, { status: 400 });
  }
  if (subject_user_id === userId) {
    return NextResponse.json({ error: "That is your own row" }, { status: 400 });
  }

  const capped = kind === "note" ? capText(body, CARE_NOTE_MAX) : null;
  if (kind === "note" && !capped) {
    return NextResponse.json({ error: "Please write something first" }, { status: 400 });
  }

  const { data: row, error } = await supabase
    .from("care_log")
    .insert({
      subject_user_id,
      author_user_id: userId,
      kind,
      body: capped
    })
    .select("id, subject_user_id, author_user_id, kind, body, created_at")
    .single();

  if (error) {
    console.error("[deep-waters] care log write:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: me } = await supabase
    .from("profiles")
    .select("name")
    .eq("id", userId)
    .maybeSingle();

  const entry: CareEntry = {
    ...row,
    kind: row.kind as CareEntry["kind"],
    author_name: me?.name ?? "You"
  };

  return NextResponse.json({ ok: true, entry });
}
