export const subjects = ["alice", "bob", "charlie"] as const;

export type Subject = (typeof subjects)[number];

export function isSubject(value: unknown): value is Subject {
  return subjects.some((subject) => subject === value);
}

export function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
