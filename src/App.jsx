import { createContext, useContext, useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { useData } from './data.js';
import Header from './components/Header.jsx';
import { AuthProvider } from './auth.jsx';
import Footer from './components/Footer.jsx';
import Home from './pages/Home.jsx';
import Stats from './pages/Stats.jsx';
import Player from './pages/Player.jsx';
import Match from './pages/Match.jsx';
import Results from './pages/Results.jsx';
import Players from './pages/Players.jsx';
import Glossary from './pages/Glossary.jsx';
import About from './pages/About.jsx';
import NotFound from './pages/NotFound.jsx';
import BackToTop from './components/BackToTop.jsx';
import { lazy, Suspense } from 'react';

const Ask = lazy(() => import('./pages/Ask.jsx'));
const Privacy = lazy(() => import('./pages/Privacy.jsx'));

const MetaContext = createContext(null);
export const useMeta = () => useContext(MetaContext);
export const useComp = (id) => {
  const meta = useMeta();
  return meta && meta.competitions.find((c) => c.id === id);
};

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

export default function App() {
  const { data: meta, error } = useData('meta.json');

  return (
    <AuthProvider>
    <MetaContext.Provider value={meta}>
      <ScrollToTop />
      <Header />
      <main id="main">
        {error ? (
          <div className="page">
            <p className="notice">The stats could not be loaded. Check your connection and reload the page.</p>
          </div>
        ) : !meta ? (
          <div className="page"><p className="loading">Loading stats…</p></div>
        ) : (
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/stats/:comp" element={<Stats />} />
            <Route path="/stats/:comp/:tab" element={<Stats />} />
            <Route path="/players" element={<Players />} />
            <Route path="/player/:id" element={<Player />} />
            <Route path="/results" element={<Results />} />
            <Route path="/match/:id" element={<Match />} />
            <Route path="/ask" element={<Suspense fallback={<div className="page"><p className="loading">Loading…</p></div>}><Ask /></Suspense>} />
            <Route path="/privacy" element={<Suspense fallback={<div className="page"><p className="loading">Loading…</p></div>}><Privacy /></Suspense>} />
            <Route path="/glossary" element={<Glossary />} />
            <Route path="/about" element={<About />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        )}
      </main>
      <BackToTop />
      <Footer />
    </MetaContext.Provider>
    </AuthProvider>
  );
}
