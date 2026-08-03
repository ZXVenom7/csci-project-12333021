# Luxury Motor Sport

Luxury Motor Sport is a React single-page application for a high-end car dealership. It includes an inventory view, vehicle specification toggles, an about section, contact information, and an appointment booking form.

## Live Deployment

This project is configured for Vercel deployment.

- Framework preset: Create React App
- Build command: `npm run build`
- Output directory: `build`
- Install command: `npm install`

The app must be deployed from the repository root. Do not set a GitHub Pages `homepage` value in `package.json` for the Vercel deployment, because Create React App will otherwise generate asset paths for `/csci-project-12333021/` instead of the Vercel site root.

## Local Development

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm start
```

Open `http://localhost:3000` in your browser.

## Production Build

Create an optimized production build:

```bash
npm run build
```

The generated files will be written to the `build` directory.

## Project Structure

```text
public/
  index.html
src/
  App.js
  App.css
  index.js
  index.css
package.json
```

## Features

- Luxury vehicle inventory with images and prices
- Expandable technical specifications for each vehicle
- Availability labels for unavailable vehicles
- About and contact sections
- Appointment request form with confirmation message

## Image Credits

- Mercedes-AMG GT Black Series image: Wikimedia Commons, Alexander-93
- Audi R8 V10 Performance image: Wikimedia Commons, Calreyn88
- Lucid Air Sapphire image: Wikimedia Commons, Calreyn88
