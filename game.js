'use strict';

// ═══════════════════════════════════════════════════════════════════════════════
//  CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const ROWS = 6, COLS = 7;
const RED = 1, YELLOW = 2, EMPTY = 0;

// Center-first column order for alpha-beta pruning (0-indexed)
const COL_ORDER = [3, 2, 4, 1, 5, 0, 6];

// ═══════════════════════════════════════════════════════════════════════════════
//  OPENING BOOK
//
//  Source: WeakC4 by 2swap (https://2swap.github.io/WeakC4/)
//  Keys = full game history string (1-indexed column chars).
//  Even-length key ⟹ Red's turn.
//  Value = [col_1indexed, "Variation name"]
//
//  The WeakC4 rep sequences encode: Red at even indices (0,2,4,…),
//  Yellow at odd indices (1,3,5,…).
// ═══════════════════════════════════════════════════════════════════════════════

const BOOK = {
  // ── Red's 1st move ──────────────────────────────────────────────────────────
  "":         [4, "Very Beginning"],

  // ── Red's 2nd move — responses to Yellow's 1st reply ───────────────────────
  "44":       [4, "Crown Variations"],
  "43":       [6, "436 Lines"],
  "46":       [2, "462 Lines"],
  "45":       [2, "Hills Opening"],
  "47":       [4, "47 Lines"],
  "41":       [4, "Hills Opening"],
  "42":       [3, "Hills Opening"],

  // ── Crown / Candlestick branch — Red's 3rd move (hist len=4) ───────────────
  "4444":     [4, "Crown Variations"],
  "4443":     [6, "3-2 / Hills Opening"],
  "4442":     [4, "D3-D4 Opening"],
  "4441":     [4, "D3-D4 Opening"],
  "4445":     [2, "Hills Opening"],
  "4446":     [3, "Hills Opening"],

  // ── Crown — Red's 4th move (hist len=6) ────────────────────────────────────
  "444444":   [5, "Crown — 6-1 Line"],      // rep "4444445"
  "444445":   [2, "Shoulder Spike"],         // rep "4444452x"
  "444442":   [2, "Candlesticks"],           // rep "444442222"
  "444446":   [6, "Half Candlesticks"],      // rep "444446622"
  "444443":   [6, "3-2 / Hills Opening"],
  "444367":   [3, "3-2 Lines"],              // rep "4443673"
  "444361":   [3, "3-2 Lines"],              // rep "4443613"
  "444365":   [5, "Hills Opening"],          // rep "4443655"

  // ── Candlestick — Red's 5th move (hist len=8) ──────────────────────────────
  "44444222": [2, "Half Candlesticks"],      // rep "444442222"
  "44444662": [2, "Half Candlesticks"],      // rep "444446622"

  // ── True Candlesticks — Red's 6th move (hist len=10) ───────────────────────
  "4444422226": [6, "True Candlesticks"],    // rep "44444222266"

  // ── 436-branch — Red's 3rd move (hist len=4) ───────────────────────────────
  "4363":     [4, "4363 Lines"],
  "4365":     [5, "Palm / Hills Opening"],   // rep "436556766"
  "4366":     [7, "Fist Variations"],        // rep "4366755535"
  "4367":     [6, "Two-bar Variations"],     // rep "436766" / "436761663"
  "4361":     [3, "Two-holes"],
  "4364":     [4, "Hills Opening"],          // rep "4364455"

  // ── 436-branch — Red's 4th move (hist len=6) ───────────────────────────────
  "436556":   [7, "Palm Variations"],        // rep "436556766"
  "436675":   [5, "Fist Variations"],        // rep "4366755535"
  "436761":   [6, "Bent Two-bar"],           // rep "436761663"
  "436445":   [5, "Hills Opening"],          // rep "4364455"

  // ── 436-branch — Red's 5th move (hist len=8) ───────────────────────────────
  "43655676": [6, "Palm Variations"],        // rep "436556766" R@pos8
  "43667555": [3, "Fist Variations"],        // rep "4366755535" R@pos8
  "43676166": [3, "Bent Two-bar"],           // rep "436761663" R@pos8

  // ── Cup Openings (462-branch) ───────────────────────────────────────────────
  "4621":     [3, "Cup Opening"],            // rep "46213xxx"
  "462135":   [2, "Cup Opening"],            // rep "46213522/23/524224"

  // ── Hills — 452-branch (45 → Red=2) ────────────────────────────────────────
  "4524":     [4, "Hills Opening"],          // rep "452443"
};

