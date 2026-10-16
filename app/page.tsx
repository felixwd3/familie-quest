'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { User, Task, Reward, Wish, FamilyGoal } from '@/lib/types';

export default function Home() {
  const [users, setUsers] = useState<User[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [wishes, setWishes] = useState<Wish[]>([]);
  const [activeGoal, setActiveGoal] = useState<FamilyGoal | null>(null);
  
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'quests' | 'shop'>('quests');
  const [loading, setLoading] = useState<boolean>(true);
  const [isClient, setIsClient] = useState<boolean>(false);

  const [newWishTitle, setNewWishTitle] = useState<string>('');
  const [newWishNote, setNewWishNote] = useState<string>('');
  const [submittingWish, setSubmittingWish] = useState<boolean>(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: usersData } = await supabase.from('users').select('*').order('created_at', { ascending: true });
      const { data: tasksData } = await supabase.from('tasks').select('*');
      const { data: rewardsData } = await supabase.from('rewards').select('*');
      const { data: wishesData } = await supabase.from('wishes').select('*');
      const { data: goalData } = await supabase.from('family_goals').select('*').eq('is_active', true).single();

      if (usersData) {
        setUsers(usersData);
        // Bevar valgt bruger hvis den findes, ellers vælg den første
        if (!selectedUser && usersData.length > 0) setSelectedUser(usersData[0].id);
      }
      if (tasksData) setTasks(tasksData);
      if (rewardsData) setRewards(rewardsData);
      if (wishesData) setWishes(wishesData);
      if (goalData) setActiveGoal(goalData);
    } catch (err) {
      console.error('Fejl ved indlæsning af data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isClient) fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isClient]);

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

  // Udfør Opgave -> Giver XP til bruger OG Fælles Familiemål
  const completeTask = async (task: Task) => {
    if (!selectedUser) return;
    const currentUser = users.find((u) => u.id === selectedUser);
    if (!currentUser) return;

    const xpEarned = Math.round(task.duration_minutes * task.difficulty);

    try {
      // 1. Gem log
      await supabase.from('event_logs').insert([{ user_id: selectedUser, task_id: task.id, xp_earned: xpEarned }]);

      // 2. Opdater bruger
      const newTotalXp = (currentUser.total_xp || 0) + xpEarned;
      const newSpendableXp = (currentUser.spendable_xp || 0) + xpEarned;
      await supabase.from('users').update({ total_xp: newTotalXp, spendable_xp: newSpendableXp }).eq('id', selectedUser);
      setUsers(users.map((u) => u.id === selectedUser ? { ...u, total_xp: newTotalXp, spendable_xp: newSpendableXp } : u));

      // 3. Opdater fælles familiemål
      if (activeGoal) {
        const newGoalXp = activeGoal.current_xp + xpEarned;
        await supabase.from('family_goals').update({ current_xp: newGoalXp }).eq('id', activeGoal.id);
        setActiveGoal({ ...activeGoal, current_xp: newGoalXp });
        
        if (newGoalXp >= activeGoal.target_xp && activeGoal.current_xp < activeGoal.target_xp) {
          alert(`🎉 KÆMPE TILLYKKE! Familien har nået målet: ${activeGoal.title}!`);
        } else {
          alert(`🌱 +${xpEarned} XP! Både til dig og fællespuljen!`);
        }
      } else {
        alert(`🌱 +${xpEarned} XP til ${currentUser.name}!`);
      }
    } catch (err) {
      console.error('Fejl ved gemning af opgave:', err);
    }
  };

  const buyReward = async (reward: Reward) => {
    const currentUser = users.find((u) => u.id === selectedUser);
    if (!currentUser) return;
    if ((currentUser.spendable_xp || 0) < reward.cost_xp) {
      alert(`Du mangler XP for at kunne indløse ${reward.title}.`);
      return;
    }
    if (!confirm(`Vil du indløse "${reward.title}" for ${reward.cost_xp} XP?`)) return;

    try {
      await supabase.from('purchases').insert([{ user_id: selectedUser, reward_id: reward.id, cost_xp: reward.cost_xp, status: 'pending' }]);
      const newSpendableXp = currentUser.spendable_xp - reward.cost_xp;
      await supabase.from('users').update({ spendable_xp: newSpendableXp }).eq('id', selectedUser);
      setUsers(users.map((u) => u.id === selectedUser ? { ...u, spendable_xp: newSpendableXp } : u));
      alert(`🎁 Tillykke! Du har indløst ${reward.title}.`);
    } catch (err) {
      console.error('Fejl ved køb:', err);
    }
  };

  const submitWish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWishTitle.trim() || !selectedUser) return;
    setSubmittingWish(true);
    try {
      const { data, error } = await supabase.from('wishes').insert([{ user_id: selectedUser, title: newWishTitle.trim(), note: newWishNote.trim(), status: 'pending' }]).select();
      if (error) throw error;
      if (data) setWishes([...wishes, data[0]]);
      setNewWishTitle('');
      setNewWishNote('');
      alert('🌟 Ønsket er sendt videre til godkendelse!');
    } catch (err) {
      console.error('Fejl:', err);
    } finally {
      setSubmittingWish(false);
    }
  };

  // ADMIN: Godkend ønske
  const approveWish = async (wish: Wish) => {
    const costInput = prompt(`Angiv pris i XP for "${wish.title}":`, '100');
    if (!costInput) return;
    const costXp = parseInt(costInput, 10);
    if (isNaN(costXp) || costXp <= 0) return;

    try {
      const { data: newReward, error } = await supabase.from('rewards').insert([{ title: wish.title, description: wish.note || 'Ønske', cost_xp: costXp, icon: '🎁', category: 'Ønsker' }]).select();
      if (error) throw error;
      await supabase.from('wishes').update({ status: 'approved' }).eq('id', wish.id);
      if (newReward) setRewards([...rewards, newReward[0]]);
      setWishes(wishes.map((w) => (w.id === wish.id ? { ...w, status: 'approved' } : w)));
    } catch (err) {
      console.error('Fejl:', err);
    }
  };

  const rejectWish = async (wish: Wish) => {
    if (!confirm(`Afvis ønsket "${wish.title}"?`)) return;
    await supabase.from('wishes').update({ status: 'rejected' }).eq('id', wish.id);
    setWishes(wishes.map((w) => (w.id === wish.id ? { ...w, status: 'rejected' } : w)));
  };

  // ADMIN: Opret Nyt Familiemål
  const createNewFamilyGoal = async () => {
    const title = prompt('Hvad skal være familiens nye fælles mål? (f.eks. Tur i Tivoli)');
    if (!title) return;
    const targetInput = prompt(`Hvor mange XP skal det koste at nå "${title}"?`, '2000');
    if (!targetInput) return;
    const targetXp = parseInt(targetInput, 10);

    try {
      // Deaktiver gamle mål
      if (activeGoal) await supabase.from('family_goals').update({ is_active: false }).eq('id', activeGoal.id);
      // Opret nyt
      const { data, error } = await supabase.from('family_goals').insert([{ title, target_xp: targetXp, is_active: true }]).select();
      if (error) throw error;
      if (data) setActiveGoal(data[0]);
      alert(`🎯 Nyt familiemål oprettet! Nu kæmper vi for: ${title}`);
    } catch (err) {
      console.error(err);
    }
  };

  // ADMIN: Roter faste tjanser
  const rotateChores = async () => {
    if (!confirm('Vil du rotere de faste opgaver, så voksne bytter ansvarsområder?')) return;
    
    const adults = users.filter(u => u.role === 'adult');
    if (adults.length < 2) {
      alert('Der skal være mindst 2 voksne for at bytte faste tjanser.');
      return;
    }
    
    const adult1 = adults[0].id;
    const adult2 = adults[1].id;
    const fixedTasks = tasks.filter(t => t.is_fixed);

    try {
      for (const task of fixedTasks) {
        // Hvis den ikke er tildelt, giv den til adult1, ellers byt
        const newAssignee = task.assigned_to === adult1 ? adult2 : adult1;
        await supabase.from('tasks').update({ assigned_to: newAssignee }).eq('id', task.id);
      }
      alert('🔄 Opgaverne er nu byttet!');
      fetchData(); // Genindlæs for at se ændringerne
    } catch (err) {
      console.error(err);
    }
  };

  if (!isClient || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50 text-stone-600">
        <div className="w-8 h-8 border-2 border-stone-400 border-t-stone-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  const activeUserData = users.find((u) => u.id === selectedUser);
  const isAdult = activeUserData?.role === 'adult';
  
  // Opdel opgaver
  const myFixedTasks = tasks.filter(t => t.is_fixed && t.assigned_to === selectedUser);
  const unassignedFixedTasks = tasks.filter(t => t.is_fixed && !t.assigned_to);
  const freeTasks = tasks.filter(t => !t.is_fixed);

  // Familiemål progress
  const goalProgress = activeGoal ? Math.min(100, Math.round((activeGoal.current_xp / activeGoal.target_xp) * 100)) : 0;

  return (
    <main className="min-h-screen bg-[#FAF9F6] text-stone-800 pb-16 antialiased">
      {/* Top Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-stone-200/80 sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-4 py-3 flex justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-stone-900 text-stone-50 flex items-center justify-center text-sm font-bold shadow-sm">FQ</div>
            <h1 className="text-lg font-bold tracking-tight text-stone-900 hidden sm:block">FamilieQuest</h1>
          </div>

          <div className="flex items-center gap-2 bg-stone-100/80 p-1 pl-3 rounded-full border border-stone-200/60">
            <span className="text-xs text-stone-500 font-medium hidden sm:inline">Spiller:</span>
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="bg-white text-stone-800 font-semibold border border-stone-200 rounded-full px-3 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-stone-400 cursor-pointer"
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 pt-6 space-y-8">
        
        {/* FÆLLES FAMILIEMÅL */}
        {activeGoal && (
          <section className="bg-white rounded-2xl p-6 border border-stone-200/90 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-full blur-3xl -mr-10 -mt-10 opacity-70"></div>
            <div className="relative z-10">
              <div className="flex justify-between items-end mb-3">
                <div>
                  <h2 className="text-xs font-bold uppercase tracking-widest text-emerald-600 mb-1">Fælles Familiemål</h2>
                  <h3 className="text-xl font-black text-stone-900">{activeGoal.title}</h3>
                </div>
                <div className="text-right">
                  <span className="text-sm font-bold text-stone-700">{activeGoal.current_xp}</span>
                  <span className="text-xs text-stone-400"> / {activeGoal.target_xp} XP</span>
                </div>
              </div>
              
              <div className="w-full bg-stone-100 rounded-full h-3 overflow-hidden border border-stone-200/50">
                <div 
                  className="bg-emerald-500 h-full rounded-full transition-all duration-1000 ease-out relative"
                  style={{ width: `${goalProgress}%` }}
                >
                  <div className="absolute inset-0 bg-white/20 w-full animate-pulse"></div>
                </div>
              </div>
              {goalProgress >= 100 && (
                <p className="text-xs font-bold text-emerald-600 mt-2 text-center animate-bounce">Målet er nået! 🎉</p>
              )}
            </div>
          </section>
        )}

        {/* Fanebladsnavigation */}
        <div className="flex bg-stone-200/60 p-1 rounded-full max-w-xs mx-auto border border-stone-200/80">
          <button
            onClick={() => setActiveTab('quests')}
            className={`flex-1 py-2 rounded-full font-bold text-xs transition text-center ${activeTab === 'quests' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-800'}`}
          >
            Opgaver
          </button>
          <button
            onClick={() => setActiveTab('shop')}
            className={`flex-1 py-2 rounded-full font-bold text-xs transition text-center flex items-center justify-center gap-1.5 ${activeTab === 'shop' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-800'}`}
          >
            <span>BørneShop</span>
            {activeUserData && <span className="bg-emerald-100 text-emerald-800 text-[10px] px-1.5 py-0.5 rounded-full font-bold">{activeUserData.spendable_xp || 0}</span>}
          </button>
        </div>

        {/* FANE 1: OPGAVER */}
        {activeTab === 'quests' && (
          <div className="space-y-8">
            
            {/* DINE FASTE TJANSER */}
            <section className="space-y-3">
              <h3 className="text-sm font-bold text-stone-900 border-b border-stone-200 pb-2">🎯 Dine Faste Tjanser Denne Uge</h3>
              {myFixedTasks.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {myFixedTasks.map((task) => {
                    const xp = Math.round(task.duration_minutes * task.difficulty);
                    return (
                      <div key={task.id} className="bg-stone-50 border border-stone-200 p-3.5 rounded-xl flex justify-between items-center shadow-sm">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{getCategoryIcon(task.category)}</span>
                          <div>
                            <h4 className="font-bold text-stone-900 text-sm">{task.title}</h4>
                            <p className="text-[11px] text-stone-500">{task.duration_minutes} min</p>
                          </div>
                        </div>
                        <button onClick={() => completeTask(task)} className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition shrink-0 shadow-sm">
                          Klar (+{xp} XP)
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-stone-500 italic">Du har ingen faste, tunge opgaver tildelt i denne uge. Nyd det!</p>
              )}
              
              {/* Viser ikke-tildelte faste tjanser hvis forældre har glemt at rotere/tildele dem */}
              {isAdult && unassignedFixedTasks.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl mt-2">
                  <p className="text-xs text-amber-800 font-semibold mb-2">⚠️ Der er faste opgaver, som mangler en ejer. Tryk "Roter Faste Opgaver" i shoppen.</p>
                </div>
              )}
            </section>

            {/* FÆLLES FRIE QUESTS */}
            <section className="space-y-3">
              <h3 className="text-sm font-bold text-stone-900 border-b border-stone-200 pb-2">🌟 Frie Fælles Quests (Åben for alle)</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {freeTasks.map((task) => {
                  const xp = Math.round(task.duration_minutes * task.difficulty);
                  return (
                    <div key={task.id} className="bg-white border border-stone-200 p-3.5 rounded-xl hover:border-stone-300 flex justify-between items-center shadow-2xs transition">
                      <div className="flex items-center gap-3">
                        <span className="text-xl opacity-80">{getCategoryIcon(task.category)}</span>
                        <div>
                          <h4 className="font-bold text-stone-900 text-xs sm:text-sm">{task.title}</h4>
                          <p className="text-[10px] sm:text-[11px] text-stone-500">{task.category}</p>
                        </div>
                      </div>
                      <button onClick={() => completeTask(task)} className="bg-stone-900 hover:bg-stone-800 text-white text-[10px] sm:text-xs font-bold px-3 py-1.5 rounded-lg transition shrink-0">
                        +{xp} XP
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        )}

        {/* FANE 2: BØRNESHOP & FORÆLDREPANEL */}
        {activeTab === 'shop' && (
          <div className="space-y-8">
            
            {/* FORÆLDREPANEL (Kun synligt for adults) */}
            {isAdult && (
              <section className="bg-stone-100 p-5 rounded-2xl border border-stone-200 space-y-4">
                <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2"><span>⚙️</span> Forældre Kontrolpanel</h3>
                
                <div className="flex flex-wrap gap-2">
                  <button onClick={createNewFamilyGoal} className="bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs px-4 py-2 rounded-lg transition shadow-sm">
                    🎯 Nyt Familiemål
                  </button>
                  <button onClick={rotateChores} className="bg-white border border-stone-300 text-stone-700 font-semibold text-xs px-4 py-2 rounded-lg transition shadow-sm hover:bg-stone-50">
                    🔄 Roter faste tjanser
                  </button>
                </div>

                {wishes.filter(w => w.status === 'pending').length > 0 && (
                  <div className="mt-4 space-y-2 border-t border-stone-200 pt-3">
                    <p className="text-xs font-bold text-stone-700">Indkomne Ønsker:</p>
                    {wishes.filter(w => w.status === 'pending').map((wish) => (
                      <div key={wish.id} className="bg-white p-3 rounded-xl border border-stone-200 flex justify-between items-center gap-2">
                        <div>
                          <p className="font-bold text-stone-900 text-xs">{wish.title}</p>
                          {wish.note && <p className="text-[10px] text-stone-500">{wish.note}</p>}
                        </div>
                        <div className="flex gap-1">
                          <button onClick={() => approveWish(wish)} className="bg-stone-900 text-white text-[10px] font-bold px-2.5 py-1.5 rounded-md">Prissæt</button>
                          <button onClick={() => rejectWish(wish)} className="bg-stone-200 text-stone-700 text-[10px] font-bold px-2.5 py-1.5 rounded-md">Afvis</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* SHOPPEN */}
            <section className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-base font-bold text-stone-900">🛒 BørneShoppen</h2>
                <span className="text-xs text-stone-600 bg-white border border-stone-200 px-3 py-1 rounded-full shadow-sm font-bold">Din Pung: {activeUserData?.spendable_xp || 0} XP</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {rewards.map((reward) => {
                  const canAfford = (activeUserData?.spendable_xp || 0) >= reward.cost_xp;
                  return (
                    <div key={reward.id} className={`bg-white border p-3.5 rounded-xl flex justify-between items-center gap-3 transition ${canAfford ? 'border-stone-200 shadow-sm' : 'border-stone-100 opacity-60'}`}>
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{reward.icon}</span>
                        <div>
                          <h4 className="font-bold text-stone-900 text-sm">{reward.title}</h4>
                          <p className="text-[10px] text-stone-500">{reward.description}</p>
                        </div>
                      </div>
                      <button onClick={() => buyReward(reward)} disabled={!canAfford} className={`text-xs font-bold px-3 py-1.5 rounded-lg shrink-0 ${canAfford ? 'bg-emerald-600 text-white shadow-sm' : 'bg-stone-100 text-stone-400'}`}>
                        {reward.cost_xp} XP
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* SEND ØNSKE FORMULAR */}
            <section className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm">
              <h3 className="text-sm font-bold text-stone-900 mb-1">Mangler der noget?</h3>
              <p className="text-[11px] text-stone-500 mb-4">Send et ønske til mor og far, så de kan sætte det i shoppen.</p>
              <form onSubmit={submitWish} className="flex flex-col gap-2.5">
                <input type="text" placeholder="Hvad ønsker du dig?" value={newWishTitle} onChange={(e) => setNewWishTitle(e.target.value)} required className="bg-stone-50 border border-stone-200 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-stone-400 focus:outline-none" />
                <button type="submit" disabled={submittingWish} className="bg-stone-900 text-white font-bold py-2 px-4 rounded-lg text-xs self-start">Send Ønske ✨</button>
              </form>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}