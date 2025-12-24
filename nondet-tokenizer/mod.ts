/**
 * Nondeterministic Tokenizer
 *
 * This module provides a tokenizer that can produce multiple valid tokenizations
 * for the same input text by randomly selecting from valid token sequences.
 */

export interface TokenizerVocabulary {
    /** Array of token strings indexed by token ID */
    tokens: string[];
    /** BPE merge rules (optional) */
    merges?: string[];
    /** BOS token ID (optional) */
    bos_token_id?: number;
    /** EOS token ID (optional) */
    eos_token_id?: number;
    /** Model type (optional) */
    model_type?: string;
}

/** A node in the token prefix trie */
interface TrieNode {
    /** Token IDs that end at this node */
    tokenIds: number[];
    /** Children nodes indexed by character */
    children: Map<string, TrieNode>;
}

/** Options for tokenization */
export interface TokenizeOptions {
    /** Selection strategy */
    strategy?: "random" | "shortest" | "longest" | "ideal-length";
    /** Ideal token length (in characters) - used with ideal-length strategy */
    idealLength?: number;
    /** Random seed for reproducible tokenization */
    seed?: number;
}

/** Simple seeded random number generator (mulberry32) */
class SeededRandom {
    private state: number;

    constructor(seed: number) {
        this.state = seed >>> 0;
    }

    next(): number {
        let t = this.state += 0x6D2B79F5;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }

    /** Get random integer between 0 (inclusive) and max (exclusive) */
    nextInt(max: number): number {
        return Math.floor(this.next() * max);
    }
}

export class NondeterministicTokenizer {
    private vocabulary: TokenizerVocabulary;
    private trie: TrieNode;

    constructor(vocabulary: TokenizerVocabulary) {
        this.vocabulary = vocabulary;
        this.trie = this.buildTrie();
    }

    /** Load tokenizer from a vocabulary JSON file */
    static async fromFile(path: string): Promise<NondeterministicTokenizer> {
        const content = await Deno.readTextFile(path);
        const vocabulary: TokenizerVocabulary = JSON.parse(content);
        return new NondeterministicTokenizer(vocabulary);
    }

    /** Build a prefix trie from the vocabulary for efficient token matching */
    private buildTrie(): TrieNode {
        const root: TrieNode = { tokenIds: [], children: new Map() };

        for (let tokenId = 0; tokenId < this.vocabulary.tokens.length; tokenId++) {
            const tokenText = this.vocabulary.tokens[tokenId];
            let node = root;

            // Build path for each character in the token
            for (const char of tokenText) {
                if (!node.children.has(char)) {
                    node.children.set(char, { tokenIds: [], children: new Map() });
                }
                node = node.children.get(char)!;
            }

            // Mark this node as a valid token endpoint
            node.tokenIds.push(tokenId);
        }

        return root;
    }

    /**
     * Find all valid tokens that can start at the given position in the text
     */
    private findValidTokens(text: string, startPos: number): Array<{ id: number; length: number; text: string }> {
        const validTokens: Array<{ id: number; length: number; text: string }> = [];
        let node = this.trie;
        let pos = startPos;

        while (pos < text.length) {
            const char = text[pos];
            const nextNode = node.children.get(char);

            if (!nextNode) {
                break; // No more matches
            }

            node = nextNode;
            pos++;

            // If this node represents a complete token, add it
            if (node.tokenIds.length > 0) {
                const length = pos - startPos;
                for (const tokenId of node.tokenIds) {
                    validTokens.push({
                        id: tokenId,
                        length,
                        text: text.substring(startPos, pos),
                    });
                }
            }
        }

        return validTokens;
    }

    /**
     * Tokenize text nondeterministically
     *
     * @param text - Input text to tokenize
     * @param options - Tokenization options or strategy string (for backward compatibility)
     * @returns Array of token IDs
     */
    tokenize(
        text: string,
        options: TokenizeOptions | "random" | "shortest" | "longest" | "ideal-length" = "random",
    ): number[] {
        // Support backward compatibility with string strategy parameter
        const opts: TokenizeOptions = typeof options === "string"
            ? { strategy: options }
            : options;

        const strategy = opts.strategy || "random";
        const idealLength = opts.idealLength || 4;
        const rng = opts.seed !== undefined ? new SeededRandom(opts.seed) : null;

        const tokens: number[] = [];
        let pos = 0;

        while (pos < text.length) {
            const validTokens = this.findValidTokens(text, pos);

            if (validTokens.length === 0) {
                // No valid token found - this shouldn't happen with a complete vocabulary
                // Try to handle by skipping the character or using a fallback
                console.warn(`No valid token found at position ${pos} for character "${text[pos]}"`);
                pos++;
                continue;
            }

            // Select a token based on the strategy
            let selectedToken;

            switch (strategy) {
                case "shortest": {
                    // Filter for shortest tokens, then randomly select
                    const minLength = Math.min(...validTokens.map(t => t.length));
                    const shortestTokens = validTokens.filter(t => t.length === minLength);
                    const idx = rng ? rng.nextInt(shortestTokens.length) : Math.floor(Math.random() * shortestTokens.length);
                    selectedToken = shortestTokens[idx];
                    break;
                }

                case "longest": {
                    // Filter for longest tokens, then randomly select
                    const maxLength = Math.max(...validTokens.map(t => t.length));
                    const longestTokens = validTokens.filter(t => t.length === maxLength);
                    const idx = rng ? rng.nextInt(longestTokens.length) : Math.floor(Math.random() * longestTokens.length);
                    selectedToken = longestTokens[idx];
                    break;
                }

                case "ideal-length": {
                    // Prefer tokens close to the ideal length using weighted random selection
                    // Weight = 1 / (1 + |length - idealLength|)
                    const weights = validTokens.map(t => 1 / (1 + Math.abs(t.length - idealLength)));
                    const totalWeight = weights.reduce((sum, w) => sum + w, 0);

                    // Weighted random selection
                    const rand = rng ? rng.next() : Math.random();
                    let cumulativeWeight = 0;
                    for (let i = 0; i < validTokens.length; i++) {
                        cumulativeWeight += weights[i] / totalWeight;
                        if (rand < cumulativeWeight) {
                            selectedToken = validTokens[i];
                            break;
                        }
                    }
                    // Fallback to last token if not selected (shouldn't happen)
                    if (!selectedToken) {
                        selectedToken = validTokens[validTokens.length - 1];
                    }
                    break;
                }

                case "random":
                default: {
                    // Randomly select from all valid tokens
                    const idx = rng ? rng.nextInt(validTokens.length) : Math.floor(Math.random() * validTokens.length);
                    selectedToken = validTokens[idx];
                    break;
                }
            }

            tokens.push(selectedToken.id);
            pos += selectedToken.length;
        }

        return tokens;
    }

    /**
     * Detokenize token IDs back to text
     */
    detokenize(tokenIds: number[]): string {
        return tokenIds
            .map(id => this.vocabulary.tokens[id] || "")
            .join("");
    }

    /**
     * Get token text by ID
     */
    getToken(tokenId: number): string | undefined {
        return this.vocabulary.tokens[tokenId];
    }

    /**
     * Get token ID by text (returns first match)
     */
    getTokenId(text: string): number | undefined {
        return this.vocabulary.tokens.indexOf(text);
    }

    /**
     * Get vocabulary size
     */
    get vocabSize(): number {
        return this.vocabulary.tokens.length;
    }
}
