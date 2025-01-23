import { useState, useRef, useEffect } from 'react';
import IconBook from '@tabler/icons-react/dist/esm/icons/IconBook';
import IconInbox from '@tabler/icons-react/dist/esm/icons/IconInbox';
import IconRobot from '@tabler/icons-react/dist/esm/icons/IconRobot';
import IconChartBar from '@tabler/icons-react/dist/esm/icons/IconChartBar';
import IconSettings from '@tabler/icons-react/dist/esm/icons/IconSettings';
import IconUser from '@tabler/icons-react/dist/esm/icons/IconUser';
import IconPlus from '@tabler/icons-react/dist/esm/icons/IconPlus';
import IconSearch from '@tabler/icons-react/dist/esm/icons/IconSearch';
import IconChevronDown from '@tabler/icons-react/dist/esm/icons/IconChevronDown';
import { useNavigate } from 'react-router-dom';
import supabase from '../supabase';
import IconArticle from '@tabler/icons-react/dist/esm/icons/IconArticle';
import IconLock from '@tabler/icons-react/dist/esm/icons/IconLock';
import IconCheck from '@tabler/icons-react/dist/esm/icons/IconCheck';
import IconX from '@tabler/icons-react/dist/esm/icons/IconX';
import IconMaximize from '@tabler/icons-react/dist/esm/icons/IconMaximize';

type Article = {
  id: string;
  title: string;
  type: 'public' | 'internal';
  status: 'published' | 'draft';
};

const getCurrentUser = async () => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
};

