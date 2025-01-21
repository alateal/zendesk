import { useState, useEffect } from 'react';
import { 
  IconInbox, 
  IconBook, 
  IconBrandSlack, 
  IconBrandDiscord, 
  IconMail, 
  IconLogout,
  IconRobot,
  IconUsers,
  IconChartBar,
  IconSend,
  IconPlus,
  IconSearch,
  IconDotsVertical,
  IconInbox as IconTickets,
  IconSettings,
  IconUser
} from '@tabler/icons-react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { RealtimeChannel } from '@supabase/supabase-js';
import supabase from '../supabase';
import { Message } from '../types/supabase';

const Dashboard = () => {
  const { signOut, user } = useAuth();
  const navigate = useNavigate();
  const [selectedNav, setSelectedNav] = useState('inbox');
  const [selectedApp, setSelectedApp] = useState('whatsapp');
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);

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

  const handleSignOut = async () => {
    await signOut();
    navigate('/signin');
  };

  // Function to load initial messages
  const loadMessages = async (conversationId: string) => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      if (data) setMessages(data);
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  // Set up real-time subscription when conversation changes
  useEffect(() => {
    if (!selectedApp) return;

    // Load initial messages
    loadMessages(selectedApp);

    // Set up real-time subscription
    const channel = supabase
      .channel(`messages:${selectedApp}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${selectedApp}`,
        },
        (payload) => {
          const newMessage = payload.new as Message;
          setMessages((current) => [...current, newMessage]);
        }
      )
      .subscribe();

    setChannel(channel);

    // Cleanup subscription
    return () => {
      channel.unsubscribe();
    };
  }, [selectedApp]);

  // Function to send message
  const sendMessage = async () => {
    if (!message.trim() || !user) return;

    try {
      const newMessage = {
        content: message,
        user_id: user.id,
        conversation_id: selectedApp,
        sender_name: user.email,
        sender_type: 'user' as const,
      };

      const { error } = await supabase
        .from('messages')
        .insert([newMessage]);

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

  return (
    <div className="flex h-screen bg-[#FDF6E3]">
      {/* Main Sidebar */}
      <div className="w-16 bg-[#FDF6E3] border-r border-[#8B4513] flex flex-col items-center py-4">
        <div className="mb-8">
          <img src="/favicon.ico" alt="Logo" className="w-8 h-8" />
        </div>
        
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
            <h2 className="text-lg font-semibold text-[#3C1810]">Inbox</h2>
            <button className="text-[#3C1810] hover:bg-[#F5E6D3] p-1 rounded">
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
          {apps.map((app) => (
            <button
              key={app.id}
              onClick={() => setSelectedApp(app.id)}
              className={`w-full p-4 flex items-start space-x-3 border-b border-[#8B4513] ${
                selectedApp === app.id ? 'bg-[#F5E6D3]' : 'hover:bg-[#F5E6D3]'
              }`}
            >
              <div className="w-10 h-10 rounded bg-[#8B4513] flex items-center justify-center text-[#FDF6E3]">
                <app.icon size={20} />
              </div>
              <div className="flex-1 text-left">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-[#3C1810]">{app.name}</span>
                  <span className="text-sm text-[#5C2E0E]">{app.time}</span>
                </div>
                <p className="text-sm text-[#5C2E0E] truncate">{app.description}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Chat Header - Updated */}
        <div className="h-16 border-b border-[#8B4513] px-6 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-8 h-8 rounded bg-[#8B4513] flex items-center justify-center text-[#FDF6E3]">
              {(() => {
                const currentApp = apps.find(app => app.id === selectedApp);
                if (currentApp && currentApp.icon) {
                  const Icon = currentApp.icon;
                  return <Icon size={20} />;
                }
                return null;
              })()}
            </div>
            <h2 className="text-lg font-semibold text-[#3C1810]">
              {getCurrentConversationTitle()}
            </h2>
          </div>
          <div className="flex items-center space-x-2">
            <button className="p-2 text-[#3C1810] hover:bg-[#F5E6D3] rounded-lg">
              <IconUser size={20} />
            </button>
            <button className="p-2 text-[#3C1810] hover:bg-[#F5E6D3] rounded-lg">
              <IconDotsVertical size={20} />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 p-6 overflow-y-auto">
          {messages.length === 0 ? (
            <div className="bg-white rounded-lg shadow-lg p-6 max-w-2xl mx-auto">
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
                    msg.user_id === user?.id ? 'ml-auto' : 'mr-auto'
                  }`}
                >
                  <div
                    className={`rounded-lg p-4 ${
                      msg.user_id === user?.id
                        ? 'bg-[#8B4513] text-[#FDF6E3]'
                        : 'bg-white border border-[#8B4513]'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium">
                        {msg.sender_name || 'Unknown'}
                      </span>
                      <span className="text-xs opacity-75">
                        {new Date(msg.created_at).toLocaleTimeString()}
                      </span>
                    </div>
                    <p>{msg.content}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Input Box */}
        <div className="border-t border-[#8B4513] p-4">
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
    </div>
  );
};

export default Dashboard; 