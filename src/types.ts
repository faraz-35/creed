export interface ChapterMeta {
  file: string;
  n: number;
  roman: string;
  title: string;
  order: number;
}

export interface BookGroup {
  roman: string;
  title: string;
  chapters: ChapterMeta[];
}

export interface Part {
  n: number;
  roman: string;
  books: BookGroup[];
}

export interface Manifest {
  book: {
    title: string;
    author: string;
    translator: string;
    source: string;
  };
  parts: Part[];
}

export interface Paragraph {
  id: string;
  html: string;
}

export interface ChapterDoc {
  file: string;
  order: number;
  part: number;
  book_roman: string;
  book_title: string;
  n: number;
  roman: string;
  title: string;
  paragraphs: Paragraph[];
}

export type NoteType =
  | "foreign"
  | "allusion"
  | "context"
  | "translation"
  | "term"
  | "idea"
  | "vocab";

export type Placement = "inline" | "before" | "after" | "page";

export type Confidence = "certain" | "likely" | "uncertain";

export interface Annotation {
  id: string;
  anchor: string;
  placement: Placement;
  type: NoteType;
  quote: string;
  title?: string;
  original?: string;
  render?: string;
  label?: string;
  note: string;
  confidence: Confidence;
  spoiler: boolean;
}

export interface AnnotationsDoc {
  chapter: string;
  annotations: Annotation[];
  commentary: Record<string, string[]>;
}

export const TYPE_LABEL: Record<NoteType, string> = {
  foreign: "French",
  allusion: "Allusion",
  context: "Context",
  translation: "Translation",
  term: "Wordplay",
  idea: "Idea",
  vocab: "Word",
};

export const VOICE_LABEL: Record<string, string> = {
  correader: "Co-reader",
  scholarly: "Scholarly",
};
