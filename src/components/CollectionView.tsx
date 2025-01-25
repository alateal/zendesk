import { useNavigate, useParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import supabase from '../supabase';

type Article = {
  id: string;
  title: string;
  description: string;
  is_public: boolean;
  content?: string;
};

type Collection = {
  id: string;
  title: string;
  articles: Article[];
};

const CollectionView = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [collection, setCollection] = useState<Collection | null>(null);

  useEffect(() => {
    const fetchCollection = async () => {
      if (!id) return;

      const { data: collectionData } = await supabase
        .from('collections')
        .select(`
          id,
          title,
          articles (
            id,
            title,
            description,
            is_public,
            content
          )
        `)
        .eq('id', id)
        .single();

      if (collectionData) {
        // Filter to only show public articles
        const publicArticles = collectionData.articles.filter(article => article.is_public);
        setCollection({
          ...collectionData,
          articles: publicArticles
        });
      }
    };

    fetchCollection();
  }, [id]);

  if (!collection) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-[#1a1a1a]">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="p-6">
        <div className="container mx-auto">
          <button 
            onClick={() => navigate('/knowledge/help')}
            className="absolute left-8 top-8 text-[#6b6b6b] hover:text-[#1a1a1a] flex items-center gap-2"
          >
            ← Back to Help Center
          </button>
          <h1 className="text-4xl font-bold tracking-wider text-center text-[#1a1a1a] mb-12">
            CHANEL
          </h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto">
          {/* Collection Header */}
          <div className="mb-8">
            <button 
              onClick={() => navigate('/knowledge/help/preview')}
              className="text-[#6b6b6b] hover:text-[#1a1a1a] mb-4"
            >
              ← Back to Collections
            </button>
            <h2 className="text-3xl font-semibold text-[#1a1a1a]">
              {collection.title}
            </h2>
            <p className="text-[#6b6b6b] mt-2">
              {collection.articles.length} articles
            </p>
          </div>

          {/* Articles List */}
          <div className="space-y-4">
            {collection.articles.map((article) => (
              <div 
                key={article.id}
                className="bg-[#f5f5f5] rounded-lg p-6 hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => navigate(`/knowledge/help/preview/article/${article.id}`)}
              >
                <h3 className="text-lg font-medium text-[#1a1a1a] mb-2">
                  {article.title}
                </h3>
                {article.description && (
                  <p className="text-[#6b6b6b]">
                    {article.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};

export default CollectionView; 