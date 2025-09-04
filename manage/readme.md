# @oke/manage

[![JSR](https://jsr.io/badges/@oke/manage)](https://jsr.io/@oke/manage)
[![JSR Score](https://jsr.io/badges/@oke/manage/score)](https://jsr.io/@oke/manage/score)

start and stop `llama-server`s from within your app

```ts
const llama = await ManagedLlamaServer(
    "../bin/llama-server",
    "/path/to/some.gguf",
    { args: { "flash-attn": true, "context-shift": true } },
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
console.log((await llama.completion("hello, ")).content);
llama.process.kill();
```
