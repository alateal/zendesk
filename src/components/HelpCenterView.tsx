import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import supabase from '../supabase';
import {
  IconChevronDown,
  IconArticle,
  IconPlus,
  IconDotsVertical,
  IconBook,
  IconInbox,
  IconRobot,
  IconChartBar,
  IconSettings,
  IconUser,
  IconX,
  IconMaximize,
  IconLock
} from '@tabler/icons-react';

type CollectionArticle = {
  id: string;
  title: string;
  description: string;
  is_public: boolean;
  is_published: boolean;
};

type Article = {
  id: string;
  title: string;
  description: string;
  content: string;
  is_public: boolean;
  is_published: boolean;
  collection_id: string;
  created_at: string;
  last_updated_at: string | null;
  organizations_id: string;
  enabled_ai: boolean;
  created_by: string;
  last_updated_by: string | null;
};

type Collection = {
  id: string;
  title: string;
  organizations_id: string;
  articles: CollectionArticle[];
};

type SelectedArticle = {
  id: string;
  title: string;
  description: string;
  content?: string;
  is_public: boolean;
  is_published: boolean;
  collection_id: string;
  created_at: string;
  last_updated_at: string | null;
  last_updated_by: string | null;
  created_by: string;
  enabled_ai: boolean;
  collections?: {
    id: string;
    title: string;
  };
};

const generateArticle = async (params: {
  title: string;
  description: string;
  organizationId: string;
  collectionId?: string;
}) => {
  try {
    // Get the current session
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No authentication session');
    }

    const response = await fetch(`${import.meta.env.VITE_API_URL}/ai/generate-enhanced-article`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to generate article');
    }

    const { content } = await response.json();
    return content || '';
  } catch (error) {
    console.error('Error generating article:', error);
    alert(error instanceof Error ? error.message : 'Failed to generate article');
    throw error;
  }
};

const isDefaultTitle = (title: string) => {
  return !title || title === 'Untitled public article';
};

