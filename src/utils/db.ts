import { PlayerStats, MatchData, TeamData } from '../types/cricket';

const STORAGE_PLAYERS_KEY = 'cricket_scorer_players_db';
const STORAGE_MATCHES_KEY = 'cricket_scorer_matches_db';
const STORAGE_TEAMS_KEY = 'cricket_scorer_teams_db';

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

export const getPlayers = (): PlayerStats[] => {
  const stored = localStorage.getItem(STORAGE_PLAYERS_KEY);
  if (!stored) {
    localStorage.setItem(STORAGE_PLAYERS_KEY, JSON.stringify(DEFAULT_PLAYERS));
    return DEFAULT_PLAYERS;
  }
  try {
    return JSON.parse(stored);
  } catch (e) {
    return DEFAULT_PLAYERS;
  }
};

export const savePlayers = (players: PlayerStats[]) => {
  localStorage.setItem(STORAGE_PLAYERS_KEY, JSON.stringify(players));
};

export const normalizePlayerName = (name: string) => name.trim().replace(/\s+/g, ' ');

export const normalizeTeamName = (name: string) => name.trim().replace(/\s+/g, ' ').toUpperCase();

export const isValidPlayerName = (name: string): boolean => {
  const value = normalizePlayerName(name);
  return value.length >= 2;
};

export const isValidTeamName = (name: string): boolean => {
  const value = normalizeTeamName(name);
  return value.length >= 3 && value.length <= 20 && /^[A-Z0-9]+(?: [A-Z0-9]+)*$/.test(value);
};

export const checkPlayerExists = (name: string): boolean => {
  if (!name || name.trim().length < 2) return false;
  const players = getPlayers();
  return players.some(p => p.name.trim().toLowerCase() === name.trim().toLowerCase());
};

export const registerOrGetPlayer = (name: string): PlayerStats => {
  const trimmedName = normalizePlayerName(name);
  const players = getPlayers();
  const found = players.find(p => p.name.toLowerCase() === trimmedName.toLowerCase());
  if (found) {
    return found;
  }
  const newPlayer: PlayerStats = {
    name: trimmedName,
    runs: 0,
    wickets: 0,
    ballsPlayed: 0,
    ballsThrown: 0,
    matchPlayed: 0,
    fours: 0,
    sixes: 0
  };
  players.push(newPlayer);
  savePlayers(players);
  return newPlayer;
};

export const createPlayerAccount = (name: string): { ok: boolean; message: string; player?: PlayerStats } => {
  const playerName = normalizePlayerName(name);
  if (!isValidPlayerName(playerName)) {
    return { ok: false, message: 'Name must be at least 2 characters long.' };
  }
  const players = getPlayers();
  const existing = players.find(p => p.name.toLowerCase() === playerName.toLowerCase());
  if (existing) {
    return { ok: false, message: 'This name is already registered.' };
  }
  const account: PlayerStats = {
    name: playerName,
    teams: [],
    matchIds: [],
    runs: 0,
    wickets: 0,
    ballsPlayed: 0,
    ballsThrown: 0,
    matchPlayed: 0,
    fours: 0,
    sixes: 0
  };
  players.push(account);
  savePlayers(players);
  return { ok: true, message: 'Profile created successfully.', player: account };
};

export const loginPlayerAccount = (name: string): { ok: boolean; message: string; player?: PlayerStats } => {
  const playerName = normalizePlayerName(name);
  const player = getPlayers().find(p => p.name.toLowerCase() === playerName.toLowerCase());
  if (!player) return { ok: false, message: 'No profile found with this name.' };
  return { ok: true, message: 'Welcome back.', player };
};

export const getTeams = (): TeamData[] => {
  const stored = localStorage.getItem(STORAGE_TEAMS_KEY);
  if (!stored) return [];
  try { return JSON.parse(stored); } catch { return []; }
};

export const saveTeams = (teams: TeamData[]) => {
  localStorage.setItem(STORAGE_TEAMS_KEY, JSON.stringify(teams));
};

export const createTeam = (name: string): { ok: boolean; message: string; team?: TeamData } => {
  const teamName = normalizeTeamName(name);
  if (!isValidTeamName(teamName)) {
    return { ok: false, message: 'Team name must be 3-20 chars, capital letters/numbers only, spaces allowed.' };
  }
  const teams = getTeams();
  if (teams.some(team => team.name === teamName)) return { ok: false, message: 'Team already exists.' };
  const team: TeamData = { name: teamName, players: [], matchIds: [], createdAt: Date.now() };
  teams.push(team);
  saveTeams(teams);
  return { ok: true, message: 'Team created.', team };
};

