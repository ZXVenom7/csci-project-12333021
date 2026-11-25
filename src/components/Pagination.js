/** Compact pager: first, last and the pages around the current one. */
function Pagination({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null;
  const pages = [];
  for (let number = 1; number <= totalPages; number += 1) {
    if (number === 1 || number === totalPages || Math.abs(number - page) <= 1) pages.push(number);
    else if (pages[pages.length - 1] !== '…') pages.push('…');
  }
  return (
    <nav className="pagination" aria-label="Pagination">
      <button type="button" className="page-btn" disabled={page === 1} onClick={() => onChange(page - 1)}>‹ Prev</button>
      {pages.map((item, index) => (item === '…' ? (
        // eslint-disable-next-line react/no-array-index-key
        <span key={`gap-${index}`} className="page-gap">…</span>
      ) : (
        <button type="button" key={item} className={`page-btn ${item === page ? 'active' : ''}`}
          aria-current={item === page ? 'page' : undefined} onClick={() => onChange(item)}>
          {item}
        </button>
      )))}
      <button type="button" className="page-btn" disabled={page === totalPages} onClick={() => onChange(page + 1)}>Next ›</button>
    </nav>
  );
}

export default Pagination;
