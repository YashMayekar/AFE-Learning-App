import assert from "node:assert/strict";
import test from "node:test";

import { computeStreamingDelta } from "./sherpa";

test("computeStreamingDelta returns only newly appended words", () => {
    assert.equal(computeStreamingDelta("hello", "hello world"), "world");
    assert.equal(computeStreamingDelta("hello world", "hello world again"), "again");
});

test("computeStreamingDelta ignores duplicate or stale partials", () => {
    assert.equal(computeStreamingDelta("hello world", "hello world"), "");
    assert.equal(computeStreamingDelta("hello world", "hello world! "), "!");
});
