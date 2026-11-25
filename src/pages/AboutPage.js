import { usePageTitle, useSite } from '../lib/SiteContext';

function AboutPage() {
  const { settings } = useSite();
  usePageTitle('About Us');
  return (
    <section id="about" className="tab-content active">
      <div className="content-box">
        <h2>{settings.dealership.aboutHeading}</h2>
        {settings.dealership.aboutParagraphs.map((paragraph) => (
          <p key={paragraph.slice(0, 40)} className="multiline">{paragraph}</p>
        ))}
      </div>
    </section>
  );
}

export default AboutPage;
