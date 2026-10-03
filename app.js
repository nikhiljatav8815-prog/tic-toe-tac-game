/**
 * Main Application Orchestrator for ChronoTacToe
 * Connects Firebase Auth, Firestore Event Sourcing, AI Minimax Engine, Time Travel & UI.
 */

import { loginWithGoogle, logoutUser, onAuthChange, getCurrentUser } from './auth.js';
import { getAIMove } from './ai-minimax.js';
import { reconstructGameState, EVENT_TYPES, GAME_STATUS, generateGameCode } from './event-sourcing.js';
import { soundEngine } from './audio.js';
import { 
    db, 
    isRealFirebase, 
    doc, 
    setDoc, 
    getDoc, 
    addDoc, 
    collection, 
    onSnapshot, 
    query, 
    orderBy, 
    serverTimestamp,
    saveFirebaseConfig,
    localStore 
} from './firebase-config.js';

// Application State
let activeGameId = null;
let activeGameMode = 'ai'; // 'ai' or 'multiplayer'
let aiDifficulty = 'unbeatable'; // 'unbeatable' | 'medium' | 'easy'
let userSymbol = 'X'; // 'X' or 'O'
let activeRoomCode = null;

let rawEvents = []; // Sorted array of event documents from Firestore
let currentReconstructedState = null;
let previewSequence = null; // null when watching live, number when previewing past turn

let unsubscribeEvents = null;
let isAiThinking = false;

// DOM Element Cache
const dom = {
    // Auth & Header
    googleSigninBtn: document.getElementById('google-signin-btn'),
    userProfile: document.getElementById('user-profile'),
    userAvatar: document.getElementById('user-avatar'),
    userName: document.getElementById('user-name'),
    signoutBtn: document.getElementById('signout-btn'),
    soundBtn: document.getElementById('sound-btn'),
    soundIcon: document.getElementById('sound-icon'),
    configBtn: document.getElementById('config-btn'),

    // Lobby
    lobbySection: document.getElementById('lobby-section'),
    aiDifficulty: document.getElementById('ai-difficulty'),
    symbolBtns: document.querySelectorAll('.symbol-btn'),
    startAiBtn: document.getElementById('start-ai-btn'),
    createRoomBtn: document.getElementById('create-room-btn'),
    joinRoomBtn: document.getElementById('join-room-btn'),
    roomCodeInput: document.getElementById('room-code-input'),

    // Game Section
    gameSection: document.getElementById('game-section'),
    gameModeBadge: document.getElementById('game-mode-badge'),
    gameCodeBadge: document.getElementById('game-code-badge'),
    currentRoomCode: document.getElementById('current-room-code'),
    copyCodeBtn: document.getElementById('copy-code-btn'),

    // Player Info
    playerCardX: document.getElementById('player-card-x'),
    playerCardO: document.getElementById('player-card-o'),
    nameX: document.getElementById('name-x'),
    roleX: document.getElementById('role-x'),
    nameO: document.getElementById('name-o'),
    roleO: document.getElementById('role-o'),

    // Status Banners
    statusBanner: document.getElementById('game-status-banner'),
    statusText: document.getElementById('status-text'),
    previewBanner: document.getElementById('preview-mode-banner'),
    previewStepNum: document.getElementById('preview-step-num'),
    restoreTurnBtn: document.getElementById('restore-turn-btn'),
    exitPreviewBtn: document.getElementById('exit-preview-btn'),

    // Board
    boardGrid: document.getElementById('board-grid'),
    cells: document.querySelectorAll('.cell'),
    winningLineSvg: document.getElementById('winning-line-svg'),
    winningLine: document.getElementById('winning-line'),

    // Controls
    leaveGameBtn: document.getElementById('leave-game-btn'),
    restartGameBtn: document.getElementById('restart-game-btn'),
    shareLinkBtn: document.getElementById('share-link-btn'),

    // Time Travel Sidebar
    totalEventsCount: document.getElementById('total-events-count'),
    btnFirstStep: document.getElementById('btn-first-step'),
    btnPrevStep: document.getElementById('btn-prev-step'),
    scrubberText: document.getElementById('scrubber-text'),
    btnNextStep: document.getElementById('btn-next-step'),
    btnLatestStep: document.getElementById('btn-latest-step'),
    timelineSlider: document.getElementById('timeline-slider'),
    eventStreamList: document.getElementById('event-stream-list'),

    // Modals & Toast
    shareModal: document.getElementById('share-modal'),
    modalGameCode: document.getElementById('modal-game-code'),
    modalCopyCodeBtn: document.getElementById('modal-copy-code-btn'),
    modalShareLink: document.getElementById('modal-share-link'),
    modalCopyLinkBtn: document.getElementById('modal-copy-link-btn'),

    configModal: document.getElementById('config-modal'),
    fbConfigJson: document.getElementById('fb-config-json'),
    saveFbConfigBtn: document.getElementById('save-fb-config-btn'),
    resetFbConfigBtn: document.getElementById('reset-fb-config-btn'),

    toast: document.getElementById('toast'),
    toastMsg: document.getElementById('toast-msg'),
    toastIcon: document.getElementById('toast-icon')
};

