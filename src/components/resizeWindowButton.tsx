import { useState } from 'react'
import { Minimize2, Square, Maximize2, Monitor } from 'lucide-react'

export default function ResizeWindowButton() {
    const [currentSize, setCurrentSize] = useState(0); // 0 = default, 1 = compact, 2 = mini, 3 = medium, 4 = fullscreen

    const handleResize = (size: number) => {
        setCurrentSize(size);
        window.electronAPI?.resizeWindow?.resize(size); // Send the resize event to the main process
    };

    const sizeOptions = [
        { id: 4, icon: Monitor, tooltip: 'Fullscreen', size: 'w-8 h-8' },
        { id: 0, icon: Square, tooltip: 'Default', size: 'w-6 h-6' },
        { id: 3, icon: Maximize2, tooltip: 'Medium Widget', size: 'w-5 h-5' },
        { id: 1, icon: Minimize2, tooltip: 'Compact Widget', size: 'w-4 h-4' },
        { id: 2, icon: Minimize2, tooltip: 'Mini Widget', size: 'w-3 h-3' },
    ];

    return (
        <div className="fixed top-4 right-4 z-50 bg-white/90 backdrop-blur-sm rounded-xl p-2 shadow-lg border border-gray-200">
            <div className="flex gap-1">
                {sizeOptions.map(({ id, icon: Icon, tooltip, size }) => (
                    <button
                        key={id}
                        className={`p-2 rounded-lg transition-all duration-200 ${currentSize === id
                                ? 'bg-blue-500 text-white shadow-md'
                                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                            }`}
                        onClick={() => handleResize(id)}
                        title={tooltip}
                    >
                        <Icon className={size} />
                    </button>
                ))}
            </div>
        </div>
    );
}