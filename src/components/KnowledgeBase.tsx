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
  created_at: string;
  organizations_id: string;
  title: string;
  description: string;
  content: string;
  is_public: boolean;
  is_published: boolean;
  last_updated_at: string | null;
  last_updated_by: string | null;
  created_by: string;
  enabled_ai: boolean;
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
  const [articleData, setArticleData] = useState<Article>({
    id: '',
    created_at: new Date().toISOString(),
    organizations_id: '',
    title: '',
    description: '',
    content: '',
    is_public: true,
    is_published: false,
    last_updated_at: null,
    last_updated_by: null,
    created_by: currentUser?.id || '',
    enabled_ai: false
  });
  const [publicArticles, setPublicArticles] = useState<Article[]>([]);
  const [internalArticles, setInternalArticles] = useState<Article[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<string | null>(null);
  const [selectedSection, setSelectedSection] = useState('sources');
  const [isNewContentModalOpen, setIsNewContentModalOpen] = useState(false);

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

  // Add this useEffect to fetch organizations and set selected org
  useEffect(() => {
    const fetchOrganizations = async () => {
      const { data: orgs } = await supabase
        .from('organizations')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (orgs && orgs.length > 0) {
        setSelectedOrg(orgs[0].id);
      }
    };

    fetchOrganizations();
  }, []);

  // Add this useEffect for initial fetch and real-time updates
  useEffect(() => {
    if (!selectedOrg) return;

    // Initial fetch of articles
    const fetchArticles = async () => {
      const { data: articles, error } = await supabase
        .from('articles')
        .select(`
          *,
          created_by_user:users!articles_created_by_fkey(display_name),
          last_updated_by_user:users!articles_last_updated_by_fkey(display_name)
        `)
        .eq('organizations_id', selectedOrg);

      if (error) {
        console.error('Error fetching articles:', error);
        return;
      }

      if (articles) {
        setPublicArticles(articles.filter(article => article.is_public));
        setInternalArticles(articles.filter(article => !article.is_public));
      }
    };

    fetchArticles();

    // Set up real-time subscription
    const subscription = supabase
      .channel('articles_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'articles',
          filter: `organizations_id=eq.${selectedOrg}`
        },
        async (payload) => {
          console.log('Real-time update:', payload);
          // Refetch all articles when there's any change
          await fetchArticles();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [selectedOrg]);

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
      is_public: type === 'public',
      created_by: currentUser?.id || '',
      enabled_ai: false
    });
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  // Update the handleCreateArticle function
  const handleCreateArticle = async (publish: boolean = false) => {
    if (!selectedOrg || !currentUser) return;

    try {
      const newArticle = {
        organizations_id: selectedOrg,
        title: articleData.title,
        description: articleData.description,
        content: articleData.content,
        created_by: currentUser.id,
        is_public: articleModalType === 'public',
        is_published: publish,
        created_at: new Date().toISOString(),
        last_updated_at: new Date().toISOString(),
        last_updated_by: currentUser.id,
        enabled_ai: articleData.enabled_ai
      };

      const { data, error } = await supabase
        .from('articles')
        .insert([newArticle])
        .select()
        .single();

      if (error) throw error;

      // Close modal after successful creation
      setArticleModalType(null);
      
      // Clear form
      setArticleData({
        id: '',
        created_at: new Date().toISOString(),
        organizations_id: selectedOrg,
        title: '',
        description: '',
        content: '',
        is_public: true,
        is_published: false,
        last_updated_at: null,
        last_updated_by: null,
        created_by: currentUser.id,
        enabled_ai: false
      });

    } catch (error) {
      console.error('Error creating article:', error);
      alert('Failed to create article');
    }
  };

  // Add handler for new content button
  const handleNewContentClick = () => {
    setIsNewContentModalOpen(true);
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
            <h2 className="text-xl font-semibold text-[#3C1810]">Knowledge Bar</h2>
            <button className="p-2 rounded-lg text-[#3C1810] hover:bg-[#F5E6D3]">
              <IconPlus size={20} />
            </button>
          </div>
        </div>

        {/* Navigation Links */}
        <div className="flex-1 overflow-y-auto">
          <div className="space-y-2 p-4">
            <button 
              onClick={() => setSelectedSection('sources')}
              className={`w-full text-left px-3 py-2 rounded text-[#3C1810] hover:bg-[#F5E6D3] flex items-center gap-2 ${
                selectedSection === 'sources' ? 'bg-[#F5E6D3]' : ''
              }`}
            >
              Sources
            </button>
            
            <button 
              onClick={() => setSelectedSection('content')}
              className={`w-full text-left px-3 py-2 rounded text-[#3C1810] hover:bg-[#F5E6D3] flex items-center gap-2 ${
                selectedSection === 'content' ? 'bg-[#F5E6D3]' : ''
              }`}
            >
              Content
            </button>
            
            <button 
              className="w-full text-left px-3 py-2 rounded text-[#3C1810] hover:bg-[#F5E6D3] flex items-center gap-2"
            >
              Help Center
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-auto">
        {selectedSection === 'content' ? (
          <div className="flex-1 overflow-auto">
            {/* Header */}
            <div className="p-6 border-b border-[#8B4513] flex justify-between items-center">
              <h1 className="text-2xl font-bold text-[#3C1810]">Content</h1>
              <div className="flex gap-2">
                <button className="px-4 py-2 text-[#3C1810] border border-[#8B4513] rounded-lg hover:bg-[#F5E6D3]">
                  Content reporting
                </button>
                <button className="px-4 py-2 text-[#3C1810] border border-[#8B4513] rounded-lg hover:bg-[#F5E6D3]">
                  New folder
                </button>
                <button 
                  onClick={handleNewContentClick}
                  className="bg-[#8B4513] text-[#FDF6E3] px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-[#5C2E0E]"
                >
                  <IconPlus size={20} />
                  New content
                </button>
              </div>
            </div>

            {/* Search and Filters */}
            <div className="p-4 border-b border-[#8B4513] flex gap-4">
              <div className="flex-1 relative">
                <input
                  type="text"
                  placeholder="Search articles..."
                  className="w-full pl-10 pr-4 py-2 rounded-lg border border-[#8B4513] focus:outline-none focus:ring-2 focus:ring-[#8B4513] bg-[#FDF6E3]"
                />
                <IconSearch className="absolute left-3 top-2.5 text-[#8B4513]" size={20} />
                <button className="absolute right-3 top-2.5 text-[#8B4513] hover:text-[#5C2E0E]">
                  <IconX size={20} />
                </button>
              </div>
              <button className="flex items-center gap-2 px-4 py-2 border border-[#8B4513] rounded-lg text-[#3C1810] hover:bg-[#F5E6D3]">
                <IconArticle size={20} />
                Type is Public article
              </button>
              <button className="px-4 py-2 border border-[#8B4513] rounded-lg text-[#3C1810] hover:bg-[#F5E6D3]">
                Filters
              </button>
            </div>

            {/* Results Count */}
            <div className="px-6 py-3 text-[#5C2E0E] flex items-center justify-between border-b border-[#8B4513]">
              <div className="flex items-center gap-2">
                <span>{publicArticles.length + internalArticles.length} results</span>
                <span>in this folder and subfolders</span>
              </div>
              <button className="text-[#8B4513] hover:text-[#5C2E0E]">
                Clear search
              </button>
            </div>

            {/* Articles List */}
            <div className="p-4">
              <table className="w-full">
                <thead className="border-b border-[#8B4513]">
                  <tr>
                    <th className="text-left pb-2 text-[#8B6B4D] font-medium">Title</th>
                    <th className="text-left pb-2 text-[#8B6B4D] font-medium">Type</th>
                    <th className="text-left pb-2 text-[#8B6B4D] font-medium">AI Agent</th>
                    <th className="text-left pb-2 text-[#8B6B4D] font-medium">Help Center</th>
                    <th className="text-left pb-2 text-[#8B6B4D] font-medium">Help Center collections</th>
                    <th className="text-left pb-2 text-[#8B6B4D] font-medium">Status</th>
                    <th className="text-left pb-2 text-[#8B6B4D] font-medium">Last updated</th>
                  </tr>
                </thead>
                <tbody>
                  {[...publicArticles, ...internalArticles].map(article => (
                    <tr key={article.id} className="hover:bg-[#F5E6D3] cursor-pointer">
                      <td className="py-3 text-[#3C1810]">{article.title}</td>
                      <td className="py-3 text-[#3C1810]">
                        {article.is_public ? 'Public article' : 'Internal article'}
                      </td>
                      <td className="py-3">
                        <IconCheck className="text-[#8B4513]" size={20} />
                      </td>
                      <td className="py-3">
                        <IconCheck className="text-[#8B4513]" size={20} />
                      </td>
                      <td className="py-3 text-[#3C1810]">General</td>
                      <td className="py-3">
                        <span className={`px-2 py-1 rounded-full text-sm ${
                          article.is_published 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {article.is_published ? 'Published' : 'Draft'}
                        </span>
                      </td>
                      <td className="py-3 text-[#8B6B4D] text-sm">
                        {formatDate(article.last_updated_at || article.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="p-6 space-y-8">
            {/* Header */}
            <div className="p-6 border-b border-[#8B4513] flex justify-between items-center">
              <h1 className="text-2xl font-bold text-[#3C1810]">Sources</h1>
              <button 
                onClick={handleNewContentClick}
                className="bg-[#8B4513] text-[#FDF6E3] px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-[#5C2E0E]"
              >
                <IconPlus size={20} />
                New content
              </button>
            </div>

            {/* Public Articles Section */}
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="p-2 bg-[#F5E6D3] rounded-lg">
                  <IconArticle size={24} className="text-[#8B4513]" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-[#3C1810]">Public articles</h2>
                  <p className="text-[#5C2E0E] text-sm">
                    Let AI Agent use public articles from your Help Center.
                  </p>
                </div>
              </div>

              {/* Public Articles List - Only show header */}
              <div className="ml-12 space-y-2">
                <div className="flex items-center justify-between p-4 border border-[#8B4513] rounded-lg bg-[#FDF6E3]">
                  <div className="flex items-center gap-3">
                    <img src="/favicon.ico" alt="Logo" className="w-6 h-6" />
                    <div>
                      <span className="text-[#3C1810] font-medium">Handle Bar</span>
                      <span className="text-[#5C2E0E] text-sm ml-2">{publicArticles.length} articles</span>
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
                  <h2 className="text-xl font-semibold text-[#3C1810]">Internal articles</h2>
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
                      <span className="text-[#5C2E0E] text-sm ml-2">{internalArticles.length} articles</span>
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

                {/* Published Internal Articles List */}
                <div className="mt-4 space-y-2">
                  {internalArticles
                    .filter(article => article.is_published)
                    .map(article => (
                      <div 
                        key={article.id}
                        className="p-4 border border-[#8B4513] rounded-lg bg-[#FDF6E3] hover:bg-[#F5E6D3] cursor-pointer"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="text-[#3C1810] font-medium">{article.title}</h3>
                            <p className="text-[#5C2E0E] text-sm mt-1">{article.description}</p>
                          </div>
                          <div className="text-[#8B6B4D] text-sm">
                            {formatDate(article.last_updated_at || article.created_at)}
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* New Content Modal */}
        {isNewContentModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-[#FDF6E3] w-[480px] rounded-lg shadow-lg">
              {/* Modal Header */}
              <div className="p-6 border-b border-[#8B4513]">
                <h2 className="text-xl font-semibold text-[#3C1810]">Create new content</h2>
              </div>

              {/* Modal Content */}
              <div className="p-6 space-y-4">
                {/* Public Article Option */}
                <button 
                  onClick={() => {
                    setIsNewContentModalOpen(false);
                    handleOpenModal('public');
                  }}
                  className="w-full p-4 border border-[#8B4513] rounded-lg hover:bg-[#F5E6D3] flex items-start gap-4"
                >
                  <div className="p-2 bg-[#F5E6D3] rounded-lg">
                    <IconArticle size={24} className="text-[#8B4513]" />
                  </div>
                  <div className="flex-1 text-left">
                    <h3 className="text-lg font-medium text-[#3C1810]">Public article</h3>
                    <p className="text-sm text-[#5C2E0E]">Create an article that will be visible in your Help Center.</p>
                  </div>
                </button>

                {/* Internal Article Option */}
                <button 
                  onClick={() => {
                    setIsNewContentModalOpen(false);
                    handleOpenModal('internal');
                  }}
                  className="w-full p-4 border border-[#8B4513] rounded-lg hover:bg-[#F5E6D3] flex items-start gap-4"
                >
                  <div className="p-2 bg-[#F5E6D3] rounded-lg">
                    <IconLock size={24} className="text-[#8B4513]" />
                  </div>
                  <div className="flex-1 text-left">
                    <h3 className="text-lg font-medium text-[#3C1810]">Internal article</h3>
                    <p className="text-sm text-[#5C2E0E]">Create an article that will only be visible to your team.</p>
                  </div>
                </button>
              </div>

              {/* Modal Footer */}
              <div className="p-6 border-t border-[#8B4513] flex justify-end">
                <button 
                  onClick={() => setIsNewContentModalOpen(false)}
                  className="px-4 py-2 text-[#3C1810] hover:bg-[#F5E6D3] rounded"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
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
                <button 
                  onClick={() => handleCreateArticle(false)}
                  className="px-3 py-1 text-[#3C1810] hover:bg-[#F5E6D3] rounded"
                >
                  Save as draft
                </button>
                <button 
                  onClick={() => handleCreateArticle(true)}
                  className="px-3 py-1 bg-[#8B4513] text-[#FDF6E3] hover:bg-[#5C2E0E] rounded"
                >
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
              <div className="w-80 p-6 flex flex-col h-full">
                <h3 className="text-base font-semibold text-[#3C1810] mb-4">Details</h3>
                {/* Make the content area scrollable */}
                <div className="space-y-4 overflow-y-auto flex-1">
                  {/* Data Section - Reduce font sizes */}
                  <div className="text-xs font-medium text-[#5C2E0E]">Data</div>
                  <div>
                    <label className="text-xs text-[#8B6B4D] block mb-1">Type</label>
                    <div className="flex items-center gap-2 text-2xl text-[#3C1810] bg-[#F5E6D3] px-3 py-2 rounded">
                      {articleData.is_public ? (
                        <>
                          <IconArticle size={20} />
                          <span>Public article</span>
                        </>
                      ) : (
                        <>
                          <IconLock size={20} />
                          <span>Internal article</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-[#8B6B4D] block mb-1">Status</label>
                    <div className="text-sm text-[#3C1810]">
                      {articleData.is_published ? 'Published' : 'Draft'}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-[#8B6B4D] block mb-1">Article ID</label>
                    <div className="text-sm text-[#3C1810]">
                      {articleData.id || 'Not yet created'}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-[#8B6B4D] block mb-1">Language</label>
                    <div className="text-sm text-[#3C1810]">English</div>
                  </div>
                  <div>
                    <label className="text-xs text-[#8B6B4D] block mb-1">Created</label>
                    <div className="text-sm text-[#3C1810]">{formatDate(articleData.created_at)}</div>
                  </div>
                  <div>
                    <label className="text-xs text-[#8B6B4D] block mb-1">Created by</label>
                    <div className="text-sm text-[#3C1810]">
                      {users.find(u => u.id === articleData.created_by)?.display_name || 'Unknown'}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-[#8B6B4D] block mb-1">Last updated</label>
                    <div className="text-sm text-[#3C1810]">
                      {articleData.last_updated_at ? formatDate(articleData.last_updated_at) : ''}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-[#8B6B4D] block mb-1">Last updated by</label>
                    <div className="text-sm text-[#3C1810]">
                      {articleData.last_updated_by ? 
                        users.find(u => u.id === articleData.last_updated_by)?.display_name : ''}
                    </div>
                  </div>

                  {/* AI Section - Update the layout */}
                  <div>
                    <div className="pt-4 border-t border-[#8B4513]"></div>
                    <div className="text-xs font-medium text-[#5C2E0E] mb-2">AI</div>
                    <label className="text-xs text-[#8B6B4D] block mb-1">AI Agent</label>
                    <div className="space-y-2">
                      <div className="text-sm text-[#3C1810] bg-[#F5E6D3] px-3 py-2 rounded">
                        When enabled, AI agent will use this content to generate AI answers.
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-[#3C1810]">Disabled</span>
                        <button 
                          onClick={() => setArticleData(prev => ({ ...prev, enabled_ai: !prev.enabled_ai }))}
                          className={`w-10 h-5 rounded-full relative transition-colors duration-200 ease-in-out ${
                            articleData.enabled_ai ? 'bg-[#8B4513]' : 'bg-[#D4B69C]'
                          }`}
                        >
                          <div 
                            className={`w-4 h-4 rounded-full bg-[#FDF6E3] absolute top-0.5 transition-transform duration-200 ease-in-out ${
                              articleData.enabled_ai ? 'translate-x-5' : 'translate-x-0.5'
                            }`}
                          />
                        </button>
                      </div>
                    </div>
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