// ==========================================
// 1. INITIALIZATION & AUTH LISTENERS
// ==========================================
function initApp() {
    setupEventListeners();
    onAuthChange(updateAuthUI);

    // Check for room code in URL query string: ?join=XXXXXX
    const urlParams = new URLSearchParams(window.location.search);
    const joinCode = urlParams.get('join') || urlParams.get('code');
    if (joinCode) {
        dom.roomCodeInput.value = joinCode.toUpperCase();
        showToast(`Room code ${joinCode} loaded from link! Click Join Room to start.`);
    }
}

function updateAuthUI(user) {
    if (user) {
        dom.googleSigninBtn.classList.add('hidden');
        dom.userProfile.classList.remove('hidden');
        dom.userAvatar.src = user.photoURL;
        dom.userName.textContent = user.displayName;
    } else {
        dom.googleSigninBtn.classList.remove('hidden');
        dom.userProfile.classList.add('hidden');
    }
}

// ==========================================
// 2. LOBBY & GAME SETUP
// ==========================================
async function startAIGame() {
    const user = getCurrentUser() || { displayName: 'Player' };
    activeGameMode = 'ai';
    aiDifficulty = dom.aiDifficulty.value;
    activeGameId = `ai_${Date.now()}`;
    activeRoomCode = null;
    previewSequence = null;

    const gameData = {
        id: activeGameId,
        mode: 'ai',
        difficulty: aiDifficulty,
        userSymbol: userSymbol,
        players: {
            X: userSymbol === 'X' ? { name: user.displayName, isAI: false } : { name: `Minimax AI (${aiDifficulty})`, isAI: true },
            O: userSymbol === 'O' ? { name: user.displayName, isAI: false } : { name: `Minimax AI (${aiDifficulty})`, isAI: true }
        },
        createdAt: Date.now()
    };

    if (isRealFirebase && db) {
        await setDoc(doc(db, 'games', activeGameId), gameData);
    } else {
        await localStore.setGameDoc(activeGameId, gameData);
    }

    subscribeToGameEvents(activeGameId);
    showGameScreen(gameData);

    // If AI goes first (Human selected 'O')
    if (userSymbol === 'O') {
        setTimeout(triggerAIMoveIfNeeded, 500);
    }
}

async function createMultiplayerRoom() {
    let user = getCurrentUser();
    if (!user) {
        user = await loginWithGoogle();
        if (!user) return;
    }

    activeGameMode = 'multiplayer';
    activeGameId = `mp_${Date.now()}`;
    activeRoomCode = generateGameCode();
    userSymbol = 'X';
    previewSequence = null;

    const gameData = {
        id: activeGameId,
        code: activeRoomCode,
        mode: 'multiplayer',
        players: {
            X: { uid: user.uid, name: user.displayName, isHost: true },
            O: { uid: null, name: 'Waiting for player...', isHost: false }
        },
        createdAt: Date.now()
    };

    if (isRealFirebase && db) {
        await setDoc(doc(db, 'games', activeGameId), gameData);
    } else {
        await localStore.setGameDoc(activeGameId, gameData);
    }

    subscribeToGameEvents(activeGameId);
    showGameScreen(gameData);
    openShareModal(activeRoomCode);
}

