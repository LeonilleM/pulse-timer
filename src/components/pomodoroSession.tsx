type IntervalType = 'focus' | 'shortBreak' | 'longBreak';

type TimerInterval = {
    type: IntervalType;
    start: number;
};

interface SessionConfig {
    focusDuration: number;
    shortBreakDuration: number;
    longBreakDuration: number | null,
    breakInterval: number;
    totalSessions: number;
}

export interface TimerSession {
    config: SessionConfig;
    intervals: TimerInterval[];
    currentIndex: number;
    completed: boolean;
    sessionCount: number
}

interface State {
    session: TimerSession;
    timeLeft: number;
    isRunning: boolean;
}

type Action =
    | { type: 'START' }
    | { type: 'STOP' }
    | { type: 'TICK' }
    | { type: 'RESTART' }


export function createSession(config: SessionConfig): TimerSession {
    const intervals: TimerInterval[] = [];

    for (let i = 1; i <= config.totalSessions; i++) {
        // Add a focus interval
        intervals.push({ type: 'focus', start: config.focusDuration * 60 });

        // Add a break interval (short or long)
        if (i % config.breakInterval === 0 && i !== config.totalSessions) {
            intervals.push({ type: 'longBreak', start: (config.longBreakDuration ?? 0) * 60 });
        } else if (i !== config.totalSessions) {
            intervals.push({ type: 'shortBreak', start: config.shortBreakDuration * 60 });
        }
    }

    return {
        config,
        intervals,
        currentIndex: 0,
        completed: false,
        sessionCount: 1
    };
}

export function pomodoroReducer(state: State, action: Action): State {
    switch (action.type) {
        case 'START':
            return { ...state, isRunning: true };

        case 'STOP':
            return { ...state, isRunning: false };

        case 'RESTART':
            return {
                ...state
            }

        case 'TICK': {
            if (state.timeLeft <= 1) {
                const nextIndex = state.session.currentIndex + 1;

                if (nextIndex >= state.session.intervals.length) {
                    return { ...state, isRunning: false, session: { ...state.session, completed: true }, timeLeft: 0 };
                }

                const currentInterval = state.session.intervals[state.session.currentIndex];

                const isBreakCompleted = (currentInterval.type === 'shortBreak' || currentInterval.type == 'longBreak') && state.session.currentIndex >= 1

                const newSession = {
                    ...state.session,
                    currentIndex: nextIndex,
                    sessionCount: isBreakCompleted ? state.session.sessionCount + 1 : state.session.sessionCount
                };
                const newInterval = newSession.intervals[nextIndex].start;
                return { session: newSession, timeLeft: newInterval, isRunning: false };
            }

            return { ...state, timeLeft: state.timeLeft - 1 };
        }

        default:
            return state;
    }
}

