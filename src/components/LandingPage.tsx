import { useState } from 'react'
import { Link } from 'react-router-dom'

const LandingPage = () => {
  const [email, setEmail] = useState('')

  return (
    <div className="min-h-screen bg-[#FDF6E3] text-[#3C1810]">
      {/* Navigation */}
      <nav className="flex justify-between items-center px-6 py-4 border-b border-[#8B4513]">
        <div className="flex items-center">
          <div className="text-2xl font-bold mr-8 text-[#3C1810]">Handlebar</div>
          <div className="hidden md:flex space-x-6">
            <a href="#" className="hover:text-[#8B4513]">Products</a>
            <a href="#" className="hover:text-[#8B4513]">Pricing</a>
            <a href="#" className="hover:text-[#8B4513]">Solutions</a>
            <a href="#" className="hover:text-[#8B4513]">Demo</a>
            <a href="#" className="hover:text-[#8B4513]">Resources</a>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <Link to="/signin" className="hover:text-[#8B4513]">
            Sign in
          </Link>
          <button className="bg-[#8B4513] text-[#FDF6E3] px-6 py-2 rounded-full hover:bg-[#5C2E0E]">
            Free trial
          </button>
          <button className="border border-[#8B4513] text-[#3C1810] px-6 py-2 rounded-full hover:bg-[#F5E6D3]">
            Demo
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="container mx-auto px-6 py-20 flex flex-col md:flex-row items-center">
        <div className="md:w-1/2 mb-10 md:mb-0">
          <h1 className="text-6xl font-serif mb-6 text-[#3C1810]">
            AI-first service.
            <br />
            Catered to
            <br />
            humans.
          </h1>
          <p className="text-xl mb-8 text-[#5C2E0E] max-w-lg">
            Customers and employees are more than interactions, they're human.
            Give them faster, more personalized experiences using AI trained in
            the art of customer service.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <input
              type="email"
              placeholder="Enter work email"
              className="flex-grow px-4 py-3 rounded-lg border border-[#8B4513] focus:outline-none focus:ring-2 focus:ring-[#8B4513] bg-[#FDF6E3]"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button className="bg-[#8B4513] text-[#FDF6E3] px-8 py-3 rounded-lg hover:bg-[#5C2E0E] transition-colors">
              Start your free trial
            </button>
          </div>
        </div>

        <div className="md:w-1/2">
          <div className="bg-[#FDF6E3] rounded-lg shadow-xl p-6 max-w-md ml-auto border border-[#8B4513]">
            <div className="flex items-center gap-2 mb-4">
              <div className="bg-[#8B4513] text-[#FDF6E3] px-3 py-1 rounded-full text-sm">
                Order #201988
              </div>
              <div className="bg-[#3C1810] text-[#FDF6E3] px-2 py-1 rounded text-xs">
                AI
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 bg-[#3C1810] rounded-sm flex items-center justify-center">
                <div className="w-2 h-2 bg-[#FDF6E3] rounded-full"></div>
              </div>
              <div>
                <p className="font-medium text-[#3C1810]">Processing exchange</p>
                <p className="text-lg text-[#3C1810]">Your new kicks are on the way!</p>
                <p className="text-sm text-[#5C2E0E] mt-2">POWERED BY ZENCLONE AI</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default LandingPage 