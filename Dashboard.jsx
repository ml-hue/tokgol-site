import { useState, useEffect, useMemo, useCallback } from "react";
import { sb } from "./sbClient";
import { supabasePublic } from "./supabaseClientPublic";
import "./index.css";

/* =============================================================
   CONFIGURACIÓN GENERAL
============================================================= */

const PHASES = [
  { id: 1, label: "Diagnóstico" },
  { id: 2, label: "Plan estratégico" },
  { id: 3, label: "Implementación" },
  { id: 4, label: "Seguimiento & control" },
];

const PHASE_MARKERS = [
  { id: 1, x: 80, y: 150 },
  { id: 2, x: 320, y: 110 },
  { id: 3, x: 620, y: 160 },
  { id: 4, x: 880, y: 120 },
];

/* =============================================================
   COMPONENTE PRINCIPAL
============================================================= */

function Dashboard({ clientMode = false, token = null }) {
  console.log("🚀 Dashboard render", { clientMode, token });

  const db = clientMode ? supabasePublic : sb;

  /* =============================================================
     ESTADOS PRINCIPALES
  ============================================================= */

  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [selectedProjectId, setSelectedProjectId] = useState(null);

  const [sessions, setSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionsError, setSessionsError] = useState(null);
  const [activeSessionId, setActiveSessionId] = useState(null);

  const [projectPhase, setProjectPhase] = useState(null);
  const [manualPhase, setManualPhase] = useState(null);
  const [phaseLoading, setPhaseLoading] = useState(true);
  const [savingPhase, setSavingPhase] = useState(false);
  const [phaseError, setPhaseError] = useState(null);

  const [clientInfo, setClientInfo] = useState(null);
  const [clientLoading, setClientLoading] = useState(clientMode);
  const [clientError, setClientError] = useState(null);

  const [draft, setDraft] = useState({
    title: "",
    date: new Date().toISOString().slice(0, 10),
    tag: "Sesión",
    summary: "",
    clientResponsible: "",
    clientStatus: "postergado",
  });

  const [savingSession, setSavingSession] = useState(false);
  const [saveError, setSaveError] = useState(null);

  /* =============================================================
     DERIVADOS (MEMO)
  ============================================================= */

  const projectSessions = useMemo(() => {
    return [...sessions].sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [sessions]);

  const activeSession = useMemo(() => {
    return sessions.find((s) => s.id === activeSessionId) || null;
  }, [sessions, activeSessionId]);

  /* =============================================================
     LOADERS (SUPABASE)
  ============================================================= */

  const loadProjects = useCallback(async () => {
    const { data, error } = await sb
      .from("projects")
      .select("id, name, client_name")
      .order("name");

    if (error) {
      console.error("Error cargando proyectos:", error);
      return;
    }

    setProjects(data || []);

    if (data?.length) {
      setSelectedProject((prev) => prev ?? data[0].name);
      setSelectedProjectId((prev) => prev ?? data[0].id);
    }
  }, []);

  const loadSessions = useCallback(
    async (projectId) => {
      if (!projectId) return;

      setSessionsLoading(true);
      setSessionsError(null);

      const { data, error } = await db
        .from("sessions")
        .select("*")
        .eq("project_id", projectId)
        .order("date", { ascending: false });

      if (error) {
        setSessionsError("Error cargando sesiones");
      } else {
        setSessions(data || []);
        setActiveSessionId(data?.[0]?.id || null);
      }

      setSessionsLoading(false);
    },
    [db]
  );

  const loadPhase = useCallback(
    async (projectName) => {
      if (!projectName) return;

      setPhaseLoading(true);

      const { data } = await db
        .from("project_phase")
        .select("current_phase")
        .eq("project_name", projectName)
        .maybeSingle();

      const phase = data?.current_phase ?? 1;
      setProjectPhase(phase);
      setManualPhase(phase);
      setPhaseLoading(false);
    },
    [db]
  );

  /* =============================================================
     EFECTOS
  ============================================================= */

  // MODO INTERNO → cargar proyectos
  useEffect(() => {
    if (!clientMode) {
      loadProjects();
    }
  }, [clientMode, loadProjects]);

  // Cargar sesiones + fase cuando hay proyecto
  useEffect(() => {
    if (selectedProjectId && selectedProject) {
      loadSessions(selectedProjectId);
      loadPhase(selectedProject);
    }
  }, [selectedProjectId, selectedProject, loadSessions, loadPhase]);

  // MODO CLIENTE → validar token y cargar proyecto
  useEffect(() => {
    if (!clientMode || !token) return;

    const loadClient = async () => {
      try {
        setClientLoading(true);

        const { data, error } = await db
          .from("client_tokens")
          .select("project_name, client_name, expires_at")
          .eq("token", token)
          .eq("active", true)
          .single();

        if (!data || error) {
          setClientError("El enlace no es válido o expiró.");
          setClientLoading(false);
          return;
        }

        if (data.expires_at) {
          const expiresAt = new Date(data.expires_at);
          if (expiresAt < new Date()) {
            setClientError("Este enlace ha expirado.");
            setClientLoading(false);
            return;
          }
        }

        setClientInfo({ client_name: data.client_name });
        setSelectedProject(data.project_name);

        const { data: project } = await db
          .from("projects")
          .select("id")
          .eq("name", data.project_name)
          .single();

        if (project) {
          setSelectedProjectId(project.id);
        }

        setClientLoading(false);
      } catch (err) {
        console.error("Error cliente:", err);
        setClientError("Error validando acceso.");
        setClientLoading(false);
      }
    };

    loadClient();
  }, [clientMode, token, db]);

  /* =============================================================
     HELPERS
  ============================================================= */

  const getPhaseStatus = (phaseId) => {
    if (!projectPhase) return "pending";
    if (phaseId < projectPhase) return "done";
    if (phaseId === projectPhase) return "current";
    return "upcoming";
  };

  const getPhaseStatusLabel = (status) => {
    switch (status) {
      case "done":
        return "Completada";
      case "current":
        return "En curso";
      case "upcoming":
        return "Próxima fase";
      default:
        return "Pendiente";
    }
  };

  const formatClientStatus = (s) =>
    s === "realizado"
      ? "Realizado"
      : s === "postergado"
      ? "Postergado"
      : "No realizado";

  /* =============================================================
     ACCIONES
  ============================================================= */

  const saveManualPhase = async () => {
    if (!manualPhase || !selectedProject) return;

    try {
      setSavingPhase(true);
      setPhaseError(null);

      const { error } = await sb
        .from("project_phase")
        .update({ current_phase: manualPhase })
        .eq("project_name", selectedProject);

      if (error) throw error;

      setProjectPhase(manualPhase);
    } catch (err) {
      console.error(err);
      setPhaseError("No se pudo guardar la fase.");
    } finally {
      setSavingPhase(false);
    }
  };

  const validateSession = (s) => {
    if (!s.title || s.title.trim().length < 3) return false;
    if (!s.summary || s.summary.trim().length < 10) return false;
    if (!s.date) return false;
    return true;
  };

  const handleCreateSession = async () => {
    if (clientMode) return;
    if (!selectedProjectId) return;

    if (!validateSession(draft)) {
      setSaveError("Completá correctamente los campos.");
      return;
    }

    try {
      setSavingSession(true);
      setSaveError(null);

      const { data, error } = await sb
        .from("sessions")
        .insert([
          {
            project_id: selectedProjectId,
            title: draft.title.trim(),
            date: draft.date,
            tag: draft.tag,
            summary: draft.summary.trim(),
            client_responsible: draft.clientResponsible || null,
            client_status: draft.clientStatus,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      setSessions((prev) => [data, ...prev]);
      setActiveSessionId(data.id);

      setDraft({
        title: "",
        date: new Date().toISOString().slice(0, 10),
        tag: "Sesión",
        summary: "",
        clientResponsible: "",
        clientStatus: "postergado",
      });
    } catch (err) {
      console.error(err);
      setSaveError("Error guardando sesión.");
    } finally {
      setSavingSession(false);
    }
  };

  const handleSharePublicView = async () => {
    if (!selectedProject) return;

    const newToken = crypto.randomUUID();
    const project = projects.find((p) => p.name === selectedProject);

    await sb.from("client_tokens").insert([
      {
        token: newToken,
        project_name: selectedProject,
        client_name: project?.client_name || "",
        active: true,
      },
    ]);

    const url = `${window.location.origin.replace(
      "bitacora",
      "bitacora-client"
    )}/?token=${newToken}`;

    await navigator.clipboard.writeText(url);
    alert("Link copiado:\n" + url);
  };

  const handleProjectChange = (name) => {
    const p = projects.find((x) => x.name === name);
    if (p) {
      setSelectedProject(p.name);
      setSelectedProjectId(p.id);
    }
  };

  /* =============================================================
     RENDER
  ============================================================= */

  return (
    <div className="app-root">
      {/* TOP BAR */}
      <header className="topbar">
        <div className="topbar-left">
          <div className="topbar-logo">S</div>
          <div className="topbar-text">
            <span className="topbar-overline">SELLER CONSULTING</span>
            <span className="topbar-title">
              {clientMode ? "Bitácora del proyecto" : "Bitácora de proyectos"}
            </span>
          </div>
        </div>

        <div className="topbar-right">
          {!clientMode && (
            <>
              <select
                className="project-select"
                value={selectedProject || ""}
                onChange={(e) => handleProjectChange(e.target.value)}
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.name}>
                    {p.name}
                  </option>
                ))}
              </select>

              <button className="share-button" onClick={handleSharePublicView}>
                Compartir vista pública
              </button>
            </>
          )}

          {clientMode && clientInfo && (
            <div className="client-chip">
              Cliente: <strong>{clientInfo.client_name}</strong>
            </div>
          )}
        </div>
      </header>

      {/* LAYOUT */}
      <main className="layout">
        {/* COLUMNA IZQUIERDA */}
        {!clientMode && (
          <section className="column column-left">
            {/* NUEVA SESIÓN */}
            <div className="card card-new-note">
              <div className="card-header">
                <div>
                  <div className="card-overline">NUEVA NOTA DE SESIÓN</div>
                  <div className="card-subtitle">
                    Acuerdos, próximos pasos y decisiones.
                  </div>
                </div>
                <span className="badge-interno">Interno Seller</span>
              </div>

              <div className="card-body">
                {saveError && <div className="error-message">{saveError}</div>}

                <input
                  className="field-input"
                  placeholder="Título"
                  value={draft.title}
                  onChange={(e) =>
                    setDraft({ ...draft, title: e.target.value })
                  }
                />

                <div className="field-row">
                  <div className="field-group">
                    <label htmlFor="session-date">Fecha</label>
                    <input
                      id="session-date"
                      type="date"
                      className="field-input"
                      value={draft.date}
                      onChange={(e) =>
                        setDraft({ ...draft, date: e.target.value })
                      }
                    />
                  </div>
                  <div className="field-group">
                    <label htmlFor="session-tag">Etiqueta</label>
                    <input
                      id="session-tag"
                      className="field-input"
                      value={draft.tag}
                      onChange={(e) =>
                        setDraft({ ...draft, tag: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div className="field-row">
                  <div className="field-group">
                    <label htmlFor="client-responsible">Responsable cliente</label>
                    <input
                      id="client-responsible"
                      className="field-input"
                      value={draft.clientResponsible}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          clientResponsible: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div className="field-group">
                    <label htmlFor="client-status">Estado cliente</label>
                    <select
                      id="client-status"
                      className="field-input"
                      value={draft.clientStatus}
                      onChange={(e) =>
                        setDraft({ ...draft, clientStatus: e.target.value })
                      }
                    >
                      <option value="realizado">Realizado</option>
                      <option value="postergado">Postergado</option>
                      <option value="no_realizado">No realizado</option>
                    </select>
                  </div>
                </div>

                <textarea
                  className="field-textarea"
                  rows={3}
                  placeholder="Resumen..."
                  value={draft.summary}
                  onChange={(e) =>
                    setDraft({ ...draft, summary: e.target.value })
                  }
                />

                <button
                  className="primary-button"
                  onClick={handleCreateSession}
                  disabled={savingSession}
                >
                  {savingSession ? "Guardando..." : "+ Guardar nota"}
                </button>
              </div>
            </div>

            {/* LISTA DE SESIONES */}
            <div className="card card-notes-list">
              <div className="card-header card-header--small">
                <div className="card-overline">NOTAS DE SESIÓN</div>
                <div className="card-counter">{projectSessions.length} entradas</div>
              </div>

              {sessionsLoading ? (
                <div className="notes-loading">Cargando sesiones...</div>
              ) : sessionsError ? (
                <div className="notes-error">{sessionsError}</div>
              ) : (
                <div className="notes-list">
                  {projectSessions.map((s) => (
                    <div
                      key={s.id}
                      className={`note-item ${
                        s.id === activeSessionId ? "note-item--active" : ""
                      }`}
                      onClick={() => setActiveSessionId(s.id)}
                      role="button"
                      tabIndex={0}
                      onKeyPress={(e) => {
                        if (e.key === "Enter") setActiveSessionId(s.id);
                      }}
                    >
                      <div className="note-item-top">
                        <div className="note-title">{s.title}</div>
                        <div className="note-date">
                          {new Date(s.date).toLocaleDateString("es-PY", {
                            day: "2-digit",
                            month: "short",
                          })}
                        </div>
                      </div>

                      <div className="note-tags">
                        <span className="tag">{s.tag}</span>
                        <span className="tag tag--status">
                          {formatClientStatus(s.client_status)}
                        </span>
                      </div>

                      <div className="note-summary">{s.summary}</div>
                    </div>
                  ))}
                </div>
              )}

              {activeSession && !sessionsLoading && (
                <div className="notes-footer">
                  Última sesión seleccionada: {" "}
                  <strong>{activeSession.title}</strong>
                </div>
              )}
            </div>
          </section>
        )}

        {/* COLUMNA DERECHA */}
        <section className="column column-right">
          {/* RESUMEN */}
          <div className="card card-project-summary">
            <div className="summary-header">
              <div>
                <div className="card-overline">
                  {clientMode ? "RESUMEN DEL PROYECTO" : "VISTA DEL PROYECTO"}
                </div>

                <h1 className="project-title">
                  Bitácora de {selectedProject || "..."}
                </h1>

                <p className="project-description">
                  {clientMode
                    ? "Aquí verás los principales hitos, acuerdos y avances del proyecto."
                    : "Resumen ejecutivo del avance del proyecto para cliente."}
                </p>
              </div>

              <div className="summary-metrics">
                <div className="metric-card">
                  <div className="metric-label">Última actualización</div>
                  <div className="metric-value">
                    {new Date().toLocaleDateString("es-PY")}
                  </div>
                </div>

                <div className="metric-card metric-card--green">
                  <div className="metric-label">Sesiones registradas</div>
                  <div className="metric-value">{projectSessions.length}</div>
                </div>
              </div>
            </div>
          </div>

          {/* ROADMAP */}
          <div className="card card-phase-roadmap card-phase-roadmap--curved">
            <div className="phase-header phase-header--curved">
              <div>
                <div className="card-overline">AVANCE DEL PROYECTO</div>

                <h2 className="phase-title">
                  Fase actual: {" "}
                  <span>
                    {PHASES.find((p) => p.id === projectPhase)?.label ||
                      "Configurando..."}
                  </span>
                </h2>

                <p className="phase-subtitle">
                  Visualizá en qué etapa se encuentra tu proyecto.
                </p>
              </div>

              <div className="phase-meta">
                <div className="phase-pill">
                  {phaseLoading ? (
                    "Cargando..."
                  ) : (
                    <>
                      <span className="phase-pill-number">
                        {projectPhase ?? "-"}
                      </span>
                      <span className="phase-pill-text">
                        de {PHASES.length} fases
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {!clientMode && (
              <div className="manual-phase-control">
                <h3 className="manual-phase-title">Control manual de fase</h3>
                <p className="manual-phase-description">
                  Seleccioná la fase actual del proyecto. Esto actualiza el
                  roadmap del cliente.
                </p>

                {phaseError && (
                  <div className="error-message" role="alert">
                    {phaseError}
                  </div>
                )}

                <div className="manual-phase-grid">
                  {PHASES.map((p) => (
                    <div
                      key={p.id}
                      className={`manual-phase-card ${
                        manualPhase === p.id ? "selected" : ""
                      }`}
                      onClick={() => setManualPhase(p.id)}
                      role="button"
                      tabIndex={0}
                      aria-label={`Seleccionar fase ${p.id}: ${p.label}`}
                      onKeyPress={(e) => {
                        if (e.key === "Enter") setManualPhase(p.id);
                      }}
                    >
                      <div className="manual-phase-number">{p.id}</div>
                      <div className="manual-phase-label">{p.label}</div>
                    </div>
                  ))}
                </div>

                <button
                  className="manual-phase-save"
                  disabled={!manualPhase || savingPhase}
                  onClick={saveManualPhase}
                >
                  {savingPhase ? "Guardando..." : "Guardar fase actual"}
                </button>
              </div>
            )}

            {/* ROADMAP SVG */}
            <div className="phase-curve-wrapper">
              <svg
                viewBox="0 0 960 220"
                className="phase-curve-svg"
                role="img"
                aria-label="Roadmap del proyecto con 4 fases"
              >
                <title>Progreso del proyecto a través de 4 fases</title>
                <path
                  className="phase-curve-path"
                  d="M40 180
                     C 180 120, 260 80, 360 110
                     S 560 200, 720 150
                     S 880 80, 920 110"
                  fill="none"
                />

                {PHASE_MARKERS.map((marker) => {
                  const status = getPhaseStatus(marker.id);
                  const phase = PHASES.find((p) => p.id === marker.id);

                  return (
                    <g
                      key={marker.id}
                      className={`phase-marker phase-marker--${status}`}
                      role="img"
                      aria-label={`Fase ${marker.id}: ${phase.label} - ${getPhaseStatusLabel(status)}`}
                    >
                      <circle
                        cx={marker.x}
                        cy={marker.y}
                        r="20"
                        className="phase-marker-ring"
                      />

                      <circle
                        cx={marker.x}
                        cy={marker.y}
                        r="9"
                        className="phase-marker-dot"
                      />

                      <text
                        x={marker.x}
                        y={marker.y + 4}
                        textAnchor="middle"
                        className="phase-marker-index"
                      >
                        {marker.id}
                      </text>

                      <text
                        x={marker.x}
                        y={marker.y - 26}
                        textAnchor="middle"
                        className="phase-marker-label"
                      >
                        {phase.label}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>

            {/* LEYENDA */}
            <div className="phase-legend">
              {PHASES.map((phase) => {
                const status = getPhaseStatus(phase.id);
                return (
                  <div
                    key={phase.id}
                    className={`phase-legend-item phase-legend-item--${status}`}
                  >
                    <div className="phase-legend-pill">
                      <span className="phase-legend-index">
                        {phase.id.toString().padStart(2, "0")}
                      </span>
                      <span className="phase-legend-title">
                        {phase.label}
                      </span>
                    </div>
                    <span className="phase-legend-status">
                      {getPhaseStatusLabel(status)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* TIMELINE */}
          <div className="card card-timeline">
            {clientMode && clientLoading && (
              <div className="timeline-empty">
                Validando tu acceso como cliente...
              </div>
            )}

            {clientMode && !clientLoading && clientError && (
              <div className="timeline-empty" role="alert">
                {clientError}
                <br />
                <br />
                <small>
                  Si el problema persiste, escribinos a {" "}
                  <strong>ml@seller.consulting</strong>.
                </small>
              </div>
            )}

            {(!clientMode || (!clientLoading && !clientError)) && (
              <>
                {sessionsLoading ? (
                  <div className="timeline-empty">Cargando bitácora...</div>
                ) : projectSessions.length === 0 ? (
                  <div className="timeline-empty">
                    Todavía no hay eventos en la bitácora.
                  </div>
                ) : (
                  <ol className="timeline">
                    {projectSessions.map((session, index) => (
                      <li key={session.id} className="timeline-item">
                        <div className="timeline-point" />

                        <div className="timeline-content">
                          <div className="timeline-header">
                            <div className="timeline-date">
                              {new Date(session.date).toLocaleDateString("es-PY", {
                                weekday: "short",
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              })}
                            </div>

                            <div className="timeline-badges">
                              <span className="timeline-badge">
                                Sesión #{projectSessions.length - index}
                              </span>
                              <span className="timeline-badge timeline-badge--blue">
                                {session.tag}
                              </span>
                            </div>
                          </div>

                          <div className="timeline-card">
                            <div className="timeline-title">{session.title}</div>

                            <div className="timeline-summary">
                              {session.summary}
                            </div>

                            <div className="timeline-meta">
                              <span>
                                • Responsable cliente: {" "}
                                <strong>
                                  {session.client_responsible || "Sin asignar"}
                                </strong>
                              </span>

                              <span>
                                • Estado cliente: {" "}
                                <strong className="status-pill">
                                  {formatClientStatus(session.client_status)}
                                </strong>
                              </span>
                            </div>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

export default Dashboard;
