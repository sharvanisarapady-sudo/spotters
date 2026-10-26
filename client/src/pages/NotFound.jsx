import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-6">
      <div className="max-w-sm text-center">
        <p className="font-mono text-sm text-spotter-blue">404</p>
        <h1 className="mt-2 font-display font-semibold text-2xl text-navy-950">Page not found</h1>
        <p className="mt-2 text-sm text-gray-500">The page you are looking for does not exist.</p>
        <Link to="/" className="mt-5 inline-block rounded-lg bg-spotter-blue px-4 py-2 text-sm font-medium text-white hover:bg-spotter-blue-dark">
          Go home
        </Link>
      </div>
    </div>
  );
}
