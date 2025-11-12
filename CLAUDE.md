# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Freetar is an open-source alternative frontend to Ultimate Guitar that scrapes and displays guitar tabs and chords. This is a Next.js 14 implementation using the App Router, TypeScript, and React 18.

**Key Principle**: All user data (favorites, preferences) is stored client-side in localStorage. The application proxies requests to Ultimate Guitar through Next.js API routes to avoid CORS issues.

## Development Commands

```bash
# Development
npm run dev              # Start dev server on localhost:3000

# Production
npm run build           # Build for production
npm start               # Start production server

# Code Quality
npm run lint            # Run ESLint
```

## Architecture Overview

### Data Flow Architecture

1. **Search Flow**: User → Search Page → `/api/search` → Ultimate Guitar → Cheerio Parser → Search Results Component
2. **Tab Flow**: User → Tab Page → `/api/tab` → Ultimate Guitar → Tab Parser → Tab Display Component
3. **Favorites**: Stored entirely in browser localStorage, no server-side persistence
4. **Setlist Flow**: User → Setlist Viewer → Load from localStorage → Display cached tabs → No API requests needed

### Web Scraping Strategy

**Critical**: The app scrapes Ultimate Guitar by:
- Fetching HTML pages from `ultimate-guitar.com` and `tabs.ultimate-guitar.com`
- Extracting JSON data from `<div class="js-store" data-content="...">` elements
- Using a Chrome User-Agent header to avoid blocking
- Filtering out "Pro" and "Official" tab types (paid content)

**Location**: All scraping logic is in `src/lib/ug.ts`:
- `searchTabs()`: Searches for tabs by term and page number
- `getTab()`: Fetches a specific tab by URL path
- `fixTab()`: Converts tab markup (`[ch]`, `[tab]`) to HTML
- `getChords()`: Parses chord fingering data (applicature) into visual diagrams

### Client-Side State Architecture

**Favorites System**:
- Storage format: `{ [tabUrl]: { artist_name, song, type, rating, tab_url } }`
- Managed independently in each component that displays favorites
- Export/import uses JSON serialization

**Setlists System**:
- Storage key: `freetar_setlists` in localStorage
- Storage format: `{ [setlistId]: Setlist }` where Setlist contains metadata and array of SetlistSong objects
- Each SetlistSong includes:
  - Metadata: `tab_url`, `artist_name`, `song_name`, `type`, `rating`
  - Cached data: Full `SongDetail` object with tab content, chords, fingerings
- Complete offline functionality - no API requests needed after initial song addition
- Export/import as `.setlist` ZIP files containing metadata and individual song JSON files
- Automatic backward compatibility migration adds `order` field to existing setlists

**Transpose System**:
- Uses 12-tone equal temperament: `['A'], ['A#', 'Bb'], ['B', 'Cb'], ...`
- Transposes by finding note index and shifting modulo 12
- Applied client-side by parsing and modifying DOM elements with `.chord-root` and `.chord-bass` classes
- Original chord values stored in component state for reset functionality

**Auto-scroll System**:
- Uses `setInterval` with configurable timeout (50-500ms)
- Pauses automatically on user wheel/touch events
- Speed control adjusts interval timeout

**Font Size System**:
- Adjustable font size for tab content (lyrics and chords)
- Range: 10px to 24px in 2px increments
- Default: 14px
- Applied via inline style to tab content div
- Reset button to return to default size

### Component Architecture

**Page Components** (`src/app/`):
- `page.tsx`: Home page showing setlists and favorites from localStorage
- `search/page.tsx`: Client component that fetches search results via `/api/search`
- `tab/page.tsx`: Client component that fetches tab data via `/api/tab`
- `setlist/page.tsx`: Setlist viewer with song navigation and keyboard shortcuts
- `about/page.tsx`: Static about page

**Reusable Components** (`src/components/`):
- `Navbar.tsx`: Contains search form with client-side routing
- `SearchResults.tsx`: Table with sorting, pagination, favorite toggles, and setlist dropdown
- `TabDisplay.tsx`: Main tab viewer with transpose, autoscroll, chord visibility controls, and setlist dropdown
- `ChordDiagram.tsx`: Renders chord fingering diagrams from applicature data
- `SetlistManager.tsx`: Complete setlist CRUD interface with expand/collapse, reordering, export/import

