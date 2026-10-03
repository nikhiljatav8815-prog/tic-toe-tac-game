/**
 * Event Sourcing Core Engine for ChronoTacToe
 * Reconstructs game state by replaying event logs sequentially.
 */

import { checkWin, isBoardFull } from './ai-minimax.js';

/**
 * Event Types
 */
export const EVENT_TYPES = {
    MOVE: 'MOVE',
    ROLLBACK: 'ROLLBACK'
};

/**
 * Game Statuses
 */
export const GAME_STATUS = {
    WAITING: 'WAITING',
    PLAYING: 'PLAYING',
    X_WIN: 'X_WIN',
    O_WIN: 'O_WIN',
    DRAW: 'DRAW'
};

/**
 * Reconstructs current game state by replaying an array of event documents.
 * @param {Array} events - List of event documents sorted by sequence ascending
 * @param {number|null} maxSequence - If provided, replays only up to this sequence number (Time Travel)
 * @param {string} startingPlayer - 'X' or 'O'
 * @returns {Object} Reconstructed State
 */
export function reconstructGameState(events = [], maxSequence = null, startingPlayer = 'X') {
    // 1. Initialize fresh board state
    let board = [null, null, null, null, null, null, null, null, null];
    let currentTurn = startingPlayer;
    let status = GAME_STATUS.PLAYING;
    let winner = null;
    let winningLine = null;
    let lastMoveIndex = -1;

    // Filter events up to maxSequence if specified
    const sortedEvents = [...events].sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
    const eventsToReplay = maxSequence !== null 
        ? sortedEvents.filter(e => e.sequence <= maxSequence)
        : sortedEvents;

    // 2. Replay events sequentially
    for (let i = 0; i < eventsToReplay.length; i++) {
        const ev = eventsToReplay[i];

        if (ev.type === EVENT_TYPES.MOVE) {
            // Apply move if position is valid and cell empty
            if (ev.position >= 0 && ev.position <= 8 && board[ev.position] === null) {
                board[ev.position] = ev.player;
                lastMoveIndex = ev.position;

                // Check terminal states after move
                const winCombo = checkWin(board, ev.player);
                if (winCombo) {
                    status = ev.player === 'X' ? GAME_STATUS.X_WIN : GAME_STATUS.O_WIN;
                    winner = ev.player;
                    winningLine = winCombo;
                } else if (isBoardFull(board)) {
                    status = GAME_STATUS.DRAW;
                } else {
                    // Toggle turn
                    currentTurn = ev.player === 'X' ? 'O' : 'X';
                }
            }
        } else if (ev.type === EVENT_TYPES.ROLLBACK) {
            // Rollback event: Re-evaluate state up to targetSequence
            const targetSeq = ev.targetSequence !== undefined ? ev.targetSequence : ev.sequence - 1;
            const subEvents = eventsToReplay.slice(0, i).filter(e => e.sequence <= targetSeq);
            // Recursive replay up to target sequence
            const subState = reconstructGameState(subEvents, targetSeq, startingPlayer);
            board = subState.board;
            currentTurn = subState.currentTurn;
            status = subState.status;
            winner = subState.winner;
            winningLine = subState.winningLine;
            lastMoveIndex = subState.lastMoveIndex;
        }
    }

    const liveMaxSequence = sortedEvents.length > 0 ? sortedEvents[sortedEvents.length - 1].sequence : 0;
    const currentReplaySequence = eventsToReplay.length > 0 ? eventsToReplay[eventsToReplay.length - 1].sequence : 0;

    return {
        board,
        currentTurn,
        status,
        winner,
        winningLine,
        lastMoveIndex,
        totalEvents: sortedEvents.length,
        liveMaxSequence,
        currentReplaySequence,
        isTimeTravelling: maxSequence !== null && maxSequence < liveMaxSequence,
        replayedEventsCount: eventsToReplay.length
    };
}

/**
 * Helper to generate a unique 6-character game match code
 */
export function generateGameCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}
