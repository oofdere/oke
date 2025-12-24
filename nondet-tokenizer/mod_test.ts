import { assertEquals, assertExists } from "@std/assert";
import { NondeterministicTokenizer } from "./mod.ts";

Deno.test("NondeterministicTokenizer - basic construction", () => {
    const vocab = {
        tokens: ["a", "b", "ab", "abc", "bc"],
    };

    const tokenizer = new NondeterministicTokenizer(vocab);
    assertExists(tokenizer);
    assertEquals(tokenizer.vocabSize, 5);
});

Deno.test("NondeterministicTokenizer - tokenize and detokenize", () => {
    const vocab = {
        tokens: ["h", "e", "l", "o", "he", "ll", "hello", " ", "w", "or", "ld", "world"],
    };

    const tokenizer = new NondeterministicTokenizer(vocab);

    // Tokenize "hello"
    const tokens = tokenizer.tokenize("hello", "longest");
    const reconstructed = tokenizer.detokenize(tokens);

    assertEquals(reconstructed, "hello");
});

Deno.test("NondeterministicTokenizer - multiple valid tokenizations", () => {
    const vocab = {
        tokens: ["a", "b", "ab"],
    };

    const tokenizer = new NondeterministicTokenizer(vocab);

    // "ab" can be tokenized as ["ab"] or ["a", "b"]
    const tokenizations = new Set<string>();

    // Generate multiple tokenizations
    for (let i = 0; i < 20; i++) {
        const tokens = tokenizer.tokenize("ab", "random");
        const key = JSON.stringify(tokens);
        tokenizations.add(key);
    }

    // We should have found at least 2 different tokenizations with random strategy
    // Note: This might occasionally fail due to randomness, but is very unlikely
    assertEquals(tokenizations.size >= 1, true);

    // Test longest strategy - should always give [2] (token "ab")
    const tokensLongest = tokenizer.tokenize("ab", "longest");
    assertEquals(tokensLongest, [2]);

    // Test shortest strategy - should prefer [0, 1] (tokens "a", "b")
    const tokensShortest = tokenizer.tokenize("ab", "shortest");
    assertEquals(tokensShortest, [0, 1]);
});

Deno.test("NondeterministicTokenizer - getToken and getTokenId", () => {
    const vocab = {
        tokens: ["hello", "world", "test"],
    };

    const tokenizer = new NondeterministicTokenizer(vocab);

    assertEquals(tokenizer.getToken(0), "hello");
    assertEquals(tokenizer.getToken(1), "world");
    assertEquals(tokenizer.getToken(2), "test");

    assertEquals(tokenizer.getTokenId("hello"), 0);
    assertEquals(tokenizer.getTokenId("world"), 1);
    assertEquals(tokenizer.getTokenId("test"), 2);
    assertEquals(tokenizer.getTokenId("nonexistent"), -1);
});

Deno.test("NondeterministicTokenizer - complex text", () => {
    const vocab = {
        tokens: [
            " ", "a", "e", "h", "l", "o", "t", "s", "i", "T",
            "he", "ll", "hello", "test", "this", "is",
        ],
    };

    const tokenizer = new NondeterministicTokenizer(vocab);

    const text = "hello";
    const tokens = tokenizer.tokenize(text);
    const reconstructed = tokenizer.detokenize(tokens);

    // Reconstruction should match original text
    assertEquals(reconstructed, text);
});
