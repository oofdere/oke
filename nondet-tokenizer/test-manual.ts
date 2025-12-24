#!/usr/bin/env -S deno run --allow-read --allow-write
/**
 * Manual test of the nondeterministic tokenizer with a small vocabulary
 */

import { NondeterministicTokenizer } from "./mod.ts";

// Create a test vocabulary
const testVocab = {
    tokens: [
        // Single characters
        "h", "e", "l", "o", "w", "r", "d", " ", "!", ",", "t", "s", "i",
        // Common bigrams
        "he", "ll", "lo", "wo", "or", "ld", "th", "is", "es",
        // Common trigrams
        "hel", "ell", "llo", "wor", "orl", "rld", "the", "his", "est", "tes", "st",
        // Full words
        "hello", "world", "test", "this",
    ],
};

async function main() {
    console.log("Creating test vocabulary...");
    await Deno.writeTextFile(
        "/tmp/test-vocab.json",
        JSON.stringify(testVocab, null, 2),
    );

    console.log("Loading tokenizer...");
    const tokenizer = await NondeterministicTokenizer.fromFile("/tmp/test-vocab.json");
    console.log(`✓ Loaded vocabulary with ${tokenizer.vocabSize} tokens\n`);

    // Test 1: Simple text
    console.log("=== Test 1: Simple text ===");
    const text1 = "hello world";
    console.log(`Input: "${text1}"\n`);

    for (let i = 0; i < 5; i++) {
        const tokens = tokenizer.tokenize(text1, "random");
        const tokenStrings = tokens.map(id => tokenizer.getToken(id));
        const reconstructed = tokenizer.detokenize(tokens);
        console.log(`  Attempt ${i + 1}: [${tokenStrings.join(", ").substring(0, 50)}...] (${tokens.length} tokens)`);
        console.log(`    Match: ${reconstructed === text1 ? "✓" : "✗ FAILED"}`);
    }

    // Test 2: Compare strategies
    console.log("\n=== Test 2: Strategy comparison ===");
    const text2 = "test";
    console.log(`Input: "${text2}"\n`);

    const strategies: Array<"random" | "shortest" | "longest" | "ideal-length"> =
        ["shortest", "longest", "random", "ideal-length"];
    for (const strategy of strategies) {
        const opts = strategy === "ideal-length"
            ? { strategy, idealLength: 2 }
            : { strategy };
        const tokens = tokenizer.tokenize(text2, opts);
        const tokenStrings = tokens.map(id => tokenizer.getToken(id));
        const reconstructed = tokenizer.detokenize(tokens);
        console.log(`  ${strategy.toUpperCase()}:`);
        console.log(`    Tokens: [${tokenStrings.map(t => `"${t}"`).join(", ")}]`);
        console.log(`    Count: ${tokens.length}`);
        console.log(`    Match: ${reconstructed === text2 ? "✓" : "✗ FAILED"}`);
    }

    // Test 3: Multiple random tokenizations
    console.log("\n=== Test 3: Randomness check ===");
    const text3 = "hello";
    console.log(`Input: "${text3}"`);
    console.log("Generating 10 random tokenizations...\n");

    const tokenizationCounts = new Map<string, number>();
    for (let i = 0; i < 10; i++) {
        const tokens = tokenizer.tokenize(text3, "random");
        const key = tokens.join(",");
        tokenizationCounts.set(key, (tokenizationCounts.get(key) || 0) + 1);
    }

    console.log(`Found ${tokenizationCounts.size} unique tokenization(s):`);
    for (const [tokenIds, count] of tokenizationCounts.entries()) {
        const tokens = tokenIds.split(",").map(id => tokenizer.getToken(parseInt(id)));
        console.log(`  [${tokens.map(t => `"${t}"`).join(", ")}] - appeared ${count} time(s)`);
    }

    // Test 4: Round-trip verification
    console.log("\n=== Test 4: Round-trip verification ===");
    const testTexts = ["hello", "world", "test", "hello world", "this is a test"];

    for (const text of testTexts) {
        const tokens = tokenizer.tokenize(text, "random");
        const reconstructed = tokenizer.detokenize(tokens);
        const status = reconstructed === text ? "✓" : "✗ FAILED";
        console.log(`  "${text}" -> ${tokens.length} tokens -> "${reconstructed}" ${status}`);
    }

    // Test 5: Seed reproducibility
    console.log("\n=== Test 5: Seed reproducibility ===");
    const text5 = "hello world";
    const seed = 12345;

    console.log(`Input: "${text5}", Seed: ${seed}\n`);

    const run1 = tokenizer.tokenize(text5, { strategy: "random", seed });
    const run2 = tokenizer.tokenize(text5, { strategy: "random", seed });
    const run3 = tokenizer.tokenize(text5, { strategy: "random", seed });

    console.log(`  Run 1: [${run1.join(", ")}]`);
    console.log(`  Run 2: [${run2.join(", ")}]`);
    console.log(`  Run 3: [${run3.join(", ")}]`);
    console.log(`  All equal: ${JSON.stringify(run1) === JSON.stringify(run2) && JSON.stringify(run2) === JSON.stringify(run3) ? "✓" : "✗ FAILED"}`);

    // Test different seed produces different result
    const differentSeed = tokenizer.tokenize(text5, { strategy: "random", seed: 99999 });
    console.log(`  Different seed: [${differentSeed.join(", ")}]`);
    console.log(`  Different from run 1: ${JSON.stringify(run1) !== JSON.stringify(differentSeed) ? "✓" : "✗ FAILED (should be different)"}`);

    // Test 6: Ideal length variations
    console.log("\n=== Test 6: Ideal length variations ===");
    const text6 = "hello world";
    console.log(`Input: "${text6}"\n`);

    for (const idealLen of [1, 2, 3, 5, 10]) {
        const tokens = tokenizer.tokenize(text6, { strategy: "ideal-length", idealLength: idealLen, seed: 42 });
        const tokenStrings = tokens.map(id => tokenizer.getToken(id));
        const avgLength = tokenStrings.reduce((sum, t) => sum + t.length, 0) / tokenStrings.length;
        console.log(`  Ideal length ${idealLen}:`);
        console.log(`    Tokens: [${tokenStrings.map(t => `"${t}"`).join(", ")}]`);
        console.log(`    Count: ${tokens.length}, Avg length: ${avgLength.toFixed(2)}`);
    }

    console.log("\n=== All tests complete ===");
}

if (import.meta.main) {
    try {
        await main();
    } catch (error) {
        console.error("\n❌ Error:", error.message);
        console.error(error.stack);
        Deno.exit(1);
    }
}
