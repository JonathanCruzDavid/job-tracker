import { DEFAULT_SECTION_ORDER, type ResumeDocumentData, type SectionKey } from "./resumeTemplate";

// Plain-text rendering of the same structured data, stored in
// resumes.extracted_text so this tailored copy still shows a text preview
// on /resumes and remains searchable/readable without opening the PDF.
// Respects section_order so the text preview matches the actual PDF layout.
export function flattenResume(resume: ResumeDocumentData): string {
  const lines: string[] = [];

  lines.push(resume.name);
  const contact = [resume.location, resume.phone, resume.email].filter(Boolean);
  if (contact.length > 0) lines.push(contact.join(" | "));
  if (resume.links.length > 0) lines.push(resume.links.join(" | "));

  const sectionLines: Partial<Record<SectionKey, string[]>> = {
    summary: resume.summary ? ["", "SUMMARY", resume.summary] : undefined,
    education:
      resume.education.length > 0
        ? [
            "",
            "EDUCATION",
            ...resume.education.flatMap((edu) => [
              `${edu.degree}${edu.dates ? ` — ${edu.dates}` : ""}`,
              `${edu.school}${edu.location ? ` — ${edu.location}` : ""}`,
            ]),
          ]
        : undefined,
    experience:
      resume.experience.length > 0
        ? [
            "",
            "WORK EXPERIENCE",
            ...resume.experience.flatMap((job) => [
              `${job.title}${job.location ? ` — ${job.location}` : ""}`,
              `${job.company}${job.dates ? ` — ${job.dates}` : ""}`,
              ...job.bullets.map((bullet) => `• ${bullet}`),
            ]),
          ]
        : undefined,
    projects:
      resume.projects.length > 0
        ? [
            "",
            "PROJECTS",
            ...resume.projects.flatMap((project) => [
              `${project.name}${project.stack ? ` — ${project.stack}` : ""}`,
              ...(project.subtitle ? [project.subtitle] : []),
              ...project.bullets.map((bullet) => `• ${bullet}`),
            ]),
          ]
        : undefined,
    skills:
      resume.skills.length > 0
        ? [
            "",
            "TECHNICAL SKILLS",
            ...resume.skills.map((group) => `${group.category} | ${group.items.join(", ")}`),
          ]
        : undefined,
  };

  const order =
    resume.section_order && resume.section_order.length > 0
      ? resume.section_order
      : DEFAULT_SECTION_ORDER;

  for (const key of order) {
    const section = sectionLines[key];
    if (section) lines.push(...section);
  }

  return lines.join("\n");
}
