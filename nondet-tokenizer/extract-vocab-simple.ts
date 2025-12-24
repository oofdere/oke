#!/usr/bin/env -S deno run --allow-all
/**
 * Extract vocabulary from a GGUF file by reading tokenizer.ggml.tokens metadata
 *
 * This tool reads the GGUF file directly and extracts the tokenizer vocabulary
 * without needing to start llama-server.
 */

import { gguf } from "npm:@huggingface/gguf@^0.1.8";

interface TokenizerMetadata {
    tokens: string[];
    merges?: string[];
    bos_token_id?: number;
    eos_token_id?: number;
    model_type?: string;
}

async function extractVocabulary(
    modelPath: string,
    outputPath: string,
): Promise<void> {
    console.log(`Reading GGUF file: ${modelPath}`);

    try {
        // Parse GGUF file
        const { metadata } = await gguf(modelPath, {
            allowLocalFile: true,
        });

        console.log(`\nExtracting tokenizer metadata...`);

        // Extract tokenizer tokens
        const tokensMetadata = metadata["tokenizer.ggml.tokens"];
        if (!tokensMetadata || !tokensMetadata.value) {
            throw new Error("No tokenizer.ggml.tokens found in GGUF metadata");
        }

        const tokens = tokensMetadata.value as string[];
        console.log(`Found ${tokens.length} tokens in vocabulary`);

        // Extract other tokenizer metadata
        const mergesMetadata = metadata["tokenizer.ggml.merges"];
        const merges = mergesMetadata?.value as string[] | undefined;

        const bosTokenId = metadata["tokenizer.ggml.bos_token_id"]?.value as number | undefined;
        const eosTokenId = metadata["tokenizer.ggml.eos_token_id"]?.value as number | undefined;
        const modelType = metadata["general.architecture"]?.value as string | undefined;

        const vocabularyData: TokenizerMetadata = {
            tokens,
            merges,
            bos_token_id: bosTokenId,
            eos_token_id: eosTokenId,
            model_type: modelType,
        };

        // Save to file
        console.log(`\nSaving vocabulary to ${outputPath}`);
        await Deno.writeTextFile(
            outputPath,
            JSON.stringify(vocabularyData, null, 2),
        );

        console.log(`✓ Vocabulary saved successfully`);
        console.log(`  Total tokens: ${tokens.length}`);
        if (merges) console.log(`  Total merges: ${merges.length}`);
        if (bosTokenId !== undefined) console.log(`  BOS token ID: ${bosTokenId}`);
        if (eosTokenId !== undefined) console.log(`  EOS token ID: ${eosTokenId}`);
        if (modelType) console.log(`  Model type: ${modelType}`);

        // Show sample tokens
        console.log(`\nSample tokens:`);
        for (let i = 0; i < Math.min(20, tokens.length); i++) {
            console.log(`  [${i}] "${tokens[i]}"`);
        }

    } catch (error) {
        throw new Error(`Failed to extract vocabulary: ${error.message}`);
    }
}

// Main execution
if (import.meta.main) {
    const args = Deno.args;

    if (args.length < 1) {
        console.error("Usage: extract-vocab-simple.ts <model.gguf> [output.json]");
        console.error("\nExample:");
        console.error("  extract-vocab-simple.ts /path/to/model.gguf vocab.json");
        Deno.exit(1);
    }

    const modelPath = args[0];
    const outputPath = args[1] || "vocabulary.json";

    try {
        await extractVocabulary(modelPath, outputPath);
    } catch (error) {
        console.error("\n❌ Error:", error.message);
        Deno.exit(1);
    }
}
