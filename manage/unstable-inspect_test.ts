import { assertEquals, assertMatch } from "@std/assert";
import { version, listDevices, type Version, type Device } from "./unstable-inspect.ts";
import { getInstalled, download } from "./unstable-download.ts";

// Helper to get or download llama-server for testing
async function getLlamaServerPath(): Promise<string> {
    const installed = await getInstalled();
    if (installed) return installed;
    return await download();
}

Deno.test("version returns valid version info", async () => {
    const path = await getLlamaServerPath();
    const ver: Version = version(path);

    // Build should be a number (e.g., "7406")
    assertMatch(ver.build, /^\d+$/, "build should be numeric");

    // Hash should be a short hex string (e.g., "4aced7a63")
    assertMatch(ver.hash, /^[a-f0-9]+$/i, "hash should be hexadecimal");

    // Compiler should contain a known compiler name
    const validCompilers = ["gcc", "clang", "GNU", "MSVC", "Apple"];
    const hasValidCompiler = validCompilers.some((c) =>
        ver.compiler.toLowerCase().includes(c.toLowerCase())
    );
    assertEquals(hasValidCompiler, true, `compiler "${ver.compiler}" should contain a known compiler`);

    // Arch should be a known OS or architecture
    const validArch = ["linux", "darwin", "windows", "macos", "x86_64", "arm64", "aarch64"];
    const hasValidArch = validArch.some((a) =>
        ver.arch.toLowerCase().includes(a.toLowerCase())
    );
    assertEquals(hasValidArch, true, `arch "${ver.arch}" should contain a known OS/arch`);
});

Deno.test("listDevices returns array of valid devices", async () => {
    const path = await getLlamaServerPath();
    const devices: Device[] = listDevices(path);

    // Should return an array with at least one device
    assertEquals(Array.isArray(devices), true);
    assertEquals(devices.length >= 1, true, "should have at least one device");

    // Each device should have valid properties
    for (const device of devices) {
        // Runtime should be a known backend
        const validRuntimes = ["Vulkan", "CUDA", "Metal", "CPU", "ROCm", "SYCL"];
        const hasValidRuntime = validRuntimes.some((r) =>
            device.runtime.toLowerCase().includes(r.toLowerCase())
        );
        assertEquals(hasValidRuntime, true, `runtime "${device.runtime}" should be a known backend`);

        // Index should be a non-negative number
        assertEquals(typeof device.index, "number");
        assertEquals(device.index >= 0, true, "index should be non-negative");

        // Device name should be non-empty
        assertEquals(device.device.length > 0, true, "device name should not be empty");

        // Memory should match pattern like "23638 MiB" or be empty
        if (device.memory) {
            assertMatch(device.memory, /^\d+\s*\w+$/, `memory "${device.memory}" should be like "1234 MiB"`);
        }

        // Free memory should match same pattern
        if (device.free) {
            assertMatch(device.free, /^\d+\s*\w+$/, `free "${device.free}" should be like "1234 MiB"`);
        }
    }
});

Deno.test("listDevices finds GPU or CPU backend", async () => {
    const path = await getLlamaServerPath();
    const devices = listDevices(path);

    // Should find at least one usable compute backend
    const hasBackend = devices.some(
        (d) =>
            d.runtime === "Vulkan" ||
            d.runtime === "CUDA" ||
            d.runtime === "Metal" ||
            d.runtime === "CPU" ||
            d.runtime === "ROCm",
    );
    assertEquals(hasBackend, true, "should find at least one compute backend");
});
