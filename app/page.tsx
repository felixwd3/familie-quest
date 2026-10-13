'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { User, Task } from '@/lib/types';

export default function Home() {
  const [users, setUsers] = useState<User[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [mounted, setMounted] = useState<boolean>(false);

  // Sikr, at koden kun kører i browseren
  useEffect(() => {
    setMounted(true);
  }, []);

  // Hent data fra Supabase
  useEffect(() => {
    if (!mounted) return;

    async function fetchData() {
      try {
        setLoading(true);
        const { data: usersData, error: usersError } = await supabase.from('users').select('*');
        const { data: tasksData, error: tasksError } = await supabase.from('tasks').select('*');

        if (usersError) console.error('Fejl ved hentning af brugere:', usersError);
        if (tasksError) console.error('Fejl ved hentning af opgaver:', tasksError);

        if (usersData) {
          setUsers(usersData);
          if (usersData.length > 0) setSelectedUser(usersData[0].id);
        }
        if (tasksData) {
          setTasks(tasksData);
        }
      } catch (err) {
        console.error('Uventet fejl ved hentning af data:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [mounted]);

  // Registrer gennemført opgave og opdater XP
  const completeTask = async (task: Task) => {
    if (!selectedUser) {
      alert('Vælg venligst en aktiv spiller først.');
      return;
    }

    const xpEarned = Math.round(task.duration_minutes * task.difficulty);
    const currentUser = users.find((u) => u.id === selectedUser);

    if (!currentUser) return;

    try {
      // 1. Gem log-historik
      const { error: logError } = await supabase.from('event_logs').insert([
        {
          user_id: selectedUser,
          task_id: task.id,
          xp_earned: xpEarned,
        },
      ]);

      if (logError) throw logError;

      // 2. Opdater samlet XP på brugeren
      const newXp = currentUser.total_xp + xpEarned;
      const { error: updateError } = await supabase
        .from('users')
        .update({ total_xp: newXp })
        .eq('id', selectedUser);

      if (updateError) throw updateError;

      // 3. Opdater lokal tilstand i appen
      setUsers(
        users.map((u) => (u.id === selectedUser ? { ...u, total_xp: newXp } : u))
      );

      alert(`🎉 Godt gået, ${currentUser.name}! Du optjente ${xpEarned} XP!`);
    } catch (err) {
      console.error('Fejl ved registrering af opgave:', err);
      alert('Der opstod en fejl ved gemning af opgaven. Prøv igen.');
    }
  };

  if (!mounted || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900 text-white">
        <p className="text-xl animate-pulse">Henter FamilieQuest data...</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-900 text-slate-100 p-4 md:p-8 max-w-4xl mx-auto">
      {/* Overskrift & Spiller-skifter */}
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

      {/* Familiens Stilling / Leaderboard */}
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

      {/* Tilgængelige Quests */}
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