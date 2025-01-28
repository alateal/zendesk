import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  IconInbox,
  IconBook,
  IconRobot,
  IconChartBar,
  IconSettings,
  IconUser,
  IconPlus,
} from '@tabler/icons-react';
import supabase from '../supabase';

type User = {
  id: string;
  display_name: string;
};

const AgentDali = () => {
  const navigate = useNavigate();
  const [selectedNav, setSelectedNav] = useState('ai');
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [newConversationsCount, setNewConversationsCount] = useState(0);
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);

  useEffect(() => {
    const fetchUserData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUser(user);
        const { data: userData } = await supabase
          .from('users')
          .select('role_id')
          .eq('id', user.id)
          .single();
        if (userData) {
          setCurrentUserRole(userData.role_id);
        }
      }
    };

    const fetchNewConversations = async () => {
      const { data: conversations } = await supabase
        .from('conversations')
        .select('*')
        .or('status.eq.New,status.eq.Active');
      
      if (conversations) {
        setNewConversationsCount(conversations.length);
      }
    };

    fetchUserData();
    fetchNewConversations();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/signin');
  };

  const handleNavigation = (nav: string) => {
    switch (nav) {
      case 'inbox':
        navigate('/dashboard');
        break;
      case 'knowledge':
        navigate('/knowledge');
        break;
      case 'ai':
        navigate('/agentDali');
        break;
      case 'reports':
        navigate('/reports');
        break;
      default:
        break;
    }
  };

  return (
    <div className="flex h-screen bg-[#FDF6E3]">
      {/* Main Sidebar */}
      <div className="w-16 bg-[#FDF6E3] border-r border-[#8B4513] flex flex-col items-center py-4">
        <div className="mb-8">
          <img src="/favicon.ico" alt="Logo" className="w-8 h-8" />
        </div>
        
        <nav className="flex flex-col space-y-4 flex-1">
          <button
            onClick={() => handleNavigation('inbox')}
            className={`p-2 rounded-lg relative ${
              selectedNav === 'inbox' ? 'text-[#8B4513] bg-[#F5E6D3]' : 'text-[#3C1810] hover:bg-[#F5E6D3]'
            }`}
          >
            <IconInbox size={20} />
            {newConversationsCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-[#8B4513] text-[#FDF6E3] text-xs w-4 h-4 flex items-center justify-center rounded-full">
                {newConversationsCount}
              </span>
            )}
          </button>

          <button
            onClick={() => handleNavigation('knowledge')}
            className={`p-2 rounded-lg ${
              selectedNav === 'knowledge' ? 'bg-[#8B4513] text-[#FDF6E3]' : 'text-[#3C1810] hover:bg-[#F5E6D3]'
            }`}
          >
            <IconBook size={24} />
          </button>
          
          <button
            onClick={() => handleNavigation('ai')}
            className="p-2 rounded-lg bg-[#8B4513] text-[#FDF6E3]"
          >
            <IconRobot size={24} />
          </button>

          <button
            onClick={() => handleNavigation('reports')}
            className={`p-2 rounded-lg ${
              selectedNav === 'reports' ? 'bg-[#8B4513] text-[#FDF6E3]' : 'text-[#3C1810] hover:bg-[#F5E6D3]'
            }`}
          >
            <IconChartBar size={24} />
          </button>
        </nav>

        {/* Bottom buttons */}
        <div className="mt-auto flex flex-col space-y-4 items-center">
          <button
            onClick={() => setSelectedNav('settings')}
            className={`p-2 rounded-lg ${
              selectedNav === 'settings' ? 'bg-[#8B4513] text-[#FDF6E3]' : 'text-[#3C1810] hover:bg-[#F5E6D3]'
            }`}
          >
            <IconSettings size={24} />
          </button>
          
          <button
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            className="p-2 rounded-lg text-[#3C1810] hover:bg-[#F5E6D3]"
          >
            <IconUser size={24} />
          </button>

          {/* Profile Dropdown */}
          {isProfileOpen && (
            <div className="fixed bottom-3 left-16 w-64 bg-[#FDF6E3] border border-[#8B4513] rounded-lg shadow-lg z-20">
              {/* User Profile Section */}
              <div className="p-4 border-b border-[#8B4513]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#F5E6D3] flex items-center justify-center">
                    <IconUser size={24} className="text-[#8B4513]" />
                  </div>
                  <div>
                    <div className="font-medium text-[#3C1810]">
                      {users.find(u => u.id === currentUser?.id)?.display_name || 'Loading...'}
                    </div>
                    <div className="text-sm text-[#5C2E0E]">
                      {currentUserRole === '5015a883-2f23-4bec-ac3d-9cfca8ecd824' ? 'Admin' : 'Agent'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Away Mode Toggle */}
              <div className="px-4 py-3 border-b border-[#8B4513] flex items-center justify-between">
                <span className="text-[#3C1810]">Away mode</span>
                <button className="w-12 h-6 rounded-full bg-[#F5E6D3] relative">
                  <div className="w-5 h-5 rounded-full bg-[#FDF6E3] absolute left-0.5 top-0.5 shadow-md border border-[#8B4513]"></div>
                </button>
              </div>

              {/* Settings Links */}
              <div className="py-2">
                <button className="w-full px-4 py-2 text-left text-[#3C1810] hover:bg-[#F5E6D3] flex items-center justify-between">
                  <span>Theme</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[#5C2E0E]">Match system</span>
                  </div>
                </button>
                <button className="w-full px-4 py-2 text-left text-[#3C1810] hover:bg-[#F5E6D3] flex items-center justify-between">
                  <span>Language</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[#5C2E0E]">English (US)</span>
                  </div>
                </button>
                <button className="w-full px-4 py-2 text-left text-[#3C1810] hover:bg-[#F5E6D3] flex items-center justify-between">
                  <span>Workspace</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[#5C2E0E]">Handle Bar</span>
                  </div>
                </button>
              </div>

              {/* Sign Out Button */}
              <div className="py-2 border-t border-[#8B4513]">
                <button
                  onClick={handleSignOut}
                  className="w-full px-4 py-2 text-[#3C1810] hover:bg-[#F5E6D3] text-left"
                >
                  Log out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Secondary Sidebar - AI specific */}
      <div className="w-80 border-r border-[#8B4513] flex flex-col">
        <div className="p-6 border-b border-[#8B4513]">
          <div className="flex items-center justify-between h-9">
            <h2 className="text-xl font-semibold text-[#3C1810]">Agent Dali</h2>
          </div>
        </div>

        {/* Navigation Links */}
        <div className="flex-1 overflow-y-auto">
          <div className="space-y-2 p-4">
            <button 
              className="w-full text-left px-3 py-2 rounded text-[#3C1810] hover:bg-[#F5E6D3] flex items-center gap-2 bg-[#F5E6D3]"
            >
              Chat
            </button>
            
            <button 
              className="w-full text-left px-3 py-2 rounded text-[#3C1810] hover:bg-[#F5E6D3] flex items-center gap-2"
            >
              History
            </button>
            
            <button 
              className="w-full text-left px-3 py-2 rounded text-[#3C1810] hover:bg-[#F5E6D3] flex items-center gap-2"
            >
              Settings
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full flex flex-col">
          {/* Content will go here */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-3xl mx-auto">
              <h1 className="text-2xl font-semibold text-[#3C1810] mb-4">Welcome to Agent Dali</h1>
              <p className="text-[#5C2E0E]">Your AI assistant is ready to help.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AgentDali; 