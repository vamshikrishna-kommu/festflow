/**
 * FESTFLOW 2.0 - MASTER PERFORMANCE OPTIMIZATION VERIFICATION SUITE
 * 
 * Verifies:
 * 1. Vite chunk splitting configuration (vendor-three, vendor-excel, etc.)
 * 2. Asynchronous 3D Scene loading & IntersectionObserver loop pausing
 * 3. Dynamic import of heavy ExcelJS library in EventReportsPage
 * 4. Input component lightweight transitions (transition-colors vs transition-all)
 * 5. Non-blocking asynchronous Google Fonts in index.html
 * 6. useDebounce hook implementation & integration in DiscoverPage and TeammateDiscoveryPage
 * 7. React 19 useDeferredValue in EventRegistrationsPage
 * 8. Promise.all concurrent querying in StudentDashboardPage and AuthContext
 * 9. Explicit Logo dimensions for CLS prevention
 * 10. Database performance index migration integrity (038_performance_indexes.sql)
 */

import * as fs from 'fs';
import * as path from 'path';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  } else {
    console.log(`✅ PASSED: ${message}`);
  }
}

console.log('================================================================');
console.log(' FESTFLOW 2.0: MASTER PERFORMANCE OPTIMIZATION TEST SUITE');
console.log('================================================================\n');

// 1. Vite manualChunks configuration
const viteConfigPath = path.resolve('vite.config.ts');
assert(fs.existsSync(viteConfigPath), 'vite.config.ts exists');
const viteContent = fs.readFileSync(viteConfigPath, 'utf8');
assert(viteContent.includes('vendor-three'), 'vite.config.ts configures vendor-three chunk');
assert(viteContent.includes('vendor-excel'), 'vite.config.ts configures vendor-excel chunk');
assert(viteContent.includes('vendor-qrcode'), 'vite.config.ts configures vendor-qrcode chunk');
assert(viteContent.includes('vendor-animations'), 'vite.config.ts configures vendor-animations chunk');
assert(viteContent.includes('vendor-supabase'), 'vite.config.ts configures vendor-supabase chunk');
assert(viteContent.includes('vendor-react'), 'vite.config.ts configures vendor-react chunk');

// 2. 3D Scene optimization
const heroSectionPath = path.resolve('src/components/sections/HeroSection.tsx');
assert(fs.existsSync(heroSectionPath), 'HeroSection.tsx exists');
const heroSectionContent = fs.readFileSync(heroSectionPath, 'utf8');
assert(heroSectionContent.includes('React.lazy') || heroSectionContent.includes('lazy('), 'HeroSection lazy-loads HeroScene3D');
assert(heroSectionContent.includes('CharacterDuoFallback'), 'HeroSection uses CharacterDuoFallback placeholder');

const heroScenePath = path.resolve('src/components/sections/HeroScene3D.tsx');
assert(fs.existsSync(heroScenePath), 'HeroScene3D.tsx exists');
const heroSceneContent = fs.readFileSync(heroScenePath, 'utf8');
assert(heroSceneContent.includes('IntersectionObserver'), 'HeroScene3D utilizes IntersectionObserver for viewport tracking');
assert(heroSceneContent.includes('cancelAnimationFrame'), 'HeroScene3D pauses render loop when offscreen');

// 3. Dynamic import of ExcelJS
const eventReportsPath = path.resolve('src/pages/club/EventReportsPage.tsx');
assert(fs.existsSync(eventReportsPath), 'EventReportsPage.tsx exists');
const eventReportsContent = fs.readFileSync(eventReportsPath, 'utf8');
assert(!eventReportsContent.includes("import { exportEventRegistrationsToExcel } from '@/lib/excelExport';"), 'EventReportsPage does not statically import excelExport');
assert(eventReportsContent.includes("await import('@/lib/excelExport')"), 'EventReportsPage dynamically imports excelExport on-demand');

