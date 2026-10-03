/**
 * Auth Module for ChronoTacToe
 * Handles Google Sign-In via Firebase Auth with local guest/mock fallback.
 */

import { 
    auth, 
    googleProvider, 
    isRealFirebase, 
    signInWithPopup, 
    signOut, 
    onAuthStateChanged 
} from './firebase-config.js';

let currentUser = null;
const authListeners = new Set();

export function getCurrentUser() {
    return currentUser;
}

export function onAuthChange(callback) {
    authListeners.add(callback);
    callback(currentUser);
    return () => authListeners.delete(callback);
}

function notifyAuthListeners() {
    authListeners.forEach(cb => cb(currentUser));
}

// Check saved guest user in localStorage
try {
    const savedUser = localStorage.getItem('chrono_current_user');
    if (savedUser) currentUser = JSON.parse(savedUser);
} catch (e) {
    console.warn("Error reading stored user:", e);
}

if (isRealFirebase && auth) {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            currentUser = {
                uid: user.uid,
                displayName: user.displayName || 'Google Player',
                email: user.email,
                photoURL: user.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.uid}`,
                isGoogle: true
            };
            localStorage.setItem('chrono_current_user', JSON.stringify(currentUser));
        } else if (!localStorage.getItem('chrono_current_user')) {
            currentUser = null;
        }
        notifyAuthListeners();
    });
}

/**
 * Trigger Google Sign-In
 */
export async function loginWithGoogle() {
    if (isRealFirebase && auth) {
        try {
            const result = await signInWithPopup(auth, googleProvider);
            const user = result.user;
            currentUser = {
                uid: user.uid,
                displayName: user.displayName || 'Google Player',
                email: user.email,
                photoURL: user.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.uid}`,
                isGoogle: true
            };
            localStorage.setItem('chrono_current_user', JSON.stringify(currentUser));
            notifyAuthListeners();
            return currentUser;
        } catch (err) {
            console.warn("Google Sign-In Popup failed or was cancelled:", err.message);
            // Fallback to guest simulation login
            return loginAsMockGoogleUser();
        }
    } else {
        return loginAsMockGoogleUser();
    }
}

/**
 * Mock Google Sign-In Fallback (when testing without live Firebase OAuth client domain setup)
 */
export function loginAsMockGoogleUser(name = 'Google Player') {
    const randomId = Math.random().toString(36).substring(2, 9);
    currentUser = {
        uid: `google_user_${randomId}`,
        displayName: name,
        email: `player_${randomId}@gmail.com`,
        photoURL: `https://api.dicebear.com/7.x/bottts/svg?seed=${randomId}`,
        isGoogle: true,
        isSimulated: true
    };
    localStorage.setItem('chrono_current_user', JSON.stringify(currentUser));
    notifyAuthListeners();
    return currentUser;
}

/**
 * Sign Out User
 */
export async function logoutUser() {
    if (isRealFirebase && auth) {
        try {
            await signOut(auth);
        } catch (e) {
            console.warn("SignOut error:", e);
        }
    }
    currentUser = null;
    localStorage.removeItem('chrono_current_user');
    notifyAuthListeners();
}
