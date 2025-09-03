import ky from "ky";
import { trimBy } from "@std/text/unstable-trim-by";

/** A class that connects to a llama-server */
export class LlamaServer {
    api!: ReturnType<typeof ky.extend>;
    props!: LlamaServerProps;
    public static async new(baseUrl: string, options?: {
        apiKey?: string;
    }): Promise<LlamaServer> {
        const inst = new LlamaServer();
        inst.api = ky.extend({
            "prefixUrl": baseUrl,
            "headers": {
                "Authorization": `bearer ${options?.apiKey || "no-key"}`,
            },
            timeout: false,
        });
        inst.props = await inst.getProps();
        return inst;
    }

    /** performs a health check on the server */
    async health(): Promise<
        { status: "ok" } | {
            "error": {
                "code": 503;
                "message": "Loading model";
                "type": "unavailable_error";
            };
        }
    > {
        return await this.api.get("health").json();
    }

    async completion(
        prompt: string | (string | number)[],
        options?: LlamaCompletionOptions,
    ): Promise<LlamaCompletionResponse> {
        return await this.api.post("completion", {
            json: { prompt, ...options },
        }).json<LlamaCompletionResponse>();
    }
    async streamingCompletion(
        prompt: string | (string | number)[],
        callback: (chunk: StreamedChunk) => void,
        options?: LlamaCompletionOptions,
    ): Promise<LlamaCompletionResponse> {
        const decoder = new TextDecoder();
        let content = "";
        const tokens: number[] = [];
        let res!: LlamaCompletionResponse;
        let fragment = "";
        await this.api.post("completion", {
            json: { prompt, stream: true, ...options },
            timeout: false,
            onDownloadProgress(_progress, chunk) {
                const c = trimBy(decoder.decode(chunk), ["data: ", "\n"]);
                if (c.endsWith("}")) {
                    const chunk: StreamedChunk = JSON.parse(fragment + c);
                    content += chunk.content;
                    tokens.push(...chunk.tokens);
                    if (chunk.stop) {
                        res = chunk as LlamaCompletionResponse;
                    } else {
                        callback(JSON.parse(c));
                    }
                    fragment = "";
                } else {
                    fragment += c;
                }
            },
        }).text();
        return {
            ...res,
            content,
            tokens,
        };
    }

    async getProps(): Promise<LlamaServerProps> {
        return await this.api.get("props").json<LlamaServerProps>();
    }

    private async setProps() {} // todo

    private async embeddings() {} // todo

    private async getSlots() {} // todo
    private async saveSlot() {} // todo
    private async loadSlot() {} // todo
    private async eraseSlot() {} // todo

    private async getLoras() {} // todo
    private async setLoras() {} // todo
    private async getLora() {} // todo
    private async setLora() {} // todo
}

if (import.meta.main) {
    const llama = await LlamaServer.new("http://100.102.174.127:34992/");
    console.log(await llama.health());
    console.log(llama.props);
    console.log(
        "res",
        await llama.streamingCompletion(
            "I am yume and today is ",
            ({ content }) => console.log(content),
            {
                stop: ["."],
            },
        ),
    );
}

/** this is what llama-server returns when streaming each chunk of a generation */
export type StreamedChunk = {
    index: number;
    /** content: Completion result as a string (excluding stopping_word if any). In case of streaming mode, will contain the next token as a string. */
    content: string;
    /** tokens: Same as content but represented as raw token ids. Only populated if "return_tokens": true or "stream": true in the request. */
    tokens: number[];
    /** stop: Boolean for use with stream to check whether the generation has stopped (Note: This is not related to stopping words array stop from input options) */
    stop: boolean;
    id_slot: number;
    /** tokens_predicted: Number of tokens predicted so far from the prompt */
    tokens_predicted: number;
    /** tokens_evaluated: Number of tokens evaluated in total from the prompt */
    tokens_evaluated: number;
};

