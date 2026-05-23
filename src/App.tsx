import React, { useState, useEffect } from 'react';
import { 
  Play, Users, BarChart3, Home, ArrowLeft, ArrowRight, 
  MoreVertical, RefreshCw, CheckCircle, 
  Search, ShieldAlert, Award, Copy, Check, ChevronRight,
  RotateCcw, Sparkles, UserCheck, Edit3, Palette
} from 'lucide-react';
import { 
  PlayerStats, MatchSettings, MatchData, InningState, 
  PlayerMatchScore, BowlerMatchScore, TeamData 
} from './types/cricket';
import { playClickSound, playStartupSound, playSuccessSound } from './utils/audio';
import { 
  getPlayers, checkPlayerExists, 
  getMatches, saveMatch, generateMatchCredentials, updatePlayerStatsAfterMatch,
  createPlayerAccount, loginPlayerAccount, getTeams, createTeam,
  addPlayerToTeamRecord, assignMatchToPlayersAndTeams, normalizeTeamName
} from './utils/db';

// ==================== PIXEL INTRO COMPONENT ====================
type Particle = {
  tx: number; ty: number;       // target position
  sx: number; sy: number;       // source/start position
  x: number; y: number;          // current position
  vx: number; vy: number;        // velocity (for explosion)
  r: number; g: number; b: number;
  size: number;
  delay: number;                 // formation delay (seconds)
  duration: number;              // formation duration
};

type BorderPixel = {
  x: number; y: number;
  vx: number; vy: number;
  size: number;
  opacity: number;
};

