import { useEffect, useMemo, useState } from 'react';
import GamesShell from '../../components/GamesShell';

const STORAGE_KEY = 'nullcore.progress';

function parse(code) {
  const labels = {};
  const instructions = [];
  const errors = [];
  const lines = code.split('\n');
  lines.forEach((rawLine, lineIdx) => {
    const stripped = rawLine.split(';')[0].trim();
    if (!stripped) return;
    if (stripped.endsWith(':')) {
      const label = stripped.slice(0, -1).trim();
      if (!/^[A-Za-z_]\w*$/.test(label)) {
        errors.push(`Line ${lineIdx + 1}: invalid label "${label}"`);
        return;
      }
      labels[label] = instructions.length;
      return;
    }
    const parts = stripped.split(/\s+/);
    const op = parts[0].toUpperCase();
    const args = parts.slice(1).map((a) => a.replace(/,$/, ''));
    instructions.push({ op, args, line: lineIdx });
  });
  return { instructions, labels, errors };
}

function freshState(inputs, preserve) {
  return {
    pc: 0,
    acc: preserve?.acc ?? 0,
    dat: preserve?.dat ?? 0,
    inputs: inputs.slice(),
    out: preserve?.out ? preserve.out.slice() : [0, 0, 0, 0],
    steps: 0,
    halted: false,
    error: null,
  };
}

function resolveValue(operand, state) {
  if (operand === undefined) throw new Error('Missing operand');
  const u = operand.toUpperCase();
  if (/^IN[0-3]$/.test(u)) return state.inputs[parseInt(u[2], 10)];
  if (/^OUT[0-3]$/.test(u)) return state.out[parseInt(u[3], 10)];
  if (u === 'ACC') return state.acc;
  if (u === 'DAT') return state.dat;
  const n = parseInt(operand, 10);
  if (!Number.isNaN(n)) return n;
  throw new Error(`Unknown operand "${operand}"`);
}

function writeTarget(operand, value, state) {
  if (operand === undefined) throw new Error('Missing target');
  const u = operand.toUpperCase();
  if (/^OUT[0-3]$/.test(u)) { state.out[parseInt(u[3], 10)] = value; return; }
  if (u === 'ACC') { state.acc = value; return; }
  if (u === 'DAT') { state.dat = value; return; }
  throw new Error(`Cannot write to "${operand}"`);
}

function step(program, state) {
  if (state.halted) return;
  const instr = program.instructions[state.pc];
  if (!instr) { state.halted = true; return; }
  const { op, args } = instr;
  try {
    switch (op) {
      case 'MOV':
        writeTarget(args[1], resolveValue(args[0], state), state);
        state.pc++;
        break;
      case 'ADD': state.acc = state.acc + resolveValue(args[0], state); state.pc++; break;
      case 'SUB': state.acc = state.acc - resolveValue(args[0], state); state.pc++; break;
      case 'MUL': state.acc = state.acc * resolveValue(args[0], state); state.pc++; break;
      case 'AND': state.acc = state.acc & resolveValue(args[0], state); state.pc++; break;
      case 'OR':  state.acc = state.acc | resolveValue(args[0], state); state.pc++; break;
      case 'NOT': state.acc = (~state.acc) & 0xFF; state.pc++; break;
      case 'JMP':
        if (!(args[0] in program.labels)) throw new Error(`Unknown label "${args[0]}"`);
        state.pc = program.labels[args[0]];
        break;
      case 'JEZ':
        if (state.acc === 0) {
          if (!(args[0] in program.labels)) throw new Error(`Unknown label "${args[0]}"`);
          state.pc = program.labels[args[0]];
        } else state.pc++;
        break;
      case 'JNZ':
        if (state.acc !== 0) {
          if (!(args[0] in program.labels)) throw new Error(`Unknown label "${args[0]}"`);
          state.pc = program.labels[args[0]];
        } else state.pc++;
        break;
      case 'JGZ':
        if (state.acc > 0) {
          if (!(args[0] in program.labels)) throw new Error(`Unknown label "${args[0]}"`);
          state.pc = program.labels[args[0]];
        } else state.pc++;
        break;
      case 'JLZ':
        if (state.acc < 0) {
          if (!(args[0] in program.labels)) throw new Error(`Unknown label "${args[0]}"`);
          state.pc = program.labels[args[0]];
        } else state.pc++;
        break;
      case 'NOP': state.pc++; break;
      case 'HALT': state.halted = true; break;
      default:
        throw new Error(`Unknown op "${op}"`);
    }
    state.steps++;
    if (!state.halted && state.pc >= program.instructions.length) state.halted = true;
  } catch (e) {
    state.error = e.message;
    state.halted = true;
  }
}

