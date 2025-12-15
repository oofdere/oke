/**
 * Download and manage llama.cpp releases
 */

import { ensureDir } from "@std/fs/ensure-dir";
import { join } from "@std/path/join";
import { homedir } from "node:os";

const GITHUB_API = "https://api.github.com/repos/ggml-org/llama.cpp/releases";

/** Default directory for oke binaries (~/.oke) */
export const OKE_DIR: string = join(homedir(), ".oke");

/** Get the recommended build variant for the current platform */
export function getRecommendedVariant(): string {
    const { os, arch } = Deno.build;
    const isArm = arch === "aarch64";
    
    if (os === "darwin") return isArm ? "macos-arm64" : "macos-x64";
    if (os === "linux") return isArm ? "ubuntu-vulkan-arm64" : "ubuntu-vulkan-x64";
    if (os === "windows") return isArm ? "win-arm64" : "win-vulkan-x64";
    throw new Error(`Unsupported platform: ${os}`);
}

/** Download llama.cpp and return path to llama-server */
export async function download(options: {
    version?: string;
    variant?: string;
    destDir?: string;
} = {}): Promise<string> {
    const { version, variant = getRecommendedVariant(), destDir = OKE_DIR } = options;

    // Fetch release info
    const url = version ? `${GITHUB_API}/tags/${version}` : `${GITHUB_API}/latest`;
    const release = await fetch(url).then(r => r.json());
    const tag = release.tag_name;

    // Check if already installed
    const versionDir = join(destDir, tag);
    const existing = await findLlamaServer(versionDir);
    if (existing) return existing;

    // Find asset
    const ext = Deno.build.os === "windows" ? ".zip" : ".tar.gz";
    const asset = release.assets.find((a: { name: string }) => 
        a.name.includes(variant) && a.name.endsWith(ext)
    );
    if (!asset) throw new Error(`No asset found for variant: ${variant}`);

    // Download
    await ensureDir(versionDir);
    const archivePath = join(destDir, asset.name);
    const data = await fetch(asset.browser_download_url).then(r => r.arrayBuffer());
    await Deno.writeFile(archivePath, new Uint8Array(data));

    // Extract
    if (ext === ".zip") {
        const cmd = Deno.build.os === "windows"
            ? new Deno.Command("powershell", { args: ["-NoProfile", "-Command", `Expand-Archive -Force '${archivePath}' '${versionDir}'`] })
            : new Deno.Command("unzip", { args: ["-o", archivePath, "-d", versionDir] });
        await cmd.output();
    } else {
        await new Deno.Command("tar", { args: ["-xzf", archivePath, "-C", versionDir] }).output();
    }
    await Deno.remove(archivePath);

    // Find binary
    const llamaServer = await findLlamaServer(versionDir);
    if (!llamaServer) throw new Error("llama-server not found after extraction");
    
    if (Deno.build.os !== "windows") {
        await Deno.chmod(llamaServer, 0o755).catch(() => {});
    }
    
    return llamaServer;
}

/** Find llama-server in a directory (checks subdirs too) */
export async function findLlamaServer(dir: string): Promise<string | null> {
    const name = Deno.build.os === "windows" ? "llama-server.exe" : "llama-server";
    
    // Direct path
    try {
        const direct = join(dir, name);
        if ((await Deno.stat(direct)).isFile) return direct;
    } catch { /* not found */ }
    
    // Check subdirectories
    try {
        for await (const entry of Deno.readDir(dir)) {
            if (entry.isDirectory) {
                const nested = join(dir, entry.name, name);
                try {
                    if ((await Deno.stat(nested)).isFile) return nested;
                } catch { /* not found */ }
            }
        }
    } catch { /* dir doesn't exist */ }
    
    return null;
}

/** Get path to installed llama-server, or null if not installed */
export async function getInstalled(version?: string, destDir = OKE_DIR): Promise<string | null> {
    if (version) return findLlamaServer(join(destDir, version));
    
    // Find latest
    try {
        const versions: string[] = [];
        for await (const entry of Deno.readDir(destDir)) {
            if (entry.isDirectory && entry.name.startsWith("b")) {
                versions.push(entry.name);
            }
        }
        for (const ver of versions.sort().reverse()) {
            const path = await findLlamaServer(join(destDir, ver));
            if (path) return path;
        }
    } catch { /* dir doesn't exist */ }
    
    return null;
}

/** Remove a downloaded version, or all except latest if none specified */
export async function cleanup(version?: string, destDir = OKE_DIR): Promise<void> {
    if (version) {
        await Deno.remove(join(destDir, version), { recursive: true }).catch(() => {});
    } else {
        // Remove all except latest
        const versions: string[] = [];
        try {
            for await (const entry of Deno.readDir(destDir)) {
                if (entry.isDirectory && entry.name.startsWith("b")) {
                    versions.push(entry.name);
                }
            }
        } catch { return; }
        
        const sorted = versions.sort().reverse();
        for (const ver of sorted.slice(1)) {
            await Deno.remove(join(destDir, ver), { recursive: true }).catch(() => {});
        }
    }
}
