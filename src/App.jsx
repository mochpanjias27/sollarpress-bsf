import { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import Nav from './components/Nav.jsx';
import Footer from './components/Footer.jsx';

const Home = lazy(() => import('./pages/Home.jsx'));
const Scheduler = lazy(() => import('./pages/Scheduler.jsx'));
const Methodology = lazy(() => import('./pages/Methodology.jsx'));
const About = lazy(() => import('./pages/About.jsx'));
const Products = lazy(() => import('./pages/Products.jsx'));
const NotFound = lazy(() => import('./pages/NotFound.jsx'));

function ScrollTop() {
  const { pathname, hash } = useLocation();
  useEffect(() => { if (!hash) window.scrollTo(0, 0); }, [pathname, hash]);
  return null;
}

const Loading = () => (
  <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', color: 'var(--tx-3)' }}>Memuat…</div>
);

export default function App() {
  return (
    <>
      <ScrollTop />
      <Nav />
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/scheduler" element={<Scheduler />} />
          <Route path="/metodologi" element={<Methodology />} />
          <Route path="/pemanfaatan" element={<Products />} />
          <Route path="/tentang" element={<About />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
      <Footer />
    </>
  );
}
