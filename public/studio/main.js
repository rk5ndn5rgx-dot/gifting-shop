// Firebase imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js";
import { getFirestore, collection, onSnapshot, query, where, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";

// Firebase config (same as main app)
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

// Studio initialization
async function initStudio() {
    const contentDiv = document.getElementById('studio-content');
    
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            contentDiv.innerHTML = `<p>Welcome to Studio 4.0, <strong>${user.displayName || user.email}</strong>!</p>`;
            
            // Set up Firestore listener for user's projects
            const userProjectsRef = collection(db, 'users', user.uid, 'projects');
            onSnapshot(userProjectsRef, (snapshot) => {
                let html = `<h2>Your Projects</h2><ul>`;
                snapshot.forEach((doc) => {
                    const project = doc.data();
                    html += `<li><strong>${project.name}</strong> - ${project.description || 'No description'}</li>`;
                });
                html += `</ul>`;
                contentDiv.innerHTML = html;
            });
        } else {
            contentDiv.innerHTML = `<p>Please sign in to access Studio 4.0.</p>`;
        }
    });
}

// Start the studio
initStudio();
console.log('Studio 4.0 initialized');
