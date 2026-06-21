import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
    Button,
    Card,
    CardContent,
    CardActions,
    Typography,
    Grid,
    Container,
    Box,
    TextField,
    Chip,
    Tabs,
    Tab,
    Dialog,
    DialogTitle,
    DialogContent,
    Switch,
    FormControlLabel,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    CircularProgress,
    List,
    ListItem,
    ListItemText,
    AppBar,
    Toolbar,
    ThemeProvider,
    createTheme,
    CssBaseline,
    Divider,
    Paper,
    ButtonGroup
} from '@mui/material';

export default function App() {
    // Theme state (persisted in localStorage)
    const [darkMode, setDarkMode] = useState(() => {
        const saved = localStorage.getItem('theme-mode');
        return saved ? saved === 'dark' : true; // Default is true (dark mode)
    });

    const [containers, setContainers] = useState([]);
    const [projects, setProjects] = useState({});
    const [standalone, setStandalone] = useState([]);
    const [hostServices, setHostServices] = useState([]);
    const [occupiedPorts, setOccupiedPorts] = useState([]);
    const [suggestedPorts, setSuggestedPorts] = useState([]);
    
    // UI control states
    const [activeFilter, setActiveFilter] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [portExpanded, setPortExpanded] = useState(false);
    const [selectedContainer, setSelectedContainer] = useState(null);
    const [modalTab, setModalTab] = useState(0);
    const [logsText, setLogsText] = useState('Cargando logs del socket...');
    const [autoScroll, setAutoScroll] = useState(true);
    const [portCheckNum, setPortCheckNum] = useState('');
    const [portCheckResult, setPortCheckResult] = useState(null);
    const [portCheckLoading, setPortCheckLoading] = useState(false);
    
    const [loading, setLoading] = useState(true);
    const [hostLoading, setHostLoading] = useState(true);

    const logScreenRef = useRef(null);
    const logPollIntervalRef = useRef(null);
    const serverHost = window.location.hostname;

    // Build dynamic theme based on mode state
    const theme = useMemo(() => createTheme({
        palette: {
            mode: darkMode ? 'dark' : 'light',
            primary: {
                main: '#10b981', // Emerald precision green
            },
            secondary: {
                main: '#f59e0b', // Hazard yellow
            },
            background: {
                default: darkMode ? '#080a0c' : '#f1f5f9', // Concrete deep black vs soft slate
                paper: darkMode ? '#11151a' : '#ffffff',   // Dark console grey vs white card
            },
            error: {
                main: '#ef4444', // Cyber alert red
            },
            text: {
                primary: darkMode ? '#e2e8f0' : '#0f172a',
                secondary: darkMode ? '#8a99ad' : '#475569',
            },
            divider: darkMode ? '#27313d' : '#cbd5e1'
        },
        typography: {
            fontFamily: '"JetBrains Mono", "Roboto", monospace',
            h6: {
                fontWeight: 800,
                letterSpacing: '-0.03em',
            },
            body1: {
                fontSize: '0.875rem',
            },
            body2: {
                fontSize: '0.75rem',
            }
        },
        components: {
            MuiButton: {
                styleOverrides: {
                    root: {
                        borderRadius: 2,
                        textTransform: 'uppercase',
                        fontWeight: 700,
                        fontSize: '0.75rem',
                        borderWidth: '1px !important',
                    }
                }
            },
            MuiCard: {
                styleOverrides: {
                    root: ({ theme }) => ({
                        borderRadius: 2,
                        border: `1px solid ${theme.palette.divider}`,
                        backgroundColor: theme.palette.background.paper,
                        backgroundImage: 'none',
                    })
                }
            },
            MuiPaper: {
                styleOverrides: {
                    root: {
                        borderRadius: 2,
                    }
                }
            },
            MuiAccordion: {
                styleOverrides: {
                    root: ({ theme }) => ({
                        border: `1px dashed ${theme.palette.divider}`,
                        backgroundColor: theme.palette.mode === 'dark' ? 'rgba(17, 21, 26, 0.4)' : 'rgba(226, 232, 240, 0.4)',
                        boxShadow: 'none',
                        margin: '0 0 16px 0 !important',
                        '&:before': {
                            display: 'none',
                        }
                    })
                }
            }
        }
    }), [darkMode]);

    const toggleTheme = () => {
        setDarkMode(prev => {
            const next = !prev;
            localStorage.setItem('theme-mode', next ? 'dark' : 'light');
            return next;
        });
    };

    // --- API CALLS ---

    const loadContainers = async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const response = await fetch('/api/containers');
            if (!response.ok) throw new Error('Fallo socket');
            const data = await response.json();
            setProjects(data.projects || {});
            setStandalone(data.standalone || []);
            
            // Flatten list for global search and stats count
            let flatList = [];
            for (const pName in data.projects) {
                flatList = flatList.concat(data.projects[pName]);
            }
            flatList = flatList.concat(data.standalone || []);
            setContainers(flatList);
        } catch (error) {
            console.error("Error fetching containers:", error);
        } finally {
            setLoading(false);
        }
    };

    const loadHostServices = async (silent = false) => {
        if (!silent) setHostLoading(true);
        try {
            const response = await fetch('/api/host-services');
            if (!response.ok) throw new Error();
            const data = await response.json();
            setHostServices(data);
        } catch (error) {
            console.error("Error fetching host services:", error);
        } finally {
            setHostLoading(false);
        }
    };

    const loadPortsStatus = async () => {
        try {
            const response = await fetch('/api/ports-status');
            if (!response.ok) throw new Error();
            const data = await response.json();
            setOccupiedPorts(data.occupied || []);
            setSuggestedPorts(data.suggested || []);
        } catch (error) {
            console.error("Error fetching ports status:", error);
        }
    };

    const handleCheckPort = async (port) => {
        if (!port || port < 1 || port > 65535) {
            setPortCheckResult({ status: 'ERROR', message: 'INV_PORT (1-65535)' });
            return;
        }
        setPortCheckLoading(true);
        setPortCheckResult(null);
        try {
            const response = await fetch(`/api/ports-status?check=${port}`);
            if (!response.ok) throw new Error();
            const data = await response.json();
            setPortCheckResult(data);
        } catch (error) {
            setPortCheckResult({ status: 'ERROR', message: 'QUERY_ERROR' });
        } finally {
            setPortCheckLoading(false);
        }
    };

    const triggerAction = async (id, action) => {
        try {
            const response = await fetch(`/api/containers/${id}/${action}`, { method: 'POST' });
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || 'Operación fallida');
            }
            await loadContainers(true);
        } catch (error) {
            alert(`OPERACIÓN FALLIDA: ${error.message}`);
        }
    };

    const fetchLogs = async (id) => {
        if (!id) return;
        try {
            const response = await fetch(`/api/containers/${id}/logs`);
            const data = await response.json();
            if (response.ok) {
                setLogsText(data.logs || '--- NO SYSTEM LOGS REPORTED ---');
            } else {
                setLogsText(`ERROR AL CARGAR LOGS: ${data.error}`);
            }
        } catch (error) {
            setLogsText(`FALLA DE RED AL CARGAR LOGS`);
        }
    };

    // --- TIMERS & INITIALIZATION ---

    useEffect(() => {
        loadContainers(false);
        loadHostServices(false);

        // Polling container status every 10 seconds
        const containerInterval = setInterval(() => {
            loadContainers(true);
        }, 10000);

        // Polling host services & port status (if expanded) every 30 seconds
        const hostInterval = setInterval(() => {
            loadHostServices(true);
            if (portExpanded) {
                loadPortsStatus();
            }
        }, 30000);

        return () => {
            clearInterval(containerInterval);
            clearInterval(hostInterval);
        };
    }, [portExpanded]);

    // Query port status immediately when expanded
    useEffect(() => {
        if (portExpanded) {
            loadPortsStatus();
        }
    }, [portExpanded]);

    // Handle modal logs polling
    useEffect(() => {
        if (selectedContainer) {
            fetchLogs(selectedContainer.id);
            if (logPollIntervalRef.current) clearInterval(logPollIntervalRef.current);
            logPollIntervalRef.current = setInterval(() => {
                fetchLogs(selectedContainer.id);
            }, 3000);
        } else {
            if (logPollIntervalRef.current) {
                clearInterval(logPollIntervalRef.current);
                logPollIntervalRef.current = null;
            }
        }
        return () => {
            if (logPollIntervalRef.current) clearInterval(logPollIntervalRef.current);
        };
    }, [selectedContainer]);

    // Handle terminal autoscroll
    useEffect(() => {
        if (autoScroll && logScreenRef.current) {
            logScreenRef.current.scrollTop = logScreenRef.current.scrollHeight;
        }
    }, [logsText, autoScroll]);

    // --- INTERACTION HANDLERS ---

    const handleOpenModal = (container) => {
        setSelectedContainer(container);
        setModalTab(0);
        setLogsText('Cargando logs del socket...');
    };

    const handleCloseModal = () => {
        setSelectedContainer(null);
    };

    const handleCopy = (elementId, text) => {
        navigator.clipboard.writeText(text);
        const btn = document.getElementById(elementId);
        if (btn) {
            const oldText = btn.textContent;
            btn.textContent = 'COPIED!';
            btn.style.color = '#10b981';
            setTimeout(() => {
                btn.textContent = oldText;
                btn.style.color = '';
            }, 1500);
        }
    };

    const handleManualRefresh = () => {
        loadContainers(false);
        loadHostServices(false);
        if (portExpanded) loadPortsStatus();
    };

    const fillPortChecker = (port) => {
        setPortCheckNum(port);
        handleCheckPort(port);
    };

    // --- RENDER HELPERS ---

    // Filter containers based on search query and state filter
    const getFilteredContainers = (list) => {
        return list.filter(c => {
            const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                  c.image.toLowerCase().includes(searchQuery.toLowerCase());
            const isRunning = c.status.toLowerCase().startsWith('up') || c.state.running;
            
            if (activeFilter === 'running') return matchesSearch && isRunning;
            if (activeFilter === 'stopped') return matchesSearch && !isRunning;
            return matchesSearch;
        });
    };

    // Generate dynamic connection guides
    const renderConnectionGuides = (c) => {
        if (!c) return null;
        const image = c.image.toLowerCase();
        const hostPorts = [];
        
        c.ports.forEach(port => {
            const match = port.match(/0\.0\.0\.0:(\d+)->/);
            if (match) hostPorts.push(match[1]);
        });
        const mainPort = hostPorts[0] || '';

        const renderCommandBox = (title, cmdId, commandText) => (
            <Paper variant="outlined" sx={{ p: 2, mb: 2, bgcolor: darkMode ? '#080a0c' : '#f8fafc', borderColor: 'divider' }} key={cmdId}>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700 }}>{title}</Typography>
                    <Button size="small" id={cmdId} onClick={() => handleCopy(cmdId, commandText)}>COPY</Button>
                </Box>
                <Typography component="code" sx={{ 
                    display: 'block', 
                    fontFamily: 'monospace', 
                    fontSize: '0.8rem',
                    color: 'text.primary',
                    borderLeft: '2px solid #10b981',
                    pl: 1,
                    py: 0.5,
                    overflowX: 'auto',
                    wordBreak: 'break-all'
                }}>
                    {commandText}
                </Typography>
            </Paper>
        );

        return (
            <Box>
                {renderCommandBox("TTY EXEC INTERNO", "cmd-exec", `docker exec -it ${c.name} sh`)}
                
                {(image.includes('postgres') || image.includes('supabase-db') || image.includes('supavisor')) && (
                    <React.Fragment>
                        {renderCommandBox("CONEXIÓN POSTGRESQL DESDE TERMINAL EXTERNA", "cmd-pg", `psql -h ${serverHost} -p ${mainPort || '5432'} -U <USUARIO> -d <DATABASE>`)}
                        {renderCommandBox("URI DE CONEXIÓN POSTGRESQL", "cmd-pg-uri", `postgresql://<USUARIO>:<PASSWORD>@${serverHost}:${mainPort || '5432'}/<DATABASE>`)}
                    </React.Fragment>
                )}
                {image.includes('redis') && renderCommandBox("CONEXIÓN REDIS-CLI EXTERNA", "cmd-redis", `redis-cli -h ${serverHost} -p ${mainPort || '6379'}`)}
                {image.includes('meilisearch') && renderCommandBox("CONEXIÓN API MEILISEARCH (HEALTHCHECK)", "cmd-meili", `curl http://${serverHost}:${mainPort || '7700'}/health`)}
                
                {((image.includes('redmine') || image.includes('jellyfin')) || (c.ports.length > 0 && mainPort)) && (
                    <Paper variant="outlined" sx={{ p: 2, mb: 2, bgcolor: darkMode ? '#080a0c' : '#f8fafc', borderColor: 'divider' }}>
                        <Box display="flex" justifyContent="space-between" alignItems="center">
                            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700 }}>ACCESO WEB DIRECTO</Typography>
                            <Button size="small" href={`http://${serverHost}:${mainPort}`} target="_blank" color="primary">ABRIR ENLACE</Button>
                        </Box>
                        <Typography sx={{ fontFamily: 'monospace', fontSize: '0.8rem', mt: 1 }}>
                            URL: http://{serverHost}:{mainPort}
                        </Typography>
                    </Paper>
                )}
            </Box>
        );
    };

    // Calculate stats
    const totalCount = containers.length;
    const runningCount = containers.filter(c => c.status.toLowerCase().startsWith('up') || c.state.running).length;
    const stoppedCount = totalCount - runningCount;

    // Filter project keys
    const filteredProjects = {};
    let activeProjectsCount = 0;
    for (const pName in projects) {
        const filteredProjList = getFilteredContainers(projects[pName]);
        if (filteredProjList.length > 0) {
            filteredProjects[pName] = filteredProjList;
            activeProjectsCount++;
        }
    }
    const filteredStandalone = getFilteredContainers(standalone);

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            
            {/* Dynamic scanlines transparency */}
            <div className="scanlines" style={{ opacity: darkMode ? 0.7 : 0.15 }} />

            {/* Header / Top App Bar */}
            <AppBar position="static" sx={{ borderBottom: '2px solid', borderColor: 'divider', bgcolor: darkMode ? '#0f1216' : '#ffffff', backgroundImage: 'none' }}>
                <Toolbar sx={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', py: 1, gap: 2 }}>
                    <Box display="flex" alignItems="center" gap={1}>
                        <Box className="pulsing-beacon" sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#10b981' }} />
                        <Typography variant="h6" component="div" sx={{ color: darkMode ? '#ffffff' : '#0f172a' }}>SYS.DOCK // CONSOLE_MUI</Typography>
                        
                        {/* Theme Switcher Button */}
                        <Button 
                            size="small" 
                            onClick={toggleTheme}
                            variant="outlined" 
                            color="secondary"
                            sx={{ ml: 2, fontSize: '0.65rem', py: 0, px: 1, minHeight: 22, height: 22 }}
                        >
                            {darkMode ? '[LIGHT_MODE]' : '[DARK_MODE]'}
                        </Button>
                    </Box>
                    <Box display="flex" gap={2} flexWrap="wrap">
                        <Paper variant="outlined" sx={{ p: 1, minWidth: 120, borderColor: 'divider', bgcolor: darkMode ? '#11151a' : '#ffffff' }}>
                            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', fontWeight: 700 }}>TOTAL_CONTAINERS</Typography>
                            <Typography variant="h6">{String(totalCount).padStart(2, '0')}</Typography>
                        </Paper>
                        <Paper variant="outlined" sx={{ p: 1, minWidth: 120, borderColor: 'rgba(16, 185, 129, 0.4)', bgcolor: darkMode ? '#11151a' : '#ffffff', borderLeft: '3px solid #10b981' }}>
                            <Typography variant="caption" sx={{ color: '#10b981', display: 'block', fontWeight: 700 }}>RUNNING</Typography>
                            <Typography variant="h6" color="primary">{String(runningCount).padStart(2, '0')}</Typography>
                        </Paper>
                        <Paper variant="outlined" sx={{ p: 1, minWidth: 120, borderColor: 'rgba(239, 68, 68, 0.4)', bgcolor: darkMode ? '#11151a' : '#ffffff', borderLeft: '3px solid #ef4444' }}>
                            <Typography variant="caption" sx={{ color: '#ef4444', display: 'block', fontWeight: 700 }}>STOPPED</Typography>
                            <Typography variant="h6" color="error">{String(stoppedCount).padStart(2, '0')}</Typography>
                        </Paper>
                        <Paper variant="outlined" sx={{ p: 1, minWidth: 120, borderColor: 'divider', bgcolor: darkMode ? '#11151a' : '#ffffff' }}>
                            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', fontWeight: 700 }}>REFRESH_RATE</Typography>
                            <Typography variant="h6" sx={{ color: 'secondary.main' }}>AUTO [10S]</Typography>
                        </Paper>
                    </Box>
                </Toolbar>
            </AppBar>

            {/* Main content grid */}
            <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
                <Grid container spacing={4}>
                    
                    {/* Left Column: Container Dashboard */}
                    <Grid item xs={12} lg={9}>
                        
                        {/* Filters & Actions Panel */}
                        <Paper variant="outlined" sx={{ p: 2, mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2, bgcolor: darkMode ? '#0f1216' : '#ffffff', borderColor: 'divider' }}>
                            <TextField 
                                variant="outlined" 
                                size="small"
                                placeholder="BUSCAR CONTENEDOR O IMAGEN..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                InputProps={{
                                    startAdornment: <Typography sx={{ mr: 1, color: 'primary.main', fontWeight: 800 }}>&gt;</Typography>
                                }}
                                sx={{ 
                                    flexGrow: 1, 
                                    maxWidth: 450,
                                    '& .MuiOutlinedInput-root': {
                                        borderRadius: 0,
                                        bgcolor: darkMode ? '#080a0c' : '#f8fafc',
                                        '& fieldset': { borderColor: 'divider' },
                                    }
                                }}
                            />
                            <Box display="flex" gap={2} flexWrap="wrap">
                                <ButtonGroup variant="outlined" size="small" aria-label="Filters">
                                    <Button onClick={() => setActiveFilter('all')} variant={activeFilter === 'all' ? 'contained' : 'outlined'}>ALL_SYS</Button>
                                    <Button onClick={() => setActiveFilter('running')} variant={activeFilter === 'running' ? 'contained' : 'outlined'}>RUNNING_ONLY</Button>
                                    <Button onClick={() => setActiveFilter('stopped')} variant={activeFilter === 'stopped' ? 'contained' : 'outlined'}>STOPPED_ONLY</Button>
                                </ButtonGroup>
                                <Button 
                                    variant="outlined" 
                                    color="primary" 
                                    onClick={handleManualRefresh}
                                >
                                    RE-SCAN SOCKET
                                </Button>
                            </Box>
                        </Paper>

                        {/* Containers Render Matrix */}
                        {loading ? (
                            <Box display="flex" flexDirection="column" alignItems="center" py={8} gap={2}>
                                <CircularProgress color="primary" />
                                <Typography variant="body2" sx={{ color: 'text.secondary' }}>ESCANEANDO SOCKET DE DOCKER [/var/run/docker.sock]...</Typography>
                            </Box>
                        ) : (
                            <Box>
                                {activeProjectsCount === 0 && filteredStandalone.length === 0 && (
                                    <Paper variant="outlined" sx={{ p: 4, textAlign: 'center', borderColor: 'divider' }}>
                                        <Typography sx={{ color: 'text.secondary' }}>00 CONTENEDORES DETECTADOS CON EL FILTRO ACTUAL.</Typography>
                                    </Paper>
                                )}

                                {/* Render grouped Compose Projects */}
                                {Object.keys(filteredProjects).map(pName => {
                                    const projContainers = filteredProjects[pName];
                                    const activeServices = projContainers.filter(c => c.status.toLowerCase().startsWith('up') || c.state.running).length;
                                    const totalServices = projContainers.length;
                                    
                                    return (
                                        <Accordion key={pName} defaultExpanded sx={{ borderStyle: 'solid' }}>
                                            <AccordionSummary 
                                                expandIcon={<Typography sx={{ color: 'secondary.main', fontWeight: 800 }}>▼</Typography>}
                                                sx={{ borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'rgba(255,255,255,0.01)' }}
                                            >
                                                <Box display="flex" justifyContent="space-between" width="100%" alignItems="center" pr={2}>
                                                    <Box display="flex" alignItems="center" gap={1}>
                                                        <Box className="pulsing-beacon" sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'secondary.main' }} />
                                                        <Typography sx={{ fontWeight: 800, color: 'secondary.main', textTransform: 'uppercase' }}>
                                                            COMPOSE_PROJECT // {pName}
                                                        </Typography>
                                                    </Box>
                                                    <Chip 
                                                        label={`${activeServices}/${totalServices} SERVICES ONLINE`} 
                                                        size="small" 
                                                        variant="outlined" 
                                                        sx={{ color: 'text.secondary', borderColor: 'divider', borderRadius: 0, fontWeight: 700, fontSize: '0.65rem' }} 
                                                    />
                                                </Box>
                                            </AccordionSummary>
                                            <AccordionDetails sx={{ p: 3, bgcolor: darkMode ? 'rgba(0,0,0,0.1)' : 'rgba(0,0,0,0.02)' }}>
                                                <Grid container spacing={2}>
                                                    {projContainers.map(c => renderContainerCard(c))}
                                                </Grid>
                                            </AccordionDetails>
                                        </Accordion>
                                    );
                                })}

                                {/* Render Standalone Containers */}
                                {filteredStandalone.length > 0 && (
                                    <Box sx={{ mt: 3 }}>
                                        <Typography sx={{ mb: 2, borderLeft: '3px solid', borderColor: 'text.secondary', pl: 1, fontWeight: 800, color: 'text.secondary' }}>
                                            STANDALONE_CONTAINERS
                                        </Typography>
                                        <Grid container spacing={2}>
                                            {filteredStandalone.map(c => renderContainerCard(c))}
                                        </Grid>
                                    </Box>
                                )}
                            </Box>
                        )}
                    </Grid>

                    {/* Right Column: Host Telemetry Sidebar */}
                    <Grid item xs={12} lg={3}>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, position: 'sticky', top: 24 }}>
                            
                            {/* Port Status Matrix Accordion (MUI) */}
                            <Accordion 
                                expanded={portExpanded} 
                                onChange={() => setPortExpanded(!portExpanded)} 
                                sx={{ borderStyle: 'solid', bgcolor: theme.palette.background.paper }}
                            >
                                <AccordionSummary 
                                    expandIcon={<Typography sx={{ color: 'secondary.main', fontWeight: 800 }}>▼</Typography>}
                                    sx={{ borderBottom: '1px solid', borderColor: 'divider', bgcolor: darkMode ? '#0f1216' : '#ffffff' }}
                                >
                                    <Box display="flex" alignItems="center" gap={1}>
                                        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'secondary.main' }} />
                                        <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.primary' }}>
                                            PORT_ALLOCATOR // MATRIX
                                        </Typography>
                                    </Box>
                                </AccordionSummary>
                                <AccordionDetails sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
                                    
                                    {/* Suggested Free Ports */}
                                    <Box>
                                        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, display: 'block', mb: 0.5 }}>SUGGESTED_FREE_PORTS</Typography>
                                        <Box display="flex" flexWrap="wrap" gap={0.5}>
                                            {suggestedPorts.length > 0 ? (
                                                suggestedPorts.map(p => (
                                                    <Chip 
                                                        key={p} 
                                                        label={p} 
                                                        size="small" 
                                                        onClick={() => fillPortChecker(p)}
                                                        color="primary"
                                                        variant="outlined"
                                                        sx={{ borderRadius: 0, fontWeight: 700, fontSize: '0.7rem' }}
                                                    />
                                                ))
                                            ) : (
                                                <Typography variant="caption" sx={{ color: 'text.muted' }}>NO SUGGESTIONS</Typography>
                                            )}
                                        </Box>
                                    </Box>

                                    {/* Port Checker */}
                                    <Box>
                                        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, display: 'block', mb: 0.5 }}>QUERY_PORT_STATUS</Typography>
                                        <Box display="flex" gap={1}>
                                            <TextField 
                                                variant="outlined" 
                                                size="small" 
                                                type="number"
                                                placeholder="Ej: 8081"
                                                value={portCheckNum}
                                                onChange={(e) => setPortCheckNum(e.target.value)}
                                                onKeyDown={(e) => e.key === 'Enter' && handleCheckPort(portCheckNum)}
                                                sx={{ 
                                                    flexGrow: 1, 
                                                    '& .MuiOutlinedInput-root': {
                                                        borderRadius: 0, 
                                                        bgcolor: darkMode ? '#080a0c' : '#f8fafc',
                                                        fontSize: '0.75rem',
                                                        '& fieldset': { borderColor: 'divider' }
                                                    } 
                                                }}
                                            />
                                            <Button 
                                                variant="outlined" 
                                                color="secondary" 
                                                onClick={() => handleCheckPort(portCheckNum)}
                                                disabled={portCheckLoading}
                                            >
                                                {portCheckLoading ? '...' : 'TEST'}
                                            </Button>
                                        </Box>
                                        {portCheckResult && (
                                            <Box mt={1} minHeight={18}>
                                                {portCheckResult.status === 'AVAILABLE' ? (
                                                    <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 700 }}>
                                                        ✓ FREE // OK FOR SERVICE
                                                    </Typography>
                                                ) : portCheckResult.status === 'OCCUPIED' ? (
                                                    <Typography variant="caption" sx={{ color: 'error.main', fontWeight: 700 }}>
                                                        ✗ OCCUPIED // {portCheckResult.owner}
                                                    </Typography>
                                                ) : (
                                                    <Typography variant="caption" sx={{ color: 'error.main', fontWeight: 700 }}>
                                                        {portCheckResult.message}
                                                    </Typography>
                                                )}
                                            </Box>
                                        )}
                                    </Box>

                                    {/* Occupied Ports Registry */}
                                    <Box>
                                        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, display: 'block', mb: 0.5 }}>OCCUPIED_REGISTRY</Typography>
                                        <Paper variant="outlined" sx={{ bgcolor: darkMode ? '#080a0c' : '#f8fafc', borderColor: 'divider', p: 1, maxHeight: 150, overflowY: 'auto' }}>
                                            {occupiedPorts.length > 0 ? (
                                                occupiedPorts.map(item => (
                                                    <Box key={item.port} display="flex" justifyContent="space-between" py={0.2} sx={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                                        <Typography variant="caption" sx={{ color: 'secondary.main', fontWeight: 700 }}>[{item.port}]</Typography>
                                                        <Typography variant="caption" sx={{ color: 'text.secondary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }} title={item.owner}>
                                                            {item.owner}
                                                        </Typography>
                                                    </Box>
                                                ))
                                            ) : (
                                                <Typography variant="caption" sx={{ color: 'text.muted' }}>NONE REGISTERED</Typography>
                                            )}
                                        </Paper>
                                    </Box>
                                </AccordionDetails>
                            </Accordion>

                            {/* Host Services Telemetry Card */}
                            <Card variant="outlined">
                                <Box display="flex" alignItems="center" gap={1} p={2} sx={{ borderBottom: '1px solid', borderColor: 'divider', bgcolor: darkMode ? '#0f1216' : '#ffffff' }}>
                                    <Box className="pulsing-beacon" sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'secondary.main' }} />
                                    <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.primary', textTransform: 'uppercase' }}>
                                        HOST_SERVICES // TELEMETRY
                                    </Typography>
                                </Box>
                                <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
                                    {hostLoading ? (
                                        <Box display="flex" justifyContent="center" py={4}>
                                            <CircularProgress size={20} color="secondary" />
                                        </Box>
                                    ) : (
                                        <List disablePadding>
                                            {hostServices.length === 0 ? (
                                                <ListItem><ListItemText primary="NO HOST SERVICES CONFIGURED" primaryTypographyProps={{ variant: 'caption', color: 'text.secondary', align: 'center' }} /></ListItem>
                                            ) : (
                                                hostServices.map((svc, index) => {
                                                    const isOnline = svc.status === 'ONLINE';
                                                    return (
                                                        <React.Fragment key={svc.name}>
                                                            {index > 0 && <Divider sx={{ borderColor: 'divider' }} />}
                                                            <ListItem 
                                                                sx={{ 
                                                                    flexDirection: 'column', 
                                                                    alignItems: 'stretch', 
                                                                    py: 1.5,
                                                                    borderLeft: isOnline ? '3px solid #10b981' : '3px solid #52637a'
                                                                }}
                                                            >
                                                                <Box display="flex" justifyContent="space-between" alignItems="center">
                                                                    <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.primary' }}>{svc.name}</Typography>
                                                                    <Chip 
                                                                        label={`PORT ${svc.port}`} 
                                                                        size="small" 
                                                                        sx={{ height: 16, borderRadius: 0, fontSize: '0.6rem', color: 'secondary.main', borderColor: 'rgba(245, 158, 11, 0.3)', bgcolor: 'rgba(245, 158, 11, 0.05)' }} 
                                                                        variant="outlined" 
                                                                    />
                                                                </Box>
                                                                <Typography variant="caption" sx={{ color: 'text.secondary', mt: 0.5, lineHeight: 1.2 }}>
                                                                    {svc.description}
                                                                </Typography>
                                                                <Box display="flex" justifyContent="space-between" alignItems="center" mt={1}>
                                                                    <Typography variant="caption" sx={{ 
                                                                        fontWeight: 800, 
                                                                        color: isOnline ? 'primary.main' : 'text.muted',
                                                                        fontSize: '0.65rem'
                                                                    }}>
                                                                        {isOnline ? 'ONLINE // OK' : 'OFFLINE // STANDBY'}
                                                                    </Typography>
                                                                    {svc.protocol && isOnline && (
                                                                        <Button 
                                                                            size="small" 
                                                                            href={`${svc.protocol}://${serverHost}:${svc.port}`} 
                                                                            target="_blank" 
                                                                            variant="outlined"
                                                                            color="primary"
                                                                            sx={{ py: 0, px: 1, fontSize: '0.65rem', minHeight: 20 }}
                                                                        >
                                                                            LAUNCH
                                                                        </Button>
                                                                    )}
                                                                </Box>
                                                            </ListItem>
                                                        </React.Fragment>
                                                    );
                                                })
                                            )}
                                        </List>
                                    )}
                                </CardContent>
                            </Card>
                        </Box>
                    </Grid>
                </Grid>
            </Container>

            {/* Modal Dialog for Container Details (Logs & Access strings) */}
            {selectedContainer && renderDetailModal()}
            
            <Box component="footer" py={3} sx={{ borderTop: '1px solid', borderColor: 'divider', bgcolor: darkMode ? '#080a0c' : '#ffffff', textAlign: 'center' }}>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    SYS.DOCK CONSOLE // WORKSTATION LOCAL // MATERIAL UI & REACT INTERFACE
                </Typography>
            </Box>
        </ThemeProvider>
    );

    // Render an individual Docker Container card
    function renderContainerCard(c) {
        const isRunning = c.status.toLowerCase().startsWith('up') || c.state.running;
        const statusLabel = isRunning ? 'RUNNING' : 'STOPPED';
        
        return (
            <Grid item xs={12} md={6} xl={4} key={c.id}>
                <Card 
                    variant="outlined"
                    sx={{ 
                        display: 'flex', 
                        flexDirection: 'column', 
                        height: '100%',
                        borderLeft: isRunning ? '4px solid #10b981' : '4px solid #ef4444',
                        transition: 'all 0.2s ease',
                        '&:hover': {
                            borderColor: 'text.secondary',
                            transform: 'translateY(-2px)'
                        }
                    }}
                >
                    <Box display="flex" justifyContent="space-between" alignItems="flex-start" p={2} sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
                        <Box overflow="hidden" mr={1}>
                            <Typography sx={{ fontWeight: 700, color: 'text.primary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textTransform: 'uppercase' }} title={c.name}>
                                {c.name}
                            </Typography>
                            <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'monospace' }}>
                                ID: {c.id}
                            </Typography>
                        </Box>
                        <Chip 
                            label={statusLabel} 
                            size="small" 
                            color={isRunning ? 'primary' : 'error'}
                            variant="outlined"
                            sx={{ borderRadius: 0, fontWeight: 700, fontSize: '0.65rem', height: 20 }}
                        />
                    </Box>
                    <CardContent sx={{ p: 2, flexGrow: 1, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                        <Box>
                            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, display: 'block' }}>IMAGE_SOURCE</Typography>
                            <Typography sx={{ color: 'text.primary', wordBreak: 'break-all', fontFamily: 'monospace', fontSize: '0.8rem' }}>{c.image}</Typography>
                        </Box>
                        <Box>
                            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, display: 'block' }}>TELEMETRY_STATUS</Typography>
                            <Typography sx={{ color: 'text.primary', fontFamily: 'monospace', fontSize: '0.8rem' }}>{c.status}</Typography>
                        </Box>
                        <Box>
                            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, display: 'block', mb: 0.5 }}>PORT_MAPPINGS</Typography>
                            <Box display="flex" flexDirection="column" gap={0.5}>
                                {c.ports && c.ports.length > 0 ? (
                                    c.ports.map((port, idx) => {
                                        const match = port.match(/0\.0\.0\.0:(\d+)->(\d+)\/tcp/);
                                        if (match) {
                                            const hostPort = match[1];
                                            const containerPort = match[2];
                                            const isWeb = ['80', '443', '8080', '3000', '8096', '9000', '9696', '8989', '7878', '8787', '8084', '19999'].includes(containerPort);
                                            return (
                                                <Box key={idx} display="flex" justifyContent="space-between" alignItems="center" p={0.5} sx={{ bgcolor: darkMode ? '#080a0c' : '#f8fafc', border: '1px solid', borderColor: 'divider' }}>
                                                    <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>{hostPort} &gt; {containerPort}/tcp</Typography>
                                                    {isWeb && (
                                                        <Button 
                                                            size="small" 
                                                            href={`http://${serverHost}:${hostPort}`} 
                                                            target="_blank" 
                                                            variant="outlined" 
                                                            color="primary"
                                                            sx={{ py: 0, px: 1, fontSize: '0.6rem', minHeight: 18 }}
                                                        >
                                                            LAUNCH
                                                        </Button>
                                                    )}
                                                </Box>
                                            );
                                        }
                                        return (
                                            <Box key={idx} p={0.5} sx={{ bgcolor: darkMode ? '#080a0c' : '#f8fafc', border: '1px solid', borderColor: 'divider' }}>
                                                <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>{port}</Typography>
                                            </Box>
                                        );
                                    })
                                ) : (
                                    <Box p={0.5} sx={{ border: '1px dashed', borderColor: 'divider', textAlign: 'center' }}>
                                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>NO PORTS EXPOSED</Typography>
                                    </Box>
                                )}
                            </Box>
                        </Box>
                    </CardContent>
                    <CardActions sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider', bgcolor: darkMode ? '#0f1216' : '#f8fafc', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr) auto', gap: 0.5 }}>
                        <Button 
                            variant="outlined" 
                            disabled={isRunning} 
                            onClick={() => triggerAction(c.id, 'start')}
                            color="primary"
                            sx={{ minWidth: 0 }}
                        >
                            RUN
                        </Button>
                        <Button 
                            variant="outlined" 
                            disabled={!isRunning} 
                            onClick={() => triggerAction(c.id, 'stop')}
                            color="error"
                            sx={{ minWidth: 0 }}
                        >
                            HALT
                        </Button>
                        <Button 
                            variant="outlined" 
                            onClick={() => triggerAction(c.id, 'restart')}
                            color="secondary"
                            sx={{ minWidth: 0 }}
                        >
                            REBOOT
                        </Button>
                        <Button 
                            variant="outlined" 
                            onClick={() => handleOpenModal(c)}
                            sx={{ minWidth: 0, color: 'text.primary', borderColor: 'divider' }}
                        >
                            LOGS
                        </Button>
                    </CardActions>
                </Card>
            </Grid>
        );
    }

    // Render log/connection guide dialog modal
    function renderDetailModal() {
        const isRunning = selectedContainer.status.toLowerCase().startsWith('up') || selectedContainer.state.running;
        
        return (
            <Dialog 
                open={Boolean(selectedContainer)} 
                onClose={handleCloseModal} 
                maxWidth="md" 
                fullWidth
                PaperProps={{
                    sx: { border: '2px solid', borderColor: 'divider', bgcolor: theme.palette.background.paper }
                }}
            >
                <DialogTitle sx={{ borderBottom: '1px solid', borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 1.5 }}>
                    <Box display="flex" alignItems="center" gap={1}>
                        <Typography component="span" color="primary" sx={{ fontWeight: 800 }}>&gt;&gt;</Typography>
                        <Typography sx={{ fontWeight: 800, textTransform: 'uppercase' }}>
                            {selectedContainer.name}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'monospace', ml: 1 }}>
                            [{selectedContainer.full_id.substring(0, 16)}]
                        </Typography>
                    </Box>
                    <Button variant="outlined" color="error" size="small" onClick={handleCloseModal}>✕ CLOSE</Button>
                </DialogTitle>
                
                <Box sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: darkMode ? '#0f1216' : '#f8fafc' }}>
                    <Tabs value={modalTab} onChange={(e, val) => setModalTab(val)} textColor="primary" indicatorColor="primary">
                        <Tab label="TTY_LOGS" sx={{ fontWeight: 700, fontSize: '0.75rem' }} />
                        <Tab label="CONNECTION_GUIDE" sx={{ fontWeight: 700, fontSize: '0.75rem' }} />
                    </Tabs>
                </Box>

                <DialogContent sx={{ p: 3, overflow: 'hidden' }}>
                    
                    {/* Tab: Logs */}
                    {modalTab === 0 && (
                        <Box display="flex" flexDirection="column" gap={2} height="100%">
                            <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
                                <Chip 
                                    label={isRunning ? 'RUNNING' : 'STOPPED'} 
                                    size="small" 
                                    variant="outlined"
                                    color={isRunning ? 'primary' : 'error'}
                                    sx={{ borderRadius: 0, fontWeight: 700 }}
                                />
                                <Box display="flex" alignItems="center" gap={2}>
                                    <Button variant="outlined" size="small" onClick={() => fetchLogs(selectedContainer.id)}>RE-EXEC LOGS</Button>
                                    <FormControlLabel 
                                        control={
                                            <Switch 
                                                checked={autoScroll} 
                                                onChange={(e) => setAutoScroll(e.target.checked)} 
                                                color="primary" 
                                                size="small"
                                            />
                                        } 
                                        label={<Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700 }}>AUTO_SCROLL</Typography>}
                                    />
                                </Box>
                            </Box>
                            <Box className="terminal-screen" ref={logScreenRef}>
                                <pre>{logsText}</pre>
                            </Box>
                        </Box>
                    )}

                    {/* Tab: Connection Guide */}
                    {modalTab === 1 && (
                        <Box sx={{ maxHeight: 450, overflowY: 'auto' }}>
                            <Typography variant="body1" sx={{ fontWeight: 800, color: 'text.primary', mb: 1, borderLeft: '3px solid #10b981', pl: 1 }}>
                                INTERFAZ DE ACCESO DIRECTO (CLI)
                            </Typography>
                            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
                                Instrucciones estructuradas para interactuar con este servicio desde la terminal local o externa.
                            </Typography>
                            {renderConnectionGuides(selectedContainer)}
                        </Box>
                    )}

                </DialogContent>
            </Dialog>
        );
    }
}
