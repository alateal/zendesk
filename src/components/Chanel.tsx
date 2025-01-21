import { useState, useEffect } from 'react';
import { IconMessage, IconX, IconSend, IconUser, IconMail } from '@tabler/icons-react';
import supabase from '../supabase';

type UserInfo = {
  fullName: string;
  email: string;
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
  const [messages, setMessages] = useState<Array<{
    id: string;
    content: string;
    created_at: string;
    sender_type: string;
  }>>([]);

  const handleSubmitUserInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // First check if customer exists
      const { data: existingCustomer, error: searchError } = await supabase
        .from('customers')
        .select('*')
        .eq('email', formData.email)
        .single();

      if (searchError && searchError.code !== 'PGRST116') { // PGRST116 is "not found" error
        throw searchError;
      }

      let customerData;
      
      if (existingCustomer) {
        // Use existing customer data
        customerData = existingCustomer;
      } else {
        // Create new customer
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

      // Set user info for chat
      setUserInfo({
        fullName: customerData.full_name,
        email: customerData.email
      });

    } catch (error) {
      console.error('Error handling customer info:', error);
      alert('Error saving your information. Please try again.');
    }
  };

  const handleSendMessage = async () => {
    if (!message.trim() || !userInfo) return;

    try {
      // First, get customer_id using email
      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .select('id')
        .eq('email', userInfo.email)
        .single();

      if (customerError) throw customerError;

      let currentConversationId = conversationId;

      // If no conversation exists, create one
      if (!currentConversationId) {
        const { data: newConversation, error: conversationError } = await supabase
          .from('conversations')
          .insert([{
            customer_id: customer.id,
            organizations_id: '645d0512-984f-4a3a-b625-5b429b24291e',
            channels: 'Website',
            status: 'New'
          }])
          .select()
          .single();

        if (conversationError) throw conversationError;
        currentConversationId = newConversation.id;
        setConversationId(newConversation.id);
      }

      // Send the message
      const { error: messageError } = await supabase
        .from('messages')
        .insert([{
          content: message,
          conversations_id: currentConversationId,
          organizations_id: '645d0512-984f-4a3a-b625-5b429b24291e',
          sender_id: customer.id,
          sender_type: 'customer'
        }]);

      if (messageError) throw messageError;
      
      // Clear the input after successful send
      setMessage('');

    } catch (error) {
      console.error('Error sending message:', error);
      alert('Error sending message. Please try again.');
    }
  };

  useEffect(() => {
    if (!conversationId) return;

    // Load existing messages
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

      if (data) setMessages(data);
    };

    loadMessages();

    // Subscribe to new messages
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
          setMessages(current => [...current, payload.new]);
        }
      )
      .subscribe();

    // Cleanup subscription
    return () => {
      channel.unsubscribe();
    };
  }, [conversationId]);

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
              <button
                onClick={() => setIsOpen(false)}
                className="hover:bg-neutral-800 p-1 rounded"
              >
                <IconX size={20} />
              </button>
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
                  {/* Welcome message */}
                  <div className="bg-white rounded-lg p-3 mb-2 border border-black">
                    <p className="text-black">
                      Welcome {userInfo.fullName}! How can we assist you today?
                    </p>
                  </div>
                  
                  {/* Chat messages */}
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`mb-2 ${
                        msg.sender_type === 'customer' ? 'ml-auto' : 'mr-auto'
                      } max-w-[80%]`}
                    >
                      <div
                        className={`rounded-lg p-3 ${
                          msg.sender_type === 'customer'
                            ? 'bg-black text-[#FFFFF0] ml-auto'
                            : 'bg-white border border-black'
                        }`}
                      >
                        <p>{msg.content}</p>
                      </div>
                      <div className={`text-xs mt-1 text-gray-500 ${
                        msg.sender_type === 'customer' ? 'text-right' : 'text-left'
                      }`}>
                        {new Date(msg.created_at).toLocaleTimeString()}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Input Area */}
                <div className="p-4 border-t border-black">
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
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
    </div>
  );
};

export default Chanel; 