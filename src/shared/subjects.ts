export const SUBJECTS = ["math", "physics", "chemistry", "accounting"] as const;
export type Subject = (typeof SUBJECTS)[number];

export const SUBJECT_LABELS: Record<Subject, string> = {
  math: "Math",
  physics: "Physics",
  chemistry: "Chemistry",
  accounting: "Accounting",
};
