import { PlayerStats, MatchData, TeamData } from '../types/cricket';
import { db } from '../firebase';
import { ref, set, get } from 'firebase/database';

const DEFAULT_PLAYERS: PlayerStats[] = [
  { name: 'Virat Kohli', runs: 12840, wickets: 4, ballsPlayed: 11500, ballsThrown: 120, matchPlayed: 275, fours: 1210, sixes: 148 },
  { name: 'Rohit Sharma', runs: 10750, wickets: 8, ballsPlayed: 9800, ballsThrown: 310, matchPlayed: 252, fours: 985, sixes: 295 },
  { name: 'MS Dhoni', runs: 10773, wickets: 1, ballsPlayed: 12300, ballsThrown: 6, matchPlayed: 350, fours: 826, sixes: 229 },
  { name: 'Sachin Tendulkar', runs: 18426, wickets: 154, ballsPlayed: 21367, ballsThrown: 8054, matchPlayed: 463, fours: 2016, sixes: 195 },
  { name: 'Jasprit Bumrah', runs: 180, wickets: 142, ballsPlayed: 250, ballsThrown: 4120, matchPlayed: 82, fours: 14, sixes: 6 },
  { name: 'Rashid Khan', runs: 1240, wickets: 172, ballsPlayed: 920, ballsThrown: 3950, matchPlayed: 94, fours: 92, sixes: 78 },
  { name: 'Ben Stokes', runs: 3460, wickets: 74, ballsPlayed: 3100, ballsThrown: 2840, matchPlayed: 112, fours: 315, sixes: 98 },
  { name: 'Hardik Pandya', runs: 1760, wickets: 81, ballsPlayed: 1480, ballsThrown: 2210, matchPlayed: 86, fours: 134, sixes: 68 },
  { name: 'Steve Smith', runs: 5050, wickets: 18, ballsPlayed: 5800, ballsThrown: 680, matchPlayed: 145, fours: 460, sixes: 34 },
  { name: 'Babar Azam', runs: 5410, wickets: 0, ballsPlayed: 6100, ballsThrown: 0, matchPlayed: 110, fours: 512, sixes: 46 }
];

