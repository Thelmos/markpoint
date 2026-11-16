import { test } from "node:test";
import assert from "node:assert/strict";
import { parseDeck, slideAtLine } from "../src/lib/parser.ts";

// 1  ---
// 2  title: Demo
// 3  ---
// 4
// 5  # First
// 6
// 7  Body
// 8
// 9  ---
// 10
// 11 # Second
// 12
// 13 Body
// 14
// 15 ---
// 16 # Third
const DECK = `---
title: Demo
---

# First

Body

---

# Second

Body

---
# Third
`;

const slides = parseDeck(DECK).slides;

test("slideAtLine maps content lines to their slide", () => {
  assert.deepEqual(
    slides.map((slide) => [slide.startLine, slide.endLine, slide.separatorLine]),
    [
      [5, 7, null],
      [11, 13, 9],
      [16, 16, 15],
    ],
  );
  assert.equal(slideAtLine(slides, 5), 0);
  assert.equal(slideAtLine(slides, 7), 0);
  assert.equal(slideAtLine(slides, 11), 1);
  assert.equal(slideAtLine(slides, 13), 1);
  assert.equal(slideAtLine(slides, 16), 2);
});

test("slideAtLine keeps the previous slide up to the separator", () => {
  // Regression: the blank line and the `---` before a slide used to select
  // the following slide while the cursor was still editing the current one.
  assert.equal(slideAtLine(slides, 8), 0);
  assert.equal(slideAtLine(slides, 9), 0);
  assert.equal(slideAtLine(slides, 14), 1);
  assert.equal(slideAtLine(slides, 15), 1);
});

test("slideAtLine selects the next slide after the separator", () => {
  // Regression: blank lines after the separator used to keep the previous
  // slide selected instead of the one being edited.
  assert.equal(slideAtLine(slides, 10), 1);
  assert.equal(slideAtLine(slides, 12), 1);
});

test("slideAtLine handles several blank lines around separators", () => {
  const before = parseDeck("# A\n\n\n---\n# B\n").slides;
  assert.deepEqual(
    before.map((slide) => [slide.startLine, slide.endLine, slide.separatorLine]),
    [
      [1, 1, null],
      [5, 5, 4],
    ],
  );
  assert.equal(slideAtLine(before, 2), 0);
  assert.equal(slideAtLine(before, 3), 0);
  assert.equal(slideAtLine(before, 4), 0);
  assert.equal(slideAtLine(before, 5), 1);

  const after = parseDeck("# A\n---\n\n\n# B\n").slides;
  assert.equal(slideAtLine(after, 2), 0);
  assert.equal(slideAtLine(after, 3), 1);
  assert.equal(slideAtLine(after, 4), 1);
  assert.equal(slideAtLine(after, 5), 1);
});

test("slideAtLine falls back to the nearest slide outside the deck", () => {
  // Front matter and leading blanks belong to the first slide.
  assert.equal(slideAtLine(slides, 1), 0);
  assert.equal(slideAtLine(slides, 3), 0);
  assert.equal(slideAtLine(slides, 4), 0);
  // Anything after the last slide stays on the last slide.
  assert.equal(slideAtLine(slides, 99), 2);
  assert.equal(slideAtLine([], 5), 0);
});
