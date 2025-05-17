import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createSession } from '../components/pomodoroSession';
import CounterButton from '../components/counterButton';
import { useSpotify } from '../context/SpotifyContext';

function Home() {
    const { isAuthenticated, login } = useSpotify();
    const [focusDuration, setFocusDuration] = useState(35);
    const [shortBreakDuration, setShortBreakDuration] = useState(10);
    const [longBreakDuration, setLongBreakDuration] = useState(20);
    const [breakInterval, setBreakInterval] = useState(2);
    const [totalSessions, setTotalSessions] = useState(4);

    const navigate = useNavigate();

    const handleStart = () => {
        // Create the session object
        const session = createSession({
            focusDuration,
            shortBreakDuration,
            longBreakDuration,
            breakInterval,
            totalSessions,
        });

        navigate('/timer', { state: { session } });
    };

    const handleSpotifyConnect = async () => {
        try {
            await login();
        } catch (error) {
            console.error('Failed to connect to Spotify:', error);
        }
    };

    return (
        <>
            <div className="bg-primary">
                <section className="container mx-auto items-center justify-center flex flex-col md:h-screen">
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
                    <div className="flex flex-col md:space-y-6 w-full px-20 items-center justify-center">
                        <CounterButton
                            label="Focus Session"
                            value={focusDuration}
                            unit="min"
                            onIncrement={() => setFocusDuration((prev) => prev + 5)}
                            onDecrement={() => setFocusDuration((prev) => Math.max(prev - 5, 5))}
                        />
                        <CounterButton
                            label="Short Break"
                            value={shortBreakDuration}
                            unit="min"
                            onIncrement={() => setShortBreakDuration((prev) => Math.min(prev + 1, 10))}
                            onDecrement={() => setShortBreakDuration((prev) => Math.max(prev - 1, 5))}
                        />
                        <CounterButton
                            label="Long Break"
                            value={longBreakDuration}
                            unit="min"
                            onIncrement={() => setLongBreakDuration((prev) => Math.min(prev + 1, 25))}
                            onDecrement={() => setLongBreakDuration((prev) => Math.max(prev - 1, 15))}
                        />
                        <CounterButton
                            label="Long Break After"
                            value={breakInterval}
                            unit="sesh"
                            onIncrement={() => setBreakInterval((prev) => Math.min(prev + 1, totalSessions))}
                            onDecrement={() => setBreakInterval((prev) => Math.max(prev - 1, 1))}
                        />
                        <CounterButton
                            label="Sessions"
                            value={totalSessions}
                            unit="sesh"
                            onIncrement={() => {
                                setTotalSessions((prev) => Math.min(prev + 1, 6));
                                if (breakInterval > totalSessions) {
                                    setBreakInterval(totalSessions);
                                }
                            }}
                            onDecrement={() => setTotalSessions((prev) => Math.max(prev - 1, 1))}
                        />
                    </div>
                    <button
                        onClick={handleStart}
                        className="mt-8 px-6 py-3 bg-blue-500 text-white rounded-lg"
                    >
                        Start
                    </button>
                </section>
            </div>
        </>
    );
}

export default Home;