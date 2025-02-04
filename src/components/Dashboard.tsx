import { useState, useEffect, useRef } from 'react';
import {
  IconInbox,
  IconBook,
  IconBrandSlack,
  IconMail,
  IconRobot,
  IconChartBar,
  IconSend,
  IconPlus,
  IconSearch,
  IconDotsVertical,
  IconSettings,
  IconStarFilled,
  IconStar,
  IconChevronDown,
  IconCheck,
  IconUser,
  IconX,
  IconUsers,
  IconTag,
  IconBuilding,
  IconCalendar,
  IconStatusChange,
  IconCategory
} from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import supabase from '../supabase';

type Organization = {
  id: string;
  name: string;
  logoUrl: string;
  created_at: string;
};

type Message = {
  id: string;
  content: string;
  sender_id: string;
  sender_type: string;
  created_at: string;
  conversations_id: string;
};

type Customer = {
  id: string;
  full_name: string;
  email: string;
};

type Conversation = {
  id: string;
  created_at: string;
  organizations_id: string;
  channels: string;
  status: string;
  satisfaction_score?: string;
  is_important: boolean;
  customer_id?: string;
  assigned_to?: string;
  customer_name?: string;
  latest_message?: Message;
  customers?: Customer;
  messages?: Message[];
};

// Add this type for insights
type InsightType = {
  label: string;
  value: string | number;
  icon: React.ReactNode;
};

// Add type for response time stats
type ResponseTimeStats = {
  averageResponseTime: number; // in minutes
  totalResponses: number;
};

// Add type for User
type User = {
  id: string;
  display_name: string;
  email: string;
  role_id: string;
};

