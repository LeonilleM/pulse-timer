import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import Timer from './pages/Timer'
import Callback from './pages/Callback'
import { SpotifyProvider } from './context/SpotifyContext'

export default function App() {
  return (
    <SpotifyProvider>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/timer" element={<Timer />} />
        <Route path="/callback" element={<Callback />} />
      </Routes>
    </SpotifyProvider>
  )
}