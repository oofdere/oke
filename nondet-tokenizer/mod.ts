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
     * @param strategy - Selection strategy:
     *   - "random": Randomly select from all valid tokens
     *   - "shortest": Prefer shorter tokens (more randomness)
     *   - "longest": Prefer longer tokens (more deterministic)
     * @returns Array of token IDs
     */
    tokenize(text: string, strategy: "random" | "shortest" | "longest" = "random"): number[] {
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
                case "shortest":
                    // Filter for shortest tokens, then randomly select
                    const minLength = Math.min(...validTokens.map(t => t.length));
                    const shortestTokens = validTokens.filter(t => t.length === minLength);
                    selectedToken = shortestTokens[Math.floor(Math.random() * shortestTokens.length)];
                    break;

                case "longest":
                    // Filter for longest tokens, then randomly select
                    const maxLength = Math.max(...validTokens.map(t => t.length));
                    const longestTokens = validTokens.filter(t => t.length === maxLength);
                    selectedToken = longestTokens[Math.floor(Math.random() * longestTokens.length)];
                    break;

                case "random":
                default:
                    // Randomly select from all valid tokens
                    selectedToken = validTokens[Math.floor(Math.random() * validTokens.length)];
                    break;
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
