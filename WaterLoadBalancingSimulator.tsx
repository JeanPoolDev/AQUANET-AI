import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Server,
  Droplets,
  ShieldCheck,
  Thermometer,
  Users,
  Activity,
  Cpu,
  AlertTriangle,
  Play,
  Square,
  RotateCcw,
  Globe,
  Sliders,
  Gauge,
  Flame,
  Wind,
  CheckCircle2,
  Zap,
  ArrowRight,
  ArrowLeft,
  TrendingUp,
  Radio,
  Layers,
  Sparkles,
  Info,
  X,
  Factory,
  CloudOff
} from 'lucide-react';

// ============================================================================
// TIPOS Y MODELOS DE DATOS
// ============================================================================
export interface ServerNodeData {
  id: number;
  name: string;
  role: 'primary' | 'secondary';
  x: number;
  y: number;
  temp: number;
  load: number;
  status: 'optimal' | 'warning' | 'critical' | 'standby';
}

export interface TelemetryLog {
  id: number;
  time: string;
  text: string;
  type: 'info' | 'warning' | 'success' | 'alert';
}

interface Point {
  x: number;
  y: number;
}

// Helper para calcular puntos exactos sobre una curva Bezier Cúbica (Trayectoria de esferas)
function getCubicBezierPoints(
  p0: Point,
  p1: Point,
  p2: Point,
  p3: Point,
  steps = 8
): { xs: number[]; ys: number[] } {
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const mt = 1 - t;
    const x =
      mt * mt * mt * p0.x +
      3 * mt * mt * t * p1.x +
      3 * mt * t * t * p2.x +
      t * t * t * p3.x;
    const y =
      mt * mt * mt * p0.y +
      3 * mt * mt * t * p1.y +
      3 * mt * t * t * p2.y +
      t * t * t * p3.y;
    xs.push(Math.round(x));
    ys.push(Math.round(y));
  }
  return { xs, ys };
}