export type LlamaCompletionOptions = {
    /** temperature: Adjust the randomness of the generated text. */
    temprature?: number;
    /** dynatemp_range: Dynamic temperature range. The final temperature will be in the range of [temperature - dynatemp_range; temperature + dynatemp_range] Default: 0.0, which is disabled. */
    dynatemp_range?: number;
    /** dynatemp_exponent: Dynamic temperature exponent. Default: 1.0 */
    dynatemp_exponent?: number;
    /** top_k: Limit the next token selection to the K most probable tokens. Default: 40 */
    top_k?: number;
    /** top_p: Limit the next token selection to a subset of tokens with a cumulative probability above a threshold P. Default: 0.95 */
    top_p?: number;
    /** min_p: The minimum probability for a token to be considered, relative to the probability of the most likely token. Default: 0.05 */
    min_p?: number;
    /** n_predict: Set the maximum number of tokens to predict when generating text. Note: May exceed the set limit slightly if the last token is a partial multibyte character. When 0, no tokens will be generated but the prompt is evaluated into the cache. Default: -1, where -1 is infinity. */
    n_predict?: number;
    /** n_indent: Specify the minimum line indentation for the generated text in number of whitespace characters. Useful for code completion tasks. Default: 0 */
    n_indent?: number;
    /** n_keep: Specify the number of tokens from the prompt to retain when the context size is exceeded and tokens need to be discarded. The number excludes the BOS token. By default, this value is set to 0, meaning no tokens are kept. Use -1 to retain all tokens from the prompt. */
    n_keep?: number;
    /** stop: Specify a JSON array of stopping strings. These words will not be included in the completion, so make sure to add them to the prompt for the next iteration. Default: [] */
    stop?: string[];
    /** typical_p: Enable locally typical sampling with parameter p. Default: 1.0, which is disabled. */
    typical_p?: number;
    /** repeat_penalty: Control the repetition of token sequences in the generated text. Default: 1.1 */
    repeat_penalty?: number;
    /** repeat_last_n: Last n tokens to consider for penalizing repetition. Default: 64, where 0 is disabled and -1 is ctx-size. */
    repeat_last_n?: number;
    /** presence_penalty: Repeat alpha presence penalty. Default: 0.0, which is disabled. */
    presence_penalty?: number;
    /** frequency_penalty: Repeat alpha frequency penalty. Default: 0.0, which is disabled. */
    frequency_penalty?: number;
    /** dry_multiplier: Set the DRY (Don't Repeat Yourself) repetition penalty multiplier. Default: 0.0, which is disabled. */
    dry_multiplier?: number;
    /** dry_base: Set the DRY repetition penalty base value. Default: 1.75 */
    dry_base?: number;
    /** dry_allowed_length: Tokens that extend repetition beyond this receive exponentially increasing penalty: multiplier * base ^ (length of repeating sequence before token - allowed length). Default: 2 */
    dry_allowed_length?: number;
    /** dry_penalty_last_n: How many tokens to scan for repetitions. Default: -1, where 0 is disabled and -1 is context size. */
    dry_penalty_last_n?: number;
    /** dry_sequence_breakers: Specify an array of sequence breakers for DRY sampling. Only a JSON array of strings is accepted. Default: ['\n', ':', '"', '*'] */
    dry_sequence_breakers?: string[];
    /** xtc_probability: Set the chance for token removal via XTC sampler. Default: 0.0, which is disabled. */
    xtc_probability?: number;
    /** xtc_threshold: Set a minimum probability threshold for tokens to be removed via XTC sampler. Default: 0.1 (> 0.5 disables XTC) */
    xtc_threshold?: number;
    /** mirostat: Enable Mirostat sampling, controlling perplexity during text generation. Default: 0, where 0 is disabled, 1 is Mirostat, and 2 is Mirostat 2.0. */
    mirostat?: 0 | 1 | 2;
    /** mirostat_tau: Set the Mirostat target entropy, parameter tau. Default: 5.0 */
    mirostat_tau?: number;
    /** mirostat_eta: Set the Mirostat learning rate, parameter eta. Default: 0.1 */
    mirostat_eta?: number;
    /** grammar: Set grammar for grammar-based sampling. Default: no grammar */
    grammar?: string;
    /** json_schema: Set a JSON schema for grammar-based sampling (e.g. {"items": {"type": "string"}, "minItems": 10, "maxItems": 100} of a list of strings, or {} for any JSON). See tests for supported features. Default: no JSON schema. */
    json_schema?: string; // todo: actual type for this
    /** seed: Set the random number generator (RNG) seed. Default: -1, which is a random seed. */
    seed?: number;
    /** ignore_eos: Ignore end of stream token and continue generating. Default: false */
    ignore_eos?: boolean;
    /** logit_bias: Modify the likelihood of a token appearing in the generated text completion. For example, use "logit_bias": [[15043,1.0]] to increase the likelihood of the token 'Hello', or "logit_bias": [[15043,-1.0]] to decrease its likelihood. Setting the value to false, "logit_bias": [[15043,false]] ensures that the token Hello is never produced. The tokens can also be represented as strings, e.g. [["Hello, World!",-0.5]] will reduce the likelihood of all the individual tokens that represent the string Hello, World!, just like the presence_penalty does. For compatibility with the OpenAI API, a JSON object {"": bias, ...} can also be passed. Default: [] */
    logit_bias?: [string | number, boolean | number][]; // todo: add type for openai-style logit bias
    /** n_probs: If greater than 0, the response also contains the probabilities of top N tokens for each generated token given the sampling settings. Note that for temperature < 0 the tokens are sampled greedily but token probabilities are still being calculated via a simple softmax of the logits without considering any other sampler settings. Default: 0 */
    n_probs?: number;
    /** min_keep: If greater than 0, force samplers to return N possible tokens at minimum. Default: 0 */
    min_keep?: number;
    /** t_max_predict_ms: Set a time limit in milliseconds for the prediction (a.k.a. text-generation) phase. The timeout will trigger if the generation takes more than the specified time (measured since the first token was generated) and if a new-line character has already been generated. Useful for FIM applications. Default: 0, which is disabled. */
    t_max_predict_ms?: number;
    /** id_slot: Assign the completion task to an specific slot. If is -1 the task will be assigned to a Idle slot. Default: -1 */
    id_slot?: number;
    /** cache_prompt: Re-use KV cache from a previous request if possible. This way the common prefix does not have to be re-processed, only the suffix that differs between the requests. Because (depending on the backend) the logits are not guaranteed to be bit-for-bit identical for different batch sizes (prompt processing vs. token generation) enabling this option can cause nondeterministic results. Default: true */
    cache_prompt?: boolean;
    /** return_tokens: Return the raw generated token ids in the tokens field. Otherwise tokens remains empty. Default: false */
    return_tokens?: boolean;
    /** samplers: The order the samplers should be applied in. An array of strings representing sampler type names. If a sampler is not set, it will not be used. If a sampler is specified more than once, it will be applied multiple times. Default: ["dry", "top_k", "typ_p", "top_p", "min_p", "xtc", "temperature"] - these are all the available values. */
    samplers?: ("dry" | "top_k" | "typ_p" | "min_p" | "xtc" | "temperature")[];
    /** timings_per_token: Include prompt processing and text generation speed information in each response. Default: false */
    timings_per_token?: boolean;
    /** post_sampling_probs: Returns the probabilities of top n_probs tokens after applying sampling chain. */
    post_sampling_probs?: unknown; // probably a boolean?????
    /** response_fields: A list of response fields, for example: "response_fields": ["content", "generation_settings/n_predict"]. If the specified field is missing, it will simply be omitted from the response without triggering an error. Note that fields with a slash will be unnested; for example, generation_settings/n_predict will move the field n_predict from the generation_settings object to the root of the response and give it a new name. */
    response_fields?: string[];
    /** lora: A list of LoRA adapters to be applied to this specific request. Each object in the list must contain id and scale fields. For example: [{"id": 0, "scale": 0.5}, {"id": 1, "scale": 1.1}]. If a LoRA adapter is not specified in the list, its scale will default to 0.0. Please note that requests with different LoRA configurations will not be batched together, which may result in performance degradation. */
    lora?: { id: number; scale: number }[];
};

