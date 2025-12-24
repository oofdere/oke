#!/usr/bin/env -S deno run --allow-all
/**
 * Extract vocabulary from a GGUF model using llama-server
 *
 * This tool:
 * 1. Starts llama-server with the provided model
 * 2. Extracts the vocabulary by tokenizing comprehensive text
 * 3. Builds a reverse mapping of token ID → string
 * 4. Saves the vocabulary to a JSON file
 */

import { ManagedLlamaServer } from "../manage/mod.ts";
import { LlamaServer } from "../client/mod.ts";

interface VocabEntry {
    id: number;
    text: string;
}

interface Vocabulary {
    tokens: VocabEntry[];
    /** Map from token ID to token text */
    id_to_text: Record<number, string>;
    /** Total number of tokens in vocabulary */
    vocab_size: number;
}

async function extractVocabulary(
    modelPath: string,
    outputPath: string,
    maxTokenId: number = 150000,
): Promise<void> {
    console.log(`Starting llama-server with model: ${modelPath}`);

    // Start managed llama-server
    const managed = await ManagedLlamaServer(modelPath);
    const server = await LlamaServer(managed.baseUrl, { apiKey: managed.apiKey });

    try {
        console.log(`Server started at ${managed.baseUrl}`);
        console.log(`Model: ${server.props.model_path}`);

        // Step 1: Find the vocabulary size by testing token IDs
        console.log(`\nFinding vocabulary size (testing up to token ID ${maxTokenId})...`);
        const tokenMap = new Map<number, string>();

        // Try to detokenize token IDs in batches
        const batchSize = 100;
        let consecutiveFailures = 0;
        const maxConsecutiveFailures = 500; // Stop after 500 consecutive failures

        for (let i = 0; i < maxTokenId; i += batchSize) {
            const endId = Math.min(i + batchSize, maxTokenId);

            if (i % 1000 === 0) {
                console.log(`Progress: ${i}/${maxTokenId} (${tokenMap.size} valid tokens found)`);
            }

            // Try each token individually (some might be invalid)
            for (let tokenId = i; tokenId < endId; tokenId++) {
                try {
                    const response = await server.api.post("detokenize", {
                        json: { tokens: [tokenId] },
                        timeout: 5000, // 5 second timeout per token
                    }).json<{ content: string }>();

                    if (response.content !== undefined && response.content !== null) {
                        tokenMap.set(tokenId, response.content);
                        consecutiveFailures = 0;
                    }
                } catch (error) {
                    // Token might be invalid or endpoint error
                    consecutiveFailures++;
                    if (consecutiveFailures >= maxConsecutiveFailures) {
                        console.log(`\nStopping: ${maxConsecutiveFailures} consecutive failures at token ${tokenId}`);
                        break;
                    }
                }
            }

            if (consecutiveFailures >= maxConsecutiveFailures) {
                break;
            }

            // Small delay to avoid overwhelming the server
            await new Promise(resolve => setTimeout(resolve, 10));
        }

        console.log(`\nFound ${tokenMap.size} valid tokens`);

        // Step 2: Verify some tokens by round-trip testing
        console.log(`\nVerifying tokens with round-trip test...`);
        const testStrings = ["hello", "world", " ", "\n", "test"];
        for (const testStr of testStrings) {
            try {
                const tokenized = await server.api.post("tokenize", {
                    json: { content: testStr },
                }).json<{ tokens: number[] }>();

                const detokenized = await server.api.post("detokenize", {
                    json: { tokens: tokenized.tokens },
                }).json<{ content: string }>();

                console.log(`  "${testStr}" -> [${tokenized.tokens.join(", ")}] -> "${detokenized.content}"`);
            } catch (error) {
                console.log(`  Failed to verify "${testStr}": ${error.message}`);
            }
        }

        // Convert to vocabulary format
        const tokens: VocabEntry[] = Array.from(tokenMap.entries())
            .map(([id, text]) => ({ id, text }))
            .sort((a, b) => a.id - b.id);

        const id_to_text: Record<number, string> = {};
        for (const { id, text } of tokens) {
            id_to_text[id] = text;
        }

        const vocabulary: Vocabulary = {
            tokens,
            id_to_text,
            vocab_size: tokens.length,
        };

        // Save to file
        console.log(`\nSaving vocabulary to ${outputPath}`);
        await Deno.writeTextFile(
            outputPath,
            JSON.stringify(vocabulary, null, 2),
        );

        console.log(`✓ Vocabulary saved successfully`);
        console.log(`  Total tokens: ${vocabulary.vocab_size}`);
        console.log(`  Token ID range: ${tokens[0]?.id} - ${tokens[tokens.length - 1]?.id}`);

    } finally {
        // Clean up
        console.log(`\nStopping llama-server...`);
        await managed.kill();
        console.log(`✓ Server stopped`);
    }
}

/** Build a comprehensive corpus to discover tokens */
function buildCorpus(): string[] {
    const corpus: string[] = [];

    // All ASCII printable characters
    for (let i = 32; i <= 126; i++) {
        corpus.push(String.fromCharCode(i));
    }

    // All bytes (0-255)
    for (let i = 0; i < 256; i++) {
        corpus.push(String.fromCharCode(i));
    }

    // Common words and sequences
    const commonWords = [
        "the", "be", "to", "of", "and", "a", "in", "that", "have", "I",
        "it", "for", "not", "on", "with", "he", "as", "you", "do", "at",
        "hello", "world", "test", "example", "function", "class", "import",
        "export", "const", "let", "var", "if", "else", "while", "for",
        "return", "true", "false", "null", "undefined", "async", "await",
    ];

    corpus.push(...commonWords);

    // Common punctuation and whitespace combinations
    const punctuation = [" ", "\n", "\t", ".", ",", "!", "?", ";", ":",
                        "'", '"', "(", ")", "[", "]", "{", "}", "<", ">"];
    corpus.push(...punctuation);

    // Two-character combinations
    for (const a of "abcdefghijklmnopqrstuvwxyz") {
        for (const b of "abcdefghijklmnopqrstuvwxyz") {
            corpus.push(a + b);
        }
    }

    // Common prefixes and suffixes
    const affixes = ["un", "re", "in", "dis", "en", "non", "over", "mis",
                     "sub", "pre", "inter", "fore", "de", "trans", "super",
                     "semi", "anti", "mid", "under", "ing", "ed", "ly",
                     "er", "est", "tion", "ness", "ment", "ity"];
    corpus.push(...affixes);

    return corpus;
}

// Main execution
if (import.meta.main) {
    const args = Deno.args;

    if (args.length < 1) {
        console.error("Usage: extract-vocab.ts <model.gguf> [output.json] [max-token-id]");
        console.error("\nExample:");
        console.error("  extract-vocab.ts /path/to/model.gguf vocab.json");
        console.error("  extract-vocab.ts /path/to/model.gguf vocab.json 200000");
        Deno.exit(1);
    }

    const modelPath = args[0];
    const outputPath = args[1] || "vocabulary.json";
    const maxTokenId = args[2] ? parseInt(args[2], 10) : 150000;

    try {
        await extractVocabulary(modelPath, outputPath, maxTokenId);
    } catch (error) {
        console.error("\n❌ Error:", error.message);
        Deno.exit(1);
    }
}
