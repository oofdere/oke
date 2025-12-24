/**
 * Text compression utilities using tokenization
 *
 * This module provides utilities for compressing text by finding optimal
 * tokenizations and analyzing compression efficiency.
 */

import { NondeterministicTokenizer, TokenizeOptions } from "./mod.ts";

export interface CompressionResult {
    /** Original text */
    text: string;
    /** Token IDs (compressed representation) */
    tokens: number[];
    /** Token strings */
    tokenStrings: string[];
    /** Number of tokens */
    tokenCount: number;
    /** Number of characters in original text */
    charCount: number;
    /** Compression ratio (chars per token) */
    compressionRatio: number;
    /** Average token length in characters */
    avgTokenLength: number;
}

export interface CompressionComparison {
    /** Original text */
    text: string;
    /** Most compressed (longest tokens) */
    mostCompressed: CompressionResult;
    /** Least compressed (shortest tokens) */
    leastCompressed: CompressionResult;
    /** Compression improvement factor */
    improvementFactor: number;
}

/**
 * Compress text using optimal tokenization (fewest tokens)
 */
export function compress(
    tokenizer: NondeterministicTokenizer,
    text: string,
    options?: Omit<TokenizeOptions, "strategy">,
): CompressionResult {
    // Use longest strategy for maximum compression
    const tokens = tokenizer.tokenize(text, { ...options, strategy: "longest" });
    const tokenStrings = tokens.map(id => tokenizer.getToken(id) || "");

    return {
        text,
        tokens,
        tokenStrings,
        tokenCount: tokens.length,
        charCount: text.length,
        compressionRatio: text.length / tokens.length,
        avgTokenLength: tokenStrings.reduce((sum, t) => sum + t.length, 0) / tokens.length,
    };
}

/**
 * Compress text with a specific compression factor
 *
 * @param tokenizer - The tokenizer instance
 * @param text - Text to compress
 * @param compressionFactor - Compression level from 0.0 (no compression, shortest tokens)
 *                           to 1.0 (maximum compression, longest tokens)
 * @param options - Additional tokenization options (seed, etc.)
 *
 * @example
 * // No compression (shortest tokens)
 * compressWithFactor(tokenizer, text, 0.0)
 *
 * // Medium compression
 * compressWithFactor(tokenizer, text, 0.5)
 *
 * // Maximum compression (longest tokens)
 * compressWithFactor(tokenizer, text, 1.0)
 */
export function compressWithFactor(
    tokenizer: NondeterministicTokenizer,
    text: string,
    compressionFactor: number,
    options?: Omit<TokenizeOptions, "strategy" | "idealLength">,
): CompressionResult {
    // Clamp compression factor to [0, 1]
    const factor = Math.max(0, Math.min(1, compressionFactor));

    // Get the range of possible token lengths by analyzing a sample
    let minTokenLen = 1;
    let maxTokenLen = 1;

    // Sample some tokens to estimate the vocabulary's token length distribution
    const sampleSize = Math.min(1000, tokenizer.vocabSize);
    for (let i = 0; i < sampleSize; i++) {
        const token = tokenizer.getToken(i);
        if (token) {
            minTokenLen = Math.min(minTokenLen, token.length);
            maxTokenLen = Math.max(maxTokenLen, token.length);
        }
    }

    // Calculate ideal length based on compression factor
    // factor = 0.0 → idealLength = minTokenLen (no compression)
    // factor = 1.0 → idealLength = maxTokenLen (max compression)
    const idealLength = Math.round(minTokenLen + factor * (maxTokenLen - minTokenLen));

    // Use ideal-length strategy with calculated ideal length
    const tokens = tokenizer.tokenize(text, {
        ...options,
        strategy: "ideal-length",
        idealLength,
    });

    const tokenStrings = tokens.map(id => tokenizer.getToken(id) || "");

    return {
        text,
        tokens,
        tokenStrings,
        tokenCount: tokens.length,
        charCount: text.length,
        compressionRatio: text.length / tokens.length,
        avgTokenLength: tokenStrings.reduce((sum, t) => sum + t.length, 0) / tokens.length,
    };
}

