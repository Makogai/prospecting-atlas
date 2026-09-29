import { Link } from 'react-router-dom';

export function NotFound() {
  return (
    <div className="grid place-items-center py-24 text-center">
      <div>
        <p className="numeric text-6xl font-black text-ore-400">404</p>
        <h1 className="mt-3 text-2xl font-extrabold">Nothing panned out here.</h1>
        <p className="mt-2 text-ink-400">That page isn’t in the atlas.</p>
        <Link
          to="/"
          className="mt-6 inline-block rounded-xl bg-ore-400 px-5 py-2.5 text-sm font-bold text-rock-950 transition hover:bg-ore-300"
        >
          Back to the surface
        </Link>
      </div>
    </div>
  );
}
