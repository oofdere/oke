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

// Tokenize text with different strategies
const text = "Hello, world!";

// Random tokenization
const tokens1 = tokenizer.tokenize(text, { strategy: "random" });

// Reproducible with seed
const tokens2 = tokenizer.tokenize(text, { strategy: "random", seed: 42 });
const tokens3 = tokenizer.tokenize(text, { strategy: "random", seed: 42 });
// tokens2 === tokens3 (same seed produces same result)

// Target ideal token length
const tokens4 = tokenizer.tokenize(text, {
    strategy: "ideal-length",
    idealLength: 3
});

// With special tokens (BOS/EOS)
const tokens5 = tokenizer.tokenize(text, {
    strategy: "random",
    addBosToken: true,
    addEosToken: true,
});

// Detokenize back to text
const reconstructed = tokenizer.detokenize(tokens1);
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

- `tokenize(text: string, options?: TokenizeOptions | string): number[]`
  - Tokenize text using the specified options
  - Options can be an object or a strategy string (for backward compatibility)
  - **TokenizeOptions**:
    - `strategy?: "random" | "shortest" | "longest" | "ideal-length"`
    - `idealLength?: number` - Target token length in characters (default: 4)
    - `seed?: number` - Random seed for reproducible tokenization
    - `addBosToken?: boolean` - Add beginning-of-sequence token
    - `addEosToken?: boolean` - Add end-of-sequence token
    - `preserveSpecialTokens?: boolean` - Preserve special tokens as atomic units (default: true)

- `detokenize(tokenIds: number[]): string` - Convert token IDs back to text

- `getToken(tokenId: number): string | undefined` - Get token text by ID

- `getTokenId(text: string): number | undefined` - Get token ID by text

- `vocabSize: number` - Get vocabulary size

## Tokenization Strategies

### Random Strategy

Randomly selects from ALL valid tokens at each position.

```typescript
const tokens = tokenizer.tokenize(text, { strategy: "random" });
// Or shorthand: tokenizer.tokenize(text, "random")
```

### Shortest Strategy

Prefers the shortest valid tokens, maximizing the number of tokens in the output.

```typescript
const tokens = tokenizer.tokenize(text, { strategy: "shortest" });
```

### Longest Strategy

Prefers the longest valid tokens, minimizing the number of tokens (most similar to standard BPE).

```typescript
const tokens = tokenizer.tokenize(text, { strategy: "longest" });
```

### Ideal Length Strategy

Uses weighted random selection to prefer tokens close to a target length. Great for controlling the granularity of tokenization.

```typescript
// Prefer tokens around 3 characters
const tokens = tokenizer.tokenize(text, {
    strategy: "ideal-length",
    idealLength: 3
});
```

The weight for each token is calculated as: `1 / (1 + |tokenLength - idealLength|)`

### Reproducible Tokenization with Seeds

Add a `seed` parameter to any strategy for deterministic, reproducible results:

```typescript
const tokens1 = tokenizer.tokenize(text, { strategy: "random", seed: 42 });
const tokens2 = tokenizer.tokenize(text, { strategy: "random", seed: 42 });
// tokens1 === tokens2 (identical results)

const tokens3 = tokenizer.tokenize(text, { strategy: "random", seed: 99 });
// tokens3 likely different from tokens1 (different seed)
```

This is useful for:
- **Testing**: Ensure consistent behavior across runs
- **Data augmentation**: Generate multiple variants with different seeds
- **Reproducible research**: Share exact tokenization results

### Special Token Handling

Special tokens (like `<s>`, `</s>`, `<|endoftext|>`) are automatically preserved as atomic units and **not re-tokenized**:

```typescript
// Vocabulary with special tokens
const vocab = {
    tokens: ["<s>", "</s>", "h", "e", "l", "hello", ...],
    bos_token_id: 0,
    eos_token_id: 1,
    special_token_ids: [0, 1]  // Mark as special
};

const tokenizer = new NondeterministicTokenizer(vocab);

// Special tokens in text are preserved
const text = "<s>hello</s>";
const tokens = tokenizer.tokenize(text, "random");
// tokens = [0, 5, 1]  -> <s>, hello, </s>
// NOT [0, 5, 1, 2]    -> <, s, >, h, e, l, l, o, <, /, s, >
```

Add BOS/EOS tokens programmatically:

