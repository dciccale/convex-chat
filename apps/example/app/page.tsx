import { ChatDemo } from "./chat-demo";
import { isSubject } from "./subjects";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const viewingAs = params.as;
  const initialSubjectId = isSubject(viewingAs) ? viewingAs : "alice";
  const initialConversationId =
    typeof params.conversation === "string" ? params.conversation : null;

  return (
    <ChatDemo
      initialConversationId={initialConversationId}
      initialSubjectId={initialSubjectId}
    />
  );
}
