/**
 * Pure Minimax Algorithm implementation for Tic-Tac-Toe.
 * Optimized with Alpha-Beta Pruning for instant performance.
 * Strictly deterministic game AI - NO LLM or Gemini API calls used!
 */

const WINNING_COMBOS = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
    [0, 4, 8], [2, 4, 6]             // Diagonals
];

export function checkWin(board, player) {
    for (const combo of WINNING_COMBOS) {
        if (board[combo[0]] === player && board[combo[1]] === player && board[combo[2]] === player) {
            return combo;
        }
    }
    return null;
}

export function isBoardFull(board) {
    return board.every(cell => cell !== null);
}

/**
 * Minimax algorithm with Alpha-Beta Pruning
 * @param {Array} board - 9-element array representing board state
 * @param {number} depth - current search depth
 * @param {boolean} isMaximizing - true if AI's turn, false if opponent's turn
 * @param {string} aiSymbol - 'X' or 'O'
 * @param {string} humanSymbol - 'O' or 'X'
 * @param {number} alpha - best score maximizer can guarantee
 * @param {number} beta - best score minimizer can guarantee
 */
function minimax(board, depth, isMaximizing, aiSymbol, humanSymbol, alpha = -Infinity, beta = Infinity) {
    if (checkWin(board, aiSymbol)) return 10 - depth;
    if (checkWin(board, humanSymbol)) return depth - 10;
    if (isBoardFull(board)) return 0;

    if (isMaximizing) {
        let bestScore = -Infinity;
        for (let i = 0; i < 9; i++) {
            if (board[i] === null) {
                board[i] = aiSymbol;
                let score = minimax(board, depth + 1, false, aiSymbol, humanSymbol, alpha, beta);
                board[i] = null;
                bestScore = Math.max(score, bestScore);
                alpha = Math.max(alpha, bestScore);
                if (beta <= alpha) break; // Alpha-Beta Cutoff
            }
        }
        return bestScore;
    } else {
        let bestScore = Infinity;
        for (let i = 0; i < 9; i++) {
            if (board[i] === null) {
                board[i] = humanSymbol;
                let score = minimax(board, depth + 1, true, aiSymbol, humanSymbol, alpha, beta);
                board[i] = null;
                bestScore = Math.min(score, bestScore);
                beta = Math.min(beta, bestScore);
                if (beta <= alpha) break; // Alpha-Beta Cutoff
            }
        }
        return bestScore;
    }
}

/**
 * Computes the best move for AI
 * @param {Array} board - current board state
 * @param {string} aiSymbol - 'X' or 'O'
 * @param {string} difficulty - 'unbeatable' | 'medium' | 'easy'
 * @returns {number} index 0-8
 */
export function getAIMove(board, aiSymbol = 'O', difficulty = 'unbeatable') {
    const emptyIndices = [];
    for (let i = 0; i < 9; i++) {
        if (board[i] === null) emptyIndices.push(i);
    }

    if (emptyIndices.length === 0) return -1;

    // Instant opening move optimization on empty board
    if (emptyIndices.length === 9) {
        const openings = [4, 0, 2, 6, 8]; // Center or corners
        return openings[Math.floor(Math.random() * openings.length)];
    }

    const humanSymbol = aiSymbol === 'X' ? 'O' : 'X';

    // Easy Difficulty: Mostly random
    if (difficulty === 'easy') {
        if (Math.random() > 0.3) {
            return emptyIndices[Math.floor(Math.random() * emptyIndices.length)];
        }
    }

    // Medium Difficulty: 60% Minimax, 40% Random
    if (difficulty === 'medium' && Math.random() < 0.4) {
        // Quick check for immediate win or block
        for (const idx of emptyIndices) {
            board[idx] = aiSymbol;
            if (checkWin(board, aiSymbol)) { board[idx] = null; return idx; }
            board[idx] = null;
        }
        for (const idx of emptyIndices) {
            board[idx] = humanSymbol;
            if (checkWin(board, humanSymbol)) { board[idx] = null; return idx; }
            board[idx] = null;
        }
        return emptyIndices[Math.floor(Math.random() * emptyIndices.length)];
    }

    // Unbeatable Minimax with Alpha-Beta Pruning
    let bestScore = -Infinity;
    let bestMove = emptyIndices[0];

    for (const idx of emptyIndices) {
        board[idx] = aiSymbol;
        let score = minimax(board, 0, false, aiSymbol, humanSymbol, -Infinity, Infinity);
        board[idx] = null;

        if (score > bestScore) {
            bestScore = score;
            bestMove = idx;
        }
    }

    return bestMove;
}

