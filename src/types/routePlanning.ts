import type { Tables } from "@/integrations/supabase/types";

// Database row types
export type DailyRoutePlan = Tables<"daily_route_plans">;
export type TeamAvailability = Tables<"team_availability">;
export type TimeOffRequest = Tables<"time_off_requests">;
export type GeocodeCache = Tables<"geocode_cache">;

// Extended job type with route planning fields
export type JobWithRouteInfo = Tables<"jobs"> & {
  latitude?: number | null;
  longitude?: number | null;
  estimated_duration_minutes?: number | null;
  route_plan_id?: string | null;
  route_sequence?: number | null;
  estimated_arrival?: string | null;
  actual_arrival?: string | null;
  drive_time_from_previous?: number | null;
  auto_assigned?: boolean | null;
  assignment_reasoning?: string | null;
};

// Location types
export interface GeoLocation {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

export interface AddressWithCoordinates {
  address: string;
  latitude: number;
  longitude: number;
  formattedAddress?: string;
  placeId?: string;
}

// Route plan types
export interface RouteLeg {
  jobId: string;
  startLocation: GeoLocation;
  endLocation: GeoLocation;
  distanceMeters: number;
  durationSeconds: number;
  polyline?: string;
}

export interface RouteOptimizationResult {
  jobIds: string[];
  optimizedSequence: number[];
  totalDistanceMeters: number;
  totalDurationSeconds: number;
  legs: RouteLeg[];
  overviewPolyline?: string;
  reasoning?: string;
}

// Availability types
export interface WeeklySchedule {
  userId: string;
  schedule: {
    dayOfWeek: number;
    dayName: string;
    startTime: string;
    endTime: string;
    isAvailable: boolean;
  }[];
}

export const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

// Time off status
export type TimeOffStatus = "pending" | "approved" | "rejected";

// Worker capacity for auto-assignment
export interface WorkerCapacity {
  userId: string;
  firstName: string;
  lastName: string;
  availableMinutes: number;
  currentJobCount: number;
  maxDailyJobs: number;
  maxDailyHours: number;
  homeLocation?: GeoLocation;
  skillTags?: string[];
  isAvailableToday: boolean;
  hasTimeOff: boolean;
}

// Auto-assignment input/output
export interface AutoAssignmentInput {
  date: Date;
  unassignedJobIds: string[];
  considerTravel: boolean;
  balanceWorkload: boolean;
}

export interface AutoAssignmentResult {
  assignments: {
    jobId: string;
    userId: string;
    reasoning: string;
    estimatedArrival?: string;
    driveTimeFromPrevious?: number;
  }[];
  unassignedJobs: {
    jobId: string;
    reason: string;
  }[];
  summary: string;
}