async function joinMultiplayerRoom(code) {
    if (!code || code.trim().length !== 6) {
        showToast('Please enter a valid 6-character game code.', 'error');
        return;
    }

    let user = getCurrentUser();
    if (!user) {
        user = await loginWithGoogle();
        if (!user) return;
    }

    const cleanCode = code.trim().toUpperCase();
    let gameData = null;

    if (isRealFirebase && db) {
        // Query Firestore for matching code
        const querySnap = await getDocs(query(collection(db, 'games'), orderBy('createdAt', 'desc')));
        querySnap.forEach(d => {
            if (d.data().code === cleanCode) {
                gameData = { id: d.id, ...d.data() };
            }
        });
    } else {
        gameData = await localStore.findGameByCode(cleanCode);
    }

    if (!gameData) {
        showToast(`Room with code "${cleanCode}" not found.`, 'error');
        return;
    }

    activeGameMode = 'multiplayer';
    activeGameId = gameData.id;
    activeRoomCode = cleanCode;
    previewSequence = null;

    // Assign user symbol (if host, X; else O)
    if (gameData.players.X.uid === user.uid) {
        userSymbol = 'X';
    } else {
        userSymbol = 'O';
        gameData.players.O = { uid: user.uid, name: user.displayName, isHost: false };
        if (isRealFirebase && db) {
            await setDoc(doc(db, 'games', activeGameId), gameData, { merge: true });
        } else {
            await localStore.setGameDoc(activeGameId, gameData);
        }
    }

    subscribeToGameEvents(activeGameId);
    showGameScreen(gameData);
    showToast(`Successfully joined room ${cleanCode}!`);
}

// ==========================================
// 3. FIRESTORE EVENT STREAM SUBSCRIPTION
// ==========================================
function subscribeToGameEvents(gameId) {
    if (unsubscribeEvents) {
        unsubscribeEvents();
        unsubscribeEvents = null;
    }

    if (isRealFirebase && db) {
        const eventsRef = collection(db, 'games', gameId, 'events');
        const q = query(eventsRef, orderBy('sequence', 'asc'));

        unsubscribeEvents = onSnapshot(q, (snapshot) => {
            const evs = [];
            snapshot.forEach(docSnap => {
                evs.push({ id: docSnap.id, ...docSnap.data() });
            });
            onEventsUpdated(evs);
        }, (error) => {
            console.warn("Firestore snapshot error, falling back to localStore:", error);
            localStore.subscribeEvents(gameId, onEventsUpdated);
        });
    } else {
        unsubscribeEvents = localStore.subscribeEvents(gameId, onEventsUpdated);
    }
}

function onEventsUpdated(eventsList) {
    rawEvents = eventsList;
    
    // Reconstruct state from events
    currentReconstructedState = reconstructGameState(rawEvents, previewSequence, 'X');

    // Update UI components
    renderBoard(currentReconstructedState);
    renderPlayerCards(currentReconstructedState);
    renderStatusBanner(currentReconstructedState);
    renderTimeTravelSidebar(rawEvents, currentReconstructedState);

    // Trigger AI move if it's AI's turn and game is ongoing
    if (activeGameMode === 'ai' && previewSequence === null && currentReconstructedState.status === GAME_STATUS.PLAYING) {
        triggerAIMoveIfNeeded();
    }
}

