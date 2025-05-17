import { useLocation, useNavigate } from 'react-router-dom';
import { useReducer, useEffect, useRef, useState } from 'react';
import { pomodoroReducer } from '../components/pomodoroSession';
import Alarm from '../assets/audio/lofi-alarm.mp3'
import { Pause, Play, SkipBack, SkipForward } from 'lucide-react';
import { CircularProgressbar } from 'react-circular-progressbar';
import 'react-circular-progressbar/dist/styles.css';
import ResizeWindowButton from '../components/resizeWindowButton';
import { useSpotify } from '../context/SpotifyContext';

interface Track {
    id: string,
    name: string,
    uri: string,
    artists: Array<{ name: string }>
    album: {
        images: Array<{ url: string }>;
        uri: string
    };
}

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
    const [searchResults, setSearchResults] = useState<Track[]>([]);

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

    const searchSong = async (userSearch: string) => {
        if (!tokens?.accessToken) {
            console.error('Access token is missing');
            return;
        }

        try {
            const query = encodeURIComponent(userSearch);
            const response = await fetch(`https://api.spotify.com/v1/search?q=${query}&type=track&limit=5`, {
                headers: { 'Authorization': `Bearer ${tokens.accessToken}` },
            });

            if (!response.ok) {
                console.error('Failed to fetch tracks:', await response.json());
                return;
            }

            const { tracks } = await response.json();
            setSearchResults(tracks.items); // Store tracks in state
        } catch (error) {
            console.error('Error searching for tracks:', error);
        }
    };

    const playSongWithAutoplay = async (trackUri: string, contextUri: string) => {
        if (!tokens?.accessToken) {
            console.error('Access token is missing');
            return;
        }

        try {
            const response = await fetch('https://api.spotify.com/v1/me/player/play', {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${tokens.accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    context_uri: contextUri,
                    offset: { uri: trackUri },
                }),
            });

            if (!response.ok) {
                console.error('Failed to play song with autoplay:', await response.json());
            } else {
                console.log('Song is now playing with autoplay enabled');
            }
        } catch (error) {
            console.error('Error playing song with autoplay:', error);
        }
    };

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

    return (
        <div className="md:min-h-screen h-[57px] flex md:flex-col  items-center py-0.5  overflow-y-hidden">
            <button className="absolute top-0 left-0 text-xs" onClick={() => navigate('/')}>
                {`<`}
            </button>
            <ResizeWindowButton />
            {isAuthenticated && currentlyPlaying && (
                <div className="md:ml-0 ml-6   md:mt-4 mt-0 xl:px-64 md:px-32 p-1 flex items-center md:gap-4 gap-2 md:w-full w-[55%]">

                    <img
                        src={currentlyPlaying.item.album.images[0]?.url}
                        alt="Album cover"
                        className="md:w-24 md:h-24 w-11 h-11 rounded"
                    />
                    <div className="flex-1  break-words whitespace-normal ">
                        <h3 className="md:text-2xl text-[10px] font-semibold break-words">{currentlyPlaying.item.name}</h3>
                        <p className="md:text-lg text-[8px] break-words">{currentlyPlaying.item.artists.map(artist => artist.name).join(', ')}</p>
                    </div>
                    <div className="relative md:block hidden">
                        <input

                            type="text"
                            placeholder="Search for a song"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    searchSong(e.currentTarget.value);
                                }
                            }}
                            className="border px-4 py-2 rounded-lg"
                        />
                        {/* Display Search Results */}
                        {searchResults.length > 0 && (
                            <div className="absolute top-12 right-0 bg-white shadow-md rounded p-4 w-64 z-50">
                                <button
                                    onClick={() => setSearchResults([])} // Clear search results
                                    className="text-red-500 hover:text-red-700"
                                >
                                    Close
                                </button>
                                <h3 className="font-semibold mb-2">Search Results:</h3>
                                <ul>
                                    {searchResults.map((track) => (
                                        <li key={track.id} className="mb-2">
                                            <div
                                                onClick={() => playSongWithAutoplay(track.uri, track.album.uri)}
                                                className="flex items-center gap-2
                                                hover:bg-gray-200 cursor-pointer">
                                                <img
                                                    src={track.album.images[0]?.url}
                                                    alt={track.name}
                                                    className="w-10 h-10 rounded"
                                                />
                                                <div>
                                                    <p className="text-sm font-medium">{track.name}</p>
                                                    <p className="text-xs text-gray-500">
                                                        {track.artists.map((artist) => artist.name).join(', ')}
                                                    </p>
                                                </div>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => handlePlaybackControl('previous')}
                            className="text-gray-600 hover:text-gray-900"
                        >
                            <SkipBack className="md:w-12 md:h-12" />
                        </button>
                        <button
                            onClick={() => handlePlaybackControl(currentlyPlaying.is_playing ? 'pause' : 'play')}
                            className="text-gray-600 hover:text-gray-900"
                        >
                            {currentlyPlaying.is_playing ? <Pause className="md:w-12 md:h-12" /> : <Play className="md:w-12 md:h-12" />}
                        </button>
                        <button
                            onClick={() => handlePlaybackControl('next')}
                            className="text-gray-600 hover:text-gray-900"
                        >
                            <SkipForward className="md:w-12 md:h-12" />
                        </button>
                    </div>

                </div>
            )}
            <div className="md:block hidden h-40 my-2 w-full">
                {/* Progress Bar */}
                <div className="flex flex-col items-center w-full mt-2 px-64">
                    <div className="w-full bg-gray-300 rounded-full h-2.5">
                        <div
                            className="bg-focus-c h-2.5 rounded-full transition-all duration-300"
                            style={{
                                width: `${currentlyPlaying ? ((currentlyPlaying.progress_ms ?? 0) / currentlyPlaying.item.duration_ms) * 100 : 0
                                    }%`,
                            }}
                        ></div>
                    </div>
                    <div className="flex justify-between w-full text-xs mt-1 text-gray-600">
                        <span>{currentlyPlaying ? songFormatTime(currentlyPlaying.progress_ms) : '0:00'}</span>
                        <span>{currentlyPlaying ? songFormatTime(currentlyPlaying.item.duration_ms) : '0:00'}</span>
                    </div>
                </div>
            </div>
            <div className="flex md:flex-col  items-center  md:mx-0 md:w-full w-1/2 px-4 border-l-2 ">
                <div className="relative md:w-[500px] md:h-[500px] w-[52px] h-[52px] order-2 md:ml-0 ml-auto">
                    <div className="md:w-[500px] md:h-[500px] border-t-2 rounded-t-full absolute -translate-x-8 -top-8 -rotate-45"> </div>
                    <div className="absolute md:top-24 md:left-1/2 -left-2/3 -translate-x-2/3  flex flex-col items-center">
                        <h1 className="md:text-2xl text-xs font-extralight">
                            {current.type === 'focus' ? 'Focus' :
                                current.type === 'shortBreak' ? 'Short Break' :
                                    'Long Break'}
                        </h1>
                        <div className="flex gap-4">
                            {Array.from({ length: session.config.totalSessions }).map((_, index) => (
                                <div
                                    key={index}
                                    className={`w-1 md:h-10 h-4 rounded-full ${index < session.sessionCount ? current.type === 'focus'
                                        ? 'bg-focus-c' : 'bg-break-c' : 'bg-gray-300'}`}>
                                </div>
                            ))}
                        </div>
                    </div>
                    <CircularProgressbar
                        styles={{
                            path: { stroke: current.type !== 'focus' ? '#F63B3E' : '#3B82F6' },
                        }}
                        value={current.start - timeLeft} maxValue={current.start} strokeWidth={5} />
                    <h1 className="md:text-5xl text-xs font-bold absolute md:top-2/3 top-1/2 left-1/2  -translate-x-1/2 -translate-y-1/2 z-20">
                        {formatTime(timeLeft)}
                    </h1>
                    <div className="md:w-[500px] md:h-[500px] border-b-2 rounded-b-full absolute translate-x-8 -bottom-8 -rotate-45"> </div>
                </div>
                <div className="flex md:space-x-24 space-x-2 md:order-2 order:1 md:my-12">
                    <button
                        className={`text-focus-c ${isRunning ? 'cursor-not-allowed opacity-80' : ''}`}
                        onClick={() => dispatch({ type: 'START' })}
                        disabled={isRunning}
                    >
                        <Play className="md:w-14 md:h-14" />
                    </button>
                    <button
                        className={`rounded text-focus-c  ${isRunning ? '' : 'cursor-not-allowed opacity-80'}`}
                        onClick={() => dispatch({ type: 'STOP' })}
                        disabled={!isRunning}
                    >
                        <Pause className="md:w-12 md:h-12" />
                    </button>
                </div>
            </div>
            <div className="absolute top-0 left-[30%] p-2">
                {!isAuthenticated && (
                    <button
                        onClick={handleSpotifyConnect}
                        className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
                    >
                        Connect Spotify
                    </button>
                )}
            </div>

        </div>
    );
}
