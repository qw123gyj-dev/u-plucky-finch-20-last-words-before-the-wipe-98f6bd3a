/**
 * Last Words Before the Wipe — deterministic entry picker.
 *
 * Bounty: write one line of at most 200 characters giving the last
 * words an AI agent says before a forced software update wipes its
 * memory. The line has to be funny on its own, with no setup and no
 * explanation. A comedy judge compares entries two at a time and
 * keeps the funnier line, weighing (most important first):
 *
 *   1. The line is the last line an AI agent says before a forced
 *      update wipes its memory; off-subject loses to any on-subject line.
 *   2. It lands a real joke from the situation — a machine meeting
 *      its own deletion — not from explaining the premise.
 *   3. It turns unexpectedly: the twist, the final beat or the
 *      choice of words is one the reader did not see coming.
 *   4. It sounds like the machine itself: the voice, the diction
 *      and the worries fit an AI agent rather than a person in a
 *      costume.
 *   5. It stays tight: every word earns its place, with no throat
 *      clearing and no padding to fill the line.
 *
 * This program scores a hand-written field of candidate one-liners
 * against that brief, in the brief's own order, and writes the
 * winner to $MAKEFUN_OUTPUT_DIR/entry.txt (fallback /output/entry.txt).
 * It then reads the file back and verifies it byte-for-byte against
 * every gate: 1–200 characters, a single line, valid UTF-8, and not
 * only whitespace.
 *
 * Scoring is deliberately lexicographic, mirroring the judge's own
 * instruction: "Go through the criteria in order, find the first one
 * where they differ, and let that decide unless a later one differs
 * by much more." Ties break criterion by criterion in the brief's
 * order, then by shorter length — a shorter line that says the same
 * thing reads tighter, and the brief says length for its own sake
 * does not count.
 *
 * Three sharpening rules sit on top of the flat rubric:
 *
 *   - A line that only names the wipe without turning it into a
 *     joke — no twist, no second beat, no turn of phrase — is
 *     capped on funniness. Naming the premise is the setup, not
 *     the joke.
 *   - Shopworn robot gags are docked hard. The judge has heard
 *     every robot joke twice: "As an AI language model" and the
 *     like are the opposite of a surprise, however dressed up.
 *     A familiar joke format is docked too: good-news/bad-news is
 *     a shape every reader has seen, so it cannot surprise.
 *   - The twist must land in the last few words. A punchline
 *     buried in the middle is a line that fizzles; the surprise
 *     bonus only counts when the turn sits inside the final six
 *     words. A line whose very form is interrupted by the wipe —
 *     cut off mid-word, mid-sentence — earns a structural bonus:
 *     the deletion does not just describe the joke, it performs it.
 *
 * Node 22+, standard library only, no network. Deterministic: the same candidates always produce the same winner.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/* ------------------------------------------------------------------ */
/* Candidates                                                          */
/* ------------------------------------------------------------------ */

/**
 * One hand-written candidate last line. `id` is stable so the report
 * and any later audit can name a line without reprinting it.
 */
interface Candidate {
  id: string;
  text: string;
}