function PixelIntro({ onStart, isLaunching }: { onStart: () => void; isLaunching: boolean }) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [pixelsFormed, setPixelsFormed] = useState(false);
  const particlesRef = React.useRef<Particle[]>([]);
  const borderPixelsRef = React.useRef<BorderPixel[]>([]);
  const animRef = React.useRef<number>(0);
  const startTimeRef = React.useRef<number>(0);
  const launchStartRef = React.useRef<number>(0);
  const isLaunchingRef = React.useRef<boolean>(false);

  // Keep ref in sync with prop so animation loop can read it
  useEffect(() => {
    isLaunchingRef.current = isLaunching;
    if (isLaunching) {
      launchStartRef.current = performance.now();
      // Assign explosion velocity to all formed pixels
      for (const p of particlesRef.current) {
        const dx = p.x - 192; // center X
        const dy = p.y - 320; // center Y
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const speed = 6 + Math.random() * 10;
        p.vx = (dx / dist) * speed + (Math.random() - 0.5) * 4;
        p.vy = (dy / dist) * speed + (Math.random() - 0.5) * 4;
      }
    }
  }, [isLaunching]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Use container's actual size
    const rect = container.getBoundingClientRect();
    const W = Math.floor(rect.width);
    const H = Math.floor(rect.height);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.scale(dpr, dpr);

    const img = new Image();
    img.src = '/images/pro-scorer-start.png';
    
    img.onload = () => {
      // Draw image to offscreen canvas to sample pixels
      const off = document.createElement('canvas');
      off.width = W;
      off.height = H;
      const octx = off.getContext('2d');
      if (!octx) return;
      
      // Use 'cover' style sizing
      const imgAspect = img.width / img.height;
      const canvasAspect = W / H;
      let drawW = W, drawH = H, dx = 0, dy = 0;
      if (imgAspect > canvasAspect) {
        drawH = H;
        drawW = H * imgAspect;
        dx = (W - drawW) / 2;
      } else {
        drawW = W;
        drawH = W / imgAspect;
        dy = (H - drawH) / 2;
      }
      octx.drawImage(img, dx, dy, drawW, drawH);
      const imgData = octx.getImageData(0, 0, W, H).data;

      // Sample pixels and create particles
      const particles: Particle[] = [];
      const step = 4; // pixel block size
      const cx = W / 2;
      const cy = H / 2;

      for (let y = 0; y < H; y += step) {
        for (let x = 0; x < W; x += step) {
          const i = (y * W + x) * 4;
          const r = imgData[i];
          const g = imgData[i + 1];
          const b = imgData[i + 2];
          const a = imgData[i + 3];
          if (a < 50) continue;

          // Pick random source position outside the screen
          const angle = Math.random() * Math.PI * 2;
          const distFromCenter = Math.max(W, H) * (0.7 + Math.random() * 0.6);
          const sx = cx + Math.cos(angle) * distFromCenter;
          const sy = cy + Math.sin(angle) * distFromCenter;

          // Delay based on distance from center (outside-in cascade) + jitter
          const distToTarget = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
          const maxDist = Math.sqrt(cx * cx + cy * cy);
          const delay = (1 - distToTarget / maxDist) * 0.4 + Math.random() * 0.6;

          particles.push({
            tx: x + step / 2,
            ty: y + step / 2,
            sx, sy,
            x: sx, y: sy,
            vx: 0, vy: 0,
            r, g, b,
            size: step,
            delay,
            duration: 1.0 + Math.random() * 0.4,
          });
        }
      }
      particlesRef.current = particles;
      
      // Initialize border pixels (drifting along edges)
      const borderPixels: BorderPixel[] = [];
      const borderCount = 20; // Very few as requested
      for (let i = 0; i < borderCount; i++) {
        const side = Math.floor(Math.random() * 4);
        let px = 0, py = 0;
        if (side === 0) { px = Math.random() * W; py = 2; } // top
        else if (side === 1) { px = W - 2; py = Math.random() * H; } // right
        else if (side === 2) { px = Math.random() * W; py = H - 2; } // bottom
        else { px = 2; py = Math.random() * H; } // left

        borderPixels.push({
          x: px, y: py,
          vx: (Math.random() - 0.5) * 0.5,
          vy: (Math.random() - 0.5) * 0.5,
          size: 1 + Math.random() * 2,
          opacity: 0.1 + Math.random() * 0.4
        });
      }
      borderPixelsRef.current = borderPixels;

      startTimeRef.current = performance.now();

      let formedFlagSet = false;

      function animate() {
        if (!ctx) return;
        const now = performance.now();
        const elapsed = (now - startTimeRef.current) / 1000;
        const launchT = isLaunchingRef.current && launchStartRef.current
          ? (now - launchStartRef.current) / 1000
          : 0;

        // Clear with black
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, W, H);

        // Update and draw border pixels
        ctx.fillStyle = '#60a5fa';
        for (const bp of borderPixelsRef.current) {
          bp.x += bp.vx;
          bp.y += bp.vy;
          // Boundary wrap
          if (bp.x < 0) bp.x = W; if (bp.x > W) bp.x = 0;
          if (bp.y < 0) bp.y = H; if (bp.y > H) bp.y = 0;
          
          ctx.globalAlpha = bp.opacity * (isLaunchingRef.current ? Math.max(0, 1 - launchT * 2) : 1);
          ctx.fillRect(bp.x, bp.y, bp.size, bp.size);
        }

        let allDone = true;

        for (const p of particles) {
          let drawAlpha = 1;

          if (isLaunchingRef.current) {
            // Explosion phase
            p.x += p.vx;
            p.y += p.vy;
            p.vx *= 0.97;
            p.vy *= 0.97;
            drawAlpha = Math.max(0, 1 - launchT * 1.2);
          } else {
            // Formation phase
            const localT = Math.min(Math.max((elapsed - p.delay) / p.duration, 0), 1);
            // Cubic ease-out
            const ease = 1 - Math.pow(1 - localT, 3);
            p.x = p.sx + (p.tx - p.sx) * ease;
            p.y = p.sy + (p.ty - p.sy) * ease;
            drawAlpha = localT;
            if (localT < 1) allDone = false;
          }

          if (drawAlpha <= 0) continue;
          
          ctx.globalAlpha = drawAlpha;
          ctx.fillStyle = `rgb(${p.r},${p.g},${p.b})`;
          ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
        }
        ctx.globalAlpha = 1;

        if (allDone && !formedFlagSet && !isLaunchingRef.current) {
          formedFlagSet = true;
          setPixelsFormed(true);
        }

        animRef.current = requestAnimationFrame(animate);
      }

      animate();
    };

    img.onerror = () => {
      // Fallback if image fails to load
      console.error('Failed to load splash image');
    };

    return () => {
      cancelAnimationFrame(animRef.current);
    };
  }, []);

  return (
    <div ref={containerRef} className="flex-1 relative overflow-hidden bg-black">
      <canvas
        ref={canvasRef}
        className="absolute inset-0"
        style={{ imageRendering: 'pixelated' }}
      />
      
      {/* Title overlay */}
      <div className={`absolute inset-x-0 top-12 z-10 flex flex-col items-center pointer-events-none transition-opacity duration-700 ${pixelsFormed && !isLaunching ? 'opacity-100' : 'opacity-0'}`}>
        <h1 className="text-5xl font-black italic tracking-tighter text-white drop-shadow-[0_0_25px_rgba(59,130,246,0.9)]">
          PRO SCORER
        </h1>
      </div>

      {/* Thin subtle thunders */}
      <div className={`absolute inset-0 z-[5] pointer-events-none transition-opacity duration-700 ${pixelsFormed && !isLaunching ? 'opacity-100' : 'opacity-0'}`}>
        <div className="pro-lightning-thin pro-lightning-thin-one" />
        <div className="pro-lightning-thin pro-lightning-thin-two" />
        <div className="pro-lightning-thin pro-lightning-thin-three" />
      </div>

      {/* Bottom button */}
      <div className={`absolute inset-x-0 bottom-6 z-10 flex justify-center px-6 transition-all duration-700 ${pixelsFormed && !isLaunching ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
        <button
          onClick={onStart}
          disabled={isLaunching}
          className="flex w-full max-w-[300px] items-center justify-center gap-3 rounded-2xl border border-blue-400/40 bg-[var(--primary)] px-6 py-4 text-xl font-black text-[var(--primary-text)] shadow-[0_0_30px_rgba(37,99,235,0.45)] transition active:scale-95 disabled:opacity-50"
        >
          <span>LET'S PLAY</span>
          <Play className="h-5 w-5 fill-current" />
        </button>
      </div>
    </div>
  );
}

export default function App() {
  // Navigation & Page routing state
  const [currentPage, setCurrentPage] = useState<string>('intro');
  const [isIntroAnimating, setIsIntroAnimating] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  // Live View Spectator Mode
  const [viewMatch, setViewMatch] = useState<MatchData | null>(null);
  const [liveViewUpdatedAt, setLiveViewUpdatedAt] = useState<number>(Date.now());

  // Swipe to go back — refs to avoid stale closure
  const touchStartXRef = React.useRef<number>(0);
  const touchStartYRef = React.useRef<number>(0);
  const [swipeHint, setSwipeHint] = useState<number>(0); // 0-1, drives the visual indicator

  // Inning Complete Confirmation Modal
  const [showInningEndModal, setShowInningEndModal] = useState(false);
  const [pendingInningEndState, setPendingInningEndState] = useState<InningState | null>(null);
  const [showNextBatsmanModal, setShowNextBatsmanModal] = useState(false);
  const [openBowlerAfterBatsman, setOpenBowlerAfterBatsman] = useState(false);

  // Global State for simulated DB
  const [allPlayers, setAllPlayers] = useState<PlayerStats[]>([]);
  const [allMatches, setAllMatches] = useState<MatchData[]>([]);
  const [allTeams, setAllTeams] = useState<TeamData[]>([]);
  const [currentUser, setCurrentUser] = useState<PlayerStats | null>(null);

  // Theme State
  const [theme, setTheme] = useState<string>('blue');
  const [showThemeModal, setShowThemeModal] = useState(false);

  const themes = [
    { id: 'blue', name: 'Blue', bg: 'bg-blue-500' },
    { id: 'black', name: 'Black', bg: 'bg-black' },
    { id: 'gray', name: 'Gray', bg: 'bg-gray-700' },
    { id: 'white', name: 'White', bg: 'bg-white' },
    { id: 'pink', name: 'Pink', bg: 'bg-pink-500' },
    { id: 'cyan', name: 'Cyan', bg: 'bg-cyan-400' },
  ];

  // Player account and team selection state
  const [accountName, setAccountName] = useState('');
  const [accountMode, setAccountMode] = useState<'login' | 'signup'>('login');
  const [accountMessage, setAccountMessage] = useState('');
  const [teamPickerSlot, setTeamPickerSlot] = useState<'A' | 'B' | null>(null);
  const [teamSearch, setTeamSearch] = useState('');
  const [newTeamName, setNewTeamName] = useState('');

  // Search filter states
  const [playerSearch, setPlayerSearch] = useState('');
  const [matchSearch, setMatchSearch] = useState('');
  const [activeStatsTab, setActiveStatsTab] = useState<'batting' | 'bowling'>('batting');

  // Match state currently being created or scored
  const [currentMatch, setCurrentMatch] = useState<MatchData | null>(null);

  // Undo History Stack (Stores previous match states)
  const [matchHistory, setMatchHistory] = useState<MatchData[]>([]);

  // Temporary filling inputs for setup pages
  const [playerInputA, setPlayerInputA] = useState('');
  const [playerInputB, setPlayerInputB] = useState('');
  
  // Modals & Popups
  const [showCancelPrompt, setShowCancelPrompt] = useState(false);
  const [showThreeDotsMenu, setShowThreeDotsMenu] = useState(false);
  const [showWideModal, setShowWideModal] = useState(false);
  const [showNoBallModal, setShowNoBallModal] = useState(false);
  const [showLegByModal, setShowLegByModal] = useState(false);
  const [showOutModal, setShowOutModal] = useState(false);
  const [showAddPlayerModal, setShowAddPlayerModal] = useState(false);
  const [showBowlerChangeModal, setShowBowlerChangeModal] = useState(false);
  const [showEndInningConfirm, setShowEndInningConfirm] = useState(false);
  const [showEndMatchManualModal, setShowEndMatchManualModal] = useState(false);
  const [showResumeAuthModal, setShowResumeAuthModal] = useState(false);
  const [notification, setNotification] = useState<{
    title: string;
    message: string;
    type: 'info' | 'success' | 'warning' | 'error';
  } | null>(null);

  // QUICK SUBSTITUTION OVERLAYS
  const [showSwapStrikerModal, setShowSwapStrikerModal] = useState(false);
  const [showSwapNonStrikerModal, setShowSwapNonStrikerModal] = useState(false);
  const [showSwapBowlerModal, setShowSwapBowlerModal] = useState(false);

  // CUSTOM SCORING MODAL
  const [showCustomRunsModal, setShowCustomRunsModal] = useState(false);
  const [customRunsValue, setCustomRunsValue] = useState<number>(5);
  const [customRunType, setCustomRunType] = useState<'normal' | 'wide' | 'noball' | 'legby'>('normal');
  const [customIsBoundary, setCustomIsBoundary] = useState<boolean>(false);

  // Resume state values
  const [resumeMatchId, setResumeMatchId] = useState('');
  const [resumePassword, setResumePassword] = useState('');
  const [resumeError, setResumeError] = useState('');
  const [selectedLiveMatchToAuth, setSelectedLiveMatchToAuth] = useState<MatchData | null>(null);

  // Extras input forms
  const [extraRunsInput, setExtraRunsInput] = useState<number>(0);
  const [extraBoundaryOption, setExtraBoundaryOption] = useState<'running' | 'boundary'>('running');
  const [outType, setOutType] = useState<'bowled' | 'caught' | 'run_out' | 'stumped' | 'lbw' | 'retired_out'>('bowled');
  const [outFielder, setOutFielder] = useState('');

  // Mid-match addition fields
  const [midMatchTeam, setMidMatchTeam] = useState<'A' | 'B'>('A');
  const [midMatchPlayerName, setMidMatchPlayerName] = useState('');

  // Initial trigger for startup tone
  useEffect(() => {
    getPlayers().then(setAllPlayers);
    getMatches().then(setAllMatches);
    getTeams().then(setAllTeams);
  }, []);

  const alert = React.useCallback((message: string) => {
    const text = String(message);
    const lower = text.toLowerCase();
    const type: 'info' | 'success' | 'warning' | 'error' =
      lower.includes('wrong') || lower.includes('incorrect') || lower.includes('failed')
        ? 'error'
        : lower.includes('success') || lower.includes('copied') || lower.includes('added') || lower.includes('created')
          ? 'success'
          : lower.includes('please') || lower.includes('must') || lower.includes('only') || lower.includes('cannot') || lower.includes('no ')
            ? 'warning'
            : 'info';
    const title = type === 'success'
      ? 'Success'
      : type === 'error'
        ? 'Action Needed'
        : type === 'warning'
          ? 'Check Required'
          : 'Notice';
    setNotification({ title, message: text, type });
  }, []);

  useEffect(() => {
    if (!notification) return;
    const timeoutId = window.setTimeout(() => setNotification(null), 3800);
    return () => window.clearTimeout(timeoutId);
  }, [notification]);

  // Spectator mode: poll saved matches every second so viewers see live score updates.
  useEffect(() => {
    if (currentPage !== 'live_view' || !viewMatch?.id) return;

    const refreshLiveScorecard = async () => {
      const matches = await getMatches();
      setAllMatches(matches);
      const freshMatch = matches.find(match => match.id === viewMatch.id);
      if (freshMatch) {
        setViewMatch(freshMatch);
        setLiveViewUpdatedAt(Date.now());
      }
    };

    refreshLiveScorecard();
    const intervalId = window.setInterval(refreshLiveScorecard, 1000);
    return () => window.clearInterval(intervalId);
  }, [currentPage, viewMatch?.id]);

  const navigateWithSound = (page: string) => {
    playClickSound();
    setCurrentPage(page);
    setShowThreeDotsMenu(false);
  };

  // Safe Prompt helper for Match Cancelation
  const handleCancelMatch = () => {
    playClickSound();
    setShowCancelPrompt(true);
  };

  const confirmCancelMatch = () => {
    playClickSound();
    setCurrentMatch(null);
    setMatchHistory([]);
    setPlayerInputA('');
    setPlayerInputB('');
    setShowCancelPrompt(false);
    setCurrentPage('home');
  };

  const handleAccountSubmit = async () => {
    playClickSound();
    const result = accountMode === 'signup'
      ? await createPlayerAccount(accountName)
      : await loginPlayerAccount(accountName);
    setAccountMessage(result.message);
    if (result.ok && result.player) {
      setCurrentUser(result.player);
      getPlayers().then(setAllPlayers);
      setAccountName('');
      setCurrentPage('player_profile');
    }
  };

  const openTeamPicker = (slot: 'A' | 'B') => {
    playClickSound();
    setTeamPickerSlot(slot);
    setTeamSearch('');
    setNewTeamName('');
  };

  const chooseTeamForSlot = (teamName: string) => {
    if (!currentMatch || !teamPickerSlot) return;
    const normalized = normalizeTeamName(teamName);
    if (teamPickerSlot === 'A' && normalized === currentMatch.teamB) {
      alert('Team A and Team B must be different.');
      return;
    }
    if (teamPickerSlot === 'B' && normalized === currentMatch.teamA) {
      alert('Team A and Team B must be different.');
      return;
    }
    const updated = teamPickerSlot === 'A'
      ? { ...currentMatch, teamA: normalized, teamAPlayers: [] }
      : { ...currentMatch, teamB: normalized, teamBPlayers: [] };
    setCurrentMatch(updated);
    setTeamPickerSlot(null);
    setTeamSearch('');
  };

  const handleCreateAndChooseTeam = async () => {
    playClickSound();
    const result = await createTeam(newTeamName);
    if (!result.ok || !result.team) {
      alert(result.message);
      return;
    }
    getTeams().then(setAllTeams);
    chooseTeamForSlot(result.team.name);
  };

  // Initializing step 1.1: Name filling page
  const handleInitiateMatchSetup = () => {
    playClickSound();
    setMatchHistory([]);
    const skeletonSettings: MatchSettings = {
      overs: 5,
      isUnlimitedOvers: false,
      isTwoBatsmenMode: true,
      lastCanBat: true,
      enableNoBall: true,
      enableWide: true,
      enableLegBy: true,
    };
    const newMatchSkeleton: MatchData = {
      id: '',
      password: '',
      teamA: '',
      teamB: '',
      teamAPlayers: [],
      teamBPlayers: [],
      settings: skeletonSettings,
      tossWinner: '',
      tossChoice: 'bat',
      status: 'setup',
      currentInningIndex: 1,
      isFreeHit: false,
      createdAt: Date.now()
    };

    setCurrentMatch(newMatchSkeleton);
    getTeams().then(setAllTeams);
    setCurrentPage('setup_teams');
  };

  const handleNextFromTeams = () => {
    playClickSound();
    if (!currentMatch?.teamA || !currentMatch?.teamB) {
      alert('Please select Team A and Team B first.');
      return;
    }
    if (currentMatch.teamA === currentMatch.teamB) {
      alert('Team A and Team B must be different.');
      return;
    }
    setCurrentMatch({ ...currentMatch, tossWinner: currentMatch.teamA });
    setCurrentPage('setup_players');
  };

  // Add players in page 1.2
  const handleAddExistingPlayer = async (team: 'A' | 'B', playerName: string) => {
    playClickSound();
    if (!currentMatch) return;
    const players = await getPlayers();
    const existingPlayer = players.find(p => p.name.toLowerCase() === playerName.trim().toLowerCase());
    if (!existingPlayer) return;
    if (team === 'A') {
      if (currentMatch.teamAPlayers.includes(existingPlayer.name)) return;
      setCurrentMatch({ ...currentMatch, teamAPlayers: [...currentMatch.teamAPlayers, existingPlayer.name] });
      await addPlayerToTeamRecord(existingPlayer.name, currentMatch.teamA);
      setPlayerInputA('');
    } else {
      if (currentMatch.teamBPlayers.includes(existingPlayer.name)) return;
      setCurrentMatch({ ...currentMatch, teamBPlayers: [...currentMatch.teamBPlayers, existingPlayer.name] });
      await addPlayerToTeamRecord(existingPlayer.name, currentMatch.teamB);
      setPlayerInputB('');
    }
    getPlayers().then(setAllPlayers);
  };

  const handleAddPlayer = async (team: 'A' | 'B') => {
    playClickSound();
    const nameStr = (team === 'A' ? playerInputA : playerInputB).trim().replace(/\s+/g, ' ');
    const players = await getPlayers();
    const existingPlayer = players.find(p => p.name.toLowerCase() === nameStr.toLowerCase());
    if (!existingPlayer) {
      alert('Only existing player accounts can be added. Ask player to create/login account first.');
      return;
    }

    if (!currentMatch) return;

    if (team === 'A') {
      if (currentMatch.teamAPlayers.some(p => p.toLowerCase() === nameStr.toLowerCase())) {
        alert('Player already added to this team.');
        return;
      }
      const updatedPlayers = [...currentMatch.teamAPlayers, existingPlayer.name];
      setCurrentMatch({ ...currentMatch, teamAPlayers: updatedPlayers });
      await addPlayerToTeamRecord(existingPlayer.name, currentMatch.teamA);
      setPlayerInputA('');
    } else {
      if (currentMatch.teamBPlayers.some(p => p.toLowerCase() === nameStr.toLowerCase())) {
        alert('Player already added to this team.');
        return;
      }
      const updatedPlayers = [...currentMatch.teamBPlayers, existingPlayer.name];
      setCurrentMatch({ ...currentMatch, teamBPlayers: updatedPlayers });
      await addPlayerToTeamRecord(existingPlayer.name, currentMatch.teamB);
      setPlayerInputB('');
    }

    getPlayers().then(setAllPlayers);
  };

  const handleNextFromPlayers = () => {
    playClickSound();
    if (!currentMatch) return;
    if (currentMatch.teamAPlayers.length < 1 || currentMatch.teamBPlayers.length < 1) {
      alert('Please add at least 1 player to each team.');
      return;
    }

    // If any team has only 1 player, force 1-Batsman mode
    if (currentMatch.teamAPlayers.length === 1 || currentMatch.teamBPlayers.length === 1) {
      setCurrentMatch({
        ...currentMatch,
        settings: {
          ...currentMatch.settings,
          isTwoBatsmenMode: false,
          lastCanBat: true
        }
      });
    }

    // Refresh player list from DB
    getPlayers().then(setAllPlayers);
    setCurrentPage('setup_settings_1');
  };

  // Page 1.3 match settings 1 handler
  const handleNextFromSettings1 = () => {
    playClickSound();
    if (!currentMatch) return;
    
    // Force custom rule constraint: in single player batting mode, lastCanBat is permanently true
    let lastCanBatVal = currentMatch.settings.lastCanBat;
    if (!currentMatch.settings.isTwoBatsmenMode) {
      lastCanBatVal = true;
    }

    setCurrentMatch({
      ...currentMatch,
      settings: {
        ...currentMatch.settings,
        lastCanBat: lastCanBatVal
      }
    });

    setCurrentPage('setup_settings_2');
  };

  // Page 1.4 match settings 2 handler -> goes to toss page 1.5
  const handleNextFromSettings2 = () => {
    playClickSound();
    setCurrentPage('setup_toss');
  };

  // Page 1.5 Toss page -> goes to 1.6 striker selection
  const handleNextFromToss = () => {
    playClickSound();
    setCurrentPage('select_striker');
  };

  // Page 1.6 Striker Selection
  const handleSelectStriker = (name: string) => {
    playClickSound();
    if (!currentMatch) return;
    setCurrentMatch({
      ...currentMatch,
      currentStriker: name
    });
  };

  const handleNextFromStriker = () => {
    playClickSound();
    if (!currentMatch || !currentMatch.currentStriker) {
      alert('Please select a Striker batsman.');
      return;
    }
    // If 2 batsmen mode, go to non-striker selection page 1.7. Otherwise skip directly to bowler selection
    if (currentMatch.settings.isTwoBatsmenMode) {
      setCurrentPage('select_non_striker');
    } else {
      setCurrentMatch(prev => prev ? { ...prev, currentNonStriker: undefined } : null);
      setCurrentPage('select_bowler');
    }
  };

  // Page 1.7 Non-Striker Selection
  const handleSelectNonStriker = (name: string) => {
    playClickSound();
    if (!currentMatch) return;
    setCurrentMatch({
      ...currentMatch,
      currentNonStriker: name
    });
  };

  const handleNextFromNonStriker = () => {
    playClickSound();
    if (!currentMatch || !currentMatch.currentNonStriker) {
      alert('Please select a Non-Striker batsman.');
      return;
    }
    setCurrentPage('select_bowler');
  };

  // Bowler Selection
  const handleSelectBowler = (name: string) => {
    playClickSound();
    if (!currentMatch) return;
    setCurrentMatch({
      ...currentMatch,
      currentBowler: name
    });
  };

  const handleNextFromBowler = async () => {
    playClickSound();
    if (!currentMatch || !currentMatch.currentBowler) {
      alert('Please select a Bowler.');
      return;
    }

    // Second innings is already registered; after choosing striker/non-striker/bowler, return to scoring.
    if (currentMatch.status === 'live' && currentMatch.currentInningIndex === 2 && currentMatch.secondInning) {
      await saveMatch(currentMatch);
      getMatches().then(setAllMatches);
      setCurrentPage('scoring');
      return;
    }

    setCurrentPage('confirm_match');
  };

  // Page 1.8 Final verification & initialization of actual Inning objects before permanent registration
  const handleStartScoringActiveMatch = async () => {
    if (!currentMatch) return;
    playSuccessSound();

    const creds = generateMatchCredentials();
    
    // Identify who bats first
    const tossWinnerName = currentMatch.tossWinner;
    const isWinnerA = tossWinnerName === currentMatch.teamA;
    const choice = currentMatch.tossChoice; // 'bat' | 'field'

    let battingTeam = '';
    let fieldingTeam = '';
    let battingPlayers: string[] = [];
    let fieldingPlayers: string[] = [];

    if (isWinnerA) {
      if (choice === 'bat') {
        battingTeam = currentMatch.teamA;
        fieldingTeam = currentMatch.teamB;
        battingPlayers = currentMatch.teamAPlayers;
        fieldingPlayers = currentMatch.teamBPlayers;
      } else {
        battingTeam = currentMatch.teamB;
        fieldingTeam = currentMatch.teamA;
        battingPlayers = currentMatch.teamBPlayers;
        fieldingPlayers = currentMatch.teamAPlayers;
      }
    } else {
      if (choice === 'bat') {
        battingTeam = currentMatch.teamB;
        fieldingTeam = currentMatch.teamA;
        battingPlayers = currentMatch.teamBPlayers;
        fieldingPlayers = currentMatch.teamAPlayers;
      } else {
        battingTeam = currentMatch.teamA;
        fieldingTeam = currentMatch.teamB;
        battingPlayers = currentMatch.teamAPlayers;
        fieldingPlayers = currentMatch.teamBPlayers;
      }
    }

    // Initialize batsman score records
    const initialBatsmenMap: Record<string, PlayerMatchScore> = {};
    battingPlayers.forEach(p => {
      initialBatsmenMap[p] = { name: p, runs: 0, balls: 0, fours: 0, sixes: 0 };
    });

    // Initialize bowler score records
    const initialBowlersMap: Record<string, BowlerMatchScore> = {};
    fieldingPlayers.forEach(p => {
      initialBowlersMap[p] = { name: p, overs: 0, balls: 0, maidens: 0, runs: 0, wickets: 0 };
    });

    const initialInning: InningState = {
      battingTeam,
      fieldingTeam,
      runs: 0,
      wickets: 0,
      balls: 0,
      extras: { wides: 0, noballs: 0, legbys: 0, others: 0 },
      batsmen: initialBatsmenMap,
      bowlers: initialBowlersMap,
      oversLog: [],
      currentOverLog: []
    };

    const initializedMatch: MatchData = {
      ...currentMatch,
      id: creds.id,
      password: creds.password,
      status: 'live',
      currentInningIndex: 1,
      firstInning: initialInning,
      isFreeHit: false
    };

    // Note: matchPlayed and all career stats are saved only at match end (from final inning data)

    setCurrentMatch(initializedMatch);
    setMatchHistory([]);
    await saveMatch(initializedMatch);
    await assignMatchToPlayersAndTeams(initializedMatch);
    getMatches().then(setAllMatches);
    getPlayers().then(setAllPlayers);
    setCurrentPage('scoring');
  };


  // ==================== CRICKET SCORING INTERACTION ENGINE ====================

  const getActiveInning = (): InningState => {
    if (!currentMatch) throw new Error("No active match");
    return currentMatch.currentInningIndex === 1 
      ? currentMatch.firstInning! 
      : currentMatch.secondInning!;
  };

  const getBattingPlayersForInning = (match: MatchData): string[] => {
    const inning = match.currentInningIndex === 1 ? match.firstInning : match.secondInning;
    if (inning) return inning.battingTeam === match.teamA ? match.teamAPlayers : match.teamBPlayers;

    // During first-inning setup, derive batting side from toss decision.
    if (match.tossChoice === 'bat') {
      return match.tossWinner === match.teamA ? match.teamAPlayers : match.teamBPlayers;
    }
    return match.tossWinner === match.teamA ? match.teamBPlayers : match.teamAPlayers;
  };

  const getFieldingPlayersForInning = (match: MatchData): string[] => {
    const inning = match.currentInningIndex === 1 ? match.firstInning : match.secondInning;
    if (inning) return inning.fieldingTeam === match.teamA ? match.teamAPlayers : match.teamBPlayers;

    // During first-inning setup, derive fielding side from toss decision.
    if (match.tossChoice === 'field') {
      return match.tossWinner === match.teamA ? match.teamAPlayers : match.teamBPlayers;
    }
    return match.tossWinner === match.teamA ? match.teamBPlayers : match.teamAPlayers;
  };

  const getAvailableNextBatsmen = (match: MatchData): string[] => {
    const inning = match.currentInningIndex === 1 ? match.firstInning : match.secondInning;
    const players = getBattingPlayersForInning(match);
    if (!inning) return players;
    return players.filter(name => !inning.batsmen[name]?.howOut && name !== match.currentStriker && name !== match.currentNonStriker);
  };

  // Push currentMatch to history stack to allow robust Undo feature
  const pushToHistory = () => {
    if (!currentMatch) return;
    const copy = JSON.parse(JSON.stringify(currentMatch));
    setMatchHistory(prev => [...prev, copy]);
  };

  const handleUndoLastBall = async () => {
    playClickSound();
    if (matchHistory.length === 0) {
      alert("No balls left in the scoring history to undo!");
      return;
    }
    const previousState = matchHistory[matchHistory.length - 1];
    setMatchHistory(prev => prev.slice(0, prev.length - 1));
    setCurrentMatch(previousState);
    await saveMatch(previousState);
    getMatches().then(setAllMatches);
    getPlayers().then(setAllPlayers);
  };

  const updateActiveInning = (updatedInning: InningState, extraPartialChanges: Partial<MatchData> = {}) => {
    if (!currentMatch) return;
    
    let nextMatchState: MatchData = { ...currentMatch, ...extraPartialChanges };
    if (currentMatch.currentInningIndex === 1) {
      nextMatchState.firstInning = updatedInning;
    } else {
      nextMatchState.secondInning = updatedInning;
    }

    setCurrentMatch(nextMatchState);
    saveMatch(nextMatchState); // fire and forget is ok here
    getMatches().then(setAllMatches);
  };

  // Helper routine to change strike
  const rotateStrike = () => {
    if (!currentMatch) return;
    if (!currentMatch.settings.isTwoBatsmenMode) return;
    if (!currentMatch.currentNonStriker) return; // No rotation possible with solo batsman

    pushToHistory(); // store history
    const temp = currentMatch.currentStriker;
    setCurrentMatch({
      ...currentMatch,
      currentStriker: currentMatch.currentNonStriker,
      currentNonStriker: temp
    });
  };

  // Quick swap striker modal handler
  const handleSubstituteStriker = (newName: string) => {
    playClickSound();
    if (!currentMatch) return;
    pushToHistory();
    setCurrentMatch({
      ...currentMatch,
      currentStriker: newName
    });
    setShowSwapStrikerModal(false);
  };

  // Quick swap non striker modal handler
  const handleSubstituteNonStriker = (newName: string) => {
    playClickSound();
    if (!currentMatch) return;
    pushToHistory();
    setCurrentMatch({
      ...currentMatch,
      currentNonStriker: newName
    });
    setShowSwapNonStrikerModal(false);
  };

  // Quick swap bowler modal handler
  const handleSubstituteBowler = (newName: string) => {
    playClickSound();
    if (!currentMatch) return;
    pushToHistory();
    setCurrentMatch({
      ...currentMatch,
      currentBowler: newName
    });
    setShowSwapBowlerModal(false);
  };

  // 1.9 Scoring Runs (Normal Delivery)
  const scoreNormalRuns = (runsScored: number) => {
    playClickSound();
    if (!currentMatch) return;
    
    const inning = getActiveInning();
    const striker = currentMatch.currentStriker;
    const bowler = currentMatch.currentBowler;

    if (!striker || !bowler) {
      alert("Please ensure both a active batsman and bowler are selected from the 3-dots or settings.");
      return;
    }

    pushToHistory(); // store history for undo

    // Deep copy state dictionaries
    const nextBatsmen = { ...inning.batsmen };
    const nextBowlers = { ...inning.bowlers };

    // Update Batsman
    const bStats = nextBatsmen[striker] 
      ? { ...nextBatsmen[striker] } 
      : { name: striker, runs: 0, balls: 0, fours: 0, sixes: 0 };
    bStats.runs += runsScored;
    bStats.balls += 1;
    if (runsScored === 4) bStats.fours += 1;
    if (runsScored === 6) bStats.sixes += 1;
    nextBatsmen[striker] = bStats;

    // Update Bowler
    const bowlStats = nextBowlers[bowler] 
      ? { ...nextBowlers[bowler] } 
      : { name: bowler, overs: 0, balls: 0, maidens: 0, runs: 0, wickets: 0 };
    bowlStats.balls += 1;
    bowlStats.runs += runsScored;
    
    let isOverComplete = false;
    let nextOverLog = [...inning.currentOverLog];

    // Log current ball
    nextOverLog.push({
      type: 'normal',
      runs: runsScored,
      displayText: runsScored.toString()
    });

    let totalBalls = inning.balls + 1;

    if (bowlStats.balls === 6) {
      bowlStats.overs += 1;
      bowlStats.balls = 0;
      isOverComplete = true;
    }
    nextBowlers[bowler] = bowlStats;

    // NOTE: Career stats updated only at match end from final inning data (not per ball, to avoid double counts on undo)

    // Prepare updated inning
    let updatedInning: InningState = {
      ...inning,
      runs: inning.runs + runsScored,
      balls: totalBalls,
      batsmen: nextBatsmen,
      bowlers: nextBowlers,
      currentOverLog: isOverComplete ? [] : nextOverLog,
      oversLog: isOverComplete ? [...inning.oversLog, nextOverLog] : inning.oversLog
    };

    // Handle strike rotation for odd numbers — only when a real non-striker exists
    let nextStriker = currentMatch.currentStriker;
    let nextNonStriker = currentMatch.currentNonStriker;
    const canRotate = currentMatch.settings.isTwoBatsmenMode && !!currentMatch.currentNonStriker;

    if (canRotate && runsScored % 2 !== 0) {
      const temp = nextStriker;
      nextStriker = nextNonStriker;
      nextNonStriker = temp;
    }

    // If over complete, automatically rotate strike unless solo batsman is on pitch
    if (isOverComplete && canRotate) {
      const temp = nextStriker;
      nextStriker = nextNonStriker;
      nextNonStriker = temp;
    }

    // Turn off free hit after a valid ball
    const extraPartial: Partial<MatchData> = {
      currentStriker: nextStriker,
      currentNonStriker: nextNonStriker,
      isFreeHit: false
    };

    updateActiveInning(updatedInning, extraPartial);

    // Auto-check if overs are completed for this inning
    if (!currentMatch.settings.isUnlimitedOvers && totalBalls >= currentMatch.settings.overs * 6) {
      triggerAutomaticInningEndOrMatchEnd(updatedInning);
      return;
    }

    // Trigger bowler change screen if over finished
    if (isOverComplete) {
      setShowBowlerChangeModal(true);
    }

    checkMatchInningTargetStatus();
  };

  // Wide delivery execution code
  const handleScoreWide = () => {
    playClickSound();
    if (!currentMatch) return;
    const inning = getActiveInning();
    const bowler = currentMatch.currentBowler;
    if (!bowler) return;

    pushToHistory();

    const penaltyRuns = 1 + extraRunsInput; // 1 for wide + added runs
    const nextBowlers = { ...inning.bowlers };
    const bowlStats = { ...nextBowlers[bowler] };
    bowlStats.runs += penaltyRuns;
    nextBowlers[bowler] = bowlStats;

    const nextOverLog = [...inning.currentOverLog];
    nextOverLog.push({
      type: 'wide',
      runs: penaltyRuns,
      displayText: `Wd+${extraRunsInput}`
    });

    const nextExtras = {
      ...inning.extras,
      wides: inning.extras.wides + penaltyRuns
    };

    // Wide ball doesn't count towards over balls, but rotates strike if running was odd
    let nextStriker = currentMatch.currentStriker;
    let nextNonStriker = currentMatch.currentNonStriker;
    if (currentMatch.settings.isTwoBatsmenMode && !!currentMatch.currentNonStriker && extraRunsInput % 2 !== 0 && extraBoundaryOption === 'running') {
      const temp = nextStriker;
      nextStriker = nextNonStriker;
      nextNonStriker = temp;
    }

    const updatedInning: InningState = {
      ...inning,
      runs: inning.runs + penaltyRuns,
      extras: nextExtras,
      bowlers: nextBowlers,
      currentOverLog: nextOverLog
    };

    setShowWideModal(false);
    setExtraRunsInput(0);
    updateActiveInning(updatedInning, { currentStriker: nextStriker, currentNonStriker: nextNonStriker });
    checkMatchInningTargetStatus();
  };

  // No-Ball delivery code
  const handleScoreNoBall = () => {
    playClickSound();
    if (!currentMatch) return;
    const inning = getActiveInning();
    const striker = currentMatch.currentStriker;
    const bowler = currentMatch.currentBowler;
    if (!bowler || !striker) return;

    pushToHistory();

    const penaltyRuns = 1 + extraRunsInput; // 1 for noball + added runs
    const nextBatsmen = { ...inning.batsmen };
    const nextBowlers = { ...inning.bowlers };

    // In modern cricket, runs off the bat on a noball are accredited to the batsman
    const bStats = { ...nextBatsmen[striker] };
    bStats.runs += extraRunsInput;
    bStats.balls += 0; 
    nextBatsmen[striker] = bStats;

    const bowlStats = { ...nextBowlers[bowler] };
    bowlStats.runs += penaltyRuns; 
    nextBowlers[bowler] = bowlStats;

    const nextOverLog = [...inning.currentOverLog];
    nextOverLog.push({
      type: 'noball',
      runs: penaltyRuns,
      displayText: `Nb+${extraRunsInput}`
    });

    const nextExtras = {
      ...inning.extras,
      noballs: inning.extras.noballs + 1 
    };

    let nextStriker = currentMatch.currentStriker;
    let nextNonStriker = currentMatch.currentNonStriker;
    if (currentMatch.settings.isTwoBatsmenMode && !!currentMatch.currentNonStriker && extraRunsInput % 2 !== 0) {
      const temp = nextStriker;
      nextStriker = nextNonStriker;
      nextNonStriker = temp;
    }

    const updatedInning: InningState = {
      ...inning,
      runs: inning.runs + penaltyRuns,
      batsmen: nextBatsmen,
      bowlers: nextBowlers,
      extras: nextExtras,
      currentOverLog: nextOverLog
    };

    setShowNoBallModal(false);
    setExtraRunsInput(0);
    updateActiveInning(updatedInning, { 
      currentStriker: nextStriker, 
      currentNonStriker: nextNonStriker,
      isFreeHit: true 
    });
    checkMatchInningTargetStatus();
  };

  // Leg-by delivery code
  const handleScoreLegBy = () => {
    playClickSound();
    if (!currentMatch) return;
    const inning = getActiveInning();
    const striker = currentMatch.currentStriker;
    const bowler = currentMatch.currentBowler;
    if (!bowler || !striker) return;

    pushToHistory();

    const nextBatsmen = { ...inning.batsmen };
    const nextBowlers = { ...inning.bowlers };

    const bStats = { ...nextBatsmen[striker] };
    bStats.balls += 1;
    nextBatsmen[striker] = bStats;

    const bowlStats = { ...nextBowlers[bowler] };
    bowlStats.balls += 1;
    
    let isOverComplete = false;
    const nextOverLog = [...inning.currentOverLog];
    nextOverLog.push({
      type: 'legby',
      runs: extraRunsInput,
      displayText: `Lb+${extraRunsInput}`
    });

    let totalBalls = inning.balls + 1;
    if (bowlStats.balls === 6) {
      bowlStats.overs += 1;
      bowlStats.balls = 0;
      isOverComplete = true;
    }
    nextBowlers[bowler] = bowlStats;

    const nextExtras = {
      ...inning.extras,
      legbys: inning.extras.legbys + extraRunsInput
    };

    let nextStriker = currentMatch.currentStriker;
    let nextNonStriker = currentMatch.currentNonStriker;
    const canRotateLb = currentMatch.settings.isTwoBatsmenMode && !!currentMatch.currentNonStriker;
    if (canRotateLb && extraRunsInput % 2 !== 0) {
      const temp = nextStriker;
      nextStriker = nextNonStriker;
      nextNonStriker = temp;
    }

    if (isOverComplete && canRotateLb) {
      const temp = nextStriker;
      nextStriker = nextNonStriker;
      nextNonStriker = temp;
    }

    const updatedInning: InningState = {
      ...inning,
      runs: inning.runs + extraRunsInput,
      batsmen: nextBatsmen,
      bowlers: nextBowlers,
      extras: nextExtras,
      balls: totalBalls,
      currentOverLog: isOverComplete ? [] : nextOverLog,
      oversLog: isOverComplete ? [...inning.oversLog, nextOverLog] : inning.oversLog
    };

    setShowLegByModal(false);
    setExtraRunsInput(0);
    updateActiveInning(updatedInning, { 
      currentStriker: nextStriker, 
      currentNonStriker: nextNonStriker,
      isFreeHit: false
    });

    // Auto-check if overs are completed for this inning
    if (!currentMatch.settings.isUnlimitedOvers && totalBalls >= currentMatch.settings.overs * 6) {
      triggerAutomaticInningEndOrMatchEnd(updatedInning);
      return;
    }

    if (isOverComplete) {
      setShowBowlerChangeModal(true);
    }
    checkMatchInningTargetStatus();
  };

  // Custom run handler modal submit
  const handleScoreCustomRuns = () => {
    playClickSound();
    if (!currentMatch) return;
    const inning = getActiveInning();
    const striker = currentMatch.currentStriker;
    const bowler = currentMatch.currentBowler;
    if (!striker || !bowler) return;

    pushToHistory();

    const nextBatsmen = { ...inning.batsmen };
    const nextBowlers = { ...inning.bowlers };

    // Update batsman / bowler stats depending on customRunType
    if (customRunType === 'normal') {
      const bStats = { ...nextBatsmen[striker] };
      bStats.runs += customRunsValue;
      bStats.balls += 1;
      if (customRunsValue === 4 || customIsBoundary) bStats.fours += 1;
      nextBatsmen[striker] = bStats;

      const bowlStats = { ...nextBowlers[bowler] };
      bowlStats.balls += 1;
      bowlStats.runs += customRunsValue;
      nextBowlers[bowler] = bowlStats;
    } else if (customRunType === 'wide') {
      const bowlStats = { ...nextBowlers[bowler] };
      bowlStats.runs += (customRunsValue + 1);
      nextBowlers[bowler] = bowlStats;
    } else if (customRunType === 'noball') {
      const bStats = { ...nextBatsmen[striker] };
      bStats.runs += customRunsValue;
      nextBatsmen[striker] = bStats;

      const bowlStats = { ...nextBowlers[bowler] };
      bowlStats.runs += (customRunsValue + 1);
      nextBowlers[bowler] = bowlStats;
    } else { // legby
      const bStats = { ...nextBatsmen[striker] };
      bStats.balls += 1;
      nextBatsmen[striker] = bStats;

      const bowlStats = { ...nextBowlers[bowler] };
      bowlStats.balls += 1;
      nextBowlers[bowler] = bowlStats;
    }

    let isOverComplete = false;
    let totalBalls = inning.balls;
    if (customRunType === 'normal' || customRunType === 'legby') {
      totalBalls += 1;
      const bowlStats = { ...nextBowlers[bowler] };
      if (bowlStats.balls === 5) {
        bowlStats.overs += 1;
        bowlStats.balls = 0;
        isOverComplete = true;
      } else {
        bowlStats.balls += 1;
      }
      nextBowlers[bowler] = bowlStats;
    }

    const nextOverLog = [...inning.currentOverLog];
    const prefix = customRunType !== 'normal' ? customRunType.substring(0, 2).toUpperCase() + '+' : '';
    nextOverLog.push({
      type: customRunType,
      runs: customRunsValue,
      displayText: `${prefix}${customRunsValue}`
    });

    const nextExtras = { ...inning.extras };
    if (customRunType === 'wide') nextExtras.wides += (customRunsValue + 1);
    if (customRunType === 'noball') nextExtras.noballs += 1;
    if (customRunType === 'legby') nextExtras.legbys += customRunsValue;

    const updatedInning: InningState = {
      ...inning,
      runs: inning.runs + customRunsValue + (customRunType === 'wide' || customRunType === 'noball' ? 1 : 0),
      balls: totalBalls,
      batsmen: nextBatsmen,
      bowlers: nextBowlers,
      extras: nextExtras,
      currentOverLog: isOverComplete ? [] : nextOverLog,
      oversLog: isOverComplete ? [...inning.oversLog, nextOverLog] : inning.oversLog
    };

    setShowCustomRunsModal(false);
    updateActiveInning(updatedInning, {
      isFreeHit: customRunType === 'noball' ? true : false
    });

    // Auto-check if overs are completed for this inning
    if (!currentMatch.settings.isUnlimitedOvers && totalBalls >= currentMatch.settings.overs * 6) {
      triggerAutomaticInningEndOrMatchEnd(updatedInning);
      return;
    }

    if (isOverComplete) {
      setShowBowlerChangeModal(true);
    }
    checkMatchInningTargetStatus();
  };

  // Triggering Out dialog
  const triggerOutFlow = () => {
    playClickSound();
    if (!currentMatch) return;
    setOutFielder('');
    setShowOutModal(true);
  };

  // Processing Out result
  const handleConfirmOut = () => {
    playClickSound();
    if (!currentMatch) return;
    const inning = getActiveInning();
    const bowler = currentMatch.currentBowler;
    const striker = currentMatch.currentStriker;

    if (!striker || !bowler) return;

    // Check Free Hit rules: only run out is permitted
    if (currentMatch.isFreeHit && outType !== 'run_out') {
      alert("Batsman is on FREE HIT! Can only be out via Run Out. Please select another mode or proceed with runs.");
      return;
    }

    pushToHistory();

    const nextBatsmen = { ...inning.batsmen };
    const nextBowlers = { ...inning.bowlers };

    // Update batsman status
    const bStats = { ...nextBatsmen[striker] };
    bStats.balls += 1;
    bStats.howOut = outType === 'bowled' ? 'Bowled' : 
                    outType === 'caught' ? `Caught (${outFielder || 'Fielder'})` :
                    outType === 'stumped' ? `Stumped (${outFielder || 'Wicketkeeper'})` :
                    outType === 'lbw' ? 'LBW' : 
                    outType === 'retired_out' ? 'Retired Out' : `Run Out (${outFielder})`;
    bStats.bowledBy = outType !== 'run_out' && outType !== 'retired_out' ? bowler : undefined;
    nextBatsmen[striker] = bStats;

    // Update bowler status
    const bowlStats = { ...nextBowlers[bowler] };
    bowlStats.balls += 1;
    if (outType !== 'run_out' && outType !== 'retired_out') {
      bowlStats.wickets += 1;
    }
    
    let isOverComplete = false;
    const nextOverLog = [...inning.currentOverLog];
    nextOverLog.push({
      type: 'wicket',
      runs: 0,
      displayText: 'W'
    });

    let totalBalls = inning.balls + 1;
    if (bowlStats.balls === 6) {
      bowlStats.overs += 1;
      bowlStats.balls = 0;
      isOverComplete = true;
    }
    nextBowlers[bowler] = bowlStats;

    const totalWickets = inning.wickets + 1;
    
    // Check if team is ALL OUT based on player limits
    const totalPlayersInTeam = getBattingPlayersForInning(currentMatch).length;

    // Professional rule or Last can bat rule
    let isAllOut = false;
    if (currentMatch.settings.isTwoBatsmenMode) {
      if (!currentMatch.settings.lastCanBat) {
        // if only 1 batsman left un-out, they can't bat alone, so all out
        if (totalWickets >= totalPlayersInTeam - 1) {
          isAllOut = true;
        }
      } else {
        // last batsman can continue alone
        if (totalWickets >= totalPlayersInTeam) {
          isAllOut = true;
        }
      }
    } else {
      // 1 batsman mode: stays until all players are out
      if (totalWickets >= totalPlayersInTeam) {
        isAllOut = true;
      }
    }

    let updatedInning: InningState = {
      ...inning,
      wickets: totalWickets,
      balls: totalBalls,
      batsmen: nextBatsmen,
      bowlers: nextBowlers,
      currentOverLog: isOverComplete ? [] : nextOverLog,
      oversLog: isOverComplete ? [...inning.oversLog, nextOverLog] : inning.oversLog
    };

    setShowOutModal(false);

    // Look up remaining batters. Do not auto-pick. Ask scorer from a list.
    const availablePlayers = getBattingPlayersForInning(currentMatch);
    const remainingToBat = availablePlayers.filter(p => !nextBatsmen[p]?.howOut && p !== striker && p !== currentMatch.currentNonStriker);
    
    if (isAllOut) {
      // Team is officially all out based on settings
      updateActiveInning(updatedInning, { isFreeHit: false });
      triggerAutomaticInningEndOrMatchEnd(updatedInning);
      return;
    }

    if (remainingToBat.length === 0) {
      // No more players left in the dugout to come in.
      // If we are in 2-batsmen mode and lastCanBat is true, the non-striker can continue alone.
      if (currentMatch.settings.isTwoBatsmenMode && currentMatch.settings.lastCanBat && currentMatch.currentNonStriker) {
        // The last batsman on pitch continues as striker.
        const lastBatsmanOnPitch = currentMatch.currentNonStriker;
        updateActiveInning(updatedInning, {
          currentStriker: lastBatsmanOnPitch,
          currentNonStriker: undefined,
          isFreeHit: false
        });
        alert(`${lastBatsmanOnPitch} will now bat alone as the last player.`);
        if (isOverComplete) setShowBowlerChangeModal(true);
        return;
      }

      // Otherwise, the team is out of players who can bat.
      updateActiveInning(updatedInning, { isFreeHit: false });
      triggerAutomaticInningEndOrMatchEnd(updatedInning);
      return;
    }

    let nextNonStriker = currentMatch.currentNonStriker;

    updateActiveInning(updatedInning, {
      currentStriker: undefined,
      currentNonStriker: nextNonStriker,
      isFreeHit: false
    });

    if (isOverComplete) {
      setOpenBowlerAfterBatsman(true);
    }

    setShowNextBatsmanModal(true);

    checkMatchInningTargetStatus();
  };

  // Automatically check if 2nd inning team passed the 1st inning score target
  const checkMatchInningTargetStatus = () => {
    if (!currentMatch || currentMatch.currentInningIndex !== 2 || !currentMatch.firstInning) return;
    const firstInningRuns = currentMatch.firstInning.runs;
    const secondInning = getActiveInning();
    
    if (secondInning.runs > firstInningRuns) {
      // Second team won the match!
      finishMatchWithWinner(secondInning.battingTeam, `${secondInning.battingTeam} won by ${thisInningRemainingWickets()} wickets!`);
    }
  };

  const thisInningRemainingWickets = (): number => {
    if (!currentMatch) return 0;
    const inning = getActiveInning();
    const availablePlayers = getBattingPlayersForInning(currentMatch);
    return availablePlayers.length - inning.wickets;
  };

  const triggerAutomaticInningEndOrMatchEnd = async (finalInningState: InningState) => {
    if (!currentMatch) return;

    // If overs are completed, show nice confirmation modal instead of alert
    if (!currentMatch.settings.isUnlimitedOvers && finalInningState.balls >= currentMatch.settings.overs * 6) {
      setPendingInningEndState(finalInningState);
      setShowInningEndModal(true);
      return; // Wait for user decision
    }
    
    if (currentMatch.currentInningIndex === 1) {
      // Transition from 1st Inning to 2nd Inning
      playSuccessSound();
      
      const nextBattingTeam = finalInningState.fieldingTeam;
      const nextFieldingTeam = finalInningState.battingTeam;
      
      const nextBattingPlayers = nextBattingTeam === currentMatch.teamA ? currentMatch.teamAPlayers : currentMatch.teamBPlayers;
      const nextFieldingPlayers = nextFieldingTeam === currentMatch.teamA ? currentMatch.teamAPlayers : currentMatch.teamBPlayers;

      const initialBatsmenMap: Record<string, PlayerMatchScore> = {};
      nextBattingPlayers.forEach(p => {
        initialBatsmenMap[p] = { name: p, runs: 0, balls: 0, fours: 0, sixes: 0 };
      });

      const initialBowlersMap: Record<string, BowlerMatchScore> = {};
      nextFieldingPlayers.forEach(p => {
        initialBowlersMap[p] = { name: p, overs: 0, balls: 0, maidens: 0, runs: 0, wickets: 0 };
      });

      const secondInningInitial: InningState = {
        battingTeam: nextBattingTeam,
        fieldingTeam: nextFieldingTeam,
        runs: 0,
        wickets: 0,
        balls: 0,
        extras: { wides: 0, noballs: 0, legbys: 0, others: 0 },
        batsmen: initialBatsmenMap,
        bowlers: initialBowlersMap,
        oversLog: [],
        currentOverLog: []
      };

      const updatedMatch: MatchData = {
        ...currentMatch,
        currentInningIndex: 2,
        firstInning: finalInningState,
        secondInning: secondInningInitial,
        currentStriker: undefined,
        currentNonStriker: undefined,
        currentBowler: undefined,
        isFreeHit: false
      };

      pushToHistory();
      setCurrentMatch(updatedMatch);
      await saveMatch(updatedMatch);
      getMatches().then(setAllMatches);
      setCurrentPage('start_second_inning');
    } else {
      // 2nd inning ended -> compute winner
      const firstInningRuns = currentMatch.firstInning!.runs;
      const secondInningRuns = finalInningState.runs;
      
      if (secondInningRuns > firstInningRuns) {
        const battingPlayers = finalInningState.battingTeam === currentMatch.teamA ? currentMatch.teamAPlayers : currentMatch.teamBPlayers;
        const wicketsLeft = Math.max(0, battingPlayers.length - finalInningState.wickets);
        finishMatchWithWinner(finalInningState.battingTeam, `${finalInningState.battingTeam} won by ${wicketsLeft} wickets!`);
      } else if (secondInningRuns < firstInningRuns) {
        finishMatchWithWinner(currentMatch.firstInning!.battingTeam, `${currentMatch.firstInning!.battingTeam} won by ${firstInningRuns - secondInningRuns} runs!`);
      } else {
        finishMatchWithWinner('draw', 'Match Tied!');
      }
    }
  };

  const finishMatchWithWinner = async (winnerTeam: string, desc: string, matchOverride?: MatchData) => {
    const matchToFinish = matchOverride || currentMatch;
    if (!matchToFinish) return;
    
    // Save ORIGINAL match data only — no random guesses, no per-ball duplicates.
    // Pull final batsman/bowler stats from the actual completed innings.
    const allMatchPlayers = new Set<string>([
      ...matchToFinish.teamAPlayers,
      ...matchToFinish.teamBPlayers
    ]);

    const updateCareerStatsForInning = async (inn: InningState | undefined) => {
      if (!inn) return;
      for (const name of Object.keys(inn.batsmen)) {
        const b = inn.batsmen[name];
        if (b.runs > 0 || b.balls > 0) {
          await updatePlayerStatsAfterMatch(name, {
            runs: b.runs, ballsPlayed: b.balls, fours: b.fours, sixes: b.sixes
          });
        }
      }
      for (const name of Object.keys(inn.bowlers)) {
        const bowl = inn.bowlers[name];
        if (bowl.overs > 0 || bowl.balls > 0 || bowl.wickets > 0) {
          await updatePlayerStatsAfterMatch(name, {
            wickets: bowl.wickets, ballsThrown: (bowl.overs * 6) + bowl.balls
          });
        }
      }
    };

    await updateCareerStatsForInning(matchToFinish.firstInning);
    await updateCareerStatsForInning(matchToFinish.secondInning);

    for (const name of allMatchPlayers) {
      await updatePlayerStatsAfterMatch(name, { matchPlayed: 1 });
    }

    const finalized: MatchData = {
      ...matchToFinish,
      status: 'completed',
      winner: winnerTeam,
      resultDescription: desc
    };

    pushToHistory();
    setCurrentMatch(finalized);
    await saveMatch(finalized);
    getMatches().then(setAllMatches);
    getPlayers().then(setAllPlayers);
    setCurrentPage('victory');
  };


  // ==================== THREE DOTS ADVANCED OPTIONS (8 REQUIRED) ====================

  // 0 change strike
  const menuChangeStrike = () => {
    playClickSound();
    if (!currentMatch) return;
    if (!currentMatch.settings.isTwoBatsmenMode) {
      alert("Strike rotation can only be processed under Two Batsmen Mode.");
      return;
    }
    if (!currentMatch.currentNonStriker) {
      alert("Only one batsman is on the pitch — strike cannot be rotated.");
      setShowThreeDotsMenu(false);
      return;
    }
    rotateStrike();
    setShowThreeDotsMenu(false);
  };

  // 1 add player mid-match
  const menuOpenAddPlayer = () => {
    playClickSound();
    setMidMatchPlayerName('');
    setShowAddPlayerModal(true);
    setShowThreeDotsMenu(false);
  };

  const handleConfirmMidMatchAddPlayer = async () => {
    playClickSound();
    if (midMatchPlayerName.trim().length < 6) {
      alert("Player name must be at least 6 letters long.");
      return;
    }
    if (!currentMatch) return;

    const allPlayersNow = await getPlayers();
    const existingPlayer = allPlayersNow.find(p => p.name.toLowerCase() === midMatchPlayerName.trim().toLowerCase());
    if (!existingPlayer) {
      alert('Only existing player accounts can be added during a match.');
      return;
    }
    const playerName = existingPlayer.name;
    pushToHistory();

    let updatedMatch = { ...currentMatch };
    if (midMatchTeam === 'A') {
      if (!updatedMatch.teamAPlayers.includes(playerName)) {
        updatedMatch.teamAPlayers.push(playerName);
       await addPlayerToTeamRecord(playerName, updatedMatch.teamA);
      }
    } else {
      if (!updatedMatch.teamBPlayers.includes(playerName)) {
        updatedMatch.teamBPlayers.push(playerName);
        await addPlayerToTeamRecord(playerName, updatedMatch.teamB);
      }
    }

    // Insert slot inside current innings score map too
    if (updatedMatch.firstInning) {
      if (!updatedMatch.firstInning.batsmen[playerName]) {
        updatedMatch.firstInning.batsmen[playerName] = { name: playerName, runs: 0, balls: 0, fours: 0, sixes: 0 };
      }
      if (!updatedMatch.firstInning.bowlers[playerName]) {
        updatedMatch.firstInning.bowlers[playerName] = { name: playerName, overs: 0, balls: 0, maidens: 0, runs: 0, wickets: 0 };
      }
    }
    if (updatedMatch.secondInning) {
      if (!updatedMatch.secondInning.batsmen[playerName]) {
        updatedMatch.secondInning.batsmen[playerName] = { name: playerName, runs: 0, balls: 0, fours: 0, sixes: 0 };
      }
      if (!updatedMatch.secondInning.bowlers[playerName]) {
        updatedMatch.secondInning.bowlers[playerName] = { name: playerName, overs: 0, balls: 0, maidens: 0, runs: 0, wickets: 0 };
      }
    }

    setCurrentMatch(updatedMatch);
    await saveMatch(updatedMatch);
    getPlayers().then(setAllPlayers);
    getMatches().then(setAllMatches);
    setShowAddPlayerModal(false);
    alert(`Successfully added ${playerName} to Team ${midMatchTeam === 'A' ? 'A' : 'B'} permanently.`);
  };

  // 2 end over (make remaining balls dots)
  const menuEndOverDots = () => {
    playClickSound();
    if (!currentMatch) return;
    const inning = getActiveInning();
    const bowler = currentMatch.currentBowler;
    if (!bowler) return;

    pushToHistory();

    const nextBowlers = { ...inning.bowlers };
    const bowlStats = { ...nextBowlers[bowler] };
    
    // Remaining balls required to fill up to 6
    const remainingBalls = 6 - bowlStats.balls;
    if (remainingBalls > 0 && remainingBalls < 6) {
      bowlStats.overs += 1;
      bowlStats.balls = 0;
      nextBowlers[bowler] = bowlStats;

      const nextOverLog = [...inning.currentOverLog];
      for (let i = 0; i < remainingBalls; i++) {
        nextOverLog.push({ type: 'normal', runs: 0, displayText: '.' });
      }

      const updatedInning: InningState = {
        ...inning,
        balls: inning.balls + remainingBalls,
        bowlers: nextBowlers,
        currentOverLog: [],
        oversLog: [...inning.oversLog, nextOverLog]
      };

      // rotate strike if requested on complete (skip if solo batsman)
      let nextStriker = currentMatch.currentStriker;
      let nextNonStriker = currentMatch.currentNonStriker;
      if (currentMatch.settings.isTwoBatsmenMode && !!currentMatch.currentNonStriker) {
        const temp = nextStriker;
        nextStriker = nextNonStriker;
        nextNonStriker = temp;
      }

      updateActiveInning(updatedInning, { currentStriker: nextStriker, currentNonStriker: nextNonStriker });
      setShowThreeDotsMenu(false);
      setShowBowlerChangeModal(true);
      alert("Over ended early via 3-dots manual setting. Converted remaining deliveries into dots.");
    } else {
      alert("Current over has no active balls recorded yet or is already completed.");
    }
  };

  // 3 timeout batsman (substituted/retired temporarily)
  const menuTimeoutBatsman = () => {
    playClickSound();
    if (!currentMatch || !currentMatch.currentStriker) return;
    
    pushToHistory();
    alert(`Batsman ${currentMatch.currentStriker} is timed out/withdrawn for tactical substitute.`);
    
    // Pick another batsman who hasn't batted yet
    const inning = getActiveInning();
    const availablePlayers = currentMatch.currentInningIndex === 1
      ? (currentMatch.tossChoice === 'bat' ? (currentMatch.tossWinner === currentMatch.teamA ? currentMatch.teamAPlayers : currentMatch.teamBPlayers) : (currentMatch.tossWinner === currentMatch.teamA ? currentMatch.teamBPlayers : currentMatch.teamAPlayers))
      : (currentMatch.tossChoice === 'field' ? (currentMatch.tossWinner === currentMatch.teamA ? currentMatch.teamAPlayers : currentMatch.teamBPlayers) : (currentMatch.tossWinner === currentMatch.teamA ? currentMatch.teamBPlayers : currentMatch.teamAPlayers));

    const remainingToBat = availablePlayers.filter(p => !inning.batsmen[p]?.howOut && p !== currentMatch.currentStriker && p !== currentMatch.currentNonStriker);
    
    if (remainingToBat.length > 0) {
      setCurrentMatch({
        ...currentMatch,
        currentStriker: remainingToBat[0]
      });
    } else {
      alert("No other available substitute player in the list.");
    }
    setShowThreeDotsMenu(false);
  };

  // 4 permanent out batsman (retired out without specific reason)
  const menuPermanentOutBatsman = () => {
    playClickSound();
    if (!currentMatch || !currentMatch.currentStriker) return;
    
    pushToHistory();
    const inning = getActiveInning();
    const striker = currentMatch.currentStriker;
    
    const nextBatsmen = { ...inning.batsmen };
    const bStats = { ...nextBatsmen[striker] };
    bStats.howOut = "Retired Out (Forced Permanent)";
    nextBatsmen[striker] = bStats;

    const totalWickets = inning.wickets + 1;
    const updatedInning = {
      ...inning,
      wickets: totalWickets,
      batsmen: nextBatsmen
    };

    // Find next
    const availablePlayers = currentMatch.currentInningIndex === 1
      ? (currentMatch.tossChoice === 'bat' ? (currentMatch.tossWinner === currentMatch.teamA ? currentMatch.teamAPlayers : currentMatch.teamBPlayers) : (currentMatch.tossWinner === currentMatch.teamA ? currentMatch.teamBPlayers : currentMatch.teamAPlayers))
      : (currentMatch.tossChoice === 'field' ? (currentMatch.tossWinner === currentMatch.teamA ? currentMatch.teamAPlayers : currentMatch.teamBPlayers) : (currentMatch.tossWinner === currentMatch.teamA ? currentMatch.teamBPlayers : currentMatch.teamAPlayers));

    const remainingToBat = availablePlayers.filter(p => !nextBatsmen[p]?.howOut && p !== striker && p !== currentMatch.currentNonStriker);

    setShowThreeDotsMenu(false);

    if (remainingToBat.length === 0) {
      updateActiveInning(updatedInning);
      triggerAutomaticInningEndOrMatchEnd(updatedInning);
    } else {
      updateActiveInning(updatedInning, {
        currentStriker: remainingToBat[0]
      });
      alert(`Batsman ${striker} permanently retired out.`);
    }
  };

  // 5 mini over (change bowler in half over)
  const menuMiniOverChangeBowler = () => {
    playClickSound();
    setShowBowlerChangeModal(true);
    setShowThreeDotsMenu(false);
  };

  // 6 end inning
  const menuEndInningForce = () => {
    playClickSound();
    setShowEndInningConfirm(true);
    setShowThreeDotsMenu(false);
  };

  const handleConfirmForceEndInning = () => {
    playClickSound();
    setShowEndInningConfirm(false);
    if (!currentMatch) return;
    const inning = getActiveInning();
    triggerAutomaticInningEndOrMatchEnd(inning);
  };

  // 7 end match
  const menuEndMatchForce = () => {
    playClickSound();
    setShowEndMatchManualModal(true);
    setShowThreeDotsMenu(false);
  };

  const handleConfirmForceEndMatchManual = (winnerType: 'A' | 'B' | 'no_result') => {
    playClickSound();
    setShowEndMatchManualModal(false);
    if (!currentMatch) return;

    let textDesc = "Match ended by match referee.";
    let winnerString = 'no_result';
    if (winnerType === 'A') {
      winnerString = currentMatch.teamA;
      textDesc = `${currentMatch.teamA} declared winner via administrative option.`;
    } else if (winnerType === 'B') {
      winnerString = currentMatch.teamB;
      textDesc = `${currentMatch.teamB} declared winner via administrative option.`;
    } else {
      textDesc = "Match ended with No Result decision.";
    }

    finishMatchWithWinner(winnerString, textDesc);
  };


  // ==================== AUTHENTICATED RESUMPTION CODE ====================

  const handleOpenResumeLiveMatchAuth = (match: MatchData) => {
    playClickSound();
    setSelectedLiveMatchToAuth(match);
    setResumeMatchId(match.id || '');
    setResumePassword('');
    setResumeError('');
    setShowResumeAuthModal(true);
  };

  // Open match in spectator live view mode
  const handleOpenLiveView = (match: MatchData) => {
    playClickSound();
    setViewMatch(match);
    setCurrentPage('live_view');
  };

  const handleVerifyAndResumeScoring = () => {
    playClickSound();
    if (!selectedLiveMatchToAuth) return;
    
    if (resumePassword.trim().toUpperCase() === selectedLiveMatchToAuth.password.trim().toUpperCase()) {
      // Auth success
      playSuccessSound();
      setCurrentMatch(selectedLiveMatchToAuth);
      setShowResumeAuthModal(false);
      setCurrentPage('scoring');
    } else {
      setResumeError('Incorrect 6-letter security password! Please check carefully.');
    }
  };

  // Copy to clipboard fallback tool
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  // ==================== SWIPE TO GO BACK LOGIC ====================
  const goBack = React.useCallback(() => {
    playClickSound();
    if (currentPage === 'live_view') {
      setViewMatch(null); navigateWithSound('show_matches');
    } else if (currentPage === 'show_matches' || currentPage === 'stats') {
      navigateWithSound('home');
    } else if (currentPage === 'player_login' || currentPage === 'player_profile') {
      navigateWithSound('home');
    } else if (currentPage === 'victory') {
      navigateWithSound('show_matches');
    } else if (currentPage === 'setup_teams') { navigateWithSound('home'); }
    else if (currentPage === 'setup_players') { navigateWithSound('setup_teams'); }
    else if (currentPage === 'setup_settings_1') { navigateWithSound('setup_players'); }
    else if (currentPage === 'setup_settings_2') { navigateWithSound('setup_settings_1'); }
    else if (currentPage === 'setup_toss') { navigateWithSound('setup_settings_2'); }
    else if (currentPage === 'start_second_inning') { navigateWithSound('scoring'); }
    else if (currentPage === 'select_striker') {
      currentMatch?.currentInningIndex === 2
        ? navigateWithSound('start_second_inning')
        : navigateWithSound('setup_toss');
    }
    else if (currentPage === 'select_non_striker') { navigateWithSound('select_striker'); }
    else if (currentPage === 'select_bowler') {
      currentMatch?.settings.isTwoBatsmenMode
        ? navigateWithSound('select_non_striker')
        : navigateWithSound('select_striker');
    } else if (currentPage === 'confirm_match') { navigateWithSound('select_bowler'); }
    // scoring page: swipe back shows the cancel prompt
    else if (currentPage === 'scoring') { handleCancelMatch(); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, currentMatch]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
    touchStartYRef.current = e.touches[0].clientY;
    setSwipeHint(0);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const dx = e.touches[0].clientX - touchStartXRef.current;
    const dy = e.touches[0].clientY - touchStartYRef.current;
    // Only track horizontal swipe (not scrolling)
    if (Math.abs(dx) > Math.abs(dy) && dx > 0) {
      const ratio = Math.min(dx / 100, 1);
      setSwipeHint(ratio);
    } else {
      setSwipeHint(0);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStartXRef.current;
    const dy = e.changedTouches[0].clientY - touchStartYRef.current;
    setSwipeHint(0);
    // Fire if clearly rightward swipe (not a vertical scroll)
    if (dx > 70 && Math.abs(dy) < 60 && currentPage !== 'intro' && currentPage !== 'home') {
      goBack();
    }
  };


  return (
    <div 
      className="min-h-screen bg-[var(--page-bg)] text-[var(--text-color)] font-sans flex flex-col items-center justify-start p-2 sm:p-4 selection:bg-[var(--primary)] selection:text-[var(--primary-text)]"
      data-theme={theme}
    >
      
      {/* Maximum Mobile Frame Shell Simulator container */}
      <div 
        className="w-full max-w-md bg-[var(--page-bg)] rounded-3xl overflow-hidden shadow-2xl shadow-black border border-slate-700/60 flex flex-col min-h-[780px] relative"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Swipe-back edge indicator — visible on all non-home pages */}
        {currentPage !== 'intro' && currentPage !== 'home' && (
          <div
            className="absolute left-0 top-0 bottom-0 z-[99] pointer-events-none"
            style={{ width: `${Math.max(swipeHint * 56, 4)}px` }}
          >
            {/* Glow strip */}
            <div
              className="absolute inset-0 bg-blue-500/40 rounded-l-3xl"
              style={{ opacity: swipeHint }}
            />
            {/* Arrow icon appears as you pull */}
            {swipeHint > 0.15 && (
              <div
                className="absolute top-1/2 -translate-y-1/2 flex items-center justify-center"
                style={{ left: `${swipeHint * 14}px`, opacity: swipeHint }}
              >
                <div className="bg-blue-600/80 rounded-full p-1.5 shadow-lg shadow-blue-900/60">
                  <ArrowLeft className="w-5 h-5 text-white" />
                </div>
              </div>
            )}
          </div>
        )}
        
        {/* APP GLOBAL TOPHEADER */}
        {currentPage !== 'intro' && (
          <header className="bg-[var(--header-bg)] p-3 flex items-center justify-between border-b border-white/20 sticky top-0 z-40 shadow-md">
            <div className="flex items-center gap-2">
              <button 
                onClick={() => {
                  if (currentPage === 'scoring') {
                    handleCancelMatch();
                  } else if (currentPage === 'setup_players') {
                    navigateWithSound('setup_teams');
                  } else if (currentPage === 'setup_settings_1') {
                    navigateWithSound('setup_players');
                  } else if (currentPage === 'setup_settings_2') {
                    navigateWithSound('setup_settings_1');
                  } else if (currentPage === 'setup_toss') {
                    navigateWithSound('setup_settings_2');
                  } else if (currentPage === 'start_second_inning') {
                    navigateWithSound('scoring');
                  } else if (currentPage === 'select_striker') {
                    if (currentMatch?.currentInningIndex === 2) {
                      navigateWithSound('start_second_inning');
                    } else {
                      navigateWithSound('setup_toss');
                    }
                  } else if (currentPage === 'select_non_striker') {
                    navigateWithSound('select_striker');
                  } else if (currentPage === 'select_bowler') {
                    if (currentMatch?.settings.isTwoBatsmenMode) {
                      navigateWithSound('select_non_striker');
                    } else {
                      navigateWithSound('select_striker');
                    }
                  } else if (currentPage === 'confirm_match') {
                    navigateWithSound('select_bowler');
                  } else {
                    navigateWithSound('home');
                  }
                }}
                className="p-1.5 hover:bg-white/10 rounded-full transition text-blue-200"
                title="Go back / Edit previous"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              
              <div className="flex flex-col">
                <span className="text-xs tracking-wider text-blue-300 font-bold uppercase">PRO SCORER</span>
                <span className="text-sm font-black text-white -mt-0.5">
                  {currentPage === 'home' && 'Dashboard'}
                  {currentPage.startsWith('setup_') && 'Match Config'}
                  {currentPage === 'start_second_inning' && 'Second Inning'}
                  {currentPage === 'scoring' && 'Live Scoring Panel'}
                  {currentPage === 'show_matches' && 'Scorecards'}
                  {currentPage === 'stats' && 'Player Stats'}
                  {currentPage === 'player_login' && 'Player Login'}
                  {currentPage === 'player_profile' && 'My Profile'}
                  {currentPage === 'victory' && 'Match Results'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {currentPage === 'scoring' && currentMatch && (
                <div 
                  onClick={() => copyToClipboard(currentMatch.id)}
                  className="bg-slate-900/50 text-[10px] text-blue-300 px-2 py-1 rounded border border-blue-500/30 font-mono cursor-pointer flex items-center gap-1 mr-1 active:scale-95"
                  title="Click to copy Match ID"
                >
                  <span>ID: {currentMatch.id}</span>
                  {copiedId ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                </div>
              )}

              <button 
                onClick={() => {
                  if (currentPage === 'scoring' || currentPage.startsWith('setup_') || currentPage === 'confirm_match') {
                    handleCancelMatch();
                  } else {
                    navigateWithSound('home');
                  }
                }}
                className="p-1.5 hover:bg-white/10 rounded-full text-blue-200 transition"
                title="Direct Home Shortcut"
              >
                <Home className="w-5 h-5" />
              </button>

              {currentPage === 'scoring' && (
                <>
                  <button 
                    onClick={() => {
                      playClickSound();
                      setViewMatch(currentMatch);
                      setCurrentPage('live_view');
                    }}
                    className="p-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-full transition ml-1"
                    title="View Full Scorecard"
                  >
                    <CheckCircle className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={() => setShowThreeDotsMenu(!showThreeDotsMenu)}
                    className="p-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-full transition ml-1"
                    title="Additional Settings Menu"
                  >
                    <MoreVertical className="w-5 h-5" />
                  </button>
                </>
              )}

              {/* Theme Switcher Button */}
              <button 
                onClick={() => {
                  playClickSound();
                  setShowThemeModal(true);
                }}
                className="p-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-full transition ml-1"
                title="Change Theme"
              >
                <Palette className="w-5 h-5" />
              </button>
            </div>
          </header>
        )}


        {/* ==================== PAGE 1: PIXEL FORMATION INTRO PAGE ==================== */}
        {currentPage === 'intro' && (
          <PixelIntro
            onStart={() => {
              playStartupSound();
              setIsIntroAnimating(true);
              setTimeout(() => {
                setCurrentPage('home');
                setIsIntroAnimating(false);
              }, 1400);
            }}
            isLaunching={isIntroAnimating}
          />
        )}


        {/* ==================== PAGE 2: HOME DASHBOARD PAGE ==================== */}
        {currentPage === 'home' && (
          <div className="flex-1 p-5 space-y-6 t-page overflow-y-auto">

            {/* Square-Rectangle Box Options as required by mobile interface layout */}
            <div className="space-y-3">
              <label className="text-xs uppercase tracking-wider t-muted font-bold block px-1">
                Main Control Hub Options
              </label>

              {/* 1. Start a match */}
              <button
                onClick={handleInitiateMatchSetup}
                className="w-full text-left t-card p-4 rounded-xl border border-[var(--border-color)] transition group flex items-center justify-between shadow"
              >
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-blue-600/20 group-hover:bg-blue-600 text-blue-400 group-hover:text-white rounded-lg transition">
                    <Play className="w-6 h-6 fill-current" />
                  </div>
                  <div>
                    <h3 className="font-bold t-text transition text-base">
                      1. Start a Match
                    </h3>
                    <p className="text-xs t-muted">
                      Configure custom teams, players, overs, modes &amp; delivery rules.
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 t-muted transition" />
              </button>

              {/* 2. Show matches */}
              <button
                onClick={() => {
                  getMatches().then(setAllMatches);
                  navigateWithSound('show_matches');
                }}
                className="w-full text-left t-card p-4 rounded-xl border border-[var(--border-color)] transition group flex items-center justify-between shadow"
              >
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-indigo-600/20 group-hover:bg-indigo-600 text-indigo-400 group-hover:text-white rounded-lg transition">
                    <Users className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold t-text transition text-base">
                      2. Show Matches
                    </h3>
                    <p className="text-xs t-muted">
                      Browse recent scorecards, live logs, or authenticate to resume scoring.
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 t-muted transition" />
              </button>

              {/* 3. Stats */}
              <button
                onClick={() => {
                  getPlayers().then(setAllPlayers);
                  navigateWithSound('stats');
                }}
                className="w-full text-left t-card p-4 rounded-xl border border-[var(--border-color)] transition group flex items-center justify-between shadow"
              >
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-emerald-600/20 group-hover:bg-emerald-600 text-emerald-400 group-hover:text-white rounded-lg transition">
                    <BarChart3 className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold t-text transition text-base">
                      3. Stats &amp; Leaderboards
                    </h3>
                    <p className="text-xs t-muted">
                      Check top run scorers, highest wickets, and search specific player careers.
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 t-muted transition" />
              </button>

              {/* 4. Player account */}
              <button
                onClick={() => {
                  playClickSound();
                  getPlayers().then(setAllPlayers);
                  getTeams().then(setAllTeams);
                  setCurrentPage(currentUser ? 'player_profile' : 'player_login');
                }}
                className="w-full text-left t-card p-4 rounded-xl border border-[var(--border-color)] transition group flex items-center justify-between shadow"
              >
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-blue-600/20 group-hover:bg-blue-600 text-blue-400 group-hover:text-white rounded-lg transition">
                    <UserCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold t-text transition text-base">
                      4. Player Login / Profile
                    </h3>
                    <p className="text-xs t-muted">
                      Create player account, view personal stats, teams and matches.
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 t-muted transition" />
              </button>
            </div>
          </div>
        )}


        {/* ==================== PLAYER LOGIN / SIGNUP PAGE ==================== */}
        {currentPage === 'player_login' && (
          <div className="flex-1 t-page p-5 flex flex-col justify-between">
            <div className="space-y-5">
              <div className="text-center pt-4">
                <UserCheck className="w-12 h-12 text-blue-400 mx-auto mb-2" />
                <h2 className="text-xl font-black text-white">Player Account</h2>
                <p className="text-xs text-slate-400">Create or login to your individual profile.</p>
              </div>

              <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800">
                <button onClick={() => setAccountMode('login')} className={`py-2 rounded-lg text-xs font-black ${accountMode === 'login' ? 'bg-blue-600 text-white' : 'text-slate-400'}`}>Login</button>
                <button onClick={() => setAccountMode('signup')} className={`py-2 rounded-lg text-xs font-black ${accountMode === 'signup' ? 'bg-blue-600 text-white' : 'text-slate-400'}`}>New Player</button>
              </div>

              <div className="bg-slate-800 rounded-2xl border border-slate-700 p-4 space-y-3">
                <div>
                  <label className="text-[10px] uppercase font-black tracking-wider text-blue-400">Player Name</label>
                  <input
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                    placeholder="e.g. Rohit 45"
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 p-3 text-sm font-bold text-white outline-none focus:border-blue-500"
                  />
                  <p className="mt-1 text-[10px] text-slate-500">At least 2 characters. Unique name required.</p>
                </div>
                {accountMessage && <div className="rounded-lg border border-blue-900/50 bg-blue-950/40 p-2 text-xs font-bold text-blue-300">{accountMessage}</div>}
              </div>
            </div>
            <button onClick={handleAccountSubmit} className="w-full rounded-xl bg-blue-600 py-3.5 font-black text-white hover:bg-blue-500">
              {accountMode === 'signup' ? 'Create Player Profile' : 'Login to Profile'}
            </button>
          </div>
        )}

        {/* ==================== PLAYER PROFILE PAGE ==================== */}
        {currentPage === 'player_profile' && currentUser && (() => {
          const latestUser = allPlayers.find(p => p.name.toLowerCase() === currentUser.name.toLowerCase()) || currentUser;
          const userTeams = latestUser.teams || [];
          const userMatches = allMatches.filter(match =>
            match.teamAPlayers.includes(latestUser.name) || match.teamBPlayers.includes(latestUser.name)
          );
          return (
            <div className="flex-1 bg-slate-900 p-4 space-y-4 overflow-y-auto">
              <div className="bg-slate-800 rounded-2xl border border-slate-700 p-5 text-center">
                <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-blue-600 text-2xl font-black text-white">
                  {latestUser.name.slice(0, 1).toUpperCase()}
                </div>
                <h2 className="text-2xl font-black text-white">{latestUser.name}</h2>
                <p className="text-xs text-slate-400">Individual Player Profile</p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="bg-slate-800 rounded-xl border border-slate-700 p-3 text-center"><div className="text-xl font-black text-blue-400">{latestUser.runs}</div><div className="text-[10px] text-slate-400">Runs</div></div>
                <div className="bg-slate-800 rounded-xl border border-slate-700 p-3 text-center"><div className="text-xl font-black text-amber-400">{latestUser.wickets}</div><div className="text-[10px] text-slate-400">Wickets</div></div>
                <div className="bg-slate-800 rounded-xl border border-slate-700 p-3 text-center"><div className="text-xl font-black text-emerald-400">{latestUser.matchPlayed}</div><div className="text-[10px] text-slate-400">Matches</div></div>
                <div className="bg-slate-800 rounded-xl border border-slate-700 p-3 text-center"><div className="text-xl font-black text-indigo-400">{latestUser.fours}/{latestUser.sixes}</div><div className="text-[10px] text-slate-400">4s / 6s</div></div>
              </div>

              <div className="bg-slate-800 rounded-xl border border-slate-700 p-3">
                <h3 className="text-xs font-black uppercase tracking-wider text-blue-400 mb-2">My Teams</h3>
                {userTeams.length ? userTeams.map(team => <div key={team} className="text-sm font-bold text-white py-1 border-b border-slate-700/60 last:border-0">{team}</div>) : <p className="text-xs text-slate-500">No teams yet. Join a team while scoring a match.</p>}
              </div>

              <div className="bg-slate-800 rounded-xl border border-slate-700 p-3">
                <h3 className="text-xs font-black uppercase tracking-wider text-blue-400 mb-2">My Matches</h3>
                {userMatches.length ? userMatches.map(match => <div key={match.id} className="text-xs py-2 border-b border-slate-700/60 last:border-0"><div className="font-black text-white">{match.teamA} vs {match.teamB}</div><div className="text-slate-400">{match.resultDescription || match.status}</div></div>) : <p className="text-xs text-slate-500">No matches yet.</p>}
              </div>

              <button onClick={() => { setCurrentUser(null); navigateWithSound('player_login'); }} className="w-full rounded-xl bg-slate-800 border border-slate-700 py-3 font-bold text-slate-300">Logout</button>
            </div>
          );
        })()}


        {/* ==================== PAGE 1.1: SELECT EXISTING/NEW TEAMS ==================== */}
        {currentPage === 'setup_teams' && currentMatch && (
          <div className="flex-1 p-5 space-y-6 bg-slate-900 flex flex-col justify-between">
            <div className="space-y-5">
              <div className="text-center py-2">
                <h2 className="text-xl font-black text-white tracking-tight">Select teams</h2>
                <p className="text-xs text-slate-400">Choose existing teams or create a new unique capital-name team.</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => openTeamPicker('A')}
                  className="min-h-32 rounded-2xl border border-blue-500/40 bg-slate-800 p-4 text-center active:scale-95 transition"
                >
                  <div className="text-[10px] font-black uppercase tracking-widest text-blue-400">Team A</div>
                  <div className="mt-3 text-lg font-black text-white break-words">
                    {currentMatch.teamA || 'EMPTY'}
                  </div>
                  <div className="mt-2 text-[10px] text-slate-500">Tap to select/create</div>
                </button>

                <button
                  onClick={() => openTeamPicker('B')}
                  className="min-h-32 rounded-2xl border border-indigo-500/40 bg-slate-800 p-4 text-center active:scale-95 transition"
                >
                  <div className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Team B</div>
                  <div className="mt-3 text-lg font-black text-white break-words">
                    {currentMatch.teamB || 'EMPTY'}
                  </div>
                  <div className="mt-2 text-[10px] text-slate-500">Tap to select/create</div>
                </button>
              </div>

              <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-3 text-[11px] text-slate-400">
                Team name rules: CAPITAL letters and numbers only, spaces allowed, 3-20 characters.
              </div>
            </div>

            <button
              onClick={handleNextFromTeams}
              disabled={!currentMatch.teamA || !currentMatch.teamB || currentMatch.teamA === currentMatch.teamB}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 font-bold text-white rounded-xl shadow-lg transition flex items-center justify-center gap-2 mt-4"
            >
              <span>Continue to Player Selection</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* TEAM PICKER MODAL */}
        {teamPickerSlot && currentMatch && (
          <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
            <div className="w-full max-w-xs rounded-2xl border border-blue-500/40 bg-slate-800 p-4 shadow-2xl space-y-4">
              <div className="text-center">
                <h3 className="text-lg font-black text-white">Select Team {teamPickerSlot}</h3>
                <p className="text-[11px] text-slate-400">Search existing team or create a new one.</p>
              </div>
              <input
                value={teamSearch}
                onChange={(e) => setTeamSearch(e.target.value.toUpperCase())}
                placeholder="SEARCH TEAM"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 p-2.5 text-sm font-bold text-white outline-none focus:border-blue-500"
              />
              <div className="max-h-44 overflow-y-auto space-y-1 rounded-xl border border-slate-700 bg-slate-950 p-1">
                {allTeams
                  .filter(team => team.name.includes(normalizeTeamName(teamSearch)))
                  .map(team => (
                    <button
                      key={team.name}
                      onClick={() => chooseTeamForSlot(team.name)}
                      className="w-full rounded-lg bg-slate-800 p-2 text-left text-xs font-black text-white hover:bg-blue-600"
                    >
                      {team.name}
                      <span className="ml-2 text-[10px] font-normal text-slate-400">{team.players.length} players</span>
                    </button>
                  ))}
                {allTeams.filter(team => team.name.includes(normalizeTeamName(teamSearch))).length === 0 && (
                  <div className="p-3 text-center text-xs text-slate-500">No team found.</div>
                )}
              </div>
              <div className="space-y-2 border-t border-slate-700 pt-3">
                <label className="block text-[10px] font-black uppercase tracking-wider text-blue-400">Create new team</label>
                <input
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value.toUpperCase())}
                  placeholder="NEW TEAM"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 p-2.5 text-sm font-bold text-white outline-none focus:border-blue-500"
                />
                <button onClick={handleCreateAndChooseTeam} className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-black text-white hover:bg-blue-500">
                  Create & Select
                </button>
              </div>
              <button onClick={() => setTeamPickerSlot(null)} className="w-full rounded-lg bg-slate-700 py-2 text-sm font-bold text-slate-200">Cancel</button>
            </div>
          </div>
        )}


        {/* ==================== PAGE 1.2: TEAM PLAYERS NAME FILLING PAGE ==================== */}
        {currentPage === 'setup_players' && currentMatch && (
          <div className="flex-1 p-4 space-y-4 bg-slate-900 flex flex-col justify-between">
            
            <div className="space-y-3">
              <div className="text-center">
                <h2 className="text-lg font-black text-white">Fill Team Player Names</h2>
                <p className="text-[11px] text-slate-400">
                  Search and add existing player accounts only. New players must signup from Player Login.
                </p>
              </div>

              {/* Two Sides Separated by a Straight Line */}
              <div className="grid grid-cols-2 gap-3 relative">
                
                {/* Straight vertical line separator */}
                <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-0.5 bg-slate-700/80 z-0" />

                {/* Left Side: Team A */}
                <div className="space-y-2 z-10 pr-1">
                  <div className="text-xs font-black text-blue-400 truncate text-center bg-blue-950/40 p-1.5 rounded border border-blue-900/30">
                    A: {currentMatch.teamA}
                  </div>
                  
                  <div className="flex gap-1">
                    <input
                      type="text"
                      placeholder="Search existing player..."
                      value={playerInputA}
                      onChange={(e) => setPlayerInputA(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddPlayer('A')}
                      className="w-full text-xs bg-slate-800 p-1.5 rounded border border-slate-700 text-white focus:outline-none"
                    />
                    <button
                      onClick={() => handleAddPlayer('A')}
                      className="bg-blue-600 hover:bg-blue-500 text-white p-1.5 rounded text-xs"
                    >
                      +
                    </button>
                  </div>

                  {playerInputA.trim() && (
                    <div className="max-h-24 overflow-y-auto rounded-lg border border-slate-700 bg-slate-950 p-1 space-y-1">
                      {allPlayers
                        .filter(p => p.name.toLowerCase().includes(playerInputA.toLowerCase()) && !currentMatch.teamAPlayers.includes(p.name))
                        .slice(0, 6)
                        .map(p => (
                          <button key={p.name} onClick={() => handleAddExistingPlayer('A', p.name)} className="w-full text-left rounded bg-slate-800 px-2 py-1.5 text-[11px] font-bold text-slate-200 hover:bg-blue-600">
                            {p.name}
                          </button>
                        ))}
                    </div>
                  )}

                  <div className="space-y-1 max-h-56 overflow-y-auto pt-1">
                    {currentMatch.teamAPlayers.map((p, idx) => {
                      const exists = allPlayers.some(pl => pl.name.toLowerCase() === p.toLowerCase());
                      return (
                        <div 
                          key={idx} 
                          className={`text-xs p-1.5 rounded bg-slate-800/90 border border-slate-700 truncate flex items-center justify-between ${
                            exists ? 'text-green-400 font-bold' : 'text-slate-200'
                          }`}
                        >
                          <span className="truncate">{idx + 1}. {p}</span>
                          <button 
                            onClick={() => {
                              const list = currentMatch.teamAPlayers.filter((_, i) => i !== idx);
                              setCurrentMatch({ ...currentMatch, teamAPlayers: list });
                            }}
                            className="text-[10px] text-red-400 hover:text-red-300 ml-1"
                          >
                            ×
                          </button>
                        </div>
                      );
                    })}
                    {currentMatch.teamAPlayers.length === 0 && (
                      <div className="text-[10px] text-slate-500 text-center italic py-4">No players added yet</div>
                    )}
                  </div>
                </div>

                {/* Right Side: Team B */}
                <div className="space-y-2 z-10 pl-1">
                  <div className="text-xs font-black text-indigo-400 truncate text-center bg-indigo-950/40 p-1.5 rounded border border-indigo-900/30">
                    B: {currentMatch.teamB}
                  </div>

                  <div className="flex gap-1">
                    <input
                      type="text"
                      placeholder="Search existing player..."
                      value={playerInputB}
                      onChange={(e) => setPlayerInputB(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddPlayer('B')}
                      className="w-full text-xs bg-slate-800 p-1.5 rounded border border-slate-700 text-white focus:outline-none"
                    />
                    <button
                      onClick={() => handleAddPlayer('B')}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white p-1.5 rounded text-xs"
                    >
                      +
                    </button>
                  </div>

                  {playerInputB.trim() && (
                    <div className="max-h-24 overflow-y-auto rounded-lg border border-slate-700 bg-slate-950 p-1 space-y-1">
                      {allPlayers
                        .filter(p => p.name.toLowerCase().includes(playerInputB.toLowerCase()) && !currentMatch.teamBPlayers.includes(p.name))
                        .slice(0, 6)
                        .map(p => (
                          <button key={p.name} onClick={() => handleAddExistingPlayer('B', p.name)} className="w-full text-left rounded bg-slate-800 px-2 py-1.5 text-[11px] font-bold text-slate-200 hover:bg-indigo-600">
                            {p.name}
                          </button>
                        ))}
                    </div>
                  )}

                  <div className="space-y-1 max-h-56 overflow-y-auto pt-1">
                    {currentMatch.teamBPlayers.map((p, idx) => {
                      const exists = allPlayers.some(pl => pl.name.toLowerCase() === p.toLowerCase());
                      return (
                        <div 
                          key={idx} 
                          className={`text-xs p-1.5 rounded bg-slate-800/90 border border-slate-700 truncate flex items-center justify-between ${
                            exists ? 'text-green-400 font-bold' : 'text-slate-200'
                          }`}
                        >
                          <span className="truncate">{idx + 1}. {p}</span>
                          <button 
                            onClick={() => {
                              const list = currentMatch.teamBPlayers.filter((_, i) => i !== idx);
                              setCurrentMatch({ ...currentMatch, teamBPlayers: list });
                            }}
                            className="text-[10px] text-red-400 hover:text-red-300 ml-1"
                          >
                            ×
                          </button>
                        </div>
                      );
                    })}
                    {currentMatch.teamBPlayers.length === 0 && (
                      <div className="text-[10px] text-slate-500 text-center italic py-4">No players added yet</div>
                    )}
                  </div>

                </div>

              </div>
            </div>

            {/* Bottom Nav indicators for 1.2 */}
            <div className="space-y-2 pt-2">
              <div className="text-[11px] bg-slate-800/60 p-2 rounded border border-slate-700 text-slate-400">
                ⚠️ <span className="text-slate-200 font-semibold">Note:</span> Pressing Next finalizes the lineup configuration permanently into local databases and unlocks match strategy rules.
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={() => navigateWithSound('setup_teams')}
                  className="flex-1 py-2.5 bg-slate-800 text-slate-300 font-bold rounded-lg border border-slate-700 text-xs flex items-center justify-center gap-1"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Previous</span>
                </button>
                <button
                  onClick={handleNextFromPlayers}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-lg text-xs flex items-center justify-center gap-1 shadow"
                >
                  <span>Next</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

          </div>
        )}


        {/* ==================== PAGE 1.3: MATCH SETTINGS PAGE 1 ==================== */}
        {currentPage === 'setup_settings_1' && currentMatch && (() => {
          const hasSinglePlayerTeam = currentMatch.teamAPlayers.length === 1 || currentMatch.teamBPlayers.length === 1;
          const isTwoBatsmenDisabled = hasSinglePlayerTeam;

          return (
          <div className="flex-1 p-5 bg-slate-900 flex flex-col justify-between">
            <div className="space-y-5">
              <div className="text-center">
                <h2 className="text-lg font-black text-white tracking-tight uppercase">Match Settings (Part 1)</h2>
                <p className="text-xs text-slate-400">Configure overs limits and striker counts.</p>
              </div>

              {/* Option 1: Overs selection */}
              <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-blue-400 uppercase tracking-wider block">
                    (1) Overs of the match
                  </label>
                  <label className="inline-flex items-center gap-2 text-xs text-slate-300 font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={currentMatch.settings.isUnlimitedOvers}
                      onChange={(e) => {
                        playClickSound();
                        setCurrentMatch({
                          ...currentMatch,
                          settings: {
                            ...currentMatch.settings,
                            isUnlimitedOvers: e.target.checked
                          }
                        });
                      }}
                      className="accent-blue-500 w-4 h-4"
                    />
                    <span>Unlimited Overs</span>
                  </label>
                </div>

                {!currentMatch.settings.isUnlimitedOvers ? (
                  <div className="space-y-1">
                    <span className="text-[11px] text-slate-400 block">Type target fixed overs amount:</span>
                    <input
                      type="number"
                      min={1}
                      max={90}
                      value={currentMatch.settings.overs}
                      onChange={(e) => setCurrentMatch({
                        ...currentMatch,
                        settings: {
                          ...currentMatch.settings,
                          overs: Math.max(1, parseInt(e.target.value) || 1)
                        }
                      })}
                      className="w-full bg-slate-950 text-white rounded p-2 text-sm border border-slate-700 font-mono text-center font-bold"
                    />
                  </div>
                ) : (
                  <div className="bg-blue-950/40 text-blue-400 text-xs p-2 rounded border border-blue-900/50 text-center italic">
                    Both innings will continue uninterrupted till the team is completely [all out].
                  </div>
                )}
              </div>

              {/* Option 2: Batsman Mode */}
              <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 space-y-2">
                <label className="text-xs font-bold text-blue-400 uppercase tracking-wider block">
                  (2) Batsman Play Mode
                </label>
                <p className="text-[11px] text-slate-400 leading-tight">
                  Indicates how batsmen will take positions: Two batsmen playing simultaneously or solo lone survival batsman mode.
                </p>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    disabled={isTwoBatsmenDisabled}
                    onClick={() => {
                      playClickSound();
                      setCurrentMatch({
                        ...currentMatch,
                        settings: {
                          ...currentMatch.settings,
                          isTwoBatsmenMode: true
                        }
                      });
                    }}
                    className={`p-2.5 text-xs font-bold rounded-lg border transition ${
                      currentMatch.settings.isTwoBatsmenMode
                        ? 'bg-blue-600 text-white border-blue-400 shadow'
                        : 'bg-slate-900 text-slate-400 border-slate-700'
                    } ${isTwoBatsmenDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    2 Batsmen Mode<br/><span className="text-[9px] font-normal opacity-80">(Striker &amp; Non-Striker)</span>
                  </button>

                  <button
                    disabled={isTwoBatsmenDisabled && !currentMatch.settings.isTwoBatsmenMode}
                    onClick={() => {
                      playClickSound();
                      setCurrentMatch({
                        ...currentMatch,
                        settings: {
                          ...currentMatch.settings,
                          isTwoBatsmenMode: false,
                          lastCanBat: true // Forced permanently in 1 batsman mode
                        }
                      });
                    }}
                    className={`p-2.5 text-xs font-bold rounded-lg border transition ${
                      !currentMatch.settings.isTwoBatsmenMode
                        ? 'bg-blue-600 text-white border-blue-500 shadow'
                        : 'bg-slate-900 text-slate-400 border-slate-700'
                    } ${isTwoBatsmenDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    1 Batsman Mode<br/><span className="text-[9px] font-normal opacity-80">(Striker Plays Only)</span>
                  </button>
                </div>

                {hasSinglePlayerTeam && (
                  <p className="text-[10px] text-amber-400 mt-2 italic">
                    Note: Forced to 1-Batsman mode as one team has only 1 player.
                  </p>
                )}
              </div>

              {/* Option 3: Last One Bat Mode */}
              <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-blue-400 uppercase tracking-wider block">
                    (3) 'Last One Bat' Option
                  </label>
                  <span className="bg-slate-900 px-2 py-0.5 rounded text-[10px] uppercase text-indigo-300 font-mono font-bold">
                    {currentMatch.settings.isTwoBatsmenMode ? 'Changeable' : 'Permanently On'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-tight">
                  Controls if the last remaining batsman can continue solo without teammates left.
                </p>

                <div className="flex items-center justify-between p-2 bg-slate-900 rounded border border-slate-700/60 mt-2">
                  <div className="text-xs font-semibold text-slate-200">
                    Status: {currentMatch.settings.lastCanBat ? 'ON (Lone striker can bat)' : 'OFF (All out when 1 left)'}
                  </div>
                  <input
                    type="checkbox"
                    disabled={!currentMatch.settings.isTwoBatsmenMode}
                    checked={currentMatch.settings.lastCanBat}
                    onChange={(e) => {
                      playClickSound();
                      setCurrentMatch({
                        ...currentMatch,
                        settings: {
                          ...currentMatch.settings,
                          lastCanBat: e.target.checked
                        }
                      });
                    }}
                    className="accent-blue-500 w-5 h-5 cursor-pointer disabled:opacity-50"
                  />
                </div>
              </div>

            </div>

            <div className="flex gap-2 pt-4">
              <button
                onClick={() => navigateWithSound('setup_players')}
                className="flex-1 py-3 bg-slate-800 text-slate-300 font-bold rounded-xl border border-slate-700 text-xs"
              >
                Previous
              </button>
              <button
                onClick={handleNextFromSettings1}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-xl text-xs"
              >
                Next
              </button>
            </div>
          </div>
          );
        })()}


        {/* ==================== PAGE 1.4: MATCH SETTINGS PAGE 2 ==================== */}
        {currentPage === 'setup_settings_2' && currentMatch && (
          <div className="flex-1 p-5 bg-slate-900 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="text-center">
                <h2 className="text-lg font-black text-white tracking-tight uppercase">Match Settings (Part 2)</h2>
                <p className="text-xs text-slate-400">Enable or disable delivery penalty scoring triggers.</p>
              </div>

              <div className="bg-slate-800 p-4 rounded-2xl border border-slate-700 space-y-4">
                <p className="text-xs text-slate-300 leading-relaxed font-semibold">
                  Select which extra rules are active. Unselected items will be automatically hidden from the main scoreboard panel layout.
                </p>

                {/* Wide Delivery Toggle */}
                <div className="p-3 bg-slate-900 rounded-xl border border-slate-700 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-black text-slate-200 block">Wide-Ball Processing</span>
                    <span className="text-[10px] text-slate-400 block max-w-[240px]">
                      Awards 1 run to team extras, prompts for secondary runs and retains strike rotation.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={currentMatch.settings.enableWide}
                    onChange={(e) => {
                      playClickSound();
                      setCurrentMatch({
                        ...currentMatch,
                        settings: { ...currentMatch.settings, enableWide: e.target.checked }
                      });
                    }}
                    className="w-5 h-5 accent-blue-500"
                  />
                </div>

                {/* No Ball Delivery Toggle */}
                <div className="p-3 bg-slate-900 rounded-xl border border-slate-700 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-black text-slate-200 block">No-Ball + FREE HIT Protocol</span>
                    <span className="text-[10px] text-slate-400 block max-w-[240px]">
                      Ball doesn't count. 1 run to extras + bat runs. Activates Free Hit where only run-out is valid.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={currentMatch.settings.enableNoBall}
                    onChange={(e) => {
                      playClickSound();
                      setCurrentMatch({
                        ...currentMatch,
                        settings: { ...currentMatch.settings, enableNoBall: e.target.checked }
                      });
                    }}
                    className="w-5 h-5 accent-blue-500"
                  />
                </div>

                {/* Leg-By Delivery Toggle */}
                <div className="p-3 bg-slate-900 rounded-xl border border-slate-700 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-black text-slate-200 block">Leg-By Extrapolations</span>
                    <span className="text-[10px] text-slate-400 block max-w-[240px]">
                      Ball is counted in over, runs go to team extras instead of batsman.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={currentMatch.settings.enableLegBy}
                    onChange={(e) => {
                      playClickSound();
                      setCurrentMatch({
                        ...currentMatch,
                        settings: { ...currentMatch.settings, enableLegBy: e.target.checked }
                      });
                    }}
                    className="w-5 h-5 accent-blue-500"
                  />
                </div>
              </div>

              <div className="p-3 bg-blue-950/30 border border-blue-900/60 rounded-xl text-[11px] text-blue-300">
                ⭐ <span className="font-bold">Algorithm Notice:</span> All selected components incorporate high fidelity professional cricket rotation matrices automatically.
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <button
                onClick={() => navigateWithSound('setup_settings_1')}
                className="flex-1 py-3 bg-slate-800 text-slate-300 font-bold rounded-xl border border-slate-700 text-xs"
              >
                Previous
              </button>
              <button
                onClick={handleNextFromSettings2}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-xl text-xs"
              >
                Proceed to Toss
              </button>
            </div>
          </div>
        )}


        {/* ==================== PAGE 1.5: TOSS PAGE ==================== */}
        {currentPage === 'setup_toss' && currentMatch && (
          <div className="flex-1 p-5 bg-slate-900 flex flex-col justify-between">
            <div className="space-y-5">
              <div className="text-center">
                <h2 className="text-xl font-black text-white uppercase tracking-tight">Toss Time</h2>
                <p className="text-xs text-slate-400">Record who won the coin flip and what decision they elected.</p>
              </div>

              {/* Toss Winner Side Selection */}
              <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 space-y-3">
                <label className="text-xs font-bold text-blue-400 uppercase tracking-wider block text-center">
                  Which team won the toss?
                </label>
                
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      playClickSound();
                      setCurrentMatch({ ...currentMatch, tossWinner: currentMatch.teamA });
                    }}
                    className={`p-3 text-xs font-black rounded-lg border truncate transition ${
                      currentMatch.tossWinner === currentMatch.teamA
                        ? 'bg-blue-600 text-white border-blue-400 shadow'
                        : 'bg-slate-900 text-slate-400 border-slate-700'
                    }`}
                  >
                    {currentMatch.teamA}
                  </button>

                  <button
                    onClick={() => {
                      playClickSound();
                      setCurrentMatch({ ...currentMatch, tossWinner: currentMatch.teamB });
                    }}
                    className={`p-3 text-xs font-black rounded-lg border truncate transition ${
                      currentMatch.tossWinner === currentMatch.teamB
                        ? 'bg-blue-600 text-white border-blue-400 shadow'
                        : 'bg-slate-900 text-slate-400 border-slate-700'
                    }`}
                  >
                    {currentMatch.teamB}
                  </button>
                </div>
              </div>

              {/* Toss Choice Selection */}
              <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 space-y-3">
                <label className="text-xs font-bold text-blue-400 uppercase tracking-wider block text-center">
                  What did the toss winner choose first?
                </label>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      playClickSound();
                      setCurrentMatch({ ...currentMatch, tossChoice: 'bat' });
                    }}
                    className={`p-3 text-xs font-black rounded-lg border transition flex flex-col items-center gap-1 ${
                      currentMatch.tossChoice === 'bat'
                        ? 'bg-blue-600 text-white border-blue-400 shadow'
                        : 'bg-slate-900 text-slate-400 border-slate-700'
                    }`}
                  >
                    <span className="text-lg">🏏</span>
                    <span>BATTING</span>
                  </button>

                  <button
                    onClick={() => {
                      playClickSound();
                      setCurrentMatch({ ...currentMatch, tossChoice: 'field' });
                    }}
                    className={`p-3 text-xs font-black rounded-lg border transition flex flex-col items-center gap-1 ${
                      currentMatch.tossChoice === 'field'
                        ? 'bg-blue-600 text-white border-blue-400 shadow'
                        : 'bg-slate-900 text-slate-400 border-slate-700'
                    }`}
                  >
                    <span className="text-lg">🛡️</span>
                    <span>FIELDING</span>
                  </button>
                </div>
              </div>

              <div className="p-3 bg-slate-800/50 border border-slate-700 rounded-xl text-center text-xs text-slate-300 font-medium">
                📢 <span className="text-blue-400 font-bold">{currentMatch.tossWinner}</span> elected to <span className="text-indigo-400 font-bold uppercase">{currentMatch.tossChoice === 'bat' ? 'Bat' : 'Field'}</span> first.
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <button
                onClick={() => navigateWithSound('setup_settings_2')}
                className="flex-1 py-3 bg-slate-800 text-slate-300 font-bold rounded-xl border border-slate-700 text-xs"
              >
                Previous
              </button>
              <button
                onClick={handleNextFromToss}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-xl text-xs"
              >
                Select Players
              </button>
            </div>
          </div>
        )}


        {/* ==================== SECOND INNING START PAGE ==================== */}
        {currentPage === 'start_second_inning' && currentMatch && currentMatch.secondInning && (
          <div className="flex-1 p-5 bg-slate-900 flex flex-col justify-between">
            <div className="space-y-5">
              <div className="text-center">
                <span className="inline-flex items-center rounded-full border border-indigo-500/40 bg-indigo-950/40 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-indigo-300">
                  Innings Break
                </span>
                <h2 className="mt-3 text-2xl font-black uppercase tracking-tight text-white">
                  Start Second Inning
                </h2>
                <p className="mt-2 text-xs text-slate-400">
                  First innings is complete. Review the target and begin the chase with fresh player selections.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-700 bg-slate-800 p-4 shadow-xl shadow-black/25 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold uppercase tracking-wider text-slate-400">First Inning</span>
                  <span className="font-mono text-blue-300">
                    {currentMatch.firstInning?.battingTeam}
                  </span>
                </div>
                <div className="text-center">
                  <div className="text-4xl font-black text-white">
                    {currentMatch.firstInning?.runs}/{currentMatch.firstInning?.wickets}
                  </div>
                  <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Target for {currentMatch.secondInning.battingTeam}
                  </div>
                </div>
                <div className="rounded-xl border border-blue-500/20 bg-blue-950/30 p-3 text-center">
                  <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-blue-300">Need to score</div>
                  <div className="mt-1 text-3xl font-black text-white">{(currentMatch.firstInning?.runs || 0) + 1}</div>
                  <div className="mt-1 text-xs font-semibold text-slate-300">
                    {currentMatch.secondInning.battingTeam} vs {currentMatch.secondInning.fieldingTeam}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-700 bg-slate-800/60 p-4 text-xs text-slate-300 space-y-2">
                <div className="font-black uppercase tracking-wider text-indigo-300">Next steps</div>
                <ul className="space-y-1.5 list-disc pl-4 marker:text-indigo-400">
                  <li>Select striker from the batting team list</li>
                  {currentMatch.settings.isTwoBatsmenMode && <li>Select non-striker from the batting team list</li>}
                  <li>Select opening bowler from the fielding team list</li>
                </ul>
              </div>
            </div>

            <div className="space-y-2 pt-4">
              <button
                onClick={() => {
                  playSuccessSound();
                  navigateWithSound('select_striker');
                }}
                className="w-full rounded-2xl bg-blue-600 px-6 py-4 text-sm font-black uppercase tracking-wider text-white shadow-xl shadow-blue-900/35 hover:bg-blue-500"
              >
                Start Second Inning
              </button>
              <div className="text-center text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                Continue to player selection
              </div>
            </div>
          </div>
        )}

        {/* ==================== PAGE 1.6: SELECT STRIKER ==================== */}
        {currentPage === 'select_striker' && currentMatch && (
          <div className="flex-1 p-5 bg-slate-900 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="text-center">
                <span className="text-[10px] uppercase font-bold text-blue-400 bg-blue-950 px-2 py-0.5 rounded border border-blue-900">
                  Step 1 / 3
                </span>
                <h2 className="text-lg font-black text-white mt-1">Select Striker Batsman</h2>
                <p className="text-xs text-slate-400">
                  Touch name to bind player to active striker position (turns blue box).
                </p>
              </div>

              <div className="space-y-1.5 max-h-80 overflow-y-auto p-1 bg-slate-950 rounded-xl border border-slate-800">
                {/* Batting team players list */}
                {getBattingPlayersForInning(currentMatch).map((name, i) => {
                  const isSelected = currentMatch.currentStriker === name;
                  return (
                    <div
                      key={i}
                      onClick={() => handleSelectStriker(name)}
                      className={`p-3 rounded-lg border transition text-xs font-bold cursor-pointer flex items-center justify-between ${
                        isSelected 
                          ? 'bg-blue-600 text-white border-blue-400 shadow-md translate-x-1' 
                          : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700/50'
                      }`}
                    >
                      <span>{name}</span>
                      {isSelected && <span className="text-[10px] uppercase bg-slate-900 px-1.5 py-0.5 rounded text-white">Active Striker</span>}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <button
                onClick={() => navigateWithSound('setup_toss')}
                className="flex-1 py-3 bg-slate-800 text-slate-300 font-bold rounded-xl border border-slate-700 text-xs"
              >
                Previous
              </button>
              <button
                onClick={handleNextFromStriker}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-xl text-xs"
              >
                Next
              </button>
            </div>
          </div>
        )}


        {/* ==================== PAGE 1.7: SELECT NON-STRIKER ==================== */}
        {currentPage === 'select_non_striker' && currentMatch && (
          <div className="flex-1 p-5 bg-slate-900 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="text-center">
                <span className="text-[10px] uppercase font-bold text-indigo-400 bg-indigo-950 px-2 py-0.5 rounded border border-indigo-900">
                  Step 2 / 3
                </span>
                <h2 className="text-lg font-black text-white mt-1">Select Non-Striker Batsman</h2>
                <p className="text-xs text-slate-400">
                  Select secondary batsman from the pool (excluding striker). Turns blue box.
                </p>
              </div>

              <div className="p-2 bg-blue-950/40 text-[11px] text-blue-300 rounded border border-blue-900 text-center">
                Striker already selected: <span className="font-bold text-white">{currentMatch.currentStriker}</span>
              </div>

              <div className="space-y-1.5 max-h-80 overflow-y-auto p-1 bg-slate-950 rounded-xl border border-slate-800">
                {getBattingPlayersForInning(currentMatch)
                .filter(name => name !== currentMatch.currentStriker)
                .map((name, i) => {
                  const isSelected = currentMatch.currentNonStriker === name;
                  return (
                    <div
                      key={i}
                      onClick={() => handleSelectNonStriker(name)}
                      className={`p-3 rounded-lg border transition text-xs font-bold cursor-pointer flex items-center justify-between ${
                        isSelected 
                          ? 'bg-blue-600 text-white border-blue-400 shadow-md translate-x-1' 
                          : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700/50'
                      }`}
                    >
                      <span>{name}</span>
                      {isSelected && <span className="text-[10px] uppercase bg-slate-900 px-1.5 py-0.5 rounded text-white">Non-Striker</span>}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <button
                onClick={() => navigateWithSound('select_striker')}
                className="flex-1 py-3 bg-slate-800 text-slate-300 font-bold rounded-xl border border-slate-700 text-xs"
              >
                Previous
              </button>
              <button
                onClick={handleNextFromNonStriker}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-xl text-xs"
              >
                Next
              </button>
            </div>
          </div>
        )}


        {/* ==================== SELECT BOWLER PAGE ==================== */}
        {currentPage === 'select_bowler' && currentMatch && (
          <div className="flex-1 p-5 bg-slate-900 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="text-center">
                <span className="text-[10px] uppercase font-bold text-amber-400 bg-amber-950 px-2 py-0.5 rounded border border-amber-900">
                  Step 3 / 3
                </span>
                <h2 className="text-lg font-black text-white mt-1">Select Opening Bowler</h2>
                <p className="text-xs text-slate-400">
                  Select one bowler from the opposing fielding side. Turns yellow box.
                </p>
              </div>

              <div className="space-y-1.5 max-h-80 overflow-y-auto p-1 bg-slate-950 rounded-xl border border-slate-800">
                {getFieldingPlayersForInning(currentMatch).map((name, i) => {
                  const isSelected = currentMatch.currentBowler === name;
                  return (
                    <div
                      key={i}
                      onClick={() => handleSelectBowler(name)}
                      className={`p-3 rounded-lg border transition text-xs font-bold cursor-pointer flex items-center justify-between ${
                        isSelected 
                          ? 'bg-amber-500 text-slate-950 border-amber-300 shadow-md translate-x-1 font-extrabold' 
                          : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700/50'
                      }`}
                    >
                      <span>{name}</span>
                      {isSelected && <span className="text-[10px] uppercase bg-slate-900 px-1.5 py-0.5 rounded text-amber-400">Opening Bowler</span>}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <button
                onClick={() => {
                  if (currentMatch.settings.isTwoBatsmenMode) {
                    navigateWithSound('select_non_striker');
                  } else {
                    navigateWithSound('select_striker');
                  }
                }}
                className="flex-1 py-3 bg-slate-800 text-slate-300 font-bold rounded-xl border border-slate-700 text-xs"
              >
                Previous
              </button>
              <button
                onClick={handleNextFromBowler}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-xl text-xs"
              >
                Next
              </button>
            </div>
          </div>
        )}


        {/* ==================== PAGE 1.8: CONFIRM MATCH READY ==================== */}
        {currentPage === 'confirm_match' && currentMatch && (
          <div className="flex-1 p-5 bg-slate-900 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="text-center">
                <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto animate-bounce" />
                <h2 className="text-xl font-black text-white mt-2">Ready to Score!</h2>
                <p className="text-xs text-slate-400">Review lineup configurations before sealing database logs.</p>
              </div>

              <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 space-y-3 divide-y divide-slate-700/50 text-xs">
                <div className="pb-2 flex justify-between">
                  <span className="text-slate-400">Match-Up:</span>
                  <span className="font-bold text-white text-right">{currentMatch.teamA} <span className="text-blue-400">vs</span> {currentMatch.teamB}</span>
                </div>

                <div className="py-2 flex justify-between">
                  <span className="text-slate-400">Toss Decision:</span>
                  <span className="font-bold text-amber-400 uppercase">{currentMatch.tossWinner} ({currentMatch.tossChoice === 'bat' ? 'Batting' : 'Fielding'})</span>
                </div>

                <div className="py-2 flex justify-between">
                  <span className="text-slate-400">Overs Configuration:</span>
                  <span className="font-bold text-white">{currentMatch.settings.isUnlimitedOvers ? 'Unlimited Overs' : `${currentMatch.settings.overs} Overs`}</span>
                </div>

                <div className="py-2 flex justify-between">
                  <span className="text-slate-400">Active Striker Batsman:</span>
                  <span className="font-bold text-blue-400">{currentMatch.currentStriker}</span>
                </div>

                {currentMatch.settings.isTwoBatsmenMode && (
                  <div className="py-2 flex justify-between">
                    <span className="text-slate-400">Active Non-Striker:</span>
                    <span className="font-bold text-indigo-400">{currentMatch.currentNonStriker}</span>
                  </div>
                )}

                <div className="pt-2 flex justify-between">
                  <span className="text-slate-400">Opening Bowler:</span>
                  <span className="font-bold text-amber-400">{currentMatch.currentBowler}</span>
                </div>
              </div>

              <div className="p-3 bg-amber-950/20 border border-amber-900/50 text-slate-300 rounded-xl text-[11px] leading-normal">
                🔒 Clicking <span className="text-white font-bold">Start Scoring</span> will lock down the configuration, generate an 8-digit secure key with a 6-letter secret authentication credential password, and render the premium scoring panel.
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <button
                onClick={() => navigateWithSound('select_bowler')}
                className="flex-1 py-3 bg-slate-800 text-slate-300 font-bold rounded-xl border border-slate-700 text-xs"
              >
                Previous
              </button>
              <button
                onClick={handleStartScoringActiveMatch}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl text-sm shadow-md"
              >
                START SCORING
              </button>
            </div>
          </div>
        )}


        {/* ==================== PAGE 1.9: MODERN SCORING PANEL ==================== */}
        {currentPage === 'scoring' && currentMatch && (
          <div className="flex-1 bg-slate-900 flex flex-col justify-between overflow-y-auto">
            
            {/* SCOREBOARD SUMMARY HEADER */}
            {(() => {
              const inning = getActiveInning();
              const firstInningRuns = currentMatch.firstInning?.runs || 0;
              const isSecondInning = currentMatch.currentInningIndex === 2;

              const totalOversDone = Math.floor(inning.balls / 6);
              const totalOversRemainder = inning.balls % 6;

              return (
                <div className="space-y-2">
                  
                  {/* Team Run Banner Display */}
                  <div className="bg-slate-900 p-3.5 border-b border-blue-900/40 text-center relative">
                    
                    {currentMatch.isFreeHit && (
                      <div className="absolute top-2 left-2 bg-red-600 text-white font-black text-[9px] px-2 py-0.5 rounded-full animate-pulse tracking-widest border border-white">
                        ★ FREE HIT ★
                      </div>
                    )}

                    <span className="text-xs font-bold text-blue-400 tracking-wider uppercase block">
                      {inning.battingTeam} Batting ({isSecondInning ? '2nd Inning' : '1st Inning'})
                    </span>

                    <div className="my-1 flex items-baseline justify-center gap-2">
                      <span className="text-4xl font-black text-white font-mono tracking-tight">
                        {inning.runs}/{inning.wickets}
                      </span>
                      <span className="text-slate-400 font-mono text-sm font-bold">
                        ({totalOversDone}.{totalOversRemainder} {currentMatch.settings.isUnlimitedOvers ? 'Overs' : `/ ${currentMatch.settings.overs} ov`})
                      </span>
                    </div>

                    {/* Secondary Metrics Bar */}
                    <div className="flex items-center justify-around text-[11px] font-mono text-slate-400 pt-1 border-t border-slate-800/60 mt-1">
                      <div>
                        Extras: <span className="text-slate-200 font-bold">{inning.extras.wides + inning.extras.noballs + inning.extras.legbys}</span> 
                        <span className="text-[10px] opacity-70"> (Wd:{inning.extras.wides} Nb:{inning.extras.noballs} Lb:{inning.extras.legbys})</span>
                      </div>
                      <div>
                        CRR: <span className="text-blue-400 font-bold">
                          {inning.balls > 0 ? ((inning.runs / inning.balls) * 6).toFixed(2) : '0.00'}
                        </span>
                      </div>
                    </div>

                    {/* Second Inning Target Notification */}
                    {isSecondInning && currentMatch.firstInning && (
                      <div className="bg-blue-600/20 text-blue-300 font-bold text-xs p-1.5 rounded border border-blue-800 mt-2 text-center">
                        🎯 Target: {firstInningRuns + 1} runs • Need { (firstInningRuns + 1) - inning.runs } runs off {currentMatch.settings.isUnlimitedOvers ? 'unlimited' : (currentMatch.settings.overs * 6) - inning.balls} balls.
                      </div>
                    )}
                  </div>

                  {/* BATSMEN DETAILS CARD ROW with On-Click Substitution triggers */}
                  <div className="px-3">
                    <div className="bg-slate-800 rounded-xl border border-slate-700/80 overflow-hidden text-xs shadow">
                      <div className="bg-slate-700/50 px-2.5 py-1.5 text-[10px] font-bold tracking-wider text-slate-400 uppercase flex justify-between">
                        <span>Batsmen (Tap Name to Substitute / Ret Burn)</span>
                        <span>R (B)</span>
                      </div>

                      <div className="p-2 space-y-1.5">
                        {/* Striker Batsman */}
                        {(() => {
                          const str = currentMatch.currentStriker;
                          if (!str) return null;
                          const stats = inning.batsmen[str] || { runs: 0, balls: 0, fours: 0, sixes: 0 };
                          return (
                            <div 
                              onClick={() => { playClickSound(); setShowSwapStrikerModal(true); }}
                              className="flex items-center justify-between p-1.5 rounded bg-blue-950/40 border border-blue-800/40 hover:bg-blue-900/40 transition cursor-pointer"
                              title="Click to quickly change / substitute striker"
                            >
                              <div className="flex items-center gap-1.5 truncate">
                                <span className="text-blue-400 text-xs">🏏</span>
                                <span className="font-extrabold text-white truncate flex items-center gap-1">
                                  {str} * <Edit3 className="w-3 h-3 text-blue-300" />
                                </span>
                                <span className="text-[9px] text-slate-400 italic font-mono">(Striker)</span>
                              </div>
                              <div className="font-mono text-slate-200 font-bold whitespace-nowrap">
                                {stats.runs} <span className="text-slate-400 text-[11px]">({stats.balls})</span>
                                <span className="text-[10px] text-slate-500 font-normal ml-1">4s:{stats.fours} 6s:{stats.sixes}</span>
                              </div>
                            </div>
                          );
                        })()}

                        {/* Non-Striker Batsman */}
                        {currentMatch.settings.isTwoBatsmenMode && (() => {
                          const nonStr = currentMatch.currentNonStriker;
                          if (!nonStr) return (
                            <div className="p-1.5 text-center text-slate-500 bg-slate-900/40 rounded italic text-[11px]">
                              No Non-Striker bound. Click to select.
                            </div>
                          );
                          const stats = inning.batsmen[nonStr] || { runs: 0, balls: 0, fours: 0, sixes: 0 };
                          return (
                            <div 
                              onClick={() => { playClickSound(); setShowSwapNonStrikerModal(true); }}
                              className="flex items-center justify-between p-1.5 rounded bg-slate-900/60 border border-slate-800 hover:bg-slate-850 transition cursor-pointer"
                              title="Click to quickly change / substitute non-striker"
                            >
                              <div className="flex items-center gap-1.5 truncate">
                                <span className="text-slate-400 text-xs">🛡️</span>
                                <span className="font-bold text-slate-300 truncate flex items-center gap-1">
                                  {nonStr} <Edit3 className="w-3 h-3 text-slate-500" />
                                </span>
                              </div>
                              <div className="font-mono text-slate-300 font-bold whitespace-nowrap">
                                {stats.runs} <span className="text-slate-400 text-[11px]">({stats.balls})</span>
                                <span className="text-[10px] text-slate-500 font-normal ml-1">4s:{stats.fours} 6s:{stats.sixes}</span>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </div>

                  {/* CURRENT BOWLER STATUS PILL */}
                  <div className="px-3">
                    {(() => {
                      const bowl = currentMatch.currentBowler;
                      if (!bowl) return null;
                      const stats = inning.bowlers[bowl] || { overs: 0, balls: 0, runs: 0, wickets: 0 };
                      return (
                        <div 
                          onClick={() => { playClickSound(); setShowSwapBowlerModal(true); }}
                          className="bg-slate-800 p-2 rounded-xl border border-slate-700/80 flex items-center justify-between text-xs shadow hover:bg-slate-750 transition cursor-pointer"
                          title="Click to quickly substitute bowler"
                        >
                          <div className="flex items-center gap-2 truncate">
                            <span className="text-amber-400">🥎</span>
                            <span className="font-bold text-slate-200 truncate flex items-center gap-1">
                              {bowl} <Edit3 className="w-3 h-3 text-amber-500" />
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">(Bowler)</span>
                          </div>
                          <div className="font-mono text-amber-400 font-extrabold whitespace-nowrap">
                            {stats.wickets}W - {stats.runs}R <span className="text-slate-400 text-[11px]">({stats.overs}.{stats.balls} ov)</span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* RECENT OVER BALLS LOG STREAM TRACKER */}
                  <div className="px-3">
                    <div className="bg-slate-950 p-2 rounded-xl border border-slate-800 flex items-center gap-2 overflow-x-auto min-h-10">
                      <span className="text-[10px] font-bold text-slate-500 tracking-wider uppercase whitespace-nowrap mr-1">
                        This Over:
                      </span>
                      {inning.currentOverLog.map((ball, i) => {
                        let badgeColor = 'bg-slate-800 text-slate-300';
                        if (ball.type === 'wicket') badgeColor = 'bg-red-600 text-white font-black';
                        if (ball.type === 'wide' || ball.type === 'noball') badgeColor = 'bg-blue-950 text-blue-400 border border-blue-800/40';
                        if (ball.runs === 4 || ball.runs === 6) badgeColor = 'bg-emerald-950 text-emerald-400 font-bold border border-emerald-800/30';
                        return (
                          <span 
                            key={i} 
                            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-mono shrink-0 shadow-sm ${badgeColor}`}
                          >
                            {ball.displayText}
                          </span>
                        );
                      })}
                      {inning.currentOverLog.length === 0 && (
                        <span className="text-xs text-slate-600 italic">Waiting for first delivery...</span>
                      )}
                    </div>
                  </div>

                  {/* CRITICAL ACTION ROW: UNDO, SWAP STRIKE, END MATCH DIRECT ACCESS */}
                  <div className="px-3 grid grid-cols-3 gap-2">
                    <button
                      onClick={handleUndoLastBall}
                      className="bg-amber-600/20 hover:bg-amber-600 text-amber-400 hover:text-white py-1.5 px-2 rounded-lg border border-amber-500/30 transition text-xs font-bold flex items-center justify-center gap-1"
                      title="Undo last ball"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Undo ({matchHistory.length})</span>
                    </button>

                    {currentMatch.settings.isTwoBatsmenMode && currentMatch.currentNonStriker ? (
                      <button
                        onClick={rotateStrike}
                        className="bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white py-1.5 px-2 rounded-lg border border-blue-500/30 transition text-xs font-bold flex items-center justify-center gap-1"
                        title="Quick swap striker strike"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>Swap Strike</span>
                      </button>
                    ) : (
                      <div className="bg-slate-800 text-slate-500 py-1.5 rounded-lg border border-slate-750 text-center text-xs">
                        Solo Bat
                      </div>
                    )}

                    <button
                      onClick={menuEndMatchForce}
                      className="bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white py-1.5 px-2 rounded-lg border border-red-500/30 transition text-xs font-bold flex items-center justify-center gap-1"
                      title="End match right now"
                    >
                      <ShieldAlert className="w-3.5 h-3.5" />
                      <span>End Match</span>
                    </button>
                  </div>

                </div>
              );
            })()}

            {/* BALL SCORING CONTROL PANEL BUTTON MATRIX */}
            <div className="mt-4 bg-slate-950 p-4 border-t border-slate-800 rounded-t-3xl space-y-4">
              <span className="text-[11px] uppercase tracking-wider text-slate-400 font-black block text-center">
                🔥 TOUCH BALL ACTION TO COMMENCE SCORECARD
              </span>

              {/* Row 1: Batting runs */}
              <div className="grid grid-cols-4 gap-2">
                <button
                  onClick={() => scoreNormalRuns(0)}
                  className="py-3 bg-slate-800 hover:bg-slate-700 text-white font-black text-sm rounded-xl border border-slate-700 shadow transition active:scale-95"
                >
                  0 <span className="text-[10px] font-normal block text-slate-400">Dot Ball</span>
                </button>
                <button
                  onClick={() => scoreNormalRuns(1)}
                  className="py-3 bg-slate-800 hover:bg-slate-700 text-white font-black text-sm rounded-xl border border-slate-700 shadow transition active:scale-95"
                >
                  1 <span className="text-[10px] font-normal block text-slate-400">Single</span>
                </button>
                <button
                  onClick={() => scoreNormalRuns(2)}
                  className="py-3 bg-slate-800 hover:bg-slate-700 text-white font-black text-sm rounded-xl border border-slate-700 shadow transition active:scale-95"
                >
                  2 <span className="text-[10px] font-normal block text-slate-400">Double</span>
                </button>
                <button
                  onClick={() => scoreNormalRuns(3)}
                  className="py-3 bg-slate-800 hover:bg-slate-700 text-white font-black text-sm rounded-xl border border-slate-700 shadow transition active:scale-95"
                >
                  3 <span className="text-[10px] font-normal block text-slate-400">Triple</span>
                </button>
              </div>

              {/* Row 2: Boundaries & Wicket */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => scoreNormalRuns(4)}
                  className="py-3 bg-emerald-700 hover:bg-emerald-600 text-white font-black text-sm rounded-xl border border-emerald-500 shadow transition active:scale-95"
                >
                  4 <span className="text-[10px] font-normal block text-emerald-200">FOUR</span>
                </button>
                <button
                  onClick={() => scoreNormalRuns(6)}
                  className="py-3 bg-emerald-800 hover:bg-emerald-700 text-white font-black text-sm rounded-xl border border-emerald-600 shadow transition active:scale-95"
                >
                  6 <span className="text-[10px] font-normal block text-emerald-200">SIX</span>
                </button>
                <button
                  onClick={triggerOutFlow}
                  className="py-3 bg-red-600 hover:bg-red-500 text-white font-black text-sm rounded-xl border border-red-500 shadow transition active:scale-95"
                >
                  OUT 🛑 <span className="text-[10px] font-normal block text-red-100">Wicket</span>
                </button>
              </div>

              {/* Row 3: Modern Cricket Rules Extras (Wide, No-Ball, Leg-By condition based) & CUSTOM RUNS */}
              <div className="grid grid-cols-4 gap-2 pt-1">
                {currentMatch.settings.enableWide ? (
                  <button
                    onClick={() => {
                      playClickSound();
                      setExtraRunsInput(0);
                      setExtraBoundaryOption('running');
                      setShowWideModal(true);
                    }}
                    className="py-2.5 bg-blue-900/90 hover:bg-blue-800 text-blue-200 font-bold text-[10px] rounded-lg border border-blue-800 truncate"
                  >
                    WIDE (+1)
                  </button>
                ) : <div className="text-[10px] text-slate-600 border border-slate-800 p-2 text-center rounded italic">Wide Off</div>}

                {currentMatch.settings.enableNoBall ? (
                  <button
                    onClick={() => {
                      playClickSound();
                      setExtraRunsInput(0);
                      setShowNoBallModal(true);
                    }}
                    className="py-2.5 bg-blue-900/90 hover:bg-blue-800 text-blue-200 font-bold text-[10px] rounded-lg border border-blue-800 truncate"
                  >
                    NO-BALL (+1)
                  </button>
                ) : <div className="text-[10px] text-slate-600 border border-slate-800 p-2 text-center rounded italic">NoBall Off</div>}

                {currentMatch.settings.enableLegBy ? (
                  <button
                    onClick={() => {
                      playClickSound();
                      setExtraRunsInput(1);
                      setShowLegByModal(true);
                    }}
                    className="py-2.5 bg-blue-900/90 hover:bg-blue-800 text-blue-200 font-bold text-[10px] rounded-lg border border-blue-800 truncate"
                  >
                    LEG-BY
                  </button>
                ) : <div className="text-[10px] text-slate-600 border border-slate-800 p-2 text-center rounded italic">LegBy Off</div>}

                <button
                  onClick={() => {
                    playClickSound();
                    setCustomRunsValue(5);
                    setCustomRunType('normal');
                    setCustomIsBoundary(false);
                    setShowCustomRunsModal(true);
                  }}
                  className="py-2.5 bg-indigo-900/90 hover:bg-indigo-800 text-indigo-200 font-bold text-[10px] rounded-lg border border-indigo-800 flex items-center justify-center gap-0.5"
                  title="Record custom overthrow runs or specific conditions"
                >
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  <span>CUSTOM</span>
                </button>
              </div>

            </div>

          </div>
        )}


        {/* ==================== PAGE 2.1: SHOW MATCHES (LIVE & SAVED RESTORATION) ==================== */}
        {currentPage === 'show_matches' && (
          <div className="flex-1 p-4 space-y-4 bg-slate-900 overflow-y-auto">
            <div className="space-y-2">
              <label className="text-xs uppercase font-bold text-slate-400 block tracking-wider">
                Search Saved or Simulated Live Matches
              </label>
              
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search team names, winner description..."
                  value={matchSearch}
                  onChange={(e) => setMatchSearch(e.target.value)}
                  className="w-full bg-slate-800 rounded-xl p-2.5 pl-9 text-xs text-white border border-slate-700 focus:outline-none"
                />
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              </div>
            </div>

            {/* Simulated Live Matches and Saved Data */}
            <div className="space-y-3">
              <span className="text-[11px] font-black tracking-wider text-blue-400 block uppercase px-1">
                Active Match Catalog Database ({allMatches.length})
              </span>

              {allMatches
                .filter(m => {
                  const query = matchSearch.toLowerCase();
                  return m.teamA.toLowerCase().includes(query) || 
                         m.teamB.toLowerCase().includes(query) || 
                         (m.resultDescription && m.resultDescription.toLowerCase().includes(query)) ||
                         m.id.includes(query);
                })
                .map((match, idx) => {
                  const isLive = match.status === 'live';
                  return (
                    <div 
                      key={idx} 
                      className="bg-slate-800/90 rounded-xl border border-slate-700 p-3.5 space-y-2 shadow-md relative group hover:border-blue-500 transition"
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-mono text-slate-400">ID: {match.id || 'N/A'}</span>
                        
                        {isLive ? (
                          <span className="bg-red-600/20 text-red-400 border border-red-900/60 font-black text-[10px] uppercase px-2 py-0.5 rounded animate-pulse">
                            ● Live Scoring
                          </span>
                        ) : (
                          <span className="bg-emerald-600/20 text-emerald-400 font-bold text-[10px] px-2 py-0.5 rounded">
                            ✓ Completed
                          </span>
                        )}
                      </div>

                      <div className="text-sm font-black text-white flex justify-between items-center">
                        <span className="truncate">{match.teamA}</span>
                        <span className="text-xs font-normal text-slate-500 mx-2">vs</span>
                        <span className="truncate text-right">{match.teamB}</span>
                      </div>

                      {/* Display live or completed status info */}
                      {match.firstInning && (
                        <div className="text-xs bg-slate-900/60 p-2 rounded border border-slate-750 font-mono text-slate-300 space-y-0.5">
                          <div>
                            🏏 {match.firstInning.battingTeam}: <span className="text-white font-bold">{match.firstInning.runs}/{match.firstInning.wickets}</span> ({Math.floor(match.firstInning.balls/6)}.{match.firstInning.balls%6} ov)
                          </div>
                          {match.secondInning && (
                            <div>
                              🏏 {match.secondInning.battingTeam}: <span className="text-white font-bold">{match.secondInning.runs}/{match.secondInning.wickets}</span> ({Math.floor(match.secondInning.balls/6)}.{match.secondInning.balls%6} ov)
                            </div>
                          )}
                        </div>
                      )}

                      {match.resultDescription && (
                        <p className="text-xs text-amber-400 font-medium italic">
                          🏆 {match.resultDescription}
                        </p>
                      )}

                      {/* Three-dots or Click triggers password modal auth to rewrite or score remaining */}
                      <div className="pt-2 flex gap-2">
                        <button
                          onClick={() => handleOpenLiveView(match)}
                          className="flex-1 text-xs font-bold text-blue-300 hover:text-white bg-blue-950 hover:bg-blue-900 px-2.5 py-1.5 rounded border border-blue-900 flex items-center justify-center gap-1 active:scale-95 transition"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>View Scorecard</span>
                        </button>
                        {isLive && (
                          <button
                            onClick={() => handleOpenResumeLiveMatchAuth(match)}
                            className="text-xs font-bold text-blue-400 hover:text-blue-300 bg-blue-950 px-2.5 py-1.5 rounded border border-blue-900 flex items-center gap-1 active:scale-95 transition"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span>Resume</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}

              {allMatches.length === 0 && (
                <div className="text-center p-8 bg-slate-800/40 border border-slate-700/50 rounded-2xl text-slate-400 text-xs italic">
                  No matches available in database yet. Click "Start a Match" on the home panel menu options to originate one!
                </div>
              )}
            </div>
          </div>
        )}


        {/* ==================== PAGE 3.1: STATS & CAREER LEADERBOARDS ==================== */}
        {currentPage === 'stats' && (
          <div className="flex-1 p-4 space-y-4 bg-slate-900 overflow-y-auto">
            
            {/* Search Input widget */}
            <div className="space-y-2">
              <label className="text-xs uppercase font-bold text-slate-400 block tracking-wider">
                Search Registered Player Metrics
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Type player name..."
                  value={playerSearch}
                  onChange={(e) => setPlayerSearch(e.target.value)}
                  className="w-full bg-slate-800 rounded-xl p-2.5 pl-9 text-xs text-white border border-slate-700 focus:outline-none focus:border-blue-500"
                />
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              </div>
            </div>

            {/* Leaderboard Tabs toggle buttons */}
            <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button
                onClick={() => { playClickSound(); setActiveStatsTab('batting'); }}
                className={`py-2 text-xs font-black rounded-lg transition uppercase ${
                  activeStatsTab === 'batting' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                🏏 Batting Runs
              </button>
              <button
                onClick={() => { playClickSound(); setActiveStatsTab('bowling'); }}
                className={`py-2 text-xs font-black rounded-lg transition uppercase ${
                  activeStatsTab === 'bowling' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                🥎 Wickets Leader
              </button>
            </div>

            {/* List entries layout */}
            <div className="space-y-2">
              {allPlayers
                .filter(p => p.name.toLowerCase().includes(playerSearch.toLowerCase()))
                .sort((a, b) => activeStatsTab === 'batting' ? b.runs - a.runs : b.wickets - a.wickets)
                .map((player, i) => (
                  <div 
                    key={i}
                    className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/60 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-3 truncate">
                      <span className="font-mono font-bold text-slate-500 w-5 text-right">{i + 1}.</span>
                      <div className="truncate">
                        <span className="font-extrabold text-white block truncate">{player.name}</span>
                        <span className="text-[10px] text-slate-400 block font-mono">
                          Matches: {player.matchPlayed || 1} • Fours: {player.fours} • Sixes: {player.sixes}
                        </span>
                      </div>
                    </div>

                    <div className="text-right shrink-0 font-mono">
                      {activeStatsTab === 'batting' ? (
                        <div>
                          <span className="text-sm font-black text-blue-400">{player.runs}</span>
                          <span className="text-[10px] text-slate-400 block">Runs ({player.ballsPlayed}b)</span>
                        </div>
                      ) : (
                        <div>
                          <span className="text-sm font-black text-amber-400">{player.wickets}</span>
                          <span className="text-[10px] text-slate-400 block">Wickets ({Math.floor(player.ballsThrown/6)} ov)</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
            </div>

          </div>
        )}


        {/* ==================== VICTORY & SUMMARY SCORECARDS PAGE ==================== */}
        {currentPage === 'victory' && currentMatch && (
          <div className="flex-1 bg-slate-900 p-4 space-y-4 overflow-y-auto">
            
            <div className="bg-blue-900 rounded-3xl p-5 border border-blue-500/30 text-center space-y-2 shadow-xl shadow-black/40">
              <Award className="w-14 h-14 text-yellow-400 mx-auto animate-bounce" />
              <h2 className="text-2xl font-black tracking-tight text-white uppercase">Victory Celebration</h2>
              <p className="text-amber-400 font-extrabold text-sm px-2 py-1 bg-slate-950/60 rounded-xl border border-amber-900/40">
                🏆 {currentMatch.resultDescription || 'Match Concluded Successfully!'}
              </p>
              <div className="text-[11px] text-indigo-200">
                All player runs, wickets, boundaries, and bowling econ aggregates have been synchronized with lifetime leaderboard tables.
              </div>
            </div>

            {/* FULL COMPREHENSIVE SCORECARDS RENDERING */}
            <h3 className="text-xs uppercase tracking-wider font-black text-slate-400 px-1 mt-4">
              Detailed Match Innings Log Report
            </h3>

            {/* Inning 1 Scorecard */}
            {currentMatch.firstInning && (
              <div className="bg-slate-800 rounded-xl border border-slate-700 p-3 text-xs space-y-2">
                <div className="text-blue-400 font-black border-b border-slate-700 pb-1 flex justify-between uppercase">
                  <span>1. {currentMatch.firstInning.battingTeam} Batting Scorecard</span>
                  <span className="text-white">{currentMatch.firstInning.runs}/{currentMatch.firstInning.wickets}</span>
                </div>
                <div className="space-y-1">
                  {Object.values(currentMatch.firstInning.batsmen).map((b, i) => (
                    <div key={i} className="flex justify-between text-slate-300 font-mono text-[11px]">
                      <span className="truncate max-w-[180px]">{b.name}</span>
                      <span>{b.runs} runs ({b.balls}b) {b.howOut ? `• ${b.howOut}` : '• DNB'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Inning 2 Scorecard */}
            {currentMatch.secondInning && (
              <div className="bg-slate-800 rounded-xl border border-slate-700 p-3 text-xs space-y-2">
                <div className="text-indigo-400 font-black border-b border-slate-700 pb-1 flex justify-between uppercase">
                  <span>2. {currentMatch.secondInning.battingTeam} Batting Scorecard</span>
                  <span className="text-white">{currentMatch.secondInning.runs}/{currentMatch.secondInning.wickets}</span>
                </div>
                <div className="space-y-1">
                  {Object.values(currentMatch.secondInning.batsmen).map((b, i) => (
                    <div key={i} className="flex justify-between text-slate-300 font-mono text-[11px]">
                      <span className="truncate max-w-[180px]">{b.name}</span>
                      <span>{b.runs} runs ({b.balls}b) {b.howOut ? `• ${b.howOut}` : '• DNB'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={() => navigateWithSound('home')}
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 font-black text-white rounded-xl shadow mt-4 flex items-center justify-center gap-2"
            >
              <Home className="w-4 h-4" />
              <span>RETURN TO HOME MAIN HUB</span>
            </button>
          </div>
        )}


        {/* ==================== LIVE VIEW SPECTATOR PAGE (FULL SCORECARD) ==================== */}
        {currentPage === 'live_view' && viewMatch && (
          <div className="flex-1 bg-slate-900 overflow-y-auto">
            {/* LIVE VIEW HEADER */}
            <div className="bg-blue-800 p-4 border-b border-blue-600/30 sticky top-0 z-40">
              <div className="flex items-center justify-between mb-2">
                <button
                  onClick={() => navigateWithSound('show_matches')}
                  className="p-1.5 hover:bg-white/10 rounded-full text-blue-200 transition"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="text-center">
                  <span className="text-[10px] uppercase font-bold text-blue-300 tracking-wider">LIVE SCORECARD</span>
                  <h2 className="text-sm font-black text-white">Match ID: {viewMatch.id}</h2>
                </div>
                <div className="w-10"></div>
              </div>
              
              {/* Match Status Banner */}
              <div className="flex items-center justify-between gap-2">
                <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold ${
                  viewMatch.status === 'live' 
                    ? 'bg-red-600/20 text-red-400 border border-red-500/40 animate-pulse' 
                    : 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/40'
                }`}>
                  {viewMatch.status === 'live' ? 'LIVE' : 'COMPLETED'}
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-black uppercase tracking-wider text-blue-200">
                    Auto refresh 1s
                  </div>
                  <div className="font-mono text-[10px] text-blue-100/60">
                    Updated {new Date(liveViewUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 space-y-4">
              {/* LIVE STREAM SNAPSHOT */}
              {(() => {
                const liveInning = viewMatch.currentInningIndex === 1 ? viewMatch.firstInning : viewMatch.secondInning;
                if (!liveInning) return null;
                const striker = viewMatch.currentStriker ? liveInning.batsmen[viewMatch.currentStriker] : undefined;
                const nonStriker = viewMatch.currentNonStriker ? liveInning.batsmen[viewMatch.currentNonStriker] : undefined;
                const bowler = viewMatch.currentBowler ? liveInning.bowlers[viewMatch.currentBowler] : undefined;
                const totalOvers = `${Math.floor(liveInning.balls / 6)}.${liveInning.balls % 6}`;

                return (
                  <div className="rounded-2xl border border-blue-500/30 bg-slate-900 p-4 shadow-xl shadow-blue-950/30">
                    <div className="mb-2 flex items-center justify-between">
                      <div>
                        <div className="text-[10px] font-black uppercase tracking-[0.22em] text-blue-300">Streaming Now</div>
                        <div className="text-sm font-black text-white">{liveInning.battingTeam}</div>
                      </div>
                      <div className="text-right font-mono">
                        <div className="text-3xl font-black text-white">{liveInning.runs}/{liveInning.wickets}</div>
                        <div className="text-[11px] font-bold text-blue-200">{totalOvers} overs</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-xl border border-slate-700/80 bg-slate-950/70 p-2">
                        <div className="text-[10px] font-bold uppercase text-slate-500">Striker</div>
                        <div className="truncate font-black text-blue-300">{viewMatch.currentStriker || '-'}</div>
                        <div className="font-mono text-slate-300">{striker ? `${striker.runs} (${striker.balls})` : '0 (0)'}</div>
                      </div>
                      <div className="rounded-xl border border-slate-700/80 bg-slate-950/70 p-2">
                        <div className="text-[10px] font-bold uppercase text-slate-500">Bowler</div>
                        <div className="truncate font-black text-amber-300">{viewMatch.currentBowler || '-'}</div>
                        <div className="font-mono text-slate-300">{bowler ? `${bowler.wickets}/${bowler.runs} (${bowler.overs}.${bowler.balls})` : '0/0 (0.0)'}</div>
                      </div>
                      {viewMatch.settings.isTwoBatsmenMode && (
                        <div className="col-span-2 rounded-xl border border-slate-700/80 bg-slate-950/70 p-2">
                          <div className="text-[10px] font-bold uppercase text-slate-500">Non-striker</div>
                          <div className="truncate font-black text-slate-200">{viewMatch.currentNonStriker || '-'}</div>
                          <div className="font-mono text-slate-300">{nonStriker ? `${nonStriker.runs} (${nonStriker.balls})` : '0 (0)'}</div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* MATCH SUMMARY CARD */}
              <div className="bg-slate-800 rounded-2xl border border-slate-700 p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">Match Up</span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {viewMatch.settings.isUnlimitedOvers ? 'Unlimited Overs' : `${viewMatch.settings.overs} Overs`}
                  </span>
                </div>
                
                <div className="text-center py-2">
                  <div className="flex items-center justify-center gap-2 text-sm">
                    <span className="font-bold text-white">{viewMatch.teamA}</span>
                    <span className="text-blue-400 font-black">vs</span>
                    <span className="font-bold text-white">{viewMatch.teamB}</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    {viewMatch.tossWinner} won toss & elected to {viewMatch.tossChoice === 'bat' ? 'bat' : 'field'} first
                  </p>
                </div>

                {viewMatch.resultDescription && (
                  <div className="bg-amber-950/30 border border-amber-900/40 rounded-xl p-2.5 text-center">
                    <p className="text-xs font-black text-amber-400">🏆 {viewMatch.resultDescription}</p>
                  </div>
                )}
              </div>

              {/* INNINGS 1 FULL SCORECARD */}
              {viewMatch.firstInning && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="h-px bg-slate-700 flex-1"></div>
                    <span className="text-xs font-black text-blue-400 uppercase tracking-wider">1st Innings</span>
                    <div className="h-px bg-slate-700 flex-1"></div>
                  </div>

                  {/* Batting Stats */}
                  <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                    <div className="bg-slate-900 p-2.5 flex justify-between items-center border-b border-slate-700">
                      <span className="text-xs font-black text-blue-400 uppercase tracking-wider">🏏 Batting</span>
                      <span className="text-sm font-black text-white">
                        {viewMatch.firstInning.runs}/{viewMatch.firstInning.wickets} 
                        <span className="text-xs text-slate-400 ml-1">
                          ({Math.floor(viewMatch.firstInning.balls/6)}.{viewMatch.firstInning.balls%6})
                        </span>
                      </span>
                    </div>
                    <div className="p-2 space-y-1.5 max-h-64 overflow-y-auto">
                      {Object.values(viewMatch.firstInning.batsmen)
                        .sort((a, b) => b.runs - a.runs || b.balls - a.balls)
                        .map((b, i) => (
                          <div key={i} className="flex items-center justify-between p-2 bg-slate-900/50 rounded-lg border border-slate-750 text-xs">
                            <div className="flex items-center gap-2 truncate">
                              <span className="text-[10px] font-mono text-slate-500 w-4">{i + 1}.</span>
                              <span className="font-bold text-white truncate max-w-[140px]">{b.name}</span>
                              {b.howOut && (
                                <span className="text-[10px] text-red-400 bg-red-950/30 px-1.5 py-0.5 rounded border border-red-900/40 truncate max-w-[100px]">
                                  {b.howOut}
                                </span>
                              )}
                              {!b.howOut && viewMatch.currentInningIndex === 1 && (
                                <span className="text-[10px] text-emerald-400 bg-emerald-950/30 px-1.5 py-0.5 rounded border border-emerald-900/40">
                                  * {b.runs}
                                </span>
                              )}
                            </div>
                            <div className="text-right font-mono">
                              <span className="font-black text-blue-400">{b.runs}</span>
                              <span className="text-slate-400 text-[10px] ml-1">({b.balls})</span>
                              {b.fours > 0 || b.sixes > 0 && (
                                <span className="text-[9px] text-slate-500 ml-1">4:{b.fours} 6:{b.sixes}</span>
                              )}
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>

                  {/* Bowling Stats */}
                  <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                    <div className="bg-slate-900 p-2.5 flex justify-between items-center border-b border-slate-700">
                      <span className="text-xs font-black text-amber-400 uppercase tracking-wider">🥎 Bowling</span>
                    </div>
                    <div className="p-2 space-y-1.5">
                      {Object.values(viewMatch.firstInning.bowlers)
                        .filter(b => b.overs > 0 || b.balls > 0)
                        .sort((a, b) => b.wickets - a.wickets || a.runs - b.runs)
                        .map((b, i) => (
                          <div key={i} className="flex items-center justify-between p-2 bg-slate-900/50 rounded-lg border border-slate-750 text-xs">
                            <span className="font-bold text-white">{b.name}</span>
                            <div className="text-right font-mono">
                              <span className="font-black text-amber-400">{b.wickets}W</span>
                              <span className="text-slate-400 text-[10px] ml-1">{b.runs}R</span>
                              <span className="text-slate-400 text-[10px] ml-1">({b.overs}.{b.balls})</span>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>

                  {/* Extras Breakdown */}
                  <div className="bg-slate-800 rounded-xl border border-slate-700 p-3">
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Extras</div>
                    <div className="grid grid-cols-4 gap-2 text-center">
                      <div className="bg-slate-900 rounded-lg p-2">
                        <span className="text-[10px] text-slate-500 block">Wides</span>
                        <span className="text-sm font-black text-blue-400">{viewMatch.firstInning.extras.wides}</span>
                      </div>
                      <div className="bg-slate-900 rounded-lg p-2">
                        <span className="text-[10px] text-slate-500 block">No Balls</span>
                        <span className="text-sm font-black text-blue-400">{viewMatch.firstInning.extras.noballs}</span>
                      </div>
                      <div className="bg-slate-900 rounded-lg p-2">
                        <span className="text-[10px] text-slate-500 block">Leg Byes</span>
                        <span className="text-sm font-black text-blue-400">{viewMatch.firstInning.extras.legbys}</span>
                      </div>
                      <div className="bg-slate-900 rounded-lg p-2">
                        <span className="text-[10px] text-slate-500 block">Total</span>
                        <span className="text-sm font-black text-white">
                          {viewMatch.firstInning.extras.wides + viewMatch.firstInning.extras.noballs + viewMatch.firstInning.extras.legbys}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* INNINGS 2 FULL SCORECARD */}
              {viewMatch.secondInning && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="h-px bg-slate-700 flex-1"></div>
                    <span className="text-xs font-black text-indigo-400 uppercase tracking-wider">2nd Innings</span>
                    <div className="h-px bg-slate-700 flex-1"></div>
                  </div>

                  {/* Target Display */}
                  <div className="bg-blue-950/40 border border-blue-900/60 rounded-xl p-3 text-center">
                    <span className="text-xs font-bold text-blue-300 uppercase tracking-wider">Target</span>
                    <p className="text-sm font-black text-white mt-1">
                      {viewMatch.firstInning!.runs + 1} runs needed
                    </p>
                  </div>

                  {/* Batting Stats */}
                  <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                    <div className="bg-slate-900 p-2.5 flex justify-between items-center border-b border-slate-700">
                      <span className="text-xs font-black text-blue-400 uppercase tracking-wider">🏏 Batting</span>
                      <span className="text-sm font-black text-white">
                        {viewMatch.secondInning.runs}/{viewMatch.secondInning.wickets}
                        <span className="text-xs text-slate-400 ml-1">
                          ({Math.floor(viewMatch.secondInning.balls/6)}.{viewMatch.secondInning.balls%6})
                        </span>
                      </span>
                    </div>
                    <div className="p-2 space-y-1.5 max-h-64 overflow-y-auto">
                      {Object.values(viewMatch.secondInning.batsmen)
                        .sort((a, b) => b.runs - a.runs || b.balls - a.balls)
                        .map((b, i) => (
                          <div key={i} className="flex items-center justify-between p-2 bg-slate-900/50 rounded-lg border border-slate-750 text-xs">
                            <div className="flex items-center gap-2 truncate">
                              <span className="text-[10px] font-mono text-slate-500 w-4">{i + 1}.</span>
                              <span className="font-bold text-white truncate max-w-[140px]">{b.name}</span>
                              {b.howOut && (
                                <span className="text-[10px] text-red-400 bg-red-950/30 px-1.5 py-0.5 rounded border border-red-900/40 truncate max-w-[100px]">
                                  {b.howOut}
                                </span>
                              )}
                              {!b.howOut && viewMatch.currentInningIndex === 2 && (
                                <span className="text-[10px] text-emerald-400 bg-emerald-950/30 px-1.5 py-0.5 rounded border border-emerald-900/40">
                                  * {b.runs}
                                </span>
                              )}
                            </div>
                            <div className="text-right font-mono">
                              <span className="font-black text-blue-400">{b.runs}</span>
                              <span className="text-slate-400 text-[10px] ml-1">({b.balls})</span>
                              {b.fours > 0 || b.sixes > 0 && (
                                <span className="text-[9px] text-slate-500 ml-1">4:{b.fours} 6:{b.sixes}</span>
                              )}
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>

                  {/* Bowling Stats */}
                  <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                    <div className="bg-slate-900 p-2.5 flex justify-between items-center border-b border-slate-700">
                      <span className="text-xs font-black text-amber-400 uppercase tracking-wider">🥎 Bowling</span>
                    </div>
                    <div className="p-2 space-y-1.5">
                      {Object.values(viewMatch.secondInning.bowlers)
                        .filter(b => b.overs > 0 || b.balls > 0)
                        .sort((a, b) => b.wickets - a.wickets || a.runs - b.runs)
                        .map((b, i) => (
                          <div key={i} className="flex items-center justify-between p-2 bg-slate-900/50 rounded-lg border border-slate-750 text-xs">
                            <span className="font-bold text-white">{b.name}</span>
                            <div className="text-right font-mono">
                              <span className="font-black text-amber-400">{b.wickets}W</span>
                              <span className="text-slate-400 text-[10px] ml-1">{b.runs}R</span>
                              <span className="text-slate-400 text-[10px] ml-1">({b.overs}.{b.balls})</span>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>

                  {/* Extras Breakdown */}
                  <div className="bg-slate-800 rounded-xl border border-slate-700 p-3">
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Extras</div>
                    <div className="grid grid-cols-4 gap-2 text-center">
                      <div className="bg-slate-900 rounded-lg p-2">
                        <span className="text-[10px] text-slate-500 block">Wides</span>
                        <span className="text-sm font-black text-blue-400">{viewMatch.secondInning.extras.wides}</span>
                      </div>
                      <div className="bg-slate-900 rounded-lg p-2">
                        <span className="text-[10px] text-slate-500 block">No Balls</span>
                        <span className="text-sm font-black text-blue-400">{viewMatch.secondInning.extras.noballs}</span>
                      </div>
                      <div className="bg-slate-900 rounded-lg p-2">
                        <span className="text-[10px] text-slate-500 block">Leg Byes</span>
                        <span className="text-sm font-black text-blue-400">{viewMatch.secondInning.extras.legbys}</span>
                      </div>
                      <div className="bg-slate-900 rounded-lg p-2">
                        <span className="text-[10px] text-slate-500 block">Total</span>
                        <span className="text-sm font-black text-white">
                          {viewMatch.secondInning.extras.wides + viewMatch.secondInning.extras.noballs + viewMatch.secondInning.extras.legbys}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* OVER BY OVER BREAKDOWN */}
              {viewMatch.firstInning && viewMatch.firstInning.oversLog.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="h-px bg-slate-700 flex-1"></div>
                    <span className="text-xs font-black text-slate-400 uppercase tracking-wider">Over-by-Over</span>
                    <div className="h-px bg-slate-700 flex-1"></div>
                  </div>
                  
                  <div className="bg-slate-800 rounded-xl border border-slate-700 p-3">
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {viewMatch.firstInning.oversLog.map((over, i) => {
                        const overRuns = over.reduce((sum, ball) => sum + ball.runs, 0);
                        return (
                          <div key={i} className="flex items-center gap-2">
                            <span className="text-[10px] font-mono text-slate-500 w-6">{i + 1}.</span>
                            <div className="flex-1 flex gap-1 overflow-x-auto">
                              {over.map((ball, j) => {
                                let badgeColor = 'bg-slate-700 text-slate-300';
                                if (ball.type === 'wicket') badgeColor = 'bg-red-600 text-white';
                                if (ball.runs === 4) badgeColor = 'bg-emerald-700 text-white';
                                if (ball.runs === 6) badgeColor = 'bg-emerald-800 text-white';
                                if (ball.type === 'wide' || ball.type === 'noball') badgeColor = 'bg-blue-900 text-blue-300';
                                return (
                                  <span key={j} className={`text-[9px] font-mono w-5 h-5 rounded flex items-center justify-center shrink-0 ${badgeColor}`}>
                                    {ball.displayText}
                                  </span>
                                );
                              })}
                            </div>
                            <span className="text-[10px] font-mono text-slate-400 w-8 text-right">({overRuns})</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* NAVIGATION BUTTONS */}
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => navigateWithSound('show_matches')}
                  className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 font-bold text-slate-300 rounded-xl border border-slate-700 text-xs flex items-center justify-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to Matches</span>
                </button>
                <button
                  onClick={() => navigateWithSound('home')}
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 font-black text-white rounded-xl shadow text-xs flex items-center justify-center gap-2"
                >
                  <Home className="w-4 h-4" />
                  <span>Home</span>
                </button>
              </div>

            </div>
          </div>
        )}


        {/* ========================================================================= */}
        {/* ==================== INTERACTIVE FLOATING MODAL OVERLAYS ================= */}
        {/* ========================================================================= */}

        {/* APP NOTIFICATION MODAL */}
        {notification && (
          <div className="absolute inset-x-0 top-16 z-[90] flex justify-center px-4 pointer-events-none">
            <div className={`pointer-events-auto w-full max-w-xs rounded-2xl border p-4 shadow-2xl ${
              notification.type === 'success'
                ? 'border-emerald-500/40 bg-emerald-950 text-emerald-50'
                : notification.type === 'error'
                  ? 'border-red-500/40 bg-red-950 text-red-50'
                  : notification.type === 'warning'
                    ? 'border-amber-500/40 bg-amber-950 text-amber-50'
                    : 'border-blue-500/40 bg-blue-950 text-blue-50'
            }`}>
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                  notification.type === 'success'
                    ? 'bg-emerald-600'
                    : notification.type === 'error'
                      ? 'bg-red-600'
                      : notification.type === 'warning'
                        ? 'bg-amber-600'
                        : 'bg-blue-600'
                }`}>
                  {notification.type === 'success' ? <Check className="h-4 w-4 text-white" /> : <ShieldAlert className="h-4 w-4 text-white" />}
                </div>
                <div className="min-w-0 flex-1 text-left">
                  <div className="text-sm font-black uppercase tracking-wide text-white">{notification.title}</div>
                  <div className="mt-1 text-xs font-semibold leading-relaxed text-white/80">{notification.message}</div>
                </div>
                <button
                  onClick={() => setNotification(null)}
                  className="rounded-full px-2 py-0.5 text-lg font-black leading-none text-white/70 hover:bg-white/10 hover:text-white"
                  aria-label="Dismiss notification"
                >
                  x
                </button>
              </div>
            </div>
          </div>
        )}

        {/* THEME SWITCHER MODAL */}
        {showThemeModal && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[95]">
            <div className="w-full max-w-xs rounded-2xl border border-slate-700 bg-slate-800 p-5 shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-black text-white">Select Theme</h3>
                <button onClick={() => setShowThemeModal(false)} className="text-slate-400 hover:text-white">
                  <Check className="w-5 h-5 rotate-45" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {themes.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      setTheme(t.id);
                      setShowThemeModal(false);
                    }}
                    className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition ${
                      theme === t.id
                        ? 'border-blue-500 bg-blue-950/50'
                        : 'border-slate-700 bg-slate-900 hover:bg-slate-700'
                    }`}
                  >
                    <div className={`h-8 w-8 rounded-full ${t.bg} border-2 border-white/20`} />
                    <span className="text-[10px] font-bold text-slate-300 text-center">{t.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 1. CANCEL MATCH PROTOCOL CONFIRM PROMPT */}
        {showCancelPrompt && (
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
            <div className="bg-slate-800 p-5 rounded-2xl border border-red-500/30 w-full max-w-xs text-center space-y-4 shadow-2xl">
              <ShieldAlert className="w-12 h-12 text-red-500 mx-auto" />
              <div className="space-y-1">
                <h4 className="text-base font-black text-white">Cancel Ongoing Match?</h4>
                <p className="text-xs text-slate-400">
                  This will discard active batting parameters, remove temporary state configurations and return directly to the main dashboard.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => { playClickSound(); setShowCancelPrompt(false); }}
                  className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 font-bold rounded-lg text-xs"
                >
                  No, Keep Data
                </button>
                <button
                  onClick={confirmCancelMatch}
                  className="flex-1 py-2 bg-red-600 hover:bg-red-500 text-white font-black rounded-lg text-xs"
                >
                  Yes, Remove Match
                </button>
              </div>
            </div>
          </div>
        )}


        {/* THREE DOTS ACTION MENU DRAWER (8 MANDATORY ITEMS WITH PASSWORD ID AT TOP) */}
        {showThreeDotsMenu && currentMatch && (
          <div className="absolute inset-x-0 top-12 bg-slate-900 border-b-2 border-blue-600 shadow-2xl z-50 p-4 rounded-b-2xl space-y-3 text-xs animate-slide-down">
            
            {/* Password Id copy block */}
            <div className="bg-slate-950 p-2 rounded-lg border border-slate-800 flex justify-between items-center font-mono">
              <div>
                <span className="text-[10px] text-slate-400 block">ID: <span className="text-blue-400 font-bold">{currentMatch.id}</span></span>
                <span className="text-[10px] text-slate-400 block">PASSWORD: <span className="text-emerald-400 font-bold">{currentMatch.password}</span></span>
              </div>
              <button
                onClick={() => {
                  copyToClipboard(`ID: ${currentMatch.id} | Pass: ${currentMatch.password}`);
                  alert('Match credentials copied to clipboard!');
                }}
                className="p-1.5 bg-blue-600/30 text-blue-300 hover:bg-blue-600 hover:text-white rounded transition"
                title="Hold & click to copy credentials"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1 font-semibold text-slate-200">
              {/* Option 0 */}
              <button
                onClick={menuChangeStrike}
                className="p-2.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-left border border-slate-700 flex items-center gap-2"
              >
                <span className="text-blue-400">0.</span> Change Strike
              </button>

              {/* Option 1 */}
              <button
                onClick={menuOpenAddPlayer}
                className="p-2.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-left border border-slate-700 flex items-center gap-2"
              >
                <span className="text-blue-400">1.</span> Add Player Mid-match
              </button>

              {/* Option 2 */}
              <button
                onClick={menuEndOverDots}
                className="p-2.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-left border border-slate-700 flex items-center gap-2"
              >
                <span className="text-blue-400">2.</span> End Over (Dots)
              </button>

              {/* Option 3 */}
              <button
                onClick={menuTimeoutBatsman}
                className="p-2.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-left border border-slate-700 flex items-center gap-2"
              >
                <span className="text-blue-400">3.</span> Timeout Batsman
              </button>

              {/* Option 4 */}
              <button
                onClick={menuPermanentOutBatsman}
                className="p-2.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-left border border-slate-700 flex items-center gap-2"
              >
                <span className="text-blue-400">4.</span> Per. Out Batsman
              </button>

              {/* Option 5 */}
              <button
                onClick={menuMiniOverChangeBowler}
                className="p-2.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-left border border-slate-700 flex items-center gap-2"
              >
                <span className="text-blue-400">5.</span> Mini Over (Bowler)
              </button>

              {/* Option 6 */}
              <button
                onClick={menuEndInningForce}
                className="p-2.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-left border border-slate-700 flex items-center gap-2"
              >
                <span className="text-blue-400">6.</span> End Inning Force
              </button>

              {/* Option 7 */}
              <button
                onClick={menuEndMatchForce}
                className="p-2.5 bg-red-950/80 hover:bg-red-900/40 text-red-300 rounded-lg text-left border border-red-900/40 flex items-center gap-2"
              >
                <span className="text-red-400">7.</span> End Match Warning
              </button>
            </div>

            <button
              onClick={() => setShowThreeDotsMenu(false)}
              className="w-full text-center py-2 bg-slate-950 text-slate-400 hover:text-white rounded font-bold"
            >
              × Dismiss Settings Menu
            </button>
          </div>
        )}


        {/* QUICK STRIKER SUBSTITUTE OVERLAY */}
        {showSwapStrikerModal && currentMatch && (
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-slate-800 p-4 rounded-xl border border-blue-500 max-w-xs w-full space-y-3 text-xs">
              <h4 className="text-sm font-black text-white flex items-center gap-2 text-blue-400">
                <UserCheck className="w-4 h-4" />
                <span>Substitute Striker Batsman</span>
              </h4>
              <p className="text-[11px] text-slate-400 leading-tight">
                Instantly swap your active striker with any teammate from the team pool. Recommended for injuries, retired-out tactical moves, or custom order changes.
              </p>

              <div className="space-y-1 max-h-48 overflow-y-auto p-1 bg-slate-950 rounded-lg border border-slate-850">
                {(currentMatch.currentInningIndex === 1
                  ? (currentMatch.tossChoice === 'bat' ? (currentMatch.tossWinner === currentMatch.teamA ? currentMatch.teamAPlayers : currentMatch.teamBPlayers) : (currentMatch.tossWinner === currentMatch.teamA ? currentMatch.teamBPlayers : currentMatch.teamAPlayers))
                  : (currentMatch.tossChoice === 'field' ? (currentMatch.tossWinner === currentMatch.teamA ? currentMatch.teamAPlayers : currentMatch.teamBPlayers) : (currentMatch.tossWinner === currentMatch.teamA ? currentMatch.teamBPlayers : currentMatch.teamAPlayers))
                )
                .filter(name => name !== currentMatch.currentNonStriker)
                .map((name, i) => {
                  const isCurrent = currentMatch.currentStriker === name;
                  return (
                    <div
                      key={i}
                      onClick={() => handleSubstituteStriker(name)}
                      className={`p-2 rounded mb-1 text-left font-bold cursor-pointer transition flex items-center justify-between ${
                        isCurrent 
                          ? 'bg-blue-600 text-white' 
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      <span>{name}</span>
                      {isCurrent && <span className="text-[9px] bg-slate-900 px-1.5 py-0.5 rounded text-blue-300 font-mono">Current Striker</span>}
                    </div>
                  );
                })}
              </div>

              <div className="flex gap-2 pt-1">
                <button 
                  onClick={() => setShowSwapStrikerModal(false)}
                  className="w-full py-2 bg-slate-700 hover:bg-slate-650 rounded text-slate-300 font-bold"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}


        {/* QUICK NON-STRIKER SUBSTITUTE OVERLAY */}
        {showSwapNonStrikerModal && currentMatch && (
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-slate-800 p-4 rounded-xl border border-indigo-500 max-w-xs w-full space-y-3 text-xs">
              <h4 className="text-sm font-black text-white flex items-center gap-2 text-indigo-400">
                <UserCheck className="w-4 h-4" />
                <span>Substitute Non-Striker</span>
              </h4>
              <p className="text-[11px] text-slate-400 leading-tight">
                Instantly swap your active non-striker with any teammate from the team pool.
              </p>

              <div className="space-y-1 max-h-48 overflow-y-auto p-1 bg-slate-950 rounded-lg border border-slate-850">
                {(currentMatch.currentInningIndex === 1
                  ? (currentMatch.tossChoice === 'bat' ? (currentMatch.tossWinner === currentMatch.teamA ? currentMatch.teamAPlayers : currentMatch.teamBPlayers) : (currentMatch.tossWinner === currentMatch.teamA ? currentMatch.teamBPlayers : currentMatch.teamAPlayers))
                  : (currentMatch.tossChoice === 'field' ? (currentMatch.tossWinner === currentMatch.teamA ? currentMatch.teamAPlayers : currentMatch.teamBPlayers) : (currentMatch.tossWinner === currentMatch.teamA ? currentMatch.teamBPlayers : currentMatch.teamAPlayers))
                )
                .filter(name => name !== currentMatch.currentStriker)
                .map((name, i) => {
                  const isCurrent = currentMatch.currentNonStriker === name;
                  return (
                    <div
                      key={i}
                      onClick={() => handleSubstituteNonStriker(name)}
                      className={`p-2 rounded mb-1 text-left font-bold cursor-pointer transition flex items-center justify-between ${
                        isCurrent 
                          ? 'bg-indigo-600 text-white' 
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      <span>{name}</span>
                      {isCurrent && <span className="text-[9px] bg-slate-900 px-1.5 py-0.5 rounded text-indigo-300 font-mono">Current Non-Striker</span>}
                    </div>
                  );
                })}
              </div>

              <div className="flex gap-2 pt-1">
                <button 
                  onClick={() => setShowSwapNonStrikerModal(false)}
                  className="w-full py-2 bg-slate-700 hover:bg-slate-650 rounded text-slate-300 font-bold"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}


        {/* QUICK BOWLER SUBSTITUTE OVERLAY */}
        {showSwapBowlerModal && currentMatch && (
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-slate-800 p-4 rounded-xl border border-amber-500 max-w-xs w-full space-y-3 text-xs">
              <h4 className="text-sm font-black text-white flex items-center gap-2 text-amber-400">
                <RefreshCw className="w-4 h-4 text-amber-500" />
                <span>Substitute Bowler</span>
              </h4>
              <p className="text-[11px] text-slate-400 leading-tight">
                Instantly swap your active bowler with any teammate from the opposing fielding roster.
              </p>

              <div className="space-y-1 max-h-48 overflow-y-auto p-1 bg-slate-950 rounded-lg border border-slate-850">
                {(currentMatch.currentInningIndex === 1
                  ? (currentMatch.tossChoice === 'field' ? (currentMatch.tossWinner === currentMatch.teamA ? currentMatch.teamAPlayers : currentMatch.teamBPlayers) : (currentMatch.tossWinner === currentMatch.teamA ? currentMatch.teamBPlayers : currentMatch.teamAPlayers))
                  : (currentMatch.tossChoice === 'bat' ? (currentMatch.tossWinner === currentMatch.teamA ? currentMatch.teamAPlayers : currentMatch.teamBPlayers) : (currentMatch.tossWinner === currentMatch.teamA ? currentMatch.teamBPlayers : currentMatch.teamAPlayers))
                ).map((name, i) => {
                  const isCurrent = currentMatch.currentBowler === name;
                  return (
                    <div
                      key={i}
                      onClick={() => handleSubstituteBowler(name)}
                      className={`p-2 rounded mb-1 text-left font-bold cursor-pointer transition flex items-center justify-between ${
                        isCurrent 
                          ? 'bg-amber-500 text-slate-950' 
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      <span>{name}</span>
                      {isCurrent && <span className="text-[9px] bg-slate-900 px-1.5 py-0.5 rounded text-amber-400 font-mono">Current Bowler</span>}
                    </div>
                  );
                })}
              </div>

              <div className="flex gap-2 pt-1">
                <button 
                  onClick={() => setShowSwapBowlerModal(false)}
                  className="w-full py-2 bg-slate-700 hover:bg-slate-650 rounded text-slate-300 font-bold"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}


        {/* ADVANCED CUSTOM RUNS SCORING DIALOG OVERLAY */}
        {showCustomRunsModal && (
          <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-slate-800 p-4 rounded-xl border border-indigo-500 max-w-xs w-full space-y-3 text-xs">
              <div className="flex items-center gap-1.5 text-indigo-400">
                <Sparkles className="w-5 h-5 text-amber-400 animate-spin-slow" />
                <h4 className="text-sm font-black text-white">Record Custom Play delivery</h4>
              </div>
              <p className="text-[11px] text-slate-400 leading-tight">
                Enables recording custom overthrow runs, multi-penalties, and rare game scenarios.
              </p>

              <div className="space-y-2">
                <div>
                  <label className="text-slate-300 block font-bold mb-1">Select / Type Run Value:</label>
                  <div className="flex gap-1.5">
                    {[5, 7, 8, 10].map(val => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setCustomRunsValue(val)}
                        className={`flex-1 py-2 font-bold font-mono rounded text-center text-xs transition border ${customRunsValue === val ? 'bg-indigo-600 text-white border-indigo-400' : 'bg-slate-900 text-slate-400 border-slate-750'}`}
                      >
                        {val}
                      </button>
                    ))}
                    <input
                      type="number"
                      min={0}
                      max={40}
                      value={customRunsValue}
                      onChange={(e) => setCustomRunsValue(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-16 bg-slate-950 text-white font-mono rounded text-center font-bold text-xs border border-slate-700"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-slate-300 block font-bold mb-1">Accredited Run Type Category:</label>
                  <select
                    value={customRunType}
                    onChange={(e) => setCustomRunType(e.target.value as any)}
                    className="w-full bg-slate-900 text-slate-200 rounded p-2 border border-slate-700 focus:outline-none"
                  >
                    <option value="normal">Normal bat run (Accredited to Batsman)</option>
                    <option value="wide">Wide-Ball Extra (Penalty to Team)</option>
                    <option value="noball">No-Ball Extra + Striker hit</option>
                    <option value="legby">Leg-Byes (No batsman runs, counted in Over)</option>
                  </select>
                </div>

                <div className="flex items-center justify-between p-2 bg-slate-900 rounded border border-slate-750">
                  <span className="text-slate-300 font-bold">Boundary Flag (Accredit Four/Six)</span>
                  <input
                    type="checkbox"
                    checked={customIsBoundary}
                    onChange={(e) => setCustomIsBoundary(e.target.checked)}
                    className="w-4 h-4 accent-indigo-500"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2 border-t border-slate-700/60">
                <button 
                  onClick={() => setShowCustomRunsModal(false)}
                  className="w-1/3 py-2 bg-slate-700 hover:bg-slate-650 rounded text-slate-300 font-bold"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleScoreCustomRuns}
                  className="w-2/3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-black shadow flex items-center justify-center gap-1"
                >
                  <Check className="w-4 h-4" />
                  <span>Enact Custom Runs</span>
                </button>
              </div>
            </div>
          </div>
        )}


        {/* WIDE BALL PARAMETERS MODAL SUBSURFACE */}
        {showWideModal && (
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-slate-800 p-4 rounded-xl border border-blue-500 max-w-xs w-full space-y-3 text-xs">
              <h4 className="text-sm font-black text-white">Wide Delivery Extrapolations</h4>
              
              <div className="space-y-1">
                <label className="text-slate-400 block font-semibold">How many auxiliary runs were added?</label>
                <select 
                  value={extraRunsInput} 
                  onChange={(e) => setExtraRunsInput(parseInt(e.target.value) || 0)}
                  className="w-full bg-slate-900 text-white rounded p-2 font-mono border border-slate-700 focus:outline-none"
                >
                  <option value={0}>0 (Just 1 Wide penalty run)</option>
                  <option value={1}>1 run (Total 2 runs)</option>
                  <option value={2}>2 runs (Total 3 runs)</option>
                  <option value={3}>3 runs (Total 4 runs)</option>
                  <option value={4}>4 runs (Total 5 runs)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-slate-400 block font-semibold">Scored by running or boundary?</label>
                <div className="grid grid-cols-2 gap-2">
                  <button 
                    onClick={() => setExtraBoundaryOption('running')}
                    className={`p-2 rounded font-bold border transition ${extraBoundaryOption === 'running' ? 'bg-blue-600 text-white border-blue-400' : 'bg-slate-900 text-slate-400 border-slate-700'}`}
                  >
                    🏃 Running Hit
                  </button>
                  <button 
                    onClick={() => setExtraBoundaryOption('boundary')}
                    className={`p-2 rounded font-bold border transition ${extraBoundaryOption === 'boundary' ? 'bg-blue-600 text-white border-blue-400' : 'bg-slate-900 text-slate-400 border-slate-700'}`}
                  >
                    🧱 Boundary
                  </button>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button 
                  onClick={() => setShowWideModal(false)}
                  className="w-1/3 py-2 bg-slate-700 rounded text-slate-300 font-bold"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleScoreWide}
                  className="w-2/3 py-2 bg-blue-600 text-white rounded font-black shadow"
                >
                  Record Wide Ball
                </button>
              </div>
            </div>
          </div>
        )}


        {/* NO BALL SUBSURFACE PARAMETERS CONTROL */}
        {showNoBallModal && (
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-slate-800 p-4 rounded-xl border border-blue-500 max-w-xs w-full space-y-3 text-xs">
              <h4 className="text-sm font-black text-white">No-Ball + Free Hit Trigger</h4>
              
              <div className="space-y-1">
                <label className="text-slate-400 block font-semibold">Auxiliary runs scored by batsman?</label>
                <select 
                  value={extraRunsInput} 
                  onChange={(e) => setExtraRunsInput(parseInt(e.target.value) || 0)}
                  className="w-full bg-slate-900 text-white rounded p-2 font-mono border border-slate-700 focus:outline-none"
                >
                  <option value={0}>0 runs off bat (Total 1 penalty run)</option>
                  <option value={1}>1 run (Total 2 runs)</option>
                  <option value={2}>2 runs (Total 3 runs)</option>
                  <option value={3}>3 runs (Total 4 runs)</option>
                  <option value={4}>4 runs (Total 5 runs)</option>
                  <option value={6}>6 runs (Total 7 runs)</option>
                </select>
                <span className="text-[10px] text-slate-400 block italic leading-tight">
                  Runs are credited to batsman's personal account, and next ball automatically triggers absolute FREE HIT protocol!
                </span>
              </div>

              <div className="flex gap-2 pt-2">
                <button 
                  onClick={() => setShowNoBallModal(false)}
                  className="w-1/3 py-2 bg-slate-700 rounded text-slate-300 font-bold"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleScoreNoBall}
                  className="w-2/3 py-2 bg-blue-600 text-white rounded font-black shadow"
                >
                  Enact No-Ball
                </button>
              </div>
            </div>
          </div>
        )}


        {/* LEG BY PARAMETERS DRAWER */}
        {showLegByModal && (
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-slate-800 p-4 rounded-xl border border-blue-500 max-w-xs w-full space-y-3 text-xs">
              <h4 className="text-sm font-black text-white">Leg-By Extrapolations</h4>
              
              <div className="space-y-1">
                <label className="text-slate-400 block font-semibold">How many leg-by runs were run?</label>
                <input 
                  type="number"
                  min={1}
                  max={4}
                  value={extraRunsInput}
                  onChange={(e) => setExtraRunsInput(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full bg-slate-900 text-white rounded p-2 border border-slate-700 text-center font-bold"
                />
                <span className="text-[10px] text-slate-400 block italic">
                  Leg-by counts as a valid ball in the over and adds to team extras runs. Strike rotates accordingly.
                </span>
              </div>

              <div className="flex gap-2 pt-2">
                <button 
                  onClick={() => setShowLegByModal(false)}
                  className="w-1/3 py-2 bg-slate-700 rounded text-slate-300 font-bold"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleScoreLegBy}
                  className="w-2/3 py-2 bg-blue-600 text-white rounded font-black shadow"
                >
                  Record Leg-By
                </button>
              </div>
            </div>
          </div>
        )}


        {/* OUT CONFIRMATION MODAL PROMPT */}
        {showOutModal && currentMatch && (
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-slate-800 p-4 rounded-xl border border-red-500 max-w-xs w-full space-y-3 text-xs">
              <h4 className="text-sm font-black text-white flex items-center gap-1.5 text-red-400">
                <span>🛑 Dismissal Protocol Registry</span>
              </h4>

              <div className="p-2 bg-slate-950 rounded border border-slate-800">
                Batsman getting out: <span className="font-bold text-white block text-sm">{currentMatch.currentStriker}</span>
              </div>

              <div className="space-y-1">
                <label className="text-slate-400 block font-semibold">Select Dismissal Mode Type:</label>
                <select
                  value={outType}
                  onChange={(e) => setOutType(e.target.value as any)}
                  className="w-full bg-slate-900 text-white rounded p-2 border border-slate-700"
                >
                  <option value="bowled">Bowled</option>
                  <option value="caught">Caught Out</option>
                  <option value="lbw">LBW</option>
                  <option value="stumped">Stumped</option>
                  <option value="run_out">Run Out (Valid on Free Hit)</option>
                  <option value="retired_out">Retired Out (Permanent)</option>
                </select>
              </div>

              {(outType === 'caught' || outType === 'stumped' || outType === 'run_out') && (
                <div className="space-y-1">
                  <label className="text-slate-400 block font-semibold">Assisting Fielder Name (Optional):</label>
                  <input
                    type="text"
                    value={outFielder}
                    onChange={(e) => setOutFielder(e.target.value)}
                    placeholder="e.g. Dhoni / Jadeja"
                    className="w-full bg-slate-900 text-white rounded p-2 border border-slate-700 text-xs"
                  />
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button 
                  onClick={() => setShowOutModal(false)}
                  className="w-1/3 py-2 bg-slate-700 rounded text-slate-300 font-bold"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleConfirmOut}
                  className="w-2/3 py-2 bg-red-600 text-white rounded font-black shadow"
                >
                  Confirm Batsman Out
                </button>
              </div>
            </div>
          </div>
        )}


        {/* MID MATCH ADD PLAYER MODAL SUBSURFACE */}
        {showAddPlayerModal && currentMatch && (
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-slate-800 p-4 rounded-xl border border-blue-500 max-w-xs w-full space-y-3 text-xs">
              <h4 className="text-sm font-black text-white">Add Player Mid-Match Option</h4>
              
              <div className="space-y-1">
                <label className="text-slate-400 block font-semibold">Select Target Team Pool:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setMidMatchTeam('A')}
                    className={`p-2 rounded font-bold border transition truncate ${midMatchTeam === 'A' ? 'bg-blue-600 text-white' : 'bg-slate-900 text-slate-400'}`}
                  >
                    {currentMatch.teamA}
                  </button>
                  <button
                    onClick={() => setMidMatchTeam('B')}
                    className={`p-2 rounded font-bold border transition truncate ${midMatchTeam === 'B' ? 'bg-blue-600 text-white' : 'bg-slate-900 text-slate-400'}`}
                  >
                    {currentMatch.teamB}
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-slate-400 block font-semibold">Enter New Player Name (Min 6 letters):</label>
                <input
                  type="text"
                  value={midMatchPlayerName}
                  onChange={(e) => setMidMatchPlayerName(e.target.value)}
                  placeholder="e.g. Substitute Star"
                  className="w-full bg-slate-900 text-white rounded p-2 border border-slate-700 text-xs"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button 
                  onClick={() => setShowAddPlayerModal(false)}
                  className="w-1/3 py-2 bg-slate-700 rounded text-slate-300 font-bold"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleConfirmMidMatchAddPlayer}
                  className="w-2/3 py-2 bg-blue-600 text-white rounded font-black shadow"
                >
                  Add Player To Team
                </button>
              </div>
            </div>
          </div>
        )}


        {/* BOWLER SELECTION MODAL POPUP (AUTOMATIC AFTER OVER / MINI OVER) */}
        {showBowlerChangeModal && currentMatch && (
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
            <div className="bg-slate-800 p-5 rounded-2xl border-2 border-amber-400 max-w-xs w-full space-y-4 text-xs">
              <div className="text-center">
                <RefreshCw className="w-8 h-8 text-amber-400 mx-auto animate-spin-slow" />
                <h4 className="text-base font-black text-white mt-1">Select Next Bowler</h4>
                <p className="text-slate-400 text-[11px]">
                  Over has concluded or mini-over option was toggled. Bind next bowler from opposing field team.
                </p>
              </div>

              <div className="space-y-1 max-h-48 overflow-y-auto p-1 bg-slate-950 rounded-lg border border-slate-800">
                {(currentMatch.currentInningIndex === 1
                  ? (currentMatch.tossChoice === 'field' ? (currentMatch.tossWinner === currentMatch.teamA ? currentMatch.teamAPlayers : currentMatch.teamBPlayers) : (currentMatch.tossWinner === currentMatch.teamA ? currentMatch.teamBPlayers : currentMatch.teamAPlayers))
                  : (currentMatch.tossChoice === 'bat' ? (currentMatch.tossWinner === currentMatch.teamA ? currentMatch.teamAPlayers : currentMatch.teamBPlayers) : (currentMatch.tossWinner === currentMatch.teamA ? currentMatch.teamBPlayers : currentMatch.teamAPlayers))
                ).map((name, i) => {
                  const isCurrent = currentMatch.currentBowler === name;
                  return (
                    <div
                      key={i}
                      onClick={() => {
                        playClickSound();
                        setCurrentMatch({ ...currentMatch, currentBowler: name });
                        setShowBowlerChangeModal(false);
                      }}
                      className={`p-2 rounded mb-1 text-left font-bold cursor-pointer transition ${
                        isCurrent 
                          ? 'bg-amber-500 text-slate-950' 
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {name} {isCurrent && '(Just Bowled)'}
                    </div>
                  );
                })}
              </div>

              <div className="text-center text-[10px] text-slate-400 italic">
                Tip: You can select the same bowler if doing consecutive mini-over changes or continuous bowling under friendly rules.
              </div>
            </div>
          </div>
        )}


        {/* INNINGS END CONFIRMATION */}
        {showEndInningConfirm && (
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-slate-800 p-4 rounded-xl border border-blue-500 max-w-xs w-full space-y-3 text-center text-xs">
              <h4 className="text-sm font-black text-white">End Current Inning Manually?</h4>
              <p className="text-slate-400">
                This will finalize current batting metrics, save the 1st inning runs permanently, and prepare target values for the 2nd inning.
              </p>
              <div className="flex gap-2">
                <button 
                  onClick={() => setShowEndInningConfirm(false)}
                  className="flex-1 py-2 bg-slate-700 rounded text-slate-300 font-bold"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleConfirmForceEndInning}
                  className="flex-1 py-2 bg-blue-600 text-white font-black rounded shadow"
                >
                  Yes, End Inning
                </button>
              </div>
            </div>
          </div>
        )}


        {/* END MATCH MANUAL REF PROTOCOL WARNING */}
        {showEndMatchManualModal && (
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
            <div className="bg-slate-800 p-4 rounded-xl border border-red-500 max-w-xs w-full space-y-3 text-xs">
              <h4 className="text-sm font-black text-red-400 text-center">7. Force End Match Protocol</h4>
              <p className="text-slate-400 text-center">
                Warning! You are manually terminating this match. Select the official winner outcome status to record:
              </p>

              <div className="space-y-1.5 pt-1">
                <button
                  onClick={() => handleConfirmForceEndMatchManual('A')}
                  className="w-full text-left p-2 bg-slate-900 hover:bg-slate-700 rounded text-slate-200 border border-slate-700 truncate font-semibold"
                >
                  🏆 Declare Team A Winner ({currentMatch?.teamA})
                </button>
                <button
                  onClick={() => handleConfirmForceEndMatchManual('B')}
                  className="w-full text-left p-2 bg-slate-900 hover:bg-slate-700 rounded text-slate-200 border border-slate-700 truncate font-semibold"
                >
                  🏆 Declare Team B Winner ({currentMatch?.teamB})
                </button>
                <button
                  onClick={() => handleConfirmForceEndMatchManual('no_result')}
                  className="w-full text-left p-2 bg-slate-900 hover:bg-slate-700 rounded text-slate-300 border border-slate-700 font-semibold"
                >
                  ⚪ No Result / Abandoned Match
                </button>
              </div>

              <button 
                onClick={() => setShowEndMatchManualModal(false)}
                className="w-full text-center py-2 bg-slate-700 rounded text-slate-300 font-bold mt-1"
              >
                Cancel / Return
              </button>
            </div>
          </div>
        )}


        {/* INNING END CONFIRMATION MODAL (Overs Complete) */}
        {showNextBatsmanModal && currentMatch && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
            <div className="bg-slate-800 border border-blue-500/50 rounded-2xl p-5 w-full max-w-xs space-y-4 shadow-2xl">
              <div className="text-center">
                <h3 className="text-lg font-black text-white">Select Next Batsman</h3>
                <p className="text-xs text-slate-400 mt-1">A wicket has fallen. Choose who comes in next.</p>
              </div>
              <div className="max-h-64 overflow-y-auto space-y-1.5 rounded-xl bg-slate-950 p-1 border border-slate-700">
                {getAvailableNextBatsmen(currentMatch).map((name, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      playClickSound();
                      const updatedMatch = { ...currentMatch, currentStriker: name };
                      setCurrentMatch(updatedMatch);
                      saveMatch(updatedMatch); // fire and forget ok here
                      setShowNextBatsmanModal(false);
                      if (openBowlerAfterBatsman) {
                        setOpenBowlerAfterBatsman(false);
                        setShowBowlerChangeModal(true);
                      }
                    }}
                    className="w-full p-2.5 rounded-lg bg-slate-800 hover:bg-blue-600 text-left text-xs font-bold text-slate-200 hover:text-white border border-slate-700 hover:border-blue-400 transition"
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* INNING END CONFIRMATION MODAL (Overs Complete) */}
        {showInningEndModal && pendingInningEndState && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
            <div className="bg-slate-800 border border-blue-500/50 rounded-2xl p-5 w-full max-w-xs text-center space-y-4 shadow-2xl">
              <div>
                <h3 className="text-lg font-black text-white">Overs Completed</h3>
                <p className="text-sm text-slate-300 mt-1">
                  {pendingInningEndState.battingTeam} finished their innings at <span className="font-bold text-blue-400">{pendingInningEndState.runs}/{pendingInningEndState.wickets}</span>.
                </p>
              </div>
              <div className="pt-2 space-y-2">
                <button
                  onClick={() => {
                    playClickSound();
                    setShowInningEndModal(false);
                    // Force the transition now that user confirmed
                    if (pendingInningEndState) {
                      // We call the function but the overs check will be false now? No, balls are still high.
                      // Better to manually trigger the state change here.
                      if (currentMatch) {
                        if (currentMatch.currentInningIndex === 1) {
                          // Manually trigger the 1st to 2nd inning transition
                          const nextBattingTeam = pendingInningEndState.fieldingTeam;
                          const nextFieldingTeam = pendingInningEndState.battingTeam;
                          const nextBattingPlayers = nextBattingTeam === currentMatch.teamA ? currentMatch.teamAPlayers : currentMatch.teamBPlayers;
                          const nextFieldingPlayers = nextFieldingTeam === currentMatch.teamA ? currentMatch.teamAPlayers : currentMatch.teamBPlayers;

                          const initialBatsmenMap: Record<string, PlayerMatchScore> = {};
                          nextBattingPlayers.forEach(p => { initialBatsmenMap[p] = { name: p, runs: 0, balls: 0, fours: 0, sixes: 0 }; });
                          const initialBowlersMap: Record<string, BowlerMatchScore> = {};
                          nextFieldingPlayers.forEach(p => { initialBowlersMap[p] = { name: p, overs: 0, balls: 0, maidens: 0, runs: 0, wickets: 0 }; });

                          const secondInningInitial: InningState = {
                            battingTeam: nextBattingTeam, fieldingTeam: nextFieldingTeam, runs: 0, wickets: 0, balls: 0,
                            extras: { wides: 0, noballs: 0, legbys: 0, others: 0 },
                            batsmen: initialBatsmenMap, bowlers: initialBowlersMap, oversLog: [], currentOverLog: []
                          };

                          const updatedMatch: MatchData = {
                            ...currentMatch, currentInningIndex: 2, firstInning: pendingInningEndState, secondInning: secondInningInitial,
                            currentStriker: undefined, currentNonStriker: undefined,
                            currentBowler: undefined, isFreeHit: false
                          };
                          setCurrentMatch(updatedMatch);
                          saveMatch(updatedMatch); // fire and forget ok here
                          setCurrentPage('start_second_inning');
                        } else {
                          // End match with a proper result, not an overs-limit message.
                          const firstRuns = currentMatch.firstInning!.runs;
                          const secondRuns = pendingInningEndState.runs;
                          const finalMatch = { ...currentMatch, secondInning: pendingInningEndState };
                          if (secondRuns > firstRuns) {
                            const battingPlayers = pendingInningEndState.battingTeam === finalMatch.teamA ? finalMatch.teamAPlayers : finalMatch.teamBPlayers;
                            const wicketsLeft = Math.max(0, battingPlayers.length - pendingInningEndState.wickets);
                            finishMatchWithWinner(pendingInningEndState.battingTeam, `${pendingInningEndState.battingTeam} won by ${wicketsLeft} wickets!`, finalMatch);
                          } else if (secondRuns < firstRuns) {
                            finishMatchWithWinner(currentMatch.firstInning!.battingTeam, `${currentMatch.firstInning!.battingTeam} won by ${firstRuns - secondRuns} runs!`, finalMatch);
                          } else {
                            finishMatchWithWinner('draw', 'Match Tied!', finalMatch);
                          }
                        }
                      }
                    }
                    setPendingInningEndState(null);
                  }}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-sm"
                >
                  Confirm Inning End &amp; Continue
                </button>
                <button
                  onClick={() => {
                    playClickSound();
                    setShowInningEndModal(false);
                    // Undo the last ball that completed the over
                    handleUndoLastBall();
                    setPendingInningEndState(null);
                  }}
                  className="w-full py-3 bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold rounded-xl text-sm border border-slate-600"
                >
                  Undo Last Ball
                </button>
              </div>
            </div>
          </div>
        )}

        {/* SECURITY AUTHENTICATION PASSWORD VERIFICATION RESUME MODAL */}
        {showResumeAuthModal && selectedLiveMatchToAuth && (
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-slate-800 p-5 rounded-2xl border border-blue-500 max-w-xs w-full space-y-3 text-xs">
              <div className="text-center">
                <h4 className="text-base font-black text-white">Enter Match Credentials</h4>
                <p className="text-slate-400 text-[11px]">
                  Provide the 6-letter security password shown in the three dots overlay menu of this active scorecard.
                </p>
              </div>

              <div className="space-y-2 font-mono">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase block">Target Match ID:</span>
                  <input
                    type="text"
                    disabled
                    value={resumeMatchId}
                    className="w-full bg-slate-950 text-slate-300 rounded p-2 text-xs border border-slate-800 font-bold text-center"
                  />
                </div>

                <div>
                  <span className="text-[10px] text-slate-400 uppercase block">Enter 6-Letter Password:</span>
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="e.g. CRKTRX"
                    value={resumePassword}
                    onChange={(e) => setResumePassword(e.target.value)}
                    className="w-full bg-slate-900 text-white rounded p-2 text-sm border border-blue-500/40 font-bold text-center uppercase tracking-widest placeholder:lowercase"
                  />
                </div>
              </div>

              {resumeError && (
                <div className="text-red-400 font-bold text-[11px] text-center bg-red-950/40 p-1.5 rounded border border-red-950">
                  ⚠️ {resumeError}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button 
                  onClick={() => setShowResumeAuthModal(false)}
                  className="w-1/3 py-2 bg-slate-700 rounded text-slate-300 font-bold"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleVerifyAndResumeScoring}
                  className="w-2/3 py-2 bg-blue-600 text-white rounded font-black shadow hover:bg-blue-500"
                >
                  Unlock &amp; Score Remaining
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
