import { useState } from 'react';
import './App.css';

const cars = [
  {
    id: 'specs-1',
    title: '2024 BMW M4 Competition',
    price: '$82,200',
    image: 'https://images.unsplash.com/photo-1617814076367-b759c7d7e738?auto=format&fit=crop&w=800&q=80',
    overlayTitle: '2024 BMW M4 Competition',
    overlayPrice: '$82,200',
    specs: [
      ['Mileage', '1,200 miles'],
      ['Engine', '3.0L Twin-Turbo'],
      ['Power', '503 hp'],
      ['Trans', '8-Speed Auto'],
      ['Drivetrain', 'RWD'],
      ['MPG', '16 / 23'],
    ],
  },
  {
    id: 'specs-2',
    title: '2023 Porsche 911 Carrera',
    price: '$114,400',
    image: 'https://images.unsplash.com/photo-1614162692292-7ac56d7f7f1e?auto=format&fit=crop&w=800&q=80',
    overlayTitle: '2023 Porsche 911 Carrera',
    overlayPrice: '$114,400',
    specs: [
      ['Mileage', '4,500 miles'],
      ['Engine', '3.0L Twin-Turbo'],
      ['Power', '379 hp'],
      ['Trans', '8-Speed PDK'],
      ['Drivetrain', 'RWD'],
      ['MPG', '18 / 24'],
    ],
  },
  {
    id: 'specs-3',
    title: '2025 Audi RS e-tron GT',
    price: '$147,100',
    image: 'https://images.unsplash.com/photo-1603584173870-7f23fdae1b7a?auto=format&fit=crop&w=800&q=80',
    overlayTitle: '2025 Audi RS e-tron GT',
    overlayPrice: '$147,100',
    specs: [
      ['Mileage', '250 miles'],
      ['Engine', 'Dual Electric Motor'],
      ['Power', '637 hp'],
      ['Trans', '2-Speed Auto'],
      ['Drivetrain', 'AWD'],
      ['MPGe', '83 MPGe'],
    ],
  },
  {
    id: 'specs-4',
    title: '2024 Mercedes-AMG C63 S',
    price: '$83,900',
    image: 'https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?auto=format&fit=crop&w=800&q=80',
    overlayTitle: '2024 Mercedes-AMG C63 S',
    overlayPrice: '$83,900',
    specs: [
      ['Mileage', '800 miles'],
      ['Engine', '2.0L Turbo Hybrid'],
      ['Power', '671 hp'],
      ['Trans', '9-Speed Auto'],
      ['Drivetrain', 'AWD'],
      ['MPGe', '41 MPGe'],
    ],
  },
  {
    id: 'specs-5',
    title: '2024 Lamborghini Huracán EVO',
    price: '$248,295',
    image: 'https://images.unsplash.com/photo-1544829099-b9a0c07fad1a?auto=format&fit=crop&w=800&q=80',
    overlayTitle: '2024 Lamborghini Huracán EVO',
    overlayPrice: '$248,295',
    specs: [
      ['Mileage', '310 miles'],
      ['Engine', '5.2L V10'],
      ['Power', '631 hp'],
      ['Trans', '7-Speed Dual-Clutch'],
      ['Drivetrain', 'AWD'],
      ['MPG', '13 / 18'],
    ],
  },
  {
    id: 'specs-6',
    title: '2023 Aston Martin DBS Superleggera',
    price: '$330,600',
    image: 'https://images.unsplash.com/photo-1563720223185-11003d516935?auto=format&fit=crop&w=800&q=80',
    overlayTitle: '2023 Aston Martin DBS',
    overlayPrice: '$330,600',
    specs: [
      ['Mileage', '1,150 miles'],
      ['Engine', '5.2L Twin-Turbo V12'],
      ['Power', '715 hp'],
      ['Trans', '8-Speed Automatic'],
      ['Drivetrain', 'RWD'],
      ['MPG', '14 / 22'],
    ],
  },
  {
    id: 'specs-7',
    title: '2024 BMW M5 Competition',
    price: '$111,900',
    image: 'https://images.unsplash.com/photo-1580273916550-e323be2ae537?auto=format&fit=crop&w=800&q=80',
    overlayTitle: '2024 BMW M5 Competition',
    overlayPrice: '$111,900',
    specs: [
      ['Mileage', '950 miles'],
      ['Engine', '4.4L Twin-Turbo V8'],
      ['Power', '617 hp'],
      ['Trans', '8-Speed Auto'],
      ['Drivetrain', 'AWD'],
      ['MPG', '15 / 21'],
    ],
  },
  {
    id: 'specs-8',
    title: '2024 Tesla Model S Plaid',
    price: '$89,990',
    image: 'https://images.unsplash.com/photo-1617788138017-80ad40651399?auto=format&fit=crop&w=800&q=80',
    overlayTitle: '2024 Tesla Model S Plaid',
    overlayPrice: '$89,990',
    specs: [
      ['Mileage', '500 miles'],
      ['Engine', 'Tri-Motor EV'],
      ['Power', '1,020 hp'],
      ['Trans', '1-Speed Auto'],
      ['Drivetrain', 'AWD'],
      ['MPGe', '120 MPGe'],
    ],
  },
  {
    id: 'specs-9',
    title: '2023 Porsche 911 GT3 RS',
    price: '$241,300',
    image: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=800&q=80',
    overlayTitle: '2023 Porsche 911 GT3 RS',
    overlayPrice: '$241,300',
    specs: [
      ['Mileage', '600 miles'],
      ['Engine', '4.0L Flat-6'],
      ['Power', '518 hp'],
      ['Trans', '7-Speed PDK'],
      ['Drivetrain', 'RWD'],
      ['MPG', '15 / 18'],
    ],
  },
  {
    id: 'specs-10',
    title: '2024 Chevrolet Corvette Z06',
    price: '$112,700',
    image: 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=800&q=80',
    overlayTitle: '2024 Chevrolet Corvette Z06',
    overlayPrice: '$112,700',
    specs: [
      ['Mileage', '1,400 miles'],
      ['Engine', '5.5L Flat-Plane V8'],
      ['Power', '670 hp'],
      ['Trans', '8-Speed Dual-Clutch'],
      ['Drivetrain', 'RWD'],
      ['MPG', '12 / 19'],
    ],
  },
  {
    id: 'specs-unavail-1',
    title: '2025 Bugatti Tourbillon',
    price: 'Reserved',
    image: 'https://images.unsplash.com/photo-1572982102138-86ca86d6b32e?auto=format&fit=crop&w=800&q=80',
    overlayTitle: '2025 Bugatti Tourbillon',
    overlayPrice: 'Reserved / Sold Out',
    unavailable: true,
    specs: [
      ['Mileage', '0 miles'],
      ['Engine', '8.3L V16 Hybrid'],
      ['Power', '1,775 hp'],
      ['Trans', '8-Speed DCT'],
      ['Drivetrain', 'AWD'],
      ['Status', 'Out of Stock'],
    ],
  },
  {
    id: 'specs-11',
    title: '2024 Audi R8 V10 Performance',
    price: '$209,700',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4c/2024_Audi_R8_V10_Performance.jpg/960px-2024_Audi_R8_V10_Performance.jpg',
    overlayTitle: '2024 Audi R8 V10 Performance',
    overlayPrice: '$209,700',
    specs: [
      ['Mileage', '2,100 miles'],
      ['Engine', '5.2L Natural V10'],
      ['Power', '602 hp'],
      ['Trans', '7-Speed S-Tronic'],
      ['Drivetrain', 'Quattro AWD'],
      ['MPG', '14 / 23'],
    ],
  },
  {
    id: 'specs-12',
    title: '2023 Mercedes-AMG GT Black Series',
    price: '$325,000',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/Mercedes-AMG_GT_Black_Series_IMG_0324.jpg/960px-Mercedes-AMG_GT_Black_Series_IMG_0324.jpg',
    overlayTitle: '2023 Mercedes-AMG GT Black',
    overlayPrice: '$325,000',
    specs: [
      ['Mileage', '400 miles'],
      ['Engine', '4.0L Twin-Turbo V8'],
      ['Power', '720 hp'],
      ['Trans', '7-Speed Auto'],
      ['Drivetrain', 'RWD'],
      ['MPG', '13 / 18'],
    ],
  },
  {
    id: 'specs-13',
    title: '2024 Ferrari F8 Tributo',
    price: '$280,000',
    image: 'https://images.unsplash.com/photo-1583121274602-3e2820c69888?auto=format&fit=crop&w=800&q=80',
    overlayTitle: '2024 Ferrari F8 Tributo',
    overlayPrice: '$280,000',
    specs: [
      ['Mileage', '1,000 miles'],
      ['Engine', '3.9L Twin-Turbo V8'],
      ['Power', '710 hp'],
      ['Trans', '7-Speed F1 Dual-Clutch'],
      ['Drivetrain', 'RWD'],
      ['MPG', '15 / 19'],
    ],
  },
  {
    id: 'specs-unavail-2',
    title: '2025 Koenigsegg Jesko Absolut',
    price: 'N/A',
    image: 'https://images.unsplash.com/photo-1724091663890-d84c2abfb28b?auto=format&fit=crop&w=800&q=80',
    overlayTitle: '2025 Koenigsegg Jesko',
    overlayPrice: 'Not Available',
    unavailable: true,
    specs: [
      ['Mileage', '50 miles'],
      ['Engine', '5.0L Twin-Turbo V8'],
      ['Power', '1,600 hp'],
      ['Trans', '9-Speed LST'],
      ['Drivetrain', 'RWD'],
      ['Status', 'Coming Soon'],
    ],
  },
  {
    id: 'specs-14',
    title: '2023 McLaren 720S',
    price: '$310,500',
    image: 'https://images.unsplash.com/photo-1621135802920-133df287f89c?auto=format&fit=crop&w=800&q=80',
    overlayTitle: '2023 McLaren 720S',
    overlayPrice: '$310,500',
    specs: [
      ['Mileage', '1,800 miles'],
      ['Engine', '4.0L Twin-Turbo V8'],
      ['Power', '710 hp'],
      ['Trans', '7-Speed SSG'],
      ['Drivetrain', 'RWD'],
      ['MPG', '15 / 22'],
    ],
  },
  {
    id: 'specs-15',
    title: '2024 Rolls-Royce Ghost',
    price: '$348,000',
    image: 'https://images.unsplash.com/photo-1562911791-c7a97b729ec5?auto=format&fit=crop&w=800&q=80',
    overlayTitle: '2024 Rolls-Royce Ghost',
    overlayPrice: '$348,000',
    specs: [
      ['Mileage', '300 miles'],
      ['Engine', '6.75L Twin-Turbo V12'],
      ['Power', '563 hp'],
      ['Trans', '8-Speed Auto'],
      ['Drivetrain', 'AWD'],
      ['MPG', '12 / 19'],
    ],
  },
  {
    id: 'specs-16',
    title: '2024 Bentley Continental GT',
    price: '$238,000',
    image: 'https://images.unsplash.com/photo-1502877338535-766e1452684a?auto=format&fit=crop&w=800&q=80',
    overlayTitle: '2024 Bentley Continental GT',
    overlayPrice: '$238,000',
    specs: [
      ['Mileage', '1,100 miles'],
      ['Engine', '4.0L Twin-Turbo V8'],
      ['Power', '542 hp'],
      ['Trans', '8-Speed Dual-Clutch'],
      ['Drivetrain', 'AWD'],
      ['MPG', '16 / 26'],
    ],
  },
  {
    id: 'specs-17',
    title: '2024 Nissan GT-R Nismo',
    price: '$221,090',
    image: 'https://images.unsplash.com/photo-1542282088-72c9c27ed0cd?auto=format&fit=crop&w=800&q=80',
    overlayTitle: '2024 Nissan GT-R Nismo',
    overlayPrice: '$221,090',
    specs: [
      ['Mileage', '700 miles'],
      ['Engine', '3.8L Twin-Turbo V6'],
      ['Power', '600 hp'],
      ['Trans', '6-Speed Dual-Clutch'],
      ['Drivetrain', 'AWD'],
      ['MPG', '16 / 22'],
    ],
  },
  {
    id: 'specs-18',
    title: '2024 Maserati MC20',
    price: '$212,000',
    image: 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=800&q=80',
    overlayTitle: '2024 Maserati MC20',
    overlayPrice: '$212,000',
    specs: [
      ['Mileage', '850 miles'],
      ['Engine', '3.0L Twin-Turbo V6'],
      ['Power', '621 hp'],
      ['Trans', '8-Speed Dual-Clutch'],
      ['Drivetrain', 'RWD'],
      ['MPG', '15 / 25'],
    ],
  },
  {
    id: 'specs-19',
    title: '2024 Lucid Air Sapphire',
    price: '$249,000',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c8/Lucid_Air_Sapphire_%2878590%29.jpg/960px-Lucid_Air_Sapphire_%2878590%29.jpg',
    overlayTitle: '2024 Lucid Air Sapphire',
    overlayPrice: '$249,000',
    specs: [
      ['Mileage', '400 miles'],
      ['Engine', 'Tri-Motor EV'],
      ['Power', '1,234 hp'],
      ['Trans', '1-Speed Automatic'],
      ['Drivetrain', 'AWD'],
      ['MPGe', '105 MPGe'],
    ],
  },
  {
    id: 'specs-20',
    title: '2024 Porsche Taycan Turbo S',
    price: '$194,900',
    image: 'https://images.unsplash.com/photo-1634317558729-c410a4133faa?auto=format&fit=crop&w=800&q=80',
    overlayTitle: '2024 Porsche Taycan Turbo S',
    overlayPrice: '$194,900',
    specs: [
      ['Mileage', '900 miles'],
      ['Engine', 'Dual Electric Motor'],
      ['Power', '750 hp'],
      ['Trans', '2-Speed Auto'],
      ['Drivetrain', 'AWD'],
      ['MPGe', '75 MPGe'],
    ],
  },
];

