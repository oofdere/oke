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
    // Common params

    /** show list of models in cache */
    "cache-list"?: boolean;
    /** print source-able bash completion script for llama.cpp */
    "completion-bash"?: boolean;
    /** print a verbose prompt before generation (default: false) */
    "verbose-prompt"?: boolean;
    /** number of CPU threads to use during generation (default: -1) */
    threads?: number;
    /** number of threads to use during batch and prompt processing (default: same as --threads) */
    "threads-batch"?: number;
    /** CPU affinity mask: arbitrarily long hex. Complements cpu-range (default: "") */
    "cpu-mask"?: string;
    /** range of CPUs for affinity. Complements --cpu-mask */
    "cpu-range"?: string;
    /** use strict CPU placement (default: 0) */
    "cpu-strict"?: 0 | 1;
    /** set process/thread priority : -1-low, 0-normal, 1-medium, 2-high, 3-realtime (default: 0) */
    prio?: -1 | 0 | 1 | 2 | 3;
    /** use polling level to wait for work (0 - no polling, 100 - max polling, default: 50) */
    poll?: number;
    /** CPU affinity mask: arbitrarily long hex. Complements cpu-range-batch (default: same as --cpu-mask) */
    "cpu-mask-batch"?: string;
    /** ranges of CPUs for affinity. Complements --cpu-mask-batch */
    "cpu-range-batch"?: string;
    /** use strict CPU placement (default: same as --cpu-strict) */
    "cpu-strict-batch"?: 0 | 1;
    /** set process/thread priority : 0-normal, 1-medium, 2-high, 3-realtime (default: 0) */
    "prio-batch"?: 0 | 1 | 2 | 3;
    /** use polling to wait for work (default: same as --poll) */
    "poll-batch"?: 0 | 1;
    /** size of the prompt context (default: 0, 0 = loaded from model) */
    "ctx-size"?: number;
    /** number of tokens to predict (default: -1, -1 = infinity) */
    "n-predict"?: number;
    /** logical maximum batch size (default: 2048) */
    "batch-size"?: number;
    /** physical maximum batch size (default: 512) */
    "ubatch-size"?: number;
    /** number of tokens to keep from the initial prompt (default: 0, -1 = all) */
    keep?: number;
    /** use full-size SWA cache (default: false) */
    "swa-full"?: boolean;
    /** set Flash Attention use ('on', 'off', or 'auto', default: 'auto') */
    "flash-attn"?: "on" | "off" | "auto";
    /** whether to enable internal libllama performance timings (default: false) */
    "no-perf"?: boolean;
    /** whether to process escapes sequences (\n, \r, \t, \', \", \\) (default: true) */
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
    /** YaRN: scale sqrt(t) or attention magnitude (default: -1.0) */
    "yarn-attn-factor"?: number;
    /** YaRN: high correction dim or alpha (default: -1.0) */
    "yarn-beta-slow"?: number;
    /** YaRN: low correction dim or beta (default: -1.0) */
    "yarn-beta-fast"?: number;
    /** whether to enable KV cache offloading (default: enabled) */
    "kv-offload"?: boolean;
    /** whether to enable weight repacking (default: enabled) */
    repack?: boolean;
    /** bypass host buffer allowing extra buffers to be used */
    "no-host"?: boolean;
    /** KV cache data type for K (default: f16) */
    "cache-type-k"?: "f32" | "f16" | "bf16" | "q8_0" | "q4_0" | "q4_1" | "iq4_nl" | "q5_0" | "q5_1";
    /** KV cache data type for V (default: f16) */
    "cache-type-v"?: "f32" | "f16" | "bf16" | "q8_0" | "q4_0" | "q4_1" | "iq4_nl" | "q5_0" | "q5_1";
    /** KV cache defragmentation threshold (DEPRECATED) */
    "defrag-thold"?: number;
    /** force system to keep model in RAM rather than swapping or compressing */
    mlock?: boolean;
    /** whether to memory-map model (if disabled, slower load but may reduce pageouts if not using mlock) (default: enabled) */
    mmap?: boolean;
    /** attempt optimizations that help on some NUMA systems */
    numa?: "distribute" | "isolate" | "numactl";
    /** comma-separated list of devices to use for offloading (none = don't offload) */
    device?: string[]; // comma-separated list
    /** print list of available devices and exit */
    "list-devices"?: boolean;
    /** override tensor buffer type */
    "override-tensor"?: string[];
    /** keep all Mixture of Experts (MoE) weights in the CPU */
    "cpu-moe"?: boolean;
    /** keep the Mixture of Experts (MoE) weights of the first N layers in the CPU */
    "n-cpu-moe"?: number;
    /** max. number of layers to store in VRAM (default: -1) */
    "gpu-layers"?: number;
    /** max. number of layers to store in VRAM (default: -1) */
    "n-gpu-layers"?: number;
    /** how to split the model across multiple GPUs (default: layer) */
    "split-mode"?: "none" | "layer" | "row";
    /** fraction of the model to offload to each GPU, comma-separated list of proportions, e.g. 3,1 */
    "tensor-split"?: string; // float list e.g. 3,1
    /** the GPU to use for the model (with split-mode = none), or for intermediate results and KV (with split-mode = row) (default: 0) */
    "main-gpu"?: number;
    /** whether to adjust unset arguments to fit in device memory ('on' or 'off', default: 'on') */
    fit?: "on" | "off";
    /** target margin per device for --fit option, default: 1024 */
    "fit-target"?: number;
    /** minimum ctx size that can be set by --fit option, default: 4096 */
    "fit-ctx"?: number;
    /** check model tensor data for invalid values (default: false) */
    "check-tensors"?: boolean;
    /** advanced option to override model metadata by key */
    "override-kv"?: string[];
    /** whether to offload host tensor operations to device (default: true) */
    "op-offload"?: boolean;
    /** whether to offload host tensor operations to device (default: true) */
    "no-op-offload"?: boolean;
    /** path to LoRA adapter (use comma-separated values to load multiple adapters) */
    lora?: string | string[];
    /** path to LoRA adapter with user defined scaling (format: FNAME:SCALE,...) */
    "lora-scaled"?: string | string[];
    /** add a control vector */
    "control-vector"?: string | string[];
    /** add a control vector with user defined scaling SCALE */
    "control-vector-scaled"?: string | string[];
    /** layer range to apply the control vector(s) to, start and end inclusive */
    "control-vector-layer-range"?: string; // "START END"
    // model: string; // handled by main arg
    /** model download url (default: unused) */
    "model-url"?: string;
    /** Docker Hub model repository (default: unused) */
    "docker-repo"?: string;
    /** Hugging Face model repository (default: unused) */
    "hf-repo"?: string;
    /** Same as --hf-repo, but for the draft model (default: unused) */
    "hf-repo-draft"?: string;
    /** Hugging Face model file. If specified, it will override the quant in --hf-repo (default: unused) */
    "hf-file"?: string;
    /** Hugging Face model repository for the vocoder model (default: unused) */
    "hf-repo-v"?: string;
    /** Hugging Face model file for the vocoder model (default: unused) */
    "hf-file-v"?: string;
    /** Hugging Face access token (default: value from HF_TOKEN environment variable) */
    "hf-token"?: string;
    /** Log disable */
    "log-disable"?: boolean;
    /** Log to file */
    "log-file"?: string;
    /** Set colored logging ('on', 'off', or 'auto', default: 'auto') */
    "log-colors"?: "on" | "off" | "auto";
    /** Set verbosity level to infinity (i.e. log all messages, useful for debugging) */
    verbose?: boolean;
    /** Set verbosity level to infinity (i.e. log all messages, useful for debugging) */
    "log-verbose"?: boolean;
    /** Offline mode: forces use of cache, prevents network access */
    offline?: boolean;
    /** Set the verbosity threshold. Messages with a higher verbosity will be ignored. (default: 3) */
    verbosity?: number;
    /** Set the verbosity threshold. Messages with a higher verbosity will be ignored. (default: 3) */
    "log-verbosity"?: number;
    /** Enable prefix in log messages */
    "log-prefix"?: boolean;
    /** Enable timestamps in log messages */
    "log-timestamps"?: boolean;
    /** KV cache data type for K for the draft model (default: f16) */
    "cache-type-k-draft"?: string;
    /** KV cache data type for V for the draft model (default: f16) */
    "cache-type-v-draft"?: string;

    // Sampling params

    /** samplers that will be used for generation in the order, separated by ';' */
    samplers?: string;
    /** RNG seed (default: -1, use random seed for -1) */
    seed?: number;
    /** simplified sequence for samplers that will be used (default: edskypmxt) */
    "sampling-seq"?: string;
    /** simplified sequence for samplers that will be used (default: edskypmxt) */
    "sampler-seq"?: string;
    /** ignore end of stream token and continue generating (implies --logit-bias EOS-inf) */
    "ignore-eos"?: boolean;
    /** temperature (default: 0.8) */
    temp?: number;
    /** top-k sampling (default: 40, 0 = disabled) */
    "top-k"?: number;
    /** top-p sampling (default: 0.9, 1.0 = disabled) */
    "top-p"?: number;
    /** min-p sampling (default: 0.1, 0.0 = disabled) */
    "min-p"?: number;
    /** top-n-sigma sampling (default: -1.0, -1.0 = disabled) */
    "top-nsigma"?: number;
    /** xtc probability (default: 0.0, 0.0 = disabled) */
    "xtc-probability"?: number;
    /** xtc threshold (default: 0.1, 1.0 = disabled) */
    "xtc-threshold"?: number;
    /** locally typical sampling, parameter p (default: 1.0, 1.0 = disabled) */
    typical?: number;
    /** last n tokens to consider for penalize (default: 64, 0 = disabled, -1 = ctx_size) */
    "repeat-last-n"?: number;
    /** penalize repeat sequence of tokens (default: 1.0, 1.0 = disabled) */
    "repeat-penalty"?: number;
    /** repeat alpha presence penalty (default: 0.0, 0.0 = disabled) */
    "presence-penalty"?: number;
    /** repeat alpha frequency penalty (default: 0.0, 0.0 = disabled) */
    "frequency-penalty"?: number;
    /** set DRY sampling multiplier (default: 0.0, 0.0 = disabled) */
    "dry-multiplier"?: number;
    /** set DRY sampling base value (default: 1.75) */
    "dry-base"?: number;
    /** set allowed length for DRY sampling (default: 2) */
    "dry-allowed-length"?: number;
    /** set DRY penalty for the last n tokens (default: -1, 0 = disable, -1 = context size) */
    "dry-penalty-last-n"?: number;
    /** add sequence breaker for DRY sampling */
    "dry-sequence-breaker"?: string;
    /** dynamic temperature range (default: 0.0, 0.0 = disabled) */
    "dynatemp-range"?: number;
    /** dynamic temperature exponent (default: 1.0) */
    "dynatemp-exp"?: number;
    /** use Mirostat sampling (default: 0, 0 = disabled, 1 = Mirostat, 2 = Mirostat 2.0) */
    mirostat?: 0 | 1 | 2;
    /** Mirostat learning rate, parameter eta (default: 0.1) */
    "mirostat-lr"?: number;
    /** Mirostat target entropy, parameter tau (default: 5.0) */
    "mirostat-ent"?: number;
    /** modifies the likelihood of token appearing in the completion */
    "logit-bias"?: string[];
    /** BNF-like grammar to constrain generations (see samples in grammars/ dir) (default: '') */
    grammar?: string;
    /** file to read grammar from */
    "grammar-file"?: string;
    /** JSON schema to constrain generations */
    "json-schema"?: string;
    /** File containing a JSON schema to constrain generations */
    "json-schema-file"?: string;

    // Server-specific params

    /** max number of context checkpoints to create per slot (default: 8) */
    "ctx-checkpoints"?: number;
    /** max number of context checkpoints to create per slot (default: 8) */
    "swa-checkpoints"?: number;
    /** set the maximum cache size in MiB (default: 8192, -1 - no limit, 0 - disable) */
    "cache-ram"?: number;
    /** use single unified KV buffer shared across all sequences (default: enabled if number of slots is auto) */
    "kv-unified"?: boolean;
    /** whether to use context shift on infinite text generation (default: disabled) */
    "context-shift"?: boolean;
    /** whether to use context shift on infinite text generation (default: disabled) */
    "no-context-shift"?: boolean;
    /** halt generation at PROMPT, return control in interactive mode */
    "reverse-prompt"?: string;
    /** special tokens output enabled (default: false) */
    special?: boolean;
    /** whether to perform warmup with an empty run (default: enabled) */
    warmup?: boolean;
    /** whether to perform warmup with an empty run (default: enabled) */
    "no-warmup"?: boolean;
    /** use Suffix/Prefix/Middle pattern for infill (instead of Prefix/Suffix/Middle) (default: disabled) */
    "spm-infill"?: boolean;
    /** pooling type for embeddings, use model default if unspecified */
    pooling?: "none" | "mean" | "cls" | "last" | "rank";
    /** number of server slots (default: -1, -1 = auto) */
    parallel?: number;
    /** whether to enable continuous batching (a.k.a dynamic batching) (default: enabled) */
    "cont-batching"?: boolean;
    /** whether to enable continuous batching (a.k.a dynamic batching) (default: enabled) */
    "no-cont-batching"?: boolean;
    /** path to a multimodal projector file */
    mmproj?: string;
    /** URL to a multimodal projector file */
    "mmproj-url"?: string;
    /** whether to use multimodal projector file (if available) (default: enabled) */
    "mmproj-auto"?: boolean;
    /** whether to use multimodal projector file (if available) (default: enabled) */
    "no-mmproj"?: boolean;
    /** whether to use multimodal projector file (if available) (default: enabled) */
    "no-mmproj-auto"?: boolean;
    /** whether to enable GPU offloading for multimodal projector (default: enabled) */
    "mmproj-offload"?: boolean;
    /** whether to enable GPU offloading for multimodal projector (default: enabled) */
    "no-mmproj-offload"?: boolean;
    /** minimum number of tokens each image can take */
    "image-min-tokens"?: number;
    /** maximum number of tokens each image can take */
    "image-max-tokens"?: number;
    /** override tensor buffer type for draft model */
    "override-tensor-draft"?: string[];
    /** keep all Mixture of Experts (MoE) weights in the CPU for the draft model */
    "cpu-moe-draft"?: boolean;
    /** keep the Mixture of Experts (MoE) weights of the first N layers in the CPU for the draft model */
    "n-cpu-moe-draft"?: number;
    /** set alias for model name (to be used by REST API) */
    alias?: string;
    /** ip address to listen (default: 127.0.0.1) */
    host?: string;
    /** port to listen (default: 8080) */
    port?: number;
    /** path to serve static files from (default: ) */
    path?: string;
    /** prefix path the server serves from, without the trailing slash (default: ) */
    "api-prefix"?: string;
    /** JSON that provides default WebUI settings (overrides WebUI defaults) */
    "webui-config"?: string;
    /** JSON file that provides default WebUI settings (overrides WebUI defaults) */
    "webui-config-file"?: string;
    /** whether to enable the Web UI (default: enabled) */
    webui?: boolean;
    /** whether to enable the Web UI (default: enabled) */
    "no-webui"?: boolean;
    /** restrict to only support embedding use case; use only with dedicated embedding models (default: disabled) */
    embedding?: boolean;
    /** restrict to only support embedding use case; use only with dedicated embedding models (default: disabled) */
    embeddings?: boolean;
    /** enable reranking endpoint on server (default: disabled) */
    reranking?: boolean;
    /** enable reranking endpoint on server (default: disabled) */
    rerank?: boolean;
    /** API key to use for authentication (default: none) */
    "api-key"?: string;
    /** path to file containing API keys (default: none) */
    "api-key-file"?: string;
    /** path to file a PEM-encoded SSL private key */
    "ssl-key-file"?: string;
    /** path to file a PEM-encoded SSL certificate */
    "ssl-cert-file"?: string;
    /** sets additional params for the json template parser */
    "chat-template-kwargs"?: string;
    /** server read/write timeout in seconds (default: 600) */
    timeout?: number;
    /** number of threads used to process HTTP requests (default: -1) */
    "threads-http"?: number;
    /** min chunk size to attempt reusing from the cache via KV shifting (default: 0) */
    "cache-reuse"?: number;
    /** enable prometheus compatible metrics endpoint (default: disabled) */
    metrics?: boolean;
    /** enable changing global properties via POST /props (default: disabled) */
    props?: boolean;
    /** expose slots monitoring endpoint (default: enabled) */
    slots?: boolean;
    /** expose slots monitoring endpoint (default: enabled) */
    "no-slots"?: boolean;
    /** path to save slot kv cache (default: disabled) */
    "slot-save-path"?: string;
    /** directory for loading local media files (default: disabled) */
    "media-path"?: string;
    /** directory containing models for the router server (default: disabled) */
    "models-dir"?: string;
    /** path to INI file containing model presets for the router server (default: disabled) */
    "models-preset"?: string;
    /** for router server, maximum number of models to load simultaneously (default: 4, 0 = unlimited) */
    "models-max"?: number;
    /** for router server, whether to automatically load models (default: enabled) */
    "models-autoload"?: boolean;
    /** for router server, whether to automatically load models (default: enabled) */
    "no-models-autoload"?: boolean;
    /** whether to use jinja template engine for chat (default: enabled) */
    jinja?: boolean;
    /** whether to use jinja template engine for chat (default: enabled) */
    "no-jinja"?: boolean;
    /** controls whether thought tags are allowed and/or extracted from the response (default: auto) */
    "reasoning-format"?: "none" | "deepseek" | "deepseek-legacy";
    /** controls the amount of thinking allowed (default: -1) */
    "reasoning-budget"?: number;
    /** set custom jinja chat template (default: template taken from model's metadata) */
    "chat-template"?: string;
    /** set custom jinja chat template file (default: template taken from model's metadata) */
    "chat-template-file"?: string;
    /** whether to prefill the assistant's response if the last message is an assistant message (default: prefill enabled) */
    "prefill-assistant"?: boolean;
    /** whether to prefill the assistant's response if the last message is an assistant message (default: prefill enabled) */
    "no-prefill-assistant"?: boolean;
    /** how much the prompt of a request must match the prompt of a slot in order to use that slot (default: 0.10, 0.0 = disabled) */
    "slot-prompt-similarity"?: number;
    /** load LoRA adapters without applying them (apply later via POST /lora-adapters) (default: disabled) */
    "lora-init-without-apply"?: boolean;
    /** number of threads to use during generation (default: same as --threads) */
    "threads-draft"?: number;
    /** number of threads to use during batch and prompt processing (default: same as --threads-draft) */
    "threads-batch-draft"?: number;
    /** number of tokens to draft for speculative decoding (default: 16) */
    "draft-max"?: number;
    /** number of tokens to draft for speculative decoding (default: 16) */
    draft?: number;
    /** number of tokens to draft for speculative decoding (default: 16) */
    "draft-n"?: number;
    /** minimum number of draft tokens to use for speculative decoding (default: 0) */
    "draft-min"?: number;
    /** minimum number of draft tokens to use for speculative decoding (default: 0) */
    "draft-n-min"?: number;
    /** minimum speculative decoding probability (greedy) (default: 0.8) */
    "draft-p-min"?: number;
    /** size of the prompt context for the draft model (default: 0, 0 = loaded from model) */
    "ctx-size-draft"?: number;
    /** comma-separated list of devices to use for offloading the draft model (none = don't offload) */
    "device-draft"?: string;
    /** number of layers to store in VRAM for the draft model */
    "gpu-layers-draft"?: number;
    /** number of layers to store in VRAM for the draft model */
    "n-gpu-layers-draft"?: number;
    /** draft model for speculative decoding (default: unused) */
    "model-draft"?: string;
    /** translate the string in TARGET into DRAFT if the draft model and main model are not compatible */
    "spec-replace"?: string; // "TARGET DRAFT"
    /** vocoder model for audio generation (default: unused) */
    "model-vocoder"?: string;
    /** Use guide tokens to improve TTS word recall */
    "tts-use-guide-tokens"?: boolean;
    /** use default EmbeddingGemma model (note: can download weights from the internet) */
    "embd-gemma-default"?: boolean;
    /** use default Qwen 2.5 Coder 1.5B (note: can download weights from the internet) */
    "fim-qwen-1.5b-default"?: boolean;
    /** use default Qwen 2.5 Coder 3B (note: can download weights from the internet) */
    "fim-qwen-3b-default"?: boolean;
    /** use default Qwen 2.5 Coder 7B (note: can download weights from the internet) */
    "fim-qwen-7b-default"?: boolean;
    /** use Qwen 2.5 Coder 7B + 0.5B draft for speculative decoding (note: can download weights from the internet) */
    "fim-qwen-7b-spec"?: boolean;
    /** use Qwen 2.5 Coder 14B + 0.5B draft for speculative decoding (note: can download weights from the internet) */
    "fim-qwen-14b-spec"?: boolean;
    /** use default Qwen 3 Coder 30B A3B Instruct (note: can download weights from the internet) */
    "fim-qwen-30b-default"?: boolean;
    /** use gpt-oss-20b (note: can download weights from the internet) */
    "gpt-oss-20b-default"?: boolean;
    /** use gpt-oss-120b (note: can download weights from the internet) */
    "gpt-oss-120b-default"?: boolean;
    /** use Gemma 3 4B QAT (note: can download weights from the internet) */
    "vision-gemma-4b-default"?: boolean;
    /** use Gemma 3 12B QAT (note: can download weights from the internet) */
    "vision-gemma-12b-default"?: boolean;
};
// add separate lora input type
// add separate control vector type