const Dashboard = () => {
  const navigate = useNavigate();
  const [selectedNav, setSelectedNav] = useState('inbox');
  const [selectedApp, setSelectedApp] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [newConversationsCount, setNewConversationsCount] = useState(0);
  const [satisfactionStats, setSatisfactionStats] = useState({
    averageScore: 0,
    totalRatings: 0
  });
  const [responseTimeStats, setResponseTimeStats] = useState<ResponseTimeStats>({
    averageResponseTime: 0,
    totalResponses: 0
  });
  const [users, setUsers] = useState<User[]>([]);
  const [isAssigneeOpen, setIsAssigneeOpen] = useState(false);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileDropdownRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAssignee, setSelectedAssignee] = useState<string | null>(null);
  const [isAssigneeFilterOpen, setIsAssigneeFilterOpen] = useState(false);
  const assigneeFilterRef = useRef<HTMLDivElement>(null);
  const [filteredConversations, setFilteredConversations] = useState<Conversation[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [isStatusFilterOpen, setIsStatusFilterOpen] = useState(false);
  const statusFilterRef = useRef<HTMLDivElement>(null);
  const [overlayConversations, setOverlayConversations] = useState<Conversation[]>([]);
  const [selectedPriority, setSelectedPriority] = useState<boolean | null>(null);
  const [isPriorityFilterOpen, setIsPriorityFilterOpen] = useState(false);
  const priorityFilterRef = useRef<HTMLDivElement>(null);

  // Add click outside handler
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsAssigneeOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Check authentication when component mounts
  useEffect(() => {
    checkUser();
  }, []); // Empty dependency array means this runs once when component mounts

  // Function to check if user is authenticated
  const checkUser = async () => {
    // Get the current session from Supabase
    const { data: { session } } = await supabase.auth.getSession();
    
    // If no session exists, redirect to sign in page
    if (!session) {
      navigate('/signin');
      return;
    }

    // Optional: You can store the user data in state if needed
    // const user = session.user;
    // setUser(user);
  };

  // Handle sign out
  const handleSignOut = async () => {
    // Sign out from Supabase
    await supabase.auth.signOut();
    // Redirect to sign in page
    navigate('/signin');
  };

  // Function to load initial messages
  const loadMessages = async (conversationId: string) => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversations_id', conversationId)  // Filter by conversation_id instead of organizations_id
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error loading messages:', error);
        return;
      }

      if (data) setMessages(data);
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  // Set up real-time subscription when conversation changes
  useEffect(() => {
    if (!selectedApp || !selectedOrg) {
      return;
    }

    // Load initial messages
    loadMessages(selectedApp);

    // Set up real-time subscription without filter
    const channel = supabase
      .channel(`messages-${selectedApp}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages'
        },
        (payload) => {
          // Check organization ID in the handler
          if (payload.new && 
              payload.new.organizations_id === selectedOrg && 
              payload.new.conversations_id === selectedApp) {
          const newMessage = payload.new as Message;
          setMessages((current) => [...current, newMessage]);
          }
        }
      )
      .subscribe();

    // Cleanup subscription
    return () => {
      channel.unsubscribe();
    };
  }, [selectedApp, selectedOrg]);

  // Function to send message
  const sendMessage = async () => {
    if (!message.trim() || !selectedApp) return;

    try {
      const { error } = await supabase
        .from('messages')
        .insert([{
          content: message,
          sender_id: 'agent',
          conversations_id: selectedApp,
          organizations_id: selectedOrg,
          sender_type: 'user'
        }]);

      if (error) throw error;

      // Clear input after successful send
      setMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  // Helper function to get current conversation title
  const getCurrentConversationTitle = () => {
    const currentConversation = conversations.find(conv => conv.id === selectedApp);
    return currentConversation?.channels || 'New Chat';
  };

  useEffect(() => {
    const fetchOrganizations = async () => {
      setIsLoading(true);
      try {
        const { data: orgs, error } = await supabase
          .from('organizations')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (error) {
          console.error('Error fetching organizations:', error);
          return;
        }
        
        if (orgs && orgs.length > 0) {
          setOrganizations(orgs);
          if (!selectedOrg) {
            setSelectedOrg(orgs[0].id);
          }
        }
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchOrganizations();
  }, []);

  // Add getCurrentUser function near the top
  const getCurrentUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    } catch (error) {
      console.error('Error getting current user:', error);
      return null;
    }
  };

  // Update the fetchConversations function
  const fetchConversations = async () => {
    try {
      // Get current user
      const currentUser = await getCurrentUser();
      if (!currentUser) return;

      // Build the query
      let query = supabase
        .from('conversations')
        .select(`
          id,
          created_at,
          organizations_id,
          channels,
          status,
          satisfaction_score,
          is_important,
          customer_id,
          assigned_to,
          customers!conversations_customer_id_fkey (
            id,
            full_name,
            email
          ),
          messages!messages_conversations_id_fkey (
            id,
            content,
            sender_id,
            sender_type,
            created_at,
            conversations_id
          )
        `)
        .eq('organizations_id', selectedOrg)
        .not('status', 'eq', 'AI_Chat')  // Filter out AI_Chat conversations
        .order('is_important', { ascending: false })
        .order('created_at', { ascending: false });

      const { data: conversationsData, error: conversationsError } = await query;

      if (conversationsError) throw conversationsError;

      if (conversationsData && conversationsData.length > 0) {
        const conversationsWithMessages = conversationsData.map(conv => {
          const messages = conv.messages || [];
          const sortedMessages = messages.sort((a, b) => 
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );
          
          const latestMessage = sortedMessages[sortedMessages.length - 1];

          return {
            ...conv,
            customer_name: conv.customers?.full_name || 'Unknown Customer',
            latest_message: latestMessage,
            customers: conv.customers,
            messages: sortedMessages
          } as Conversation;
        });

        setConversations(conversationsWithMessages);
      }
    } catch (error) {
      console.error('Error fetching conversations:', error);
    }
  };

  useEffect(() => {
    if (!selectedOrg) {
      return;
    }

    fetchConversations();

    // Set up real-time subscription
    const channel = supabase.channel(`org-${selectedOrg}`)
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all events
          schema: 'public',
          table: 'conversations'
        },
        (payload) => {
          if (payload.new && payload.new.organizations_id === selectedOrg) {
            fetchConversations();
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages'
        },
        (payload) => {
          if (payload.new && payload.new.organizations_id === selectedOrg) {
            fetchConversations();
          }
        }
      );

    // Subscribe and handle connection status
    channel.subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [selectedOrg, currentUserRole]); // Add currentUserRole to dependencies

  // Add this function
  const refreshSession = async () => {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) {
      console.error('Error refreshing session:', error);
      return null;
    }
    if (!session) {
      return null;
    }
    return session;
  };

  // Update createNewConversation
  const createNewConversation = async () => {
    try {
      // Refresh session first
      const session = await refreshSession();
      if (!session) {
        navigate('/signin');
        return;
      }

      const { data: userData, error: authError } = await supabase.auth.getUser();

      if (authError) {
        console.error('Auth error:', authError);
        return;
      }

      if (!selectedOrg || !userData?.user?.id) {
        console.error('Missing required data:', { 
          selectedOrg, 
          userId: userData?.user?.id 
        });
        return;
      }

      // Create conversation
      const { data: conversationData, error: conversationError } = await supabase
        .from('conversations')
        .insert([
          {
            organizations_id: selectedOrg,
            channels: 'chat',
            status: 'active'
          }
        ])
        .select('*')
        .single();

      if (conversationError) {
        console.error('Error creating conversation:', conversationError);
        return;
      }

      if (conversationData) {
        // Create initial message
        const { data: messageData, error: messageError } = await supabase
          .from('messages')
          .insert([
            {
              conversations_id: conversationData.id,
              organizations_id: selectedOrg,
              content: 'Conversation started',
              sender_id: userData.user.id,
              sender_name: userData.user.email || 'System',
              sender_type: 'system'
            }
          ])
          .select('*')
          .single();

        if (messageError) {
          console.error('Error creating initial message:', messageError);
          return;
        }

        // Select the new conversation
        setSelectedApp(conversationData.id);
        
        // Trigger a refresh of conversations
        await fetchConversations();
      }
    } catch (error) {
      console.error('Error in createNewConversation:', error);
    }
  };

  // Add this function to get the current conversation
  const getCurrentConversation = () => {
    return conversations.find(conv => conv.id === selectedApp);
  };

  // Add this function to get insights for the current conversation
  const getConversationInsights = (): InsightType[] => {
    const conversation = getCurrentConversation();
    return [
      {
        label: 'Channel',
        value: conversation?.channels || '-',
        icon: <IconBrandSlack size={20} />
      },
      {
        label: 'Status',
        value: conversation?.status || '-',
        icon: <IconInbox size={20} />
      },
      {
        label: 'Messages',
        value: messages.length,
        icon: <IconMail size={20} />
      }
    ];
  };

  // Add this function to handle status updates
  const updateConversationStatus = async (conversationId: string, status: string) => {
    try {
      const { error } = await supabase
        .from('conversations')
        .update({ status })
        .eq('id', conversationId);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating conversation status:', error);
    }
  };

  // Add useEffect for real-time status updates
  useEffect(() => {
    const channel = supabase
      .channel('conversation-status')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'conversations',
          filter: `organizations_id=eq.${selectedOrg}`
        },
        (payload) => {
          // Only update if the conversation is not in AI_Chat status
          if (payload.new.status !== 'AI_Chat') {
            setConversations(current =>
              current.map(conv =>
                conv.id === payload.new.id
                  ? { ...conv, status: payload.new.status }
                  : conv
              )
            );
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [selectedOrg]);

  // Update the conversation click handler
  const handleConversationClick = async (conversationId: string) => {
    setSelectedApp(conversationId);
    loadMessages(conversationId);

    // Get the conversation
    const conversation = conversations.find(conv => conv.id === conversationId);
    
    // If the conversation is new, update its status to active
    if (conversation?.status === 'New') {
      try {
        const { error } = await supabase
          .from('conversations')
          .update({ status: 'Active' })
          .eq('id', conversationId);

        if (error) throw error;
      } catch (error) {
        console.error('Error updating conversation status:', error);
      }
    }
  };

  // Update the close conversation handler
  const handleCloseConversation = async () => {
    if (!selectedApp) return;
    
    try {
      await updateConversationStatus(selectedApp, 'Closed');
      setSelectedApp(null); // Clear the selection
      setMessages([]); // Clear the messages
    } catch (error) {
      console.error('Error closing conversation:', error);
    }
  };

  // Add useEffect to count new conversations
  useEffect(() => {
    const fetchInboxCount = async () => {
      if (!selectedOrg) return;

      const { data: activeConversations, error } = await supabase
        .from('conversations')
        .select('id, status')
        .eq('organizations_id', selectedOrg)
        .in('status', ['New', 'Active']);

      if (error) {
        console.error('Error fetching inbox count:', error);
        return;
      }

      setNewConversationsCount(activeConversations.length);
    };

    fetchInboxCount();

    // Set up real-time subscription for count updates
    const channel = supabase
      .channel('inbox_count')
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

  // Update the useEffect for real-time conversation updates
  useEffect(() => {
    if (!selectedOrg) return;

    // Initial fetch of conversations is already handled

    // Set up real-time subscription for conversation changes
    const channel = supabase
      .channel('conversations_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations',
          filter: `organizations_id=eq.${selectedOrg}`
        },
        async (payload) => {
          // Fetch updated conversation data
          const { data: updatedConversation } = await supabase
            .from('conversations')
            .select(`
              *,
              customers!conversations_customer_id_fkey (
                id,
                full_name,
                email
              ),
              messages!messages_conversations_id_fkey (
                id,
                content,
                sender_id,
                sender_type,
                created_at,
                conversations_id
              )
            `)
            .eq('id', payload.new.id)
            .single();

          if (updatedConversation) {
            setConversations(prevConversations => {
              const index = prevConversations.findIndex(c => c.id === payload.new.id);
              if (index >= 0) {
                // Update existing conversation
                const newConversations = [...prevConversations];
                newConversations[index] = {
                  ...newConversations[index],
                  ...updatedConversation,
                  satisfaction_score: payload.new.satisfaction_score // Ensure this gets updated
                };
                return newConversations;
              } else {
                // Add new conversation
                return [...prevConversations, updatedConversation];
              }
            });

            // Update satisfaction stats when a rating changes
            if (payload.new.satisfaction_score) {
              setSatisfactionStats(prevStats => {
                const allConversations = conversations.map(conv => 
                  conv.id === payload.new.id ? 
                    { ...conv, satisfaction_score: payload.new.satisfaction_score } : 
                    conv
                );
                return calculateSatisfactionStats(allConversations);
              });
            }
          }
        }
      )
      .subscribe();

    // Cleanup subscription
    return () => {
      channel.unsubscribe();
    };
  }, [selectedOrg]);

  // Update the calculateSatisfactionStats function to be more robust
  const calculateSatisfactionStats = (conversations: Conversation[]) => {
    const ratedConversations = conversations.filter(conv => 
      conv.satisfaction_score !== null && 
      conv.satisfaction_score !== undefined &&
      conv.satisfaction_score !== ''
    );
    
    const totalRatings = ratedConversations.length;
    
    if (totalRatings === 0) return { averageScore: 0, totalRatings: 0 };
    
    const sum = ratedConversations.reduce((acc, conv) => {
      const score = parseFloat(conv.satisfaction_score || '0');
      return acc + (isNaN(score) ? 0 : score);
    }, 0);
    
    return {
      averageScore: Math.round((sum / totalRatings) * 10) / 10,
      totalRatings
    };
  };

  // Update useEffect for real-time satisfaction updates
  useEffect(() => {
    if (!selectedOrg) return;

    // Subscribe to conversation updates
    const channel = supabase
      .channel('conversation-ratings')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'conversations',
          filter: `organizations_id=eq.${selectedOrg}`
        },
        (payload) => {
          // Fetch fresh data when a rating is updated
          fetchConversations();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [selectedOrg]);

  // Update satisfaction stats when conversations change
  useEffect(() => {
    setSatisfactionStats(calculateSatisfactionStats(conversations));
  }, [conversations]);

  // Add function to calculate response time
  const calculateResponseTime = (conversations: Conversation[]) => {
    let totalTime = 0;
    let responseCount = 0;

    conversations.forEach(conv => {
      if (!conv.messages) return;
      
      const sortedMessages = [...conv.messages].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );

      for (let i = 0; i < sortedMessages.length - 1; i++) {
        const currentMsg = sortedMessages[i];
        const nextMsg = sortedMessages[i + 1];

        if (currentMsg.sender_type === 'customer' && nextMsg.sender_type === 'user') {
          const timeDiff = new Date(nextMsg.created_at).getTime() - new Date(currentMsg.created_at).getTime();
          totalTime += timeDiff;
          responseCount++;
        }
      }
    });

    return {
      averageResponseTime: responseCount > 0 ? Math.floor(totalTime / responseCount / 60000) : 0, // Convert to minutes
      totalResponses: responseCount
    };
  };

  // Update useEffect to calculate response time when conversations change
  useEffect(() => {
    setResponseTimeStats(calculateResponseTime(conversations));
  }, [conversations]);

  // Add toggle importance function
  const toggleImportance = async (conversationId: string, currentValue: boolean) => {
    try {
      const { error } = await supabase
        .from('conversations')
        .update({ is_important: !currentValue })
        .eq('id', conversationId);

      if (error) throw error;
    } catch (error) {
      console.error('Error toggling importance:', error);
    }
  };

  // Update the useEffect for fetching users
  useEffect(() => {
    if (selectedOrg) {
      fetchUsers();
    }
  }, [selectedOrg]); // Fetch users when organization changes

  // Remove the users fetch from handleAssigneeClick
  const handleAssigneeClick = () => {
    setIsAssigneeOpen(!isAssigneeOpen);
  };

  // Update the fetchUsers function
  const fetchUsers = async () => {
    try {
      const { data: usersData, error } = await supabase
        .from('users')
        .select(`
          id,
          display_name,
          email,
          role_id
        `)
        .order('display_name');

      if (error) throw error;
      
      setUsers(usersData || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  // Update the checkUserRole function with logging
  const checkUserRole = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return;

      const { data: userData, error } = await supabase
        .from('users')
        .select('role_id')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      
      setCurrentUserRole(userData?.role_id || null);
    } catch (error) {
      console.error('Error checking user role:', error);
    }
  };

  // Add useEffect to check role when component mounts
  useEffect(() => {
    checkUserRole();
  }, []);

  // Update the handleAssign function to ensure UI updates
  const handleAssign = async (userId: string | null) => {
    if (!selectedApp) return;

    try {
      const { error } = await supabase
        .from('conversations')
        .update({ 
          assigned_to: userId,
          is_assigned: userId !== null  // Set is_assigned based on whether there's an assignee
        })
        .eq('id', selectedApp);

      if (error) throw error;

      // Close the dropdown after successful assignment
      setIsAssigneeOpen(false);
    } catch (error) {
      console.error('Error assigning conversation:', error);
      alert('Failed to assign conversation');
    }
  };

  // Add useEffect for profile dropdown click outside handler
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

  // Update the profile dropdown to handle async user data
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Add useEffect to fetch current user when component mounts
  useEffect(() => {
    const fetchCurrentUser = async () => {
      const user = await getCurrentUser();
      setCurrentUser(user);
    };
    fetchCurrentUser();
  }, []);

  // Update getOverlayConversations to handle search properly
  const getOverlayConversations = async (searchQuery: string, assigneeId: string | null, status: string | null, priority: boolean | null) => {
    try {
      if (!selectedOrg) {
        console.log('No organization selected');
        return;
      }

      // If there's no filter and no search query, don't show anything
      if (!searchQuery && !assigneeId && !status && priority === null) {
        setOverlayConversations([]);
        return;
      }

      let supabaseQuery = supabase
        .from('conversations')
        .select(`
          id,
          created_at,
          organizations_id,
          channels,
          status,
          assigned_to,
          is_important,
          customers (
            id,
            full_name,
            email
          ),
          messages (
            id,
            content,
            sender_type,
            created_at
          )
        `)
        .eq('organizations_id', selectedOrg);

      // Apply filters if they exist
      if (assigneeId) {
        supabaseQuery = supabaseQuery.eq('assigned_to', assigneeId);
      } else if (status) {
        supabaseQuery = supabaseQuery.eq('status', status);
      } else if (priority !== null) {
        supabaseQuery = supabaseQuery.eq('is_important', priority);
      }

      const { data, error } = await supabaseQuery;

      if (error) throw error;

      // Filter by search query if it exists
      let filteredData = data || [];
      if (searchQuery.trim()) {
        const searchLower = searchQuery.toLowerCase();
        filteredData = filteredData.filter(conv => {
          // Search in customer name
          const customerMatch = conv.customers?.full_name?.toLowerCase().includes(searchLower);
          
          // Search in messages
          const messageMatch = conv.messages?.some(msg => 
            msg.content?.toLowerCase().includes(searchLower)
          );

          return customerMatch || messageMatch;
        });
      }

      setOverlayConversations(filteredData);
    } catch (error) {
      console.error('Error fetching overlay conversations:', error);
      setOverlayConversations([]);
    }
  };

  // Add handler for priority selection
  const handlePrioritySelect = async (isPriority: boolean) => {
    const newPriority = selectedPriority === isPriority ? null : isPriority;
    setSelectedPriority(newPriority);
    setSelectedAssignee(null);
    setSelectedStatus(null);
    setIsPriorityFilterOpen(false);
    await getOverlayConversations(searchQuery, null, null, newPriority);
  };

  // Update other handlers to include priority parameter
  const handleAssigneeSelect = async (userId: string) => {
    const newAssignee = selectedAssignee === userId ? null : userId;
    setSelectedAssignee(newAssignee);
    setSelectedStatus(null);
    setSelectedPriority(null);
    setIsAssigneeFilterOpen(false);
    await getOverlayConversations(searchQuery, newAssignee, null, null);
  };

  const handleStatusSelect = async (status: string) => {
    const newStatus = selectedStatus === status ? null : status;
    setSelectedStatus(newStatus);
    setSelectedAssignee(null);
    setSelectedPriority(null);
    setIsStatusFilterOpen(false);
    await getOverlayConversations(searchQuery, null, newStatus, null);
  };

  // Update the Priority filter button in the search overlay
  <div className="relative" ref={priorityFilterRef}>
    <button 
      onClick={() => setIsPriorityFilterOpen(!isPriorityFilterOpen)}
      className={`px-3 py-1.5 text-sm text-[#3C1810] hover:bg-[#F5E6D3] rounded-lg flex items-center gap-1 ${
        selectedPriority !== null ? 'bg-[#F5E6D3] border border-[#8B4513]' : ''
      }`}
    >
      <IconStar size={16} />
      Priority
    </button>
    
    {isPriorityFilterOpen && (
      <div className="absolute top-full left-0 mt-1 w-40 bg-[#FDF6E3] border border-[#8B4513] rounded-lg shadow-lg z-[1000]">
        <div className="p-2 space-y-1">
          {[
            { label: 'Priority', value: true },
            { label: 'Non-Priority', value: false }
          ].map((option) => (
            <button
              key={option.label}
              onClick={() => handlePrioritySelect(option.value)}
              className={`w-full px-3 py-2 text-left text-sm rounded-lg flex items-center justify-between ${
                selectedPriority === option.value 
                  ? 'bg-[#F5E6D3] text-[#3C1810]' 
                  : 'text-[#3C1810] hover:bg-[#F5E6D3]'
              }`}
            >
              {option.label}
              {selectedPriority === option.value && (
                <IconCheck size={16} className="text-[#8B4513]" />
              )}
            </button>
          ))}
        </div>
      </div>
    )}
  </div>

  // In the messages section of the conversation detail
  const renderMessages = (messages: any[]) => {
    return messages.map((msg, index) => (
      <div
        key={`${msg.id}-${index}`}
        className={`mb-4 flex ${
          msg.sender_type === 'customer' ? 'justify-end' : 'justify-start'
        }`}
      >
        <div
          className={`max-w-[70%] ${
            msg.sender_type === 'customer' ? 'ml-auto' : 'mr-auto'
          }`}
        >
          {/* Sender Label */}
          <div className={`text-xs mb-1 text-[#5C2E0E] ${
            msg.sender_type === 'customer' ? 'text-right' : 'text-left'
          }`}>
            {msg.sender_type === 'customer' ? 'Customer' :
             msg.sender_type === 'agent' && msg.sender_id === 'ai-agent' ? 'Agent Dali' :
             msg.sender_type === 'system' ? 'System' : 'Agent'}
          </div>

          {/* Message Content */}
          <div className={`rounded-lg p-3 ${
            msg.sender_type === 'customer'
              ? 'bg-[#F5E6D3] text-[#3C1810] border border-[#8B4513]'
              : 'bg-[#FFFFFF] text-[#3C1810] border border-[#8B4513]'
          }`}>
            <p>{msg.content}</p>
          </div>

          {/* Timestamp */}
          <div className={`text-xs mt-1 text-[#5C2E0E] opacity-75 ${
            msg.sender_type === 'customer' ? 'text-right' : 'text-left'
          }`}>
            {new Date(msg.created_at).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit'
            })}
          </div>
        </div>
      </div>
    ));
  };

  return (
    <div className="flex h-screen bg-[#FDF6E3]">
      {/* Main Sidebar */}
      <div className="w-16 bg-[#FDF6E3] border-r border-[#8B4513] flex flex-col items-center py-4">
        {/* Logo Section - Simplified */}
        <div className="mb-8">
          <img src="/favicon.ico" alt="Logo" className="w-8 h-8" />
        </div>
        
        {/* Rest of the sidebar navigation */}
        <nav className="flex flex-col space-y-4 flex-1">
          <button
            onClick={() => {
              setSelectedNav('inbox');
              setIsSearchOpen(false);
              setSearchQuery('');
              setSelectedAssignee(null);
              setSelectedStatus(null);
            }}
            className={`p-2 rounded-lg relative ${
              selectedNav === 'inbox' ? 'text-[#8B4513] bg-[#F5E6D3]' : 'text-[#3C1810] hover:bg-[#F5E6D3]'
            }`}
          >
            <IconInbox size={20} />
            {/* Always show the count badge */}
            {newConversationsCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-[#8B4513] text-[#FDF6E3] text-xs w-4 h-4 flex items-center justify-center rounded-full">
                {conversations.filter(conv => 
                  conv.status === 'New' || conv.status === 'Active'
                ).length}
              </span>
            )}
          </button>
          
          <button
            onClick={() => navigate('/knowledge')}
            className={`p-2 rounded-lg ${
              selectedNav === 'knowledge'
                ? 'bg-[#8B4513] text-[#FDF6E3]'
                : 'text-[#3C1810] hover:bg-[#F5E6D3]'
            }`}
          >
            <IconBook size={24} />
          </button>

          <button
            onClick={() => navigate('/agentDali')}
            className={`p-2 rounded-lg ${
              selectedNav === 'ai'
                ? 'bg-[#8B4513] text-[#FDF6E3]'
                : 'text-[#3C1810] hover:bg-[#F5E6D3]'
            }`}
          >
            <IconRobot size={24} />
          </button>

          <button
            onClick={() => setSelectedNav('reports')}
            className={`p-2 rounded-lg ${
              selectedNav === 'reports'
                ? 'bg-[#8B4513] text-[#FDF6E3]'
                : 'text-[#3C1810] hover:bg-[#F5E6D3]'
            }`}
          >
            <IconChartBar size={24} />
          </button>
        </nav>

        <div className="mt-auto flex flex-col space-y-4 items-center">
          <button
            onClick={() => setSelectedNav('settings')}
            className={`p-2 rounded-lg ${
              selectedNav === 'settings'
                ? 'bg-[#8B4513] text-[#FDF6E3]'
                : 'text-[#3C1810] hover:bg-[#F5E6D3]'
            }`}
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

            {/* Profile Dropdown - Updated positioning */}
            {isProfileOpen && (
              <div className="fixed bottom-3 left-16 w-64 bg-white border border-[#8B4513] rounded-lg shadow-lg z-20">
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
                  <button className="w-12 h-6 rounded-full bg-gray-200 relative">
                    <div className="w-5 h-5 rounded-full bg-white absolute left-0.5 top-0.5 shadow"></div>
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

      {/* New Secondary Navigation */}
      <div className="w-64 border-r border-[#8B4513] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-[#8B4513]">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[#3C1810]">Inbox</h2>
            <button 
              onClick={() => setIsSearchOpen(true)}
              className="p-2 rounded-lg text-[#3C1810] hover:bg-[#F5E6D3]"
            >
              <IconSearch size={20} />
            </button>
          </div>
        </div>

        {/* Add Search Overlay */}
        {isSearchOpen && (
          <div 
            className="fixed bg-[#FDF6E3] z-[20] border-l border-[#8B4513]"
            style={{ 
              left: '320px', // Width of main sidebar (64px) + secondary nav (256px)
              width: 'calc(100% - 320px)', // Full width minus the sidebars
              top: 0,
              bottom: 0,
              position: 'absolute',
              borderLeft: 'none' // Remove right border to prevent double border
            }}
          >
            {/* Search Header */}
            <div className="p-6 border-b border-[#8B4513]">
              <div className="flex items-center gap-4">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    autoFocus
                    value={searchQuery}
                    onChange={(e) => {
                      const value = e.target.value;
                      setSearchQuery(value);
                      getOverlayConversations(value, selectedAssignee, selectedStatus, selectedPriority);
                    }}
                    placeholder="Search conversations here..."
                    className="w-full pl-10 pr-4 py-2.5 bg-[#F5E6D3] border border-[#8B4513] rounded-lg text-[#3C1810] placeholder-[#8B6B4D] focus:outline-none focus:ring-1 focus:ring-[#8B4513]"
                  />
                  <IconSearch 
                    size={20} 
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8B6B4D]" 
                  />
                </div>
                <button 
                  onClick={() => {
                    setIsSearchOpen(false);
                    setSearchQuery('');
                  }}
                  className="p-2 rounded-lg text-[#3C1810] hover:bg-[#F5E6D3]"
                >
                  <IconX size={20} />
                </button>
              </div>
            </div>

            {/* Update the Search Filters */}
            <div className="px-6 py-3 border-b border-[#8B4513] flex items-center gap-2 overflow-visible">
              <button className="px-3 py-1.5 text-sm text-[#3C1810] bg-[#F5E6D3] rounded-lg border border-[#8B4513]">
                All
              </button>
              <div className="relative" ref={assigneeFilterRef}>
                <button 
                  onClick={() => setIsAssigneeFilterOpen(!isAssigneeFilterOpen)}
                  className={`px-3 py-1.5 text-sm text-[#3C1810] hover:bg-[#F5E6D3] rounded-lg flex items-center gap-1 ${
                    selectedAssignee ? 'bg-[#F5E6D3] border border-[#8B4513]' : ''
                  }`}
                >
                  <IconUser size={16} />
                  Assigned to
                </button>
                
                {isAssigneeFilterOpen && (
                  <div className="absolute top-full left-0 mt-1 w-56 bg-[#FDF6E3] border border-[#8B4513] rounded-lg shadow-lg z-[1000]">
                    <div className="p-2 space-y-1">
                      {users.map((user) => (
                        <button
                          key={user.id}
                          onClick={() => handleAssigneeSelect(user.id)}
                          className={`w-full px-3 py-2 text-left text-sm rounded-lg flex items-center gap-2 ${
                            selectedAssignee === user.id 
                              ? 'bg-[#F5E6D3] text-[#3C1810]' 
                              : 'text-[#3C1810] hover:bg-[#F5E6D3]'
                          }`}
                        >
                          <div className="w-6 h-6 rounded-full bg-[#8B4513] text-[#FDF6E3] flex items-center justify-center">
                            {user.display_name?.[0] || '?'}
                          </div>
                          {user.display_name || 'Unknown User'}
                          {selectedAssignee === user.id && (
                            <IconCheck size={16} className="ml-auto text-[#8B4513]" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="relative" ref={statusFilterRef}>
                <button 
                  onClick={() => setIsStatusFilterOpen(!isStatusFilterOpen)}
                  className={`px-3 py-1.5 text-sm text-[#3C1810] hover:bg-[#F5E6D3] rounded-lg flex items-center gap-1 ${
                    selectedStatus ? 'bg-[#F5E6D3] border border-[#8B4513]' : ''
                  }`}
                >
                  <IconStatusChange size={16} />
                  Status
                </button>
                
                {isStatusFilterOpen && (
                  <div className="absolute top-full left-0 mt-1 w-40 bg-[#FDF6E3] border border-[#8B4513] rounded-lg shadow-lg z-[1000]">
                    <div className="p-2 space-y-1">
                      {['New', 'Active', 'Closed'].map((status) => (
                        <button
                          key={status}
                          onClick={() => handleStatusSelect(status)}
                          className={`w-full px-3 py-2 text-left text-sm rounded-lg flex items-center justify-between ${
                            selectedStatus === status 
                              ? 'bg-[#F5E6D3] text-[#3C1810]' 
                              : 'text-[#3C1810] hover:bg-[#F5E6D3]'
                          }`}
                        >
                          {status}
                          {selectedStatus === status && (
                            <IconCheck size={16} className="text-[#8B4513]" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="relative" ref={priorityFilterRef}>
                <button 
                  onClick={() => setIsPriorityFilterOpen(!isPriorityFilterOpen)}
                  className={`px-3 py-1.5 text-sm text-[#3C1810] hover:bg-[#F5E6D3] rounded-lg flex items-center gap-1 ${
                    selectedPriority !== null ? 'bg-[#F5E6D3] border border-[#8B4513]' : ''
                  }`}
                >
                  <IconStar size={16} />
                  Priority
                </button>
                
                {isPriorityFilterOpen && (
                  <div className="absolute top-full left-0 mt-1 w-40 bg-[#FDF6E3] border border-[#8B4513] rounded-lg shadow-lg z-[1000]">
                    <div className="p-2 space-y-1">
                      {[
                        { label: 'Priority', value: true },
                        { label: 'Non-Priority', value: false }
                      ].map((option) => (
                        <button
                          key={option.label}
                          onClick={() => handlePrioritySelect(option.value)}
                          className={`w-full px-3 py-2 text-left text-sm rounded-lg flex items-center justify-between ${
                            selectedPriority === option.value 
                              ? 'bg-[#F5E6D3] text-[#3C1810]' 
                              : 'text-[#3C1810] hover:bg-[#F5E6D3]'
                          }`}
                        >
                          {option.label}
                          {selectedPriority === option.value && (
                            <IconCheck size={16} className="text-[#8B4513]" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <button className="px-3 py-1.5 text-sm text-[#3C1810] hover:bg-[#F5E6D3] rounded-lg flex items-center gap-1">
                <IconUsers size={16} />
                Team
              </button>
            </div>

            {/* Search Results Area */}
            <div className="flex-1 overflow-auto">
              {(searchQuery || selectedAssignee || selectedStatus || selectedPriority) ? (
                <div className="p-6 space-y-2">
                  {overlayConversations.map((conversation) => (
                    <div 
                      key={conversation.id}
                      onClick={() => {
                        setIsSearchOpen(false);
                        setSearchQuery('');
                        setSelectedAssignee(null);
                        setSelectedStatus(null);
                        setSelectedPriority(null);
                        setSelectedApp(conversation.id);
                      }}
                      className="p-4 border border-[#8B4513] rounded-lg hover:bg-[#F5E6D3] cursor-pointer"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-[#3C1810] font-medium">
                            {conversation.customers?.full_name || 'Unknown Customer'}
                          </h3>
                          {conversation.messages && conversation.messages.length > 0 && (
                            <p className="text-sm text-[#5C2E0E] line-clamp-1">
                              {conversation.messages[0].content}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className="text-xs text-[#8B6B4D]">
                            {conversation.channels}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            conversation.status === 'Closed' 
                              ? 'bg-gray-100 text-gray-600' 
                              : conversation.status === 'Active'
                              ? 'bg-green-100 text-green-600'
                              : 'bg-yellow-100 text-yellow-600'
                          }`}>
                            {conversation.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                  {overlayConversations.length === 0 && (
                    <div className="text-center text-[#5C2E0E] mt-20">
                      {searchQuery 
                        ? 'No conversations found matching your search.'
                        : selectedAssignee 
                        ? 'No conversations found for this assignee.'
                        : selectedStatus
                        ? `No ${selectedStatus.toLowerCase()} conversations found.`
                        : selectedPriority
                        ? 'No conversations found for the selected priority.'
                        : 'Type to search for conversations.'
                      }
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center text-[#5C2E0E] mt-20">
                  Type to search for conversations or select a filter.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Navigation Items */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 space-y-1">
            {/* Your inbox */}
            <div className="mb-4">
              <div className="flex items-center gap-2 px-3 py-2" 
                onClick={() => {
                  setSelectedNav('inbox');
                  setIsSearchOpen(false);
                  setSearchQuery('');
                  setSelectedAssignee(null);
                  setSelectedStatus(null);
                }}
                style={{ cursor: 'pointer' }}
              >
                <IconInbox size={20} className="text-[#8B4513]" />
                <span className="text-sm font-medium text-[#3C1810]">Your Inbox</span>
                {newConversationsCount > 0 && (
                  <span className="ml-auto bg-[#8B4513] text-[#FDF6E3] text-xs px-2 py-0.5 rounded-full">
                    {conversations.filter(conv => 
                      conv.status === 'New' || conv.status === 'Active'
                    ).length}
                  </span>
                )}
              </div>
              <div className="pl-9">
                <button className="w-full text-left px-3 py-2 text-sm text-[#3C1810] hover:bg-[#F5E6D3] rounded flex items-center justify-between">
                  <span>Mentions</span>
                  <span className="text-xs text-[#5C2E0E]">0</span>
                </button>
                <button className="w-full text-left px-3 py-2 text-sm text-[#3C1810] hover:bg-[#F5E6D3] rounded flex items-center justify-between">
                  <span>Unassigned</span>
                  <span className="text-xs text-[#5C2E0E]">
                    {(() => {
                      const unassignedConvs = conversations.filter(conv => {
                        return (
                          !conv.assigned_to && 
                          (conv.status === 'New' || conv.status === 'Active')
                        );
                      });
                      return unassignedConvs.length;
                    })()}
                  </span>
                </button>
              </div>
            </div>

            {/* Fin AI Agent */}
            <div className="mb-4">
              <div className="flex items-center justify-between px-3 py-2">
                <div className="flex items-center gap-2">
                  <IconRobot size={20} className="text-[#8B4513]" />
                  <span className="text-sm font-medium text-[#3C1810]">AI Agent</span>
                </div>
                <button className="p-1 rounded hover:bg-[#F5E6D3]">
                  <IconPlus size={16} className="text-[#8B4513]" />
                </button>
              </div>
            </div>

            {/* Teammates */}
            <div className="mb-4">
              <div className="flex items-center justify-between px-3 py-2">
                <div className="flex items-center gap-2">
                  <IconUser size={20} className="text-[#8B4513]" />
                  <span className="text-sm font-medium text-[#3C1810]">Teammates</span>
                </div>
                <button className="p-1 rounded hover:bg-[#F5E6D3]">
                  <IconPlus size={16} className="text-[#8B4513]" />
                </button>
              </div>
            </div>

            {/* Team inboxes */}
            <div className="mb-4">
              <div className="flex items-center justify-between px-3 py-2">
                <div className="flex items-center gap-2">
                  <IconInbox size={20} className="text-[#8B4513]" />
                  <span className="text-sm font-medium text-[#3C1810]">Team inboxes</span>
                </div>
                <button className="p-1 rounded hover:bg-[#F5E6D3]">
                  <IconPlus size={16} className="text-[#8B4513]" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Current Secondary Sidebar (now third) */}
      <div className="w-80 border-r border-[#8B4513] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-[#8B4513]">
          <div className="flex items-center justify-between h-9">
            <div className="flex items-center gap-3">
              {/* Organization Logo - only show if logoUrl exists */}
              {organizations.find(org => org.id === selectedOrg)?.logoUrl && (
                <div className="w-8 h-8 rounded-lg border border-[#8B4513] overflow-hidden flex items-center justify-center bg-[#F5E6D3]">
                  <img 
                    src={organizations.find(org => org.id === selectedOrg)?.logoUrl} 
                    alt="Organization Logo" 
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              {/* Organization Name */}
              <h2 className="text-xl font-semibold text-[#3C1810]">
                {organizations.find(org => org.id === selectedOrg)?.name || 'Loading...'}
              </h2>
            </div>
          </div>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto">
          {conversations
            .filter(conversation => conversation.status !== 'Closed')
            .map((conversation) => {
            const customerMessages = conversation.messages?.filter(msg => msg.sender_type === 'customer') || [];
            const latestCustomerMessage = customerMessages.length > 0 
              ? customerMessages[customerMessages.length - 1] 
              : null;

            return (
              <div
                key={conversation.id}
                className={`w-full p-4 flex flex-col border-b border-[#8B4513] relative cursor-pointer ${
                  selectedApp === conversation.id ? 'bg-[#F5E6D3]' : 'hover:bg-[#F5E6D3]'
                }`}
                onClick={() => handleConversationClick(conversation.id)}
              >
                {/* Status Section */}
                <div className="mb-2 flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${
                    conversation.status === 'New' ? 'bg-orange-500' :
                    conversation.status === 'Active' ? 'bg-green-500' :
                    'bg-gray-400'
                  }`} />
                  <span className={`text-xs px-2 py-1 rounded ${
                    conversation.status === 'New' ? 'bg-orange-100 text-orange-800' :
                    conversation.status === 'Active' ? 'bg-green-100 text-green-800' :
                    conversation.status === 'Closed' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {conversation.status}
                  </span>
              </div>

                {/* Conversation Content */}
                <div className="flex-1 pr-8">
                  <div className="flex items-center mb-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-[#3C1810]">
                        {conversation.customer_name}
                      </span>
                      <span className="text-xs text-[#5C2E0E] opacity-75">
                        {new Date(latestCustomerMessage?.created_at || conversation.created_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                </div>
              </div>
                  {latestCustomerMessage && (
                    <p className="text-sm text-[#5C2E0E] truncate">
                      {latestCustomerMessage.content}
                    </p>
                  )}
                </div>

                {/* Importance Toggle - Positioned absolutely */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleImportance(conversation.id, conversation.is_important);
                  }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-1 hover:bg-[#8B4513] hover:bg-opacity-10 rounded"
                >
                  {conversation.is_important ? (
                    <IconStarFilled size={20} className="text-[#8B4513]" />
                  ) : (
                    <IconStar size={20} className="text-[#8B4513]" />
                  )}
            </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex">
        {/* Chat Area */}
        <div className="flex-1 flex flex-col">
          {/* Chat Header */}
          <div className="p-6 border-b border-[#8B4513]">
            <div className="flex items-center justify-between h-9">
              <h2 className="text-xl font-semibold text-[#3C1810]">
                {getCurrentConversation()?.channels || 'Welcome'}
              </h2>
              {selectedApp && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCloseConversation}
                    className="px-4 py-2 text-[#3C1810] hover:bg-[#F5E6D3] rounded-lg"
                  >
                    Close Chat
                  </button>
                  <button className="p-2 rounded-lg text-[#3C1810] hover:bg-[#F5E6D3]">
                    <IconDotsVertical size={20} />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 p-6 overflow-y-auto bg-[#FDF6E3]">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full">
                <img 
                  src="/mustache.png" 
                  alt="Mustache" 
                  className="w-32 h-32 opacity-90"
                />
                <p className="text-[#3C1810] mb-6 text-center text-lg">
                  Ready to put on your mustache?
                </p>
                <p className="text-[#5C2E0E] mb-4 text-center text-sm">
                  Choose a conversation to start helping your customer.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {renderMessages(messages)}
              </div>
            )}
          </div>

          {/* Input Box */}
          {selectedApp && (
            <div className="p-4 border-t border-[#8B4513]">
              <div className="flex space-x-4">
                <input
                  type="text"
                  placeholder="Type your message..."
                  className="flex-1 px-4 py-2 rounded-lg border border-[#8B4513] focus:outline-none focus:ring-2 focus:ring-[#8B4513] bg-[#FDF6E3]"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                />
                <button 
                  onClick={sendMessage}
                  className="px-6 py-2 bg-[#8B4513] text-[#FDF6E3] rounded-lg hover:bg-[#5C2E0E] flex items-center space-x-2"
                >
                  <IconSend size={20} />
                  <span>Send</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Insights Sidebar */}
        <div className="w-80 border-l border-[#8B4513] bg-[#FDF6E3] p-4">
          <h3 className="text-lg font-semibold text-[#3C1810] mb-4">Insights</h3>
          
          {/* Assignee Section */}
          <div className="mb-6">
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={handleAssigneeClick}
                className="w-full bg-[#F5E6D3] p-4 rounded-lg border border-[#8B4513] flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm text-[#5C2E0E]">Assignee</span>
                  <span className="text-[#3C1810] font-medium">
                    {(() => {
                      const conversation = getCurrentConversation();
                      const assignedUser = users.find(u => u.id === conversation?.assigned_to);
                      return assignedUser?.display_name || 'Unassigned';
                    })()}
                  </span>
                </div>
                <IconChevronDown 
                  size={20} 
                  className={`text-[#8B4513] transition-transform ${isAssigneeOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {/* Dropdown Menu */}
              {isAssigneeOpen && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-[#8B4513] rounded-lg shadow-lg z-10">
                  <div className="p-2">
                    {users.map((user) => (
                      <button
                        key={user.id}
                        onClick={() => handleAssign(user.id)}
                        className="w-full text-left px-4 py-2 hover:bg-[#F5E6D3] rounded flex items-center justify-between"
                      >
                        <span className="text-[#3C1810]">{user.display_name}</span>
                        {getCurrentConversation()?.assigned_to === user.id && (
                          <IconCheck size={16} className="text-[#8B4513]" />
                        )}
                      </button>
                    ))}
                    <button
                      onClick={() => handleAssign(null)}
                      className="w-full text-left px-4 py-2 hover:bg-[#F5E6D3] rounded flex items-center justify-between"
                    >
                      <span className="text-[#3C1810]">Unassign</span>
                      {!getCurrentConversation()?.assigned_to && (
                        <IconCheck size={16} className="text-[#8B4513]" />
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            {/* Response Time Box */}
            <div className="bg-[#F5E6D3] rounded-lg p-4 border border-[#8B4513]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-[#5C2E0E]">Avg. Response Time</span>
                <span className="text-[#3C1810]">
                  <IconChartBar size={20} />
                </span>
              </div>
              <div className="flex flex-col">
                <div className="text-lg font-semibold text-[#3C1810]">
                  {responseTimeStats.averageResponseTime < 1 
                    ? '< 1 min' 
                    : `${responseTimeStats.averageResponseTime} min`}
                </div>
                <div className="text-xs text-[#5C2E0E] mt-1">
                  Based on {responseTimeStats.totalResponses} responses
                </div>
              </div>
            </div>

            {/* Satisfaction Score Box */}
            <div className="bg-[#F5E6D3] rounded-lg p-4 border border-[#8B4513]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-[#5C2E0E]">Satisfaction Rate</span>
                <span className="text-[#3C1810]">
                  <IconStarFilled size={20} />
                </span>
              </div>
              <div className="flex flex-col">
                <div className="text-lg font-semibold text-[#3C1810] flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => {
                    const currentConversation = getCurrentConversation();
                    const hasRating = currentConversation?.satisfaction_score !== null && 
                                     currentConversation?.satisfaction_score !== undefined;
                    const rating = hasRating ? parseInt(currentConversation?.satisfaction_score || '0', 10) : 0;
                    
                    return (
                      <span 
                        key={star} 
                        className={`text-[#8B4513] ${
                          !hasRating 
                            ? 'opacity-30' 
                            : star <= rating 
                              ? 'opacity-100' 
                              : 'opacity-30'
                        }`}
                      >
                        {!hasRating ? '☆' : star <= rating ? '★' : '☆'}
                      </span>
                    );
                  })}
                </div>
                <div className="text-sm text-[#5C2E0E] mt-1">
                  {!getCurrentConversation()?.satisfaction_score 
                    ? 'No rating yet'
                    : `${getCurrentConversation()?.satisfaction_score} / 5`}
                </div>
              </div>
            </div>

            {/* Other insight boxes */}
            {getConversationInsights().map((insight, index) => (
              <div 
                key={index}
                className="bg-[#F5E6D3] rounded-lg p-4 border border-[#8B4513]"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-[#5C2E0E]">{insight.label}</span>
                  <span className="text-[#3C1810]">{insight.icon}</span>
                </div>
                <div className="text-lg font-semibold text-[#3C1810]">
                  {insight.value}
                </div>
              </div>
            ))}
          </div>

          {/* Additional Insights or Actions */}
          <div className="mt-6">
            <button className="w-full bg-[#8B4513] text-[#FDF6E3] py-2 px-4 rounded-lg hover:bg-[#5C2E0E] transition-colors border border-[#3C1810]">
              View Full Analytics
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard; 