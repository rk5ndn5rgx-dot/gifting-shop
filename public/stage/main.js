// Firebase imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js";
import { getFirestore, collection, onSnapshot, query, orderBy, limit, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";

// Firebase config
const firebaseConfig = {
    apiKey: "AIzaSyC0H4lqKw_mXI7-7RZ8v5YRz9p3Q8kL2Xc",
    authDomain: "studio-2fb13.firebaseapp.com",
    projectId: "studio-2fb13",
    storageBucket: "studio-2fb13.firebasestorage.app",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abcdef1234567890"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Stage initialization - listen for gift events
async function initStage() {
    const animationZone = document.getElementById('animation-zone');
    
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            // Listen to gift events in real-time
            const giftsRef = collection(db, 'gifts');
            const q = query(giftsRef, orderBy('createdAt', 'desc'), limit(1));
            
            onSnapshot(q, (snapshot) => {
                snapshot.docChanges().forEach((change) => {
                    if (change.type === 'added') {
                        const gift = change.doc.data();
                        displayGiftAnimation(gift);
                    }
                });
            });
        }
    });
}

// Display gift animation
function displayGiftAnimation(gift) {
    const animationZone = document.getElementById('animation-zone');
    const giftElement = document.createElement('div');
    giftElement.className = 'gift-animation';
    giftElement.innerHTML = `
        <div style="text-align: center; font-size: 3rem;">
            ${gift.emoji || '🎁'}
            <p style="font-size: 1rem; margin-top: 1rem;">${gift.from} sent ${gift.to} a ${gift.name}!</p>
        </div>
    `;
    
    animationZone.innerHTML = '';
    animationZone.appendChild(giftElement);
    
    // Remove animation after 3 seconds
    setTimeout(() => {
        animationZone.innerHTML = '<p>Waiting for gift events...</p>';
    }, 3000);
}

// Start the stage
initStage();
console.log('Stage initialized');
