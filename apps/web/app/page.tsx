import { ChatDemo } from "./chat-demo";
import { isSubject } from "./subjects";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const viewingAs = (await searchParams).as;
  const initialSubjectId = isSubject(viewingAs) ? viewingAs : "alice";

  return <ChatDemo initialSubjectId={initialSubjectId} />;
}
