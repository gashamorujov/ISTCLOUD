import { initializeApp, getApps } from "firebase/app";
import { getDatabase, ref, set, get, remove, query, orderByChild, equalTo, push, update, serverTimestamp } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyBphO5XhddqFwaxelZnCShcJ6ZOops990Y",
  authDomain: "ogstorage-13ca0.firebaseapp.com",
  databaseURL: "https://ogstorage-13ca0-default-rtdb.firebaseio.com",
  projectId: "ogstorage-13ca0",
  storageBucket: "ogstorage-13ca0.firebasestorage.app",
  messagingSenderId: "422108490754",
  appId: "1:422108490754:web:03e6c19125ff40ef3c0b1b",
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getDatabase(app);

export {
  db,
  ref,
  set,
  get,
  remove,
  query,
  orderByChild,
  equalTo,
  push,
  update,
  serverTimestamp,
};
