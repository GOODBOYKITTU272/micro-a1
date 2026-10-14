# micro1 Referral Hub

A local dashboard and referral tracker for micro1 referral-eligible jobs, powered by Node.js and an embedded SQLite database (`referrals.db`).

---

## 🌟 Features

- **281 Active Referral Jobs**: Stored in a local SQLite database (`referrals.db`).
- **Referral Code Tracking**: All jobs automatically attach your unique referral parameters:
  `referralCode=b3967e16-757e-4cb1-9bc6-bda6a63f6627&utm_source=referral&utm_medium=share&utm_campaign=job_referral`
- **Candidate Referral CRM**: Log candidate names, emails, job roles, and track status (`Contacted` → `Applied` → `Interviewing` → `Hired & Paid`).
- **Interactive UI**: Search by title or skills (Python, Rust, AI, Finance), filter by high-demand or high-reward ($1,000+ to $3,000), copy links with one click, or test links directly on `jobs.micro1.ai`.
- **Sync Engine**: Re-sync with micro1 API anytime with one click.

---

## 🚀 Getting Started

The dashboard is currently running live at:
👉 **[http://localhost:3333](http://localhost:3333)**

### Commands

- **Start Dashboard**:
  ```bash
  npm start
  ```
- **Sync fresh data from micro1 API**:
  ```bash
  npm run sync
  ```

---

## 🤖 Option 2: Local Playwright Bot (Strict Human Simulation)

Automate sending personalized LinkedIn referral intros to your top matched connections directly inside your real Google Chrome browser.

### Features
- **Direct Chrome Attachment**: Connects to your existing Chrome browser over Chrome DevTools Protocol (`port 9222`). Your active LinkedIn session, cookies, and 2FA are preserved—no repeated sign-ins!
- **Strict Human Simulation**:
  - Multi-step interpolated mouse movements (`humanMouseMove`)
  - Smooth page scrolling to simulate reviewing profiles
  - Character-by-character typing jitter (40–95ms/char) with natural micro-pauses at punctuation
  - 25–40s cooldown between candidates with a live countdown timer
- **Visual On-Screen Supervision**: The browser window stays in front on your screen so you can visually watch every action.
- **SQLite Auto-Sync**: Updates connection status to `Intro Sent` and prevents messaging the same connection twice.

### Quick Start Commands

1. **Start Chrome with Remote Debugging (Mac)**:
   ```bash
   npm run chrome
   ```
   *(Or close Chrome completely with Cmd+Q and run `./launch-chrome.sh`)*

2. **Run the Bot in Supervised Mode (Recommended)**:
   ```bash
   npm run bot:step
   ```
   *The bot types the message in your browser window and waits for you to visually inspect it and press Enter before sending.*

3. **Run the Bot in Autonomous Mode**:
   ```bash
   npm run bot:auto
   ```
   *The bot types the message, pauses 4 seconds for your visual review, automatically sends, and counts down 25–40s before moving to the next candidate.*

4. **Zero-Risk Dry Run Test**:
   ```bash
   npm run bot:test
   ```
   *Navigates, reviews profile, types message for 1 test candidate, but DOES NOT click Send.*

## 🔒 Security

- The API key is stored securely in `.env` (permissions `600`) and ignored by Git in `.gitignore`.
- `.env.example` provides a template without exposing secrets.
- `referrals.db` is stored locally and git-ignored.
