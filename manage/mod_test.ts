import { assertEquals, assertExists, assertStringIncludes } from "@std/assert";
import { ManagedLlamaServer } from "./mod.ts";
import { getInstalled, download } from "./unstable-download.ts";

// Use a small model for testing
const TEST_MODEL = "/home/teo/Downloads/Qwen3-0.6B-UD-IQ1_S.gguf";

Deno.test("ManagedLlamaServer launches and responds", async () => {
    const llama = await ManagedLlamaServer(TEST_MODEL);

    // Verify endpoint is set
    assertExists(llama.endpoint);
    assertStringIncludes(llama.endpoint, "http");

    // Verify api_key is set
    assertExists(llama.api_key);
    assertEquals(llama.api_key.length > 0, true);

    // Verify process is running
    assertExists(llama.process);

    // Verify props are loaded
    assertExists(llama.props);
    assertExists(llama.props.build_info);

    // Verify can make a completion request
    const response = await llama.completion("Hello", { n_predict: 5 });
    assertExists(response.content);
    assertEquals(typeof response.content, "string");

    await llama.kill();
});

Deno.test("ManagedLlamaServer uses custom path", async () => {
    const path = await getInstalled() ?? await download();
    const llama = await ManagedLlamaServer(TEST_MODEL, { path });

    assertExists(llama.endpoint);
    assertExists(llama.props);

    await llama.kill();
});

Deno.test("ManagedLlamaServer accepts launch args", async () => {
    const llama = await ManagedLlamaServer(TEST_MODEL, {
        args: {
            "ctx-size": 512,
        },
    });

    assertExists(llama.endpoint);
    assertExists(llama.props);

    await llama.kill();
});
