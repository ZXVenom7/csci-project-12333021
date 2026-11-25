import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { FUEL_LABELS, TRANSMISSION_LABELS, formatMoney, formatNumber } from '../lib/format';
import { usePageTitle, useSite } from '../lib/SiteContext';
import Pagination from '../components/Pagination';
import VehicleCard from '../components/VehicleCard';

const PAGE_SIZE = 24;
const FILTER_KEYS = ['q', 'brand', 'category', 'fuelType', 'transmission', 'minYear', 'maxYear', 'minPrice', 'maxPrice', 'maxMileage'];
const SORT_OPTIONS = [
  ['', 'Recommended'],
  ['newest', 'Newest listings'],
  ['price_asc', 'Price: low to high'],
  ['price_desc', 'Price: high to low'],
  ['year_desc', 'Year: newest first'],
  ['mileage_asc', 'Mileage: lowest first'],
  ['power_desc', 'Most powerful'],
];

function InventoryPage() {
  const { settings } = useSite();
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [featured, setFeatured] = useState([]);
  const [facets, setFacets] = useState(null);
  const [error, setError] = useState('');
  const [activeSpec, setActiveSpec] = useState(null);
  const [search, setSearch] = useState(params.get('q') || '');

  usePageTitle('');

  const query = useMemo(() => Object.fromEntries(params.entries()), [params]);
  const queryKey = params.toString();
  const activeFilters = FILTER_KEYS.filter((key) => query[key]).length;
  const [filtersOpen, setFiltersOpen] = useState(activeFilters > (query.q ? 1 : 0));

  useEffect(() => {
    let cancelled = false;
    setError('');
    api.get('/vehicles', { ...query, pageSize: PAGE_SIZE })
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((failure) => {
        if (!cancelled) setError(failure.message);
      });
    return () => {
      cancelled = true;
    };
    // queryKey is the serialised form of `query`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryKey]);

  useEffect(() => {
    api.get('/vehicles/facets').then(setFacets).catch(() => {});
    api.get('/vehicles', { featured: 'true', pageSize: 6 }).then((result) => setFeatured(result.items)).catch(() => {});
  }, []);

  const update = (changes) => {
    const next = new URLSearchParams(params);
    Object.entries(changes).forEach(([key, value]) => {
      if (value === '' || value === null || value === undefined) next.delete(key);
      else next.set(key, value);
    });
    if (!('page' in changes)) next.delete('page');
    setParams(next, { replace: true });
    setActiveSpec(null);
  };

  // Search as you type, without a request per keystroke.
  useEffect(() => {
    if (search === (params.get('q') || '')) return undefined;
    const timer = window.setTimeout(() => update({ q: search.trim() }), 350);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const clearFilters = () => {
    setSearch('');
    setParams(query.sort ? { sort: query.sort } : {}, { replace: true });
  };

  const toggleSpecs = (specId) => setActiveSpec((current) => (current === specId ? null : specId));
  const select = (key, label, options) => (
    <div>
      <label htmlFor={`filter-${key}`}>{label}</label>
      <select id={`filter-${key}`} value={query[key] || ''} onChange={(event) => update({ [key]: event.target.value })}>
        <option value="">Any</option>
        {options.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
      </select>
    </div>
  );
  const number = (key, label, placeholder) => (
    <div>
      <label htmlFor={`filter-${key}`}>{label}</label>
      <input id={`filter-${key}`} type="number" min="0" inputMode="numeric" placeholder={placeholder}
        defaultValue={query[key] || ''} key={`${key}-${query[key] || ''}`}
        onBlur={(event) => event.target.value !== (query[key] || '') && update({ [key]: event.target.value })}
        onKeyDown={(event) => event.key === 'Enter' && event.target.blur()} />
    </div>
  );

  const showFeatured = featured.length > 0 && activeFilters === 0 && (!data || data.page === 1);
  const total = data ? data.total : null;

  return (
    <section id="cars" className="tab-content active">
      {showFeatured ? (
        <div className="featured-block">
          <h2>{settings.content.featuredHeading}</h2>
          <div className="cars-grid">
            {featured.map((vehicle) => (
              <VehicleCard key={vehicle.id} vehicle={vehicle} specsOpen={activeSpec === `featured-${vehicle.id}`}
                onToggleSpecs={() => toggleSpecs(`featured-${vehicle.id}`)} />
            ))}
          </div>
        </div>
      ) : null}

      <h2>
        {settings.content.inventoryHeading}
        {total !== null ? ` (${formatNumber(total)} ${total === 1 ? 'Vehicle' : 'Vehicles'})` : ''}
      </h2>
      {settings.content.inventoryIntro ? <p className="inventory-copy">{settings.content.inventoryIntro}</p> : null}

      <div className="inventory-toolbar" role="search">
        <div className="toolbar-search">
          <label htmlFor="filter-q" className="sr-only">Search inventory</label>
          <input id="filter-q" type="search" placeholder="Search by make, model, year…" value={search}
            onChange={(event) => setSearch(event.target.value)} />
        </div>
        <div className="toolbar-sort">
          <label htmlFor="filter-sort" className="sr-only">Sort by</label>
          <select id="filter-sort" value={query.sort || ''} onChange={(event) => update({ sort: event.target.value })}>
            {SORT_OPTIONS.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
          </select>
        </div>
        <button type="button" className="dropdown-btn toolbar-toggle" aria-expanded={filtersOpen}
          onClick={() => setFiltersOpen((open) => !open)}>
          <span>Filters{activeFilters ? ` (${activeFilters})` : ''}</span>
          <span aria-hidden="true">{filtersOpen ? '▲' : '▼'}</span>
        </button>
      </div>

      {filtersOpen && facets ? (
        <div className="filter-panel">
          {select('brand', 'Brand', facets.brands.map((brand) => [brand.slug, `${brand.name} (${brand.count})`]))}
          {facets.categories.length
            ? select('category', 'Category', facets.categories.map((item) => [item.slug, `${item.name} (${item.count})`]))
            : null}
          {select('fuelType', 'Fuel Type', facets.fuelTypes.map((value) => [value, FUEL_LABELS[value]]))}
          {select('transmission', 'Transmission', facets.transmissions.map((value) => [value, TRANSMISSION_LABELS[value]]))}
          {number('minYear', 'Year From', facets.year.min || '')}
          {number('maxYear', 'Year To', facets.year.max || '')}
          {number('minPrice', 'Min Price', facets.price.min !== null ? formatMoney(facets.price.min, settings.currency) : '')}
          {number('maxPrice', 'Max Price', facets.price.max !== null ? formatMoney(facets.price.max, settings.currency) : '')}
          {number('maxMileage', 'Max Mileage', facets.maxMileage !== null ? formatNumber(facets.maxMileage) : '')}
          <div className="filter-actions">
            <button type="button" className="text-btn" onClick={clearFilters} disabled={!activeFilters}>Clear filters</button>
          </div>
        </div>
      ) : null}

      {error ? <div className="error-alert" role="alert">{error}</div> : null}
      {!data && !error ? <p className="inventory-copy" role="status">Loading inventory…</p> : null}

      {data && data.items.length === 0 ? (
        <div className="content-box empty-state">
          <p>{activeFilters ? 'No vehicles match your search.' : 'New inventory is arriving soon. Please check back.'}</p>
          {activeFilters ? <button type="button" className="submit-btn" onClick={clearFilters}>Clear filters</button> : null}
        </div>
      ) : null}

      {data && data.items.length > 0 ? (
        <>
          <div className="cars-grid">
            {data.items.map((vehicle) => (
              <VehicleCard key={vehicle.id} vehicle={vehicle} specsOpen={activeSpec === vehicle.id}
                onToggleSpecs={() => toggleSpecs(vehicle.id)} />
            ))}
          </div>
          <Pagination page={data.page} totalPages={data.totalPages}
            onChange={(page) => {
              update({ page: page === 1 ? '' : String(page) });
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }} />
        </>
      ) : null}
    </section>
  );
}

export default InventoryPage;
