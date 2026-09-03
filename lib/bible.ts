// API.Bible wrapper - fetches KJV chapter text.
// Free tier: 5000 requests/day. We cache in memory per-process.

const KJV_BIBLE_ID = "de4e12af7f28f599-02"; // KJV public domain
const BASE = "https://api.scripture.api.bible/v1";

type ChapterContent = {
  reference: string;
  content: string; // plain text or HTML
};

const cache = new Map<string, ChapterContent>();

export async function fetchChapter(chapterId: string): Promise<ChapterContent | null> {
  if (cache.has(chapterId)) return cache.get(chapterId)!;
  const key = process.env.API_BIBLE_KEY;
  if (!key) {
    return {
      reference: chapterId,
      content: `<p><em>Set API_BIBLE_KEY in .env.local to load ${chapterId}.</em></p>`
    };
  }
  try {
    const res = await fetch(
      `${BASE}/bibles/${KJV_BIBLE_ID}/chapters/${chapterId}?content-type=html&include-verse-numbers=true&include-titles=false&include-notes=false`,
      { headers: { "api-key": key }, next: { revalidate: 86400 } }
    );
    if (!res.ok) return null;
    const json = await res.json();
    const out: ChapterContent = {
      reference: json.data.reference,
      content: json.data.content
    };
    cache.set(chapterId, out);
    return out;
  } catch {
    return null;
  }
}

export async function fetchChapters(chapterIds: string[]): Promise<ChapterContent[]> {
  const results = await Promise.all(chapterIds.map(fetchChapter));
  return results.filter((r): r is ChapterContent => r !== null);
}
