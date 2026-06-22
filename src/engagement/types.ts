// types.ts — fan-facing read models for the engagement surfaces.
// All coverage of real sport + hub broadcasts; no fan-to-fan content type exists.

export interface FanFeedItem {
  kind: 'post' | 'result' | 'fixture';
  date?: string;
  headline: string;     // the post body, or the match/bout headline
  sub?: string;         // author name, "Full time", kickoff time…
}

export interface AthleteProfile {
  athleteId: string;
  name: string;
  handle?: string | null;
  tagline?: string | null;          // athlete-written one-liner
  avatarUrl?: string | null;        // athlete-uploaded
  bannerUrl?: string | null;        // athlete-uploaded
  links: Record<string, string>;    // {instagram,x,tiktok,youtube,website,...} — point OUT
  record: { wins: number; losses: number; draws: number };
  followers: number;
  recentResults: { headline: string; date?: string; eventId?: string }[];
  posts: { body: string; date?: string; visibility?: string }[];
  nextEvent?: { opponent: string; date?: string };
}

export interface FanHome {
  feed: FanFeedItem[];
  predictions: { event: string; pick: string; status: string }[];
  notifications: { kind: string; headline: string; read: boolean }[];
}
