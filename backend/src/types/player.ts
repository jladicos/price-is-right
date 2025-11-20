export type PlayerRole = "host" | "player" | "audience";

export interface Player {
  id: number;
  firstName: string;
  lastName: string;
  email: string | null;
  accessCode: string;
  photoFilename: string;
  role: PlayerRole;
  active: boolean;
  sessionToken: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PlayerRow {
  id: number;
  first_name: string;
  last_name: string;
  email: string | null;
  access_code: string;
  photo_filename: string;
  role: PlayerRole;
  active: number;
  session_token: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Convert database row to Player object
 */
export function rowToPlayer(row: PlayerRow): Player {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    accessCode: row.access_code,
    photoFilename: row.photo_filename,
    role: row.role,
    active: Boolean(row.active),
    sessionToken: row.session_token,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
