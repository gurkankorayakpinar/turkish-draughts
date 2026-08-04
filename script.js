// "Sağ tık ile menü açma" özelliği devre dışı
document.addEventListener('contextmenu', (event) => {
    event.preventDefault();
});

const boardElement = document.getElementById('board');
const $moveList = $('#moveList');
const $status = $('#status');

let boardState = [];
let turn = 'white';
let selectedSquare = null;
let availableMoves = [];
let isMultiJump = false;
let globalMaxCaptures = 0;

let historyFens = [];
let moveHistory = [];
let currentViewIndex = 0;
let currentNotation = "";
let lastJumpDir = null;

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
    historyFens = [JSON.stringify(boardState)];
    moveHistory = [];
    currentViewIndex = 0;
    currentNotation = "";
    lastJumpDir = null;

    calculateGlobalMax();
    updateUI();
    renderBoard();
}

function getSquareName(r, c) {
    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    return files[c] + (8 - r);
}

function getJumpMoves(r, c, state, currentTurn, forbiddenDir = null) {
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
        } else {
            if (forbiddenDir && d.dr === forbiddenDir.dr && d.dc === forbiddenDir.dc) return;
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
                        moves.push({ r: nr, c: nc, captured: { ...enemyPos }, dir: d });
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
                        moves.push({ r: jr, c: jc, captured: { r: nr, c: nc }, dir: d });
                    }
                }
            }
        }
    });
    return moves;
}

