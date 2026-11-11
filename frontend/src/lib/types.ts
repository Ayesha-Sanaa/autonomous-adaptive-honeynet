export type Counted = { value: string; count: number };

export type DayPoint = { day: string; count: number };
export type DayDecoyPoint = { day: string; decoy: string; count: number };

export type Stats = {
  total: number;
  by_decoy: Counted[];
  by_event_type: Counted[];
  top_src_ip: Counted[];
  top_usernames: Counted[];
  top_passwords: Counted[];
  top_commands: Counted[];
  by_day: DayPoint[];
  by_day_decoy?: DayDecoyPoint[];
};

export type EventRow = {
  _id: string;
  id: string;
  decoy: string;
  protocol: string;
  event_type: string;
  src_ip?: string;
  timestamp: string;
  username?: string;
  password?: string;
  command?: string;
  success?: boolean;
  session?: string;
  attack: { id: string; name: string; tactics: string[] }[];
};

export type Attacker = {
  src_ip: string;
  events: number;
  first_seen: string;
  last_seen: string;
  decoys: string[];
  behaviours: { id: string; name: string; tactics: string[] }[];
  techniques: { id: string; name: string; tactics: string[]; events: number }[];
};

export type Session = {
  session: string;
  decoy: string;
  src_ip: string;
  start: string;
  end: string;
  login_success: boolean;
  logins: { username: string; password?: string; success: boolean; time: string }[];
  commands: { command: string; time: string }[];
};

export type User = {
  username: string;
  role: "admin" | "analyst";
  must_change_password?: boolean;
};