// 4. Input component transitions
const inputPath = path.resolve('src/components/ui/Input.tsx');
assert(fs.existsSync(inputPath), 'Input.tsx exists');
const inputContent = fs.readFileSync(inputPath, 'utf8');
assert(!inputContent.includes('transition-all duration-200'), 'Input.tsx removed heavy transition-all duration-200');
assert(inputContent.includes('transition-colors duration-150'), 'Input.tsx uses lightweight transition-colors duration-150');

// 5. Non-blocking Google Fonts
const indexPath = path.resolve('index.html');
assert(fs.existsSync(indexPath), 'index.html exists');
const indexContent = fs.readFileSync(indexPath, 'utf8');
assert(indexContent.includes('rel="preload"') && indexContent.includes('as="style"'), 'index.html preloads font stylesheets');
assert(indexContent.includes('media="print"') && indexContent.includes("this.media='all'"), 'index.html uses non-blocking print-to-all font loading');

// 6. useDebounce hook implementation & integration
const debounceHookPath = path.resolve('src/hooks/useDebounce.ts');
assert(fs.existsSync(debounceHookPath), 'useDebounce.ts exists');
const debounceHookContent = fs.readFileSync(debounceHookPath, 'utf8');
assert(debounceHookContent.includes('export function useDebounce'), 'useDebounce is exported properly');

const discoverPagePath = path.resolve('src/pages/DiscoverPage.tsx');
const discoverContent = fs.readFileSync(discoverPagePath, 'utf8');
assert(discoverContent.includes('useDebounce(search, 300)'), 'DiscoverPage debounces search queries at 300ms');

const teammatePagePath = path.resolve('src/pages/community/TeammateDiscoveryPage.tsx');
const teammateContent = fs.readFileSync(teammatePagePath, 'utf8');
assert(teammateContent.includes('useDebounce(searchQuery, 300)'), 'TeammateDiscoveryPage debounces search queries at 300ms');

// 7. useDeferredValue in EventRegistrationsPage
const registrationsPagePath = path.resolve('src/pages/club/EventRegistrationsPage.tsx');
const registrationsContent = fs.readFileSync(registrationsPagePath, 'utf8');
assert(registrationsContent.includes('useDeferredValue(search)'), 'EventRegistrationsPage uses useDeferredValue for instant input response');

// 8. Promise.all concurrent querying
const studentDashboardPath = path.resolve('src/pages/dashboard/StudentDashboardPage.tsx');
const studentDashContent = fs.readFileSync(studentDashboardPath, 'utf8');
assert(studentDashContent.includes('Promise.all(['), 'StudentDashboardPage fetches registrations, notifications, and certificates concurrently');
assert(studentDashContent.includes('useMemo(() => {'), 'StudentDashboardPage uses useMemo for single-pass metric counts');

const authContextPath = path.resolve('src/context/AuthContext.tsx');
const authContextContent = fs.readFileSync(authContextPath, 'utf8');
assert(authContextContent.includes('Promise.all(['), 'AuthContext fetches subprofile and club membership concurrently');

// 9. Logo CLS dimensions
const logoPath = path.resolve('src/components/ui/Logo.tsx');
const logoContent = fs.readFileSync(logoPath, 'utf8');
assert(logoContent.includes('width={dims.width}'), 'Logo includes explicit width attribute');
assert(logoContent.includes('height={dims.height}'), 'Logo includes explicit height attribute');

// 10. Performance database indexes
const migration38Path = path.resolve('supabase/migrations/038_performance_indexes.sql');
assert(fs.existsSync(migration38Path), '038_performance_indexes.sql exists');
const migration38Content = fs.readFileSync(migration38Path, 'utf8');
assert(migration38Content.includes('idx_events_status_start_date'), '038 migration indexes events(status, start_date)');
assert(migration38Content.includes('idx_registrations_student_status'), '038 migration indexes registrations(student_id, status)');
assert(migration38Content.includes('idx_payment_submissions_event_status'), '038 migration indexes payment_submissions(event_id, status)');
assert(migration38Content.includes('idx_certificates_student_event'), '038 migration indexes certificates(student_id, event_id)');

console.log('\n================================================================');
console.log(' ALL 10 MASTER PERFORMANCE OPTIMIZATION CHECKS PASSED SUCCESSFULLY! 🚀');
console.log('================================================================');
