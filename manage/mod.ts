import { LlamaServer } from "@oke/client";
import { getAvailablePort } from "@std/net";
import { download, getInstalled } from "./unstable-download.ts";

const decode = new TextDecoder();

export type ManagedLlamaServer = {
    endpoint: string;
    api_key: string;
    process: Deno.ChildProcess;
    kill: () => Promise<void>;
} & LlamaServer;

/** start/stop a managed llama-server */
export async function ManagedLlamaServer(
    model: string,
    options?: { path?: string; args?: LaunchArgs },
): Promise<ManagedLlamaServer> {
    // Get llama-server path (download if needed)
    const path = options?.path ?? await getInstalled() ?? await download();
    
    const port = getAvailablePort();
    const api_key = crypto.randomUUID();
    const cmd = new Deno.Command(path, {
        args: [
            `--port`, `${port}`,
            `--model`, `${model}`,
            `--api-key`, `${api_key}`,
            ...Object.entries(options?.args || {}).flatMap(([k, v]) =>
                typeof v === "boolean"
                    ? (v === true ? [`--${k}`] : [])
                    : [`--${k}`, `${v}`]
            ),
        ],
        stderr: "piped", // yes, stdout and stderr are flipped :sob:
    });
    const process: Deno.ChildProcess = cmd.spawn();
    process.kill;
    for await (const l of process.stderr) {
        const line = decode.decode(l);
        console.log("stderr:", line);
        if (line.includes("main: server is listening on ")) {
            const endpoint = line.split("\n").find((l) =>
                l === undefined
                    ? false
                    : l.includes("main: server is listening on ")
            )!.replace("main: server is listening on", "")
                .replace(" - starting the main loop", "").trim();
            const client = await LlamaServer(
                endpoint,
                { apiKey: api_key },
            ) as ManagedLlamaServer;
            client.endpoint = endpoint;
            client.api_key = api_key;
            client.process = process;
            client.kill = async () => {
                process.kill();
                await process.status;
            };
            return client;
        }
    }
    throw "failed to launch";
}

if (import.meta.main) {
    const llama = await ManagedLlamaServer(
        "/home/teo/Downloads/Trinity-Nano-Base-Pre-Anneal.i1-Q4_K_M.gguf",
    );
    console.log(
        "started llama.cpp",
        llama.props.build_info,
        "server running",
        llama.props.model_path,
        "at",
        llama.endpoint,
        "with api key",
        llama.api_key,
    );
    console.log((await llama.completion("9 + 10 = ", {
        stop: ["\n"],
    })).content);
    llama.process.kill();
}



