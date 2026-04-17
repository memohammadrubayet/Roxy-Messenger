import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { collection, query, onSnapshot, updateDoc, deleteDoc, doc, orderBy, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Checkbox } from './ui/checkbox';
import { ScrollArea } from './ui/scroll-area';
import { Plus, Trash2, CheckCircle2, Circle } from 'lucide-react';
import { format } from 'date-fns';

interface TasksProps {
  user: User;
}

interface Task {
  id: string;
  title: string;
  completed: boolean;
  createdAt: string;
}

export function Tasks({ user }: TasksProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState('');

  useEffect(() => {
    const q = query(
      collection(db, `users/${user.uid}/tasks`),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const tasksData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Task[];
      setTasks(tasksData);
    }, (error) => {
      console.error('Error listening to tasks:', error);
    });

    return () => unsubscribe();
  }, [user.uid]);

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    try {
      const taskRef = doc(collection(db, `users/${user.uid}/tasks`));
      await setDoc(taskRef, {
        id: taskRef.id,
        userId: user.uid,
        title: newTaskTitle.trim(),
        completed: false,
        createdAt: new Date().toISOString()
      });

      setNewTaskTitle('');
    } catch (error) {
      console.error('Error adding task:', error);
    }
  };

  const toggleTask = async (taskId: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, `users/${user.uid}/tasks`, taskId), {
        completed: !currentStatus
      });
    } catch (error) {
      console.error('Error toggling task:', error);
    }
  };

  const deleteTask = async (taskId: string) => {
    try {
      await deleteDoc(doc(db, `users/${user.uid}/tasks`, taskId));
    } catch (error) {
      console.error('Error deleting task:', error);
    }
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950/80 backdrop-blur-xl border-l border-zinc-800 w-full md:w-80 shadow-xl">
      <div className="p-4 border-b border-zinc-800">
        <h2 className="text-lg font-semibold text-zinc-100 flex items-center">
          <CheckCircle2 className="mr-2 h-5 w-5 text-indigo-400" />
          My Tasks
        </h2>
      </div>

      <div className="p-4 border-b border-zinc-800">
        <form onSubmit={handleAddTask} className="flex space-x-2">
          <Input
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            placeholder="Add a new task..."
            className="bg-zinc-900 border-zinc-800 text-sm"
          />
          <Button type="submit" size="icon" className="bg-indigo-600 hover:bg-indigo-700 flex-shrink-0">
            <Plus size={16} />
          </Button>
        </form>
      </div>

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-2">
          {tasks.length === 0 ? (
            <div className="text-center text-zinc-500 py-8 text-sm">
              No tasks yet. Add one above!
            </div>
          ) : (
            tasks.map(task => (
              <div 
                key={task.id} 
                className={`flex items-start space-x-3 p-3 rounded-lg border transition-colors ${
                  task.completed 
                    ? 'bg-zinc-900/50 border-zinc-800/50 opacity-60' 
                    : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'
                }`}
              >
                <button 
                  onClick={() => toggleTask(task.id, task.completed)}
                  className="mt-0.5 flex-shrink-0 text-zinc-400 hover:text-indigo-400 transition-colors"
                >
                  {task.completed ? <CheckCircle2 size={18} className="text-indigo-500" /> : <Circle size={18} />}
                </button>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm break-words ${task.completed ? 'line-through text-zinc-500' : 'text-zinc-200'}`}>
                    {task.title}
                  </p>
                  <p className="text-[10px] text-zinc-600 mt-1">
                    {format(new Date(task.createdAt), 'MMM d, h:mm a')}
                  </p>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => deleteTask(task.id)}
                  className="h-6 w-6 text-zinc-500 hover:text-red-400 hover:bg-red-400/10 flex-shrink-0"
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
