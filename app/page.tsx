'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { User, Task, Reward, Wish, FamilyGoal } from '@/lib/types';
import confetti from 'canvas-confetti';

export default function Home() {
  const [users, setUsers] = useState<User[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [wishes, setWishes] = useState<Wish[]>([]);
  const [activeGoal, setActiveGoal] = useState<FamilyGoal | null>(null);
  
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'quests' | 'shop'>('quests');
  const [categoryFilter, setCategoryFilter] = useState<string>('Alle');
  const [loading, setLoading] = useState<boolean>(true);
  const [isClient, setIsClient] = useState<boolean>(false);

  const [newWishTitle, setNewWishTitle] = useState<string>('');
  const [newWishNote, setNewWishNote] = useState<string>('');
  const [submittingWish, setSubmittingWish] = useState<boolean>(false);

  // Vores nye lækre Toast-notifikationssystem
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'warning' } | null>(null);

  const showToast = (message: string, type: 'success' | 'info' | 'warning' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Konfetti-funktion til fejring
  const triggerConfetti = () => {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#10b981', '#f59e0b', '#3b82f6']
    });
  };

  const triggerGrandConfetti = () => {
    const duration = 3000;
    const end = Date.now() + duration;

    (function frame() {
      confetti({
        particleCount: 5,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ['#10b981', '#f59e0b', '#3b82f6']
      });
      confetti({
        particleCount: 5,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ['#10b981', '#f59e0b', '#3b82f6']
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    }());
  };

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

  const calculateLevel = (totalXp: number = 0) => {
    const level = Math.floor(totalXp / 100) + 1;
    const progress = totalXp % 100;
    return { level, progress };
  };

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

  const completeTask = async (task: Task) => {
    if (!selectedUser) return;
    const currentUser = users.find((u) => u.id === selectedUser);
    if (!currentUser) return;

    const xpEarned = Math.round(task.duration_minutes * task.difficulty);

    try {
      await supabase.from('event_logs').insert([{ user_id: selectedUser, task_id: task.id, xp_earned: xpEarned }]);

      const newTotalXp = (currentUser.total_xp || 0) + xpEarned;
      const newSpendableXp = (currentUser.spendable_xp || 0) + xpEarned;
      await supabase.from('users').update({ total_xp: newTotalXp, spendable_xp: newSpendableXp }).eq('id', selectedUser);
      setUsers(users.map((u) => u.id === selectedUser ? { ...u, total_xp: newTotalXp, spendable_xp: newSpendableXp } : u));

      if (activeGoal) {
        const newGoalXp = activeGoal.current_xp + xpEarned;
        await supabase.from('family_goals').update({ current_xp: newGoalXp }).eq('id', activeGoal.id);
        setActiveGoal({ ...activeGoal, current_xp: newGoalXp });
        
        if (newGoalXp >= activeGoal.target_xp && activeGoal.current_xp < activeGoal.target_xp) {
          triggerGrandConfetti();
          showToast(`🎉 KÆMPE TILLYKKE! Familien har nået målet: ${activeGoal.title}!`, 'success');
        } else {
          triggerConfetti();
          showToast(`✨ +${xpEarned} XP! Både til dig og fællespuljen!`, 'success');
        }
      } else {
        triggerConfetti();
        showToast(`✨ +${xpEarned} XP til ${currentUser.name}!`, 'success');
      }
    } catch (err) {
      console.error('Fejl ved gemning af opgave:', err);
      showToast('Der opstod en fejl. Prøv igen.', 'warning');
    }
  };

  const buyReward = async (reward: Reward) => {
    const currentUser = users.find((u) => u.id === selectedUser);
    if (!currentUser) return;
    if ((currentUser.spendable_xp || 0) < reward.cost_xp) {
      showToast(`Du mangler ${reward.cost_xp - (currentUser.spendable_xp || 0)} XP.`, 'warning');
      return;
    }
    if (!confirm(`Vil du indløse "${reward.title}" for ${reward.cost_xp} XP?`)) return;

    try {
      await supabase.from('purchases').insert([{ user_id: selectedUser, reward_id: reward.id, cost_xp: reward.cost_xp, status: 'pending' }]);
      const newSpendableXp = currentUser.spendable_xp - reward.cost_xp;
      await supabase.from('users').update({ spendable_xp: newSpendableXp }).eq('id', selectedUser);
      setUsers(users.map((u) => u.id === selectedUser ? { ...u, spendable_xp: newSpendableXp } : u));
      
      triggerConfetti();
      showToast(`🎁 Tillykke! Du har indløst ${reward.title}.`, 'success');
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
      showToast('🌟 Dit ønske er sendt til godkendelse!', 'success');
    } catch (err) {
      console.error('Fejl:', err);
    } finally {
      setSubmittingWish(false);
    }
  };

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
      showToast(`✅ Ønsket er nu godkendt til ${costXp} XP!`, 'success');
    } catch (err) {
      console.error('Fejl:', err);
    }
  };

  const rejectWish = async (wish: Wish) => {
    if (!confirm(`Afvis ønsket "${wish.title}"?`)) return;
    await supabase.from('wishes').update({ status: 'rejected' }).eq('id', wish.id);
    setWishes(wishes.map((w) => (w.id === wish.id ? { ...w, status: 'rejected' } : w)));
    showToast('Ønsket blev afvist.', 'info');
  };

  const createNewFamilyGoal = async () => {
    const title = prompt('Hvad skal være familiens nye fælles mål? (f.eks. Tur i Tivoli)');
    if (!title) return;
    const targetInput = prompt(`Hvor mange XP skal det koste at nå "${title}"?`, '2000');
    if (!targetInput) return;
    const targetXp = parseInt(targetInput, 10);

    try {
      if (activeGoal) await supabase.from('family_goals').update({ is_active: false }).eq('id', activeGoal.id);
      const { data, error } = await supabase.from('family_goals').insert([{ title, target_xp: targetXp, is_active: true }]).select();
      if (error) throw error;
      if (data) setActiveGoal(data[0]);
      triggerConfetti();
      showToast(`🎯 Nyt familiemål oprettet!`, 'success');
    } catch (err) {
      console.error(err);
    }
  };

  const rotateChores = async () => {
    if (!confirm('Vil du fordele og rotere de faste opgaver ligeligt mellem de voksne?')) return;
    
    const adults = users.filter(u => u.role === 'adult');
    if (adults.length < 2) {
      showToast('Der skal være mindst 2 voksne for at bytte faste tjanser.', 'warning');
      return;
    }
    
    const adult1 = adults[0].id;
    const adult2 = adults[1].id;
    const fixedTasks = tasks.filter(t => t.is_fixed);

    const count1 = fixedTasks.filter(t => t.assigned_to === adult1).length;
    const count2 = fixedTasks.filter(t => t.assigned_to === adult2).length;
    const isUnbalanced = Math.abs(count1 - count2) > 1;

    try {
      for (let i = 0; i < fixedTasks.length; i++) {
        const task = fixedTasks[i];
        let newAssignee = isUnbalanced || !task.assigned_to 
          ? (i % 2 === 0 ? adult1 : adult2) 
          : (task.assigned_to === adult1 ? adult2 : adult1);
        await supabase.from('tasks').update({ assigned_to: newAssignee }).eq('id', task.id);
      }
      showToast('🔄 Opgaverne er nu fordelt og byttet!', 'success');
      fetchData();
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
  
  const myFixedTasks = tasks.filter(t => t.is_fixed && t.assigned_to === selectedUser);
  const unassignedFixedTasks = tasks.filter(t => t.is_fixed && !t.assigned_to);
  const freeTasks = tasks.filter(t => !t.is_fixed);

  const goalProgress = activeGoal ? Math.min(100, Math.round((activeGoal.current_xp / activeGoal.target_xp) * 100)) : 0;
  const categories = ['Alle', ...Array.from(new Set(tasks.map((t) => t.category)))];
  const filteredTasks = categoryFilter === 'Alle' ? freeTasks : freeTasks.filter((t) => t.category === categoryFilter);

  return (
    <main className="min-h-screen bg-[#FAF9F6] text-stone-800 pb-20 antialiased relative">
      
      {/* Lækre Custom Toasts */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-full shadow-2xl backdrop-blur-md border border-white/20 transition-all duration-300 animate-in slide-in-from-bottom-8 fade-in flex items-center gap-3 font-semibold text-sm ${
          toast.type === 'success' ? 'bg-emerald-600/90 text-white' : 
          toast.type === 'warning' ? 'bg-amber-500/90 text-white' : 
          'bg-stone-800/90 text-white'
        }`}>
          {toast.type === 'success' && '✨'}
          {toast.type === 'warning' && '⚠️'}
          {toast.type === 'info' && '💡'}
          {toast.message}
        </div>
      )}

      {/* Top Header */}
      <header className="bg-white/80 backdrop-blur-xl border-b border-stone-200/80 sticky top-0 z-50 transition-all">
        <div className="max-w-3xl mx-auto px-4 py-3 flex justify-between items-center gap-4">
          <div className="flex items-center gap-3 hover:scale-105 transition-transform duration-300 cursor-pointer">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-stone-800 to-stone-600 text-white flex items-center justify-center text-sm font-bold shadow-md shadow-stone-800/20">FQ</div>
            <h1 className="text-lg font-bold tracking-tight text-stone-900 hidden sm:block">FamilieQuest</h1>
          </div>

          <div className="flex items-center gap-2 bg-stone-100/80 p-1 pl-3 rounded-full border border-stone-200/60 shadow-inner">
            <span className="text-xs text-stone-500 font-medium hidden sm:inline">Aktiv:</span>
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="bg-white text-stone-800 font-bold border border-stone-200 rounded-full px-4 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-stone-400 cursor-pointer shadow-sm hover:shadow-md transition-shadow"
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 pt-8 space-y-10">
        
        {/* FÆLLES FAMILIEMÅL (Opdateret med lækkert glow) */}
        {activeGoal && (
          <section className="bg-white rounded-3xl p-7 border border-stone-200/90 shadow-xl shadow-stone-200/50 relative overflow-hidden group hover:shadow-2xl hover:border-emerald-200 transition-all duration-500">
            <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-br from-emerald-100 to-transparent rounded-full blur-3xl -mr-16 -mt-16 opacity-60 group-hover:opacity-80 transition-opacity duration-500"></div>
            <div className="absolute bottom-0 left-0 w-40 h-40 bg-gradient-to-tr from-amber-50 to-transparent rounded-full blur-2xl -ml-10 -mb-10 opacity-60"></div>
            
            <div className="relative z-10">
              <div className="flex justify-between items-end mb-4">
                <div>
                  <h2 className="text-xs font-black uppercase tracking-widest text-emerald-600 mb-1.5 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> Fælles Familiemål
                  </h2>
                  <h3 className="text-2xl font-black text-stone-900 tracking-tight">{activeGoal.title}</h3>
                </div>
                <div className="text-right bg-stone-50 px-3 py-1.5 rounded-xl border border-stone-100">
                  <span className="text-lg font-black text-emerald-700">{activeGoal.current_xp}</span>
                  <span className="text-xs font-bold text-stone-400"> / {activeGoal.target_xp} XP</span>
                </div>
              </div>
              
              <div className="w-full bg-stone-100 rounded-full h-4 overflow-hidden border border-stone-200/60 shadow-inner">
                <div 
                  className="bg-gradient-to-r from-emerald-400 to-emerald-500 h-full rounded-full transition-all duration-1000 ease-out relative shadow-[0_0_10px_rgba(16,185,129,0.4)]"
                  style={{ width: `${goalProgress}%` }}
                >
                  <div className="absolute inset-0 bg-white/30 w-full animate-[pulse_2s_ease-in-out_infinite]"></div>
                </div>
              </div>
              {goalProgress >= 100 && (
                <p className="text-sm font-bold text-emerald-600 mt-3 text-center animate-bounce">🎯 Målet er nået! Det er tid til belønningen! 🎉</p>
              )}
            </div>
          </section>
        )}

        {/* Fanebladsnavigation */}
        <div className="flex bg-stone-200/60 p-1.5 rounded-2xl max-w-sm mx-auto border border-stone-200/80 shadow-inner">
          <button
            onClick={() => setActiveTab('quests')}
            className={`flex-1 py-2.5 rounded-xl font-bold text-xs transition-all duration-300 text-center ${activeTab === 'quests' ? 'bg-white text-stone-900 shadow-md scale-105' : 'text-stone-500 hover:text-stone-800 hover:bg-stone-200/50'}`}
          >
            Opgaver
          </button>
          <button
            onClick={() => setActiveTab('shop')}
            className={`flex-1 py-2.5 rounded-xl font-bold text-xs transition-all duration-300 text-center flex items-center justify-center gap-2 ${activeTab === 'shop' ? 'bg-white text-stone-900 shadow-md scale-105' : 'text-stone-500 hover:text-stone-800 hover:bg-stone-200/50'}`}
          >
            <span>BørneShop</span>
            {activeUserData && <span className="bg-emerald-100 text-emerald-800 text-[10px] px-2 py-0.5 rounded-full font-black shadow-sm">{activeUserData.spendable_xp || 0}</span>}
          </button>
        </div>

        {/* FANE 1: OPGAVER */}
        {activeTab === 'quests' && (
          <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
            
            {/* DINE FASTE TJANSER */}
            <section className="space-y-4">
              <div className="flex items-center gap-2 border-b border-stone-200 pb-2">
                <span className="text-xl">🎯</span>
                <h3 className="text-base font-black text-stone-900">Dine Faste Tjanser Denne Uge</h3>
              </div>
              
              {myFixedTasks.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {myFixedTasks.map((task) => {
                    const xp = Math.round(task.duration_minutes * task.difficulty);
                    return (
                      <div key={task.id} className="group bg-white border border-stone-200/80 hover:border-emerald-300 p-4 rounded-2xl flex justify-between items-center shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-stone-50 rounded-xl flex items-center justify-center text-2xl border border-stone-100 group-hover:scale-110 transition-transform duration-300">
                            {getCategoryIcon(task.category)}
                          </div>
                          <div>
                            <h4 className="font-bold text-stone-900 text-sm leading-tight">{task.title}</h4>
                            <p className="text-[11px] font-medium text-stone-500 mt-1 bg-stone-100 inline-block px-2 py-0.5 rounded-md">{task.duration_minutes} min</p>
                          </div>
                        </div>
                        <button onClick={() => completeTask(task)} className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black px-4 py-2.5 rounded-xl transition-all shadow-md hover:shadow-emerald-500/30 active:scale-95 shrink-0">
                          Klar (+{xp})
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="bg-stone-50 border border-stone-200 border-dashed rounded-2xl p-6 text-center">
                  <span className="text-3xl block mb-2">🏖️</span>
                  <p className="text-sm text-stone-500 font-medium">Ingen faste, tunge opgaver til dig i denne uge. Nyd det!</p>
                </div>
              )}
              
              {isAdult && unassignedFixedTasks.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl mt-4 flex items-center gap-3 shadow-sm">
                  <span className="text-2xl">⚠️</span>
                  <p className="text-xs text-amber-800 font-bold leading-relaxed">Der er faste opgaver, som mangler en ejer. Tryk "Roter faste tjanser" i kontrolpanelet under shoppen.</p>
                </div>
              )}
            </section>

            {/* FÆLLES FRIE QUESTS */}
            <section className="space-y-4">
              <div className="flex items-center gap-2 border-b border-stone-200 pb-2">
                <span className="text-xl">🌟</span>
                <h3 className="text-base font-black text-stone-900">Frie Fælles Quests</h3>
              </div>

              {/* Kategori Piller */}
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setCategoryFilter(cat)}
                    className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap border shadow-sm ${
                      categoryFilter === cat
                        ? 'bg-stone-800 border-stone-800 text-white scale-105'
                        : 'bg-white border-stone-200 text-stone-600 hover:border-stone-300 hover:bg-stone-50'
                    }`}
                  >
                    {cat !== 'Alle' && `${getCategoryIcon(cat)} `}{cat}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {filteredTasks.map((task) => {
                  const xp = Math.round(task.duration_minutes * task.difficulty);
                  return (
                    <div key={task.id} className="bg-white border border-stone-200/80 p-4 rounded-2xl hover:border-stone-400 hover:shadow-lg hover:-translate-y-1 flex justify-between items-center transition-all duration-300">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl opacity-90">{getCategoryIcon(task.category)}</span>
                        <div>
                          <h4 className="font-bold text-stone-900 text-sm leading-tight">{task.title}</h4>
                          <p className="text-[11px] font-medium text-stone-500 mt-1">{task.category}</p>
                        </div>
                      </div>
                      <button onClick={() => completeTask(task)} className="bg-stone-800 hover:bg-stone-700 text-white text-xs font-black px-4 py-2.5 rounded-xl transition-all shadow-md active:scale-95 shrink-0">
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
          <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
            
            {/* FORÆLDREPANEL */}
            {isAdult && (
              <section className="bg-stone-100 p-6 rounded-3xl border border-stone-200 shadow-inner space-y-5 relative overflow-hidden">
                <div className="absolute top-0 right-0 text-9xl opacity-5">⚙️</div>
                <h3 className="text-base font-black text-stone-900 flex items-center gap-2 relative z-10"><span>🛠️</span> Kontrolpanel</h3>
                
                <div className="flex flex-wrap gap-3 relative z-10">
                  <button onClick={createNewFamilyGoal} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-all shadow-md hover:shadow-emerald-500/30 active:scale-95 flex items-center gap-2">
                    <span>🎯</span> Nyt Familiemål
                  </button>
                  <button onClick={rotateChores} className="bg-white border border-stone-300 text-stone-700 font-bold text-xs px-5 py-2.5 rounded-xl transition-all shadow-sm hover:shadow-md hover:bg-stone-50 active:scale-95 flex items-center gap-2">
                    <span>🔄</span> Roter faste tjanser
                  </button>
                </div>

                {wishes.filter(w => w.status === 'pending').length > 0 && (
                  <div className="mt-6 space-y-3 border-t border-stone-200 pt-5 relative z-10">
                    <p className="text-xs font-black uppercase tracking-wider text-stone-500">Indkomne Ønsker:</p>
                    {wishes.filter(w => w.status === 'pending').map((wish) => (
                      <div key={wish.id} className="bg-white p-4 rounded-2xl border border-stone-200 flex flex-col sm:flex-row justify-between sm:items-center gap-4 shadow-sm hover:shadow-md transition-shadow">
                        <div>
                          <p className="font-black text-stone-900 text-sm">{wish.title}</p>
                          {wish.note && <p className="text-[11px] font-medium text-stone-500 mt-1">{wish.note}</p>}
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => approveWish(wish)} className="bg-stone-900 hover:bg-stone-800 text-white text-[11px] font-bold px-4 py-2 rounded-xl transition-all active:scale-95 shadow-sm">Prissæt</button>
                          <button onClick={() => rejectWish(wish)} className="bg-stone-100 hover:bg-rose-100 hover:text-rose-700 border border-stone-200 text-stone-600 text-[11px] font-bold px-4 py-2 rounded-xl transition-all active:scale-95">Afvis</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* SHOPPEN */}
            <section className="space-y-5">
              <div className="flex justify-between items-center border-b border-stone-200 pb-2">
                <h2 className="text-lg font-black text-stone-900 flex items-center gap-2"><span>🛍️</span> BørneShoppen</h2>
                <div className="bg-white border border-stone-200 px-4 py-1.5 rounded-full shadow-sm flex items-center gap-2">
                  <span className="text-xs text-stone-500 font-medium">Pung:</span>
                  <strong className="text-sm font-black text-emerald-600">{activeUserData?.spendable_xp || 0} XP</strong>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {rewards.map((reward) => {
                  const canAfford = (activeUserData?.spendable_xp || 0) >= reward.cost_xp;
                  return (
                    <div key={reward.id} className={`bg-white border p-4 rounded-2xl flex justify-between items-center gap-4 transition-all duration-300 ${canAfford ? 'border-stone-200 shadow-sm hover:shadow-xl hover:-translate-y-1' : 'border-stone-100 opacity-60'}`}>
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-stone-50 rounded-xl border border-stone-100 flex items-center justify-center text-2xl shadow-inner">
                          {reward.icon}
                        </div>
                        <div>
                          <h4 className="font-bold text-stone-900 text-sm leading-tight">{reward.title}</h4>
                          <p className="text-[10px] font-medium text-stone-500 mt-1">{reward.description}</p>
                        </div>
                      </div>
                      <button onClick={() => buyReward(reward)} disabled={!canAfford} className={`text-xs font-black px-4 py-2.5 rounded-xl transition-all active:scale-95 shrink-0 ${canAfford ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md hover:shadow-emerald-500/30' : 'bg-stone-100 text-stone-400'}`}>
                        {reward.cost_xp} XP
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* SEND ØNSKE FORMULAR */}
            <section className="bg-white p-6 rounded-3xl border border-stone-200 shadow-lg shadow-stone-200/50">
              <div className="mb-5 flex items-center gap-3">
                <span className="text-3xl">✨</span>
                <div>
                  <h3 className="text-base font-black text-stone-900">Mangler der noget?</h3>
                  <p className="text-xs font-medium text-stone-500 mt-0.5">Send et ønske til forældrene, så de kan sætte det i shoppen.</p>
                </div>
              </div>
              
              <form onSubmit={submitWish} className="flex flex-col gap-3">
                <input type="text" placeholder="Hvad ønsker du dig? (f.eks. Biograftur)" value={newWishTitle} onChange={(e) => setNewWishTitle(e.target.value)} required className="bg-stone-50 border border-stone-200 rounded-xl p-3.5 text-sm font-medium focus:ring-2 focus:ring-emerald-400 focus:outline-none transition-all placeholder:text-stone-400" />
                <button type="submit" disabled={submittingWish} className="bg-stone-900 hover:bg-stone-800 text-white font-bold py-3.5 px-6 rounded-xl text-xs transition-all active:scale-95 shadow-md self-end mt-1">
                  Send Ønske 🚀
                </button>
              </form>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}