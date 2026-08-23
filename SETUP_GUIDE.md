# Project Setup Guide

## Overview
This guide covers setting up the Podcast Summary project with all features enabled, including the process logging system and OCR capabilities.

---

## Prerequisites

- **Node.js**: v18+ (for both backend and frontend)
- **npm**: v9+ (for package management)
- **PostgreSQL**: v12+ (for database)
- **Git**: v2+ (for version control)

---

## Installation Steps

### 1. Clone & Navigate
```bash
git clone <repository-url>
cd podcast-summary
```

### 2. Backend Setup

#### Install Dependencies
```bash
cd backend
npm install
```

#### Environment Configuration
Create a `.env` file in the `backend` directory:

```env
PORT=4000
DATABASE_URL=postgresql://user:password@localhost:5432/podcast_summary
NODE_ENV=development
```

#### Database Setup
```bash
# Generate migrations
npm run db:generate

# Run migrations
npm run db:migrate

# (Optional) Open Drizzle Studio
npm run db:studio
```

#### Start Backend
```bash
npm run dev
# Backend will run on http://localhost:4000
```

### 3. Frontend Setup

#### Install Dependencies
```bash
cd ../frontend
npm install
```

#### Environment Configuration
Create a `.env` file in the `frontend` directory:

```env
VITE_API_URL=http://localhost:4000/api
```

#### Start Frontend
```bash
npm run dev
# Frontend will run on http://localhost:5173
```

### 4. Verify Setup
- Frontend: http://localhost:5173
- Backend: http://localhost:4000
- Health check: http://localhost:4000/health

---

## Process Logging System

### Overview
The project includes an automated system that tracks all modifications and updates the PROCESS_LOG.md file.

### Files Involved
- **PROCESS_LOG.md**: Main log file tracking all changes
- **.claude/hooks/process-log-hook.ts**: Automated hook script

### How It Works

#### Automatic Updates
The logging system can be triggered:

1. **On Git Commits** (via pre-commit hook)
2. **On File Changes** (via file watcher)
3. **Manually** (by running the hook script)

#### Manual Trigger
To manually update the process log:

```bash
# From project root
npx tsx .claude/hooks/process-log-hook.ts
```

#### Interpreting the Log
Each entry includes:
- **Date**: When the change was made
- **Type**: Category (Feature, Fix, Enhancement, Refactor, Documentation, Chore)
- **Component**: Where changes were made (Frontend, Backend, or Both)
- **Files**: What files were modified
- **Description**: Summary of the change

### Example Entry
```markdown
### 2026-08-23 14:50
- **Type**: Feature
- **Component**: Frontend
- **Files**: `frontend/src/components/ImageScanner.vue`, `frontend/package.json`
- **Description**: Added OCR (Optical Character Recognition) functionality
```

---

## OCR Setup (Tesseract.js)

### Installation
The OCR library is automatically installed with frontend dependencies:

```bash
npm install tesseract.js
```

### Usage
The ImageScanner component is located at:
```
frontend/src/components/ImageScanner.vue
```

### Configuration
No additional configuration needed! Tesseract.js works entirely in the browser.

### Language Support
To add additional languages:

Edit `frontend/src/components/ImageScanner.vue`:

```typescript
// Change this line:
const worker = await createWorker('eng', 1, {

// To:
const worker = await createWorker(['eng', 'spa'], 1, { // English + Spanish
```

