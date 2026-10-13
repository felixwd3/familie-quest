export interface User {
  id: string;
  name: string;
  role: 'adult' | 'child';
  total_xp: number;
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