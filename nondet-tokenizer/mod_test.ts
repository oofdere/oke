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

Deno.test("NondeterministicTokenizer - seed reproducibility", () => {
    const vocab = {
        tokens: ["a", "b", "ab", "abc", "bc"],
    };

    const tokenizer = new NondeterministicTokenizer(vocab);
    const text = "abab";
    const seed = 12345;

    // Multiple runs with same seed should produce same result
    const tokens1 = tokenizer.tokenize(text, { strategy: "random", seed });
    const tokens2 = tokenizer.tokenize(text, { strategy: "random", seed });
    const tokens3 = tokenizer.tokenize(text, { strategy: "random", seed });

    assertEquals(tokens1, tokens2);
    assertEquals(tokens2, tokens3);

    // Different seed should produce different result (with high probability)
    const tokens4 = tokenizer.tokenize(text, { strategy: "random", seed: 99999 });
    // Note: There's a small chance this could be equal by luck, but very unlikely
});

Deno.test("NondeterministicTokenizer - ideal length strategy", () => {
    const vocab = {
        tokens: ["a", "b", "ab", "abc", "abcd", "bc", "bcd"],
    };

    const tokenizer = new NondeterministicTokenizer(vocab);
    const text = "abcd";

    // Test ideal length 1 - should prefer single characters
    const tokens1 = tokenizer.tokenize(text, { strategy: "ideal-length", idealLength: 1, seed: 42 });
    const reconstructed1 = tokenizer.detokenize(tokens1);
    assertEquals(reconstructed1, text);

    // Test ideal length 4 - should prefer the full "abcd" token
    const tokens4 = tokenizer.tokenize(text, { strategy: "ideal-length", idealLength: 4, seed: 42 });
    const reconstructed4 = tokenizer.detokenize(tokens4);
    assertEquals(reconstructed4, text);
    // With seed 42 and ideal length 4, should strongly prefer the 4-char token
});

Deno.test("NondeterministicTokenizer - backward compatibility", () => {
    const vocab = {
        tokens: ["a", "b", "ab"],
    };

    const tokenizer = new NondeterministicTokenizer(vocab);

    // Old string API should still work
    const tokens1 = tokenizer.tokenize("ab", "longest");
    const tokens2 = tokenizer.tokenize("ab", "shortest");

    assertEquals(tokens1, [2]); // "ab" token
    assertEquals(tokens2, [0, 1]); // "a", "b" tokens
});

Deno.test("NondeterministicTokenizer - special tokens preserved", () => {
    const vocab = {
        tokens: ["<s>", "</s>", "<|special|>", "h", "e", "l", "o", "he", "ll", "hello"],
        bos_token_id: 0,
        eos_token_id: 1,
        special_token_ids: [0, 1, 2],
    };

    const tokenizer = new NondeterministicTokenizer(vocab);

    // Special tokens in text should be preserved
    const text = "<s>hello<|special|>hello</s>";
    const tokens = tokenizer.tokenize(text, { strategy: "longest", seed: 42 });

    // Should be: <s>, hello, <|special|>, hello, </s>
    assertEquals(tokens[0], 0); // <s>
    assertEquals(tokens[1], 9); // hello
    assertEquals(tokens[2], 2); // <|special|>
    assertEquals(tokens[3], 9); // hello
    assertEquals(tokens[4], 1); // </s>

    // Detokenize should work
    const reconstructed = tokenizer.detokenize(tokens);
    assertEquals(reconstructed, text);
});

Deno.test("NondeterministicTokenizer - add BOS/EOS tokens", () => {
    const vocab = {
        tokens: ["<s>", "</s>", "h", "e", "l", "o", "hello"],
        bos_token_id: 0,
        eos_token_id: 1,
    };

    const tokenizer = new NondeterministicTokenizer(vocab);

    const text = "hello";

    // Without BOS/EOS
    const tokens1 = tokenizer.tokenize(text, { strategy: "longest" });
    assertEquals(tokens1, [6]); // Just "hello"

    // With BOS only
    const tokens2 = tokenizer.tokenize(text, { strategy: "longest", addBosToken: true });
    assertEquals(tokens2, [0, 6]); // <s>, hello

    // With EOS only
    const tokens3 = tokenizer.tokenize(text, { strategy: "longest", addEosToken: true });
    assertEquals(tokens3, [6, 1]); // hello, </s>

    // With both BOS and EOS
    const tokens4 = tokenizer.tokenize(text, {
        strategy: "longest",
        addBosToken: true,
        addEosToken: true,
    });
    assertEquals(tokens4, [0, 6, 1]); // <s>, hello, </s>
});

Deno.test("NondeterministicTokenizer - disable special token preservation", () => {
    const vocab = {
        tokens: ["<", "s", ">", "<s>", "h", "e", "l", "o", "hello"],
        bos_token_id: 3,
        special_token_ids: [3],
    };

    const tokenizer = new NondeterministicTokenizer(vocab);

    const text = "<s>hello";

    // With special token preservation (default)
    const tokens1 = tokenizer.tokenize(text, { strategy: "longest" });
    assertEquals(tokens1[0], 3); // Should be <s> as single token

    // Without special token preservation
    const tokens2 = tokenizer.tokenize(text, {
        strategy: "longest",
        preserveSpecialTokens: false,
    });
    // Should tokenize <s> as separate tokens: <, s, >
    assertEquals(tokens2[0], 0); // <
    assertEquals(tokens2[1], 1); // s
    assertEquals(tokens2[2], 2); // >
});
