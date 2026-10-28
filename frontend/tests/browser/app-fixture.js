// Browser-only synthetic API fixture. Production auth is not changed; this
// frontend-only server has no backend or proxy and cannot touch a database.
export const card = { id: 'synthetic-entry', entry_id: 'synthetic-entry', card_id: 'synthetic-card', name: 'Synthetic Test Card', quantity: 2, purchase_price: 1.25, price_trend: 0.5, language: 'English', condition: 'Near Mint', printing: 'Normal', set_id: 'tst', set_name: 'Test Set', rarity: 'common', image_url: '/logo.svg', number: '1', colors: [], color_identity: [], types: ['Artifact'] };
export async function syntheticApp(page) {
  await page.addInitScript(() => {
    localStorage.setItem('bindarr_token', 'browser-test-not-a-real-token');
    localStorage.setItem('bindarr_user', JSON.stringify({ username: 'synthetic', role: 'user' }));
    localStorage.setItem('scrybox_view_synthetic', 'collection');
  });
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() !== 'GET') return route.fulfill({ status: 405, json: { error: 'Read-only browser fixture' } });
    let json = {};
    if (path === '/api/collection') json = [card];
    else if (path === '/api/sets' || /decks|lists|history/.test(path)) json = [];
    else if (path.endsWith('/oracle')) json = { oracle_text: 'Synthetic rules text. No real collection data.' };
    return route.fulfill({ json, headers: { 'X-Total-Count': '1', 'Cache-Control': 'no-store' } });
  });
}