export type LlamaCompletionResponse = {
    index: number;
    /** content: Completion result as a string (excluding stopping_word if any). In case of streaming mode, will contain the next token as a string. */
    content: string;
    /** tokens: Same as content but represented as raw token ids. Only populated if "return_tokens": true or "stream": true in the request. */
    tokens: number[];
    id_slot: number;
    /** stop: Boolean for use with stream to check whether the generation has stopped (Note: This is not related to stopping words array stop from input options) */
    stop: boolean;
    /** model: The model alias (for model path, please use /props endpoint) */
    model: string;
    /** tokens_predicted: Number of tokens predicted in total from the prompt */
    tokens_predicted: number;
    /** tokens_evaluated: Number of tokens evaluated in total from the prompt */
    tokens_evaluated: number;
    /** generation_settings: The provided options above excluding prompt but including n_ctx, model. These options may differ from the original ones in some way (e.g. bad values filtered out, strings converted to tokens, etc.). */
    generation_settings: Required<LlamaCompletionOptions>;
    /** prompt: The processed prompt (special tokens may be added) */
    prompt: string;
    has_new_line: boolean;
    /** truncated: Boolean indicating if the context size was exceeded during generation, i.e. the number of tokens provided in the prompt (tokens_evaluated) plus tokens generated (tokens predicted) exceeded the context size (n_ctx) */
    truncated: boolean;
    /** stop_type: Indicating whether the completion has stopped. Possible values are:
     *  - none: Generating (not stopped)
     *  - eos: Stopped because it encountered the EOS token
     *  - limit: Stopped because n_predict tokens were generated before stop words or EOS was encountered
     *  - word: Stopped due to encountering a stopping word from stop JSON array provided
     */
    stop_type: "none" | "eos" | "limit" | "word";
    /** stopping_word: The stopping word encountered which stopped the generation (or "" if not stopped due to a stopping word) */
    stopping_word: string;
    /** tokens_cached: Number of tokens from the prompt which could be re-used from previous completion (n_past) */
    tokens_cached: number;
    /** timings: Hash of timing information about the completion such as the number of tokens predicted_per_second */
    timings: {
        prompt_n: number;
        prompt_ms: number;
        prompt_per_token_ms: number;
        prompt_per_second: number;
        predicted_n: number;
        predicted_ms: number;
        predicted_per_token_ms: number;
        predicted_per_second: number;
    };
};

