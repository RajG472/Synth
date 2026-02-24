import React, { useState, useCallback, useEffect } from 'react';

interface KeyboardProps {
  onNoteOn: (frequency: number) => void;
  onNoteOff: () => void;
}

const notes = [
  { note: 'C', frequency: 261.63, isBlack: false, key: 'a' },
  { note: 'C#', frequency: 277.18, isBlack: true, key: 'w' },
  { note: 'D', frequency: 293.66, isBlack: false, key: 's' },
  { note: 'D#', frequency: 311.13, isBlack: true, key: 'e' },
  { note: 'E', frequency: 329.63, isBlack: false, key: 'd' },
  { note: 'F', frequency: 349.23, isBlack: false, key: 'f' },
  { note: 'F#', frequency: 369.99, isBlack: true, key: 't' },
  { note: 'G', frequency: 392.00, isBlack: false, key: 'g' },
  { note: 'G#', frequency: 415.30, isBlack: true, key: 'y' },
  { note: 'A', frequency: 440.00, isBlack: false, key: 'h' },
  { note: 'A#', frequency: 466.16, isBlack: true, key: 'u' },
  { note: 'B', frequency: 493.88, isBlack: false, key: 'j' },
  { note: 'C5', frequency: 523.25, isBlack: false, key: 'k' },
];

export function Keyboard({ onNoteOn, onNoteOff }: KeyboardProps) {
  const [pressedKeys, setPressedKeys] = useState<Set<string>>(new Set());
  const [activeNote, setActiveNote] = useState<string | null>(null);

  const playNote = useCallback((note: typeof notes[0]) => {
    if (activeNote === note.note) return;
    
    onNoteOff(); // Stop current note
    onNoteOn(note.frequency);
    setActiveNote(note.note);
  }, [onNoteOn, onNoteOff, activeNote]);

  const stopNote = useCallback(() => {
    onNoteOff();
    setActiveNote(null);
  }, [onNoteOff]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (pressedKeys.has(e.key)) return;
    
    const note = notes.find(n => n.key === e.key.toLowerCase());
    if (note) {
      setPressedKeys(prev => new Set(prev).add(e.key));
      playNote(note);
    }
  }, [pressedKeys, playNote]);

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    const note = notes.find(n => n.key === e.key.toLowerCase());
    if (note) {
      setPressedKeys(prev => {
        const newSet = new Set(prev);
        newSet.delete(e.key);
        return newSet;
      });
      stopNote();
    }
  }, [stopNote]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);

  return (
    <div className="relative">
      <h3 className="text-lg font-semibold mb-4">Keyboard</h3>
      <div className="relative flex bg-gray-800 p-4 rounded-lg">
        {/* White keys */}
        <div className="flex">
          {notes.filter(note => !note.isBlack).map((note) => (
            <button
              key={note.note}
              className={`w-12 h-32 bg-white border border-gray-300 rounded-b-lg mr-1 transition-colors ${
                activeNote === note.note ? 'bg-blue-200' : 'hover:bg-gray-100'
              }`}
              onMouseDown={() => playNote(note)}
              onMouseUp={stopNote}
              onMouseLeave={stopNote}
            >
              <div className="flex flex-col justify-end h-full p-2">
                <span className="text-xs text-gray-600">{note.note}</span>
                <span className="text-xs text-gray-400">{note.key}</span>
              </div>
            </button>
          ))}
        </div>
        
        {/* Black keys */}
        <div className="absolute flex ml-2">
          {notes.filter(note => note.isBlack).map((note, index) => {
            const whiteKeysBefore = notes.slice(0, notes.indexOf(note)).filter(n => !n.isBlack).length;
            const offset = whiteKeysBefore * 52 - 8; // 52px = white key width + margin, 8px = half black key width
            
            return (
              <button
                key={note.note}
                className={`absolute w-8 h-20 bg-gray-900 border border-gray-700 rounded-b-lg transition-colors ${
                  activeNote === note.note ? 'bg-blue-800' : 'hover:bg-gray-700'
                }`}
                style={{ left: `${offset}px` }}
                onMouseDown={() => playNote(note)}
                onMouseUp={stopNote}
                onMouseLeave={stopNote}
              >
                <div className="flex flex-col justify-end h-full p-1">
                  <span className="text-xs text-white">{note.note}</span>
                  <span className="text-xs text-gray-400">{note.key}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
      <p className="text-sm text-gray-400 mt-2">
        Use your keyboard: A-K keys for notes, W-U for sharps/flats
      </p>
    </div>
  );
}
