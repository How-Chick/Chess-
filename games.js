/* Chess logic & UI separated file
   Uses Unicode characters for piece "pictures".
*/

const PIECE_TO_CHAR = {
  'w': { 'k':'♔','q':'♕','r':'♖','b':'♗','n':'♘','p':'♙' },
  'b': { 'k':'♚','q':'♛','r':'♜','b':'♝','n':'♞','p':'♟' }
};

const initialFEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

// Helpers for coordinates
const files = ['a','b','c','d','e','f','g','h'];
const ranks = ['8','7','6','5','4','3','2','1'];

function algebraicToRC(sq){
  const file = files.indexOf(sq[0]);
  const rank = ranks.indexOf(sq[1]);
  return { r: rank, c: file };
}
function rcToAlgebraic(r,c){ return files[c] + ranks[r]; }

function cloneBoard(board){ return board.map(row => row.map(p => p ? {...p} : null)); }

function parseFEN(fen){
  const [piecePlacement, active, castling, ep, half, full] = fen.split(' ');
  const rows = piecePlacement.split('/');
  const board = Array.from({length:8},()=>Array(8).fill(null));
  rows.forEach((row, rIdx) => {
    let c=0;
    for (const ch of row){
      if(/[1-8]/.test(ch)){ c += parseInt(ch,10); }
      else {
        const color = ch === ch.toLowerCase() ? 'b' : 'w';
        const type = ch.toLowerCase();
        board[rIdx][c] = { type, color };
        c++;
      }
    }
  });
  return {
    board,
    turn: active,
    castling,
    enPassant: ep === '-' ? null : ep,
    halfmove: parseInt(half,10),
    fullmove: parseInt(full,10),
  };
}

function boardToFEN(state){
  const {board, turn, castling, enPassant, halfmove, fullmove} = state;
  const rows = board.map(row => {
    let out = '', empty=0;
    for (let c=0;c<8;c++){
      const p = row[c];
      if(!p){ empty++; continue; }
      if(empty>0){ out += empty; empty=0; }
      let ch = p.type;
      if(p.color==='w') ch = ch.toUpperCase();
      out += ch;
    }
    if(empty>0) out += empty;
    return out;
  });
  return rows.join('/') + ' ' + turn + ' ' + (castling || '-') + ' ' + (enPassant || '-') + ' ' + halfmove + ' ' + fullmove;
}

// Movement deltas
const DIRS = {
  n: [ [-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1] ],
  b: [ [-1,-1],[-1,1],[1,-1],[1,1] ],
  r: [ [-1,0],[1,0],[0,-1],[0,1] ],
  k: [ [-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1] ]
};

function inBounds(r,c){ return r>=0 && r<8 && c>=0 && c<8; }

function isSquareAttacked(board, targetR, targetC, byColor){
  const opp = byColor;
  // Pawns
  const dir = opp==='w' ? -1 : 1;
  for(const dc of [-1,1]){
    const r = targetR + dir, c = targetC + dc;
    if(inBounds(r,c)){
      const p = board[r][c];
      if(p && p.color===opp && p.type==='p') return true;
    }
  }
  // Knights
  for(const [dr,dc] of DIRS.n){
    const r = targetR+dr, c = targetC+dc;
    if(inBounds(r,c)){
      const p = board[r][c];
      if(p && p.color===opp && p.type==='n') return true;
    }
  }
  // Bishops/Queens (diagonals)
  for(const [dr,dc] of DIRS.b){
    let r=targetR+dr, c=targetC+dc;
    while(inBounds(r,c)){
      const p = board[r][c];
      if(p){
        if(p.color===opp && (p.type==='b' || p.type==='q')) return true;
        break;
      }
      r+=dr; c+=dc;
    }
  }
  // Rooks/Queens (straight)
  for(const [dr,dc] of DIRS.r){
    let r=targetR+dr, c=targetC+dc;
    while(inBounds(r,c)){
      const p = board[r][c];
      if(p){
        if(p.color===opp && (p.type==='r' || p.type==='q')) return true;
        break;
      }
      r+=dr; c+=dc;
    }
  }
  // King
  for(const [dr,dc] of DIRS.k){
    const r = targetR+dr, c = targetC+dc;
    if(inBounds(r,c)){
      const p = board[r][c];
      if(p && p.color===opp && p.type==='k') return true;
    }
  }
  return false;
}

