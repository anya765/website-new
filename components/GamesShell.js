import Head from 'next/head';

export default function GamesShell({ title, children }) {
  return (
    <div className="games-root">
      <Head>
        <title>{title ? `${title} — games` : 'games'}</title>
      </Head>
      <div className="games-shell">
        <nav className="games-nav">
          <a href="/index.html">home</a>
          <a href="/writing.html">writing</a>
          <a href="/bookshelf.html">bookshelf</a>
          <a href="/games.html">games</a>
          <a href="/email.html">email</a>
        </nav>
        {children}
      </div>
    </div>
  );
}
