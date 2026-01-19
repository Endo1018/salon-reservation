export type ResourceId =
  | 'head-spa-1' | 'head-spa-2' | 'head-spa-3' | 'head-spa-4'
  | 'spa-1' | 'spa-2' | 'spa-3' | 'spa-4' // Mapping for Spa 1-4 mentioned in requirements? Wait, requirements say "Head Spa (4台)", "Spa 1"..."Spa 4" - actually "Head Spa (4台)" usually is the category.
  // Requirement 3: 
  // Head Spa (4台) -> Wait. "Head Spa (4台)" is the GROUP.
  // Items: Spa 1, Spa 2, Spa 3, Spa 4 ?
  // Or "Head Spa" is a type? 
  // "Head Spa (4台)" -> implied 4 distinct resources.
  // Requirement says: "Head Spa (4台)", followed by "Spa 1", "Spa 2", "Spa 3", "Spa 4". 
  // Ah, the indent suggests:
  // Head Spa (4台)
  //   Spa 1
  //   Spa 2
  //   Spa 3
  //   Spa 4
  // Aroma Room (2部屋)
  //   Aroma Room A
  //   Aroma Room B
  // Massage Seat (5席)
  //   Massage Seat 1
  //   ...
  //   Massage Seat 5

  // So distinct IDs are:
  | 'Head Spa 1' | 'Head Spa 2' | 'Head Spa 3' | 'Head Spa 4' // Wait, the list said "Spa 1..4". I'll use IDs that are consistent.
  | 'Aroma Room A-1' | 'Aroma Room A-2' | 'Aroma Room B-1' | 'Aroma Room B-2'
  | 'Massage Seat 1' | 'Massage Seat 2' | 'Massage Seat 3' | 'Massage Seat 4' | 'Massage Seat 5';

export type ResourceCategory = 'Head Spa' | 'Aroma Room' | 'Massage Seat';

export interface Resource {
  id: ResourceId;
  name: string;
  category: ResourceCategory;
}

export type MenuType = 'Single' | 'Combo';

export interface Menu {
  id: string; // generated or name
  name: string;
  duration: number; // total minutes
  price: number;
  type: MenuType;
  massageTime?: number; // for Combo or explicit split
  headSpaTime?: number; // for Combo or explicit split
  category: string; // from CSV 'カテゴリ'
  allowedStaff: string[]; // List of staff names who can perform this
}

export interface Staff {
  id: string;
  name: string;
  // skills? derived from menu allowedStaff logic inverse
}

export type ReservationStatus = 'Hold' | 'Confirmed' | 'Active' | 'Completed' | 'Cancelled';

export interface Reservation {
  id: string;
  menuId: string;
  menuName: string;
  staffId: string; // Staff name
  startAt: string; // ISO DateTime
  endAt: string; // ISO DateTime
  resourceId: ResourceId;
  status: ReservationStatus;
  comboLinkId?: string; // To link two parts of a combo
  isComboMain?: boolean; // If this is the primary record (optional, maybe not needed if filtered carefully)
  clientName?: string;
}

export const RESOURCES: Resource[] = [
  { id: 'Head Spa 1', name: 'Spa 1', category: 'Head Spa' },
  { id: 'Head Spa 2', name: 'Spa 2', category: 'Head Spa' },
  { id: 'Head Spa 3', name: 'Spa 3', category: 'Head Spa' },
  { id: 'Head Spa 4', name: 'Spa 4', category: 'Head Spa' },
  { id: 'Aroma Room A-1', name: 'Aroma Room A-1', category: 'Aroma Room' },
  { id: 'Aroma Room A-2', name: 'Aroma Room A-2', category: 'Aroma Room' },
  { id: 'Aroma Room B-1', name: 'Aroma Room B-1', category: 'Aroma Room' },
  { id: 'Aroma Room B-2', name: 'Aroma Room B-2', category: 'Aroma Room' },
  { id: 'Massage Seat 1', name: 'Massage Seat 1', category: 'Massage Seat' },
  { id: 'Massage Seat 2', name: 'Massage Seat 2', category: 'Massage Seat' },
  { id: 'Massage Seat 3', name: 'Massage Seat 3', category: 'Massage Seat' },
  { id: 'Massage Seat 4', name: 'Massage Seat 4', category: 'Massage Seat' },
  { id: 'Massage Seat 5', name: 'Massage Seat 5', category: 'Massage Seat' },
];