function generatePseudoMoves(state, r, c){
  const board = state.board; const piece = board[r][c];
  if(!piece) return [];
  const moves = [];
  const add = (toR,toC,opts={})=>{ if(inBounds(toR,toC)) moves.push({from:{r,c}, to:{r:toR,c:toC}, ...opts}); };
  const {type, color} = piece;

  if(type==='p'){
    const dir = color==='w' ? -1 : 1;
    const startRank = color==='w' ? 6 : 1;
    if(inBounds(r+dir,c) && !board[r+dir][c]) add(r+dir,c);
    if(r===startRank && !board[r+dir][c] && !board[r+2*dir][c]) add(r+2*dir,c,{double:true});
    for(const dc of [-1,1]){
      const tr=r+dir, tc=c+dc;
      if(inBounds(tr,tc)){
        const p = board[tr][tc];
        if(p && p.color!==color) add(tr,tc,{capture:true});
      }
    }
    if(state.enPassant){
      const ep = algebraicToRC(state.enPassant);
      if(ep.r===r+dir && Math.abs(ep.c-c)===1) add(ep.r, ep.c, {capture:true, enPassant:true});
    }
  }
  else if(type==='n'){
    for(const [dr,dc] of DIRS.n){
      const tr=r+dr, tc=c+dc; if(!inBounds(tr,tc)) continue;
      const p=board[tr][tc]; if(!p || p.color!==color) add(tr,tc,{capture: !!p});
    }
  }
  else if(type==='b' || type==='r' || type==='q'){
    const dirs = (type==='b')?DIRS.b:(type==='r')?DIRS.r:DIRS.b.concat(DIRS.r);
    for(const [dr,dc] of dirs){
      let tr=r+dr, tc=c+dc;
      while(inBounds(tr,tc)){
        const p = board[tr][tc];
        if(!p){ add(tr,tc); }
        else { if(p.color!==color) add(tr,tc,{capture:true}); break; }
        tr+=dr; tc+=dc;
      }
    }
  }
  else if(type==='k'){
    for(const [dr,dc] of DIRS.k){
      const tr=r+dr, tc=c+dc; if(!inBounds(tr,tc)) continue;
      const p=board[tr][tc]; if(!p || p.color!==color) add(tr,tc,{capture: !!p});
    }
    const rights = state.castling || '';
    if(color==='w' && r===7 && c===4){
      if(rights.includes('K')){
        if(!board[7][5] && !board[7][6] &&
           !isSquareAttacked(board,7,4,'b') && !isSquareAttacked(board,7,5,'b') && !isSquareAttacked(board,7,6,'b')){
          add(7,6,{castle:'K'});
        }
      }
      if(rights.includes('Q')){
        if(!board[7][1] && !board[7][2] && !board[7][3] &&
           !isSquareAttacked(board,7,4,'b') && !isSquareAttacked(board,7,3,'b') && !isSquareAttacked(board,7,2,'b')){
          add(7,2,{castle:'Q'});
        }
      }
    }
    if(color==='b' && r===0 && c===4){
      if(rights.includes('k')){
        if(!board[0][5] && !board[0][6] &&
           !isSquareAttacked(board,0,4,'w') && !isSquareAttacked(board,0,5,'w') && !isSquareAttacked(board,0,6,'w')){
          add(0,6,{castle:'k'});
        }
      }
      if(rights.includes('q')){
        if(!board[0][1] && !board[0][2] && !board[0][3] &&
           !isSquareAttacked(board,0,4,'w') && !isSquareAttacked(board,0,3,'w') && !isSquareAttacked(board,0,2,'w')){
          add(0,2,{castle:'q'});
        }
      }
    }
  }
  return moves;
}

