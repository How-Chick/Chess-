// Advanced Chess Game JS
const boardElement = document.getElementById('board');
const statusElement = document.getElementById('status');

const files = ['a','b','c','d','e','f','g','h'];
let board = [];
let selectedSquare = null;
let legalMoves = [];
let currentPlayer = 'white';

function initBoard() {
  // Setup board with pieces
  const emptyRow = ['', '', '', '', '', '', '', ''];
  board = [
    ['♜','♞','♝','♛','♚','♝','♞','♜'],
    ['♟','♟','♟','♟','♟','♟','♟','♟'],
    [...emptyRow],
    [...emptyRow],
    [...emptyRow],
    [...emptyRow],
    ['♙','♙','♙','♙','♙','♙','♙','♙'],
    ['♖','♘','♗','♕','♔','♗','♘','♖']
  ];
}

function renderBoard() {
  boardElement.innerHTML = '';
  for (let row=0; row<8; row++){
    for (let col=0; col<8; col++){
      const square = document.createElement('div');
      square.classList.add('square', (row+col)%2===0 ? 'light' : 'dark');
      square.textContent = board[row][col];
      square.dataset.row = row;
      square.dataset.col = col;

      // Highlight legal moves
      if (legalMoves.some(m => m[0]===row && m[1]===col)){
        square.style.background = '#8fbc8f'; // highlight color
      }

      square.addEventListener('click', () => handleSquareClick(row, col));
      boardElement.appendChild(square);
    }
  }
  statusElement.textContent = `${currentPlayer}'s turn`;
}

function handleSquareClick(row, col){
  const piece = board[row][col];

  if (selectedSquare){
    // Attempt move
    const [fromRow, fromCol] = selectedSquare;
    if (legalMoves.some(m => m[0]===row && m[1]===col)){
      movePiece(fromRow, fromCol, row, col);
      currentPlayer = currentPlayer === 'white' ? 'black' : 'white';
    }
    selectedSquare = null;
    legalMoves = [];
    renderBoard();
  } else {
    if (piece && isCurrentPlayersPiece(piece)){
      selectedSquare = [row, col];
      legalMoves = getLegalMoves(row, col);
      renderBoard();
    }
  }
}

function isCurrentPlayersPiece(piece){
  return (currentPlayer==='white' && piece === piece.toUpperCase()) ||
         (currentPlayer==='black' && piece === piece.toLowerCase());
}

// Move piece
function movePiece(fromRow, fromCol, toRow, toCol){
  const piece = board[fromRow][fromCol];
  board[toRow][toCol] = piece;
  board[fromRow][fromCol] = '';

  // Promotion
  if (piece === '♙' && toRow===0) board[toRow][toCol]='♕';
  if (piece === '♟' && toRow===7) board[toRow][toCol]='♛';
}

// Determine legal moves for a piece (simplified, prevents moving into check)
function getLegalMoves(row, col){
  const piece = board[row][col];
  const moves = [];

  const directions = {
    '♙': [[-1,0], [-1,-1], [-1,1]],
    '♟': [[1,0],[1,-1],[1,1]],
    '