const HelpCenterView = () => {
  const navigate = useNavigate();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<any>(null);
  const [expandedCollections, setExpandedCollections] = useState<{[key: string]: boolean}>({});
  const [selectedNav, setSelectedNav] = useState('knowledge');
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [newConversationsCount, setNewConversationsCount] = useState(0);
  const [selectedSection, setSelectedSection] = useState('help');
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [isArticleModalOpen, setIsArticleModalOpen] = useState(false);
  const [users, setUsers] = useState<Array<{
    id: string;
    display_name: string;
    email: string;
    role_id?: string;
  }>>([]);
  const [isAddDropdownOpen, setIsAddDropdownOpen] = useState(false);
  const [isNewArticleModalOpen, setIsNewArticleModalOpen] = useState(false);
  const [newArticle, setNewArticle] = useState<Article>({
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
    collection_id: ''
  });
  const [isCollectionDropdownOpen, setIsCollectionDropdownOpen] = useState(false);
  const [isNewCollectionModalOpen, setIsNewCollectionModalOpen] = useState(false);
  const [newCollectionTitle, setNewCollectionTitle] = useState('');
  const [existingCollectionMessage, setExistingCollectionMessage] = useState('');
  const [articles, setArticles] = useState<Article[]>([]);
  const [isGeneratingArticle, setIsGeneratingArticle] = useState(false);

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

  // Fetch organization and collections data
  useEffect(() => {
    const fetchData = async () => {
      // First get the organization
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userData } = await supabase
        .from('users')
        .select('organizations_id')
        .eq('id', user.id)
        .single();

      if (!userData?.organizations_id) return;

      // Get organization details
      const { data: orgData } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', userData.organizations_id)
        .single();

      setSelectedOrg(orgData);

      // Get collections with their articles
      const { data: collectionsData } = await supabase
        .from('collections')
        .select(`
          id,
          title,
          organizations_id,
          articles (
            id,
            title,
            description,
            is_public,
            is_published
          )
        `)
        .eq('organizations_id', userData.organizations_id)
        .order('title', { ascending: true });

      if (collectionsData) {
        // Create a Map to ensure unique collections by ID and maintain the latest version
        const uniqueCollections = new Map();
        collectionsData.forEach(collection => {
          uniqueCollections.set(collection.id, collection);
        });

        // Filter for public and published articles
        const collectionsWithPublicArticles = Array.from(uniqueCollections.values())
          .map(collection => ({
            ...collection,
            articles: (collection.articles || [])
              .filter(article => article.is_public && article.is_published)
              .map(article => ({
                id: article.id,
                title: article.title,
                description: article.description || '',
                is_public: article.is_public,
                is_published: article.is_published
              }))
          }))
          .filter(collection => collection.articles.length > 0);
        
        setCollections(collectionsWithPublicArticles);
      }
    };

    fetchData();

    // Set up real-time subscription for collections and articles
    const channel = supabase
      .channel('help_center_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'collections'
        },
        (payload) => {
          // Handle collection changes
          fetchData();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'articles'
        },
        (payload) => {
          // Handle article changes
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Add this to your existing useEffect or create a new one
  useEffect(() => {
    const fetchUsers = async () => {
      const { data: allUsers } = await supabase
        .from('users')
        .select('id, display_name, email, role_id');
      
      if (allUsers) {
        setUsers(allUsers);
      }
    };

    fetchUsers();
  }, []);

  // Add useEffect to keep inbox count updated
  useEffect(() => {
    if (!selectedOrg?.id) return;

    const fetchInboxCount = async () => {
      const { data: activeConversations, error } = await supabase
        .from('conversations')
        .select('id, status')
        .eq('organizations_id', selectedOrg.id)
        .in('status', ['New', 'Active']);

      if (error) {
        console.error('Error fetching inbox count:', error);
        return;
      }

      setNewConversationsCount(activeConversations?.length || 0);
    };

    fetchInboxCount();

    const channel = supabase
      .channel('inbox_count_help')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations',
          filter: `organizations_id=eq.${selectedOrg.id}`
        },
        () => {
          fetchInboxCount();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [selectedOrg?.id]);

  const toggleCollection = (collectionId: string) => {
    setExpandedCollections(prev => ({
      ...prev,
      [collectionId]: !prev[collectionId]
    }));
  };

  const handleArticleClick = (article: CollectionArticle) => {
    const fetchFullArticle = async () => {
      const { data, error } = await supabase
        .from('articles')
        .select(`
          *,
          collections (
            id,
            title
          )
        `)
        .eq('id', article.id)
        .maybeSingle();
      
      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching article:', error);
        return;
      }
      
      if (data) {
        setSelectedArticle(data);
        setIsArticleModalOpen(true);
      }
    };

    fetchFullArticle();
  };

  const handleUpdateArticle = async (publish: boolean = false) => {
    try {
      if (!selectedArticle || !selectedOrg) return;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const articleToUpdate = {
        organizations_id: selectedOrg.id,
        title: selectedArticle.title,
        description: selectedArticle.description,
        content: selectedArticle.content,
        is_public: selectedArticle.is_public,
        is_published: publish,
        last_updated_at: new Date().toISOString(),
        last_updated_by: user.id,
        collection_id: selectedArticle.collection_id,
        enabled_ai: selectedArticle.enabled_ai
      };

      const { data: updatedArticle, error } = await supabase
        .from('articles')
        .update(articleToUpdate)
        .eq('id', selectedArticle.id)
        .select(`
          *,
          collections (
            id,
            title
          )
        `)
        .single();

      if (error) throw error;

      // Store embeddings for all articles
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const embeddingResponse = await fetch(`${import.meta.env.VITE_API_URL}/ai/store-embeddings`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`
          },
          body: JSON.stringify({
            articleId: updatedArticle.id,
            content: updatedArticle.content,
            organizationId: selectedOrg.id
          }),
        });

        if (!embeddingResponse.ok) {
          throw new Error('Failed to store embeddings');
        }
      } catch (error) {
        console.error('Error storing embeddings:', error);
        // Don't throw here, as the article is already saved
      }

      // Update collections state to reflect changes
      setCollections(prev => 
        prev.map(collection => {
          if (collection.id === updatedArticle.collection_id) {
            const existingArticleIndex = collection.articles?.findIndex(a => a.id === updatedArticle.id);
            if (existingArticleIndex >= 0) {
              const updatedArticles = [...(collection.articles || [])];
              updatedArticles[existingArticleIndex] = {
                id: updatedArticle.id,
                title: updatedArticle.title,
                description: updatedArticle.description,
                is_public: updatedArticle.is_public,
                is_published: updatedArticle.is_published
              };
              return { ...collection, articles: updatedArticles };
            }
          }
          return collection;
        })
      );

      // Close the modal after successful update
      setIsArticleModalOpen(false);
      setSelectedArticle(null);

    } catch (error) {
      console.error('Error updating article:', error);
    }
  };

  const handleCreateArticle = async (publish: boolean = false) => {
    try {
      if (!selectedOrg) return;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const articleToCreate = {
        organizations_id: selectedOrg.id,
        title: newArticle.title,
        description: newArticle.description,
        content: newArticle.content,
        is_public: true, // Always public in help center
        is_published: publish,
        created_by: user.id,
        enabled_ai: newArticle.enabled_ai,
        collection_id: newArticle.collection_id || null
      };

      const { data: createdArticle, error } = await supabase
        .from('articles')
        .insert([articleToCreate])
        .select(`
          *,
          collections (
            id,
            title
          )
        `)
        .single();

      if (error) throw error;

      // Store embeddings for all articles
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const embeddingResponse = await fetch(`${import.meta.env.VITE_API_URL}/ai/store-embeddings`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`
          },
          body: JSON.stringify({
            articleId: createdArticle.id,
            content: createdArticle.content,
            organizationId: selectedOrg.id
          }),
        });

        if (!embeddingResponse.ok) {
          throw new Error('Failed to store embeddings');
        }
      } catch (error) {
        console.error('Error storing embeddings:', error);
        // Don't throw here, as the article is already saved
      }

      // Update collections state to reflect changes
      setCollections(prev => 
        prev.map(collection => {
          if (collection.id === createdArticle.collection_id) {
            return {
              ...collection,
              articles: [
                ...(collection.articles || []),
                {
                  id: createdArticle.id,
                  title: createdArticle.title,
                  description: createdArticle.description,
                  is_public: createdArticle.is_public,
                  is_published: createdArticle.is_published
                }
              ]
            };
          }
          return collection;
        })
      );
      
      // Close the modal
      setIsNewArticleModalOpen(false);
      
      // Reset the form
      setNewArticle({
        id: '',
        created_at: new Date().toISOString(),
        organizations_id: selectedOrg.id,
        title: '',
        description: '',
        content: '',
        is_public: true,
        is_published: false,
        last_updated_at: null,
        last_updated_by: null,
        created_by: user.id,
        enabled_ai: false,
        collection_id: ''
      });

    } catch (error) {
      console.error('Error creating article:', error);
    }
  };

  const handleCreateCollection = async () => {
    if (!newCollectionTitle.trim() || !selectedOrg?.id) return;

    // First check if collection already exists (case-insensitive search)
    const { data: existingCollection, error: searchError } = await supabase
      .from('collections')
      .select()
      .eq('organizations_id', selectedOrg.id)
      .ilike('title', newCollectionTitle.trim())
      .single();

    if (searchError && searchError.code !== 'PGRST116') { // PGRST116 means no rows returned
      console.error('Error checking for existing collection:', searchError);
      return;
    }

    if (existingCollection) {
      // Show notification that collection already exists
      setExistingCollectionMessage(`Collection "${newCollectionTitle}" already exists and has been selected`);
      // Use existing collection
      setNewArticle(prev => ({ ...prev, collection_id: existingCollection.id }));
      setSelectedArticle(prev => prev ? { ...prev, collection_id: existingCollection.id } : prev);
      // Don't close the modal yet, let user see the message
    } else {
      // Create new collection
      const { data: newCollection, error: createError } = await supabase
        .from('collections')
        .insert([{ 
          title: newCollectionTitle.trim(), 
          organizations_id: selectedOrg.id 
        }])
        .select()
        .single();

      if (createError) {
        console.error('Error creating collection:', createError);
        return;
      }

      if (newCollection) {
        setNewArticle(prev => ({ ...prev, collection_id: newCollection.id }));
        setSelectedArticle(prev => prev ? { ...prev, collection_id: newCollection.id } : prev);
        setNewCollectionTitle('');
        setIsNewCollectionModalOpen(false);
        setIsCollectionDropdownOpen(false);
      }
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!event.target) return;
      const target = event.target as HTMLElement;
      if (!target.closest('.relative')) {
        setIsAddDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div className="flex h-screen bg-[#FDF6E3]">
      {/* Main Sidebar */}
      <div className="w-16 bg-[#FDF6E3] border-r border-[#8B4513] flex flex-col items-center py-4">
        <div className="mb-8">
          <img src="/favicon.ico" alt="Logo" className="w-8 h-8" />
        </div>

        <div className="flex-1 flex flex-col items-center space-y-4">
          <button
            onClick={() => navigate('/dashboard')}
            className={`p-2 rounded hover:bg-[#F5E6D3] relative ${
              selectedNav === 'inbox' ? 'bg-[#F5E6D3]' : ''
            }`}
          >
            <IconInbox size={24} className="text-[#3C1810]" />
            {newConversationsCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-[#8B4513] text-[#FDF6E3] text-xs rounded-full w-4 h-4 flex items-center justify-center">
                {newConversationsCount}
              </span>
            )}
          </button>

          <button
            onClick={() => navigate('/knowledge')}
            className={`p-2 rounded hover:bg-[#F5E6D3] ${
              selectedNav === 'knowledge' ? 'bg-[#F5E6D3]' : ''
            }`}
          >
            <IconBook size={24} className="text-[#3C1810]" />
          </button>

          <button
            onClick={() => navigate('/agentDali')}
            className={`p-2 rounded hover:bg-[#F5E6D3] ${
              selectedNav === 'ai' ? 'bg-[#F5E6D3]' : ''
            }`}
          >
            <IconRobot size={24} className="text-[#3C1810]" />
          </button>

          <button
            className={`p-2 rounded hover:bg-[#F5E6D3] ${
              selectedNav === 'analytics' ? 'bg-[#F5E6D3]' : ''
            }`}
          >
            <IconChartBar size={24} className="text-[#3C1810]" />
          </button>
        </div>

        <div className="space-y-4">
          <button
            className={`p-2 rounded hover:bg-[#F5E6D3] ${
              selectedNav === 'settings' ? 'bg-[#F5E6D3]' : ''
            }`}
          >
            <IconSettings size={24} className="text-[#3C1810]" />
          </button>

          <button
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            className="p-2 rounded hover:bg-[#F5E6D3]"
          >
            <IconUser size={24} className="text-[#3C1810]" />
          </button>
        </div>
      </div>

      {/* Second Navigation Bar */}
      <div className="w-80 border-r border-[#8B4513] bg-[#FDF6E3]">
        <div className="p-6 border-b border-[#8B4513]">
          <div className="flex items-center justify-between h-9">
            <h2 className="text-xl font-semibold text-[#3C1810]">Knowledge Bar</h2>
          </div>
        </div>

        <div className="space-y-2 p-4">
          <button 
            onClick={() => {
              setSelectedSection('sources');
              navigate('/knowledge');
            }}
            className={`w-full text-left px-3 py-2 rounded text-[#3C1810] hover:bg-[#F5E6D3] flex items-center gap-2 ${
              selectedSection === 'sources' ? 'bg-[#F5E6D3]' : ''
            }`}
          >
            Sources
          </button>
          
          <button 
            onClick={() => {
              setSelectedSection('content');
              navigate('/knowledge?section=content');
            }}
            className={`w-full text-left px-3 py-2 rounded text-[#3C1810] hover:bg-[#F5E6D3] flex items-center gap-2 ${
              selectedSection === 'content' ? 'bg-[#F5E6D3]' : ''
            }`}
          >
            Content
          </button>
          
          <button 
            onClick={() => {
              setSelectedSection('help');
              navigate('/knowledge/help');
            }}
            className={`w-full text-left px-3 py-2 rounded text-[#3C1810] hover:bg-[#F5E6D3] flex items-center gap-2 ${
              selectedSection === 'help' ? 'bg-[#F5E6D3]' : ''
            }`}
          >
            Help Center
          </button>
        </div>
      </div>

      {/* Your existing Help Center content */}
      <div className="flex flex-1 flex-col h-screen">
        {/* Full width header */}
        <div className="p-6 border-b border-[#8B4513]">
          <div className="flex items-center justify-between h-9">
            <h1 className="text-xl font-semibold text-[#3C1810]">
              {selectedOrg?.name} Help Center
            </h1>
          </div>
        </div>

        {/* Content area */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left side - Collections */}
          <div className="w-[500px] border-r border-[#8B4513] overflow-y-auto">
            {/* Collections List with heading and Add button */}
            <div className="p-4">
              {/* Collection Name heading with Add button */}
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-[#5C2E0E]">Collection Name</h3>
                <div className="relative">
                  <button 
                    onClick={() => setIsAddDropdownOpen(!isAddDropdownOpen)}
                    className="px-4 py-1.5 bg-[#8B4513] text-[#FDF6E3] rounded hover:bg-[#5C2E0E] text-sm font-medium transition-colors duration-200 flex items-center gap-2"
                  >
                    Add
                    <IconChevronDown 
                      size={16} 
                      className={`transform transition-transform ${isAddDropdownOpen ? 'rotate-180' : ''}`}
                    />
                  </button>

                  {/* Dropdown Menu */}
                  {isAddDropdownOpen && (
                    <div className="absolute right-0 mt-1 w-48 max-h-[200px] overflow-y-auto bg-[#FDF6E3] border border-[#8B4513] rounded-lg shadow-lg z-10">
                      <button 
                        onClick={() => {
                          setNewArticle({
                            ...newArticle,
                            organizations_id: selectedOrg?.id || '',
                            is_public: true,
                            title: 'Untitled public article'
                          });
                          setIsNewArticleModalOpen(true);
                          setIsAddDropdownOpen(false);
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-[#3C1810] hover:bg-[#F5E6D3] rounded-t-lg flex items-center gap-2"
                      >
                        <IconArticle size={16} className="text-[#8B4513]" />
                        Create an article
                      </button>
                      <button 
                        onClick={() => {
                          setIsNewCollectionModalOpen(true);
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-[#3C1810] hover:bg-[#F5E6D3] rounded-b-lg flex items-center gap-2"
                      >
                        <IconPlus size={16} className="text-[#8B4513]" />
                        Create a collection
                      </button>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Collections */}
              {collections.map((collection) => {
                // Filter for public AND published articles
                const publicArticles = collection.articles?.filter(article => 
                  article.is_public && article.is_published
                ) || [];
                
                return (
                  <div key={collection.id} className="mb-4">
                    <div 
                      className="flex items-center justify-between p-2 hover:bg-[#F5E6D3] rounded cursor-pointer"
                      onClick={() => toggleCollection(collection.id)}
                    >
                      <div className="flex items-center gap-2">
                        <IconArticle size={18} className="text-[#8B4513]" />
                        <span className="text-sm text-[#3C1810]">{collection.title}</span>
                        <span className="text-xs text-[#8B6B4D]">
                          {publicArticles.length} articles
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <IconChevronDown 
                          size={16} 
                          className={`text-[#8B4513] transform transition-transform ${
                            expandedCollections[collection.id] ? 'rotate-180' : ''
                          }`}
                        />
                        <IconDotsVertical size={16} className="text-[#8B4513]" />
                      </div>
                    </div>

                    {/* Articles in collection */}
                    {expandedCollections[collection.id] && publicArticles.length > 0 && (
                      <div className="ml-6 mt-2 space-y-2">
                        {publicArticles.map((article: CollectionArticle) => (
                          <div 
                            key={article.id}
                            onClick={() => handleArticleClick(article)}
                            className="flex items-center gap-2 p-2 hover:bg-[#F5E6D3] rounded cursor-pointer"
                          >
                            <IconArticle size={16} className="text-[#8B6B4D]" />
                            <span className="text-sm text-[#3C1810]">{article.title}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right side - Preview */}
          <div className="flex-1 overflow-y-auto bg-[#FDF6E3] p-8">
            <div className="max-w-4xl mx-auto">
              <div className="flex items-center justify-end mb-4">
                <button
                  onClick={() => navigate('/knowledge/help/preview')}
                  className="px-4 py-1.5 bg-[#8B4513] text-[#FDF6E3] rounded hover:bg-[#5C2E0E] text-sm font-medium transition-colors duration-200"
                >
                  Preview Help Center
                </button>
              </div>

              {/* Preview iframe-like container */}
              <div className="bg-white rounded-lg shadow-lg overflow-hidden">
                {/* Preview Header */}
                <header className="p-6">
                  <div className="container mx-auto">
                    <h1 className="text-4xl font-bold tracking-wider text-center text-[#1a1a1a] mb-12">
                      CHANEL
                    </h1>
                  </div>
                </header>

                {/* Preview Content */}
                <main className="container mx-auto px-4 py-8">
                  <div className="max-w-3xl mx-auto text-center mb-12">
                    <h2 className="text-3xl font-semibold text-[#1a1a1a] mb-8">
                      Advice and answers from the CHANEL Team
                    </h2>
                    
                    {/* Search Bar */}
                    <div className="relative max-w-xl mx-auto">
                      <input
                        type="text"
                        placeholder="Search for articles..."
                        className="w-full px-12 py-3 rounded-full bg-[#f5f5f5] border border-[#e5e5e5] text-[#1a1a1a] placeholder-[#6b6b6b] focus:outline-none focus:ring-2 focus:ring-[#1a1a1a]"
                        disabled
                      />
                      <svg 
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-[#6b6b6b]"
                        width="20" 
                        height="20" 
                        viewBox="0 0 24 24" 
                        fill="none" 
                        stroke="currentColor" 
                        strokeWidth="2" 
                        strokeLinecap="round" 
                        strokeLinejoin="round"
                      >
                        <circle cx="11" cy="11" r="8"></circle>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                      </svg>
                    </div>
                  </div>

                  {/* Collections Preview */}
                  <div className="max-w-3xl mx-auto">
                    <div className="grid grid-cols-1 gap-4">
                      {collections.map((collection) => (
                        <div 
                          key={collection.id}
                          className="bg-[#f5f5f5] rounded-lg p-6"
                        >
                          <div className="flex items-start gap-4">
                            <div className="p-2 bg-white rounded-lg">
                              <svg 
                                className="text-[#1a1a1a]"
                                width="24" 
                                height="24" 
                                viewBox="0 0 24 24" 
                                fill="none" 
                                stroke="currentColor" 
                                strokeWidth="2" 
                                strokeLinecap="round" 
                                strokeLinejoin="round"
                              >
                                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                              </svg>
                            </div>
                            <div>
                              <h3 className="text-lg font-medium text-[#1a1a1a] mb-1">
                                {collection.title}
                              </h3>
                              <p className="text-sm text-[#6b6b6b]">
                                {collection.articles?.filter(article => article.is_public).length || 0} articles
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </main>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Article Modal */}
      {isArticleModalOpen && selectedArticle && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-[#FDF6E3] w-full max-w-5xl h-[90vh] rounded-lg flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-[#8B4513]">
              <h2 className="text-sm font-semibold text-[#3C1810]">
                {selectedArticle.is_public ? 'Public article' : 'Internal article'}
              </h2>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setIsArticleModalOpen(false)}
                  className="px-3 py-1 text-[#3C1810] hover:bg-[#F5E6D3] rounded"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => handleUpdateArticle(false)}
                  className="px-3 py-1 text-[#3C1810] hover:bg-[#F5E6D3] rounded"
                >
                  Save as draft
                </button>
                <button 
                  onClick={() => handleUpdateArticle(true)}
                  className="px-3 py-1 bg-[#8B4513] text-[#FDF6E3] hover:bg-[#5C2E0E] rounded"
                >
                  Publish
                </button>
                <button className="p-2 hover:bg-[#F5E6D3] rounded">
                  <IconMaximize size={20} className="text-[#3C1810]" />
                </button>
                <button 
                  onClick={() => setIsArticleModalOpen(false)}
                  className="p-2 hover:bg-[#F5E6D3] rounded"
                >
                  <IconX size={20} className="text-[#3C1810]" />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="flex flex-1 overflow-hidden">
              {/* Editor Section */}
              <div className="flex-1 overflow-y-auto p-6 border-r border-[#8B4513]">
                <input
                  type="text"
                  value={selectedArticle.title}
                  onChange={(e) => setSelectedArticle({ ...selectedArticle, title: e.target.value })}
                  className="w-full text-3xl font-light text-[#3C1810] bg-transparent border-none outline-none mb-4"
                  placeholder="Article title"
                />
                <input
                  type="text"
                  value={selectedArticle.description}
                  onChange={(e) => setSelectedArticle({ ...selectedArticle, description: e.target.value })}
                  className="w-full text-lg text-[#5C2E0E] bg-transparent border-none outline-none mb-6"
                  placeholder="Describe your article to help it get found"
                />
                <div className="flex items-center justify-end mb-4">
                  <div className="relative">
                    <button
                      onClick={async () => {
                        if (!selectedOrg?.id || !selectedArticle.title) return;
                        
                        if (!selectedArticle.collection_id) {
                          alert('Please select a collection first');
                          return;
                        }
                        
                        if (isDefaultTitle(selectedArticle.title)) {
                          alert('Please enter a title for the article');
                          return;
                        }
                        
                        setIsGeneratingArticle(true);
                        try {
                          const article = await generateArticle({
                            title: selectedArticle.title,
                            description: selectedArticle.description || '',
                            organizationId: selectedOrg.id,
                            collectionId: selectedArticle.collection_id
                          });
                          
                          setSelectedArticle({
                            ...selectedArticle,
                            content: article
                          });
                        } catch (error) {
                          // Error is already handled in generateArticle
                        } finally {
                          setIsGeneratingArticle(false);
                        }
                      }}
                      disabled={isDefaultTitle(selectedArticle.title) || isGeneratingArticle}
                      className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                        isDefaultTitle(selectedArticle.title)
                          ? 'bg-[#D4B69C] text-[#8B4513] cursor-not-allowed hover:bg-[#D4B69C]' 
                          : isGeneratingArticle
                          ? 'bg-[#8B4513] text-[#FDF6E3] opacity-50 cursor-not-allowed'
                          : 'bg-[#8B4513] text-[#FDF6E3] hover:bg-[#5C2E0E]'
                      }`}
                    >
                      <IconRobot size={20} className={isGeneratingArticle ? 'animate-spin' : ''} />
                      {isGeneratingArticle ? 'Generating...' : 'Generate with AI'}
                    </button>
                    
                    {/* Tooltip for disabled state */}
                    {isDefaultTitle(selectedArticle.title) && (
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
                  <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                    <div className="flex items-center bg-[#FDF6E3] border border-[#8B4513] rounded px-2 py-1 shadow-lg">
                      <img src="/favicon.ico" alt="Tooltip" className="w-4 h-4 mr-2" />
                      <span className="text-sm text-[#3C1810]">Ask Agent Dali to write this article for you</span>
                    </div>
                  </div>
                  <textarea
                    value={selectedArticle.content}
                    onChange={(e) => setSelectedArticle({ ...selectedArticle, content: e.target.value })}
                    className="w-full min-h-[500px] text-[#3C1810] bg-transparent border-none outline-none resize-y hover:bg-[#F5E6D3] transition-colors duration-200 p-2 rounded"
                    placeholder="Start writing..."
                  />
                </div>
              </div>

              {/* Details Sidebar */}
              <div className="w-80 flex flex-col overflow-hidden">
                <div className="p-6 border-b border-[#8B4513]">
                  <h3 className="text-base font-semibold text-[#3C1810]">Details</h3>
                </div>
                
                <div className="flex-1 overflow-y-auto p-6">
                  <div className="space-y-4">
                    {/* Data Section */}
                    <div className="text-xs font-medium text-[#5C2E0E]">Data</div>
                    <div>
                      <label className="text-xs text-[#8B6B4D] block mb-1">Type</label>
                      <div className="flex items-center gap-2 text-sm text-[#3C1810] bg-[#F5E6D3] px-3 py-2 rounded">
                        {selectedArticle.is_public ? (
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
                        {selectedArticle.is_published ? 'Published' : 'Draft'}
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-[#8B6B4D] block mb-1">Article ID</label>
                      <div className="text-sm text-[#3C1810]">
                        {selectedArticle.id}
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-[#8B6B4D] block mb-1">Language</label>
                      <div className="text-sm text-[#3C1810]">English</div>
                    </div>
                    <div>
                      <label className="text-xs text-[#8B6B4D] block mb-1">Created</label>
                      <div className="text-sm text-[#3C1810]">
                        {formatDate(selectedArticle.created_at)}
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-[#8B6B4D] block mb-1">Created by</label>
                      <div className="text-sm text-[#3C1810]">
                        {users.find(u => u.id === selectedArticle.created_by)?.display_name || 'Unknown'}
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-[#8B6B4D] block mb-1">Last updated</label>
                      <div className="text-sm text-[#6b6b6b]">
                        {selectedArticle.last_updated_at ? new Date(selectedArticle.last_updated_at).toLocaleDateString() : 'Never'}
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-[#8B6B4D] block mb-1">Last updated by</label>
                      <div className="text-sm text-[#3C1810]">
                        {selectedArticle.last_updated_by ? 
                          users.find(u => u.id === selectedArticle.last_updated_by)?.display_name : ''}
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
                          <span className="text-sm text-[#3C1810]">
                            {selectedArticle.enabled_ai ? 'Enabled' : 'Disabled'}
                          </span>
                          <button 
                            onClick={() => setSelectedArticle({ 
                              ...selectedArticle, 
                              enabled_ai: !selectedArticle.enabled_ai 
                            })}
                            className={`w-10 h-5 rounded-full relative transition-colors duration-200 ease-in-out ${
                              selectedArticle.enabled_ai ? 'bg-[#8B4513]' : 'bg-[#D4B69C]'
                            }`}
                          >
                            <div 
                              className={`w-4 h-4 rounded-full bg-[#FDF6E3] absolute top-0.5 transition-transform duration-200 ease-in-out ${
                                selectedArticle.enabled_ai ? 'translate-x-5' : 'translate-x-0.5'
                              }`}
                            />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Collection Section */}
                    <div className="pt-4 border-t border-[#8B4513]">
                      <div className="text-xs font-medium text-[#5C2E0E] mb-4">Help Center</div>
                      <div className="space-y-2">
                        <label className="text-xs text-[#8B6B4D] block">Collection</label>
                        <div className="relative">
                          <button
                            onClick={() => setIsCollectionDropdownOpen(!isCollectionDropdownOpen)}
                            className="w-full px-3 py-2 text-sm text-[#3C1810] bg-[#F5E6D3] rounded border border-[#8B4513] flex items-center justify-between hover:bg-[#F0D6B3] transition-colors duration-200"
                          >
                            <span>
                              {collections.find(c => c.id === selectedArticle.collection_id)?.title || 'Select collection...'}
                            </span>
                            <IconChevronDown size={16} className="text-[#8B4513]" />
                          </button>
                          
                          {isCollectionDropdownOpen && (
                            <div className="absolute z-50 w-full mt-1 bg-[#FDF6E3] border border-[#8B4513] rounded shadow-lg max-h-48 overflow-y-auto">
                              {collections
                                .filter((collection, index, self) => 
                                  index === self.findIndex(c => c.id === collection.id)
                                )
                                .map(collection => (
                                  <button
                                    key={collection.id}
                                    onClick={() => {
                                      setSelectedArticle(prev => prev ? { ...prev, collection_id: collection.id } : prev);
                                      setIsCollectionDropdownOpen(false);
                                    }}
                                    className="w-full px-3 py-2 text-sm text-[#3C1810] hover:bg-[#F5E6D3] text-left"
                                  >
                                    {collection.title}
                                  </button>
                                ))
                              }
                              <button
                                onClick={() => {
                                  setIsNewCollectionModalOpen(true);
                                }}
                                className="w-full px-3 py-2 text-sm text-[#8B4513] font-medium hover:bg-[#F5E6D3] text-left border-t border-[#8B4513]"
                              >
                                + Create new collection
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Article Modal */}
      {isNewArticleModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-[#FDF6E3] w-full max-w-5xl h-[90vh] rounded-lg flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-[#8B4513]">
              <h2 className="text-sm font-semibold text-[#3C1810]">Public article</h2>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setIsNewArticleModalOpen(false)}
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
                  onClick={() => setIsNewArticleModalOpen(false)}
                  className="p-2 hover:bg-[#F5E6D3] rounded"
                >
                  <IconX size={20} className="text-[#3C1810]" />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="flex flex-1 overflow-hidden">
              {/* Editor Section */}
              <div className="flex-1 overflow-y-auto p-6 border-r border-[#8B4513]">
                <input
                  type="text"
                  value={newArticle.title}
                  onChange={(e) => setNewArticle({ ...newArticle, title: e.target.value })}
                  className="w-full text-3xl font-light text-[#3C1810] bg-transparent border-none outline-none mb-4"
                  placeholder="Article title"
                />
                <input
                  type="text"
                  value={newArticle.description}
                  onChange={(e) => setNewArticle({ ...newArticle, description: e.target.value })}
                  className="w-full text-lg text-[#5C2E0E] bg-transparent border-none outline-none mb-6"
                  placeholder="Describe your article to help it get found"
                />
                <div className="flex items-center justify-end mb-4">
                  <div className="relative">
                    <button
                      onClick={async () => {
                        if (!selectedOrg?.id || !newArticle.title) return;
                        
                        if (!newArticle.collection_id) {
                          alert('Please select a collection first');
                          return;
                        }
                        
                        setIsGeneratingArticle(true);
                        try {
                          const article = await generateArticle({
                            title: newArticle.title,
                            description: newArticle.description || '',
                            organizationId: selectedOrg.id,
                            collectionId: newArticle.collection_id
                          });
                          
                          setNewArticle(prev => ({
                            ...prev,
                            content: article
                          }));
                        } catch (error) {
                          // Error is already handled in generateArticle
                        } finally {
                          setIsGeneratingArticle(false);
                        }
                      }}
                      disabled={isDefaultTitle(newArticle.title) || isGeneratingArticle}
                      className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                        isDefaultTitle(newArticle.title)
                          ? 'bg-[#D4B69C] text-[#8B4513] cursor-not-allowed hover:bg-[#D4B69C]' 
                          : isGeneratingArticle
                          ? 'bg-[#8B4513] text-[#FDF6E3] opacity-50 cursor-not-allowed'
                          : 'bg-[#8B4513] text-[#FDF6E3] hover:bg-[#5C2E0E]'
                      }`}
                    >
                      <IconRobot size={20} className={isGeneratingArticle ? 'animate-spin' : ''} />
                      {isGeneratingArticle ? 'Generating...' : 'Generate with AI'}
                    </button>
                    
                    {/* Tooltip for disabled state */}
                    {isDefaultTitle(newArticle.title) && (
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
                  <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                    <div className="flex items-center bg-[#FDF6E3] border border-[#8B4513] rounded px-2 py-1 shadow-lg">
                      <img src="/favicon.ico" alt="Tooltip" className="w-4 h-4 mr-2" />
                      <span className="text-sm text-[#3C1810]">Click to edit</span>
                    </div>
                  </div>
                  <textarea
                    value={newArticle.content}
                    onChange={(e) => setNewArticle({ ...newArticle, content: e.target.value })}
                    className="w-full min-h-[500px] text-[#3C1810] bg-transparent border-none outline-none resize-y hover:bg-[#F5E6D3] transition-colors duration-200 p-2 rounded"
                    placeholder="Start writing..."
                  />
                </div>
              </div>

              {/* Details Sidebar */}
              <div className="w-80 flex flex-col overflow-hidden">
                <div className="p-6 border-b border-[#8B4513]">
                  <h3 className="text-base font-semibold text-[#3C1810]">Details</h3>
                </div>
                
                <div className="flex-1 overflow-y-auto p-6">
                  <div className="space-y-4">
                    {/* Data Section */}
                    <div className="text-xs font-medium text-[#5C2E0E]">Data</div>
                    <div>
                      <label className="text-xs text-[#8B6B4D] block mb-1">Type</label>
                      <div className="flex items-center gap-2 text-sm text-[#3C1810] bg-[#F5E6D3] px-3 py-2 rounded">
                        <IconArticle size={20} />
                        <span>Public article</span>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-[#8B6B4D] block mb-1">Status</label>
                      <div className="text-sm text-[#3C1810]">
                        Draft
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-[#8B6B4D] block mb-1">Language</label>
                      <div className="text-sm text-[#3C1810]">English</div>
                    </div>
                    <div>
                      <label className="text-xs text-[#8B6B4D] block mb-1">Created</label>
                      <div className="text-sm text-[#3C1810]">
                        {formatDate(newArticle.created_at)}
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-[#8B6B4D] block mb-1">Created by</label>
                      <div className="text-sm text-[#3C1810]">
                        {users.find(u => u.id === newArticle.created_by)?.display_name || 'Unknown'}
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
                          <span className="text-sm text-[#3C1810]">
                            {newArticle.enabled_ai ? 'Enabled' : 'Disabled'}
                          </span>
                          <button 
                            onClick={() => setNewArticle({ 
                              ...newArticle, 
                              enabled_ai: !newArticle.enabled_ai 
                            })}
                            className={`w-10 h-5 rounded-full relative transition-colors duration-200 ease-in-out ${
                              newArticle.enabled_ai ? 'bg-[#8B4513]' : 'bg-[#D4B69C]'
                            }`}
                          >
                            <div 
                              className={`w-4 h-4 rounded-full bg-[#FDF6E3] absolute top-0.5 transition-transform duration-200 ease-in-out ${
                                newArticle.enabled_ai ? 'translate-x-5' : 'translate-x-0.5'
                              }`}
                            />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Collection Section */}
                    <div className="pt-4 border-t border-[#8B4513]">
                      <div className="text-xs font-medium text-[#5C2E0E] mb-4">Help Center</div>
                      <div className="space-y-2">
                        <label className="text-xs text-[#8B6B4D] block">Collection</label>
                        <div className="relative">
                          <button
                            onClick={() => setIsCollectionDropdownOpen(!isCollectionDropdownOpen)}
                            className="w-full px-3 py-2 text-sm text-[#3C1810] bg-[#F5E6D3] rounded border border-[#8B4513] flex items-center justify-between hover:bg-[#F0D6B3] transition-colors duration-200"
                          >
                            <span>
                              {collections.find(c => c.id === newArticle.collection_id)?.title || 'Select collection...'}
                            </span>
                            <IconChevronDown size={16} className="text-[#8B4513]" />
                          </button>
                          
                          {isCollectionDropdownOpen && (
                            <div className="absolute z-50 w-full mt-1 bg-[#FDF6E3] border border-[#8B4513] rounded shadow-lg max-h-48 overflow-y-auto">
                              {collections
                                .filter((collection, index, self) => 
                                  index === self.findIndex(c => c.id === collection.id)
                                )
                                .map(collection => (
                                  <button
                                    key={collection.id}
                                    onClick={() => {
                                      setNewArticle({ ...newArticle, collection_id: collection.id });
                                      setIsCollectionDropdownOpen(false);
                                    }}
                                    className="w-full px-3 py-2 text-sm text-[#3C1810] hover:bg-[#F5E6D3] text-left"
                                  >
                                    {collection.title}
                                  </button>
                                ))
                              }
                              <button
                                onClick={() => {
                                  setIsNewCollectionModalOpen(true);
                                }}
                                className="w-full px-3 py-2 text-sm text-[#8B4513] font-medium hover:bg-[#F5E6D3] text-left border-t border-[#8B4513]"
                              >
                                + Create new collection
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Collection Modal */}
      {isNewCollectionModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-[#FDF6E3] w-full max-w-md rounded-lg">
            <div className="flex items-center justify-between p-4 border-b border-[#8B4513]">
              <h2 className="text-2xl font-medium text-[#3C1810]">Create collection</h2>
              <button 
                onClick={() => {
                  setIsNewCollectionModalOpen(false);
                  setExistingCollectionMessage('');
                }}
                className="p-2 hover:bg-[#F5E6D3] rounded"
              >
                <IconX size={20} className="text-[#3C1810]" />
              </button>
            </div>
            
            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-[#3C1810] block mb-2">Title<span className="text-[#8B4513]">*</span></label>
                  <input
                    type="text"
                    value={newCollectionTitle}
                    onChange={(e) => {
                      setNewCollectionTitle(e.target.value);
                      setExistingCollectionMessage('');
                    }}
                    placeholder="e.g. Getting Started"
                    className="w-full px-3 py-2 text-sm text-[#3C1810] bg-[#FDF6E3] border border-[#8B4513] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#8B4513] placeholder-[#8B6B4D]"
                    autoFocus
                  />
                </div>
                {existingCollectionMessage && (
                  <div className="bg-[#F5E6D3] text-[#8B4513] px-3 py-2 rounded-lg text-sm">
                    {existingCollectionMessage}
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex items-center justify-end gap-2 p-4 border-t border-[#8B4513]">
              <button 
                onClick={() => {
                  setIsNewCollectionModalOpen(false);
                  setExistingCollectionMessage('');
                }}
                className="px-4 py-2 text-base text-[#3C1810] hover:bg-[#F5E6D3] rounded-lg"
              >
                Cancel
              </button>
              <button 
                onClick={handleCreateCollection}
                className="px-4 py-2 text-base bg-[#8B4513] text-[#FDF6E3] hover:bg-[#5C2E0E] rounded-lg"
              >
                Create collection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HelpCenterView; 