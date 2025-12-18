// super simple llamacpp version manager

import { parseArgs } from "@std/cli/parse-args";
import * as download from "../../manage/unstable-download.ts";
import { match, P } from "ts-pattern";

const args = parseArgs(Deno.args);

match(args._)
    .with(["run"], async () => {
        const llamaServer = await download.getInstalled() ||
            await download.download();
        new Deno.Command(llamaServer, {
            args: Deno.args.slice(1),
        }).spawn();
    })
    .with(["run", P.string], async ([_, version]) => {
        const llamaServer = await download.getInstalled(version) ||
            await download.download({ version });
        new Deno.Command(llamaServer, {
            args: Deno.args.slice(2),
        }).spawn();
    })
    .with(["install"], () => {
        download.download();
    })
    .with(["install", P.string], ([_, version]) => {
        download.download({ version });
    })
    .with(["update"], () => {
        download.download();
    });
