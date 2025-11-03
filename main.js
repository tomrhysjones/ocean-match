// ===== Ocean Match ===== //

// --- Constants --- //
const ICONS = ['🐙','🦈','🐠','🐡','🦀','🐬','🐢','🐳','🦑','🐚','🪼','🪸'];

// --- Game State --- //
const state = {
  tiles: [],
  firstPick: null,
  secondPick: null,
  matches: 0,
  totalPairs: 0,
  timeLeft: 60,
  mismatches: 0,
  missLimit: 12,
  timerId: null,
  running: false,
  difficulty: 'easy',
  cols: 4,
  rows: 4
};

// --- Cached DOM Elements --- //
// --- Cached DOM Elements (declare only; assign later) --- //
let $board, $time, $matches, $total, $misses, $missLimit, $message;
let $newGame, $difficulty, $endDialog, $endTitle, $endText, $playAgain, $srLive;



// --- Utility Functions --- //
function el(tag, props = {}) {
  const node = document.createElement(tag);
  Object.assign(node, props);
  return node;
}

function announce(text) {
  if ($srLive) $srLive.textContent = text;
}

function openDialog(title, text) {
  $endTitle.textContent = title;
  $endText.textContent = text;
  $endDialog.showModal();
}

function closeDialog() {
  if ($endDialog.open) $endDialog.close();
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// --- Game Logic --- //
function initState(diff = 'easy') {
  // Set board sizes (Easy now 3×3)
  const byDiff = {
    easy:   { cols: 3, rows: 3, time: 50, misses: 10 }, // ← 3×3
    medium: { cols: 5, rows: 4, time: 75, misses: 14 },
    hard:   { cols: 6, rows: 4, time: 90, misses: 16 }
  };
  const d = byDiff[diff];

  // Base state
  Object.assign(state, {
    cols: d.cols,
    rows: d.rows,
    timeLeft: d.time,
    mismatches: 0,
    missLimit: d.misses,
    matches: 0,
    totalPairs: 0,     // will set below
    tiles: [],
    firstPick: null,
    secondPick: null,
    running: false,
    difficulty: diff
  });

  // How many tiles the board needs
  const needed = state.cols * state.rows;

  // Number of pairs we can fit (for 3×3 this is 4)
  const pairs = Math.floor(needed / 2);
  state.totalPairs = pairs;

  // Build icon list: pairs duplicated
  const chosen = ICONS.slice(0, pairs);
  let deckIcons = [...chosen, ...chosen];

  // If the board has an odd slot (e.g., 3×3 → 9 tiles), add a filler tile
  if (deckIcons.length < needed) {
    deckIcons.push('🌊'); // non-playable filler
  }

  // Shuffle and map into tile objects
  deckIcons = shuffle(deckIcons);
  state.tiles = deckIcons.map((icon, id) => {
    // Mark the filler as 'blocked' so it can't be played
    const isFiller = icon === '🌊' && deckIcons.length % 2 === 1;
    return { id, icon, state: isFiller ? 'blocked' : 'hidden' };
  });

  render();
}


function render() {
  $time.textContent = state.timeLeft;
  $matches.textContent = state.matches;
  $total.textContent = state.totalPairs;
  $misses.textContent = state.mismatches;
  $missLimit.textContent = state.missLimit;
  $board.style.setProperty('--cols', state.cols);
  $board.innerHTML = '';

    state.tiles.forEach(tile => {
    const isBlocked = tile.state === 'blocked';

    const cell = el('button', {
      className: 'tile',
      type: 'button',
      disabled: isBlocked, // 🚫 filler not clickable
      textContent: isBlocked
        ? '🌊'  // show filler
        : (tile.state === 'hidden' ? '❓' : tile.icon),
      ariaLabel: isBlocked
        ? 'Spacer tile'
        : (tile.state === 'hidden' ? 'Hidden tile' : `Tile ${tile.icon}`)
    });

    cell.dataset.state = tile.state;

    if (!isBlocked) {
      cell.addEventListener('click', () => onFlip(tile.id));
    }

    $board.appendChild(cell);
  });
}

function onFlip(id) {
  if (!state.running) return;
  const tile = state.tiles[id];
  if (tile.state !== 'hidden') return;

  tile.state = 'revealed';
  announce('Tile revealed');
  render();

  if (state.firstPick === null) {
    state.firstPick = id;
    return;
  }

  state.secondPick = id;
  setTimeout(checkMatch, 450);
}

function checkMatch() {
  const a = state.tiles[state.firstPick];
  const b = state.tiles[state.secondPick];
  if (!a || !b) return;

  if (a.icon === b.icon) {
    a.state = b.state = 'matched';
    state.matches++;
    $message.textContent = 'Nice! You found a match.';
    announce('Match found!');
  } else {
    a.state = b.state = 'hidden';
    state.mismatches++;
    $message.textContent = 'No match. Try again.';
    announce('No match.');
  }

  state.firstPick = state.secondPick = null;
  render();
  checkWinLoss();
}

function checkWinLoss() {
  if (state.matches === state.totalPairs) {
    stop();
    startConfetti(); // 🎉 Make sure this is here
    openDialog('You Win! 🎉', 'You matched all pairs!');
  } else if (state.mismatches >= state.missLimit) {
    stop();
    openDialog('You Lost 😢', 'Mismatch limit reached.');
  }
}


function tick() {
  if (!state.running) return;
  state.timeLeft--;
  if (state.timeLeft <= 0) {
    stop();
    openDialog('You Lost 😭', 'Time ran out.');
  }
  render();
}

function start() {
  initState($difficulty.value);
  render();
  state.running = true;
  $message.textContent = 'Find all pairs before time or guesses run out.';
  closeDialog();
  state.timerId = setInterval(tick, 1000);
}

function stop() {
  state.running = false;
  clearInterval(state.timerId);
}



// ===== CONFETTI =====
let $confetti, _ctx, _raf, _particles = [];

function setupConfetti() {
  $confetti = document.getElementById('confetti');
  if (!$confetti) return;
  _ctx = $confetti.getContext('2d');
  resizeConfetti();
  window.addEventListener('resize', resizeConfetti);
}

function resizeConfetti() {
  if (!$confetti) return;
  $confetti.width = window.innerWidth;
  $confetti.height = window.innerHeight;
}

function spawnConfetti(count = 120) {
  const colors = ['#ff6b6b', '#ffd93d', '#6bcB77', '#4d96ff', '#f72585', '#48cae4'];
  for (let i = 0; i < count; i++) {
    _particles.push({
      x: Math.random() * $confetti.width,
      y: -20 - Math.random() * 50,
      w: 6 + Math.random() * 4,
      h: 10 + Math.random() * 6,
      vx: -2 + Math.random() * 4,
      vy: 2 + Math.random() * 3,
      rot: Math.random() * Math.PI,
      vr: (-0.2 + Math.random() * 0.4),
      color: colors[Math.floor(Math.random() * colors.length)],
      alpha: 1
    });
  }
}

function drawConfetti() {
  _raf = requestAnimationFrame(drawConfetti);
  _ctx.clearRect(0, 0, $confetti.width, $confetti.height);
  for (let p of _particles) {
    p.vy += 0.04;
    p.x += p.vx;
    p.y += p.vy;
    p.rot += p.vr;
    if (p.y > $confetti.height * 0.7) p.alpha -= 0.01;
    _ctx.save();
    _ctx.globalAlpha = Math.max(p.alpha, 0);
    _ctx.translate(p.x, p.y);
    _ctx.rotate(p.rot);
    _ctx.fillStyle = p.color;
    _ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
    _ctx.restore();
  }
  _particles = _particles.filter(p => p.alpha > 0 && p.y < $confetti.height + 50);
}

function startConfetti(duration = 1800) {
  if (!$confetti) setupConfetti();
  spawnConfetti(140);
  if (!_raf) drawConfetti();
  setTimeout(stopConfetti, duration);
}

function stopConfetti() {
  if (_raf) cancelAnimationFrame(_raf);
  _raf = null;
  _particles = [];
  if (_ctx) _ctx.clearRect(0, 0, $confetti.width, $confetti.height);
}



// --- Event Listeners --- //


// --- DOM Ready Init --- //
// --- DOM Ready: wire everything here --- //
document.addEventListener('DOMContentLoaded', () => {
  // Query elements now that the DOM exists
  $board      = document.getElementById('board');
  $time       = document.getElementById('time');
  $matches    = document.getElementById('matches');
  $total      = document.getElementById('total');
  $misses     = document.getElementById('misses');
  $missLimit  = document.getElementById('miss-limit');
  $message    = document.getElementById('message');
  $newGame    = document.getElementById('new-game');
  $difficulty = document.getElementById('difficulty');
  $endDialog  = document.getElementById('end-dialog');
  $endTitle   = document.getElementById('end-title');
  $endText    = document.getElementById('end-text');
  $playAgain  = document.getElementById('play-again');
  $srLive     = document.getElementById('sr-live');

  // Attach listeners AFTER refs exist
  $newGame.addEventListener('click', start);
  $playAgain.addEventListener('click', (e) => { e.preventDefault(); start(); });

  // Initial board
  initState('easy');
  render();
});


console.log('Ocean Match loaded.');


// ===== End of Ocean Match ===== //