// ── Variation name — longest-prefix match ────────────────────────────────────
const VAR_PREFIXES = [
  ["Bent Two-bar",         "436761663"],
  ["Two-bar",              "436766"],
  ["Palm Variations",      "436556766"],
  ["Fist Variations",      "4366755535"],
  ["True Candlesticks",    "44444222266"],
  ["Half Candlesticks",    "444442222"],
  ["Half Candlesticks",    "444446622"],
  ["Shoulder Spike",       "44444521"],
  ["Shoulder Spike",       "44444524"],
  ["Crown — 6-1 Line",     "4444445"],
  ["Crown Variations",     "44444"],
  ["3-2 Lines",            "4443673"],
  ["3-2 Lines",            "4443613"],
  ["Hills Opening",        "4443655"],
  ["Hills Opening",        "4364455"],
  ["Hills Opening",        "452443"],
  ["Tall Cup Opening",     "46213524224"],
  ["Short Cup Opening",    "46213522"],
  ["No Cup Opening",       "46213523"],
  ["Cup Opening",          "4621"],
  ["D3-D4 Opening",        "4442"],
  ["D3-D4 Opening",        "4441"],
  ["3-2 / Hills Opening",  "4443"],
  ["Hills Opening",        "4365"],
  ["Hills Opening",        "4364"],
  ["Hills Opening",        "4524"],
  ["Fist Variations",      "4366"],
  ["Two-bar Variations",   "4367"],
  ["Two-holes",            "4361"],
  ["4363 Lines",           "4363"],
  ["47 Lines",             "47"],
  ["Hills Opening",        "45"],
  ["Hills Opening",        "41"],
  ["Hills Opening",        "42"],
  ["436 Lines",            "43"],
  ["462 Lines",            "46"],
  ["Crown Variations",     "44"],
  ["Very Beginning",       ""],
];

function varName(hist) {
  let best = "Very Beginning", bestLen = -1;
  for (const [name, prefix] of VAR_PREFIXES) {
    if (hist.startsWith(prefix) && prefix.length > bestLen) {
      best = name; bestLen = prefix.length;
    }
  }
  return best;
}

function bookMove(hist) {
  const e = BOOK[hist];
  return e ? { col: e[0] - 1, name: e[1] } : null;  // 0-indexed col
}

// ═══════════════════════════════════════════════════════════════════════════════
//  BOARD LOGIC
// ═══════════════════════════════════════════════════════════════════════════════

function makeBoard() {
  return Array.from({length: ROWS}, () => Array(COLS).fill(EMPTY));
}

function dropRow(b, col) {
  for (let r = 0; r < ROWS; r++) if (b[r][col] === EMPTY) return r;
  return -1;
}

function canPlay(b, col) {
  return col >= 0 && col < COLS && dropRow(b, col) !== -1;
}

function placed(b, col, player) {
  const nb = b.map(r => r.slice());
  const r = dropRow(nb, col);
  if (r === -1) return null;
  nb[r][col] = player;
  return nb;
}

function checkWin(b) {
  const DIRS = [[0,1],[1,0],[1,1],[1,-1]];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const p = b[r][c]; if (!p) continue;
      for (const [dr, dc] of DIRS) {
        const cells = [[r,c]];
        for (let i = 1; i < 4; i++) {
          const nr = r+dr*i, nc = c+dc*i;
          if (nr<0||nr>=ROWS||nc<0||nc>=COLS||b[nr][nc]!==p) break;
          cells.push([nr,nc]);
        }
        if (cells.length === 4) return { player: p, cells };
      }
    }
  }
  return null;
}

