export interface Message {
  id: string;  // uuid
  created_at: string;
  conversations_id: string;  // uuid
  organizations_id: string;  // uuid
  sender_id: string;  // text
  sender_name: string;  // text
  sender_type: string;  // text
  content: string;  // text
}

export interface UserProfile {
  id: string;
  display_name: string | null;
  role_id: string;
  organizations_id: string;
  created_at: string;
  email: string;
  auth_users_id: string;
} 