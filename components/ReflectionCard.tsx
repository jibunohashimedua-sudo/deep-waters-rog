"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import Avatar from "./Avatar";
import { createClient } from "@/lib/supabase/client";
import { friendlyError } from "@/lib/errors";
import MentionText from "./MentionText";
import ReportButton from "./ReportButton";

type Comment = {
  id: string;
  body: string;
  created_at: string;
  user_id: string;
  profiles: { name: string; photo_url: string | null } | null;
};

export default function ReflectionCard({
  item,
  currentUserId,
  isAdmin
}: {
  item: {
    id: string;
    user_id: string;
    day_number: number;
    verse_reference: string | null;
    verse_text: string | null;
    reflection: string | null;
    completed_at: string;
    name: string;
    photo_url: string | null;
    amen_count: number;
    comment_count: number;
  };
  currentUserId: string | null;
  isAdmin: boolean;
}) {
  const supabase = createClient();
  const [amens, setAmens] = useState<number>(Number(item.amen_count));
  const [reacted, setReacted] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentCount, setCommentCount] = useState<number>(Number(item.comment_count));
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUserId) return;
    supabase
      .from("reactions")
      .select("completion_id")
      .eq("completion_id", item.id)
      .eq("user_id", currentUserId)
      .maybeSingle()
      .then(({ data }) => setReacted(!!data));
  }, [currentUserId, item.id, supabase]);

  async function loadComments() {
    const { data } = await supabase
      .from("comments")
      .select("id, body, created_at, user_id, profiles(name:display_name, photo_url)")
      .eq("completion_id", item.id)
      .order("created_at");
    setComments((data ?? []) as unknown as Comment[]);
  }

  async function toggleComments() {
    const next = !showComments;
    setShowComments(next);
    if (next && comments.length === 0) await loadComments();
  }

  async function amen() {
    if (!currentUserId) return;
    // Optimistic flip — revert on any non-2xx so the count never drifts from
    // truth. The prior version awaited json() unconditionally, which threw
    // uncaught when middleware served an HTML redirect to a stale session.
    const prevReacted = reacted;
    const prevAmens = amens;
    const nextReacted = !reacted;
    setReacted(nextReacted);
    setAmens((a) => (nextReacted ? a + 1 : Math.max(0, a - 1)));
    setActionError(null);
    try {
      const res = await fetch("/api/react", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ completion_id: item.id })
      });
      if (!res.ok) throw new Error("react-failed");
      const j = await res.json();
      // Server is authority — if it disagrees with our optimistic flip,
      // take its answer.
      if (typeof j.reacted === "boolean" && j.reacted !== nextReacted) {
        setReacted(j.reacted);
        setAmens((a) => (j.reacted ? a + 1 : Math.max(0, a - 1)));
      }
    } catch (err) {
      setReacted(prevReacted);
      setAmens(prevAmens);
      setActionError(friendlyError(err instanceof Error ? err.message : undefined));
    }
  }

  async function postComment(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    setPosting(true);
    setActionError(null);
    try {
      const res = await fetch("/api/comment", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ completion_id: item.id, body: draft })
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setActionError(friendlyError(j.error));
        return; // draft preserved, count untouched
      }
      setDraft("");
      setCommentCount((c) => c + 1);
      await loadComments();
    } finally {
      setPosting(false);
    }
  }

  async function deleteComment(id: string) {
    // Optimistic remove, restore on failure — a comment that disappears from
    // the UI and then reappears on reload is worse than a small pause.
    const previous = comments;
    setComments((prev) => prev.filter((c) => c.id !== id));
    setCommentCount((c) => Math.max(0, c - 1));
    setActionError(null);
    try {
      const res = await fetch("/api/comment", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id })
      });
      if (!res.ok) throw new Error("delete-failed");
    } catch (err) {
      setComments(previous);
      setCommentCount((c) => c + 1);
      setActionError(friendlyError(err instanceof Error ? err.message : undefined));
    }
  }

  return (
    <article id={item.id} className="card">
      {/* Your own post takes you to Depth. Everyone else's does nothing —
          there are no public profiles yet, and a name that looks tappable
          and isn't is worse than one that plainly isn't. */}
      {(() => {
        const mine = !!currentUserId && item.user_id === currentUserId;
        const inner = (
          <>
            <Avatar name={item.name} photoUrl={item.photo_url} size="md" decorative />
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-semibold text-rog-ink leading-tight">{item.name}</p>
              {/* One fact, and which one depends on when it was written.
                  Today's posts are placed by the clock; older ones by the
                  day of the plan they belong to. Both together was a date
                  and a day number saying the same thing twice. */}
              <p className="meta mt-1">{stampFor(item)}</p>
            </div>
          </>
        );
        return mine ? (
          <Link href="/depth" className="flex items-center gap-3" aria-label="Your depth">
            {inner}
          </Link>
        ) : (
          <div className="flex items-center gap-3">{inner}</div>
        );
      })()}

      {/* The verse they kept. A rule down the left says "this is quoted"
          more quietly than quotation marks and an italic ever did. */}
      {item.verse_text ? (
        <div className="quoted mt-4">
          <p className="scripture-prose selectable text-[15px] leading-[1.62] text-rog-ink">
            {item.verse_text}
          </p>
          {item.verse_reference && <p className="meta mt-1.5">{item.verse_reference}</p>}
        </div>
      ) : (
        item.verse_reference && <p className="meta mt-4">{item.verse_reference}</p>
      )}
      {item.reflection && (
        <p
          className="selectable mt-3 text-[14.5px] leading-[1.55] text-rog-ink"
          style={{ overflowWrap: "anywhere" }}
        >
          <MentionText text={item.reflection} />
        </p>
      )}

      {/* Actions */}
      {/* Actions read as a footer, not a button bar: metadata-sized, no
          fills, and drawn rather than set in emoji. Amen goes sonar when
          it's yours — the same green that marks today on the gauge. */}
      <div className="mt-4 flex items-center gap-5 meta">
        <button
          onClick={amen}
          disabled={!currentUserId}
          className="act"
          data-on={reacted ? "true" : undefined}
          aria-pressed={reacted}
        >
          <span>Amen{amens > 0 ? ` ${amens}` : ""}</span>
        </button>
        <button onClick={toggleComments} className="act">
          <span>{commentCount > 0 ? `Reply ${commentCount}` : "Reply"}</span>
        </button>
        <div className="ml-auto">
          {currentUserId !== item.user_id && (
            <ReportButton targetType="completion" targetId={item.id} />
          )}
        </div>
      </div>

      {actionError && (
        <p className="mt-2 text-[11.5px] text-danger" role="alert">{actionError}</p>
      )}

      {/* Comments */}
      {showComments && (
        <div className="mt-4 border-t border-rog-line pt-4 space-y-3">
          {comments.length === 0 && (
            <p className="text-xs text-rog-muted py-2">
              No comments yet. Be the first to say something.
            </p>
          )}
          {comments.map((c) => (
            <div key={c.id} className="flex gap-2">
              <Avatar name={c.profiles?.name ?? "?"} photoUrl={c.profiles?.photo_url} size="xs" decorative />
              <div className="flex-1 surface-soft !p-3">
                <p className="text-[13px] font-semibold text-rog-ink">{c.profiles?.name}</p>
                <p
                  className="selectable text-[14px] leading-[1.5] text-rog-ink"
                  style={{ overflowWrap: "anywhere" }}
                >
                  <MentionText text={c.body} />
                </p>
                <div className="flex gap-3 mt-1.5">
                  <p className="meta">{new Date(c.created_at).toLocaleString("en-GB")}</p>
                  {(c.user_id === currentUserId || isAdmin) && (
                    <button onClick={() => deleteComment(c.id)} className="text-[10px] text-rog-muted hover:text-danger">Delete</button>
                  )}
                  {c.user_id !== currentUserId && <ReportButton targetType="comment" targetId={c.id} />}
                </div>
              </div>
            </div>
          ))}
          {currentUserId && (
            <form onSubmit={postComment} className="flex gap-2">
              <input
                type="text"
                enterKeyHint="send"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Add a comment... use @name to mention"
                className="flex-1 border border-rog-line px-3 py-2 text-[14px] focus:border-rog-purple focus:outline-none"
              />
              <button type="submit" disabled={posting || !draft.trim()} className="btn-primary !text-[13px] px-4 py-2 disabled:opacity-50">
                Post
              </button>
            </form>
          )}
        </div>
      )}
    </article>
  );
}

/** "07:41" for something written today, "Day 32" for anything older. */
function stampFor(item: { completed_at: string; day_number: number }): string {
  const at = new Date(item.completed_at);
  const now = new Date();
  const sameDay =
    at.getFullYear() === now.getFullYear() &&
    at.getMonth() === now.getMonth() &&
    at.getDate() === now.getDate();
  return sameDay
    ? at.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
    : `Day ${item.day_number}`;
}