// ==========================================
// 4. PLAYER MOVES & EVENT EMISSION
// ==========================================
async function handleCellClick(index) {
    if (!currentReconstructedState) return;

    // Disallow moves if previewing past state (time travelling)
    if (previewSequence !== null) {
        showToast('Exit Time Travel preview mode to make a live move!', 'warning');
        return;
    }

    // Check game active
    if (currentReconstructedState.status !== GAME_STATUS.PLAYING) return;

    // Check cell empty
    if (currentReconstructedState.board[index] !== null) return;

    // Check user's turn
    if (currentReconstructedState.currentTurn !== userSymbol && activeGameMode === 'multiplayer') {
        showToast(`It is Player ${currentReconstructedState.currentTurn}'s turn!`, 'warning');
        return;
    }

    if (activeGameMode === 'ai' && currentReconstructedState.currentTurn !== userSymbol) {
        return; // Wait for AI move
    }

    // Sound effect
    soundEngine.playMove(userSymbol);

    // Emit MOVE Event document into Firestore subcollection
    const nextSeq = rawEvents.length + 1;
    const user = getCurrentUser() || { displayName: 'Player' };

    const eventDoc = {
        sequence: nextSeq,
        type: EVENT_TYPES.MOVE,
        player: userSymbol,
        position: index,
        timestamp: Date.now(),
        userUid: user.uid || 'guest',
        userName: user.displayName || 'Player'
    };

    await emitEventToSubcollection(activeGameId, eventDoc);
}

async function triggerAIMoveIfNeeded() {
    if (!currentReconstructedState) return;
    if (currentReconstructedState.status !== GAME_STATUS.PLAYING) return;
    if (isAiThinking) return;

    const aiSymbol = userSymbol === 'X' ? 'O' : 'X';
    if (currentReconstructedState.currentTurn !== aiSymbol) return;

    isAiThinking = true;

    // Small async delay (250ms) for natural UI feel and non-blocking execution
    setTimeout(async () => {
        try {
            // Calculate AI move using pure Minimax algorithm with Alpha-Beta pruning
            const aiMoveIndex = getAIMove(currentReconstructedState.board, aiSymbol, aiDifficulty);

            if (aiMoveIndex >= 0 && aiMoveIndex <= 8) {
                soundEngine.playMove(aiSymbol);
                const nextSeq = rawEvents.length + 1;
                const aiEventDoc = {
                    sequence: nextSeq,
                    type: EVENT_TYPES.MOVE,
                    player: aiSymbol,
                    position: aiMoveIndex,
                    timestamp: Date.now(),
                    userUid: 'minimax_ai',
                    userName: `Minimax AI (${aiDifficulty})`
                };

                await emitEventToSubcollection(activeGameId, aiEventDoc);
            }
        } finally {
            isAiThinking = false;
        }
    }, 250);
}

async function emitEventToSubcollection(gameId, eventDoc) {
    if (isRealFirebase && db) {
        try {
            const eventsSubcollection = collection(db, 'games', gameId, 'events');
            await addDoc(eventsSubcollection, {
                ...eventDoc,
                serverTime: serverTimestamp()
            });
        } catch (e) {
            console.warn("Error adding Firestore event document, writing to localStore:", e);
            await localStore.addEvent(gameId, eventDoc);
        }
    } else {
        await localStore.addEvent(gameId, eventDoc);
    }
}

// ==========================================
// 5. TIME TRAVEL & ROLLBACK FUNCTIONALITY
// ==========================================
function setTimeTravelPreview(sequence) {
    if (sequence === null || sequence >= rawEvents.length) {
        previewSequence = null;
    } else {
        previewSequence = Math.max(0, sequence);
    }
    soundEngine.playTimeTravel();
    onEventsUpdated(rawEvents);
}

async function executeRollbackToTurn(targetSequence) {
    if (!activeGameId || targetSequence === null) return;

    const user = getCurrentUser() || { displayName: 'Player' };
    const nextSeq = rawEvents.length + 1;

    // Append ROLLBACK Event document into Firestore subcollection
    const rollbackEvent = {
        sequence: nextSeq,
        type: EVENT_TYPES.ROLLBACK,
        targetSequence: targetSequence,
        player: userSymbol,
        timestamp: Date.now(),
        userUid: user.uid || 'guest',
        userName: user.displayName || 'Player'
    };

    if (!isRealFirebase || !db) {
        // Option to truncate localStore for clean history
        await localStore.truncateEventsAfter(activeGameId, targetSequence);
    } else {
        await emitEventToSubcollection(activeGameId, rollbackEvent);
    }

    previewSequence = null;
    showToast(`Rolled back match state to Turn #${targetSequence}!`, 'success');
}

