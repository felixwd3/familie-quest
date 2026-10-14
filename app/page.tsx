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
  const [categoryFilter, setCategoryFilter] = useState<string>('Alle');
  const [loading, setLoading] = useState<boolean>(true);
  const [isClient, setIsClient] = useState<boolean>(false);

  // Form til nyt ønske
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

  // Beregn niveau ud fra total XP
  const calculateLevel = (totalXp: number = 0) => {
    const level = Math.floor(totalXp / 100) + 1;
    const currentLevelXp = totalXp % 100;
    return { level, progress: currentLevelXp };
  };

  // Ikoner ud fra opgavekategori
  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'Køkken': return '🍳';
      case 'Rengøring': return '🧹';
      case 'Badeværelse': return '🪠';
      case 'Tøjvask': return '🧺';
      case 'Sengelinned': return '🛏️';
      case 'Affald': return '♻️';
      case 'Børne-quest': return '🧸';
      default: return '📜';
    }
  };

  // Registrer opgave
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

      alert(`⚔️ VIKTORIE! ${currentUser.name} gennemførte "${task.title}" og optjente +${xpEarned} XP! 🌟`);
    } catch (err) {
      console.error('Fejl ved gemning af opgave:', err);
    }
  };

  // Køb belønning
  const buyReward = async (reward: Reward) => {
    const currentUser = users.find((u) => u.id === selectedUser);
    if (!currentUser) return;

    if ((currentUser.spendable_xp || 0) < reward.cost_xp) {
      alert(`⚠️ Du mangler ${reward.cost_xp - (currentUser.spendable_xp || 0)} XP for at kunne købe ${reward.title}!`);
      return;
    }

    if (!confirm(`Vil du indløse "${reward.title}" for ${reward.cost_xp} XP?`)) return;

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

      alert(`🎁 BELØNNING INDLØST! Tillykke med ${reward.title}!`);
    } catch (err) {
      console.error('Fejl ved køb:', err);
    }
  };

  // Opret Ønske
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

      if (data) setWishes([...wishes, data[0]]);

      setNewWishTitle('');
      setNewWishNote('');
      alert('🌟 Ønsket er sendt til forældrenes guild-mastere!');
    } catch (err) {
      console.error('Fejl ved oprettelse af ønske:', err);
    } finally {
      setSubmittingWish(false);
    }
  };

  // Godkend Ønske
  const approveWish = async (wish: Wish) => {
    const costInput = prompt(`Indtast XP-pris for "${wish.title}":`, '100');
    if (!costInput) return;

    const costXp = parseInt(costInput, 10);
    if (isNaN(costXp) || costXp <= 0) return;

    try {
      const { data: newReward, error: rewardError } = await supabase
        .from('rewards')
        .insert([
          {
            title: wish.title,
            description: wish.note || 'Ønske oprettet af barn',
            cost_xp: costXp,
            icon: '🎯',
            category: 'Ønsker',
          },
        ])
        .select();

      if (rewardError) throw rewardError;

      await supabase.from('wishes').update({ status: 'approved' }).eq('id', wish.id);

      if (newReward) setRewards([...rewards, newReward[0]]);
      setWishes(wishes.map((w) => (w.id === wish.id ? { ...w, status: 'approved' } : w)));

      alert(`✅ Ønsket "${wish.title}" er nu godkendt og koster ${costXp} XP!`);
    } catch (err) {
      console.error('Fejl ved godkendelse:', err);
    }
  };

  const rejectWish = async (wish: Wish) => {
    if (!confirm(`Afvis ønsket "${wish.title}"?`)) return;

    try {
      await supabase.from('wishes').update({ status: 'rejected' }).eq('id', wish.id);
      setWishes(wishes.map((w) => (w.id === wish.id ? { ...w, status: 'rejected' } : w)));
    } catch (err) {
      console.error('Fejl ved afvisning:', err);
    }
  };

  if (!isClient || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-indigo-400">
        <div className="text-center space-y-3">
          <div className="text-5xl animate-bounce">⚔️</div>
          <p className="text-lg font-bold tracking-wider animate-pulse">Forbereder FamilieQuest...</p>
        </div>
      </div>
    );
  }

  const activeUserData = users.find((u) => u.id === selectedUser);
  const isAdult = activeUserData?.role === 'adult';
  const userWishes = wishes.filter((w) => w.user_id === selectedUser && w.status === 'pending');
  const pendingWishesAll = wishes.filter((w) => w.status === 'pending');

  const categories = ['Alle', ...Array.from(new Set(tasks.map((t) => t.category)))];
  const filteredTasks = categoryFilter === 'Alle' ? tasks : tasks.filter((t) => t.category === categoryFilter);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 pb-12">
      {/* RPG Top Navigation Header */}
      <div className="bg-slate-900/80 border-b border-indigo-900/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-3 flex justify-between items-center flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-xl shadow-lg shadow-indigo-500/30">
              ⚔️
            </div>
            <div>
              <h1 className="text-xl font-black tracking-wide bg-gradient-to-r from-indigo-300 via-violet-200 to-amber-300 bg-clip-text text-transparent">
                FamilieQuest
              </h1>
              <p className="text-[11px] text-slate-400 font-medium">Lvl Up Husholdningen</p>
            </div>
          </div>

          {/* Aktiv Helt Vælger */}
          <div className="flex items-center gap-2 bg-slate-950/80 p-1.5 rounded-xl border border-slate-800">
            <span className="text-xs text-slate-400 font-bold pl-2 hidden sm:inline">Aktiv Helt:</span>
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="bg-indigo-950 text-amber-300 font-bold border border-indigo-800/80 rounded-lg px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 cursor-pointer shadow-inner"
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} {u.role === 'child' ? '🧒' : '👑'} ({u.spendable_xp || 0} XP)
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 pt-6 space-y-8">
        {/* Familiens Helte-Cards (Leaderboard) */}
        <section>
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-xs font-black uppercase tracking-widest text-indigo-400/90 flex items-center gap-1.5">
              <span>🛡️</span> Familiens Helte
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {users.map((u) => {
              const { level, progress } = calculateLevel(u.total_xp);
              const isSelected = u.id === selectedUser;

              return (
                <div
                  key={u.id}
                  onClick={() => setSelectedUser(u.id)}
                  className={`relative overflow-hidden rounded-2xl p-4 transition cursor-pointer border ${
                    isSelected
                      ? 'bg-gradient-to-b from-indigo-950/80 to-slate-900 border-amber-400/80 shadow-lg shadow-indigo-500/20 ring-1 ring-amber-400/50'
                      : 'bg-slate-900/60 border-slate-800/80 hover:border-slate-700'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-extrabold text-slate-100 text-lg">{u.name}</span>
                        {u.role === 'adult' ? (
                          <span className="text-[10px] bg-indigo-950 text-indigo-300 font-bold px-2 py-0.5 rounded-full border border-indigo-800">
                            Voksen
                          </span>
                        ) : (
                          <span className="text-[10px] bg-amber-950 text-amber-300 font-bold px-2 py-0.5 rounded-full border border-amber-800">
                            Junior
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-indigo-300 font-semibold mt-0.5">Level {level} Eventyrer</p>
                    </div>

                    <div className="text-right">
                      <span className="inline-flex items-center gap-1 bg-amber-500/10 border border-amber-500/30 text-amber-300 font-black px-2.5 py-1 rounded-xl text-sm shadow-sm">
                        🪙 {u.spendable_xp || 0}
                      </span>
                    </div>
                  </div>

                  {/* Level Progress Bar */}
                  <div className="space-y-1 mt-3">
                    <div className="flex justify-between text-[10px] font-bold text-slate-400">
                      <span>Lvl {level}</span>
                      <span>{progress} / 100 XP til Lvl {level + 1}</span>
                    </div>
                    <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
                      <div
                        className="bg-gradient-to-r from-indigo-500 via-violet-400 to-amber-400 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${progress}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Faneblad Navigation */}
        <div className="flex bg-slate-900/90 p-1.5 rounded-2xl border border-slate-800 max-w-md mx-auto shadow-inner">
          <button
            onClick={() => setActiveTab('quests')}
            className={`flex-1 py-2.5 rounded-xl font-extrabold text-sm transition flex justify-center items-center gap-2 ${
              activeTab === 'quests'
                ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>📜</span> Quests
          </button>
          <button
            onClick={() => setActiveTab('shop')}
            className={`flex-1 py-2.5 rounded-xl font-extrabold text-sm transition flex justify-center items-center gap-2 ${
              activeTab === 'shop'
                ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 shadow-md shadow-amber-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>🛒</span> BørneShop
            {activeUserData && (
              <span className="bg-slate-950/60 text-amber-300 text-xs px-2 py-0.5 rounded-full font-black border border-amber-500/30">
                {activeUserData.spendable_xp || 0} XP
              </span>
            )}
          </button>
        </div>

        {/* FANE 1: QUESTS */}
        {activeTab === 'quests' && (
          <section className="space-y-6">
            {/* Kategori-filtrering */}
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition whitespace-nowrap border ${
                    categoryFilter === cat
                      ? 'bg-indigo-600 border-indigo-400 text-white shadow-md shadow-indigo-500/20'
                      : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  {cat !== 'Alle' && getCategoryIcon(cat)} {cat}
                </button>
              ))}
            </div>

            {/* Quest Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredTasks.map((task) => {
                const xp = Math.round(task.duration_minutes * task.difficulty);
                const icon = getCategoryIcon(task.category);

                return (
                  <div
                    key={task.id}
                    className="group bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-indigo-500/50 p-4 rounded-2xl transition shadow-md flex justify-between items-center gap-4"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-12 h-12 rounded-2xl bg-indigo-950/80 border border-indigo-800/50 flex items-center justify-center text-2xl group-hover:scale-105 transition">
                        {icon}
                      </div>
                      <div>
                        <h3 className="font-extrabold text-slate-100 text-base">{task.title}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[11px] font-semibold text-indigo-300/80 bg-indigo-950 px-2 py-0.5 rounded-md border border-indigo-900/50">
                            {task.category}
                          </span>
                          <span className="text-[11px] text-slate-400 font-medium">
                            ⏱️ {task.duration_minutes} min
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => completeTask(task)}
                      className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs font-extrabold px-4 py-2.5 rounded-xl transition active:scale-95 shadow-lg shadow-indigo-600/30 whitespace-nowrap cursor-pointer"
                    >
                      +{xp} XP ⚔️
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* FANE 2: BØRNESHOP & ØNSKER */}
        {activeTab === 'shop' && (
          <section className="space-y-8">
            {/* FORÆLDRE GODKENDELSE */}
            {isAdult && pendingWishesAll.length > 0 && (
              <div className="bg-gradient-to-br from-amber-950/60 to-slate-900 p-5 rounded-2xl border border-amber-500/50 shadow-xl space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🔒</span>
                  <div>
                    <h3 className="text-base font-black text-amber-300">
                      Guild Master Kontor: Indkomne Ønsker ({pendingWishesAll.length})
                    </h3>
                    <p className="text-xs text-amber-200/60">Sæt en XP-pris for at tilføje ønsket til shoppen.</p>
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  {pendingWishesAll.map((wish) => {
                    const wishUser = users.find((u) => u.id === wish.user_id);
                    return (
                      <div
                        key={wish.id}
                        className="bg-slate-950/90 p-3.5 rounded-xl border border-amber-500/30 flex justify-between items-center flex-wrap gap-3"
                      >
                        <div>
                          <span className="text-[10px] font-extrabold text-amber-400 uppercase tracking-wider block">
                            Ønske fra {wishUser?.name || 'Barn'}
                          </span>
                          <p className="font-bold text-slate-100 text-sm">{wish.title}</p>
                          {wish.note && <p className="text-xs text-slate-400">{wish.note}</p>}
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => approveWish(wish)}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs px-3 py-1.5 rounded-lg transition active:scale-95 cursor-pointer shadow-sm"
                          >
                            Godkend & Prissæt 🏷️
                          </button>
                          <button
                            onClick={() => rejectWish(wish)}
                            className="bg-rose-950 text-rose-300 border border-rose-800 hover:bg-rose-900 font-bold text-xs px-2.5 py-1.5 rounded-lg transition active:scale-95 cursor-pointer"
                          >
                            Afvis ❌
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* BELØNNINGSSHOP */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-black text-amber-300 flex items-center gap-2">
                  <span>🛍️</span> Belønningskatalog
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {rewards.map((reward) => {
                  const canAfford = (activeUserData?.spendable_xp || 0) >= reward.cost_xp;

                  return (
                    <div
                      key={reward.id}
                      className={`p-4 rounded-2xl border transition flex justify-between items-center gap-4 ${
                        canAfford
                          ? 'bg-slate-900/90 border-amber-500/40 shadow-lg shadow-amber-500/5 hover:border-amber-400'
                          : 'bg-slate-900/40 border-slate-800/80 opacity-60'
                      }`}
                    >
                      <div className="flex items-center gap-3.5">
                        <div className="w-12 h-12 rounded-2xl bg-amber-950/50 border border-amber-800/50 flex items-center justify-center text-2xl">
                          {reward.icon}
                        </div>
                        <div>
                          <h3 className="font-extrabold text-slate-100 text-base">{reward.title}</h3>
                          <p className="text-xs text-slate-400 mt-0.5">{reward.description}</p>
                        </div>
                      </div>

                      <button
                        onClick={() => buyReward(reward)}
                        disabled={!canAfford}
                        className={`text-xs font-black px-4 py-2.5 rounded-xl transition active:scale-95 whitespace-nowrap shadow-md ${
                          canAfford
                            ? 'bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 cursor-pointer shadow-amber-500/20'
                            : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                        }`}
                      >
                        Indløs ({reward.cost_xp} XP)
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* SEND ØNSKE FORM */}
            <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800 space-y-4">
              <h3 className="text-sm font-black text-indigo-300 flex items-center gap-2">
                <span>🌟</span> Send et ønske til shoppen
              </h3>

              <form onSubmit={submitWish} className="flex flex-col gap-3">
                <input
                  type="text"
                  placeholder="Hvad ønsker du dig? (f.eks. Nyt LEGO Star Wars sæt)"
                  value={newWishTitle}
                  onChange={(e) => setNewWishTitle(e.target.value)}
                  required
                  className="bg-slate-950 text-white border border-slate-800 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/80 placeholder:text-slate-600"
                />
                <input
                  type="text"
                  placeholder="Eventuel bemærkning..."
                  value={newWishNote}
                  onChange={(e) => setNewWishNote(e.target.value)}
                  className="bg-slate-950 text-white border border-slate-800 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/80 placeholder:text-slate-600"
                />
                <button
                  type="submit"
                  disabled={submittingWish}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold py-2.5 px-5 rounded-xl text-xs transition active:scale-95 self-start cursor-pointer shadow-lg shadow-indigo-600/20"
                >
                  {submittingWish ? 'Sender...' : 'Send Ønske 🚀'}
                </button>
              </form>

              {userWishes.length > 0 && (
                <div className="pt-2">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">
                    Dine Indsendte Ønsker
                  </h4>
                  <div className="space-y-2">
                    {userWishes.map((w) => (
                      <div
                        key={w.id}
                        className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 flex justify-between items-center"
                      >
                        <div>
                          <p className="font-bold text-slate-200 text-sm">{w.title}</p>
                          {w.note && <p className="text-xs text-slate-400">{w.note}</p>}
                        </div>
                        <span className="text-[11px] bg-indigo-950 text-indigo-300 border border-indigo-900 px-2.5 py-1 rounded-full font-semibold">
                          Afventer godkendelse... ⏳
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}