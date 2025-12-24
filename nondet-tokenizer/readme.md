# @oke/nondet-tokenizer

A nondeterministic tokenizer that can produce multiple valid tokenizations for the same input text.

## Overview

Unlike standard BPE tokenizers which deterministically produce the same token sequence for a given input, this tokenizer randomly selects from multiple valid tokenization paths. This is useful for:

- **Data augmentation**: Generate different token representations of the same text
- **Robustness testing**: Test model behavior with varied tokenizations
- **Token-level exploration**: Understand all possible ways text can be tokenized
- **Adversarial testing**: Create edge cases for token-sensitive systems

## How It Works

1. **Extract vocabulary** from a GGUF model file using the extraction tool
2. **Build a prefix trie** from all tokens in the vocabulary
3. **Tokenize nondeterministically** by randomly selecting from valid token choices at each position

### Example

The text `"hello"` might be tokenized as:
- `["hello"]` - single token
- `["hel", "lo"]` - two tokens
- `["h", "e", "ll", "o"]` - four tokens
- `["h", "e", "l", "l", "o"]` - five byte-level tokens

All are valid depending on what tokens exist in the vocabulary!

## Usage

### 1. Extract Vocabulary from GGUF Model

```bash
deno run --allow-all extract-vocab-simple.ts /path/to/model.gguf vocab.json
```

This reads the GGUF file and extracts the `tokenizer.ggml.tokens` metadata.

### 2. Use the Tokenizer

```typescript
import { NondeterministicTokenizer } from "@oke/nondet-tokenizer";

// Load vocabulary
const tokenizer = await NondeterministicTokenizer.fromFile("vocab.json");

// Tokenize text
const text = "Hello, world!";
const tokens = tokenizer.tokenize(text, "random");

// Detokenize back to text
const reconstructed = tokenizer.detokenize(tokens);
console.log(reconstructed); // "Hello, world!"
```

### 3. Run the Example

```bash
deno task example vocab.json
```

## API

### `NondeterministicTokenizer`

#### Constructor

```typescript
new NondeterministicTokenizer(vocabulary: TokenizerVocabulary)
```

#### Static Methods

- `fromFile(path: string): Promise<NondeterministicTokenizer>` - Load from vocabulary JSON

#### Instance Methods

- `tokenize(text: string, strategy?: "random" | "shortest" | "longest"): number[]`
  - Tokenize text using the specified strategy
  - **random**: Randomly select from all valid tokens (default)
  - **shortest**: Prefer shorter tokens (maximum randomness)
  - **longest**: Prefer longer tokens (most deterministic)

- `detokenize(tokenIds: number[]): string` - Convert token IDs back to text

- `getToken(tokenId: number): string | undefined` - Get token text by ID

- `getTokenId(text: string): number | undefined` - Get token ID by text

- `vocabSize: number` - Get vocabulary size

## Tokenization Strategies

### Random Strategy

Randomly selects from ALL valid tokens at each position.

```typescript
const tokens = tokenizer.tokenize(text, "random");
```

### Shortest Strategy

Prefers the shortest valid tokens, maximizing the number of tokens in the output.

```typescript
const tokens = tokenizer.tokenize(text, "shortest");
```

### Longest Strategy

Prefers the longest valid tokens, minimizing the number of tokens (most similar to standard BPE).

```typescript
const tokens = tokenizer.tokenize(text, "longest");
```

## File Structure

```
nondet-tokenizer/
├── mod.ts                    # Main tokenizer implementation
├── mod_test.ts              # Unit tests
├── extract-vocab-simple.ts  # Vocabulary extraction tool
├── example.ts               # Usage examples
├── deno.json                # Deno configuration
└── readme.md                # This file
```

## Testing

```bash
deno task test
```

## Example Output

```
Input text: "Hello, world! This is a test."

Tokenization 1:
  Token count: 12
  Tokens: ["Hello", ",", " ", "world", "!", ...]

Tokenization 2:
  Token count: 15
  Tokens: ["Hel", "lo", ",", " ", "wor", "ld", ...]

Tokenization 3:
  Token count: 8
  Tokens: ["Hello", ", ", "world", "! ", "This", ...]
```

## Vocabulary Format

The vocabulary JSON file has this structure:

```json
{
  "tokens": ["<unk>", "<s>", "</s>", "a", "b", "ab", ...],
  "merges": ["a b", "ab c", ...],
  "bos_token_id": 1,
  "eos_token_id": 2,
  "model_type": "llama"
}
```

Only the `tokens` array is required.

## License

MIT
