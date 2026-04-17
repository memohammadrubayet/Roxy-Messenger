import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { collection, query, where, onSnapshot, orderBy, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { Bell, CheckCircle2, Circle, MessageSquare } from 'lucide-react';
import { ScrollArea } from './ui/scroll-area';
import { formatDistanceToNow } from 'date-fns';
import { Button } from './ui/button';

interface HomeDashboardProps {
  user: User;
  onSelectRoom: (roomId: string) => void;
}

interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  read: boolean;
  linkToRoomId?: string;
  createdAt: string;
}

export function HomeDashboard({ user, onSelectRoom }: HomeDashboardProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    // We will listen to the existing 'rooms' collection for unread messages as notifications
    // Or normally we would listen to a 'notifications' subcollection.
    // Let's use the 'rooms' logic to synthesize notifications for now to avoid needing a backend trigger.

    const roomsQuery = query(
      collection(db, 'rooms'),
      where('participantIds', 'array-contains', user.uid)
    );

    const unsubscribe = onSnapshot(roomsQuery, (snapshot) => {
      const notifs: Notification[] = [];
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.unreadBy && data.unreadBy.includes(user.uid)) {
          notifs.push({
            id: doc.id,
            userId: user.uid,
            title: data.type === 'group' ? (data.name || 'Group Chat') : 'New Message',
            message: data.lastMessage || 'You have new messages',
            read: false,
            linkToRoomId: doc.id,
            createdAt: data.lastMessageAt || new Date().toISOString()
          });
        }
      });
      // Sort by latest
      notifs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setNotifications(notifs);
    });

    return () => unsubscribe();
  }, [user.uid]);

  const markAllAsRead = async () => {
    // In our synthesized logic, this means clearing unreadBy in all rooms the user has unread
    if (notifications.length === 0) return;
    
    // Dynamically importing to avoid top-level issues if needed, but it's safe here
    const { writeBatch, doc, arrayRemove } = await import('firebase/firestore');
    const batch = writeBatch(db);
    
    notifications.forEach(n => {
      if (n.linkToRoomId) {
        batch.update(doc(db, 'rooms', n.linkToRoomId), {
          unreadBy: arrayRemove(user.uid)
        });
      }
    });
    
    await batch.commit().catch(console.error);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-zinc-950/50">
      <div className="p-8 border-b border-zinc-800/50">
        <h1 className="text-3xl font-bold text-zinc-100 mt-4 md:mt-0">Welcome, {user.displayName}</h1>
        <p className="text-zinc-400 mt-2">Here is what&apos;s happening across your chats.</p>
      </div>
      
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-2 text-zinc-100">
            <Bell size={20} className="text-indigo-400" />
            <h2 className="text-xl font-semibold">Notifications</h2>
            {notifications.length > 0 && (
               <span className="bg-indigo-500 text-white text-xs px-2 py-0.5 rounded-full font-medium">
                 {notifications.length} new
               </span>
            )}
          </div>
          {notifications.length > 0 && (
            <Button variant="ghost" size="sm" onClick={markAllAsRead} className="text-zinc-400 hover:text-zinc-200">
              <CheckCircle2 size={16} className="mr-2" />
              Mark all as read
            </Button>
          )}
        </div>

        <ScrollArea className="h-[400px]">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-zinc-600">
              <div className="h-16 w-16 rounded-full bg-zinc-900 flex items-center justify-center mb-4">
                <Bell size={24} className="text-zinc-700" />
              </div>
              <p>You&apos;re all caught up!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {notifications.map(notif => (
                <button
                  key={notif.id}
                  onClick={() => notif.linkToRoomId && onSelectRoom(notif.linkToRoomId)}
                  className="w-full text-left p-4 rounded-xl border border-zinc-800 bg-zinc-900/40 hover:bg-zinc-800/60 transition-colors flex items-start space-x-4 relative overflow-hidden group"
                >
                  <div className="mt-1">
                    {notif.read ? (
                      <CheckCircle2 size={18} className="text-zinc-600" />
                    ) : (
                      <Circle size={18} className="text-indigo-500 fill-indigo-500/20" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className={`font-medium text-sm ${!notif.read ? 'text-zinc-100' : 'text-zinc-400'}`}>
                      {notif.title}
                    </h3>
                    <p className="text-zinc-400 text-xs mt-1 truncate">{notif.message}</p>
                    <p className="text-zinc-600 text-[10px] mt-2">
                       {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
}
