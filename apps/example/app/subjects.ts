export const subjects = ["alice", "bob", "charlie"] as const;

export type Subject = (typeof subjects)[number];

export function isSubject(value: unknown): value is Subject {
  return (
    typeof value === "string" && subjects.some((subject) => subject === value)
  );
}
