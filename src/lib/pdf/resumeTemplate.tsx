import type { ReactNode } from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

export type SectionKey = "summary" | "education" | "experience" | "projects" | "skills";

export const DEFAULT_SECTION_ORDER: SectionKey[] = [
  "summary",
  "education",
  "experience",
  "projects",
  "skills",
];

export type ResumeDocumentData = {
  name: string;
  location: string | null;
  phone: string | null;
  email: string | null;
  links: string[];
  summary: string | null;
  section_order: SectionKey[];
  education: { degree: string; school: string; location: string | null; dates: string | null }[];
  experience: {
    title: string;
    company: string;
    location: string | null;
    dates: string | null;
    bullets: string[];
  }[];
  projects: {
    name: string;
    stack: string | null;
    subtitle: string | null;
    dates: string | null;
    bullets: string[];
  }[];
  skills: { category: string; items: string[] }[];
};

// Successively tighter layouts tried in order until the resume fits on one
// page (see renderResumePdf.ts) — a real word processor would reflow text
// to fit; react-pdf has no such thing, so this is the closest equivalent:
// shrink font size and whitespace step by step rather than ever paginating.
const SCALE_TIERS = [
  {
    pagePadding: 36,
    baseFontSize: 10,
    nameFontSize: 18,
    contactFontSize: 9.5,
    sectionHeaderFontSize: 11,
    sectionMarginTop: 8,
    entryMarginBottom: 5,
    bulletMarginTop: 1.5,
  },
  {
    pagePadding: 28,
    baseFontSize: 9.5,
    nameFontSize: 17,
    contactFontSize: 9,
    sectionHeaderFontSize: 10.5,
    sectionMarginTop: 6,
    entryMarginBottom: 4,
    bulletMarginTop: 1,
  },
  {
    pagePadding: 22,
    baseFontSize: 9,
    nameFontSize: 16,
    contactFontSize: 8.5,
    sectionHeaderFontSize: 10,
    sectionMarginTop: 5,
    entryMarginBottom: 3,
    bulletMarginTop: 0.75,
  },
  {
    pagePadding: 16,
    baseFontSize: 8.5,
    nameFontSize: 15,
    contactFontSize: 8,
    sectionHeaderFontSize: 9.5,
    sectionMarginTop: 3,
    entryMarginBottom: 2,
    bulletMarginTop: 0.5,
  },
] as const;

export const SCALE_TIER_COUNT = SCALE_TIERS.length;

function buildStyles(scaleIndex: number) {
  const tier = SCALE_TIERS[Math.min(scaleIndex, SCALE_TIERS.length - 1)];

  return StyleSheet.create({
    page: {
      paddingTop: tier.pagePadding,
      paddingBottom: tier.pagePadding,
      paddingHorizontal: tier.pagePadding + 8,
      fontFamily: "Times-Roman",
      fontSize: tier.baseFontSize,
      color: "#111111",
    },
    name: {
      fontSize: tier.nameFontSize,
      fontFamily: "Times-Bold",
      textAlign: "center",
      marginBottom: 3,
    },
    contactLine: {
      fontSize: tier.contactFontSize,
      textAlign: "center",
      marginBottom: 1,
    },
    section: {
      marginTop: tier.sectionMarginTop,
    },
    sectionHeader: {
      fontSize: tier.sectionHeaderFontSize,
      fontFamily: "Times-Bold",
      textTransform: "uppercase",
      borderBottomWidth: 1,
      borderBottomColor: "#111111",
      paddingBottom: 2,
      marginBottom: 4,
    },
    entry: {
      marginBottom: tier.entryMarginBottom,
    },
    row: {
      flexDirection: "row",
      justifyContent: "space-between",
    },
    bold: {
      fontFamily: "Times-Bold",
    },
    italic: {
      fontFamily: "Times-Italic",
    },
    bulletRow: {
      flexDirection: "row",
      marginTop: tier.bulletMarginTop,
      paddingLeft: 10,
    },
    bulletMark: {
      width: 10,
    },
    bulletText: {
      flex: 1,
    },
    skillsRow: {
      marginBottom: 2,
    },
  });
}

