// src/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// 실제 프로젝트 설정값 입력
const firebaseConfig = {
  apiKey: "AIzaSyDIGD4g8hliycZbykukwDqG-R_6Tg_aLkk",
  authDomain: "my-application2-4d187.firebaseapp.com",
  projectId: "my-application2-4d187",
  storageBucket: "my-application2-4d187.appspot.com",
  messagingSenderId: "1094535312184",
  appId: "1:1094535312184:web:92d7cbde762096216a07cd"
};

// Firebase 초기화 및 Firestore 참조
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