const toKey = (name: string) => name.trim().replace(/\s+/g, '_').replace(/[.#$[\]]/g, '');

export const getPlayers = async (): Promise<PlayerStats[]> => {
  const snap = await get(ref(db, 'players'));
  if (!snap.exists()) {
    const updates: Record<string, PlayerStats> = {};
    DEFAULT_PLAYERS.forEach(p => { updates[toKey(p.name)] = p; });
    await set(ref(db, 'players'), updates);
    return DEFAULT_PLAYERS;
  }
  const players = Object.values(snap.val()) as PlayerStats[];
  return players.map(p => ({ ...p, teams: p.teams || [], matchIds: p.matchIds || [] }));
};

export const savePlayers = async (players: PlayerStats[]): Promise<void> => {
  const updates: Record<string, PlayerStats> = {};
  players.forEach(p => { updates[toKey(p.name)] = p; });
  await set(ref(db, 'players'), updates);
};

export const normalizePlayerName = (name: string) => name.trim().replace(/\s+/g, ' ');
export const normalizeTeamName = (name: string) => name.trim().replace(/\s+/g, ' ').toUpperCase();
export const isValidPlayerName = (name: string): boolean => normalizePlayerName(name).length >= 2;
export const isValidTeamName = (name: string): boolean => {
  const v = normalizeTeamName(name);
  return v.length >= 3 && v.length <= 20 && /^[A-Z0-9]+(?: [A-Z0-9]+)*$/.test(v);
};

export const checkPlayerExists = async (name: string): Promise<boolean> => {
  if (!name || name.trim().length < 2) return false;
  const snap = await get(ref(db, `players/${toKey(name)}`));
  return snap.exists();
};

export const registerOrGetPlayer = async (name: string): Promise<PlayerStats> => {
  const trimmedName = normalizePlayerName(name);
  const snap = await get(ref(db, `players/${toKey(trimmedName)}`));
  if (snap.exists()) return snap.val() as PlayerStats;
  const newPlayer: PlayerStats = {
    name: trimmedName, runs: 0, wickets: 0,
    ballsPlayed: 0, ballsThrown: 0, matchPlayed: 0, fours: 0, sixes: 0
  };
  await set(ref(db, `players/${toKey(trimmedName)}`), newPlayer);
  return newPlayer;
};

export const createPlayerAccount = async (
  name: string
): Promise<{ ok: boolean; message: string; player?: PlayerStats }> => {
  const playerName = normalizePlayerName(name);
  if (!isValidPlayerName(playerName)) return { ok: false, message: 'Name must be at least 2 characters long.' };
  const snap = await get(ref(db, `players/${toKey(playerName)}`));
  if (snap.exists()) return { ok: false, message: 'This name is already registered.' };
  const account: PlayerStats = {
    name: playerName, teams: [], matchIds: [],
    runs: 0, wickets: 0, ballsPlayed: 0,
    ballsThrown: 0, matchPlayed: 0, fours: 0, sixes: 0
  };
  await set(ref(db, `players/${toKey(playerName)}`), account);
  return { ok: true, message: 'Profile created successfully.', player: account };
};

export const loginPlayerAccount = async (
  name: string
): Promise<{ ok: boolean; message: string; player?: PlayerStats }> => {
  const playerName = normalizePlayerName(name);
  const snap = await get(ref(db, `players/${toKey(playerName)}`));
  if (!snap.exists()) return { ok: false, message: 'No profile found with this name.' };
  return { ok: true, message: 'Welcome back.', player: snap.val() };
};

export const updatePlayerStatsAfterMatch = async (
  name: string,
  statsDelta: Partial<PlayerStats>
): Promise<void> => {
  const key = toKey(name);
  const snap = await get(ref(db, `players/${key}`));
  if (snap.exists()) {
    const p = snap.val() as PlayerStats;
    await set(ref(db, `players/${key}`), {
      ...p,
      runs: p.runs + (statsDelta.runs || 0),
      wickets: p.wickets + (statsDelta.wickets || 0),
      ballsPlayed: p.ballsPlayed + (statsDelta.ballsPlayed || 0),
      ballsThrown: p.ballsThrown + (statsDelta.ballsThrown || 0),
      matchPlayed: p.matchPlayed + (statsDelta.matchPlayed || 0),
      fours: p.fours + (statsDelta.fours || 0),
      sixes: p.sixes + (statsDelta.sixes || 0),
    });
  } else {
    await set(ref(db, `players/${key}`), { name, ...statsDelta });
  }
};

export const getTeams = async (): Promise<TeamData[]> => {
  const snap = await get(ref(db, 'teams'));
  if (!snap.exists()) return [];
  const teams = Object.values(snap.val()) as TeamData[];
  return teams.map(t => ({ ...t, players: t.players || [], matchIds: t.matchIds || [] }));
};

export const saveTeams = async (teams: TeamData[]): Promise<void> => {
  const updates: Record<string, TeamData> = {};
  teams.forEach(t => { updates[toKey(t.name)] = t; });
  await set(ref(db, 'teams'), updates);
};

export const createTeam = async (
  name: string
): Promise<{ ok: boolean; message: string; team?: TeamData }> => {
  const teamName = normalizeTeamName(name);
  if (!isValidTeamName(teamName)) return { ok: false, message: 'Team name must be 3-20 chars, capital letters/numbers only.' };
  const snap = await get(ref(db, `teams/${toKey(teamName)}`));
  if (snap.exists()) return { ok: false, message: 'Team already exists.' };
  const team: TeamData = { name: teamName, players: [], matchIds: [], createdAt: Date.now() };
  await set(ref(db, `teams/${toKey(teamName)}`), team);
  return { ok: true, message: 'Team created.', team };
};

export const addPlayerToTeamRecord = async (
  playerName: string, teamName: string
): Promise<void> => {
  const np = normalizePlayerName(playerName);
  const nt = normalizeTeamName(teamName);
  const teamSnap = await get(ref(db, `teams/${toKey(nt)}`));
  if (teamSnap.exists()) {
    const team = teamSnap.val() as TeamData;
    if (!team.players) team.players = [];
    if (!team.players.includes(np)) {
      team.players.push(np);
      await set(ref(db, `teams/${toKey(nt)}`), team);
    }
  }
  const playerSnap = await get(ref(db, `players/${toKey(np)}`));
  if (playerSnap.exists()) {
    const player = playerSnap.val() as PlayerStats;
    const playerTeams = player.teams || [];
    if (!playerTeams.includes(nt)) {
      await set(ref(db, `players/${toKey(np)}`), { ...player, teams: [...playerTeams, nt] });
    }
  }
};

export const getMatches = async (): Promise<MatchData[]> => {
  const snap = await get(ref(db, 'matches'));
  if (!snap.exists()) return [];
  return Object.values(snap.val()) as MatchData[];
};

export const saveMatch = async (match: MatchData): Promise<void> => {
  const matchId = (match as any).id ?? (match as any).matchId;
  await set(ref(db, `matches/${matchId}`), match);
};

export const assignMatchToPlayersAndTeams = async (match: MatchData): Promise<void> => {
  const matchId = (match as any).id ?? (match as any).matchId;
  const teamNames = [normalizeTeamName(match.teamA), normalizeTeamName(match.teamB)];
  const playerNames = [...match.teamAPlayers, ...match.teamBPlayers].map(normalizePlayerName);

  for (const teamName of teamNames) {
    const snap = await get(ref(db, `teams/${toKey(teamName)}`));
    if (snap.exists()) {
      const team = snap.val() as TeamData;
      const matchIds = team.matchIds || [];
      if (matchId && !matchIds.includes(matchId)) {
        await set(ref(db, `teams/${toKey(teamName)}`), { ...team, matchIds: [...matchIds, matchId] });
      }
    }
  }

  for (const playerName of playerNames) {
    const snap = await get(ref(db, `players/${toKey(playerName)}`));
    if (snap.exists()) {
      const player = snap.val() as PlayerStats;
      const matchIds = player.matchIds || [];
      if (matchId && !matchIds.includes(matchId)) {
        await set(ref(db, `players/${toKey(playerName)}`), { ...player, matchIds: [...matchIds, matchId] });
      }
    }
  }
};

export const generateMatchCredentials = (): { id: string; password: string } => {
  const digits = Math.floor(10000000 + Math.random() * 90000000).toString();
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let password = '';
  for (let i = 0; i < 6; i++) password += letters.charAt(Math.floor(Math.random() * letters.length));
  return { id: digits, password };
};