function findKing(board, color){
  for(let r=0;r<8;r++) for(let c=0;c<8;c++){
    const p=board[r][c]; if(p && p.type==='k' && p.color===color) return {r,c};
  }
  return null;
}

function makeMove(state, move){
  const s = JSON.parse(JSON.stringify(state));
  const {from, to} = move; const board = s.board;
  const piece = board[from.r][from.c];
  if(piece.type==='p' || move.capture) s.halfmove = 0; else s.halfmove++;
  if(s.turn==='b') s.fullmove++;
  s.enPassant = null;

  if(piece.type==='p'){
    const dir = (piece.color==='w')?-1:1;
    if(move.double){ s.enPassant = rcToAlgebraic(from.r+dir, from.c); }
    const promoteRank = (piece.color==='w')?0:7;
    if(to.r===promoteRank){ move.promotion = 'q'; }
    if(move.enPassant){
      const capR = to.r + (piece.color==='w'?1:-1);
      board[capR][to.c] = null;
    }
  }

  if(piece.type==='k' && move.castle){
    if(move.castle==='K') { board[7][5]=board[7][7]; board[7][7]=null; }
    if(move.castle==='Q') { board[7][3]=board[7][0]; board[7][0]=null; }
    if(move.castle==='k') { board[0][5]=board[0][7]; board[0][7]=null; }
    if(move.castle==='q') { board[0][3]=board[0][0]; board[0][0]=null; }
  }

  board[to.r][to.c] = piece;
  board[from.r][from.c] = null;

  if(move.promotion){ board[to.r][to.c] = {type: move.promotion, color: piece.color}; }

  let rights = s.castling || '';
  if(piece.type==='k') rights = rights.replace(piece.color==='w' ? /K|Q/g : /k|q/g, '');
  if(piece.type==='r'){
    if(from.r===7 && from.c===0) rights = rights.replace('Q','');
    if(from.r===7 && from.c===7) rights = rights.replace('K','');
    if(from.r===0 && from.c===0) rights = rights.replace('q','');
    if(from.r===0 && from.c===7) rights = rights.replace('k','');
  }
  if(move.capture){
    if(to.r===7 && to.c===0) rights = rights.replace('Q','');
    if(to.r===7 && to.c===7) rights = rights.replace('K','');
    if(to.r===0 && to.c===0) rights = rights.replace('q','');
    if(to.r===0 && to.c===7) rights = rights.replace('k','');
  }
  s.castling = rights;
  s.turn = s.turn==='w' ? 'b' : 'w';
  return s;
}

function legalMoves(state, r, c){
  const board = state.board; const piece = board[r][c]; if(!piece || piece.color!==state.turn) return [];
  const pseudo = generatePseudoMoves(state, r, c);
  const legal = [];
  for(const mv of pseudo){
    const next = JSON.parse(JSON.stringify(state));
    next.board = cloneBoard(state.board);
    const after = makeMove(next, mv);
    const kingPos = findKing(after.board, piece.color);
    if(!isSquareAttacked(after.board, kingPos.r, kingPos.c, after.turn)){
      legal.push(mv);
    }
  }
  return legal;
}

// --- UI ---
const boardEl = document.getElementById('board');
const statusEl = document.getElementById('status');
const undoBtn = document.getElementById('undoBtn');
const newBtn = document.getElementById('newGame');
const flipBtn = document.getElementById('flipBoard');

let state = parseFEN(initialFEN);
let history = [boardToFEN(state)];
let flipped = false;

function setupBoardGrid(){
  boardEl.innerHTML = '';
  const displayRanks = flipped ? [...ranks].reverse() : ranks;
  const displayFiles = flipped ? [...files].reverse() : files;
  for(let r=0;r<8;r++){
    for(let c=0;c<8;c++){
      const sq = document.createElement('div');
      sq.className = 'square ' + ((r+c)%2===0 ? 'light':'dark');
      sq.dataset.r = r; sq.dataset.c = c;
      const fileLabel = document.createElement('div'); fileLabel.className='label file'; fileLabel.textContent = displayFiles[c];
      const rankLabel = document.createElement('div'); rankLabel.className='label rank'; if(c===0) rankLabel.textContent = displayRanks[r];
      sq.appendChild(fileLabel); if(c===0) sq.appendChild(rankLabel);
      boardEl.appendChild(sq);
    }
  }
}

