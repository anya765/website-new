import { useEffect, useRef, useState } from 'react';
import GamesShell from '../../components/GamesShell';

const SIZE = 9;
const CELL = 52;
const GAP = 6;

function initialState() {
  return {
    pawns: [
      { r: 0, c: 4, goal: SIZE - 1 },
      { r: SIZE - 1, c: 4, goal: 0 },
    ],
    walls: [],
    wallsLeft: [10, 10],
    turn: 0,
    winner: null,
    mode: 'move',
  };
}

function edgeBlocked(walls, from, to) {
  const dr = to.r - from.r;
  const dc = to.c - from.c;
  if (Math.abs(dr) + Math.abs(dc) !== 1) return true;
  for (const w of walls) {
    if (dr === 1 && w.o === 'h' && w.r === from.r && (w.c === from.c || w.c === from.c - 1)) return true;
    if (dr === -1 && w.o === 'h' && w.r === from.r - 1 && (w.c === from.c || w.c === from.c - 1)) return true;
    if (dc === 1 && w.o === 'v' && w.c === from.c && (w.r === from.r || w.r === from.r - 1)) return true;
    if (dc === -1 && w.o === 'v' && w.c === from.c - 1 && (w.r === from.r || w.r === from.r - 1)) return true;
  }
  return false;
}

function inBounds(r, c) {
  return r >= 0 && r < SIZE && c >= 0 && c < SIZE;
}

function getLegalMoves(state, pawnIdx) {
  const me = state.pawns[pawnIdx];
  const other = state.pawns[1 - pawnIdx];
  const moves = [];
  const directions = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ];
  for (const [dr, dc] of directions) {
    const nr = me.r + dr;
    const nc = me.c + dc;
    if (!inBounds(nr, nc)) continue;
    if (edgeBlocked(state.walls, { r: me.r, c: me.c }, { r: nr, c: nc })) continue;
    if (other.r === nr && other.c === nc) {
      const jr = nr + dr;
      const jc = nc + dc;
      if (inBounds(jr, jc) && !edgeBlocked(state.walls, { r: nr, c: nc }, { r: jr, c: jc })) {
        moves.push({ r: jr, c: jc });
      } else {
        const perps = dr !== 0 ? [[0, -1], [0, 1]] : [[-1, 0], [1, 0]];
        for (const [pdr, pdc] of perps) {
          const dr2 = nr + pdr;
          const dc2 = nc + pdc;
          if (inBounds(dr2, dc2) && !edgeBlocked(state.walls, { r: nr, c: nc }, { r: dr2, c: dc2 })) {
            moves.push({ r: dr2, c: dc2 });
          }
        }
      }
    } else {
      moves.push({ r: nr, c: nc });
    }
  }
  return moves;
}

function hasPathToGoal(walls, start, goalRow) {
  const seen = new Set();
  const key = (r, c) => `${r},${c}`;
  const queue = [start];
  seen.add(key(start.r, start.c));
  while (queue.length) {
    const cur = queue.shift();
    if (cur.r === goalRow) return true;
    const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    for (const [dr, dc] of dirs) {
      const nr = cur.r + dr;
      const nc = cur.c + dc;
      if (!inBounds(nr, nc)) continue;
      if (seen.has(key(nr, nc))) continue;
      if (edgeBlocked(walls, cur, { r: nr, c: nc })) continue;
      seen.add(key(nr, nc));
      queue.push({ r: nr, c: nc });
    }
  }
  return false;
}

function wallsOverlap(a, b) {
  if (a.o !== b.o) {
    return a.o === 'h' ? a.r === b.r && a.c === b.c : a.r === b.r && a.c === b.c;
  }
  if (a.o === 'h') return a.r === b.r && Math.abs(a.c - b.c) < 2;
  return a.c === b.c && Math.abs(a.r - b.r) < 2;
}

function canPlaceWall(state, wall) {
  if (wall.r < 0 || wall.r > SIZE - 2 || wall.c < 0 || wall.c > SIZE - 2) return false;
  for (const w of state.walls) {
    if (wallsOverlap(w, wall)) return false;
    if (w.o !== wall.o && w.r === wall.r && w.c === wall.c) return false;
  }
  const nextWalls = [...state.walls, wall];
  for (let i = 0; i < 2; i++) {
    const p = state.pawns[i];
    if (!hasPathToGoal(nextWalls, { r: p.r, c: p.c }, p.goal)) return false;
  }
  return true;
}

