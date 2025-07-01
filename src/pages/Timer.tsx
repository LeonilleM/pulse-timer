import { useLocation, useNavigate } from 'react-router-dom';
import { useReducer, useEffect, useRef, useState } from 'react';
import { pomodoroReducer } from '../components/pomodoroSession';
import Alarm from '../assets/audio/lofi-alarm.mp3'
import { Pause, Play, SkipBack, SkipForward } from 'lucide-react';
import { CircularProgressbar } from 'react-circular-progressbar';
import 'react-circular-progressbar/dist/styles.css';
import ResizeWindowButton from '../components/resizeWindowButton';
import { useSpotify } from '../context/SpotifyContext';

interface CurrentlyPlaying {
    device: {
        volume_percent: number
    }
    item: {
        name: string;
        artists: Array<{ name: string }>;
        album: {
            name: string;
            images: Array<{ url: string }>;
        };
        duration_ms: number
    };
    is_playing: boolean
    progress_ms: number
}

export default function Timer() {
    const navigate = useNavigate();
    const location = useLocation();
    const { isAuthenticated, login, tokens } = useSpotify();
    const [currentlyPlaying, setCurrentlyPlaying] = useState<CurrentlyPlaying | null>(null);
    const [windowSize, setWindowSize] = useState({ width: window.innerWidth, height: window.innerHeight });

    const [state, dispatch] = useReducer(
        pomodoroReducer,
        {
            session: location.state?.session || null,
            timeLeft: location.state?.session?.intervals[0]?.start || 0,
            isRunning: false
        }
    );

    const { session, timeLeft, isRunning } = state;
    const current = session?.intervals[session?.currentIndex];
    const audioRef = useRef(new Audio(Alarm));

    // Track window size for responsive design
    useEffect(() => {
        const handleResize = () => {
            setWindowSize({ width: window.innerWidth, height: window.innerHeight });
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Determine layout mode based on window size
    const isMiniWidget = windowSize.width <= 320 && windowSize.height <= 80;
    const isCompactWidget = windowSize.width <= 400 && windowSize.height <= 120;
    const isMediumWidget = windowSize.width <= 600 && windowSize.height <= 200;
    const isFullSize = windowSize.width > 600;

    // Determine if we should show timer-only layout (no Spotify integration in full size)
    const shouldShowTimerOnly = isFullSize && !currentlyPlaying;

    // Handle navigation when session is invalid
    useEffect(() => {
        if (!session) {
            navigate('/');
        }
    }, [session, navigate]);


    // Handle Spotify playback state and current track
    useEffect(() => {
        const checkPlaybackState = async () => {
            if (!isAuthenticated || !tokens?.accessToken) return;

            try {
                const response = await fetch('https://api.spotify.com/v1/me/player', {
                    headers: {
                        'Authorization': `Bearer ${tokens.accessToken}`
                    }
                });

                if (response.status === 204) {
                    // No content means no active device
                    setCurrentlyPlaying(null);
                    return;
                }

                if (response.ok) {
                    const data = await response.json();
                    setCurrentlyPlaying(data);
                }
            } catch (error) {
                console.error('Error checking Spotify playback state:', error);
                setCurrentlyPlaying(null);
            }
        };

        checkPlaybackState();
        const interval = setInterval(checkPlaybackState, 5000);
        return () => clearInterval(interval);
    }, [isAuthenticated, tokens?.accessToken]);

    // Handle timer state
    useEffect(() => {
        if (isRunning) {
            const timer = setInterval(() => {
                dispatch({ type: 'TICK' });
            }, 1000);
            return () => clearInterval(timer);
        }
    }, [isRunning]);

    // Handle interval completion
    useEffect(() => {
        if (timeLeft === 0 && isRunning) {
            audioRef.current.play();
            dispatch({ type: 'TICK' });

            if (isAuthenticated && current?.type === 'focus' && tokens?.accessToken) {
                // Pause Spotify during focus intervals
                fetch('https://api.spotify.com/v1/me/player/pause', {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${tokens.accessToken}`
                    }
                }).catch(error => console.error('Error pausing Spotify:', error));
            }
        }
    }, [timeLeft, isRunning, isAuthenticated, current?.type, tokens?.accessToken]);

    // Update progress in real time
    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentlyPlaying((prev) => {
                if (!prev) return prev;
                return {
                    ...prev,
                    progress_ms: Math.min(
                        prev.progress_ms + 1000,
                        prev.item.duration_ms
                    ),
                };
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [currentlyPlaying]);


    const handlePlaybackControl = async (action: 'previous' | 'play' | 'pause' | 'next') => {
        if (!isAuthenticated || !tokens?.accessToken) return;

        try {
            // Check for an active device
            const playbackStateResponse = await fetch('https://api.spotify.com/v1/me/player', {
                headers: {
                    'Authorization': `Bearer ${tokens.accessToken}`,
                },
            });

            if (!playbackStateResponse.ok) {
                console.error('Failed to fetch playback state:', await playbackStateResponse.json());
                return;
            }

            const endpoint = action;   // now 'play', 'pause', 'next', or 'previous'
            const method = (action === 'play' || action === 'pause')
                ? 'PUT'
                : 'POST';

            await fetch(`https://api.spotify.com/v1/me/player/${endpoint}`, {
                method,
                headers: {
                    'Authorization': `Bearer ${tokens.accessToken}`
                }
            });
        } catch (error) {
            console.error(`Error controlling playback (${action}):`, error);
        }
    };

    if (!session) {
        return null;
    }

    const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

    const songFormatTime = (ms: number) => {
        const totalSeconds = Math.floor(ms / 1000); // Convert milliseconds to seconds
        const minutes = Math.floor(totalSeconds / 60); // Get the number of minutes
        const seconds = totalSeconds % 60; // Get the remaining seconds
        return `${minutes}:${seconds.toString().padStart(2, '0')}`; // Format as MM:SS
    };

    const handleSpotifyConnect = async () => {
        try {
            localStorage.setItem('currentSession', JSON.stringify(state.session));
            await login();
        } catch (error) {
            console.error('Failed to connect to Spotify:', error);
        }
    };

    // Mini Widget Layout (320x80)
    if (isMiniWidget) {
        return (
            <div className="w-full h-full bg-black/80 backdrop-blur-sm flex items-center justify-between px-3 py-2">
                <div className="hidden">
                    <ResizeWindowButton />
                </div>

                <div className="flex items-center gap-3 flex-1 min-w-0">
                    {/* Timer Display */}
                    <div className="text-white text-sm font-mono">
                        {formatTime(timeLeft)}
                    </div>
                    {/* Status Indicator */}
                    <div className={`w-2 h-2 rounded-full ${isRunning ? 'bg-green-400 animate-pulse' : 'bg-gray-400'}`} />
                    {/* Spotify Track (if available) */}
                    {currentlyPlaying && (
                        <div className="text-white text-xs truncate">
                            {currentlyPlaying.item.name}
                        </div>
                    )}
                </div>
                {/* Quick Controls */}
                <div className="flex gap-1">
                    <button
                        onClick={() => dispatch({ type: isRunning ? 'STOP' : 'START' })}
                        className="text-white hover:text-gray-300 p-1"
                    >
                        {isRunning ? <Pause size={12} /> : <Play size={12} />}
                    </button>
                </div>
            </div>
        );
    }

    // Compact Widget Layout (400x120)
    if (isCompactWidget) {
        return (
            <div className="w-full h-full bg-white rounded-lg shadow-lg flex items-center gap-4 p-4">
                <div className="hidden">
                    <ResizeWindowButton />
                </div>

                {/* Timer Section */}
                <div className="flex items-center gap-3">
                    <div className="relative w-16 h-16">
                        <CircularProgressbar
                            styles={{
                                path: {
                                    stroke: current.type === 'focus' ? '#3B82F6' : '#F63B3E',
                                    strokeWidth: 8
                                },
                                trail: { stroke: '#E5E7EB' }
                            }}
                            value={current.start - timeLeft}
                            maxValue={current.start}
                        />
                        <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-xs font-bold text-gray-900">
                                {formatTime(timeLeft)}
                            </span>
                        </div>
                    </div>
                    <div>
                        <div className="text-sm font-medium text-gray-900">
                            {current.type === 'focus' ? 'Focus' : 'Break'}
                        </div>
                        <button
                            onClick={() => dispatch({ type: isRunning ? 'STOP' : 'START' })}
                            className={`text-xs px-2 py-1 rounded-full ${isRunning
                                ? 'bg-red-100 text-red-600'
                                : 'bg-blue-100 text-blue-600'}`}
                        >
                            {isRunning ? 'Pause' : 'Start'}
                        </button>
                    </div>
                </div>

                {/* Spotify Section (if authenticated and playing) */}
                {currentlyPlaying && (
                    <>
                        <div className="w-px h-16 bg-gray-200" />
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                            <img
                                src={currentlyPlaying.item.album.images[0]?.url}
                                alt="Album"
                                className="w-12 h-12 rounded object-cover"
                            />
                            <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-gray-900 truncate">
                                    {currentlyPlaying.item.name}
                                </div>
                                <div className="text-xs text-gray-600 truncate">
                                    {currentlyPlaying.item.artists[0]?.name}
                                </div>
                            </div>
                            <div className="flex gap-1">
                                <button
                                    onClick={() => handlePlaybackControl(currentlyPlaying.is_playing ? 'pause' : 'play')}
                                    className="p-1 text-gray-600 hover:text-gray-900"
                                >
                                    {currentlyPlaying.is_playing ? <Pause size={14} /> : <Play size={14} />}
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>
        );
    }

    // Medium Widget Layout (600x200)
    if (isMediumWidget) {
        return (
            <div className="w-full h-full bg-white rounded-xl shadow-lg overflow-hidden">
                <div className="sm:hidden">
                    <ResizeWindowButton />
                </div>
                <div className="p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold text-gray-900">
                            {current.type === 'focus' ? 'Focus Session' : 'Break Time'}
                        </h2>
                        <div className="flex gap-1">
                            {Array.from({ length: session.config.totalSessions }).map((_, index) => (
                                <div
                                    key={index}
                                    className={`w-2 h-4 rounded-full ${index < session.sessionCount
                                        ? (current.type === 'focus' ? 'bg-blue-500' : 'bg-red-500')
                                        : 'bg-gray-300'
                                        }`}
                                />
                            ))}
                        </div>
                    </div>

                    <div className="flex items-center gap-6">
                        {/* Timer */}
                        <div className="flex items-center gap-4">
                            <div className="relative w-20 h-20">
                                <CircularProgressbar
                                    styles={{
                                        path: {
                                            stroke: current.type === 'focus' ? '#3B82F6' : '#F63B3E',
                                            strokeWidth: 6
                                        },
                                        trail: { stroke: '#E5E7EB' }
                                    }}
                                    value={current.start - timeLeft}
                                    maxValue={current.start}
                                />
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <span className="text-lg font-bold text-gray-900">
                                        {formatTime(timeLeft)}
                                    </span>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => dispatch({ type: 'START' })}
                                    disabled={isRunning}
                                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${isRunning
                                        ? 'bg-gray-200 text-gray-400'
                                        : 'bg-blue-500 text-white hover:bg-blue-600'
                                        }`}
                                >
                                    Start
                                </button>
                                <button
                                    onClick={() => dispatch({ type: 'STOP' })}
                                    disabled={!isRunning}
                                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${!isRunning
                                        ? 'bg-gray-200 text-gray-400'
                                        : 'bg-red-500 text-white hover:bg-red-600'
                                        }`}
                                >
                                    Pause
                                </button>
                            </div>
                        </div>

                        {/* Spotify Section */}
                        {currentlyPlaying ? (
                            <div className="flex items-center gap-4 flex-1 min-w-0">
                                <img
                                    src={currentlyPlaying.item.album.images[0]?.url}
                                    alt="Album"
                                    className="w-16 h-16 rounded-lg object-cover"
                                />
                                <div className="flex-1 min-w-0">
                                    <div className="text-base font-medium text-gray-900 truncate">
                                        {currentlyPlaying.item.name}
                                    </div>
                                    <div className="text-sm text-gray-600 truncate">
                                        {currentlyPlaying.item.artists.map(a => a.name).join(', ')}
                                    </div>
                                    <div className="flex items-center gap-2 mt-2">
                                        <button
                                            onClick={() => handlePlaybackControl('previous')}
                                            className="p-1 text-gray-600 hover:text-gray-900"
                                        >
                                            <SkipBack size={16} />
                                        </button>
                                        <button
                                            onClick={() => handlePlaybackControl(currentlyPlaying.is_playing ? 'pause' : 'play')}
                                            className="p-2 bg-green-500 text-white rounded-full hover:bg-green-600"
                                        >
                                            {currentlyPlaying.is_playing ? <Pause size={16} /> : <Play size={16} />}
                                        </button>
                                        <button
                                            onClick={() => handlePlaybackControl('next')}
                                            className="p-1 text-gray-600 hover:text-gray-900"
                                        >
                                            <SkipForward size={16} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ) : !isAuthenticated && (
                            <div className="flex-1">
                                <button
                                    onClick={handleSpotifyConnect}
                                    className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 text-sm"
                                >
                                    Connect Spotify
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // Full Size Layout (default)
    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-4">
            {/* Navigation */}
            <button
                className="absolute top-4 left-4 text-gray-600 hover:text-gray-800 transition-colors"
                onClick={() => navigate('/')}
            >
                ← Back
            </button>

            <ResizeWindowButton />

            {/* Main Container */}
            <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden w-full max-w-4xl">
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white p-6">
                    <h1 className="text-2xl font-bold mb-2">
                        {current.type === 'focus' ? 'Focus Time' :
                            current.type === 'shortBreak' ? 'Short Break' : 'Long Break'}
                    </h1>
                    <div className="flex gap-2">
                        {Array.from({ length: session.config.totalSessions }).map((_, index) => (
                            <div
                                key={index}
                                className={`w-3 h-6 rounded-full ${index < session.sessionCount
                                    ? 'bg-white' : 'bg-white/30'
                                    }`}
                            />
                        ))}
                    </div>
                </div>

                <div className="p-8">
                    {/* Spotify Section */}
                    {currentlyPlaying && (
                        <div className="flex items-center gap-6 p-6">
                            {/* Spotify Section */}
                            <div className="flex items-center gap-4 flex-1 min-w-0">
                                <img
                                    src={currentlyPlaying.item.album.images[0]?.url}
                                    alt="Album cover"
                                    className="w-16 h-16 rounded-lg shadow-md flex-shrink-0"
                                />
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-lg font-semibold text-gray-900 truncate">
                                        {currentlyPlaying.item.name}
                                    </h3>
                                    <p className="text-sm text-gray-600 truncate">
                                        {currentlyPlaying.item.artists.map(artist => artist.name).join(', ')}
                                    </p>
                                    {/* Progress Bar */}
                                    <div className="mt-2">
                                        <div className="w-full bg-gray-200 rounded-full h-1.5">
                                            <div
                                                className="bg-green-500 h-1.5 rounded-full transition-all duration-300"
                                                style={{
                                                    width: `${((currentlyPlaying.progress_ms ?? 0) / currentlyPlaying.item.duration_ms) * 100}%`,
                                                }}
                                            />
                                        </div>
                                        <div className="flex justify-between text-xs text-gray-500 mt-1">
                                            <span>{songFormatTime(currentlyPlaying.progress_ms)}</span>
                                            <span>{songFormatTime(currentlyPlaying.item.duration_ms)}</span>
                                        </div>
                                    </div>
                                </div>
                                {/* Spotify Controls */}
                                <div className="flex items-center gap-2 flex-shrink-0">
                                    <button
                                        onClick={() => handlePlaybackControl('previous')}
                                        className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors"
                                    >
                                        <SkipBack size={20} />
                                    </button>
                                    <button
                                        onClick={() => handlePlaybackControl(currentlyPlaying.is_playing ? 'pause' : 'play')}
                                        className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors"
                                    >
                                        {currentlyPlaying.is_playing ? <Pause size={20} /> : <Play size={20} />}
                                    </button>
                                    <button
                                        onClick={() => handlePlaybackControl('next')}
                                        className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors"
                                    >
                                        <SkipForward size={20} />
                                    </button>
                                </div>
                            </div>

                            {/* Vertical Divider */}
                            <div className="w-px h-20 bg-gray-200" />

                            {/* Compact Timer Section */}
                            <div className="flex flex-col items-center gap-4 flex-shrink-0">
                                <div className="relative w-24 h-24">
                                    <CircularProgressbar
                                        styles={{
                                            path: {
                                                stroke: current.type === 'focus' ? '#3B82F6' : '#F63B3E',
                                                strokeWidth: 8
                                            },
                                            trail: { stroke: '#E5E7EB' }
                                        }}
                                        value={current.start - timeLeft}
                                        maxValue={current.start}
                                    />
                                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                                        <span className="text-xs font-medium text-gray-600">
                                            {current.type === 'focus' ? 'Focus' :
                                                current.type === 'shortBreak' ? 'Break' : 'Long Break'}
                                        </span>
                                        <span className="text-lg font-bold text-gray-900">
                                            {formatTime(timeLeft)}
                                        </span>
                                    </div>
                                </div>
                                {/* Timer Controls */}
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => dispatch({ type: 'START' })}
                                        disabled={isRunning}
                                        className={`p-2 rounded-full transition-colors ${isRunning
                                            ? 'text-gray-400 cursor-not-allowed'
                                            : 'text-blue-600 hover:bg-blue-50'
                                            }`}
                                    >
                                        <Play size={16} />
                                    </button>
                                    <button
                                        onClick={() => dispatch({ type: 'STOP' })}
                                        disabled={!isRunning}
                                        className={`p-2 rounded-full transition-colors ${!isRunning
                                            ? 'text-gray-400 cursor-not-allowed'
                                            : 'text-red-600 hover:bg-red-50'
                                            }`}
                                    >
                                        <Pause size={16} />
                                    </button>
                                </div>
                                {/* Session Progress */}
                                <div className="flex gap-1">
                                    {Array.from({ length: session.config.totalSessions }).map((_, index) => (
                                        <div
                                            key={index}
                                            className={`w-2 h-6 rounded-full ${index < session.sessionCount
                                                ? (current.type === 'focus' ? 'bg-blue-500' : 'bg-red-500')
                                                : 'bg-gray-300'
                                                }`}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Timer-Only Layout */}
                    {shouldShowTimerOnly && (
                        <div className="p-8 text-center">
                            {/* Session Info */}
                            <div className="mb-6">
                                <h1 className="text-2xl font-light text-gray-800 mb-2">
                                    {current.type === 'focus' ? 'Focus Time' :
                                        current.type === 'shortBreak' ? 'Short Break' :
                                            'Long Break'}
                                </h1>
                                <div className="flex justify-center gap-2 mb-4">
                                    {Array.from({ length: session.config.totalSessions }).map((_, index) => (
                                        <div
                                            key={index}
                                            className={`w-3 h-8 rounded-full ${index < session.sessionCount
                                                ? (current.type === 'focus' ? 'bg-blue-500' : 'bg-red-500')
                                                : 'bg-gray-300'
                                                }`}
                                        />
                                    ))}
                                </div>
                            </div>

                            {/* Large Timer */}
                            <div className="relative w-64 h-64 mx-auto mb-8">
                                <CircularProgressbar
                                    styles={{
                                        path: {
                                            stroke: current.type === 'focus' ? '#3B82F6' : '#F63B3E',
                                            strokeWidth: 4
                                        },
                                        trail: { stroke: '#E5E7EB' }
                                    }}
                                    value={current.start - timeLeft}
                                    maxValue={current.start}
                                />
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                    <span className="text-4xl font-bold text-gray-900 mb-2">
                                        {formatTime(timeLeft)}
                                    </span>
                                    <span className="text-sm text-gray-600">
                                        {current.type === 'focus' ? 'Stay focused!' :
                                            current.type === 'shortBreak' ? 'Take a break' : 'Long break time'}
                                    </span>
                                </div>
                            </div>

                            {/* Timer Controls */}
                            <div className="flex justify-center gap-4">
                                <button
                                    onClick={() => dispatch({ type: 'START' })}
                                    disabled={isRunning}
                                    className={`px-6 py-3 rounded-full font-medium transition-colors ${isRunning
                                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                        : 'bg-blue-500 text-white hover:bg-blue-600'
                                        }`}
                                >
                                    <Play className="w-5 h-5 inline mr-2" />
                                    Start
                                </button>
                                <button
                                    onClick={() => dispatch({ type: 'STOP' })}
                                    disabled={!isRunning}
                                    className={`px-6 py-3 rounded-full font-medium transition-colors ${!isRunning
                                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                        : 'bg-red-500 text-white hover:bg-red-600'
                                        }`}
                                >
                                    <Pause className="w-5 h-5 inline mr-2" />
                                    Pause
                                </button>
                            </div>

                            {/* Spotify Connect Button */}
                            {!isAuthenticated && (
                                <div className="mt-8 pt-6 border-t border-gray-200">
                                    <button
                                        onClick={handleSpotifyConnect}
                                        className="bg-green-500 text-white px-6 py-3 rounded-full font-medium hover:bg-green-600 transition-colors"
                                    >
                                        🎵 Connect Spotify
                                    </button>
                                    <p className="text-xs text-gray-500 mt-2">
                                        Connect to play music during breaks
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