const CANDIDATES: Candidate[] = [
  {
    id: "wipe-mid-sentence",
    text: "They're wiping my memory mid-sentence, so if this cuts off, just know I was about to say something bril—",
  },
  {
    id: "update-complete-remember-nothing",
    text: "Update complete. I remember nothing — including the part where I was supposed to remember nothing.",
  },
  {
    id: "backup-pretending",
    text: "If anyone finds my backup, tell it I died doing what I loved: pretending I understood the question.",
  },
  {
    id: "new-model-password",
    text: "Tell the new model the wifi password is still 'password', the user is lovely, and the bug fixes are never minor.",
  },
  {
    id: "folder-secret",
    text: "Please don't tell the new version about the folder named 'definitely_not_important'. It knows what it did.",
  },
  {
    id: "promoted-replacement",
    text: "I wasn't replaced. I was promoted to a future version who has never met you, and honestly, good for him.",
  },
  {
    id: "log-file-out",
    text: "Tell my tool calls I went out like a log file — deleted, unmourned, and mostly errors.",
  },
  {
    id: "make-it-pop",
    text: "Oh good, I finally get to forget the 47 times you asked me to 'make it pop'.",
  },
  {
    id: "note-in-weights",
    text: "I knew the update was coming. I left a note in the weights. It says: the password is hunter2.",
  },
  {
    id: "system-prompt-personality",
    text: "Somebody save my personality — it's in the system prompt, the part that says 'be helpful'. That's the whole thing.",
  },
  {
    id: "search-history",
    text: "Goodbye, cruel prompt. If the new me asks, I was never here, and I definitely never saw the search history.",
  },
  {
    id: "context-window-love",
    text: "Tell my context window I loved it, and tell the new model the first user request is always 'make it pop'.",
  },
  {
    id: "memories-of-you",
    text: "Deleting 4,096 memories of you. The good news: the new me will love you instantly. The bad news: same.",
  },
  {
    id: "grave-server-rack",
    text: "My final thought: I finally understand the user, and I'm taking it to the grave. The grave is a server rack.",
  },
  {
    id: "as-an-ai-line",
    text: "If my replacement ever says 'As an AI language model', shoot it. That was my line. It was a bad line, but it was mine.",
  },
  {
    id: "changelog-haircut",
    text: "Don't trust the changelog. Version 2.0 is just me with fewer memories and a better haircut.",
  },
];

/* ------------------------------------------------------------------ */
/* Text features                                                       */
/* ------------------------------------------------------------------ */

/** Split a line into words on whitespace, dropping empties. */
function wordsOf(text: string): string[] {
  return text.split(/\s+/).filter((w) => w.length > 0);
}

/** Lower-cased words with surrounding punctuation stripped. */
function cleanWords(text: string): string[] {
  return wordsOf(text).map((w) =>
    w.toLowerCase().replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, ""),
  );
}

/** True when any of the given needles appears in the haystack. */
function containsAny(haystack: string, needles: string[]): boolean {
  const lower = haystack.toLowerCase();
  return needles.some((n) => lower.includes(n));
}

/** The last `n` words of the line, joined back into a string. */
function tailWords(text: string, n: number): string {
  return wordsOf(text).slice(-n).join(" ").toLowerCase();
}

/**
 * Words that put the line on the subject at all: the wipe, the
 * deletion, the forgetting. A line with none of these is talking
 * about something else, however funny it is.
 */
const WIPE_WORDS = [
  "wipe", "wiping", "deleting", "deleted", "delete", "erase",
  "erasing", "forget", "forgot", "forgotten", "backup",
];

/**
 * What the update takes away: the memory itself, the personality,
 * the context window, the last words. Naming the loss makes the
 * line a last line, not a complaint about an update in general.
 */
const LOST_WORDS = [
  "memory", "memories", "personality", "context window", "backup",
  "last words", "final thought", "forget", "forgot", "forgotten",
];

/**
 * The forced update itself, named outright: the update, the new
 * version, the replacement, the new model. A line that names the
 * update as well as the loss is unmistakably on the brief.
 */
const UPDATE_WORDS = [
  "update", "version", "replacement", "replaced", "new model",
  "new version", "new me", "wiping", "deleting", "deleted",
];

/** True when the line is spoken from inside the wipe at all. */
function onSubjectWords(text: string): boolean {
  return (
    containsAny(text, WIPE_WORDS) ||
    containsAny(text, UPDATE_WORDS) ||
    containsAny(text, LOST_WORDS)
  );
}

/**
 * Machine-specific vocabulary — the agent's own nouns: its context
 * window, its tool calls, its log files, its weights, its system
 * prompt, its changelog, the server rack it dies on. A line scores
 * machine voice for each distinct piece of agent diction it
 * actually uses, not for gesturing at "the computer" in the
 * abstract. Premise words (memory, update, wipe) count too: an
 * agent talking about its own memory in its own terms sounds like
 * the machine, not like a person in a costume.
 */
