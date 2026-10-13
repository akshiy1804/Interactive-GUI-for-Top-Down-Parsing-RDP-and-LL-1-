
const EPSILON = "ε";
const END = "$";

// Split whitespace-separated grammar symbols or input tokens.
function tokenize(text) {
  return text.trim().split(/\s+/).filter(Boolean);
}

// Convert grammar text into productions.
function parseGrammar(grammarText) {
  const productions = [];
  const nonTerminals = new Set();

  for (const rawLine of grammarText.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;

    const parts = line.split(/→|->/);

    if (parts.length !== 2 || !parts[0].trim()) {
      throw new Error(`Invalid grammar rule: ${line}`);
    }

    const lhs = parts[0].trim();
    nonTerminals.add(lhs);

    for (const alternative of parts[1].split("|")) {
      const rhsText = alternative.trim();

      const rhs =
        !rhsText ||
        ["ε", "epsilon", "eps"].includes(rhsText.toLowerCase())
          ? []
          : tokenize(rhsText);

      productions.push({ lhs, rhs });
    }
  }

  if (!productions.length) {
    throw new Error("Please enter a valid grammar.");
  }

  // Epsilon must be used alone in an alternative.
  for (const { rhs } of productions) {
    if (
      rhs.some(symbol =>
        ["ε", "epsilon", "eps"].includes(symbol.toLowerCase())
      )
    ) {
      if (
        rhs.length !== 1 ||
        !["ε", "epsilon", "eps"].includes(rhs[0].toLowerCase())
      ) {
        throw new Error("Epsilon must appear alone in a production.");
      }
    }
  }

  return {
    productions,
    nonTerminals,
    startSymbol: productions[0].lhs
  };
}

// Calculate FIRST and FOLLOW sets.
function computeFirstFollow(grammar) {
  const { productions, nonTerminals, startSymbol } = grammar;
  const first = {};
  const follow = {};

  for (const nt of nonTerminals) {
    first[nt] = new Set();
    follow[nt] = new Set();
  }

  let changed = true;

  // FIRST sets.
  while (changed) {
    changed = false;

    for (const { lhs, rhs } of productions) {
      let nullable = true;

      for (const symbol of rhs) {
        if (!nonTerminals.has(symbol)) {
          if (!first[lhs].has(symbol)) {
            first[lhs].add(symbol);
            changed = true;
          }

          nullable = false;
          break;
        }

        for (const item of first[symbol]) {
          if (item !== EPSILON && !first[lhs].has(item)) {
            first[lhs].add(item);
            changed = true;
          }
        }

        if (!first[symbol].has(EPSILON)) {
          nullable = false;
          break;
        }
      }

      if (nullable && !first[lhs].has(EPSILON)) {
        first[lhs].add(EPSILON);
        changed = true;
      }
    }
  }

  // The end marker is in FOLLOW(start symbol).
  follow[startSymbol].add(END);

  // FOLLOW sets.
  changed = true;

  while (changed) {
    changed = false;

    for (const { lhs, rhs } of productions) {
      for (let i = 0; i < rhs.length; i++) {
        const symbol = rhs[i];

        if (!nonTerminals.has(symbol)) continue;

        const suffix = rhs.slice(i + 1);
        let suffixNullable = true;

        for (const next of suffix) {
          if (!nonTerminals.has(next)) {
            if (!follow[symbol].has(next)) {
              follow[symbol].add(next);
              changed = true;
            }

            suffixNullable = false;
            break;
          }

          for (const item of first[next]) {
            if (item !== EPSILON && !follow[symbol].has(item)) {
              follow[symbol].add(item);
              changed = true;
            }
          }

          if (!first[next].has(EPSILON)) {
            suffixNullable = false;
            break;
          }
        }

        if (suffixNullable) {
          for (const item of follow[lhs]) {
            if (!follow[symbol].has(item)) {
              follow[symbol].add(item);
              changed = true;
            }
          }
        }
      }
    }
  }

  return { first, follow };
}

