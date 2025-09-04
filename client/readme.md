# @oke/client

[![JSR](https://jsr.io/badges/@oke/client)](https://jsr.io/@oke/client)
[![JSR Score](https://jsr.io/badges/@oke/client/score)](https://jsr.io/@oke/client/score)

easily connect to `llama-server`

```ts
const llama = await LlamaServer("http://100.102.174.127:34992/");
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
```