type Styles = ReturnType<typeof buildStyles>;

function Bullets({ items, styles }: { items: string[]; styles: Styles }) {
  return (
    <>
      {items.map((item, i) => (
        <View key={i} style={styles.bulletRow}>
          <Text style={styles.bulletMark}>•</Text>
          <Text style={styles.bulletText}>{item}</Text>
        </View>
      ))}
    </>
  );
}

export function ResumeDocument({
  resume,
  scaleIndex = 0,
}: {
  resume: ResumeDocumentData;
  scaleIndex?: number;
}) {
  const styles = buildStyles(scaleIndex);
  const contactParts = [resume.location, resume.phone, resume.email].filter(Boolean);

  const sections: Partial<Record<SectionKey, ReactNode>> = {
    summary: resume.summary && (
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>Summary</Text>
        <Text>{resume.summary}</Text>
      </View>
    ),
    education: resume.education.length > 0 && (
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>Education</Text>
        {resume.education.map((edu, i) => (
          <View key={i} style={styles.entry}>
            <View style={styles.row}>
              <Text style={styles.bold}>{edu.degree}</Text>
              {edu.dates && <Text style={styles.bold}>{edu.dates}</Text>}
            </View>
            <View style={styles.row}>
              <Text style={styles.italic}>{edu.school}</Text>
              {edu.location && <Text style={styles.italic}>{edu.location}</Text>}
            </View>
          </View>
        ))}
      </View>
    ),
    experience: resume.experience.length > 0 && (
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>Work Experience</Text>
        {resume.experience.map((job, i) => (
          <View key={i} style={styles.entry}>
            <View style={styles.row}>
              <Text style={styles.bold}>{job.title}</Text>
              {job.location && <Text style={styles.bold}>{job.location}</Text>}
            </View>
            <View style={styles.row}>
              <Text style={styles.italic}>{job.company}</Text>
              {job.dates && <Text style={styles.italic}>{job.dates}</Text>}
            </View>
            <Bullets items={job.bullets} styles={styles} />
          </View>
        ))}
      </View>
    ),
    projects: resume.projects.length > 0 && (
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>Projects</Text>
        {resume.projects.map((project, i) => (
          <View key={i} style={styles.entry}>
            <View style={styles.row}>
              <Text style={styles.bold}>{project.name}</Text>
              {project.stack && <Text style={styles.bold}>{project.stack}</Text>}
            </View>
            {(project.subtitle || project.dates) && (
              <View style={styles.row}>
                {project.subtitle && <Text style={styles.italic}>{project.subtitle}</Text>}
                {project.dates && <Text style={styles.italic}>{project.dates}</Text>}
              </View>
            )}
            <Bullets items={project.bullets} styles={styles} />
          </View>
        ))}
      </View>
    ),
    skills: resume.skills.length > 0 && (
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>Technical Skills</Text>
        {resume.skills.map((group, i) => (
          <Text key={i} style={styles.skillsRow}>
            <Text style={styles.bold}>{group.category}</Text> | {group.items.join(", ")}
          </Text>
        ))}
      </View>
    ),
  };

  const order =
    resume.section_order && resume.section_order.length > 0
      ? resume.section_order
      : DEFAULT_SECTION_ORDER;

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.name}>{resume.name}</Text>
        {contactParts.length > 0 && (
          <Text style={styles.contactLine}>{contactParts.join(" | ")}</Text>
        )}
        {resume.links.length > 0 && (
          <Text style={styles.contactLine}>{resume.links.join(" | ")}</Text>
        )}

        {order.map((key) => sections[key] ?? null)}
      </Page>
    </Document>
  );
}