const AI_PLAYER = 1;

function bfsDistance(walls, from, goalRow) {
  const seen = new Set();
  const queue = [{ r: from.r, c: from.c, d: 0 }];
  seen.add(`${from.r},${from.c}`);
  while (queue.length) {
    const cur = queue.shift();
    if (cur.r === goalRow) return cur.d;
    for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const nr = cur.r + dr;
      const nc = cur.c + dc;
      if (!inBounds(nr, nc)) continue;
      if (edgeBlocked(walls, cur, { r: nr, c: nc })) continue;
      const k = `${nr},${nc}`;
      if (seen.has(k)) continue;
      seen.add(k);
      queue.push({ r: nr, c: nc, d: cur.d + 1 });
    }
  }
  return 999;
}

function bfsPath(walls, from, goalRow) {
  const seen = new Map();
  const queue = [from];
  seen.set(`${from.r},${from.c}`, null);
  while (queue.length) {
    const cur = queue.shift();
    if (cur.r === goalRow) {
      const path = [];
      let c = cur;
      while (c) { path.push(c); c = seen.get(`${c.r},${c.c}`); }
      return path.reverse();
    }
    for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const nr = cur.r + dr;
      const nc = cur.c + dc;
      if (!inBounds(nr, nc)) continue;
      if (edgeBlocked(walls, cur, { r: nr, c: nc })) continue;
      const k = `${nr},${nc}`;
      if (seen.has(k)) continue;
      seen.set(k, cur);
      queue.push({ r: nr, c: nc });
    }
  }
  return [];
}

function wbEval(state) {
  const d0 = bfsDistance(state.walls, state.pawns[0], state.pawns[0].goal);
  const d1 = bfsDistance(state.walls, state.pawns[1], state.pawns[1].goal);
  return d0 - d1;
}

function wallCandidates(state, forPlayer) {
  if (state.wallsLeft[forPlayer] <= 0) return [];
  const opp = state.pawns[1 - forPlayer];
  const path = bfsPath(state.walls, opp, opp.goal);
  const seen = new Set();
  const result = [];
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i];
    const b = path[i + 1];
    const dr = b.r - a.r;
    const dc = b.c - a.c;
    let wallsForEdge = [];
    if (dr === 1) wallsForEdge = [{ r: a.r, c: a.c, o: 'h' }, { r: a.r, c: a.c - 1, o: 'h' }];
    else if (dr === -1) wallsForEdge = [{ r: a.r - 1, c: a.c, o: 'h' }, { r: a.r - 1, c: a.c - 1, o: 'h' }];
    else if (dc === 1) wallsForEdge = [{ r: a.r, c: a.c, o: 'v' }, { r: a.r - 1, c: a.c, o: 'v' }];
    else if (dc === -1) wallsForEdge = [{ r: a.r, c: a.c - 1, o: 'v' }, { r: a.r - 1, c: a.c - 1, o: 'v' }];
    for (const w of wallsForEdge) {
      const k = `${w.r},${w.c},${w.o}`;
      if (seen.has(k)) continue;
      seen.add(k);
      if (canPlaceWall(state, w)) result.push(w);
    }
  }
  return result;
}

function applyMove(state, player, dest) {
  const pawns = state.pawns.map((p, i) => (i === player ? { ...p, r: dest.r, c: dest.c } : p));
  const winner = dest.r === state.pawns[player].goal ? player : null;
  return { ...state, pawns, turn: 1 - player, winner };
}

function applyWall(state, player, wall) {
  const walls = [...state.walls, wall];
  const wallsLeft = state.wallsLeft.slice();
  wallsLeft[player] -= 1;
  return { ...state, walls, wallsLeft, turn: 1 - player };
}