export const addPlayerToTeamRecord = (playerName: string, teamName: string) => {
  const normalizedPlayer = normalizePlayerName(playerName);
  const normalizedTeam = normalizeTeamName(teamName);
  const teams = getTeams();
  const teamIndex = teams.findIndex(team => team.name === normalizedTeam);
  if (teamIndex >= 0 && !teams[teamIndex].players.includes(normalizedPlayer)) {
    teams[teamIndex].players.push(normalizedPlayer);
    saveTeams(teams);
  }
  const players = getPlayers();
  const playerIndex = players.findIndex(player => player.name.toLowerCase() === normalizedPlayer.toLowerCase());
  if (playerIndex >= 0) {
    const playerTeams = players[playerIndex].teams || [];
    if (!playerTeams.includes(normalizedTeam)) {
      players[playerIndex] = { ...players[playerIndex], teams: [...playerTeams, normalizedTeam] };
      savePlayers(players);
    }
  }
};

export const getMatches = (): MatchData[] => {
  const stored = localStorage.getItem(STORAGE_MATCHES_KEY);
  if (!stored) return [];
  try {
    return JSON.parse(stored);
  } catch (e) {
    return [];
  }
};

export const saveMatches = (matches: MatchData[]) => {
  localStorage.setItem(STORAGE_MATCHES_KEY, JSON.stringify(matches));
};

export const saveMatch = (match: MatchData) => {
  const matches = getMatches();
  const index = matches.findIndex(m => m.id === match.id);
  if (index >= 0) {
    matches[index] = match;
  } else {
    matches.push(match);
  }
  saveMatches(matches);
};

export const updatePlayerStatsAfterMatch = (
  name: string,
  statsDelta: Partial<PlayerStats>
) => {
  const players = getPlayers();
  const index = players.findIndex(p => p.name.toLowerCase() === name.toLowerCase());
  if (index >= 0) {
    players[index] = {
      ...players[index],
      runs: players[index].runs + (statsDelta.runs || 0),
      wickets: players[index].wickets + (statsDelta.wickets || 0),
      ballsPlayed: players[index].ballsPlayed + (statsDelta.ballsPlayed || 0),
      ballsThrown: players[index].ballsThrown + (statsDelta.ballsThrown || 0),
      matchPlayed: players[index].matchPlayed + (statsDelta.matchPlayed || 0),
      fours: players[index].fours + (statsDelta.fours || 0),
      sixes: players[index].sixes + (statsDelta.sixes || 0),
    };
  } else {
    // If somehow not registered yet
    players.push({
      name,
      runs: statsDelta.runs || 0,
      wickets: statsDelta.wickets || 0,
      ballsPlayed: statsDelta.ballsPlayed || 0,
      ballsThrown: statsDelta.ballsThrown || 0,
      matchPlayed: statsDelta.matchPlayed || 0,
      fours: statsDelta.fours || 0,
      sixes: statsDelta.sixes || 0,
    });
  }
  savePlayers(players);
};

export const assignMatchToPlayersAndTeams = (match: MatchData) => {
  const teamNames = [normalizeTeamName(match.teamA), normalizeTeamName(match.teamB)];
  const playerNames = [...match.teamAPlayers, ...match.teamBPlayers].map(normalizePlayerName);
  const teams = getTeams();
  teamNames.forEach(teamName => {
    const index = teams.findIndex(team => team.name === teamName);
    if (index >= 0 && match.id && !teams[index].matchIds.includes(match.id)) {
      teams[index].matchIds.push(match.id);
    }
  });
  saveTeams(teams);

  const players = getPlayers();
  playerNames.forEach(playerName => {
    const index = players.findIndex(player => player.name.toLowerCase() === playerName.toLowerCase());
    if (index >= 0) {
      const matchIds = players[index].matchIds || [];
      if (match.id && !matchIds.includes(match.id)) {
        players[index] = { ...players[index], matchIds: [...matchIds, match.id] };
      }
    }
  });
  savePlayers(players);
};

export const generateMatchCredentials = (): { id: string; password: string } => {
  const digits = Math.floor(10000000 + Math.random() * 90000000).toString(); // 8 digits
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let password = '';
  for (let i = 0; i < 6; i++) {
    password += letters.charAt(Math.floor(Math.random() * letters.length));
  }
  return { id: digits, password };
};
