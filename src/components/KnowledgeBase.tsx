import { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import supabase from '../supabase';
import IconFilter from '@tabler/icons-react/dist/esm/icons/IconFilter';
import IconArticle from '@tabler/icons-react/dist/esm/icons/IconArticle';
import IconRobot from '@tabler/icons-react/dist/esm/icons/IconRobot';
import IconBrain from '@tabler/icons-react/dist/esm/icons/IconBrain';
import IconFolder from '@tabler/icons-react/dist/esm/icons/IconFolder';
import IconClock from '@tabler/icons-react/dist/esm/icons/IconClock';
import IconCheckbox from '@tabler/icons-react/dist/esm/icons/IconCheckbox';
import IconSearch from '@tabler/icons-react/dist/esm/icons/IconSearch';
import IconBook from '@tabler/icons-react/dist/esm/icons/IconBook';
import IconInbox from '@tabler/icons-react/dist/esm/icons/IconInbox';
import IconChartBar from '@tabler/icons-react/dist/esm/icons/IconChartBar';
import IconSettings from '@tabler/icons-react/dist/esm/icons/IconSettings';
import IconUser from '@tabler/icons-react/dist/esm/icons/IconUser';
import IconPlus from '@tabler/icons-react/dist/esm/icons/IconPlus';
import IconX from '@tabler/icons-react/dist/esm/icons/IconX';
import IconMaximize from '@tabler/icons-react/dist/esm/icons/IconMaximize';
import IconChevronDown from '@tabler/icons-react/dist/esm/icons/IconChevronDown';
import IconLock from '@tabler/icons-react/dist/esm/icons/IconLock';
import IconCheck from '@tabler/icons-react/dist/esm/icons/IconCheck';

type Article = {
  id: string;
  title: string;
  description: string;
  content: string;
  type?: string;
  is_public: boolean;
  is_published: boolean;
  collection_id: string;
  created_at: string;
  last_updated_at: string | null;
  organizations_id: string;
  enabled_ai: boolean;
  created_by: string;
  last_updated_by: string | null;
  collections?: {
    id: string;
    title: string;
  };
};

// Add these types at the top with other types
type GenerationPhase = 'idle' | 'research' | 'analysis' | 'writing' | 'error';

type LoadingMessage = {
  research: string;
  analysis: string;
  writing: string;
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

// Remove AIService import and add generateArticle function
const generateArticle = async (params: {
  title: string;
  description: string;
  organizationId: string;
  collectionId?: string;
}) => {
  const response = await fetch(`${import.meta.env.VITE_API_URL}/ai/generate-article`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    throw new Error('Failed to generate article');
  }

  return response.json();
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
    enabled_ai: false,
    collection_id: '',
  });
  const [publicArticles, setPublicArticles] = useState<Article[]>([]);
  const [internalArticles, setInternalArticles] = useState<Article[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<string | null>(null);
  const [selectedSection, setSelectedSection] = useState('sources');
  const [isNewContentModalOpen, setIsNewContentModalOpen] = useState(false);
  const [newConversationsCount, setNewConversationsCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [collections, setCollections] = useState<Array<{ id: string; title: string }>>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isCreateCollectionModalOpen, setIsCreateCollectionModalOpen] = useState(false);
  const [newCollection, setNewCollection] = useState({
    title: ''
  });
  const [collectionError, setCollectionError] = useState<string | null>(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filters, setFilters] = useState({
    type: '',
    aiAgent: false,
    aiCopilot: false,
    collection: '',
    status: '',
    lastUpdated: ''
  });
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, right: 0 });
  // Add isGeneratingArticle state
  const [isGeneratingArticle, setIsGeneratingArticle] = useState(false);
  // Add new state for error modal
  const [errorModal, setErrorModal] = useState<{
    isOpen: boolean;
    message: string;
  }>({
    isOpen: false,
    message: ''
  });
  // Add new state variables
  const [generationPhase, setGenerationPhase] = useState<GenerationPhase>('idle');
  
  const loadingMessages: LoadingMessage = {
    research: 'One moment please. AI Dali is collecting information...',
    analysis: 'Almost there, AI Dali is analyzing the information...',
    writing: 'Generating your article...'
  };

  // Add LoadingOverlay component
  const LoadingOverlay = () => (
    <>
      {generationPhase !== 'idle' && (
        <div className="absolute inset-0 bg-[#FDF6E3] bg-opacity-90 flex flex-col items-center justify-center z-10">
          <div className="flex flex-col items-center space-y-4">
            {/* Loading Animation */}
            <div className="w-16 h-16 relative">
              <div className="absolute inset-0 border-4 border-[#8B4513] border-opacity-20 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-[#8B4513] border-l-transparent rounded-full animate-spin"></div>
            </div>
            
            {/* Loading Message */}
            <p className="text-[#3C1810] text-lg font-medium text-center px-4">
              {loadingMessages[generationPhase as keyof LoadingMessage]}
            </p>
            
            {/* Progress Indicator */}
            <div className="flex items-center space-x-2">
              {(['research', 'analysis', 'writing'] as const).map((phase, index) => (
                <div 
                  key={phase}
                  className={`w-2 h-2 rounded-full ${
                    index <= ['research', 'analysis', 'writing'].indexOf(generationPhase)
                      ? 'bg-[#8B4513]' 
                      : 'bg-[#D4B69C]'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );

  // Add authentication check
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error || !session) {
          console.error('Auth error:', error);
          navigate('/signin');
          return;
        }

        // Set up auth state change listener
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
          if (!session) {
            navigate('/signin');
          }
        });

        return () => {
          subscription.unsubscribe();
        };
      } catch (error) {
        console.error('Auth check error:', error);
        navigate('/signin');
      }
    };

    checkAuth();
  }, [navigate]);

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

  // Update the real-time subscription useEffect
  useEffect(() => {
    if (!selectedOrg) return;

    // Initial fetch of articles
    const fetchArticles = async () => {
      const { data: articles, error } = await supabase
        .from('articles')
        .select(`
          *,
          created_by_user:users!articles_created_by_fkey(display_name),
          last_updated_by_user:users!articles_last_updated_by_fkey(display_name),
          collections:collection_id (
            id,
            title
          )
        `)
        .eq('organizations_id', selectedOrg)
        .order('created_at', { ascending: false });

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
    const channel = supabase
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
          // When an article is updated or inserted, fetch its collection data
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const { data: article } = await supabase
              .from('articles')
              .select(`
                *,
                created_by_user:users!articles_created_by_fkey(display_name),
                last_updated_by_user:users!articles_last_updated_by_fkey(display_name),
                collections:collection_id (
                  id,
                  title
                )
              `)
              .eq('id', payload.new.id)
              .single();

            if (article) {
              if (article.is_public) {
          setPublicArticles(prev => {
                  const filtered = prev.filter(a => a.id !== article.id);
                  return [article, ...filtered];
          });
              } else {
          setInternalArticles(prev => {
                  const filtered = prev.filter(a => a.id !== article.id);
                  return [article, ...filtered];
                });
              }
            }
          } else if (payload.eventType === 'DELETE') {
            const deletedArticle = payload.old;
            if (deletedArticle.is_public) {
              setPublicArticles(prev => prev.filter(a => a.id !== deletedArticle.id));
            } else {
              setInternalArticles(prev => prev.filter(a => a.id !== deletedArticle.id));
            }
          }
        }
      )
      .subscribe();

    return () => {
      console.log('Cleaning up subscription');
      supabase.removeChannel(channel);
    };
  }, [selectedOrg]);

  // Add useEffect to keep inbox count updated
  useEffect(() => {
    if (!selectedOrg) return;

    const fetchInboxCount = async () => {
      const { data: activeConversations, error } = await supabase
        .from('conversations')
        .select('id, status')
        .eq('organizations_id', selectedOrg)
        .in('status', ['New', 'Active']);

      if (error) {
        console.error('Error fetching inbox count:', error);
        return;
      }

      setNewConversationsCount(activeConversations?.length || 0);
    };

    fetchInboxCount();

    const channel = supabase
      .channel('inbox_count_knowledge')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations',
          filter: `organizations_id=eq.${selectedOrg}`
        },
        () => {
          fetchInboxCount();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [selectedOrg]);

  // Add this useEffect to fetch and subscribe to collections
  useEffect(() => {
    if (!selectedOrg) return;

    // Initial fetch of collections
    const fetchCollections = async () => {
      const { data: collections, error } = await supabase
        .from('collections')
        .select('id, title')
        .eq('organizations_id', selectedOrg)
        .order('title', { ascending: true }); // Add ordering

      if (error) {
        console.error('Error fetching collections:', error);
        return;
      }

      if (collections) {
        // Ensure unique collections
        const uniqueCollections = new Map();
        collections.forEach(collection => {
          uniqueCollections.set(collection.id, collection);
        });
        
        setCollections(Array.from(uniqueCollections.values()));
      }
    };

    fetchCollections();

    // Set up real-time subscription
    const channel = supabase
      .channel('collections_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'collections',
          filter: `organizations_id=eq.${selectedOrg}`
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newCollection = payload.new;
            setCollections(prev => [{
              id: newCollection.id,
              title: newCollection.title
            }, ...prev]);
          } else if (payload.eventType === 'DELETE') {
            const deletedCollection = payload.old;
            setCollections(prev => 
              prev.filter(c => c.id !== deletedCollection.id)
            );
          } else if (payload.eventType === 'UPDATE') {
            const updatedCollection = payload.new;
            setCollections(prev => 
              prev.map(c => 
                c.id === updatedCollection.id 
                  ? { id: updatedCollection.id, title: updatedCollection.title }
                  : c
              )
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedOrg]);

  // Add this near the top of your KnowledgeBase component
  useEffect(() => {
    // Get the section from URL query parameters
    const params = new URLSearchParams(window.location.search);
    const section = params.get('section');
    
    // If section is specified, set it
    if (section) {
      setSelectedSection(section);
    }
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

  // Update the formatDate function to show relative time
  const formatDate = (dateString: string | null) => {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    // Less than a minute
    if (diffInSeconds < 60) {
      return 'just now';
    }
    
    // Less than an hour
    if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;
    }
    
    // Less than a day
    if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
    }
    
    // Less than a week
    if (diffInSeconds < 604800) {
      const days = Math.floor(diffInSeconds / 86400);
      return `${days} ${days === 1 ? 'day' : 'days'} ago`;
    }
    
    // Less than a month
    if (diffInSeconds < 2592000) {
      const weeks = Math.floor(diffInSeconds / 604800);
      return `${weeks} ${weeks === 1 ? 'week' : 'weeks'} ago`;
    }
    
    // Less than a year
    if (diffInSeconds < 31536000) {
      const months = Math.floor(diffInSeconds / 2592000);
      return `${months} ${months === 1 ? 'month' : 'months'} ago`;
    }
    
    // More than a year
    const years = Math.floor(diffInSeconds / 31536000);
    return `${years} ${years === 1 ? 'year' : 'years'} ago`;
  };

  const defaultArticleData = {
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
    created_by: '',
    enabled_ai: false,
    collection_id: '',
  };

  // Modify the handleCreateArticle function to not automatically generate content
  const handleCreateArticle = async (publish: boolean = false) => {
    try {
      if (!selectedOrg || !currentUser) return;
      
      // Prepare article data with current content
      const articleToSave = {
        organizations_id: selectedOrg,
        title: articleData.title,
        description: articleData.description,
        content: articleData.content,
        is_public: articleModalType === 'public',
        is_published: publish,
        last_updated_at: new Date().toISOString(),
        last_updated_by: currentUser.id,
        enabled_ai: articleData.enabled_ai,
        collection_id: articleData.collection_id || null
      };

      let response;
      
      if (articleData.id) {
        // Update existing article
        response = await supabase
          .from('articles')
          .update(articleToSave)
          .eq('id', articleData.id)
          .select(`
            *,
            created_by_user:users!articles_created_by_fkey(display_name),
            last_updated_by_user:users!articles_last_updated_by_fkey(display_name),
            collections:collection_id (
              id,
              title
            )
          `)
          .single();
      } else {
        // Create new article
        response = await supabase
          .from('articles')
          .insert([{
            ...articleToSave,
            created_by: currentUser.id,
          }])
          .select(`
            *,
            created_by_user:users!articles_created_by_fkey(display_name),
            last_updated_by_user:users!articles_last_updated_by_fkey(display_name),
            collections:collection_id (
              id,
              title
            )
          `)
          .single();
      }

      if (response.error) throw response.error;

      // Store embeddings for the article if it has content
      if (articleData.content) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          const embeddingResponse = await fetch(`${import.meta.env.VITE_API_URL}/ai/store-embeddings`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session?.access_token}`
            },
            body: JSON.stringify({
              articleId: response.data.id,
              content: articleData.content,
              organizationId: selectedOrg
            }),
          });

          if (!embeddingResponse.ok) {
            throw new Error('Failed to store embeddings');
          }
        } catch (error) {
          console.error('Error storing embeddings:', error);
        }
      }

      // Update articles list
      const updatedArticle = response.data;
      if (articleData.id) {
        if (updatedArticle.is_public) {
          setPublicArticles(prev => prev.map(a => a.id === articleData.id ? updatedArticle : a));
        } else {
          setInternalArticles(prev => prev.map(a => a.id === articleData.id ? updatedArticle : a));
        }
      } else {
        if (updatedArticle.is_public) {
          setPublicArticles(prev => [updatedArticle, ...prev]);
        } else {
          setInternalArticles(prev => [updatedArticle, ...prev]);
        }
      }

      // Reset form and close modal
      setArticleModalType(null);
      setArticleData(defaultArticleData);

    } catch (error) {
      console.error('Error saving article:', error);
      setErrorModal({
        isOpen: true,
        message: 'Failed to save article'
      });
    }
  };

  // Separate function for AI generation
  const handleGenerateWithAI = async () => {
    if (!selectedOrg || !articleData.title) {
      if (!articleData.title) {
        setErrorModal({
          isOpen: true,
          message: 'Please enter a title for the article'
        });
      }
      return;
    }
    
    setIsGeneratingArticle(true);
    setGenerationPhase('research');
    
    try {
      // Simulate research phase
      await new Promise(resolve => setTimeout(resolve, 2000));
      setGenerationPhase('analysis');
      
      // Simulate analysis phase
      await new Promise(resolve => setTimeout(resolve, 2000));
      setGenerationPhase('writing');
      
      // Make the actual API call
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`${import.meta.env.VITE_API_URL}/ai/generate-enhanced-article`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          title: articleData.title,
          description: articleData.description || '',
          organizationId: selectedOrg,
          collectionId: articleData.collection_id
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate article');
      }

      const { content } = await response.json();
      
      setArticleData(prev => ({
        ...prev,
        content: content || ''
      }));
    } catch (error) {
      console.error('Error generating article:', error);
      setErrorModal({
        isOpen: true,
        message: 'Failed to generate article content'
      });
      setGenerationPhase('error');
    } finally {
      setIsGeneratingArticle(false);
      setGenerationPhase('idle');
    }
  };

  // Update the handleArticleClick function to load article data
  const handleArticleClick = (article: Article) => {
    setArticleData(article);
    setArticleModalType(article.is_public ? 'public' : 'internal');
  };

  // Add handler for new content button
  const handleNewContentClick = () => {
    setIsNewContentModalOpen(true);
  };

  // Update the filtering logic to work with existing code
  const filteredArticles = useMemo(() => {
    // Create a Map to store unique articles by ID
    const articlesMap = new Map();
    
    // Add public articles to the map
    publicArticles.forEach(article => {
      articlesMap.set(article.id, article);
    });
    
    // Add internal articles to the map (will overwrite any duplicates)
    internalArticles.forEach(article => {
      articlesMap.set(article.id, article);
    });
    
    // Convert map values back to array
    const uniqueArticles = Array.from(articlesMap.values());

    return uniqueArticles.filter(article => {
      // First apply the search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch = 
          article.title.toLowerCase().includes(query) ||
          article.description.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }

      // Then apply the additional filters
      // Type filter (public/internal)
      if (filters.type === 'public' && !article.is_public) return false;
      if (filters.type === 'internal' && article.is_public) return false;
      
      // AI Agent filter
      if (filters.aiAgent && !article.enabled_ai) return false;
      
      // AI Copilot filter
      if (filters.aiCopilot && !article.enabled_ai) return false;
      
      // Collection filter
      if (filters.collection && article.collection_id !== filters.collection) return false;
      
      // Status filter
      if (filters.status === 'published' && !article.is_published) return false;
      if (filters.status === 'draft' && article.is_published) return false;
      
      // Last Updated filter
      if (filters.lastUpdated) {
        const lastUpdated = new Date(article.last_updated_at || article.created_at);
        const now = new Date();
        
        switch (filters.lastUpdated) {
          case 'today':
            if (lastUpdated.toDateString() !== now.toDateString()) return false;
            break;
          case 'week':
            const weekAgo = new Date(now.setDate(now.getDate() - 7));
            if (lastUpdated < weekAgo) return false;
            break;
          case 'month':
            const monthAgo = new Date(now.setMonth(now.getMonth() - 1));
            if (lastUpdated < monthAgo) return false;
            break;
          case 'year':
            const yearAgo = new Date(now.setFullYear(now.getFullYear() - 1));
            if (lastUpdated < yearAgo) return false;
            break;
        }
      }
      
      return true;
    });
  }, [publicArticles, internalArticles, searchQuery, filters]);

  const handleCollectionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value === 'new') {
      // Handle creating new collection
      // You could open another modal or implement your preferred UI for collection creation
      handleCreateNewCollection();
    } else {
      setArticleData({ ...articleData, collection_id: value });
    }
  };

  const handleCreateNewCollection = async () => {
    setIsCreateCollectionModalOpen(true);
  };

  const handleSaveCollection = async () => {
    try {
      if (!selectedOrg) return;
      
      setCollectionError(null); // Reset error state

      // First check if collection with same title exists
      const { data: existingCollections, error: searchError } = await supabase
        .from('collections')
        .select('id, title')
        .eq('organizations_id', selectedOrg)
        .ilike('title', newCollection.title)
        .single();

      if (searchError && searchError.code !== 'PGRST116') { // PGRST116 means no rows returned
        throw searchError;
      }

      if (existingCollections) {
        // Collection exists - set it as selected and show message
        setArticleData(prev => ({
          ...prev,
          collection_id: existingCollections.id
        }));

        setCollectionError(`Collection "${existingCollections.title}" already exists and has been selected`);
        
        // Don't close modal immediately to show the message
        setTimeout(() => {
          setIsCreateCollectionModalOpen(false);
          setIsDropdownOpen(false);
          setCollectionError(null);
        }, 2000);

        return;
      }

      // If no existing collection, create new one
      const { data: collectionData, error: collectionError } = await supabase
        .from('collections')
        .insert([{
          title: newCollection.title,
          organizations_id: selectedOrg
        }])
        .select()
        .single();

      if (collectionError) throw collectionError;

      // Add new collection to local state
      setCollections(prev => [...prev, {
        id: collectionData.id,
        title: collectionData.title
      }]);

      // Set the new collection as selected
      setArticleData(prev => ({
        ...prev,
        collection_id: collectionData.id
      }));

      // Close modals
      setIsCreateCollectionModalOpen(false);
      setIsDropdownOpen(false);

      // Reset new collection form
      setNewCollection({
        title: ''
      });

    } catch (error) {
      console.error('Error creating collection:', error);
      setCollectionError('Error creating collection. Please try again.');
    }
  };

  // Add this effect to close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!event.target) return;
      const target = event.target as HTMLElement;
      if (!target.closest('.relative')) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Add click outside handler for filter dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.filter-dropdown')) {
        setIsFilterOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const renderArticleList = (articles: Article[]) => {
    return articles.map(article => (
      <div key={article.id} className="flex items-center gap-4 p-4 border-b border-[#8B4513] hover:bg-[#F5E6D3]">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-base font-medium text-[#3C1810]">
              {article.title}
            </h3>
            {article.collections && (
              <span className="text-xs text-[#8B6B4D] bg-[#F5E6D3] px-2 py-1 rounded">
                {article.collections.title}
              </span>
            )}
          </div>
          <p className="text-sm text-[#5C2E0E]">{article.description}</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Your existing action buttons */}
        </div>
      </div>
    ));
  };

  // Add custom error modal component before the return statement
  const ErrorModal = ({ message, onClose }: { message: string; onClose: () => void }) => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[70]">
      <div className="bg-[#FDF6E3] w-[400px] rounded-lg shadow-lg">
        <div className="p-6 flex items-start gap-4">
          <div className="flex-1">
            <h3 className="text-lg font-medium text-[#3C1810] mb-2">Error</h3>
            <p className="text-[#5C2E0E]">{message}</p>
          </div>
        </div>
        <div className="p-4 border-t border-[#8B4513] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#8B4513] text-[#FDF6E3] rounded-lg hover:bg-[#5C2E0E]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );

  // First, let's add a helper function near the top of the component to check if title is default
  const isDefaultTitle = (title: string, type: 'public' | 'internal' | null) => {
    return !title || title === `Untitled ${type} article`;
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
            className={`p-2 rounded-lg relative ${
              selectedNav === 'inbox' ? 'text-[#8B4513] bg-[#F5E6D3]' : 'text-[#3C1810] hover:bg-[#F5E6D3]'
            }`}
          >
            <IconInbox size={20} />
            {/* Always show the count badge */}
            {newConversationsCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-[#8B4513] text-[#FDF6E3] text-xs w-4 h-4 flex items-center justify-center rounded-full">
                {newConversationsCount}
              </span>
            )}
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
        <div className="p-6 border-b border-[#8B4513]">
          <div className="flex items-center justify-between h-9">
            <h2 className="text-xl font-semibold text-[#3C1810]">Knowledge Bar</h2>
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
              onClick={() => navigate('/knowledge/help')}
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
            <div className="p-6 border-b border-[#8B4513]">
              <div className="flex items-center justify-between h-9">
                <h1 className="text-xl font-semibold text-[#3C1810]">Content</h1>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={handleNewContentClick}
                    className="bg-[#8B4513] text-[#FDF6E3] px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-[#5C2E0E]"
                  >
                    <IconPlus size={20} />
                    New content
                  </button>
                </div>
              </div>
            </div>

            {/* Content Container with Padding */}
            <div className="p-12">
              {/* Search and Filter Bar */}
              <div className="flex items-center gap-2 mb-6">
                <div className="relative flex-1">
                  <input
                    type="text"
                    placeholder="Search articles..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full px-4 py-2 pl-10 bg-[#F5E6D3] border border-[#8B4513] rounded-lg text-[#3C1810] placeholder-[#8B6B4D] focus:outline-none focus:ring-1 focus:ring-[#8B4513]"
                  />
                  <IconSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#8B4513]" size={18} />
                </div>
                
                {/* Filter Button and Dropdown */}
                <div className="relative filter-dropdown">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const button = e.currentTarget;
                      const rect = button.getBoundingClientRect();
                      setDropdownPosition({ top: rect.bottom + 8, right: window.innerWidth - rect.right });
                      setIsFilterOpen(!isFilterOpen);
                    }}
                    className={`p-2 rounded hover:bg-[#F5E6D3] ${
                      isFilterOpen ? 'bg-[#F5E6D3]' : ''
                    }`}
                  >
                    <IconFilter size={20} className="text-[#3C1810]" />
                  </button>

                  {isFilterOpen && (
                    <div 
                      className="fixed w-64 bg-[#FDF6E3] border border-[#8B4513] rounded-lg shadow-lg z-[9999] max-h-[80vh] overflow-y-auto"
                      style={{
                        top: dropdownPosition.top,
                        right: dropdownPosition.right,
                      }}
                    >
                      {/* Clear All Filters Button */}
                      <div className="p-4 border-b border-[#8B4513]">
                        <button
                          onClick={() => setFilters({
                            type: null,
                            aiAgent: false,
                            aiCopilot: false,
                            collection: null,
                            status: null,
                            lastUpdated: null
                          })}
                          className="w-full p-2 text-sm text-[#3C1810] bg-[#F5E6D3] rounded-lg hover:bg-[#ECD6B3] transition-colors duration-200"
                        >
                          Clear all filters
                        </button>
                      </div>

                      {/* Type Filter */}
                      <div className="p-4 border-b border-[#8B4513]">
                        <div className="text-sm font-medium text-[#3C1810] mb-2 flex items-center gap-2">
                          <IconArticle size={16} />
                          Type
                        </div>
                        <div className="space-y-2">
                          <div 
                            onClick={() => setFilters({ ...filters, type: filters.type === '' ? null : '' })}
                            className={`flex items-center justify-between p-2 rounded-lg cursor-pointer ${
                              filters.type === '' ? 'bg-[#8B4513] text-[#FDF6E3]' : 'hover:bg-[#F5E6D3] text-[#3C1810]'
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              {filters.type === '' && <IconCheck size={16} />}
                              All Types
                            </span>
                          </div>
                          <div 
                            onClick={() => setFilters({ ...filters, type: filters.type === 'public' ? null : 'public' })}
                            className={`flex items-center justify-between p-2 rounded-lg cursor-pointer ${
                              filters.type === 'public' ? 'bg-[#8B4513] text-[#FDF6E3]' : 'hover:bg-[#F5E6D3] text-[#3C1810]'
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              {filters.type === 'public' && <IconCheck size={16} />}
                              Public
                            </span>
                          </div>
                          <div 
                            onClick={() => setFilters({ ...filters, type: filters.type === 'internal' ? null : 'internal' })}
                            className={`flex items-center justify-between p-2 rounded-lg cursor-pointer ${
                              filters.type === 'internal' ? 'bg-[#8B4513] text-[#FDF6E3]' : 'hover:bg-[#F5E6D3] text-[#3C1810]'
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              {filters.type === 'internal' && <IconCheck size={16} />}
                              Internal
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* AI Agent Filter */}
                      <div className="p-4 border-b border-[#8B4513]">
                        <div className="text-sm font-medium text-[#3C1810] mb-2 flex items-center gap-2">
                          <IconRobot size={16} />
                          AI Agent
                        </div>
                        <div 
                          onClick={() => setFilters({ ...filters, aiAgent: !filters.aiAgent })}
                          className={`flex items-center justify-between p-2 rounded-lg cursor-pointer ${
                            filters.aiAgent ? 'bg-[#8B4513] text-[#FDF6E3]' : 'hover:bg-[#F5E6D3] text-[#3C1810]'
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            {filters.aiAgent && <IconCheck size={16} />}
                            Enabled
                          </span>
                        </div>
                      </div>

                      {/* AI Copilot Filter */}
                      <div className="p-4 border-b border-[#8B4513]">
                        <div className="text-sm font-medium text-[#3C1810] mb-2 flex items-center gap-2">
                          <IconBrain size={16} />
                          AI Copilot
                        </div>
                        <div 
                          onClick={() => setFilters({ ...filters, aiCopilot: !filters.aiCopilot })}
                          className={`flex items-center justify-between p-2 rounded-lg cursor-pointer ${
                            filters.aiCopilot ? 'bg-[#8B4513] text-[#FDF6E3]' : 'hover:bg-[#F5E6D3] text-[#3C1810]'
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            {filters.aiCopilot && <IconCheck size={16} />}
                            Enabled
                          </span>
                        </div>
                      </div>

                      {/* Collections Filter */}
                      <div className="p-4 border-b border-[#8B4513]">
                        <div className="text-sm font-medium text-[#3C1810] mb-2 flex items-center gap-2">
                          <IconFolder size={16} />
                          Collections
                        </div>
                        <div className="space-y-2">
                          <div 
                            onClick={() => setFilters({ ...filters, collection: filters.collection === '' ? null : '' })}
                            className={`flex items-center justify-between p-2 rounded-lg cursor-pointer ${
                              filters.collection === '' ? 'bg-[#8B4513] text-[#FDF6E3]' : 'hover:bg-[#F5E6D3] text-[#3C1810]'
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              {filters.collection === '' && <IconCheck size={16} />}
                              All Collections
                            </span>
                          </div>
                          {collections.map((collection) => (
                            <div 
                              key={collection.id}
                              onClick={() => setFilters({ ...filters, collection: filters.collection === collection.id ? null : collection.id })}
                              className={`flex items-center justify-between p-2 rounded-lg cursor-pointer ${
                                filters.collection === collection.id ? 'bg-[#8B4513] text-[#FDF6E3]' : 'hover:bg-[#F5E6D3] text-[#3C1810]'
                              }`}
                            >
                              <span className="flex items-center gap-2">
                                {filters.collection === collection.id && <IconCheck size={16} />}
                                {collection.title}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Status Filter */}
                      <div className="p-4 border-b border-[#8B4513]">
                        <div className="text-sm font-medium text-[#3C1810] mb-2 flex items-center gap-2">
                          <IconCheckbox size={16} />
                          Status
                        </div>
                        <div className="space-y-2">
                          <div 
                            onClick={() => setFilters({ ...filters, status: filters.status === '' ? null : '' })}
                            className={`flex items-center justify-between p-2 rounded-lg cursor-pointer ${
                              filters.status === '' ? 'bg-[#8B4513] text-[#FDF6E3]' : 'hover:bg-[#F5E6D3] text-[#3C1810]'
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              {filters.status === '' && <IconCheck size={16} />}
                              All Status
                            </span>
                          </div>
                          <div 
                            onClick={() => setFilters({ ...filters, status: filters.status === 'published' ? null : 'published' })}
                            className={`flex items-center justify-between p-2 rounded-lg cursor-pointer ${
                              filters.status === 'published' ? 'bg-[#8B4513] text-[#FDF6E3]' : 'hover:bg-[#F5E6D3] text-[#3C1810]'
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              {filters.status === 'published' && <IconCheck size={16} />}
                              Published
                            </span>
                          </div>
                          <div 
                            onClick={() => setFilters({ ...filters, status: filters.status === 'draft' ? null : 'draft' })}
                            className={`flex items-center justify-between p-2 rounded-lg cursor-pointer ${
                              filters.status === 'draft' ? 'bg-[#8B4513] text-[#FDF6E3]' : 'hover:bg-[#F5E6D3] text-[#3C1810]'
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              {filters.status === 'draft' && <IconCheck size={16} />}
                              Draft
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Last Updated Filter */}
                      <div className="p-4">
                        <div className="text-sm font-medium text-[#3C1810] mb-2 flex items-center gap-2">
                          <IconClock size={16} />
                          Last Updated
                        </div>
                        <div className="space-y-2">
                          <div 
                            onClick={() => setFilters({ ...filters, lastUpdated: filters.lastUpdated === '' ? null : '' })}
                            className={`flex items-center justify-between p-2 rounded-lg cursor-pointer ${
                              filters.lastUpdated === '' ? 'bg-[#8B4513] text-[#FDF6E3]' : 'hover:bg-[#F5E6D3] text-[#3C1810]'
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              {filters.lastUpdated === '' && <IconCheck size={16} />}
                              Any time
                            </span>
                          </div>
                          <div 
                            onClick={() => setFilters({ ...filters, lastUpdated: filters.lastUpdated === 'today' ? null : 'today' })}
                            className={`flex items-center justify-between p-2 rounded-lg cursor-pointer ${
                              filters.lastUpdated === 'today' ? 'bg-[#8B4513] text-[#FDF6E3]' : 'hover:bg-[#F5E6D3] text-[#3C1810]'
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              {filters.lastUpdated === 'today' && <IconCheck size={16} />}
                              Today
                            </span>
                          </div>
                          <div 
                            onClick={() => setFilters({ ...filters, lastUpdated: filters.lastUpdated === 'week' ? null : 'week' })}
                            className={`flex items-center justify-between p-2 rounded-lg cursor-pointer ${
                              filters.lastUpdated === 'week' ? 'bg-[#8B4513] text-[#FDF6E3]' : 'hover:bg-[#F5E6D3] text-[#3C1810]'
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              {filters.lastUpdated === 'week' && <IconCheck size={16} />}
                              Last week
                            </span>
                          </div>
                          <div 
                            onClick={() => setFilters({ ...filters, lastUpdated: filters.lastUpdated === 'month' ? null : 'month' })}
                            className={`flex items-center justify-between p-2 rounded-lg cursor-pointer ${
                              filters.lastUpdated === 'month' ? 'bg-[#8B4513] text-[#FDF6E3]' : 'hover:bg-[#F5E6D3] text-[#3C1810]'
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              {filters.lastUpdated === 'month' && <IconCheck size={16} />}
                              Last month
                            </span>
                          </div>
                          <div 
                            onClick={() => setFilters({ ...filters, lastUpdated: filters.lastUpdated === 'year' ? null : 'year' })}
                            className={`flex items-center justify-between p-2 rounded-lg cursor-pointer ${
                              filters.lastUpdated === 'year' ? 'bg-[#8B4513] text-[#FDF6E3]' : 'hover:bg-[#F5E6D3] text-[#3C1810]'
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              {filters.lastUpdated === 'year' && <IconCheck size={16} />}
                              Last year
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Table Container */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b border-[#8B4513]">
                    <tr className="text-left text-xs text-[#8B6B4D]">
                      <th className="text-left py-3 pr-6 font-medium w-[30%]">Title</th>
                      <th className="text-left py-3 pr-6 font-medium w-[15%]">Type</th>
                      <th className="text-left py-3 pr-3 font-medium w-[10%]">AI Agent</th>
                      <th className="text-left py-3 pr-3 font-medium w-[10%]">Help Center</th>
                      <th className="text-left py-3 pr-4 font-medium w-[10%]">Collections</th>
                      <th className="text-left py-3 pr-4 font-medium w-[12%]">Status</th>
                      <th className="text-left py-3 font-medium w-[13%]">Last updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredArticles.map((article) => (
                      <tr 
                        key={article.id} 
                        className="hover:bg-[#F5E6D3] cursor-pointer border-b border-[#8B4513] last:border-b-0"
                        onClick={() => handleArticleClick(article)}
                      >
                        <td className="py-4 pr-6">
                          <div className="flex items-center gap-2">
                            <IconArticle 
                              size={18} 
                              className="text-[#8B4513] shrink-0" 
                              stroke={1.5}
                            />
                            <span className="text-[#3C1810]">{article.title}</span>
                          </div>
                        </td>
                        <td className="py-4 pr-6 text-[#3C1810] text-sm">
                          {article.is_public ? 'Public article' : 'Internal article'}
                        </td>
                        <td className="py-4 pr-4">
                          {article.enabled_ai ? (
                            <IconCheck size={18} className="text-[#8B4513]" />
                          ) : (
                            <IconX size={18} className="text-[#8B6B4D]" />
                          )}
                        </td>
                        <td className="py-4 pr-4">
                          {article.is_public && article.is_published ? (
                            <IconCheck size={18} className="text-[#8B4513]" />
                          ) : (
                            <IconX size={18} className="text-[#8B6B4D]" />
                          )}
                        </td>
                        <td className="py-4 pr-4 text-[#3C1810] text-sm">
                          {article.collections?.title || 'Uncategorized'}
                        </td>
                        <td className="py-4 pr-4">
                          <span className={`px-2 py-1 rounded-full text-sm ${
                            article.is_published 
                            ? 'bg-[#DCC0A3] text-[#5C2E0E]' 
                            : 'bg-[#F5E6D3] text-[#8B6B4D]'
                          }`}>
                            {article.is_published ? 'Published' : 'Draft'}
                          </span>
                        </td>
                        <td className="py-4 text-[#8B6B4D] text-sm">
                          {formatDate(article.last_updated_at || article.created_at)}
                        </td>
                      </tr>
                    ))}
                    {filteredArticles.length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-6 text-center text-[#5C2E0E]">
                          No articles found matching your search
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-auto">
            {/* Header */}
            <div className="p-6 border-b border-[#8B4513]">
              <div className="flex items-center justify-between h-9">
                <h1 className="text-xl font-semibold text-[#3C1810]">Sources</h1>
                <button 
                  onClick={handleNewContentClick}
                  className="bg-[#8B4513] text-[#FDF6E3] px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-[#5C2E0E]"
                >
                  <IconPlus size={20} />
                  New content
                </button>
              </div>
            </div>
            
            {/* Sources content with padding */}
            <div className="p-6">
              {/* Public Articles Section */}
              <div className="space-y-8">
                {/* Public Articles */}
                <div className="space-y-6">
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

                  {/* Public Articles List */}
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

                {/* Internal Articles */}
                <div className="space-y-6">
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
                  </div>
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
            {/* Modal Header - Keep fixed */}
            <div className="flex items-center justify-between p-4 border-b border-[#8B4513] shrink-0">
              <h2 className="text-sm font-semibold text-[#3C1810]">
                {articleModalType === 'public' ? 'Public article' : 'Internal article'}
              </h2>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => {
                    setArticleModalType(null);
                    setArticleData(defaultArticleData);
                  }}
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
                  onClick={() => {
                    setArticleModalType(null);
                    setArticleData(defaultArticleData);
                  }}
                  className="p-2 hover:bg-[#F5E6D3] rounded"
                >
                  <IconX size={20} className="text-[#3C1810]" />
                </button>
              </div>
            </div>

            {/* Modal Content - Make scrollable */}
            <div className="flex flex-1 overflow-hidden">
              {/* Editor Section */}
              <div className="flex-1 overflow-y-auto p-6 border-r border-[#8B4513]">
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
                <div className="flex items-center justify-end mb-4">
                  <div className="relative">
                    <button
                      onClick={handleGenerateWithAI}
                      disabled={isDefaultTitle(articleData.title, articleModalType) || isGeneratingArticle}
                      className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                        isDefaultTitle(articleData.title, articleModalType)
                          ? 'bg-[#D4B69C] text-[#8B4513] cursor-not-allowed hover:bg-[#D4B69C]' 
                          : isGeneratingArticle
                          ? 'bg-[#8B4513] text-[#FDF6E3] opacity-50 cursor-not-allowed'
                          : 'bg-[#8B4513] text-[#FDF6E3] hover:bg-[#5C2E0E]'
                      }`}
                    >
                      <IconRobot size={20} className={isGeneratingArticle ? 'animate-spin' : ''} />
                      {isGeneratingArticle ? 'Generating...' : 'Generate with AI'}
                    </button>
                    
                    {/* Tooltip for disabled state - Updated positioning */}
                    {isDefaultTitle(articleData.title, articleModalType) && (
                      <div className="absolute bottom-full right-0 mb-2 w-64">
                        <div className="bg-[#FDF6E3] border border-[#8B4513] rounded-lg px-4 py-2 shadow-lg">
                          <p className="text-sm text-[#3C1810] text-center">
                            Unlock the magic by letting AI Dali knows the title of your article.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="relative group">
                  {/* Tooltip */}
                  <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                    <div className="flex items-center bg-[#FDF6E3] border border-[#8B4513] rounded px-2 py-1 shadow-lg">
                      <img src="/favicon.ico" alt="Tooltip" className="w-4 h-4 mr-2" />
                      <span className="text-sm text-[#3C1810]">Ask Agent Dali to write this article for you</span>
                    </div>
                  </div>
                  
                  {/* Add LoadingOverlay here */}
                  <LoadingOverlay />
                  
                  <textarea
                    value={articleData.content}
                    onChange={(e) => setArticleData({ ...articleData, content: e.target.value })}
                    className="w-full min-h-[500px] text-[#3C1810] bg-transparent border-none outline-none resize-y hover:bg-[#F5E6D3] transition-colors duration-200 p-2 rounded"
                    placeholder="Start writing..."
                  />
                </div>
              </div>

              {/* Details Sidebar */}
              <div className="w-80 flex flex-col overflow-hidden">
                {/* Details Header */}
                <div className="p-6 border-b border-[#8B4513] shrink-0">
                  <h3 className="text-base font-semibold text-[#3C1810]">Details</h3>
                </div>
                
                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto p-6">
                  <div className="space-y-4">
                    {/* Data Section */}
                  <div className="text-xs font-medium text-[#5C2E0E]">Data</div>
                  <div>
                    <label className="text-xs text-[#8B6B4D] block mb-1">Type</label>
                    <div className="flex items-center gap-2 text-sm text-[#3C1810] bg-[#F5E6D3] px-3 py-2 rounded">
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

                    {/* AI Section */}
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

                    {/* Help Center Section */}
                    <div className="pt-4 border-t border-[#8B4513]">
                      <div className="text-xs font-medium text-[#5C2E0E] mb-4">Help Center</div>
                      
                      <div className="space-y-2">
                        <label className="text-xs text-[#8B6B4D] block">Collection</label>
                        <div className="relative">
                          <div 
                            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                            className="w-full px-3 py-2 text-sm text-[#3C1810] bg-[#FDF6E3] rounded border border-[#8B4513] cursor-pointer hover:bg-[#F5E6D3] transition-colors duration-200 flex items-center justify-between"
                          >
                            <span className={articleData.collection_id ? 'text-[#3C1810]' : 'text-[#8B6B4D]'}>
                              {articleData.collection_id ? 
                                collections.find(c => c.id === articleData.collection_id)?.title : 
                                'Select collection...'}
                            </span>
                            <IconChevronDown size={16} className="text-[#8B4513]" />
                </div>

                          {/* Dropdown Menu */}
                          {isDropdownOpen && (
                            <div className="absolute z-50 w-full mt-1 bg-[#FDF6E3] border border-[#8B4513] rounded shadow-lg">
                              {collections.length > 0 ? (
                                <>
                                  {collections.map((collection) => (
                                    <div
                                      key={collection.id}
                                      onClick={() => {
                                        setArticleData({ ...articleData, collection_id: collection.id });
                                        setIsDropdownOpen(false);
                                      }}
                                      className="px-3 py-2 text-sm text-[#3C1810] hover:bg-[#F5E6D3] cursor-pointer"
                                    >
                                      {collection.title}
              </div>
                                  ))}
                                  <div
                                    onClick={() => {
                                      handleCreateNewCollection();
                                      setIsDropdownOpen(false);
                                    }}
                                    className="px-3 py-2 text-sm text-[#8B4513] font-medium hover:bg-[#F5E6D3] cursor-pointer border-t border-[#8B4513]"
                                  >
                                    + Create new collection
            </div>
                                </>
                              ) : (
                                <>
                                  <div className="px-3 py-2 text-sm text-[#8B6B4D] italic">
                                    No collections yet
          </div>
                                  <div
                                    onClick={() => {
                                      handleCreateNewCollection();
                                      setIsDropdownOpen(false);
                                    }}
                                    className="px-3 py-2 text-sm text-[#8B4513] font-medium hover:bg-[#F5E6D3] cursor-pointer border-t border-[#8B4513]"
                                  >
                                    + Create new collection
                                  </div>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                        <p className="text-xs text-[#5C2E0E]">
                          Add your article to a collection in your Help Center to make it discoverable to customers.
                        </p>
                      </div>
                    </div>

                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Collection Creation Modal */}
      {isCreateCollectionModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
          <div className="bg-[#FDF6E3] w-[480px] rounded-lg shadow-lg">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-[#8B4513]">
              <h2 className="text-xl font-semibold text-[#3C1810]">Create collection</h2>
              <button 
                onClick={() => setIsCreateCollectionModalOpen(false)}
                className="text-[#3C1810] hover:bg-[#F5E6D3] p-2 rounded"
              >
                <IconX size={20} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-4">
              {/* Title Input */}
              <div>
                <label className="text-xs text-[#8B6B4D] block mb-1">
                  Title<span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newCollection.title}
                  onChange={(e) => {
                    setCollectionError(null);
                    setNewCollection(prev => ({ ...prev, title: e.target.value }));
                  }}
                  placeholder="e.g. Getting Started"
                  className="w-full px-3 py-2 text-sm text-[#3C1810] bg-[#FDF6E3] border border-[#8B4513] rounded focus:outline-none focus:ring-1 focus:ring-[#8B4513]"
                />
              </div>

              {/* Error Message */}
              {collectionError && (
                <div className={`text-sm ${
                  collectionError.includes('already exists') 
                    ? 'text-[#8B4513]' 
                    : 'text-red-500'
                } bg-[#F5E6D3] p-2 rounded`}>
                  {collectionError}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-[#8B4513] flex justify-end gap-2">
              <button
                onClick={() => setIsCreateCollectionModalOpen(false)}
                className="px-4 py-2 text-[#3C1810] hover:bg-[#F5E6D3] rounded"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveCollection}
                disabled={!newCollection.title}
                className="px-4 py-2 bg-[#8B4513] text-[#FDF6E3] rounded hover:bg-[#5C2E0E] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Create collection
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Error Modal */}
      {errorModal.isOpen && (
        <ErrorModal
          message={errorModal.message}
          onClose={() => setErrorModal({ isOpen: false, message: '' })}
        />
      )}
    </div>
  );
};

export default KnowledgeBase; 