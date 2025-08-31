import { match, P } from "@gabriel/ts-pattern";

type Range = { min: string; max: string } | string[];

type Rule =
    | { type: "sequence"; rules: Rule[] }
    | { type: "choice"; rules: Rule[] }
    | { type: "repeat"; rule: Rule; min: number; max: number }
    | { type: "repeat1"; rule: Rule }
    | { type: "repeat0"; rule: Rule }
    | { type: "optional"; rule: Rule }
    | { type: "range"; range: string }
    | { type: "named"; name: string }
    | string;

export function stringify(rule: string | Rule): string {
    return match(rule)
        .with(
            { type: "sequence" },
            ({ rules }) =>
                rules.map((
                    e,
                ) => (typeof e === "string" ? `"${e}"` : stringify(e)))
                    .join(" "),
        )
        .with(
            { type: "choice" },
            ({ rules }) =>
                `(${
                    rules.map((e) =>
                        typeof e === "string" ? `"${e}"` : stringify(e)
                    ).join(" | ")
                })`,
        )
        .with(
            { type: "repeat" },
            ($) => `${stringify($.rule)}{${$.min},${$.max}}`,
        )
        .with({ type: "repeat0" }, ({ rule }) => `${stringify(rule)}*`)
        .with({ type: "repeat1" }, ({ rule }) => `${stringify(rule)}+`)
        .with({ type: "optional" }, ({ rule }) => `${stringify(rule)}?`)
        .with({ type: "range" }, ({ range }) => `[${range}]`)
        .with({ type: "named" }, ({ name }) => `${name}`)
        .with(P.string, (rule) => `"${rule}"`)
        .exhaustive();
}

export function grammar<T>(
    rules: {
        [K in keyof T]:
            | string
            | Rule
            | ((self: { [K in keyof T]: Rule }) => Rule);
    },
    options?: {
        /** inline compilation merges all declarations instead of resolving them at runtime */
        compileMode?: "normal" | "inline";
        /** setting a prefix allows you to use your grammar in multiple places, simply by appending it to other grammars */
        prefix?: string;
    },
): string {
    // disgusting hack to intercept strings and make them into rules when stringifying
    const proxy = options?.compileMode === "inline"
        ? rules
        : Object.fromEntries(
            Object.entries(rules).map((
                [name, _rule],
            ) => [name, { type: "named", name }]),
        );
    let g = [];
    for (const [name, rule] of Object.entries(rules)) {
        g.push(
            `${options?.prefix ? options.prefix + "-" + name : name} ::= ${
                stringify(typeof rule === "function" ? rule(proxy) : rule)
            }`,
        );
    }
    return g.join("\n");
}

// ! figure out some way to allow any kind of whitespace like the extras field in tree-sitter does

/** This function creates a rule that matches any number of other rules, one after another. */
export function seq(...rules: (Rule | string)[]): Rule {
    return { type: "sequence", rules };
}

/** This function creates a rule that matches one of a set of possible rules. The order of the arguments does not matter. */
export function choice(...rules: (Rule | string)[]): Rule {
    return { type: "choice", rules };
}

/** This function creates a rule that matches *zero-or-more* occurrences of a given rule. */
export function repeat0(rule: string | Rule): Rule {
    return { type: "repeat0", rule };
}

/** This function creates a rule that matches *one-or-more* occurrences of a given rule. The previous repeat rule is implemented in repeat1 but is included because it is very commonly used. */
export function repeat1(rule: string | Rule): Rule {
    return { type: "repeat1", rule };
}

/** This function creates a rule that matches between min and max occurrences of a given rule. */
export function repeat(rule: string | Rule, min: number, max: number): Rule {
    return { type: "repeat", rule, min, max };
}

/** This function creates a rule that matches zero or one occurrence of a given rule. */
export function optional(rule: string | Rule): Rule {
    return { type: "optional", rule };
}

/**
 * This rule matches every character in the range provided.
 */
export function range(range: string): Rule {
    return { type: "range", range };
}
