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
    const progress = totalXp % 100;
    return { level, progress };
  };

  // Ikoner til opgaver
  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'Køkken': return '🍳';
      case 'Rengøring': return '🧹';
      case 'Badeværelse': return '✨';
      case 'Tøjvask': return '🧺';
      case 'Sengelinned': return '🌿';
      case 'Affald': return '🌱';
      case 'Børne-quest': return '🎈';
      default: return '📋';
    }
  };

  // Registrer gennemført opgave
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

      alert(`🌱 Flot klaret! ${currentUser.name} optjente +${xpEarned} XP!`);
    } catch (err) {
      console.error('Fejl ved gemning af opgave:', err);
    }
  };

  // Indløs belønning
  const buyReward = async (reward: Reward) => {
    const currentUser = users.find((u) => u.id === selectedUser);
    if (!currentUser) return;

    if ((currentUser.spendable_xp || 0) < reward.cost_xp) {
      alert(`Du mangler ${reward.cost_xp - (currentUser.spendable_xp || 0)} XP for at kunne indløse ${reward.title}.`);
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

      alert(`🎁 Tillykke! Du har indløst ${reward.title}.`);
    } catch (err) {
      console.error('Fejl ved køb:', err);
    }
  };

  // Send nyt ønske
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
      alert('🌟 Ønsket er sendt videre til godkendelse!');
    } catch (err) {
      console.error('Fejl ved oprettelse af ønske:', err);
    } finally {
      setSubmittingWish(false);
    }
  };

  // Godkend Ønske
  const approveWish = async (wish: Wish) => {
    const costInput = prompt(`Angiv pris i XP for "${wish.title}":`, '100');
    if (!costInput) return;

    const costXp = parseInt(costInput, 10);
    if (isNaN(costXp) || costXp <= 0) return;

    try {
      const { data: newReward, error: rewardError } = await supabase
        .from('rewards')
        .insert([
          {
            title: wish.title,
            description: wish.note || 'Ønske indsendt af familiemedlem',
            cost_xp: costXp,
            icon: '🎁',
            category: 'Ønsker',
          },
        ])
        .select();

      if (rewardError) throw rewardError;

      await supabase.from('wishes').update({ status: 'approved' }).eq('id', wish.id);

      if (newReward) setRewards([...rewards, newReward[0]]);
      setWishes(wishes.map((w) => (w.id === wish.id ? { ...w, status: 'approved' } : w)));

      alert(`✅ Ønsket "${wish.title}" er nu godkendt til ${costXp} XP!`);
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
      <div className="flex min-h-screen items-center justify-center bg-stone-50 text-stone-600">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-stone-400 border-t-stone-800 rounded-full animate-spin mx-auto"></div>
          <p className="text-sm font-medium tracking-wide">Henter FamilieQuest...</p>
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
    <main className="min-h-screen bg-[#FAF9F6] text-stone-800 pb-16 antialiased">
      {/* Top Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-stone-200/80 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-3.5 flex justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-stone-900 text-stone-50 flex items-center justify-center text-sm font-bold shadow-sm">
              FQ
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-stone-900">FamilieQuest</h1>
              <p className="text-[11px] text-stone-500 font-medium">Hverdagens balancerede overblik</p>
            </div>
          </div>

          {/* Aktiv bruger-vælger */}
          <div className="flex items-center gap-2 bg-stone-100/80 p-1 pl-3 rounded-full border border-stone-200/60">
            <span className="text-xs text-stone-500 font-medium hidden sm:inline">Aktiv:</span>
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="bg-white text-stone-800 font-semibold border border-stone-200 rounded-full px-3 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-stone-400 cursor-pointer shadow-sm"
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.spendable_xp || 0} XP)
                </option>
              ))}
            </select>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 pt-6 space-y-8">
        {/* Profil-Kort */}
        <section>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {users.map((u) => {
              const { level, progress } = calculateLevel(u.total_xp);
              const isSelected = u.id === selectedUser;

              return (
                <div
                  key={u.id}
                  onClick={() => setSelectedUser(u.id)}
                  className={`relative rounded-2xl p-4 transition cursor-pointer border ${
                    isSelected
                      ? 'bg-white border-stone-800 shadow-md shadow-stone-200/60 ring-1 ring-stone-800/10'
                      : 'bg-white/60 border-stone-200/80 hover:bg-white hover:border-stone-300'
                  }`}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-bold text-stone-900 text-base">{u.name}</h3>
                      <p className="text-xs text-stone-500 font-medium mt-0.5">Niveau {level}</p>
                    </div>

                    <div className="text-right">
                      <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 font-bold px-2.5 py-1 rounded-full text-xs border border-emerald-200/60">
                        ✨ {u.spendable_xp || 0} XP
                      </span>
                    </div>
                  </div>

                  {/* Fremskridtslinje */}
                  <div className="space-y-1.5 mt-2">
                    <div className="flex justify-between text-[11px] font-medium text-stone-500">
                      <span>Niveaufremgang</span>
                      <span>{progress}/100</span>
                    </div>
                    <div className="w-full bg-stone-100 rounded-full h-1.5 overflow-hidden border border-stone-200/50">
                      <div
                        className="bg-stone-800 h-1.5 rounded-full transition-all duration-500"
                        style={{ width: `${progress}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Fanebladsnavigation */}
        <div className="flex bg-stone-200/60 p-1 rounded-full max-w-xs mx-auto border border-stone-200/80">
          <button
            onClick={() => setActiveTab('quests')}
            className={`flex-1 py-2 rounded-full font-bold text-xs transition text-center ${
              activeTab === 'quests'
                ? 'bg-white text-stone-900 shadow-sm'
                : 'text-stone-500 hover:text-stone-800'
            }`}
          >
            Opgaver
          </button>
          <button
            onClick={() => setActiveTab('shop')}
            className={`flex-1 py-2 rounded-full font-bold text-xs transition text-center flex items-center justify-center gap-1.5 ${
              activeTab === 'shop'
                ? 'bg-white text-stone-900 shadow-sm'
                : 'text-stone-500 hover:text-stone-800'
            }`}
          >
            <span>Shoppen</span>
            {activeUserData && (
              <span className="bg-emerald-100 text-emerald-800 text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                {activeUserData.spendable_xp || 0}
              </span>
            )}
          </button>
        </div>

        {/* FANE 1: OPGAVER */}
        {activeTab === 'quests' && (
          <section className="space-y-5">
            {/* Kategori-Piller */}
            <div className="flex gap-2 overflow-x-auto pb-1">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition whitespace-nowrap border ${
                    categoryFilter === cat
                      ? 'bg-stone-900 border-stone-900 text-white shadow-sm'
                      : 'bg-white border-stone-200 text-stone-600 hover:border-stone-300'
                  }`}
                >
                  {cat !== 'Alle' && `${getCategoryIcon(cat)} `}{cat}
                </button>
              ))}
            </div>

            {/* Opgaveliste */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {filteredTasks.map((task) => {
                const xp = Math.round(task.duration_minutes * task.difficulty);
                const icon = getCategoryIcon(task.category);

                return (
                  <div
                    key={task.id}
                    className="bg-white border border-stone-200/90 hover:border-stone-400/80 p-4 rounded-2xl transition shadow-sm flex justify-between items-center gap-4"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-10 h-10 rounded-xl bg-stone-100 border border-stone-200/60 flex items-center justify-center text-xl shrink-0">
                        {icon}
                      </div>
                      <div>
                        <h3 className="font-bold text-stone-900 text-sm">{task.title}</h3>
                        <p className="text-xs text-stone-500 font-medium mt-0.5">
                          {task.category} • {task.duration_minutes} min
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => completeTask(task)}
                      className="bg-stone-900 hover:bg-stone-800 active:bg-stone-950 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition cursor-pointer shrink-0"
                    >
                      +{xp} XP
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* FANE 2: BØRNESHOP & ØNSKER */}
        {activeTab === 'shop' && (
          <section className="space-y-7">
            {/* FORÆLDRE GODKENDELSE */}
            {isAdult && pendingWishesAll.length > 0 && (
              <div className="bg-amber-50/70 p-5 rounded-2xl border border-amber-200/80 space-y-3">
                <div>
                  <h3 className="text-sm font-bold text-amber-900 flex items-center gap-2">
                    <span>💡</span> Indkomne Ønsker til behandling ({pendingWishesAll.length})
                  </h3>
                  <p className="text-xs text-amber-700/80 mt-0.5">
                    Angiv en pris i XP for at gøre ønsket til en tilgængelig belønning.
                  </p>
                </div>

                <div className="space-y-2 pt-1">
                  {pendingWishesAll.map((wish) => {
                    const wishUser = users.find((u) => u.id === wish.user_id);
                    return (
                      <div
                        key={wish.id}
                        className="bg-white p-3.5 rounded-xl border border-amber-200 flex justify-between items-center flex-wrap gap-3 shadow-sm"
                      >
                        <div>
                          <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block">
                            Ønske fra {wishUser?.name || 'Barn'}
                          </span>
                          <p className="font-bold text-stone-900 text-sm">{wish.title}</p>
                          {wish.note && <p className="text-xs text-stone-500">{wish.note}</p>}
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => approveWish(wish)}
                            className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs px-3 py-1.5 rounded-lg transition cursor-pointer shadow-sm"
                          >
                            Godkend & Sæt XP
                          </button>
                          <button
                            onClick={() => rejectWish(wish)}
                            className="bg-stone-200 hover:bg-stone-300 text-stone-700 font-medium text-xs px-2.5 py-1.5 rounded-lg transition cursor-pointer"
                          >
                            Afvis
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* BELØNNINGSKATALOG */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-base font-bold text-stone-900">Belønninger & Hygge</h2>
                <span className="text-xs text-stone-500 font-medium">
                  Optjent: <strong className="text-stone-900">{activeUserData?.spendable_xp || 0} XP</strong>
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {rewards.map((reward) => {
                  const canAfford = (activeUserData?.spendable_xp || 0) >= reward.cost_xp;

                  return (
                    <div
                      key={reward.id}
                      className={`p-4 rounded-2xl border transition flex justify-between items-center gap-4 ${
                        canAfford
                          ? 'bg-white border-stone-200 shadow-sm'
                          : 'bg-stone-50/70 border-stone-200/60 opacity-60'
                      }`}
                    >
                      <div className="flex items-center gap-3.5">
                        <div className="w-10 h-10 rounded-xl bg-stone-100 border border-stone-200/60 flex items-center justify-center text-xl shrink-0">
                          {reward.icon}
                        </div>
                        <div>
                          <h3 className="font-bold text-stone-900 text-sm">{reward.title}</h3>
                          <p className="text-xs text-stone-500 mt-0.5">{reward.description}</p>
                        </div>
                      </div>

                      <button
                        onClick={() => buyReward(reward)}
                        disabled={!canAfford}
                        className={`text-xs font-bold px-3.5 py-2 rounded-xl transition whitespace-nowrap shrink-0 ${
                          canAfford
                            ? 'bg-emerald-700 hover:bg-emerald-800 text-white cursor-pointer shadow-sm'
                            : 'bg-stone-200 text-stone-400 cursor-not-allowed'
                        }`}
                      >
                        Indløs ({reward.cost_xp} XP)
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* SEND ØNSKE FORMULAR */}
            <div className="bg-white p-5 rounded-2xl border border-stone-200/90 space-y-4 shadow-sm">
              <div>
                <h3 className="text-sm font-bold text-stone-900">Nyt Ønske til Shoppen</h3>
                <p className="text-xs text-stone-500 mt-0.5">Mangler der noget du vil gemme sammen til?</p>
              </div>

              <form onSubmit={submitWish} className="flex flex-col gap-3">
                <input
                  type="text"
                  placeholder="Hvad ønsker du dig? (f.eks. Nyt LEGO-sæt)"
                  value={newWishTitle}
                  onChange={(e) => setNewWishTitle(e.target.value)}
                  required
                  className="bg-stone-50 text-stone-900 border border-stone-200 rounded-xl p-3 text-xs focus:outline-none focus:ring-2 focus:ring-stone-400 placeholder:text-stone-400"
                />
                <input
                  type="text"
                  placeholder="Evt. bemærkning..."
                  value={newWishNote}
                  onChange={(e) => setNewWishNote(e.target.value)}
                  className="bg-stone-50 text-stone-900 border border-stone-200 rounded-xl p-3 text-xs focus:outline-none focus:ring-2 focus:ring-stone-400 placeholder:text-stone-400"
                />
                <button
                  type="submit"
                  disabled={submittingWish}
                  className="bg-stone-900 hover:bg-stone-800 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition active:scale-95 self-start cursor-pointer shadow-sm"
                >
                  {submittingWish ? 'Sender...' : 'Send Ønske ✨'}
                </button>
              </form>

              {userWishes.length > 0 && (
                <div className="pt-2 border-t border-stone-100">
                  <h4 className="text-[11px] font-bold text-stone-400 uppercase tracking-wider mb-2">
                    Dine Indsendte Ønsker
                  </h4>
                  <div className="space-y-2">
                    {userWishes.map((w) => (
                      <div
                        key={w.id}
                        className="bg-stone-50 p-3 rounded-xl border border-stone-200/60 flex justify-between items-center"
                      >
                        <div>
                          <p className="font-bold text-stone-800 text-xs">{w.title}</p>
                          {w.note && <p className="text-[11px] text-stone-500">{w.note}</p>}
                        </div>
                        <span className="text-[10px] bg-stone-200/80 text-stone-600 px-2.5 py-1 rounded-full font-semibold">
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