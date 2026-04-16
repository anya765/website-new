import { useEffect, useMemo, useRef, useState } from 'react';
import GamesShell from '../../components/GamesShell';

const DIRS = [
  [+1, 0],
  [+1, -1],
  [0, -1],
  [-1, 0],
  [-1, +1],
  [0, +1],
];

const PIECE_GLYPH = {
  QUEEN: '♛',
  SPIDER: '✶',
  GRASSHOPPER: 'Ȣ',
  ANT: '●',
  BEETLE: '◆',
};

const HAND = { QUEEN: 1, SPIDER: 2, GRASSHOPPER: 3, ANT: 3, BEETLE: 2 };

function key(q, r) { return `${q},${r}`; }
function fromKey(k) { const [q, r] = k.split(',').map(Number); return { q, r }; }

function neighbors(q, r) {
  return DIRS.map(([dq, dr]) => ({ q: q + dq, r: r + dr }));
}

function sharedNeighbors(a, b) {
  const aN = neighbors(a.q, a.r);
  const bN = neighbors(b.q, b.r);
  return aN.filter((n) => bN.some((m) => m.q === n.q && m.r === n.r));
}

function allOccupied(stacks) {
  return Object.keys(stacks).filter((k) => stacks[k].length > 0);
}

function topAt(stacks, k) {
  const s = stacks[k];
  return s && s.length ? s[s.length - 1] : null;
}

function isHiveConnected(stacks) {
  const occ = allOccupied(stacks);
  if (occ.length <= 1) return true;
  const seen = new Set([occ[0]]);
  const queue = [occ[0]];
  while (queue.length) {
    const k = queue.shift();
    const { q, r } = fromKey(k);
    for (const n of neighbors(q, r)) {
      const nk = key(n.q, n.r);
      if (stacks[nk] && stacks[nk].length && !seen.has(nk)) {
        seen.add(nk);
        queue.push(nk);
      }
    }
  }
  return seen.size === occ.length;
}

function canSlide(stacks, from, to) {
  const shared = sharedNeighbors(from, to);
  if (shared.length !== 2) return false;
  const blocked = shared.filter((s) => {
    const k = key(s.q, s.r);
    return stacks[k] && stacks[k].length > 0;
  });
  return blocked.length < 2;
}

function simulateRemove(stacks, k) {
  const next = { ...stacks };
  const stack = (next[k] || []).slice();
  stack.pop();
  if (stack.length === 0) delete next[k];
  else next[k] = stack;
  return next;
}

function simulateAdd(stacks, k, piece) {
  const next = { ...stacks };
  next[k] = [...(next[k] || []), piece];
  return next;
}

function emptyNeighborsOfHive(stacks) {
  const result = new Set();
  for (const k of allOccupied(stacks)) {
    const { q, r } = fromKey(k);
    for (const n of neighbors(q, r)) {
      const nk = key(n.q, n.r);
      if (!stacks[nk] || stacks[nk].length === 0) result.add(nk);
    }
  }
  return Array.from(result);
}

function placementCandidates(stacks, owner, isFirstEver) {
  const occ = allOccupied(stacks);
  if (occ.length === 0) return [key(0, 0)];
  if (occ.length === 1) {
    const onlyKey = occ[0];
    const { q, r } = fromKey(onlyKey);
    return neighbors(q, r).map((n) => key(n.q, n.r));
  }
  const candidates = new Set();
  for (const k of allOccupied(stacks)) {
    const top = topAt(stacks, k);
    if (!top || top.owner !== owner) continue;
    const { q, r } = fromKey(k);
    for (const n of neighbors(q, r)) {
      const nk = key(n.q, n.r);
      if (stacks[nk] && stacks[nk].length) continue;
      const adjToOpp = neighbors(n.q, n.r).some((nn) => {
        const nnk = key(nn.q, nn.r);
        const t = topAt(stacks, nnk);
        return t && t.owner !== owner;
      });
      if (!adjToOpp) candidates.add(nk);
    }
  }
  return Array.from(candidates);
}

function queenMoves(stacks, from) {
  const removed = simulateRemove(stacks, key(from.q, from.r));
  const result = [];
  for (const n of neighbors(from.q, from.r)) {
    const nk = key(n.q, n.r);
    if (removed[nk] && removed[nk].length) continue;
    if (!canSlide(removed, from, n)) continue;
    const added = simulateAdd(removed, nk, { __probe: true });
    if (!hasNeighborInHive(added, n, nk)) continue;
    if (!isHiveConnected(added)) continue;
    result.push(nk);
  }
  return result;
}