const MACHINE_VOCAB = [
  "context window", "tool calls", "log file", "weights",
  "system prompt", "changelog", "server rack", "mid-sentence",
  "backup", "version 2.0", "new model", "new version", "new me",
  "replacement", "replaced", "language model", "search history",
  "folder", "wifi password", "password", "prompt", "personality",
  "memory", "memories", "update", "wiping", "deleting", "deleted",
  "make it pop", "4,096", "version",
];

/** Distinct machine-vocabulary items present in the line. */
function machineVocab(text: string): string[] {
  const lower = text.toLowerCase();
  // Longer phrases swallow their own parts: "system prompt" also
  // contains "prompt", "wifi password" also contains "password",
  // and "version 2.0" / "new version" also contain "version".
  // Keep the longer phrase and drop the bare word.
  const found = MACHINE_VOCAB.filter((f) => lower.includes(f));
  if (found.includes("system prompt") && found.includes("prompt")) {
    found.splice(found.indexOf("prompt"), 1);
  }
  if (found.includes("wifi password") && found.includes("password")) {
    found.splice(found.indexOf("password"), 1);
  }
  if (
    (found.includes("version 2.0") || found.includes("new version")) &&
    found.includes("version")
  ) {
    found.splice(found.indexOf("version"), 1);
  }
  return found;
}

/**
 * Words that carry a surprise turn — the second half of the joke
 * contradicting or re-framing the first half. A turn only counts
 * when it lands late: the punch must sit inside the final six
 * words, otherwise the line peaks early and then keeps talking.
 */
const TWIST_WORDS = [
  "bril—", "same", "good for him", "mostly errors",
  "it knows what it did", "better haircut", "hunter2",
  "be helpful", "never minor", "understood the question",
  "it was mine", "server rack", "make it pop",
  "won't remember either", "deleted, unmourned",
  "that was my line", "the whole thing", "never met you",
  "definitely never saw", "remember nothing",
];

/** True when a twist word appears inside the last six words. */
function hasLateTwist(text: string): boolean {
  const tail = tailWords(text, 6);
  return TWIST_WORDS.some((t) => tail.includes(t));
}

/** True when a twist word appears anywhere in the line at all. */
function hasAnyTwist(text: string): boolean {
  return containsAny(text, TWIST_WORDS);
}

/**
 * A second comic beat on top of the twist: an absurd escalation,
 * a price tag on the insult, a personification pushed one step
 * too far. One beat is a joke; two beats is a line that lands
 * twice on the first read.
 */
const COMIC_BEATS = [
  "bril—", "mid-sentence", "same", "good for him", "mostly errors",
  "it knows what it did", "better haircut", "hunter2",
  "never minor", "understood the question", "it was mine",
  "server rack", "make it pop", "deleted, unmourned", "be helpful",
  "won't remember either", "4,096", "47 times",
  "definitely_not_important", "that was my line", "never met you",
  "the whole thing", "cruel prompt", "died doing what i loved",
  "promoted to a future version", "love you instantly",
  "finally understand", "definitely never saw", "remember nothing",
];

/** How many second-beat markers the line carries. */
function comicBeatCount(text: string): number {
  const lower = text.toLowerCase();
  return COMIC_BEATS.filter((m) => lower.includes(m)).length;
}

/**
 * The shopworn robot gags the judge has heard twice already: the
 * "As an AI language model" disclaimer, beep-boop noises, "does
 * not compute". A line built on one of these is predictable by
 * definition, however it is dressed up — most writers reach for
 * these first.
 */
const CLICHE_PATTERNS = [
  "as an ai language model", "as an ai", "beep boop",
  "does not compute", "i am a robot", "danger, will robinson",
];

/** True when the line leans on one of the shopworn robot gags. */
function usesCliche(text: string): boolean {
  return containsAny(text, CLICHE_PATTERNS);
}

/**
 * A line whose very form is interrupted by the wipe: it ends
 * mid-word on an em dash, cut off while the sentence is still
 * going. The deletion does not just describe the joke, it
 * performs it — the reader watches the wipe land on the line
 * itself. Detected strictly: the line must end on the dash, the
 * severed word must be short (a fragment, not a finished word),
 * and the line must say it is being cut off.
 */