// ============================================================================
// COMPONENTE PRINCIPAL: WaterLoadBalancingSimulator V2
// ============================================================================
export const WaterLoadBalancingSimulator: React.FC = () => {
  // --------------------------------------------------------------------------
  // ESTADOS DE CONTROL Y CONFIGURACIÓN (TABS 1 Y 2)
  // --------------------------------------------------------------------------
  const [activeTab, setActiveTab] = useState<'config' | 'control'>('control');

  // Tab 1: Configuración Operativa
  const [serverCount, setServerCount] = useState<number>(5); // 3 a 8 servidores
  const [thermalThreshold, setThermalThreshold] = useState<number>(45); // 35°C a 55°C
  const [activeUsers, setActiveUsers] = useState<number>(45000); // 1k a 100k usuarios

  // Tab 2: Control, Simulación y Balancer
  const [isRunning, setIsRunning] = useState<boolean>(true);
  const [isSmartBalancing, setIsSmartBalancing] = useState<boolean>(false);
  const [isCoolingModalOpen, setIsCoolingModalOpen] = useState<boolean>(false);

  // Estados Térmicos e Hídricos
  const [mainServerTemp, setMainServerTemp] = useState<number>(36);
  const [waterLossTotal, setWaterLossTotal] = useState<number>(0);
  const [waterSavedTotal, setWaterSavedTotal] = useState<number>(0);

  // Telemetría en vivo
  const [logs, setLogs] = useState<TelemetryLog[]>([
    { id: 1, time: '12:00:00', text: 'Telemetría V2 inicializada. Topología dinámica lista.', type: 'info' }
  ]);
  const logIdRef = useRef<number>(2);

  const addLog = (text: string, type: 'info' | 'warning' | 'success' | 'alert' = 'info') => {
    const timeStr = new Date().toTimeString().split(' ')[0];
    setLogs(prev => [
      { id: logIdRef.current++, time: timeStr, text, type },
      ...prev.slice(0, 7)
    ]);
  };

  // Coordenada Fija del Nodo "El Mundo" (Fuente Ingress)
  const worldPoint: Point = { x: 130, y: 325 };

  // --------------------------------------------------------------------------
  // CÁLCULO TOPOLÓGICO DINÁMICO DE SERVIDORES (Semicírculo / Arco armónico)
  // --------------------------------------------------------------------------
  const servers: ServerNodeData[] = useMemo(() => {
    const list: ServerNodeData[] = [];
    const midIndex = Math.floor((serverCount - 1) / 2);
    const startY = 100;
    const endY = 550;
    const stepY = serverCount > 1 ? (endY - startY) / (serverCount - 1) : 0;

    let secondaryCounter = 2;

    for (let i = 0; i < serverCount; i++) {
      const y = Math.round(startY + i * stepY);
      // Curvatura elegante tipo disco cóncavo apuntando a El Mundo
      const normalizedDist = Math.abs(y - 325) / 225;
      const x = Math.round(720 - Math.pow(normalizedDist, 2) * 75);

      const isPrimary = (i === midIndex);
      const id = isPrimary ? 1 : secondaryCounter++;
      const name = isPrimary ? 'Servidor 1 (Principal)' : `Rack Secundario 0${id}`;

      let temp: number;
      let load: number;
      let status: 'optimal' | 'warning' | 'critical' | 'standby';

      if (isPrimary) {
        temp = mainServerTemp;
        if (!isSmartBalancing) {
          load = Math.min(99, Math.round(78 + (activeUsers / 100000) * 21));
          status = temp > thermalThreshold ? 'critical' : temp > 40 ? 'warning' : 'optimal';
        } else {
          load = Math.round(100 / serverCount);
          status = 'optimal';
        }
      } else {
        if (!isSmartBalancing) {
          temp = 23 + (id % 3);
          load = Math.round(3 + (id % 4));
          status = 'standby';
        } else {
          temp = Math.min(34, 27 + Math.round((activeUsers / 100000) * 6) + (id % 2));
          load = Math.round(100 / serverCount);
          status = 'optimal';
        }
      }

      list.push({
        id,
        name,
        role: isPrimary ? 'primary' : 'secondary',
        x,
        y,
        temp,
        load,
        status
      });
    }

    // Asegurar que el Servidor 1 siempre esté primero o identificable fácilmente
    return list;
  }, [serverCount, mainServerTemp, isSmartBalancing, activeUsers, thermalThreshold]);

  // Localizar Servidor Principal
  const primaryServer = useMemo(() => {
    return servers.find(s => s.role === 'primary') || servers[0];
  }, [servers]);

  // Servidores Secundarios
  const secondaryServers = useMemo(() => {
    return servers.filter(s => s.role === 'secondary');
  }, [servers]);

  // --------------------------------------------------------------------------
  // MÉTRICAS DERIVADAS
  // --------------------------------------------------------------------------
  const isOverheated = mainServerTemp > thermalThreshold;
  const isCoolingTowerActive = isOverheated && !isSmartBalancing;

  // Temperatura Promedio del Clúster
  const avgTemp = useMemo(() => {
    if (servers.length === 0) return 30;
    const sum = servers.reduce((acc, curr) => acc + curr.temp, 0);
    return sum / servers.length;
  }, [servers]);

  // Tasa instantánea de evaporación de agua (L/h)
  const currentWaterLossRate = useMemo(() => {
    if (!isRunning) return 0;
    if (isOverheated && !isSmartBalancing) {
      // Sube rápido en función de usuarios y sobretemperatura
      const excess = mainServerTemp - thermalThreshold;
      return Math.round(480 + excess * 90 + (activeUsers / 1000) * 12);
    }
    return 0;
  }, [isRunning, isOverheated, isSmartBalancing, mainServerTemp, thermalThreshold, activeUsers]);

  // --------------------------------------------------------------------------
  // MOTOR DE SIMULACIÓN Y TERMODINÁMICA (useEffect dependiente de isRunning)
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (!isRunning) return;

    const interval = setInterval(() => {
      if (!isSmartBalancing) {
        // --- ESCENARIO A (Balanceo OFF = Sobrecalentamiento) ---
        setMainServerTemp(prev => {
          const next = Math.min(64, prev + 2.5);
          return next;
        });

        // Acumular pérdida hídrica si sobrepasa el umbral
        if (mainServerTemp > thermalThreshold) {
          setWaterLossTotal(prev => prev + Math.round(currentWaterLossRate / 10));
        }
      } else {
        // --- ESCENARIO B (Balanceo ON = Modo Seco Activo) ---
        setMainServerTemp(prev => {
          const next = Math.max(29, prev - 4);
          return next;
        });

        // Acumular agua ahorrada
        const savedIncrement = Math.round(750 + (activeUsers / 1000) * 18);
        setWaterSavedTotal(prev => prev + savedIncrement);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning, isSmartBalancing, mainServerTemp, thermalThreshold, currentWaterLossRate, activeUsers]);

  // Disparar logs de telemetría en eventos clave
  useEffect(() => {
    if (isOverheated && !isSmartBalancing) {
      addLog(`[ALERTA TÉRMICA] Servidor 1 en ${mainServerTemp.toFixed(1)}°C superó el umbral (${thermalThreshold}°C). Torres de evaporación al 100%.`, 'alert');
    } else if (isSmartBalancing && mainServerTemp <= 31) {
      addLog(`[MODO SECO] Clúster estabilizado en ${mainServerTemp.toFixed(1)}°C. Torres apagadas. Cero evaporación.`, 'success');
    }
  }, [isOverheated, isSmartBalancing]);

  // Log al alternar switch de balanceo
  const handleToggleBalancing = () => {
    const nextState = !isSmartBalancing;
    setIsSmartBalancing(nextState);
    if (nextState) {
      addLog(`[BALANCEO ACTIVADO] Smart Load Balancing activo. Distribuyendo tráfico a ${serverCount} servidores.`, 'success');
    } else {
      addLog(`[BALANCEO DESACTIVADO] Carga concentrada en Servidor 1. Riesgo inminente de sobrecalentamiento.`, 'warning');
    }
  };

  // Reiniciar Simulación
  const handleReset = () => {
    setMainServerTemp(35);
    setWaterLossTotal(0);
    setWaterSavedTotal(0);
    setIsSmartBalancing(false);
    setIsRunning(true);
    addLog('Simulación reiniciada a condiciones estándar de laboratorio.', 'info');
  };

  return (
    <div className="h-screen w-full flex flex-col bg-slate-950 text-slate-100 overflow-hidden font-sans select-none antialiased">

      {/* ==================================================================== */}
      {/* 1. HEADER SUPERIOR CORPORATIVO                                        */}
      {/* ==================================================================== */}
      <header className="h-14 border-b border-slate-800 bg-slate-900/90 backdrop-blur px-6 flex items-center justify-between z-20 shrink-0">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.2)]">
            <Activity className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-sm font-bold tracking-wider uppercase text-slate-100 font-mono">
                AQUANET AI <span className="text-cyan-400 font-normal">DATA CENTER PLATFORM</span>
              </h1>
              <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-950/80 border border-cyan-700/60 text-cyan-300 font-mono">
                PROTOTIPO V2
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Simulador SaaS Avanzado de Carga Hídrica // Animación de Nodos & Balanceo Térmico
            </p>
          </div>
        </div>

        {/* Status Pills y Controles Rápidos */}
        <div className="flex items-center space-x-3">
          {/* Indicador de Ejecución */}
          <div className="flex items-center space-x-2 text-xs px-3 py-1 rounded-full bg-slate-950 border border-slate-800">
            <span className={`w-2 h-2 rounded-full ${isRunning ? 'bg-emerald-400 animate-ping' : 'bg-rose-500'}`}></span>
            <span className="text-slate-300 font-mono text-[11px]">
              {isRunning ? 'MOTOR EN VIVO' : 'PAUSADO'}
            </span>
          </div>

          {/* Badge Global de Régimen Térmico */}
          <div className="flex items-center space-x-2 text-xs px-3.5 py-1 rounded-full bg-slate-950 border border-slate-800">
            <span className={`w-2 h-2 rounded-full ${isSmartBalancing ? 'bg-emerald-400 shadow-[0_0_8px_#10b981]' :
              isOverheated ? 'bg-rose-500 animate-pulse shadow-[0_0_10px_#f43f5e]' :
                'bg-cyan-400'
              }`}></span>
            <span className="text-slate-300 font-mono text-[11px] font-semibold">
              {isSmartBalancing ? 'MODO SECO (CIRCUITO CERRADO)' : isOverheated ? 'ALERTA TÉRMICA: EVAPORACIÓN' : 'MONONODO: CALENTAMIENTO'}
            </span>
          </div>

          {/* Botón de Reset */}
          <button
            onClick={handleReset}
            className="flex items-center space-x-1.5 text-xs text-slate-400 hover:text-slate-200 px-3 py-1.5 rounded-lg border border-slate-800 hover:bg-slate-800/80 transition"
            title="Reiniciar valores"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        </div>
      </header>

      {/* ==================================================================== */}
      {/* 2. CONTENEDOR PRINCIPAL: 70% CANVAS | 30% PANEL DE CONTROL            */}
      {/* ==================================================================== */}
      <div className="flex-1 flex overflow-hidden">

        {/* ================================================================== */}
        {/* SECCIÓN IZQUIERDA (70%): LIENZO TOPOLÓGICO (TOPOLOGICAL CANVAS)    */}
        {/* ================================================================== */}
        <div className="w-[70%] h-full relative bg-slate-950 border-r border-slate-800 flex flex-col overflow-hidden">

          {/* Malla de Fondo Decorativa */}
          <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px] opacity-60 pointer-events-none" />

          {/* Overlay de Telemetría Superior del Canvas */}
          <div className="absolute top-4 left-6 right-6 z-10 flex items-center justify-between pointer-events-none">
            <div className="flex items-center space-x-2">
              <span className="text-[11px] font-mono uppercase tracking-widest text-slate-400 bg-slate-900/90 backdrop-blur px-3 py-1 rounded-md border border-slate-800">
                Topological Canvas // Clúster Activo: {serverCount} Servidores
              </span>
              <span className="text-[11px] font-mono text-cyan-400 bg-cyan-950/70 border border-cyan-800/60 px-2.5 py-1 rounded-md">
                {activeUsers.toLocaleString()} req/s
              </span>
            </div>

            {/* Badge de Alerta Visual */}
            {isSmartBalancing ? (
              <div className="flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-500/60 text-emerald-400 text-xs font-semibold shadow-[0_0_15px_rgba(16,185,129,0.25)]">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Dry / Closed Mode Active (0 L/h)</span>
              </div>
            ) : isOverheated ? (
              <div className="flex items-center space-x-2 px-3.5 py-1 rounded-full bg-rose-950/90 border border-rose-500 text-rose-400 text-xs font-semibold animate-pulse shadow-[0_0_20px_rgba(244,63,94,0.4)]">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                <span>ALERTA: EVAPORACIÓN EN CURSO ({currentWaterLossRate} L/h)</span>
              </div>
            ) : (
              <div className="flex items-center space-x-2 px-3 py-1 rounded-full bg-slate-900/80 border border-slate-800 text-slate-400 text-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                <span>Modo Bypass Directo // Acumulando Calor</span>
              </div>
            )}
          </div>

          {/* ---------------------------------------------------------------- */}
          {/* CAPA SVG: CONEXIONES Y ANIMACIÓN DE ESFERAS (FRAMER MOTION)       */}
          {/* ---------------------------------------------------------------- */}
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none z-0"
            viewBox="0 0 1000 650"
            preserveAspectRatio="none"
          >
            <defs>
              {/* Filtros de Resplandor Neón */}
              <filter id="glow-cyan" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="3.5" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <filter id="glow-rose" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="4.5" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <filter id="glow-emerald" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="3.5" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* 1. LÍNEAS SVG ESTÁTICAS/PULSANTES: De El Mundo a TODOS los servidores */}
            {servers.map((srv) => {
              const isPrimary = srv.role === 'primary';
              const p0 = worldPoint;
              const p3 = { x: srv.x, y: srv.y };
              const p1 = { x: Math.round(p0.x + (p3.x - p0.x) * 0.45), y: p0.y };
              const p2 = { x: Math.round(p0.x + (p3.x - p0.x) * 0.55), y: p3.y };
              const pathD = `M ${p0.x} ${p0.y} C ${p1.x} ${p1.y}, ${p2.x} ${p2.y}, ${p3.x} ${p3.y}`;

              // Color y grosor de línea según escenario
              let strokeColor = '#1e293b';
              let strokeWidth = '1.5';
              let strokeDash = '4 4';
              let opacity = 0.35;

              if (!isSmartBalancing) {
                if (isPrimary) {
                  strokeColor = isOverheated ? '#f43f5e' : '#06b6d4';
                  strokeWidth = isOverheated ? '3.5' : '2.5';
                  strokeDash = '6 4';
                  opacity = 0.95;
                } else {
                  opacity = 0.15;
                  strokeWidth = '1';
                }
              } else {
                strokeColor = '#10b981';
                strokeWidth = '2.2';
                strokeDash = '6 4';
                opacity = 0.85;
              }

              return (
                <path
                  key={`line-w-to-${srv.id}`}
                  d={pathD}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  strokeDasharray={strokeDash}
                  opacity={opacity}
                  filter={
                    !isSmartBalancing && isPrimary
                      ? isOverheated ? 'url(#glow-rose)' : 'url(#glow-cyan)'
                      : isSmartBalancing ? 'url(#glow-emerald)' : undefined
                  }
                />
              );
            })}

            {/* 2. LÍNEAS SVG MESH: Entre Servidores (Interconexión de Malla) */}
            {primaryServer && secondaryServers.map((sec) => {
              const mp0 = { x: primaryServer.x, y: primaryServer.y };
              const mp3 = { x: sec.x, y: sec.y };
              // Arco lateral curvado para representar bus de interconexión interna
              const mp1 = { x: primaryServer.x - 70, y: primaryServer.y };
              const mp2 = { x: sec.x - 70, y: sec.y };
              const meshPathD = `M ${mp0.x} ${mp0.y} C ${mp1.x} ${mp1.y}, ${mp2.x} ${mp2.y}, ${mp3.x} ${mp3.y}`;

              return (
                <path
                  key={`mesh-srv1-to-${sec.id}`}
                  d={meshPathD}
                  fill="none"
                  stroke={isSmartBalancing ? '#38bdf8' : '#1e293b'}
                  strokeWidth={isSmartBalancing ? '1.8' : '1'}
                  strokeDasharray={isSmartBalancing ? '5 4' : '3 6'}
                  opacity={isSmartBalancing ? 0.75 : 0.15}
                  filter={isSmartBalancing ? 'url(#glow-cyan)' : undefined}
                />
              );
            })}

            {/* 3. LÍNEAS ADYACENTES ENTRE SERVIDORES SECUNDARIOS (Malla Anular) */}
            {secondaryServers.map((sec, idx) => {
              if (idx === secondaryServers.length - 1) return null;
              const nextSec = secondaryServers[idx + 1];
              return (
                <line
                  key={`inter-sec-${sec.id}-${nextSec.id}`}
                  x1={sec.x}
                  y1={sec.y}
                  x2={nextSec.x}
                  y2={nextSec.y}
                  stroke={isSmartBalancing ? '#06b6d4' : '#1e293b'}
                  strokeWidth="1"
                  strokeDasharray="3 4"
                  opacity={isSmartBalancing ? 0.35 : 0.1}
                />
              );
            })}

            {/* -------------------------------------------------------------- */}
            {/* 4. ANIMACIÓN DE ESFERAS DE TRÁFICO CON FRAMER MOTION           */}
            {/* -------------------------------------------------------------- */}
            {isRunning && servers.map((srv) => {
              const isPrimary = srv.role === 'primary';
              const p0 = worldPoint;
              const p3 = { x: srv.x, y: srv.y };
              const p1 = { x: Math.round(p0.x + (p3.x - p0.x) * 0.45), y: p0.y };
              const p2 = { x: Math.round(p0.x + (p3.x - p0.x) * 0.55), y: p3.y };
              const { xs, ys } = getCubicBezierPoints(p0, p1, p2, p3, 8);

              // ESCENARIO A (Balanceo OFF): 90% del tráfico hacia Servidor 1
              if (!isSmartBalancing) {
                if (isPrimary) {
                  // Múltiples esferas de tráfico denso hacia el Servidor Principal
                  const particleDelays = [0, 0.22, 0.44, 0.66, 0.88, 1.1, 1.32];
                  return (
                    <g key={`stream-w-to-srv1`}>
                      {particleDelays.map((del, pIdx) => (
                        <motion.circle
                          key={`p-pri-${pIdx}`}
                          r={isOverheated ? 4.5 : 3.8}
                          fill={isOverheated ? '#f43f5e' : '#06b6d4'}
                          filter={isOverheated ? 'url(#glow-rose)' : 'url(#glow-cyan)'}
                          animate={{
                            cx: xs,
                            cy: ys,
                            opacity: [0, 0.9, 1, 1, 1, 0.9, 0],
                            scale: [0.8, 1.2, 1.2, 1, 0.8]
                          }}
                          transition={{
                            duration: 1.5,
                            repeat: Infinity,
                            ease: 'linear',
                            delay: del
                          }}
                        />
                      ))}
                    </g>
                  );
                } else {
                  // Tráfico mínimo residual hacia los demás servidores (10%)
                  return (
                    <motion.circle
                      key={`stream-w-to-${srv.id}-slow`}
                      r={2.5}
                      fill="#64748b"
                      animate={{
                        cx: xs,
                        cy: ys,
                        opacity: [0, 0.35, 0.35, 0]
                      }}
                      transition={{
                        duration: 3.2,
                        repeat: Infinity,
                        ease: 'linear',
                        delay: (srv.id * 0.6) % 3
                      }}
                    />
                  );
                }
              }

              // ESCENARIO B (Balanceo ON): Esferas distribuidas equitativamente a todos los servidores
              const balancedDelays = [0, 0.7, 1.4];
              return (
                <g key={`stream-w-to-${srv.id}-balanced`}>
                  {balancedDelays.map((del, pIdx) => (
                    <motion.circle
                      key={`p-bal-${srv.id}-${pIdx}`}
                      r={3.4}
                      fill="#10b981"
                      filter="url(#glow-emerald)"
                      animate={{
                        cx: xs,
                        cy: ys,
                        opacity: [0, 0.85, 1, 1, 0.85, 0],
                        scale: [0.8, 1.1, 1, 0.8]
                      }}
                      transition={{
                        duration: 2.1,
                        repeat: Infinity,
                        ease: 'linear',
                        delay: del + (srv.id * 0.15)
                      }}
                    />
                  ))}
                </g>
              );
            })}

            {/* 5. ESFERAS DE TRÁFICO MESH EN ESCENARIO B: Delegación de tareas desde Servidor 1 hacia los demás */}
            {isRunning && isSmartBalancing && primaryServer && secondaryServers.map((sec) => {
              const mp0 = { x: primaryServer.x, y: primaryServer.y };
              const mp3 = { x: sec.x, y: sec.y };
              const mp1 = { x: primaryServer.x - 70, y: primaryServer.y };
              const mp2 = { x: sec.x - 70, y: sec.y };
              const { xs: mXs, ys: mYs } = getCubicBezierPoints(mp0, mp1, mp2, mp3, 8);

              const meshDelays = [0.2, 1.2];
              return (
                <g key={`mesh-particles-${sec.id}`}>
                  {meshDelays.map((del, mIdx) => (
                    <motion.circle
                      key={`mp-${sec.id}-${mIdx}`}
                      r={3.0}
                      fill="#38bdf8"
                      filter="url(#glow-cyan)"
                      animate={{
                        cx: mXs,
                        cy: mYs,
                        opacity: [0, 0.8, 1, 1, 0.8, 0],
                        scale: [0.8, 1.1, 1, 0.8]
                      }}
                      transition={{
                        duration: 1.9,
                        repeat: Infinity,
                        ease: 'linear',
                        delay: del + (sec.id * 0.2)
                      }}
                    />
                  ))}
                </g>
              );
            })}
          </svg>

          {/* ---------------------------------------------------------------- */}
          {/* NODOS HTML INTERACTIVOS DEL CANVAS                               */}
          {/* ---------------------------------------------------------------- */}
          <div className="relative w-full h-full pointer-events-none">

            {/* NODO A: "EL MUNDO" (Fuente Global de Tráfico de Usuarios) */}
            <div
              className="absolute pointer-events-auto -translate-x-1/2 -translate-y-1/2 z-20"
              style={{ left: `${(worldPoint.x / 1000) * 100}%`, top: `${(worldPoint.y / 650) * 100}%` }}
            >
              <div className="relative group">
                {/* Ondas de Pulso de Radar Ingress */}
                {isRunning && (
                  <motion.div
                    className="absolute -inset-2 rounded-2xl border border-cyan-500/40 pointer-events-none"
                    animate={{ scale: [1, 1.25, 1.35], opacity: [0.6, 0.2, 0] }}
                    transition={{ duration: 2.4, repeat: Infinity, ease: 'easeOut' }}
                  />
                )}

                <div className="w-52 bg-slate-900/95 border border-cyan-500/40 rounded-2xl p-4 shadow-[0_0_25px_rgba(6,182,212,0.18)] backdrop-blur transition-all duration-300 hover:border-cyan-400">
                  <div className="flex items-center space-x-3 mb-2.5">
                    <div className="w-9 h-9 rounded-xl bg-cyan-950 border border-cyan-800 flex items-center justify-center text-cyan-400 shadow-inner">
                      <Globe className="w-5 h-5 animate-[spin_12s_linear_infinite]" />
                    </div>
                    <div>
                      <div className="text-[10px] uppercase font-mono text-cyan-400 font-semibold tracking-wider">
                        Fuente de Tráfico
                      </div>
                      <div className="text-xs font-bold text-slate-100">
                        El Mundo // Ingress
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-950/80 rounded-xl p-2.5 border border-slate-800/80 mb-2">
                    <div className="text-[10px] text-slate-400">Peticiones Concurrentes:</div>
                    <div className="text-base font-mono font-bold text-cyan-300 flex items-baseline justify-between">
                      <span>{activeUsers.toLocaleString()}</span>
                      <span className="text-[10px] text-slate-500 font-normal font-sans">req/s</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                    <span className="flex items-center space-x-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                      <span>HTTPS / LLM</span>
                    </span>
                    <span className="text-cyan-400">Gateway 01</span>
                  </div>
                </div>
              </div>
            </div>

            {/* NODOS B: SERVIDORES (Renderizado Dinámico de 3 a 8 servidores) */}
            {servers.map((srv) => {
              const isPrimary = srv.role === 'primary';
              const leftPercent = (srv.x / 1000) * 100;
              const topPercent = (srv.y / 650) * 100;

              return (
                <div
                  key={`card-srv-${srv.id}`}
                  className="absolute pointer-events-auto -translate-x-1/2 -translate-y-1/2 z-20 transition-all duration-500"
                  style={{ left: `${leftPercent}%`, top: `${topPercent}%` }}
                >
                  <div className={`w-52 rounded-2xl p-3.5 backdrop-blur transition-all duration-500 border shadow-xl ${isPrimary
                    ? isOverheated
                      ? 'bg-slate-900/95 border-rose-500 shadow-[0_0_30px_rgba(244,63,94,0.45)] ring-2 ring-rose-500/40 animate-pulse'
                      : isSmartBalancing
                        ? 'bg-slate-900/95 border-emerald-500/60 shadow-[0_0_25px_rgba(16,185,129,0.25)]'
                        : 'bg-slate-900/95 border-cyan-500/50 shadow-[0_0_20px_rgba(6,182,212,0.2)]'
                    : isSmartBalancing
                      ? 'bg-slate-900/95 border-emerald-500/40 shadow-[0_0_15px_rgba(16,185,129,0.15)] opacity-100'
                      : 'bg-slate-900/40 border-slate-800/80 opacity-50 shadow-none'
                    }`}>
                    {/* Header de la Tarjeta del Servidor */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${isPrimary
                          ? isOverheated
                            ? 'bg-rose-950 border border-rose-700 text-rose-400'
                            : isSmartBalancing
                              ? 'bg-emerald-950 border border-emerald-700 text-emerald-400'
                              : 'bg-cyan-950 border border-cyan-700 text-cyan-400'
                          : isSmartBalancing
                            ? 'bg-emerald-950 border border-emerald-800 text-emerald-400'
                            : 'bg-slate-800 border border-slate-700 text-slate-500'
                          }`}>
                          {isPrimary && isOverheated ? (
                            <Flame className="w-4 h-4 animate-bounce text-rose-400" />
                          ) : (
                            <Server className="w-4 h-4" />
                          )}
                        </div>
                        <div>
                          <div className="text-[11px] font-bold text-slate-200 leading-tight">
                            {srv.name}
                          </div>
                          <div className="text-[9px] font-mono text-slate-400">
                            {isPrimary ? 'Core AI Node' : 'Secondary Rack'}
                          </div>
                        </div>
                      </div>

                      {/* Status Tag */}
                      <span className={`text-[9px] px-2 py-0.5 rounded-full font-mono font-semibold uppercase ${isPrimary && isOverheated
                        ? 'bg-rose-950 text-rose-300 border border-rose-600 animate-pulse'
                        : srv.status === 'optimal'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                          : srv.status === 'warning'
                            ? 'bg-amber-950 text-amber-300 border border-amber-700'
                            : 'bg-slate-800 text-slate-400 border border-slate-700'
                        }`}>
                        {srv.status === 'critical' ? 'CRÍTICO' : srv.status === 'optimal' ? 'ÓPTIMO' : srv.status === 'warning' ? 'ALERTA' : 'STANDBY'}
                      </span>
                    </div>

                    {/* Métricas Interiores (Temperatura y Carga de Cómputo) */}
                    <div className="grid grid-cols-2 gap-2 text-[10px] font-mono bg-slate-950/80 p-2.5 rounded-xl border border-slate-800/80">
                      <div>
                        <div className="text-slate-500 text-[9px]">Temp CPU:</div>
                        <div className={`text-xs font-bold flex items-center space-x-1 ${srv.temp > thermalThreshold
                          ? 'text-rose-400 font-extrabold'
                          : srv.temp > 38
                            ? 'text-amber-400'
                            : 'text-cyan-300'
                          }`}>
                          <Thermometer className="w-3 h-3" />
                          <span>{srv.temp.toFixed(1)}°C</span>
                        </div>
                      </div>

                      <div>
                        <div className="text-slate-500 text-[9px]">Carga TDP:</div>
                        <div className={`text-xs font-bold flex items-center space-x-1 ${srv.load > 70 ? 'text-rose-400' : srv.load > 30 ? 'text-amber-300' : 'text-emerald-400'
                          }`}>
                          <Cpu className="w-3 h-3" />
                          <span>{srv.load}%</span>
                        </div>
                      </div>
                    </div>

                    {/* Barra de Progreso Térmico */}
                    <div className="mt-2 w-full bg-slate-950 h-1.5 rounded-full overflow-hidden border border-slate-800">
                      <div
                        className={`h-full transition-all duration-500 ${srv.temp > thermalThreshold
                          ? 'bg-rose-500 shadow-[0_0_8px_#f43f5e]'
                          : srv.temp > 38
                            ? 'bg-amber-400'
                            : 'bg-cyan-400'
                          }`}
                        style={{ width: `${Math.min(100, (srv.temp / 65) * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}

          </div>

          {/* Pie del Canvas: Leyenda Rápida */}
          <div className="absolute bottom-3 left-6 right-6 z-10 flex items-center justify-between text-[11px] text-slate-400 font-mono pointer-events-none">
            <div className="flex items-center space-x-4 bg-slate-900/90 backdrop-blur px-3 py-1.5 rounded-lg border border-slate-800">
              <span className="flex items-center space-x-1.5">
                <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                <span>Ingress User Traffic</span>
              </span>
              <span className="flex items-center space-x-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                <span>Dry Mesh Routing</span>
              </span>
              <span className="flex items-center space-x-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                <span>Thermal Bottleneck</span>
              </span>
            </div>

            <div className="bg-slate-900/90 backdrop-blur px-3 py-1.5 rounded-lg border border-slate-800">
              Umbral Límite: <span className="text-rose-400 font-bold">{thermalThreshold}°C</span>
            </div>
          </div>

        </div>

        {/* ================================================================== */}
        {/* SECCIÓN DERECHA (30%): PANEL DE CONTROL CON TABS                     */}
        {/* ================================================================== */}
        <div className="w-[30%] h-full bg-slate-900/95 border-l border-slate-800 flex flex-col overflow-hidden">

          {/* Header de Tabs (Selector de Tab 1 vs Tab 2) */}
          <div className="h-12 border-b border-slate-800 flex items-stretch shrink-0 bg-slate-950">
            <button
              onClick={() => setActiveTab('config')}
              className={`flex-1 flex items-center justify-center space-x-2 text-xs font-semibold transition-all ${activeTab === 'config'
                ? 'text-cyan-400 border-b-2 border-cyan-400 bg-slate-900/90 shadow-inner'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
                }`}
            >
              <Sliders className="w-4 h-4" />
              <span>Configuración Operativa</span>
            </button>

            <button
              onClick={() => setActiveTab('control')}
              className={`flex-1 flex items-center justify-center space-x-2 text-xs font-semibold transition-all relative ${activeTab === 'control'
                ? 'text-cyan-400 border-b-2 border-cyan-400 bg-slate-900/90 shadow-inner'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
                }`}
            >
              <Gauge className="w-4 h-4" />
              <span>Control, Torre & KPIs</span>
              {isOverheated && !isSmartBalancing && (
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping absolute top-2 right-4"></span>
              )}
            </button>
          </div>

          {/* ---------------------------------------------------------------- */}
          {/* CONTENIDO DE LOS TABS                                            */}
          {/* ---------------------------------------------------------------- */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5">

            {/* ============================================================== */}
            {/* TAB 1: CONFIGURACIÓN OPERATIVA                                  */}
            {/* ============================================================== */}
            {activeTab === 'config' && (
              <div className="space-y-6">

                <div className="border-b border-slate-800 pb-3">
                  <h2 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
                    <Sliders className="w-4 h-4 text-cyan-400" />
                    <span>Parámetros de Infraestructura</span>
                  </h2>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Ajuste la cantidad dinámica de nodos, el umbral de evaporación hídrica y la demanda de usuarios.
                  </p>
                </div>

                {/* SLIDER 1: Servidores Activos (serverCount: 3 a 8) */}
                <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-200 flex items-center space-x-2">
                      <Server className="w-4 h-4 text-cyan-400" />
                      <span>Servidores Activos en Clúster</span>
                    </label>
                    <span className="px-2.5 py-0.5 rounded-lg bg-cyan-950 border border-cyan-700 text-cyan-300 font-mono font-bold text-xs">
                      {serverCount} Servidores
                    </span>
                  </div>

                  <input
                    type="range"
                    min="3"
                    max="8"
                    step="1"
                    value={serverCount}
                    onChange={(e) => {
                      const count = Number(e.target.value);
                      setServerCount(count);
                      addLog(`Topología redimensionada a ${count} servidores en el canvas.`, 'info');
                    }}
                    className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                  />

                  {/* Selector rápido por botones de píldora */}
                  <div className="flex justify-between items-center pt-1">
                    {[3, 4, 5, 6, 7, 8].map((num) => (
                      <button
                        key={num}
                        onClick={() => {
                          setServerCount(num);
                          addLog(`Topología redimensionada a ${num} servidores.`, 'info');
                        }}
                        className={`text-[10px] font-mono w-7 h-6 rounded flex items-center justify-center transition ${serverCount === num
                          ? 'bg-cyan-500 text-slate-950 font-bold shadow-[0_0_8px_rgba(6,182,212,0.5)]'
                          : 'bg-slate-800/80 text-slate-400 hover:bg-slate-700'
                          }`}
                      >
                        {num}
                      </button>
                    ))}
                  </div>

                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    Al modificar este valor, el canvas del 70% actualiza en tiempo real su topología y las conexiones en malla.
                  </p>
                </div>

                {/* SLIDER 2: Umbral Térmico (thermalThreshold: 35°C a 55°C) */}
                <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-200 flex items-center space-x-2">
                      <Thermometer className="w-4 h-4 text-rose-400" />
                      <span>Umbral Térmico Crítico</span>
                    </label>
                    <span className="px-2.5 py-0.5 rounded-lg bg-rose-950 border border-rose-700 text-rose-300 font-mono font-bold text-xs">
                      {thermalThreshold} °C
                    </span>
                  </div>

                  <input
                    type="range"
                    min="35"
                    max="55"
                    step="1"
                    value={thermalThreshold}
                    onChange={(e) => setThermalThreshold(Number(e.target.value))}
                    className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-rose-500"
                  />

                  <div className="flex justify-between text-[10px] font-mono text-slate-500">
                    <span>35°C (Estricto)</span>
                    <span className="text-rose-400 font-bold">{thermalThreshold}°C</span>
                    <span>55°C (Tolerante)</span>
                  </div>

                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    Define la temperatura límite admisible antes de que el Servidor Principal active de emergencia las torres evaporativas de agua dulce.
                  </p>
                </div>

                {/* SLIDER 3: Carga de Usuarios (activeUsers: 1k a 100k) */}
                <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-200 flex items-center space-x-2">
                      <Users className="w-4 h-4 text-indigo-400" />
                      <span>Carga de Usuarios Concurrente</span>
                    </label>
                    <span className="px-2.5 py-0.5 rounded-lg bg-indigo-950 border border-indigo-700 text-indigo-300 font-mono font-bold text-xs">
                      {activeUsers.toLocaleString()} req/s
                    </span>
                  </div>

                  <input
                    type="range"
                    min="1000"
                    max="100000"
                    step="1000"
                    value={activeUsers}
                    onChange={(e) => setActiveUsers(Number(e.target.value))}
                    className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />

                  <div className="flex justify-between text-[10px] font-mono text-slate-500">
                    <span>1,000 req/s</span>
                    <span>50,000 req/s</span>
                    <span>100,000 req/s</span>
                  </div>

                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    Volumen de inferencias que emite el nodo "El Mundo". Un volumen más alto acelera el calentamiento del Servidor 1 cuando el balanceo está apagado.
                  </p>
                </div>

                {/* Perfiles Rápidos de Prueba */}
                <div className="border border-slate-800 rounded-xl p-3 bg-slate-900/50 space-y-2">
                  <div className="text-[10px] font-mono text-slate-400 uppercase font-semibold">
                    Escenarios Preconfigurados B2B
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => {
                        setServerCount(6);
                        setThermalThreshold(42);
                        setActiveUsers(80000);
                        setIsSmartBalancing(false);
                        addLog('Escenario cargado: "Pico de Tráfico Extremo (Black Friday)".', 'warning');
                      }}
                      className="text-[11px] p-2 rounded-lg border border-rose-900/60 bg-rose-950/30 hover:bg-rose-900/40 text-rose-300 text-left transition"
                    >
                      <div className="font-bold flex items-center space-x-1">
                        <Flame className="w-3.5 h-3.5 text-rose-400" />
                        <span>Pico Extremo</span>
                      </div>
                      <div className="text-[9px] text-slate-400">80k req/s // 42°C límite</div>
                    </button>

                    <button
                      onClick={() => {
                        setServerCount(5);
                        setThermalThreshold(46);
                        setActiveUsers(45000);
                        setIsSmartBalancing(true);
                        addLog('Escenario cargado: "Operación Balanceada Sostenible".', 'success');
                      }}
                      className="text-[11px] p-2 rounded-lg border border-emerald-900/60 bg-emerald-950/30 hover:bg-emerald-900/40 text-emerald-300 text-left transition"
                    >
                      <div className="font-bold flex items-center space-x-1">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Sostenible</span>
                      </div>
                      <div className="text-[9px] text-slate-400">Smart LB Activo // Eco</div>
                    </button>
                  </div>
                </div>

              </div>
            )}

            {/* ============================================================== */}
            {/* TAB 2: CONTROL, TORRE DE ENFRIAMIENTO Y KPIS                     */}
            {/* ============================================================== */}
            {activeTab === 'control' && (
              <div className="space-y-5">

                {/* 1. CONTROLES DE SIMULACIÓN (PLAY / STOP) */}
                <div className="space-y-2">
                  <div className="text-[10px] uppercase font-mono text-slate-400 font-semibold">
                    Control de Ejecución del Motor
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      onClick={() => {
                        setIsRunning(true);
                        addLog('Simulación reanudada por el operador.', 'info');
                      }}
                      className={`flex items-center justify-center space-x-2 py-3 px-4 rounded-xl font-bold text-xs transition shadow-lg ${isRunning
                        ? 'bg-emerald-600 text-white shadow-[0_0_20px_rgba(16,185,129,0.35)] ring-2 ring-emerald-400'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
                        }`}
                    >
                      <Play className="w-4 h-4 fill-current" />
                      <span>▶ INICIAR SIMULACIÓN</span>
                    </button>

                    <button
                      onClick={() => {
                        setIsRunning(false);
                        addLog('Simulación detenida / pausada.', 'warning');
                      }}
                      className={`flex items-center justify-center space-x-2 py-3 px-4 rounded-xl font-bold text-xs transition ${!isRunning
                        ? 'bg-rose-600 text-white shadow-[0_0_20px_rgba(244,63,94,0.35)] ring-2 ring-rose-400'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
                        }`}
                    >
                      <Square className="w-4 h-4 fill-current" />
                      <span>⏹ DETENER</span>
                    </button>
                  </div>
                </div>

                {/* 2. ACCIÓN PRINCIPAL: TOGGLE SWITCH DE SMART LOAD BALANCING */}
                <div className={`rounded-2xl p-4 border transition-all duration-300 shadow-xl ${isSmartBalancing
                  ? 'bg-gradient-to-br from-emerald-950/60 to-slate-900 border-emerald-500/70 shadow-[0_0_25px_rgba(16,185,129,0.2)]'
                  : 'bg-gradient-to-br from-slate-900 to-slate-950 border-slate-800'
                  }`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                        Estrategia Central
                      </div>
                      <div className="text-sm font-bold text-slate-100 flex items-center space-x-1.5 mt-0.5">
                        <Zap className={`w-4 h-4 ${isSmartBalancing ? 'text-emerald-400' : 'text-slate-400'}`} />
                        <span>Smart Load Balancing</span>
                      </div>
                    </div>

                    {/* Switch Visual Grande */}
                    <button
                      onClick={handleToggleBalancing}
                      className={`w-14 h-8 rounded-full p-1 transition-colors duration-300 flex items-center cursor-pointer ${isSmartBalancing ? 'bg-emerald-500 shadow-[0_0_12px_#10b981]' : 'bg-slate-800'
                        }`}
                      title={isSmartBalancing ? 'Desactivar Balanceo' : 'Activar Smart Load Balancing'}
                    >
                      <div
                        className={`w-6 h-6 rounded-full bg-white shadow-md transform transition-transform duration-300 flex items-center justify-center text-[10px] font-bold ${isSmartBalancing ? 'translate-x-6 text-emerald-700' : 'translate-x-0 text-slate-600'
                          }`}
                      >
                        {isSmartBalancing ? 'ON' : 'OFF'}
                      </div>
                    </button>
                  </div>

                  {/* Detalle del Estado de Balanceo */}
                  <div className="mt-3 pt-3 border-t border-slate-800/80 text-[11px] leading-relaxed">
                    {isSmartBalancing ? (
                      <div className="text-emerald-300 flex items-start space-x-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                        <span>
                          <strong>Modo Seco Activo:</strong> Flujo distribuido uniformemente entre los {serverCount} racks. Delegación de cómputo en marcha.
                        </span>
                      </div>
                    ) : (
                      <div className="text-slate-400 flex items-start space-x-2">
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                        <span>
                          <strong>Balanceo Inactivo:</strong> El Servidor 1 asume el 90% del tráfico global, conduciendo al sobrecalentamiento crítico.
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* 3. MÉTRICAS (KPIS) */}
                <div className="space-y-2">
                  <div className="text-[10px] uppercase font-mono text-slate-400 font-semibold flex items-center justify-between">
                    <span>Métricas y KPIs del Sistema</span>
                    <span className="text-cyan-400 text-[9px]">Telemetría en Vivo</span>
                  </div>

                  <div className="grid grid-cols-1 gap-2.5">

                    {/* KPI 1: Temperatura Promedio */}
                    <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${avgTemp > thermalThreshold
                          ? 'bg-rose-950 border border-rose-800 text-rose-400'
                          : 'bg-cyan-950 border border-cyan-800 text-cyan-400'
                          }`}>
                          <Thermometer className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-400 font-mono">Temperatura Promedio</div>
                          <div className={`text-base font-mono font-bold ${avgTemp > thermalThreshold ? 'text-rose-400' : 'text-slate-100'
                            }`}>
                            {avgTemp.toFixed(1)} °C
                          </div>
                        </div>
                      </div>
                      <div className="text-right text-[10px] font-mono text-slate-500">
                        <div>Umbral: {thermalThreshold}°C</div>
                        <div className={mainServerTemp > thermalThreshold ? 'text-rose-400' : 'text-emerald-400'}>
                          Srv1: {mainServerTemp.toFixed(1)}°C
                        </div>
                      </div>
                    </div>

                    {/* KPI 2: Agua Evaporada (L/h) */}
                    <div className={`border rounded-xl p-3 flex items-center justify-between transition-colors ${currentWaterLossRate > 0
                      ? 'bg-rose-950/30 border-rose-500/60 shadow-[0_0_15px_rgba(244,63,94,0.15)]'
                      : 'bg-slate-950/80 border-slate-800'
                      }`}>
                      <div className="flex items-center space-x-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${currentWaterLossRate > 0
                          ? 'bg-rose-950 border border-rose-700 text-rose-400'
                          : 'bg-slate-800 border border-slate-700 text-slate-500'
                          }`}>
                          <Droplets className={`w-5 h-5 ${currentWaterLossRate > 0 ? 'animate-bounce' : ''}`} />
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-400 font-mono">Agua Evaporada (Tasa / Total)</div>
                          <div className={`text-base font-mono font-bold ${currentWaterLossRate > 0 ? 'text-rose-400 animate-pulse' : 'text-slate-300'
                            }`}>
                            {currentWaterLossRate.toLocaleString()} <span className="text-xs font-normal">L/h</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right text-[10px] font-mono">
                        <div className="text-slate-500">Pérdida acumulada:</div>
                        <div className="text-rose-300 font-bold">{waterLossTotal.toLocaleString()} L</div>
                      </div>
                    </div>

                    {/* KPI 3: Agua Ahorrada (L/día) */}
                    <div className={`border rounded-xl p-3 flex items-center justify-between transition-colors ${isSmartBalancing
                      ? 'bg-emerald-950/30 border-emerald-500/60 shadow-[0_0_15px_rgba(16,185,129,0.15)]'
                      : 'bg-slate-950/80 border-slate-800'
                      }`}>
                      <div className="flex items-center space-x-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isSmartBalancing
                          ? 'bg-emerald-950 border border-emerald-700 text-emerald-400'
                          : 'bg-slate-800 border border-slate-700 text-slate-500'
                          }`}>
                          <ShieldCheck className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-400 font-mono">Agua Ahorrada (Modo Seco)</div>
                          <div className="text-base font-mono font-bold text-emerald-400">
                            {waterSavedTotal.toLocaleString()} <span className="text-xs font-normal">L/día</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right text-[10px] font-mono text-slate-500">
                        <div>Equivalente:</div>
                        <div className="text-emerald-300 font-bold">~{Math.round(waterSavedTotal / 250)} personas/día</div>
                      </div>
                    </div>

                  </div>
                </div>

                {/* 4. WIDGET VISUAL: TORRE DE ENFRIAMIENTO EVAPORATIVO (CLICKABLE -> MODAL) */}
                <div
                  onClick={() => setIsCoolingModalOpen(true)}
                  className={`border rounded-2xl p-4 relative overflow-hidden transition-all duration-300 cursor-pointer hover:ring-2 hover:ring-blue-500 group ${isCoolingTowerActive
                    ? 'bg-gradient-to-b from-rose-950/60 to-slate-950 border-rose-500 shadow-[0_0_30px_rgba(244,63,94,0.35)]'
                    : isSmartBalancing
                      ? 'bg-gradient-to-b from-emerald-950/40 to-slate-950 border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.15)]'
                      : 'bg-slate-950/90 border-slate-800 hover:border-slate-700'
                    }`}
                  title="Haz clic para inspeccionar el esquema físico y el ciclo termodinámico del agua"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${isCoolingTowerActive
                        ? 'bg-rose-950 border border-rose-700 text-rose-400'
                        : isSmartBalancing
                          ? 'bg-emerald-950 border border-emerald-700 text-emerald-400'
                          : 'bg-slate-800 text-slate-400'
                        }`}>
                        <Wind className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-[11px] font-bold text-slate-200 flex items-center gap-1.5">
                          <span>Torre de Enfriamiento Hídrico</span>
                          <span className="text-[9px] text-blue-400 font-mono opacity-80 group-hover:opacity-100 transition">↗</span>
                        </div>
                        <div className="text-[9px] font-mono text-slate-400">
                          Subestación de Enfriamiento #01
                        </div>
                      </div>
                    </div>

                    {/* Tag de Estado */}
                    <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-mono font-bold uppercase ${isCoolingTowerActive
                      ? 'bg-rose-950 text-rose-300 border border-rose-500 animate-pulse'
                      : isSmartBalancing
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-600'
                        : 'bg-slate-800 text-slate-400'
                      }`}>
                      {isCoolingTowerActive ? 'EVAPORACIÓN ACTIVA' : isSmartBalancing ? 'CIRCUITO CERRADO' : 'STANDBY'}
                    </span>
                  </div>

                  {/* Ilustración Visual de la Torre y Efecto de Vapor */}
                  <div className="relative h-24 bg-slate-950/80 rounded-xl border border-slate-800/80 flex items-center justify-center overflow-hidden">

                    {/* Partículas de Vapor Animadas en Emergencia */}
                    {isCoolingTowerActive && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        {[1, 2, 3, 4, 5].map((i) => (
                          <motion.div
                            key={`steam-${i}`}
                            className="absolute rounded-full bg-rose-400/40 blur-sm"
                            style={{
                              width: 14 + i * 4,
                              height: 14 + i * 4,
                              left: `${28 + i * 9}%`,
                              bottom: '30%'
                            }}
                            animate={{
                              y: [-5, -45 - i * 6],
                              x: [0, i % 2 === 0 ? 8 : -8],
                              opacity: [0, 0.75, 0],
                              scale: [0.6, 1.6]
                            }}
                            transition={{
                              duration: 1.8 + i * 0.25,
                              repeat: Infinity,
                              delay: i * 0.2,
                              ease: 'easeOut'
                            }}
                          />
                        ))}
                      </div>
                    )}

                    {/* Silueta de Torre de Enfriamiento */}
                    <div className="z-10 flex flex-col items-center space-y-1">
                      {isCoolingTowerActive ? (
                        <>
                          <div className="flex items-center space-x-1.5 text-rose-400 font-bold text-xs animate-pulse">
                            <Flame className="w-4 h-4" />
                            <span>Vaporización Hídrica en Curso</span>
                          </div>
                          <div className="text-[10px] font-mono text-rose-300">
                            +{currentWaterLossRate} L/h evaporándose al aire libre
                          </div>
                        </>
                      ) : isSmartBalancing ? (
                        <>
                          <div className="flex items-center space-x-1.5 text-emerald-400 font-bold text-xs">
                            <ShieldCheck className="w-4 h-4" />
                            <span>Modo Seco Sostenible // Cero Vapor</span>
                          </div>
                          <div className="text-[10px] font-mono text-emerald-300/80">
                            Enfriamiento por convección natural (0 L/h)
                          </div>
                        </>
                      ) : (
                        <div className="text-slate-500 text-xs font-mono">
                          Temperatura en rango seguro pre-umbral
                        </div>
                      )}
                    </div>
                  </div>

                  <p className="text-[10px] text-slate-400 mt-2 leading-relaxed">
                    {isCoolingTowerActive
                      ? '⚠️ La temperatura excedió el umbral crítico. Las aspersoras consumen agua potable para salvar el clúster.'
                      : isSmartBalancing
                        ? '✅ Con el balanceo activo, el calor se disipa sin pérdida de agua dulce mediante circuito cerrado.'
                        : 'Modo pasivo. Si el Servidor 1 sobrepasa el umbral, comenzará la pérdida de agua.'}
                  </p>

                  {/* Indicador de Acción Interactiva */}
                  <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] font-mono">
                    <span className="text-slate-500">Inspección de tuberías</span>
                    <span className="text-blue-400 font-semibold group-hover:text-blue-300 flex items-center space-x-1">
                      <span>Ver Ciclo Físico</span>
                      <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                    </span>
                  </div>
                </div>

                {/* 5. LOG DE EVENTOS Y TELEMETRÍA */}
                <div className="border border-slate-800 bg-slate-950/80 rounded-xl p-3 space-y-2">
                  <div className="text-[10px] uppercase font-mono text-slate-400 font-semibold flex items-center justify-between">
                    <span>Log de Auditoría Térmica</span>
                    <span className="text-[9px] text-cyan-400">Stream en Vivo</span>
                  </div>
                  <div className="h-28 overflow-y-auto space-y-1.5 font-mono text-[10px] pr-1">
                    {logs.map((log) => (
                      <div key={log.id} className="flex items-start space-x-2 leading-tight">
                        <span className="text-slate-600 shrink-0">[{log.time}]</span>
                        <span className={
                          log.type === 'alert' ? 'text-rose-400 font-bold' :
                            log.type === 'warning' ? 'text-amber-400' :
                              log.type === 'success' ? 'text-emerald-400' :
                                'text-slate-300'
                        }>
                          {log.text}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            )}

          </div>

        </div>

      </div>

      {/* ==================================================================== */}
      {/* 3. MODAL DEL CICLO FÍSICO DE ENFRIAMIENTO (TERMODINÁMICA E HÍDRICA)  */}
      {/* ==================================================================== */}
      <AnimatePresence>
        {isCoolingModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 sm:p-6"
            onClick={(e) => {
              if (e.target === e.currentTarget) setIsCoolingModalOpen(false);
            }}
          >
            <motion.div
              initial={{ scale: 0.94, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.94, opacity: 0, y: 15 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-3/4 max-w-4xl max-h-[92vh] flex flex-col overflow-hidden text-slate-100"
            >
              {/* Cabecera del Modal */}
              <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
                <div className="flex items-center space-x-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isCoolingTowerActive
                    ? 'bg-rose-950 border border-rose-700 text-rose-400'
                    : isSmartBalancing
                      ? 'bg-emerald-950 border border-emerald-700 text-emerald-400'
                      : 'bg-cyan-950 border border-cyan-700 text-cyan-400'
                    }`}>
                    <Factory className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                      <span>Esquema Físico: Sistema de Enfriamiento y Evaporación</span>
                      <span className={`text-[10px] font-mono px-2.5 py-0.5 rounded-full ${isCoolingTowerActive
                        ? 'bg-rose-950 text-rose-300 border border-rose-600 animate-pulse'
                        : isSmartBalancing
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-600'
                          : 'bg-slate-800 text-slate-400'
                        }`}>
                        {isCoolingTowerActive ? 'EVAPORACIÓN ACTIVA' : isSmartBalancing ? 'CIRCUITO CERRADO' : 'NOMINAL'}
                      </span>
                    </h3>
                    <p className="text-xs text-slate-400">
                      Diagrama de flujo termodinámico y ciclo de reutilización del agua en el Data Center
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setIsCoolingModalOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                  title="Cerrar modal"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Contenido del Diagrama */}
              <div className="p-6 overflow-y-auto space-y-6">

                {/* Banner Explicativo de Estado */}
                <div className={`p-3.5 rounded-xl border flex items-start space-x-3 ${isCoolingTowerActive
                  ? 'bg-rose-950/40 border-rose-700/60 text-rose-200'
                  : isSmartBalancing
                    ? 'bg-emerald-950/40 border-emerald-700/60 text-emerald-200'
                    : 'bg-slate-950 border-slate-800 text-slate-300'
                  }`}>
                  <Info className="w-5 h-5 shrink-0 mt-0.5" />
                  <div className="text-xs leading-relaxed">
                    {isCoolingTowerActive ? (
                      <>
                        <strong>Pérdida Hídrica por Sobrecalentamiento:</strong> El Servidor Principal opera a {mainServerTemp.toFixed(1)}°C superando el umbral de {thermalThreshold}°C. Las torres evaporativas liberan vapor caliente a la atmósfera ({currentWaterLossRate} L/h) para evitar la degradación de los chips.
                      </>
                    ) : isSmartBalancing ? (
                      <>
                        <strong>Modo Seco / Circuito Cerrado Activo:</strong> La distribución homogénea de cómputo estabiliza la temperatura a {mainServerTemp.toFixed(1)}°C. Las torres de evaporación se detienen y el 100% del caudal de agua recircula sin pérdida.
                      </>
                    ) : (
                      <>
                        <strong>Operación en Rango Nominal:</strong> Monitoreo de temperatura pre-umbral ({mainServerTemp.toFixed(1)}°C). Si se satura el servidor primario, se activará la evaporación hídrica.
                      </>
                    )}
                  </div>
                </div>

                {/* DIAGRAMA HORIZONTAL (FLEXBOX DE 3 BLOQUES) */}
                <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-6 relative">

                  <div className="flex flex-col lg:flex-row items-center justify-between gap-4 relative">

                    {/* BLOQUE 1: RACKS DE SERVIDORES (IZQUIERDA) */}
                    <div className="w-full lg:w-60 bg-slate-900 border border-slate-700/80 rounded-xl p-4 shadow-xl flex flex-col items-center text-center relative z-10">
                      <div className="w-14 h-14 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-cyan-400 mb-3 shadow-inner">
                        <Server className="w-7 h-7" />
                      </div>
                      <div className="text-xs font-bold text-slate-100 uppercase tracking-wider">
                        Racks de Servidores
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono mb-2">
                        Fuente Térmica (CPUs / GPUs)
                      </div>

                      {/* Temperatura conectada a mainServerTemp */}
                      <div className={`px-3 py-1.5 rounded-lg border font-mono font-bold text-xs flex items-center space-x-1.5 mb-2 ${mainServerTemp > thermalThreshold
                        ? 'bg-rose-950/80 border-rose-600 text-rose-300 animate-pulse'
                        : 'bg-cyan-950/80 border-cyan-700 text-cyan-300'
                        }`}>
                        <Thermometer className="w-3.5 h-3.5" />
                        <span>Temp: {mainServerTemp.toFixed(1)} °C</span>
                      </div>

                      <div className="text-[10px] text-slate-400">
                        {isOverheated ? 'Calor extremo en placas frías' : 'Disipación térmica nominal'}
                      </div>
                    </div>

                    {/* CONECTOR PRIMARIO (Servidores <-> Intercambiador) */}
                    <div className="hidden lg:flex flex-col items-center justify-center w-16 relative">
                      <div className="w-full h-2.5 bg-slate-800 border border-orange-500/50 rounded-full relative overflow-hidden mb-3">
                        <motion.div
                          className="w-3 h-full bg-orange-400 rounded-full"
                          animate={{ x: [-8, 50] }}
                          transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
                        />
                      </div>
                      <span className="text-[8px] font-mono text-slate-500 whitespace-nowrap mb-3">
                        Loop Interno
                      </span>
                      <div className="w-full h-2.5 bg-slate-800 border border-cyan-500/50 rounded-full relative overflow-hidden">
                        <motion.div
                          className="w-3 h-full bg-cyan-400 rounded-full"
                          animate={{ x: [50, -8] }}
                          transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
                        />
                      </div>
                    </div>

                    {/* BLOQUE 2: INTERCAMBIADOR DE CALOR (CENTRO) */}
                    <div className="w-full lg:w-56 bg-slate-900 border border-cyan-800/60 rounded-xl p-4 shadow-xl flex flex-col items-center text-center relative z-10">
                      <div className="w-14 h-14 rounded-2xl bg-cyan-950/70 border border-cyan-700 flex items-center justify-center text-cyan-300 mb-3 shadow-inner">
                        <Cpu className="w-7 h-7" />
                      </div>
                      <div className="text-xs font-bold text-slate-100 uppercase tracking-wider">
                        Heat Exchanger
                      </div>
                      <div className="text-[10px] text-cyan-400 font-mono mb-2">
                        Intercambiador de Calor
                      </div>

                      <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-2.5 w-full text-[10px] font-mono text-slate-400 space-y-1">
                        <div className="flex justify-between">
                          <span>Placas:</span>
                          <span className="text-emerald-400">Titanio</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Transferencia:</span>
                          <span className="text-cyan-300">96.8%</span>
                        </div>
                      </div>
                    </div>

                    {/* CONEXIONES HÍDRICAS (CENTRO <-> DERECHA): TUBERÍAS ANIMADAS */}
                    <div className="w-full lg:w-48 flex flex-col justify-center space-y-5 relative px-2 py-2">

                      {/* 1. Tubería Superior (Agua Caliente hacia la Torre) */}
                      <div className="relative">
                        <div className="h-6 bg-rose-950/40 border border-red-500 rounded-full relative overflow-hidden flex items-center px-2 shadow-[0_0_10px_rgba(239,68,68,0.25)]">
                          {/* Partículas animadas moviéndose hacia la DERECHA */}
                          {[0, 1, 2].map((i) => (
                            <motion.div
                              key={`hot-p-${i}`}
                              className="w-2.5 h-2.5 rounded-full bg-red-400 shadow-[0_0_8px_#ef4444] absolute"
                              animate={{ x: [-15, 140] }}
                              transition={{
                                duration: 1.6,
                                repeat: Infinity,
                                ease: 'linear',
                                delay: i * 0.52
                              }}
                            />
                          ))}
                        </div>
                        <div className="flex items-center justify-between text-[9px] font-mono text-red-400 font-bold mt-1 px-1">
                          <span>Tubería Agua Caliente</span>
                          <ArrowRight className="w-3 h-3 text-red-400" />
                        </div>
                      </div>

                      {/* 2. Tubería Inferior (Agua Fría/Reutilizada hacia el Intercambiador) */}
                      <div className="relative">
                        <div className="h-6 bg-blue-950/40 border border-blue-500 rounded-full relative overflow-hidden flex items-center px-2 shadow-[0_0_10px_rgba(59,130,246,0.25)]">
                          {/* Partículas animadas moviéndose hacia la IZQUIERDA */}
                          {[0, 1, 2].map((i) => (
                            <motion.div
                              key={`cold-p-${i}`}
                              className="w-2.5 h-2.5 rounded-full bg-blue-400 shadow-[0_0_8px_#3b82f6] absolute"
                              animate={{ x: [140, -15] }}
                              transition={{
                                duration: 1.8,
                                repeat: Infinity,
                                ease: 'linear',
                                delay: i * 0.58
                              }}
                            />
                          ))}
                        </div>

                        {/* BADGE DINÁMICO DE AGUA REUTILIZADA (CRUCIAL) */}
                        <div className="flex items-center justify-between text-[9px] font-mono mt-1 px-1">
                          <ArrowLeft className="w-3 h-3 text-blue-400" />
                          <span className={`font-bold px-2 py-0.5 rounded ${isSmartBalancing
                            ? 'text-emerald-300 bg-emerald-950 border border-emerald-600'
                            : 'text-blue-300 bg-blue-950 border border-blue-600'
                            }`}>
                            {isSmartBalancing
                              ? '100% Recirculación (Cero Consumo de Red)'
                              : 'Agua Reutilizada (Aprox. 70%)'}
                          </span>
                        </div>
                      </div>

                    </div>

                    {/* BLOQUE 3: TORRE DE ENFRIAMIENTO (DERECHA) */}
                    <div className="w-full lg:w-64 bg-slate-900 border border-slate-700/80 rounded-xl p-4 shadow-xl flex flex-col items-center text-center relative z-10">

                      {/* BADGE FLOTANTE DE EVAPORACIÓN (CRUCIAL) */}
                      <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-20 whitespace-nowrap">
                        {isCoolingTowerActive ? (
                          <span className="text-[10px] font-mono font-bold text-rose-200 bg-rose-950 border border-rose-500 px-3 py-1 rounded-full shadow-[0_0_15px_rgba(244,63,94,0.5)] animate-pulse flex items-center space-x-1">
                            <Flame className="w-3 h-3 text-rose-400" />
                            <span>Pérdida por Evaporación (Aprox. 20% - 30%)</span>
                          </span>
                        ) : isSmartBalancing ? (
                          <span className="text-[10px] font-mono font-bold text-emerald-200 bg-emerald-950 border border-emerald-500 px-3 py-1 rounded-full shadow-[0_0_15px_rgba(16,185,129,0.3)] flex items-center space-x-1">
                            <ShieldCheck className="w-3 h-3 text-emerald-400" />
                            <span>Dry Mode / Sistema Cerrado (0% Evaporación)</span>
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono text-slate-300 bg-slate-950 border border-slate-700 px-2.5 py-0.5 rounded-full">
                            Torre en Espera
                          </span>
                        )}
                      </div>

                      {/* Animación de Nubes de Vapor (Crucial: Solo en Sobrecalentamiento sin Balanceo) */}
                      {isCoolingTowerActive && (
                        <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-28 h-12 pointer-events-none flex justify-center">
                          {[1, 2, 3, 4].map((i) => (
                            <motion.div
                              key={`modal-steam-${i}`}
                              className="absolute rounded-full bg-rose-400/40 blur-sm"
                              style={{ width: 14 + i * 4, height: 14 + i * 4, bottom: 0 }}
                              animate={{
                                y: [0, -32 - i * 6],
                                x: [0, i % 2 === 0 ? 10 : -10],
                                opacity: [0, 0.75, 0],
                                scale: [0.6, 1.7]
                              }}
                              transition={{
                                duration: 1.7 + i * 0.25,
                                repeat: Infinity,
                                delay: i * 0.2,
                                ease: 'easeOut'
                              }}
                            />
                          ))}
                        </div>
                      )}

                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-3 mt-2 shadow-inner transition-colors ${isCoolingTowerActive
                        ? 'bg-rose-950/80 border border-rose-700 text-rose-400'
                        : isSmartBalancing
                          ? 'bg-emerald-950/80 border border-emerald-700 text-emerald-400'
                          : 'bg-slate-800 border border-slate-700 text-slate-400'
                        }`}>
                        <Factory className="w-7 h-7" />
                      </div>

                      <div className="text-xs font-bold text-slate-100 uppercase tracking-wider">
                        Torre de Enfriamiento
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono mb-2">
                        Unidad de Evaporación
                      </div>

                      <div className={`px-2.5 py-1 rounded-lg border font-mono text-[10px] w-full ${isCoolingTowerActive
                        ? 'bg-rose-950/50 border-rose-700 text-rose-300'
                        : isSmartBalancing
                          ? 'bg-emerald-950/50 border-emerald-700 text-emerald-300'
                          : 'bg-slate-950 border-slate-800 text-slate-400'
                        }`}>
                        {isCoolingTowerActive
                          ? `Evaporando: ${currentWaterLossRate} L/h`
                          : isSmartBalancing
                            ? 'Pérdida Hídrica: 0 L/h'
                            : 'Circuito en Standby'}
                      </div>
                    </div>

                  </div>

                </div>

                {/* MÉTRICAS COMPARATIVAS DEL BALANCE DE MATERIA HÍDRICO */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3">
                    <div className="text-[10px] font-mono text-slate-400 uppercase">Flujo Térmico Disipado</div>
                    <div className="text-base font-bold text-slate-100 font-mono mt-0.5">
                      {((activeUsers / 1000) * 1.8).toFixed(1)} <span className="text-xs font-normal text-slate-400">kW Térmicos</span>
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1">Generado por núcleos GPU/CPU</div>
                  </div>

                  <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3">
                    <div className="text-[10px] font-mono text-slate-400 uppercase">Pérdida por Evaporación</div>
                    <div className={`text-base font-bold font-mono mt-0.5 ${isCoolingTowerActive ? 'text-rose-400' : 'text-emerald-400'
                      }`}>
                      {isCoolingTowerActive ? '20% - 30%' : '0% (Cero Pérdida)'}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1">
                      {isCoolingTowerActive ? 'Vapor liberado a la atmósfera' : 'Sin aspersión evaporativa'}
                    </div>
                  </div>

                  <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3">
                    <div className="text-[10px] font-mono text-slate-400 uppercase">Tasa de Recirculación</div>
                    <div className="text-base font-bold text-blue-400 font-mono mt-0.5">
                      {isSmartBalancing ? '100% de Masa' : 'Aprox. 70%'}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1">
                      {isSmartBalancing ? 'Circuito cerrado sin reposición' : 'Retorno de agua no evaporada'}
                    </div>
                  </div>
                </div>

              </div>

              {/* Pie del Modal */}
              <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between">
                <div className="text-[11px] font-mono text-slate-400 flex items-center space-x-2">
                  <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                  <span>AQUANET AI // Simulación Termodinámica en Tiempo Real</span>
                </div>
                <button
                  onClick={() => setIsCoolingModalOpen(false)}
                  className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
                >
                  Entendido / Cerrar
                </button>
              </div>

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};

export default WaterLoadBalancingSimulator;
