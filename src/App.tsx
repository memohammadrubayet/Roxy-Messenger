/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, db } from './firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { Login } from './components/Login';
import { ChatLayout } from './components/ChatLayout';
import { Toaster } from './components/ui/sonner';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        // Ensure user exists in Firestore
        const userRef = doc(db, 'users', currentUser.uid);
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) {
          await setDoc(userRef, {
            uid: currentUser.uid,
            displayName: currentUser.displayName || 'Anonymous',
            photoURL: currentUser.photoURL || '',
            status: 'online',
            createdAt: new Date().toISOString(),
            lastSeen: new Date().toISOString(),
          });
        } else {
          await setDoc(userRef, {
            status: 'online',
            lastSeen: new Date().toISOString(),
          }, { merge: true });
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    
    const userRef = doc(db, 'users', user.uid);
    
    const setOnline = () => {
      setDoc(userRef, { status: 'online', lastSeen: new Date().toISOString() }, { merge: true }).catch(console.error);
    };
    
    const setOffline = () => {
      setDoc(userRef, { status: 'offline', lastSeen: new Date().toISOString() }, { merge: true }).catch(console.error);
    };

    // Heartbeat every minute
    const interval = setInterval(setOnline, 60000);

    // Set offline on window close/unload
    window.addEventListener('beforeunload', setOffline);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeunload', setOffline);
      setOffline();
    };
  }, [user]);

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-zinc-950">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-800 border-t-zinc-50"></div>
      </div>
    );
  }

  return (
    <div className="dark h-screen w-full bg-zinc-950 text-zinc-50 overflow-hidden">
      {user ? <ChatLayout user={user} /> : <Login />}
      <Toaster theme="dark" />
    </div>
  );
}
