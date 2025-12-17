/**
 * this module is vibe coded from now on because the output format changes constantly. NO ONE should EVER rely on this, instead, use the server info endpoints after launching an instance
 * 
 * Inspect llama.cpp binaries for version and device information
 */

const decode = new TextDecoder();

/** Version information from a llama-server binary */
export type Version = {
    build: string;
    hash: string;
    compiler: string;
    arch: string;
};

/** Device information from llama-server */
export type Device = {
    runtime: string;
    index: number;
    device: string;
    memory: string;
    free: string;
};

/** Check the version of a llama-server binary */
export function version(path: string): Version {
    const cmd = new Deno.Command(path, { args: ["--version"] });
    const child = cmd.outputSync();
    const output = decode.decode(child.stderr);

    // Format: "version: 1234 (abc123)\nbuilt with gcc-11 for x86_64"
    // GPU backends may print initialization lines before the version, so we use regex
    const versionMatch = output.match(/version:\s*(\S+)\s*\(([^)]+)\)/);
    const builtMatch = output.match(/built with\s+(.+?)\s+for\s+(\S+)/);

    return {
        build: versionMatch?.[1] ?? "",
        hash: versionMatch?.[2] ?? "",
        compiler: builtMatch?.[1] ?? "",
        arch: builtMatch?.[2] ?? "",
    };
}

/** List available devices */
export function listDevices(path: string): Device[] {
    const cmd = new Deno.Command(path, { args: ["--list-devices"] });
    const child = cmd.outputSync();
    const lines = decode.decode(child.stdout)
        .replace("Available devices:", "")
        .trim()
        .split("\n");

    // Format: "Runtime0: Device Name (possibly with parens) (XXXX MiB, YYYY MiB free)"
    const regex = /^([A-Za-z]+)(\d+):\s+(.+?)\s+\((\d+\s*\w+),\s*(\d+\s*\w+)\s*free\)$/;

    return lines.map((line) => {
        const match = line.match(regex);
        if (match) {
            return {
                runtime: match[1],
                index: parseInt(match[2], 10),
                device: match[3],
                memory: match[4],
                free: match[5],
            };
        }
        // Fallback for unexpected formats
        return {
            runtime: line,
            index: 0,
            device: "",
            memory: "",
            free: "",
        };
    });
}
