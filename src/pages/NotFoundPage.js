import { Link } from 'react-router-dom';
import { usePageTitle } from '../lib/SiteContext';

function NotFoundPage() {
  usePageTitle('Page not found');
  return (
    <div className="content-box empty-state">
      <h2>Page not found</h2>
      <p>The page you are looking for does not exist.</p>
      <Link className="submit-btn link-btn" to="/">Browse available cars</Link>
    </div>
  );
}

export default NotFoundPage;