// ==========================================
// 6. UI RENDERING PIPELINE
// ==========================================
function showGameScreen(gameData) {
    dom.lobbySection.classList.add('hidden');
    dom.gameSection.classList.remove('hidden');

    if (gameData.mode === 'ai') {
        dom.gameModeBadge.innerHTML = `<i class="fa-solid fa-robot"></i> VS AI (${gameData.difficulty})`;
        dom.gameCodeBadge.classList.add('hidden');
        dom.shareLinkBtn.classList.add('hidden');

        dom.nameX.textContent = gameData.players.X.name;
        dom.nameO.textContent = gameData.players.O.name;
        dom.roleX.textContent = userSymbol === 'X' ? 'You' : 'Opponent';
        dom.roleO.textContent = userSymbol === 'O' ? 'You' : 'Opponent';
    } else {
        dom.gameModeBadge.innerHTML = `<i class="fa-solid fa-users"></i> Online Match`;
        dom.gameCodeBadge.classList.remove('hidden');
        dom.currentRoomCode.textContent = gameData.code;
        dom.shareLinkBtn.classList.remove('hidden');

        dom.nameX.textContent = gameData.players.X.name;
        dom.nameO.textContent = gameData.players.O.name;
        dom.roleX.textContent = userSymbol === 'X' ? 'You (Host)' : 'Host';
        dom.roleO.textContent = userSymbol === 'O' ? 'You' : 'Guest';
    }
}

function renderBoard(state) {
    const { board, winningLine, status } = state;

    dom.cells.forEach((cell, idx) => {
        const mark = board[idx];
        cell.className = 'cell';
        cell.textContent = '';

        if (mark) {
            cell.classList.add('occupied', mark === 'X' ? 'mark-x' : 'mark-o');
            cell.textContent = mark;
        }

        if (winningLine && winningLine.includes(idx)) {
            cell.classList.add('winning-cell');
        }
    });

    // Draw SVG winning line strike
    if (winningLine) {
        drawWinningLine(winningLine);
    } else {
        dom.winningLineSvg.style.display = 'none';
    }
}

function drawWinningLine(combo) {
    const coords = [
        [50, 50],   [150, 50],   [250, 50],   // Row 0, 1, 2
        [50, 150],  [150, 150],  [250, 150],  // Row 3, 4, 5
        [50, 250],  [150, 250],  [250, 250]   // Row 6, 7, 8
    ];

    const start = coords[combo[0]];
    const end = coords[combo[2]];

    dom.winningLine.setAttribute('x1', start[0]);
    dom.winningLine.setAttribute('y1', start[1]);
    dom.winningLine.setAttribute('x2', end[0]);
    dom.winningLine.setAttribute('y2', end[1]);
    dom.winningLineSvg.style.display = 'block';
}

function renderPlayerCards(state) {
    const { currentTurn, status } = state;

    if (status === GAME_STATUS.PLAYING) {
        if (currentTurn === 'X') {
            dom.playerCardX.classList.add('active-turn');
            dom.playerCardO.classList.remove('active-turn');
        } else {
            dom.playerCardO.classList.add('active-turn');
            dom.playerCardX.classList.remove('active-turn');
        }
    } else {
        dom.playerCardX.classList.remove('active-turn');
        dom.playerCardO.classList.remove('active-turn');
    }
}