function runOne(program, inputs, preserve, maxSteps = 100) {
  const state = freshState(inputs, preserve);
  while (!state.halted && state.steps < maxSteps) step(program, state);
  return state;
}

const LEVELS = [
  {
    id: 'RELAY',
    title: 'Relay',
    goal: 'Copy the value from input pin IN0 into output pin OUT0.',
    detail: 'Warm-up. Whatever the test pushes into IN0 needs to appear on OUT0. The MOV instruction copies a value from one place to another.',
    pins: { in: ['IN0', '—', '—', '—'], out: ['OUT0', '—', '—', '—'] },
    tests: [
      { inputs: [0, 0, 0, 0], expected: [0, 0, 0, 0] },
      { inputs: [1, 0, 0, 0], expected: [1, 0, 0, 0] },
    ],
    hint: 'reference solution: 1 instruction',
    starter: '; MOV <source> <destination>\n; copies a value.\nMOV IN0 OUT0\n',
  },
  {
    id: 'INVERTER',
    title: 'Inverter',
    goal: 'OUT0 should be 1 when IN0 is 0, and 0 when IN0 is 1.',
    detail: 'This needs a decision — two different paths through the code. Read IN0 into ACC, then JEZ (jump-if-equal-zero) to skip past the "set OUT0 to 0" branch when it\u2019s zero.',
    pins: { in: ['IN0', '—', '—', '—'], out: ['OUT0', '—', '—', '—'] },
    tests: [
      { inputs: [0, 0, 0, 0], expected: [1, 0, 0, 0] },
      { inputs: [1, 0, 0, 0], expected: [0, 0, 0, 0] },
    ],
    hint: 'reference solution: 6 instructions',
    starter: '; load IN0 into ACC so we can test it\nMOV IN0 ACC\nJEZ zero      ; if ACC == 0, jump to the "zero" label\nMOV 0 OUT0    ; IN0 was 1, so write 0\nJMP end\nzero:\nMOV 1 OUT0    ; IN0 was 0, so write 1\nend:\n',
  },
  {
    id: 'ADDER',
    title: 'Adder',
    goal: 'OUT0 should equal IN0 + IN1.',
    detail: 'ADD always works on ACC. Load one number into ACC, add the other, then write the result out.',
    pins: { in: ['IN0', 'IN1', '—', '—'], out: ['OUT0', '—', '—', '—'] },
    tests: [
      { inputs: [2, 3, 0, 0], expected: [5, 0, 0, 0] },
      { inputs: [7, 0, 0, 0], expected: [7, 0, 0, 0] },
      { inputs: [9, 6, 0, 0], expected: [15, 0, 0, 0] },
    ],
    hint: 'reference solution: 3 instructions',
    starter: 'MOV IN0 ACC   ; ACC = IN0\nADD IN1       ; ACC = ACC + IN1\nMOV ACC OUT0  ; write sum out\n',
  },
  {
    id: 'GATE',
    title: 'Gate',
    goal: 'OUT0 = IN0 AND IN1 (bitwise). OUT1 = IN0 OR IN1.',
    detail: 'Two outputs this time. AND and OR are bitwise ops that operate on ACC. You\u2019ll need to load IN0 twice — once for each output — unless you use DAT to save it.',
    pins: { in: ['IN0', 'IN1', '—', '—'], out: ['AND', 'OR', '—', '—'] },
    tests: [
      { inputs: [0, 0, 0, 0], expected: [0, 0, 0, 0] },
      { inputs: [0, 1, 0, 0], expected: [0, 1, 0, 0] },
      { inputs: [1, 0, 0, 0], expected: [0, 1, 0, 0] },
      { inputs: [1, 1, 0, 0], expected: [1, 1, 0, 0] },
    ],
    hint: 'reference solution: 6 instructions',
    starter: 'MOV IN0 ACC\nAND IN1\nMOV ACC OUT0   ; AND result\nMOV IN0 ACC\nOR IN1\nMOV ACC OUT1   ; OR result\n',
  },
  {
    id: 'ROUTER',
    title: 'Router',
    goal: 'If IN2 is 1 then OUT0 = IN0, otherwise OUT0 = IN1. (IN2 is a "selector" bit.)',
    detail: 'Branch on IN2 to choose which input to forward. JEZ takes you to a label if ACC is zero.',
    pins: { in: ['IN0', 'IN1', 'SEL', '—'], out: ['OUT0', '—', '—', '—'] },
    tests: [
      { inputs: [5, 9, 1, 0], expected: [5, 0, 0, 0] },
      { inputs: [5, 9, 0, 0], expected: [9, 0, 0, 0] },
      { inputs: [3, 7, 1, 0], expected: [3, 0, 0, 0] },
    ],
    hint: 'reference solution: 6 instructions',
    starter: 'MOV IN2 ACC\nJEZ useB      ; if selector is 0, take path B\nMOV IN0 OUT0  ; selector was 1, forward IN0\nJMP end\nuseB:\nMOV IN1 OUT0  ; selector was 0, forward IN1\nend:\n',
  },
  {
    id: 'COUNTER',
    title: 'Counter',
    goal: 'Each time the program runs, OUT0 should output the next number in the sequence 0, 1, 2, 3, 0, 1, 2, 3, \u2026',
    detail: 'This level runs your program five times in a row. ACC and OUT reset between runs, but DAT holds its value — use it as persistent storage. Write out the count, then update DAT so the next run emits the next number.',
    pins: { in: ['—', '—', '—', '—'], out: ['COUNT', '—', '—', '—'] },
    persistent: true,
    cycles: [
      { inputs: [0, 0, 0, 0], expected: [0, 0, 0, 0] },
      { inputs: [0, 0, 0, 0], expected: [1, 0, 0, 0] },
      { inputs: [0, 0, 0, 0], expected: [2, 0, 0, 0] },
      { inputs: [0, 0, 0, 0], expected: [3, 0, 0, 0] },
      { inputs: [0, 0, 0, 0], expected: [0, 0, 0, 0] },
    ],
    hint: 'reference solution: 5 instructions',
    starter: '; DAT persists across runs — use it as memory.\nMOV DAT OUT0   ; emit current count\nMOV DAT ACC\nADD 1\nAND 3          ; wrap at 4 (bitmask 0b11)\nMOV ACC DAT    ; save incremented count for next run\n',
  },
];

