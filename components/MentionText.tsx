import { splitMentions } from "@/lib/mentions";

export default function MentionText({ text, className = "" }: { text: string; className?: string }) {
  const parts = splitMentions(text);
  return (
    <span className={`whitespace-pre-wrap ${className}`}>
      {parts.map((p, i) =>
        p.m ? (
          <span key={i} className="text-rog-purple font-semibold">{p.t}</span>
        ) : (
          <span key={i}>{p.t}</span>
        )
      )}
    </span>
  );
}