function renderStatusBanner(state) {
    const { status, winner, isTimeTravelling, currentReplaySequence } = state;

    if (isTimeTravelling) {
        dom.previewBanner.classList.remove('hidden');
        dom.statusBanner.classList.add('hidden');
        dom.previewStepNum.textContent = currentReplaySequence;
        return;
    }

    dom.previewBanner.classList.add('hidden');
    dom.statusBanner.classList.remove('hidden');

    if (status === GAME_STATUS.PLAYING) {
        const isMyTurn = state.currentTurn === userSymbol;
        dom.statusText.textContent = isMyTurn ? `Your turn! (Player ${userSymbol})` : `Opponent's turn (Player ${state.currentTurn})...`;
    } else if (status === GAME_STATUS.X_WIN) {
        const iWon = userSymbol === 'X';
        dom.statusText.textContent = iWon ? '🎉 Victory! Player X won the match!' : 'Player X won the match!';
        soundEngine.playWin();
        if (iWon && window.confetti) window.confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    } else if (status === GAME_STATUS.O_WIN) {
        const iWon = userSymbol === 'O';
        dom.statusText.textContent = iWon ? '🎉 Victory! Player O won the match!' : 'Player O won the match!';
        soundEngine.playWin();
        if (iWon && window.confetti) window.confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    } else if (status === GAME_STATUS.DRAW) {
        dom.statusText.textContent = '🤝 Game Draw! Perfect play on both sides.';
        soundEngine.playDraw();
    }
}

function renderTimeTravelSidebar(events, state) {
    const totalCount = events.length;
    dom.totalEventsCount.textContent = `${totalCount} Event${totalCount === 1 ? '' : 's'}`;

    // Timeline Slider
    dom.timelineSlider.max = totalCount;
    const currentStep = previewSequence !== null ? previewSequence : totalCount;
    dom.timelineSlider.value = currentStep;
    dom.scrubberText.textContent = `Turn ${currentStep} / ${totalCount}`;

    // Stream Console list
    dom.eventStreamList.innerHTML = '';
    if (events.length === 0) {
        dom.eventStreamList.innerHTML = '<div class="empty-stream">No Firestore events recorded yet.</div>';
        return;
    }

    events.forEach(ev => {
        const row = document.createElement('div');
        row.className = `event-row ${currentStep === ev.sequence ? 'active-preview' : ''} ${ev.type === EVENT_TYPES.ROLLBACK ? 'event-rollback' : ''}`;
        
        let desc = '';
        if (ev.type === EVENT_TYPES.MOVE) {
            const rowIdx = Math.floor(ev.position / 3) + 1;
            const colIdx = (ev.position % 3) + 1;
            desc = `MOVE <span class="event-mark-${ev.player.toLowerCase()}">${ev.player}</span> at [R${rowIdx}, C${colIdx}]`;
        } else {
            desc = `ROLLBACK to Turn #${ev.targetSequence}`;
        }

        row.innerHTML = `
            <span class="event-seq">#${ev.sequence}</span>
            <span class="event-desc">${desc}</span>
        `;

        row.addEventListener('click', () => setTimeTravelPreview(ev.sequence));
        dom.eventStreamList.appendChild(row);
    });

    // Auto-scroll log to bottom if live
    if (previewSequence === null) {
        dom.eventStreamList.scrollTop = dom.eventStreamList.scrollHeight;
    }
}

