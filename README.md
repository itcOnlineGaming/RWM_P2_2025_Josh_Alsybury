# Time Manager - Smart Calendar Component

A SvelteKit application for managing and optimizing time slots using Google Calendar integration.

## Project Structure
```
my-srl-project/
├── src/
│   ├── lib/                     # Reusable utilities
│   ├── routes/
│   │   └── +page.svelte        # Main calendar interface
│   └── app.html
├── packages/TimeManager/        # Component library (future extraction)
├── static/                      # Static assets
├── README.md                    # This file
└── package.json
```

## Features

- 📅 Google Calendar integration
- 🎯 Smart time block management
- 📊 Weekly capacity visualization
- ⏰ Automatic gap detection
- 🔄 Real-time calendar sync

## Installation
```bash
# Clone the repository
git clone [https://github.com/itcOnlineGaming/RWM_P2_2025_Josh_Alsybury/]
cd my-srl-project

# Install dependencies
npm install

# Run development server
npm run dev
```

Visit `http://localhost:5173` to see the app.

## Setup

1. Configure Google Calendar API credentials
2. Add `.tokens.json` to project root (see `.tokens.json.example`)
3. Run the application and connect your calendar

## Components

- **Time Blocks**: Create reusable time block templates
- **Weekly Calendar**: View all events in a bucket-based layout
- **Capacity Tracker**: Monitor available time slots per day
- **Gap Finder**: Automatically identify free time slots

## Technologies

- SvelteKit 2.0
- TypeScript
- Google Calendar API
- Vite

## Design

See the [Figma design file](https://www.figma.com/design/4gBaFbsDDISO4y8gbsOVzd/Real-World-Sim---Design-Process?node-id=692-587&p=f&t=YCShlkNMCFTLzyIy-0) for the component design work and UI specifications.