/**
 * Compress text with a weighted gradient toward longer or shorter tokens
 *
 * @param tokenizer - The tokenizer instance
 * @param text - Text to compress
 * @param gradient - Bias toward token length (-1.0 to 1.0)
 *                  -1.0 = strongly prefer shortest tokens
 *                   0.0 = no preference (random)
 *                   1.0 = strongly prefer longest tokens
 * @param options - Additional tokenization options
 *
 * Uses exponential weighting: weight = e^(gradient * tokenLength)
 */
export function compressWithGradient(
    tokenizer: NondeterministicTokenizer,
    text: string,
    gradient: number,
    options?: Omit<TokenizeOptions, "strategy">,
): CompressionResult {
    // Clamp gradient to [-1, 1]
    const grad = Math.max(-1, Math.min(1, gradient));

    // Custom tokenization with gradient-based weighting
    const tokens: number[] = [];
    let pos = 0;

    // Get RNG from options if seed is provided
    const rng = options?.seed !== undefined ? new SeededRandom(options.seed) : null;

    while (pos < text.length) {
        const validTokens = (tokenizer as any).findValidTokens(text, pos);

        if (validTokens.length === 0) {
            console.warn(`No valid token found at position ${pos}`);
            pos++;
            continue;
        }

        // Apply exponential weighting based on gradient
        // gradient > 0 → prefer longer tokens
        // gradient < 0 → prefer shorter tokens
        // gradient = 0 → uniform random
        const weights = validTokens.map((t: any) =>
            Math.exp(grad * t.length * 2) // Scale by 2 for stronger effect
        );
        const totalWeight = weights.reduce((sum: number, w: number) => sum + w, 0);

        // Weighted random selection
        const rand = rng ? rng.next() : Math.random();
        let cumulativeWeight = 0;
        let selectedToken;

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

        tokens.push(selectedToken.id);
        pos += selectedToken.length;
    }

    const tokenStrings = tokens.map(id => tokenizer.getToken(id) || "");

    return {
        text,
        tokens,
        tokenStrings,
        tokenCount: tokens.length,
        charCount: text.length,
        compressionRatio: text.length / tokens.length,
        avgTokenLength: tokenStrings.reduce((sum, t) => sum + t.length, 0) / tokens.length,
    };
}

// Helper class for seeded random (duplicate from mod.ts for gradient function)
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
}

/**
 * Decompress tokens back to text (alias for detokenize)
 */
export function decompress(
    tokenizer: NondeterministicTokenizer,
    tokens: number[],
): string {
    return tokenizer.detokenize(tokens);
}

/**
 * Compare compression efficiency between different strategies
 */
export function compareCompression(
    tokenizer: NondeterministicTokenizer,
    text: string,
): CompressionComparison {
    const mostCompressed = compress(tokenizer, text);

    // Least compressed uses shortest tokens
    const leastTokens = tokenizer.tokenize(text, "shortest");
    const leastTokenStrings = leastTokens.map(id => tokenizer.getToken(id) || "");

    const leastCompressed: CompressionResult = {
        text,
        tokens: leastTokens,
        tokenStrings: leastTokenStrings,
        tokenCount: leastTokens.length,
        charCount: text.length,
        compressionRatio: text.length / leastTokens.length,
        avgTokenLength: leastTokenStrings.reduce((sum, t) => sum + t.length, 0) / leastTokens.length,
    };

    return {
        text,
        mostCompressed,
        leastCompressed,
        improvementFactor: leastCompressed.tokenCount / mostCompressed.tokenCount,
    };
}

/**
 * Analyze text to find highly compressible segments
 *
 * This finds parts of the text that can be represented with very few tokens
 * (high compression ratio segments).
 */
export function findCompressibleSegments(
    tokenizer: NondeterministicTokenizer,
    text: string,
    minSegmentLength: number = 10,
): Array<{ start: number; end: number; text: string; compressionRatio: number }> {
    const segments: Array<{ start: number; end: number; text: string; compressionRatio: number }> = [];

    // Sliding window to find compressible segments
    for (let start = 0; start < text.length - minSegmentLength; start++) {
        for (let end = start + minSegmentLength; end <= text.length; end++) {
            const segment = text.substring(start, end);
            const result = compress(tokenizer, segment);

            // Consider segments with compression ratio > 5 as highly compressible
            if (result.compressionRatio > 5) {
                segments.push({
                    start,
                    end,
                    text: segment,
                    compressionRatio: result.compressionRatio,
                });
            }
        }
    }

    // Sort by compression ratio descending
    segments.sort((a, b) => b.compressionRatio - a.compressionRatio);

    return segments;
}

