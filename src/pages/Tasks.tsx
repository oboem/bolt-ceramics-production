import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import Header from '../components/layout/Header';
import {
  Plus, X, CheckCircle2, Circle, Clock, AlertTriangle, Trash2,
  ChevronDown, Tag, Calendar, Flame, ArrowUp, Minus,
} from 'lucide-react';

type TaskStatus = 'todo' | 'in_progress' | 'done';
type Priority = 'low' | 'medium' | 'high' | 'urgent';

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: Priority;
  category: string | null;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
}

const PRIORITY_CONFIG: Record<Priority, { label: string; color: string; icon: React.ReactNode }> = {
  urgent: { label: 'Urgent', color: 'text-red-600 bg-red-50 border-red-200', icon: <Flame size={11} /> },
  high:   { label: 'High',   color: 'text-orange-600 bg-orange-50 border-orange-200', icon: <ArrowUp size={11} /> },
  medium: { label: 'Medium', color: 'text-amber-600 bg-amber-50 border-amber-200', icon: <Minus size={11} /> },
  low:    { label: 'Low',    color: 'text-slate-500 bg-slate-50 border-slate-200', icon: <ChevronDown size={11} /> },
};

const STATUS_ORDER: TaskStatus[] = ['todo', 'in_progress', 'done'];

