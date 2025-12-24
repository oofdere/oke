#!/usr/bin/env -S deno run --allow-read
/**
 * Example usage of the nondeterministic tokenizer
 */

import { NondeterministicTokenizer } from "./mod.ts";

async function main() {
    // Check if vocabulary file is provided
    if (Deno.args.length < 1) {
        console.error("Usage: example.ts <vocabulary.json>");
        console.error("\nFirst extract vocabulary from a GGUF model:");
        console.error("  ./extract-vocab-simple.ts model.gguf vocab.json");
        console.error("\nThen run this example:");
        console.error("  ./example.ts vocab.json");
        Deno.exit(1);
    }

    const vocabPath = Deno.args[0];

    console.log("Loading tokenizer...");
    const tokenizer = await NondeterministicTokenizer.fromFile(vocabPath);
    console.log(`✓ Loaded vocabulary with ${tokenizer.vocabSize} tokens\n`);

    // Test text
    const text = "Hello, world! This is a test.";
    console.log(`Input text: "${text}"\n`);

    // Generate multiple tokenizations
    console.log("Generating 5 different nondeterministic tokenizations:\n");

    for (let i = 0; i < 5; i++) {
        const tokens = tokenizer.tokenize(text, "random");
        const reconstructed = tokenizer.detokenize(tokens);

        console.log(`Tokenization ${i + 1}:`);
        console.log(`  Token IDs: [${tokens.slice(0, 20).join(", ")}${tokens.length > 20 ? ", ..." : ""}]`);
        console.log(`  Token count: ${tokens.length}`);
        console.log(`  Reconstructed: "${reconstructed}"`);
        console.log(`  Match: ${reconstructed === text ? "✓" : "✗"}`);

        // Show the actual tokens
        const tokenStrings = tokens.slice(0, 15).map(id => {
            const token = tokenizer.getToken(id);
            return `"${token}"`;
        });
        console.log(`  Tokens: [${tokenStrings.join(", ")}${tokens.length > 15 ? ", ..." : ""}]`);
        console.log();
    }

    // Compare strategies
    console.log("\nComparing different tokenization strategies:\n");

    const strategies: Array<"random" | "shortest" | "longest"> = ["random", "shortest", "longest"];
    for (const strategy of strategies) {
        const tokens = tokenizer.tokenize(text, strategy);
        console.log(`${strategy.toUpperCase()} strategy:`);
        console.log(`  Token count: ${tokens.length}`);
        console.log(`  First 10 tokens: [${tokens.slice(0, 10).map(id => tokenizer.getToken(id)).map(t => `"${t}"`).join(", ")}]`);
        console.log();
    }
}

if (import.meta.main) {
    try {
        await main();
    } catch (error) {
        console.error("\n❌ Error:", error.message);
        Deno.exit(1);
    }
}
