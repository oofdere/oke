import { assertEquals } from "@std/assert";
import {
    NondeterministicTokenizer,
    compress,
    decompress,
    compareCompression,
    getCompressionStats,
    selectiveCompress,
} from "./mod.ts";

Deno.test("Compression - compress and decompress", () => {
    const vocab = {
        tokens: ["h", "e", "l", "o", " ", "w", "r", "d", "he", "ll", "hello", "world"],
    };

    const tokenizer = new NondeterministicTokenizer(vocab);
    const text = "hello world";

    const compressed = compress(tokenizer, text);
    const decompressed = decompress(tokenizer, compressed.tokens);

    // Should round-trip correctly
    assertEquals(decompressed, text);

    // Compression should use longest tokens
    assertEquals(compressed.tokens.length < text.length, true);
});

Deno.test("Compression - compare compression strategies", () => {
    const vocab = {
        tokens: ["a", "b", "ab", "abc"],
    };

    const tokenizer = new NondeterministicTokenizer(vocab);
    const text = "abab";

    const comparison = compareCompression(tokenizer, text);

    // Most compressed should have fewer tokens than least compressed
    assertEquals(comparison.mostCompressed.tokenCount < comparison.leastCompressed.tokenCount, true);

    // Improvement factor should be > 1
    assertEquals(comparison.improvementFactor > 1, true);

    // Both should decompress to the same text
    assertEquals(decompress(tokenizer, comparison.mostCompressed.tokens), text);
    assertEquals(decompress(tokenizer, comparison.leastCompressed.tokens), text);
});

Deno.test("Compression - get compression stats", () => {
    const vocab = {
        tokens: ["t", "e", "s", "test", "testing"],
    };

    const tokenizer = new NondeterministicTokenizer(vocab);
    const text = "testing";

    const stats = getCompressionStats(tokenizer, text);

    assertEquals(stats.totalChars, 7);
    assertEquals(stats.minTokens, 1); // "testing" as one token
    assertEquals(stats.maxTokens > stats.minTokens, true);
    assertEquals(stats.bestRatio > stats.worstRatio, true);
});

Deno.test("Compression - selective compression", () => {
    const vocab = {
        tokens: ["a", "b", "c", "ab", "abc", "bc"],
    };

    const tokenizer = new NondeterministicTokenizer(vocab);
    const text = "abcabc";

    // Compress first half with shortest, second half with longest
    const selective = selectiveCompress(
        tokenizer,
        text,
        [
            { start: 0, end: 3, strategy: "shortest" },
            { start: 3, end: 6, strategy: "longest" },
        ],
    );

    // Should decompress correctly
    const decompressed = decompress(tokenizer, selective.tokens);
    assertEquals(decompressed, text);

    // First segment should use more tokens (shortest strategy)
    // Second segment should use fewer tokens (longest strategy)
    assertEquals(selective.tokenCount > 0, true);
});

Deno.test("Compression - compression ratio calculation", () => {
    const vocab = {
        tokens: ["hello", "world", " "],
    };

    const tokenizer = new NondeterministicTokenizer(vocab);
    const text = "hello world";

    const compressed = compress(tokenizer, text);

    // Should be 3 tokens: "hello", " ", "world"
    assertEquals(compressed.tokenCount, 3);

    // Compression ratio should be chars/tokens
    assertEquals(compressed.compressionRatio, text.length / 3);

    // Average token length
    const expectedAvg = (5 + 1 + 5) / 3; // "hello" + " " + "world"
    assertEquals(compressed.avgTokenLength, expectedAvg);
});
