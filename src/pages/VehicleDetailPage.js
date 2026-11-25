import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import {
  CONDITION_LABELS, FUEL_LABELS, STATUS_LABELS, formatMileage, formatMoney, formatNumber, priceLabel,
  transmissionLabel, whatsappLink,
} from '../lib/format';
import { usePageTitle, useSite } from '../lib/SiteContext';
import InquiryForm from '../components/InquiryForm';
import VehicleImage from '../components/VehicleImage';

function VehicleDetailPage() {
  const { slug } = useParams();
  const { settings } = useSite();
  const [vehicle, setVehicle] = useState(null);
  const [error, setError] = useState(null);
  const [imageIndex, setImageIndex] = useState(0);
  const [formType, setFormType] = useState('test_drive');

  usePageTitle(vehicle ? vehicle.title : '');

  useEffect(() => {
    let cancelled = false;
    setVehicle(null);
    setError(null);
    setImageIndex(0);
    api.get(`/vehicles/${encodeURIComponent(slug)}`)
      .then((result) => {
        if (cancelled) return;
        setVehicle(result);
        setFormType(result.status === 'sold' ? 'general' : 'test_drive');
      })
      .catch((failure) => {
        if (!cancelled) setError(failure);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (error) {
    return (
      <div className="content-box empty-state">
        <h2>{error.status === 404 ? 'Vehicle not found' : 'Something went wrong'}</h2>
        <p>{error.status === 404 ? 'This vehicle is no longer listed. It may have been sold.' : error.message}</p>
        <Link className="submit-btn link-btn" to="/">Browse available cars</Link>
      </div>
    );
  }
  if (!vehicle) return <p className="inventory-copy" role="status">Loading vehicle…</p>;

  const sold = vehicle.status === 'sold';
  const image = vehicle.images[imageIndex] || vehicle.images[0];
  const specs = [
    ['Brand', vehicle.brand.name],
    ['Model', vehicle.model],
    ['Year', vehicle.year],
    ['Condition', CONDITION_LABELS[vehicle.condition]],
    ['Category', vehicle.category && vehicle.category.name],
    ['Body Type', vehicle.bodyType],
    ['Mileage', formatMileage(vehicle.mileage, settings.distanceUnit)],
    ['Engine', vehicle.engine],
    ['Power', vehicle.horsepower !== null ? `${formatNumber(vehicle.horsepower)} hp` : ''],
    ['Transmission', transmissionLabel(vehicle)],
    ['Drivetrain', vehicle.drivetrain],
    ['Fuel Type', FUEL_LABELS[vehicle.fuelType]],
    ['Economy', vehicle.fuelEconomy],
    ['Exterior', vehicle.exteriorColor],
    ['Interior', vehicle.interiorColor],
    ['VIN', vehicle.vin],
  ].filter(([, value]) => value);

  return (
    <article className="vehicle-detail">
      <Link to="/" className="back-link">← Back to inventory</Link>

      <div className="detail-top">
        <div className="detail-gallery">
          <div className="detail-image">
            {vehicle.status !== 'available' ? <div className="status-badge">{STATUS_LABELS[vehicle.status]}</div> : null}
            <VehicleImage src={image && image.url} alt={image ? image.alt : vehicle.title} lazy={false} />
          </div>
          {vehicle.images.length > 1 ? (
            <div className="detail-thumbs">
              {vehicle.images.map((item, index) => (
                <button type="button" key={item.id} className={index === imageIndex ? 'active' : ''}
                  aria-label={`Show photo ${index + 1} of ${vehicle.images.length}`}
                  aria-pressed={index === imageIndex} onClick={() => setImageIndex(index)}>
                  <img src={item.thumbUrl} alt="" loading="lazy" />
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="detail-summary">
          <h2>{vehicle.title}</h2>
          <div className="detail-price">
            <span className={`car-price ${vehicle.status !== 'available' ? 'sold-out' : ''}`}>
              {priceLabel(vehicle, settings.currency)}
            </span>
            {vehicle.discount && !sold ? (
              <>
                <s className="previous-price">{formatMoney(vehicle.previousPrice, settings.currency)}</s>
                <span className="discount-note">
                  Save {formatMoney(vehicle.discount.amount, settings.currency)} ({vehicle.discount.percent}%)
                </span>
              </>
            ) : null}
          </div>

          <div className="detail-specs">
            {specs.map(([name, value]) => (
              <div className="spec-item" key={name}><span>{name}:</span> {value}</div>
            ))}
          </div>

          {settings.contact.whatsapp ? (
            <a className="whatsapp-btn" target="_blank" rel="noopener noreferrer"
              href={whatsappLink(settings.contact.whatsapp, `Hello, I'm interested in the ${vehicle.title}. ${window.location.href}`)}>
              Ask on WhatsApp
            </a>
          ) : null}
        </div>
      </div>

      {vehicle.description ? (
        <div className="content-box detail-box">
          <h2>About This Vehicle</h2>
          {vehicle.description.split(/\n{2,}/).map((paragraph) => (
            <p key={paragraph.slice(0, 40)} className="multiline">{paragraph}</p>
          ))}
        </div>
      ) : null}

      <div className="content-box detail-box">
        <h2>{sold ? 'Looking for something similar?' : 'Interested in this vehicle?'}</h2>
        {sold ? (
          <p className="booking-copy">This vehicle has been sold. Send us a message and we will help you find a similar one.</p>
        ) : (
          <div className="form-switch" role="group" aria-label="Request type">
            <button type="button" className={`tab-btn ${formType === 'test_drive' ? 'active' : ''}`}
              aria-pressed={formType === 'test_drive'} onClick={() => setFormType('test_drive')}>Book a Test Drive</button>
            <button type="button" className={`tab-btn ${formType === 'availability' ? 'active' : ''}`}
              aria-pressed={formType === 'availability'} onClick={() => setFormType('availability')}>Check Availability</button>
          </div>
        )}
        <InquiryForm key={formType} type={formType} vehicleId={vehicle.id} idPrefix="vehicle"
          submitLabel={{ test_drive: 'Request Test Drive', availability: 'Check Availability', general: 'Send Message' }[formType]} />
      </div>
    </article>
  );
}

export default VehicleDetailPage;
