# CLAUDE.md for hostel-system

## Build and Dev Commands
- `npm run dev`: Start Vite development server for the management app
- `npm run build`: Build production bundle
- `npm run lint`: Run ESLint for code quality
- `npm run preview`: Preview production build
- `supabase db push`: Push local database changes to Supabase (if using Supabase CLI)

## Project Overview
This is a Hostel Management System built with React, Tailwind CSS (v4), and Supabase for the backend. It handles bookings, guests, and room management.

## Key Files
- `src/pages/Calendar.jsx`: Main booking management interface.
- `src/pages/Guests.jsx`: Guest management and registration.
- `src/components/`: Reusable components like Modals, Forms, and UI elements.
- `supabase_migration.sql`: Main database schema and logic.
- `.env`: Contains Supabase connection details (URL and Anon/Service Role keys).

## Guidelines
- Use React 19 features where appropriate.
- Follow the established Tailwind CSS v4 styling patterns.
- Ensure all database interactions go through Supabase.
- Maintain consistent modal styling for bookings and guests.
