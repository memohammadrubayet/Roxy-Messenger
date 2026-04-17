import React, { useState, useRef } from 'react';
import { User } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Camera, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';

interface UserProfileSettingsProps {
  user: User;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UserProfileSettings({ user, isOpen, onOpenChange }: UserProfileSettingsProps) {
  const [displayName, setDisplayName] = useState(user.displayName || '');
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [photoURL, setPhotoURL] = useState(user.photoURL || '');
  const [e2ePassword, setE2ePassword] = useState(localStorage.getItem('chat_e2e_password') || '');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) return;

    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        displayName: displayName.trim(),
        photoURL
      });
      localStorage.setItem('chat_e2e_password', e2ePassword);
      toast.success('Profile updated successfully');
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    
    const file = e.target.files[0];
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    try {
      setIsUploading(true);
      const fileExtension = file.name.split('.').pop();
      const storageRef = ref(storage, `profiles/${user.uid}/avatar.${fileExtension}`);
      
      const uploadTask = uploadBytesResumable(storageRef, file);
      
      await new Promise((resolve, reject) => {
        uploadTask.on(
          'state_changed',
          null,
          (error) => reject(error),
          () => resolve(uploadTask.snapshot.ref)
        );
      });

      const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
      setPhotoURL(downloadURL);
      
      // Auto-save the new photoURL to user doc
      await updateDoc(doc(db, 'users', user.uid), {
        photoURL: downloadURL
      });
      toast.success('Profile picture updated');
    } catch (error: any) {
      console.error('Error uploading photo:', error);
      toast.error('Failed to upload photo: ' + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-zinc-950 border-zinc-800 text-zinc-50 p-6 rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold tracking-tight text-white mb-2">Profile Settings</DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-col items-center space-y-6 py-4">
          <div className="relative group">
            <Avatar className="h-24 w-24 ring-4 ring-zinc-900 border border-zinc-800 bg-zinc-900 shadow-xl transition-all">
              <AvatarImage src={photoURL} className="object-cover" />
              <AvatarFallback className="text-3xl font-medium bg-zinc-800 text-zinc-300">
                {displayName.charAt(0)?.toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
            
            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-full opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
            >
              {isUploading ? <Loader2 className="h-8 w-8 text-white animate-spin" /> : <Camera className="h-8 w-8 text-white" />}
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileSelect} 
              className="hidden" 
              accept="image/*"
            />
          </div>

          <form onSubmit={handleSave} className="w-full space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-zinc-400 tracking-wider uppercase ml-1">Display Name</label>
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="bg-zinc-900/80 border-zinc-700/50 focus-visible:ring-indigo-500 focus-visible:border-indigo-500/50 h-11 px-4 text-base rounded-xl transition-all"
                placeholder="Enter your name"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-zinc-400 tracking-wider uppercase ml-1">E2E Encryption Key (Optional)</label>
              <Input
                type="password"
                value={e2ePassword}
                onChange={(e) => setE2ePassword(e.target.value)}
                className="bg-zinc-900/80 border-zinc-700/50 focus-visible:ring-indigo-500 focus-visible:border-indigo-500/50 h-11 px-4 text-base rounded-xl transition-all"
                placeholder="Share this secret key with your contacts to decrypt your messages"
              />
              <p className="text-[10px] text-zinc-500 px-1">Messages are encrypted using AES-256. If a sender's key matches yours, you can read their messages. Keys are stored locally.</p>
            </div>
            
            <Button
              type="submit"
              disabled={isSaving || !displayName.trim()}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg h-11 rounded-xl font-medium transition-all"
            >
              {isSaving ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />}
              Save Changes
            </Button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
