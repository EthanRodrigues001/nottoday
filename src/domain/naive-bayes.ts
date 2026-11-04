import { tokenize } from './text.ts';

/**
 * A small word-based model that learns from the user's own taps in the Inbox: "Add" is a yes,
 * "Dismiss" is a no, and a message the user marks as missed is a yes. It only runs on the phone,
 * and with a few hundred short texts it trains in a fraction of a second.
 */

export type Label = 'yes' | 'no';
export type Example = { text: string; label: Label };

export type Model = {
  yes: Map<string, number>;
  no: Map<string, number>;
  yesTotal: number;
  noTotal: number;
  yesDocs: number;
  noDocs: number;
  vocabulary: number;
};

/** Words and pairs of neighbouring words, each counted once per message. */
export function features(text: string): string[] {
  const words = tokenize(text);
  const out = new Set<string>(words);
  for (let i = 0; i + 1 < words.length; i++) out.add(`${words[i]}_${words[i + 1]}`);
  return [...out];
}

export function train(examples: readonly Example[]): Model {
  const model: Model = { yes: new Map(), no: new Map(), yesTotal: 0, noTotal: 0, yesDocs: 0, noDocs: 0, vocabulary: 0 };
  const seen = new Set<string>();
  for (const ex of examples) {
    const counts = ex.label === 'yes' ? model.yes : model.no;
    if (ex.label === 'yes') model.yesDocs++;
    else model.noDocs++;
    for (const f of features(ex.text)) {
      counts.set(f, (counts.get(f) ?? 0) + 1);
      if (ex.label === 'yes') model.yesTotal++;
      else model.noTotal++;
      seen.add(f);
    }
  }
  model.vocabulary = seen.size;
  return model;
}

/** Enough of both kinds to say anything. Below this the model stays out of the way and the rules decide. */
export const MIN_PER_CLASS = 5;
export const MIN_TOTAL = 20;

export function isUsable(model: Model): boolean {
  return model.yesDocs >= MIN_PER_CLASS && model.noDocs >= MIN_PER_CLASS && model.yesDocs + model.noDocs >= MIN_TOTAL;
}

/** Probability, 0 to 1, that the user would want this message as a task. */
export function predict(model: Model, text: string): number {
  const docs = model.yesDocs + model.noDocs;
  let yes = Math.log((model.yesDocs + 1) / (docs + 2));
  let no = Math.log((model.noDocs + 1) / (docs + 2));
  const v = Math.max(1, model.vocabulary);
  for (const f of features(text)) {
    yes += Math.log(((model.yes.get(f) ?? 0) + 1) / (model.yesTotal + v));
    no += Math.log(((model.no.get(f) ?? 0) + 1) / (model.noTotal + v));
  }
  // Both scores are log-probabilities; turn the gap into a share, guarding against overflow.
  const gap = Math.max(-30, Math.min(30, yes - no));
  return 1 / (1 + Math.exp(-gap));
}
