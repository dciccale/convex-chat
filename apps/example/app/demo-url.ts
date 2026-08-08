import type { Subject } from "./subjects";

export function buildDemoUrl({
  conversationId,
  hash,
  pathname,
  search,
  subjectId,
}: {
  conversationId: string | null;
  hash: string;
  pathname: string;
  search: string;
  subjectId: Subject;
}) {
  const params = new URLSearchParams(search);
  params.set("as", subjectId);
  if (conversationId) {
    params.set("conversation", conversationId);
  } else {
    params.delete("conversation");
  }

  const query = params.toString();
  return `${pathname}${query ? `?${query}` : ""}${hash}`;
}
