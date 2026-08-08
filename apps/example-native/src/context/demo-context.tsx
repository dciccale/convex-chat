import {
  createContext,
  type ReactNode,
  useContext,
  useMemo,
  useState,
} from "react";
import type { Subject } from "@/lib/subjects";

type DemoContextValue = {
  subjectId: Subject;
  setSubjectId: (subjectId: Subject) => void;
};

const DemoContext = createContext<DemoContextValue | null>(null);

export function DemoProvider({ children }: { children: ReactNode }) {
  const [subjectId, setSubjectId] = useState<Subject>("bob");
  const value = useMemo(() => ({ subjectId, setSubjectId }), [subjectId]);

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

export function useDemo() {
  const value = useContext(DemoContext);
  if (!value) throw new Error("useDemo must be used inside DemoProvider");
  return value;
}
