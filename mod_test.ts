/// <reference lib="deno.ns" />
import {
    choice,
    grammar,
    optional,
    range,
    repeat,
    repeat0,
    repeat1,
    seq,
    stringify,
} from "./mod.ts";
import { assertEquals } from "jsr:@std/assert";

Deno.test("stringify", async (t) => {
    await t.step("choice", () => {
        assertEquals(`("a" | "b")`, stringify(choice("a", "b")));
    });

    await t.step("optional", () => {
        assertEquals(`"a"?`, stringify(optional("a")));
    });

    await t.step("range", async (t) => {
        assertEquals(`[a-z]`, stringify(range("a-z")));
    });

    await t.step("repeat", async (t) => {
        assertEquals(`"a"{1,4}`, stringify(repeat("a", 1, 4)));
    });

    await t.step("repeat0", async (t) => {
        assertEquals(`"a"*`, stringify(repeat0("a")));
    });

    await t.step("repeat1", async (t) => {
        assertEquals(`"a"+`, stringify(repeat1("a")));
    });

    await t.step("seq", async (t) => {
        assertEquals(`"a" "b" "c"`, stringify(seq("a", "b", "c")));
    });
});

// import { loadModel } from "@fugood/llama.node";
// import { trimEndBy } from "@std/text/unstable-trim-by";

// // const context = await loadModel({
// //     model: "/Users/teo/Downloads/SmolLM-135M.Q2_K.gguf",
// // });

// async function deterministicCompletion(prompt: string, grammar: string) {
//     return trimEndBy(
//         (await context.completion({
//             prompt,
//             temperature: 0,
//             seed: 0,
//             grammar,
//             stop: ["<|endoftext|>"],
//         })).text,
//         "<|endoftext|>",
//     );
// }
