import React, { useState, useRef, useEffect } from 'react';
import { User } from 'firebase/auth';
import { collection, addDoc, doc, updateDoc, onSnapshot, setDoc, getDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import { encryptText } from '../lib/encryption';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Paperclip, Send, X, Image as ImageIcon, File, Video } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { toast } from 'sonner';

interface MessageInputProps {
  user: User;
  roomId: string;
}

export function MessageInput({ user, roomId }: MessageInputProps) {
  const [text, setText] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const clearFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const updateTypingStatus = async (isTyping: boolean) => {
    try {
      await updateDoc(doc(db, 'rooms', roomId), {
        [`typing.${user.uid}`]: isTyping
      });
    } catch (error) {
      console.error('Failed to update typing status', error);
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setText(e.target.value);
    
    // Set typing to true
    updateTypingStatus(true);
    
    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Set typing to false after 2 seconds of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      updateTypingStatus(false);
    }, 2000);
  };

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      updateTypingStatus(false);
    };
  }, [roomId]);

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!text.trim() && !selectedFile) return;

    try {
      setIsUploading(true);
      let fileUrl = '';
      let fileType = '';
      let fileName = '';

      if (selectedFile) {
        fileName = selectedFile.name;
        const fileExtension = fileName.split('.').pop();
        const uniqueFileName = `${uuidv4()}.${fileExtension}`;
        const storageRef = ref(storage, `chat_files/${roomId}/${uniqueFileName}`);
        
        if (selectedFile.type.startsWith('image/')) fileType = 'image';
        else if (selectedFile.type.startsWith('video/')) fileType = 'video';
        else fileType = 'file';

        const uploadTask = uploadBytesResumable(storageRef, selectedFile);

        fileUrl = await new Promise((resolve, reject) => {
          uploadTask.on(
            'state_changed',
            (snapshot) => {
              const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
              setUploadProgress(progress);
            },
            (error) => reject(error),
            async () => {
              const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
              resolve(downloadURL);
            }
          );
        });
      }

      const messageRef = doc(collection(db, `rooms/${roomId}/messages`));
      
      const messageData: any = {
        id: messageRef.id,
        roomId,
        senderId: user.uid,
        createdAt: new Date().toISOString(),
        readBy: [user.uid] // Automatically read by sender
      };

      if (text.trim()) {
        const e2ePassword = localStorage.getItem('chat_e2e_password');
        if (e2ePassword) {
          messageData.text = await encryptText(text.trim(), e2ePassword);
          messageData.isEncrypted = true;
        } else {
          messageData.text = text.trim();
        }
      }
      if (fileUrl) {
        messageData.fileUrl = fileUrl;
        messageData.fileType = fileType;
        messageData.fileName = fileName;
      }

      // Add message to subcollection
      await setDoc(messageRef, messageData);

      // Fetch participants to update unreadBy
      const roomDoc = await getDoc(doc(db, 'rooms', roomId));
      const participantIds = roomDoc.exists() ? roomDoc.data()?.participantIds || [] : [];
      const unreadBy = participantIds.filter((id: string) => id !== user.uid);

      // Update room's last message
      await updateDoc(doc(db, 'rooms', roomId), {
        lastMessage: text.trim() || `Sent a ${fileType}`,
        lastMessageAt: messageData.createdAt,
        unreadBy
      });

      setText('');
      clearFile();
      setUploadProgress(0);
      updateTypingStatus(false);
    } catch (error: any) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message: ' + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex flex-col w-full">
      {selectedFile && (
        <div className="mb-3 flex items-center p-3 bg-zinc-900 rounded-lg border border-zinc-800 w-max max-w-full">
          <div className="mr-3 text-indigo-400">
            {selectedFile.type.startsWith('image/') ? <ImageIcon size={24} /> : 
             selectedFile.type.startsWith('video/') ? <Video size={24} /> : 
             <File size={24} />}
          </div>
          <div className="flex-1 truncate mr-4">
            <p className="text-sm font-medium text-zinc-200 truncate">{selectedFile.name}</p>
            <p className="text-xs text-zinc-500">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
          </div>
          <Button variant="ghost" size="icon" onClick={clearFile} className="h-8 w-8 text-zinc-400 hover:text-zinc-100">
            <X size={16} />
          </Button>
        </div>
      )}
      
      {isUploading && uploadProgress > 0 && uploadProgress < 100 && (
        <div className="mb-2 w-full bg-zinc-800 rounded-full h-1.5">
          <div className="bg-indigo-500 h-1.5 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
        </div>
      )}

      <form onSubmit={handleSend} className="flex items-center space-x-2">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          className="hidden"
          accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
        />
        <Button 
          type="button" 
          variant="ghost" 
          size="icon" 
          className="text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 flex-shrink-0"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
        >
          <Paperclip size={20} />
        </Button>
        
        <Input
          value={text}
          onChange={handleTextChange}
          placeholder="Message..."
          className="flex-1 bg-zinc-900/80 border-zinc-700/50 text-zinc-100 focus-visible:ring-indigo-500 rounded-full h-11 px-4 text-base"
          disabled={isUploading}
        />
        
        <Button 
          type="submit" 
          size="icon"
          className="bg-indigo-600 hover:bg-indigo-700 text-white flex-shrink-0 h-11 w-11 rounded-full ml-1"
          disabled={(!text.trim() && !selectedFile) || isUploading}
        >
          <Send size={18} />
        </Button>
      </form>
    </div>
  );
}
