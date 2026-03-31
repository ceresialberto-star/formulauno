import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js';
import { getFirestore, collection, addDoc, onSnapshot } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';

/**
 * F1 Coast Racer - Logica di Gioco Corretta
 * Forza l'esposizione delle funzioni all'oggetto window per l'HTML.
 */

// --- CONFIGURAZIONE DATABASE ---
const firebaseConfig = JSON.parse(__firebase_config);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'f1-coast-racer-school';

let user = null;
let scene, camera, renderer, player, pilot, pilotSuit;
let beach, sea, meadow;
let traffic = [];
let trees = [];
let score = 0;
let startTime = 0;
let isGameOver = false;
let currentMode = 'LOGIN'; 
let playerColor = 0xff0000; 
let gameSpeed = 0.7;

const keys = { KeyW: false, KeyA: false, KeyS: false, KeyD: false };

// --- GESTIONE AUTENTICAZIONE ---
onAuthStateChanged(auth, (u) => {
    user = u;
    if (user) {
        console.log("Sistema pronto. ID Utente:", user.uid);
        setupLeaderboard();
    }
});

function setupLeaderboard() {
    if (!user) return;
    const leaderboardCol = collection(db, 'artifacts', appId, 'public', 'data', 'leaderboard');
    
    onSnapshot(leaderboardCol, (snapshot) => {
        const scores = [];
        snapshot.forEach(doc => scores.push(doc.data()));
        scores.sort((a, b) => b.points - a.points);
        
        const listElement = document.getElementById('leaderboard-list');
        if (listElement) {
            if (scores.length === 0) {
                listElement.innerHTML = "<p style='color:#888'>Nessun record presente.</p>";
            } else {
                listElement.innerHTML = scores.slice(0, 10).map(entry => `
                    <div class="leaderboard-entry">
                        <span>${entry.name}</span>
                        <span><strong>${entry.points}</strong> pt</span>
                    </div>
                `).join('');
            }
        }
    }, (error) => console.error("Errore classifica:", error));
}

// --- FUNZIONI ESPOSTE (MANDATORIE PER L'HTML) ---

window.goToGarage = async function(email, password, playerName) {
    const errorEl = document.getElementById('login-error');
    const btn = document.getElementById('login-btn');

    try {
        // 1. Tenta il login
        try {
            await signInWithEmailAndPassword(auth, email, password);
        } catch (authError) {
            // 2. Se l'utente non esiste, lo crea automaticamente
            if (authError.code === 'auth/user-not-found' || authError.code === 'auth/invalid-credential' || authError.code === 'auth/invalid-email') {
                await createUserWithEmailAndPassword(auth, email, password);
            } else {
                throw authError;
            }
        }

        // 3. UI Update
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('garage-screen').style.display = 'flex';
        document.getElementById('display-name').innerText = playerName.toUpperCase();
        
        currentMode = 'GARAGE';
        if (!renderer) init3D(); 
        resetToGarageView();
        
    } catch (err) {
        console.error("Errore critico:", err);
        errorEl.innerText = "Errore: " + (err.code || err.message);
        errorEl.style.color = "#ff3333";
        if(btn) btn.disabled = false;
    }
};

window.startGame = function() {
    document.getElementById('garage-screen').style.display = 'none';
    document.getElementById('game-ui').style.display = 'block';
    currentMode = 'GAME';
    score = 0;
    gameSpeed = 0.7;
    startTime = Date.now();
    document.getElementById('score').innerText = "Punti: 0";
    
    scene.background = new THREE.Color(0x87ceeb); 
    camera.position.set(0, 5, 12); 
    camera.lookAt(0, 0, 0);
    player.position.set(0, 0.5, 0);
    pilot.visible = false; 
    beach.visible = true; sea.visible = true; meadow.visible = true;
};

window.resetToGarage = function() {
    isGameOver = false;
    document.getElementById('game-over').style.display = 'none';
    document.getElementById('game-ui').style.display = 'none';
    document.getElementById('garage-screen').style.display = 'flex';
    traffic.forEach(t => scene.remove(t)); traffic = [];
    trees.forEach(t => scene.remove(t)); trees = [];
    resetToGarageView();
};

window.changeTeamColor = function(hex) {
    playerColor = hex;
    if(player) player.material.color.setHex(hex);
    if(pilotSuit) pilotSuit.material.color.setHex(hex);
};