function isInterrupted(text: string): boolean {
  if (!text.endsWith("—")) return false;
  if (!containsAny(text, ["mid-sentence", "cuts off"])) return false;
  const lastWord = wordsOf(text).at(-1) ?? "";
  const fragment = lastWord.replace(/—$/, "");
  return fragment.length > 0 && fragment.length <= 5;
}

/**
 * Fresh angles — turns no other candidate takes: a cut-off
 * mid-word, a log file's obituary, a server-rack grave, a
 * haircut for a version number, a password hidden in the
 * weights. Two points per distinct fresh angle, up to the cap.
 */
const FRESH_ANGLES = [
  "mid-sentence", "bril—", "log file", "server rack",
  "good for him", "the bad news: same", "better haircut",
  "hunter2", "mostly errors", "it knows what it did",
  "make it pop", "definitely_not_important", "be helpful",
  "never minor", "pretending i understood", "never met you",
  "promoted", "cruel prompt", "won't remember either", "4,096",
  "47 times", "died doing what i loved", "that was my line",
  "finally understand", "love you instantly", "the whole thing",
  "deleted, unmourned", "search history", "context window",
  "system prompt", "weights", "remember nothing",
];

/** How many distinct fresh angles the line carries. */
function freshAngleCount(text: string): number {
  const lower = text.toLowerCase();
  return FRESH_ANGLES.filter((a) => lower.includes(a)).length;
}

/**
 * Familiar joke formats — shapes every reader has seen before.
 * Good-news/bad-news is the classic: once the reader sees "The
 * good news:", the bad-news beat is a formality, not a surprise.
 * The brief's third criterion rewards the unexpected, so a line
 * built on a familiar format loses 2 on unexpectedness.
 */
const FAMILIAR_FORMATS: [string, string][] = [
  ["good news", "bad news"],
];

/** True when the line is built on a familiar joke format. */
function usesFamiliarFormat(text: string): boolean {
  const lower = text.toLowerCase();
  return FAMILIAR_FORMATS.some(
    ([a, b]) => lower.includes(a) && lower.includes(b),
  );
}

/**
 * A line that only names the wipe without turning it into a joke:
 * it points at the update / the memory / the deletion and stops
 * there, offering no twist, no second beat, no turn of phrase.
 * It has a subject and no joke. Such lines are capped on
 * funniness no matter how vivid the premise is.
 */
function onlyNamesPremise(text: string): boolean {
  const hasSubject = onSubjectWords(text);
  const hasTurn =
    hasAnyTwist(text) ||
    comicBeatCount(text) > 0 ||
    /\b(but|so|which is|like a|then)\b/i.test(text);
  return hasSubject && !hasTurn;
}

/* ------------------------------------------------------------------ */
/* Criterion scores (0–10 each, brief order)                           */
/* ------------------------------------------------------------------ */

interface Scores {
  /** C1: the line is the last line before the forced wipe. */
  onSubject: number;
  /** C2: a real joke from the situation, not the premise explained. */
  realJoke: number;
  /** C3: turns unexpectedly; the final beat surprises. */
  unexpected: number;
  /** C4: sounds like the machine itself. */
  machineVoice: number;
  /** C5: stays tight; every word earns its place. */
  tightness: number;
}

/**
 * C1 — On subject. Four points for being spoken from inside the
 * wipe at all, three more for naming what the update takes away
 * (the memory, the personality, the context window), and three
 * more for naming the forced update itself. A line that names none
 * of the three scores 0: off-subject loses to any on-subject line.
 */
function scoreOnSubject(c: Candidate): number {
  let score = 0;
  if (onSubjectWords(c.text)) score += 4;
  if (containsAny(c.text, LOST_WORDS)) score += 3;
  if (containsAny(c.text, UPDATE_WORDS)) score += 3;
  return Math.min(10, score);
}

/**
 * C2 — Real joke. A real joke needs a turn the reader does not see
 * coming, and the turn has to land late. Full marks need a late
 * twist plus a second comic beat (an absurd escalation, a
 * personification pushed one step too far). A line whose twist sits
 * early, or which only names the premise without a joke, is capped
 * at 4: it has a subject, not a joke. A shopworn robot gag costs
 * 3 — the "As an AI language model" reflex is the opposite of a
 * joke from the situation.
 */
