import { test, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { 
  STANDEE_THEMES, 
  STANDEE_FRAMES, 
  buildStandeeCardHtml 
} from '../../src/utils/standeeTemplates.js';

describe('Standee & Sticker Designer Multi-Vertical Capabilities', () => {
  it('Includes dedicated Hotel Sapphire theme and Cinema Amber theme', () => {
    assert.ok(STANDEE_THEMES.hotel_sapphire, 'hotel_sapphire theme must exist');
    assert.ok(STANDEE_THEMES.cinema_amber, 'cinema_amber theme must exist');

    assert.strictEqual(STANDEE_THEMES.hotel_sapphire.badgeBg, '#1E3A8A');
    assert.strictEqual(STANDEE_THEMES.cinema_amber.badgeBorder, '#F59E0B');
  });

  it('Includes Hotel Tent Card and Cinema Armrest Sticker frames', () => {
    assert.ok(STANDEE_FRAMES.tent_card, 'tent_card frame must exist');
    assert.ok(STANDEE_FRAMES.sticker, 'sticker frame must exist');

    assert.strictEqual(STANDEE_FRAMES.tent_card.name, 'Hotel Tent Card');
    assert.strictEqual(STANDEE_FRAMES.sticker.name, 'Cinema Armrest Sticker');
  });

  it('buildStandeeCardHtml dynamically renders IN-ROOM DINING and hotel instructions for rooms', () => {
    const html = buildStandeeCardHtml({
      space: { spaceType: 'room', spaceNumber: '302', badge: 'ROOM 302' },
      restaurant: { name: 'Grand Palace Resort' },
      themeId: 'hotel_sapphire',
      frameStyle: 'tent_card',
      qrDataUrl: 'data:image/png;base64,mock'
    });

    assert.ok(html.includes('IN-ROOM DINING'), 'Must render IN-ROOM DINING pill');
    assert.ok(html.includes('कमरे में खाना मंगाएं'), 'Must render Hindi room service instruction');
    assert.ok(html.includes('Scan QR'), 'Must render Scan QR step');
    assert.ok(html.includes('Room Delivery'), 'Must render Room Delivery step');
  });

  it('buildStandeeCardHtml dynamically renders DELIVER TO SEAT and cinema instructions for cinema seats', () => {
    const html = buildStandeeCardHtml({
      space: { spaceType: 'cinema_seat', spaceNumber: 'E14', badge: 'AUDI 2 • E-14' },
      restaurant: { name: 'Starview Multiplex' },
      themeId: 'cinema_amber',
      frameStyle: 'sticker',
      qrDataUrl: 'data:image/png;base64,mock'
    });

    assert.ok(html.includes('DELIVER TO SEAT'), 'Must render DELIVER TO SEAT pill');
    assert.ok(html.includes('सीट पर मंगाएं'), 'Must render Hindi cinema seat instruction');
    assert.ok(html.includes('Scan QR'), 'Must render Scan QR step');
    assert.ok(html.includes('Seat Delivery'), 'Must render Seat Delivery step');
  });

  it('buildStandeeCardHtml dynamically renders SCAN TO ORDER and table instructions for restaurants', () => {
    const html = buildStandeeCardHtml({
      space: { spaceType: 'table', spaceNumber: '5', badge: 'TABLE 05' },
      restaurant: { name: 'Royal Spice Restaurant' },
      themeId: 'emerald',
      frameStyle: 'acrylic',
      qrDataUrl: 'data:image/png;base64,mock'
    });

    assert.ok(html.includes('SCAN TO ORDER'), 'Must render SCAN TO ORDER pill');
    assert.ok(html.includes('Scan QR'), 'Must render Scan QR step');
    assert.ok(html.includes('Order Food'), 'Must render Order Food step');
  });
});