export type LaunchArgs = {
    /** print a verbose prompt before generation (default: false) */
    "verbose-prompt"?: boolean;
    /** number of threads to use during generation (default: -1) */
    threads?: number;
    /** number of threads to use during batch and prompt processing (default: same as --threads) */
    "threads-batch"?: number;
    /** CPU affinity mask: arbitrarily long hex. Complements cpu-range (default: "") */
    "cpu-mask"?: string;
    /** range of CPUs for affinity. Complements --cpu-mask */
    "cpu-range"?: string;
    /** use strict CPU placement (default: 0) */
    "cpu-strict"?: 0 | 1;
    /** set process/thread priority : 0-normal, 1-medium, 2-high, 3-realtime (default: 0) */
    prio?: 0 | 1 | 2 | 3;
    /** use polling level to wait for work (0 - no polling, default: 50) */
    poll?: number;
    /** CPU affinity mask: arbitrarily long hex. Complements cpu-range-batch (default: same as --cpu-mask) */
    "cpu-mask-batch"?: string;
    /** ranges of CPUs for affinity. Complements --cpu-mask-batch */
    "cpu-range-batch"?: string;
    /** use strict CPU placement (default: same as --cpu-strict) */
    "cpu-strict-batch"?: string;
    /** set process/thread priority : 0-normal, 1-medium, 2-high, 3-realtime (default: 0) */
    "prio-batch"?: 0 | 1 | 2 | 3;
    /** use polling to wait for work (default: same as --poll) */
    "poll-batch"?: 0 | 1;
    /** size of the prompt context (default: 4096, 0 = loaded from model) */
    "ctx-size"?: 0 | number;
    /** number of tokens to predict (default: -1, -1 = infinity) */
    predict?: -1 | number;
    /** logical maximum batch size (default: 2048) */
    "batch-size"?: number;
    /** physical maximum batch size (default: 512) */
    "ubatch-size"?: number;
    /** number of tokens to keep from the initial prompt (default: 0, -1 = all) */
    keep?: -1 | number;
    /** enable Flash Attention (default: disabled) */
    "flash-attn"?: boolean;
    /** disable internal libllama performance timings (default: false) */
    "no-perf"?: boolean;
    /** process escapes sequences (\n, \r, \t, ', ", \) (default: true) */
    escape?: boolean;
    /** RoPE frequency scaling method, defaults to linear unless specified by the model */
    "rope-scaling"?: "none" | "linear" | "yarn";
    /** RoPE context scaling factor, expands context by a factor of N */
    "rope-scale"?: number;
    /** RoPE base frequency, used by NTK-aware scaling (default: loaded from model) */
    "rope-freq-base"?: number;
    /** RoPE frequency scaling factor, expands context by a factor of 1/N */
    "rope-freq-scale"?: number;
    /** YaRN: original context size of model (default: 0 = model training context size) */
    "yarn-orig-ctx"?: number;
    /** YaRN: extrapolation mix factor (default: -1.0, 0.0 = full interpolation) */
    "yarn-ext-factor"?: number;
    /** YaRN: scale sqrt(t) or attention magnitude (default: 1.0) */
    "yarn-attn-factor"?: number;
    /** YaRN: high correction dim or alpha (default: 1.0) */
    "yarn-beta-slow"?: number;
    /** YaRN: low correction dim or beta (default: 32.0) */
    "yarn-beta-fast"?: number;
    /** disable KV offload */
    "no-kv-offload"?: boolean;
    /** KV cache data type for K
     * allowed values: f32, f16, bf16, q8_0, q4_0, q4_1, iq4_nl, q5_0, q5_1
     * (default: f16) */
    "cache-type-k"?:
        | "f32"
        | "f16"
        | "bf16"
        | "q8_0"
        | "q4_0"
        | "q4_1"
        | "iq4_nl"
        | "q5_0"
        | "q5_1";
    /** KV cache data type for V
     * allowed values: f32, f16, bf16, q8_0, q4_0, q4_1, iq4_nl, q5_0, q5_1
     * (default: f16) */
    "cache-type-v"?:
        | "f32"
        | "f16"
        | "bf16"
        | "q8_0"
        | "q4_0"
        | "q4_1"
        | "iq4_nl"
        | "q5_0"
        | "q5_1";
    /** @deprecated KV cache defragmentation threshold (DEPRECATED) */
    "defrag-thold"?: number;
    /** number of parallel sequences to decode (default: 1) */
    parallel?: number;
    /** force system to keep model in RAM rather than swapping or compressing */
    mlock?: boolean;
    /** do not memory-map model (slower load but may reduce pageouts if not using mlock) */
    "no-mmap"?: boolean;
    /** attempt optimizations that help on some NUMA systems
     * - distribute: spread execution evenly over all nodes
     * - isolate: only spawn threads on CPUs on the node that execution started on
     * - numactl: use the CPU map provided by numactl
     * if run without this previously, it is recommended to drop the system page cache before using this
     * see https://github.com/ggml-org/llama.cpp/issues/1437 */
    numa?: "distribute" | "isolate" | "numactl";
    /** comma-separated list of devices to use for offloading (none = don't offload)
     * use --list-devices to see a list of available devices */
    device?: string[];
    /** override tensor buffer type */
    "override-tensor"?: string;
    /** number of layers to store in VRAM */
    "gpu-layers"?: number;
    /** how to split the model across multiple GPUs, one of:
     * - none: use one GPU only
     * - layer (default): split layers and KV across GPUs
     * - row: split rows across GPUs */
    "split-mode"?: "none" | "layer" | "row";
    /** fraction of the model to offload to each GPU, comma-separated list of proportions, e.g. 3,1 */
    "tensor-split"?: number[];
    /** the GPU to use for the model (with split-mode = none), or for intermediate results and KV (with split-mode = row) (default: 0) */
    "main-gpu"?: number;
    /** check model tensor data for invalid values (default: false) */
    "check-tensors"?: boolean;
    /** always keep this on tbh */
    "context-shift"?: boolean;
};
// add separate lora input type
// add separate control vector type
