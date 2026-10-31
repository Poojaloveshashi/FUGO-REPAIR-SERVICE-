export type Role = 'customer' | 'technician' | 'admin';
export type ServiceType = 'online' | 'offline';
export type PartPreference = 'brand' | 'third-party';
export type Status = 'pending' | 'transporting' | 'warehouse' | 'repairing' | 'ready' | 'completed';

export interface RepairRequest {
  id: string;
  userId: string;
  customerName?: string;
  customerPhone?: string;
  vehicleName: string;
  rcNumber: string;
  vehiclePlate: string;
  make?: string;
  model?: string;
  year?: string;
  fuelType?: string;
  engineCapacity?: string;
  registrationDate?: string;
  description: string;
  status: Status;
  serviceType: ServiceType;
  partPreference: PartPreference;
  price?: number;
  servicePrice?: number;
  repairPrice?: number;
  oemPrice?: number;
  thirdPartyPrice?: number;
  parts?: { name: string; price?: number; sourcing: PartPreference }[];
  repairComplexity?: 'light' | 'heavy';
  photoUrl?: string;
  repairStartTime?: any;
  estimatedTiming?: string;
  rating?: number;
  createdAt: any;
  updatedAt: any;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: Role;
  phoneNumber?: string;
}