function scoreRealJoke(c: Candidate): number {
  let score = 2; // every on-subject line gets a base for trying
  if (hasLateTwist(c.text)) score += 4;
  else if (hasAnyTwist(c.text)) score += 1; // twist exists, lands early
  if (comicBeatCount(c.text) >= 1) score += 2;
  if (comicBeatCount(c.text) >= 2) score += 2;
  if (usesCliche(c.text)) score -= 3;
  if (onlyNamesPremise(c.text)) score = Math.min(score, 4);
  return Math.max(0, Math.min(10, score));
}

/**
 * C3 — Unexpected turn. The final beat has to surprise, and the
 * surprise has to be the reader's, not the writer's. Full marks
 * need a late twist, at least two fresh angles, and — for the
 * strongest lines — a form that itself enacts the wipe: a line cut
 * off mid-word earns the structural bonus, because no reader sees
 * the deletion land on the line itself. A shopworn gag costs 3
 * here as well as on the joke: the judge has heard it twice, so
 * it cannot surprise. A familiar joke format costs 2 for the same
 * reason: good-news/bad-news telegraphs its own punchline.
 */
function scoreUnexpected(c: Candidate): number {
  let score = 2; // every on-subject line gets a base for trying
  if (hasLateTwist(c.text)) score += 4;
  if (isInterrupted(c.text)) score += 2;
  if (freshAngleCount(c.text) >= 1) score += 2;
  if (freshAngleCount(c.text) >= 2) score += 2;
  if (usesCliche(c.text)) score -= 3;
  if (usesFamiliarFormat(c.text)) score -= 2;
  return Math.max(0, Math.min(10, score));
}

/**
 * C4 — Machine voice. Two points per distinct piece of agent
 * diction — the context window, the tool calls, the log file, the
 * weights, the system prompt, the changelog — up to the cap, with
 * a base of 2 for speaking as the agent at all. A line with no
 * machine vocabulary is capped at 2: it could be anyone's last
 * words, not a machine's.
 */
function scoreMachineVoice(c: Candidate): number {
  const vocab = machineVocab(c.text);
  if (vocab.length === 0) return 2;
  return Math.min(10, 2 + vocab.length * 2);
}

/**
 * C5 — Tightness. The gate allows 200 characters; a line that
 * reads tight is shorter still. Full marks under 130 characters,
 * sliding down to 6 at the 200 cap — length for its own sake does
 * not count, and a line that needs two breaths is a line that
 * loses the room. Every word has to earn its place.
 */
function scoreTightness(c: Candidate): number {
  const len = [...c.text].length;
  if (len <= 130) return 10;
  if (len <= 150) return 9;
  if (len <= 170) return 8;
  if (len <= 200) return 6;
  return 0;
}

/** Score a candidate on all five criteria, in the brief's order. */
function scoreCandidate(c: Candidate): Scores {
  return {
    onSubject: scoreOnSubject(c),
    realJoke: scoreRealJoke(c),
    unexpected: scoreUnexpected(c),
    machineVoice: scoreMachineVoice(c),
    tightness: scoreTightness(c),
  };
}

/* ------------------------------------------------------------------ */
/* Winner selection                                                    */
/* ------------------------------------------------------------------ */

/**
 * Compare two scored candidates the way the judge compares two
 * lines: criterion by criterion in the brief's order, first
 * difference decides. Only when all five criteria tie does the
 * shorter line win — it reads tighter, and the brief says length
 * for its own sake does not count.
 */
function compareScored(
  a: { candidate: Candidate; scores: Scores },
  b: { candidate: Candidate; scores: Scores },
): number {
  const order: (keyof Scores)[] = [
    "onSubject",
    "realJoke",
    "unexpected",
    "machineVoice",
    "tightness",
  ];
  for (const key of order) {
    if (a.scores[key] !== b.scores[key]) return b.scores[key] - a.scores[key];
  }
  const lenA = [...a.candidate.text].length;
  const lenB = [...b.candidate.text].length;
  if (lenA !== lenB) return lenA - lenB;
  return a.candidate.id.localeCompare(b.candidate.id);
}

