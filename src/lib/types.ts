export interface FigureItem {
  value: string;
  label: string;
}

export type Block =
  | { type: "p"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "steps"; items: string[] }
  | { type: "callout"; variant?: "ok" | "warn" | "risk"; text: string }
  | { type: "card"; text: string }
  | { type: "kv"; entries: { k: string; v: string }[] }
  | { type: "figures"; items: FigureItem[] }
  | { type: "table"; columns: string[]; num?: number[]; rows: string[][] }
  | {
      type: "bars";
      items: { label: string; value: number; display: string }[];
      max?: number;
    }
  | {
      type: "compare";
      wide?: boolean;
      cards: {
        pick?: boolean;
        heading: string;
        text?: string;
        pros?: string[];
        cons?: string[];
      }[];
    }
  | { type: "pair"; tr: string; orig: string; origLang: string }
  | { type: "details"; summary: string; pre?: string; body?: string[] }
  | { type: "figure"; svg: string; caption: string; wide?: boolean };

export interface Section {
  heading: string;
  blocks: Block[];
}

export interface ChoiceOption {
  value: string;
  label: string;
  desc?: string;
}

export type Question =
  | {
      type: "choice";
      id: string;
      text: string;
      hint?: string;
      cols?: boolean;
      note?: boolean;
      multiple?: boolean;
      options: ChoiceOption[];
    }
  | {
      type: "verdict";
      id: string;
      text: string;
      items: {
        id: string;
        label: string;
        chip?: string;
        hint?: string;
        verdicts: { value: string; label: string; tone?: "ok" | "warn" | "risk" }[];
      }[];
    }
  | {
      type: "text";
      id: string;
      text: string;
      hint?: string;
      multiline?: boolean;
      placeholder?: string;
    };

export interface Review {
  questions: Question[];
}

export interface Report {
  lang: string;
  title: string;
  kicker?: string;
  meta?: string;
  summary: string[];
  sections: Section[];
  review?: Review;
}