function wbMinimax(state, depth, alpha, beta, maxPlayer) {
  if (depth === 0 || state.winner !== null) return wbEval(state);
  const player = state.turn;
  const isMax = player === maxPlayer;
  const moves = getLegalMoves(state, player);
  const walls = wallCandidates(state, player);

  if (isMax) {
    let best = -Infinity;
    for (const m of moves) {
      const ns = applyMove(state, player, m);
      const v = wbMinimax(ns, depth - 1, alpha, beta, maxPlayer);
      if (v > best) best = v;
      if (best > alpha) alpha = best;
      if (beta <= alpha) break;
    }
    for (const w of walls) {
      const ns = applyWall(state, player, w);
      const v = wbMinimax(ns, depth - 1, alpha, beta, maxPlayer);
      if (v > best) best = v;
      if (best > alpha) alpha = best;
      if (beta <= alpha) break;
    }
    return best;
  } else {
    let best = Infinity;
    for (const m of moves) {
      const ns = applyMove(state, player, m);
      const v = wbMinimax(ns, depth - 1, alpha, beta, maxPlayer);
      if (v < best) best = v;
      if (best < beta) beta = best;
      if (beta <= alpha) break;
    }
    for (const w of walls) {
      const ns = applyWall(state, player, w);
      const v = wbMinimax(ns, depth - 1, alpha, beta, maxPlayer);
      if (v < best) best = v;
      if (best < beta) beta = best;
      if (beta <= alpha) break;
    }
    return best;
  }
}

function pickWbAiMove(state) {
  const moves = getLegalMoves(state, AI_PLAYER);
  const walls = wallCandidates(state, AI_PLAYER);
  let bestAction = null;
  let bestScore = -Infinity;
  let alpha = -Infinity;
  const beta = Infinity;
  const depth = 3;

  for (const m of moves) {
    const ns = applyMove(state, AI_PLAYER, m);
    if (ns.winner === AI_PLAYER) return { type: 'move', dest: m };
    const v = wbMinimax(ns, depth - 1, alpha, beta, AI_PLAYER);
    if (v > bestScore) { bestScore = v; bestAction = { type: 'move', dest: m }; }
    if (v > alpha) alpha = v;
  }
  for (const w of walls) {
    const ns = applyWall(state, AI_PLAYER, w);
    const v = wbMinimax(ns, depth - 1, alpha, beta, AI_PLAYER);
    if (v > bestScore) { bestScore = v; bestAction = { type: 'wall', wall: w }; }
    if (v > alpha) alpha = v;
  }
  return bestAction;
}

