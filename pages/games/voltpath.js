import { useEffect, useMemo, useRef, useState } from 'react';
import GamesShell from '../../components/GamesShell';

// Tile types — edges are sets of {0:top, 1:right, 2:bottom, 3:left}
const BASE_EDGES = {
  STRAIGHT: [0, 2],
  CORNER: [0, 1],
  T: [0, 1, 2],
  CROSS: [0, 1, 2, 3],
};

function tileEdges(type, rotation) {
  const base = BASE_EDGES[type];
  return base.map((e) => (e + rotation) % 4);
}

const OPPOSITE = { 0: 2, 1: 3, 2: 0, 3: 1 };

function dirOffset(dir) {
  return [
    [-1, 0],
    [0, 1],
    [1, 0],
    [0, -1],
  ][dir];
}

const STORAGE_KEY = 'voltpath.progress';

const LEVELS = [
  {
    name: 'Relay',
    rows: 6, cols: 6,
    source: { r: 0, c: 0, dir: 1 },
    receiver: { r: 0, c: 5, dir: 3 },
    fixed: [],
    hand: { STRAIGHT: 5 },
  },
  {
    name: 'Elbow',
    rows: 6, cols: 6,
    source: { r: 0, c: 0, dir: 2 },
    receiver: { r: 5, c: 5, dir: 3 },
    fixed: [],
    hand: { STRAIGHT: 8, CORNER: 1 },
  },
  {
    name: 'Detour',
    rows: 7, cols: 7,
    source: { r: 3, c: 0, dir: 1 },
    receiver: { r: 3, c: 6, dir: 3 },
    fixed: [
      { r: 3, c: 3, type: 'STRAIGHT', rotation: 0 },
    ],
    hand: { STRAIGHT: 6, CORNER: 4 },
  },
  {
    name: 'Choice',
    rows: 7, cols: 7,
    source: { r: 0, c: 0, dir: 2 },
    receiver: { r: 6, c: 6, dir: 0 },
    fixed: [],
    hand: { STRAIGHT: 10, CORNER: 2 },
  },
  {
    name: 'Branches',
    rows: 8, cols: 8,
    source: { r: 0, c: 0, dir: 1 },
    receiver: { r: 7, c: 7, dir: 3 },
    fixed: [],
    hand: { STRAIGHT: 10, CORNER: 2, T: 1 },
  },
  {
    name: 'Lean',
    rows: 8, cols: 8,
    source: { r: 0, c: 4, dir: 2 },
    receiver: { r: 7, c: 3, dir: 0 },
    fixed: [
      { r: 4, c: 4, type: 'CORNER', rotation: 2 },
    ],
    hand: { STRAIGHT: 10, CORNER: 2 },
  },
  {
    name: 'Spindle',
    rows: 9, cols: 9,
    source: { r: 0, c: 0, dir: 1 },
    receiver: { r: 8, c: 8, dir: 3 },
    fixed: [
      { r: 4, c: 4, type: 'CROSS', rotation: 0 },
    ],
    hand: { STRAIGHT: 12, CORNER: 4, T: 1 },
  },
  {
    name: 'Minima',
    rows: 10, cols: 10,
    source: { r: 0, c: 0, dir: 2 },
    receiver: { r: 9, c: 9, dir: 0 },
    fixed: [],
    hand: { STRAIGHT: 16, CORNER: 2 },
  },
];

function makeInitial(level) {
  const grid = Array.from({ length: level.rows }, () =>
    Array.from({ length: level.cols }, () => null)
  );
  for (const f of level.fixed) {
    grid[f.r][f.c] = { type: f.type, rotation: f.rotation, fixed: true };
  }
  return grid;
}

