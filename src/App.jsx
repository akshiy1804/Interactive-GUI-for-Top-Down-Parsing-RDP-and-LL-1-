
import './App.css'
import { useEffect, useState } from 'react'

import {
  parseGrammar as parseLL1Grammar,
  computeFirstFollow,
  buildParseTable,
  parseLL1
} from './ll1Parser.js'

// ==================================================
// RDP: Grammar processing
// ==================================================
function parseRDPGrammar(grammarText) {
  const productions = []

  const lines = grammarText
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)

  for (const line of lines) {
    const parts = line.includes('→')
      ? line.split('→')
      : line.split('->')

    if (parts.length !== 2 || !parts[0].trim()) {
      continue
    }

    const lhs = parts[0].trim()
    const alternatives = parts[1].split('|')

    for (const alternative of alternatives) {
      const rhsText = alternative.trim()

      productions.push({
        lhs,
        rhs: rhsText ? rhsText.split(/\s+/) : ['ε']
      })
    }
  }

  return {
    productions,
    nonTerminals: new Set(productions.map(p => p.lhs)),
    startSymbol: productions.length ? productions[0].lhs : null
  }
}

const isEpsilon = symbol =>
  ['ε', 'epsilon', 'eps'].includes(symbol)

// ==================================================
// RDP: Parser with recorded tree snapshots
// ==================================================
function runRecursiveDescent(grammarText, inputText) {
  const { productions, nonTerminals, startSymbol } =
    parseRDPGrammar(grammarText)

  if (!startSymbol) {
    return {
      success: false,
      message: 'No valid grammar found. Enter rules such as E → T.',
      tree: null,
      steps: []
    }
  }

  const tokens = inputText.trim()
    ? inputText.trim().split(/\s+/)
    : []

  const productionMap = {}

  productions.forEach(({ lhs, rhs }) => {
    if (!productionMap[lhs]) productionMap[lhs] = []
    productionMap[lhs].push(rhs)
  })

  const root = {
    symbol: startSymbol,
    children: []
  }

  const steps = []

  function cloneTree(node) {
    return JSON.parse(JSON.stringify(node))
  }

  function record(action, position, production = '') {
    steps.push({
      action,
      production,
      inputPosition: position,
      currentToken: tokens[position] ?? 'End of input',
      remainingInput: tokens.slice(position).join(' ') || 'ε',
      tree: cloneTree(root)
    })
  }

  record('Start parsing from the start symbol.', 0)

  function parseSymbol(symbol, position, node, depth = 0) {
    if (depth > 100) {
      record(
        `Recursion limit reached while parsing ${symbol}.`,
        position
      )
      return null
    }

    // Handle terminals and epsilon
    if (!nonTerminals.has(symbol)) {
      if (isEpsilon(symbol)) {
        node.symbol = 'ε'
        node.children = []

        record('Apply ε. No input token is consumed.', position)

        return { position }
      }

      if (position < tokens.length && tokens[position] === symbol) {
        record(`Match terminal "${symbol}".`, position)

        return { position: position + 1 }
      }

      record(
        `Expected "${symbol}", but found "${tokens[position] ?? 'end of input'}".`,
        position
      )

      return null
    }

    const alternatives = productionMap[symbol] || []

    for (const rhs of alternatives) {
      const productionText = `${symbol} → ${rhs.join(' ')}`

      // Reset this branch before trying the production
      node.children = []

      record(
        `Expand ${symbol} using ${productionText}.`,
        position,
        productionText
      )

      let currentPosition = position
      let successful = true

      if (rhs.length === 1 && isEpsilon(rhs[0])) {
        node.children.push({
          symbol: 'ε',
          children: []
        })

        record(
          'Apply ε. No input token is consumed.',
          currentPosition,
          productionText
        )
      } else {
        for (const rhsSymbol of rhs) {
          const child = {
            symbol: rhsSymbol,
            children: []
          }

          node.children.push(child)

          const result = parseSymbol(
            rhsSymbol,
            currentPosition,
            child,
            depth + 1
          )

          if (!result) {
            successful = false
            break
          }

          currentPosition = result.position
        }
      }

      if (successful) {
        return { position: currentPosition }
      }

      record(
        `Backtrack: ${productionText} failed. Trying the next production.`,
        position,
        productionText
      )
    }

    node.children = []
    return null
  }

  const result = parseSymbol(startSymbol, 0, root)

  if (result && result.position === tokens.length) {
    record(
      'Input accepted! All tokens have been consumed.',
      result.position
    )

    return {
      success: true,
      message: 'Input accepted successfully!',
      tree: cloneTree(root),
      steps
    }
  }

  record(
    result
      ? 'Input rejected. Unconsumed input remains.'
      : 'Input rejected. No production could match the input.',
    result?.position ?? 0
  )

  return {
    success: false,
    message: 'Input rejected by the grammar.',
    tree: cloneTree(root),
    steps
  }
}