const INSTRUCTION_REFERENCE = [
  ['MOV src dst', 'Copy a value. src can be IN0-3, OUT0-3, ACC, DAT, or a number. dst can be OUT0-3, ACC, or DAT.'],
  ['ADD val', 'ACC = ACC + val'],
  ['SUB val', 'ACC = ACC - val'],
  ['MUL val', 'ACC = ACC * val'],
  ['AND val', 'ACC = ACC bitwise-AND val'],
  ['OR val',  'ACC = ACC bitwise-OR val'],
  ['NOT',     'ACC = bitwise NOT of ACC (8-bit)'],
  ['JMP label', 'Unconditional jump to label.'],
  ['JEZ label', 'Jump if ACC is equal to zero.'],
  ['JNZ label', 'Jump if ACC is not zero.'],
  ['JGZ label', 'Jump if ACC > 0.'],
  ['JLZ label', 'Jump if ACC < 0.'],
  ['NOP',       'Do nothing.'],
  ['HALT',      'Stop execution.'],
  ['label:',    'Define a jump target on its own line.'],
  ['; comment', 'Everything after a semicolon is ignored.'],
];

function loadProgress() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveProgress(completed) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(completed)); } catch {}
}

function loadCode(levelId) {
  if (typeof window === 'undefined') return null;
  try { return localStorage.getItem(`nullcore.code.${levelId}`); } catch { return null; }
}

function saveCode(levelId, code) {
  try { localStorage.setItem(`nullcore.code.${levelId}`, code); } catch {}
}

