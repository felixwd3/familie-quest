'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { User, Task } from '@/lib/types';

export default function Home() {
  const [users, setUsers] = useState<User[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [isClient, setIsClient] = useState<boolean>(false);

  // 1. Tving komponenten til FØRST at køre efter rendering i browseren
  useEffect(() => {
    setIsClient(true);
  }, []);

  // 2. Hent data når koden kører på klienten
  useEffect(() => {
    if (!isClient) return;

    async function fetchData() {
      try {
        setLoading(true);
        const { data: usersData } = await supabase.from('users').select('*');
        const { data: tasksData } = await supabase.from('tasks').select('*');

        if (usersData) {
          setUsers(usersData);
          if (usersData.length > 0) setSelectedUser(usersData[0].id);
        }
        if (tasksData) {
          setTasks(tasksData);
        }
      } catch (err) {
        console.error('Fejl ved indlæsning af data:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [isClient]);

  const completeTask = async (task: Task) => {
    if (!selectedUser) return;

    const xpEarned = Math.round(task.duration_minutes * task.difficulty);
    const currentUser = users.find((u) => u.id === selectedUser);

    if (!currentUser) return;

    try {
      await supabase.from('event_logs').insert([
        {
          user_id: selectedUser,
          task_id: task.id,
          xp_earned: xpEarned,
        },
      ]);

      const newXp = currentUser.total_xp + xpEarned;
      await supabase
        .from('users')
        .update({ total_xp: newXp })
        .eq('id', selectedUser);

      setUsers(
        users.map((u) => (u.id === selectedUser ? { ...u, total_xp: newXp } : u))
      );

      alert(`🎉 Godt gået! Du optjente ${xpEarned} XP!`);
    } catch (err) {
      console.error('Fejl ved gemning:', err);
    }
  };

  // Vis en simpel indlæsningstilstand under build/SSR
  if (!isClient || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900 text-white">
        <p className="text-xl animate-pulse">Henter FamilieQuest data...</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-900 text-slate-100 p-4 md:p-8 max-w-4xl mx-auto">
      <header className="flex justify-between items-center mb-8 border-b border-slate-800 pb-4 flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-indigo-400">FamilieQuest ⚔️</h1>
          <p className="text-slate-400 text-sm">Gør huslige pligter til et eventyr</p>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-slate-300">Aktiv spiller:</label>
          <select
            value={selectedUser}
            onChange={(e) => setSelectedUser(e.target.value)}
            className="bg-slate-800 text-white border border-slate-700 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
          >
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.total_xp} XP)
              </option>
            ))}
          </select>
        </div>
      </header>

      <section className="mb-8 bg-slate-800/50 p-4 rounded-xl border border-slate-700">
        <h2 className="text-lg font-semibold mb-3 text-slate-200">📊 Familiens Stilling</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {users.map((u) => (
            <div
              key={u.id}
              className={`p-3 rounded-lg border flex justify-between items-center transition ${
                u.id === selectedUser
                  ? 'bg-slate-800 border-indigo-500 ring-1 ring-indigo-500'
                  : 'bg-slate-800/60 border-slate-700'
              }`}
            >
              <div>
                <p className="font-bold text-white">{u.name}</p>
                <p className="text-xs text-slate-400 uppercase">{u.role === 'child' ? 'Barn' : 'Voksen'}</p>
              </div>
              <span className="bg-indigo-900/60 text-indigo-300 font-extrabold px-3 py-1 rounded-full text-sm">
                {u.total_xp} XP
              </span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-xl font-bold mb-4 text-slate-200">📜 Tilgængelige Quests</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {tasks.map((task) => {
            const xp = Math.round(task.duration_minutes * task.difficulty);
            return (
              <div
                key={task.id}
                className="bg-slate-800 p-4 rounded-xl border border-slate-700 hover:border-slate-600 transition flex justify-between items-center gap-4"
              >
                <div>
                  <h3 className="font-bold text-slate-100">{task.title}</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {task.category} • {task.duration_minutes} min • Sværhedsgrad {task.difficulty}x
                  </p>
                </div>
                <button
                  onClick={() => completeTask(task)}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold px-4 py-2 rounded-lg transition active:scale-95 whitespace-nowrap shadow-sm"
                >
                  +{xp} XP
                </button>
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}