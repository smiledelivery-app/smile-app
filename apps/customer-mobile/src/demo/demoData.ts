import type { CustomerOrder, Product, Vendor } from '@makanza/mobile-core';

export const demoLocation = { latitude: 6.5095, longitude: 3.3711 };

export const demoVendors: Vendor[] = [
  { id: 'demo-vendor-ada', name: 'Ada’s Kitchen', cuisine: 'Restaurant · Nigerian comfort food', neighborhood: 'Yaba', eta: '25–35 min', fee: 900, rating: 4.8, image: '', open: true, demo: true, latitude: 6.514, longitude: 3.376 },
  { id: 'demo-vendor-green', name: 'Green Bowl', cuisine: 'Restaurant · fresh bowls & wraps', neighborhood: 'Surulere', eta: '20–30 min', fee: 700, rating: 4.7, image: '', open: true, demo: true, latitude: 6.496, longitude: 3.361 },
  { id: 'demo-vendor-suya', name: 'Suya Corner', cuisine: 'Restaurant · grill & suya', neighborhood: 'Ikeja', eta: '30–40 min', fee: 1200, rating: 4.9, image: '', open: true, demo: true, latitude: 6.601, longitude: 3.351 },
  { id: 'demo-vendor-pharmacy', name: 'Everyday Pharmacy', cuisine: 'Pharmacy & wellness', neighborhood: 'Yaba', eta: '20–30 min', fee: 600, rating: 4.8, image: '', open: true, demo: true, latitude: 6.512, longitude: 3.37 },
  { id: 'demo-vendor-groceries', name: 'Fresh Basket Groceries', cuisine: 'Groceries & essentials', neighborhood: 'Surulere', eta: '25–35 min', fee: 700, rating: 4.7, image: '', open: true, demo: true, latitude: 6.49, longitude: 3.36 },
  { id: 'demo-vendor-pickup', name: 'Smile Pickup Point', cuisine: 'Pickup', neighborhood: 'Ikeja', eta: 'Ready in 15 min', fee: 0, rating: 4.9, image: '', open: true, demo: true, latitude: 6.596, longitude: 3.35 },
  { id: 'demo-vendor-market', name: 'Yaba Local Market', cuisine: 'Local market produce', neighborhood: 'Yaba', eta: '30–45 min', fee: 900, rating: 4.6, image: '', open: true, demo: true, latitude: 6.509, longitude: 3.373 },
];

