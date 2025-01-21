import { useState } from 'react';
import { IconMessage, IconX, IconSend, IconUser, IconMail } from '@tabler/icons-react';

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

  const handleSubmitUserInfo = (e: React.FormEvent) => {
    e.preventDefault();
    setUserInfo(formData);
  };

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