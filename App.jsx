import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  onSnapshot, 
  doc, 
  setDoc, 
  deleteDoc, 
  addDoc 
} from 'firebase/firestore';
import { 
  getAuth, 
  signInAnonymously, 
  signInWithCustomToken, 
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  Users, 
  UserPlus, 
  TrendingUp, 
  PlusCircle, 
  Edit, 
  Trash2, 
  ChevronRight, 
  Moon, 
  Sun,
  Search,
  Zap,
  Award,
  Activity,
  FileDown,
  Cloud,
  CloudOff,
  Dumbbell,
  Layers,
  Plus,
  Trash
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts';

// --- CONFIGURAZIONE FIREBASE ---
const firebaseConfig = typeof __firebase_config !== 'undefined' 
  ? JSON.parse(__firebase_config) 
  : {
      apiKey: "demo-api-key",
      authDomain: "demo-app.firebaseapp.com",
      projectId: "demo-app",
      storageBucket: "demo-app.appspot.com",
      messagingSenderId: "123456789",
      appId: "1:123456789:web:demo"
    };

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'volley-metrics-app';

// Ruoli Volley predefiniti
const ROLES = [
  'Schiacciatore / Banda',
  'Opposto',
  'Centrale',
  'Palleggiatore',
  'Libero'
];

export default function App() {
  // Stato Auth e Connessione Cloud
  const [user, setUser] = useState(null);
  const [isSyncing, setIsSyncing] = useState(true);
  const [syncStatus, setSyncStatus] = useState('connecting');

  // Stato Squadre
  const [teams, setTeams] = useState([]);
  const [activeTeamId, setActiveTeamId] = useState('');
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');

  // Stato Atleti
  const [athletes, setAthletes] = useState([]);

  // Navigazione & Selezioni
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard', 'athletes', 'detail'
  const [selectedAthleteId, setSelectedAthleteId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState('Tutti');

  // Modali
  const [showAthleteModal, setShowAthleteModal] = useState(false);
  const [editingAthlete, setEditingAthlete] = useState(null);

  const [showLogModal, setShowLogModal] = useState(false);
  const [editingLog, setEditingLog] = useState(null);

  // Modale Scheda Pesi
  const [showWorkoutModal, setShowWorkoutModal] = useState(false);
  const [editingWorkout, setEditingWorkout] = useState(null);

  // Form States
  const [athleteForm, setAthleteForm] = useState({
    nome: '',
    cognome: '',
    annoNascita: new Date().getFullYear() - 18,
    ruolo: ROLES[0],
    reach1Mano: 235,
    reach2Mani: 230
  });

  const [logForm, setLogForm] = useState({
    data: new Date().toISOString().substring(0, 7),
    altezza: 185,
    peso: 75,
    saltoFermo: 60,
    saltoRincorsa: 75
  });

  const [workoutForm, setWorkoutForm] = useState({
    titolo: 'FASE FORZA MAX - MESOCICLO 1',
    dataInizio: new Date().toISOString().substring(0, 10),
    dataFine: '',
    note: '',
    esercizi: [
      { nome: 'Squat Bilanciere', serieReps: '4x6', carico: '90 kg', recupero: '120s', note: 'Profondo, ritmo 3-0-1' },
      { nome: 'Panca Piana', serieReps: '4x6', carico: '70 kg', recupero: '90s', note: 'Fermo al petto' }
    ]
  });

  // 1. INIZIALIZZAZIONE AUTENTICAZIONE FIREBASE
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Errore Autenticazione Firebase:", err);
        setSyncStatus('error');
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });

    return () => unsubscribe();
  }, []);

  // 2. RECUPERO DATI SQUADRE
  useEffect(() => {
    if (!user) return;

    const teamsColRef = collection(db, 'artifacts', appId, 'public', 'data', 'teams');
    const unsubscribe = onSnapshot(teamsColRef, (snapshot) => {
      const teamList = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      }));

      if (teamList.length === 0) {
        addDoc(teamsColRef, { nome: 'PRIMA SQUADRA VOLLEY', createdAt: new Date().toISOString() });
      } else {
        setTeams(teamList);
        if (!activeTeamId || !teamList.some(t => t.id === activeTeamId)) {
          setActiveTeamId(teamList[0].id);
        }
      }
    }, (err) => console.error("Errore teams:", err));

    return () => unsubscribe();
  }, [user, activeTeamId]);

  // 3. RECUPERO DATI ATLETI PER SQUADRA ATTIVA
  useEffect(() => {
    if (!user || !activeTeamId) return;

    setIsSyncing(true);
    const athletesColRef = collection(db, 'artifacts', appId, 'public', 'data', 'athletes');

    const unsubscribe = onSnapshot(athletesColRef, (snapshot) => {
      const athleteList = snapshot.docs
        .map(docSnap => ({ id: docSnap.id, ...docSnap.data() }))
        .filter(a => a.teamId === activeTeamId);
      
      athleteList.sort((a, b) => (a.cognome || '').localeCompare(b.cognome || ''));
      setAthletes(athleteList);
      setIsSyncing(false);
      setSyncStatus('synced');
    }, (error) => {
      console.error("Errore Cloud:", error);
      setIsSyncing(false);
      setSyncStatus('error');
    });

    return () => unsubscribe();
  }, [user, activeTeamId]);

  // Atleta Selezionato Corrente
  const selectedAthlete = useMemo(() => {
    return athletes.find(a => a.id === selectedAthleteId) || null;
  }, [athletes, selectedAthleteId]);

  // Squadra Attiva Corrente
  const activeTeam = useMemo(() => {
    return teams.find(t => t.id === activeTeamId) || null;
  }, [teams, activeTeamId]);

  // Filtro Atleti
  const filteredAthletes = useMemo(() => {
    return athletes.filter(a => {
      const matchSearch = `${a.nome} ${a.cognome} ${a.ruolo}`.toLowerCase().includes(searchTerm.toLowerCase());
      const matchRole = selectedRoleFilter === 'Tutti' || a.ruolo === selectedRoleFilter;
      return matchSearch && matchRole;
    });
  }, [athletes, searchTerm, selectedRoleFilter]);

  // --- AZIONI SQUADRA ---
  const handleCreateTeam = async (e) => {
    e.preventDefault();
    if (!newTeamName.trim()) return;
    try {
      const teamsColRef = collection(db, 'artifacts', appId, 'public', 'data', 'teams');
      const docRef = await addDoc(teamsColRef, {
        nome: newTeamName.trim().toUpperCase(),
        createdAt: new Date().toISOString()
      });
      setActiveTeamId(docRef.id);
      setNewTeamName('');
      setShowTeamModal(false);
    } catch (err) {
      console.error("Errore creazione squadra:", err);
    }
  };

  const handleDeleteTeam = async (teamId) => {
    if (teams.length <= 1) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'teams', teamId));
      const remaining = teams.filter(t => t.id !== teamId);
      setActiveTeamId(remaining[0].id);
    } catch (err) {
      console.error("Errore eliminazione squadra:", err);
    }
  };

  // --- AZIONI ATLETI & SALTO ---
  const handleSaveAthlete = async (e) => {
    e.preventDefault();
    if (!user || !athleteForm.nome || !athleteForm.cognome || !activeTeamId) return;

    try {
      setIsSyncing(true);
      if (editingAthlete) {
        const athleteRef = doc(db, 'artifacts', appId, 'public', 'data', 'athletes', editingAthlete.id);
        await setDoc(athleteRef, {
          ...editingAthlete,
          nome: athleteForm.nome.toUpperCase(),
          cognome: athleteForm.cognome.toUpperCase(),
          annoNascita: Number(athleteForm.annoNascita),
          ruolo: athleteForm.ruolo,
          reach1Mano: Number(athleteForm.reach1Mano),
          reach2Mani: Number(athleteForm.reach2Mani),
          teamId: activeTeamId,
          updatedAt: new Date().toISOString()
        }, { merge: true });
      } else {
        const athletesColRef = collection(db, 'artifacts', appId, 'public', 'data', 'athletes');
        await addDoc(athletesColRef, {
          nome: athleteForm.nome.toUpperCase(),
          cognome: athleteForm.cognome.toUpperCase(),
          annoNascita: Number(athleteForm.annoNascita),
          ruolo: athleteForm.ruolo,
          reach1Mano: Number(athleteForm.reach1Mano),
          reach2Mani: Number(athleteForm.reach2Mani),
          teamId: activeTeamId,
          logs: [],
          workouts: [],
          createdAt: new Date().toISOString()
        });
      }
      setShowAthleteModal(false);
    } catch (err) {
      console.error("Errore salvataggio atleta:", err);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDeleteAthlete = async (id) => {
    if (!user) return;
    try {
      setIsSyncing(true);
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'athletes', id));
      if (selectedAthleteId === id) {
        setSelectedAthleteId(null);
        setActiveTab('athletes');
      }
    } catch (err) {
      console.error("Errore eliminazione atleta:", err);
    } finally {
      setIsSyncing(false);
    }
  };

  // --- GESTIONE SCHEDE PESI ---
  const handleAddExerciseRow = () => {
    setWorkoutForm({
      ...workoutForm,
      esercizi: [
        ...workoutForm.esercizi,
        { nome: '', serieReps: '3x10', carico: '', recupero: '60s', note: '' }
      ]
    });
  };

  const handleRemoveExerciseRow = (index) => {
    const updated = workoutForm.esercizi.filter((_, i) => i !== index);
    setWorkoutForm({ ...workoutForm, esercizi: updated });
  };

  const handleExerciseChange = (index, field, value) => {
    const updated = [...workoutForm.esercizi];
    updated[index][field] = value;
    setWorkoutForm({ ...workoutForm, esercizi: updated });
  };

  const handleSaveWorkout = async (e) => {
    e.preventDefault();
    if (!user || !selectedAthlete) return;

    try {
      setIsSyncing(true);
      const newWorkout = {
        id: editingWorkout ? editingWorkout.id : Date.now().toString(),
        titolo: workoutForm.titolo.toUpperCase(),
        dataInizio: workoutForm.dataInizio,
        dataFine: workoutForm.dataFine,
        note: workoutForm.note,
        esercizi: workoutForm.esercizi,
        updatedAt: new Date().toISOString()
      };

      let currentWorkouts = [...(selectedAthlete.workouts || [])];
      if (editingWorkout) {
        currentWorkouts = currentWorkouts.map(w => w.id === editingWorkout.id ? newWorkout : w);
      } else {
        currentWorkouts.unshift(newWorkout);
      }

      const athleteRef = doc(db, 'artifacts', appId, 'public', 'data', 'athletes', selectedAthlete.id);
      await setDoc(athleteRef, { workouts: currentWorkouts }, { merge: true });

      setShowWorkoutModal(false);
    } catch (err) {
      console.error("Errore salvataggio scheda pesi:", err);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDeleteWorkout = async (workoutId) => {
    if (!user || !selectedAthlete) return;
    try {
      setIsSyncing(true);
      const updatedWorkouts = selectedAthlete.workouts.filter(w => w.id !== workoutId);
      const athleteRef = doc(db, 'artifacts', appId, 'public', 'data', 'athletes', selectedAthlete.id);
      await setDoc(athleteRef, { workouts: updatedWorkouts }, { merge: true });
    } catch (err) {
      console.error("Errore eliminazione scheda pesi:", err);
    } finally {
      setIsSyncing(false);
    }
  };

  // --- GESTIONE LOG MISURAZIONI ---
  const handleSaveLog = async (e) => {
    e.preventDefault();
    if (!user || !selectedAthlete) return;

    try {
      setIsSyncing(true);
      const newLogEntry = {
        id: editingLog ? editingLog.id : Date.now().toString(),
        data: logForm.data,
        altezza: Number(logForm.altezza),
        peso: Number(logForm.peso),
        saltoFermo: Number(logForm.saltoFermo),
        saltoRincorsa: Number(logForm.saltoRincorsa)
      };

      let updatedLogs = [...(selectedAthlete.logs || [])];

      if (editingLog) {
        updatedLogs = updatedLogs.map(l => l.id === editingLog.id ? newLogEntry : l);
      } else {
        const existingIndex = updatedLogs.findIndex(l => l.data === logForm.data);
        if (existingIndex >= 0) {
          updatedLogs[existingIndex] = newLogEntry;
        } else {
          updatedLogs.push(newLogEntry);
        }
      }

      updatedLogs.sort((a, b) => a.data.localeCompare(b.data));

      const athleteRef = doc(db, 'artifacts', appId, 'public', 'data', 'athletes', selectedAthlete.id);
      await setDoc(athleteRef, {
        logs: updatedLogs,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      setShowLogModal(false);
    } catch (err) {
      console.error("Errore salvataggio misurazione:", err);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDeleteLog = async (logId) => {
    if (!user || !selectedAthlete) return;
    try {
      setIsSyncing(true);
      const updatedLogs = selectedAthlete.logs.filter(l => l.id !== logId);
      const athleteRef = doc(db, 'artifacts', appId, 'public', 'data', 'athletes', selectedAthlete.id);
      await setDoc(athleteRef, { logs: updatedLogs }, { merge: true });
    } catch (err) {
      console.error("Errore eliminazione log:", err);
    } finally {
      setIsSyncing(false);
    }
  };

  // Statistiche Generali
  const statsSummary = useMemo(() => {
    let maxJumpRincorsa = 0;
    let topJumper = 'NESSUNO';

    athletes.forEach(a => {
      (a.logs || []).forEach(l => {
        const totalHeightReach = (a.reach1Mano || 0) + (l.saltoRincorsa || 0);
        if (totalHeightReach > maxJumpRincorsa) {
          maxJumpRincorsa = totalHeightReach;
          topJumper = `${a.nome} ${a.cognome} (${totalHeightReach} CM)`;
        }
      });
    });

    return { totalAthletes: athletes.length, topJumper };
  }, [athletes]);

  return (
    <div 
      className="min-h-screen text-slate-900 font-sans tracking-wide pb-12"
      style={{
        backgroundColor: '#0b192c',
        backgroundImage: `radial-gradient(#38bdf8 1px, transparent 1px), radial-gradient(#f43f5e 1px, #0b192c 1px)`,
        backgroundSize: '40px 40px',
        backgroundPosition: '0 0, 20px 20px'
      }}
    >
      
      {/* HEADER STILE POP AMERICAN RETRO */}
      <header className="border-b-4 border-slate-900 bg-[#1e293b] sticky top-0 z-30 shadow-[0_4px_0_#000] print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            
            {/* LOGO TITOLO 3D STILE AMERICAN */}
            <div className="flex items-center space-x-6">
              <div className="cursor-pointer flex items-center space-x-2" onClick={() => setActiveTab('dashboard')}>
                <h1 
                  className="text-2xl sm:text-4xl font-black italic tracking-widest uppercase text-[#fffdf0]"
                  style={{
                    textShadow: `
                      3px 3px 0px #f43f5e,
                      6px 6px 0px #1e40af,
                      8px 8px 0px #090d16
                    `
                  }}
                >
                  VOLLEYBALL METRICS
                </h1>
              </div>

              {/* Selettore Multi-Squadra Pop */}
              <div className="hidden md:flex items-center space-x-2 bg-[#fffdf0] px-3 py-1.5 rounded-xl border-4 border-slate-900 shadow-[3px_3px_0px_#f43f5e]">
                <Layers className="h-4 w-4 text-slate-900" />
                <select
                  value={activeTeamId}
                  onChange={(e) => setActiveTeamId(e.target.value)}
                  className="bg-transparent text-xs font-black uppercase text-slate-900 focus:outline-none cursor-pointer"
                >
                  {teams.map(team => (
                    <option key={team.id} value={team.id}>★ {team.nome}</option>
                  ))}
                </select>

                <button
                  onClick={() => setShowTeamModal(true)}
                  className="p-1 rounded-lg bg-[#f43f5e] text-white hover:bg-rose-600 transition-colors border-2 border-slate-900"
                  title="Aggiungi Squadre"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* NAVIGAZIONE E BOTTONI 3D */}
            <div className="flex items-center space-x-3">
              <nav className="flex space-x-2">
                <button
                  onClick={() => setActiveTab('dashboard')}
                  className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-black uppercase border-4 border-slate-900 transition-all ${
                    activeTab === 'dashboard' 
                      ? 'bg-[#f43f5e] text-[#fffdf0] shadow-[3px_3px_0px_#000] -translate-y-0.5' 
                      : 'bg-[#fffdf0] text-slate-900 shadow-[3px_3px_0px_#000] hover:bg-amber-100'
                  }`}
                >
                  DASHBOARD
                </button>

                <button
                  onClick={() => setActiveTab('athletes')}
                  className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-black uppercase border-4 border-slate-900 transition-all ${
                    activeTab === 'athletes' || activeTab === 'detail'
                      ? 'bg-[#f43f5e] text-[#fffdf0] shadow-[3px_3px_0px_#000] -translate-y-0.5' 
                      : 'bg-[#fffdf0] text-slate-900 shadow-[3px_3px_0px_#000] hover:bg-amber-100'
                  }`}
                >
                  ATLETI ({athletes.length})
                </button>
              </nav>

              <button
                onClick={() => {
                  setEditingAthlete(null);
                  setAthleteForm({
                    nome: '',
                    cognome: '',
                    annoNascita: 2005,
                    ruolo: ROLES[0],
                    reach1Mano: 235,
                    reach2Mani: 230
                  });
                  setShowAthleteModal(true);
                }}
                className="bg-[#38bdf8] hover:bg-sky-400 text-slate-900 px-4 py-2 rounded-xl text-xs sm:text-sm font-black uppercase border-4 border-slate-900 shadow-[3px_3px_0px_#000] flex items-center space-x-1.5 transition-all active:translate-y-0.5"
              >
                <UserPlus className="h-4 w-4" />
                <span className="hidden sm:inline">NUOVO ATLETA</span>
              </button>
            </div>

          </div>
        </div>
      </header>

      {/* CONTENUTO PRINCIPALE */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* TAB DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              <div className="bg-[#fffdf0] border-4 border-slate-900 rounded-2xl p-6 shadow-[6px_6px_0px_#f43f5e] flex items-center space-x-5">
                <div className="p-4 bg-[#f43f5e] text-[#fffdf0] rounded-xl border-3 border-slate-900 shadow-[2px_2px_0px_#000]">
                  <Users className="h-8 w-8" />
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-wider text-slate-500">ATLETI REGISTRATI ({activeTeam?.nome})</p>
                  <h3 className="text-4xl font-black text-slate-900">{statsSummary.totalAthletes}</h3>
                </div>
              </div>

              <div className="bg-[#fffdf0] border-4 border-slate-900 rounded-2xl p-6 shadow-[6px_6px_0px_#38bdf8] flex items-center space-x-5">
                <div className="p-4 bg-[#38bdf8] text-slate-900 rounded-xl border-3 border-slate-900 shadow-[2px_2px_0px_#000]">
                  <Award className="h-8 w-8" />
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-wider text-slate-500">RECORD QUOTA ATTACCO SQUADRA</p>
                  <h3 className="text-xl sm:text-2xl font-black text-[#f43f5e]">{statsSummary.topJumper}</h3>
                </div>
              </div>

            </div>

            {/* CLASSIFICA SALTI */}
            <div className="bg-[#fffdf0] border-4 border-slate-900 rounded-2xl p-6 shadow-[8px_8px_0px_#1e293b] space-y-5">
              <h3 className="text-2xl font-black italic uppercase tracking-wider text-slate-900 flex items-center space-x-2">
                <Activity className="h-6 w-6 text-[#f43f5e]" />
                <span>CLASSIFICA ELEVAZIONE & REACH SQUADRA</span>
              </h3>

              <div className="overflow-x-auto border-4 border-slate-900 rounded-xl bg-white">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-[#1e293b] text-[#fffdf0] uppercase font-black text-xs border-b-4 border-slate-900">
                    <tr>
                      <th className="px-4 py-3.5">ATLETA</th>
                      <th className="px-4 py-3.5">RUOLO</th>
                      <th className="px-4 py-3.5">REACH 1M</th>
                      <th className="px-4 py-3.5">ULTIMO SALTO RINCORSA</th>
                      <th className="px-4 py-3.5">QUOTA TOTALE ATTACCO</th>
                      <th className="px-4 py-3.5 text-right">AZIONE</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y-2 divide-slate-900 font-bold">
                    {athletes.map(a => {
                      const lastLog = a.logs && a.logs.length > 0 ? a.logs[a.logs.length - 1] : null;
                      const quotaTotale = lastLog ? a.reach1Mano + lastLog.saltoRincorsa : null;
                      return (
                        <tr key={a.id} className="hover:bg-amber-100 transition-colors">
                          <td className="px-4 py-3.5 font-black uppercase text-slate-900">{a.nome} {a.cognome}</td>
                          <td className="px-4 py-3.5 text-slate-600 font-extrabold uppercase">{a.ruolo}</td>
                          <td className="px-4 py-3.5 text-slate-900">{a.reach1Mano} CM</td>
                          <td className="px-4 py-3.5 text-slate-900">{lastLog ? `${lastLog.saltoRincorsa} CM` : '-'}</td>
                          <td className="px-4 py-3.5 font-black text-[#f43f5e] text-base">{quotaTotale ? `${quotaTotale} CM` : '-'}</td>
                          <td className="px-4 py-3.5 text-right">
                            <button
                              onClick={() => {
                                setSelectedAthleteId(a.id);
                                setActiveTab('detail');
                              }}
                              className="bg-[#f43f5e] hover:bg-rose-600 text-white px-4 py-1.5 rounded-lg font-black uppercase border-2 border-slate-900 shadow-[2px_2px_0px_#000] inline-flex items-center space-x-1 text-xs"
                            >
                              <span>SCHEDA</span>
                              <ChevronRight className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB LISTA ATLETI */}
        {activeTab === 'athletes' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-3.5 h-5 w-5 text-slate-900" />
                <input
                  type="text"
                  placeholder="CERCA PER NOME, COGNOME O RUOLO..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 text-sm font-black uppercase bg-[#fffdf0] text-slate-900 rounded-xl border-4 border-slate-900 shadow-[3px_3px_0px_#000] focus:outline-none placeholder:text-slate-500"
                />
              </div>

              <select
                value={selectedRoleFilter}
                onChange={(e) => setSelectedRoleFilter(e.target.value)}
                className="px-4 py-3 text-sm font-black uppercase bg-[#fffdf0] text-slate-900 rounded-xl border-4 border-slate-900 shadow-[3px_3px_0px_#000] focus:outline-none cursor-pointer"
              >
                <option value="Tutti">TUTTI I RUOLI</option>
                {ROLES.map(r => <option key={r} value={r}>{r.toUpperCase()}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredAthletes.map(a => (
                <div 
                  key={a.id} 
                  className="bg-[#fffdf0] border-4 border-slate-900 rounded-2xl p-6 shadow-[6px_6px_0px_#1e293b] space-y-4 hover:shadow-[8px_8px_0px_#f43f5e] transition-all"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-black text-2xl uppercase tracking-wide text-slate-900">{a.nome} {a.cognome}</h4>
                      <p className="text-xs font-black text-[#f43f5e] uppercase">{a.ruolo} ({a.annoNascita})</p>
                    </div>
                    <div className="flex space-x-1">
                      <button
                        onClick={() => {
                          setEditingAthlete(a);
                          setAthleteForm({
                            nome: a.nome,
                            cognome: a.cognome,
                            annoNascita: a.annoNascita,
                            ruolo: a.ruolo,
                            reach1Mano: a.reach1Mano,
                            reach2Mani: a.reach2Mani
                          });
                          setShowAthleteModal(true);
                        }}
                        className="p-1.5 text-slate-900 hover:text-[#f43f5e]"
                      >
                        <Edit className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => handleDeleteAthlete(a.id)}
                        className="p-1.5 text-slate-900 hover:text-rose-600"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs font-black py-3 border-y-4 border-slate-900 uppercase text-slate-700 bg-amber-50 px-2 rounded-lg">
                    <div>REACH 1M: <strong className="text-[#f43f5e]">{a.reach1Mano} CM</strong></div>
                    <div>REACH 2M: <strong className="text-[#f43f5e]">{a.reach2Mani} CM</strong></div>
                  </div>

                  <button
                    onClick={() => {
                      setSelectedAthleteId(a.id);
                      setActiveTab('detail');
                    }}
                    className="w-full py-3 bg-[#f43f5e] hover:bg-rose-600 text-white rounded-xl text-xs font-black uppercase border-3 border-slate-900 shadow-[3px_3px_0px_#000] flex items-center justify-center space-x-1 transition-transform active:translate-y-0.5"
                  >
                    <span>VEDI SCHEDA & TEST</span>
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB DETTAGLIO ATLETA + TAB SCHEDE PESI */}
        {activeTab === 'detail' && selectedAthlete && (
          <div className="space-y-8">
            
            <div className="bg-[#fffdf0] border-4 border-slate-900 rounded-2xl p-6 shadow-[8px_8px_0px_#38bdf8] flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:hidden">
              <div>
                <button 
                  onClick={() => setActiveTab('athletes')} 
                  className="text-xs font-black uppercase text-[#f43f5e] hover:underline mb-2 inline-flex items-center space-x-1"
                >
                  ← TORNA ALLA LISTA ATLETI
                </button>
                <div className="flex items-center space-x-3">
                  <h2 className="text-3xl font-black uppercase text-slate-900">{selectedAthlete.nome} {selectedAthlete.cognome}</h2>
                  <span className="px-3 py-1 rounded-xl text-xs font-black uppercase bg-[#38bdf8] text-slate-900 border-2 border-slate-900 shadow-[2px_2px_0px_#000]">
                    {selectedAthlete.ruolo}
                  </span>
                </div>
                <p className="text-xs font-black text-slate-600 uppercase mt-1">SQUADRA: <strong>{activeTeam?.nome}</strong> | REACH 1M: <strong>{selectedAthlete.reach1Mano} CM</strong></p>
              </div>

              <div className="flex flex-wrap gap-3 w-full md:w-auto">
                <button
                  onClick={() => {
                    setEditingWorkout(null);
                    setWorkoutForm({
                      titolo: 'SCHEDA FORZA & POTENZA ESPLOSIVA',
                      dataInizio: new Date().toISOString().substring(0, 10),
                      dataFine: '',
                      note: '',
                      esercizi: [
                        { nome: 'Squat Completo', serieReps: '4x6', carico: '80 kg', recupero: '120s', note: '' },
                        { nome: 'Bench Press', serieReps: '4x6', carico: '65 kg', recupero: '90s', note: '' }
                      ]
                    });
                    setShowWorkoutModal(true);
                  }}
                  className="bg-[#10b981] hover:bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black uppercase border-3 border-slate-900 shadow-[3px_3px_0px_#000] flex items-center space-x-1.5 transition-transform active:translate-y-0.5"
                >
                  <Dumbbell className="h-4 w-4" />
                  <span>NUOVA SCHEDA PESI</span>
                </button>

                <button
                  onClick={() => {
                    setEditingLog(null);
                    setLogForm({
                      data: new Date().toISOString().substring(0, 7),
                      altezza: 185,
                      peso: 75,
                      saltoFermo: 60,
                      saltoRincorsa: 75
                    });
                    setShowLogModal(true);
                  }}
                  className="bg-[#38bdf8] hover:bg-sky-400 text-slate-900 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black uppercase border-3 border-slate-900 shadow-[3px_3px_0px_#000] flex items-center space-x-1.5 transition-transform active:translate-y-0.5"
                >
                  <PlusCircle className="h-4 w-4" />
                  <span>NUOVO TEST SALTO</span>
                </button>

                <button
                  onClick={() => window.print()}
                  className="bg-[#f43f5e] hover:bg-rose-600 text-white px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black uppercase border-3 border-slate-900 shadow-[3px_3px_0px_#000] flex items-center space-x-1.5 transition-transform active:translate-y-0.5"
                >
                  <FileDown className="h-4 w-4" />
                  <span>ESPORTA PDF SCHEDA</span>
                </button>
              </div>
            </div>

            {/* SCHEDE PESI PER L'ATLETA */}
            <div className="bg-[#fffdf0] border-4 border-slate-900 rounded-2xl p-6 shadow-[8px_8px_0px_#1e293b] space-y-6 print:border-none print:shadow-none print:bg-white print:text-black">
              <div className="flex justify-between items-center print:hidden">
                <div className="flex items-center space-x-2">
                  <Dumbbell className="h-6 w-6 text-[#10b981]" />
                  <h3 className="text-2xl font-black uppercase tracking-wider text-slate-900">SCHEDE PESI & PROGRAMMAZIONE SALA FORZA</h3>
                </div>
                <span className="text-xs font-black uppercase bg-emerald-100 text-slate-900 px-3 py-1 rounded-xl border-2 border-slate-900">{(selectedAthlete.workouts || []).length} SCHEDE PRESENTI</span>
              </div>

              {(selectedAthlete.workouts || []).length === 0 ? (
                <div className="text-center py-8 text-slate-600 font-bold text-sm border-4 border-dashed border-slate-900 rounded-xl bg-amber-50 print:hidden">
                  NESSUNA SCHEDA PESI ANCORA ASSEGNATA A {selectedAthlete.nome}. CLICCA SU <strong>"NUOVA SCHEDA PESI"</strong> PER AGGIUNGERNE UNA.
                </div>
              ) : (
                <div className="space-y-6">
                  {selectedAthlete.workouts.map((workout, idx) => (
                    <div 
                      key={workout.id || idx} 
                      className="bg-white border-4 border-slate-900 rounded-xl p-5 shadow-[4px_4px_0px_#000] print:border-black print:p-0 print:mb-6 print:shadow-none"
                    >
                      <div className="flex justify-between items-start mb-3 border-b-4 border-slate-900 pb-3">
                        <div>
                          <h4 className="font-black text-xl text-[#f43f5e] uppercase tracking-wide print:text-black">{workout.titolo}</h4>
                          <p className="text-xs font-black text-slate-600 uppercase">
                            PERIODO: <strong>{workout.dataInizio}</strong> {workout.dataFine ? `FINO A ${workout.dataFine}` : ''}
                          </p>
                          {workout.note && <p className="text-xs italic font-semibold text-slate-700 mt-1">NOTE: {workout.note}</p>}
                        </div>

                        <div className="flex space-x-2 print:hidden">
                          <button
                            onClick={() => {
                              setEditingWorkout(workout);
                              setWorkoutForm({
                                titolo: workout.titolo,
                                dataInizio: workout.dataInizio,
                                dataFine: workout.dataFine || '',
                                note: workout.note || '',
                                esercizi: workout.esercizi || []
                              });
                              setShowWorkoutModal(true);
                            }}
                            className="p-1 text-slate-900 hover:text-[#10b981]"
                          >
                            <Edit className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => handleDeleteWorkout(workout.id)}
                            className="p-1 text-slate-900 hover:text-rose-600"
                          >
                            <Trash2 className="h-5 w-5" />
                          </button>
                        </div>
                      </div>

                      {/* Tabella Esercizi Scheda */}
                      <div className="overflow-x-auto border-3 border-slate-900 rounded-lg">
                        <table className="w-full text-left text-xs sm:text-sm">
                          <thead className="bg-[#1e293b] text-[#fffdf0] uppercase font-black text-xs border-b-3 border-slate-900">
                            <tr>
                              <th className="px-3 py-2.5">ESERCIZIO</th>
                              <th className="px-3 py-2.5">SERIE X REPS</th>
                              <th className="px-3 py-2.5">CARICO (KG)</th>
                              <th className="px-3 py-2.5">RECUPERO</th>
                              <th className="px-3 py-2.5">NOTE / TEMPO</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y-2 divide-slate-900 font-bold bg-white">
                            {(workout.esercizi || []).map((ex, exIdx) => (
                              <tr key={exIdx} className="hover:bg-amber-100">
                                <td className="px-3 py-2.5 font-black text-slate-900 uppercase">{ex.nome}</td>
                                <td className="px-3 py-2.5 font-black text-[#f43f5e]">{ex.serieReps}</td>
                                <td className="px-3 py-2.5 font-black">{ex.carico}</td>
                                <td className="px-3 py-2.5 text-slate-700">{ex.recupero}</td>
                                <td className="px-3 py-2.5 italic text-slate-600">{ex.note || '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Grafico Salto & Misurazioni */}
            <div className="bg-[#fffdf0] border-4 border-slate-900 rounded-2xl p-6 shadow-[8px_8px_0px_#1e293b] space-y-4">
              <div>
                <h3 className="text-2xl font-black uppercase text-slate-900">EVOLUZIONE MENSILE JUMP TEST (CM)</h3>
                <p className="text-xs font-black text-slate-600 uppercase">CALCOLO AUTOMATICO QUOTA TOTALE: REACH 1 MANO ({selectedAthlete.reach1Mano} CM) + ELEVAZIONE NETTA</p>
              </div>

              {(selectedAthlete.logs || []).length > 0 ? (
                <div className="h-72 w-full pt-4 border-4 border-slate-900 rounded-xl bg-white p-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart 
                      data={selectedAthlete.logs.map(log => ({
                        data: log.data,
                        'Quota Salto Rincorsa': selectedAthlete.reach1Mano + log.saltoRincorsa,
                        'Quota Salto Fermo': selectedAthlete.reach1Mano + log.saltoFermo,
                      }))}
                      margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
                      <XAxis dataKey="data" stroke="#0f172a" fontStyle="bold" />
                      <YAxis domain={['auto', 'auto']} stroke="#0f172a" fontStyle="bold" />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#fffdf0', 
                          border: '3px solid #0f172a',
                          borderRadius: '12px',
                          color: '#0f172a',
                          fontWeight: 'bold'
                        }}
                      />
                      <Legend />
                      <Line type="monotone" dataKey="Quota Salto Rincorsa" stroke="#f43f5e" strokeWidth={4} activeDot={{ r: 8 }} />
                      <Line type="monotone" dataKey="Quota Salto Fermo" stroke="#38bdf8" strokeWidth={4} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="text-center py-10 text-slate-600 font-black text-sm">
                  NESSUNA MISURAZIONE MENSILE ANCORA INSERITA PER QUESTO ATLETA.
                </div>
              )}
            </div>

          </div>
        )}

      </main>

      {/* MODALE NUOVO / MODIFICA ATLETA */}
      {showAthleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm print:hidden">
          <div className="w-full max-w-md rounded-2xl p-6 bg-[#fffdf0] border-4 border-slate-900 shadow-[8px_8px_0px_#f43f5e]">
            <h3 className="text-2xl font-black uppercase tracking-wide text-slate-900 mb-4">{editingAthlete ? 'MODIFICA ATLETA' : 'NUOVO ATLETA'}</h3>

            <form onSubmit={handleSaveAthlete} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black text-slate-700 uppercase mb-1">NOME</label>
                  <input
                    type="text"
                    required
                    value={athleteForm.nome}
                    onChange={(e) => setAthleteForm({ ...athleteForm, nome: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border-3 border-slate-900 text-sm font-black uppercase bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-700 uppercase mb-1">COGNOME</label>
                  <input
                    type="text"
                    required
                    value={athleteForm.cognome}
                    onChange={(e) => setAthleteForm({ ...athleteForm, cognome: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border-3 border-slate-900 text-sm font-black uppercase bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black text-slate-700 uppercase mb-1">ANNO NASCITA</label>
                  <input
                    type="number"
                    required
                    value={athleteForm.annoNascita}
                    onChange={(e) => setAthleteForm({ ...athleteForm, annoNascita: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border-3 border-slate-900 text-sm font-black uppercase bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-700 uppercase mb-1">RUOLO</label>
                  <select
                    value={athleteForm.ruolo}
                    onChange={(e) => setAthleteForm({ ...athleteForm, ruolo: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border-3 border-slate-900 text-sm font-black uppercase bg-white focus:outline-none cursor-pointer"
                  >
                    {ROLES.map(r => <option key={r} value={r}>{r.toUpperCase()}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black text-slate-700 uppercase mb-1">REACH 1 MANO (CM)</label>
                  <input
                    type="number"
                    required
                    value={athleteForm.reach1Mano}
                    onChange={(e) => setAthleteForm({ ...athleteForm, reach1Mano: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border-3 border-slate-900 text-sm font-black uppercase bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-700 uppercase mb-1">REACH 2 MANI (CM)</label>
                  <input
                    type="number"
                    required
                    value={athleteForm.reach2Mani}
                    onChange={(e) => setAthleteForm({ ...athleteForm, reach2Mani: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border-3 border-slate-900 text-sm font-black uppercase bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAthleteModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-black uppercase bg-slate-200 text-slate-900 border-2 border-slate-900"
                >
                  ANNULLA
                </button>
                <button
                  type="submit"
                  className="bg-[#f43f5e] hover:bg-rose-600 text-white px-5 py-2 rounded-xl text-xs font-black uppercase border-3 border-slate-900 shadow-[2px_2px_0px_#000]"
                >
                  SALVA ATLETA
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODALE NUOVA MISURAZIONE TEST SALTO */}
      {showLogModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm print:hidden">
          <div className="w-full max-w-md rounded-2xl p-6 bg-[#fffdf0] border-4 border-slate-900 shadow-[8px_8px_0px_#38bdf8]">
            <h3 className="text-2xl font-black uppercase tracking-wide text-slate-900 mb-4">REGISTRA TEST MENSILE</h3>

            <form onSubmit={handleSaveLog} className="space-y-4">
              <div>
                <label className="block text-xs font-black text-slate-700 uppercase mb-1">MESE & ANNO</label>
                <input
                  type="month"
                  required
                  value={logForm.data}
                  onChange={(e) => setLogForm({ ...logForm, data: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border-3 border-slate-900 text-sm font-black uppercase bg-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black text-slate-700 uppercase mb-1">ALTEZZA (CM)</label>
                  <input
                    type="number"
                    required
                    value={logForm.altezza}
                    onChange={(e) => setLogForm({ ...logForm, altezza: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border-3 border-slate-900 text-sm font-black uppercase bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-700 uppercase mb-1">PESO (KG)</label>
                  <input
                    type="number"
                    required
                    value={logForm.peso}
                    onChange={(e) => setLogForm({ ...logForm, peso: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border-3 border-slate-900 text-sm font-black uppercase bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black text-slate-700 uppercase mb-1">SALTO FERMO (CM)</label>
                  <input
                    type="number"
                    required
                    value={logForm.saltoFermo}
                    onChange={(e) => setLogForm({ ...logForm, saltoFermo: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border-3 border-slate-900 text-sm font-black uppercase bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-700 uppercase mb-1">SALTO RINCORSA (CM)</label>
                  <input
                    type="number"
                    required
                    value={logForm.saltoRincorsa}
                    onChange={(e) => setLogForm({ ...logForm, saltoRincorsa: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border-3 border-slate-900 text-sm font-black uppercase bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="p-3 bg-amber-100 border-3 border-slate-900 rounded-xl text-xs space-y-1 font-black">
                <p className="text-[#f43f5e] uppercase">CALCOLO AUTOMATICO QUOTA TOTALE:</p>
                <p>• SALTO RINCORSA: <strong>{Number(selectedAthlete?.reach1Mano || 0) + Number(logForm.saltoRincorsa || 0)} CM</strong></p>
                <p>• SALTO MURO (FERMO): <strong>{Number(selectedAthlete?.reach1Mano || 0) + Number(logForm.saltoFermo || 0)} CM</strong></p>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowLogModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-black uppercase bg-slate-200 text-slate-900 border-2 border-slate-900"
                >
                  ANNULLA
                </button>
                <button
                  type="submit"
                  className="bg-[#38bdf8] hover:bg-sky-400 text-slate-900 px-5 py-2 rounded-xl text-xs font-black uppercase border-3 border-slate-900 shadow-[2px_2px_0px_#000]"
                >
                  SALVA TEST
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODALE SCHEDA PESI */}
      {showWorkoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm print:hidden">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl p-6 bg-[#fffdf0] border-4 border-slate-900 shadow-[8px_8px_0px_#10b981]">
            <h3 className="text-2xl font-black uppercase tracking-wide text-slate-900 mb-1">
              {editingWorkout ? 'MODIFICA SCHEDA PESI' : 'CREA NUOVA SCHEDA PESI'}
            </h3>
            <p className="text-xs font-black uppercase text-[#f43f5e] mb-4">ATLETA: <strong>{selectedAthlete?.nome} {selectedAthlete?.cognome}</strong></p>

            <form onSubmit={handleSaveWorkout} className="space-y-4">
              <div>
                <label className="block text-xs font-black text-slate-700 uppercase mb-1">TITOLO SCHEDA</label>
                <input
                  type="text"
                  required
                  value={workoutForm.titolo}
                  onChange={(e) => setWorkoutForm({ ...workoutForm, titolo: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border-3 border-slate-900 text-sm font-black uppercase bg-white focus:outline-none"
                  placeholder="ES. FASE PRE-CAMPIONATO FORZA ESPLOSIVA"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black text-slate-700 uppercase mb-1">DATA INIZIO</label>
                  <input
                    type="date"
                    required
                    value={workoutForm.dataInizio}
                    onChange={(e) => setWorkoutForm({ ...workoutForm, dataInizio: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border-3 border-slate-900 text-sm font-black uppercase bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-700 uppercase mb-1">DATA FINE (OPZIONALE)</label>
                  <input
                    type="date"
                    value={workoutForm.dataFine}
                    onChange={(e) => setWorkoutForm({ ...workoutForm, dataFine: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border-3 border-slate-900 text-sm font-black uppercase bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-700 uppercase mb-1">NOTE & OBIETTIVI</label>
                <textarea
                  value={workoutForm.note}
                  onChange={(e) => setWorkoutForm({ ...workoutForm, note: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 rounded-xl border-3 border-slate-900 text-sm font-black uppercase bg-white focus:outline-none"
                  placeholder="FOCUS SU RITMO CONCENTRICO ESPLOSIVO..."
                />
              </div>

              {/* LISTA DINAMICA ESERCIZI */}
              <div className="space-y-3 pt-3 border-t-3 border-slate-900">
                <div className="flex justify-between items-center">
                  <label className="block text-xs font-black uppercase text-slate-900">ESERCIZI IN PROGRAMMA</label>
                  <button
                    type="button"
                    onClick={handleAddExerciseRow}
                    className="text-xs bg-[#10b981] hover:bg-emerald-600 text-white px-3 py-1.5 rounded-lg font-black uppercase border-2 border-slate-900 shadow-[2px_2px_0px_#000] flex items-center space-x-1"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>AGGIUNGI ESERCIZIO</span>
                  </button>
                </div>

                {workoutForm.esercizi.map((ex, index) => (
                  <div key={index} className="p-3 rounded-xl border-3 border-slate-900 bg-white space-y-2">
                    <div className="flex items-center space-x-2">
                      <input
                        type="text"
                        placeholder="NOME ESERCIZIO (ES. SQUAT)"
                        value={ex.nome}
                        onChange={(e) => handleExerciseChange(index, 'nome', e.target.value)}
                        className="flex-1 px-2.5 py-1.5 text-xs sm:text-sm rounded-lg border-2 border-slate-900 font-black uppercase bg-amber-50"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveExerciseRow(index)}
                        className="text-slate-900 hover:text-rose-500 p-1"
                      >
                        <Trash className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <input
                        type="text"
                        placeholder="SERIE X REPS (ES. 4X6)"
                        value={ex.serieReps}
                        onChange={(e) => handleExerciseChange(index, 'serieReps', e.target.value)}
                        className="px-2.5 py-1.5 text-xs rounded-lg border-2 border-slate-900 font-black uppercase"
                      />
                      <input
                        type="text"
                        placeholder="CARICO (ES. 80 KG)"
                        value={ex.carico}
                        onChange={(e) => handleExerciseChange(index, 'carico', e.target.value)}
                        className="px-2.5 py-1.5 text-xs rounded-lg border-2 border-slate-900 font-black uppercase"
                      />
                      <input
                        type="text"
                        placeholder="RECUPERO (ES. 90S)"
                        value={ex.recupero}
                        onChange={(e) => handleExerciseChange(index, 'recupero', e.target.value)}
                        className="px-2.5 py-1.5 text-xs rounded-lg border-2 border-slate-900 font-black uppercase"
                      />
                    </div>

                    <input
                      type="text"
                      placeholder="NOTE ESECUZIONE (OPZIONALE)"
                      value={ex.note}
                      onChange={(e) => handleExerciseChange(index, 'note', e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border-2 border-slate-900 font-bold uppercase"
                    />
                  </div>
                ))}
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowWorkoutModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-black uppercase bg-slate-200 text-slate-900 border-2 border-slate-900"
                >
                  ANNULLA
                </button>
                <button
                  type="submit"
                  className="bg-[#10b981] hover:bg-emerald-600 text-white px-5 py-2 rounded-xl text-xs font-black uppercase border-3 border-slate-900 shadow-[2px_2px_0px_#000]"
                >
                  SALVA SCHEDA PESI
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODALE GESTIONE MULTI-SQUADRE */}
      {showTeamModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm print:hidden">
          <div className="w-full max-w-md rounded-2xl p-6 bg-[#fffdf0] border-4 border-slate-900 shadow-[8px_8px_0px_#1e293b]">
            <h3 className="text-2xl font-black uppercase tracking-wide text-slate-900 mb-4">GESTIONE SQUADRE STAFF</h3>

            <form onSubmit={handleCreateTeam} className="space-y-4 mb-6">
              <div>
                <label className="block text-xs font-black text-slate-700 uppercase mb-1">NOME NUOVA SQUADRA</label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    required
                    value={newTeamName}
                    onChange={(e) => setNewTeamName(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-xl border-3 border-slate-900 text-sm font-black uppercase bg-white focus:outline-none"
                    placeholder="ES. UNDER 19 MASCHILE"
                  />
                  <button
                    type="submit"
                    className="bg-[#f43f5e] hover:bg-rose-600 text-white px-4 py-2 rounded-xl text-xs font-black uppercase border-3 border-slate-900 shadow-[2px_2px_0px_#000]"
                  >
                    CREA
                  </button>
                </div>
              </div>
            </form>

            <div className="space-y-2 border-t-3 border-slate-900 pt-4">
              <label className="block text-xs font-black text-slate-700 uppercase mb-2">SQUADRE ESISTENTI</label>
              {teams.map(team => (
                <div key={team.id} className="flex justify-between items-center p-3 rounded-xl border-3 border-slate-900 bg-white font-black text-sm">
                  <span>★ {team.nome}</span>
                  <button
                    onClick={() => handleDeleteTeam(team.id)}
                    className="text-slate-900 hover:text-rose-500 p-1"
                    title="Elimina Squadra"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-6">
              <button
                onClick={() => setShowTeamModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-black uppercase bg-slate-200 text-slate-900 border-2 border-slate-900"
              >
                CHIUDI
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