export type LlamaServerProps = {
    default_generation_settings: {
        id: number;
        id_task: number;
        n_ctx: number;
        speculative: boolean;
        is_processing: boolean;
        params: {
            n_predict: number;
            seed: number;
            temperature: number;
            dynatemp_range: number;
            dynatemp_exponent: number;
            top_k: number;
            top_p: number;
            min_p: number;
            top_n_sigma: number;
            xtc_probability: number;
            xtc_threshold: number;
            typical_p: number;
            repeat_last_n: number;
            repeat_penalty: number;
            presence_penalty: number;
            frequency_penalty: number;
            dry_multiplier: number;
            dry_base: number;
            dry_allowed_length: number;
            dry_penalty_last_n: number;
            dry_sequence_breakers: string[];
            mirostat: number;
            mirostat_tau: number;
            mirostat_eta: number;
            stop: string[];
            max_tokens: number;
            n_keep: number;
            n_discard: number;
            ignore_eos: boolean;
            stream: boolean;
            logit_bias: string[]; //?
            n_probs: number;
            min_keep: number;
            grammar: string;
            grammar_lazy: boolean;
            grammar_triggers: string[]; //?
            preserved_tokens: string[]; //?
            chat_format: string; //?
            reasoning_format: "none" | string; //?
            reasoning_in_content: boolean;
            thinking_forced_open: boolean;
            samplers: (
                | "penalties"
                | "dry"
                | "top_n_sigma"
                | "top_k"
                | "typ_p"
                | "top_p"
                | "min_p"
                | "xtc"
                | "temperature"
            )[];
            "speculative.n_max": number;
            "speculative.n_min": number;
            "speculative.p_min": number;
            timings_per_token: boolean;
            post_sampling_probs: boolean;
            lora: string[];
        };
        prompt: string;
        next_token: {
            has_next_token: boolean;
            has_new_line: boolean;
            n_remain: number;
            n_decoded: number;
            stopping_word: string;
        };
    };
    total_slots: number;
    model_path: string;
    modalities: { vision: boolean; audio: boolean };
    chat_template: string;
    bos_token: string;
    eos_token: string;
    build_info: `b${string}-e${string}`;
};
