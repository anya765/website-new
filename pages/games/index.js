import { useEffect } from 'react';

export default function GamesRedirect() {
  useEffect(() => {
    window.location.replace('/games.html');
  }, []);
  return null;
}
