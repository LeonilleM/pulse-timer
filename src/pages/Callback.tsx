import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useSpotify } from '../context/SpotifyContext';

function Callback() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const code = searchParams.get('code');
    const { setTokens } = useSpotify();
    const [isExchanging, setIsExchanging] = useState(false);

    useEffect(() => {
        if (code && !isExchanging) {
            console.log('Received authorization code:', code);
            setIsExchanging(true);

            // Exchange the code for tokens directly
            window.electronAPI.spotifyAPI.exchangeCode(code)
                .then((result) => {
                    console.log('Token exchange result:', result);
                    if (result && result.accessToken && result.refreshToken) {
                        const newTokens = {
                            accessToken: result.accessToken,
                            refreshToken: result.refreshToken,
                            expiresAt: Date.now() + (result.expiresIn * 1000),
                        };
                        setTokens(newTokens);
                        localStorage.setItem('spotifyTokens', JSON.stringify(newTokens));
                        console.log('Successfully exchanged code for tokens');

                        // Retrieve the stored session
                        const storedSession = localStorage.getItem('currentSession');
                        const sessionState = storedSession ? { session: JSON.parse(storedSession) } : null;

                        // Navigate back with the session
                        navigate('/timer', { state: sessionState });
                    } else {
                        throw new Error('Invalid token response');
                    }
                })
                .catch((error) => {
                    console.error('Error during token exchange:', error);
                    // Log the full error details
                    if (error instanceof Error) {
                        console.error('Error details:', {
                            message: error.message,
                            stack: error.stack,
                        });
                    }
                    navigate('/timer', { state: { error: 'Failed to exchange code for tokens' } });
                })
                .finally(() => {
                    setIsExchanging(false);
                    // Clean up the stored session
                    localStorage.removeItem('currentSession');
                });
        } else if (!code) {
            console.error('No authorization code received');
            navigate('/timer', { state: { error: 'No authorization code received' } });
        }
    }, [code, setTokens, navigate, isExchanging]);

    return <div>Finishing Spotify login…</div>;
}

export default Callback;