### Type System

All types in `src/types/index.ts`:
- `SearchResult`: Individual search result metadata
- `SongDetail`: Complete tab with content, metadata, chords, and fingerings
- `ChordVariant`: Map of fret numbers to string press patterns `{ [fret]: [0|1, 0|1, ...] }`
- `SearchResponse`: Paginated search results
- `FreetarError`: Custom error class for user-facing error messages
- `SetlistSong`: Song entry in setlist with metadata and optional cached `SongDetail`
- `Setlist`: Complete setlist with id, name, created date, order, and array of SetlistSong objects
- `SetlistCollection`: Dictionary of setlists keyed by setlist ID

### Dark Mode Implementation

Dark mode uses DaisyUI's `data-theme` attribute:
- Initial theme detection in `<script>` tag in `layout.tsx` (runs before hydration)
- Checks localStorage first, falls back to system preference
- Toggle updates both DOM attribute and localStorage
- Prevents flash of wrong theme on page load
- DaisyUI provides 'light' and 'dark' theme variants

### Progressive Web App (PWA) Implementation

Freetar is a fully-featured Progressive Web App that can be installed on mobile and desktop devices:

**PWA Configuration** (`next.config.js`):
- Uses `next-pwa` package wrapped around Next.js config
- Service worker destination: `public/` directory
- Auto-registers service worker for offline functionality
- Disabled in development mode for easier debugging
- Generates `sw.js` and workbox files automatically during build

