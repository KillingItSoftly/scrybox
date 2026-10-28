import React from 'react';
import { createRoot } from 'react-dom/client';
import CardInspectorModal from '../../src/components/CardInspectorModal';
import { I18nProvider } from '../../src/utils/i18n';
import '../../src/index.css';
import '../../src/theme-manabox.css';
const card = { id: 'synthetic-entry', name: 'Synthetic Test Card', quantity: 2, purchase_price: 1.25, language: 'English', set_name: 'Test Set', rarity: 'common', image_url: '/logo.svg' };
createRoot(document.getElementById('root')).render(<React.StrictMode><I18nProvider><CardInspectorModal card={card} startInEdit onClose={() => { document.body.dataset.closed = 'true'; }} /></I18nProvider></React.StrictMode>);
