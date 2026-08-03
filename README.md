# One Thing

A mobile-friendly accountability app built for one recurring action.

Example:

> Go live on Whatnot every day at 7:00 PM.

The app tracks the commitment, sends escalating reminders, logs completed shows and profit, tracks streaks, and subtracts logged profit from a larger financial goal.

## What works now

- One recurring daily commitment
- Custom show time
- Gentle, normal, and relentless reminder modes
- Encouraging, direct, accountant, and funny notification voices
- Browser notifications
- Stop notifications by tapping **I'm Live**, **Completed**, or **Skipped**
- Debt goal, debt remaining, profit, streaks, and show count
- Show result logging
- Local history
- Installable Progressive Web App
- Offline loading after the first visit

## Important notification limitation

This free GitHub Pages version schedules browser notifications from the open app.

Browsers, especially iPhones, may suspend timers after the app is fully closed. GitHub Pages is static hosting and cannot independently wake the phone at future times.

For fully reliable closed-app notifications, the next version should add:

1. A small backend such as Supabase
2. A scheduled function or cron job
3. Web Push subscriptions
4. Push messages sent from the backend at each reminder time

The interface and data model in this MVP are ready to be extended for that.

## Put it on GitHub

### Easiest method

1. Sign in to GitHub.
2. Click **New repository**.
3. Name it `one-thing-app`.
4. Make it **Public**.
5. Create the repository.
6. Click **uploading an existing file**.
7. Drag every file and folder from this project into GitHub.
8. Click **Commit changes**.

### Turn on the website

1. Open the repository.
2. Click **Settings**.
3. Click **Pages** in the left menu.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Select `main` and `/root`.
6. Click **Save**.
7. GitHub will show the public website link after deployment.

## Install it on an iPhone

1. Open the GitHub Pages website in Safari.
2. Tap the Share button.
3. Tap **Add to Home Screen**.
4. Open the installed app.
5. Open Settings inside the app.
6. Tap **Enable notifications**.

iPhone web push requires an installed Home Screen web app and a supported iOS version.

## Rename it

Change the name inside the app Settings screen.

To permanently change the browser and install name, also edit:

- `<title>` in `index.html`
- `name` and `short_name` in `manifest.webmanifest`

## Data

This MVP stores all settings and history in the browser's local storage. Clearing browser data removes it.

A later Supabase version can add user accounts, cloud sync, cross-device data, and reliable push scheduling.
