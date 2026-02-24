import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Knob } from './Knob';
import { Keyboard } from './Keyboard';

interface SynthParams {
  oscillator: {
    type: OscillatorType;
    frequency: number;
    detune: number;
  };
  filter: {
    type: BiquadFilterType;
    frequency: number;
    Q: number;
  };
  envelope: {
    attack: number;
    decay: number;
    sustain: number;
    release: number;
  };
  effects: {
    reverb: number;
    delay: number;
    distortion: number;
  };
  volume: number;
}

const defaultParams: SynthParams = {
  oscillator: {
    type: 'sawtooth',
    frequency: 440,
    detune: 0,
  },
  filter: {
    type: 'lowpass',
    frequency: 2000,
    Q: 1,
  },
  envelope: {
    attack: 0.1,
    decay: 0.3,
    sustain: 0.7,
    release: 0.5,
  },
  effects: {
    reverb: 0.2,
    delay: 0.1,
    distortion: 0,
  },
  volume: 0.5,
};

export function Synthesizer() {
  const [params, setParams] = useState<SynthParams>(defaultParams);
  const [presetName, setPresetName] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const filterNodeRef = useRef<BiquadFilterNode | null>(null);
  const reverbNodeRef = useRef<ConvolverNode | null>(null);
  const delayNodeRef = useRef<DelayNode | null>(null);
  const distortionNodeRef = useRef<WaveShaperNode | null>(null);

  const presets = useQuery(api.synth.getPresets);
  const savePreset = useMutation(api.synth.savePreset);
  const deletePreset = useMutation(api.synth.deletePreset);

  // Initialize audio context
  useEffect(() => {
    audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  // Create impulse response for reverb
  const createImpulseResponse = useCallback((duration: number, decay: number) => {
    if (!audioContextRef.current) return null;
    
    const sampleRate = audioContextRef.current.sampleRate;
    const length = sampleRate * duration;
    const impulse = audioContextRef.current.createBuffer(2, length, sampleRate);
    
    for (let channel = 0; channel < 2; channel++) {
      const channelData = impulse.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        channelData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
      }
    }
    
    return impulse;
  }, []);

  // Create distortion curve
  const createDistortionCurve = useCallback((amount: number) => {
    const samples = 44100;
    const curve = new Float32Array(samples);
    const deg = Math.PI / 180;
    
    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1;
      curve[i] = ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x));
    }
    
    return curve;
  }, []);

  const playNote = useCallback((frequency: number) => {
    if (!audioContextRef.current) return;

    // Stop previous note
    stopNote();

    const ctx = audioContextRef.current;
    
    // Create nodes
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    const filterNode = ctx.createBiquadFilter();
    const reverbNode = ctx.createConvolver();
    const delayNode = ctx.createDelay();
    const delayGain = ctx.createGain();
    const distortionNode = ctx.createWaveShaper();
    const masterGain = ctx.createGain();

    // Configure oscillator
    oscillator.type = params.oscillator.type;
    oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);
    oscillator.detune.setValueAtTime(params.oscillator.detune, ctx.currentTime);

    // Configure filter
    filterNode.type = params.filter.type;
    filterNode.frequency.setValueAtTime(params.filter.frequency, ctx.currentTime);
    filterNode.Q.setValueAtTime(params.filter.Q, ctx.currentTime);

    // Configure envelope
    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(params.volume, ctx.currentTime + params.envelope.attack);
    gainNode.gain.linearRampToValueAtTime(
      params.volume * params.envelope.sustain,
      ctx.currentTime + params.envelope.attack + params.envelope.decay
    );

    // Configure reverb
    const impulse = createImpulseResponse(2, params.effects.reverb * 10);
    if (impulse) {
      reverbNode.buffer = impulse;
    }

    // Configure delay
    delayNode.delayTime.setValueAtTime(0.3, ctx.currentTime);
    delayGain.gain.setValueAtTime(params.effects.delay, ctx.currentTime);

    // Configure distortion
    if (params.effects.distortion > 0) {
      distortionNode.curve = createDistortionCurve(params.effects.distortion * 100);
      distortionNode.oversample = '4x';
    }

    // Configure master volume
    masterGain.gain.setValueAtTime(params.volume, ctx.currentTime);

    // Connect nodes
    oscillator.connect(filterNode);
    
    if (params.effects.distortion > 0) {
      filterNode.connect(distortionNode);
      distortionNode.connect(gainNode);
    } else {
      filterNode.connect(gainNode);
    }

    // Dry signal
    gainNode.connect(masterGain);

    // Reverb send
    if (params.effects.reverb > 0) {
      gainNode.connect(reverbNode);
      reverbNode.connect(masterGain);
    }

    // Delay send
    if (params.effects.delay > 0) {
      gainNode.connect(delayNode);
      delayNode.connect(delayGain);
      delayGain.connect(delayNode); // Feedback
      delayGain.connect(masterGain);
    }

    masterGain.connect(ctx.destination);

    // Store references
    oscillatorRef.current = oscillator;
    gainNodeRef.current = gainNode;
    filterNodeRef.current = filterNode;

    // Start oscillator
    oscillator.start();
    setIsPlaying(true);
  }, [params, createImpulseResponse, createDistortionCurve]);

  const stopNote = useCallback(() => {
    if (oscillatorRef.current && gainNodeRef.current && audioContextRef.current) {
      const ctx = audioContextRef.current;
      const releaseTime = params.envelope.release;
      
      gainNodeRef.current.gain.cancelScheduledValues(ctx.currentTime);
      gainNodeRef.current.gain.setValueAtTime(gainNodeRef.current.gain.value, ctx.currentTime);
      gainNodeRef.current.gain.linearRampToValueAtTime(0, ctx.currentTime + releaseTime);
      
      oscillatorRef.current.stop(ctx.currentTime + releaseTime);
      oscillatorRef.current = null;
      gainNodeRef.current = null;
      filterNodeRef.current = null;
      setIsPlaying(false);
    }
  }, [params.envelope.release]);

  const updateParam = (category: keyof SynthParams, param: string, value: number | string) => {
    setParams(prev => ({
      ...prev,
      [category]: {
        ...(prev[category] as any),
        [param]: value,
      },
    }));
  };

  const handleSavePreset = async () => {
    if (!presetName.trim()) return;
    
    try {
      await savePreset({
        name: presetName,
        ...params,
      });
      setPresetName('');
    } catch (error) {
      console.error('Failed to save preset:', error);
    }
  };

  const loadPreset = (preset: any) => {
    setParams({
      oscillator: preset.oscillator,
      filter: preset.filter,
      envelope: preset.envelope,
      effects: preset.effects,
      volume: preset.volume,
    });
  };

  return (
    <div className="w-full max-w-6xl mx-auto p-6 bg-gray-900 text-white rounded-lg">
      <h1 className="text-3xl font-bold mb-6 text-center">Web Synthesizer</h1>
      
      {/* Oscillator Section */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Oscillator</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm mb-2">Waveform</label>
            <select
              value={params.oscillator.type}
              onChange={(e) => updateParam('oscillator', 'type', e.target.value)}
              className="w-full p-2 bg-gray-800 rounded"
            >
              <option value="sine">Sine</option>
              <option value="square">Square</option>
              <option value="sawtooth">Sawtooth</option>
              <option value="triangle">Triangle</option>
            </select>
          </div>
          <Knob
            label="Frequency"
            value={params.oscillator.frequency}
            min={20}
            max={2000}
            onChange={(value) => updateParam('oscillator', 'frequency', value)}
          />
          <Knob
            label="Detune"
            value={params.oscillator.detune}
            min={-100}
            max={100}
            onChange={(value) => updateParam('oscillator', 'detune', value)}
          />
        </div>
      </div>

      {/* Filter Section */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Filter</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm mb-2">Type</label>
            <select
              value={params.filter.type}
              onChange={(e) => updateParam('filter', 'type', e.target.value)}
              className="w-full p-2 bg-gray-800 rounded"
            >
              <option value="lowpass">Low Pass</option>
              <option value="highpass">High Pass</option>
              <option value="bandpass">Band Pass</option>
            </select>
          </div>
          <Knob
            label="Cutoff"
            value={params.filter.frequency}
            min={20}
            max={20000}
            onChange={(value) => updateParam('filter', 'frequency', value)}
          />
          <Knob
            label="Resonance"
            value={params.filter.Q}
            min={0.1}
            max={30}
            onChange={(value) => updateParam('filter', 'Q', value)}
          />
        </div>
      </div>

      {/* Envelope Section */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Envelope</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Knob
            label="Attack"
            value={params.envelope.attack}
            min={0.01}
            max={2}
            onChange={(value) => updateParam('envelope', 'attack', value)}
          />
          <Knob
            label="Decay"
            value={params.envelope.decay}
            min={0.01}
            max={2}
            onChange={(value) => updateParam('envelope', 'decay', value)}
          />
          <Knob
            label="Sustain"
            value={params.envelope.sustain}
            min={0}
            max={1}
            onChange={(value) => updateParam('envelope', 'sustain', value)}
          />
          <Knob
            label="Release"
            value={params.envelope.release}
            min={0.01}
            max={3}
            onChange={(value) => updateParam('envelope', 'release', value)}
          />
        </div>
      </div>

      {/* Effects Section */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Effects</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Knob
            label="Reverb"
            value={params.effects.reverb}
            min={0}
            max={1}
            onChange={(value) => updateParam('effects', 'reverb', value)}
          />
          <Knob
            label="Delay"
            value={params.effects.delay}
            min={0}
            max={1}
            onChange={(value) => updateParam('effects', 'delay', value)}
          />
          <Knob
            label="Distortion"
            value={params.effects.distortion}
            min={0}
            max={1}
            onChange={(value) => updateParam('effects', 'distortion', value)}
          />
          <Knob
            label="Volume"
            value={params.volume}
            min={0}
            max={1}
            onChange={(value) => setParams(prev => ({ ...prev, volume: value }))}
          />
        </div>
      </div>

      {/* Keyboard */}
      <div className="mb-8">
        <Keyboard onNoteOn={playNote} onNoteOff={stopNote} />
      </div>

      {/* Presets */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Presets</h2>
        <div className="flex gap-4 mb-4">
          <input
            type="text"
            value={presetName}
            onChange={(e) => setPresetName(e.target.value)}
            placeholder="Preset name..."
            className="flex-1 p-2 bg-gray-800 rounded"
          />
          <button
            onClick={handleSavePreset}
            disabled={!presetName.trim()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded"
          >
            Save Preset
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {presets?.map((preset) => (
            <div key={preset._id} className="flex gap-2">
              <button
                onClick={() => loadPreset(preset)}
                className="flex-1 p-2 bg-gray-700 hover:bg-gray-600 rounded text-sm"
              >
                {preset.name}
              </button>
              <button
                onClick={() => deletePreset({ presetId: preset._id })}
                className="px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-sm"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Status */}
      <div className="text-center">
        <div className={`inline-block px-4 py-2 rounded ${isPlaying ? 'bg-green-600' : 'bg-gray-600'}`}>
          {isPlaying ? 'Playing' : 'Ready'}
        </div>
      </div>
    </div>
  );
}
