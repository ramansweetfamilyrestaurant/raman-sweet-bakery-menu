import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Sound Manager and Kitchen Alarm Invariants', () => {
  const soundManagerPath = path.resolve(__dirname, '../../src/utils/soundManager.js');
  const adminDashboardPath = path.resolve(__dirname, '../../src/components/Admin/AdminDashboard.jsx');

  test('soundManager.js has re-entrancy lock to prevent machine-gun rapid loop', () => {
    const code = fs.readFileSync(soundManagerPath, 'utf8');

    // 1. Tracks sirenIsPlaying & sirenStartTime
    assert.ok(code.includes('this.sirenIsPlaying'), 'soundManager must track sirenIsPlaying flag');
    assert.ok(code.includes('this.sirenStartTime'), 'soundManager must track sirenStartTime');

    // 2. Re-entrancy guard in playKitchenSiren
    assert.ok(code.includes('now - (this.sirenStartTime || 0) < 2350'), 'playKitchenSiren must guard against rapid re-entrant calls');

    // 3. Smooth attack (starts at 0.0001) preventing pop/click
    assert.ok(code.includes('gain1.gain.setValueAtTime(0.0001, t)'), 'Siren pulse 1 must start at silence (0.0001) for smooth attack');
    assert.ok(code.includes('gain2.gain.setValueAtTime(0.0001, t + 0.10)'), 'Siren pulse 2 must start at silence (0.0001) for smooth attack');

    // 4. stopKitchenSiren must NOT spike gain to 1.0 (gain.value || 1.0 is strictly forbidden)
    assert.ok(!code.includes('gain.value || 1.0'), 'stopKitchenSiren must NEVER use gain.value || 1.0 which spiked gain to 100% on silence');
  });

  test('AdminDashboard.jsx uses stable boolean hasPendingOrders dependency to prevent stutter on every poll', () => {
    const code = fs.readFileSync(adminDashboardPath, 'utf8');

    // 1. hasPendingOrders is computed via useMemo
    assert.ok(code.includes('const hasPendingOrders = useMemo(() => {'), 'hasPendingOrders must be memoized boolean');

    // 2. useEffect depends on [hasPendingOrders]
    assert.ok(code.includes('}, [hasPendingOrders]);'), 'Pending alarm useEffect must depend strictly on [hasPendingOrders]');
    assert.ok(!code.includes('stopPendingAlarm();\n    };\n  }, [orders]);'), 'Pending alarm useEffect must NOT depend directly on [orders] array');

    // 3. No duplicate playKitchenChime in loadOrders
    assert.ok(!code.includes('if (!pendingLoopRef.current) {\n          playKitchenChime();\n        }'), 'loadOrders must not duplicate playKitchenChime calls');
  });
});