**Web App Manifest** (`public/manifest.json`):
- App name: "Freetar - Free Guitar Tabs"
- Display mode: `standalone` (runs without browser UI)
- Theme colors: White background, dark gray theme (#1f2937)
- Icons: 8 sizes from 72x72 to 512x512 pixels
- Supports both `any` and `maskable` purposes for adaptive icons

**Metadata Configuration** (`src/app/layout.tsx`):
- Viewport export: Proper mobile viewport and theme color
- Manifest link: Points to `/manifest.json`
- Apple Web App support: Enabled with custom status bar styling
- Icons metadata: Standard icons (192x192, 512x512) and Apple touch icon (152x152)
- All PWA metadata separated from general metadata per Next.js 14 requirements

**PWA Icons**:
- Generated from `public/guitar.png` source image
- 8 sizes: 72x72, 96x96, 128x128, 144x144, 152x152, 192x192, 384x384, 512x512
- Format: PNG with transparent backgrounds
- Generation script: Icons can be regenerated using `sharp` package

**PWA Features**:
- Install to home screen on mobile/desktop
- Offline support with service worker caching
- Fast loading with cached resources
- Standalone app experience without browser chrome
- Automatic updates when new service worker is available

**Generated Files** (excluded from git):
- `/public/sw.js`: Main service worker file
- `/public/sw.js.map`: Source map for debugging
- `/public/workbox-*.js`: Workbox runtime files for caching strategies
- All generated during `npm run build` and excluded via `.gitignore`

## Key Implementation Details

### Chord Diagram Calculation

The `getChords()` function in `src/lib/ug.ts` converts Ultimate Guitar's "applicature" data:
1. Takes array of fret positions for each string (6 strings)
2. Calculates min/max fret range
3. Creates 6-fret visualization window showing pressed strings
4. Maps finger positions (1-4, T for thumb, x for unstrummed)
5. Returns both visual grid and fingering labels

### Tab Content Parsing

Tab content arrives with markup tags:
- `[ch]C#m[/ch]` → chord markup
- `[tab]...[/tab]` → tab content wrapper
- Regex extracts chord root, quality (m, 7, maj7, etc.), and bass note
- Converted to HTML spans: `<span class="chord"><span class="chord-root">C#</span><span class="chord-quality">m</span></span>`
- Whitespace converted to `&nbsp;` to preserve formatting in HTML

**Important**: Ultimate Guitar sometimes includes trailing slashes in chord notation (e.g., `A/`, `E/`). These are NOT bass notes but formatting artifacts. The regex pattern `[^\[/]+` excludes slashes from chord quality, and trailing slashes are explicitly removed with `.replace(/\/+$/, '')`. Only treat `/X` as a bass note if there's a note letter after the slash.

### URL Routing Pattern

Tab URLs from Ultimate Guitar use format: `/tab/artist-name/song-name/tab-123456`
- `SearchResult.tab_url` stores the pathname only (not full URL)
- Next.js route: `/tab?path=artist-name/song-name/tab-123456`
- API route extracts path param and fetches from `https://tabs.ultimate-guitar.com/tab/${path}`

### Tailwind CSS and DaisyUI Integration

The app uses Tailwind CSS with DaisyUI component library:
- Tailwind CSS provides utility-first styling
- DaisyUI adds pre-built components (buttons, cards, tables, etc.)
- Configuration in `tailwind.config.js` and `postcss.config.js`
- Global styles and Tailwind directives in `src/app/globals.css`
- DaisyUI themes configured for light/dark mode switching

## Setlists Architecture

**Key Design Decision**: Store complete tab data in setlists to enable offline viewing and eliminate API requests during performances.

**Library** (`src/lib/setlist.ts`):
- `loadSetlists()`: Loads setlists from localStorage with automatic migration for `order` field
- `saveSetlists()`: Persists setlists to localStorage
- `createSetlist()`: Creates new setlist with unique ID and timestamp-based order
- `addSetlist()`: Adds newly created setlist to collection
- `deleteSetlist()`: Removes setlist from collection
- `renameSetlist()`: Updates setlist name
- `addSongToSetlist()`: Adds song with optional full `SongDetail` cached data
- `removeSongFromSetlist()`: Removes song by tab_url
- `moveSongUp()` / `moveSongDown()`: Reorders songs within setlist
- `moveSetlistUp()` / `moveSetlistDown()`: Reorders setlists by swapping order values
- `exportSetlist()`: Creates ZIP file with metadata.json and individual song JSON files
- `importSetlist()`: Parses ZIP file and creates new setlist with imported data
- `getSetlistsArray()`: Returns sorted array of setlists by order field

**Setlist Viewer** (`src/app/setlist/page.tsx`):
- URL format: `/setlist?id={setlistId}&song={songIndex}`
- Loads complete setlist from localStorage (no API calls)
- Song navigation: Previous/Next buttons and keyboard shortcuts
- Keyboard shortcuts: ← or H (previous), → or L (next), S (toggle song list)
- Displays current position (e.g., "3 / 10")
- Shows song list dropdown for quick jumping
- Integrates full TabDisplay with all features (transpose, autoscroll, etc.)
- URL updates as user navigates between songs

**Adding Songs to Setlists**:
- From `TabDisplay.tsx`: Passes complete `tab` object to `addSongToSetlist()`
- From `SearchResults.tsx`: Only passes metadata (no cached data yet)
- Full tab data stored in `SetlistSong.tabData` field
- Songs without cached data shown as disabled in SetlistManager

**Data Format**:
```typescript
SetlistSong {
  tab_url: string          // e.g., "/tab/artist/song/123456"
  artist_name: string
  song_name: string
  type: string            // "Chords", "Tab", etc.
  rating: number
  tabData?: SongDetail    // Complete cached tab data
}

Setlist {
  id: string              // e.g., "setlist_1234567890_abc123"
  name: string            // User-provided name
  created: string         // ISO timestamp
  order?: number          // Sort order (optional for backward compatibility)
  songs: SetlistSong[]    // Array of songs with cached data
}
```

**Export Format** (`.setlist` ZIP file):
- `metadata.json`: Setlist metadata (id, name, created, version, songCount)
- `songs/song-1.json`, `songs/song-2.json`, etc.: Individual SetlistSong objects with full tabData

**Backward Compatibility**:
- `loadSetlists()` automatically adds `order` field to old setlists using created timestamp
- Migration happens transparently on first load after update
- `order` field is optional in TypeScript types

## ChordPro Format Support

The app supports conversion to/from ChordPro format (https://songbook-pro.com/docs/manual/chordpro/):

**ChordPro Library** (`src/lib/chordpro.ts`):
- `convertToChordPro()`: Converts SongDetail to ChordPro text with metadata directives
- `chordProToHtml()`: Converts ChordPro text to displayable HTML
- `parseChordPro()`: Parses ChordPro text into structured data
- `exportChordProFile()`: Downloads tab as .cho file

**Format**:
- Metadata: `{title: Song Name}`, `{artist: Artist Name}`, `{capo: 3}`, etc.
- Chords: `[Am]`, `[G7/B]` (inline with lyrics)
- Comments: `{comment: Difficulty: Easy}`
- Transpose value preserved in export

**View Modes**:
- HTML View: Original Ultimate Guitar format with styled chords
- ChordPro View: Converts to ChordPro format for display (chords in brackets)

## Common Modifications

### Adding New Tab Features

When adding features to tab display:
1. Add UI controls in `TabDisplay.tsx`
2. Use React state for feature toggle/values
3. Apply transformations in `getTransposedTab()` or similar utility
4. Ensure print-friendly by adding `no-print` class to controls

### Modifying Search/Filter Logic

Search filtering happens in `src/lib/ug.ts`:
- `getResults()` filters by tab type (excludes "Pro" and "Official")
- To add more filters, modify this function before returning results
- Filtering can also happen client-side in `SearchResults.tsx`

### Changing Scraping Selectors

If Ultimate Guitar changes their HTML structure:
- Update selectors in `searchTabs()` and `getTab()` in `src/lib/ug.ts`
- Look for `div.js-store` with `data-content` attribute
- JSON structure is nested: `data.store.page.data.{results|tab|tab_view}`
- Test with actual Ultimate Guitar pages to verify structure

## Environment & Dependencies

**No environment variables required** for basic functionality.

**Optional Environment Variables**:
- `NEXT_PUBLIC_BASE_URL`: Sets the base URL for metadata and Open Graph images (defaults to `https://freetar.de`). Useful when deploying to custom domains.

**Critical Dependencies**:
- `cheerio`: Server-side HTML parsing (like jQuery for Node.js)
- `axios`: HTTP client with better error handling than fetch
- `jszip`: ZIP file creation for setlist export/import
- `tailwindcss` + `daisyui`: Utility-first CSS framework with component library (note: custom CSS in globals.css for chord styling)
- `next-pwa`: Progressive Web App support with service worker generation (note: peer dependency warnings for webpack/@babel/core are expected and can be ignored as Next.js provides these internally)

**Development Dependencies**:
- `sharp`: Image processing library for generating PWA icons in multiple sizes

**Node Version**: Requires Node.js ≥22.0.0 (specified in package.json engines)

## Deployment Considerations

**Vercel Deployment**:
- Uses Next.js serverless functions for API routes
- No additional configuration needed
- Ensure Node.js version matches engine requirement

**Docker Deployment**:
- Complete Docker setup with multi-stage builds (see `Dockerfile` and `docker-compose.yml`)
- Uses Node.js 22 Alpine images for minimal size
- Exposes port 3000 by default
- Run with `docker-compose up -d`
- See `DOCKER.md` for detailed deployment instructions
- Optional: Set `NEXT_PUBLIC_BASE_URL` environment variable for custom domains

**CORS**: Not an issue because scraping happens server-side in API routes, not from browser.

## Privacy & Legal

- No user tracking or analytics
- No server-side data storage
- Acts as a proxy/scraper for Ultimate Guitar content
- Users should be aware this scrapes a third-party site
- Not affiliated with Ultimate Guitar

## Testing Ultimate Guitar Scraping

To test if scraping still works after UG updates:
1. Try searching for a common song (e.g., "Wonderwall")
2. Check browser devtools network tab for API route responses
3. If errors occur, inspect actual UG HTML structure
4. Update selectors in `src/lib/ug.ts` as needed
5. Look for `div.js-store` and verify JSON structure in `data-content` attribute