export default function Nullcore() {
  const [levelIdx, setLevelIdx] = useState(0);
  const level = LEVELS[levelIdx];
  const [code, setCode] = useState(level.starter);
  const [state, setState] = useState(() => freshState([0, 0, 0, 0]));
  const [testResults, setTestResults] = useState(null);
  const [completed, setCompleted] = useState([]);
  const [view, setView] = useState('select');

  const program = useMemo(() => parse(code), [code]);

  useEffect(() => {
    setCompleted(loadProgress());
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.__setGameState = (s) => {
        if (s?.testResults) setTestResults(s.testResults);
        if (s?.completed) { setCompleted(s.completed); saveProgress(s.completed); }
      };
    }
    return () => { if (typeof window !== 'undefined') delete window.__setGameState; };
  }, []);

  function openLevel(i) {
    setLevelIdx(i);
    const saved = loadCode(LEVELS[i].id);
    setCode(saved ?? LEVELS[i].starter);
    setState(freshState([0, 0, 0, 0]));
    setTestResults(null);
    setView('play');
  }

  function onCodeChange(v) {
    setCode(v);
    saveCode(level.id, v);
  }

  function doStep() {
    const next = { ...state, out: state.out.slice(), inputs: state.inputs.slice() };
    step(program, next);
    setState(next);
  }

  function doRun() {
    const next = { ...state, out: state.out.slice(), inputs: state.inputs.slice() };
    while (!next.halted && next.steps < 100) step(program, next);
    setState(next);
  }

  function doReset() {
    setState(freshState([0, 0, 0, 0]));
  }

  function doTest() {
    const results = [];
    let allPass = true;
    if (level.persistent) {
      let preserve = null;
      for (const cyc of level.cycles) {
        const s = runOne(program, cyc.inputs, preserve);
        const pass = !s.error && s.out.every((v, i) => v === cyc.expected[i]);
        results.push({ inputs: cyc.inputs, expected: cyc.expected, got: s.out, pass, error: s.error });
        if (!pass) allPass = false;
        preserve = { dat: s.dat, acc: 0, out: s.out };
      }
    } else {
      for (const t of level.tests) {
        const s = runOne(program, t.inputs);
        const pass = !s.error && s.out.every((v, i) => v === t.expected[i]);
        results.push({ inputs: t.inputs, expected: t.expected, got: s.out, pass, error: s.error });
        if (!pass) allPass = false;
      }
    }
    setTestResults({ results, allPass });
    if (allPass) {
      const nc = Array.from(new Set([...completed, levelIdx]));
      setCompleted(nc);
      saveProgress(nc);
    }
  }

  const currentLineInSource = state.halted ? -1 : program.instructions[state.pc]?.line ?? -1;
  const sourceLines = code.split('\n');

  if (view === 'select') {
    return (
      <GamesShell title="nullcore">
        <h1>Nullcore</h1>
        <p className="games-intro">
          Nullcore is a puzzle about writing tiny assembly programs for a made-up microcontroller. You read numbers from input pins, do arithmetic in a register called ACC, and write answers out to output pins. Each level gives you a target behavior and three or four test cases — when your program passes all of them, the level is solved.
        </p>

        <div className="nc-tutorial">
          <h3>The machine</h3>
          <p style={{ margin: '6px 0 12px' }}>
            The microcontroller has <strong>four input pins</strong> (IN0–IN3), <strong>four output pins</strong> (OUT0–OUT3), and two scratch registers: <strong>ACC</strong> (where arithmetic happens) and <strong>DAT</strong> (a second slot, used by the last level to remember things between runs). Inputs are decided by the level; your job is to set the outputs.
          </p>

          <details>
            <summary>Instruction reference</summary>
            <table>
              <tbody>
                {INSTRUCTION_REFERENCE.map(([op, desc]) => (
                  <tr key={op}><td>{op}</td><td>{desc}</td></tr>
                ))}
              </tbody>
            </table>
          </details>

          <details style={{ marginTop: 6 }}>
            <summary>How to run code</summary>
            <ul style={{ margin: '6px 0 0', paddingLeft: 20 }}>
              <li><strong>Step</strong> runs one instruction so you can watch ACC and OUT change.</li>
              <li><strong>Run</strong> executes until HALT or 100 instructions (loop guard).</li>
              <li><strong>Reset</strong> clears registers and outputs but keeps your code.</li>
              <li><strong>Test</strong> runs your program against every test case and checks the outputs. Pass all of them and the level is complete.</li>
            </ul>
          </details>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 16 }}>
          {LEVELS.map((lv, i) => {
            const done = completed.includes(i);
            return (
              <button key={i} className="games-btn" data-testid={`level-${i}`} onClick={() => openLevel(i)}>
                {String(i + 1).padStart(2, '0')} · {lv.title}
                {done && <span style={{ marginLeft: 8, color: 'var(--accent)' }}>✓</span>}
              </button>
            );
          })}
        </div>
      </GamesShell>
    );
  }

  return (
    <GamesShell title={`nullcore — ${level.title}`}>
      <h1>Nullcore · {level.title}</h1>
      <div className="games-nav" style={{ marginBottom: 14 }}>
        <button className="games-btn" onClick={() => setView('select')} data-testid="back-btn">← levels</button>
        <span style={{ color: 'var(--muted)', marginLeft: 'auto' }}>{level.hint}</span>
      </div>

      <div className="nc-goal">
        <strong>Goal · {level.title}.</strong> {level.goal}
      </div>
      <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: -6 }}>{level.detail}</p>

      <div className="nc-layout">
        <div className="nc-mcu">
          <h3>Microcontroller</h3>
          <div className="nc-pins">
            <div className="nc-pin-col">
              <div className="games-label">Inputs</div>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="nc-pin">
                  <span>{level.pins.in[i] !== '—' ? level.pins.in[i] : `IN${i}`}</span>
                  <span>{state.inputs[i]}</span>
                </div>
              ))}
            </div>
            <div className="nc-pin-col">
              <div className="games-label">Outputs</div>
              {[0, 1, 2, 3].map((i) => {
                const expected = testResults?.results?.[0]?.expected?.[i];
                const cls = testResults
                  ? state.out[i] === expected
                    ? 'match'
                    : 'miss'
                  : '';
                return (
                  <div key={i} className={`nc-pin ${cls}`}>
                    <span>{level.pins.out[i] !== '—' ? level.pins.out[i] : `OUT${i}`}</span>
                    <span>{state.out[i]}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="nc-regs">
            <div className="nc-pin"><span>ACC</span><span>{state.acc}</span></div>
            <div className="nc-pin"><span>DAT</span><span>{state.dat}</span></div>
          </div>
          <div style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="games-btn" onClick={doStep} data-testid="step-btn">step</button>
            <button className="games-btn" onClick={doRun} data-testid="run-btn">run</button>
            <button className="games-btn" onClick={doReset} data-testid="reset-btn">reset</button>
            <button className="games-btn amber" onClick={doTest} data-testid="test-btn">test</button>
          </div>
          {state.error && <div style={{ marginTop: 10, color: 'var(--red)' }}>{state.error}</div>}
        </div>

        <div className="nc-editor">
          <div className="nc-editor-wrap">
            <div className="nc-gutter">
              {sourceLines.map((_, i) => (
                <div key={i} className={i === currentLineInSource ? 'current' : ''}>
                  {i === currentLineInSource ? '▶' : ' '}
                  {String(i + 1).padStart(2, ' ')}
                </div>
              ))}
            </div>
            <textarea
              className="nc-code"
              value={code}
              onChange={(e) => onCodeChange(e.target.value)}
              spellCheck={false}
              rows={16}
              data-testid="code-editor"
            />
          </div>

          <div>
            <div className="games-label">Tests</div>
            {(level.persistent ? level.cycles : level.tests).map((t, i) => {
              const res = testResults?.results?.[i];
              const cls = res ? (res.pass ? 'pass' : 'fail') : '';
              return (
                <div key={i} className={`nc-test-row ${cls}`} data-testid={`test-${i}`}>
                  <span>in [{t.inputs.join(', ')}]</span>
                  <span>→ expect [{t.expected.join(', ')}]</span>
                  {res && <span>{res.pass ? 'PASS' : `FAIL (got ${res.got.join(',')})`}</span>}
                </div>
              );
            })}
          </div>

          {testResults?.allPass && (
            <div className="games-win-banner" data-testid="win-banner">
              All tests pass
              {levelIdx + 1 < LEVELS.length ? (
                <div style={{ marginTop: 8 }}>
                  <button className="games-btn amber" onClick={() => openLevel(levelIdx + 1)}>Next →</button>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </GamesShell>
  );
}