// ==================================================
// Parse tree renderer
// ==================================================
function ParseTreeNode({ node }) {
  if (!node) return null

  return (
    <div className="tree-node-wrapper">
      <div className="tree-node">
        {node.symbol}
      </div>

      {node.children?.length > 0 && (
        <div className="tree-children">
          {node.children.map((child, index) => (
            <ParseTreeNode
              key={index}
              node={child}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ==================================================
// Main App
// ==================================================
function App() {
  const [page, setPage] = useState('home')

  // Shared grammar and input fields
  const [grammarText, setGrammarText] = useState(
    "E  → T E'\nE' → + T E'\nE' → ε\nT  → id"
  )

  const [inputText, setInputText] = useState('id + id')

  // LL(1) state
  const [ll1Result, setLl1Result] = useState(null)
  const [error, setError] = useState('')

  // RDP playback state
  const [rdpResult, setRdpResult] = useState(null)
  const [rdpSteps, setRdpSteps] = useState([])
  const [currentStep, setCurrentStep] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)

  const activeStep = rdpSteps[currentStep]

  // Automatically advance the RDP visualization
  useEffect(() => {
    if (!isPlaying || rdpSteps.length === 0) return

    if (currentStep >= rdpSteps.length - 1) {
      setIsPlaying(false)
      return
    }

    const timer = setTimeout(() => {
      setCurrentStep(step => Math.min(step + 1, rdpSteps.length - 1))
    }, 1000)

    return () => clearTimeout(timer)
  }, [isPlaying, currentStep, rdpSteps.length])

  function navigateTo(nextPage) {
    setIsPlaying(false)
    setPage(nextPage)
  }

  // ==================================================
  // Generate RDP trace
  // ==================================================
  function generateRDP() {
    setIsPlaying(false)

    const result = runRecursiveDescent(grammarText, inputText)

    setRdpResult(result)
    setRdpSteps(result.steps || [])
    setCurrentStep(0)
  }

  function loadRDPExample() {
    setIsPlaying(false)
    setGrammarText("E  → T E'\nE' → + T E'\nE' → ε\nT  → id")
    setInputText('id + id')
    setRdpResult(null)
    setRdpSteps([])
    setCurrentStep(0)
  }

  // ==================================================
  // Generate LL(1) result
  // ==================================================
  function generateLL1() {
    setIsPlaying(false)

    try {
      const grammar = parseLL1Grammar(grammarText)
      const sets = computeFirstFollow(grammar)
      const { table, conflicts } = buildParseTable(grammar, sets)
      const parsing = parseLL1(grammar, table, inputText)

      setLl1Result({
        grammar,
        sets,
        table,
        conflicts,
        parsing
      })

      setError('')
    } catch (err) {
      setLl1Result(null)
      setError(err.message || 'Unable to process the grammar.')
    }
  }

  // ==================================================
  // Top-Down Parsing page
  // ==================================================
  if (page === 'topdown') {
    return (
      <div className="app">
        <button
          className="back-button"
          onClick={() => navigateTo('home')}
        >
          ← Back to Home
        </button>

        <header>
          <h1>Top-Down Parsing</h1>
          <p>Choose a parsing technique to continue</p>
        </header>

        <main className="options-container">
          <div className="option-card">
            <h2>Recursive Descent Parser</h2>

            <p>
              A recursive parser where each grammar rule is
              represented by a procedure or function.
            </p>

            <button onClick={() => navigateTo('rdp')}>
              Open RDP
            </button>
          </div>

          <div className="option-card">
            <h2>LL(1) Parser</h2>

            <p>
              A predictive parser that uses one input token and
              a parsing table to choose the next production.
            </p>

            <button onClick={() => navigateTo('ll1')}>
              Open LL(1)
            </button>
          </div>
        </main>
      </div>
    )
  }

  // ==================================================
  // Recursive Descent Parser page
  // ==================================================
  if (page === 'rdp') {
    return (
      <div className="app">
        <button
          className="back-button"
          onClick={() => navigateTo('topdown')}
        >
          ← Back to Top-Down Parsing
        </button>

        <header>
          <h1>Recursive Descent Parser</h1>
          <p>
            Generate a parse tree and follow the parsing process
            one step at a time.
          </p>
        </header>

        <main className="rdp-container">
          <div className="rdp-input-area">
            <section className="grammar-card">
              <h2>Grammar Input</h2>

              <textarea
                rows="10"
                value={grammarText}
                onChange={event => setGrammarText(event.target.value)}
                placeholder="Enter one production rule per line..."
              />

              <h3>Input String</h3>

              <input
                type="text"
                value={inputText}
                onChange={event => setInputText(event.target.value)}
                placeholder="Example: id + id"
              />

              <button onClick={generateRDP}>
                Generate Parser
              </button>
            </section>

            <section className="example-card">
              <h2>Example Grammar</h2>

              <pre>{`E  → T E'
E' → + T E'
E' → ε
T  → id`}</pre>

              <p>
                Example input: <strong>id + id</strong>
              </p>

              <button
                className="secondary-button"
                onClick={loadRDPExample}
              >
                Load Example
              </button>
            </section>
          </div>

          <section className="visualization-card">
            <h2>Live Parse Tree</h2>

            {!rdpResult && (
              <div className="tree-area">
                <p>
                  Enter a grammar and input string, then click
                  Generate Parser.
                </p>
              </div>
            )}

            {rdpResult && (
              <>
                <div
                  className={
                    rdpResult.success
                      ? 'parse-success'
                      : 'parse-failure'
                  }
                >
                  {rdpResult.message}
                </div>

                {activeStep && (
                  <div className="step-panel">
                    <div className="step-heading">
                      <strong>
                        Step {currentStep + 1} of {rdpSteps.length}
                      </strong>

                      <span>
                        Input position: {activeStep.inputPosition}
                      </span>
                    </div>

                    <p className="step-action">
                      {activeStep.action}
                    </p>

                    {activeStep.production && (
                      <p>
                        <strong>Production:</strong>{' '}
                        {activeStep.production}
                      </p>
                    )}

                    <div className="input-tracking">
                      <div>
                        <span>Current token</span>
                        <strong>{activeStep.currentToken}</strong>
                      </div>

                      <div>
                        <span>Remaining input</span>
                        <strong>{activeStep.remainingInput}</strong>
                      </div>
                    </div>
                  </div>
                )}

                <div className="tree-controls">
                  <button
                    onClick={() => {
                      setIsPlaying(false)
                      setCurrentStep(step => Math.max(0, step - 1))
                    }}
                    disabled={currentStep === 0}
                  >
                    ← Previous
                  </button>

                  <button
                    className="play-button"
                    disabled={rdpSteps.length === 0}
                    onClick={() => {
                      if (isPlaying) {
                        setIsPlaying(false)
                      } else if (currentStep >= rdpSteps.length - 1) {
                        setCurrentStep(0)
                        setIsPlaying(true)
                      } else {
                        setIsPlaying(true)
                      }
                    }}
                  >
                    {isPlaying ? '⏸ Pause' : '▶ Play'}
                  </button>

                  <span>
                    {rdpSteps.length
                      ? `${currentStep + 1} / ${rdpSteps.length}`
                      : '0 / 0'}
                  </span>

                  <button
                    onClick={() => {
                      setIsPlaying(false)
                      setCurrentStep(step =>
                        Math.min(rdpSteps.length - 1, step + 1)
                      )
                    }}
                    disabled={
                      currentStep >= rdpSteps.length - 1 ||
                      rdpSteps.length === 0
                    }
                  >
                    Next →
                  </button>
                </div>

                <div className="tree-area">
                  {activeStep?.tree ? (
                    <ParseTreeNode node={activeStep.tree} />
                  ) : (
                    <p>No tree snapshot is available.</p>
                  )}
                </div>
              </>
            )}
          </section>
        </main>
      </div>
    )
  }

  // ==================================================
  // LL(1) Parser page
  // ==================================================
  if (page === 'll1') {
    const result = ll1Result

    const terminals = result
      ? [
          ...new Set(
            Object.values(result.table).flatMap(row => Object.keys(row))
          )
        ].sort((a, b) =>
          a === '$' ? 1 : b === '$' ? -1 : a.localeCompare(b)
        )
      : []

    return (
      <div className="app">
        <button
          className="back-button"
          onClick={() => navigateTo('topdown')}
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
                onChange={event => setGrammarText(event.target.value)}
                placeholder="Enter one production rule per line..."
              />

              <h3>Input String</h3>

              <input
                type="text"
                value={inputText}
                onChange={event => setInputText(event.target.value)}
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
                {result.conflicts.length > 0 ? (
                  <p style={{ color: 'red' }}>
                    Grammar is not LL(1): parsing table conflicts detected.
                  </p>
                ) : (
                  <p style={{ color: 'green' }}>
                    No conflicts detected in the parsing table.
                  </p>
                )}

                <div style={{ overflowX: 'auto' }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Non-terminal</th>
                        {terminals.map(terminal => (
                          <th key={terminal}>{terminal}</th>
                        ))}
                      </tr>
                    </thead>

                    <tbody>
                      {[...result.grammar.nonTerminals].map(nt => (
                        <tr key={nt}>
                          <th>{nt}</th>

                          {terminals.map(terminal => {
                            const production = result.table[nt]?.[terminal]

                            return (
                              <td key={terminal}>
                                {production
                                  ? `${production.lhs} → ${
                                      production.rhs.join(' ') || 'ε'
                                    }`
                                  : '—'}
                              </td>
                            )
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
    )
  }

  // ==================================================
  // Home page
  // ==================================================
  return (
    <div className="app home-page">
      <header>
        <h1>Top-Down Parser</h1>
        <p>Interactive Parser Visualization</p>
      </header>

      <main className="home-content">
        <h2>What is Top-Down Parsing?</h2>

        <p>
          Top-down parsing is a parsing technique that starts from
          the start symbol of a grammar and builds the parse tree
          from the root towards the input tokens.
        </p>

        <p>
          It is commonly used to analyze whether an input string
          can be generated by a given context-free grammar.
        </p>

        <button onClick={() => navigateTo('topdown')}>
          Explore Top-Down Parsing →
        </button>
      </main>
    </div>
  )
}

export default App
