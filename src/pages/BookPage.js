import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { usePageTitle, useSite } from '../lib/SiteContext';
import InquiryForm from '../components/InquiryForm';

function BookPage() {
  const { settings } = useSite();
  const [params] = useSearchParams();
  const [vehicles, setVehicles] = useState(null);
  const [error, setError] = useState('');
  usePageTitle('Book an Appointment');

  useEffect(() => {
    api.get('/vehicles', { pageSize: 60 })
      .then((result) => setVehicles(result.items))
      .catch((failure) => setError(failure.message));
  }, []);

  const preselected = vehicles && vehicles.find((vehicle) => vehicle.slug === params.get('vehicle'));

  return (
    <section id="book" className="tab-content active">
      <div className="content-box">
        <h2>{settings.content.bookingHeading}</h2>
        {settings.content.bookingIntro ? <p className="booking-copy">{settings.content.bookingIntro}</p> : null}
        {error ? <div className="error-alert" role="alert">{error}</div> : null}
        {vehicles ? (
          <InquiryForm type="appointment" vehicles={vehicles} defaultVehicleId={preselected ? preselected.id : ''}
            submitLabel="Confirm Booking" idPrefix="book" />
        ) : null}
        {!vehicles && !error ? <p className="booking-copy" role="status">Loading…</p> : null}
      </div>
    </section>
  );
}

export default BookPage;
