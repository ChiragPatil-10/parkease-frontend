import { VehicleType } from '../../models/spot.model';
import { VehicleResponse } from '../../models/vehicle/vehicle.model';

const VEHICLE_TYPE_LABEL: Record<VehicleType, string> = {
  TwoWheeler: 'Two Wheeler',
  FourWheeler: 'Four Wheeler',
  Heavy: 'Heavy',
};

/** The backend's standard format: 2 letters, 1-2 digits, 0-3 letters, 4 digits (KA05MJ4471, DL1CAB1234). */
const STANDARD_PLATE = /^([A-Z]{2})(\d{1,2})([A-Z]{0,3})(\d{4})$/;

/** The backend's BH series: 22BH1234AB. */
const BH_PLATE = /^(\d{2})(BH)(\d{4})([A-Z]{1,2})$/;

const RETURN_TO_PATTERN = /^\/lots\/[A-Za-z0-9-]+$/;

/**
 * Standard and BH plates are shown grouped (KA 05 MJ 4471, DL 1 CAB 1234, 22 BH 1234 AB);
 * anything else is shown exactly as stored.
 */
export function formatPlate(plate: string): string {
  const match = STANDARD_PLATE.exec(plate) ?? BH_PLATE.exec(plate);
  return match ? match.slice(1).filter((group) => group !== '').join(' ') : plate;
}

/** Same text as the backend's PlateNumberFormat.InvalidMessage; it is used for every bad plate. */
export const PLATE_INVALID_MESSAGE = 'Enter a valid vehicle number, for example KA05AB1234.';

/** The backend rejects a raw plate longer than this (before spaces and dashes are removed). */
export const PLATE_MAX_LENGTH = 20;

/** Same patterns as the backend: standard (KA05PE3601, DL1CAB1234) and BH series (22BH1234AB). */
const BACKEND_STANDARD_PLATE = /^[A-Z]{2}[0-9]{1,2}[A-Z]{0,3}[0-9]{4}$/;
const BACKEND_BH_PLATE = /^[0-9]{2}BH[0-9]{4}[A-Z]{1,2}$/;

/** Spaces and dashes are ignored and letters uppercased, matching the backend's normalisation. */
export function normalizePlate(plate: string): string {
  return plate.replace(/[\s-]/g, '').toUpperCase();
}

/** True when the plate, once normalised, matches the standard or BH pattern the backend accepts. */
export function isValidPlate(raw: string): boolean {
  if (raw.length > PLATE_MAX_LENGTH) {
    return false;
  }
  const plate = normalizePlate(raw);
  return BACKEND_STANDARD_PLATE.test(plate) || BACKEND_BH_PLATE.test(plate);
}

export function vehicleName(vehicle: VehicleResponse): string {
  return `${vehicle.make} ${vehicle.model}`;
}

export function vehicleDetail(vehicle: VehicleResponse): string {
  const label = VEHICLE_TYPE_LABEL[vehicle.vehicleType] ?? vehicle.vehicleType;
  return vehicle.isElectric ? `${label} · Electric` : label;
}

/** Accepts `returnTo` from router state only if it is /lots/<id> with an id of letters, digits, dashes. */
export function parseReturnTo(state: unknown): string | null {
  const value = (state as { returnTo?: unknown } | null)?.returnTo;
  return typeof value === 'string' && RETURN_TO_PATTERN.test(value) ? value : null;
}
