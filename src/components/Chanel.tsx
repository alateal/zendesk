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

// Update conversation status type
type ConversationStatus = 'New' | 'AI_Chat' | 'Pending_Handoff' | 'Active' | 'Closed';

// Define valid status transitions with assignment states
const STATUS_TRANSITIONS = {
  New: { next: ['AI_Chat', 'Closed'], assignment: { is_assigned: true, assigned_to: 'ai-dali' } },
  AI_Chat: { next: ['Pending_Handoff', 'Closed'], assignment: { is_assigned: true, assigned_to: 'ai-dali' } },
  Pending_Handoff: { next: ['Active', 'Closed'], assignment: { is_assigned: false, assigned_to: null } },
  Active: { next: ['Closed'], assignment: null },
  Closed: { next: [], assignment: null }
} as const;

type ConversationUpdate = {
  status?: ConversationStatus;
  satisfaction_score?: string;
  closed_at?: string;
  assigned_to?: string | null;
  is_assigned?: boolean;
};

interface Conversation {
  id: string;
  status: ConversationStatus;
  customer_id: string;
  agent_id?: string;
  created_at: string;
}

// Add this function near the top of the file, after the type definitions
const getStatusMessage = (status: ConversationStatus): string => {
  switch (status) {
    case 'AI_Chat':
      return 'Chat started with Ai Dali';
    case 'Pending_Handoff':
      return 'Connecting to a CHANEL Client Care Advisor...';
    case 'Active':
      return 'A CHANEL Client Care Advisor has joined the chat';
    case 'Closed':
      return 'Chat session ended';
    default:
      return '';
  }
};

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
      const initialGreeting = `Hello ${userInfo.fullName}! I'm Ai Dali, CHANEL's virtual assistant. How may I assist you today?`;
      
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

  const handleConversationUpdate = async (
    conversationId: string,
    updates: ConversationUpdate
  ) => {
    try {
      // Get current status to determine proper transition
      const { data: currentConv } = await supabase
        .from('conversations')
        .select('status')
        .eq('id', conversationId)
        .single();

      if (!currentConv) throw new Error('Conversation not found');

      // Get assignment details for the new status
      const statusTransition = STATUS_TRANSITIONS[currentConv.status as keyof typeof STATUS_TRANSITIONS];
      const newStatus = updates.status;

      if (newStatus && !statusTransition.next.includes(newStatus)) {
        throw new Error(`Invalid status transition from ${currentConv.status} to ${newStatus}`);
      }

      // Merge assignment details if status is changing
      const finalUpdates = {
        ...updates,
        ...(newStatus && STATUS_TRANSITIONS[newStatus].assignment 
            ? STATUS_TRANSITIONS[newStatus].assignment 
            : {})
      };

      const { error } = await supabase
        .from('conversations')
        .update(finalUpdates)
        .eq('id', conversationId);

      if (error) throw error;

      // Add system message for status changes
      if (updates.status) {
        await supabase.from('messages').insert([{
          conversations_id: conversationId,
          organizations_id: '645d0512-984f-4a3a-b625-5b429b24291e',
          sender_id: 'system',
          sender_type: 'system',
          content: getStatusMessage(updates.status)
        }]);
      }
    } catch (error) {
      console.error('Error updating conversation:', error);
      throw error;
    }
  };

  const handleHumanHandoff = async () => {
    if (!userInfo || !conversationId) return;
    
    try {
      setIsHandingOff(true);

      // Update conversation status to Pending_Handoff
      await handleConversationUpdate(conversationId, {
        status: 'Pending_Handoff',
        is_assigned: false
      });

      // Add system message
      await supabase.from('messages').insert([{
        content: 'Connecting you to a CHANEL Client Care Advisor...',
        conversations_id: conversationId,
        organizations_id: '645d0512-984f-4a3a-b625-5b429b24291e',
        sender_id: 'system',
        sender_type: 'system'
      }]);

      setConversationStatus('Pending_Handoff');

    } catch (error) {
      console.error('Error in human handoff:', error);
      alert('Unable to connect to a human agent at this time.');
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

      // Store customer message
      await supabase.from('messages').insert([{
        content: message,
        conversations_id: currentConversationId,
        organizations_id: '645d0512-984f-4a3a-b625-5b429b24291e',
        sender_id: customer.id,
        sender_type: 'customer'
      }]);

      setMessage(''); // Clear input
      setIsAiTyping(true);

      try {
        // Check for thank you message first
        const thankYouResponse = await fetch(`${import.meta.env.VITE_API_URL}/ai/chat-deflection`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            question: message,
            articleContent: ''  // Empty for thank you check
          })
        });

        if (!thankYouResponse.ok) {
          throw new Error(`Thank you check failed: ${thankYouResponse.statusText}`);
        }

        const { response: aiResponse } = await thankYouResponse.json();

        // If it's a thank you message, store the farewell and return
        if (aiResponse === "Thank you for contacting us. Hope you have a nice day!") {
          await supabase.from('messages').insert([{
            content: aiResponse,
            conversations_id: currentConversationId,
            organizations_id: '645d0512-984f-4a3a-b625-5b429b24291e',
            sender_id: 'ai-agent',
            sender_type: 'agent'
          }]);
          setIsAiTyping(false);  // Stop typing indicator
          return;
        }

        // If not a thank you message, proceed with article search
        const similarResponse = await fetch(`${import.meta.env.VITE_API_URL}/ai/search-similar`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: message,
            organizationId: '645d0512-984f-4a3a-b625-5b429b24291e'
          }),
        });

        if (!similarResponse.ok) {
          throw new Error(`Similar search failed: ${similarResponse.statusText}`);
        }

        const similarData = await similarResponse.json();
        let aiResponseData;

        if (similarData.articles && similarData.articles.length > 0) {
          setFailedAttempts(0);
          
          aiResponseData = await fetch(`${import.meta.env.VITE_API_URL}/ai/generate-response`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              question: message,
              articleContent: similarData.articles[0].content
            }),
          });

          if (!aiResponseData.ok) {
            throw new Error(`AI response generation failed: ${aiResponseData.statusText}`);
          }

          const responseJson = await aiResponseData.json();
          const aiResponse = responseJson.response;

          // Store AI response
          if (aiResponse) {
            await supabase.from('messages').insert([{
              content: aiResponse,
              conversations_id: currentConversationId,
              organizations_id: '645d0512-984f-4a3a-b625-5b429b24291e',
              sender_id: 'ai-agent',
              sender_type: 'agent'
            }]);
            setIsAiTyping(false);  // Stop typing indicator after response is stored
          }
        } else {
          // No articles found - deflect to human agent
          aiResponseData = "I apologize, but I don't have enough information to help with your specific query. Would you like to connect with a CHANEL Client Care Advisor? Click the button below to connect.";
          
          // Store AI response with button
          await supabase.from('messages').insert([{
            content: aiResponseData,
            conversations_id: currentConversationId,
            organizations_id: '645d0512-984f-4a3a-b625-5b429b24291e',
            sender_id: 'ai-agent',
            sender_type: 'agent'
          }]);

          // Add system message with connect button
          await supabase.from('messages').insert([{
            content: 'CONNECT_TO_AGENT_BUTTON',  // Special content to render as button
            conversations_id: currentConversationId,
            organizations_id: '645d0512-984f-4a3a-b625-5b429b24291e',
            sender_id: 'system',
            sender_type: 'system'
          }]);

          setIsAiTyping(false);
          return;  // Return early since we've already stored the messages
        }

      } catch (error) {
        console.error('Error:', error);
        setIsAiTyping(false);  // Stop typing indicator on error
      }
    } catch (error) {
      // ... rest of your error handling
    }
  };

  const handleLogout = () => {
    setShowRatingModal(true);
  };

  const handleFinalLogout = async (skip: boolean = false) => {
    try {
      setIsSubmittingRating(true);

      if (conversationId) {
        // Check current conversation status
        const { data: currentConv } = await supabase
          .from('conversations')
          .select('status')
          .eq('id', conversationId)
          .single();

        // Only update if not already closed
        if (currentConv && currentConv.status !== 'Closed') {
          const updates: ConversationUpdate = {
            status: 'Closed'
          };

          // Only add satisfaction score if rating was provided
          if (!skip && rating > 0) {
            updates.satisfaction_score = rating.toString();
          }

          await handleConversationUpdate(conversationId, updates);
        }
      }

      // Clear local storage and reset states
      localStorage.removeItem('chatConversationId');
      localStorage.removeItem('chatUserInfo');
      setUserInfo(null);
      setConversationId(null);
      setMessages([]);
      setShowRatingModal(false);
      setRating(0);
      setIsOpen(false);
      setConversationStatus('New');

    } catch (error) {
      console.error('Error closing conversation:', error);
      alert('Error updating conversation. Please try again.');
    } finally {
      setIsSubmittingRating(false);
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
        setMessages(prevMessages => {
          // Get the greeting message if it exists
          const greetingMessage = prevMessages.find(m => m.id === 'greeting');
          
          // Convert database messages to our Message type
          const newMessages = data.map(msg => ({
            id: msg.id,
            content: msg.content,
            created_at: msg.created_at,
            sender_type: msg.sender_type as MessageType,
            is_typing: false
          }));

          // Combine messages in the correct order
          const allMessages = greetingMessage 
            ? [greetingMessage, ...newMessages]
            : newMessages;

          // Remove any duplicates while preserving order
          return allMessages.filter((msg, index, self) =>
            index === self.findIndex((m) => m.id === msg.id)
          );
        });
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
          setMessages(prevMessages => {
            // Check if message already exists
            const exists = prevMessages.some(m => m.id === payload.new.id);
            if (exists) return prevMessages;

            // Get the greeting message if it exists
            const greetingMessage = prevMessages.find(m => m.id === 'greeting');
            
            // Create the new message
            const newMessage = {
              id: payload.new.id,
              content: payload.new.content,
              created_at: payload.new.created_at,
              sender_type: payload.new.sender_type as MessageType,
              is_typing: false
            };

            // Get all non-greeting messages
            const otherMessages = prevMessages.filter(m => m.id !== 'greeting');

            // Combine all messages in the correct order
            const allMessages = greetingMessage 
              ? [greetingMessage, ...otherMessages, newMessage]
              : [...otherMessages, newMessage];

            // Remove any duplicates while preserving order
            return allMessages.filter((msg, index, self) =>
              index === self.findIndex((m) => m.id === msg.id)
            );
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  // Update real-time subscription for conversation status
  useEffect(() => {
    if (!conversationId) return;

    const conversationSubscription = supabase
      .channel('conversation-status')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'conversations',
          filter: `id=eq.${conversationId}`
        },
        (payload) => {
          const newStatus = payload.new.status as ConversationStatus;
          setConversationStatus(newStatus);
          
          // Handle different status changes
          switch (newStatus) {
            case 'Handed_Off':
              // Show message that agent has joined
              setMessages(prev => [...prev, {
                id: 'system-handoff',
                content: 'A CHANEL Client Care Advisor has joined the conversation.',
                created_at: new Date().toISOString(),
                sender_type: 'system'
              }]);
              break;
            
            case 'Closed':
              // Clean up UI
              setShowRatingModal(false);
              setRating(0);
              setIsOpen(false);
              break;
          }
        }
      )
      .subscribe();

    return () => {
      conversationSubscription.unsubscribe();
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
    <div className="flex items-center space-x-2 p-4 bg-white border border-black rounded-lg">
      <div className="flex space-x-1">
        <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
        <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
        <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
      </div>
      <span className="text-base text-gray-500">Ai Dali is typing...</span>
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
                  {messages.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.sender_type === 'customer' ? 'justify-end' : 'justify-start'} mb-4`}>
                      <div className={`max-w-[80%] p-4 rounded-lg ${
                        msg.sender_type === 'customer' ? 'bg-black text-[#FFFFF0]' : 'bg-white border border-black'
                      }`}>
                        {msg.content === 'CONNECT_TO_AGENT_BUTTON' ? (
                          <button
                            onClick={handleHumanHandoff}
                            disabled={isHandingOff}
                            className="bg-black text-[#FFFFF0] px-4 py-2 rounded hover:bg-neutral-800 transition-colors disabled:opacity-50 text-base"
                          >
                            {isHandingOff ? 'Connecting...' : 'Connect to Agent'}
                          </button>
                        ) : (
                          <p className="text-base leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                        )}
                      </div>
                    </div>
                  ))}
                  {isAiTyping && (
                    <div className="flex justify-start mb-4">
                      <div className="mr-auto max-w-[80%]">
                        <TypingIndicator />
                      </div>
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
                      className="flex-1 px-4 py-3 text-base rounded border border-black focus:outline-none focus:ring-2 focus:ring-black bg-[#FFFFF0]"
                    />
                    <button
                      onClick={() => handleSendMessage()}
                      className="bg-black text-[#FFFFF0] p-3 rounded hover:bg-neutral-800 transition-colors"
                    >
                      <IconSend size={24} />
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