import { VehicleType } from '../../models/spot.model';
import { VehicleResponse } from '../../models/vehicle/vehicle.model';

const VEHICLE_TYPE_LABEL: Record<VehicleType, string> = {
  TwoWheeler: 'Two Wheeler',
  FourWheeler: 'Four Wheeler',
  Heavy: 'Heavy',
};

/** 2 letters, 2 digits, 1-3 letters, 4 digits, e.g. KA05MJ4471. */
const STANDARD_PLATE = /^([A-Z]{2})(\d{2})([A-Z]{1,3})(\d{4})$/;

const RETURN_TO_PATTERN = /^\/lots\/[A-Za-z0-9-]+$/;

/** Standard plates are shown grouped (KA 05 MJ 4471); anything else is shown exactly as stored. */
export function formatPlate(plate: string): string {
  const match = STANDARD_PLATE.exec(plate);
  return match ? match.slice(1).join(' ') : plate;
}

/** The backend only trims and uppercases, so spaces and dashes are removed here. */
export function normalizePlate(plate: string): string {
  return plate.replace(/[\s-]/g, '').toUpperCase();
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
