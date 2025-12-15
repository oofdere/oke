import { assertEquals, assertExists } from "@std/assert";
import { 
    getRecommendedVariant, 
    download, 
    findLlamaServer, 
    getInstalled, 
    cleanup,
    OKE_DIR 
} from "./unstable-download.ts";
import { join } from "@std/path/join";

const TEST_DIR = join(Deno.makeTempDirSync(), ".oke-test");

Deno.test("getRecommendedVariant returns valid variant", () => {
    const variant = getRecommendedVariant();
    assertExists(variant);
    // Should contain platform identifier
    const valid = ["macos", "ubuntu", "win"].some(p => variant.includes(p));
    assertEquals(valid, true);
});

Deno.test("findLlamaServer returns null for empty dir", async () => {
    const result = await findLlamaServer("/nonexistent/path");
    assertEquals(result, null);
});

Deno.test("getInstalled returns null when nothing installed", async () => {
    const result = await getInstalled(undefined, TEST_DIR);
    assertEquals(result, null);
});

Deno.test("download fetches and extracts llama-server", async () => {
    const result = await download({ destDir: TEST_DIR });
    assertExists(result);
    
    // Verify the file exists
    const stat = await Deno.stat(result);
    assertEquals(stat.isFile, true);
});

Deno.test("download returns cached path on second call", async () => {
    const first = await download({ destDir: TEST_DIR });
    const second = await download({ destDir: TEST_DIR });
    assertEquals(first, second);
});

Deno.test("getInstalled finds downloaded version", async () => {
    const installed = await getInstalled(undefined, TEST_DIR);
    assertExists(installed);
});

Deno.test("cleanup removes old versions", async () => {
    await cleanup(undefined, TEST_DIR);
    // Should still have one version (the latest)
    const installed = await getInstalled(undefined, TEST_DIR);
    assertExists(installed);
});

Deno.test("cleanup with specific version removes it", async () => {
    // Get current version
    const current = await getInstalled(undefined, TEST_DIR);
    if (current) {
        const version = current.split("/").find(p => p.startsWith("b"));
        if (version) {
            await cleanup(version, TEST_DIR);
            const after = await getInstalled(version, TEST_DIR);
            assertEquals(after, null);
        }
    }
});
