import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

// A round "back to top" button that appears once you've scrolled well down a long page
// (results, stats tables, scorecards). Smooth scroll unless the visitor prefers reduced motion.
export default function BackToTop() {
  const { pathname } = useLocation();
  const [show, setShow] = useState(false);
  useEffect(() => {
    let raf = 0;
    const check = () => { raf = 0; setShow(window.scrollY > window.innerHeight * 1.5); };
    const on = () => { if (!raf) raf = requestAnimationFrame(check); };
    window.addEventListener('scroll', on, { passive: true });
    check();
    return () => { window.removeEventListener('scroll', on); if (raf) cancelAnimationFrame(raf); };
  }, []);
  const top = () => {
    const still = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: still ? 'auto' : 'smooth' });
  };
  // Not on Ask: its question box sits at the bottom of the screen where this button would go.
  if (pathname.startsWith('/ask')) return null;
  return (
    <button type="button" className={`to-top${show ? ' show' : ''}`} onClick={top} aria-label="Back to top" tabIndex={show ? 0 : -1} aria-hidden={!show}>
      <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 15.5V4.5M4.8 9.7 10 4.5l5.2 5.2" /></svg>
      <span>Top</span>
    </button>
  );
}