function getMaxCapturesForPiece(r, c, state, currentTurn, forbiddenDir = null) {
    let jumps = getJumpMoves(r, c, state, currentTurn, forbiddenDir);
    if (jumps.length === 0) return 0;

    let max = 0;
    jumps.forEach(move => {
        let tempBoard = state.map(row => [...row]);
        tempBoard[move.r][move.c] = tempBoard[r][c];
        tempBoard[r][c] = null;
        tempBoard[move.captured.r][move.captured.c] = null;

        let nextForbidden = { dr: -move.dir.dr, dc: -move.dir.dc };
        let count = 1 + getMaxCapturesForPiece(move.r, move.c, tempBoard, currentTurn, nextForbidden);
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

function renderBoard() {
    boardElement.innerHTML = '';
    const displayState = (currentViewIndex === historyFens.length - 1)
        ? boardState
        : JSON.parse(historyFens[currentViewIndex]);

    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const square = document.createElement('div');
            square.className = `square ${(r + c) % 2 === 0 ? 'light' : 'dark'}`;
            const pieceType = displayState[r][c];
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
}

function handleSquareClick(r, c) {
    if (currentViewIndex !== historyFens.length - 1) return;

    const move = availableMoves.find(m => m.r === r && m.c === c);
    if (move) {
        executeMove(selectedSquare, move);
        return;
    }

    if (isMultiJump) return;

    const piece = boardState[r][c];
    if (piece && piece.startsWith(turn)) {
        let pieceMax = getMaxCapturesForPiece(r, c, boardState, turn);
        if (globalMaxCaptures > 0 && pieceMax < globalMaxCaptures) return;

        let moves = getValidMoves(r, c);
        if (globalMaxCaptures > 0) {
            moves = moves.filter(m => {
                if (!m.captured) return false;
                let tempBoard = boardState.map(row => [...row]);
                tempBoard[m.r][m.c] = tempBoard[r][c];
                tempBoard[r][c] = null;
                tempBoard[m.captured.r][m.captured.c] = null;
                let nextForbidden = { dr: -m.dir.dr, dc: -m.dir.dc };
                return (1 + getMaxCapturesForPiece(m.r, m.c, tempBoard, turn, nextForbidden)) === globalMaxCaptures;
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
    let jumps = getJumpMoves(r, c, boardState, turn, lastJumpDir);
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
    if (!isMultiJump) {
        currentNotation = getSquareName(from.r, from.c);
    }

    let piece = boardState[from.r][from.c];
    boardState[to.r][to.c] = piece;
    boardState[from.r][from.c] = null;

    if (to.captured) {
        boardState[to.captured.r][to.captured.c] = null;
        currentNotation += ":" + getSquareName(to.r, to.c);

        let nextForbidden = { dr: -to.dir.dr, dc: -to.dir.dc };
        let remainingMax = getMaxCapturesForPiece(to.r, to.c, boardState, turn, nextForbidden);

        if (remainingMax > 0) {
            selectedSquare = { r: to.r, c: to.c };
            lastJumpDir = nextForbidden;
            availableMoves = getJumpMoves(to.r, to.c, boardState, turn, nextForbidden).filter(m => {
                let tempBoard = boardState.map(row => [...row]);
                tempBoard[m.r][m.c] = tempBoard[to.r][to.c];
                tempBoard[to.r][to.c] = null;
                tempBoard[m.captured.r][m.captured.c] = null;
                let nextNextForbidden = { dr: -m.dir.dr, dc: -m.dir.dc };
                return (1 + getMaxCapturesForPiece(m.r, m.c, tempBoard, turn, nextNextForbidden)) === remainingMax;
            });
            isMultiJump = true;
            renderBoard();
            return;
        }
    } else {
        currentNotation += "-" + getSquareName(to.r, to.c);
    }

    if (turn === 'white' && to.r === 0) boardState[to.r][to.c] = 'white-king';
    if (turn === 'black' && to.r === 7) boardState[to.r][to.c] = 'black-king';

    moveHistory.push(currentNotation);
    historyFens.push(JSON.stringify(boardState));
    currentViewIndex = historyFens.length - 1;

    turn = turn === 'white' ? 'black' : 'white';
    selectedSquare = null;
    availableMoves = [];
    isMultiJump = false;
    lastJumpDir = null;
    currentNotation = "";

    calculateGlobalMax();
    updateUI();
    renderBoard();
    setTimeout(checkGameOver, 100);
}

function checkGameOver() {
    let w = 0, b = 0;
    boardState.flat().forEach(p => {
        if (p?.startsWith('white')) w++;
        if (p?.startsWith('black')) b++;
    });

    let statusText = '';

    if (w === 1 && b === 1 && globalMaxCaptures === 0) {
        statusText = "Beraberlik.";
    } else if (w === 0) {
        statusText = "Siyah kazandı.";
    } else if (b === 0) {
        statusText = "Beyaz kazandı.";
    } else {
        let hasMove = false;
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                if (boardState[r][c] && boardState[r][c].startsWith(turn)) {
                    if (getValidMoves(r, c).length > 0) {
                        hasMove = true;
                        break;
                    }
                }
            }
            if (hasMove) break;
        }
        if (!hasMove) {
            statusText = (turn === 'white' ? 'Siyah' : 'Beyaz') + " kazandı.";
        }
    }

    if (statusText) {
        $status.html(statusText);
    }
}

function updateUI() {
    updateStatus();
    updateMoveHistoryUI();
}

function updateStatus() {
    let moveColor = (turn === 'white') ? 'Beyaz' : 'Siyah';
    $status.html('Hamle: ' + moveColor);
}

function updateMoveHistoryUI() {
    $moveList.empty();
    for (let i = 0; i < moveHistory.length; i += 2) {
        let moveNum = Math.floor(i / 2) + 1;
        let whiteMove = moveHistory[i];
        let blackMove = moveHistory[i + 1] || "";

        let whiteIdx = i + 1;
        let blackIdx = i + 2;

        let row = `<tr>
            <td>${moveNum}</td>
            <td class="${currentViewIndex === whiteIdx ? 'active-move' : ''}" onclick="goToMove(${whiteIdx})">${whiteMove}</td>
            <td class="${currentViewIndex === blackIdx ? 'active-move' : ''}" onclick="goToMove(${blackIdx})">${blackMove}</td>
        </tr>`;
        $moveList.append(row);
    }
    const container = $('.move-history-container');
    if (currentViewIndex === historyFens.length - 1) {
        container.scrollTop(container[0].scrollHeight);
    }
}

function goToMove(index) {
    if (isMultiJump) return;
    if (index < 0 || index >= historyFens.length) return;
    currentViewIndex = index;

    let pastTurn = (index % 2 === 0) ? 'white' : 'black';
    let moveColor = (pastTurn === 'white') ? 'Beyaz' : 'Siyah';
    $status.html('Hamle: ' + moveColor);

    selectedSquare = null;
    availableMoves = [];
    renderBoard();
    updateMoveHistoryUI();
}

function copyNotation() {
    if (moveHistory.length === 0) return;
    let text = "";
    for (let i = 0; i < moveHistory.length; i += 2) {
        text += (Math.floor(i / 2) + 1) + ". " + moveHistory[i] + " ";
        if (moveHistory[i + 1]) text += moveHistory[i + 1] + " ";
    }
    navigator.clipboard.writeText(text.trim()).then(() => {
        const originalText = $('#copyBtn').text();
        $('#copyBtn').text('Kopyalandı!');
        setTimeout(() => $('#copyBtn').text(originalText), 1500);
    });
}

$('#undoBtn').on('click', () => {
    if (isMultiJump) return;
    if (historyFens.length > 1) {
        historyFens.pop();
        moveHistory.pop();
        boardState = JSON.parse(historyFens[historyFens.length - 1]);
        currentViewIndex = historyFens.length - 1;
        turn = (currentViewIndex % 2 === 0) ? 'white' : 'black';
        isMultiJump = false;
        selectedSquare = null;
        availableMoves = [];
        calculateGlobalMax();
        updateUI();
        renderBoard();
    }
});

$('#resetBtn').on('click', () => {
    if (confirm("Yeni oyun başlatılsın mı?")) initGame();
});

$('#copyBtn').on('click', copyNotation);

document.addEventListener('keydown', (e) => {
    if (isMultiJump) return;
    if (e.key === 'ArrowLeft') goToMove(currentViewIndex - 1);
    else if (e.key === 'ArrowRight') goToMove(currentViewIndex + 1);
});

initGame();