function isFull(b) {
  for (let c = 0; c < COLS; c++) if (b[ROWS-1][c] === EMPTY) return false;
  return true;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  MINIMAX  (depth-6 alpha-beta, center-first column order)
// ═══════════════════════════════════════════════════════════════════════════════

function scoreWin(w) {
  const r = w.filter(x=>x===RED).length;
  const y = w.filter(x=>x===YELLOW).length;
  if (r && y) return 0;
  if (r===4) return 100; if (r===3) return 5; if (r===2) return 2;
  if (y===4) return -100; if (y===3) return -5; if (y===2) return -2;
  return 0;
}

function evalBoard(b) {
  let s = 0;
  for (let r = 0; r < ROWS; r++) {
    s += b[r][3]===RED ? 4 : b[r][3]===YELLOW ? -4 : 0;
    s += (b[r][2]===RED||b[r][4]===RED) ? 1 : (b[r][2]===YELLOW||b[r][4]===YELLOW) ? -1 : 0;
  }
  for (let r=0;r<ROWS;r++)
    for (let c=0;c<=COLS-4;c++)
      s += scoreWin([b[r][c],b[r][c+1],b[r][c+2],b[r][c+3]]);
  for (let c=0;c<COLS;c++)
    for (let r=0;r<=ROWS-4;r++)
      s += scoreWin([b[r][c],b[r+1][c],b[r+2][c],b[r+3][c]]);
  for (let r=0;r<=ROWS-4;r++)
    for (let c=0;c<=COLS-4;c++)
      s += scoreWin([b[r][c],b[r+1][c+1],b[r+2][c+2],b[r+3][c+3]]);
  for (let r=3;r<ROWS;r++)
    for (let c=0;c<=COLS-4;c++)
      s += scoreWin([b[r][c],b[r-1][c+1],b[r-2][c+2],b[r-3][c+3]]);
  return s;
}

function minimax(b, depth, alpha, beta, isMax) {
  const win = checkWin(b);
  if (win) return win.player===RED ? 10000+depth : -10000-depth;
  if (isFull(b)||depth===0) return depth===0 ? evalBoard(b) : 0;
  if (isMax) {
    let best = -Infinity;
    for (const c of COL_ORDER) {
      if (!canPlay(b,c)) continue;
      best = Math.max(best, minimax(placed(b,c,RED), depth-1, alpha, beta, false));
      alpha = Math.max(alpha, best);
      if (beta <= alpha) break;
    }
    return best;
  } else {
    let best = Infinity;
    for (const c of COL_ORDER) {
      if (!canPlay(b,c)) continue;
      best = Math.min(best, minimax(placed(b,c,YELLOW), depth-1, alpha, beta, true));
      beta = Math.min(beta, best);
      if (beta <= alpha) break;
    }
    return best;
  }
}

function bestMove(b, player, depth=6) {
  const isMax = player===RED;
  let bestScore = isMax ? -Infinity : Infinity;
  let bestCol = COL_ORDER.find(c => canPlay(b,c)) ?? 3;
  for (const c of COL_ORDER) {
    if (!canPlay(b,c)) continue;
    const score = minimax(placed(b,c,player), depth-1, -Infinity, Infinity, !isMax);
    if (isMax ? score > bestScore : score < bestScore) {
      bestScore = score; bestCol = c;
    }
  }
  return bestCol;
}

// Immediate win or block (O(n) scan, no recursion)
function tacticalMove(b, forPlayer) {
  for (const c of COL_ORDER) {
    if (!canPlay(b,c)) continue;
    if (checkWin(placed(b,c,forPlayer))) return c;
  }
  const opp = forPlayer===RED ? YELLOW : RED;
  for (const c of COL_ORDER) {
    if (!canPlay(b,c)) continue;
    if (checkWin(placed(b,c,opp))) return c;
  }
  return -1;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  SUGGESTION  (used internally for badge display + hint button)
// ═══════════════════════════════════════════════════════════════════════════════

function computeSuggestion() {
  if (gameOver || currentPlayer !== RED) return null;
  const tac = tacticalMove(board, RED);
  if (tac !== -1) return { col: tac, inBook: false, urgent: true };
  const bm = bookMove(history);
  if (bm && canPlay(board, bm.col)) return { col: bm.col, inBook: true };
  return { col: bestMove(board, RED, 6), inBook: false };
}

// ═══════════════════════════════════════════════════════════════════════════════
//  GAME STATE
// ═══════════════════════════════════════════════════════════════════════════════

let board, history, currentPlayer, gameOver, winner, winCells;
let isAnimating = false;
let suggestion = null;
let aiTimer = null;
let hintTimer = null;

function initState() {
  board = makeBoard();
  history = "";
  currentPlayer = RED;
  gameOver = false;
  winner = null;
  winCells = null;
  suggestion = null;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  DOM HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

const $      = id => document.getElementById(id);
const cellEl = (r, c) => document.querySelector(`.cell[data-r="${r}"][data-c="${c}"]`);

function clearHintFlash() {
  document.querySelectorAll('.col.hint-flash').forEach(el => el.classList.remove('hint-flash'));
  if (hintTimer) { clearTimeout(hintTimer); hintTimer = null; }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  BUILD BOARD DOM
// ═══════════════════════════════════════════════════════════════════════════════

function buildBoardDOM() {
  const boardEl = $('board');
  boardEl.innerHTML = '';
  for (let c = 0; c < COLS; c++) {
    const col = document.createElement('div');
    col.className = 'col'; col.dataset.c = c;
    for (let r = ROWS-1; r >= 0; r--) {
      const cell = document.createElement('div');
      cell.className = 'cell'; cell.dataset.r = r; cell.dataset.c = c;
      col.appendChild(cell);
    }
    boardEl.appendChild(col);
  }
  const nums = $('col-nums');
  nums.innerHTML = '';
  for (let c = 1; c <= COLS; c++) {
    const n = document.createElement('div');
    n.className = 'col-num'; n.textContent = c;
    nums.appendChild(n);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  RENDER  — pieces and win highlight only; NO ghost piece shown
// ═══════════════════════════════════════════════════════════════════════════════

function render() {
  document.querySelectorAll('.piece:not(.dropping)').forEach(el => el.remove());
  document.querySelectorAll('.cell').forEach(el => el.classList.remove('win-cell'));

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (!board[r][c]) continue;
      const el = cellEl(r, c); if (!el) continue;
      const p = document.createElement('div');
      p.className = `piece ${board[r][c]===RED ? 'red' : 'yellow'}`;
      el.appendChild(p);
    }
  }

  if (winCells) {
    for (const [r,c] of winCells.cells) {
      const el = cellEl(r,c); if (el) el.classList.add('win-cell');
    }
  }
  renderAnnotations();
  updatePriorityLegend();
}

// ═══════════════════════════════════════════════════════════════════════════════
//  STATUS UI
// ═══════════════════════════════════════════════════════════════════════════════

function updateStatus() {
  $('var-name').textContent = varName(history);
  const badge = $('badge'), pip = $('pip'), tt = $('turn-text');

  if (gameOver) {
    badge.className = 'badge gameover';
    badge.textContent = winner===RED ? 'Red Wins' : winner===YELLOW ? 'Yellow Wins' : 'Draw';
    pip.className = 'pip off';
    tt.textContent = winner===RED ? 'You win! 🏆' : winner===YELLOW ? 'AI wins!' : "It's a draw!";
    return;
  }

  if (currentPlayer === RED) {
    pip.className = 'pip red'; tt.textContent = 'Your turn — Red';
    if (!suggestion) {
      badge.className = 'badge thinking'; badge.textContent = 'Thinking…';
    } else if (suggestion.urgent) {
      badge.className = 'badge tactical'; badge.textContent = 'Tactical!';
    } else if (suggestion.inBook) {
      badge.className = 'badge in-book';  badge.textContent = 'In Book';
    } else {
      badge.className = 'badge engine';   badge.textContent = 'Engine';
    }
  } else {
    pip.className = 'pip yellow'; tt.textContent = 'AI thinking — Yellow';
    badge.className = 'badge thinking'; badge.textContent = 'Calculating…';
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  DROP ANIMATION  — piece flies as absolute child of #board
// ═══════════════════════════════════════════════════════════════════════════════

function animateDrop(col, row, player, cb) {
  const boardEl = $('board');
  const targetCell = cellEl(row, col);
  if (!targetCell) { cb(); return; }

  const boardRect = boardEl.getBoundingClientRect();
  const cellRect  = targetCell.getBoundingClientRect();
  const cellW = cellRect.width, cellH = cellRect.height;

  const finalLeft = cellRect.left - boardRect.left;
  const finalTop  = cellRect.top  - boardRect.top;
  const startTop  = -cellH - 4;

  const visualRow = ROWS - 1 - row;
  const dur = Math.round(110 + visualRow * 58);

  boardEl.style.position = 'relative';

  let done = false;
  const finish = () => {
    if (done) return; done = true;
    clearTimeout(guard);
    piece.remove();
    cb();
  };

  const piece = document.createElement('div');
  piece.className = `piece ${player===RED ? 'red' : 'yellow'} dropping`;
  piece.style.cssText = `
    width:${cellW}px; height:${cellH}px;
    left:${finalLeft}px;
    --drop-from:${startTop}px;
    --drop-to:${finalTop}px;
    --drop-dur:${dur}ms;
  `;
  boardEl.appendChild(piece);

  piece.addEventListener('animationend', finish, { once: true });
  const guard = setTimeout(finish, dur + 120);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  GAME FLOW — Human (Red)
// ═══════════════════════════════════════════════════════════════════════════════

function handleHumanMove(col) {
  if (lessonStep >= 0 || gameOver || isAnimating || currentPlayer !== RED) return;
  if (!canPlay(board, col)) return;

  clearHintFlash();
  isAnimating = true;
  const row = dropRow(board, col);

  animateDrop(col, row, RED, () => {
    board = placed(board, col, RED);
    history += String(col + 1);

    const win = checkWin(board);
    if (win) {
      winner = RED; winCells = win; gameOver = true;
      render(); updateStatus();
      $('msg').textContent = '🎉 You win! Red wins!';
      $('msg').className = 'red';
      isAnimating = false; return;
    }
    if (isFull(board)) {
      gameOver = true; render(); updateStatus();
      $('msg').textContent = "It's a draw!"; $('msg').className = 'draw';
      isAnimating = false; return;
    }

    currentPlayer = YELLOW;
    suggestion = null;
    render(); updateStatus();
    aiTimer = setTimeout(doAIMove, 420);
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
//  GAME FLOW — AI (Yellow)
// ═══════════════════════════════════════════════════════════════════════════════

function doAIMove() {
  if (gameOver || currentPlayer !== YELLOW) return;
  isAnimating = true;

  let col = tacticalMove(board, YELLOW);
  if (col === -1) col = bestMove(board, YELLOW, 6);

  const row = dropRow(board, col);
  animateDrop(col, row, YELLOW, () => {
    board = placed(board, col, YELLOW);
    history += String(col + 1);

    const win = checkWin(board);
    if (win) {
      winner = YELLOW; winCells = win; gameOver = true;
      render(); updateStatus();
      $('msg').textContent = 'Yellow wins! The AI wins!';
      $('msg').className = 'yellow';
      isAnimating = false; return;
    }
    if (isFull(board)) {
      gameOver = true; render(); updateStatus();
      $('msg').textContent = "It's a draw!"; $('msg').className = 'draw';
      isAnimating = false; return;
    }

    currentPlayer = RED;

    // Compute suggestion for badge + hint button.
    // If book move: instant. If engine: async to keep UI responsive.
    const bm = bookMove(history);
    if (bm && canPlay(board, bm.col)) {
      suggestion = { col: bm.col, inBook: true };
      render(); updateStatus();
      isAnimating = false;
    } else {
      suggestion = null;
      render(); updateStatus();   // shows "Thinking…" badge
      setTimeout(() => {
        suggestion = computeSuggestion();
        render(); updateStatus();
        isAnimating = false;
      }, 30);
    }
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
//  EVENTS
// ═══════════════════════════════════════════════════════════════════════════════

$('board').addEventListener('click', e => {
  const c = e.target.closest('.col')?.dataset?.c;
  if (c !== undefined) handleHumanMove(parseInt(c));
});

$('board').addEventListener('touchend', e => {
  e.preventDefault();
  const t = e.changedTouches[0];
  const el = document.elementFromPoint(t.clientX, t.clientY);
  const c = el?.closest?.('.col')?.dataset?.c;
  if (c !== undefined) handleHumanMove(parseInt(c));
}, { passive: false });

$('btn-new').addEventListener('click', () => {
  if (aiTimer)  clearTimeout(aiTimer);
  clearHintFlash();
  isAnimating = false;
  initState();
  buildBoardDOM();
  // Pre-compute first suggestion (always col 4) so badge shows "In Book"
  suggestion = { col: 3, inBook: true };
  render(); updateStatus();
  $('msg').textContent = ''; $('msg').className = '';
});

$('btn-hint').addEventListener('click', () => {
  if (gameOver || currentPlayer !== RED) return;

  // Ensure suggestion is available (may need engine compute first time)
  if (!suggestion) suggestion = computeSuggestion();
  if (!suggestion) return;

  clearHintFlash();

  const colEl = document.querySelector(`.col[data-c="${suggestion.col}"]`);
  if (!colEl) return;

  // Force reflow so the animation restarts cleanly if already active
  void colEl.offsetWidth;
  colEl.classList.add('hint-flash');
  hintTimer = setTimeout(() => {
    colEl.classList.remove('hint-flash');
    hintTimer = null;
  }, 1500);
});

// ═══════════════════════════════════════════════════════════════════════════════
//  SSD OVERLAY  — annotate empty cells with WeakC4 symbols
// ═══════════════════════════════════════════════════════════════════════════════

let ssdActive = false;

function cellAnn(b, r, c) {
  if (b[r][c] !== EMPTY) return null;
  let pos = 0, total = 0;
  for (let row = 0; row < ROWS; row++) {
    if (b[row][c] === EMPTY) { total++; if (row === r) pos = total; }
  }
  // pos 1 = bottom-most empty (playable next)
  if (pos === 1) {
    const nb1 = placed(b, c, RED);    if (nb1 && checkWin(nb1)) return 'win';
    const nb2 = placed(b, c, YELLOW); if (nb2 && checkWin(nb2)) return 'block';
  }
  if (pos % 2 === 0)                     return 'claimeven'; // Red's via claimeven
  if (pos === total && total % 2 === 1)  return 'claimodd';  // Red's via claimodd
  return null; // Yellow's cell in this column — no annotation
}

const ANN_SYM = { win: '!', block: '!', claimodd: '|', claimeven: '○' };

function renderAnnotations() {
  document.querySelectorAll('.ann').forEach(el => el.remove());
  if (!ssdActive) return;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const ann = cellAnn(board, r, c);
      if (!ann) continue;
      const el = cellEl(r, c); if (!el) continue;
      const div = document.createElement('div');
      div.className = `ann ann-${ann}`;
      div.textContent = ANN_SYM[ann] || '';
      el.appendChild(div);
    }
  }
}

function priorityNow(b) {
  for (let c = 0; c < COLS; c++) {
    if (!canPlay(b, c)) continue;
    if (checkWin(placed(b, c, RED)))    return 'win';
  }
  for (let c = 0; c < COLS; c++) {
    if (!canPlay(b, c)) continue;
    if (checkWin(placed(b, c, YELLOW))) return 'block';
  }
  if (suggestion?.urgent) return 'urgent';
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      const a = cellAnn(b, r, c);
      if (a === 'claimodd' || a === 'claimeven') return 'claim';
    }
  return 'equal';
}

function updatePriorityLegend() {
  if ($('priority-panel').hidden) return;
  const active = (gameOver || currentPlayer !== RED) ? null : priorityNow(board);
  document.querySelectorAll('.p-step').forEach(li =>
    li.classList.toggle('p-active', li.dataset.step === active));
}

// ═══════════════════════════════════════════════════════════════════════════════
//  CLAIMEVEN LESSON
// ═══════════════════════════════════════════════════════════════════════════════

const LESSON_DATA = [
  { col: 3, player: RED,
    text: "Red opens at the center (column 4). Column 4 now has 5 empty squares — ODD. All other columns have 6 — EVEN. Blue ○ marks cells Red can claim; the blue | marks Red's Claimodd cell at the very top of col 4." },
  { col: 2, player: YELLOW,
    text: "Yellow plays column 3 (6 empties — even). The annotations shift as one cell is filled. Notice how Red is about to mirror." },
  { col: 2, player: RED,
    text: "Red MIRRORS column 3 immediately. Red lands on position 2 from the bottom — an EVEN slot (○). That cell is now guaranteed for Red. Rule: wherever Yellow plays in an even column, Red follows in the same column." },
  { col: 4, player: YELLOW,
    text: "Yellow plays column 5." },
  { col: 4, player: RED,
    text: "Red mirrors column 5. Another even cell secured without any calculation." },
  { col: 1, player: YELLOW,
    text: "Yellow plays column 2." },
  { col: 1, player: RED,
    text: "Red mirrors column 2. Three pairs done. Red's guaranteed cells are quietly building multiple 4-in-a-row threats." },
  { col: 5, player: YELLOW,
    text: "Yellow plays column 6." },
  { col: 5, player: RED,
    text: "Red mirrors column 6. Red has claimed even cells in four columns. Yellow cannot block all the resulting threats simultaneously. Red wins — by following one simple rule." },
];

const LESSON_INTRO = "The Claimeven strategy lets Red win without any calculation. When a column has an EVEN number of empty squares, Red can guarantee the even-numbered cells (2nd, 4th, 6th from bottom) simply by mirroring Yellow's move in that column. The ○ symbols show cells Red owns; | shows Red's Claimodd cell. Step through to see it unfold.";

let lessonStep = -1, lessonBoards = null, lessonSaved = null;

function buildLessonBoards() {
  const boards = [makeBoard()];
  let b = makeBoard();
  for (const { col, player } of LESSON_DATA) {
    b = placed(b, col, player);
    boards.push(b);
  }
  return boards;
}

function openLesson() {
  if (aiTimer) { clearTimeout(aiTimer); aiTimer = null; }
  clearHintFlash();
  lessonSaved = { board, history, currentPlayer, gameOver, winner, winCells, suggestion, ssdActive };
  lessonBoards = buildLessonBoards();
  lessonStep = 0;
  ssdActive = true;
  gameOver = false; currentPlayer = RED;
  $('status-row').hidden = true;
  $('msg').hidden        = true;
  $('btns').hidden       = true;
  $('btn-lesson').hidden = true;
  $('lesson-ui').hidden  = false;
  $('priority-panel').hidden = false;
  updateLessonStep();
}

function closeLesson() {
  board         = lessonSaved.board;
  history       = lessonSaved.history;
  currentPlayer = lessonSaved.currentPlayer;
  gameOver      = lessonSaved.gameOver;
  winner        = lessonSaved.winner;
  winCells      = lessonSaved.winCells;
  suggestion    = lessonSaved.suggestion;
  ssdActive     = lessonSaved.ssdActive;
  lessonStep    = -1;
  $('status-row').hidden = false;
  $('msg').hidden        = false;
  $('btns').hidden       = false;
  $('btn-lesson').hidden = false;
  $('lesson-ui').hidden  = true;
  $('priority-panel').hidden = !ssdActive;
  $('btn-ssd').textContent   = `SSD: ${ssdActive ? 'ON' : 'OFF'}`;
  $('btn-ssd').classList.toggle('active', ssdActive);
  document.querySelectorAll('.col-num').forEach(el => el.classList.remove('col-num-active'));
  render(); updateStatus();
}

function updateLessonStep() {
  board = lessonBoards[lessonStep];

  $('lesson-text-box').textContent =
    lessonStep === 0 ? LESSON_INTRO : LESSON_DATA[lessonStep - 1].text;
  $('lesson-counter').textContent =
    lessonStep === 0 ? 'Introduction' : `Step ${lessonStep} of ${LESSON_DATA.length}`;

  $('lesson-prev').disabled = lessonStep === 0;
  const isLast = lessonStep === LESSON_DATA.length;
  $('lesson-next').textContent = isLast ? 'Done ✓' : 'Next →';

  const hCol = lessonStep > 0 ? LESSON_DATA[lessonStep - 1].col : null;
  document.querySelectorAll('.col-num').forEach((el, i) =>
    el.classList.toggle('col-num-active', i === hCol));

  render();
}

$('btn-ssd').addEventListener('click', () => {
  ssdActive = !ssdActive;
  $('btn-ssd').textContent = `SSD: ${ssdActive ? 'ON' : 'OFF'}`;
  $('btn-ssd').classList.toggle('active', ssdActive);
  $('priority-panel').hidden = !ssdActive;
  renderAnnotations(); updatePriorityLegend();
});

$('btn-lesson').addEventListener('click', openLesson);
$('lesson-close').addEventListener('click', closeLesson);
$('lesson-prev').addEventListener('click', () => {
  if (lessonStep > 0) { lessonStep--; updateLessonStep(); }
});
$('lesson-next').addEventListener('click', () => {
  if (lessonStep < LESSON_DATA.length) { lessonStep++; updateLessonStep(); }
  else closeLesson();
});

// ═══════════════════════════════════════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════════════════════════════════════

initState();
buildBoardDOM();
suggestion = { col: 3, inBook: true };   // col 4 (1-indexed) = index 3
render();
updateStatus();
