# Fitness Routine

Expo React Native MVP for planning routines, seeing today's scheduled work, and logging adjusted workout execution with Supabase.

## Setup

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the Supabase SQL editor.
3. Copy `.env.example` to `.env` and set:
   - `EXPO_PUBLIC_SUPABASE_URL`
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
4. Install dependencies with `npm install`.
5. Start the app with `npm start`.

## MVP Features

- Email/password sign up, sign in, session persistence, and logout.
- Today tab for routines scheduled on the current weekday.
- Routines tab for creating, editing, deleting, scheduling, and reordering routine exercises.
- Workout execution screen that saves actual reps and sets without changing the routine template.