function render(){
  setupBoardGrid();
  const mapping = (r,c)=>{ return flipped ? { r: 7-r, c: 7-c } : { r, c }; };

  for(let r=0;r<8;r++){
    for(let c=0;c<8;c++){
      const disp = mapping(r,c);
      const idx = disp.r*8 + disp.c;
      const sqEl = boardEl.children[idx];
      const p = state.board[r][c];
      if(p){
        const span = document.createElement('span');
        span.className = `piece ${p.color==='w'?'white':'black'}`;
        span.textContent = PIECE_TO_CHAR[p.color][p.type];
        sqEl.appendChild(span);
      }
    }
  }

  const k = findKing(state.board, state.turn);
  if(k){
    if(isSquareAttacked(state.board, k.r, k.c, state.turn==='w'?'b':'w')){
      const m = flipped ? { r: 7-k.r, c: 7-k.c } : k;
      const idx = m.r*8 + m.c; boardEl.children[idx].classList.add('king-in-check');
    }
  }

  statusEl.textContent = `${state.turn==='w'?'White':'Black'} to move`;
  const anyLegal = hasAnyLegalMove(state);
  const inCheck = k && isSquareAttacked(state.board, k.r, k.c, state.turn==='w'?'b':'w');
  if(!anyLegal){
    statusEl.textContent = inCheck ? `${state.turn==='w'?'White':'Black'} is checkmated` : 'Stalemate';
  }
}

function hasAnyLegalMove(st){
  for(let r=0;r<8;r++) for(let c=0;c<8;c++){
    const p = st.board[r][c]; if(!p || p.color!==st.turn) continue;
    if(legalMoves(st,r,c).length>0) return true;
  }
  return false;
}

let selected = null;
let legalForSelected = [];

function clearHighlights(){
  Array.from(boardEl.children).forEach(el=>{
    el.classList.remove('highlight','capture','selected','king-in-check');
  });
}

function showHighlights(moves){
  const mapping = (r,c)=> flipped ? { r: 7-r, c: 7-c } : { r, c };
  for(const mv of moves){
    const mFrom = mapping(mv.from.r, mv.from.c);
    const mTo = mapping(mv.to.r, mv.to.c);
    boardEl.children[mFrom.r*8 + mFrom.c].classList.add('selected');
    const toEl = boardEl.children[mTo.r*8 + mTo.c];
    toEl.classList.add(mv.capture? 'capture':'highlight');
  }
}

function handleClick(e){
  const sq = e.target.closest('.square'); if(!sq) return;
  const dispR = parseInt(sq.dataset.r,10); const dispC = parseInt(sq.dataset.c,10);
  const r = flipped ? 7 - dispR : dispR; const c = flipped ? 7 - dispC : dispC;

  if(selected){
    const mv = legalForSelected.find(m => m.to.r===r && m.to.c===c);
    if(mv){
      state = makeMove(state, mv);
      history.push(boardToFEN(state));
      selected = null; legalForSelected = []; clearHighlights(); render();
      return;
    }
  }

  const p = state.board[r][c];
  if(p && p.color===state.turn){
    selected = {r,c};
    legalForSelected = legalMoves(state, r, c);
    clearHighlights();
    showHighlights(legalForSelected);
  } else {
    selected = null; legalForSelected = []; clearHighlights();
  }
}

boardEl.addEventListener('click', handleClick);

undoBtn.addEventListener('click', ()=>{
  if(history.length>1){ history.pop(); state = parseFEN(history[history.length-1]); selected=null; legalForSelected=[]; render(); }
});
newBtn.addEventListener('click', ()=>{ state = parseFEN(initialFEN); history=[boardToFEN(state)]; selected=null; legalForSelected=[]; render(); });
flipBtn.addEventListener('click', ()=>{ flipped = !flipped; render(); });

// Init
setupBoardGrid();
render();
