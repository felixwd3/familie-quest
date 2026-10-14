'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { User, Task, Reward, Wish } from '@/lib/types';

export default function Home() {
  const [users, setUsers] = useState<User[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [wishes, setWishes] = useState<Wish[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'quests' | 'shop'>('quests');
  const [loading, setLoading] = useState<boolean>(true);
  const [isClient, setIsClient] = useState<boolean>(false);

  // Tilstand for det nye ønske-felt
  const [newWishTitle, setNewWishTitle] = useState<string>('');
  const [newWishNote, setNewWishNote] = useState<string>('');
  const [submittingWish, setSubmittingWish] = useState<boolean>(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient) return;

    async function fetchData() {
      try {
        setLoading(true);
        const { data: usersData } = await supabase.from('users').select('*');
        const { data: tasksData } = await supabase.from('tasks').select('*');
        const { data: rewardsData } = await supabase.from('rewards').select('*');
        const { data: wishesData } = await supabase.from('wishes').select('*');

        if (usersData) {
          setUsers(usersData);
          if (usersData.length > 0) setSelectedUser(usersData[0].id);
        }
        if (tasksData) setTasks(tasksData);
        if (rewardsData) setRewards(rewardsData);
        if (wishesData) setWishes(wishesData);
      } catch (err) {
        console.error('Fejl ved indlæsning af data:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [isClient]);

  // Registrer udført opgave -> Tilføj XP
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

      const newTotalXp = (currentUser.total_xp || 0) + xpEarned;
      const newSpendableXp = (currentUser.spendable_xp || 0) + xpEarned;

      await supabase
        .from('users')
        .update({ total_xp: newTotalXp, spendable_xp: newSpendableXp })
        .eq('id', selectedUser);

      setUsers(
        users.map((u) =>
          u.id === selectedUser
            ? { ...u, total_xp: newTotalXp, spendable_xp: newSpendableXp }
            : u
        )
      );

      alert(`🎉 Godt gået, ${currentUser.name}! Du optjente +${xpEarned} XP!`);
    } catch (err) {
      console.error('Fejl ved gemning af opgave:', err);
    }
  };

  // Køb belønning i BørneShoppen
  const buyReward = async (reward: Reward) => {
    const currentUser = users.find((u) => u.id === selectedUser);
    if (!currentUser) return;

    if ((currentUser.spendable_xp || 0) < reward.cost_xp) {
      alert(`⚠️ Du mangler ${reward.cost_xp - (currentUser.spendable_xp || 0)} XP for at kunne købe ${reward.title}!`);
      return;
    }

    const confirmBuy = confirm(`Vil du købe "${reward.title}" for ${reward.cost_xp} XP?`);
    if (!confirmBuy) return;

    try {
      await supabase.from('purchases').insert([
        {
          user_id: selectedUser,
          reward_id: reward.id,
          cost_xp: reward.cost_xp,
          status: 'pending',
        },
      ]);

      const newSpendableXp = currentUser.spendable_xp - reward.cost_xp;
      await supabase
        .from('users')
        .update({ spendable_xp: newSpendableXp })
        .eq('id', selectedUser);

      setUsers(
        users.map((u) =>
          u.id === selectedUser ? { ...u, spendable_xp: newSpendableXp } : u
        )
      );

      alert(`🛍️ Tillykke! Du har købt ${reward.title}! Spørg mor eller far om at hente din belønning.`);
    } catch (err) {
      console.error('Fejl ved køb:', err);
    }
  };

  // Send nyt ønske til Shoppen
  const submitWish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWishTitle.trim() || !selectedUser) return;

    setSubmittingWish(true);
    try {
      const { data, error } = await supabase
        .from('wishes')
        .insert([
          {
            user_id: selectedUser,
            title: newWishTitle.trim(),
            note: newWishNote.trim(),
            status: 'pending',
          },
        ])
        .select();

      if (error) throw error;

      if (data) {
        setWishes([...wishes, data[0]]);
      }

      setNewWishTitle('');
      setNewWishNote('');
      alert('🌟 Ønsket er sendt! Mor eller far kigger på det og sætter en pris i XP.');
    } catch (err) {
      console.error('Fejl ved oprettelse af ønske:', err);
      alert('Der opstod en fejl ved gemning af ønsket.');
    } finally {
      setSubmittingWish(false);
    }
  };

  if (!isClient || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900 text-white">
        <p className="text-xl animate-pulse">Henter FamilieQuest data...</p>
      </div>
    );
  }

  const activeUserData = users.find((u) => u.id === selectedUser);
  const userWishes = wishes.filter((w) => w.user_id === selectedUser);

  return (
    <main className="min-h-screen bg-slate-900 text-slate-100 p-4 md:p-8 max-w-4xl mx-auto">
      {/* Overskrift & Brugerforvalger */}
      <header className="flex justify-between items-center mb-6 border-b border-slate-800 pb-4 flex-wrap gap-4">
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
                {u.name} ({u.spendable_xp || 0} rådige XP)
              </option>
            ))}
          </select>
        </div>
      </header>

      {/* Familiens Stilling */}
      <section className="mb-6 bg-slate-800/50 p-4 rounded-xl border border-slate-700">
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
                <p className="text-xs text-slate-400">Total: {u.total_xp || 0} XP</p>
              </div>
              <div className="text-right">
                <span className="bg-amber-500/20 text-amber-300 font-extrabold px-3 py-1 rounded-full text-sm block">
                  🪙 {u.spendable_xp || 0} XP
                </span>
                <span className="text-[10px] text-slate-400 mt-1 block">til shoppen</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Navigation til Faneblade */}
      <div className="flex border-b border-slate-800 mb-6 gap-2">
        <button
          onClick={() => setActiveTab('quests')}
          className={`pb-3 px-4 font-bold text-sm border-b-2 transition ${
            activeTab === 'quests'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          📜 Dagens Quests
        </button>
        <button
          onClick={() => setActiveTab('shop')}
          className={`pb-3 px-4 font-bold text-sm border-b-2 transition ${
            activeTab === 'shop'
              ? 'border-amber-500 text-amber-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          🛒 BørneShoppen {activeUserData && `(${activeUserData.spendable_xp || 0} XP)`}
        </button>
      </div>

      {/* Fane 1: Dagens Quests */}
      {activeTab === 'quests' && (
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
                    className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold px-4 py-2 rounded-lg transition active:scale-95 whitespace-nowrap shadow-sm cursor-pointer"
                  >
                    +{xp} XP
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Fane 2: BørneShoppen & Ønskeseddel */}
      {activeTab === 'shop' && (
        <section className="space-y-8">
          {/* Varer i Shoppen */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-amber-300">🛒 BørneShoppen</h2>
              <p className="text-sm text-slate-400">
                Aktiv opsparing: <span className="font-extrabold text-amber-400">{activeUserData?.spendable_xp || 0} XP</span>
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {rewards.map((reward) => {
                const canAfford = (activeUserData?.spendable_xp || 0) >= reward.cost_xp;
                return (
                  <div
                    key={reward.id}
                    className={`p-4 rounded-xl border transition flex justify-between items-center gap-4 ${
                      canAfford
                        ? 'bg-slate-800 border-amber-500/50 hover:border-amber-400'
                        : 'bg-slate-800/40 border-slate-800 opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{reward.icon}</span>
                      <div>
                        <h3 className="font-bold text-slate-100">{reward.title}</h3>
                        <p className="text-xs text-slate-400 mt-0.5">{reward.description}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => buyReward(reward)}
                      disabled={!canAfford}
                      className={`text-sm font-bold px-4 py-2 rounded-lg transition active:scale-95 whitespace-nowrap shadow-sm ${
                        canAfford
                          ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 cursor-pointer'
                          : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      Køb ({reward.cost_xp} XP)
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Ønskeseddel Formular & Liste */}
          <div className="bg-slate-800/40 p-5 rounded-2xl border border-slate-700/80">
            <h3 className="text-lg font-bold text-indigo-300 mb-2 flex items-center gap-2">
              ✨ Send et Ønske til Shoppen
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Mangler der noget i shoppen, som du sparer op til? Skriv dit ønske herunder!
            </p>

            <form onSubmit={submitWish} className="flex flex-col gap-3 mb-6">
              <input
                type="text"
                placeholder="Hvad ønsker du dig? (f.eks. Nyt LEGO Star Wars sæt)"
                value={newWishTitle}
                onChange={(e) => setNewWishTitle(e.target.value)}
                required
                className="bg-slate-900 text-white border border-slate-700 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <input
                type="text"
                placeholder="Eventuel bemærkning (valgfri)"
                value={newWishNote}
                onChange={(e) => setNewWishNote(e.target.value)}
                className="bg-slate-900 text-white border border-slate-700 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="submit"
                disabled={submittingWish}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 px-4 rounded-lg text-sm transition active:scale-95 self-start cursor-pointer"
              >
                {submittingWish ? 'Sender...' : 'Send Ønske 🚀'}
              </button>
            </form>

            {/* Mine Sendte Ønsker */}
            {userWishes.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Sendte Ønsker ({userWishes.length})
                </h4>
                <div className="space-y-2">
                  {userWishes.map((w) => (
                    <div
                      key={w.id}
                      className="bg-slate-900/60 p-3 rounded-lg border border-slate-800 flex justify-between items-center"
                    >
                      <div>
                        <p className="font-semibold text-slate-200 text-sm">{w.title}</p>
                        {w.note && <p className="text-xs text-slate-400">{w.note}</p>}
                      </div>
                      <span className="text-xs bg-indigo-950 text-indigo-300 border border-indigo-800 px-2.5 py-1 rounded-full">
                        Afventer pris... ⏳
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      )}
    </main>
  );
}