Available language codes: See [Tesseract.js documentation](https://github.com/naptha/tesseract.js)

---

## Navigation System

### File Structure
- **Component**: `frontend/src/components/NavigationBar.vue`
- **Integration**: `frontend/src/App.vue`
- **Router**: `frontend/src/router.ts`

### Adding New Summary Types

To add a new summary type (e.g., "Book Notes"):

1. **Update NavigationBar.vue**:
```typescript
const navItems: NavItem[] = [
  {
    id: 'podcast',
    label: 'Podcast Notes',
    icon: '🎙️',
    description: 'Summarize and organize podcast notes',
  },
  // Add this:
  {
    id: 'book-notes',
    label: 'Book Notes',
    icon: '📚',
    description: 'Take notes while reading',
  },
];
```

2. **Update API client** if needed for type-specific fields

3. **Create type-specific form** if needed

---

## Database Schema

### Main Tables

#### summaries
```sql
CREATE TABLE summaries (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  podcast_name VARCHAR(255),
  session_title VARCHAR(255) NOT NULL,
  guest VARCHAR(255),
  url TEXT,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Relationships
- One user can have many summaries
- Each summary belongs to exactly one user

---

## Development Workflow

### Typical Development Session

1. **Start Backend**
```bash
cd backend
npm run dev
```

2. **Start Frontend** (in another terminal)
```bash
cd frontend
npm run dev
```

3. **Make Changes**
- Edit files as needed
- Changes hot-reload automatically

4. **Update Process Log** (optional)
```bash
npx tsx .claude/hooks/process-log-hook.ts
```

5. **Commit & Push**
```bash
git add .
git commit -m "Add new feature"
git push
```

### Building for Production

#### Backend
```bash
cd backend
npm run build
npm start
```

#### Frontend
```bash
cd frontend
npm run build
# Output in dist/
```

---

## Project Structure

```
podcast-summary/
├── backend/
│   ├── src/
│   │   ├── server.ts           # Express server
│   │   ├── routes/             # API endpoints
│   │   ├── db/                 # Database config
│   │   ├── ai/                 # AI integration
│   │   └── middleware/         # Express middleware
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/
│   ├── src/
│   │   ├── App.vue             # Main app component
│   │   ├── router.ts           # Route definitions
│   │   ├── components/         # Reusable components
│   │   │   ├── NavigationBar.vue
│   │   │   ├── ImageScanner.vue
│   │   │   ├── SummaryForm.vue
│   │   │   └── ...
│   │   ├── views/              # Page components
│   │   ├── api/                # API client
│   │   └── lib/                # Utilities
│   ├── package.json
│   └── tsconfig.json
│
├── PROCESS_LOG.md              # Change tracking
├── FEATURES.md                 # Feature documentation
├── SETUP_GUIDE.md              # This file
├── .claude/
│   ├── hooks/
│   │   └── process-log-hook.ts # Logging automation
│   └── settings.json           # Claude Code config
│
└── README.md                   # Project overview
```

---

## Troubleshooting

### Backend Won't Start
```bash
# Check if port 4000 is in use
lsof -i :4000

# Check database connection
# Verify DATABASE_URL in .env is correct
# Ensure PostgreSQL is running
```

### Frontend Build Fails
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
npm run dev
```

### OCR Not Working
```bash
# Clear browser cache and hard reload (Cmd+Shift+R)
# Check browser console for errors (F12 > Console)
# Tesseract.js requires about 50MB of data - ensure sufficient bandwidth
```

### Process Log Hook Not Working
```bash
# Verify .claude/hooks/process-log-hook.ts exists
# Check it's executable: chmod +x .claude/hooks/process-log-hook.ts
# Run manually to test: npx tsx .claude/hooks/process-log-hook.ts
```

---

## Performance Tips

### Frontend
- Use Vite dev server (automatic hot reload)
- Clear browser cache if seeing stale assets
- Chrome DevTools > Throttling to test slow connections

### Backend
- Use `npm run dev` for development (tsx with watch mode)
- Monitor database queries in Drizzle Studio
- Use Morgan logger for request tracking

### Database
- Keep indexes on frequently queried columns
- Monitor query performance using `EXPLAIN`
- Consider partitioning if table gets very large

---

## Security Notes

### Environment Variables
- Never commit `.env` files to version control
- Use `.env.example` template for team setup
- Rotate API keys regularly

### Database
- Use strong passwords for PostgreSQL
- Restrict database access to localhost during development
- Use SSL for production connections

### Frontend
- No sensitive data in localStorage
- Use HTTPS in production
- Enable CORS only for trusted domains

---

## Next Steps

1. **Review FEATURES.md** for user guide
2. **Check PROCESS_LOG.md** for recent changes
3. **Start developing** following the workflow above
4. **Update PROCESS_LOG.md** when making major changes

---

## Resources

- **Vue 3 Docs**: https://vuejs.org/
- **Express.js**: https://expressjs.com/
- **Drizzle ORM**: https://orm.drizzle.team/
- **Tailwind CSS**: https://tailwindcss.com/
- **Tesseract.js**: https://github.com/naptha/tesseract.js/
- **PostgreSQL**: https://www.postgresql.org/docs/

---

Last Updated: 2026-08-23
