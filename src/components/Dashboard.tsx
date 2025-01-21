import { useState, useEffect } from 'react';
import IconInbox from '@tabler/icons-react/dist/esm/icons/IconInbox';
import IconBook from '@tabler/icons-react/dist/esm/icons/IconBook';
import IconBrandSlack from '@tabler/icons-react/dist/esm/icons/IconBrandSlack';
import IconBrandDiscord from '@tabler/icons-react/dist/esm/icons/IconBrandDiscord';
import IconMail from '@tabler/icons-react/dist/esm/icons/IconMail';
import IconLogout from '@tabler/icons-react/dist/esm/icons/IconLogout';
import IconRobot from '@tabler/icons-react/dist/esm/icons/IconRobot';
import IconUsers from '@tabler/icons-react/dist/esm/icons/IconUsers';
import IconChartBar from '@tabler/icons-react/dist/esm/icons/IconChartBar';
import IconSend from '@tabler/icons-react/dist/esm/icons/IconSend';
import IconPlus from '@tabler/icons-react/dist/esm/icons/IconPlus';
import IconSearch from '@tabler/icons-react/dist/esm/icons/IconSearch';
import IconDotsVertical from '@tabler/icons-react/dist/esm/icons/IconDotsVertical';
import IconTickets from '@tabler/icons-react/dist/esm/icons/IconInbox';
import IconSettings from '@tabler/icons-react/dist/esm/icons/IconSettings';
import IconUser from '@tabler/icons-react/dist/esm/icons/IconUser';
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

  const apps = [
    { 
      id: 'messenger', 
      name: 'Messenger', 
      icon: IconBrandSlack, 
      description: 'Install Messenger',
      time: '2h' 
    },
    { 
      id: 'email', 
      name: 'Email', 
      icon: IconMail, 
      description: 'This is a demo email. It shows...',
      time: '2h'
    },
    { 
      id: 'whatsapp', 
      name: 'WhatsApp', 
      icon: IconBrandSlack, 
      description: 'Set up WhatsApp or social ch...',
      time: '2h'
    },
    { 
      id: 'phone', 
      name: 'Phone', 
      icon: IconMail, 
      description: 'Set up phone or SMS',
      time: '2h'
    },
  ];

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
      const { data, error } = await supabase
        .from('messages')
        .insert([{
          content: message,
          sender_id: 'user',
          conversations_id: selectedApp,  // Add the conversation ID
          organizations_id: selectedOrg,
          sender_name: 'User',
          sender_type: 'user' as const,
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

  // Update the conversations fetch effect
  useEffect(() => {
    if (!selectedOrg) {
      console.log('No organization selected, skipping subscription setup');
      return;
    }

    const fetchConversations = async () => {
      try {
        console.log('Fetching conversations for org:', selectedOrg);
        
        // Get conversations with their customer details and messages
        const { data: conversationsData, error: conversationsError } = await supabase
          .from('conversations')
          .select(`
            id,
            created_at,
            organizations_id,
            channels,
            status,
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
          .order('created_at', { ascending: false });

        if (conversationsError) {
          console.error('Error fetching conversations:', conversationsError);
          return;
        }

        console.log('Full conversations data:', conversationsData);

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

          console.log('Processed conversations:', conversationsWithMessages);
          setConversations(conversationsWithMessages);
        }
      } catch (error) {
        console.error('Error in fetchConversations:', error);
      }
    };

    // Initial fetch
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
            className={`p-2 rounded-lg relative ${
              selectedNav === 'inbox'
                ? 'bg-[#8B4513] text-[#FDF6E3]'
                : 'text-[#3C1810] hover:bg-[#F5E6D3]'
            }`}
          >
            <IconInbox size={24} />
            <span className="absolute top-0 right-0 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
              4
            </span>
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
          {conversations.map((conversation) => (
            <button
              key={conversation.id}
              onClick={() => setSelectedApp(conversation.id)}
              className={`w-full p-4 flex flex-col border-b border-[#8B4513] ${
                selectedApp === conversation.id ? 'bg-[#F5E6D3]' : 'hover:bg-[#F5E6D3]'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-[#3C1810]">
                  {conversation.customer_name}
                </span>
                <div className="flex items-center space-x-2">
                  <span className="text-xs px-2 py-1 rounded bg-[#8B4513] text-[#FDF6E3]">
                    {conversation.channels}
                  </span>
                  <span className="text-sm text-[#5C2E0E]">
                    {new Date(conversation.latest_message?.created_at || conversation.created_at).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </div>
              </div>
              {conversation.latest_message && (
                <p className="text-sm text-[#5C2E0E] truncate">
                  {conversation.latest_message.content}
                </p>
              )}
              <div className="mt-1">
                <span className={`text-xs px-2 py-1 rounded ${
                  conversation.status === 'new' ? 'bg-orange-100 text-orange-800' :
                  conversation.status === 'active' ? 'bg-green-100 text-green-800' :
                  conversation.status === 'closed' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {conversation.status}
                </span>
              </div>
            </button>
          ))}
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
            <button className="text-[#3C1810] hover:bg-[#F5E6D3] p-2 rounded">
              <IconDotsVertical size={20} />
            </button>
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