function PriorityBadge({ priority }: { priority: Priority }) {
  const cfg = PRIORITY_CONFIG[priority];
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${cfg.color}`}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

function isOverdue(task: Task) {
  return task.due_date && task.status !== 'done' && new Date(task.due_date + 'T00:00:00') < new Date();
}

function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function fmtRelative(d: string) {
  const now = new Date();
  const date = new Date(d + 'T00:00:00');
  const diff = Math.round((date.getTime() - now.setHours(0, 0, 0, 0)) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  if (diff < 0) return `${Math.abs(diff)}d overdue`;
  return `in ${diff}d`;
}

export default function Tasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'active' | 'done' | 'all'>('active');
  const [filterPriority, setFilterPriority] = useState<Priority | 'all'>('all');
  const [editTask, setEditTask] = useState<Task | null>(null);

  const [form, setForm] = useState({
    title: '',
    description: '',
    priority: 'medium' as Priority,
    category: '',
    due_date: '',
  });

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('tasks')
      .select('id, title, description, status, priority, category, due_date, completed_at, created_at')
      .order('created_at', { ascending: false });
    if (data) setTasks(data as Task[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const resetForm = () => setForm({ title: '', description: '', priority: 'medium', category: '', due_date: '' });

  const openNew = () => { resetForm(); setEditTask(null); setShowForm(true); };

  const openEdit = (task: Task) => {
    setForm({
      title: task.title,
      description: task.description ?? '',
      priority: task.priority,
      category: task.category ?? '',
      due_date: task.due_date ?? '',
    });
    setEditTask(task);
    setShowForm(true);
  };

  const saveTask = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      priority: form.priority,
      category: form.category.trim() || null,
      due_date: form.due_date || null,
      updated_at: new Date().toISOString(),
    };

    if (editTask) {
      await supabase.from('tasks').update(payload).eq('id', editTask.id);
    } else {
      await supabase.from('tasks').insert({ ...payload, status: 'todo' });
    }

    setShowForm(false);
    resetForm();
    setEditTask(null);
    setSaving(false);
    load();
  };

  const cycleStatus = async (task: Task) => {
    const next = STATUS_ORDER[(STATUS_ORDER.indexOf(task.status) + 1) % STATUS_ORDER.length];
    const update: any = { status: next, updated_at: new Date().toISOString() };
    if (next === 'done') update.completed_at = new Date().toISOString();
    if (next !== 'done') update.completed_at = null;
    await supabase.from('tasks').update(update).eq('id', task.id);
    load();
  };

  const markDone = async (task: Task) => {
    if (task.status === 'done') {
      await supabase.from('tasks').update({ status: 'todo', completed_at: null, updated_at: new Date().toISOString() }).eq('id', task.id);
    } else {
      await supabase.from('tasks').update({ status: 'done', completed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', task.id);
    }
    load();
  };

  const deleteTask = async (id: string) => {
    await supabase.from('tasks').delete().eq('id', id);
    load();
  };

  // Filtering
  let filtered = tasks;
  if (filterStatus === 'active') filtered = filtered.filter(t => t.status !== 'done');
  if (filterStatus === 'done') filtered = filtered.filter(t => t.status === 'done');
  if (filterPriority !== 'all') filtered = filtered.filter(t => t.priority === filterPriority);

  // Group active tasks: urgent/overdue first, then by priority
  const active = filtered.filter(t => t.status !== 'done');
  const done = filtered.filter(t => t.status === 'done');

  const priorityOrder: Priority[] = ['urgent', 'high', 'medium', 'low'];
  const sortedActive = [...active].sort((a, b) => {
    const aOverdue = isOverdue(a) ? 0 : 1;
    const bOverdue = isOverdue(b) ? 0 : 1;
    if (aOverdue !== bOverdue) return aOverdue - bOverdue;
    return priorityOrder.indexOf(a.priority) - priorityOrder.indexOf(b.priority);
  });

  const counts = {
    todo: tasks.filter(t => t.status === 'todo').length,
    in_progress: tasks.filter(t => t.status === 'in_progress').length,
    done: tasks.filter(t => t.status === 'done').length,
    overdue: tasks.filter(t => isOverdue(t)).length,
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50">
      <Header
        title="Tasks"
        subtitle={`${counts.todo + counts.in_progress} open · ${counts.done} completed`}
        onRefresh={load}
        loading={loading}
        actions={
          <button
            onClick={openNew}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-amber-500 hover:bg-amber-600 rounded-lg transition-colors"
          >
            <Plus size={15} /> New Task
          </button>
        }
      />

      <div className="p-8 space-y-6">

        {/* Summary stats */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'To Do', value: counts.todo, color: 'bg-blue-50 border-blue-100', text: 'text-blue-700', sub: 'not started' },
            { label: 'In Progress', value: counts.in_progress, color: 'bg-amber-50 border-amber-100', text: 'text-amber-700', sub: 'being worked on' },
            { label: 'Completed', value: counts.done, color: 'bg-green-50 border-green-100', text: 'text-green-700', sub: 'done' },
            { label: 'Overdue', value: counts.overdue, color: counts.overdue > 0 ? 'bg-red-50 border-red-100' : 'bg-slate-50 border-slate-100', text: counts.overdue > 0 ? 'text-red-700' : 'text-slate-500', sub: 'past due date' },
          ].map(s => (
            <div key={s.label} className={`bg-white rounded-xl border ${s.color} px-5 py-4`}>
              <p className={`text-3xl font-black ${s.text}`}>{s.value}</p>
              <p className="text-sm font-semibold text-slate-800 mt-0.5">{s.label}</p>
              <p className="text-xs text-slate-400">{s.sub}</p>
            </div>
          ))}
        </div>

        {/* New / Edit task form */}
        {showForm && (
          <div className="bg-white rounded-xl border border-amber-200 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-amber-100 bg-amber-50">
              <h3 className="font-semibold text-slate-900">{editTask ? 'Edit Task' : 'New Task'}</h3>
              <button onClick={() => { setShowForm(false); setEditTask(null); }} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Task Title *</label>
                <input
                  autoFocus
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  placeholder="What needs to be done?"
                  value={form.title}
                  onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && saveTask()}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Description</label>
                <textarea
                  rows={2}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
                  placeholder="Additional details (optional)"
                  value={form.description}
                  onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Priority</label>
                  <select
                    value={form.priority}
                    onChange={e => setForm(p => ({ ...p, priority: e.target.value as Priority }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                  >
                    <option value="urgent">Urgent</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Category</label>
                  <input
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                    placeholder="e.g. Production, Admin"
                    value={form.category}
                    onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Due Date</label>
                  <input
                    type="date"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                    value={form.due_date}
                    onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))}
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  onClick={saveTask}
                  disabled={saving || !form.title.trim()}
                  className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
                >
                  {saving ? 'Saving...' : editTask ? 'Save Changes' : 'Create Task'}
                </button>
                <button onClick={() => { setShowForm(false); setEditTask(null); }} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            {(['active', 'done', 'all'] as const).map(s => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  filterStatus === s ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {s === 'active' ? 'Active' : s === 'done' ? 'Completed' : 'All'}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Priority:</span>
            <select
              value={filterPriority}
              onChange={e => setFilterPriority(e.target.value as Priority | 'all')}
              className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400"
            >
              <option value="all">All</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-slate-400">Loading tasks...</div>
        ) : (
          <>
            {/* Active tasks */}
            {filterStatus !== 'done' && (
              <div className="space-y-2">
                {sortedActive.length === 0 ? (
                  <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
                    <CheckCircle2 size={32} className="text-green-300 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-slate-700">All caught up!</p>
                    <p className="text-xs text-slate-400 mt-1">No active tasks. Add one above.</p>
                  </div>
                ) : (
                  sortedActive.map(task => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      onToggleDone={() => markDone(task)}
                      onCycleStatus={() => cycleStatus(task)}
                      onEdit={() => openEdit(task)}
                      onDelete={() => deleteTask(task.id)}
                    />
                  ))
                )}
              </div>
            )}

            {/* Completed tasks */}
            {filterStatus !== 'active' && done.length > 0 && (
              <div>
                {filterStatus === 'all' && (
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex-1 h-px bg-slate-200" />
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Recently Completed</span>
                    <div className="flex-1 h-px bg-slate-200" />
                  </div>
                )}
                <div className="space-y-2">
                  {done.map(task => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      onToggleDone={() => markDone(task)}
                      onCycleStatus={() => cycleStatus(task)}
                      onEdit={() => openEdit(task)}
                      onDelete={() => deleteTask(task.id)}
                    />
                  ))}
                </div>
              </div>
            )}

            {filterStatus === 'done' && done.length === 0 && (
              <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
                <p className="text-sm text-slate-400">No completed tasks yet.</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

interface TaskRowProps {
  task: Task;
  onToggleDone: () => void;
  onCycleStatus: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function TaskRow({ task, onToggleDone, onCycleStatus, onEdit, onDelete }: TaskRowProps) {
  const overdue = isOverdue(task);
  const isDone = task.status === 'done';

  const statusBtn: Record<TaskStatus, { label: string; style: string }> = {
    todo:        { label: 'To Do',       style: 'bg-slate-100 text-slate-600 hover:bg-blue-100 hover:text-blue-700' },
    in_progress: { label: 'In Progress', style: 'bg-amber-100 text-amber-700 hover:bg-green-100 hover:text-green-700' },
    done:        { label: 'Done',        style: 'bg-green-100 text-green-700 hover:bg-slate-100 hover:text-slate-600' },
  };

  return (
    <div className={`group flex items-start gap-4 bg-white rounded-xl border px-5 py-4 transition-all ${
      isDone ? 'border-slate-100 opacity-60' : overdue ? 'border-red-200' : 'border-slate-200'
    }`}>
      {/* Done toggle */}
      <button
        onClick={onToggleDone}
        className={`mt-0.5 shrink-0 transition-colors ${isDone ? 'text-green-500 hover:text-slate-300' : 'text-slate-300 hover:text-green-500'}`}
      >
        {isDone ? <CheckCircle2 size={20} /> : <Circle size={20} />}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2 flex-wrap">
          <span
            onClick={onEdit}
            className={`text-sm font-semibold cursor-pointer hover:text-amber-600 transition-colors ${isDone ? 'line-through text-slate-400' : 'text-slate-900'}`}
          >
            {task.title}
          </span>
          <PriorityBadge priority={task.priority} />
          {overdue && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
              <AlertTriangle size={10} /> Overdue
            </span>
          )}
        </div>

        {task.description && (
          <p className={`text-xs mt-1 ${isDone ? 'text-slate-300' : 'text-slate-500'}`}>{task.description}</p>
        )}

        <div className="flex items-center gap-3 mt-2 flex-wrap">
          {/* Status cycle button */}
          <button
            onClick={onCycleStatus}
            className={`text-xs font-semibold px-2.5 py-0.5 rounded-full transition-colors ${statusBtn[task.status].style}`}
          >
            {statusBtn[task.status].label}
          </button>

          {task.category && (
            <span className="inline-flex items-center gap-1 text-xs text-slate-500">
              <Tag size={10} /> {task.category}
            </span>
          )}

          {task.due_date && (
            <span className={`inline-flex items-center gap-1 text-xs font-medium ${overdue ? 'text-red-500' : isDone ? 'text-slate-300' : 'text-slate-500'}`}>
              <Calendar size={10} />
              {fmtDate(task.due_date)}
              {!isDone && <span className="opacity-70">({fmtRelative(task.due_date)})</span>}
            </span>
          )}

          {isDone && task.completed_at && (
            <span className="inline-flex items-center gap-1 text-xs text-slate-400">
              <Clock size={10} />
              Completed {new Date(task.completed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button
          onClick={onEdit}
          className="text-xs text-slate-400 hover:text-slate-700 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 transition-colors font-medium"
        >
          Edit
        </button>
        <button
          onClick={onDelete}
          className="text-slate-300 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 transition-colors"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}
