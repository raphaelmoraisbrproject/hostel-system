import { describe, it, expect, beforeEach } from 'vitest';

/**
 * Testes de Validação para Refatoração de Performance - Calendar.jsx
 *
 * Este arquivo compara a implementação ANTES (usando .filter() e .find())
 * com a implementação DEPOIS (usando Maps pré-computados) para garantir
 * que a lógica de negócio permanece 100% idêntica.
 */

// ============================================================================
// IMPLEMENTAÇÃO ANTES (Atual - usando .filter() e .find())
// ============================================================================

/**
 * Bloco 2.1 - getResourceBookings (implementação atual)
 */
function getResourceBookings_OLD(bookings, row, type) {
  return bookings.filter(b => {
    // Hide cancelled bookings from calendar
    if (b.status === 'Cancelled') return false;

    // Room Header rows (type 'room') never show bookings
    if (type === 'room') return false;

    // Bed rows show bookings linked to that bed
    if (type === 'bed') return b.bed_id === row.id;

    // room_booking rows show bookings linked to the room (without a specific bed)
    if (type === 'room_booking') return b.room_id === row.parentId && !b.bed_id;

    return false;
  });
}

/**
 * Bloco 2.2 - getResourceLocks (implementação atual)
 */
function getResourceLocks_OLD(dateLocks, row, type) {
  return dateLocks.filter(lock => {
    // Room Header rows (type 'room') never show locks
    if (type === 'room') return false;

    // Bed rows show locks linked to that bed
    if (type === 'bed') return lock.bed_id === row.id;

    // room_booking rows show locks linked to the room (without a specific bed)
    if (type === 'room_booking') return lock.room_id === row.parentId && !lock.bed_id;

    return false;
  });
}

/**
 * Bloco 2.3 - getDailyRate (implementação atual)
 */
function getDailyRate_OLD(dailyRates, roomId, dateStr) {
  const rate = dailyRates.find(r => r.room_id === roomId && r.date === dateStr);
  return rate ? rate.price : null;
}

// ============================================================================
// IMPLEMENTAÇÃO DEPOIS (Nova - usando Maps)
// ============================================================================

/**
 * Bloco 2.1 - getResourceBookings (implementação nova com Map)
 */
function buildBookingsMap(bookings) {
  const bookingsMap = new Map();

  bookings.forEach(b => {
    if (b.status === 'Cancelled') return;

    // Bookings com bed_id (camas específicas)
    if (b.bed_id) {
      const key = `bed-${b.bed_id}`;
      if (!bookingsMap.has(key)) bookingsMap.set(key, []);
      bookingsMap.get(key).push(b);
    }

    // Bookings de quarto inteiro (sem bed_id)
    if (!b.bed_id && b.room_id) {
      const key = `room-${b.room_id}`;
      if (!bookingsMap.has(key)) bookingsMap.set(key, []);
      bookingsMap.get(key).push(b);
    }
  });

  return bookingsMap;
}

function getResourceBookings_NEW(bookingsMap, row, type) {
  // Room Header rows never show bookings
  if (type === 'room') return [];

  // Determinar a chave baseada no tipo
  const key = type === 'bed' ? `bed-${row.id}` : `room-${row.parentId}`;

  return bookingsMap.get(key) || [];
}

/**
 * Bloco 2.2 - getResourceLocks (implementação nova com Map)
 */
function buildLocksMap(dateLocks) {
  const locksMap = new Map();

  dateLocks.forEach(lock => {
    // Locks com bed_id (camas específicas)
    if (lock.bed_id) {
      const key = `bed-${lock.bed_id}`;
      if (!locksMap.has(key)) locksMap.set(key, []);
      locksMap.get(key).push(lock);
    }

    // Locks de quarto inteiro (sem bed_id)
    if (!lock.bed_id && lock.room_id) {
      const key = `room-${lock.room_id}`;
      if (!locksMap.has(key)) locksMap.set(key, []);
      locksMap.get(key).push(lock);
    }
  });

  return locksMap;
}