// ==========================================
// 7. EVENT LISTENERS & MODAL HANDLERS
// ==========================================
function setupEventListeners() {
    // Auth buttons
    dom.googleSigninBtn.addEventListener('click', loginWithGoogle);
    dom.signoutBtn.addEventListener('click', logoutUser);

    // Audio button
    dom.soundBtn.addEventListener('click', () => {
        const isMuted = soundEngine.toggleMute();
        dom.soundIcon.className = isMuted ? 'fa-solid fa-volume-xmark' : 'fa-solid fa-volume-high';
    });

    // Symbol Toggle
    dom.symbolBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            dom.symbolBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            userSymbol = btn.dataset.symbol;
        });
    });

    // Start Game Buttons
    dom.startAiBtn.addEventListener('click', startAIGame);
    dom.createRoomBtn.addEventListener('click', createMultiplayerRoom);
    dom.joinRoomBtn.addEventListener('click', () => joinMultiplayerRoom(dom.roomCodeInput.value));

    // Cell Clicks
    dom.cells.forEach(cell => {
        cell.addEventListener('click', () => {
            const index = parseInt(cell.dataset.index, 10);
            handleCellClick(index);
        });
    });

    // Game Control Buttons
    dom.leaveGameBtn.addEventListener('click', () => {
        if (unsubscribeEvents) unsubscribeEvents();
        dom.gameSection.classList.add('hidden');
        dom.lobbySection.classList.remove('hidden');
    });

    dom.restartGameBtn.addEventListener('click', () => {
        if (activeGameMode === 'ai') startAIGame();
        else createMultiplayerRoom();
    });

    dom.shareLinkBtn.addEventListener('click', () => openShareModal(activeRoomCode));
    dom.copyCodeBtn.addEventListener('click', () => copyToClipboard(activeRoomCode, 'Room code copied!'));

    // Time Travel Controls
    dom.timelineSlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        setTimeTravelPreview(val >= rawEvents.length ? null : val);
    });

    dom.btnFirstStep.addEventListener('click', () => setTimeTravelPreview(0));
    dom.btnPrevStep.addEventListener('click', () => {
        const curr = previewSequence !== null ? previewSequence : rawEvents.length;
        setTimeTravelPreview(Math.max(0, curr - 1));
    });
    dom.btnNextStep.addEventListener('click', () => {
        if (previewSequence === null) return;
        const next = previewSequence + 1;
        setTimeTravelPreview(next >= rawEvents.length ? null : next);
    });
    dom.btnLatestStep.addEventListener('click', () => setTimeTravelPreview(null));

    dom.exitPreviewBtn.addEventListener('click', () => setTimeTravelPreview(null));
    dom.restoreTurnBtn.addEventListener('click', () => executeRollbackToTurn(previewSequence));

    // Modals Close Buttons
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modalId = btn.dataset.close;
            document.getElementById(modalId).classList.add('hidden');
        });
    });

    // Firebase Config Modal
    dom.configBtn.addEventListener('click', () => {
        dom.configModal.classList.remove('hidden');
    });

    dom.saveFbConfigBtn.addEventListener('click', () => {
        try {
            const configObj = JSON.parse(dom.fbConfigJson.value);
            saveFirebaseConfig(configObj);
            showToast('Firebase config saved! Reloading application...', 'success');
            setTimeout(() => window.location.reload(), 1200);
        } catch (e) {
            showToast('Invalid JSON format for Firebase config.', 'error');
        }
    });

    dom.resetFbConfigBtn.addEventListener('click', () => {
        localStorage.removeItem('chrono_fb_config');
        showToast('Firebase config reset. Reloading...', 'info');
        setTimeout(() => window.location.reload(), 1200);
    });

    // Modal Copy Buttons
    dom.modalCopyCodeBtn.addEventListener('click', () => copyToClipboard(activeRoomCode, 'Game code copied!'));
    dom.modalCopyLinkBtn.addEventListener('click', () => copyToClipboard(dom.modalShareLink.value, 'Match link copied!'));
}

function openShareModal(code) {
    if (!code) return;
    dom.modalGameCode.textContent = code;
    const shareUrl = `${window.location.origin}${window.location.pathname}?join=${code}`;
    dom.modalShareLink.value = shareUrl;
    dom.shareModal.classList.remove('hidden');
}

function copyToClipboard(text, successMessage = 'Copied to clipboard!') {
    navigator.clipboard.writeText(text).then(() => {
        showToast(successMessage, 'success');
    }).catch(err => {
        showToast('Failed to copy to clipboard.', 'error');
    });
}

function showToast(message, type = 'info') {
    dom.toastMsg.textContent = message;
    dom.toast.classList.remove('hidden');

    if (type === 'error') dom.toastIcon.className = 'fa-solid fa-circle-exclamation text-danger';
    else if (type === 'warning') dom.toastIcon.className = 'fa-solid fa-triangle-exclamation';
    else dom.toastIcon.className = 'fa-solid fa-circle-check';

    setTimeout(() => {
        dom.toast.classList.add('hidden');
    }, 3200);
}

// Start application
initApp();
