import type { Report } from "./schema.ts";

export function navigation(report: Report, reviewHeading: string) {
  const used = new Set<string>();
  const reserved = new Set(report.sections.flatMap((section) => (section.id ? [section.id] : [])));
  const allocate = (base: string, reservedIds?: ReadonlySet<string>) => {
    let id = base;
    for (let n = 2; used.has(id) || reservedIds?.has(id); n++) id = `${base}-${n}`;
    used.add(id);
    return id;
  };
  const sections = report.sections.map((section, i) => ({
    id: section.id ? allocate(section.id) : allocate(`sec-${i + 1}`, reserved),
    heading: section.heading,
  }));
  const review = allocate("review", reserved);
  const questions = (report.review?.questions ?? []).map((question) => ({
    id: allocate(`question-${question.id}`),
    heading: question.text,
    depth: 1,
  }));
  return {
    sections,
    review,
    questions,
    entries: [
      ...sections,
      ...(questions.length ? [{ id: review, heading: reviewHeading }, ...questions] : []),
    ],
  };
}