function getResourceLocks_NEW(locksMap, row, type) {
  // Room Header rows never show locks
  if (type === 'room') return [];

  // Determinar a chave baseada no tipo
  const key = type === 'bed' ? `bed-${row.id}` : `room-${row.parentId}`;

  return locksMap.get(key) || [];
}

/**
 * Bloco 2.3 - getDailyRate (implementação nova com Map)
 */
function buildRatesMap(dailyRates) {
  const ratesMap = new Map();

  dailyRates.forEach(rate => {
    ratesMap.set(`${rate.room_id}-${rate.date}`, rate.price);
  });

  return ratesMap;
}

function getDailyRate_NEW(ratesMap, roomId, dateStr) {
  return ratesMap.get(`${roomId}-${dateStr}`) || null;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Compara dois arrays de forma profunda (ignorando ordem)
 */
function compareArrays(arr1, arr2) {
  if (arr1.length !== arr2.length) return false;

  // Converter para strings para comparação profunda
  const sorted1 = arr1.map(obj => JSON.stringify(obj)).sort();
  const sorted2 = arr2.map(obj => JSON.stringify(obj)).sort();

  return JSON.stringify(sorted1) === JSON.stringify(sorted2);
}

// ============================================================================
// TESTES
// ============================================================================

describe('Calendar Performance Refactor - Bloco 2.1: Bookings Map', () => {

  it('Teste 1.1: Bookings de Cama (bed_id presente)', () => {
    const bookings = [
      { id: 1, bed_id: 'bed1', room_id: 'room1', status: 'Confirmed', guest_name: 'João Silva' },
      { id: 2, bed_id: 'bed1', room_id: 'room1', status: 'Checked-in', guest_name: 'Maria Santos' },
      { id: 3, bed_id: 'bed2', room_id: 'room1', status: 'Confirmed', guest_name: 'Pedro Costa' }
    ];
    const row = { id: 'bed1', parentId: 'room1', type: 'bed' };

    const resultOLD = getResourceBookings_OLD(bookings, row, 'bed');
    const bookingsMap = buildBookingsMap(bookings);
    const resultNEW = getResourceBookings_NEW(bookingsMap, row, 'bed');

    expect(compareArrays(resultOLD, resultNEW)).toBe(true);
    expect(resultNEW).toHaveLength(2);
    expect(resultNEW.map(b => b.id)).toContain(1);
    expect(resultNEW.map(b => b.id)).toContain(2);
  });

  it('Teste 1.2: Bookings Canceladas (devem ser filtradas)', () => {
    const bookings = [
      { id: 1, bed_id: 'bed1', room_id: 'room1', status: 'Confirmed', guest_name: 'João Silva' },
      { id: 2, bed_id: 'bed1', room_id: 'room1', status: 'Cancelled', guest_name: 'Maria Santos' },
      { id: 3, bed_id: 'bed1', room_id: 'room1', status: 'Checked-in', guest_name: 'Pedro Costa' }
    ];
    const row = { id: 'bed1', parentId: 'room1', type: 'bed' };

    const resultOLD = getResourceBookings_OLD(bookings, row, 'bed');
    const bookingsMap = buildBookingsMap(bookings);
    const resultNEW = getResourceBookings_NEW(bookingsMap, row, 'bed');

    expect(compareArrays(resultOLD, resultNEW)).toBe(true);
    expect(resultNEW).toHaveLength(2);
    expect(resultNEW.map(b => b.id)).not.toContain(2); // ID 2 é Cancelled
  });

  it('Teste 1.3: Bookings de Quarto Inteiro (sem bed_id)', () => {
    const bookings = [
      { id: 1, bed_id: null, room_id: 'suite-casal', status: 'Confirmed', guest_name: 'João Silva' },
      { id: 2, bed_id: null, room_id: 'suite-casal', status: 'Checked-in', guest_name: 'Maria Santos' },
      { id: 3, bed_id: null, room_id: 'private-room', status: 'Confirmed', guest_name: 'Pedro Costa' }
    ];
    const row = { id: 'suite-casal-booking', parentId: 'suite-casal', type: 'room_booking' };

    const resultOLD = getResourceBookings_OLD(bookings, row, 'room_booking');
    const bookingsMap = buildBookingsMap(bookings);
    const resultNEW = getResourceBookings_NEW(bookingsMap, row, 'room_booking');

    expect(compareArrays(resultOLD, resultNEW)).toBe(true);
    expect(resultNEW).toHaveLength(2);
    expect(resultNEW.map(b => b.id)).toContain(1);
    expect(resultNEW.map(b => b.id)).toContain(2);
    expect(resultNEW.map(b => b.id)).not.toContain(3); // Pertence a outro quarto
  });

  it('Teste 1.4: Room Header (type=room não deve retornar bookings)', () => {
    const bookings = [
      { id: 1, bed_id: 'bed1', room_id: 'room1', status: 'Confirmed', guest_name: 'João Silva' }
    ];
    const row = { id: 'room1', type: 'room' };

    const resultOLD = getResourceBookings_OLD(bookings, row, 'room');
    const bookingsMap = buildBookingsMap(bookings);
    const resultNEW = getResourceBookings_NEW(bookingsMap, row, 'room');

    expect(compareArrays(resultOLD, resultNEW)).toBe(true);
    expect(resultNEW).toHaveLength(0);
  });

  it('Teste 1.5: Sem Bookings para o Resource', () => {
    const bookings = [
      { id: 1, bed_id: 'bed1', room_id: 'room1', status: 'Confirmed', guest_name: 'João Silva' }
    ];
    const row = { id: 'bed2', parentId: 'room1', type: 'bed' };

    const resultOLD = getResourceBookings_OLD(bookings, row, 'bed');
    const bookingsMap = buildBookingsMap(bookings);
    const resultNEW = getResourceBookings_NEW(bookingsMap, row, 'bed');

    expect(compareArrays(resultOLD, resultNEW)).toBe(true);
    expect(resultNEW).toHaveLength(0);
  });

  it('Teste 1.6: Múltiplos Status Diferentes', () => {
    const bookings = [
      { id: 1, bed_id: 'bed1', status: 'Confirmed', guest_name: 'João' },
      { id: 2, bed_id: 'bed1', status: 'Pending', guest_name: 'Maria' },
      { id: 3, bed_id: 'bed1', status: 'Checked-in', guest_name: 'Pedro' },
      { id: 4, bed_id: 'bed1', status: 'Checked-out', guest_name: 'Ana' },
      { id: 5, bed_id: 'bed1', status: 'Cancelled', guest_name: 'Carlos' }
    ];
    const row = { id: 'bed1', type: 'bed' };

    const resultOLD = getResourceBookings_OLD(bookings, row, 'bed');
    const bookingsMap = buildBookingsMap(bookings);
    const resultNEW = getResourceBookings_NEW(bookingsMap, row, 'bed');

    expect(compareArrays(resultOLD, resultNEW)).toBe(true);
    expect(resultNEW).toHaveLength(4); // Todos exceto Cancelled
    expect(resultNEW.map(b => b.id)).not.toContain(5);
  });
});

describe('Calendar Performance Refactor - Bloco 2.2: Locks Map', () => {

  it('Teste 2.1: Locks de Cama', () => {
    const dateLocks = [
      { id: 1, bed_id: 'bed1', room_id: null, lock_type: 'Voluntariado', start_date: '2024-01-01', end_date: '2024-01-05' },
      { id: 2, bed_id: 'bed1', room_id: null, lock_type: 'Manutenção', start_date: '2024-01-10', end_date: '2024-01-15' },
      { id: 3, bed_id: 'bed2', room_id: null, lock_type: 'Voluntariado', start_date: '2024-01-01', end_date: '2024-01-05' }
    ];
    const row = { id: 'bed1', parentId: 'room1', type: 'bed' };

    const resultOLD = getResourceLocks_OLD(dateLocks, row, 'bed');
    const locksMap = buildLocksMap(dateLocks);
    const resultNEW = getResourceLocks_NEW(locksMap, row, 'bed');

    expect(compareArrays(resultOLD, resultNEW)).toBe(true);
    expect(resultNEW).toHaveLength(2);
    expect(resultNEW.map(l => l.id)).toContain(1);
    expect(resultNEW.map(l => l.id)).toContain(2);
  });

  it('Teste 2.2: Locks de Quarto Inteiro', () => {
    const dateLocks = [
      { id: 1, bed_id: null, room_id: 'suite-casal', lock_type: 'Manutenção', start_date: '2024-01-01', end_date: '2024-01-05' },
      { id: 2, bed_id: null, room_id: 'suite-casal', lock_type: 'Voluntariado', start_date: '2024-02-01', end_date: '2024-02-05' },
      { id: 3, bed_id: null, room_id: 'private-room', lock_type: 'Manutenção', start_date: '2024-01-01', end_date: '2024-01-05' }
    ];
    const row = { id: 'suite-casal-booking', parentId: 'suite-casal', type: 'room_booking' };

    const resultOLD = getResourceLocks_OLD(dateLocks, row, 'room_booking');
    const locksMap = buildLocksMap(dateLocks);
    const resultNEW = getResourceLocks_NEW(locksMap, row, 'room_booking');

    expect(compareArrays(resultOLD, resultNEW)).toBe(true);
    expect(resultNEW).toHaveLength(2);
    expect(resultNEW.map(l => l.id)).toContain(1);
    expect(resultNEW.map(l => l.id)).toContain(2);
  });

  it('Teste 2.3: Room Header Não Mostra Locks', () => {
    const dateLocks = [
      { id: 1, bed_id: 'bed1', room_id: null, lock_type: 'Voluntariado', start_date: '2024-01-01', end_date: '2024-01-05' }
    ];
    const row = { id: 'room1', type: 'room' };

    const resultOLD = getResourceLocks_OLD(dateLocks, row, 'room');
    const locksMap = buildLocksMap(dateLocks);
    const resultNEW = getResourceLocks_NEW(locksMap, row, 'room');

    expect(compareArrays(resultOLD, resultNEW)).toBe(true);
    expect(resultNEW).toHaveLength(0);
  });

  it('Teste 2.4: Sem Locks para o Resource', () => {
    const dateLocks = [
      { id: 1, bed_id: 'bed1', lock_type: 'Voluntariado', start_date: '2024-01-01', end_date: '2024-01-05' }
    ];
    const row = { id: 'bed2', type: 'bed' };

    const resultOLD = getResourceLocks_OLD(dateLocks, row, 'bed');
    const locksMap = buildLocksMap(dateLocks);
    const resultNEW = getResourceLocks_NEW(locksMap, row, 'bed');

    expect(compareArrays(resultOLD, resultNEW)).toBe(true);
    expect(resultNEW).toHaveLength(0);
  });
});

describe('Calendar Performance Refactor - Bloco 2.3: Daily Rates Map', () => {

  it('Teste 3.1: Rate Customizado Existe', () => {
    const dailyRates = [
      { room_id: 'room1', date: '2024-01-01', price: 150.00 },
      { room_id: 'room1', date: '2024-01-02', price: 200.00 },
      { room_id: 'room2', date: '2024-01-01', price: 180.00 }
    ];
    const roomId = 'room1';
    const dateStr = '2024-01-02';

    const resultOLD = getDailyRate_OLD(dailyRates, roomId, dateStr);
    const ratesMap = buildRatesMap(dailyRates);
    const resultNEW = getDailyRate_NEW(ratesMap, roomId, dateStr);

    expect(resultOLD).toBe(resultNEW);
    expect(resultNEW).toBe(200.00);
  });

  it('Teste 3.2: Rate Não Existe (retornar null)', () => {
    const dailyRates = [
      { room_id: 'room1', date: '2024-01-01', price: 150.00 },
      { room_id: 'room2', date: '2024-01-02', price: 200.00 }
    ];
    const roomId = 'room1';
    const dateStr = '2024-01-05';

    const resultOLD = getDailyRate_OLD(dailyRates, roomId, dateStr);
    const ratesMap = buildRatesMap(dailyRates);
    const resultNEW = getDailyRate_NEW(ratesMap, roomId, dateStr);

    expect(resultOLD).toBe(resultNEW);
    expect(resultNEW).toBe(null);
  });

  it('Teste 3.3: Múltiplos Rates para Mesmo Quarto', () => {
    const dailyRates = [
      { room_id: 'room1', date: '2024-01-01', price: 100.00 },
      { room_id: 'room1', date: '2024-01-02', price: 150.00 },
      { room_id: 'room1', date: '2024-01-03', price: 200.00 },
      { room_id: 'room1', date: '2024-01-04', price: 175.00 }
    ];
    const roomId = 'room1';

    const ratesMap = buildRatesMap(dailyRates);

    const testDates = [
      { date: '2024-01-01', expected: 100.00 },
      { date: '2024-01-02', expected: 150.00 },
      { date: '2024-01-03', expected: 200.00 },
      { date: '2024-01-04', expected: 175.00 },
      { date: '2024-01-05', expected: null }
    ];

    testDates.forEach(({ date, expected }) => {
      const resultOLD = getDailyRate_OLD(dailyRates, roomId, date);
      const resultNEW = getDailyRate_NEW(ratesMap, roomId, date);

      expect(resultOLD).toBe(resultNEW);
      expect(resultNEW).toBe(expected);
    });
  });

  it('Teste 3.4: Rates em Diferentes Quartos na Mesma Data', () => {
    const dailyRates = [
      { room_id: 'room1', date: '2024-01-01', price: 100.00 },
      { room_id: 'room2', date: '2024-01-01', price: 200.00 },
      { room_id: 'room3', date: '2024-01-01', price: 300.00 }
    ];
    const date = '2024-01-01';

    const ratesMap = buildRatesMap(dailyRates);

    const testRooms = [
      { roomId: 'room1', expected: 100.00 },
      { roomId: 'room2', expected: 200.00 },
      { roomId: 'room3', expected: 300.00 },
      { roomId: 'room4', expected: null }
    ];

    testRooms.forEach(({ roomId, expected }) => {
      const resultOLD = getDailyRate_OLD(dailyRates, roomId, date);
      const resultNEW = getDailyRate_NEW(ratesMap, roomId, date);

      expect(resultOLD).toBe(resultNEW);
      expect(resultNEW).toBe(expected);
    });
  });
});

describe('Calendar Performance Refactor - Edge Cases', () => {

  it('Teste 4.1: Bookings que Cruzam Meses', () => {
    const bookings = [
      {
        id: 1,
        bed_id: 'bed1',
        status: 'Confirmed',
        check_in: '2024-01-28',
        check_out: '2024-02-05',
        guest_name: 'João Silva'
      }
    ];
    const row = { id: 'bed1', type: 'bed' };

    const resultOLD = getResourceBookings_OLD(bookings, row, 'bed');
    const bookingsMap = buildBookingsMap(bookings);
    const resultNEW = getResourceBookings_NEW(bookingsMap, row, 'bed');

    expect(compareArrays(resultOLD, resultNEW)).toBe(true);
    expect(resultNEW).toHaveLength(1);
  });

  it('Teste 4.2: Múltiplas Bookings Consecutivas', () => {
    const bookings = [
      { id: 1, bed_id: 'bed1', status: 'Checked-out', check_in: '2024-01-01', check_out: '2024-01-05' },
      { id: 2, bed_id: 'bed1', status: 'Checked-in', check_in: '2024-01-05', check_out: '2024-01-10' },
      { id: 3, bed_id: 'bed1', status: 'Confirmed', check_in: '2024-01-10', check_out: '2024-01-15' }
    ];
    const row = { id: 'bed1', type: 'bed' };

    const resultOLD = getResourceBookings_OLD(bookings, row, 'bed');
    const bookingsMap = buildBookingsMap(bookings);
    const resultNEW = getResourceBookings_NEW(bookingsMap, row, 'bed');

    expect(compareArrays(resultOLD, resultNEW)).toBe(true);
    expect(resultNEW).toHaveLength(3);
  });

  it('Teste 4.3: Booking com Saldo Devedor', () => {
    const bookings = [
      {
        id: 1,
        bed_id: 'bed1',
        status: 'Confirmed',
        total_amount: 500.00,
        paid_amount: 100.00,
        guest_name: 'Maria Santos'
      }
    ];
    const row = { id: 'bed1', type: 'bed' };

    const resultOLD = getResourceBookings_OLD(bookings, row, 'bed');
    const bookingsMap = buildBookingsMap(bookings);
    const resultNEW = getResourceBookings_NEW(bookingsMap, row, 'bed');

    expect(compareArrays(resultOLD, resultNEW)).toBe(true);
    expect(resultNEW).toHaveLength(1);
    expect(resultNEW[0].total_amount).toBe(500.00);
    expect(resultNEW[0].paid_amount).toBe(100.00);
  });

  it('Teste 4.4: Arrays Vazios', () => {
    const bookings = [];
    const dateLocks = [];
    const dailyRates = [];

    const row = { id: 'bed1', type: 'bed' };

    // Bookings
    const resultBookingsOLD = getResourceBookings_OLD(bookings, row, 'bed');
    const bookingsMap = buildBookingsMap(bookings);
    const resultBookingsNEW = getResourceBookings_NEW(bookingsMap, row, 'bed');
    expect(compareArrays(resultBookingsOLD, resultBookingsNEW)).toBe(true);
    expect(resultBookingsNEW).toHaveLength(0);

    // Locks
    const resultLocksOLD = getResourceLocks_OLD(dateLocks, row, 'bed');
    const locksMap = buildLocksMap(dateLocks);
    const resultLocksNEW = getResourceLocks_NEW(locksMap, row, 'bed');
    expect(compareArrays(resultLocksOLD, resultLocksNEW)).toBe(true);
    expect(resultLocksNEW).toHaveLength(0);

    // Rates
    const resultRateOLD = getDailyRate_OLD(dailyRates, 'room1', '2024-01-01');
    const ratesMap = buildRatesMap(dailyRates);
    const resultRateNEW = getDailyRate_NEW(ratesMap, 'room1', '2024-01-01');
    expect(resultRateOLD).toBe(resultRateNEW);
    expect(resultRateNEW).toBe(null);
  });

  it('Teste 4.5: IDs Duplicados', () => {
    const bookings = [
      { id: 1, bed_id: 'bed1', status: 'Confirmed', guest_name: 'João' },
      { id: 1, bed_id: 'bed1', status: 'Confirmed', guest_name: 'João Clone' }
    ];
    const row = { id: 'bed1', type: 'bed' };

    const resultOLD = getResourceBookings_OLD(bookings, row, 'bed');
    const bookingsMap = buildBookingsMap(bookings);
    const resultNEW = getResourceBookings_NEW(bookingsMap, row, 'bed');

    expect(compareArrays(resultOLD, resultNEW)).toBe(true);
    expect(resultNEW).toHaveLength(2);
  });

  it('Teste 4.6: Mix de Bookings e Locks no Mesmo Resource', () => {
    const bookings = [
      { id: 1, bed_id: 'bed1', status: 'Confirmed', check_in: '2024-01-01', check_out: '2024-01-05' }
    ];
    const dateLocks = [
      { id: 1, bed_id: 'bed1', lock_type: 'Manutenção', start_date: '2024-01-10', end_date: '2024-01-15' }
    ];
    const row = { id: 'bed1', type: 'bed' };

    // Bookings
    const resultBookingsOLD = getResourceBookings_OLD(bookings, row, 'bed');
    const bookingsMap = buildBookingsMap(bookings);
    const resultBookingsNEW = getResourceBookings_NEW(bookingsMap, row, 'bed');
    expect(compareArrays(resultBookingsOLD, resultBookingsNEW)).toBe(true);
    expect(resultBookingsNEW).toHaveLength(1);

    // Locks
    const resultLocksOLD = getResourceLocks_OLD(dateLocks, row, 'bed');
    const locksMap = buildLocksMap(dateLocks);
    const resultLocksNEW = getResourceLocks_NEW(locksMap, row, 'bed');
    expect(compareArrays(resultLocksOLD, resultLocksNEW)).toBe(true);
    expect(resultLocksNEW).toHaveLength(1);
  });
});

describe('Calendar Performance Refactor - Performance Benchmarks', () => {

  /**
   * Gera dataset grande para testes de performance
   */
  function generateLargeDataset(numBookings = 1000, numBeds = 100) {
    const bookings = [];
    const statuses = ['Confirmed', 'Checked-in', 'Checked-out', 'Pending', 'Cancelled'];

    for (let i = 0; i < numBookings; i++) {
      bookings.push({
        id: i,
        bed_id: `bed${i % numBeds}`,
        room_id: `room${Math.floor((i % numBeds) / 10)}`,
        status: statuses[i % statuses.length],
        guest_name: `Guest ${i}`,
        check_in: '2024-01-01',
        check_out: '2024-01-10'
      });
    }

    return bookings;
  }

  it('Benchmark: 1000 bookings, 100 beds - OLD vs NEW', () => {
    const bookings = generateLargeDataset(1000, 100);
    const row = { id: 'bed50', type: 'bed' };

    // Warm up
    getResourceBookings_OLD(bookings, row, 'bed');
    const bookingsMap = buildBookingsMap(bookings);
    getResourceBookings_NEW(bookingsMap, row, 'bed');

    // Benchmark OLD
    const startOLD = performance.now();
    for (let i = 0; i < 1000; i++) {
      getResourceBookings_OLD(bookings, row, 'bed');
    }
    const endOLD = performance.now();
    const timeOLD = endOLD - startOLD;

    // Benchmark NEW (sem incluir build do Map, pois será feito uma vez)
    const startNEW = performance.now();
    for (let i = 0; i < 1000; i++) {
      getResourceBookings_NEW(bookingsMap, row, 'bed');
    }
    const endNEW = performance.now();
    const timeNEW = endNEW - startNEW;

    const improvement = ((timeOLD - timeNEW) / timeOLD) * 100;

    console.log(`\n📊 Performance Benchmark (1000 iterations):`);
    console.log(`   OLD implementation: ${timeOLD.toFixed(2)}ms`);
    console.log(`   NEW implementation: ${timeNEW.toFixed(2)}ms`);
    console.log(`   Improvement: ${improvement.toFixed(2)}%\n`);

    // Esperamos pelo menos 30% de melhoria
    expect(timeNEW).toBeLessThan(timeOLD);
  });

  it('Benchmark: Build Maps - Custo de pré-computação', () => {
    const bookings = generateLargeDataset(1000, 100);
    const dateLocks = bookings.map(b => ({
      id: b.id,
      bed_id: b.bed_id,
      room_id: null,
      lock_type: 'Voluntariado',
      start_date: '2024-01-01',
      end_date: '2024-01-05'
    }));
    const dailyRates = [];
    for (let i = 0; i < 100; i++) {
      for (let day = 1; day <= 30; day++) {
        dailyRates.push({
          room_id: `room${i}`,
          date: `2024-01-${String(day).padStart(2, '0')}`,
          price: 100 + i
        });
      }
    }

    const startBuild = performance.now();
    const bookingsMap = buildBookingsMap(bookings);
    const locksMap = buildLocksMap(dateLocks);
    const ratesMap = buildRatesMap(dailyRates);
    const endBuild = performance.now();

    console.log(`\n📊 Map Building Performance:`);
    console.log(`   Time to build all maps: ${(endBuild - startBuild).toFixed(2)}ms`);
    console.log(`   Bookings Map size: ${bookingsMap.size} keys`);
    console.log(`   Locks Map size: ${locksMap.size} keys`);
    console.log(`   Rates Map size: ${ratesMap.size} keys\n`);

    // Build deve ser rápido (< 100ms para 1000+ registros)
    expect(endBuild - startBuild).toBeLessThan(100);
  });
});
