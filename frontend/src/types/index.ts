/**
 * DTOs returned by the API.
 *
 * These mirror the response shapes built in backend/src/modules/**. Keeping
 * them in one file makes a drift between client and server obvious the moment
 * a page stops type-checking.
 */

export type UserRole = 'GUEST' | 'ADMIN';

export type BookingStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'CHECKED_IN'
  | 'CHECKED_OUT'
  | 'CANCELLED';

export type RoomStatus = 'AVAILABLE' | 'MAINTENANCE' | 'OUT_OF_SERVICE';

export type PaymentMethod = 'CARD' | 'PAYPAL' | 'BANK_TRANSFER';

export interface User {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  role: UserRole;
  createdAt: string;
}

export interface AuthResponse {
  user: User;
  token: string;
  expiresIn: string;
}

export interface Paginated<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface HotelSummary {
  id: string;
  name: string;
  slug: string;
  description: string;
  city: string;
  country: string;
  addressLine: string;
  starRating: number;
  amenities: string[];
  imageUrl: string | null;
  fromPricePerNight: number | null;
  maxOccupancy: number;
  averageRating: number | null;
  reviewCount: number;
}

export interface RoomTypeSummary {
  id: string;
  name: string;
  description: string;
  basePricePerNight: number;
  maxOccupancy: number;
  bedConfiguration: string;
  sizeSqm: number;
  amenities: string[];
  imageUrl: string | null;
  roomCount: number;
}

export interface HotelDetail extends HotelSummary {
  checkInTime: string;
  checkOutTime: string;
  roomTypes: RoomTypeSummary[];
}

export interface CityOption {
  city: string;
  country: string;
  hotels: number;
}

export interface NightlyRate {
  date: string;
  multiplier: number;
  amount: number;
  ratePlanName: string | null;
}

export interface Quote {
  nights: NightlyRate[];
  nightCount: number;
  averageNightlyRate: number;
  subtotal: number;
  taxPercent: number;
  tax: number;
  total: number;
}

export interface RoomTypeAvailability {
  hotel: {
    id: string;
    name: string;
    slug: string;
    city: string;
    country: string;
    starRating: number;
    imageUrl: string | null;
  };
  roomType: {
    id: string;
    name: string;
    description: string;
    basePricePerNight: number;
    maxOccupancy: number;
    bedConfiguration: string;
    sizeSqm: number;
    amenities: string[];
    imageUrl: string | null;
  };
  roomId: string;
  availableRoomCount: number;
  quote: Quote;
}

export interface RoomSearchResponse {
  checkIn: string;
  checkOut: string;
  nights: number;
  guests: number;
  results: RoomTypeAvailability[];
}

export interface RoomDetail {
  id: string;
  roomNumber: string;
  floor: number;
  status: RoomStatus | string;
  hotel: {
    id: string;
    name: string;
    slug: string;
    city: string;
    country: string;
    addressLine: string;
    starRating: number;
    checkInTime: string;
    checkOutTime: string;
    imageUrl: string | null;
  };
  roomType: {
    id: string;
    name: string;
    description: string;
    basePricePerNight: number;
    maxOccupancy: number;
    bedConfiguration: string;
    sizeSqm: number;
    amenities: string[];
    imageUrl: string | null;
  };
  quote: Quote | null;
  isAvailable: boolean | null;
}

export interface Booking {
  id: string;
  reference: string;
  status: BookingStatus | string;
  checkIn: string;
  checkOut: string;
  nights: number;
  guests: number;
  totalAmount: number;
  taxAmount: number;
  cancellationFee: number;
  specialRequests: string | null;
  createdAt: string;
  cancelledAt: string | null;
  hotel: {
    id: string;
    name: string;
    slug: string;
    city: string;
    country: string;
    addressLine: string;
    checkInTime: string;
    checkOutTime: string;
    imageUrl: string | null;
  };
  roomType: {
    id: string;
    name: string;
    bedConfiguration: string;
    maxOccupancy: number;
    imageUrl: string | null;
  };
  room: { id: string; roomNumber: string; floor: number };
  payment: {
    id: string;
    amount: number;
    method: string;
    status: string;
    transactionRef: string;
    paidAt: string | null;
  } | null;
  guest: { id: string; fullName: string; email: string } | null;
  canCancel: boolean;
  cancellation: {
    isFree: boolean;
    feeAmount: number;
    refundAmount: number;
    freeUntilHoursBeforeCheckIn: number;
  } | null;
}

export interface CreateBookingResponse {
  booking: Booking;
  quote: Quote;
}

export interface CancellationResponse {
  booking: Booking;
  outcome: {
    isFree: boolean;
    reason: 'FREE_WINDOW' | 'LATE_CANCELLATION' | 'STAY_STARTED';
    feeAmount: number;
    refundAmount: number;
    hoursUntilCheckIn: number;
  };
}

export interface PaymentResponse {
  payment: {
    id: string;
    status: string;
    method: PaymentMethod;
    amount: number;
    transactionRef: string;
    paidAt: string | null;
  };
  booking: Booking;
}

export interface Review {
  id: string;
  rating: number;
  title: string;
  comment: string;
  createdAt: string;
  author: { id: string; fullName: string };
  stay: { reference: string; checkIn: string; checkOut: string; roomTypeName: string };
}

export interface ReviewSummary {
  average: number | null;
  count: number;
  distribution: Record<'1' | '2' | '3' | '4' | '5', number>;
}

export interface HotelReviewsResponse extends Paginated<Review> {
  summary: ReviewSummary;
}

export interface DashboardStats {
  generatedAt: string;
  totals: {
    hotels: number;
    rooms: number;
    roomTypes: number;
    guests: number;
    bookings: number;
  };
  bookingsByStatus: Record<string, number>;
  revenue: {
    confirmedTotal: number;
    collectedTotal: number;
    averageBookingValue: number;
    last6Months: Array<{ month: string; bookings: number; revenue: number }>;
  };
  occupancy: {
    date: string;
    occupiedRooms: number;
    bookableRooms: number;
    rate: number;
  };
  arrivalsToday: number;
  departuresToday: number;
  recentBookings: Booking[];
}

export interface AdminRoom {
  id: string;
  roomNumber: string;
  floor: number;
  status: RoomStatus | string;
  hotel: { id: string; name: string; slug: string };
  roomType: { id: string; name: string; basePricePerNight: number };
  totalBookings: number;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}
