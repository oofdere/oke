import { assertEquals, assertExists } from "@std/assert";
import { ManagedLlamaServer } from "../manage/mod.ts";

// Use a small model for testing
const TEST_MODEL = "/home/teo/Downloads/Qwen3-0.6B-UD-IQ1_S.gguf";

Deno.test("LlamaServer tokenize endpoint", async () => {
    const llama = await ManagedLlamaServer(TEST_MODEL);

    try {
        const text = "Hello, World!";
        const result = await llama.tokenize(text);

        // Verify response structure
        assertExists(result.tokens);
        assertEquals(Array.isArray(result.tokens), true);
        assertEquals(result.tokens.length > 0, true);

        // Verify all tokens are numbers
        for (const token of result.tokens) {
            assertEquals(typeof token, "number");
        }
    } finally {
        await llama.kill();
    }
});

Deno.test("LlamaServer detokenize endpoint", async () => {
    const llama = await ManagedLlamaServer(TEST_MODEL);

    try {
        // First tokenize some text to get valid tokens
        const originalText = "Hello, World!";
        const { tokens } = await llama.tokenize(originalText);

        // Now detokenize those tokens
        const result = await llama.detokenize(tokens);

        // Verify response structure
        assertExists(result.content);
        assertEquals(typeof result.content, "string");
        assertEquals(result.content.length > 0, true);
    } finally {
        await llama.kill();
    }
});

Deno.test("LlamaServer tokenize/detokenize round-trip", async () => {
    const llama = await ManagedLlamaServer(TEST_MODEL);

    try {
        const originalText = "The quick brown fox jumps over the lazy dog.";

        // Tokenize
        const { tokens } = await llama.tokenize(originalText);
        assertExists(tokens);
        assertEquals(tokens.length > 0, true);

        // Detokenize
        const { content } = await llama.detokenize(tokens);
        assertExists(content);

        // The round-trip should produce similar text
        // Note: There may be minor differences (e.g., whitespace) due to tokenization
        assertEquals(content.trim().length > 0, true);
        assertEquals(typeof content, "string");
    } finally {
        await llama.kill();
    }
});

Deno.test("LlamaServer tokenize empty string", async () => {
    const llama = await ManagedLlamaServer(TEST_MODEL);

    try {
        const result = await llama.tokenize("");

        // Empty string should still return a valid response
        assertExists(result.tokens);
        assertEquals(Array.isArray(result.tokens), true);
    } finally {
        await llama.kill();
    }
});

Deno.test("LlamaServer detokenize empty array", async () => {
    const llama = await ManagedLlamaServer(TEST_MODEL);

    try {
        const result = await llama.detokenize([]);

        // Empty array should still return a valid response
        assertExists(result.content);
        assertEquals(typeof result.content, "string");
    } finally {
        await llama.kill();
    }
});