// Calculate FIRST for a sequence of grammar symbols.
function firstOfSequence(sequence, first, nonTerminals) {
  const result = new Set();
  let nullable = true;

  for (const symbol of sequence) {
    if (!nonTerminals.has(symbol)) {
      result.add(symbol);
      nullable = false;
      break;
    }

    for (const item of first[symbol]) {
      if (item !== EPSILON) result.add(item);
    }

    if (!first[symbol].has(EPSILON)) {
      nullable = false;
      break;
    }
  }

  if (nullable) result.add(EPSILON);

  return result;
}

// Build the LL(1) predictive parsing table.
function buildParseTable(grammar, sets) {
  const { productions, nonTerminals } = grammar;
  const { first, follow } = sets;

  const table = {};
  const conflicts = [];

  for (const nt of nonTerminals) {
    table[nt] = {};
  }

  for (const production of productions) {
    const sequenceFirst = firstOfSequence(
      production.rhs,
      first,
      nonTerminals
    );

    const lookaheads = new Set(
      [...sequenceFirst].filter(symbol => symbol !== EPSILON)
    );

    if (sequenceFirst.has(EPSILON)) {
      for (const symbol of follow[production.lhs]) {
        lookaheads.add(symbol);
      }
    }

    for (const terminal of lookaheads) {
      const existing = table[production.lhs][terminal];

      if (existing) {
        conflicts.push({
          nonTerminal: production.lhs,
          terminal,
          productions: [existing, production]
        });
      } else {
        table[production.lhs][terminal] = production;
      }
    }
  }

  return { table, conflicts };
}

// Run the predictive parser and record every step.
function parseLL1(grammar, table, inputText) {
  const { nonTerminals, startSymbol } = grammar;

  const tokens = inputText.trim()
    ? tokenize(inputText)
    : [];

  const input = [...tokens, END];
  const stack = [END, startSymbol];
  const steps = [];

  let position = 0;
  let accepted = false;
  const maxSteps = 1000;

  const formatStack = () => [...stack].reverse().join(" ");

  while (steps.length < maxSteps) {
    const stackBefore = formatStack();
    const remainingInput = input.slice(position).join(" ");
    const top = stack[stack.length - 1];
    const lookahead = input[position];

    if (top === END && lookahead === END) {
      steps.push({
        stack: stackBefore,
        input: remainingInput,
        action: "Accept"
      });

      accepted = true;
      break;
    }

    if (top === undefined || lookahead === undefined) break;

    // Match a terminal.
    if (!nonTerminals.has(top)) {
      if (top === lookahead) {
        stack.pop();
        position++;

        steps.push({
          stack: stackBefore,
          input: remainingInput,
          action: `Match ${top}`
        });
      } else {
        steps.push({
          stack: stackBefore,
          input: remainingInput,
          action: `Error: expected ${top}, found ${lookahead}`
        });

        break;
      }
    } else {
      // Expand a non-terminal using the parsing table.
      const production = table[top]?.[lookahead];

      if (!production) {
        steps.push({
          stack: stackBefore,
          input: remainingInput,
          action: `Error: no table entry M[${top}, ${lookahead}]`
        });

        break;
      }

      stack.pop();

      // Push RHS in reverse order.
      for (let i = production.rhs.length - 1; i >= 0; i--) {
        stack.push(production.rhs[i]);
      }

      steps.push({
        stack: stackBefore,
        input: remainingInput,
        action: `${top} → ${
          production.rhs.length
            ? production.rhs.join(" ")
            : EPSILON
        }`
      });
    }
  }

  if (!accepted && steps.length >= maxSteps) {
    steps.push({
      stack: formatStack(),
      input: input.slice(position).join(" "),
      action: "Error: step limit reached"
    });
  }

  return {
    accepted,
    steps,
    message: accepted
      ? "Input accepted."
      : "Input rejected. Check the grammar and input string."
  };
}

export {
  parseGrammar,
  computeFirstFollow,
  buildParseTable,
  parseLL1
};
