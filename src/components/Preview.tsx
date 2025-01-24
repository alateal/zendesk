import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import supabase from '../supabase';

type Collection = {
  id: string;
  title: string;
  articles: any[];
};

const Preview = () => {
  const navigate = useNavigate();
  const [collections, setCollections] = useState<Collection[]>([]);

  // Fetch collections data
  useEffect(() => {
    const fetchData = async () => {
      // Get collections with their public articles
      const { data: collectionsData } = await supabase
        .from('collections')
        .select(`
          id,
          title,
          articles (
            id,
            title,
            description,
            is_public
          )
        `)
        .eq('organizations_id', '645d0512-984f-4a3a-b625-5b429b24291e'); // CHANEL org ID

      if (collectionsData) {
        // Filter to only include collections that have public articles
        const collectionsWithPublicArticles = collectionsData.map(collection => ({
          ...collection,
          articles: collection.articles.filter(article => article.is_public)
        })).filter(collection => collection.articles.length > 0);
        
        setCollections(collectionsWithPublicArticles);
      }
    };

    fetchData();
  }, []);

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="p-6">
        <div className="container mx-auto">
          <h1 className="text-4xl font-bold tracking-wider text-center text-[#1a1a1a] mb-12">
            CHANEL
          </h1>
        </div>
      </header>

      {/* Main Content */}
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

        {/* Collections Grid */}
        <div className="max-w-3xl mx-auto">
          <div className="grid grid-cols-1 gap-4">
            {collections.map((collection) => (
              <div 
                key={collection.id}
                className="bg-[#f5f5f5] rounded-lg p-6 hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => navigate(`/knowledge/help/preview/collection/${collection.id}`)}
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
                      {collection.articles.length} articles
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Preview; 