# Campaign Builder - Kiehl's Prototype

An interactive, single-page prototype that simulates an AI-chat-led campaign builder for Kiehl's.

## Features

- **Split-pane UI**: Chat interface on the left, Campaign Canvas on the right
- **Natural language commands**: Build and modify campaigns through chat
- **Progressive disclosure**: Collapsible sections with inline editing
- **Conflict detection**: Automatic schedule conflict checking
- **Launch flow**: Save Draft, Schedule, and Launch with validation

## Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

## Chat Commands

- `create valentine's moisturizer campaign` - Creates the seed campaign
- `change discount to 15%` - Updates the offer percentage
- `move launch to feb 8` - Shifts the entire schedule
- `remove last sms` - Removes the last SMS touchpoint
- `add push` - Adds a Push notification channel
- `show me conflicts` - Displays current schedule conflicts
- `rename campaign to [name]` - Renames the campaign

## Seed Scenario

- **Brand**: Kiehl's
- **Campaign**: Valentine's Day Moisturizer Launch
- **Product**: Ultra Hydration Moisturizer
- **Offer**: 20% off
- **Window**: Feb 7–Feb 14, 2026
- **Channels**: SMS + Email
- **Touches**: 3 (Launch SMS, Reminder Email, Last-chance SMS)

## Tech Stack

- React 18
- TypeScript
- Vite
- CSS (no frameworks)
