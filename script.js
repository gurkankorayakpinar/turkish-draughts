// "Sağ tık ile menü açma" özelliği devre dışı
document.addEventListener('contextmenu', (event) => {
    event.preventDefault();
});

const boardElement = document.getElementById('board');
const statusBar = document.getElementById('status-bar');
const resetBtn = document.getElementById('reset-btn');

let boardState = [];
let turn = 'white';
let selectedSquare = null;
let availableMoves = [];
let isMultiJump = false;
let globalMaxCaptures = 0;

function initGame() {
    boardState = Array(8).fill(null).map(() => Array(8).fill(null));
    for (let r = 1; r < 3; r++) {
        for (let c = 0; c < 8; c++) boardState[r][c] = 'black';
    }
    for (let r = 5; r < 7; r++) {
        for (let c = 0; c < 8; c++) boardState[r][c] = 'white';
    }
    turn = 'white';
    selectedSquare = null;
    availableMoves = [];
    isMultiJump = false;
    statusBar.innerHTML = 'Sıra: <span id="current-player">Beyaz</span>';
    calculateGlobalMax();
    renderBoard();
}

function getMaxCapturesForPiece(r, c, state, currentTurn) {
    let jumps = getJumpMoves(r, c, state, currentTurn);
    if (jumps.length === 0) return 0;

    let max = 0;
    jumps.forEach(move => {
        let tempBoard = state.map(row => [...row]);
        tempBoard[move.r][move.c] = tempBoard[r][c];
        tempBoard[r][c] = null;
        tempBoard[move.captured.r][move.captured.c] = null;

        let count = 1 + getMaxCapturesForPiece(move.r, move.c, tempBoard, currentTurn);
        if (count > max) max = count;
    });
    return max;
}

function calculateGlobalMax() {
    let max = 0;
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = boardState[r][c];
            if (piece && piece.startsWith(turn)) {
                let pieceMax = getMaxCapturesForPiece(r, c, boardState, turn);
                if (pieceMax > max) max = pieceMax;
            }
        }
    }
    globalMaxCaptures = max;
}

function getJumpMoves(r, c, state, currentTurn) {
    const piece = state[r][c];
    if (!piece) return [];
    const moves = [];
    const isKing = piece.includes('king');
    const directions = [
        { dr: 0, dc: 1 }, { dr: 0, dc: -1 }, { dr: 1, dc: 0 }, { dr: -1, dc: 0 }
    ];

    directions.forEach(d => {
        if (!isKing) {
            if (currentTurn === 'white' && d.dr === 1) return;
            if (currentTurn === 'black' && d.dr === -1) return;
        }

        let nr = r + d.dr;
        let nc = c + d.dc;

        if (isKing) {
            let enemyFound = false;
            let enemyPos = null;
            while (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
                const target = state[nr][nc];
                if (!target) {
                    if (enemyFound) {
                        moves.push({ r: nr, c: nc, captured: { ...enemyPos } });
                    }
                } else if (target.startsWith(currentTurn)) {
                    break;
                } else {
                    if (enemyFound) break;
                    enemyFound = true;
                    enemyPos = { r: nr, c: nc };
                }
                nr += d.dr;
                nc += d.dc;
            }
        } else {
            if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
                const target = state[nr][nc];
                if (target && !target.startsWith(currentTurn)) {
                    let jr = nr + d.dr;
                    let jc = nc + d.dc;
                    if (jr >= 0 && jr < 8 && jc >= 0 && jc < 8 && !state[jr][jc]) {
                        moves.push({ r: jr, c: jc, captured: { r: nr, c: nc } });
                    }
                }
            }
        }
    });
    return moves;
}

function renderBoard() {
    boardElement.innerHTML = '';
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const square = document.createElement('div');
            square.className = `square ${(r + c) % 2 === 0 ? 'light' : 'dark'}`;
            const pieceType = boardState[r][c];
            if (pieceType) {
                const piece = document.createElement('div');
                piece.className = `piece ${pieceType.split('-')[0]} ${pieceType.includes('king') ? 'king' : ''}`;
                square.appendChild(piece);
            }
            if (selectedSquare && selectedSquare.r === r && selectedSquare.c === c) square.classList.add('selected');
            if (availableMoves.some(m => m.r === r && m.c === c)) square.classList.add('available-move');
            square.onclick = () => handleSquareClick(r, c);
            boardElement.appendChild(square);
        }
    }
    const currentPlayerDisplay = document.getElementById('current-player');
    if (currentPlayerDisplay) {
        currentPlayerDisplay.innerText = turn === 'white' ? 'Beyaz' : 'Siyah';
    }
}

