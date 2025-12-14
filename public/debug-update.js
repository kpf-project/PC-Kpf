/**
 * Debug Script for PWA Update Detection
 *
 * วิธีใช้:
 * 1. เปิด Console (F12) บน production site
 * 2. Copy script นี้ทั้งหมดแล้ว paste ลงใน Console
 * 3. กด Enter
 * 4. ดูผลลัพธ์
 */

(async function debugPWAUpdate() {
  console.log('🔍 Starting PWA Update Debug...\n');

  // 1. ตรวจสอบ Service Worker
  console.log('1️⃣ Checking Service Worker...');
  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    console.log('✅ Service Worker supported');
    console.log(`📦 Registered: ${registrations.length} worker(s)`);

    if (registrations.length > 0) {
      registrations.forEach((reg, i) => {
        console.log(`   Worker ${i+1}:`, {
          scope: reg.scope,
          active: !!reg.active,
          waiting: !!reg.waiting,
          installing: !!reg.installing,
        });
      });
    } else {
      console.log('⚠️ No Service Worker registered!');
    }
  } else {
    console.log('❌ Service Worker NOT supported');
  }

  console.log('\n');

  // 2. ตรวจสอบ localStorage
  console.log('2️⃣ Checking localStorage...');
  const storedVersion = localStorage.getItem('app_version');
  const updatedAt = localStorage.getItem('app_version_updated_at');
  console.log('📦 Stored version:', storedVersion || 'NOT SET');
  console.log('📅 Updated at:', updatedAt || 'NOT SET');

  console.log('\n');

  // 3. ตรวจสอบ version.json จาก server
  console.log('3️⃣ Fetching version.json from server...');
  try {
    const response = await fetch('/version.json', { cache: 'no-cache' });
    const versionInfo = await response.json();
    console.log('✅ Server version:', versionInfo.version);
    console.log('📅 Build date:', versionInfo.buildDate);
    console.log('📦 Full response:', versionInfo);

    // 4. เปรียบเทียบ version
    console.log('\n4️⃣ Comparing versions...');
    if (storedVersion === versionInfo.version) {
      console.log('⚠️ Versions MATCH - Popup will NOT show');
      console.log(`   Local: ${storedVersion}`);
      console.log(`   Server: ${versionInfo.version}`);
    } else {
      console.log('✅ Versions DIFFER - Popup SHOULD show');
      console.log(`   Local: ${storedVersion || 'NOT SET'}`);
      console.log(`   Server: ${versionInfo.version}`);
    }
  } catch (error) {
    console.log('❌ Failed to fetch version.json:', error.message);
  }

  console.log('\n');

  // 5. ตรวจสอบ UpdatePopup component
  console.log('5️⃣ Checking UpdatePopup component...');
  const hasUpdatePopup = document.querySelector('[data-update-popup]');
  console.log('UpdatePopup in DOM:', hasUpdatePopup ? '✅ Found' : '❌ Not found');

  console.log('\n');

  // 6. แนะนำขั้นตอนถัดไป
  console.log('6️⃣ Recommended Actions:');
  if (storedVersion === versionInfo?.version) {
    console.log('   → Clear localStorage: localStorage.removeItem("app_version")');
    console.log('   → Reload page: location.reload()');
  }
  if (registrations && registrations.length === 0) {
    console.log('   → Service Worker not registered. Check next.config.ts');
  }

  console.log('\n✅ Debug complete!\n');
})();
