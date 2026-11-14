import { VehicleResponse } from '../../models/vehicle/vehicle.model';
import {
  PLATE_INVALID_MESSAGE,
  formatPlate,
  isValidPlate,
  normalizePlate,
  parseReturnTo,
  vehicleDetail,
  vehicleName,
} from './vehicle-format';

const vehicle = (overrides: Partial<VehicleResponse>): VehicleResponse => ({
  vehicleId: 'v-1',
  driverId: 'd-1',
  plateNumber: 'KA05MJ4471',
  vehicleType: 'FourWheeler',
  make: 'Honda',
  model: 'City',
  isElectric: false,
  isActive: true,
  createdAt: '',
  updatedAt: '',
  ...overrides,
});

describe('vehicle-format', () => {
  describe('formatPlate', () => {
    it.each([
      ['KA05MJ4471', 'KA 05 MJ 4471'],
      ['KA01A1234', 'KA 01 A 1234'],
      ['KA01ABC1234', 'KA 01 ABC 1234'],
      ['DL1CAB1234', 'DL 1 CAB 1234'],
      ['KA051234', 'KA 05 1234'],
      ['22BH1234AB', '22 BH 1234 AB'],
      ['22BH1234A', '22 BH 1234 A'],
    ])('groups the standard plate %s', (plate, expected) => {
      expect(formatPlate(plate)).toBe(expected);
    });

    it.each(['KA01ABCD1234', 'K05MJ4471', 'KA05MJ447', 'ka05mj4471', 'TEMP-1234', 'KA 05 MJ 4471'])(
      'shows the non-standard plate %s exactly as stored',
      (plate) => {
        expect(formatPlate(plate)).toBe(plate);
      },
    );
  });

  it('normalizes a plate by removing spaces and dashes and uppercasing', () => {
    expect(normalizePlate(' ka 05-mj 4471 ')).toBe('KA05MJ4471');
  });

  describe('isValidPlate (same rules as the backend)', () => {
    it.each([
      'KA05MJ4471',
      'ka 05-mj 4471',
      'KA05PE3601',
      'MH12AB1234',
      'DL1CAB1234',
      'KA051234',
      '22BH1234AB',
      '22 bh 1234 a',
    ])('accepts %s', (plate) => {
      expect(isValidPlate(plate)).toBe(true);
    });

    it.each(['', '   ', 'AB12', 'KA05MJ44', '1234567890', 'KA05MJ4471X', 'K505MJ4471', '22BH1234ABC'])(
      'rejects "%s"',
      (plate) => {
        expect(isValidPlate(plate)).toBe(false);
      },
    );

    it('rejects a raw value longer than 20 characters even if it is valid once cleaned', () => {
      expect(isValidPlate('K A 0 5 M J 4 4 7 1       ')).toBe(false);
    });

    it('uses the backend message text', () => {
      expect(PLATE_INVALID_MESSAGE).toBe('Enter a valid vehicle number, for example KA05AB1234.');
    });

    it('still groups valid standard plates for display', () => {
      expect(formatPlate('KA05MJ4471')).toBe('KA 05 MJ 4471');
    });
  });

  it('builds the name and second line, adding Electric only when electric', () => {
    expect(vehicleName(vehicle({}))).toBe('Honda City');
    expect(vehicleDetail(vehicle({}))).toBe('Four Wheeler');
    expect(vehicleDetail(vehicle({ vehicleType: 'TwoWheeler', isElectric: true }))).toBe(
      'Two Wheeler · Electric',
    );
    expect(vehicleDetail(vehicle({ vehicleType: 'Heavy' }))).toBe('Heavy');
  });

  describe('parseReturnTo', () => {
    it('accepts /lots/<id>', () => {
      expect(parseReturnTo({ returnTo: '/lots/abc-123' })).toBe('/lots/abc-123');
    });

    it.each([
      null,
      {},
      { returnTo: 42 },
      { returnTo: 'https://evil.example/lots/1' },
      { returnTo: '//evil.example/lots/1' },
      { returnTo: '/lots/' },
      { returnTo: '/lots/1/extra' },
      { returnTo: '/lots/1?x=1' },
      { returnTo: '/login' },
    ])('rejects %j', (state) => {
      expect(parseReturnTo(state)).toBeNull();
    });
  });
});
