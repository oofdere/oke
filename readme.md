# oke [><](https://www.youtube.com/watch?v=tog6_AZO4p4) (wiiiiip)

dynamically generate [gbnf](https://github.com/ggml-org/llama.cpp/blob/b55f06e1aa67fb10e89f53e31bbccf37eb2678ea/grammars/README.md) grammars

the code is a mess so unless you want to initialize llama with a rp model every time and generate 5 completions maybe wait for me to clean it up

## defining rules
the grammar DSL is largely based on [tree-sitter](https://tree-sitter.github.io/tree-sitter/creating-parsers/2-the-grammar-dsl.html)'s, but with the ability to reference external grammars (partially or fully) as rules as well, so you can easily compose multiple grammars

```ts
const myGrammar = grammar({
    root: ($) => seq($.hello,  optional(seq("today is ", $.day, optional($.remark), "!"))),

    hello: $ => seq("hello, ", $.word, "! my name is ", $.word, "! "),
    word: repeat(choice(range("a", "z"), range("A", "Z"))),
    day: $ => seq(range("A", "Z"), $.word, "day"),

    remark: $ => choice(seq(" and what a ", $.word, " day it is!"), seq(" and I'm super ", $.word, " to ", $.word, " with you today!"))
});
```

compiles to

```ebnf
root ::= hello "today is " day remark? "!"?
hello ::= "hello, " word "! my word is " word "! "
word ::= (([a-z] | [A-Z])){0,7}
day ::= [A-Z] word "day"
remark ::= (" and what a " word " day it is!" | " and I'm super " word " to " word " with you today!") 
```

## roadmap
this will eventually become a llamacpp wrapper

it is inevitable

also that would make it reasonable to use [llguidance](https://github.com/ggml-org/llama.cpp/blob/master/docs/llguidance.md) which requires a custom build of llamacpp but is way faster and already has libs for making and testing grammars in every language

also possibly binding with the webgpu build that's a wip rn

and more primatives, also schema validation

---

> I looked at tree-sitter and asked
> > what would happen if i fwell off the tree

[give me money if you find this useful](https://github.com/sponsors/oofdere/)