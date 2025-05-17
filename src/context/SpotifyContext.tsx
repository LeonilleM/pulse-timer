import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

interface SpotifyTokens {
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
}

interface SpotifyContextType {
    isAuthenticated: boolean;
    tokens: SpotifyTokens | null;
    login: () => Promise<void>;
    logout: () => void;
    setTokens: (tokens: SpotifyTokens | null) => void;
}

const SpotifyContext = createContext<SpotifyContextType | undefined>(undefined);

export const SpotifyProvider = ({ children }: { children: ReactNode }) => {
    const [tokens, setTokens] = useState<SpotifyTokens | null>(() => {
        try {
            const storedTokens = localStorage.getItem('spotifyTokens');
            return storedTokens ? JSON.parse(storedTokens) : null;
        } catch (error) {
            console.error('Error parsing stored tokens:', error);
            return null;
        }
    });

    const isAuthenticated = tokens !== null && tokens.expiresAt > Date.now();

    const refreshToken = useCallback(async () => {
        if (!tokens?.refreshToken) return;

        try {
            const newTokens = await window.electronAPI.spotifyAPI.refreshToken(tokens.refreshToken);
            const updatedTokens = {
                accessToken: newTokens.accessToken,
                refreshToken: tokens.refreshToken,
                expiresAt: Date.now() + newTokens.expiresIn * 1000,
            };
            setTokens(updatedTokens);
            localStorage.setItem('spotifyTokens', JSON.stringify(updatedTokens));
        } catch (error) {
            console.error('Failed to refresh token:', error);
            logout();
        }
    }, [tokens]);

    useEffect(() => {
        if (tokens && tokens.expiresAt < Date.now()) {
            refreshToken();
        }
    }, [tokens, refreshToken]);

    const login = async () => {
        try {
            // Clear any existing tokens before login
            localStorage.removeItem('spotifyTokens');

            const result = await window.electronAPI.spotifyAPI.login();
            console.log('Login result:', result);

            if (!result) {
                throw new Error('No response received from Spotify API');
            }

            if (!result.accessToken || !result.refreshToken) {
                console.error('Invalid response structure:', result);
                throw new Error('Invalid response structure from Spotify API');
            }

            const newTokens = {
                accessToken: result.accessToken,
                refreshToken: result.refreshToken,
                expiresAt: Date.now() + (result.expiresIn * 1000),
            };
            setTokens(newTokens);
            localStorage.setItem('spotifyTokens', JSON.stringify(newTokens));
        } catch (error) {
            console.error('Login failed:', error);
            // Clear any partial state
            localStorage.removeItem('spotifyTokens');
            setTokens(null);
            throw error;
        }
    };

    const logout = () => {
        // Clear all Spotify-related localStorage items
        localStorage.removeItem('spotifyTokens');
        localStorage.removeItem('com.spotify.single.item.cache:accounts-sso');
        localStorage.removeItem('_grecaptcha');

        // Clear tokens state
        setTokens(null);
    };

    return (
        <SpotifyContext.Provider value={{ isAuthenticated, tokens, login, logout, setTokens }}>
            {children}
        </SpotifyContext.Provider>
    );
};

export const useSpotify = () => {
    const context = useContext(SpotifyContext);
    if (context === undefined) {
        throw new Error('useSpotify must be used within a SpotifyProvider');
    }
    return context;
}; 