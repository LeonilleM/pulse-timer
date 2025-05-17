import { useState } from 'react'

export default function ResizeWindowButton() {
    const [currentSize, setCurrentSize] = useState(0); // 0 = default, 1 = compact, 2 = full-view

    const handleResize = (size: number) => {
        setCurrentSize(size);
        window.electronAPI?.resizeWindow?.resize(size); // Send the resize event to the main process
    };

    return (
        <div className="flex flex-col space-y-1.5 mt-5 absolute left-0">
            <button
                className={`w-4 h-1 rounded-r-md ${currentSize === 1 ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
                onClick={() => handleResize(1)}
            >
            </button>
            <button
                className={` w-5 h-1 rounded-r-md ${currentSize === 0 ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
                onClick={() => handleResize(0)}
            >
            </button>
            <button
                className={`w-6 h-1 rounded-r-md  ${currentSize === 2 ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
                onClick={() => handleResize(2)}
            >
            </button>
        </div >
    );
}