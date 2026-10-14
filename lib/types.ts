export interface User {
  id: string;
  name: string;
  role: 'adult' | 'child';
  total_xp: number;
  spendable_xp: number;
  level: number;
}

export interface Task {
  id: string;
  title: string;
  duration_minutes: number;
  difficulty: 1.0 | 1.25 | 1.5;
  category: string;
}

export interface EventLog {
  id: string;
  user_id: string;
  task_id: string;
  xp_earned: number;
  created_at: string;
}

export interface Reward {
  id: string;
  title: string;
  description: string;
  cost_xp: number;
  icon: string;
  category: string;
}

export interface Purchase {
  id: string;
  user_id: string;
  reward_id: string;
  cost_xp: number;
  status: 'pending' | 'delivered';
  created_at: string;
}

export interface Wish {
  id: string;
  user_id: string;
  title: string;
  note?: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

export interface WeeklySchedule {
  id: string;
  user_id: string;
  area_name: string;
  description?: string;
  icon?: string;
  day_of_week?: string;
}