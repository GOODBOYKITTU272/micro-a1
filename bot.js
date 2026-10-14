import { chromium } from 'playwright';
import readline from 'node:readline';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, updateConnection } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper for human-like pauses
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const getRandomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

// Parse command line arguments
const args = process.argv.slice(2);
const isStepMode = args.includes('--step');
const isAutoMode = args.includes('--auto');
const isDryRun = args.includes('--dry-run');
const limitArg = args.find(a => a.startsWith('--limit=') || a.startsWith('--target='));
const TARGET_SENDS = limitArg ? parseInt(limitArg.split('=')[1], 10) : 20;
const portArg = args.find(a => a.startsWith('--port='));
const CDP_PORT = portArg ? parseInt(portArg.split('=')[1], 10) : 9222;

function askUser(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise(resolve => rl.question(query, ans => {
    rl.close();
    resolve(ans);
  }));
}

// Shorten micro1 referral URL via TinyURL
async function getShortUrl(rawUrl) {
  if (!rawUrl) return 'https://jobs.micro1.ai';
  const cleanUrl = rawUrl.replace(/&utm_[^&]+/g, '').replace(/\?utm_[^&]+&/, '?');
  try {
    const res = await fetch(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(cleanUrl)}`, {
      signal: AbortSignal.timeout(6000)
    });
    if (res.ok) {
      const short = (await res.text()).trim();
      if (short.startsWith('http')) return short;
    }
  } catch (err) {
    // Fall back to clean URL if TinyURL fails
  }
  return cleanUrl;
}

function formatFirstName(raw) {
  if (!raw) return 'there';
  const first = raw.trim().split(/\s+/)[0].replace(/[^a-zA-Z\u00C0-\u024F]/g, '');
  if (!first) return 'there';
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

const jobRates = new Map();
try {
  db.prepare('SELECT job_id, ideal_hourly_rate_min, ideal_hourly_rate_max FROM jobs').all().forEach(j => {
    jobRates.set(j.job_id, { min: j.ideal_hourly_rate_min, max: j.ideal_hourly_rate_max });
  });
} catch (e) {}

// Generate the high-converting AI talent network message
function composeMessage(candidate, job, shortUrl) {
  const firstName = formatFirstName(candidate.first_name || candidate.full_name);
  const roleName = (job.name || 'AI Specialist').trim().replace(/\s+/g, ' ');
  const rates = jobRates.get(job.id);

  let payLine = "It's 100% remote with competitive compensation paid in USD.";
  if (rates && rates.max > 0) {
    if (rates.min > 0) {
      payLine = `The role is 100% remote with compensation paid in USD ($${rates.min} – $${rates.max}/hr depending on experience).`;
    } else {
      payLine = `The role is 100% remote with compensation paid in USD (up to $${rates.max}/hr depending on experience).`;
    }
  }

  return `Hi ${firstName},

We run an AI talent network connecting top specialists with tier-1 global AI projects.

We're currently onboarding for: ${roleName}.

${payLine}

If you're interested, you can review the details and apply directly here:
${shortUrl}

Applications are fast-tracked and reviewed directly by our AI team, and we'll reach out if there's a match.`;
}

// Smooth mouse movement with multi-step interpolation
async function humanMouseMove(page, targetX, targetY) {
  await page.mouse.move(targetX, targetY, { steps: getRandomInt(8, 14) });
  await sleep(getRandomInt(150, 300));
}

// Simulate human typing with variable keystroke delay and natural pauses
async function humanType(page, text) {
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    await page.keyboard.type(char, { delay: getRandomInt(40, 95) });

    // Natural micro-pauses at punctuation and newlines
    if (char === '\n') {
      await sleep(getRandomInt(300, 600));
    } else if (char === '.' || char === '!' || char === '?') {
      await sleep(getRandomInt(200, 450));
    } else if (char === ',') {
      await sleep(getRandomInt(100, 250));
    }
  }
}

// Pacing countdown in console
async function safePacingCooldown(seconds) {
  process.stdout.write(`⏳ Safe Pacing: Cooling down for ${seconds}s to stay 100% human-safe `);
  for (let s = seconds; s > 0; s--) {
    process.stdout.write(`\r⏳ Safe Pacing: Cooling down for ${s}s to stay 100% human-safe...   `);
    await sleep(1000);
  }
  console.log(`\r✅ Ready for next candidate!                                       \n`);
}

async function main() {
  console.clear();
  console.log(`===============================================================`);
  console.log(`🤖 micro1 LinkedIn Referral Automation Bot (Strict Human Mode)`);
  console.log(`===============================================================`);
  console.log(`🛡️  Anti-Detection: Multi-step mouse moves, human typing, jitter`);
  console.log(`⏱️  Pacing: 25-40s cooldown between candidates`);
  console.log(`📦 Target Goal: ${TARGET_SENDS} referral intros per run`);
  console.log(`===============================================================\n`);

  let browser;
  let context;
  let page;

  // Step 1: Try connecting to Chrome via CDP (localhost:9222)
  console.log(`🔍 Checking for active Chrome on port ${CDP_PORT}...`);
  try {
    browser = await chromium.connectOverCDP(`http://127.0.0.1:${CDP_PORT}`, { timeout: 4000 });
    console.log(`✅ Connected directly to your running Chrome browser via port ${CDP_PORT}!`);
    const contexts = browser.contexts();
    context = contexts.length > 0 ? contexts[0] : await browser.newContext();
    const pages = context.pages();
    page = pages.length > 0 ? pages[0] : await context.newPage();
  } catch (cdpErr) {
    console.log(`⚠️  Could not connect to Chrome on port ${CDP_PORT}.`);
    console.log(`\n💡 To connect to your existing Chrome with your current LinkedIn login:`);
    console.log(`   Run in your Mac terminal:`);
    console.log(`   "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --remote-debugging-port=9222`);
    console.log(`   (Or run: ./launch-chrome.sh)\n`);

    const fallbackChoice = await askUser(`Would you like to launch a dedicated Chrome browser window instead? (y/n): `);
    if (fallbackChoice.trim().toLowerCase() !== 'y') {
      console.log(`\nExiting. Please start Chrome with --remote-debugging-port=9222 and run again.`);
      process.exit(0);
    }

    console.log(`\n🚀 Launching headful Chrome with persistent profile at .chrome-session...`);
    const sessionDir = path.join(process.cwd(), '.chrome-session');
    context = await chromium.launchPersistentContext(sessionDir, {
      headless: false,
      channel: 'chrome',
      viewport: { width: 1280, height: 860 },
      args: [
        '--disable-blink-features=AutomationControlled',
        '--start-maximized'
      ]
    });
    page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();
  }

  // Ensure window is in front and verify LinkedIn session
  console.log(`\n🌐 Navigating to LinkedIn to verify session...`);
  await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await sleep(2500);

  const currentUrl = page.url();
  if (currentUrl.includes('/login') || currentUrl.includes('/checkpoint') || currentUrl.includes('/uas/')) {
    console.log(`\n⚠️  You are not logged into LinkedIn in this browser window.`);
    console.log(`👉 Please log into LinkedIn now in the opened browser.`);
    await askUser(`Press [ENTER] here once you have finished logging in...`);
    console.log(`Continuing with automation...\n`);
  } else {
    console.log(`✅ LinkedIn session verified! Logged in and active.\n`);
  }

  // Step 2: Fetch candidates from SQLite database
  const candidatePool = db.prepare(`
    SELECT * FROM connections
    WHERE match_count > 0 AND (status = 'New' OR status IS NULL)
    ORDER BY max_potential_earnings DESC, match_count DESC, id ASC
    LIMIT ?
  `).all(Math.max(TARGET_SENDS * 3, 60));

  if (candidatePool.length === 0) {
    console.log(`🎉 No uncontacted matched candidates found in database! (All have been messaged or reviewed).`);
    return;
  }

  console.log(`🎯 Target Goal: Send ${TARGET_SENDS} referral intros and then stop.`);
  console.log(`📋 Candidate queue loaded: ${candidatePool.length} top candidates available.\n`);

  const mode = isAutoMode ? 'auto' : (isStepMode ? 'step' : 'interactive');
  let runMode = mode;
  if (runMode === 'interactive') {
    const choice = await askUser(`Choose execution mode:\n  1) Supervised Mode (Review in browser & press Enter to send each) [Default]\n  2) Autonomous Mode (Visual auto-send with human delays)\nEnter 1 or 2: `);
    runMode = choice.trim() === '2' ? 'auto' : 'step';
  }

  console.log(`\n🚀 Starting batch in ${runMode.toUpperCase()} mode (Target: ${TARGET_SENDS} sends)...\n`);

  let sentCount = 0;
  let skippedCount = 0;

  for (let i = 0; i < candidatePool.length; i++) {
    if (sentCount >= TARGET_SENDS) {
      console.log(`\n🎉 Target Goal Reached! Successfully sent ${sentCount}/${TARGET_SENDS} referral intros. Stopping cleanly!`);
      break;
    }

    const candidate = candidatePool[i];
    const matchedJobs = JSON.parse(candidate.matched_jobs || '[]');
    const topJob = matchedJobs[0] || { name: 'AI Specialist', reward: 1000, url: 'https://jobs.micro1.ai' };

    console.log(`---------------------------------------------------------------`);
    console.log(`👤 [Progress: ${sentCount}/${TARGET_SENDS} Sent] ${candidate.full_name}`);
    console.log(`💼 ${candidate.position} at ${candidate.company}`);
    console.log(`🎯 Matched: ${topJob.name} ($${topJob.reward})`);
    console.log(`🔗 Profile: ${candidate.linkedin_url}`);

    if (!candidate.linkedin_url || !candidate.linkedin_url.includes('linkedin.com/in/')) {
      console.log(`⚠️ Invalid LinkedIn URL. Skipping.`);
      updateConnection(candidate.id, { status: 'Skipped - Invalid URL' });
      skippedCount++;
      continue;
    }

    try {
      // 1. Generate shortened referral link
      const shortUrl = await getShortUrl(topJob.url);
      const messageText = composeMessage(candidate, topJob, shortUrl);

      // 2. Navigate to profile
      console.log(`   Navigating to profile...`);
      await page.goto(candidate.linkedin_url, { waitUntil: 'domcontentloaded', timeout: 35000 });
      await sleep(getRandomInt(2000, 3500));

      // 3. Human Simulation: Scroll profile naturally
      console.log(`   Simulating human review (scrolling)...`);
      await page.evaluate(() => window.scrollBy({ top: 400, behavior: 'smooth' }));
      await sleep(getRandomInt(1500, 2500));
      await page.evaluate(() => window.scrollBy({ top: -400, behavior: 'smooth' }));
      await sleep(getRandomInt(1000, 1800));

      // 4. Locate Message Button
      console.log(`   Looking for Message button...`);
      let messageBtn = null;

      // Check primary top card button
      const topButtons = page.locator('div.pv-top-card-v2-ctas button, div.ph5 button, section.artdeco-card button');
      const count = await topButtons.count();

      for (let b = 0; b < count; b++) {
        const btn = topButtons.nth(b);
        const text = (await btn.innerText() || '').trim();
        const aria = (await btn.getAttribute('aria-label') || '').trim();
        if (/^message$/i.test(text) || (/message/i.test(aria) && !/more/i.test(aria))) {
          messageBtn = btn;
          break;
        }
      }

      // If not in primary buttons, check "More" dropdown
      if (!messageBtn) {
        const moreBtn = page.locator('button[aria-label*="More actions"], button:has-text("More")').first();
        if (await moreBtn.isVisible()) {
          console.log(`   Checking "More" dropdown...`);
          const moreBox = await moreBtn.boundingBox();
          if (moreBox) {
            await humanMouseMove(page, moreBox.x + moreBox.width / 2, moreBox.y + moreBox.height / 2);
            await moreBtn.click();
            await sleep(800);
            const dropdownMsg = page.locator('div[role="menuitem"]:has-text("Message"), div.artdeco-dropdown__item:has-text("Message")').first();
            if (await dropdownMsg.isVisible()) {
              messageBtn = dropdownMsg;
            }
          }
        }
      }

      if (!messageBtn) {
        console.log(`⚠️  No direct Message button available for ${candidate.full_name} (Likely not 1st-degree or locked).`);
        updateConnection(candidate.id, {
          status: 'Skipped - Not 1st Degree',
          notes: 'No direct message button on profile'
        });
        skippedCount++;
        await safePacingCooldown(getRandomInt(10, 15));
        continue;
      }

      // Click the Message button
      const btnBox = await messageBtn.boundingBox();
      if (btnBox) {
        await humanMouseMove(page, btnBox.x + btnBox.width / 2, btnBox.y + btnBox.height / 2);
      }
      await messageBtn.click();
      await sleep(getRandomInt(1200, 2000));

      // 5. Check if InMail credits are required
      const isInMailModal = await page.locator('text="Send InMail", text="InMail credits", text="1 credit to send"').first().isVisible().catch(() => false);
      if (isInMailModal) {
        console.log(`⚠️  Requires InMail credits. Skipping to protect credits.`);
        const dismissBtn = page.locator('button[aria-label="Dismiss"], button[aria-label="Close"]').first();
        if (await dismissBtn.isVisible()) await dismissBtn.click();
        updateConnection(candidate.id, {
          status: 'Skipped - InMail Required',
          notes: 'Requires InMail credits'
        });
        skippedCount++;
        await safePacingCooldown(getRandomInt(12, 18));
        continue;
      }

      // 6. Locate the message textbox
      console.log(`   Locating message composer...`);
      const textbox = page.locator('div[role="textbox"][contenteditable="true"], div.msg-form__contenteditable').first();
      await textbox.waitFor({ state: 'visible', timeout: 10000 });
      await sleep(600);

      const textBoxRect = await textbox.boundingBox();
      if (textBoxRect) {
        await humanMouseMove(page, textBoxRect.x + 20, textBoxRect.y + 20);
      }
      await textbox.click();
      await sleep(getRandomInt(400, 800));

      // 7. Human Typing Simulation
      console.log(`✍️  Simulating human keystrokes for personalized message...`);
      await humanType(page, messageText);
      await sleep(getRandomInt(1200, 2000));

      // 8. Decision: Supervised inspection vs Autonomous
      let doSend = false;

      if (runMode === 'step') {
        console.log(`\n👁️  VISUAL INSPECTION: Message typed in browser window!`);
        console.log(`   Candidate: ${candidate.full_name} (${topJob.name} - $${topJob.reward})`);
        const userAction = await askUser(`   👉 Press [ENTER] to Send, [s] to Skip, or [q] to Quit: `);
        const trimmed = userAction.trim().toLowerCase();
        if (trimmed === 'q') {
          console.log(`Stopping bot as requested.`);
          break;
        } else if (trimmed === 's') {
          console.log(`Skipped by user.`);
          updateConnection(candidate.id, { status: 'Skipped by User' });
          skippedCount++;
          // Close active message box
          const closeBtn = page.locator('button[data-control-name="overlay.close_conversation_window"], button[aria-label*="Close your conversation"]').first();
          if (await closeBtn.isVisible()) await closeBtn.click();
          continue;
        } else {
          doSend = true;
        }
      } else {
        // Auto mode: pause 4 seconds for visual review
        console.log(`   Pausing 4s for visual human review...`);
        await sleep(4000);
        doSend = true;
      }

      if (doSend) {
        if (isDryRun) {
          console.log(`🧪 [DRY RUN ACTIVE]: Message was typed and visually inspected in browser.`);
          console.log(`   (Send button was NOT clicked because --dry-run was specified).`);
          sentCount++;
          await sleep(2500);
          // Close chat popup
          const closeBtn = page.locator('button[data-control-name="overlay.close_conversation_window"], button[aria-label*="Close your conversation"]').first();
          if (await closeBtn.isVisible()) await closeBtn.click();
        } else {
          // Find Send button
          const sendBtn = page.locator('button.msg-form__send-button, button[type="submit"]:has-text("Send")').first();
          if (await sendBtn.isVisible() && !(await sendBtn.isDisabled())) {
            const sendBox = await sendBtn.boundingBox();
            if (sendBox) {
              await humanMouseMove(page, sendBox.x + sendBox.width / 2, sendBox.y + sendBox.height / 2);
            }
            await sendBtn.click();
            console.log(`🚀 Message sent to ${candidate.full_name}!`);
            sentCount++;

            // Update SQLite
            updateConnection(candidate.id, {
              status: 'Intro Sent',
              notes: `Intro sent via Playwright Bot for role: ${topJob.name} ($${topJob.reward}) on ${new Date().toLocaleString()}`
            });

            await sleep(2000);

            // Close chat popup to keep browser clean
            const closeBtn = page.locator('button[data-control-name="overlay.close_conversation_window"], button[aria-label*="Close your conversation"]').first();
            if (await closeBtn.isVisible()) {
              await closeBtn.click();
            }
          } else {
            console.log(`⚠️ Send button was disabled or not found.`);
          }
        }
      }

      if (sentCount >= TARGET_SENDS) {
        console.log(`\n🎉 Target Goal Reached! Successfully sent ${sentCount}/${TARGET_SENDS} referral intros. Stopping cleanly!`);
        break;
      }

      // Safe pacing delay before next candidate
      if (i < candidatePool.length - 1) {
        const cooldownSeconds = getRandomInt(25, 40);
        await safePacingCooldown(cooldownSeconds);
      }

    } catch (err) {
      console.error(`❌ Error processing ${candidate.full_name}:`, err.message);
      skippedCount++;
    }
  }

  console.log(`\n===============================================================`);
  console.log(`🎉 Batch Run Complete!`);
  console.log(`✅ Messages Sent: ${sentCount}`);
  console.log(`⏭️  Skipped / Reviewed: ${skippedCount}`);
  console.log(`📊 Check your local dashboard: http://localhost:3333`);
  console.log(`===============================================================\n`);
}

main().catch(err => {
  console.error('Fatal bot error:', err);
  process.exit(1);
});
