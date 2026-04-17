import { useState } from 'react';
import { User } from 'firebase/auth';
import { Sidebar } from './Sidebar';
import { ChatArea } from './ChatArea';
import { Tasks } from './Tasks';
import { HomeDashboard } from './HomeDashboard';
import { ListTodo, Menu, MessageSquare } from 'lucide-react';
import { Button } from './ui/button';
import { Sheet, SheetContent, SheetTrigger } from './ui/sheet';

interface ChatLayoutProps {
  user: User;
}

export function ChatLayout({ user }: ChatLayoutProps) {
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [showTasks, setShowTasks] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isTasksOpen, setIsTasksOpen] = useState(false);

  const handleSelectRoom = (id: string) => {
    setSelectedRoomId(id);
    setIsSidebarOpen(false); // Close mobile sidebar when a room is selected
  };

  return (
    <div className="flex h-full w-full overflow-hidden bg-zinc-950">
      {/* Desktop Sidebar */}
      <div className="hidden md:flex h-full z-10 shrink-0">
        <Sidebar 
          user={user} 
          selectedRoomId={selectedRoomId} 
          onSelectRoom={handleSelectRoom} 
        />
      </div>

      <div className="flex-1 flex flex-col min-w-0 bg-zinc-950 relative h-full">
        {/* Mobile Header (Visible when no room selected on mobile) */}
        <div className={`md:hidden flex items-center justify-between p-3 border-b border-zinc-800 bg-zinc-900/50 ${selectedRoomId ? 'hidden' : ''}`}>
          <Sheet open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
            <SheetTrigger render={<Button variant="ghost" size="icon" className="text-zinc-400 hover:text-white" />}>
              <Menu size={20} />
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-80 border-r border-zinc-800 bg-zinc-950 px-0 pt-0 pb-0">
              <Sidebar 
                user={user} 
                selectedRoomId={selectedRoomId} 
                onSelectRoom={handleSelectRoom} 
              />
            </SheetContent>
          </Sheet>
          
          <div className="flex items-center space-x-2 text-zinc-100 font-semibold">
            <MessageSquare size={18} className="text-indigo-400" />
            <span>Chat App</span>
          </div>

          <Sheet open={isTasksOpen} onOpenChange={setIsTasksOpen}>
            <SheetTrigger render={<Button variant="ghost" size="icon" className="text-zinc-400 hover:text-indigo-400" />}>
              <ListTodo size={20} />
            </SheetTrigger>
            <SheetContent side="right" className="p-0 w-80 border-l border-zinc-800 bg-zinc-950 px-0 pt-0 pb-0">
              <Tasks user={user} />
            </SheetContent>
          </Sheet>
        </div>

        {/* Desktop Tasks Toggle */}
        <div className="hidden md:block absolute top-4 right-4 z-20">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowTasks(!showTasks)}
            className={`bg-zinc-900/80 backdrop-blur-md border-zinc-700/80 shadow-lg transition-all ${
              showTasks ? 'text-indigo-400 border-indigo-500/50' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <ListTodo size={16} className="mr-2" />
            Tasks
          </Button>
        </div>

        {selectedRoomId ? (
          <ChatArea 
            user={user} 
            roomId={selectedRoomId} 
            onOpenMobileMenu={() => {
              setSelectedRoomId(null);
            }} 
            onOpenTasksMobile={() => setIsTasksOpen(true)}
          />
        ) : (
          <HomeDashboard user={user} onSelectRoom={setSelectedRoomId} />
        )}
      </div>
      
      {/* Desktop Tasks Panel */}
      {showTasks && (
        <div className="hidden md:block shrink-0 h-full z-10 border-l border-zinc-800 shadow-2xl">
          <Tasks user={user} />
        </div>
      )}
    </div>
  );
}
