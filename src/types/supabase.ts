export interface Message {
  id: number;
  content: string;
  user_id: string;
  conversation_id: string;
  created_at: string;
  sender_name: string | null;
  sender_type: 'user' | 'customer' | 'ai';
}

export interface UserProfile {
  id: string;
  full_name: string | null;
  role: 'admin' | 'agent' | 'customer';
  organization_id: string | null;
  avatar_url: string | null;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
} 