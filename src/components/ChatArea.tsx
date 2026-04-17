import { useState, useEffect, useRef } from 'react';
import { User } from 'firebase/auth';
import { collection, query, onSnapshot, orderBy, doc, getDoc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '../firebase';
import { encryptText, decryptText } from '../lib/encryption';
import { ScrollArea } from './ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { MessageInput } from './MessageInput';
import { format, isToday, isYesterday } from 'date-fns';
import { FileIcon, Check, CheckCheck, SmilePlus, Menu, ChevronLeft, ListTodo } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';

interface ChatAreaProps {
  user: User;
  roomId: string;
  onOpenMobileMenu?: () => void;
  onOpenTasksMobile?: () => void;
}

interface Message {
  id: string;
  roomId: string;
  senderId: string;
  text?: string;
  fileUrl?: string;
  fileType?: 'image' | 'video' | 'file';
  fileName?: string;
  isEncrypted?: boolean;
  readBy?: string[];
  reactions?: Record<string, string[]>;
  createdAt: string;
}

interface UserProfile {
  uid: string;
  displayName: string;
  photoURL: string;
  status?: 'online' | 'offline';
  lastSeen?: string;
}

const EMOJI_OPTIONS = ['👍', '❤️', '😂', '😮', '😢', '😡'];

export function ChatArea({ user, roomId, onOpenMobileMenu, onOpenTasksMobile }: ChatAreaProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [roomDetails, setRoomDetails] = useState<any>(null);
  const [otherUser, setOtherUser] = useState<UserProfile | null>(null);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Fetch room details and listen for typing status
    const unsubscribeRoom = onSnapshot(doc(db, 'rooms', roomId), async (roomDoc) => {
      if (roomDoc.exists()) {
        const data = roomDoc.data();
        setRoomDetails(data);
        
        // Handle typing status
        if (data.typing) {
          const typing = Object.entries(data.typing)
            .filter(([uid, isTyping]) => isTyping && uid !== user.uid)
            .map(([uid]) => uid);
          setTypingUsers(typing);
        } else {
          setTypingUsers([]);
        }
        
        if (data.type === 'direct') {
          const otherUserId = data.participantIds.find((id: string) => id !== user.uid);
          if (otherUserId) {
            const userDoc = await getDoc(doc(db, 'users', otherUserId));
            if (userDoc.exists()) {
              setOtherUser(userDoc.data() as UserProfile);
            }
          }
        }
      }
    }, (error) => {
      console.error('Error listening to room details:', error);
    });

    // Listen to messages
    const q = query(
      collection(db, `rooms/${roomId}/messages`),
      orderBy('createdAt', 'asc')
    );

    const unsubscribeMessages = onSnapshot(q, async (snapshot) => {
      const e2ePassword = localStorage.getItem('chat_e2e_password');
      
      const msgsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Message[];

      const msgs = await Promise.all(msgsData.map(async (msg) => {
        if (msg.isEncrypted && msg.text && e2ePassword) {
          try {
            msg.text = await decryptText(msg.text, e2ePassword);
          } catch (err) {
            msg.text = '🔒 Encrypted Message (Decryption failed or missing key)';
          }
        } else if (msg.isEncrypted && msg.text) {
          msg.text = '🔒 Encrypted Message (Set a key in settings to view)';
        }
        return msg;
      }));

      setMessages(msgs);
      
      // Mark unread messages as read
      let hasMessageUpdates = false;
      msgs.forEach(msg => {
        if (msg.senderId !== user.uid && (!msg.readBy || !msg.readBy.includes(user.uid))) {
          updateDoc(doc(db, `rooms/${roomId}/messages`, msg.id), {
            readBy: arrayUnion(user.uid)
          }).catch(console.error);
          hasMessageUpdates = true;
        }
      });

      // Clear unread indicator on the room itself
      if (hasMessageUpdates || msgs.length > 0) {
         updateDoc(doc(db, 'rooms', roomId), {
           unreadBy: arrayRemove(user.uid)
         }).catch(console.error);
      }
      
      // Scroll to bottom
      setTimeout(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      }, 100);
    }, (error) => {
      console.error('Error listening to messages:', error);
    });

    return () => {
      unsubscribeRoom();
      unsubscribeMessages();
    };
  }, [roomId, user.uid]);

  const toggleReaction = async (messageId: string, emoji: string, currentReactions: Record<string, string[]> = {}) => {
    const userReacted = currentReactions[emoji]?.includes(user.uid);
    let updatedReactions = { ...currentReactions };

    if (userReacted) {
      updatedReactions[emoji] = updatedReactions[emoji].filter(id => id !== user.uid);
      if (updatedReactions[emoji].length === 0) {
        delete updatedReactions[emoji];
      }
    } else {
      updatedReactions[emoji] = [...(updatedReactions[emoji] || []), user.uid];
    }

    try {
      await updateDoc(doc(db, `rooms/${roomId}/messages`, messageId), {
        reactions: updatedReactions
      });
    } catch (error) {
      console.error('Error updating reaction:', error);
    }
  };

  const displayName = roomDetails?.type === 'group' ? roomDetails?.name : otherUser?.displayName || 'Chat';
  const isOnline = roomDetails?.type === 'direct' && otherUser?.status === 'online';

  const isDifferentDay = (date1: string, date2: string) => {
    return new Date(date1).setHours(0,0,0,0) !== new Date(date2).setHours(0,0,0,0);
  };

  const formatMessageDate = (dateString: string) => {
    const date = new Date(dateString);
    if (isToday(date)) return 'Today';
    if (isYesterday(date)) return 'Yesterday';
    return format(date, 'MMMM d, yyyy');
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="h-16 border-b border-zinc-800 bg-zinc-900/50 flex items-center px-4 md:px-6 shadow-sm z-10 shrink-0">
        <div className="flex items-center space-x-3 w-full">
          {onOpenMobileMenu && (
            <button 
              onClick={onOpenMobileMenu}
              className="md:hidden mr-1 p-2 -ml-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-full transition-colors"
            >
              <ChevronLeft size={24} />
            </button>
          )}
          <div className="relative">
            <Avatar className="h-10 w-10 border border-zinc-800 shadow-sm">
              <AvatarImage src={roomDetails?.type === 'group' ? undefined : otherUser?.photoURL} />
              <AvatarFallback>{displayName.charAt(0)}</AvatarFallback>
            </Avatar>
            {isOnline && (
              <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-zinc-900 rounded-full"></span>
            )}
          </div>
          <div>
            <h2 className="font-semibold text-zinc-100">{displayName}</h2>
            {roomDetails?.type === 'direct' && (
              <p className="text-xs text-zinc-500">
                {isOnline ? 'Online' : otherUser?.lastSeen ? `Last seen ${format(new Date(otherUser.lastSeen), 'MMM d, h:mm a')}` : 'Offline'}
              </p>
            )}
            {roomDetails?.type === 'group' && (
              <p className="text-xs text-zinc-500">{roomDetails.participantIds?.length || 0} participants</p>
            )}
          </div>
          <div className="flex-1" />
          {onOpenTasksMobile && (
            <button
              onClick={onOpenTasksMobile}
              className="md:hidden flex-shrink-0 p-2 text-zinc-400 hover:text-indigo-400 hover:bg-zinc-800 rounded-full transition-colors"
            >
              <ListTodo size={20} />
            </button>
          )}
        </div>
      </div>
      
      {/* Typing Indicator Below Header */}
      {typingUsers.length > 0 && (
        <div className="bg-zinc-900/80 border-b border-zinc-800 px-6 py-1.5 flex items-center shadow-sm shrink-0">
          <span className="flex space-x-1 items-center">
            <span className="text-xs text-indigo-400 font-medium italic">
              {typingUsers.length === 1 ? 'User is typing' : 'Multiple users are typing'}
            </span>
            <span className="flex space-x-0.5 ml-1">
              <span className="w-1 h-1 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></span>
              <span className="w-1 h-1 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
              <span className="w-1 h-1 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></span>
            </span>
          </span>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4" ref={scrollRef}>
        {messages.map((msg, index) => {
          const isMe = msg.senderId === user.uid;
          const showAvatar = !isMe && (index === 0 || messages[index - 1].senderId !== msg.senderId);
          const isRead = msg.readBy && msg.readBy.length > 1; // Sender + at least one other
          const showDateSeparator = index === 0 || isDifferentDay(msg.createdAt, messages[index - 1].createdAt);
          
          return (
            <div key={msg.id} className="flex flex-col">
              {showDateSeparator && (
                <div className="flex justify-center my-6">
                  <span className="text-xs font-medium px-3 py-1 bg-zinc-800/80 text-zinc-400 rounded-full">
                    {formatMessageDate(msg.createdAt)}
                  </span>
                </div>
              )}
              
              <div className={`flex group ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div className={`flex max-w-[85%] md:max-w-[75%] ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                  {!isMe && (
                    <div className="w-8 flex-shrink-0 mr-2 mt-auto mb-5">
                      {showAvatar && (
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={roomDetails?.type === 'group' ? undefined : otherUser?.photoURL} />
                          <AvatarFallback>{roomDetails?.type === 'group' ? 'U' : otherUser?.displayName?.charAt(0)}</AvatarFallback>
                        </Avatar>
                      )}
                    </div>
                  )}
                  
                  <div className={`flex flex-col relative ${isMe ? 'items-end' : 'items-start'}`}>
                    <div className={`flex items-center space-x-2 ${isMe ? 'flex-row-reverse space-x-reverse' : 'flex-row'}`}>
                      <div 
                        className={`rounded-2xl px-4 py-2 ${
                          isMe 
                            ? 'bg-indigo-600 text-white rounded-br-sm' 
                            : 'bg-zinc-800 text-zinc-100 rounded-bl-sm'
                        } relative shadow-sm`}
                      >
                        {msg.fileUrl && (
                          <div className="mb-2">
                            {msg.fileType === 'image' && (
                              <img src={msg.fileUrl} alt="attachment" className="max-w-full rounded-lg max-h-64 object-contain" />
                            )}
                            {msg.fileType === 'video' && (
                              <video src={msg.fileUrl} controls className="max-w-full rounded-lg max-h-64" />
                            )}
                            {msg.fileType === 'file' && (
                              <a href={msg.fileUrl} target="_blank" rel="noopener noreferrer" className="flex items-center space-x-2 bg-black/20 p-3 rounded-lg hover:bg-black/30 transition-colors">
                                <FileIcon size={24} />
                                <span className="text-sm truncate max-w-[200px]">{msg.fileName || 'Download File'}</span>
                              </a>
                            )}
                          </div>
                        )}
                        {msg.text && <p className="whitespace-pre-wrap break-words leading-relaxed text-[15px]">{msg.text}</p>}
                        
                        {/* Reactions render */}
                        {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                          <div className={`flex flex-wrap gap-1 mt-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                            {Object.entries(msg.reactions).map(([emoji, users]) => (
                              <button
                                key={emoji}
                                onClick={() => toggleReaction(msg.id, emoji, msg.reactions)}
                                className={`text-xs px-1.5 py-0.5 rounded-full border flex items-center space-x-1 transition-colors ${
                                  (users as string[]).includes(user.uid) 
                                    ? 'bg-indigo-500/20 border-indigo-500/30 text-indigo-200' 
                                    : 'bg-zinc-900/60 border-zinc-700/50 text-zinc-300 hover:bg-zinc-800'
                                }`}
                              >
                                <span>{emoji}</span>
                                <span className="text-[10px] opacity-80">{(users as string[]).length}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Reaction trigger popover visible on group hover */}
                      <Popover>
                        <PopoverTrigger render={<button className="opacity-0 group-hover:opacity-100 p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded-full transition-all" />}>
                          <SmilePlus size={16} />
                        </PopoverTrigger>
                        <PopoverContent side="top" className="w-auto p-2 bg-zinc-900 border-zinc-800 rounded-full flex space-x-1" align={isMe ? 'end' : 'start'}>
                          {EMOJI_OPTIONS.map(emoji => (
                            <button
                              key={emoji}
                              onClick={() => toggleReaction(msg.id, emoji, msg.reactions)}
                              className="w-8 h-8 flex items-center justify-center text-lg hover:bg-zinc-800 rounded-full transition-colors"
                            >
                              {emoji}
                            </button>
                          ))}
                        </PopoverContent>
                      </Popover>
                    </div>

                    <div className="flex items-center mt-1 px-1 space-x-1">
                      <span className="text-[10px] text-zinc-500">
                        {format(new Date(msg.createdAt), 'h:mm a')}
                      </span>
                      {isMe && (
                        <span className="text-zinc-500">
                          {isRead ? <CheckCheck size={14} className="text-indigo-400" /> : <Check size={14} />}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Input */}
      <div className="p-4 bg-zinc-950 border-t border-zinc-800/50">
        <MessageInput user={user} roomId={roomId} />
      </div>
    </div>
  );
}