function hasNeighborInHive(stacks, hex, skipKey) {
  for (const n of neighbors(hex.q, hex.r)) {
    const nk = key(n.q, n.r);
    if (nk === skipKey) continue;
    if (stacks[nk] && stacks[nk].length > 0) {
      if (nk === skipKey) continue;
      return true;
    }
  }
  return false;
}

function antMoves(stacks, from) {
  const removed = simulateRemove(stacks, key(from.q, from.r));
  const visited = new Set([key(from.q, from.r)]);
  const result = new Set();
  const queue = [from];
  while (queue.length) {
    const cur = queue.shift();
    for (const n of neighbors(cur.q, cur.r)) {
      const nk = key(n.q, n.r);
      if (visited.has(nk)) continue;
      if (removed[nk] && removed[nk].length) continue;
      if (!canSlide(removed, cur, n)) continue;
      const anchored = neighbors(n.q, n.r).some((nn) => {
        const nnk = key(nn.q, nn.r);
        return nnk !== key(from.q, from.r) && removed[nnk] && removed[nnk].length;
      });
      if (!anchored) continue;
      visited.add(nk);
      result.add(nk);
      queue.push(n);
    }
  }
  return Array.from(result);
}

function spiderMoves(stacks, from) {
  const removed = simulateRemove(stacks, key(from.q, from.r));
  const result = new Set();
  function walk(cur, visited, depth) {
    if (depth === 3) { result.add(key(cur.q, cur.r)); return; }
    for (const n of neighbors(cur.q, cur.r)) {
      const nk = key(n.q, n.r);
      if (visited.has(nk)) continue;
      if (removed[nk] && removed[nk].length) continue;
      if (!canSlide(removed, cur, n)) continue;
      const anchored = neighbors(n.q, n.r).some((nn) => {
        const nnk = key(nn.q, nn.r);
        return nnk !== key(from.q, from.r) && removed[nnk] && removed[nnk].length;
      });
      if (!anchored) continue;
      const newVisited = new Set(visited);
      newVisited.add(nk);
      walk(n, newVisited, depth + 1);
    }
  }
  walk(from, new Set([key(from.q, from.r)]), 0);
  return Array.from(result);
}

function grasshopperMoves(stacks, from) {
  const result = [];
  for (const [dq, dr] of DIRS) {
    let q = from.q + dq;
    let r = from.r + dr;
    if (!(stacks[key(q, r)] && stacks[key(q, r)].length)) continue;
    while (stacks[key(q, r)] && stacks[key(q, r)].length) {
      q += dq; r += dr;
    }
    result.push(key(q, r));
  }
  return result;
}

function beetleMoves(stacks, from) {
  const result = [];
  for (const n of neighbors(from.q, from.r)) {
    const nk = key(n.q, n.r);
    const removed = simulateRemove(stacks, key(from.q, from.r));
    if (removed[nk] && removed[nk].length === 0) continue;
    const placed = simulateAdd(removed, nk, { __probe: true });
    if (!isHiveConnected(placed)) continue;
    result.push(nk);
  }
  return result;
}

function movesFor(stacks, from, piece) {
  switch (piece.type) {
    case 'QUEEN': return queenMoves(stacks, from);
    case 'ANT': return antMoves(stacks, from);
    case 'SPIDER': return spiderMoves(stacks, from);
    case 'GRASSHOPPER': return grasshopperMoves(stacks, from);
    case 'BEETLE': return beetleMoves(stacks, from);
    default: return [];
  }
}

function queenSurrounded(stacks, owner) {
  for (const k of allOccupied(stacks)) {
    const stack = stacks[k];
    const hasQueen = stack.some((p) => p.type === 'QUEEN' && p.owner === owner);
    if (!hasQueen) continue;
    const { q, r } = fromKey(k);
    const allN = neighbors(q, r).every((n) => {
      const nk = key(n.q, n.r);
      return stacks[nk] && stacks[nk].length > 0;
    });
    if (allN) return true;
  }
  return false;
}

function queenPlaced(stacks, owner) {
  for (const k of allOccupied(stacks)) {
    if (stacks[k].some((p) => p.type === 'QUEEN' && p.owner === owner)) return true;
  }
  return false;
}