function resetToGarageView() {
    currentMode = 'GARAGE';
    if(scene) {
        scene.background = new THREE.Color(0x111111);
        pilot.visible = true;
        beach.visible = false; sea.visible = false; meadow.visible = false;
    }
    camera.position.set(0, 3, 8); 
    camera.lookAt(1, 1, 0);
}

// --- ENGINE 3D ---

function init3D() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    const sun = new THREE.DirectionalLight(0xffffff, 1);
    sun.position.set(5, 20, 10);
    scene.add(sun);

    const road = new THREE.Mesh(new THREE.PlaneGeometry(15, 10000), new THREE.MeshStandardMaterial({ color: 0x333333 }));
    road.rotation.x = -Math.PI / 2;
    scene.add(road);

    meadow = new THREE.Mesh(new THREE.PlaneGeometry(100, 10000), new THREE.MeshStandardMaterial({ color: 0x228b22 }));
    meadow.rotation.x = -Math.PI / 2; meadow.position.set(-57.5, -0.05, 0); scene.add(meadow);

    beach = new THREE.Mesh(new THREE.PlaneGeometry(25, 10000), new THREE.MeshStandardMaterial({ color: 0xffdb58 }));
    beach.rotation.x = -Math.PI / 2; beach.position.set(20, -0.04, 0); scene.add(beach);

    sea = new THREE.Mesh(new THREE.PlaneGeometry(400, 10000), new THREE.MeshStandardMaterial({ color: 0x0077be }));
    sea.rotation.x = -Math.PI / 2; sea.position.set(232.5, -0.1, 0); scene.add(sea);

    player = new THREE.Mesh(new THREE.BoxGeometry(2, 0.8, 4), new THREE.MeshStandardMaterial({ color: playerColor }));
    player.position.y = 0.4;
    scene.add(player);

    pilot = new THREE.Group();
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.35), new THREE.MeshStandardMaterial({color: 0xffdbac}));
    head.position.y = 1.7;
    pilotSuit = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 1.4), new THREE.MeshStandardMaterial({color: playerColor}));
    pilotSuit.position.y = 0.8;
    pilot.add(head); pilot.add(pilotSuit);
    pilot.position.set(2.5, 0, 0);
    scene.add(pilot);

    window.addEventListener('keydown', e => keys[e.code] = true);
    window.addEventListener('keyup', e => keys[e.code] = false);
    animate();
}

async function saveScoreToCloud() {
    if (!user || score === 0) return;
    const name = document.getElementById('user-name').value || "Pilota";
    try {
        const leaderboardCol = collection(db, 'artifacts', appId, 'public', 'data', 'leaderboard');
        await addDoc(leaderboardCol, { name, points: score, timestamp: Date.now(), userId: user.uid });
    } catch (e) { console.error("Salvataggio fallito:", e); }
}

function animate() {
    requestAnimationFrame(animate);
    if (currentMode === 'GARAGE') {
        player.rotation.y += 0.01; pilot.rotation.y += 0.01;
    } else if (currentMode === 'GAME' && !isGameOver) {
        if (keys.KeyA && player.position.x > -6) player.position.x -= 0.22;
        if (keys.KeyD && player.position.x < 6) player.position.x += 0.22;
        let speed = keys.KeyW ? gameSpeed * 2.5 : gameSpeed;

        traffic.forEach((enemy, i) => {
            enemy.position.z += speed;
            if (player.position.distanceTo(enemy.position) < 2.8) {
                isGameOver = true;
                saveScoreToCloud();
                document.getElementById('game-over').style.display = 'flex';
                document.getElementById('final-score').innerText = "Punti: " + score;
            }
            if (enemy.position.z > 30) {
                scene.remove(enemy); traffic.splice(i, 1);
                score += 10; document.getElementById('score').innerText = "Punti: " + score;
            }
        });
        if (Math.random() < 0.035) {
            const enemy = new THREE.Mesh(new THREE.BoxGeometry(2, 0.8, 4), new THREE.MeshStandardMaterial({ color: Math.random() * 0xffffff }));
            enemy.position.set([-5, 0, 5][Math.floor(Math.random() * 3)], 0.4, -200);
            scene.add(enemy); traffic.push(enemy);
        }
    }
    renderer.render(scene, camera);
}