// config.js

// Firebase コンソールからコピーした設定
const firebaseConfig = {
    apiKey: "AIzaSyDQgoIA89QHmZACPK3B3Z2TknM9KJSBtJE",
    authDomain: "core-f52a0.firebaseapp.com",
    projectId: "core-f52a0",
    storageBucket: "core-f52a0.firebasestorage.app",
    messagingSenderId: "626624327146",
    appId: "1:626624327146:web:308147a91fe86359629693",
    measurementId: "G-ZZ6XPM74BL",
};

// ここがポイント：compat 版の初期化
firebase.initializeApp(firebaseConfig);

// Firestore をグローバル変数 db として使えるようにする
const db = firebase.firestore();