export const demoProducts: Record<string, Product[]> = {
  'demo-vendor-ada': [
    { id: 'demo-product-jollof', name: 'Smoky party jollof', description: 'Smoky basmati rice, plantain and a choice of protein.', category: 'Rice', priceMinor: 380000, imageUrl: null, stock: 12, addons: [{ id: 'demo-addon-chicken', productId: 'demo-product-jollof', name: 'Grilled chicken', priceMinor: 150000, available: true }, { id: 'demo-addon-plantain', productId: 'demo-product-jollof', name: 'Extra plantain', priceMinor: 50000, available: true }] },
    { id: 'demo-product-suya', name: 'Beef suya bowl', description: 'Spiced beef, onions, tomatoes and creamy slaw.', category: 'Grill', priceMinor: 420000, imageUrl: null, stock: 9 },
    { id: 'demo-product-zobo', name: 'Chilled zobo', description: 'Hibiscus, ginger and pineapple, served cold.', category: 'Drinks', priceMinor: 90000, imageUrl: null, stock: 20 },
  ],
  'demo-vendor-green': [
    { id: 'demo-product-bowl', name: 'Lagos crunch bowl', description: 'Avocado, grilled chicken, greens and citrus dressing.', category: 'Bowls', priceMinor: 520000, imageUrl: null, stock: 8 },
    { id: 'demo-product-wrap', name: 'Spicy plantain wrap', description: 'Roasted plantain, beans and smoky pepper sauce.', category: 'Wraps', priceMinor: 350000, imageUrl: null, stock: 10 },
  ],
  'demo-vendor-suya': [
    { id: 'demo-product-beef', name: 'Classic beef suya', description: 'Char-grilled beef with yaji, onions and tomatoes.', category: 'Grill', priceMinor: 450000, imageUrl: null, stock: 11 },
    { id: 'demo-product-kunu', name: 'Kunu aya', description: 'Cool, creamy tiger-nut drink.', category: 'Drinks', priceMinor: 180000, imageUrl: null, stock: 14 },
  ],
  'demo-vendor-pharmacy': [
    { id: 'demo-product-vitamin', name: 'Daily multivitamins', description: 'Sample wellness item. Consult a pharmacist for advice.', category: 'Wellness', priceMinor: 280000, imageUrl: null, stock: 8 },
    { id: 'demo-product-bandage', name: 'First-aid kit', description: 'A compact sample kit for everyday first aid.', category: 'First aid', priceMinor: 650000, imageUrl: null, stock: 5 },
  ],
  'demo-vendor-groceries': [
    { id: 'demo-product-tomatoes', name: 'Fresh tomatoes', description: 'Market-fresh tomatoes, one basket.', category: 'Produce', priceMinor: 250000, imageUrl: null, stock: 10 },
    { id: 'demo-product-rice', name: 'Long grain rice', description: 'Everyday long grain rice, 2 kg.', category: 'Pantry', priceMinor: 380000, imageUrl: null, stock: 12 },
  ],
  'demo-vendor-pickup': [
    { id: 'demo-product-pickup-meal', name: 'Lunch pickup bundle', description: 'Pre-packed jollof and a chilled drink, ready for pickup.', category: 'Pickup', priceMinor: 420000, imageUrl: null, stock: 6 },
  ],
  'demo-vendor-market': [
    { id: 'demo-product-pepper', name: 'Pepper market mix', description: 'A sample market mix of fresh peppers and onions.', category: 'Produce', priceMinor: 180000, imageUrl: null, stock: 9 },
    { id: 'demo-product-yam', name: 'White yam', description: 'One medium-sized white yam from the local market.', category: 'Produce', priceMinor: 550000, imageUrl: null, stock: 7 },
  ],
};

const demoDate = (hoursAgo: number) => new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();

export const demoOrders: CustomerOrder[] = [
  {
    id: 'demo-order-1042', status: 'PICKED_UP', totalMinor: 620000, createdAt: demoDate(1),
    vendor: { name: 'Ada’s Kitchen' }, delivery: { status: 'PICKED_UP', assignedAt: demoDate(0.5), riderName: 'Tunde A.' }, deliveryCode: '284613',
    items: [{ id: 'demo-line-1', nameSnapshot: 'Smoky party jollof', quantity: 1, unitPriceMinor: 380000, addons: [{ id: 'demo-line-addon-1', nameSnapshot: 'Grilled chicken', quantity: 1, unitPriceMinor: 150000 }] }],
    events: [{ id: 'demo-event-1', status: 'CONFIRMED', createdAt: demoDate(1) }, { id: 'demo-event-2', status: 'PREPARING', createdAt: demoDate(0.8) }, { id: 'demo-event-3', status: 'PICKED_UP', createdAt: demoDate(0.5) }],
  },
  {
    id: 'demo-order-1038', status: 'DELIVERED', totalMinor: 590000, createdAt: demoDate(26),
    vendor: { name: 'Green Bowl' }, delivery: { status: 'COMPLETED', assignedAt: demoDate(25.5), riderName: 'Mariam K.' },
    items: [{ id: 'demo-line-2', nameSnapshot: 'Lagos crunch bowl', quantity: 1, unitPriceMinor: 520000 }],
    events: [{ id: 'demo-event-4', status: 'CONFIRMED', createdAt: demoDate(26) }, { id: 'demo-event-5', status: 'DELIVERED', createdAt: demoDate(25) }],
  },
];