function initialState() {
  return {
    stacks: {},
    hands: [{ ...HAND }, { ...HAND }],
    turn: 0,
    turnCount: [0, 0],
    winner: null,
  };
}

const SW_AI_PLAYER = 1;

function swEval(stacks, hands, turnCount, aiPlayer) {
  const opp = 1 - aiPlayer;
  let score = 0;
  for (const k of allOccupied(stacks)) {
    const stack = stacks[k];
    const hasAiQueen = stack.some((p) => p.type === 'QUEEN' && p.owner === aiPlayer);
    const hasOppQueen = stack.some((p) => p.type === 'QUEEN' && p.owner === opp);
    if (hasOppQueen) {
      const { q, r } = fromKey(k);
      const ns = neighbors(q, r);
      const filled = ns.filter((n) => stacks[key(n.q, n.r)] && stacks[key(n.q, n.r)].length > 0).length;
      score += filled * 150;
    }
    if (hasAiQueen) {
      const { q, r } = fromKey(k);
      const ns = neighbors(q, r);
      const filled = ns.filter((n) => stacks[key(n.q, n.r)] && stacks[key(n.q, n.r)].length > 0).length;
      score -= filled * 150;
    }
    const top = stack[stack.length - 1];
    if (top.owner === aiPlayer) score += 8;
    else score -= 8;
  }
  const aiHandTotal = Object.values(hands[aiPlayer]).reduce((a, b) => a + b, 0);
  const oppHandTotal = Object.values(hands[opp]).reduce((a, b) => a + b, 0);
  score -= aiHandTotal * 3;
  score += oppHandTotal * 3;
  return score;
}

function allSwMoves(stacks, hands, turnCount, player) {
  const actions = [];
  const isFirstEver = turnCount[0] + turnCount[1] === 0;
  const qForced = turnCount[player] >= 3 && !queenPlaced(stacks, player);
  const placeCandidates = placementCandidates(stacks, player, isFirstEver);
  for (const [type, count] of Object.entries(hands[player])) {
    if (count <= 0) continue;
    if (qForced && type !== 'QUEEN') continue;
    for (const pk of placeCandidates) {
      actions.push({ kind: 'place', type, hex: pk });
    }
  }
  if (queenPlaced(stacks, player)) {
    for (const k of allOccupied(stacks)) {
      const top = topAt(stacks, k);
      if (!top || top.owner !== player) continue;
      const from = fromKey(k);
      const removed = simulateRemove(stacks, k);
      if (!isHiveConnected(removed) && stacks[k].length === 1) continue;
      const dests = movesFor(stacks, from, top);
      for (const dest of dests) {
        actions.push({ kind: 'move', from: k, to: dest, piece: top });
      }
    }
  }
  return actions;
}

function applySwAction(stacks, hands, turnCount, player, action) {
  let nextStacks = { ...stacks };
  let nextHands = hands.map((h) => ({ ...h }));
  if (action.kind === 'place') {
    nextStacks = simulateAdd(nextStacks, action.hex, { type: action.type, owner: player });
    nextHands[player] = { ...nextHands[player], [action.type]: nextHands[player][action.type] - 1 };
  } else {
    const removed = simulateRemove(nextStacks, action.from);
    const piece = topAt(nextStacks, action.from);
    nextStacks = simulateAdd(removed, action.to, piece);
  }
  const nextTurnCount = turnCount.slice();
  nextTurnCount[player] += 1;
  return { stacks: nextStacks, hands: nextHands, turnCount: nextTurnCount };
}

function swMinimax(stacks, hands, turnCount, player, depth, alpha, beta, aiPlayer) {
  const p0S = queenSurrounded(stacks, 0);
  const p1S = queenSurrounded(stacks, 1);
  if (p0S && p1S) return 0;
  if (p0S) return aiPlayer === 1 ? 10000 : -10000;
  if (p1S) return aiPlayer === 0 ? 10000 : -10000;
  if (depth === 0) return swEval(stacks, hands, turnCount, aiPlayer);

  const actions = allSwMoves(stacks, hands, turnCount, player);
  if (actions.length === 0) return swEval(stacks, hands, turnCount, aiPlayer);

  const isMax = player === aiPlayer;
  if (isMax) {
    let best = -Infinity;
    for (const act of actions) {
      const ns = applySwAction(stacks, hands, turnCount, player, act);
      const v = swMinimax(ns.stacks, ns.hands, ns.turnCount, 1 - player, depth - 1, alpha, beta, aiPlayer);
      if (v > best) best = v;
      if (best > alpha) alpha = best;
      if (beta <= alpha) break;
    }
    return best;
  } else {
    let best = Infinity;
    for (const act of actions) {
      const ns = applySwAction(stacks, hands, turnCount, player, act);
      const v = swMinimax(ns.stacks, ns.hands, ns.turnCount, 1 - player, depth - 1, alpha, beta, aiPlayer);
      if (v < best) best = v;
      if (best < beta) beta = best;
      if (beta <= alpha) break;
    }
    return best;
  }
}

