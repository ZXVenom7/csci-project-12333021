import { Link } from 'react-router-dom';
import VehicleImage from './VehicleImage';
import { useSite } from '../lib/SiteContext';
import { STATUS_LABELS, cardSpecs, formatMoney, priceLabel } from '../lib/format';

function VehicleCard({ vehicle, specsOpen, onToggleSpecs }) {
  const { settings } = useSite();
  const unavailable = vehicle.status !== 'available';
  const label = priceLabel(vehicle, settings.currency);
  const showDiscount = vehicle.discount && vehicle.status !== 'sold';
  const href = `/vehicles/${vehicle.slug}`;

  return (
    <article className={`car-card ${unavailable ? 'unavailable' : ''}`}>
      {unavailable ? <div className="status-badge">{STATUS_LABELS[vehicle.status]}</div> : null}
      {!unavailable && showDiscount ? (
        <div className="status-badge discount-badge">Save {vehicle.discount.percent}%</div>
      ) : null}
      <Link to={href} className="image-container" aria-label={`View ${vehicle.title}`}>
        <VehicleImage src={vehicle.primaryImage && vehicle.primaryImage.thumbUrl}
          alt={vehicle.primaryImage ? vehicle.primaryImage.alt : vehicle.title} />
        <div className="image-overlay">
          <h3>{vehicle.title}</h3>
          <p className="overlay-price">{label}</p>
          <p className="overlay-copy">Click to view full details and photos.</p>
        </div>
      </Link>
      <div className="card-body">
        <div className="car-header">
          <h3><Link to={href}>{vehicle.title}</Link></h3>
          <span className="price-stack">
            {showDiscount ? (
              <s className="previous-price">{formatMoney(vehicle.previousPrice, settings.currency)}</s>
            ) : null}
            <span className={`car-price ${unavailable ? 'sold-out' : ''}`}>{label}</span>
          </span>
        </div>
        <button className="dropdown-btn" type="button" onClick={onToggleSpecs} aria-expanded={specsOpen}>
          <span>{specsOpen ? 'Hide Specifications' : 'Show Specifications'}</span>
          <span aria-hidden="true">{specsOpen ? '▲' : '▼'}</span>
        </button>
        <div className={`specs-panel ${specsOpen ? 'show' : ''}`}>
          {cardSpecs(vehicle, settings).map(([name, value]) => (
            <div className="spec-item" key={name}>
              <span>{name}:</span> {value}
            </div>
          ))}
          <Link className="spec-link" to={href}>View full details →</Link>
        </div>
      </div>
    </article>
  );
}

export default VehicleCard;
