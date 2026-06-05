// Firebase imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js";
import { getFirestore, collection, onSnapshot, query, where, doc, getDoc, updateDoc, increment } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";
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

// Gift Shelf initialization
async function initGiftShelf() {
    const balanceDisplay = document.getElementById('balance-display');
    const giftList = document.getElementById('gift-list');
    
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            // Listen to user balance (A.I. Dollars)
            const userRef = doc(db, 'users', user.uid);
            onSnapshot(userRef, (snapshot) => {
                if (snapshot.exists()) {
                    const userData = snapshot.data();
                    const balance = userData.balance || 0;
                    balanceDisplay.innerHTML = `
                        <div>
                            <p>Your A.I. Dollar Balance</p>
                            <p style="font-size: 2.5rem; font-weight: bold; margin-top: 0.5rem;">💰 ${balance}</p>
                        </div>
                    `;
                }
            });
            
            // Listen to user's gifts
            const userGiftsRef = collection(db, 'users', user.uid, 'gifts');
            onSnapshot(userGiftsRef, (snapshot) => {
                let html = '';
                if (snapshot.empty) {
                    html = '<p>No gifts yet. Start collecting!</p>';
                } else {
                    snapshot.forEach((doc) => {
                        const gift = doc.data();
                        html += `
                            <div class="gift-item" onclick="sendGift('${doc.id}', '${gift.name}')">
                                <div class="emoji">${gift.emoji || '🎁'}</div>
                                <div class="name">${gift.name}</div>
                                <div class="price">💰 ${gift.price}</div>
                            </div>
                        `;
                    });
                }
                giftList.innerHTML = html || '<p>No gifts available</p>';
            });
        } else {
            balanceDisplay.innerHTML = '<p>Please sign in to view your gift shelf</p>';
            giftList.innerHTML = '<p>Please sign in</p>';
        }
    });
}

// Send gift to another user
async function sendGift(giftId, giftName) {
    const user = auth.currentUser;
    if (!user) {
        alert('Please sign in first');
        return;
    }
    
    const targetUserId = prompt('Enter the recipient\'s user ID:');
    if (!targetUserId) return;
    
    try {
        const userRef = doc(db, 'users', user.uid);
        const targetRef = doc(db, 'users', targetUserId);
        
        // Deduct from sender
        await updateDoc(userRef, {
            balance: increment(-10) // Example: 10 A.I. Dollars per gift
        });
        
        // Add to recipient
        await updateDoc(targetRef, {
            balance: increment(10)
        });
        
        alert(`You sent ${giftName} to ${targetUserId}!`);
    } catch (error) {
        console.error('Error sending gift:', error);
        alert('Failed to send gift');
    }
}

// Start the gift shelf
initGiftShelf();
console.log('Gift Shelf initialized');

// Expose function globally
window.sendGift = sendGift;