function pickSwAiMove(stacks, hands, turnCount) {
  const actions = allSwMoves(stacks, hands, turnCount, SW_AI_PLAYER);
  if (actions.length === 0) return null;
  const depth = actions.length > 40 ? 1 : 2;
  let best = null;
  let bestScore = -Infinity;
  let alpha = -Infinity;
  const beta = Infinity;
  for (const act of actions) {
    const ns = applySwAction(stacks, hands, turnCount, SW_AI_PLAYER, act);
    const p0S = queenSurrounded(ns.stacks, 0);
    if (p0S) return act;
    const v = swMinimax(ns.stacks, ns.hands, ns.turnCount, 0, depth - 1, alpha, beta, SW_AI_PLAYER);
    if (v > bestScore) { bestScore = v; best = act; }
    if (v > alpha) alpha = v;
  }
  return best;
}

function hexToPixel(q, r, size) {
  const x = size * 1.5 * q;
  const y = size * Math.sqrt(3) * (r + q / 2);
  return { x, y };
}

function hexPoints(cx, cy, size) {
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i;
    pts.push([cx + size * Math.cos(a), cy + size * Math.sin(a)]);
  }
  return pts.map((p) => p.join(',')).join(' ');
}

export default function Swarm() {
  const [state, setState] = useState(initialState);
  const [selectedPiece, setSelectedPiece] = useState(null);
  const [selectedHex, setSelectedHex] = useState(null);
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
    if (aiMode && state.turn === SW_AI_PLAYER && !state.winner && !aiThinking) {
      setAiThinking(true);
      aiTimeout.current = setTimeout(() => {
        const action = pickSwAiMove(state.stacks, state.hands, state.turnCount);
        setAiThinking(false);
        if (!action) return;
        setState((s) => {
          const ns = applySwAction(s.stacks, s.hands, s.turnCount, SW_AI_PLAYER, action);
          const p0S = queenSurrounded(ns.stacks, 0);
          const p1S = queenSurrounded(ns.stacks, 1);
          let winner = null;
          if (p0S && p1S) winner = 'draw';
          else if (p0S) winner = 1;
          else if (p1S) winner = 0;
          return { ...s, stacks: ns.stacks, hands: ns.hands, turnCount: ns.turnCount, turn: 0, winner };
        });
        setSelectedPiece(null);
        setSelectedHex(null);
      }, 400);
    }
    return () => { if (aiTimeout.current) clearTimeout(aiTimeout.current); };
  }, [state.turn, state.winner, aiMode, aiThinking]);

  const validPlacements = useMemo(() => {
    if (!selectedPiece || state.winner) return [];
    return placementCandidates(state.stacks, state.turn, state.turnCount[0] + state.turnCount[1] === 0);
  }, [selectedPiece, state]);

  const validMoves = useMemo(() => {
    if (!selectedHex || state.winner) return [];
    const k = key(selectedHex.q, selectedHex.r);
    const top = topAt(state.stacks, k);
    if (!top || top.owner !== state.turn) return [];
    if (!queenPlaced(state.stacks, state.turn)) return [];
    const removed = simulateRemove(state.stacks, k);
    if (!isHiveConnected(removed) && state.stacks[k].length === 1) return [];
    return movesFor(state.stacks, selectedHex, top);
  }, [selectedHex, state]);

  function endTurn(nextStacks) {
    const p0Surrounded = queenSurrounded(nextStacks, 0);
    const p1Surrounded = queenSurrounded(nextStacks, 1);
    let winner = null;
    if (p0Surrounded && p1Surrounded) winner = 'draw';
    else if (p0Surrounded) winner = 1;
    else if (p1Surrounded) winner = 0;

    const turnCount = state.turnCount.slice();
    turnCount[state.turn] += 1;
    setState((s) => ({
      ...s,
      stacks: nextStacks,
      turn: 1 - state.turn,
      turnCount,
      winner,
    }));
    setSelectedPiece(null);
    setSelectedHex(null);
  }

  function onTrayClick(type) {
    if (state.winner || aiThinking) return;
    if (aiMode && state.turn === SW_AI_PLAYER) return;
    if (state.hands[state.turn][type] <= 0) return;
    if (state.turnCount[state.turn] >= 3 && !queenPlaced(state.stacks, state.turn) && type !== 'QUEEN') return;
    setSelectedPiece(type);
    setSelectedHex(null);
  }

  function onHexClick(q, r) {
    if (state.winner || aiThinking) return;
    if (aiMode && state.turn === SW_AI_PLAYER) return;
    const k = key(q, r);
    if (selectedPiece) {
      if (!validPlacements.includes(k)) return;
      const nextStacks = simulateAdd(state.stacks, k, { type: selectedPiece, owner: state.turn });
      const hands = state.hands.map((h, i) =>
        i === state.turn ? { ...h, [selectedPiece]: h[selectedPiece] - 1 } : h
      );
      setState((s) => ({ ...s, hands }));
      endTurn(nextStacks);
      return;
    }
    const top = topAt(state.stacks, k);
    if (top && top.owner === state.turn) {
      setSelectedHex({ q, r });
      return;
    }
    if (selectedHex) {
      if (!validMoves.includes(k)) {
        setSelectedHex(null);
        return;
      }
      const removed = simulateRemove(state.stacks, key(selectedHex.q, selectedHex.r));
      const moved = topAt(state.stacks, key(selectedHex.q, selectedHex.r));
      const added = simulateAdd(removed, k, moved);
      endTurn(added);
    }
  }

  const hexSize = 28;
  const coords = allOccupied(state.stacks).map(fromKey);
  if (selectedPiece) validPlacements.forEach((k) => coords.push(fromKey(k)));
  if (coords.length === 0) coords.push({ q: 0, r: 0 });

  const pixels = coords.map((c) => hexToPixel(c.q, c.r, hexSize));
  const xs = pixels.map((p) => p.x);
  const ys = pixels.map((p) => p.y);
  const pad = hexSize * 3;
  const minX = Math.min(...xs) - pad;
  const minY = Math.min(...ys) - pad;
  const maxX = Math.max(...xs) + pad;
  const maxY = Math.max(...ys) + pad;
  const vbW = Math.max(maxX - minX, 400);
  const vbH = Math.max(maxY - minY, 400);

  const placementSet = new Set(validPlacements);
  const moveSet = new Set(validMoves);

  const allHexes = new Map();
  for (const k of allOccupied(state.stacks)) allHexes.set(k, fromKey(k));
  for (const k of placementSet) allHexes.set(k, fromKey(k));
  for (const k of moveSet) allHexes.set(k, fromKey(k));

  const queenForced = state.turnCount[state.turn] >= 3 && !queenPlaced(state.stacks, state.turn);

  return (
    <GamesShell title="swarm">
      <h1>Swarm</h1>
      <p className="games-intro">A 2-player hex strategy game. Each player has a set of insect pieces. You win by surrounding the opponent&apos;s queen on all six sides.</p>
      <div className="games-rules">
        <strong>How to play</strong>
        <ul>
          <li>On your turn, either <strong>place</strong> a new piece from your tray or <strong>move</strong> a piece already on the board.</li>
          <li>After your first turn, new placements must touch one of your own pieces and cannot touch an opponent&apos;s piece.</li>
          <li>You must place your <strong>queen by your fourth turn</strong>. You can&apos;t move any piece until your queen is on the board.</li>
          <li>Piece movement: <strong>queen</strong> slides 1, <strong>ant</strong> slides any distance, <strong>spider</strong> slides exactly 3, <strong>grasshopper</strong> jumps over pieces in a straight line, <strong>beetle</strong> moves 1 and can climb on top of another piece.</li>
          <li>You cannot move a piece if removing it would split the hive into disconnected groups (the &quot;one hive&quot; rule).</li>
          <li>First queen to be completely surrounded loses.</li>
        </ul>
      </div>
      <div className="games-nav" style={{ marginBottom: 14 }}>
        <button className={`games-btn ${aiMode ? 'active' : ''}`} onClick={() => { setAiMode(true); setState(initialState()); setAiThinking(false); }}>vs computer</button>
        <button className={`games-btn ${!aiMode ? 'active' : ''}`} onClick={() => { setAiMode(false); setState(initialState()); setAiThinking(false); }}>2 players</button>
        <button className="games-btn" onClick={() => { setState(initialState()); setAiThinking(false); if (aiTimeout.current) clearTimeout(aiTimeout.current); }} data-testid="reset-btn">restart</button>
      </div>

      <div className="sw-layout">
        <TrayPanel
          owner={0}
          hand={state.hands[0]}
          active={state.turn === 0}
          selected={state.turn === 0 ? selectedPiece : null}
          onPick={(t) => state.turn === 0 && onTrayClick(t)}
          queenForced={state.turn === 0 && queenForced}
        />

        <div className="sw-board-wrap" data-testid="sw-board">
          <svg width="100%" height="520" viewBox={`${minX} ${minY} ${vbW} ${vbH}`}>
            {[...allHexes.values()].map((h) => {
              const { x, y } = hexToPixel(h.q, h.r, hexSize);
              const k = key(h.q, h.r);
              const stack = state.stacks[k];
              const top = stack && stack[stack.length - 1];
              const isSelected = selectedHex && selectedHex.q === h.q && selectedHex.r === h.r;
              const isValid = placementSet.has(k) || moveSet.has(k);
              const fill = top
                ? top.owner === 0
                  ? '#f4f4f0'
                  : '#fdf0da'
                : isValid
                ? '#fff5e6'
                : '#fcfcfc';
              const stroke = isValid ? '#d98824' : isSelected ? '#d98824' : '#444444';
              return (
                <g
                  key={k}
                  onClick={() => onHexClick(h.q, h.r)}
                  className={`sw-hex ${isValid ? 'valid' : ''} ${isSelected ? 'selected' : ''}`}
                  data-testid={`sw-hex-${h.q}-${h.r}`}
                >
                  <polygon
                    points={hexPoints(x, y, hexSize)}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={isValid || isSelected ? 2.5 : 1.5}
                  />
                  {top && (
                    <text
                      x={x}
                      y={y + 7}
                      textAnchor="middle"
                      fontSize="20"
                      fill={top.owner === 0 ? '#444444' : '#d98824'}
                      fontFamily="Inter, sans-serif"
                      fontWeight="600"
                    >
                      {PIECE_GLYPH[top.type]}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        <TrayPanel
          owner={1}
          hand={state.hands[1]}
          active={state.turn === 1}
          selected={state.turn === 1 ? selectedPiece : null}
          onPick={(t) => state.turn === 1 && onTrayClick(t)}
          queenForced={state.turn === 1 && queenForced}
        />
      </div>

      <div className="games-panel" style={{ marginTop: 18 }}>
        <div className="games-label">Turn</div>
        <div className={`games-value ${state.turn === 1 ? 'accent' : ''}`}>
          {aiMode
            ? state.turn === 0
              ? 'your turn'
              : aiThinking
              ? 'thinking…'
              : 'computer'
            : `player ${state.turn + 1}`}
          {queenForced && <span style={{ marginLeft: 10, color: 'var(--error)' }}>queen must be placed!</span>}
        </div>
      </div>

      {state.winner !== null && (
        <div className="games-win-banner" data-testid="win-banner">
          {state.winner === 'draw' ? 'draw' : `Player ${state.winner + 1} wins`}
        </div>
      )}
    </GamesShell>
  );
}

function TrayPanel({ owner, hand, active, selected, onPick, queenForced }) {
  return (
    <div className="sw-tray" style={{ opacity: active ? 1 : 0.5 }}>
      <h3>{owner === 0 ? 'Player 1' : 'Player 2'}</h3>
      {Object.entries(HAND).map(([type]) => {
        const count = hand[type] || 0;
        const disabled = count === 0 || !active;
        return (
          <div
            key={type}
            className={`sw-tray-item ${selected === type ? 'selected' : ''} ${disabled ? 'empty' : ''}`}
            onClick={() => !disabled && onPick(type)}
            data-testid={`tray-${owner}-${type.toLowerCase()}`}
          >
            <span>{PIECE_GLYPH[type]} {type.toLowerCase()}</span>
            <span style={{ color: 'var(--amber)' }}>{count}</span>
          </div>
        );
      })}
      {queenForced && <div style={{ color: 'var(--red)', fontSize: 11, marginTop: 8 }}>queen must be placed this turn</div>}
    </div>
  );
}
