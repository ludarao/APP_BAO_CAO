import type { Values, Optional, Kind } from "./forms";
export interface Unit {
  id: string;
  code: string;
  name: string;
  group: string;
  parentCode: string | null;
  scope: string;
  active: boolean;
  users?: {
    id: string;
    username: string;
    active: boolean;
    mustChangePassword: boolean;
  }[];
}
export interface Period {
  id: string;
  title: string;
  kind: Kind;
  startAt: string;
  endAt: string;
  opensAt: string;
  dueAt: string;
  closesAt: string;
  formVersion: number;
  _count?: { assignments: number };
}
export interface Report {
  id: string;
  version: number;
  status: string;
  values: Values;
  optional: Optional;
  notes: { highlights: string; difficulties: string; progress: string };
  completed: number;
  required: number;
  reporterName: string;
  reporterPhone: string;
  firstCompleteAt: string | null;
  firstReceivedAt: string;
  updatedAt: string;
}
export interface Assignment {
  id: string;
  unitId: string;
  periodId: string;
  dueAt: string | null;
  closesAt: string | null;
  period: Period;
  unit: Unit;
  report: Report | null;
}
export interface Bootstrap {
  me: {
    id: string;
    username: string;
    role: string;
    mustChangePassword: boolean;
    unit: Unit | null;
  };
  periods?: Period[];
  units?: Unit[];
  assignments: Assignment[];
  contacts?: { name: string; phone: string }[];
  selectedId?: string;
  refreshedAt?: string;
}
