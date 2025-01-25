import { useNavigate, useParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import supabase from '../supabase';

type Article = {
  id: string;
  title: string;
  description: string;
  content: string;
  is_public: boolean;
  is_published: boolean;
  created_at: string;
  collection_id: string;
  organizations_id: string;
  collections: Array<{
    id: string;
    title: string;
  }>;
};

const ArticleView = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [article, setArticle] = useState<Article | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchArticle = async () => {
      if (!id) return;

      try {
        setIsLoading(true);
        setError(null);
        
        const { data: articleData, error: fetchError } = await supabase
          .from('articles')
          .select(`
            id,
            title,
            description,
            content,
            is_public,
            is_published,
            created_at,
            collection_id,
            organizations_id,
            collections (
              id,
              title
            )
          `)
          .eq('id', id)
          .eq('organizations_id', '645d0512-984f-4a3a-b625-5b429b24291e')
          .eq('is_public', true)
          .eq('is_published', true)
          .maybeSingle();

        if (fetchError) {
          setError('An error occurred while fetching the article');
          return;
        }

        if (!articleData) {
          setError('Article not found or is not publicly available');
          return;
        }

        setArticle(articleData);
      } catch (err) {
        setError('An unexpected error occurred');
      } finally {
        setIsLoading(false);
      }
    };

    fetchArticle();
  }, [id]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-[#1a1a1a]">Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white">
        <header className="p-6">
          <div className="container mx-auto">
            <h1 className="text-4xl font-bold tracking-wider text-center text-[#1a1a1a] mb-12">
              CHANEL
            </h1>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8">
          <div className="max-w-3xl mx-auto text-center">
            <button 
              onClick={() => navigate('/knowledge/help/preview')}
              className="text-[#6b6b6b] hover:text-[#1a1a1a] mb-8 inline-flex items-center"
            >
              ← Back to Help Center
            </button>
            <div className="bg-[#f5f5f5] rounded-lg p-8">
              <h2 className="text-2xl font-semibold text-[#1a1a1a] mb-4">
                {error}
              </h2>
              <p className="text-[#6b6b6b]">
                Please check the URL or try accessing the article through the Help Center.
              </p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!article) {
    return null;
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
          {/* Navigation */}
          <div className="mb-8">
            <button 
              onClick={() => navigate(`/knowledge/help/preview/collection/${article.collection_id}`)}
              className="text-[#6b6b6b] hover:text-[#1a1a1a] mb-4"
            >
              ← Back to {article.collections[0]?.title || 'Collection'}
            </button>
          </div>

          {/* Article Content */}
          <article className="prose prose-lg max-w-none">
            <h1 className="text-3xl font-semibold text-[#1a1a1a] mb-4">
              {article.title}
            </h1>
            {article.description && (
              <p className="text-xl text-[#6b6b6b] mb-8">
                {article.description}
              </p>
            )}
            <div className="text-[#1a1a1a] whitespace-pre-wrap">
              {article.content}
            </div>
          </article>
        </div>
      </main>
    </div>
  );
};

export default ArticleView; 