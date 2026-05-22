export interface PlayerStats {
  name: string;
  teams?: string[];
  matchIds?: string[];
  runs: number;
  wickets: number;
  ballsPlayed: number;
  ballsThrown: number;
  matchPlayed: number;
  fours: number;
  sixes: number;
}

export interface TeamData {
  name: string;
  players: string[];
  matchIds: string[];
  createdAt: number;
}

export interface MatchSettings {
  overs: number; // 0 means unlimited
  isUnlimitedOvers: boolean;
  isTwoBatsmenMode: boolean; // true = 2 batsmen, false = 1 batsman
  lastCanBat: boolean;
  enableNoBall: boolean;
  enableWide: boolean;
  enableLegBy: boolean;
}

export interface LiveBatsmanState {
  name: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  isStriker: boolean;
}

export interface LiveBowlerState {
  name: string;
  overs: number;
  balls: number; // current over balls
  maidens: number;
  runs: number;
  wickets: number;
}

export interface OverBallLog {
  type: 'normal' | 'wide' | 'noball' | 'legby' | 'wicket';
  runs: number;
  displayText: string;
}

export interface PlayerMatchScore {
  name: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  howOut?: string;
  bowledBy?: string;
}

export interface BowlerMatchScore {
  name: string;
  overs: number;
  balls: number;
  maidens: number;
  runs: number;
  wickets: number;
}

export interface InningState {
  battingTeam: string;
  fieldingTeam: string;
  runs: number;
  wickets: number;
  balls: number; // total balls bowled in inning
  extras: {
    wides: number;
    noballs: number;
    legbys: number;
    others: number;
  };
  batsmen: Record<string, PlayerMatchScore>;
  bowlers: Record<string, BowlerMatchScore>;
  oversLog: OverBallLog[][]; // list of overs
  currentOverLog: OverBallLog[];
}

export interface MatchData {
  id: string;
  password: string;
  teamA: string;
  teamB: string;
  teamAPlayers: string[];
  teamBPlayers: string[];
  settings: MatchSettings;
  tossWinner: string;
  tossChoice: 'bat' | 'field';
  status: 'setup' | 'live' | 'completed';
  currentInningIndex: 1 | 2;
  firstInning?: InningState;
  secondInning?: InningState;
  currentStriker?: string;
  currentNonStriker?: string;
  currentBowler?: string;
  isFreeHit: boolean;
  winner?: string; // 'teamA' | 'teamB' | 'draw' | 'no_result'
  resultDescription?: string;
  createdAt: number;
}