```typescript
const tokens = tokenizer.tokenize("hello", {
    strategy: "random",
    addBosToken: true,  // Add <s> at start
    addEosToken: true,  // Add </s> at end
});
// tokens = [0, ..., 1]  -> <s>, hello..., </s>
```

Disable special token preservation if needed:

```typescript
const tokens = tokenizer.tokenize(text, {
    preserveSpecialTokens: false  // Treat special tokens as normal text
});
```

## Text Compression

The library includes utilities for compressing and decompressing text using optimal tokenization:

### Basic Compression

```typescript
import { compress, decompress } from "@oke/nondet-tokenizer";

// Compress text (uses longest tokens for maximum compression)
const compressed = compress(tokenizer, "Hello world! This is a test.");
console.log(`${compressed.tokenCount} tokens (${compressed.compressionRatio.toFixed(2)} chars/token)`);

// Decompress back to original text
const decompressed = decompress(tokenizer, compressed.tokens);
```

### Compression with Factor

Control compression level smoothly from 0.0 (no compression) to 1.0 (max compression):

```typescript
import { compressWithFactor } from "@oke/nondet-tokenizer";

// No compression (shortest tokens, most tokens)
const min = compressWithFactor(tokenizer, text, 0.0);

// Medium compression
const medium = compressWithFactor(tokenizer, text, 0.5);

// Maximum compression (longest tokens, fewest tokens)
const max = compressWithFactor(tokenizer, text, 1.0);

console.log(`Min: ${min.tokenCount} tokens`);
console.log(`Medium: ${medium.tokenCount} tokens`);
console.log(`Max: ${max.tokenCount} tokens`);
```

### Compression with Gradient

Use exponential weighting to bias toward longer or shorter tokens:

```typescript
import { compressWithGradient } from "@oke/nondet-tokenizer";

// Strong bias toward shortest tokens
const shortBias = compressWithGradient(tokenizer, text, -1.0);

// No bias (random)
const neutral = compressWithGradient(tokenizer, text, 0.0);

// Strong bias toward longest tokens
const longBias = compressWithGradient(tokenizer, text, 1.0);

// Gradient uses: weight = e^(gradient * tokenLength * 2)
```

**Difference between factor and gradient:**
- **Factor**: Linear interpolation of ideal token length (deterministic with seed)
- **Gradient**: Exponential weighting of token selection (more variation)

### Compression Comparison

Compare compression efficiency between strategies:

```typescript
import { compareCompression } from "@oke/nondet-tokenizer";

const comparison = compareCompression(tokenizer, text);
console.log(`Most compressed: ${comparison.mostCompressed.tokenCount} tokens`);
console.log(`Least compressed: ${comparison.leastCompressed.tokenCount} tokens`);
console.log(`Improvement: ${comparison.improvementFactor.toFixed(2)}x`);
```

### Selective Compression

Compress different parts of text with different strategies:

```typescript
import { selectiveCompress } from "@oke/nondet-tokenizer";

// Compress sensitive data with less compression (preserves detail)
// Compress regular text with maximum compression
const selective = selectiveCompress(
    tokenizer,
    "IMPORTANT: password123. Regular text here.",
    [
        { start: 0, end: 11, strategy: "shortest" },  // "IMPORTANT: "
        { start: 11, end: 23, strategy: "ideal-length", idealLength: 2 },  // password
    ],
    "longest"  // default for remaining text
);
```

### Compression Statistics

Analyze compression potential:

```typescript
import { getCompressionStats } from "@oke/nondet-tokenizer";

const stats = getCompressionStats(tokenizer, text);
console.log(`Best ratio: ${stats.bestRatio.toFixed(2)} chars/token`);
console.log(`Min tokens: ${stats.minTokens}`);
console.log(`Max tokens: ${stats.maxTokens}`);
```

### Run Compression Examples

```bash
# Basic compression examples
deno task example:compress vocab.json

# Compression factor and gradient examples
deno task example:factor vocab.json
```

## File Structure

```
nondet-tokenizer/
├── mod.ts                     # Main module exports
├── compression.ts            # Compression utilities
├── mod_test.ts               # Tokenizer tests
├── compression_test.ts       # Compression tests
├── extract-vocab-simple.ts   # Vocabulary extraction tool
├── extract-vocab.ts          # Alternative extraction via llama-server
├── example.ts                # Tokenization examples
├── example-compression.ts    # Compression examples
├── example-factor.ts         # Factor/gradient examples
├── test-manual.ts            # Manual test suite
├── deno.json                 # Deno configuration
└── readme.md                 # This file
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
