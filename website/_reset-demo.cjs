const admin = require('firebase-admin');
const sa = require('../secrets/service-account.json');
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

async function countCol(p) {
  try {
    const snap = await db.collection(p).count().get();
    return snap.data().count;
  } catch(e) {
    return 'ERR: ' + e.message.slice(0,60);
  }
}

(async () => {
  console.log('=== TRUOC RESET ===');
  for (const p of ['posts','announcements','short_links','audit','feedback','users','keys','apps_meta','standards','dinh_muc','vat_lieu','roads_vn','trishteam_library','sign_images','bridge_images']) {
    console.log(`  ${p}: ${await countCol(p)}`);
  }
  const c = await db.doc('_meta/posts_counter').get();
  console.log(`  _meta/posts_counter: ${c.exists ? c.data().value : '(khong co)'}`);
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
