import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { collection, query, where, onSnapshot, addDoc, getDocs, doc, setDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Plus, LogOut, MessageSquare, Search, Users, Hash, Settings } from 'lucide-react';
import { Input } from './ui/input';
import { formatDistanceToNow } from 'date-fns';
import { Checkbox } from './ui/checkbox';
import { UserProfileSettings } from './UserProfileSettings';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from './ui/context-menu';

interface SidebarProps {
  user: User;
  selectedRoomId: string | null;
  onSelectRoom: (id: string) => void;
}

interface Room {
  id: string;
  name?: string;
  type: 'direct' | 'group';
  participantIds: string[];
  unreadBy?: string[];
  lastMessage?: string;
  lastMessageAt?: string;
  createdAt: string;
}

interface UserProfile {
  uid: string;
  displayName: string;
  photoURL: string;
  status?: 'online' | 'offline';
  lastSeen?: string;
}

export function Sidebar({ user, selectedRoomId, onSelectRoom }: SidebarProps) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [roomSearchQuery, setRoomSearchQuery] = useState('');
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [isGroupMode, setIsGroupMode] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [groupName, setGroupName] = useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [currentUserProfile, setCurrentUserProfile] = useState<UserProfile>({
    uid: user.uid,
    displayName: user.displayName || '',
    photoURL: user.photoURL || ''
  });

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'users', user.uid), (doc: any) => {
      if (doc.exists()) {
        setCurrentUserProfile(doc.data() as UserProfile);
      }
    });
    return () => unsubscribe();
  }, [user.uid]);

  useEffect(() => {
    const q = query(
      collection(db, 'rooms'),
      where('participantIds', 'array-contains', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const roomsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Room[];
      
      roomsData.sort((a, b) => {
        const dateA = a.lastMessageAt || a.createdAt;
        const dateB = b.lastMessageAt || b.createdAt;
        return new Date(dateB).getTime() - new Date(dateA).getTime();
      });
      
      setRooms(roomsData);
    }, (error) => {
      console.error('Error listening to rooms:', error);
    });

    return () => unsubscribe();
  }, [user.uid]);

  useEffect(() => {
    if (isNewChatOpen) {
      const fetchUsers = async () => {
        const snapshot = await getDocs(collection(db, 'users'));
        const usersData = snapshot.docs
          .map(doc => doc.data() as UserProfile)
          .filter(u => u.uid !== user.uid);
        setUsers(usersData);
      };
      fetchUsers();
    } else {
      setIsGroupMode(false);
      setSelectedUsers([]);
      setGroupName('');
      setUserSearchQuery('');
    }
  }, [isNewChatOpen, user.uid]);

  const handleCreateDirectChat = async (otherUser: UserProfile) => {
    const existingRoom = rooms.find(r => 
      r.type === 'direct' && 
      r.participantIds.includes(otherUser.uid) && 
      r.participantIds.includes(user.uid)
    );

    if (existingRoom) {
      onSelectRoom(existingRoom.id);
      setIsNewChatOpen(false);
      return;
    }

    const newRoomRef = doc(collection(db, 'rooms'));

    await setDoc(newRoomRef, {
      id: newRoomRef.id,
      type: 'direct',
      participantIds: [user.uid, otherUser.uid],
      createdAt: new Date().toISOString(),
      name: ''
    });

    onSelectRoom(newRoomRef.id);
    setIsNewChatOpen(false);
  };

  const handleCreateGroupChat = async () => {
    if (selectedUsers.length === 0 || !groupName.trim()) return;

    const participantIds = [user.uid, ...selectedUsers];
    const newRoomRef = doc(collection(db, 'rooms'));

    await setDoc(newRoomRef, {
      id: newRoomRef.id,
      type: 'group',
      name: groupName.trim(),
      participantIds,
      createdAt: new Date().toISOString(),
    });

    onSelectRoom(newRoomRef.id);
    setIsNewChatOpen(false);
  };

  const filteredUsers = users.filter(u => 
    u.displayName.toLowerCase().includes(userSearchQuery.toLowerCase())
  );

  return (
    <div className="w-full md:w-80 border-r border-zinc-800 bg-zinc-900/50 flex flex-col h-full">
      <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
        <div 
          className="flex items-center space-x-3 cursor-pointer group hover:bg-zinc-800/50 p-1.5 -ml-1.5 rounded-lg transition-colors"
          onClick={() => setIsSettingsOpen(true)}
        >
          <Avatar className="ring-2 ring-zinc-800 transition-colors group-hover:ring-indigo-500/50">
            <AvatarImage src={currentUserProfile.photoURL || ''} />
            <AvatarFallback>{currentUserProfile.displayName?.charAt(0) || 'U'}</AvatarFallback>
          </Avatar>
          <div className="font-medium truncate">{currentUserProfile.displayName}</div>
        </div>
        <div className="flex space-x-1">
          <Button variant="ghost" size="icon" onClick={() => setIsSettingsOpen(true)} className="text-zinc-400 hover:text-indigo-400">
            <Settings size={18} />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => auth.signOut()} className="text-zinc-400 hover:text-zinc-100">
            <LogOut size={18} />
          </Button>
        </div>
      </div>

      <UserProfileSettings 
        user={user} 
        isOpen={isSettingsOpen} 
        onOpenChange={setIsSettingsOpen} 
      />

      <div className="p-4 space-y-3 border-b border-zinc-800/50">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
          <Input 
            placeholder="Search chats..." 
            className="pl-9 bg-zinc-950/50 border-zinc-800 h-9"
            value={roomSearchQuery}
            onChange={(e) => setRoomSearchQuery(e.target.value)}
          />
        </div>
        <Dialog open={isNewChatOpen} onOpenChange={setIsNewChatOpen}>
          <DialogTrigger render={<Button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white justify-start h-9" />}>
            <Plus size={16} className="mr-2" />
            New Chat
          </DialogTrigger>
          <DialogContent className="bg-zinc-900 border-zinc-800 text-zinc-50 sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{isGroupMode ? 'Create Group Chat' : 'New Chat'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="flex space-x-2 mb-4 bg-zinc-950/50 p-1 rounded-lg">
                <Button 
                  variant="ghost"
                  className={`flex-1 h-8 ${!isGroupMode ? 'bg-zinc-800 text-zinc-100 shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}
                  onClick={() => setIsGroupMode(false)}
                >
                  Direct
                </Button>
                <Button 
                  variant="ghost"
                  className={`flex-1 h-8 ${isGroupMode ? 'bg-zinc-800 text-zinc-100 shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}
                  onClick={() => setIsGroupMode(true)}
                >
                  Group
                </Button>
              </div>

              {isGroupMode && (
                <div className="space-y-2">
                  <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider pl-1">Group Name</label>
                  <Input 
                    placeholder="E.g. Product Team..." 
                    className="bg-zinc-950 border-zinc-800"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                  />
                </div>
              )}

              <div className="space-y-2">
                <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider pl-1">Invite Members</label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
                  <Input 
                    placeholder="Search users..." 
                    className="pl-9 bg-zinc-950 border-zinc-800"
                    value={userSearchQuery}
                    onChange={(e) => setUserSearchQuery(e.target.value)}
                  />
                </div>
              </div>
              <ScrollArea className="h-[250px] border border-zinc-800 rounded-md p-1 bg-zinc-950/30">
                <div className="space-y-1">
                  {filteredUsers.map(u => (
                    <div
                      key={u.uid}
                      onClick={() => {
                        if (isGroupMode) {
                          setSelectedUsers(prev => 
                            prev.includes(u.uid) ? prev.filter(id => id !== u.uid) : [...prev, u.uid]
                          );
                        } else {
                          handleCreateDirectChat(u);
                        }
                      }}
                      className={`w-full flex items-center space-x-3 p-2 rounded-md hover:bg-zinc-800/80 transition-colors text-left cursor-pointer ${
                        selectedUsers.includes(u.uid) ? 'bg-zinc-800/50' : ''
                      }`}
                    >
                      {isGroupMode && (
                        <Checkbox 
                          checked={selectedUsers.includes(u.uid)}
                          className="mr-1"
                          onCheckedChange={(checked) => {
                            if (checked) setSelectedUsers(prev => [...prev, u.uid]);
                            else setSelectedUsers(prev => prev.filter(id => id !== u.uid));
                          }}
                        />
                      )}
                      <div className="relative">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={u.photoURL} />
                          <AvatarFallback>{u.displayName.charAt(0)}</AvatarFallback>
                        </Avatar>
                        {u.status === 'online' && (
                          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-zinc-900 rounded-full"></span>
                        )}
                      </div>
                      <div className="flex flex-col flex-1 min-w-0">
                        <span className="font-medium text-sm truncate">{u.displayName}</span>
                        {u.status === 'online' ? (
                          <span className="text-[10px] text-green-500 truncate">Online</span>
                        ) : (
                          <span className="text-[10px] text-zinc-500 truncate">
                            {u.lastSeen ? `Last seen ${formatDistanceToNow(new Date(u.lastSeen), { addSuffix: true })}` : 'Offline'}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                  {filteredUsers.length === 0 && (
                    <div className="text-center text-zinc-500 py-6 text-sm">No users found</div>
                  )}
                </div>
              </ScrollArea>
              
              {isGroupMode && (
                <Button 
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white mt-4"
                  disabled={selectedUsers.length === 0 || !groupName.trim()}
                  onClick={handleCreateGroupChat}
                >
                  Create Group ({selectedUsers.length} members)
                </Button>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {rooms
            .filter(room => {
              if (!roomSearchQuery) return true;
              return true; // Simple search implementated in RoomListItem mapping, or we just do it here if we attach names
            })
            .map(room => (
              <RoomListItem 
                key={room.id} 
                room={room} 
                currentUser={user} 
                searchQuery={roomSearchQuery}
                isSelected={selectedRoomId === room.id}
                onClick={() => onSelectRoom(room.id)}
              />
          ))}
          {rooms.length === 0 && (
            <div className="p-4 text-center text-sm text-zinc-500">
              No chats yet. Click "New Chat" to start.
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

interface RoomListItemProps {
  room: Room;
  currentUser: User;
  searchQuery: string;
  isSelected: boolean;
  onClick: () => void;
}

const RoomListItem: React.FC<RoomListItemProps> = ({ room, currentUser, searchQuery, isSelected, onClick }) => {
  const [otherUser, setOtherUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    if (room.type === 'direct') {
      const otherUserId = room.participantIds.find(id => id !== currentUser.uid);
      if (otherUserId) {
        const fetchOtherUser = async () => {
          const unsubscribe = onSnapshot(doc(db, 'users', otherUserId), (userDoc) => {
            if (userDoc.exists()) {
              setOtherUser(userDoc.data() as UserProfile);
            }
          }, (error) => {
            console.error('Error listening to user:', error);
          });
          return unsubscribe;
        };
        let unsub: any;
        fetchOtherUser().then(u => unsub = u);
        return () => { if (unsub) unsub(); };
      }
    }
  }, [room, currentUser.uid]);

  const displayName = room.type === 'group' ? room.name : otherUser?.displayName || 'Unknown User';
  const photoURL = room.type === 'group' ? undefined : otherUser?.photoURL;
  const isOnline = room.type === 'direct' && otherUser?.status === 'online';
  const isUnread = room.unreadBy?.includes(currentUser.uid);

  // Apply search filter
  if (searchQuery && !displayName?.toLowerCase().includes(searchQuery.toLowerCase())) {
    return null;
  }

  const markAsUnread = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await updateDoc(doc(db, 'rooms', room.id), {
      unreadBy: arrayUnion(currentUser.uid)
    });
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger render={
        <button
          onClick={onClick}
          className={`w-full flex items-center space-x-3 p-3 rounded-xl transition-colors text-left group relative ${
            isSelected ? 'bg-indigo-600/10 text-indigo-100' : 'hover:bg-zinc-800/60 text-zinc-300'
          }`}
        />
      }>
        <div className="relative">
          <Avatar className={`h-11 w-11 border ${isOnline ? 'border-green-500/50' : 'border-zinc-800'} transition-colors`}>
            <AvatarImage src={photoURL} />
            <AvatarFallback className={room.type === 'group' ? 'bg-indigo-900/50 text-indigo-300' : 'bg-zinc-800 text-zinc-400'}>
              {room.type === 'group' ? <Hash size={18} /> : displayName?.charAt(0)}
            </AvatarFallback>
          </Avatar>
          {isOnline && (
            <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-zinc-950 rounded-full"></span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-baseline mb-1">
            <h3 className={`font-medium truncate ${isSelected ? 'text-indigo-200' : 'text-zinc-200 group-hover:text-zinc-100'} ${isUnread ? 'font-bold text-zinc-100' : ''}`}>
              {displayName}
            </h3>
            {room.lastMessageAt && (
              <span className={`text-[10px] flex-shrink-0 ml-2 ${isSelected ? 'text-indigo-400/80' : isUnread ? 'text-indigo-400 font-bold' : 'text-zinc-500'}`}>
                {formatDistanceToNow(new Date(room.lastMessageAt), { addSuffix: false }).replace('about ', '')}
              </span>
            )}
          </div>
          <div className="flex justify-between items-center">
            <p className={`text-xs truncate ${isSelected ? 'text-indigo-300/70' : isUnread ? 'text-zinc-300 font-medium' : 'text-zinc-500'}`}>
              {room.lastMessage || 'No messages yet'}
            </p>
            {isUnread && (
              <span className="h-2.5 w-2.5 bg-indigo-500 rounded-full flex-shrink-0 ml-2 shadow-[0_0_8px_rgba(99,102,241,0.5)]"></span>
            )}
            {isOnline && !room.lastMessage && !isUnread && (
              <span className="text-[10px] text-green-500 font-medium px-1.5 py-0.5 bg-green-500/10 rounded ml-2">Online</span>
            )}
          </div>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="bg-zinc-900 border-zinc-800 text-zinc-50">
        <ContextMenuItem 
          onClick={markAsUnread}
          className="focus:bg-zinc-800 focus:text-zinc-100 cursor-pointer"
        >
          Mark as unread
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
