# Nearby Helper Service Finder

Nearby Helper Service Finder is a MERN-based hyperlocal marketplace where users can find and book trusted helpers in their area.

The goal is simple:
- Help users quickly discover nearby service providers
- Build trust through ratings, verification, and clear pricing
- Make booking easy on both mobile and desktop

## Problem We Are Solving

People often need local helpers such as plumbers, electricians, maids, carpenters, tutors, drivers, and elder-care providers. Most users still depend on word of mouth, unverified phone numbers, or social media groups. That creates:
- Slow discovery
- Low trust
- Unclear pricing
- No booking history
- No accountability

This project solves that with a location-first local services platform.

## Core Product Idea

Users can:
- Detect or enter their location
- Browse service categories
- Find nearby helpers
- Compare pricing, ratings, and availability
- Submit a booking request

Helpers can:
- Create a professional profile
- Add service categories
- Set pricing and service area
- Accept or reject booking requests
- Build trust with reviews

Admins can:
- Verify helpers
- Moderate complaints and reviews
- Manage categories and platform quality

## MVP Features

### User Side
- Location detection or manual location entry
- Search by service, area, or pin code
- Category filters
- Nearby helper listing
- Helper profile page
- Booking request form
- Booking history
- Ratings and reviews
- Call / WhatsApp contact options

### Helper Side
- Helper registration
- Profile setup
- Category selection
- Pricing setup
- Availability management
- Booking acceptance and rejection

### Admin Side
- Manage users and helpers
- Verify helper profiles
- Moderate flagged content
- Manage service categories

## Trust Features

- ID / KYC verification status
- Verified helper badge
- Complaint reporting
- Review moderation
- Booking records for accountability

## Future Features

- Map-based search
- Live availability
- Emergency booking
- Coupons and referrals
- In-app chat
- Multi-language support
- AI helper recommendations
- Subscription plans for helpers

## MERN Stack Plan

- Frontend: React + Vite + React Router
- Backend: Node.js + Express
- Database: MongoDB
- ODM: Mongoose
- Auth: JWT + optional OTP later
- Maps: Google Maps or OpenStreetMap
- Notifications: WhatsApp, SMS, or email later

## Current Folder Structure

```text
Nearby Helper Service Finder/
|- client/
|  |- src/
|  |- package.json
|- server/
|  |- src/
|  |- package.json
|- docs/
|- package.json
```

## Local Setup

### 1. Install dependencies

```bash
npm install --prefix server
npm install --prefix client
```

### 2. Set environment variables

Copy:
- `server/.env.example` to `server/.env`
- `client/.env.example` to `client/.env`

Important:
- `server/.env` should be created inside the `server/` folder
- `client/.env` should be created inside the `client/` folder

### 3. Start backend

```bash
npm run server
```

### 4. Start frontend

```bash
npm run client
```

## MongoDB Mode

The app currently supports two modes:
- Mock mode for fast UI development
- MongoDB mode for real persisted data

### To use MongoDB

1. Set `USE_MOCK_DATA=false` in `server/.env`
2. Add your `MONGODB_URI`
3. Seed the sample categories and helpers

```bash
npm run seed
```

4. Start the server again

## Project Docs

- [Page Structure](./docs/page-structure.md)
- [MongoDB Schema](./docs/database-schema.md)
- [API Outline](./docs/api-outline.md)
- [MVP Roadmap](./docs/mvp-roadmap.md)
- [MERN Architecture](./docs/mern-architecture.md)
- [Company Email Sender Setup](./server/EMAIL_SETUP.md)
