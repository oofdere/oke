/**
 * Represents an enum object as a tuple containing a key and a value derived from the enum template E.
 * @template E - The enum type
 */
export type Enum<E> = { [K in keyof E]: [K, E[K]] }[keyof E];

/**
 * Defines the structure for matching arms used in the match function.
 * All cases are required, unless a default case is provided with `_`.
 * @template E - The enum type
 */
export type Arms<E> =
    | {
        [K in keyof E]-?: (x: E[K]) => unknown;
    }
    | (
        & {
            [K in keyof E]?: (x: E[K]) => unknown;
        }
        & {
            // make this show only remaining types instead of all types at some point
            _: (x: Enum<E>[1]) => unknown;
        }
    );

/**
 * Creates enum instances. The Enum() factory function is preferred over this method.
 * @template E - The enum type
 * @param {...Enum<E>} e - The enum entries
 * @returns {E} The created enum
 */
export const pack = <E>(...e: Enum<E>) => e as E;

/**
 * Factory function to create enum instances.
 * @template E - The enum type
 * @returns {(...e: Enum<E>) => E} A function used to create instances of the enum
 */
export const Enum = <E>() => (...e: Enum<E>) => e as unknown as E;

/**
 * Matches a pattern against a set of arms and executes the corresponding function.
 * @param {E} pattern - The enum to match
 * @param {Fn} arms - The object containing matching arms
 * @returns {ReturnType<Exclude<Fn[keyof Fn], undefined>>} The result of the matched function
 */
export const match = <E, Fn extends Arms<E>>(pattern: E, arms: Fn) =>
    // biome-ignore lint/suspicious/noExplicitAny: return type is handled externally
    (((arms as any)[(pattern as any[])[0]] as any) || (arms as any)._)(
        // biome-ignore lint/suspicious/noExplicitAny: return type is handled externally
        (pattern as any)[1] as unknown,
    ) as ReturnType<Exclude<(typeof arms)[keyof typeof arms], undefined>>;
