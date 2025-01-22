import { useState, useEffect } from 'react';
import IconInbox from '@tabler/icons-react/dist/esm/icons/IconInbox';
import IconBook from '@tabler/icons-react/dist/esm/icons/IconBook';
import IconBrandSlack from '@tabler/icons-react/dist/esm/icons/IconBrandSlack';
import IconMail from '@tabler/icons-react/dist/esm/icons/IconMail';
import IconLogout from '@tabler/icons-react/dist/esm/icons/IconLogout';
import IconRobot from '@tabler/icons-react/dist/esm/icons/IconRobot';
import IconChartBar from '@tabler/icons-react/dist/esm/icons/IconChartBar';
import IconSend from '@tabler/icons-react/dist/esm/icons/IconSend';
import IconPlus from '@tabler/icons-react/dist/esm/icons/IconPlus';
import IconSearch from '@tabler/icons-react/dist/esm/icons/IconSearch';
import IconDotsVertical from '@tabler/icons-react/dist/esm/icons/IconDotsVertical';
import IconSettings from '@tabler/icons-react/dist/esm/icons/IconSettings';
import IconStarFilled from '@tabler/icons-react/dist/esm/icons/IconStarFilled';
import IconStar from '@tabler/icons-react/dist/esm/icons/IconStar';
import { useNavigate } from 'react-router-dom';
import supabase from '../supabase';

type Organization = {
  id: string;
  name: string;
  logoUrl: string;
  created_at: string;
};

type Conversation = {
  id: string;
  created_at: string;
  organizations_id: string;
  channels: string;
  status: string;
  customer_name: string;
  customers?: {
    id: string;
    full_name: string;
    email: string;
  };
  latest_message?: {
    sender_id: string;
    sender_type: string;
    content: string;
    created_at: string;
  };
  satisfaction_score?: string;
  is_important: boolean;
};