export default function Wallbreak() {
  const [state, setState] = useState(initialState);
  const [hoverWall, setHoverWall] = useState(null);
  const [aiMode, setAiMode] = useState(true);
  const [aiThinking, setAiThinking] = useState(false);
  const aiTimeout = useRef(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.__setGameState = (s) => setState((prev) => ({ ...prev, ...s }));
    }
    return () => { if (typeof window !== 'undefined') delete window.__setGameState; };
  }, []);

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'w' || e.key === 'W') {
        setState((s) => ({ ...s, mode: s.mode === 'move' ? 'wall' : 'move' }));
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (aiMode && state.turn === AI_PLAYER && !state.winner && !aiThinking) {
      setAiThinking(true);
      aiTimeout.current = setTimeout(() => {
        const action = pickWbAiMove(state);
        setAiThinking(false);
        if (!action) return;
        if (action.type === 'move') {
          const pawns = state.pawns.map((p, i) =>
            i === AI_PLAYER ? { ...p, r: action.dest.r, c: action.dest.c } : p
          );
          const winner = action.dest.r === state.pawns[AI_PLAYER].goal ? AI_PLAYER : null;
          setState((s) => ({ ...s, pawns, turn: 0, winner }));
        } else {
          const walls = [...state.walls, action.wall];
          const wallsLeft = state.wallsLeft.slice();
          wallsLeft[AI_PLAYER] -= 1;
          setState((s) => ({ ...s, walls, wallsLeft, turn: 0 }));
        }
      }, 300);
    }
    return () => { if (aiTimeout.current) clearTimeout(aiTimeout.current); };
  }, [state.turn, state.winner, aiMode, aiThinking]);

  const isHumanTurn = !aiMode || state.turn !== AI_PLAYER;
  const legalMoves = state.winner || !isHumanTurn ? [] : getLegalMoves(state, state.turn);
  const legalSet = new Set(legalMoves.map((m) => `${m.r},${m.c}`));

  function doMove(r, c) {
    if (state.winner || !isHumanTurn) return;
    if (!legalSet.has(`${r},${c}`)) return;
    const pawns = state.pawns.map((p, i) => (i === state.turn ? { ...p, r, c } : p));
    const winner = pawns[state.turn].r === pawns[state.turn].goal ? state.turn : null;
    setState({ ...state, pawns, turn: 1 - state.turn, winner });
  }

  function doPlaceWall() {
    if (!hoverWall || state.winner || !isHumanTurn) return;
    if (state.wallsLeft[state.turn] <= 0) return;
    if (!canPlaceWall(state, hoverWall)) return;
    const walls = [...state.walls, hoverWall];
    const wallsLeft = state.wallsLeft.slice();
    wallsLeft[state.turn] -= 1;
    setState({ ...state, walls, wallsLeft, turn: 1 - state.turn });
    setHoverWall(null);
  }

  function restart() {
    setState(initialState());
    setAiThinking(false);
    if (aiTimeout.current) clearTimeout(aiTimeout.current);
  }

  function toggleAi(on) {
    setAiMode(on);
    restart();
  }

  const boardSize = SIZE * CELL + (SIZE - 1) * GAP + 16;

  function cellX(c) { return 8 + c * (CELL + GAP); }
  function cellY(r) { return 8 + r * (CELL + GAP); }

  function handleBoardMove(e) {
    if (state.mode !== 'wall' || state.winner) return;
    const svg = e.currentTarget;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const { x, y } = pt.matrixTransform(svg.getScreenCTM().inverse());

    const col = (x - 8) / (CELL + GAP);
    const row = (y - 8) / (CELL + GAP);
    const fracC = col - Math.floor(col);
    const fracR = row - Math.floor(row);
    const nearV = Math.abs(fracC - 1) < 0.25;
    const nearH = Math.abs(fracR - 1) < 0.25;

    if (nearH && !nearV) {
      const r = Math.floor(row);
      const c = Math.max(0, Math.min(SIZE - 2, Math.floor(col)));
      setHoverWall({ r, c, o: 'h' });
    } else if (nearV && !nearH) {
      const r = Math.max(0, Math.min(SIZE - 2, Math.floor(row)));
      const c = Math.floor(col);
      setHoverWall({ r, c, o: 'v' });
    } else {
      setHoverWall(null);
    }
  }

  function renderWall(w, cls) {
    if (w.o === 'h') {
      const x1 = cellX(w.c);
      const x2 = cellX(w.c + 1) + CELL;
      const y = cellY(w.r) + CELL + GAP / 2;
      return <line key={`${w.o}-${w.r}-${w.c}-${cls}`} x1={x1} y1={y} x2={x2} y2={y} className={`wb-wall ${cls}`} />;
    }
    const y1 = cellY(w.r);
    const y2 = cellY(w.r + 1) + CELL;
    const x = cellX(w.c) + CELL + GAP / 2;
    return <line key={`${w.o}-${w.r}-${w.c}-${cls}`} x1={x} y1={y1} x2={x} y2={y2} className={`wb-wall ${cls}`} />;
  }

  return (
    <GamesShell title="wallbreak">
      <h1>Wallbreak</h1>
      <p className="games-intro">2-player pawn race on a 9×9 board. Player 1 starts at the top, player 2 at the bottom. First to reach the other side wins.</p>
      <div className="games-rules">
        <strong>How to play</strong>
        <ul>
          <li>On your turn, you can <strong>move your pawn</strong> one step (orthogonally) or <strong>place a wall</strong> to slow your opponent.</li>
          <li>Walls are two cells long and sit between cells — click to place in wall mode. You get <strong>10 walls per game</strong>.</li>
          <li>A wall is illegal if it would leave either player with no path to their goal row.</li>
          <li>If your pawn is adjacent to the opponent, you can <strong>jump over</strong> them (or diagonally around if the hop is blocked).</li>
          <li>Toggle between move and wall mode with the buttons below or by pressing <strong>W</strong>.</li>
        </ul>
      </div>
      <div className="games-nav" style={{ marginBottom: 14 }}>
        <button className={`games-btn ${aiMode ? 'active' : ''}`} onClick={() => toggleAi(true)}>vs computer</button>
        <button className={`games-btn ${!aiMode ? 'active' : ''}`} onClick={() => toggleAi(false)}>2 players</button>
        <span style={{ color: 'var(--border)' }}>|</span>
        <button
          className={`games-btn ${state.mode === 'move' ? 'active' : ''}`}
          onClick={() => setState((s) => ({ ...s, mode: 'move' }))}
          data-testid="mode-move"
        >move</button>
        <button
          className={`games-btn ${state.mode === 'wall' ? 'active' : ''}`}
          onClick={() => setState((s) => ({ ...s, mode: 'wall' }))}
          data-testid="mode-wall"
        >wall (w)</button>
        <button className="games-btn" onClick={restart} data-testid="reset-btn">restart</button>
      </div>

      <div className="wb-layout">
        <div className="wb-board-wrap">
          <svg
            className="wb-svg"
            width={boardSize}
            height={boardSize}
            viewBox={`0 0 ${boardSize} ${boardSize}`}
            onMouseMove={handleBoardMove}
            onMouseLeave={() => setHoverWall(null)}
            onClick={() => { if (state.mode === 'wall') doPlaceWall(); }}
            data-testid="wb-board"
          >
            {Array.from({ length: SIZE }).map((_, r) =>
              Array.from({ length: SIZE }).map((_, c) => {
                const isMoveTarget = state.mode === 'move' && legalSet.has(`${r},${c}`);
                const cls = `wb-cell ${isMoveTarget ? 'valid-move' : ''}`;
                return (
                  <rect
                    key={`c-${r}-${c}`}
                    x={cellX(c)}
                    y={cellY(r)}
                    width={CELL}
                    height={CELL}
                    className={cls}
                    onClick={(e) => { if (state.mode === 'move') { e.stopPropagation(); doMove(r, c); } }}
                    data-testid={`wb-cell-${r}-${c}`}
                  />
                );
              })
            )}

            {state.walls.map((w) => renderWall(w, 'placed'))}
            {hoverWall && state.mode === 'wall' && state.wallsLeft[state.turn] > 0 && (
              renderWall(hoverWall, canPlaceWall(state, hoverWall) ? 'preview' : 'invalid')
            )}

            <circle
              cx={cellX(state.pawns[0].c) + CELL / 2}
              cy={cellY(state.pawns[0].r) + CELL / 2}
              r={CELL / 3}
              className="wb-pawn-p1"
              data-testid="pawn-0"
            />
            <rect
              x={cellX(state.pawns[1].c) + CELL / 4}
              y={cellY(state.pawns[1].r) + CELL / 4}
              width={CELL / 2}
              height={CELL / 2}
              transform={`rotate(45 ${cellX(state.pawns[1].c) + CELL / 2} ${cellY(state.pawns[1].r) + CELL / 2})`}
              className="wb-pawn-p2"
              data-testid="pawn-1"
            />
          </svg>
        </div>

        <div>
          <div className="games-panel" style={{ marginBottom: 12 }}>
            <div className="games-label">Turn</div>
            <div className={`games-value ${state.turn === 1 ? 'accent' : ''}`}>
              {aiMode
                ? state.turn === 0
                  ? 'your turn'
                  : aiThinking
                  ? 'thinking…'
                  : 'computer'
                : `player ${state.turn + 1}`}
            </div>
          </div>
          <div className="games-panel" style={{ marginBottom: 12 }}>
            <div className="games-label">Walls left</div>
            <div className="games-value">Player 1 · {state.wallsLeft[0]}</div>
            <div className="games-value accent">Player 2 · {state.wallsLeft[1]}</div>
          </div>
          <div className="games-panel">
            <div className="games-label">Mode</div>
            <div className="games-value">{state.mode}</div>
            <div style={{ color: 'var(--muted)', marginTop: 6, fontSize: 12 }}>press W to toggle</div>
          </div>

          {state.winner !== null && (
            <div className="games-win-banner" data-testid="win-banner">
              Player {state.winner + 1} wins
            </div>
          )}
        </div>
      </div>
    </GamesShell>
  );
}
