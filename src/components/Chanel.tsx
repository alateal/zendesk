import { useState, useEffect, useRef } from 'react';
import { IconMessage, IconX, IconSend, IconUser, IconMail } from '@tabler/icons-react';
import supabase from '../supabase';

type UserInfo = {
  fullName: string;
  email: string;
};

// Add new types
type MessageType = 'customer' | 'agent' | 'system';

interface Message {
  id: string;
  content: string;
  created_at: string;
  sender_type: MessageType;
  is_typing?: boolean;
}

// Add new types at the top
type ConversationStatus = 'New' | 'Active' | 'Pending_Handoff' | 'Handed_Off' | 'Closed' | 'AI_Chat';

interface Conversation {
  id: string;
  status: ConversationStatus;
  customer_id: string;
  agent_id?: string;
  created_at: string;
}

const Chanel = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [formData, setFormData] = useState<UserInfo>({
    fullName: '',
    email: ''
  });
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [rating, setRating] = useState(0);
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);
  const [isAiTyping, setIsAiTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  // Add new states
  const [conversationStatus, setConversationStatus] = useState<ConversationStatus>('New');
  const [isHandingOff, setIsHandingOff] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);

  useEffect(() => {
    // Load user info from localStorage on mount
    const savedUserInfo = localStorage.getItem('chatUserInfo');
    if (savedUserInfo) {
      setUserInfo(JSON.parse(savedUserInfo));
    }

    const savedConversationId = localStorage.getItem('chatConversationId');
    if (savedConversationId) {
      setConversationId(savedConversationId);
    }
  }, []);

  // Add scroll to bottom effect
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Update the useEffect for initial greeting
  useEffect(() => {
    if (userInfo && !messages.some(m => m.id === 'greeting')) {  // Check if greeting doesn't exist
      const initialGreeting = `Hello ${userInfo.fullName}! I'm Agent Dali, CHANEL's virtual assistant. How may I assist you today?`;
      
      setIsAiTyping(true);
      setTimeout(() => {
        setMessages(prevMessages => [...prevMessages, {  // Use functional update to preserve existing messages
          id: 'greeting',
          content: initialGreeting,
          created_at: new Date().toISOString(),
          sender_type: 'agent'
        }]);
        setIsAiTyping(false);
      }, 1000);
    }
  }, [userInfo]);

  const handleSubmitUserInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const { data: existingCustomer, error: searchError } = await supabase
        .from('customers')
        .select('*')
        .eq('email', formData.email)
        .single();

      if (searchError && searchError.code !== 'PGRST116') {
        throw searchError;
      }

      let customerData;
      
      if (existingCustomer) {
        customerData = existingCustomer;
      } else {
        const { data: newCustomer, error: insertError } = await supabase
          .from('customers')
          .insert([{
            full_name: formData.fullName,
            email: formData.email,
            organizations_id: '645d0512-984f-4a3a-b625-5b429b24291e'
          }])
          .select()
          .single();

        if (insertError) throw insertError;
        customerData = newCustomer;
      }

      const userInfo = {
        fullName: customerData.full_name,
        email: customerData.email
      };

      // Save to localStorage
      localStorage.setItem('chatUserInfo', JSON.stringify(userInfo));
      setUserInfo(userInfo);

    } catch (error) {
      console.error('Error handling customer info:', error);
      alert('Error saving your information. Please try again.');
    }
  };

  const handleHumanHandoff = async () => {
    if (!userInfo) return;
    
    try {
      setIsHandingOff(true);

      // Get customer info
      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .select('id')
        .eq('email', userInfo.email)
        .single();

      if (customerError) throw customerError;

      // Create conversation for handoff
      const { data: newConversation, error: conversationError } = await supabase
        .from('conversations')
        .insert([{
          customer_id: customer.id,
          organizations_id: '645d0512-984f-4a3a-b625-5b429b24291e',
          channels: 'Website',
          status: 'Pending_Handoff'
        }])
        .select()
        .single();

      if (conversationError) throw conversationError;
      
      const newConversationId = newConversation.id;
      setConversationId(newConversationId);
      localStorage.setItem('chatConversationId', newConversationId);
      setConversationStatus('Pending_Handoff');

      // Add all previous messages to the conversation
      const messagesToAdd = messages.map(msg => ({
        content: msg.content,
        conversations_id: newConversationId,
        organizations_id: '645d0512-984f-4a3a-b625-5b429b24291e',
        sender_id: msg.sender_type === 'customer' ? customer.id : 'ai-agent',
        sender_type: msg.sender_type,
        created_at: msg.created_at
      }));

      await supabase.from('messages').insert(messagesToAdd);

      // Add handoff message
      await supabase.from('messages').insert([{
        content: "I'm connecting you with a CHANEL Client Care Advisor. Please wait a moment.",
        conversations_id: newConversationId,
        organizations_id: '645d0512-984f-4a3a-b625-5b429b24291e',
        sender_id: 'system',
        sender_type: 'system'
      }]);

    } catch (error) {
      console.error('Error in human handoff:', error);
      if (error instanceof Error) {
        alert(error.message);
      } else {
        alert('Unable to connect to a human agent at this time. Please try again.');
      }
    } finally {
      setIsHandingOff(false);
    }
  };

  const handleSendMessage = async () => {
    if (!message.trim() || !userInfo || isHandingOff) return;

    try {
      // Get customer info
      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .select('id')
        .eq('email', userInfo.email)
        .single();

      if (customerError) throw customerError;

      let currentConversationId = conversationId;

      // Create AI conversation if it doesn't exist
      if (!currentConversationId) {
        const { data: newConversation, error: conversationError } = await supabase
          .from('conversations')
          .insert([{
            customer_id: customer.id,
            organizations_id: '645d0512-984f-4a3a-b625-5b429b24291e',
            channels: 'Website',
            status: 'AI_Chat'
          }])
          .select()
          .single();

        if (conversationError) throw conversationError;
        currentConversationId = newConversation.id;
        setConversationId(newConversation.id);
        localStorage.setItem('chatConversationId', newConversation.id);
      }

      // Store customer message - messages will be added via subscription
      await supabase.from('messages').insert([{
        content: message,
        conversations_id: currentConversationId,
        organizations_id: '645d0512-984f-4a3a-b625-5b429b24291e',
        sender_id: customer.id,
        sender_type: 'customer'
      }]);

      setMessage(''); // Clear input
      setIsAiTyping(true);

      // Get AI response
      const similarResponse = await fetch(`${import.meta.env.VITE_API_URL}/ai/search-similar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: message,
          organizationId: '645d0512-984f-4a3a-b625-5b429b24291e'
        }),
      });

      const similarData = await similarResponse.json();
      let aiResponse;

      if (similarData.articles && similarData.articles.length > 0) {
        setFailedAttempts(0);
        
        const aiResponseData = await fetch(`${import.meta.env.VITE_API_URL}/ai/generate-response`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            question: message,
            articleContent: similarData.articles[0].content
          }),
        });

        const { response } = await aiResponseData.json();
        aiResponse = response;
      } else {
        const newFailedAttempts = failedAttempts + 1;
        setFailedAttempts(newFailedAttempts);

        if (newFailedAttempts >= 3) {
          aiResponse = "I notice I haven't been able to fully address your questions. Let me connect you with a CHANEL Client Care Advisor who can better assist you.";
        } else {
          aiResponse = "I apologize, but I don't have specific information about that. Would you like me to connect you with a CHANEL Client Care Advisor who can better assist you?";
        }
      }

      // Store AI response - will be added via subscription
      await supabase.from('messages').insert([{
        content: aiResponse,
        conversations_id: currentConversationId,
        organizations_id: '645d0512-984f-4a3a-b625-5b429b24291e',
        sender_id: 'ai-agent',
        sender_type: 'agent'
      }]);

      setIsAiTyping(false);

      if (failedAttempts >= 2) {
        setTimeout(() => {
          handleHumanHandoff();
        }, 1000);
      }

    } catch (error) {
      console.error('Error sending message:', error);
      setIsAiTyping(false);
      alert('Error sending message. Please try again.');
    }
  };

  const handleLogout = () => {
    setShowRatingModal(true);
  };

  const handleFinalLogout = async (skipRating: boolean = false) => {
    if (!skipRating && !rating) {
      alert('Please select a rating before leaving');
      return;
    }

    try {
      if (!skipRating && rating && conversationId) {
        setIsSubmittingRating(true);
        const { error } = await supabase
          .from('conversations')
          .update({ satisfaction_score: rating.toString() })
          .eq('id', conversationId);

        if (error) throw error;
      }
    } catch (error) {
      console.error('Error saving rating:', error);
    } finally {
      setIsSubmittingRating(false);
      localStorage.removeItem('chatUserInfo');
      localStorage.removeItem('chatConversationId');
      setUserInfo(null);
      setConversationId(null);
      setMessages([]);
      setIsOpen(false);
      setShowRatingModal(false);
    }
  };

  // Update the message subscription effect
  useEffect(() => {
    if (!conversationId) return;

    // Load existing messages first
    const loadMessages = async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversations_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error loading messages:', error);
        return;
      }

      if (data) {
        // Replace all messages instead of merging
        setMessages(data.map(msg => ({
          id: msg.id,
          content: msg.content,
          created_at: msg.created_at,
          sender_type: msg.sender_type as MessageType,
          is_typing: false
        })));
      }
    };

    loadMessages();

    // Create subscription to new messages
    const channel = supabase
      .channel(`messages-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversations_id=eq.${conversationId}`
        },
        (payload) => {
          // Only add new messages that aren't from the current user's session
          if (!payload.new.id.toString().startsWith('local-')) {
            setMessages(prevMessages => {
              // Only add if not already in the list
              const exists = prevMessages.some(m => m.id === payload.new.id);
              if (exists) return prevMessages;
              
              return [...prevMessages, {
                id: payload.new.id,
                content: payload.new.content,
                created_at: payload.new.created_at,
                sender_type: payload.new.sender_type as MessageType,
                is_typing: false
              }];
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  // Add a test button temporarily
  const testSimilarity = async () => {
    try {
      const response = await fetch('/api/ai/search-similar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: "How do I return an item?",
          organizationId: "645d0512-984f-4a3a-b625-5b429b24291e" // Your org ID
        }),
      });
      const data = await response.json();
      console.log('Similar articles:', data);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  // Add typing indicator component
  const TypingIndicator = () => (
    <div className="flex items-center space-x-2 p-3 bg-white border border-black rounded-lg">
      <div className="flex space-x-1">
        <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
        <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
        <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
      </div>
      <span className="text-sm text-gray-500">Agent Dali is typing...</span>
    </div>
  );

  return (
    <div 
      className="min-h-screen bg-cover bg-center bg-no-repeat"
      style={{ 
        backgroundImage: 'url("/chanel-hero.jpg")',
        backgroundBlendMode: 'overlay'
      }}
    >
      {/* Header */}
      <header className="p-6">
        <div className="container mx-auto">
          <h1 className="text-4xl font-bold tracking-wider text-center text-black">
            CHANEL
          </h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Add any additional content here */}
      </main>

      {/* Floating Chat Widget */}
      <div className="fixed bottom-4 right-4 z-50">
        {/* Chat Button */}
        {!isOpen && (
          <button
            onClick={() => setIsOpen(true)}
            className="bg-black text-[#FFFFF0] p-4 rounded-full shadow-lg hover:bg-neutral-800 transition-colors"
          >
            <IconMessage size={24} />
          </button>
        )}

        {/* Chat Window */}
        {isOpen && (
          <div className="bg-[#FFFFF0] w-96 h-[500px] rounded-lg shadow-xl flex flex-col border border-black">
            {/* Chat Header */}
            <div className="p-4 border-b border-black flex justify-between items-center bg-black text-[#FFFFF0] rounded-t-lg">
              <h3 className="font-semibold">Chat with CHANEL</h3>
              <div className="flex gap-2">
                {userInfo && (
                  <button
                    onClick={handleLogout}
                    className="hover:bg-neutral-800 p-1 rounded text-sm"
                  >
                    Logout
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="hover:bg-neutral-800 p-1 rounded"
                >
                  <IconX size={20} />
                </button>
              </div>
            </div>

            {/* User Info Form or Chat Interface */}
            {!userInfo ? (
              <div className="flex-1 p-4">
                <form onSubmit={handleSubmitUserInfo} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-black mb-1">
                      Full Name
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        value={formData.fullName}
                        onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                        className="w-full pl-10 pr-3 py-2 border border-black rounded focus:outline-none focus:ring-2 focus:ring-black bg-[#FFFFF0]"
                        placeholder="Enter your full name"
                      />
                      <IconUser className="absolute left-3 top-2.5 text-black" size={20} />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-black mb-1">
                      Email Address
                    </label>
                    <div className="relative">
                      <input
                        type="email"
                        required
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full pl-10 pr-3 py-2 border border-black rounded focus:outline-none focus:ring-2 focus:ring-black bg-[#FFFFF0]"
                        placeholder="Enter your email"
                      />
                      <IconMail className="absolute left-3 top-2.5 text-black" size={20} />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-black text-[#FFFFF0] py-2 rounded hover:bg-neutral-800 transition-colors"
                  >
                    Start Chat
                  </button>
                </form>
              </div>
            ) : (
              <>
                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto p-4">
                  {/* Status indicator */}
                  {conversationStatus !== 'New' && (
                    <div className="text-center mb-4">
                      <span className={`text-xs px-2 py-1 rounded ${
                        conversationStatus === 'Active' ? 'bg-green-100 text-green-800' :
                        conversationStatus === 'Pending_Handoff' ? 'bg-yellow-100 text-yellow-800' :
                        conversationStatus === 'Handed_Off' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {conversationStatus.replace('_', ' ')}
                      </span>
                    </div>
                  )}

                  {/* Messages with handoff button */}
                  {messages.map((msg, index) => (
                    <div key={`${msg.id}-${index}`}>
                      <div className={`mb-2 ${
                        msg.sender_type === 'customer' ? 'ml-auto' : 'mr-auto'
                      } max-w-[80%]`}>
                        <div className={`rounded-lg p-3 ${
                          msg.sender_type === 'customer'
                            ? 'bg-black text-[#FFFFF0] ml-auto'
                            : msg.sender_type === 'system'
                            ? 'bg-gray-100 border border-gray-300'
                            : 'bg-white border border-black'
                        }`}>
                          <p>{msg.content}</p>
                          {msg.sender_type === 'agent' && 
                           msg.content.includes("Would you like me to connect you with a CHANEL Client Care Advisor") && 
                           conversationStatus === 'Active' && (
                            <button
                              onClick={handleHumanHandoff}
                              disabled={isHandingOff}
                              className="mt-2 text-sm px-3 py-1 bg-black text-[#FFFFF0] rounded hover:bg-neutral-800 transition-colors disabled:opacity-50"
                            >
                              {isHandingOff ? 'Connecting...' : 'Connect to Human Agent'}
                            </button>
                          )}
                        </div>
                        <div className={`text-xs mt-1 text-gray-500 ${
                          msg.sender_type === 'customer' ? 'text-right' : 'text-left'
                        }`}>
                          {new Date(msg.created_at).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  ))}
                  {isAiTyping && (
                    <div className="mr-auto max-w-[80%] mb-2">
                      <TypingIndicator />
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-4 border-t border-black">
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      placeholder="Type your message..."
                      className="flex-1 px-3 py-2 rounded border border-black focus:outline-none focus:ring-2 focus:ring-black bg-[#FFFFF0]"
                    />
                    <button
                      onClick={handleSendMessage}
                      className="bg-black text-[#FFFFF0] p-2 rounded hover:bg-neutral-800 transition-colors"
                    >
                      <IconSend size={20} />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Rating Modal */}
      {showRatingModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-[#FFFFF0] p-6 rounded-lg shadow-xl max-w-md w-full mx-4">
            <h3 className="text-xl font-semibold text-center mb-4">
              How satisfied were you with our service?
            </h3>
            <div className="flex justify-center space-x-2 mb-6">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setRating(star)}
                  className="text-3xl focus:outline-none transition-colors"
                >
                  {star <= rating ? '★' : '☆'}
                </button>
              ))}
            </div>
            <div className="flex justify-center space-x-4">
              <button
                onClick={() => handleFinalLogout(true)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
                disabled={isSubmittingRating}
              >
                Skip
              </button>
              <button
                onClick={() => handleFinalLogout(false)}
                className="px-4 py-2 bg-black text-[#FFFFF0] rounded hover:bg-neutral-800"
                disabled={isSubmittingRating}
              >
                {isSubmittingRating ? 'Submitting...' : 'Submit & Close'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Chanel; 