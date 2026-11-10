import { test, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

describe('Landing Page Multi-Industry Showcase & Hardware Audit', () => {
  it('StandeePreview.jsx includes interactive switching for restaurant, hotel, and cinema', () => {
    const standeeFilePath = path.join(process.cwd(), 'src', 'components', 'Landing', 'components', 'StandeePreview.jsx');
    assert.ok(fs.existsSync(standeeFilePath), 'StandeePreview.jsx must exist');
    const content = fs.readFileSync(standeeFilePath, 'utf8');

    assert.ok(content.includes('VERTICAL_DATA'), 'Must contain VERTICAL_DATA object');
    assert.ok(content.includes('restaurant:'), 'Must configure restaurant vertical');
    assert.ok(content.includes('hotel:'), 'Must configure hotel vertical');
    assert.ok(content.includes('cinema:'), 'Must configure cinema vertical');
    assert.ok(content.includes('km-standee-tab-strip'), 'Must include interactive standee tab strip');
    assert.ok(content.includes('km-theme-restaurant'), 'Must include restaurant theme styling');
    assert.ok(content.includes('km-theme-hotel'), 'Must include hotel theme styling');
    assert.ok(content.includes('km-theme-cinema'), 'Must include cinema theme styling');
    assert.ok(content.includes('THERMAL KOT RECEIPT'), 'Must include restaurant thermal receipt');
    assert.ok(content.includes('PANTRY DISPATCH TICKET'), 'Must include hotel pantry ticket');
    assert.ok(content.includes('SEAT RUNNER CONCESSION SLIP'), 'Must include cinema concession runner slip');
  });

  it('CategoryStrip.jsx supports interactive onSelectIndustry and smooth scroll', () => {
    const categoryFilePath = path.join(process.cwd(), 'src', 'components', 'Landing', 'components', 'CategoryStrip.jsx');
    assert.ok(fs.existsSync(categoryFilePath), 'CategoryStrip.jsx must exist');
    const content = fs.readFileSync(categoryFilePath, 'utf8');

    assert.ok(content.includes('onSelectIndustry'), 'Must accept onSelectIndustry callback');
    assert.ok(content.includes("industry: 'hotel'"), 'Must map hotel category to hotel vertical');
    assert.ok(content.includes("industry: 'cinema'"), 'Must map cinema category to cinema vertical');
    assert.ok(content.includes("industry: 'restaurant'"), 'Must map dining to restaurant vertical');
    assert.ok(content.includes('standee-preview'), 'Must link to standee-preview section');
  });

  it('ProductShowcase.jsx supports hotel and cinema sub-switching and live dispatch', () => {
    const showcaseFilePath = path.join(process.cwd(), 'src', 'components', 'Landing', 'components', 'ProductShowcase.jsx');
    assert.ok(fs.existsSync(showcaseFilePath), 'ProductShowcase.jsx must exist');
    const content = fs.readFileSync(showcaseFilePath, 'utf8');

    assert.ok(content.includes('serviceSubMode'), 'Must support serviceSubMode state');
    assert.ok(content.includes('Room 408 • Grand Luxury Suite'), 'Must showcase hotel room dining & butler call');
    assert.ok(content.includes('Audi 3 • Row D • Seat 12'), 'Must showcase cinema seat concession delivery');
    assert.ok(content.includes('Intermission Rush Timer'), 'Must feature intermission countdown');
    assert.ok(content.includes('Hotel Pantry Dispatch'), 'Must feature hotel pantry dispatch in live KDS');
  });

  it('LandingPage.jsx wires selectedIndustry to CategoryStrip, StandeePreview, ProductShowcase, and Pricing', () => {
    const landingFilePath = path.join(process.cwd(), 'src', 'components', 'Landing', 'LandingPage.jsx');
    assert.ok(fs.existsSync(landingFilePath), 'LandingPage.jsx must exist');
    const content = fs.readFileSync(landingFilePath, 'utf8');

    assert.ok(content.includes('<CategoryStrip \n        selectedIndustry={selectedIndustry}'), 'CategoryStrip must receive selectedIndustry');
    assert.ok(content.includes('<StandeePreview \n        selectedIndustry={selectedIndustry}'), 'StandeePreview must receive selectedIndustry');
    assert.ok(content.includes('<ProductShowcase \n        selectedIndustry={selectedIndustry}'), 'ProductShowcase must receive selectedIndustry');
    assert.ok(content.includes('<Pricing \n        publicPlans={publicPlans} \n        trialDays={trialDays} \n        selectedIndustry={selectedIndustry}'), 'Pricing must receive selectedIndustry');
  });
});