function findPath(level, grid) {
  const { source, receiver } = level;
  // Graph nodes: cells that contain tiles, plus source and receiver.
  const key = (r, c) => `${r},${c}`;

  // Initial step: does source connect to neighbor in source.dir?
  const [dr, dc] = dirOffset(source.dir);
  const startR = source.r + dr;
  const startC = source.c + dc;

  if (startR < 0 || startR >= level.rows || startC < 0 || startC >= level.cols) return null;

  // Queue elements: {r, c, path: [cells]}
  const seen = new Set();
  const start = key(source.r, source.c);
  seen.add(start);

  const firstTile = grid[startR][startC];
  if (!firstTile) return null;
  const firstEdges = tileEdges(firstTile.type, firstTile.rotation);
  if (!firstEdges.includes(OPPOSITE[source.dir])) return null;

  const queue = [{ r: startR, c: startC, path: [{ r: source.r, c: source.c }, { r: startR, c: startC }] }];
  seen.add(key(startR, startC));

  while (queue.length) {
    const { r, c, path } = queue.shift();
    const tile = grid[r][c];
    if (!tile) continue;
    const edges = tileEdges(tile.type, tile.rotation);

    // Check if this cell can reach the receiver directly
    for (const edge of edges) {
      const [rdr, rdc] = dirOffset(edge);
      const nr = r + rdr;
      const nc = c + rdc;
      if (nr === receiver.r && nc === receiver.c && edge === OPPOSITE[receiver.dir]) {
        return [...path, { r: receiver.r, c: receiver.c }];
      }
    }

    // Expand to neighbors
    for (const edge of edges) {
      const [rdr, rdc] = dirOffset(edge);
      const nr = r + rdr;
      const nc = c + rdc;
      if (nr < 0 || nr >= level.rows || nc < 0 || nc >= level.cols) continue;
      if (seen.has(key(nr, nc))) continue;
      const nt = grid[nr][nc];
      if (!nt) continue;
      const nEdges = tileEdges(nt.type, nt.rotation);
      if (!nEdges.includes(OPPOSITE[edge])) continue;
      seen.add(key(nr, nc));
      queue.push({ r: nr, c: nc, path: [...path, { r: nr, c: nc }] });
    }
  }
  return null;
}

function loadProgress() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveProgress(completed) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(completed));
  } catch {}
}

function TileSVG({ type, rotation, cellSize = 48, lit = false }) {
  const edges = tileEdges(type, rotation);
  const c = cellSize / 2;
  const midpoints = {
    0: [c, 0],
    1: [cellSize, c],
    2: [c, cellSize],
    3: [0, c],
  };
  const color = lit ? '#d98824' : '#444444';
  const lines = edges.map((e, i) => {
    const [x, y] = midpoints[e];
    return <line key={i} x1={c} y1={c} x2={x} y2={y} strokeWidth="4" strokeLinecap="round" stroke={color} />;
  });
  return (
    <svg width={cellSize} height={cellSize} viewBox={`0 0 ${cellSize} ${cellSize}`}>
      {lines}
      <circle cx={c} cy={c} r="3" fill={color} />
    </svg>
  );
}

function HandIcon({ type }) {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26">
      {(() => {
        const edges = BASE_EDGES[type];
        const mid = { 0: [13, 0], 1: [26, 13], 2: [13, 26], 3: [0, 13] };
        return (
          <>
            {edges.map((e, i) => (
              <line key={i} x1="13" y1="13" x2={mid[e][0]} y2={mid[e][1]} stroke="#444" strokeWidth="3" strokeLinecap="round" />
            ))}
            <circle cx="13" cy="13" r="2" fill="#444" />
          </>
        );
      })()}
    </svg>
  );
}