type Message = {
  id: string;
  created_at: string;
  organizations_id: string;
  sender_id: string;
  sender_name: string;
  sender_type: string;
  content: string;
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

const Dashboard = () => {
  const navigate = useNavigate();
  const [selectedNav, setSelectedNav] = useState('inbox');
  const [selectedApp, setSelectedApp] = useState('whatsapp');
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
      console.log('Loading messages for conversation:', conversationId);
      
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversations_id', conversationId)  // Filter by conversation_id instead of organizations_id
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error loading messages:', error);
        return;
      }

      console.log('Loaded messages:', data);
      if (data) setMessages(data);
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  // Set up real-time subscription when conversation changes
  useEffect(() => {
    if (!selectedApp || !selectedOrg) {
      console.log('No conversation or organization selected');
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
    const currentApp = apps.find(app => app.id === selectedApp);
    switch (currentApp?.id) {
      case 'whatsapp':
        return 'WhatsApp & Social';
      case 'messenger':
        return 'Messenger';
      case 'email':
        return 'Email';
      case 'phone':
        return 'Phone & SMS';
      default:
        return currentApp?.name || 'Conversation';
    }
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
          console.log('Setting organizations:', orgs);
          setOrganizations(orgs);
          if (!selectedOrg) {
            console.log('Setting selected org:', orgs[0].id);
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

  // Add this console log in the render to verify the state
  console.log('Current organizations state:', organizations);

  const fetchConversations = async () => {
    try {
      console.log('Fetching conversations for org:', selectedOrg);
      
      const { data: conversationsData, error: conversationsError } = await supabase
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
        .order('is_important', { ascending: false })
        .order('created_at', { ascending: false });

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
            latest_message: latestMessage
          };
        });

        setConversations(conversationsWithMessages);
      }
    } catch (error) {
      console.error('Error fetching conversations:', error);
    }
  };

  useEffect(() => {
    if (!selectedOrg) {
      console.log('No organization selected, skipping subscription setup');
      return;
    }

    fetchConversations();

    // Set up real-time subscription without filters
    const channel = supabase.channel(`org-${selectedOrg}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'conversations'
        },
        (payload) => {
          console.log('Conversation inserted:', payload);
          // Check organization ID in the handler instead of filter
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
          console.log('Message inserted:', payload);
          // Check organization ID in the handler instead of filter
          if (payload.new && payload.new.organizations_id === selectedOrg) {
            fetchConversations();
          }
        }
      );

    // Subscribe and handle connection status
    channel.subscribe(async (status) => {
      console.log('Subscription status:', status);
      if (status === 'SUBSCRIBED') {
        console.log('Successfully subscribed to changes');
      }
      if (status === 'CHANNEL_ERROR') {
        console.error('Channel error occurred');
        // Try to reconnect
        await channel.unsubscribe();
        channel.subscribe();
      }
    });

    // Cleanup
    return () => {
      console.log('Cleaning up subscription');
      channel.unsubscribe();
    };
  }, [selectedOrg]);

  // Add this function
  const refreshSession = async () => {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) {
      console.error('Error refreshing session:', error);
      return null;
    }
    if (!session) {
      console.log('No session found');
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
      console.log('Auth response:', userData);

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

      console.log('Conversation creation result:', { data: conversationData, error: conversationError });

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

        console.log('Message creation result:', { data: messageData, error: messageError });

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
        label: 'Response Time',
        value: '2m',
        icon: <IconChartBar size={20} />
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
          setConversations(current =>
            current.map(conv =>
              conv.id === payload.new.id
                ? { ...conv, status: payload.new.status }
                : conv
            )
          );
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
    
    // Get current conversation
    const conversation = conversations.find(conv => conv.id === conversationId);
    
    // Only update to Active if it's currently New
    if (conversation?.status === 'New') {
      await updateConversationStatus(conversationId, 'Active');
    }
  };

  // Add close conversation handler
  const handleCloseConversation = async () => {
    if (!selectedApp) return;
    
    await updateConversationStatus(selectedApp, 'Closed');
    setSelectedApp(null); // Optionally clear the selection
  };

  // Add useEffect to count new conversations
  useEffect(() => {
    const newCount = conversations.filter(conv => conv.status === 'New').length;
    setNewConversationsCount(newCount);
  }, [conversations]);

  // Add real-time subscription for conversation changes
  useEffect(() => {
    if (!selectedOrg) return;

    const channel = supabase
      .channel('conversation-changes')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'conversations',
          filter: `organizations_id=eq.${selectedOrg}`
        },
        (payload) => {
          // Fetch updated conversations to maintain accurate count
          fetchConversations();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [selectedOrg]);

  // Simplify the calculation function
  const calculateSatisfactionStats = (conversations: Conversation[]) => {
    const ratedConversations = conversations.filter(conv => conv.satisfaction_score);
    const totalRatings = ratedConversations.length;
    
    if (totalRatings === 0) return { averageScore: 0, totalRatings: 0 };
    
    const sum = ratedConversations.reduce((acc, conv) => 
      acc + Number(conv.satisfaction_score || 0), 0
    );
    
    return {
      averageScore: Math.floor(sum / totalRatings),
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
          console.log('Satisfaction update received:', payload);
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
            onClick={() => setSelectedNav('inbox')}
            className={`relative p-3 rounded-lg ${
              selectedNav === 'inbox'
                ? 'bg-[#F5E6D3] text-[#3C1810]'
                : 'text-[#5C2E0E] hover:bg-[#F5E6D3]'
            }`}
          >
            <IconInbox size={24} />
            {newConversationsCount > 0 && (
              <div className="absolute -top-1 -right-1 bg-[#8B4513] text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {newConversationsCount}
              </div>
            )}
          </button>
          
          <button
            onClick={() => setSelectedNav('ai')}
            className={`p-2 rounded-lg ${
              selectedNav === 'ai'
                ? 'bg-[#8B4513] text-[#FDF6E3]'
                : 'text-[#3C1810] hover:bg-[#F5E6D3]'
            }`}
          >
            <IconRobot size={24} />
          </button>

          <button
            onClick={() => setSelectedNav('knowledge')}
            className={`p-2 rounded-lg ${
              selectedNav === 'knowledge'
                ? 'bg-[#8B4513] text-[#FDF6E3]'
                : 'text-[#3C1810] hover:bg-[#F5E6D3]'
            }`}
          >
            <IconBook size={24} />
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
          
          <button
            onClick={handleSignOut}
            className="p-2 rounded-lg text-[#3C1810] hover:bg-[#F5E6D3]"
          >
            <IconLogout size={24} />
          </button>
        </div>
      </div>

      {/* Secondary Sidebar */}
      <div className="w-80 border-r border-[#8B4513] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-[#8B4513]">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              {selectedOrg && organizations.find(org => org.id === selectedOrg) && (
                <div className="w-8 h-8 rounded overflow-hidden">
                  {organizations.find(org => org.id === selectedOrg)?.logoUrl ? (
                    <img 
                      src={organizations.find(org => org.id === selectedOrg)?.logoUrl} 
                      alt="Organization Logo" 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-8 h-8 bg-[#8B4513] flex items-center justify-center text-[#FDF6E3] rounded">
                      <span className="text-sm font-semibold">
                        {organizations.find(org => org.id === selectedOrg)?.name.charAt(0)}
                      </span>
                    </div>
                  )}
                </div>
              )}
              <h2 className="text-lg font-semibold text-[#3C1810]">Inbox</h2>
            </div>
            <button 
              onClick={createNewConversation}
              className="text-[#3C1810] hover:bg-[#F5E6D3] p-1 rounded"
            >
              <IconPlus size={20} />
            </button>
          </div>
          <div className="relative">
            <input
              type="text"
              placeholder="Search..."
              className="w-full px-4 py-2 pl-10 rounded-lg border border-[#8B4513] focus:outline-none focus:ring-2 focus:ring-[#8B4513] bg-[#FDF6E3]"
            />
            <IconSearch className="absolute left-3 top-2.5 text-[#3C1810]" size={20} />
          </div>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto">
          {conversations.map((conversation) => {
            const customerMessages = conversation.messages?.filter(msg => msg.sender_type === 'customer') || [];
            const latestCustomerMessage = customerMessages.length > 0 
              ? customerMessages[customerMessages.length - 1] 
              : null;

            return (
              <button
                key={conversation.id}
                className={`w-full p-4 flex flex-col border-b border-[#8B4513] relative ${
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
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex">
        {/* Chat Area */}
        <div className="flex-1 flex flex-col">
          {/* Chat Header */}
          <div className="p-4 border-b border-[#8B4513] flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex flex-col">
                <h2 className="text-lg font-semibold text-[#3C1810]">
                  {getCurrentConversation()?.channels || 'New Chat'}
                </h2>
                <span className="text-sm text-[#5C2E0E]">
                  {getCurrentConversation()?.status || ''}
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCloseConversation}
                className="text-[#3C1810] hover:bg-[#F5E6D3] p-2 rounded"
              >
                Close Chat
              </button>
              <button className="text-[#3C1810] hover:bg-[#F5E6D3] p-2 rounded">
                <IconDotsVertical size={20} />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 p-6 overflow-y-auto bg-[#FDF6E3]">
            {messages.length === 0 ? (
              <div className="bg-[#F5E6D3] rounded-lg border border-[#8B4513] p-6 max-w-2xl mx-auto">
                <div className="flex items-center gap-2 mb-4">
                  <div className="bg-[#8B4513] text-[#FDF6E3] px-3 py-1 rounded-full text-sm">
                    Demo Message
                  </div>
                </div>
                <p className="text-[#3C1810] mb-4">
                  This is a demo message. It shows how a customer conversation from WhatsApp, 
                  Instagram or Facebook will look in your Inbox.
                </p>
                <p className="text-[#5C2E0E] text-sm">
                  Once a channel is set up, all conversations come straight to your Inbox, 
                  so you can route them to the right team.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`max-w-2xl ${
                      msg.sender_type === 'user' ? 'ml-auto' : 'mr-auto'
                    }`}
                  >
                    <div
                      className={`rounded-lg p-4 ${
                        msg.sender_type === 'user'
                          ? 'bg-[#F5E6D3] text-[#3C1810] border border-[#8B4513]'
                          : msg.sender_type === 'system'
                          ? 'bg-[#F5E6D3] text-[#3C1810] border border-[#8B4513]'
                          : 'bg-[#FFFFFF] text-[#3C1810] border border-[#8B4513]'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-sm font-medium ${
                          msg.sender_type === 'user' || msg.sender_type === 'system'
                            ? 'text-[#5C2E0E]'
                            : 'text-[#5C2E0E]'
                        }`}>
                          {msg.sender_type === 'user' 
                            ? 'Agent' 
                            : getCurrentConversation()?.customer_name || 'Unknown Customer'}
                        </span>
                        <span className={`text-xs ${
                          msg.sender_type === 'user' || msg.sender_type === 'system'
                            ? 'text-[#5C2E0E] opacity-75'
                            : 'text-[#5C2E0E] opacity-75'
                        }`}>
                          {new Date(msg.created_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                      <p className={
                        msg.sender_type === 'user' || msg.sender_type === 'system'
                          ? 'text-[#3C1810]'
                          : 'text-[#3C1810]'
                      }>
                        {msg.content}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Input Box */}
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
        </div>

        {/* Insights Sidebar */}
        <div className="w-80 border-l border-[#8B4513] bg-[#FDF6E3] p-4">
          <h3 className="text-lg font-semibold text-[#3C1810] mb-4">Insights</h3>
          
          <div className="space-y-4">
            {/* Response Time Box */}
            <div className="bg-[#F5E6D3] rounded-lg p-4 border border-[#8B4513]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-[#5C2E0E]">Avg. Response Time</span>
                <span className="text-[#3C1810]">⏱️</span>
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
                  {[1, 2, 3, 4, 5].map((star) => (
                    <span 
                      key={star} 
                      className={star <= satisfactionStats.averageScore 
                        ? 'text-[#8B4513]' 
                        : 'text-[#8B4513] opacity-30'
                      }
                    >
                      ★
                    </span>
                  ))}
                </div>
                <div className="text-sm text-[#5C2E0E] mt-1">
                  {satisfactionStats.averageScore} / 5
                  <span className="text-xs ml-2">
                    ({satisfactionStats.totalRatings} ratings)
                  </span>
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