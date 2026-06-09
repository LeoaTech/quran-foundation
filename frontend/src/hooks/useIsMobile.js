import { useEffect, useState } from 'react';

export function useIsMobile(bp = 768) {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= bp);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= bp);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [bp]);

  return isMobile;
}


