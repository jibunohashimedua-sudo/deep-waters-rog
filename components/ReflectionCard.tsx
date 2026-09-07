"use client";
import { useState, useEffect } from "react";
import Avatar from "./Avatar";
import { createClient } from "@/lib/supabase/client";
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
      .select("id, body, created_at, user_id, profiles(name, photo_url)")
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
    const res = await fetch("/api/react", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ completion_id: item.id })
    });
    const j = await res.json();
    setReacted(j.reacted);
    setAmens((a) => (j.reacted ? a + 1 : Math.max(0, a - 1)));
  }

  async function postComment(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    setPosting(true);
    await fetch("/api/comment", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ completion_id: item.id, body: draft })
    });
    setDraft("");
    setPosting(false);
    setCommentCount((c) => c + 1);
    await loadComments();
  }

  async function deleteComment(id: string) {
    await fetch("/api/comment", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id })
    });
    setComments((prev) => prev.filter((c) => c.id !== id));
    setCommentCount((c) => Math.max(0, c - 1));
  }

  return (
    <article id={item.id} className="card">
      <div className="flex items-center gap-3">
        <Avatar name={item.name} photoUrl={item.photo_url} size="md" decorative />
        <div className="flex-1">
          <p className="font-semibold text-rog-ink">{item.name}</p>
          <p className="text-xs text-rog-muted">
            Day {item.day_number} &bull; {new Date(item.completed_at).toLocaleDateString("en-GB")}
          </p>
        </div>
      </div>

      {item.verse_reference && <p className="mt-4 font-semibold text-rog-purple">{item.verse_reference}</p>}
      {item.verse_text && <p className="selectable mt-1 italic text-rog-ink">&ldquo;{item.verse_text}&rdquo;</p>}
      {item.reflection && (
        <p className="selectable mt-3 text-rog-ink">
          <MentionText text={item.reflection} />
        </p>
      )}

      {/* Actions */}
      <div className="mt-4 flex items-center gap-4 text-sm">
        <button
          onClick={amen}
          disabled={!currentUserId}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition ${
            reacted ? "bg-rog-purple text-white" : "bg-rog-cream text-rog-purple hover:bg-rog-peach"
          }`}
        >
          <span aria-hidden>🙏</span> <span className="font-semibold">Amen</span> {amens > 0 && <span>{amens}</span>}
        </button>
        <button onClick={toggleComments} className="text-rog-muted hover:text-rog-purple">
          <span aria-hidden>💬</span> {commentCount > 0 ? commentCount : ""} {commentCount === 1 ? "comment" : "comments"}
        </button>
        <div className="ml-auto">
          {currentUserId !== item.user_id && (
            <ReportButton targetType="completion" targetId={item.id} />
          )}
        </div>
      </div>

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
              <div className="flex-1 bg-rog-cream rounded-2xl px-3 py-2">
                <p className="text-xs font-semibold text-rog-purple">{c.profiles?.name}</p>
                <p className="selectable text-sm text-rog-ink"><MentionText text={c.body} /></p>
                <div className="flex gap-3 mt-1">
                  <p className="text-[10px] text-rog-muted">{new Date(c.created_at).toLocaleString("en-GB")}</p>
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
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Add a comment... use @name to mention"
                className="flex-1 rounded-full border border-rog-line bg-white px-4 py-2 text-sm focus:border-rog-purple focus:outline-none"
              />
              <button type="submit" disabled={posting || !draft.trim()} className="btn-primary text-sm px-4 py-2 disabled:opacity-50">
                Post
              </button>
            </form>
          )}
        </div>
      )}
    </article>
  );
}
