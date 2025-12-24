#!/usr/bin/env -S deno run --allow-read
/**
 * Example demonstrating compression factor and gradient features
 */

import {
    NondeterministicTokenizer,
    compressWithFactor,
    compressWithGradient,
    decompress,
} from "./mod.ts";

async function main() {
    if (Deno.args.length < 1) {
        console.error("Usage: example-factor.ts <vocabulary.json>");
        Deno.exit(1);
    }

    const vocabPath = Deno.args[0];

    console.log("Loading tokenizer...");
    const tokenizer = await NondeterministicTokenizer.fromFile(vocabPath);
    console.log(`✓ Loaded vocabulary with ${tokenizer.vocabSize} tokens\n`);

    const text = "Hello world! This is a demonstration of compression factors and gradients.";

    console.log("=== Compression Factor Demo ===\n");
    console.log(`Text: "${text}"`);
    console.log(`Length: ${text.length} characters\n`);

    // Test different compression factors
    console.log("--- Compression Factor Sweep ---");
    console.log("Factor 0.0 = shortest tokens, 1.0 = longest tokens\n");

    for (let factor = 0.0; factor <= 1.0; factor += 0.2) {
        const compressed = compressWithFactor(tokenizer, text, factor, { seed: 42 });
        const percent = (factor * 100).toFixed(0);

        console.log(`Factor ${factor.toFixed(1)} (${percent}%):`);
        console.log(`  Tokens: ${compressed.tokenCount}`);
        console.log(`  Ratio: ${compressed.compressionRatio.toFixed(2)} chars/token`);
        console.log(`  Avg token length: ${compressed.avgTokenLength.toFixed(2)} chars`);
        console.log();
    }

    // Verify round-trip
    const testCompress = compressWithFactor(tokenizer, text, 0.7, { seed: 42 });
    const testDecompress = decompress(tokenizer, testCompress.tokens);
    console.log(`Round-trip verification: ${testDecompress === text ? "✓ PASS" : "✗ FAIL"}\n`);

    console.log("\n=== Compression Gradient Demo ===\n");
    console.log("Gradient -1.0 = strong bias to short, +1.0 = strong bias to long\n");

    // Test different gradients
    for (let gradient = -1.0; gradient <= 1.0; gradient += 0.5) {
        const compressed = compressWithGradient(tokenizer, text, gradient, { seed: 42 });

        console.log(`Gradient ${gradient.toFixed(1)}:`);
        console.log(`  Tokens: ${compressed.tokenCount}`);
        console.log(`  Ratio: ${compressed.compressionRatio.toFixed(2)} chars/token`);
        console.log(`  Avg token length: ${compressed.avgTokenLength.toFixed(2)} chars`);
        console.log(`  Sample: [${compressed.tokenStrings.slice(0, 8).map(t => `"${t}"`).join(", ")}...]`);
        console.log();
    }

    // Compare extremes
    console.log("\n--- Compression Extremes ---");
    const minCompress = compressWithGradient(tokenizer, text, -1.0, { seed: 42 });
    const maxCompress = compressWithGradient(tokenizer, text, 1.0, { seed: 42 });

    console.log(`Minimum compression (gradient -1.0):`);
    console.log(`  ${minCompress.tokenCount} tokens, ${minCompress.compressionRatio.toFixed(2)} ratio`);

    console.log(`\nMaximum compression (gradient +1.0):`);
    console.log(`  ${maxCompress.tokenCount} tokens, ${maxCompress.compressionRatio.toFixed(2)} ratio`);

    const improvement = minCompress.tokenCount / maxCompress.tokenCount;
    console.log(`\nCompression improvement: ${improvement.toFixed(2)}x fewer tokens`);

    console.log("\n✓ Factor and gradient examples complete!");
}

if (import.meta.main) {
    try {
        await main();
    } catch (error) {
        console.error("\n❌ Error:", error.message);
        Deno.exit(1);
    }
}
