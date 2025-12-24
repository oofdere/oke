#!/usr/bin/env -S deno run --allow-read
/**
 * Example demonstrating text compression features
 */

import {
    NondeterministicTokenizer,
    compress,
    decompress,
    compareCompression,
    getCompressionStats,
    selectiveCompress,
} from "./mod.ts";

async function main() {
    if (Deno.args.length < 1) {
        console.error("Usage: example-compression.ts <vocabulary.json>");
        console.error("\nFirst extract vocabulary from a GGUF model:");
        console.error("  ./extract-vocab-simple.ts model.gguf vocab.json");
        console.error("\nThen run this example:");
        console.error("  ./example-compression.ts vocab.json");
        Deno.exit(1);
    }

    const vocabPath = Deno.args[0];

    console.log("Loading tokenizer...");
    const tokenizer = await NondeterministicTokenizer.fromFile(vocabPath);
    console.log(`✓ Loaded vocabulary with ${tokenizer.vocabSize} tokens\n`);

    // Example text
    const text = "Hello world! This is a test of text compression using tokenization. " +
        "The quick brown fox jumps over the lazy dog. The quick brown fox jumps over the lazy dog.";

    console.log("=== Text Compression Demo ===\n");
    console.log(`Original text (${text.length} chars):`);
    console.log(`"${text}"\n`);

    // 1. Basic compression
    console.log("--- Basic Compression ---");
    const compressed = compress(tokenizer, text);
    console.log(`Compressed to ${compressed.tokenCount} tokens`);
    console.log(`Compression ratio: ${compressed.compressionRatio.toFixed(2)} chars/token`);
    console.log(`Average token length: ${compressed.avgTokenLength.toFixed(2)} chars`);
    console.log(`\nTokens: [${compressed.tokenStrings.slice(0, 10).map(t => `"${t}"`).join(", ")}...]`);

    // Verify decompression
    const decompressed = decompress(tokenizer, compressed.tokens);
    console.log(`\nDecompression matches: ${decompressed === text ? "✓" : "✗"}\n`);

    // 2. Compression comparison
    console.log("--- Compression Comparison ---");
    const comparison = compareCompression(tokenizer, text);
    console.log(`Most compressed:  ${comparison.mostCompressed.tokenCount} tokens (ratio: ${comparison.mostCompressed.compressionRatio.toFixed(2)})`);
    console.log(`Least compressed: ${comparison.leastCompressed.tokenCount} tokens (ratio: ${comparison.leastCompressed.compressionRatio.toFixed(2)})`);
    console.log(`Improvement factor: ${comparison.improvementFactor.toFixed(2)}x\n`);

    // 3. Compression statistics
    console.log("--- Compression Statistics ---");
    const stats = getCompressionStats(tokenizer, text);
    console.log(`Total characters: ${stats.totalChars}`);
    console.log(`Min tokens (best compression): ${stats.minTokens}`);
    console.log(`Max tokens (worst compression): ${stats.maxTokens}`);
    console.log(`Best ratio: ${stats.bestRatio.toFixed(2)} chars/token`);
    console.log(`Worst ratio: ${stats.worstRatio.toFixed(2)} chars/token`);

    console.log(`\nToken length distribution:`);
    const sortedLengths = Array.from(stats.tokenLengthDistribution.entries())
        .sort((a, b) => a[0] - b[0]);
    for (const [length, count] of sortedLengths.slice(0, 10)) {
        const bar = "█".repeat(Math.min(count, 40));
        console.log(`  ${length.toString().padStart(2)} chars: ${bar} (${count} tokens)`);
    }

    // 4. Selective compression
    console.log("\n--- Selective Compression ---");
    const text2 = "IMPORTANT: User password is secret123. Regular text here.";
    console.log(`Text: "${text2}"`);

    // Compress "IMPORTANT" part with shortest tokens (less compression, preserves detail)
    // Compress regular text with longest tokens (maximum compression)
    const selective = selectiveCompress(
        tokenizer,
        text2,
        [
            { start: 0, end: 11, strategy: "shortest" }, // "IMPORTANT: "
            { start: 11, end: 42, strategy: "ideal-length", idealLength: 2 }, // sensitive part
        ],
        "longest", // default for remaining text
    );

    console.log(`Normal compression: ${compress(tokenizer, text2).tokenCount} tokens`);
    console.log(`Selective compression: ${selective.tokenCount} tokens`);
    console.log(`Tokens: [${selective.tokenStrings.slice(0, 15).map(t => `"${t}"`).join(", ")}...]`);

    // 5. Repeated text compression
    console.log("\n--- Repeated Text Compression ---");
    const repeatedText = "hello ".repeat(10);
    console.log(`Repeated text: "${repeatedText}"`);
    console.log(`Length: ${repeatedText.length} chars`);

    const repeatedCompressed = compress(tokenizer, repeatedText);
    console.log(`Compressed to: ${repeatedCompressed.tokenCount} tokens`);
    console.log(`Ratio: ${repeatedCompressed.compressionRatio.toFixed(2)} chars/token`);
    console.log(`Tokens: [${repeatedCompressed.tokenStrings.map(t => `"${t}"`).join(", ")}]`);

    console.log("\n✓ Compression examples complete!");
}

if (import.meta.main) {
    try {
        await main();
    } catch (error) {
        console.error("\n❌ Error:", error.message);
        Deno.exit(1);
    }
}