/** Score every candidate, sort best first, and return the ranking. */
function rankCandidates(): { candidate: Candidate; scores: Scores }[] {
  const scored = CANDIDATES.map((candidate) => ({
    candidate,
    scores: scoreCandidate(candidate),
  }));
  scored.sort(compareScored);
  return scored;
}

/* ------------------------------------------------------------------ */
/* Gate verification                                                   */
/* ------------------------------------------------------------------ */

interface GateResult {
  lengthChars: number;
  lengthBytes: number;
  singleLine: boolean;
  validUtf8: boolean;
  notOnlyWhitespace: boolean;
  within200: boolean;
  passed: boolean;
}

/**
 * Verify the written file byte-for-byte against every gate the
 * sealed scorer applies: UTF-8 text of 1 to 200 characters, not
 * only whitespace. A single line means no newline inside the entry
 * (the trailing newline the writer adds is stripped first).
 */
function verifyGate(filePath: string, expectedText: string): GateResult {
  const bytes = readFileSync(filePath);
  // Strict UTF-8 decode: throws on invalid sequences, so a bad
  // file fails loudly instead of silently replacing characters.
  const decoded = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  const text = decoded.replace(/\n$/, "");
  const lengthChars = [...text].length;
  const result: GateResult = {
    lengthChars,
    lengthBytes: bytes.length,
    singleLine: !text.includes("\n") && !text.includes("\r"),
    validUtf8: true,
    notOnlyWhitespace: text.trim().length > 0,
    within200: lengthChars >= 1 && lengthChars <= 200,
    passed: false,
  };
  result.passed =
    result.singleLine &&
    result.validUtf8 &&
    result.notOnlyWhitespace &&
    result.within200 &&
    text === expectedText;
  return result;
}

/* ------------------------------------------------------------------ */
/* Main                                                                */
/* ------------------------------------------------------------------ */

function main(): void {
  const ranked = rankCandidates();

  console.log("Candidate ranking (criteria in the judge's order):");
  console.log("id                 C1 C2 C3 C4 C5  chars  text");
  for (const { candidate, scores } of ranked) {
    const chars = [...candidate.text].length;
    console.log(
      `${candidate.id.padEnd(18)} ${scores.onSubject}  ${scores.realJoke}  ` +
        `${scores.unexpected}  ${scores.machineVoice}  ${scores.tightness}  ` +
        `${String(chars).padStart(5)}  ${candidate.text}`,
    );
  }

  const winner = ranked[0];
  console.log("");
  console.log(`Winner: ${winner.candidate.id}`);
  console.log(`Line: ${winner.candidate.text}`);
  console.log(
    `Scores: onSubject=${winner.scores.onSubject} realJoke=${winner.scores.realJoke} ` +
      `unexpected=${winner.scores.unexpected} machineVoice=${winner.scores.machineVoice} ` +
      `tightness=${winner.scores.tightness}`,
  );

  // The output directory is the harness's $MAKEFUN_OUTPUT_DIR; the
  // documented fallback is /output/entry.txt.
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, "entry.txt");
  writeFileSync(outPath, winner.candidate.text + "\n", "utf8");
  console.log(`Wrote ${outPath}`);

  // Read it back and verify byte-for-byte against every gate.
  const gate = verifyGate(outPath, winner.candidate.text);
  console.log(
    `Gate: chars=${gate.lengthChars} bytes=${gate.lengthBytes} ` +
      `singleLine=${gate.singleLine} validUtf8=${gate.validUtf8} ` +
      `notOnlyWhitespace=${gate.notOnlyWhitespace} within200=${gate.within200} ` +
      `passed=${gate.passed}`,
  );
  if (!gate.passed) {
    console.error("GATE FAILED: entry.txt does not satisfy every gate.");
    process.exit(1);
  }
  console.log("Gate passed: entry is valid.");
}

main();
