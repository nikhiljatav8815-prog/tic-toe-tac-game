/**
 * Firebase Initialization & Fallback Event Store
 * Supports both real Firebase (Auth + Firestore) and Local Storage fallback mode.
 */

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { 
    getAuth, 
    GoogleAuthProvider, 
    signInWithPopup, 
    signOut, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { 
    getFirestore, 
    collection, 
    doc, 
    setDoc, 
    getDoc, 
    getDocs, 
    addDoc, 
    query, 
    orderBy, 
    onSnapshot, 
    serverTimestamp,
    deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// Default placeholder config
const DEFAULT_FIREBASE_CONFIG = {
    apiKey: "AIzaSyDemoKeyForChronoTacToeLocalApp12345",
    authDomain: "chrono-tac-toe-demo.firebaseapp.com",
    projectId: "chrono-tac-toe-demo",
    storageBucket: "chrono-tac-toe-demo.appspot.com",
    messagingSenderId: "123456789012",
    appId: "1:123456789012:web:demo123456"
};

export function getStoredFirebaseConfig() {
    try {
        const saved = localStorage.getItem('chrono_fb_config');
        if (saved) return JSON.parse(saved);
    } catch (e) {
        console.warn('Failed to parse stored Firebase config:', e);
    }
    return DEFAULT_FIREBASE_CONFIG;
}

export function saveFirebaseConfig(configObj) {
    localStorage.setItem('chrono_fb_config', JSON.stringify(configObj));
}

let firebaseApp = null;
let authInstance = null;
let dbInstance = null;
let googleProviderInstance = new GoogleAuthProvider();
let isRealFirebase = false;

try {
    const config = getStoredFirebaseConfig();
    if (config && config.apiKey && config.projectId && !config.apiKey.includes("DemoKey")) {
        firebaseApp = getApps().length === 0 ? initializeApp(config) : getApp();
        authInstance = getAuth(firebaseApp);
        dbInstance = getFirestore(firebaseApp);
        isRealFirebase = true;
        console.log("Firebase initialized successfully with config:", config.projectId);
    } else {
        console.warn("No custom Firebase config found. Using Fallback Store for local simulation & testing.");
    }
} catch (err) {
    console.warn("Firebase initialization error, using local fallback mode:", err);
}

/**
 * Local Storage & Memory Fallback Store replicating Firestore subcollections
 * Allows testing multiplayer & event sourcing even without a live Firebase API Key!
 */
class LocalEventStore {
    constructor() {
        this.listeners = new Map();
        this.games = JSON.parse(localStorage.getItem('chrono_local_games') || '{}');
        this.events = JSON.parse(localStorage.getItem('chrono_local_events') || '{}');
    }

    _save() {
        localStorage.setItem('chrono_local_games', JSON.stringify(this.games));
        localStorage.setItem('chrono_local_events', JSON.stringify(this.events));
    }

    async setGameDoc(gameId, data) {
        this.games[gameId] = { ...this.games[gameId], ...data, updatedAt: Date.now() };
        this._save();
        this._notify(gameId);
    }

    async getGameDoc(gameId) {
        return this.games[gameId] || null;
    }

    async findGameByCode(code) {
        const uppercaseCode = code.toUpperCase();
        for (const [id, game] of Object.entries(this.games)) {
            if (game.code === uppercaseCode) return { id, ...game };
        }
        return null;
    }

    async addEvent(gameId, eventData) {
        if (!this.events[gameId]) this.events[gameId] = [];
        const seq = this.events[gameId].length + 1;
        const newEv = {
            id: `ev_${seq}_${Date.now()}`,
            sequence: seq,
            timestamp: Date.now(),
            ...eventData
        };
        this.events[gameId].push(newEv);
        this._save();
        this._notify(gameId);
        return newEv;
    }

    async getEvents(gameId) {
        return this.events[gameId] || [];
    }

    async truncateEventsAfter(gameId, sequence) {
        if (!this.events[gameId]) return;
        this.events[gameId] = this.events[gameId].filter(e => e.sequence <= sequence);
        this._save();
        this._notify(gameId);
    }

    subscribeEvents(gameId, callback) {
        if (!this.listeners.has(gameId)) {
            this.listeners.set(gameId, new Set());
        }
        this.listeners.get(gameId).add(callback);

        // Immediate initial trigger
        callback(this.events[gameId] || []);

        // Listen to storage events across browser tabs for real multi-tab local testing!
        const storageHandler = (e) => {
            if (e.key === 'chrono_local_events' || e.key === 'chrono_local_games') {
                this.events = JSON.parse(localStorage.getItem('chrono_local_events') || '{}');
                this.games = JSON.parse(localStorage.getItem('chrono_local_games') || '{}');
                callback(this.events[gameId] || []);
            }
        };
        window.addEventListener('storage', storageHandler);

        return () => {
            if (this.listeners.has(gameId)) {
                this.listeners.get(gameId).delete(callback);
            }
            window.removeEventListener('storage', storageHandler);
        };
    }

    _notify(gameId) {
        if (this.listeners.has(gameId)) {
            const evList = this.events[gameId] || [];
            this.listeners.get(gameId).forEach(cb => cb(evList));
        }
    }
}

export const localStore = new LocalEventStore();
export { 
    firebaseApp, 
    authInstance as auth, 
    dbInstance as db, 
    googleProviderInstance as googleProvider, 
    isRealFirebase,
    signInWithPopup, 
    signOut, 
    onAuthStateChanged,
    collection, 
    doc, 
    setDoc, 
    getDoc, 
    getDocs, 
    addDoc, 
    query, 
    orderBy, 
    onSnapshot, 
    serverTimestamp,
    deleteDoc
};
