import { Enum, match } from "./enum.ts";

type Range = { min: string; max: string } | string[];

export type Rule = {
    Sequence: (Rule | string)[];
    Choice: (Rule | string)[];
    Repeat: {
        rule: Rule | string;
        min?: number;
        max?: number;
    };
    Optional: Rule | string;
    Range: Range;
    Named: string;
};
export const Rule: (...e: Enum<Rule>) => Rule = Enum<Rule>();

export function stringify(rule: string | Rule): string {
    if (typeof rule === "string") {
        return `"${rule}"`;
    }

    return match(rule, {
        Sequence: ($): string =>
            $.map((e) => (typeof e === "string" ? `"${e}"` : stringify(e)))
                .join(" "),
        Choice: ($): string =>
            `(${
                $.map((e) => (typeof e === "string" ? `"${e}"` : stringify(e)))
                    .join(" | ")
            })`,
        Repeat: ($) =>
            `(${stringify($.rule)}){${$.min || "0"},${$.max || "7"}}`,
        Optional: ($) => stringify($) + "?",
        Range: ($) => {
            if (Array.isArray($)) {
                return `[${$.join("")}]`;
            } else {
                return `[${$.min}-${$.max}]`;
            }
        },
        Named: ($) => $,
    });
}

export function grammar<T>(
    rules: {
        [K in keyof T]:
            | string
            | Rule
            | ((self: { [K in keyof T]: Rule }) => Rule);
    },
): string {
    // disgusting hack to intercept strings and make them into rules when stringifying
    const proxy = Object.fromEntries(
        Object.entries(rules).map((
            [name, rule],
        ) => [name, Rule("Named", name)]),
    );
    let g = [];
    for (const [name, rule] of Object.entries(rules)) {
        g.push(
            `${name} ::= ${
                stringify(typeof rule === "function" ? rule(proxy) : rule)
            }`,
        );
    }
    return g.join("\n");
}

// ! figure out some way to allow any kind of whitespace like the extras field in tree-sitter does

/** This function creates a rule that matches any number of other rules, one after another. */
export function seq(...rules: (Rule | string)[]): Rule {
    return Rule("Sequence", rules);
}

/** This function creates a rule that matches one of a set of possible rules. The order of the arguments does not matter. */
export function choice(...rules: (Rule | string)[]): Rule {
    return Rule("Choice", rules);
}

/** This function creates a rule that matches *zero-or-more* occurrences of a given rule. */
export function repeat(rule: string | Rule): Rule {
    return Rule("Repeat", { rule });
}

/** This function creates a rule that matches *one-or-more* occurrences of a given rule. The previous repeat rule is implemented in repeat1 but is included because it is very commonly used. */
export function repeat1(rule: string | Rule): Rule {
    return Rule("Repeat", { rule, min: 1 });
}

/** This function creates a rule that matches zero or one occurrence of a given rule. */
export function optional(rule: string | Rule): Rule {
    return Rule("Optional", rule);
}

/**
 * This rule matches every character in the range provided
 */
export function range(from: string, to: string): Rule {
    return Rule("Range", { min: from, max: to });
}
