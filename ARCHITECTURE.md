# Architecture & System Design

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER BROWSER                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Vue 3 Frontend (http://localhost:5173)                │   │
│  │                                                          │   │
│  │  ┌──────────────────────────────────────────────────┐  │   │
│  │  │ App.vue (Main Container)                         │  │   │
│  │  │ ├─ Header (Logo + User ID)                       │  │   │
│  │  │ ├─ NavigationBar (Podcast | Food Review | +New) │  │   │
│  │  │ └─ Router View (Current Page)                    │  │   │
│  │  └──────────────────────────────────────────────────┘  │   │
│  │                                                          │   │
│  │  ┌──────────────────────────────────────────────────┐  │   │
│  │  │ SummaryNewView / SummaryEditView                 │  │   │
│  │  │                                                   │  │   │
│  │  │ ┌────────────────────────────────────────────┐  │  │   │
│  │  │ │ SummaryForm.vue                            │  │  │   │
│  │  │ │ ├─ Podcast/Food Details Fields             │  │  │   │
│  │  │ │ ├─ ✏️ Write Tab → RichEditor               │  │  │   │
│  │  │ │ └─ 📸 Scan Tab → ImageScanner              │  │  │   │
│  │  │ │                                             │  │  │   │
│  │  │ │ ImageScanner.vue (Tesseract.js)            │  │  │   │
│  │  │ │ ├─ Drag & Drop Zone                        │  │  │   │
│  │  │ │ ├─ File Input Handler                      │  │  │   │
│  │  │ │ ├─ OCR Processing (Browser)                │  │  │   │
│  │  │ │ └─ Text Extraction Output                  │  │  │   │
│  │  │ └────────────────────────────────────────────┘  │  │   │
│  │  └──────────────────────────────────────────────────┘  │   │
│  │                                                          │   │
│  │  ┌──────────────────────────────────────────────────┐  │   │
│  │  │ Tesseract.js (OCR Engine - ~50MB)               │  │   │
│  │  │ - Runs entirely in browser                      │  │   │
│  │  │ - No server communication                       │  │   │
│  │  │ - Supports: EN, ES, FR, etc.                    │  │   │
│  │  └──────────────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                         ↓↑ API Calls                             │
│                    (JSON over HTTP)                              │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────┐
│                    BACKEND SERVER                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Express.js Server (http://localhost:4000)                      │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ API Routes (/api/summaries, /api/ai)                   │   │
│  │                                                          │   │
│  │ ├─ GET    /api/summaries           → List all          │   │
│  │ ├─ GET    /api/summaries/:id       → Get one           │   │
│  │ ├─ POST   /api/summaries           → Create new        │   │
│  │ ├─ PATCH  /api/summaries/:id       → Update            │   │
│  │ ├─ DELETE /api/summaries/:id       → Delete            │   │
│  │ └─ POST   /api/ai/generate         → AI summary        │   │
│  └─────────────────────────────────────────────────────────┘   │
│                         ↓↑ ORM                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Drizzle ORM (Database Layer)                           │   │
│  │ - Type-safe queries                                     │   │
│  │ - Schema management                                     │   │
│  │ - Migration support                                     │   │
│  └─────────────────────────────────────────────────────────┘   │
│                         ↓↑ SQL                                   │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────┐
│                    DATABASE                                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  PostgreSQL Database                                             │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ tables:                                                 │   │
│  │ ├─ summaries                                            │   │
│  │ │  ├─ id (UUID, PK)                                     │   │
│  │ │  ├─ user_id (UUID)                                    │   │
│  │ │  ├─ podcast_name / restaurant_name                    │   │
│  │ │  ├─ session_title / dish_name                         │   │
│  │ │  ├─ guest / rating                                    │   │
│  │ │  ├─ url / visit_date                                  │   │
│  │ │  ├─ content (Rich text)                               │   │
│  │ │  ├─ created_at                                        │   │
│  │ │  └─ updated_at                                        │   │
│  │ └─ ...more tables as needed                             │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Data Flow Diagrams

### Creating a Summary with OCR

```
User Interface
     ↓
  [Scan Image]
     ↓
ImageScanner Component
     ├─ File Input Handler
     ├─ Drag & Drop Detector
     ↓
  [Browser-side OCR]
     ├─ Load Tesseract.js
     ├─ Initialize worker
     ├─ Process image
     ├─ Extract text
     ↓
  [Display Results]
     ├─ Show preview
     ├─ Display extracted text
     ├─ [Copy] button
     ├─ [Clear] button
     ↓
  [Append to Form]
     ├─ Add text to notes
     ├─ Auto-switch to Write mode
     ↓
  [Submit Summary]
     ├─ POST /api/summaries
     ↓
  Backend Processing
     ├─ Validate input
     ├─ Store in database
     ↓
  Database
     └─ Persist record
```

### Navigation Between Summary Types

```
User clicks navigation tab
     ↓
NavigationBar emits tab change
     ↓
Router changes query param (?type=podcast|food-review)
     ↓
SummaryListView filters data by type
     ↓
Display type-specific summaries
     ↓
User clicks "+ New"
     ↓
Navigate to SummaryNewView with type param
     ↓
SummaryForm loads with correct fields for type
     ↓
User can write or scan notes
     ↓
Submit creates type-specific summary
```

---

## Component Hierarchy

```
App.vue
├── Header
│   ├── Logo/Title
│   └── User ID badge
│
├── NavigationBar
│   ├── Tab: Podcast Notes
│   ├── Tab: Food Reviews
│   └── Button: + New
│
├── Main Content (Router View)
│   ├── SummaryListView
│   │   └── SummaryList (component)
│   │       └── SummaryItem (repeated)
│   │
│   ├── SummaryNewView
│   │   └── SummaryForm
│   │       ├── Form Fields
│   │       ├── RichEditor (Write Mode)
│   │       └── ImageScanner (Scan Mode)
│   │           ├── Upload Zone
│   │           ├── Preview
│   │           └── Text Output
│   │
│   ├── SummaryDetailView
│   │   ├── Summary Display
│   │   └── ExportModal
│   │
│   └── SummaryEditView
│       └── SummaryForm (with initial data)
│
└── Footer
    └── User info
```

---

## Module Dependencies

```
Frontend Dependencies:
├── vue@^3.5.13
│   ├── vue-router@^4.6.4 (Navigation)
│   └── @tailwindcss/vite (Styling)
├── @vueup/vue-quill@^1.5.5 (Rich editor)
├── tesseract.js (OCR - for ImageScanner)
├── html2canvas@^1.4.1 (Export)
└── jspdf@^4.2.1 (PDF generation)

Backend Dependencies:
├── express@^4.21.1 (Server)
├── drizzle-orm@^0.36.4 (ORM)
├── pg@^8.13.1 (Database driver)
├── cors@^2.8.5 (Cross-origin)
├── morgan@^1.10.0 (Logging)
└── dotenv@^16.4.5 (Config)
```

---

## File Organization

```
podcast-summary/
│
├── frontend/                    # Vue 3 SPA
│   ├── src/
│   │   ├── components/          # Reusable components
│   │   │   ├── ImageScanner.vue ✨ (NEW)
│   │   │   ├── NavigationBar.vue ✨ (NEW)
│   │   │   ├── SummaryForm.vue  📝 (MODIFIED)
│   │   │   ├── RichEditor.vue
│   │   │   ├── ExportModal.vue
│   │   │   └── ...
│   │   ├── views/               # Page components
│   │   │   ├── SummaryListView.vue
│   │   │   ├── SummaryNewView.vue
│   │   │   ├── SummaryDetailView.vue
│   │   │   └── SummaryEditView.vue
│   │   ├── api/                 # API client
│   │   │   ├── client.ts
│   │   │   └── user.ts
│   │   ├── lib/                 # Utilities
│   │   │   ├── export.ts
│   │   │   └── sketch.ts
│   │   ├── App.vue              📝 (MODIFIED)
│   │   ├── router.ts
│   │   ├── main.ts
│   │   └── env.d.ts
│   ├── public/
│   ├── package.json             📝 (MODIFIED - tesseract.js added)
│   └── vite.config.ts
│
├── backend/                     # Express server
│   ├── src/
│   │   ├── server.ts            # Main app
│   │   ├── routes/              # API endpoints
│   │   ├── db/                  # Database config
│   │   ├── ai/                  # AI integration
│   │   └── middleware/          # Express middleware
│   ├── package.json
│   └── tsconfig.json
│
├── .claude/
│   ├── hooks/
│   │   └── process-log-hook.ts  ✨ (NEW) - Change logging
│   └── settings.local.json      📝 (MODIFIED)
│
├── Documentation:
│   ├── PROCESS_LOG.md           ✨ (NEW) - Change tracking
│   ├── FEATURES.md              ✨ (NEW) - User guide
│   ├── SETUP_GUIDE.md           ✨ (NEW) - Dev guide
│   ├── ARCHITECTURE.md          ✨ (NEW) - This file
│   ├── IMPLEMENTATION_SUMMARY.md ✨ (NEW) - Summary
│   └── README.md                (Original project info)
│
└── .git/                        # Version control
```

---

## Data Models

### Summary (Base)
```typescript
interface Summary {
  id: string;              // UUID
  userId: string;          // UUID
  type: 'podcast' | 'food-review';  // Summary type
  podcastName?: string;    // For podcasts
  restaurantName?: string; // For food reviews
  sessionTitle: string;    // Required
  content: string;         // Rich text
  url?: string;            // Optional link
  createdAt: Date;
  updatedAt: Date;
}
```

### SummaryInput (Create/Update)
```typescript
interface SummaryInput {
  podcastName?: string;
  restaurantName?: string;
  sessionTitle: string;
  content: string;
  url?: string | null;
  guest?: string | null;
  rating?: number | null;
}
```

---

## Performance Considerations

### Frontend
- **Bundle Size**: ~837 KB (265 KB gzipped)
  - Large due to Tesseract.js OCR engine (~50 MB data files, loaded on-demand)
- **Runtime Performance**: 
  - OCR processing: 5-30 seconds (image dependent)
  - UI interactions: <100ms (Vue reactivity)
- **Optimization Ideas**:
  - Dynamic import for ImageScanner component
  - Lazy load Tesseract worker
  - Cache OCR model data

### Backend
- **Database Queries**: Simple and indexed
- **API Response Time**: <100ms typical
- **Scaling Approach**:
  - Add database connection pooling (PgBouncer)
  - Implement caching (Redis)
  - Load balance with multiple instances

### Database
- **Query Optimization**:
  - Index on user_id for fast lookups
  - Index on created_at for sorting
- **Scaling Strategy**:
  - Partitioning by user_id for multi-tenancy
  - Archive old records to separate storage

---

## Security Architecture

### Frontend Security
- ✅ No sensitive data in localStorage
- ✅ CORS configured properly
- ✅ Input sanitization on forms
- ✅ Client-side validation before submit

### Backend Security
- ✅ Environment variables for secrets
- ✅ CORS whitelist in production
- ✅ Input validation on all endpoints
- ✅ Error handling (no stack traces exposed)

### Database Security
- ✅ Connection via SSL (in production)
- ✅ Strong authentication required
- ✅ Row-level security (per user)
- ✅ Regular backups scheduled

---

## Deployment Architecture

### Development
```
localhost:5173 (Frontend Dev Server)
         ↓
localhost:4000 (Backend Express)
         ↓
PostgreSQL localhost:5432
```

### Production (Recommended)
```
CDN → Static Assets (frontend/dist)
  ↓
Load Balancer → Backend API Servers (multiple instances)
  ↓
Connection Pool → PostgreSQL Database
```

---

## Testing Strategy

### Unit Tests (To be added)
- Component behavior
- API client functions
- Utility functions
- Type checking with TypeScript

### Integration Tests (To be added)
- Form submission flow
- OCR integration
- Navigation between types
- Data persistence

### E2E Tests (To be added)
- Complete user workflows
- Cross-browser compatibility
- Mobile responsiveness

---

## Monitoring & Logging

### Frontend
- Browser console logs (development)
- Error tracking (to be added)
- Performance metrics (to be added)

### Backend
- Morgan HTTP logger
- Console error logging
- Database query logging (available in Drizzle Studio)

### Database
- PostgreSQL logs
- Query performance monitoring
- Connection pool status

---

Last Updated: 2026-08-23