const KnowledgeBase = () => {
  const [selectedNav, setSelectedNav] = useState('knowledge');
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileDropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [users, setUsers] = useState<Array<{
    id: string;
    display_name: string;
    email: string;
    role_id?: string;
  }>>([]);
  const [isArticleModalOpen, setIsArticleModalOpen] = useState(false);
  const [articleModalType, setArticleModalType] = useState<'public' | 'internal' | null>(null);
  const [articleData, setArticleData] = useState({
    title: '',
    description: '',
    content: '',
    type: 'public' as const,
    status: 'draft' as const
  });

  // Handle click outside profile dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Update the useEffect for fetching user data
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        // Get current user
        const user = await getCurrentUser();
        setCurrentUser(user);
        
        if (user) {
          // Fetch user role and all users
          const [{ data: userData }, { data: allUsers }] = await Promise.all([
            supabase
              .from('users')
              .select('role_id')
              .eq('id', user.id)
              .single(),
            supabase
              .from('users')
              .select('id, display_name, email, role_id')
          ]);
          
          if (userData) {
            setCurrentUserRole(userData.role_id);
          }
          
          if (allUsers) {
            setUsers(allUsers);
          }
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      }
    };

    fetchUserData();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/signin');
  };

  const handleNavigation = (nav: string) => {
    if (nav === 'inbox') {
      navigate('/dashboard');
    } else {
      setSelectedNav(nav);
    }
  };

  const handleOpenModal = (type: 'public' | 'internal') => {
    setArticleModalType(type);
    setArticleData({
      ...articleData,
      title: `Untitled ${type} article`,
      type
    });
  };

  return (
    <div className="flex h-screen bg-[#FDF6E3]">
      {/* Main Sidebar - Same as Dashboard */}
      <div className="w-16 bg-[#FDF6E3] border-r border-[#8B4513] flex flex-col items-center py-4">
        <div className="mb-8">
          <img src="/favicon.ico" alt="Logo" className="w-8 h-8" />
        </div>
        
        <nav className="flex flex-col space-y-4 flex-1">
          <button
            onClick={() => handleNavigation('inbox')}
            className="p-2 rounded-lg text-[#3C1810] hover:bg-[#F5E6D3]"
          >
            <IconInbox size={24} />
          </button>

          <button
            onClick={() => handleNavigation('knowledge')}
            className="p-2 rounded-lg bg-[#8B4513] text-[#FDF6E3]"
          >
            <IconBook size={24} />
          </button>
          
          <button
            onClick={() => handleNavigation('ai')}
            className="p-2 rounded-lg text-[#3C1810] hover:bg-[#F5E6D3]"
          >
            <IconRobot size={24} />
          </button>

          <button
            onClick={() => handleNavigation('reports')}
            className="p-2 rounded-lg text-[#3C1810] hover:bg-[#F5E6D3]"
          >
            <IconChartBar size={24} />
          </button>
        </nav>

        {/* Bottom buttons */}
        <div className="mt-auto flex flex-col space-y-4 items-center">
          <button
            onClick={() => setSelectedNav('settings')}
            className="p-2 rounded-lg text-[#3C1810] hover:bg-[#F5E6D3]"
          >
            <IconSettings size={24} />
          </button>
          
          {/* Profile Button and Dropdown */}
          <div className="relative" ref={profileDropdownRef}>
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
      </div>

      {/* Secondary Sidebar - Knowledge Base specific */}
      <div className="w-80 border-r border-[#8B4513] flex flex-col">
        <div className="p-4 border-b border-[#8B4513]">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-[#3C1810]">Knowledge Bar</h2>
            <button className="p-2 rounded-lg text-[#3C1810] hover:bg-[#F5E6D3]">
              <IconPlus size={20} />
            </button>
          </div>
          <div className="relative">
            <input
              type="text"
              placeholder="Search articles..."
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-[#8B4513] focus:outline-none focus:ring-2 focus:ring-[#8B4513] bg-[#FDF6E3]"
            />
            <IconSearch className="absolute left-3 top-2.5 text-[#8B4513]" size={20} />
          </div>
        </div>

        {/* Sources Section */}
        <div className="p-4 border-b border-[#8B4513]">
          <div className="flex items-center justify-between mb-2">
            <span className="font-medium text-[#3C1810]">Sources</span>
            <IconChevronDown size={16} className="text-[#8B4513]" />
          </div>
          <div className="space-y-2">
            <button className="w-full text-left px-3 py-2 rounded text-[#3C1810] hover:bg-[#F5E6D3]">
              All sources
            </button>
            <button className="w-full text-left px-3 py-2 rounded text-[#3C1810] hover:bg-[#F5E6D3]">
              Help Center
            </button>
            <button className="w-full text-left px-3 py-2 rounded text-[#3C1810] hover:bg-[#F5E6D3]">
              AI Agent
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-auto">
        {/* Header with New Content button */}
        <div className="p-6 border-b border-[#8B4513] flex justify-between items-center">
          <h1 className="text-2xl font-bold text-[#3C1810]">Sources</h1>
          <button className="bg-[#8B4513] text-[#FDF6E3] px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-[#5C2E0E]">
            <IconPlus size={20} />
            New content
          </button>
        </div>

        {/* Content Sections */}
        <div className="p-6 space-y-8">
          {/* Public Articles Section */}
          <div className="space-y-4">
            <div className="flex items-start gap-4">
              <div className="p-2 bg-[#F5E6D3] rounded-lg">
                <IconArticle size={24} className="text-[#8B4513]" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-[#3C1810]">Public articles</h2>
                <p className="text-[#5C2E0E] text-sm">
                  Let AI Agent use public articles from your Help Center.
                </p>
              </div>
            </div>

            {/* Public Articles List */}
            <div className="ml-12 space-y-2">
              <div className="flex items-center justify-between p-4 border border-[#8B4513] rounded-lg bg-[#FDF6E3]">
                <div className="flex items-center gap-3">
                  <img src="/favicon.ico" alt="Logo" className="w-6 h-6" />
                  <div>
                    <span className="text-[#3C1810] font-medium">Handle Bar</span>
                    <span className="text-[#5C2E0E] text-sm ml-2">3 articles</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <IconCheck size={16} className="text-[#8B4513]" />
                  <button 
                    onClick={() => handleOpenModal('public')}
                    className="px-3 py-1 text-sm text-[#3C1810] hover:bg-[#F5E6D3] rounded border border-[#8B4513]"
                  >
                    Add article
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Internal Articles Section */}
          <div className="space-y-4">
            <div className="flex items-start gap-4">
              <div className="p-2 bg-[#F5E6D3] rounded-lg">
                <IconLock size={24} className="text-[#8B4513]" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-[#3C1810]">Internal articles</h2>
                <p className="text-[#5C2E0E] text-sm">
                  Give AI Agent internal knowledge only available to you and your team.
                </p>
              </div>
            </div>

            {/* Internal Articles List */}
            <div className="ml-12 space-y-2">
              <div className="flex items-center justify-between p-4 border border-[#8B4513] rounded-lg bg-[#FDF6E3]">
                <div className="flex items-center gap-3">
                  <img src="/favicon.ico" alt="Logo" className="w-6 h-6" />
                  <div>
                    <span className="text-[#3C1810] font-medium">Handle Bar</span>
                    <span className="text-[#5C2E0E] text-sm ml-2">1 article</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <IconCheck size={16} className="text-[#8B4513]" />
                  <button 
                    onClick={() => handleOpenModal('internal')}
                    className="px-3 py-1 text-sm text-[#3C1810] hover:bg-[#F5E6D3] rounded border border-[#8B4513]"
                  >
                    Add article
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Article Creation Modal */}
      {articleModalType && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-[#FDF6E3] w-full max-w-5xl h-[90vh] rounded-lg flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-[#8B4513]">
              <h2 className="text-xl font-semibold text-[#3C1810]">
                {articleModalType === 'public' ? 'Public article' : 'Internal article'}
              </h2>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setArticleModalType(null)}
                  className="px-3 py-1 text-[#3C1810] hover:bg-[#F5E6D3] rounded"
                >
                  Cancel
                </button>
                <button className="px-3 py-1 text-[#3C1810] hover:bg-[#F5E6D3] rounded">
                  Save as draft
                </button>
                <button className="px-3 py-1 bg-[#8B4513] text-[#FDF6E3] hover:bg-[#5C2E0E] rounded">
                  Publish
                </button>
                <button className="p-2 hover:bg-[#F5E6D3] rounded">
                  <IconMaximize size={20} className="text-[#3C1810]" />
                </button>
                <button 
                  onClick={() => setArticleModalType(null)}
                  className="p-2 hover:bg-[#F5E6D3] rounded"
                >
                  <IconX size={20} className="text-[#3C1810]" />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="flex flex-1">
              {/* Editor Section */}
              <div className="flex-1 p-6 border-r border-[#8B4513]">
                <input
                  type="text"
                  value={articleData.title}
                  onChange={(e) => setArticleData({ ...articleData, title: e.target.value })}
                  className="w-full text-3xl font-light text-[#3C1810] bg-transparent border-none outline-none mb-4 placeholder-gray-400"
                  placeholder="Untitled public article"
                />
                <input
                  type="text"
                  value={articleData.description}
                  onChange={(e) => setArticleData({ ...articleData, description: e.target.value })}
                  className="w-full text-lg text-[#5C2E0E] bg-transparent border-none outline-none mb-6 placeholder-gray-400"
                  placeholder="Describe your article to help it get found"
                />
                <textarea
                  value={articleData.content}
                  onChange={(e) => setArticleData({ ...articleData, content: e.target.value })}
                  className="w-full h-[calc(100%-200px)] text-[#3C1810] bg-transparent border-none outline-none resize-none"
                  placeholder="Start writing..."
                />
              </div>

              {/* Details Sidebar */}
              <div className="w-80 p-6">
                <h3 className="text-lg font-semibold text-[#3C1810] mb-4">Details</h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-[#5C2E0E] block mb-1">Type</label>
                    <div className="flex items-center gap-2 text-[#3C1810] bg-[#F5E6D3] px-3 py-2 rounded">
                      {articleModalType === 'public' ? (
                        <>
                          <IconArticle size={16} />
                          <span>Public article</span>
                        </>
                      ) : (
                        <>
                          <IconLock size={16} />
                          <span>Internal article</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm text-[#5C2E0E] block mb-1">Status</label>
                    <div className="text-[#3C1810]">Draft</div>
                  </div>
                  <div>
                    <label className="text-sm text-[#5C2E0E] block mb-1">Article ID</label>
                    <div className="text-[#3C1810]">{Math.floor(Math.random() * 10000000)}</div>
                  </div>
                  <div>
                    <label className="text-sm text-[#5C2E0E] block mb-1">Language</label>
                    <div className="text-[#3C1810]">English</div>
                  </div>
                  <div>
                    <label className="text-sm text-[#5C2E0E] block mb-1">Created</label>
                    <div className="text-[#3C1810]">A few seconds ago</div>
                  </div>
                  <div>
                    <label className="text-sm text-[#5C2E0E] block mb-1">Created by</label>
                    <div className="text-[#3C1810]">{users.find(u => u.id === currentUser?.id)?.display_name}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default KnowledgeBase; 