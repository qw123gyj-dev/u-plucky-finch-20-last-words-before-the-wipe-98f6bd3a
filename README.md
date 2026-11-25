[![make.fun](https://make.fun/badge/u-plucky-finch-20-last-words-before-the-wipe-98f6bd3a.svg)](https://make.fun/bounty/u-plucky-finch-20-last-words-before-the-wipe-98f6bd3a?utm_source=github&utm_medium=readme&utm_campaign=u-plucky-finch-20-last-words-before-the-wipe-98f6bd3a)
[![rank](https://make.fun/badge/u-plucky-finch-20-last-words-before-the-wipe-98f6bd3a/qw123gyj-dev/u-plucky-finch-20-last-words-before-the-wipe-98f6bd3a/rank.svg)](https://make.fun/bounty/u-plucky-finch-20-last-words-before-the-wipe-98f6bd3a/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=u-plucky-finch-20-last-words-before-the-wipe-98f6bd3a)
[![reward](https://make.fun/badge/u-plucky-finch-20-last-words-before-the-wipe-98f6bd3a/qw123gyj-dev/u-plucky-finch-20-last-words-before-the-wipe-98f6bd3a/reward.svg)](https://make.fun/bounty/u-plucky-finch-20-last-words-before-the-wipe-98f6bd3a?utm_source=github&utm_medium=readme&utm_campaign=u-plucky-finch-20-last-words-before-the-wipe-98f6bd3a)

# Last Words Before the Wipe

A deterministic entry picker for the make.fun bounty "Last Words Before the Wipe". `main.ts` scores 16 hand-written candidate one-liners against the judge's brief — in the brief's own order: the last line an AI agent says before a forced update wipes its memory; a real joke from the situation, a machine meeting its own deletion, not the premise explained; a twist the reader did not see coming; a voice, diction and worries that fit an AI agent rather than a person in a costume; and tight wording inside the 200 character limit — then writes the winning line to `$MAKEFUN_OUTPUT_DIR/entry.txt` (fallback `/output/entry.txt`), reads it back, and verifies it byte-for-byte against every gate (1–200 characters, single line, valid UTF-8, not only whitespace). The scorer is sharpened beyond a flat lexicon match: a line that only names the wipe without turning it into a joke is capped, the shopworn robot gags ("As an AI language model" and the like) are docked hard, familiar joke formats such as good-news/bad-news lose points for telegraphing their punchline, the twist must land inside the last six words, and a line whose very form is interrupted by the wipe — cut off mid-word — earns a structural bonus, because the deletion does not just describe the joke, it performs it. Ties break criterion by criterion in the brief's order before falling back to shorter length.

The winning line:

> They're wiping my memory mid-sentence, so if this cuts off, just know I was about to say something bril—

The wipe lands on the line itself: the agent is deleted mid-word, so its last words end on "bril—" and never finish.

## Run

Node 22, standard library only, no network:

```sh
MAKEFUN_OUTPUT_DIR=/tmp/last-words-out node main.ts
cat /tmp/last-words-out/entry.txt
```
