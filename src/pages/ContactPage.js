import { usePageTitle, useSite } from '../lib/SiteContext';
import { whatsappLink } from '../lib/format';
import InquiryForm from '../components/InquiryForm';

function ContactPage() {
  const { settings } = useSite();
  const { contact } = settings;
  usePageTitle('Contact Us');
  return (
    <section id="contact" className="tab-content active">
      <div className="content-box">
        <h2>Contact Information</h2>
        {contact.addressLines.length ? (
          <>
            <p className="contact-label">Showroom Address:</p>
            <p>
              {contact.addressLines.map((line, index) => (
                // eslint-disable-next-line react/no-array-index-key
                <span key={index}>{line}{index < contact.addressLines.length - 1 ? <br /> : null}</span>
              ))}
            </p>
          </>
        ) : null}
        {contact.email || contact.phone ? (
          <>
            <p className="contact-label">Direct Contact:</p>
            <p>
              {contact.email ? <>Email: <a href={`mailto:${contact.email}`}>{contact.email}</a><br /></> : null}
              {contact.phone ? <>Phone: <a href={`tel:${contact.phone.replace(/[^+\d]/g, '')}`}>{contact.phone}</a></> : null}
            </p>
          </>
        ) : null}
        {contact.hours ? (
          <>
            <p className="contact-label">Opening Hours:</p>
            <p>{contact.hours}</p>
          </>
        ) : null}
        {contact.whatsapp ? (
          <a className="whatsapp-btn" target="_blank" rel="noopener noreferrer"
            href={whatsappLink(contact.whatsapp, `Hello ${settings.dealership.name}, I have a question.`)}>
            Chat on WhatsApp
          </a>
        ) : null}
      </div>

      <div className="content-box detail-box">
        <h2>Send Us a Message</h2>
        <InquiryForm type="general" submitLabel="Send Message" idPrefix="contact" />
      </div>
    </section>
  );
}

export default ContactPage;