export default function Voltpath() {
  const [levelIdx, setLevelIdx] = useState(0);
  const [grid, setGrid] = useState(() => makeInitial(LEVELS[0]));
  const [hand, setHand] = useState(() => ({ ...LEVELS[0].hand }));
  const [selectedType, setSelectedType] = useState(null);
  const [path, setPath] = useState(null);
  const [won, setWon] = useState(false);
  const [completed, setCompleted] = useState([]);
  const [pulseIdx, setPulseIdx] = useState(0);
  const [view, setView] = useState('select');
  const pulseTimerRef = useRef(null);

  const level = LEVELS[levelIdx];

  useEffect(() => {
    setCompleted(loadProgress());
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.__setGameState = (state) => {
        if (state?.grid) setGrid(state.grid);
        if (state?.won !== undefined) setWon(state.won);
        if (state?.path) setPath(state.path);
      };
    }
    return () => {
      if (typeof window !== 'undefined') delete window.__setGameState;
    };
  }, []);

  function loadLevel(i) {
    setLevelIdx(i);
    setGrid(makeInitial(LEVELS[i]));
    setHand({ ...LEVELS[i].hand });
    setSelectedType(null);
    setPath(null);
    setWon(false);
    setPulseIdx(0);
    setView('play');
    if (pulseTimerRef.current) clearInterval(pulseTimerRef.current);
  }

  function checkWin(nextGrid) {
    const p = findPath(level, nextGrid);
    if (p) {
      setPath(p);
      setWon(true);
      const nc = Array.from(new Set([...completed, levelIdx]));
      setCompleted(nc);
      saveProgress(nc);
      setPulseIdx(0);
      if (pulseTimerRef.current) clearInterval(pulseTimerRef.current);
      pulseTimerRef.current = setInterval(() => {
        setPulseIdx((i) => (i + 1) % p.length);
      }, 180);
    }
  }

  function handleCellClick(r, c, e) {
    if (won) return;
    if (r === level.source.r && c === level.source.c) return;
    if (r === level.receiver.r && c === level.receiver.c) return;
    const cell = grid[r][c];
    if (cell?.fixed) return;

    if (cell) {
      // rotate
      const maxRot = cell.type === 'CROSS' ? 1 : cell.type === 'STRAIGHT' ? 2 : 4;
      const newGrid = grid.map((row) => row.slice());
      newGrid[r][c] = { ...cell, rotation: (cell.rotation + 1) % maxRot };
      setGrid(newGrid);
      checkWin(newGrid);
    } else if (selectedType && hand[selectedType] > 0) {
      const newGrid = grid.map((row) => row.slice());
      newGrid[r][c] = { type: selectedType, rotation: 0 };
      setGrid(newGrid);
      setHand({ ...hand, [selectedType]: hand[selectedType] - 1 });
      checkWin(newGrid);
    }
  }

  function handleCellRightClick(r, c, e) {
    e.preventDefault();
    if (won) return;
    const cell = grid[r][c];
    if (!cell || cell.fixed) return;
    const newGrid = grid.map((row) => row.slice());
    newGrid[r][c] = null;
    setGrid(newGrid);
    setHand({ ...hand, [cell.type]: (hand[cell.type] || 0) + 1 });
    setPath(null);
    setWon(false);
  }

  function resetLevel() {
    loadLevel(levelIdx);
  }

  const pathSet = useMemo(() => {
    if (!path) return new Set();
    return new Set(path.map((p) => `${p.r},${p.c}`));
  }, [path]);

  if (view === 'select') {
    return (
      <GamesShell title="voltpath">
        <h1>Voltpath</h1>
        <p className="games-intro">Close the circuit. A current needs to flow from the green source to the amber receiver through connected wire tiles.</p>
        <div className="games-rules">
          <strong>How to play</strong>
          <ul>
            <li>Pick a tile type from the hand on the right.</li>
            <li>Click an empty cell to <strong>place</strong> it.</li>
            <li>Click a placed tile to <strong>rotate</strong> it 90°.</li>
            <li>Right-click a placed tile to <strong>remove</strong> it back to your hand.</li>
            <li>You win the instant a contiguous wire path connects source and receiver.</li>
          </ul>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginTop: 16 }}>
          {LEVELS.map((lv, i) => {
            const done = completed.includes(i);
            return (
              <button key={i} className="games-btn" data-testid={`level-${i}`} onClick={() => loadLevel(i)}>
                {String(i + 1).padStart(2, '0')} · {lv.name}
                {done && <span style={{ marginLeft: 8, color: 'var(--accent)' }}>✓</span>}
              </button>
            );
          })}
        </div>
      </GamesShell>
    );
  }

  const cellSize = level.rows > 8 ? 40 : 48;

  return (
    <GamesShell title={`voltpath — ${level.name}`}>
      <h1>Voltpath · {level.name}</h1>
      <div className="games-nav" style={{ marginBottom: 18 }}>
        <button className="games-btn" onClick={() => setView('select')} data-testid="back-btn">← levels</button>
        <button className="games-btn" onClick={resetLevel} data-testid="reset-btn">reset</button>
        <span style={{ color: 'var(--muted)', marginLeft: 'auto' }}>
          level {levelIdx + 1} / {LEVELS.length}
        </span>
      </div>

      <div className="vp-layout">
        <div>
          <div
            className="vp-grid"
            style={{ gridTemplateColumns: `repeat(${level.cols}, ${cellSize}px)` }}
            data-testid="vp-grid"
          >
            {grid.map((row, r) =>
              row.map((cell, c) => {
                const isSource = r === level.source.r && c === level.source.c;
                const isReceiver = r === level.receiver.r && c === level.receiver.c;
                const isPath = pathSet.has(`${r},${c}`);
                const pathPos = path ? path.findIndex((p) => p.r === r && p.c === c) : -1;
                const classes = [
                  'vp-cell',
                  cell?.fixed ? 'fixed' : '',
                  isSource ? 'source' : '',
                  isReceiver ? 'receiver' : '',
                  isReceiver && won ? 'lit' : '',
                  isPath ? 'on-path' : '',
                ].filter(Boolean).join(' ');
                return (
                  <div
                    key={`${r}-${c}`}
                    className={classes}
                    style={{ width: cellSize, height: cellSize }}
                    onClick={(e) => handleCellClick(r, c, e)}
                    onContextMenu={(e) => handleCellRightClick(r, c, e)}
                    data-testid={`vp-cell-${r}-${c}`}
                  >
                    {isSource && (
                      <svg width={cellSize} height={cellSize} viewBox={`0 0 ${cellSize} ${cellSize}`} style={{ position: 'absolute', inset: 0 }}>
                        <line
                          x1={cellSize / 2}
                          y1={cellSize / 2}
                          x2={dirOffset(level.source.dir)[1] * cellSize / 2 + cellSize / 2}
                          y2={dirOffset(level.source.dir)[0] * cellSize / 2 + cellSize / 2}
                          stroke="#4a8f3a"
                          strokeWidth="4"
                          strokeLinecap="round"
                        />
                        <circle cx={cellSize / 2} cy={cellSize / 2} r="6" fill="#4a8f3a" />
                      </svg>
                    )}
                    {isReceiver && (
                      <svg width={cellSize} height={cellSize} viewBox={`0 0 ${cellSize} ${cellSize}`} style={{ position: 'absolute', inset: 0 }}>
                        <line
                          x1={cellSize / 2}
                          y1={cellSize / 2}
                          x2={dirOffset(level.receiver.dir)[1] * cellSize / 2 + cellSize / 2}
                          y2={dirOffset(level.receiver.dir)[0] * cellSize / 2 + cellSize / 2}
                          stroke={won ? '#d98824' : '#aaaaaa'}
                          strokeWidth="4"
                          strokeLinecap="round"
                        />
                        <circle cx={cellSize / 2} cy={cellSize / 2} r="6" fill={won ? '#d98824' : '#ffffff'} stroke="#d98824" strokeWidth="2" />
                      </svg>
                    )}
                    {cell && <TileSVG type={cell.type} rotation={cell.rotation} cellSize={cellSize} lit={won && isPath} />}
                    {won && path && pathPos === pulseIdx && (
                      <div className="vp-pulse" style={{ left: cellSize / 2 - 4, top: cellSize / 2 - 4 }} />
                    )}
                  </div>
                );
              })
            )}
          </div>
          {won && (
            <div className="games-win-banner" data-testid="win-banner">
              Circuit Closed
              <div style={{ marginTop: 8 }}>
                {levelIdx + 1 < LEVELS.length ? (
                  <button className="games-btn amber" onClick={() => loadLevel(levelIdx + 1)} data-testid="next-btn">
                    Next level →
                  </button>
                ) : (
                  <button className="games-btn amber" onClick={() => setView('select')}>
                    All levels complete
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="vp-hand">
          <div className="games-label">Hand</div>
          {Object.entries(hand).map(([type, count]) => (
            <div
              key={type}
              className={`vp-hand-item ${selectedType === type ? 'selected' : ''} ${count === 0 ? 'empty' : ''}`}
              onClick={() => count > 0 && setSelectedType(type)}
              data-testid={`hand-${type.toLowerCase()}`}
            >
              <HandIcon type={type} />
              <span>{type}</span>
              <span className="vp-hand-count">{count}</span>
            </div>
          ))}
        </div>
      </div>
    </GamesShell>
  );
}
