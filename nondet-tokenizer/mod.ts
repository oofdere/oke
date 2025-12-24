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
    /** Special token IDs that should not be re-tokenized */
    special_token_ids?: number[];
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
    /** Add BOS (beginning of sequence) token */
    addBosToken?: boolean;
    /** Add EOS (end of sequence) token */
    addEosToken?: boolean;
    /** Preserve special tokens as atomic units (don't retokenize them) */
    preserveSpecialTokens?: boolean;
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
    private specialTokenMap: Map<string, number>; // Maps special token text -> token ID

    constructor(vocabulary: TokenizerVocabulary) {
        this.vocabulary = vocabulary;
        this.trie = this.buildTrie();
        this.specialTokenMap = this.buildSpecialTokenMap();
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

    /** Build a map of special tokens for fast lookup */
    private buildSpecialTokenMap(): Map<string, number> {
        const map = new Map<string, number>();
        const specialIds = this.vocabulary.special_token_ids || [];

        for (const tokenId of specialIds) {
            const tokenText = this.vocabulary.tokens[tokenId];
            if (tokenText) {
                map.set(tokenText, tokenId);
            }
        }

        // Always include BOS and EOS if defined
        if (this.vocabulary.bos_token_id !== undefined) {
            const bosText = this.vocabulary.tokens[this.vocabulary.bos_token_id];
            if (bosText) {
                map.set(bosText, this.vocabulary.bos_token_id);
            }
        }

        if (this.vocabulary.eos_token_id !== undefined) {
            const eosText = this.vocabulary.tokens[this.vocabulary.eos_token_id];
            if (eosText) {
                map.set(eosText, this.vocabulary.eos_token_id);
            }
        }

        return map;
    }

    /**
     * Find special tokens in the text and return their positions
     */
    private findSpecialTokens(text: string): Array<{ start: number; end: number; tokenId: number }> {
        const matches: Array<{ start: number; end: number; tokenId: number }> = [];

        // Try to match each special token
        for (const [tokenText, tokenId] of this.specialTokenMap.entries()) {
            let pos = 0;
            while ((pos = text.indexOf(tokenText, pos)) !== -1) {
                matches.push({
                    start: pos,
                    end: pos + tokenText.length,
                    tokenId,
                });
                pos += tokenText.length;
            }
        }

        // Sort by start position
        matches.sort((a, b) => a.start - b.start);

        return matches;
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
        const preserveSpecialTokens = opts.preserveSpecialTokens ?? true; // Default to true

        let tokens: number[] = [];

        // Add BOS token if requested
        if (opts.addBosToken && this.vocabulary.bos_token_id !== undefined) {
            tokens.push(this.vocabulary.bos_token_id);
        }

        // Find special tokens in the text
        const specialTokenPositions = preserveSpecialTokens ? this.findSpecialTokens(text) : [];

        // Build list of text segments to tokenize (excluding special tokens)
        const segments: Array<{ start: number; end: number; isSpecial: boolean; tokenId?: number }> = [];

        if (specialTokenPositions.length === 0) {
            // No special tokens, tokenize entire text
            segments.push({ start: 0, end: text.length, isSpecial: false });
        } else {
            // Interleave special tokens and normal text segments
            let lastPos = 0;
            for (const special of specialTokenPositions) {
                // Add normal text before special token
                if (lastPos < special.start) {
                    segments.push({ start: lastPos, end: special.start, isSpecial: false });
                }
                // Add special token
                segments.push({
                    start: special.start,
                    end: special.end,
                    isSpecial: true,
                    tokenId: special.tokenId,
                });
                lastPos = special.end;
            }
            // Add remaining normal text
            if (lastPos < text.length) {
                segments.push({ start: lastPos, end: text.length, isSpecial: false });
            }
        }

        // Tokenize each segment
        for (const segment of segments) {
            if (segment.isSpecial) {
                // Add special token directly
                tokens.push(segment.tokenId!);
            } else {
                // Tokenize normal text
                const segmentText = text.substring(segment.start, segment.end);
                let pos = 0;

                while (pos < segmentText.length) {
                    const validTokens = this.findValidTokens(segmentText, pos);

                    if (validTokens.length === 0) {
                        // No valid token found - this shouldn't happen with a complete vocabulary
                        console.warn(
                            `No valid token found at position ${pos} for character "${segmentText[pos]}"`,
                        );
                        pos++;
                        continue;
                    }

                    // Select a token based on the strategy
                    let selectedToken;

                    switch (strategy) {
                        case "shortest": {
                            const minLength = Math.min(...validTokens.map((t) => t.length));
                            const shortestTokens = validTokens.filter((t) => t.length === minLength);
                            const idx = rng
                                ? rng.nextInt(shortestTokens.length)
                                : Math.floor(Math.random() * shortestTokens.length);
                            selectedToken = shortestTokens[idx];
                            break;
                        }

                        case "longest": {
                            const maxLength = Math.max(...validTokens.map((t) => t.length));
                            const longestTokens = validTokens.filter((t) => t.length === maxLength);
                            const idx = rng
                                ? rng.nextInt(longestTokens.length)
                                : Math.floor(Math.random() * longestTokens.length);
                            selectedToken = longestTokens[idx];
                            break;
                        }

                        case "ideal-length": {
                            const weights = validTokens.map((t) =>
                                1 / (1 + Math.abs(t.length - idealLength))
                            );
                            const totalWeight = weights.reduce((sum, w) => sum + w, 0);

                            const rand = rng ? rng.next() : Math.random();
                            let cumulativeWeight = 0;
                            for (let i = 0; i < validTokens.length; i++) {
                                cumulativeWeight += weights[i] / totalWeight;
                                if (rand < cumulativeWeight) {
                                    selectedToken = validTokens[i];
                                    break;
                                }
                            }
                            if (!selectedToken) {
                                selectedToken = validTokens[validTokens.length - 1];
                            }
                            break;
                        }

                        case "random":
                        default: {
                            const idx = rng
                                ? rng.nextInt(validTokens.length)
                                : Math.floor(Math.random() * validTokens.length);
                            selectedToken = validTokens[idx];
                            break;
                        }
                    }

                    tokens.push(selectedToken.id);
                    pos += selectedToken.length;
                }
            }
        }

        // Add EOS token if requested
        if (opts.addEosToken && this.vocabulary.eos_token_id !== undefined) {
            tokens.push(this.vocabulary.eos_token_id);
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

// Export compression utilities
export {
    compress,
    decompress,
    compareCompression,
    findCompressibleSegments,
    selectiveCompress,
    getCompressionStats,
} from "./compression.ts";
export type {
    CompressionResult,
    CompressionComparison,
    SelectiveCompressionSegment,
    CompressionStats,
} from "./compression.ts";
