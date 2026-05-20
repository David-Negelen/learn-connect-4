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
//  TAB SWITCHING
// ═══════════════════════════════════════════════════════════════════════════════

function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('tab-active', b.dataset.tab === tab));
  document.querySelectorAll('.tab-pane').forEach(p => { p.hidden = p.id !== `tab-${tab}`; });
  if (tab === 'trainer') refreshTrainerSummary();
}
document.querySelectorAll('.tab-btn').forEach(btn =>
  btn.addEventListener('click', () => switchTab(btn.dataset.tab)));

// ═══════════════════════════════════════════════════════════════════════════════
//  PROGRESS STORAGE
// ═══════════════════════════════════════════════════════════════════════════════

function loadProgress() {
  try { return JSON.parse(localStorage.getItem('wc4-progress') || '{}'); } catch { return {}; }
}
function saveProgress(data) { localStorage.setItem('wc4-progress', JSON.stringify(data)); }
function recordResult(hist, correct) {
  const p = loadProgress();
  if (!p[hist]) p[hist] = { a: 0, c: 0 };
  p[hist].a++; if (correct) p[hist].c++;
  saveProgress(p);
}
function getAccuracy(hist) {
  const p = loadProgress()[hist];
  return p && p.a >= 1 ? Math.round(p.c / p.a * 100) : null;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  MEMORIZATION TRAINER
// ═══════════════════════════════════════════════════════════════════════════════

// All even-length BOOK keys are Red's turn — those are our drill positions.
const DRILL_POSITIONS = Object.entries(BOOK)
  .filter(([hist]) => hist.length % 2 === 0)
  .map(([hist, [col, name]]) => ({ hist, col: col - 1, name })) // 0-indexed col
  .sort((a, b) => a.hist.length - b.hist.length); // shorter (earlier) positions first

const MOVE_REASONS = {
  '':           "The center column connects to more potential 4-in-a-rows than any other — a core principle of Connect 4 strategy.",
  '44':         "Reinforcing the center builds maximum threat density and defines the Crown Variations main line.",
  '43':         "Column 6 prevents Yellow from getting symmetric control and launches the 436 structure.",
  '46':         "Column 2 mirrors the 436 response on the other side — entering the 462 / Cup Opening lines.",
  '45':         "Column 2 takes center-adjacent control and initiates the Hills Opening.",
  '47':         "Staying in column 4 maintains center dominance in the 47 Lines.",
  '41':         "Column 4 keeps the center despite Yellow's edge attempt in the Hills Opening.",
  '42':         "Column 3 starts building toward a miai pair between center and left.",
  '4444':       "A fourth center piece creates a tall crown structure with strong claimeven implications.",
  '4443':       "Column 6 keeps Red's threat network alive while preventing Yellow's left-side expansion.",
  '4442':       "Column 4 maintains center pressure in the D3-D4 Opening.",
  '4441':       "Column 4 responds to Yellow's far-left play by deepening the center stack.",
  '4445':       "Column 2 establishes a miai pair on either side of the central crown.",
  '4446':       "Column 3 sets up the Hills Opening counter to Yellow's near-right play.",
  '444444':     "Column 5 continues the Crown 6-1 line — the most forcing branch of the Crown.",
  '444445':     "Column 2 launches the Shoulder Spike — an aggressive forcing sequence.",
  '444442':     "Column 2 enters the Candlesticks — a deep positional line with strong claimeven control.",
  '444446':     "Column 6 enters the Half Candlesticks, exploiting Yellow's column-6 commitment.",
  '444443':     "Column 6 transposes into the 3-2 / Hills line — a dual-threat setup.",
  '4363':       "Column 4 is the book move keeping Red's threat network intact in the 4363 Lines.",
  '4621':       "Column 3 sets up the Cup Opening, targeting the miai pair on columns 2-4.",
  '4524':       "Column 4 maintains the Hills Opening structure after Yellow's early column-5 play.",
};

function getMoveReason(hist, col) {
  const r = MOVE_REASONS[hist];
  if (r) return r;
  const entry = BOOK[hist];
  return entry
    ? `Book move for the ${entry[1]} — memorizing this branch eliminates the need to calculate here.`
    : 'This is the engine-recommended move for this position.';
}

function boardFromHistory(hist) {
  let b = makeBoard();
  for (let i = 0; i < hist.length; i++) {
    const c = parseInt(hist[i]) - 1;
    b = placed(b, c, i % 2 === 0 ? RED : YELLOW) || b;
  }
  return b;
}

// ── Drill board DOM ──────────────────────────────────────────────────────────

function buildDrillBoard() {
  const boardEl  = document.getElementById('drill-board');
  const numsEl   = document.getElementById('drill-col-nums');
  boardEl.innerHTML = ''; numsEl.innerHTML = '';
  for (let c = 0; c < COLS; c++) {
    const col = document.createElement('div');
    col.className = 'dcol'; col.dataset.c = c;
    for (let r = ROWS - 1; r >= 0; r--) {
      const cell = document.createElement('div');
      cell.className = 'dc'; cell.dataset.r = r; cell.dataset.c = c;
      col.appendChild(cell);
    }
    boardEl.appendChild(col);
    const n = document.createElement('div');
    n.className = 'dcn'; n.textContent = c + 1; n.dataset.c = c;
    numsEl.appendChild(n);
  }
}

function renderDrillBoard(b) {
  document.querySelectorAll('#drill-board .dc').forEach(el => {
    const r = +el.dataset.r, c = +el.dataset.c;
    el.className = 'dc';
    if (b[r][c] === RED)    el.classList.add('red');
    if (b[r][c] === YELLOW) el.classList.add('yellow');
  });
  // Clear column highlights
  document.querySelectorAll('.dcol').forEach(el => el.className = 'dcol');
  document.querySelectorAll('.dcn').forEach(el => el.className = 'dcn');
}

// ── Drill state ──────────────────────────────────────────────────────────────

let drillQueue = [], drillIdx = 0, drillCorrect = 0, drillAnswered = false;

function buildDrillQueue() {
  const progress = loadProgress();
  // Prioritise: unseen first, then by lowest accuracy, then shuffle within tiers
  const shuffle = arr => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.random() * (i+1) | 0; [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };
  const unseen   = shuffle(DRILL_POSITIONS.filter(p => !progress[p.hist]));
  const needWork = shuffle(DRILL_POSITIONS.filter(p => { const d = progress[p.hist]; return d && d.a >= 1 && d.c/d.a < 0.8; }));
  const mastered = shuffle(DRILL_POSITIONS.filter(p => { const d = progress[p.hist]; return d && d.a >= 1 && d.c/d.a >= 0.8; }));
  return [...unseen, ...needWork, ...mastered].slice(0, 20); // cap at 20 per session
}

function startDrill() {
  drillQueue = buildDrillQueue();
  if (!drillQueue.length) return;
  drillIdx = 0; drillCorrect = 0;
  document.getElementById('trainer-summary').hidden = true;
  document.getElementById('btn-start-drill').hidden = true;
  document.getElementById('drill-wrap').hidden = false;
  showDrillCard();
}

function showDrillCard() {
  drillAnswered = false;
  const pos = drillQueue[drillIdx];
  const b   = boardFromHistory(pos.hist);

  document.getElementById('drill-variation').textContent = pos.name;
  document.getElementById('drill-question').textContent  = "What is Red's best move?";
  document.getElementById('drill-feedback').hidden = true;
  document.getElementById('drill-feedback').className   = 'drill-feedback';
  document.getElementById('drill-progress-text').textContent =
    `Card ${drillIdx + 1} of ${drillQueue.length} · Session: ${drillCorrect}/${drillIdx} correct`;

  renderDrillBoard(b);
}

function submitDrillAnswer(col) {
  if (drillAnswered) return;
  drillAnswered = true;
  const pos   = drillQueue[drillIdx];
  const right = col === pos.col;
  if (right) drillCorrect++;
  recordResult(pos.hist, right);

  // Visual feedback on columns
  const colEls = document.querySelectorAll('.dcol');
  colEls[col].classList.add(right ? 'drill-correct' : 'drill-wrong');
  if (!right) {
    colEls[pos.col].classList.add('drill-answer');
    document.querySelectorAll('.dcn')[pos.col].classList.add('drill-answer-num');
  }

  const fb = document.getElementById('drill-feedback');
  fb.hidden = false;
  fb.className = right ? 'correct' : 'wrong';
  if (right) {
    fb.innerHTML = `<strong>✓ Correct</strong> — ${getMoveReason(pos.hist, pos.col)}`;
  } else {
    fb.innerHTML = `<strong>✗ Column ${pos.col + 1} was the book move</strong> — ${getMoveReason(pos.hist, pos.col)}`;
  }

  setTimeout(advanceDrill, 2400);
}

function advanceDrill() {
  drillIdx++;
  if (drillIdx >= drillQueue.length) { endDrill(); return; }
  showDrillCard();
}

function endDrill() {
  document.getElementById('drill-wrap').hidden = true;
  const pct   = drillQueue.length ? Math.round(drillCorrect / drillQueue.length * 100) : 0;
  const sumEl = document.getElementById('drill-summary');
  const scoreEl = document.getElementById('drill-score');
  scoreEl.textContent = `${pct}%`;
  scoreEl.className = pct >= 80 ? 'good' : pct >= 50 ? 'ok' : 'bad';
  document.getElementById('drill-summary-text').textContent =
    `${drillCorrect} of ${drillQueue.length} correct · ${pct >= 80 ? 'Great session!' : pct >= 50 ? 'Keep practicing.' : 'Review the Concepts tab for the theory.'}`;
  sumEl.hidden = false;
  document.getElementById('btn-start-drill').hidden = false;
  document.getElementById('btn-start-drill').textContent = 'Drill Again';
  refreshTrainerSummary();
}

// ── Trainer summary view ─────────────────────────────────────────────────────

function refreshTrainerSummary() {
  const progress = loadProgress();
  const total    = DRILL_POSITIONS.length;
  let mastered = 0, needWork = 0;

  const mList = [], pList = [], uList = [];
  for (const pos of DRILL_POSITIONS) {
    const d = progress[pos.hist];
    const acc = d && d.a >= 3 ? d.c / d.a : null;
    if (acc !== null && acc >= 0.8) { mastered++; mList.push({ pos, acc }); }
    else if (d && d.a >= 1)         { needWork++;  pList.push({ pos, acc: d.c/d.a }); }
    else                            { uList.push({ pos }); }
  }

  document.getElementById('coverage-fill').style.width = `${Math.round(mastered/total*100)}%`;
  document.getElementById('coverage-pct').textContent  = `${Math.round(mastered/total*100)}%`;
  document.getElementById('stat-mastered').textContent = mastered;
  document.getElementById('stat-practice').textContent  = needWork;
  document.getElementById('stat-unseen').textContent   = total - mastered - needWork;

  const listEl = document.getElementById('pos-list');
  listEl.innerHTML = '';
  const addSection = (items, cls, label, accFn) => {
    if (!items.length) return;
    const sec = document.createElement('div');
    sec.className = 'pos-list-section';
    sec.innerHTML = `<div class="pos-list-title">${label}</div>`;
    items.forEach(item => {
      const acc = accFn(item);
      const div = document.createElement('div');
      div.className = 'pos-item';
      div.innerHTML = `<span class="pos-dot ${cls}"></span>
        <span>${item.pos.name}${item.pos.hist ? ` <span style="opacity:0.5;font-size:0.7em">(${item.pos.hist})</span>` : ''}</span>
        ${acc !== null ? `<span class="pos-acc ${cls}">${Math.round(acc*100)}%</span>` : ''}`;
      sec.appendChild(div);
    });
    listEl.appendChild(sec);
  };
  addSection(mList, 'mastered', '✓ Mastered', i => i.acc);
  addSection(pList, 'practice', '⚡ Needs Practice', i => i.acc);
  addSection(uList, 'unseen',   '○ Not Yet Seen',   () => null);
}

// ── Build trainer tab DOM (called once at init) ──────────────────────────────

function buildTrainerTab() {
  const tab = document.getElementById('tab-trainer');
  tab.innerHTML = `
    <div id="trainer-summary">
      <div id="coverage-card">
        <div class="coverage-row">
          <span id="coverage-label">Opening Book Coverage</span>
          <span id="coverage-pct">0%</span>
        </div>
        <div id="coverage-bar"><div id="coverage-fill"></div></div>
        <div id="trainer-stats-row">
          <div class="tstat tstat-mastered"><div id="stat-mastered" class="tstat-num">0</div><div class="tstat-label">Mastered</div></div>
          <div class="tstat tstat-practice"> <div id="stat-practice"  class="tstat-num">0</div><div class="tstat-label">Practice</div></div>
          <div class="tstat tstat-unseen">  <div id="stat-unseen"   class="tstat-num">0</div><div class="tstat-label">Unseen</div></div>
        </div>
      </div>
      <div id="position-list-wrap"><div id="pos-list"></div></div>
    </div>

    <div id="drill-wrap" hidden>
      <div id="drill-header">
        <div id="drill-variation"></div>
        <div id="drill-question"></div>
      </div>
      <div id="drill-board-outer">
        <div id="drill-board"></div>
      </div>
      <div id="drill-col-nums"></div>
      <div id="drill-feedback" hidden></div>
      <div id="drill-footer">
        <span id="drill-progress-text"></span>
        <button id="btn-end-drill">End Session</button>
      </div>
    </div>

    <div id="drill-summary" hidden>
      <h3>Session Complete</h3>
      <div id="drill-score">—</div>
      <p id="drill-summary-text"></p>
    </div>

    <button id="btn-start-drill">Start Drilling</button>
  `;

  buildDrillBoard();
  document.getElementById('drill-board').addEventListener('click', e => {
    const c = e.target.closest('.dcol')?.dataset?.c;
    if (c !== undefined) submitDrillAnswer(parseInt(c));
  });
  document.getElementById('btn-start-drill').addEventListener('click', startDrill);
  document.getElementById('btn-end-drill').addEventListener('click', () => {
    drillIdx = drillQueue.length; endDrill();
  });
  refreshTrainerSummary();
}

// ═══════════════════════════════════════════════════════════════════════════════
//  CONCEPT DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════

function mc(cls) { return `<div class="mc ${cls}"></div>`; }
const E = '', R = 'r', Y = 'y', CE = 'ce', CO = 'co', URG = 'urg', MI = 'mi';

function miniGrid(rows, cols = 7) {
  const cls = cols === 7 ? 'mg7' : cols === 5 ? 'mg5' : 'mg4';
  return `<div class="mini-grid ${cls}">${rows.flatMap(r => r).map(c => mc(c)).join('')}</div>`;
}

const CONCEPTS = [
  {
    sym: '○', symColor: '#34d399', title: 'Claimeven',
    desc: "When a column has an EVEN number of empty squares, Red can guarantee the 2nd, 4th, and 6th cells from the bottom — simply by responding to Yellow's every move in that same column. No calculation needed: wherever Yellow plays in an even column, Red follows immediately. Red gets the even cells; Yellow the odd ones.",
    diagram: miniGrid([
      [CE,CE,CE,CE,CE,CE,CE],
      [E, E, E, E, E, E, E ],
      [CE,CE,CE,CE,CE,CE,CE],
      [E, E, E, E, E, E, E ],
      [CE,CE,CE,CE,CE,CE,CE],
      [E, E, E, E, E, E, E ],
    ]),
  },
  {
    sym: '@', symColor: '#a78bfa', title: 'Miai Pairs',
    desc: "Two cells are miai if winning through either one guarantees Red eventually wins through the other too. Once Red creates threats through both miai cells, Yellow can only block one — Red scores through the remaining threat. Recognising miai pairs turns a two-step calculation into a single visual check.",
    diagram: miniGrid([
      [E, E, E, E, E ],
      [E, E, E, E, E ],
      [E, R, E, R, E ],
      [MI,R, R, R, MI],
    ], 5),
  },
  {
    sym: '|', symColor: '#60a5fa', title: 'Claimodd',
    desc: "In a column with an ODD number of empty squares, the topmost empty cell sits at an odd-numbered row. Red can claim this cell at the right moment — before Yellow controls it. Timing is key: Red waits until the column is almost full, then plays into it, capturing the odd cell that completes a winning threat.",
    diagram: miniGrid([
      [E, E, CO,E, E, E, E],
      [E, E, CE,E, E, E, E],
      [E, E, E, E, E, E, E],
      [E, E, CE,E, E, E, E],
      [E, E, E, E, E, E, E],
      [E, E, R, E, E, E, E],
    ]),
  },
  {
    sym: '!', symColor: '#fb923c', title: 'Urgent Threats',
    desc: "An urgent cell is one where Red must play immediately — either to win on this turn or to stop Yellow from winning next turn. Urgent threats override all other strategy. If you see a red ! on the overlay, every other annotation is irrelevant: play there first, no exceptions.",
    diagram: miniGrid([
      [E,   E,   E,   E,   E  ],
      [E,   E,   E,   E,   E  ],
      [E,   URG, E,   E,   E  ],
      [R,   R,   R,   E,   Y  ],
    ], 5),
  },
  {
    sym: '⚡', symColor: '#fbbf24', title: 'Zugzwang',
    desc: "Zugzwang (from chess) is when the player to move is forced into a losing action. In Connect 4, Red engineers positions where every remaining cell benefits Red's threats — so Yellow, forced to keep playing, fills Red's winning squares. Red wins not by acting, but by making Yellow act.",
    diagram: miniGrid([
      [E, E, E, E, E, E, E],
      [Y, E, E, E, E, E, Y],
      [R, Y, E, E, E, Y, R],
      [R, R, Y, E, Y, R, R],
      [Y, R, R, Y, R, R, Y],
      [R, Y, Y, R, Y, Y, R],
    ]),
  },
  {
    sym: '⅄', symColor: '#94a3b8', title: 'Weak vs Strong Solution',
    desc: "A strong solution maps every possible position — all 4.5 trillion of them. A weak solution only covers Red's winning replies; Yellow's choices don't matter because Red always wins with correct play. This means you need to memorise only ~40 book positions (the trunk), not an entire game tree. The engine handles all of Yellow's deviations; you handle the known lines.",
    diagram: miniGrid([
      [E, E, E, E, E, E, E],
      [E, E, E, CE,E, E, E],
      [E, E, CE,CE,CE,E, E],
      [E, CE,CE,CE,CE,CE,E],
      [CE,CE,CE,CE,CE,CE,CE],
      [E, CE,CE,CE,CE,CE,E],
    ]),
  },
];

function buildConceptsTab() {
  const tab = document.getElementById('tab-concepts');
  tab.innerHTML = `<div id="concepts-grid">${
    CONCEPTS.map(c => `
      <div class="cc">
        <div class="cc-header">
          <span class="cc-sym" style="color:${c.symColor}">${c.sym}</span>
          <span class="cc-title">${c.title}</span>
        </div>
        <div class="cc-diagram">${c.diagram}</div>
        <p class="cc-desc">${c.desc}</p>
      </div>`).join('')
  }</div>`;
}

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

buildTrainerTab();
buildConceptsTab();
initState();
buildBoardDOM();
suggestion = { col: 3, inBook: true };   // col 4 (1-indexed) = index 3
render();
updateStatus();