function App() {
  const [activeTab, setActiveTab] = useState('cars');
  const [activeSpec, setActiveSpec] = useState(null);
  const [bookingSent, setBookingSent] = useState(false);

  const toggleSpecs = (specId) => {
    setActiveSpec((current) => (current === specId ? null : specId));
  };

  const handleBooking = (event) => {
    event.preventDefault();
    setBookingSent(true);
    event.target.reset();
    window.setTimeout(() => setBookingSent(false), 4000);
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>Luxury Motor Sport</h1>
        <nav>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'cars' ? 'active' : ''}`}
            onClick={() => setActiveTab('cars')}
          >
            Cars Available
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'about' ? 'active' : ''}`}
            onClick={() => setActiveTab('about')}
          >
            About Us
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'contact' ? 'active' : ''}`}
            onClick={() => setActiveTab('contact')}
          >
            Contact Us
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'book' ? 'active' : ''}`}
            onClick={() => setActiveTab('book')}
          >
            Book an Appointment
          </button>
        </nav>
      </header>

      <main>
        <section id="cars" className={`tab-content ${activeTab === 'cars' ? 'active' : ''}`}>
          <h2>Available Inventory (22 Vehicles)</h2>
          <p className="inventory-copy">
            Hover over any image for quick details. Click below a car to expand technical specifications.
          </p>

          <div className="cars-grid">
            {cars.map((car) => (
              <article className={`car-card ${car.unavailable ? 'unavailable' : ''}`} key={car.id}>
                {car.unavailable ? <div className="status-badge">Not Available</div> : null}
                <div className="image-container">
                  <img src={car.image} alt={car.title} />
                  <div className="image-overlay">
                    <h3>{car.overlayTitle}</h3>
                    <p className="overlay-price">{car.overlayPrice}</p>
                    <p className="overlay-copy">Click &apos;Show Specs&apos; below for full technical details.</p>
                  </div>
                </div>
                <div className="card-body">
                  <div className="car-header">
                    <h3>{car.title}</h3>
                    <span className={`car-price ${car.unavailable ? 'sold-out' : ''}`}>{car.price}</span>
                  </div>
                  <button className="dropdown-btn" type="button" onClick={() => toggleSpecs(car.id)}>
                    <span>{activeSpec === car.id ? 'Hide Specifications' : 'Show Specifications'}</span>
                    <span>{activeSpec === car.id ? '▲' : '▼'}</span>
                  </button>
                  <div className={`specs-panel ${activeSpec === car.id ? 'show' : ''}`}>
                    {car.specs.map(([label, value]) => (
                      <div className="spec-item" key={`${car.id}-${label}`}>
                        <span>{label}:</span> {value}
                      </div>
                    ))}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section id="about" className={`tab-content ${activeTab === 'about' ? 'active' : ''}`}>
          <div className="content-box">
            <h2>About Luxury Motor Sport</h2>
            <p>
              Welcome to Luxury Motor Sport. We specialize in offering premier performance, exotic, and ultra-luxury vehicles.
              Every vehicle in our showroom undergoes a thorough multi-point inspection to ensure complete safety and peak mechanical performance.
            </p>
            <p>
              Our dedicated team provides a transparent buying experience tailored to help you find your ideal luxury vehicle.
            </p>
          </div>
        </section>

        <section id="contact" className={`tab-content ${activeTab === 'contact' ? 'active' : ''}`}>
          <div className="content-box">
            <h2>Contact Information</h2>
            <p className="contact-label">Showroom Address:</p>
            <p>100 Luxury Way, Suite 500<br />Automotive District</p>
            <p className="contact-label">Direct Contact:</p>
            <p>
              Email: 12333021@liu.edu.lb<br />
              Phone: +961 799 788 799
            </p>
          </div>
        </section>

        <section id="book" className={`tab-content ${activeTab === 'book' ? 'active' : ''}`}>
          <div className="content-box">
            <h2>Book an Appointment</h2>
            <p className="booking-copy">Schedule a private viewing or test drive with an automotive specialist.</p>

            {bookingSent ? (
              <div className="success-alert">Appointment request sent successfully! We will contact you soon to confirm.</div>
            ) : null}

            <form onSubmit={handleBooking}>
              <div>
                <label htmlFor="name">Full Name</label>
                <input type="text" id="name" required placeholder="John Doe" />
              </div>
              <div>
                <label htmlFor="email">Email Address</label>
                <input type="email" id="email" required placeholder="john@example.com" />
              </div>
              <div>
                <label htmlFor="car-select">Select Vehicle</label>
                <select id="car-select">
                  {cars.map((car) => (
                    <option key={car.id} value={car.title} disabled={car.unavailable}>
                      {car.title}{car.unavailable ? ' (Not Available)' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="date">Preferred Date</label>
                <input type="date" id="date" required />
              </div>
              <button type="submit" className="submit-btn">Confirm Booking</button>
            </form>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
