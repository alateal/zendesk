import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import LandingPage from './components/LandingPage'
import SignIn from './components/SignIn'
import SignUp from './components/SignUp'
import Dashboard from './components/Dashboard'
import Chanel from './components/Chanel'
import KnowledgeBase from './components/KnowledgeBase'
import HelpCenterView from './components/HelpCenterView'
import Preview from './components/Preview'
import CollectionView from './components/CollectionView'
import ArticleView from './components/ArticleView'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/signin" element={<SignIn />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/knowledge" element={<KnowledgeBase />} />
        <Route path="/knowledge/help" element={<HelpCenterView />} />
        <Route path="/knowledge/help/preview" element={<Preview />} />
        <Route path="/knowledge/help/preview/collection/:id" element={<CollectionView />} />
        <Route path="/knowledge/help/preview/article/:id" element={<ArticleView />} />
        <Route path="/chanel" element={<Chanel />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
