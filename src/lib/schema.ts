import { z } from "zod";

const figureItem = z.object({ value: z.string(), label: z.string() });

const block = z.discriminatedUnion("type", [
  z.object({ type: z.literal("p"), id: z.string().optional(), text: z.string() }),
  z.object({ type: z.literal("ul"), id: z.string().optional(), items: z.string().array() }),
  z.object({ type: z.literal("ol"), id: z.string().optional(), items: z.string().array() }),
  z.object({ type: z.literal("steps"), id: z.string().optional(), items: z.string().array() }),
  z.object({
    type: z.literal("callout"),
    id: z.string().optional(),
    variant: z.enum(["ok", "warn", "risk"]).optional(),
    text: z.string(),
  }),
  z.object({ type: z.literal("card"), id: z.string().optional(), text: z.string() }),
  z.object({
    type: z.literal("kv"),
    id: z.string().optional(),
    entries: z.object({ k: z.string(), v: z.string() }).array(),
  }),
  z.object({
    type: z.literal("figures"),
    id: z.string().optional(),
    items: figureItem.array(),
  }),
  z.object({
    type: z.literal("table"),
    id: z.string().optional(),
    columns: z.string().array(),
    num: z.number().int().nonnegative().array().optional(),
    rows: z.string().array().array(),
  }),
  z.object({
    type: z.literal("bars"),
    id: z.string().optional(),
    items: z.object({ label: z.string(), value: z.number(), display: z.string() }).array(),
    max: z.number().positive().optional(),
  }),
  z.object({
    type: z.literal("compare"),
    id: z.string().optional(),
    wide: z.boolean().optional(),
    cards: z
      .object({
        pick: z.boolean().optional(),
        badge: z.string().optional(),
        heading: z.string(),
        text: z.string().optional(),
        pros: z.string().array().optional(),
        cons: z.string().array().optional(),
      })
      .array(),
  }),
  z.object({
    type: z.literal("pair"),
    id: z.string().optional(),
    tr: z.string(),
    orig: z.string(),
    origLang: z.string(),
  }),
  z.object({
    type: z.literal("details"),
    id: z.string().optional(),
    summary: z.string(),
    pre: z.string().optional(),
    body: z.string().array().optional(),
  }),
  z.object({
    type: z.literal("figure"),
    id: z.string().optional(),
    svg: z.string(),
    caption: z.string(),
    wide: z.boolean().optional(),
  }),
]);

const section = z.object({
  id: z.string().optional(),
  heading: z.string(),
  blocks: block.array(),
});

const choiceOption = z.object({
  value: z.string(),
  label: z.string(),
  desc: z.string().optional(),
});

const question = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("choice"),
    id: z.string(),
    text: z.string(),
    hint: z.string().optional(),
    cols: z.boolean().optional(),
    note: z.boolean().optional(),
    multiple: z.boolean().optional(),
    options: choiceOption.array(),
  }),
  z.object({
    type: z.literal("verdict"),
    id: z.string(),
    text: z.string(),
    items: z
      .object({
        id: z.string(),
        label: z.string(),
        chip: z.string().optional(),
        hint: z.string().optional(),
        verdicts: z
          .object({
            value: z.string(),
            label: z.string(),
            tone: z.enum(["ok", "warn", "risk"]).optional(),
          })
          .array(),
      })
      .array(),
  }),
  z.object({
    type: z.literal("text"),
    id: z.string(),
    text: z.string(),
    hint: z.string().optional(),
    multiline: z.boolean().optional(),
    placeholder: z.string().optional(),
  }),
]);

const review = z.object({ questions: question.array() });

export const reportSchema = z.object({
  lang: z.string(),
  title: z.string(),
  kicker: z.string().optional(),
  meta: z.string().optional(),
  summary: z.string().array(),
  sections: section.array(),
  review: review.optional(),
});

export type Block = z.infer<typeof block>;
export type Section = z.infer<typeof section>;
export type Question = z.infer<typeof question>;
export type Review = z.infer<typeof review>;
export type Report = z.infer<typeof reportSchema>;
export type FigureItem = z.infer<typeof figureItem>;