/**
 * Selectively compress different parts of text with different strategies
 *
 * This allows you to compress common/repeated text aggressively while
 * preserving important parts with less compression.
 */
export interface SelectiveCompressionSegment {
    /** Start index in original text */
    start: number;
    /** End index in original text */
    end: number;
    /** Strategy to use for this segment */
    strategy: "random" | "shortest" | "longest" | "ideal-length";
    /** Ideal length for ideal-length strategy */
    idealLength?: number;
}

export function selectiveCompress(
    tokenizer: NondeterministicTokenizer,
    text: string,
    segments: SelectiveCompressionSegment[],
    defaultStrategy: "random" | "shortest" | "longest" | "ideal-length" = "longest",
): CompressionResult {
    // Sort segments by start position
    const sortedSegments = [...segments].sort((a, b) => a.start - b.start);

    // Build token list by processing each segment
    const allTokens: number[] = [];
    const allTokenStrings: string[] = [];

    let lastPos = 0;

    for (const segment of sortedSegments) {
        // Process text before this segment with default strategy
        if (lastPos < segment.start) {
            const beforeText = text.substring(lastPos, segment.start);
            const beforeTokens = tokenizer.tokenize(beforeText, defaultStrategy);
            allTokens.push(...beforeTokens);
            allTokenStrings.push(...beforeTokens.map(id => tokenizer.getToken(id) || ""));
        }

        // Process this segment with specified strategy
        const segmentText = text.substring(segment.start, segment.end);
        const segmentOpts = segment.strategy === "ideal-length"
            ? { strategy: segment.strategy, idealLength: segment.idealLength || 4 }
            : { strategy: segment.strategy };

        const segmentTokens = tokenizer.tokenize(segmentText, segmentOpts);
        allTokens.push(...segmentTokens);
        allTokenStrings.push(...segmentTokens.map(id => tokenizer.getToken(id) || ""));

        lastPos = segment.end;
    }

    // Process remaining text after last segment
    if (lastPos < text.length) {
        const remainingText = text.substring(lastPos);
        const remainingTokens = tokenizer.tokenize(remainingText, defaultStrategy);
        allTokens.push(...remainingTokens);
        allTokenStrings.push(...remainingTokens.map(id => tokenizer.getToken(id) || ""));
    }

    return {
        text,
        tokens: allTokens,
        tokenStrings: allTokenStrings,
        tokenCount: allTokens.length,
        charCount: text.length,
        compressionRatio: text.length / allTokens.length,
        avgTokenLength: allTokenStrings.reduce((sum, t) => sum + t.length, 0) / allTokenStrings.length,
    };
}

/**
 * Get detailed compression statistics for text
 */
export interface CompressionStats {
    /** Total characters */
    totalChars: number;
    /** Token count with maximum compression */
    minTokens: number;
    /** Token count with minimum compression */
    maxTokens: number;
    /** Best possible compression ratio */
    bestRatio: number;
    /** Worst possible compression ratio */
    worstRatio: number;
    /** Token distribution */
    tokenLengthDistribution: Map<number, number>;
}

export function getCompressionStats(
    tokenizer: NondeterministicTokenizer,
    text: string,
): CompressionStats {
    const minTokens = tokenizer.tokenize(text, "longest");
    const maxTokens = tokenizer.tokenize(text, "shortest");

    const tokenLengthDistribution = new Map<number, number>();
    for (const tokenId of minTokens) {
        const tokenStr = tokenizer.getToken(tokenId);
        if (tokenStr) {
            const len = tokenStr.length;
            tokenLengthDistribution.set(len, (tokenLengthDistribution.get(len) || 0) + 1);
        }
    }

    return {
        totalChars: text.length,
        minTokens: minTokens.length,
        maxTokens: maxTokens.length,
        bestRatio: text.length / minTokens.length,
        worstRatio: text.length / maxTokens.length,
        tokenLengthDistribution,
    };
}
