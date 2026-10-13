import './App.css';
import { useState } from 'react';

import {
  parseGrammar,
  computeFirstFollow,
  buildParseTable,
  parseLL1
} from './ll1Parser.js';
function App() {
  const [page, setPage] = useState('home')
  const [grammarText, setGrammarText] = useState(
  "E  → T E'\nE' → + T E'\nE' → ε\nT  → id"
);
const [inputText, setInputText] = useState('id + id');
const [ll1Result, setLl1Result] = useState(null);
const [error, setError] = useState('');

function generateLL1() {
  try {
    const grammar = parseGrammar(grammarText);
    const sets = computeFirstFollow(grammar);
    const { table, conflicts } = buildParseTable(grammar, sets);
    const parsing = parseLL1(grammar, table, inputText);

    setLl1Result({ grammar, sets, table, conflicts, parsing });
    setError('');
  } catch (err) {
    setLl1Result(null);
    setError(err.message || 'Unable to process the grammar.');
  }
}

  // Top-Down Parsing page
  if (page === 'topdown') {
    return (
      <div className="app">
        <button
          className="back-button"
          onClick={() => setPage('home')}
        >
          ← Back to Home
        </button>

        <header>
          <h1>Top-Down Parsing</h1>
          <p>Choose a parsing technique to continue</p>
        </header>

        <main className="options-container">

          {/* Recursive Descent Parser */}
          <div className="option-card">
            <h2>Recursive Descent Parser</h2>

            <p>
              A recursive parser where each grammar rule is
              represented by a procedure or function.
            </p>

            <button onClick={() => setPage('rdp')}>
              Open RDP
            </button>
          </div>

          {/* LL(1) Parser */}
          <div className="option-card">
            <h2>LL(1) Parser</h2>

            <p>
              A predictive parser that uses one input token and
              a parsing table to choose the next production.
            </p>

            <button onClick={() => setPage('ll1')}>
              Open LL(1)
            </button>
          </div>

        </main>
      </div>
    )
  }

  // Recursive Descent Parser page
 if (page === 'rdp') {
  return (
    <div className="app">
      <button
        className="back-button"
        onClick={() => setPage('topdown')}
      >
        ← Back to Top-Down Parsing
      </button>

      <header>
        <h1>Recursive Descent Parser</h1>
        <p>
          Enter a grammar and visualize recursive descent parsing
          step by step.
        </p>
      </header>

      <main className="rdp-container">

        <div className="rdp-input-area">

          <section className="grammar-card">
            <h2>Grammar Input</h2>

            <textarea
              rows="10"
              placeholder="Enter your grammar here..."
            />

            <button>
              Generate Parser
            </button>
          </section>

          <section className="example-card">
            <h2>Example Grammar</h2>

            <pre>
{`E  → T E'
E' → + T E'
E' → ε
T  → id`}
            </pre>

            <p>
              Enter one production rule per line.
            </p>
          </section>

        </div>

        <section className="visualization-card">
          <h2>Parsing Visualization</h2>

          <div className="visualization-placeholder">
            <p>
              Generate a parser to view the parsing steps.
            </p>
          </div>
        </section>

      </main>
    </div>
  )
}

  // LL(1) Parser page
 
  // LL(1) Parser page
  if (page === 'll1') {
    const result = ll1Result;

    const terminals = result
      ? [...new Set(
          Object.values(result.table).flatMap(row => Object.keys(row))
        )].sort((a, b) =>
          a === '$' ? 1 : b === '$' ? -1 : a.localeCompare(b)
        )
      : [];

    return (
      <div className="app">
        <button
          className="back-button"
          onClick={() => setPage('topdown')}
        >
          ← Back to Top-Down Parsing
        </button>

        <header>
          <h1>LL(1) Parser</h1>
          <p>
            Enter a grammar and explore FIRST, FOLLOW and LL(1) parsing.
          </p>
        </header>

        <main className="ll1-container">
          <div className="ll1-input-area">
            <section className="grammar-card">
              <h2>Grammar Input</h2>

              <textarea
                rows="10"
                value={grammarText}
                onChange={(e) => setGrammarText(e.target.value)}
                placeholder="Enter one production rule per line..."
              />

              <h3>Input String</h3>
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Example: id + id"
              />

              <button onClick={generateLL1}>
                Generate Parser
              </button>

              {error && (
                <p style={{ color: 'red' }}>{error}</p>
              )}
            </section>

            <section className="example-card">
              <h2>Example Grammar</h2>
              <pre>{`E  → T E'
E' → + T E'
E' → ε
T  → id`}</pre>
              <p>Enter one production rule per line.</p>
            </section>
          </div>

          <section className="ll1-result-card">
            <h2>FIRST &amp; FOLLOW Sets</h2>

            {result ? (
              <div>
                <h3>FIRST</h3>
                {Object.entries(result.sets.first).map(([nt, set]) => (
                  <p key={`first-${nt}`}>
                    <strong>FIRST({nt})</strong> = {'{ '}
                    {[...set].join(', ')}
                    {' }'}
                  </p>
                ))}

                <h3>FOLLOW</h3>
                {Object.entries(result.sets.follow).map(([nt, set]) => (
                  <p key={`follow-${nt}`}>
                    <strong>FOLLOW({nt})</strong> = {'{ '}
                    {[...set].join(', ')}
                    {' }'}
                  </p>
                ))}
              </div>
            ) : (
              <div className="result-placeholder">
                <p>FIRST and FOLLOW sets will appear here.</p>
              </div>
            )}
          </section>

          <section className="ll1-result-card">
            <h2>LL(1) Parse Table</h2>

            {result ? (
              <>
                {result.conflicts.length > 0 && (
                  <p style={{ color: 'red' }}>
                    Grammar is not LL(1): parsing table conflicts detected.
                  </p>
                )}

                {result.conflicts.length === 0 && (
                  <p style={{ color: 'green' }}>
                    No conflicts detected in the parsing table.
                  </p>
                )}

                <div style={{ overflowX: 'auto' }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Non-terminal</th>
                        {terminals.map(t => (
                          <th key={t}>{t}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[...result.grammar.nonTerminals].map(nt => (
                        <tr key={nt}>
                          <th>{nt}</th>
                          {terminals.map(t => {
                            const production = result.table[nt]?.[t];
                            return (
                              <td key={t}>
                                {production
                                  ? `${production.lhs} → ${
                                      production.rhs.join(' ') || 'ε'
                                    }`
                                  : '—'}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="result-placeholder">
                <p>The LL(1) parsing table will appear here.</p>
              </div>
            )}
          </section>

          <section className="ll1-result-card">
            <h2>Parsing Result</h2>

            {result ? (
              <>
                <h3>
                  {result.parsing.accepted
                    ? 'Input Accepted'
                    : 'Input Rejected'}
                </h3>

                <p>{result.parsing.message}</p>

                {result.conflicts.length > 0 && (
                  <p>
                    Warning: this grammar has table conflicts, so the
                    parsing result may not be reliable.
                  </p>
                )}

                <div style={{ overflowX: 'auto' }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Stack</th>
                        <th>Input</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.parsing.steps.map((step, index) => (
                        <tr key={index}>
                          <td>{step.stack}</td>
                          <td>{step.input}</td>
                          <td>{step.action}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="result-placeholder">
                <p>Generate the parser to see the parsing steps.</p>
              </div>
            )}
          </section>
        </main>
      </div>
    );
  }

  // Home page
  return (
    <div className="app home-page">

      <header>
        <h1>Top-Down Parser</h1>
        <p>Interactive Parser Visualization</p>
      </header>

      <main className="home-content">

        <h2>What is Top-Down Parsing?</h2>

        <p>
          Top-down parsing is a parsing technique that starts
          from the start symbol of a grammar and builds the parse
          tree from the root towards the input tokens.
        </p>

        <p>
          It is commonly used to analyze whether an input string
          can be generated by a given context-free grammar.
        </p>

        <button onClick={() => setPage('topdown')}>
          Explore Top-Down Parsing →
        </button>

      </main>

    </div>
  )
}

export default App