function handleSquareClick(r, c) {
    const move = availableMoves.find(m => m.r === r && m.c === c);
    if (move) {
        executeMove(selectedSquare, move);
        return;
    }

    if (isMultiJump) return;

    const piece = boardState[r][c];
    if (piece && piece.startsWith(turn)) {
        let pieceMax = getMaxCapturesForPiece(r, c, boardState, turn);

        if (globalMaxCaptures > 0 && pieceMax < globalMaxCaptures) {
            return;
        }

        let moves = getValidMoves(r, c);
        if (globalMaxCaptures > 0) {
            moves = moves.filter(m => {
                if (!m.captured) return false;
                let tempBoard = boardState.map(row => [...row]);
                tempBoard[m.r][m.c] = tempBoard[r][c];
                tempBoard[r][c] = null;
                tempBoard[m.captured.r][m.captured.c] = null;
                return (1 + getMaxCapturesForPiece(m.r, m.c, tempBoard, turn)) === globalMaxCaptures;
            });
        }

        selectedSquare = { r, c };
        availableMoves = moves;
        renderBoard();
    } else {
        selectedSquare = null;
        availableMoves = [];
        renderBoard();
    }
}

function getValidMoves(r, c) {
    const piece = boardState[r][c];
    let jumps = getJumpMoves(r, c, boardState, turn);
    if (jumps.length > 0) return jumps;

    if (globalMaxCaptures > 0) return [];

    const moves = [];
    const isKing = piece.includes('king');
    const directions = isKing
        ? [{ dr: 0, dc: 1 }, { dr: 0, dc: -1 }, { dr: 1, dc: 0 }, { dr: -1, dc: 0 }]
        : (turn === 'white' ? [{ dr: -1, dc: 0 }, { dr: 0, dc: 1 }, { dr: 0, dc: -1 }] : [{ dr: 1, dc: 0 }, { dr: 0, dc: 1 }, { dr: 0, dc: -1 }]);

    directions.forEach(d => {
        let nr = r + d.dr;
        let nc = c + d.dc;
        if (isKing) {
            while (nr >= 0 && nr < 8 && nc >= 0 && nc < 8 && !boardState[nr][nc]) {
                moves.push({ r: nr, c: nc });
                nr += d.dr; nc += d.dc;
            }
        } else {
            if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8 && !boardState[nr][nc]) {
                moves.push({ r: nr, c: nc });
            }
        }
    });
    return moves;
}

function executeMove(from, to) {
    let piece = boardState[from.r][from.c];
    boardState[to.r][to.c] = piece;
    boardState[from.r][from.c] = null;

    if (to.captured) {
        boardState[to.captured.r][to.captured.c] = null;
        let remainingMax = getMaxCapturesForPiece(to.r, to.c, boardState, turn);

        if (remainingMax > 0) {
            selectedSquare = { r: to.r, c: to.c };
            availableMoves = getJumpMoves(to.r, to.c, boardState, turn).filter(m => {
                let tempBoard = boardState.map(row => [...row]);
                tempBoard[m.r][m.c] = tempBoard[to.r][to.c];
                tempBoard[to.r][to.c] = null;
                tempBoard[m.captured.r][m.captured.c] = null;
                return (1 + getMaxCapturesForPiece(m.r, m.c, tempBoard, turn)) === remainingMax;
            });
            isMultiJump = true;
            renderBoard();
            return;
        }
    }

    if (turn === 'white' && to.r === 0) boardState[to.r][to.c] = 'white-king';
    if (turn === 'black' && to.r === 7) boardState[to.r][to.c] = 'black-king';

    turn = turn === 'white' ? 'black' : 'white';
    selectedSquare = null;
    availableMoves = [];
    isMultiJump = false;
    calculateGlobalMax();
    renderBoard();
    setTimeout(checkGameOver, 100);
}

function checkGameOver() {
    let w = 0, b = 0;
    boardState.flat().forEach(p => {
        if (p?.startsWith('white')) w++;
        if (p?.startsWith('black')) b++;
    });
    if (w === 0) {
        statusBar.innerText = "Siyah kazandı.";
    } else if (b === 0) {
        statusBar.innerText = "Beyaz kazandı.";
    }
}

resetBtn.onclick = () => {
    if (confirm("Yeni bir oyun başlatmak istediğinize emin misiniz?")) {
        initGame();
    }
};
initGame();