import React, { useState } from 'react';
import { X, Clock, CheckCircle } from 'lucide-react';
import { ITask } from '@/models/Task';

type TaskModalTask = Pick<ITask, '_id' | 'title' | 'description' | 'subtasks'> & {
  _id: string;
  subtasks?: Array<{ title: string; isCompleted: boolean }>;
};

interface TaskModalProps {
  task: TaskModalTask;
  onClose: () => void;
  onUpdate: () => void;
}

export default function TaskModal({ task, onClose, onUpdate }: TaskModalProps) {
  const [subtasks, setSubtasks] = useState(task.subtasks || []);
  const [newSubtask, setNewSubtask] = useState('');

  const handleAddSubtask = async (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && newSubtask.trim() !== '') {
      const updated = [...subtasks, { title: newSubtask, isCompleted: false }];
      setSubtasks(updated);
      setNewSubtask('');
      
      // Update logic would go here
      await fetch(`/api/tasks/${task._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subtasks: updated })
      });
      onUpdate();
    }
  };

  const toggleSubtask = async (index: number) => {
    const updated = [...subtasks];
    updated[index].isCompleted = !updated[index].isCompleted;
    setSubtasks(updated);

    await fetch(`/api/tasks/${task._id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subtasks: updated })
    });
    onUpdate();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content glass animate-fade-in" onClick={e => e.stopPropagation()}>
        <header className="modal-header">
          <h2>{task.title}</h2>
          <button className="icon-btn" onClick={onClose}><X size={20} /></button>
        </header>

        <div className="modal-body">
          <div className="task-section">
            <label className="text-muted text-sm font-semibold">DESCRIPTION</label>
            <p className="mt-2 text-sm">{task.description || 'No description provided.'}</p>
          </div>

          <div className="task-section mt-4">
            <label className="text-muted text-sm font-semibold flex items-center gap-2">
              <CheckCircle size={16}/> SUBTASKS
            </label>
            <div className="subtasks-list mt-2">
              {subtasks.map((st: { title: string; isCompleted: boolean }, i: number) => (
                <div key={i} className="subtask-item flex items-center gap-2 mb-2">
                  <input 
                    type="checkbox" 
                    checked={st.isCompleted} 
                    onChange={() => toggleSubtask(i)}
                  />
                  <span className={st.isCompleted ? 'text-muted line-through text-sm' : 'text-sm'}>{st.title}</span>
                </div>
              ))}
              <input 
                type="text" 
                placeholder="Add subtask and press enter..." 
                className="modal-input mt-2"
                value={newSubtask}
                onChange={e => setNewSubtask(e.target.value)}
                onKeyDown={handleAddSubtask}
              />
            </div>
          </div>
          
          <div className="task-section flex items-center gap-4 mt-6 p-4 rounded-md bg-surface-hover">
             <div className="flex items-center gap-2 text-sm text-primary font-medium cursor-pointer">
                <Clock size={16} /> Request Deadline Extension
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
